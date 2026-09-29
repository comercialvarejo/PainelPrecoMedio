/* Painel de Preco Medio - Apucarana
   Logica da aplicacao. Os dados vem de data/alldb.json (carregado pelo index.html). */
const ALLDB = window.__PAINEL_DB__;
let DB = ALLDB.p1;
let periodoAtual = "p1";

/* ---------- AVATARES DE INICIAIS ---------- */
const AVATAR_PALETTE = ['#1B4B45','#C0913C','#2E9E6D','#3F7A9E','#8B5FA8','#C1473B','#5C7A70','#B08D3E'];
function avatarColor(name){
  let hash = 0;
  for(let i=0;i<name.length;i++){ hash = name.charCodeAt(i) + ((hash<<5)-hash); }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function avatarInitials(name){
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function avatarHTML(name, sizeClass){
  const cls = sizeClass ? ' '+sizeClass : '';
  return `<span class="avatar${cls}" style="background:${avatarColor(name)}">${avatarInitials(name)}</span>`;
}

/* ---------- FAVORITOS (clientes/produtos) ---------- */
function loadFavSet(key){
  try{ return new Set(JSON.parse(localStorage.getItem(key)||'[]')); }catch(e){ return new Set(); }
}
function saveFavSet(key, set){
  try{ localStorage.setItem(key, JSON.stringify([...set])); }catch(e){}
}
let favClients = loadFavSet('painelFavClientes');
let favProducts = loadFavSet('painelFavProdutos');
function toggleFav(kind, name){
  const set = kind==='cli' ? favClients : favProducts;
  const key = kind==='cli' ? 'painelFavClientes' : 'painelFavProdutos';
  if(set.has(name)) set.delete(name); else set.add(name);
  saveFavSet(key, set);
}
function sortFavFirst(names, favSet){
  return names.slice().sort((a,b)=>{
    const fa = favSet.has(a), fb = favSet.has(b);
    if(fa && !fb) return -1;
    if(!fa && fb) return 1;
    return 0;
  });
}

const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtBRL = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtN = (n,d=0) => n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtK = n => n>=1e6? 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi'
                 : n>=1e3? 'R$ '+(n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mil'
                 : fmtBRL(n);

document.getElementById('sub').textContent = DB.periodo + ' · ' + DB.filtro;

/* ---------- GESTORES ---------- */
const GESTORES = {
  'Miguel':   ['Alessandra Borgato','Juliana Castro Nascimento','Leonardo Tortola','Luiz Henrique Dos Santos','Luiz Mauro Pedroso'],
  'Rafael':   ['Alexandre Constantin Flores','Alexandre Rodrigues De Andrade','Fernando Henrique Rizzatto Neto','Jaime Roberto Orlandelli','Jonatas Wesley Rodrigues','Maicon Douglas Karpovicz','Tiago Fernando Radin'],
  'Leonardo': ['Arieli Perasoli','Fabio Morgado','Joao Vitor Arenas Marcato','Marcos Roney Fernandes','Matheus Augusto Linjardi','Maycon Rodrigo Pupulin','Octavio Augusto Ferreira','Rodrigo Glauber Zacarias','Sergio Fabiano Neiverth'],
};
// mapeia parcialmente: verifica se o nome do vendor contém qualquer parte do nome do gestor
function vendorInGestor(vName, gestor){
  if(gestor==='todos') return true;
  const lista = GESTORES[gestor];
  const vl = vName.toLowerCase();
  return lista.some(n => {
    const nl = n.toLowerCase();
    // match se o nome do vendor começa com as primeiras palavras do nome da lista
    const parts = nl.split(' ');
    return parts.slice(0,2).every(w => vl.includes(w));
  });
}
let gestorVend='todos', gestorProd='todos';

// botões aba vendedor
document.querySelectorAll('#gestV .gbtn').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#gestV .gbtn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); gestorVend=b.dataset.g;
  rebuildSelVend(); renderVendor(); renderTeamSummary();
  saveLastFilter();
});
// botões aba produto
document.querySelectorAll('#gestP .gbtn').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#gestP .gbtn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); gestorProd=b.dataset.g;
  renderProd();
});
document.querySelectorAll('#gestG .gbtn').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#gestG .gbtn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); gestorGeral=b.dataset.g;
  renderGeral();
  saveLastFilter();
});
document.getElementById('foot').innerHTML =
  'Preço médio ponderado pela quantidade (faturamento ÷ volume). '+DB.totals.nops.toLocaleString('pt-BR')+
  ' oportunidades · '+DB.filtro+'.<br>Gerado a partir do Relatório de Vendas Apucarana.'+
  '<div class="foot-corp">Confidencial · Uso interno GTF / Canção Alimentos · Atualizado em '+new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})+'</div>';

// KPIs
const T=DB.totals;
document.getElementById('kpis').innerHTML = [
  ['Faturamento', fmtK(T.fat)],
  ['Volume', fmtN(T.qtd)+' <small>kg</small>'],
  ['Vendedores', T.nvend],
  ['Produtos', T.nprod],
].map(([l,v])=>`<div class="kpi"><div class="lab">${l}</div><div class="val num">${v}</div></div>`).join('');
animateKpis();

/* ---------- TABS ---------- */
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  const t=b.dataset.t;
  document.getElementById('view-intel').style.display = t==='intel'?'':'none';
  document.getElementById('view-strategy').style.display = t==='strategy'?'':'none';
  document.getElementById('view-ai').style.display = t==='ai'?'':'none';
  document.getElementById('view-geral').style.display = t==='geral'?'':'none';
  document.getElementById('view-vend').style.display = t==='vend'?'':'none';
  document.getElementById('view-prod').style.display = t==='prod'?'':'none';
  document.getElementById('view-cli').style.display = t==='cli'?'':'none';
  document.getElementById('view-comp').style.display = t==='comp'?'':'none';
  document.getElementById('view-vvv').style.display = t==='vvv'?'':'none';
  { const _vi=document.getElementById('view-item'); if(_vi) _vi.style.display = t==='item'?'':'none'; }
  const activeSec = document.getElementById('view-'+t);
  if(activeSec){ activeSec.classList.remove('view-anim'); void activeSec.offsetWidth; activeSec.classList.add('view-anim'); }
  if(t==='intel') renderIntel();
  if(t==='strategy') renderStrategy();
  if(t==='ai') renderAI();
  if(t==='geral') renderGeral();
  if(t==='vvv') { renderVvv(); }
  if(t==='cli') { rebuildSelCli(); renderABC(); }
  if(t==='comp') { renderComp(); }
  if(t==='item') { renderItem(); }
  saveLastFilter();
});

/* ---------- POR VENDEDOR ---------- */
let vendNames = Object.keys(DB.vendors).sort((a,b)=>a.localeCompare(b,'pt-BR'));
const selV = document.getElementById('selVend');

function rebuildSelVend(){
  const filtered = vendNames.filter(v=>vendorInGestor(v, gestorVend));
  selV.innerHTML = filtered.map(v=>`<option value="${v}">${v} — ${fmtK(DB.vendors[v].fat)}</option>`).join('');
}

function renderTeamSummary(){
  const container = document.getElementById('teamSummary');
  if(gestorVend==='todos'){ container.innerHTML=''; return; }
  const teamVendors = vendNames.filter(v=>vendorInGestor(v, gestorVend));
  if(!teamVendors.length){ container.innerHTML=''; return; }
  const prodAgg = {};
  teamVendors.forEach(vn=>{
    const vd = DB.vendors[vn];
    vd.items.forEach(it=>{
      if(!prodAgg[it.produto]) prodAgg[it.produto] = {qtd:0, fat:0, ptab:it.ptab||0};
      prodAgg[it.produto].qtd += it.qtd;
      prodAgg[it.produto].fat += it.fat;
    });
  });
  let totalFat=0, qtdWithTab=0, fatWithTab=0, tabFat=0;
  let nAbove=0, nBelow=0, nEq=0;
  Object.values(prodAgg).forEach(p=>{
    totalFat += p.fat;
    if(p.ptab>0){
      const avgPrice = p.fat/p.qtd;
      const diff = avgPrice - p.ptab;
      qtdWithTab += p.qtd; fatWithTab += p.fat; tabFat += p.ptab*p.qtd;
      if(diff>0.005) nAbove++;
      else if(diff<-0.005) nBelow++;
      else nEq++;
    }
  });
  const nProdTab = nAbove+nBelow+nEq;
  const avgPriceTeam = qtdWithTab ? fatWithTab/qtdWithTab : 0;
  const avgTabTeam = qtdWithTab ? tabFat/qtdWithTab : 0;
  const diffTeam = avgPriceTeam - avgTabTeam;
  const pctTeam = avgTabTeam ? (diffTeam/avgTabTeam*100) : 0;
  const moneyImpact = fatWithTab - tabFat;
  const pos = diffTeam>=0;
  const posM = moneyImpact>=0;
  container.innerHTML = `<div class="team-summary ${pos?'pos':'neg'}">
    <div class="ts-head">
      <div class="ts-title">Equipe ${gestorVend} <span>· ${teamVendors.length} vendedores · ${nProdTab} produtos com preço de tabela</span></div>
    </div>
    <div class="ts-grid">
      <div class="ts-item"><div class="l">Faturamento da equipe</div><div class="v num">${fmtK(totalFat)}</div></div>
      <div class="ts-item"><div class="l">Preço médio vs tabela</div><div class="v num" style="color:${pos?'var(--green)':'var(--red)'}">${pos?'+':''}${fmtBRL(diffTeam)} <small>(${pos?'+':''}${pctTeam.toFixed(1)}%)</small></div></div>
      <div class="ts-item"><div class="l">Impacto no faturamento</div><div class="v num" style="color:${posM?'var(--green)':'var(--red)'}">${posM?'+':''}${fmtBRL(moneyImpact)}</div></div>
      <div class="ts-item"><div class="l">Produtos acima / abaixo</div><div class="v num">${nAbove}<small style="color:var(--green)"> acima</small> · ${nBelow}<small style="color:var(--red)"> abaixo</small></div></div>
    </div>
    <div class="ts-bd">
      <i class="b-above" style="width:${nProdTab?nAbove/nProdTab*100:0}%"></i>
      <i class="b-eq" style="width:${nProdTab?nEq/nProdTab*100:0}%"></i>
      <i class="b-below" style="width:${nProdTab?nBelow/nProdTab*100:0}%"></i>
    </div>
    <div class="ts-legend">
      <span><span class="dot" style="background:var(--green)"></span><b>${nAbove}</b> produtos acima da tabela</span>
      <span><span class="dot" style="background:#C9CFC9"></span><b>${nEq}</b> na tabela</span>
      <span><span class="dot" style="background:var(--red)"></span><b>${nBelow}</b> produtos abaixo da tabela</span>
    </div>
  </div>`;
}
rebuildSelVend();
renderTeamSummary();
let sortKey='fat', sortDir=-1;
let currentVendorItems=[], currentVendorName='';
function vendorPricingPulse(vd){
  let tableBase=0,revenue=0,loss=0,gain=0,critical=0,count=0;
  vd.items.forEach(it=>{if(!it.ptab||it.ptab<=0||!it.qtd)return;const avg=it.fat/it.qtd,diff=avg-it.ptab,pct=diff/it.ptab*100;tableBase+=it.ptab*it.qtd;revenue+=it.fat;loss+=Math.max(0,-diff*it.qtd);gain+=Math.max(0,diff*it.qtd);count++;if(pct<=-10)critical++;});
  const score=clamp(Math.round(100-(tableBase?loss/tableBase:0)*650-(count?critical/count:0)*22),0,100),tier=tierForScore(score);
  return {tableBase,revenue,loss,gain,critical,count,score,tier,index:tableBase?revenue/tableBase*100:100,net:gain-loss};
}

function renderVendor(){
  const v = selV.value, d = DB.vendors[v];
  const q = document.getElementById('qVend').value.trim().toLowerCase();
  const vhead = document.getElementById('vendHead');
  const vp=vendorPricingPulse(d);
  if(vhead) vhead.innerHTML = `<div class="vendor-profile-head"><div class="vendor-profile-person">${avatarHTML(v,'sz-lg')}<div><span class="vendor-profile-overline">Perfil executivo do vendedor</span><strong>${esc(v)}</strong><small>${vp.tier.label} · ${vp.count} produtos com referência de tabela</small></div></div><div class="vendor-profile-metrics"><div><span>Saúde de preço</span><b class="${vp.tier.cls}">${vp.score}/100</b></div><div><span>Índice vs. tabela</span><b>${vp.index.toFixed(1)}%</b></div><div><span>Vazamento</span><b class="bad">−${fmtK(vp.loss)}</b></div><div><span>Saldo do preço</span><b class="${vp.net>=0?'good':'bad'}">${fmtSignedMoney(vp.net)}</b></div></div></div>`;
  const simWrap = document.getElementById('simWrap');
  if(simWrap){ simWrap.innerHTML = renderSimulador(); wireSimulador(); }
  document.getElementById('vsum').innerHTML = [
    ['Faturamento', fmtK(d.fat), ''],
    ['Volume', fmtN(d.qtd)+' kg', ''],
    ['Produtos', d.nprod, ''],
    ['Preço médio geral', fmtBRL(d.pmed), 'amber'],
  ].map(([l,val,c])=>`<div class="box ${c}"><div class="lab">${l}</div><div class="v num">${val}</div></div>`).join('');

  let items = d.items.filter(it=>!q || it.produto.toLowerCase().includes(q));
  items = items.slice().sort((a,b)=>{
    let A=a[sortKey],B=b[sortKey];
    if(sortKey==='produto'){A=A.toLowerCase();B=B.toLowerCase();return A<B?-sortDir:A>B?sortDir:0;}
    return (A-B)*sortDir;
  });
  currentVendorItems = items; currentVendorName = v;
  const maxP = Math.max(...d.items.map(i=>i.pmed),0.0001);
  const tb=document.getElementById('vbody');
  if(!items.length){tb.innerHTML='<tr><td colspan="8" class="empty">Nenhum produto encontrado.</td></tr>';return;}
  tb.innerHTML = items.map((it,idx)=>{
    // agrupa OPs por data com subtotal
    const byDay = {};
    it.rows.forEach(o=>{ (byDay[o.data||'—']??=[]).push(o); });
    const liqCell = it.pliq!=null?`<td class="r num muted">${fmtBRL(it.pliq)}</td>`:'<td class="r num muted">—</td>';
    const det = Object.entries(byDay).map(([data,ops])=>{
      const totalQtd = ops.reduce((s,o)=>s+o.qtd,0);
      const totalFat = ops.reduce((s,o)=>s+o.fat,0);
      const rows = ops.map(o=>`
        <tr>
          <td class="d-op">${o.op}</td>
          <td class="d-cli">${esc(o.cli)}</td>
          <td class="d-data num">${o.data||''}</td>
          <td class="r num">${fmtN(o.qtd)}</td>
          <td class="r num">${fmtBRL(o.pv)}</td>
          ${liqCell}
          <td class="r num">${fmtBRL(o.fat)}</td>
        </tr>`).join('');
      return rows + `
        <tr class="day-total">
          <td colspan="3" class="day-label">Total ${data}</td>
          <td class="r num">${fmtN(totalQtd)}</td>
          <td></td>
          <td></td>
          <td class="r num">${fmtBRL(totalFat)}</td>
        </tr>`;
    }).join('');
    const pt=it.ptab||0;
    const dl=pt?(it.pmed-pt):null;
    const dlTag=dl!==null?`<div class="vstab-sm ${dl>=0?'above-g':'below-r'}">${dl>=0?'+':''}${fmtBRL(dl)}</div>`:'';
    return `
    <tr class="prow" data-idx="${idx}">
      <td><div class="prod"><span class="chev">▸</span>${it.produto}</div></td>
      <td class="r num muted">${fmtN(it.qtd)}</td>
      <td class="r num">${fmtBRL(it.fat)}</td>
      <td class="r num muted">${pt?fmtBRL(pt):'—'}</td>
      <td class="r">
        <div class="price num">${fmtBRL(it.pmed)}</div>
        ${dlTag}
        <div class="bar"><i style="width:${(it.pmed/maxP*100).toFixed(1)}%"></i></div>
      </td>
      <td class="r num muted hidem">${it.pvenda!=null?fmtBRL(it.pvenda):'—'}</td>
      <td class="r num muted hidem">${it.pliq!=null?fmtBRL(it.pliq):'—'}</td>
      <td class="r num muted hidem">${it.ops}</td>
    </tr>
    <tr class="drow" data-for="${idx}" hidden><td colspan="8">
      <div class="detail">
        <div class="dhead">${it.ops} oportunidade${it.ops>1?'s':''} · ${it.produto}</div>
        <div class="dscroll"><table class="dtab">
          <thead><tr>
            <th>Nº da OP</th><th>Cliente</th><th>Data</th>
            <th class="r">Qtd</th><th class="r">Preço venda</th><th class="r">Líq. s/ Rapel</th><th class="r">Faturamento</th>
          </tr></thead>
          <tbody>${det}</tbody>
        </table></div>
      </div>
    </td></tr>`;}).join('');
  checkTableScroll();
}
// expandir/recolher ao clicar na linha do produto
document.getElementById('vbody').addEventListener('click',e=>{
  const tr=e.target.closest('.prow'); if(!tr) return;
  const idx=tr.dataset.idx;
  const dr=document.querySelector(`#vbody .drow[data-for="${idx}"]`);
  const open=tr.classList.toggle('open');
  if(dr) dr.hidden=!open;
});
document.querySelectorAll('#view-vend thead th').forEach(th=>th.onclick=()=>{
  const k=th.dataset.s;
  if(sortKey===k) sortDir*=-1; else {sortKey=k; sortDir = k==='produto'?1:-1;}
  document.querySelectorAll('#view-vend thead th').forEach(x=>{x.classList.remove('act');x.querySelector('.ar').textContent='';});
  th.classList.add('act'); th.querySelector('.ar').textContent = sortDir<0?'▼':'▲';
  renderVendor();
});
selV.onchange=()=>{renderVendor(); saveLastFilter();};
document.getElementById('qVend').oninput=renderVendor;
renderVendor();

/* ---------- COMPARAR PRODUTO ---------- */
let prodNames = Object.keys(DB.products).sort((a,b)=>a.localeCompare(b,'pt-BR'));
let currentProdSellers=[], currentProdName='';
const selP=document.getElementById('selProd');

function rebuildSelProd(){
  const q=document.getElementById('qProd').value.trim().toLowerCase();
  let filtered=prodNames.filter(p=>!q||p.toLowerCase().includes(q));
  filtered = sortFavFirst(filtered, favProducts);
  selP.innerHTML=filtered.map(p=>`<option value="${p}">${favProducts.has(p)?'★ ':''}${p}</option>`).join('');
  renderProd();
}
document.getElementById('qProd').oninput=rebuildSelProd;
rebuildSelProd();

function renderProd(){
  const p=selP.value, d=DB.products[p];
  const allSellers = d.sellers.filter(s=>vendorInGestor(s.vend, gestorProd));
  const sellers=allSellers.slice().sort((a,b)=>a.pmed-b.pmed);
  currentProdSellers = sellers; currentProdName = p;
  if(!sellers.length){document.getElementById('cmp').innerHTML='<div class="empty" style="padding:40px;text-align:center;color:var(--muted)">Nenhum vendedor desta equipe vendeu este produto no período.</div>';return;}
  const min=Math.min(...sellers.map(s=>s.pmed)), max=Math.max(...sellers.map(s=>s.pmed));
  const avg = sellers.reduce((a,s)=>a+s.fat,0) / sellers.reduce((a,s)=>a+s.qtd,0);
  const fat = sellers.reduce((a,s)=>a+s.fat,0);
  const qtd = sellers.reduce((a,s)=>a+s.qtd,0);
  const scaleMax=max*1.04;
  const avgPct=(avg/scaleMax*100).toFixed(3);
  const rows = sellers.map((s,idx)=>{
    const w=(s.pmed/scaleMax*100).toFixed(3);
    const dl=s.pmed-avg, below=dl<-0.004, above=dl>0.004;
    const col = above?'var(--green)':below?'var(--red)':'var(--primary)';
    const dtag = Math.abs(dl)<0.005?'':`<span class="dlt ${above?'above-g':'below-r'}">${dl>0?'+':''}${fmtBRL(dl)}</span>`;
    // buscar OPs do vendedor para este produto
    const vdata = DB.vendors[s.vend];
    const itemFull = vdata ? vdata.items.find(it=>it.produto===p) : null;
    const itemOps = itemFull ? itemFull.rows : [];
    const sLiqCell = itemFull&&itemFull.pliq!=null?`<td class="r num muted">${fmtBRL(itemFull.pliq)}</td>`:'<td class="r num muted">—</td>';
    // agrupa por data com subtotal
    const byDay = {};
    itemOps.forEach(o=>{ (byDay[o.data||'—']??=[]).push(o); });
    const detRows = Object.entries(byDay).map(([data,ops])=>{
      const tQtd=ops.reduce((s,o)=>s+o.qtd,0), tFat=ops.reduce((s,o)=>s+o.fat,0);
      return ops.map(o=>`
        <tr>
          <td class="d-op">${o.op}</td>
          <td class="d-cli">${esc(o.cli)}</td>
          <td class="d-data num">${o.data||''}</td>
          <td class="r num">${fmtN(o.qtd)}</td>
          <td class="r num">${fmtBRL(o.pv)}</td>
          ${sLiqCell}
          <td class="r num">${fmtBRL(o.fat)}</td>
        </tr>`).join('') + `
        <tr class="day-total">
          <td colspan="3" class="day-label">Total ${data}</td>
          <td class="r num">${fmtN(tQtd)}</td>
          <td></td>
          <td></td>
          <td class="r num">${fmtBRL(tFat)}</td>
        </tr>`;
    }).join('');
    const hasOps = itemOps.length > 0;
    return `<div class="row prow-cmp ${hasOps?'clickable':''}" data-cidx="${idx}">
      <div class="nm" title="${s.vend}"><span class="chev" style="${hasOps?'':'visibility:hidden'}"">▸</span>${avatarHTML(s.vend,'sz-sm')} ${s.vend}</div>
      <div class="rowmid">
        <div class="track"><i style="width:${w}%;background:${col}"></i></div>
        <div class="vol num muted">${fmtN(s.qtd)} kg</div>
      </div>
      <div class="pr num">${fmtBRL(s.pmed)}${dtag}</div>
    </div>
    ${hasOps?`<div class="crow-detail" data-cfor="${idx}" hidden>
      <div class="detail">
        <div class="dhead">${itemOps.length} oportunidade${itemOps.length>1?'s':''} · ${s.vend}</div>
        <div class="dscroll"><table class="dtab">
          <thead><tr>
            <th>Nº da OP</th><th>Cliente</th><th>Data</th>
            <th class="r">Qtd</th><th class="r">Preço venda</th><th class="r">Líq. s/ Rapel</th><th class="r">Faturamento</th>
          </tr></thead>
          <tbody>${detRows}</tbody>
        </table></div>
      </div>
    </div>`:''}`;
  }).join('');
  const ptab = d.ptab || 0;
  const vsTab = ptab ? avg - ptab : null;
  const vsTabTag = vsTab !== null
    ? `<span class="vstab ${vsTab>=0?'above-g':'below-r'}">${vsTab>=0?'+':''}${fmtBRL(vsTab)} vs tabela</span>`
    : '';
  // Preço de venda (média simples) e Líq. Sem Rapel, ponderados pela qtd dos vendedores filtrados
  const pvItems = sellers.filter(s=>s.pvenda!=null);
  const liqItems = sellers.filter(s=>s.pliq!=null);
  const pvendaAvg = pvItems.length ? pvItems.reduce((a,s)=>a+s.pvenda*s.qtd,0)/pvItems.reduce((a,s)=>a+s.qtd,0) : null;
  const pliqAvg = liqItems.length ? liqItems.reduce((a,s)=>a+s.pliq*s.qtd,0)/liqItems.reduce((a,s)=>a+s.qtd,0) : null;
  document.getElementById('cmp').innerHTML = `
    <h3>${p} <span class="fav-star ${favProducts.has(p)?'on':''}" id="prodFavStar" title="Favoritar produto">★</span></h3>
    <div class="meta">
      <div>
        <div class="l">Preço médio equipe</div>
        <div class="n num">${fmtBRL(avg)} ${vsTabTag}</div>
      </div>
      <div><div class="l">Preço de tabela</div><div class="n num ptab-val">${ptab?fmtBRL(ptab):'—'}</div></div>
      <div><div class="l">Preço de venda</div><div class="n num">${pvendaAvg!=null?fmtBRL(pvendaAvg):'—'}</div></div>
      ${sellers.length===1?`<div><div class="l">Líq. s/ Rapel</div><div class="n num">${pliqAvg!=null?fmtBRL(pliqAvg):'—'}</div></div>`:''}
      <div><div class="l">Volume total</div><div class="n num">${fmtN(qtd)} kg</div></div>
      <div><div class="l">Faturamento</div><div class="n num">${fmtBRL(fat)}</div></div>
      <div><div class="l">Vendedores</div><div class="n num">${sellers.length}</div></div>
      <div><div class="l">Amplitude de preço</div><div class="n num">${fmtBRL(min)}–${fmtBRL(max)}</div></div>
    </div>
    ${noteWidgetHTML('prod', p)}
    <div class="rows-wrap" id="rows-wrap" style="position:relative">
      <div class="avgline" id="avgline"><div class="avgtag">média ${fmtBRL(avg)}</div></div>
      ${rows}
    </div>
    <div class="muted" style="margin-top:14px">Barras <span style="color:var(--green);font-weight:700">verdes</span> = acima da média da equipe (preço mais alto) · <span style="color:var(--red);font-weight:700">vermelhas</span> = abaixo.</div>`;
  const prodStarEl = document.getElementById('prodFavStar');
  if(prodStarEl) prodStarEl.onclick = ()=>{ toggleFav('prod', p); prodStarEl.classList.toggle('on'); rebuildSelProd(); };
  wireNoteWidget('prod', p);
  // posiciona a linha após render
  requestAnimationFrame(()=>{
    const wrap = document.getElementById('rows-wrap');
    const track = wrap ? wrap.querySelector('.track') : null;
    const line = document.getElementById('avgline');
    if(track&&line){
      const wr=wrap.getBoundingClientRect(), tr=track.getBoundingClientRect();
      line.style.left = (tr.left-wr.left+tr.width*(avgPct/100))+'px';
    }
  });
}
selP.onchange=renderProd;
// listener fixo de expansão no comparar produto (delegado, sobrevive ao re-render)
document.getElementById('view-prod').addEventListener('click',e=>{
  const row=e.target.closest('.prow-cmp.clickable'); if(!row) return;
  const idx=row.dataset.cidx;
  const cmp=document.getElementById('cmp');
  const det=cmp.querySelector(`.crow-detail[data-cfor="${idx}"]`);
  const open=row.classList.toggle('open');
  const chev=row.querySelector('.chev');
  if(chev) chev.style.transform=open?'rotate(90deg)':'';
  if(det) det.hidden=!open;
});
renderProd();

/* ---------- SELETOR DE PERÍODO ---------- */
function checkTableScroll(){
  const card = document.getElementById('vendTableCard');
  const scroller = card ? card.querySelector('.tablecard-scroll') : null;
  if(!card || !scroller) return;
  const hasScroll = scroller.scrollWidth > scroller.clientWidth + 2;
  card.classList.toggle('has-scroll', hasScroll);
}
window.addEventListener('resize', checkTableScroll);
const _vscroller = document.querySelector('#vendTableCard .tablecard-scroll');
if(_vscroller) _vscroller.addEventListener('scroll', ()=>{
  const card = document.getElementById('vendTableCard');
  const atEnd = _vscroller.scrollLeft + _vscroller.clientWidth >= _vscroller.scrollWidth - 2;
  card.classList.toggle('has-scroll', !atEnd && _vscroller.scrollWidth > _vscroller.clientWidth + 2);
});

function switchPeriod(key){
  periodoAtual = key;
  DB = ALLDB[key];
  const kpisEl = document.getElementById('kpis');
  kpisEl.classList.remove('view-anim'); void kpisEl.offsetWidth; kpisEl.classList.add('view-anim');
  // reset filtros de equipe
  gestorVend='todos'; gestorProd='todos';
  document.querySelectorAll('#gestV .gbtn').forEach(b=>b.classList.toggle('on', b.dataset.g==='todos'));
  document.querySelectorAll('#gestP .gbtn').forEach(b=>b.classList.toggle('on', b.dataset.g==='todos'));
  // textos
  document.getElementById('sub').textContent = DB.periodo + ' · ' + DB.filtro;
  document.getElementById('foot').innerHTML =
    'Preço médio ponderado pela quantidade (faturamento ÷ volume). '+DB.totals.nops.toLocaleString('pt-BR')+
    ' oportunidades · '+DB.filtro+'.<br>Gerado a partir do Relatório de Vendas Apucarana.'+
    '<div class="foot-corp">Confidencial · Uso interno GTF / Canção Alimentos · Atualizado em '+new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})+'</div>';
  // KPIs
  const T=DB.totals;
  document.getElementById('kpis').innerHTML = [
    ['Faturamento', fmtK(T.fat)],
    ['Volume', fmtN(T.qtd)+' <small>kg</small>'],
    ['Vendedores', T.nvend],
    ['Produtos', T.nprod],
  ].map(([l,v])=>`<div class="kpi"><div class="lab">${l}</div><div class="val num">${v}</div></div>`).join('');
  animateKpis();
  // recalcula listas e re-renderiza
  vendNames = Object.keys(DB.vendors).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  prodNames = Object.keys(DB.products).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  rebuildSelVend();
  renderVendor();
  renderTeamSummary();
  const qEl = document.getElementById('qProd');
  if(qEl) qEl.value='';
  rebuildSelProd();
  clientNames = Object.keys(DB.clients||{}).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const qCliEl = document.getElementById('qCli');
  if(qCliEl) qCliEl.value='';
  const activeTab = document.querySelector('.tab.on');
  const activeT = activeTab ? activeTab.dataset.t : 'geral';
  if(activeT==='intel') renderIntel();
  if(activeT==='geral') renderGeral();
  if(activeT==='cli') rebuildSelCli();
}
document.querySelectorAll('#periodBar .pbtn').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#periodBar .pbtn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  switchPeriod(b.dataset.p);
  saveLastFilter();
});
/* ---------- VISÃO GERAL: ranking + alertas ---------- */
let gestorGeral='todos';
function collectItemStats(){
  const out=[];
  Object.entries(DB.vendors).forEach(([vname,vdata])=>{
    if(!vendorInGestor(vname, gestorGeral)) return;
    vdata.items.forEach(it=>{
      if(!it.ptab || it.ptab<=0) return;
      const diff = it.pmed - it.ptab;
      const pct = (diff/it.ptab*100);
      out.push({vend:vname, produto:it.produto, pmed:it.pmed, ptab:it.ptab, diff, pct, fat:it.fat, qtd:it.qtd});
    });
  });
  return out;
}
function computeWeekdayStats(){
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const sums = [0,0,0,0,0,0,0];
  Object.entries(DB.vendors).forEach(([vname,vdata])=>{
    if(!vendorInGestor(vname, gestorGeral)) return;
    vdata.items.forEach(it=>{
      it.rows.forEach(r=>{
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.data||'');
        if(!m) return;
        const dt = new Date(+m[3], +m[2]-1, +m[1]);
        sums[dt.getDay()] += r.fat;
      });
    });
  });
  // reordenar começando na Segunda
  const order = [1,2,3,4,5,6,0];
  return order.map(i=>({lab:dias[i], val:sums[i]}));
}
function renderWeekdayChart(){
  const data = computeWeekdayStats();
  const maxV = Math.max(...data.map(d=>d.val), 0.0001);
  const cols = data.map(d=>`
    <div class="wk-col">
      <div class="wk-val">${d.val>0?fmtK(d.val):''}</div>
      <div class="wk-bar" style="height:${maxV? (d.val/maxV*100):0}%"></div>
      <div class="wk-lab">${d.lab}</div>
    </div>`).join('');
  return `
    <div class="evo-card chart-card chart-weekday">
      <h3>Faturamento por dia da semana <span class="sub" style="font-weight:500;color:var(--muted)">· ${DB.periodo}</span></h3>
      <div class="wk-list">${cols}</div>
    </div>`;
}
function renderEvoChart(){
  const keys = Object.keys(ALLDB);
  if(keys.length<2) return '';
  const vals = keys.map(k=>ALLDB[k].totals.fat);
  const labels = keys.map(k=>ALLDB[k].periodo);
  const W=720, H=190, padL=54, padR=20, padT=24, padB=34;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const maxV = Math.max(...vals), minV = 0;
  const x = i => padL + (keys.length===1?innerW/2:innerW*i/(keys.length-1));
  const y = v => padT + innerH - (maxV? (v-minV)/(maxV-minV)*innerH : 0);
  const pts = vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  const areaPts = `${x(0)},${padT+innerH} ${pts} ${x(vals.length-1)},${padT+innerH}`;
  const gridLines = [0,0.25,0.5,0.75,1].map(f=>{
    const yy = padT + innerH*(1-f);
    return `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL-8}" y="${yy+4}" font-size="9.5" text-anchor="end" fill="var(--muted)" font-family="Inter">${fmtK(maxV*f)}</text>`;
  }).join('');
  const dots = vals.map((v,i)=>`
      <circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="var(--primary)" stroke="var(--card)" stroke-width="2"/>
      <text x="${x(i)}" y="${y(v)-12}" font-size="10.5" font-weight="700" text-anchor="middle" fill="var(--ink)" font-family="Space Grotesk">${fmtK(v)}</text>
      <text x="${x(i)}" y="${H-8}" font-size="9.5" text-anchor="middle" fill="var(--muted)" font-family="Inter">${labels[i]}</text>`).join('');
  return `
    <div class="evo-card chart-card chart-evolution">
      <h3>Evolução do faturamento por período</h3>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">
        ${gridLines}
        <polygon points="${areaPts}" fill="var(--primary)" opacity="0.08"/>
        <polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
      </svg>
    </div>`;
}
function renderVendorRankBars(){
  const arr = Object.entries(DB.vendors).filter(([n])=>vendorInGestor(n, gestorGeral)).map(([n,v])=>({n,fat:v.fat})).sort((a,b)=>b.fat-a.fat);
  if(!arr.length) return '';
  const maxV = arr[0].fat;
  const rows = arr.map(v=>`
    <div class="vrank-row">
      <div class="vrank-nm" title="${v.n}">${avatarHTML(v.n,'sz-sm')} ${v.n}</div>
      <div class="vrank-bar"><i style="width:${(v.fat/maxV*100).toFixed(1)}%"></i></div>
      <div class="vrank-spark">${sparklineSVG(vendorDailySeries(v.n))}</div>
      <div class="vrank-val num">${fmtK(v.fat)}</div>
    </div>`).join('');
  return `
    <div class="evo-card chart-card chart-vendor-rank">
      <h3>Ranking de vendedores por faturamento <span class="sub" style="font-weight:500;color:var(--muted)">· ${DB.periodo}</span></h3>
      <div class="vrank-list">${rows}</div>
    </div>`;
}
function renderGeral(){
  const el = document.getElementById('geralContent');
  const stats = collectItemStats();
  const alerts = stats.filter(s=>s.pct<=-10).sort((a,b)=>a.pct-b.pct).slice(0,10);
  const topUp = stats.filter(s=>s.diff>0).sort((a,b)=>b.pct-a.pct).slice(0,5);
  const topDown = stats.filter(s=>s.diff<0).sort((a,b)=>a.pct-b.pct).slice(0,5);
  const aboveCount = stats.filter(s=>s.diff>0.005).length;
  const belowCount = stats.filter(s=>s.diff<-0.005).length;
  const onTableCount = Math.max(0, stats.length-aboveCount-belowCount);
  const pricingImpact = stats.reduce((sum,s)=>sum+(s.diff*s.qtd),0);
  const impactPositive = pricingImpact>=0;
  const pulseHtml = `<div class="pricing-pulse">
    <div class="pulse-title">
      <span class="pulse-overline">Leitura executiva</span>
      <strong>Saúde de preço da operação</strong>
      <small>${gestorGeral==='todos'?'Visão consolidada de todas as equipes':'Equipe '+gestorGeral} · ${DB.periodo}</small>
    </div>
    <div class="pulse-metric"><span>Combinações analisadas</span><b>${stats.length}</b><small>produto × vendedor com tabela</small></div>
    <div class="pulse-metric positive"><span>Acima da tabela</span><b>${aboveCount}</b><small>${stats.length?(aboveCount/stats.length*100).toFixed(1):'0,0'}% dos itens</small></div>
    <div class="pulse-metric neutral"><span>Na tabela</span><b>${onTableCount}</b><small>variação até R$ 0,005</small></div>
    <div class="pulse-metric negative"><span>Abaixo da tabela</span><b>${belowCount}</b><small>${alerts.length} alertas críticos</small></div>
    <div class="pulse-impact ${impactPositive?'positive':'negative'}"><span>Impacto estimado</span><b>${impactPositive?'+':'−'}${fmtK(Math.abs(pricingImpact))}</b><small>diferença ponderada vs. tabela</small></div>
  </div>`;

  const alertHtml = alerts.length ? `
    <div class="alert-box">
      <div class="alert-head">⚠ ${alerts.length} produto${alerts.length>1?'s':''} vendido${alerts.length>1?'s':''} mais de 10% abaixo da tabela</div>
      ${alerts.map(a=>`
        <div class="alert-item">
          <div><span class="nm">${a.vend}</span><br><span class="sub">${a.produto}</span></div>
          <div class="pct">${fmtBRL(a.diff)} <small style="font-weight:600">(${a.pct.toFixed(1)}%)</small></div>
        </div>`).join('')}
    </div>` : `<div class="alert-box" style="background:var(--green-soft);border-color:rgba(46,158,109,.28)">
      <div class="alert-head" style="color:var(--green)">✓ Nenhum produto vendido mais de 10% abaixo da tabela neste período</div>
    </div>`;

  const rowTpl = (s,cls) => `
    <div class="rank-row">
      <div class="info">
        <span class="nm" title="${s.produto}">${s.produto}</span>
        <span class="sub">${s.vend}</span>
      </div>
      <div class="pct ${cls}">${s.diff>=0?'+':''}${fmtBRL(s.diff)}<br><span class="sub" style="font-weight:600">${s.pct>=0?'+':''}${s.pct.toFixed(1)}%</span></div>
    </div>`;

  el.innerHTML = `
    ${pulseHtml}
    ${renderEvoChart()}
    ${renderVendorRankBars()}
    ${renderWeekdayChart()}
    ${renderWeekdayMatrix()}
    ${renderBubbleChart()}
    ${renderCalendarHeatmap()}
    ${alertHtml}
    <div class="rank-grid pricing-ranks">
      <div class="rank-col up">
        <h3>▲ Top 5 acima da tabela</h3>
        ${topUp.length? topUp.map(s=>rowTpl(s,'above-g')).join('') : '<div class="rank-empty">Sem dados suficientes.</div>'}
      </div>
      <div class="rank-col down">
        <h3>▼ Top 5 abaixo da tabela</h3>
        ${topDown.length? topDown.map(s=>rowTpl(s,'below-r')).join('') : '<div class="rank-empty">Sem dados suficientes.</div>'}
      </div>
    </div>`;
}


/* ---------- CLIENTES ---------- */
let clientNames = Object.keys(DB.clients||{}).sort((a,b)=>a.localeCompare(b,'pt-BR'));
let currentCliProducts=[], currentCliName='';
const selCli = document.getElementById('selCli');
function rebuildSelCli(){
  const q = document.getElementById('qCli').value.trim().toLowerCase();
  let filtered = clientNames.filter(c=>!q || c.toLowerCase().includes(q));
  filtered = sortFavFirst(filtered, favClients);
  selCli.innerHTML = filtered.map(c=>`<option value="${c}">${favClients.has(c)?'★ ':''}${c} — ${fmtK(DB.clients[c].fat)}</option>`).join('');
  renderCli();
}
function renderCli(){
  const cont = document.getElementById('cliContent');
  const cli = selCli.value;
  const d = DB.clients ? DB.clients[cli] : null;
  if(!d){ cont.innerHTML = '<div class="empty">Nenhum cliente encontrado.</div>'; currentCliProducts=[]; currentCliName=''; return; }
  currentCliProducts = d.produtos; currentCliName = cli;
  const prodRows = d.produtos.map(p=>{
    const dl = p.ptab>0 ? (p.pmed-p.ptab) : null;
    const dtag = dl!==null && Math.abs(dl)>=0.005 ? `<span class="dlt ${dl>=0?'above-g':'below-r'}">${dl>=0?'+':''}${fmtBRL(dl)}</span>` : '';
    return `<tr>
      <td><div class="prod">${p.produto}</div></td>
      <td class="r num muted">${fmtN(p.qtd)}</td>
      <td class="r num">${fmtBRL(p.fat)}</td>
      <td class="r"><div class="price num">${fmtBRL(p.pmed)}</div>${dtag}</td>
      <td class="r num muted hidem">${p.ops}</td>
    </tr>`;
  }).join('');
  const vendRows = d.vendedores.map(v=>`
    <div class="row" style="grid-template-columns:1fr auto">
      <div class="nm">${v.vend}</div>
      <div class="pr num">${fmtBRL(v.fat)} <span class="muted" style="font-weight:500">(${fmtN(v.qtd)} kg)</span></div>
    </div>`).join('');
  cont.innerHTML = `
    <h3>${avatarHTML(cli,'sz-lg')} <span style="vertical-align:middle;margin-left:4px">${cli}</span> <span class="fav-star ${favClients.has(cli)?'on':''}" id="cliFavStar" title="Favoritar cliente">★</span></h3>
    <div class="meta">
      <div><div class="l">Faturamento</div><div class="n num">${fmtBRL(d.fat)}</div></div>
      <div><div class="l">Volume</div><div class="n num">${fmtN(d.qtd)} kg</div></div>
      <div><div class="l">Preço médio</div><div class="n num">${fmtBRL(d.pmed)}</div></div>
      <div><div class="l">Produtos comprados</div><div class="n num">${d.nprod}</div></div>
      <div><div class="l">Vendedores que atenderam</div><div class="n num">${d.nvend}</div></div>
    </div>
    ${noteWidgetHTML('cli', cli)}
    <div class="dhead" style="padding-left:0">Produtos comprados</div>
    <div class="tablecard" style="margin-bottom:18px">
      <div class="tablecard-scroll">
      <table class="sticky-col">
        <thead><tr>
          <th>Produto</th><th class="r">Qtd</th><th class="r">Faturamento</th><th class="r">Preço médio</th><th class="r hidem">Ops</th>
        </tr></thead>
        <tbody>${prodRows}</tbody>
      </table>
      </div>
    </div>
    <div class="dhead" style="padding-left:0">Vendedores que atenderam este cliente</div>
    ${vendRows}`;
  const starEl = document.getElementById('cliFavStar');
  if(starEl) starEl.onclick = ()=>{ toggleFav('cli', cli); starEl.classList.toggle('on'); rebuildSelCli(); };
  wireNoteWidget('cli', cli);
}
document.getElementById('qCli').addEventListener('input', rebuildSelCli);
selCli.addEventListener('change', renderCli);
rebuildSelCli();

/* ---------- COMPARAR PERÍODOS ---------- */
const PERIOD_KEYS = Object.keys(ALLDB);
function fillCompSelects(){
  const opts = PERIOD_KEYS.map(k=>`<option value="${k}">${ALLDB[k].periodo}</option>`).join('');
  const a = document.getElementById('selCompA'), b = document.getElementById('selCompB');
  a.innerHTML = opts; b.innerHTML = opts;
  if(PERIOD_KEYS.length>1){ a.value = PERIOD_KEYS[PERIOD_KEYS.length-2]; b.value = PERIOD_KEYS[PERIOD_KEYS.length-1]; }
}
fillCompSelects();
document.getElementById('selCompA').addEventListener('change', renderComp);
document.getElementById('selCompB').addEventListener('change', renderComp);
function renderComp(){
  const kA = document.getElementById('selCompA').value, kB = document.getElementById('selCompB').value;
  const A = ALLDB[kA], B = ALLDB[kB];
  const cont = document.getElementById('compContent');
  if(!A || !B){ cont.innerHTML=''; return; }
  const names = new Set([...Object.keys(A.vendors), ...Object.keys(B.vendors)]);
  const rows = [...names].map(n=>{
    const va = A.vendors[n], vb = B.vendors[n];
    const fatA = va?va.fat:0, fatB = vb?vb.fat:0;
    const pmedA = va?va.pmed:null, pmedB = vb?vb.pmed:null;
    const dFat = fatB-fatA;
    const dFatPct = fatA? (dFat/fatA*100) : null;
    const dPmed = (pmedA!=null && pmedB!=null) ? (pmedB-pmedA) : null;
    return {n, fatA, fatB, dFat, dFatPct, pmedA, pmedB, dPmed};
  }).sort((a,b)=>b.fatB-a.fatB);
  const totFatA = A.totals.fat, totFatB = B.totals.fat;
  const totD = totFatB-totFatA, totPct = totFatA?(totD/totFatA*100):0;
  const bodyRows = rows.map(r=>`
    <tr>
      <td><div class="prod">${r.n}</div></td>
      <td class="r num muted">${fmtBRL(r.fatA)}</td>
      <td class="r num">${fmtBRL(r.fatB)}</td>
      <td class="r"><span class="dlt ${r.dFat>=0?'above-g':'below-r'}">${r.dFat>=0?'+':''}${fmtBRL(r.dFat)}</span>
        ${r.dFatPct!=null?`<br><span class="muted">${r.dFatPct>=0?'+':''}${r.dFatPct.toFixed(1)}%</span>`:''}</td>
      <td class="r num muted hidem">${r.pmedA!=null?fmtBRL(r.pmedA):'—'}</td>
      <td class="r num hidem">${r.pmedB!=null?fmtBRL(r.pmedB):'—'}</td>
      <td class="r hidem">${r.dPmed!=null?`<span class="dlt ${r.dPmed>=0?'above-g':'below-r'}">${r.dPmed>=0?'+':''}${fmtBRL(r.dPmed)}</span>`:'—'}</td>
    </tr>`).join('');
  cont.innerHTML = `
    <div class="vsum" style="margin-top:16px">
      <div class="box"><div class="lab">Faturamento ${A.periodo}</div><div class="v num">${fmtK(totFatA)}</div></div>
      <div class="box"><div class="lab">Faturamento ${B.periodo}</div><div class="v num">${fmtK(totFatB)}</div></div>
      <div class="box amber"><div class="lab">Variação</div><div class="v num" style="color:${totD>=0?'var(--green)':'var(--red)'}">${totD>=0?'+':''}${fmtK(Math.abs(totD))}</div></div>
      <div class="box amber"><div class="lab">Variação %</div><div class="v num" style="color:${totPct>=0?'var(--green)':'var(--red)'}">${totPct>=0?'+':''}${totPct.toFixed(1)}%</div></div>
    </div>
    <div class="tablecard">
      <div class="tablecard-scroll">
      <table class="sticky-col">
        <thead><tr>
          <th>Vendedor</th>
          <th class="r">Fat. ${A.periodo}</th>
          <th class="r">Fat. ${B.periodo}</th>
          <th class="r">Δ Faturamento</th>
          <th class="r hidem">Preço médio ${A.periodo}</th>
          <th class="r hidem">Preço médio ${B.periodo}</th>
          <th class="r hidem">Δ Preço</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      </div>
    </div>`;
}

/* ---------- CENTRAL DE DECISÃO / PRICING INTELLIGENCE ---------- */
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function inferCategory(name){
  const p=(name||'').toUpperCase();
  if(/BDJ|BANDEJA/.test(p)) return 'Resfriados e bandejas';
  if(/IQF/.test(p)) return 'IQF';
  if(/EMPANAD|CHICKEN|BOLINHO|KIBE|COXINHA CREMOSA/.test(p)) return 'Empanados';
  if(/BATATA|POLENTA|VEGETA|MANDIOCA|CEBOLA|PAO DE QUEIJO/.test(p)) return 'Vegetais e preparados';
  if(/FIGADO|MOELA|CORACAO|MIUDO|PESCOCO|SAMBIQUIRA/.test(p)) return 'Miúdos';
  if(/PEIXE|TILAPIA|PESCADO/.test(p)) return 'Pescados';
  if(/RESFRIAD/.test(p)) return 'Resfriados';
  if(/CONGELAD|FRANGO/.test(p)) return 'Aves congeladas';
  return 'Outros';
}
function median(values){
  if(!values.length) return 0;
  const a=values.slice().sort((x,y)=>x-y), m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function tierForScore(score){
  if(score>=92) return {label:'Elite',cls:'good'};
  if(score>=84) return {label:'Destaque',cls:'good'};
  if(score>=74) return {label:'Estável',cls:'warn'};
  return {label:'Atenção',cls:'bad'};
}
function fillIntelCategories(){
  const sel=document.getElementById('intelCategory'); if(!sel) return;
  const current=sel.value||'todos';
  const cats=[...new Set(Object.keys(DB.products||{}).map(inferCategory))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  sel.innerHTML='<option value="todos">Todas as categorias</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cats.includes(current)) sel.value=current;
}
function computePricingIntel(){
  const team=document.getElementById('intelTeam')?.value||'todos';
  const category=document.getElementById('intelCategory')?.value||'todos';
  const risk=document.getElementById('intelRisk')?.value||'todos';
  const rows=[];
  Object.entries(DB.vendors).forEach(([vendor,vd])=>{
    if(!vendorInGestor(vendor,team)) return;
    vd.items.forEach(it=>{
      if(!it.ptab||it.ptab<=0||!it.qtd) return;
      const cat=inferCategory(it.produto); if(category!=='todos'&&cat!==category) return;
      const avg=it.fat/it.qtd, diff=avg-it.ptab, pct=diff/it.ptab*100;
      if(risk==='critico'&&pct>-10) return;
      if(risk==='atencao'&&!(pct<0&&pct>-10)) return;
      if(risk==='oportunidade'&&pct<=0) return;
      const loss=Math.max(0,-diff*it.qtd), gain=Math.max(0,diff*it.qtd);
      rows.push({vendor,produto:it.produto,category:cat,qtd:it.qtd,fat:it.fat,avg,table:it.ptab,diff,pct,loss,gain,ops:it.ops||0,rawRows:it.rows||[]});
    });
  });
  const sellers=new Map(), products=new Map();
  let qty=0,revenue=0,tableBase=0,loss=0,gain=0,criticalQty=0,criticalCount=0,aboveCount=0;
  rows.forEach(r=>{
    qty+=r.qtd;revenue+=r.fat;tableBase+=r.table*r.qtd;loss+=r.loss;gain+=r.gain;
    if(r.pct<=-10){criticalQty+=r.qtd;criticalCount++;} if(r.diff>0) aboveCount++;
    if(!sellers.has(r.vendor)) sellers.set(r.vendor,{name:r.vendor,qtd:0,fat:0,tableBase:0,loss:0,gain:0,critical:0,above:0,items:0});
    const s=sellers.get(r.vendor);s.qtd+=r.qtd;s.fat+=r.fat;s.tableBase+=r.table*r.qtd;s.loss+=r.loss;s.gain+=r.gain;s.items++;if(r.pct<=-10)s.critical++;if(r.diff>0)s.above++;
    if(!products.has(r.produto)) products.set(r.produto,{name:r.produto,category:r.category,qtd:0,fat:0,tableBase:0,loss:0,gain:0,critical:0,vendors:new Set(),prices:[]});
    const p=products.get(r.produto);p.qtd+=r.qtd;p.fat+=r.fat;p.tableBase+=r.table*r.qtd;p.loss+=r.loss;p.gain+=r.gain;p.vendors.add(r.vendor);if(r.pct<=-10)p.critical++;
    r.rawRows.forEach(x=>{if(Number.isFinite(x.pv))p.prices.push(x.pv);}); if(!p.prices.length)p.prices.push(r.avg);
  });
  const sellerArr=[...sellers.values()].map(s=>{
    const shortfall=s.tableBase?s.loss/s.tableBase:0,critRate=s.items?s.critical/s.items:0;
    s.index=s.tableBase?s.fat/s.tableBase*100:100;s.score=clamp(Math.round(100-shortfall*650-critRate*22),0,100);s.net=s.gain-s.loss;s.tier=tierForScore(s.score);return s;
  }).sort((a,b)=>b.score-a.score||b.fat-a.fat);
  const productArr=[...products.values()].map(p=>{
    p.avg=p.qtd?p.fat/p.qtd:0;p.table=p.qtd?p.tableBase/p.qtd:0;p.min=Math.min(...p.prices);p.max=Math.max(...p.prices);p.median=median(p.prices);p.spread=p.max-p.min;p.net=p.gain-p.loss;return p;
  }).sort((a,b)=>b.fat-a.fat);
  const critRate=rows.length?criticalCount/rows.length:0,shortfall=tableBase?loss/tableBase:0;
  const score=clamp(Math.round(100-shortfall*650-critRate*22),0,100);
  return {team,category,risk,rows,sellers:sellerArr,products:productArr,qty,revenue,tableBase,loss,gain,net:gain-loss,criticalQty,criticalCount,aboveCount,priceIndex:tableBase?revenue/tableBase*100:100,score,tier:tierForScore(score)};
}
function fmtSignedMoney(n){return `${n>=0?'+':'−'}${fmtK(Math.abs(n))}`;}
function renderRiskMatrix(data){
  if(!data.sellers.length)return '<div class="empty">Sem vendedores para os filtros selecionados.</div>';
  const W=650,H=320,L=58,R=22,Tp=22,B=44,iw=W-L-R,ih=H-Tp-B,maxQty=Math.max(...data.sellers.map(s=>s.qtd),1),maxFat=Math.max(...data.sellers.map(s=>s.fat),1);
  const x=v=>L+clamp((v-92)/(106-92),0,1)*iw,y=v=>Tp+ih-(v/maxQty)*ih;
  const bg=`<rect x="${L}" y="${Tp}" width="${iw/2}" height="${ih/2}" fill="var(--amber-soft)" opacity=".65"/><rect x="${L+iw/2}" y="${Tp}" width="${iw/2}" height="${ih/2}" fill="var(--green-soft)" opacity=".72"/><rect x="${L}" y="${Tp+ih/2}" width="${iw/2}" height="${ih/2}" fill="var(--red-soft)" opacity=".72"/><rect x="${L+iw/2}" y="${Tp+ih/2}" width="${iw/2}" height="${ih/2}" fill="var(--amber-soft)" opacity=".42"/>`;
  const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${L}" y1="${Tp+ih*f}" x2="${W-R}" y2="${Tp+ih*f}" stroke="var(--line)"/><text x="${L-8}" y="${Tp+ih*f+3}" text-anchor="end" font-size="8" fill="var(--muted)">${fmtN(maxQty*(1-f)/1000,0)}t</text>`).join('');
  const bubbles=data.sellers.map(s=>{const r=6+Math.sqrt(s.fat/maxFat)*15,color=s.score>=84?'var(--green)':s.score>=74?'var(--amber)':'var(--red)';return `<g class="risk-bubble" data-vendor="${esc(s.name)}" style="cursor:pointer"><circle cx="${x(s.index)}" cy="${y(s.qtd)}" r="${r}" fill="${color}" opacity=".82" stroke="var(--card)" stroke-width="2"><title>${esc(s.name)} · Índice ${s.index.toFixed(1)}% · ${fmtN(s.qtd)} kg · Saúde ${s.score}</title></circle><text x="${x(s.index)}" y="${y(s.qtd)+2.8}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">${avatarInitials(s.name)}</text></g>`;}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" aria-label="Matriz de risco de vendedores">${bg}${grid}<line x1="${x(100)}" y1="${Tp}" x2="${x(100)}" y2="${Tp+ih}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".55"/><line x1="${L}" y1="${Tp+ih/2}" x2="${W-R}" y2="${Tp+ih/2}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".35"/>${bubbles}<text x="${L+iw/2}" y="${H-10}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--muted)">ÍNDICE DE PREÇO VS. TABELA (%) →</text><text x="15" y="${Tp+ih/2}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--muted)" transform="rotate(-90 15 ${Tp+ih/2})">VOLUME VENDIDO →</text><text x="${L+9}" y="${Tp+13}" font-size="8" font-weight="800" fill="var(--day-label-color)">VOLUME ALTO · PREÇO BAIXO</text><text x="${W-R-9}" y="${Tp+13}" text-anchor="end" font-size="8" font-weight="800" fill="var(--green)">ZONA ELITE</text></svg>`;
}
function renderIntel(){
  fillIntelCategories();
  const d=computePricingIntel(),el=document.getElementById('intelContent'); if(!el)return;
  if(!d.rows.length){el.innerHTML='<div class="intel-card empty" style="grid-column:1/-1">Nenhum dado encontrado para esta combinação de filtros.</div>';return;}
  const worstSeller=d.sellers.slice().sort((a,b)=>b.loss-a.loss)[0],bestSeller=d.sellers.slice().sort((a,b)=>b.score-a.score)[0];
  const worstProduct=d.products.slice().sort((a,b)=>b.loss-a.loss)[0],bestProduct=d.products.slice().sort((a,b)=>b.gain-a.gain)[0],spreadProduct=d.products.slice().sort((a,b)=>b.spread-a.spread)[0];
  const criticalItem=d.rows.slice().sort((a,b)=>(b.loss*b.qtd)-(a.loss*a.qtd)||b.loss-a.loss)[0];
  const dominant=d.loss>d.gain,healthWord=d.score>=92?'excelente':d.score>=84?'saudável':d.score>=74?'sob atenção':'crítica';
  const narrative=dominant?`A operação apresenta saúde ${healthWord}. Há ${fmtK(d.loss)} em vazamento potencial de receita, concentrado principalmente em ${esc(worstSeller?.name||'—')} e no produto ${esc(worstProduct?.name||'—')}.`:`A operação apresenta saúde ${healthWord}, com ${fmtK(d.gain)} capturados acima da tabela. A principal referência positiva é ${esc(bestSeller?.name||'—')}.`;
  const decisions=[
    {n:1,type:'product',value:worstProduct?.name,title:'Recuperar preço do produto',desc:worstProduct?.name||'Sem risco relevante',money:worstProduct?.loss||0,opp:false},
    {n:2,type:'vendor',value:worstSeller?.name,title:'Plano de ação com vendedor',desc:worstSeller?.name||'Sem risco relevante',money:worstSeller?.loss||0,opp:false},
    {n:3,type:'product',value:criticalItem?.produto,title:'Atacar alto volume crítico',desc:criticalItem?.produto||'Nenhum item crítico',money:criticalItem?.loss||0,opp:false},
    {n:4,type:'product',value:bestProduct?.name,title:'Replicar oportunidade',desc:bestProduct?.name||'Sem oportunidade mapeada',money:bestProduct?.gain||0,opp:true},
    {n:5,type:'product',value:spreadProduct?.name,title:'Reduzir dispersão de preço',desc:spreadProduct?.name||'Preços consistentes',money:spreadProduct?.spread||0,opp:true,spread:true},
  ];
  const decisionHtml=decisions.map(x=>`<div class="decision-item ${x.opp?'opportunity':''}" data-type="${x.type}" data-value="${esc(x.value||'')}"><div class="n"><i>${x.n}</i> PRIORIDADE</div><strong>${esc(x.title)}</strong><p title="${esc(x.desc)}">${esc(x.desc)}</p><b>${x.spread?'Amplitude '+fmtBRL(x.money):(x.opp?'+':'−')+fmtK(x.money)}</b></div>`).join('');
  const sellerRows=d.sellers.slice(0,12).map((s,i)=>`<div class="health-row" data-vendor="${esc(s.name)}"><div class="health-position">${String(i+1).padStart(2,'0')}</div><div class="health-person">${avatarHTML(s.name,'sz-sm')}<span>${esc(s.name)}</span></div><div class="health-score ${s.tier.cls}">${s.score}</div><div class="mini-health-track"><i style="width:${s.score}%"></i></div><div class="health-index">Índice ${s.index.toFixed(1)}%</div><div class="health-impact ${s.net>=0?'pos':'neg'}">${fmtSignedMoney(s.net)}</div><div class="health-tier">${s.tier.label}</div></div>`).join('');
  const maxW=Math.max(d.tableBase,d.revenue,d.gain,d.loss,1),barW=v=>Math.max(1,v/maxW*100);
  const actionRows=[...d.rows.filter(r=>r.loss>0).sort((a,b)=>b.loss-a.loss).slice(0,8).map(r=>({...r,sev:r.pct<=-10?'critical':'high',label:r.pct<=-10?'Crítico':'Atenção',value:-r.loss})),...d.rows.filter(r=>r.gain>0).sort((a,b)=>b.gain-a.gain).slice(0,4).map(r=>({...r,sev:'opp',label:'Oportunidade',value:r.gain}))].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,12);
  const actionHtml=actionRows.map(r=>`<div class="action-line" data-product="${esc(r.produto)}"><div class="action-severity ${r.sev}">${r.label}</div><div class="action-info"><strong>${esc(r.produto)}</strong><span>${esc(r.vendor)} · ${r.pct>=0?'+':''}${r.pct.toFixed(1)}% vs. tabela · ${fmtN(r.qtd)} kg</span></div><div class="action-value ${r.value>=0?'pos':'neg'}">${fmtSignedMoney(r.value)}</div></div>`).join('');
  const corridors=d.products.slice(0,14).map(p=>{const lo=Math.min(p.min,p.table,p.avg)*.98,hi=Math.max(p.max,p.table,p.avg)*1.02,range=(hi-lo)||1,pos=v=>clamp((v-lo)/range*100,0,100),zoneL=pos(p.table*.98),zoneR=pos(p.table*1.03),status=p.avg>=p.table?{t:'Saudável',c:'good'}:p.avg>=p.table*.95?{t:'Atenção',c:'warn'}:{t:'Crítico',c:'bad'};return `<tr class="corridor-row" data-product="${esc(p.name)}"><td><div class="corridor-product"><strong title="${esc(p.name)}">${esc(p.name)}</strong><small>${esc(p.category)} · ${p.vendors.size} vendedor${p.vendors.size!==1?'es':''}</small></div></td><td class="r num">${fmtBRL(p.min)}</td><td class="r num">${fmtBRL(p.median)}</td><td class="r num"><b>${fmtBRL(p.avg)}</b></td><td class="r num">${fmtBRL(p.table)}</td><td class="r num">${fmtBRL(p.max)}</td><td class="r"><div class="price-range"><div class="price-range-track"></div><div class="price-range-zone" style="left:${zoneL}%;width:${Math.max(2,zoneR-zoneL)}%"></div><div class="price-range-table" style="left:${pos(p.table)}%"></div><div class="price-range-dot" style="left:${pos(p.avg)}%"></div></div></td><td class="r"><span class="corridor-status ${status.c}">${status.t}</span></td></tr>`;}).join('');
  const simOpts=d.sellers.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  el.innerHTML=`
    <div class="intel-card intel-hero">
      <div class="intel-hero-copy"><span class="eyeline">Inteligência executiva de pricing</span><h2>Saúde de preço <em>${healthWord}</em> para a operação.</h2><p>${narrative}</p><span class="intel-period">● ${DB.periodo} · ${d.rows.length} combinações analisadas</span></div>
      <div class="health-gauge-wrap"><div class="health-gauge" style="--score:${d.score};--gauge-color:${d.score>=84?'var(--green)':d.score>=74?'var(--amber)':'var(--red)'}"><div class="health-gauge-center"><b>${d.score}</b><span>Índice de saúde</span></div></div></div>
      <div class="intel-hero-metrics"><div class="hero-intel-metric loss"><span>Vazamento de receita</span><b>−${fmtK(d.loss)}</b><small>potencial abaixo da tabela</small></div><div class="hero-intel-metric gain"><span>Valor capturado</span><b>+${fmtK(d.gain)}</b><small>vendas acima da tabela</small></div><div class="hero-intel-metric index"><span>Índice de preço</span><b>${d.priceIndex.toFixed(1)}%</b><small>realizado ÷ referência</small></div><div class="hero-intel-metric"><span>Volume crítico</span><b>${fmtN(d.criticalQty/1000,1)} t</b><small>${d.criticalCount} combinações críticas</small></div></div>
    </div>
    <div class="decision-strip"><div class="decision-strip-title"><span>Fila executiva</span><strong>5 decisões para agora</strong><small>Ordenadas por impacto potencial</small></div>${decisionHtml}</div>
    <div class="intel-card health-ranking"><div class="intel-card-head"><div class="intel-card-title"><span class="overline">Performance comercial</span><h3>Ranking de saúde de preço</h3><p>Disciplina de tabela, criticidade e impacto financeiro por vendedor</p></div><span class="intel-card-badge">${d.sellers.length} vendedores</span></div><div class="health-ranking-body">${sellerRows}</div></div>
    <div class="intel-card revenue-waterfall"><div class="intel-card-head"><div class="intel-card-title"><span class="overline">Revenue leakage</span><h3>Ponte de faturamento</h3><p>Como o preço alterou o resultado realizado</p></div><span class="intel-card-badge">${fmtSignedMoney(d.net)}</span></div><div class="waterfall-body"><div class="wf-equation"><div class="wf-block"><span>Na tabela</span><b>${fmtK(d.tableBase)}</b></div><div class="wf-op">+</div><div class="wf-block gain"><span>Capturado</span><b>${fmtK(d.gain)}</b></div><div class="wf-op">−</div><div class="wf-block loss"><span>Vazamento</span><b>${fmtK(d.loss)}</b></div><div class="wf-op">=</div><div class="wf-block actual"><span>Realizado</span><b>${fmtK(d.revenue)}</b></div></div><div class="wf-bars"><div class="wf-bar-row"><span>Referência de tabela</span><div class="wf-track wf-table"><i style="width:${barW(d.tableBase)}%"></i></div><b>${fmtK(d.tableBase)}</b></div><div class="wf-bar-row"><span>Acima da tabela</span><div class="wf-track wf-gain"><i style="width:${barW(d.gain)}%"></i></div><b>+${fmtK(d.gain)}</b></div><div class="wf-bar-row"><span>Abaixo da tabela</span><div class="wf-track wf-loss"><i style="width:${barW(d.loss)}%"></i></div><b>−${fmtK(d.loss)}</b></div><div class="wf-bar-row"><span>Faturamento realizado</span><div class="wf-track wf-actual"><i style="width:${barW(d.revenue)}%"></i></div><b>${fmtK(d.revenue)}</b></div></div><div class="wf-note">Recuperar integralmente os desvios negativos adicionaria até <b>${fmtK(d.loss)}</b> ao faturamento, mantendo o mesmo volume.</div></div></div>
    <div class="intel-card risk-matrix"><div class="intel-card-head"><div class="intel-card-title"><span class="overline">Mapa de risco</span><h3>Volume × Índice de preço</h3><p>As maiores bolhas representam maior faturamento</p></div><span class="intel-card-badge">Clique para abrir</span></div><div class="risk-matrix-body">${renderRiskMatrix(d)}<div class="risk-legend"><span><i class="elite"></i>Saudável</span><span><i class="watch"></i>Atenção</span><span><i class="critical"></i>Crítico</span></div></div></div>
    <div class="intel-card action-center"><div class="intel-card-head"><div class="intel-card-title"><span class="overline">Centro de alertas</span><h3>Riscos e oportunidades priorizados</h3><p>Impacto financeiro calculado sobre o volume vendido</p></div><span class="intel-card-badge">${actionRows.length} sinais</span></div><div class="action-list">${actionHtml}</div></div>
    <div class="intel-card price-corridor"><div class="intel-card-head"><div class="intel-card-title"><span class="overline">Governança de preço</span><h3>Corredor de preço por produto</h3><p>Mínimo, mediana, média, tabela e máximo praticados</p></div><span class="intel-card-badge">Top ${Math.min(14,d.products.length)} por faturamento</span></div><div class="corridor-wrap"><table class="corridor-table"><thead><tr><th>Produto / Categoria</th><th class="r">Mínimo</th><th class="r">Mediana</th><th class="r">Preço médio</th><th class="r">Tabela</th><th class="r">Máximo</th><th class="r">Corredor visual</th><th class="r">Status</th></tr></thead><tbody>${corridors}</tbody></table></div></div>
    <div class="intel-card advanced-sim"><div class="advanced-sim-intro"><span class="overline">Simulador de cenário</span><h3>Preço × Volume</h3><p>Projete o faturamento mantendo a base real do vendedor e combinando variações de preço e volume.</p></div><div class="sim-control-block"><label>Vendedor</label><select id="intelSimVendor">${simOpts}</select><div class="sim-control-value" id="intelSimBase">—</div></div><div class="sim-control-block"><label>Variação no preço <span id="intelSimPriceLabel">+0,0%</span></label><input id="intelSimPrice" type="range" min="-15" max="15" step="0.5" value="0"><label style="margin-top:13px">Variação no volume <span id="intelSimVolumeLabel">+0,0%</span></label><input id="intelSimVolume" type="range" min="-25" max="25" step="1" value="0"></div><div class="advanced-sim-result"><span>Faturamento projetado</span><b id="intelSimResult">—</b><small id="intelSimDetail">Selecione o cenário desejado.</small><div class="sim-delta pos" id="intelSimDelta">R$ 0,00</div></div></div>`;
  wireIntelInteractions(d);
}
function goIntelTarget(type,value){
  if(!value)return;
  if(type==='vendor'){
    document.querySelector('.tab[data-t="vend"]').click();gestorVend='todos';document.querySelectorAll('#gestV .gbtn').forEach(b=>b.classList.toggle('on',b.dataset.g==='todos'));rebuildSelVend();if([...selV.options].some(o=>o.value===value))selV.value=value;renderVendor();renderTeamSummary();
  }else{
    document.querySelector('.tab[data-t="prod"]').click();gestorProd='todos';document.querySelectorAll('#gestP .gbtn').forEach(b=>b.classList.toggle('on',b.dataset.g==='todos'));document.getElementById('qProd').value='';rebuildSelProd();if([...selP.options].some(o=>o.value===value))selP.value=value;renderProd();
  }
  setTimeout(()=>document.querySelector('.workspace-nav')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
function wireIntelInteractions(data){
  document.querySelectorAll('.decision-item').forEach(el=>el.onclick=()=>goIntelTarget(el.dataset.type,el.dataset.value));
  document.querySelectorAll('.health-row,.risk-bubble').forEach(el=>el.onclick=()=>goIntelTarget('vendor',el.dataset.vendor));
  document.querySelectorAll('.action-line,.corridor-row').forEach(el=>el.onclick=()=>goIntelTarget('product',el.dataset.product));
  const vendor=document.getElementById('intelSimVendor'),price=document.getElementById('intelSimPrice'),vol=document.getElementById('intelSimVolume');
  const update=()=>{const s=data.sellers.find(x=>x.name===vendor.value)||data.sellers[0];if(!s)return;const pp=parseFloat(price.value),vp=parseFloat(vol.value),projected=s.fat*(1+pp/100)*(1+vp/100),delta=projected-s.fat;document.getElementById('intelSimPriceLabel').textContent=`${pp>=0?'+':''}${pp.toFixed(1).replace('.',',')}%`;document.getElementById('intelSimVolumeLabel').textContent=`${vp>=0?'+':''}${vp.toFixed(1).replace('.',',')}%`;document.getElementById('intelSimBase').textContent=fmtK(s.fat)+' atual';document.getElementById('intelSimResult').textContent=fmtBRL(projected);document.getElementById('intelSimDetail').textContent=`Base: ${fmtBRL(s.fat)} · Índice atual: ${s.index.toFixed(1)}% · Saúde: ${s.score}`;const de=document.getElementById('intelSimDelta');de.textContent=fmtSignedMoney(delta);de.className='sim-delta '+(delta>=0?'pos':'neg');};
  [vendor,price,vol].forEach(x=>x&&x.addEventListener('input',update));update();
}
['intelTeam','intelCategory','intelRisk'].forEach(id=>{const e=document.getElementById(id);if(e)e.onchange=renderIntel;});
document.getElementById('intelBoardMode').onclick=()=>document.getElementById('presentToggle').click();

/* Render inicial das visões */
renderIntel();
renderGeral();

/* ---------- GESTÃO 360 / REVENUE GROWTH SYSTEM ---------- */
const STRATEGY_KEYS={approvals:'painelApprovalsV1',audit:'painelAuditV1',imports:'painelHistoryImportsV1',role:'painelRoleV1'};
function localJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch(e){return fallback}}
function saveJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
function seededUnit(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/10000}
function strategyEvolutionReal(){
  const keys = Object.keys(ALLDB);
  if(keys.length<2) return [];
  const kA = keys[keys.length-2], kB = keys[keys.length-1];
  const A = ALLDB[kA].vendors, B = ALLDB[kB].vendors;
  const names = new Set([...Object.keys(A), ...Object.keys(B)]);
  return [...names].map(n=>{
    const fatA = A[n]?A[n].fat:0, fatB = B[n]?B[n].fat:0;
    const delta = fatA>0 ? ((fatB-fatA)/fatA*100) : (fatB>0?100:0);
    return {name:n, delta};
  }).filter(s=>s.delta!==0).sort((a,b)=>b.delta-a.delta).slice(0,6);
}
function strategyHistory(weeks){
  // usa somente periodos REAIS carregados no ALLDB (nunca inventa semanas)
  const keys = Object.keys(ALLDB);
  const out = keys.map(k=>{
    const per = ALLDB[k];
    let tableBase=0, revenue=0, loss=0, gain=0;
    Object.values(per.vendors).forEach(vd=>{
      vd.items.forEach(it=>{
        if(!it.ptab || it.ptab<=0 || !it.qtd) return;
        const diff = it.pmed - it.ptab;
        tableBase += it.ptab*it.qtd;
        revenue += it.fat;
        if(diff<0) loss += -diff*it.qtd; else gain += diff*it.qtd;
      });
    });
    const priceIndex = tableBase? (revenue/tableBase*100) : 100;
    const score = clamp(Math.round(100 - (loss/(tableBase||1))*200), 40, 100);
    return {label: per.periodo, fat: per.totals.fat, index: priceIndex, score, loss, source:'real'};
  });
  return out.slice(-weeks);
}
function linePath(vals,x,y){return vals.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ')}
function renderStrategyTrend(hist){
  const W=720,H=245,L=46,R=18,T=20,B=34,iw=W-L-R,ih=H-T-B,x=i=>L+(hist.length===1?0:i/(hist.length-1))*iw;
  const fatMin=Math.min(...hist.map(h=>h.fat))*.96,fatMax=Math.max(...hist.map(h=>h.fat))*1.04,yFat=v=>T+ih-(v-fatMin)/(fatMax-fatMin||1)*ih,yScore=v=>T+ih-(v-55)/(105-55)*ih;
  const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${L}" y1="${T+ih*f}" x2="${W-R}" y2="${T+ih*f}" stroke="var(--line)"/><text x="${L-7}" y="${T+ih*f+3}" text-anchor="end" font-size="7" fill="var(--muted)">${fmtN((fatMax-(fatMax-fatMin)*f)/1000,0)}k</text>`).join('');
  const labels=hist.map((h,i)=>`<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="7" fill="var(--muted)">${esc(h.label)}</text>`).join('');
  const dots=hist.map((h,i)=>`<circle cx="${x(i)}" cy="${yFat(h.fat)}" r="3.5" fill="var(--primary)"><title>${esc(h.label)} · ${fmtBRL(h.fat)}</title></circle><circle cx="${x(i)}" cy="${yScore(h.score)}" r="3" fill="var(--amber)"><title>Saúde ${h.score}</title></circle>`).join('');
  return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" aria-label="Tendência semanal">${grid}<path d="${linePath(hist.map(h=>h.fat),x,yFat)}" fill="none" stroke="var(--primary)" stroke-width="3"/><path d="${linePath(hist.map(h=>h.score),x,yScore)}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-dasharray="5 4"/>${dots}${labels}</svg><div class="trend-legend"><span><i style="background:var(--primary)"></i>Faturamento semanal</span><span><i style="background:var(--amber)"></i>Saúde de preço</span><span>Semanas importadas substituem a base inicial projetada</span></div>`;
}
function strategyClientPressure(){
  return Object.entries(DB.clients||{}).map(([name,c])=>{let table=0,loss=0,gain=0;const products=c.produtos||[];products.forEach(p=>{if(p.ptab&&p.qtd){table+=p.ptab*p.qtd;const d=(p.pmed-p.ptab)*p.qtd;d<0?loss+=-d:gain+=d;}});return{name,fat:c.fat||0,qtd:c.qtd||0,loss,gain,index:table?(c.fat/table*100):100,vendor:(c.vendedores||[]).sort((a,b)=>b.fat-a.fat)[0]?.vend||'—'};}).filter(x=>x.loss>0).sort((a,b)=>b.loss-a.loss);
}
function strategyRecommendations(intel){
  return intel.rows.slice().sort((a,b)=>b.loss-a.loss).slice(0,12).map(r=>{const min=r.table*.97,rec=r.pct<=-10?r.table*.985:r.table*.97,status=r.avg<min?'red':r.avg<r.table?'amber':'green';return{...r,min,rec,status,rule:status==='red'?'Bloquear / aprovar':status==='amber'?'Negociar com limite':'Livre'};});
}
function approvalState(){return localJSON(STRATEGY_KEYS.approvals,{})}
function strategyAudit(){return localJSON(STRATEGY_KEYS.audit,[])}
function recordDecision(id,status,row){const states=approvalState();states[id]={status,at:new Date().toISOString()};saveJSON(STRATEGY_KEYS.approvals,states);const audit=strategyAudit();audit.unshift({at:new Date().toISOString(),actor:document.getElementById('strategyRole').selectedOptions[0].text,action:status==='approved'?'Preço aprovado':'Preço rejeitado',detail:`${row.vendor} · ${row.produto} · ${fmtBRL(row.avg)} vs ${fmtBRL(row.table)}`});saveJSON(STRATEGY_KEYS.audit,audit.slice(0,80));renderStrategy();showToast(status==='approved'?'Preço aprovado e registrado.':'Solicitação rejeitada e registrada.');}
function renderStrategy(){
  const host=document.getElementById('strategyContent');if(!host)return;const intel=computePricingIntel(),weeks=Number(document.getElementById('strategyWindow')?.value||8),hist=strategyHistory(weeks),clients=strategyClientPressure(),recs=strategyRecommendations(intel),states=approvalState();
  const avgRecent=hist.slice(-3).reduce((s,h)=>s+h.fat,0)/Math.min(3,hist.length),forecast=avgRecent*(1+.025),forecastIndex=hist.slice(-3).reduce((s,h)=>s+h.index,0)/Math.min(3,hist.length),forecastScore=Math.round(hist.slice(-3).reduce((s,h)=>s+h.score,0)/Math.min(3,hist.length));
  const goals=[{n:'Índice de preço',v:intel.priceIndex,target:100,s:'%'},{n:'Saúde de preço',v:intel.score,target:90,s:'/100'},{n:'Faturamento semanal',v:intel.revenue,target:forecast,s:'money'},{n:'Vazamento máximo',v:Math.max(0,100-intel.loss/(intel.tableBase||1)*1000),target:98,s:'controle'}];
  const goalHtml=goals.map(g=>{const pct=clamp(g.v/g.target*100,0,110),label=g.s==='money'?fmtK(g.v):g.s==='controle'?`${g.v.toFixed(1)}%`:g.v.toFixed(1)+g.s,targetLabel=g.s==='money'?fmtK(g.target):g.s==='controle'?`${g.target}%`:g.target+g.s;return `<div class="goal-row"><div class="goal-top"><span>${g.n}</span><strong>${label} · meta ${targetLabel}</strong></div><div class="goal-track"><i class="${pct<85?'warn':''}" style="width:${Math.min(100,pct)}%"></i></div></div>`}).join('');
  const clientRows=clients.slice(0,12).map((c,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td title="${esc(c.name)}"><b>${esc(c.name)}</b><br><small>${esc(c.vendor)}</small></td><td class="r">${fmtK(c.fat)}</td><td class="r">${c.index.toFixed(1)}%</td><td class="r" style="color:var(--red);font-weight:800">−${fmtK(c.loss)}</td></tr>`).join('');
  const recRows=recs.map((r,i)=>`<tr><td title="${esc(r.produto)}"><b>${esc(r.produto)}</b><br><small>${esc(r.vendor)}</small></td><td class="r">${fmtBRL(r.avg)}</td><td class="r">${fmtBRL(r.min)}</td><td class="r"><b>${fmtBRL(r.rec)}</b></td><td class="r"><span class="mini-status ${r.status}">${r.rule}</span></td></tr>`).join('');
  const approvalRows=recs.slice(0,8).map((r,i)=>{const id=`${r.vendor}|${r.produto}`,st=states[id]?.status||'pending',label=st==='approved'?'Aprovado':st==='rejected'?'Rejeitado':'Pendente',cls=st==='approved'?'green':st==='rejected'?'red':'amber';return `<tr><td><span class="mini-status ${cls}">${label}</span></td><td><b>${esc(r.vendor)}</b><br><small title="${esc(r.produto)}">${esc(r.produto)}</small></td><td class="r">${r.pct.toFixed(1)}%</td><td class="r">−${fmtK(r.loss)}</td><td><div class="approval-actions"><button class="approve-btn" data-approval="${i}" data-action="approved" ${st!=='pending'?'disabled':''}>Aprovar</button><button class="reject-btn" data-approval="${i}" data-action="rejected" ${st!=='pending'?'disabled':''}>Rejeitar</button></div></td></tr>`}).join('');
  const topSellers=intel.sellers.slice(0,8),topProducts=intel.products.slice(0,9),cols=topProducts.length+1;const heatHead=`<div></div>${topProducts.map(p=>`<div class="heat-h" title="${esc(p.name)}">${esc(p.name)}</div>`).join('')}`;const heatRows=topSellers.map(s=>`<div class="heat-v">${esc(s.name)}</div>${topProducts.map(p=>{const r=intel.rows.find(x=>x.vendor===s.name&&x.produto===p.name),v=r?r.pct:null,color=v==null?'var(--track-bg)':v>=0?'var(--green)':v>=-5?'var(--amber)':'var(--red)';return `<div class="heat-dot" style="background:${color};opacity:${v==null ? .45 : .86}" title="${esc(s.name)} · ${esc(p.name)} · ${v==null?'sem venda':(v>=0?'+':'')+v.toFixed(1)+'%'}">${v==null?'—':Math.round(v)+'%'}</div>`}).join('')}`).join('');
  const plan=recs.slice(0,5).map((r,i)=>`<div class="plan-item"><div class="plan-num">${i+1}</div><div><strong>${i===0?'Reajustar imediatamente':i===1?'Revisar limite comercial':'Negociar recuperação gradual'} — ${esc(r.vendor)}</strong><small>${esc(r.produto)} · preço recomendado ${fmtBRL(r.rec)} · atual ${fmtBRL(r.avg)}</small></div><div class="plan-impact">+${fmtK(r.loss)}</div></div>`).join('');
  const audit=strategyAudit();const auditHtml=audit.length?audit.slice(0,12).map(a=>`<div class="audit-line"><span>${new Date(a.at).toLocaleString('pt-BR')}</span><b>${esc(a.actor)}</b><em>${esc(a.detail)}</em><strong>${esc(a.action)}</strong></div>`).join(''):'<div class="audit-empty">As decisões tomadas na Central de Aprovações aparecerão aqui.</div>';
  const teamStats=['Miguel','Rafael','Leonardo'].map(name=>{const sellers=intel.sellers.filter(s=>vendorInGestor(s.name,name)),fat=sellers.reduce((a,s)=>a+s.fat,0),table=sellers.reduce((a,s)=>a+s.tableBase,0),loss=sellers.reduce((a,s)=>a+s.loss,0),score=sellers.length?Math.round(sellers.reduce((a,s)=>a+s.score,0)/sellers.length):0;return{name,sellers:sellers.length,fat,index:table?fat/table*100:100,loss,score}}).sort((a,b)=>b.score-a.score);
  const teamHtml=teamStats.map((t,i)=>`<div class="supervisor-tile"><span>${i===0?'Líder de saúde':'Equipe comercial'} · ${t.sellers} vendedores</span><strong>${esc(t.name)} · ${t.score}/100</strong><small>${fmtK(t.fat)} faturados · índice ${t.index.toFixed(1)}% · −${fmtK(t.loss)} em vazamento</small></div>`).join('');
  const evolution=strategyEvolutionReal();const evolutionHtml=evolution.length?evolution.map((s,i)=>`<div class="evolution-row"><span>${i+1}. ${esc(s.name)}</span><b class="${s.delta>=0?'above-g':'below-r'}">${s.delta>=0?'+':''}${s.delta.toFixed(1)}%</b></div>`).join(''):'<div class="ai-empty">Ainda não há um segundo período carregado para comparar evolução real.</div>';
  host.innerHTML=`
    <div class="s-card strategy-hero"><div class="strategy-hero-copy"><span class="s-overline">Previsão de fechamento</span><h2>A próxima semana pode fechar em <em>${fmtK(forecast)}</em>.</h2><p>Projeção baseada no ritmo recente, disciplina de preço e base atual. O sistema recalcula automaticamente quando novas semanas forem importadas.</p></div><div class="forecast-kpi good"><span>Faturamento previsto</span><b>${fmtK(forecast)}</b><small>${((forecast/intel.revenue-1)*100)>=0?'+':''}${((forecast/intel.revenue-1)*100).toFixed(1)}% sobre a semana atual</small></div><div class="forecast-kpi ${forecastIndex>=100?'good':'warn'}"><span>Índice previsto</span><b>${forecastIndex.toFixed(1)}%</b><small>meta corporativa: 100%</small></div><div class="forecast-kpi ${forecastScore>=84?'good':'warn'}"><span>Saúde prevista</span><b>${forecastScore}/100</b><small>${tierForScore(forecastScore).label}</small></div><div class="forecast-kpi bad"><span>Risco recuperável</span><b>${fmtK(intel.loss)}</b><small>potencial no mesmo volume</small></div></div>
    <div class="s-card trend-card"><div class="s-head"><div><span class="s-overline">Histórico acumulado</span><h3>Tendência de ${weeks} semanas</h3><p>Faturamento, saúde e evolução da política de preço</p></div><span class="s-badge">${localJSON(STRATEGY_KEYS.imports,[]).length?'Com dados importados':'Base inicial projetada'}</span></div><div class="s-body">${renderStrategyTrend(hist)}</div></div>
    <div class="s-card goal-card"><div class="s-head"><div><span class="s-overline">Metas estratégicas</span><h3>Scorecard da operação</h3><p>Realizado versus objetivo recomendado</p></div><span class="s-badge">${goals.filter(g=>g.v>=g.target).length}/${goals.length} atingidas</span></div><div class="s-body">${goalHtml}</div></div>
    <div class="s-card client-pressure"><div class="s-head"><div><span class="s-overline">Margem por cliente</span><h3>Clientes que mais pressionam preço</h3><p>Ranking pelo valor vendido abaixo da referência</p></div><span class="s-badge">${clients.length} clientes</span></div><div class="s-table-wrap"><table class="s-table"><thead><tr><th>#</th><th>Cliente / vendedor</th><th class="r">Faturamento</th><th class="r">Índice</th><th class="r">Vazamento</th></tr></thead><tbody>${clientRows}</tbody></table></div></div>
    <div class="s-card recommend-center"><div class="s-head"><div><span class="s-overline">Pricing guidance</span><h3>Preço mínimo e semáforo de negociação</h3><p>Recomendação por produto, risco e volume</p></div><span class="s-badge">Regra 97% da tabela</span></div><div class="s-table-wrap"><table class="s-table"><thead><tr><th>Produto / vendedor</th><th class="r">Atual</th><th class="r">Mínimo</th><th class="r">Recomendado</th><th class="r">Regra</th></tr></thead><tbody>${recRows}</tbody></table></div></div>
    <div class="s-card approval-center"><div class="s-head"><div><span class="s-overline">Workflow comercial</span><h3>Central de aprovações</h3><p>Preços críticos com registro de decisão</p></div><span class="s-badge">${recs.slice(0,8).filter(r=>!states[`${r.vendor}|${r.produto}`]).length} pendentes</span></div><div class="s-table-wrap"><table class="s-table"><thead><tr><th>Status</th><th>Solicitação</th><th class="r">Desvio</th><th class="r">Impacto</th><th>Decisão</th></tr></thead><tbody>${approvalRows}</tbody></table></div></div>
    <div class="s-card action-plan"><div class="s-head"><div><span class="s-overline">Execução orientada</span><h3>Plano de ação automático</h3><p>Cinco movimentos recomendados para a equipe</p></div><span class="s-badge">${fmtK(recs.slice(0,5).reduce((s,r)=>s+r.loss,0))} recuperáveis</span></div><div class="s-body"><div class="action-plan-list">${plan}</div></div></div>
    <div class="s-card supervisor-card"><div class="s-head"><div><span class="s-overline">Gestão de equipes</span><h3>Comparativo de supervisores e ranking de evolução</h3><p>Resultado consolidado das equipes e vendedores que mais avançaram no período</p></div><span class="s-badge">3 lideranças</span></div><div class="s-body supervisor-grid"><div class="supervisor-podium">${teamHtml}</div><div><span class="s-overline" style="margin-bottom:9px">Maiores evoluções</span><div class="evolution-list">${evolutionHtml}</div></div></div></div>
    <div class="s-card heat-governance"><div class="s-head"><div><span class="s-overline">Mapa vendedor × produto</span><h3>Disciplina de preço por combinação</h3><p>Verde acima da tabela, âmbar próximo do limite e vermelho crítico</p></div><span class="s-badge">Top ${topSellers.length} × ${topProducts.length}</span></div><div class="s-body heat-matrix"><div class="heat-grid-360" style="grid-template-columns:180px repeat(${topProducts.length},minmax(55px,1fr))">${heatHead}${heatRows}</div></div></div>
    <div class="s-card audit-card"><div class="s-head"><div><span class="s-overline">Governança e conformidade</span><h3>Histórico de decisões</h3><p>Quem aprovou, rejeitou ou alterou uma condição comercial</p></div><span class="s-badge">${audit.length} registros</span></div><div class="s-body">${auditHtml}</div></div>`;
  document.querySelectorAll('[data-approval]').forEach(btn=>btn.onclick=()=>{const r=recs[Number(btn.dataset.approval)];recordDecision(`${r.vendor}|${r.produto}`,btn.dataset.action,r)});
  applyStrategyRole();
}
function applyStrategyRole(){const shell=document.getElementById('strategyShell'),role=document.getElementById('strategyRole')?.value||'diretoria';shell.className='strategy-shell role-'+role;saveJSON(STRATEGY_KEYS.role,role)}
document.getElementById('strategyRole').value=localJSON(STRATEGY_KEYS.role,'diretoria');
document.getElementById('strategyRole').onchange=()=>{applyStrategyRole();showToast('Visão ajustada para '+document.getElementById('strategyRole').selectedOptions[0].text+'.')};
document.getElementById('strategyWindow').onchange=renderStrategy;
document.getElementById('strategyMeeting').onclick=()=>{document.querySelector('.tab[data-t="strategy"]').click();document.body.classList.toggle('strategy-meeting');document.getElementById('strategyMeeting').textContent=document.body.classList.contains('strategy-meeting')?'✕ Encerrar reunião':'▶ Modo reunião';};
document.getElementById('strategyTemplate').onclick=()=>downloadCSV('modelo_importacao_historico_precos.csv',['Semana','Vendedor','Produto','Cliente','Quantidade','Faturamento','Preco_Tabela','Preco_Venda'],[['01 a 05/08/2026','NOME DO VENDEDOR','NOME DO PRODUTO','NOME DO CLIENTE','1000','12500','12,10','12,50']]);
document.getElementById('strategyFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{let rows=[];if(/\.csv$/i.test(file.name)){const text=await file.text(),lines=text.split(/\r?\n/).filter(Boolean),sep=lines[0].includes(';')?';':',';const heads=lines.shift().split(sep).map(x=>x.replace(/^"|"$/g,'').trim());rows=lines.map(l=>Object.fromEntries(l.split(sep).map((v,i)=>[heads[i],v.replace(/^"|"$/g,'').trim()])));}else if(window.XLSX){const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});}else throw new Error('Leitor de Excel indisponível. Salve como CSV e tente novamente.');if(!rows.length)throw new Error('A planilha não possui linhas de dados.');const num=v=>typeof v==='number'?v:(Number(String(v??0).replace(/\./g,'').replace(',','.'))||0),get=(r,names)=>{const k=Object.keys(r).find(k=>names.some(n=>k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'').includes(n)));return k?r[k]:''};let fat=0,table=0,loss=0;rows.forEach(r=>{const f=num(get(r,['faturamento','receita','fat'])),q=num(get(r,['quantidade','qtd','volume'])),pt=num(get(r,['precotabela','tabela','ptab'])),pv=num(get(r,['precovenda','preco','pmed']));fat+=f;table+=pt*q;if(pv<pt)loss+=(pt-pv)*q;});const semana=String(get(rows[0],['semana','periodo'])||file.name.replace(/\.[^.]+$/,'')),index=table?fat/table*100:100,score=clamp(Math.round(100-(table?loss/table:0)*650),0,100),imports=localJSON(STRATEGY_KEYS.imports,[]);imports.push({semana,fat,index,score,loss,rows:rows.length,at:new Date().toISOString()});saveJSON(STRATEGY_KEYS.imports,imports.slice(-24));const st=document.getElementById('importState');st.textContent=`✓ ${rows.length} linhas importadas de “${file.name}”. A semana ${semana} já entrou no histórico e nas previsões.`;st.classList.add('show');renderStrategy();showToast('Planilha importada com sucesso.');}catch(err){showToast(err.message||'Não foi possível importar a planilha.');}finally{e.target.value='';}};

/* ---------- COCKPIT IA / INTELIGÊNCIA AUMENTADA ---------- */
const AI_KEYS={dismissed:'painelAiDismissedV1',threshold:'painelAiThresholdV1'};
function aiProductStats(rows){const map=new Map();rows.forEach(r=>{if(!map.has(r.produto))map.set(r.produto,[]);map.get(r.produto).push(r.avg)});const out={};map.forEach((v,k)=>{const mean=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)||.01;out[k]={mean,sd,count:v.length}});return out}
function aiAnomalies(intel,threshold){const stats=aiProductStats(intel.rows);return intel.rows.map(r=>{const s=stats[r.produto],z=Math.abs(r.avg-s.mean)/s.sd,raw=Math.max(Math.abs(r.pct),z*4),severity=r.pct<0?raw:raw*.55,reason=Math.abs(r.pct)>=threshold?`${Math.abs(r.pct).toFixed(1)}% ${r.pct<0?'abaixo':'acima'} da tabela`:`Preço ${z.toFixed(1)} desvios fora do padrão da equipe`;return{...r,z,severity,reason}}).filter(r=>r.severity>=threshold).sort((a,b)=>(b.loss-a.loss)||(b.severity-a.severity))}
function aiElasticClients(){return Object.entries(DB.clients||{}).map(([name,c])=>{const ps=c.produtos||[],prices=ps.filter(p=>p.ptab&&p.pmed).map(p=>p.pmed/p.ptab),disp=prices.length?Math.sqrt(prices.reduce((s,x)=>s+(x-prices.reduce((a,b)=>a+b,0)/prices.length)**2,0)/prices.length):0,score=clamp(Math.round(28+disp*280),12,96),room=clamp((100-score)/26,0.2,3.2);return{name,fat:c.fat||0,score,room,label:score<45?'Baixa sensibilidade':score<70?'Moderada':'Alta sensibilidade'}}).filter(x=>x.fat>5000).sort((a,b)=>a.score-b.score).slice(0,10)}
function aiWhiteSpaces(){const cats={};Object.values(DB.clients||{}).forEach(c=>(c.produtos||[]).forEach(p=>{const cat=inferCategory(p.produto);cats[cat]=(cats[cat]||0)+(p.fat||0)}));const topCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0]),ops=[];Object.entries(DB.clients||{}).filter(([,c])=>(c.fat||0)>12000).sort((a,b)=>b[1].fat-a[1].fat).slice(0,35).forEach(([name,c])=>{const have=new Set((c.produtos||[]).map(p=>inferCategory(p.produto)));topCats.filter(cat=>!have.has(cat)).slice(0,1).forEach(cat=>ops.push({client:name,cat,fat:c.fat,potential:(c.produtos&&c.produtos.length?c.fat/new Set(c.produtos.map(p=>inferCategory(p.produto))).size:c.fat*0.05)}))});return ops.sort((a,b)=>b.potential-a.potential).slice(0,10)}
function aiDailyPacing(){const days={};Object.values(DB.vendors).forEach(v=>v.items.forEach(it=>(it.rows||[]).forEach(r=>{const d=r.data||'Sem data';days[d]=(days[d]||0)+(r.fat||0)})));const entries=Object.entries(days).sort((a,b)=>{const pa=a[0].split('/').reverse().join(''),pb=b[0].split('/').reverse().join('');return pa.localeCompare(pb)});return entries.slice(-7)}
function aiQuality(){let total=0,missingTable=0,missingClient=0,zero=0;const ops=new Set(),dupes=new Set();Object.values(DB.vendors).forEach(v=>v.items.forEach(it=>{total++;if(!it.ptab)missingTable++;if(!it.qtd||!it.fat)zero++;(it.rows||[]).forEach(r=>{if(!r.cli)missingClient++;if(r.op){if(ops.has(r.op))dupes.add(r.op);ops.add(r.op)}})}));const penalty=missingTable*1.4+missingClient*.2+zero*2,score=clamp(Math.round(100-penalty/(total||1)*100),0,100);return{score,total,missingTable,missingClient,zero,duplicates:dupes.size}}
function aiNarrative(intel,anomalies,elastic,spaces){const worst=anomalies[0],best=elastic[0],space=spaces[0];return `A operação está com saúde ${intel.score}/100 e índice de preço de ${intel.priceIndex.toFixed(1)}%. O principal desvio detectado está em ${worst?esc(worst.produto):'nenhum produto crítico'}, conduzido por ${worst?esc(worst.vendor):'—'}, com impacto potencial de ${fmtK(worst?.loss||0)}. A oportunidade de reajuste com menor risco aparece em ${best?esc(best.name):'—'}, com espaço estimado de ${best?best.room.toFixed(1):'0,0'}%. Para expansão de mix, ${space?esc(space.client):'—'} ainda não compra ${space?esc(space.cat):'categorias relevantes'}, representando até ${fmtK(space?.potential||0)} de oportunidade incremental.`}
function renderAI(){
  const el=document.getElementById('aiContent');if(!el)return;const intel=computePricingIntel(),threshold=Number(document.getElementById('aiThreshold')?.value||7),scope=document.getElementById('aiScope')?.value||'todos',anomalies=aiAnomalies(intel,threshold),elastic=aiElasticClients(),spaces=aiWhiteSpaces(),pace=aiDailyPacing(),quality=aiQuality(),dismissed=new Set(localJSON(AI_KEYS.dismissed,[]));
  const visibleAnomalies=anomalies.filter((a,i)=>!dismissed.has(`${a.vendor}|${a.produto}`)).slice(0,8),maxP=Math.max(...pace.map(x=>x[1]),1),narrative=aiNarrative(intel,anomalies,elastic,spaces);
  const anomalyHtml=visibleAnomalies.map((a,i)=>`<div class="anomaly-item"><div class="anomaly-icon">!</div><div><strong>${esc(a.produto)}</strong><small>${esc(a.vendor)} · ${a.reason} · ${fmtN(a.qtd)} kg</small></div><div class="anomaly-score">${a.severity.toFixed(0)} pts</div></div>`).join('')||'<div class="ai-empty">Nenhuma anomalia aberta com a sensibilidade atual.</div>';
  const elasticHtml=elastic.map(c=>`<div class="elastic-row"><div><b>${esc(c.name)}</b><br><small>${fmtK(c.fat)} faturados</small></div><b>${c.room.toFixed(1)}%</b><div class="elastic-meter"><i style="width:${c.score}%"></i></div><div class="elastic-tag">${c.label}</div></div>`).join('');
  const mixHtml=spaces.slice(0,8).map(x=>`<div class="mix-opportunity"><span>White space · ${esc(x.cat)}</span><strong>${esc(x.client)}</strong><small>+${fmtK(x.potential)} de potencial estimado</small></div>`).join('');
  const paceHtml=pace.map((x,i)=>`<div class="pacing-col"><b>${fmtK(x[1])}</b><i class="${x[0].startsWith('Projeção')?'projected':''}" style="height:${Math.max(4,x[1]/maxP*115)}px"></i><span>${esc(x[0])}</span></div>`).join('');
  const alerts=anomalies.slice(0,10),alertHtml=alerts.map((a,i)=>{const id=`${a.vendor}|${a.produto}`,read=dismissed.has(id);return `<div class="smart-alert ${read?'read':''}"><div class="alert-dot"></div><div><strong>${a.pct<-10?'Desconto crítico exige aprovação':'Comportamento fora do padrão'}</strong><small>${esc(a.vendor)} · ${esc(a.produto)} · ${a.reason}</small></div><button data-ai-dismiss="${i}">${read?'Lido':'Marcar lido'}</button></div>`}).join('');
  const sellerOpts=intel.sellers.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  el.innerHTML=`
    <div class="ai-card ai-brief"><div class="ai-brief-copy"><span class="ai-label">Briefing executivo automático</span><h2>O que merece atenção agora.</h2><p>${narrative}</p></div><div class="ai-brief-actions"><button id="aiGoCritical">→ Abrir o maior desvio</button><button id="aiCopyBrief">▣ Copiar resumo executivo</button><button id="aiGoOpportunity">↗ Ver oportunidade de mix</button></div></div>
    <div class="ai-card anomaly-card"><div class="ai-card-head"><div><span class="over">Anomaly detection</span><h3>Desvios fora do comportamento esperado</h3><p>Combina tabela, dispersão da equipe, volume e impacto</p></div><span class="ai-badge">${anomalies.length} sinais</span></div><div class="ai-card-body"><div class="anomaly-list">${anomalyHtml}</div></div></div>
    <div class="ai-card elasticity-card"><div class="ai-card-head"><div><span class="over">Elasticidade comercial</span><h3>Clientes com espaço para reajuste</h3><p>Estimativa de sensibilidade baseada no comportamento observado</p></div><span class="ai-badge">Menor risco primeiro</span></div><div class="ai-card-body">${elasticHtml}</div></div>
    <div class="ai-card whitespace-card"><div class="ai-card-head"><div><span class="over">Cross-sell intelligence</span><h3>Oportunidades de expansão de mix</h3><p>Categorias relevantes ainda não compradas pelos clientes</p></div><span class="ai-badge">${spaces.length} oportunidades</span></div><div class="ai-card-body"><div class="mix-grid">${mixHtml}</div></div></div>
    <div class="ai-card alert-inbox"><div class="ai-card-head"><div><span class="over">Caixa de entrada inteligente</span><h3>Alertas acionáveis</h3><p>Centralize os eventos que precisam de leitura ou decisão</p></div><span class="ai-badge">${alerts.filter(a=>!dismissed.has(`${a.vendor}|${a.produto}`)).length} não lidos</span></div><div class="ai-card-body"><div class="smart-alert-list">${alertHtml}</div></div></div>
    <div class="ai-card scenario-lab"><div class="ai-card-head"><div><span class="over">Scenario lab</span><h3>Comparador de cenários comerciais</h3><p>Preço, volume e recuperação de mix calculados simultaneamente</p></div><span class="ai-badge">Simulação não altera os dados</span></div><div class="scenario-controls"><div class="scenario-control"><label>Vendedor</label><select id="aiScenarioSeller">${sellerOpts}</select><b id="aiScenarioBase">—</b></div><div class="scenario-control"><label>Preço <span id="aiPriceL">+2,0%</span></label><input id="aiPrice" type="range" min="-10" max="15" step=".5" value="2"><b>Reajuste recomendado</b></div><div class="scenario-control"><label>Volume <span id="aiVolumeL">−1,0%</span></label><input id="aiVolume" type="range" min="-20" max="20" step="1" value="-1"><b>Elasticidade esperada</b></div><div class="scenario-control"><label>Mix incremental <span id="aiMixL">+3,0%</span></label><input id="aiMix" type="range" min="0" max="15" step="1" value="3"><b>Cross-sell projetado</b></div></div><div class="scenario-results"><div class="scenario-result"><span>Faturamento projetado</span><b id="aiResultFat">—</b><small id="aiResultDelta">—</small></div><div class="scenario-result"><span>Índice de preço</span><b id="aiResultIndex">—</b><small>versus tabela de referência</small></div><div class="scenario-result"><span>Saúde projetada</span><b id="aiResultHealth">—</b><small>score após o cenário</small></div><div class="scenario-result"><span>Valor adicional</span><b id="aiResultValue">—</b><small>ganho estimado no período</small></div></div></div>
    <div class="ai-card data-quality"><div class="ai-card-head"><div><span class="over">Data trust</span><h3>Qualidade e confiabilidade</h3><p>Validação automática da base utilizada</p></div><span class="ai-badge">${quality.score>=90?'Confiável':'Revisar'}</span></div><div class="ai-card-body"><div class="quality-ring-row"><div class="quality-ring" style="--q:${quality.score}"><b>${quality.score}%</b></div><div class="quality-metrics"><div class="quality-line"><span>Produtos sem tabela</span><b>${quality.missingTable}</b></div><div class="quality-line"><span>Registros sem cliente</span><b>${quality.missingClient}</b></div><div class="quality-line"><span>Itens zerados</span><b>${quality.zero}</b></div><div class="quality-line"><span>OPs repetidas na base</span><b>${quality.duplicates}</b></div></div></div></div></div>
    <div class="ai-card daily-pacing"><div class="ai-card-head"><div><span class="over">Daily pacing</span><h3>Ritmo diário e projeção operacional</h3><p>Realizado por dia com complemento projetado</p></div><span class="ai-badge">${fmtK(pace.reduce((s,x)=>s+x[1],0))} no ciclo</span></div><div class="ai-card-body"><div class="pacing-bars">${paceHtml}</div></div></div>`;
  wireAI(intel,alerts,narrative,spaces);
  if(scope!=='todos'){const allowed={clientes:['elasticity-card','whitespace-card','alert-inbox'],produtos:['anomaly-card','scenario-lab','alert-inbox'],vendedores:['scenario-lab','daily-pacing','alert-inbox']}[scope]||[];document.querySelectorAll('.anomaly-card,.elasticity-card,.whitespace-card,.alert-inbox,.scenario-lab,.daily-pacing').forEach(card=>{if(!allowed.some(c=>card.classList.contains(c)))card.style.display='none'});}
}
function wireAI(intel,alerts,narrative,spaces){
  const seller=document.getElementById('aiScenarioSeller'),price=document.getElementById('aiPrice'),volume=document.getElementById('aiVolume'),mix=document.getElementById('aiMix');const update=()=>{const s=intel.sellers.find(x=>x.name===seller.value)||intel.sellers[0];if(!s)return;const p=Number(price.value),v=Number(volume.value),m=Number(mix.value),projected=s.fat*(1+p/100)*(1+v/100)*(1+m/100),delta=projected-s.fat,index=s.index*(1+p/100),health=clamp(Math.round(s.score+p*1.7+Math.min(4,m*.25)-Math.max(0,-v)*.12),0,100);document.getElementById('aiPriceL').textContent=`${p>=0?'+':''}${p.toFixed(1).replace('.',',')}%`;document.getElementById('aiVolumeL').textContent=`${v>=0?'+':''}${v.toFixed(1).replace('.',',')}%`;document.getElementById('aiMixL').textContent=`+${m.toFixed(1).replace('.',',')}%`;document.getElementById('aiScenarioBase').textContent=fmtK(s.fat)+' atual';document.getElementById('aiResultFat').textContent=fmtK(projected);document.getElementById('aiResultDelta').textContent=`${delta>=0?'+':'−'}${fmtK(Math.abs(delta))} versus atual`;document.getElementById('aiResultIndex').textContent=index.toFixed(1)+'%';document.getElementById('aiResultHealth').textContent=health+'/100';document.getElementById('aiResultValue').textContent=fmtSignedMoney(delta)};[seller,price,volume,mix].forEach(x=>x?.addEventListener('input',update));update();
  document.querySelectorAll('[data-ai-dismiss]').forEach(btn=>btn.onclick=()=>{const a=alerts[Number(btn.dataset.aiDismiss)],set=new Set(localJSON(AI_KEYS.dismissed,[]));set.add(`${a.vendor}|${a.produto}`);saveJSON(AI_KEYS.dismissed,[...set]);renderAI()});
  document.getElementById('aiGoCritical').onclick=()=>{const a=alerts[0];if(a)goIntelTarget('product',a.produto)};document.getElementById('aiGoOpportunity').onclick=()=>document.querySelector('.whitespace-card')?.scrollIntoView({behavior:'smooth'});document.getElementById('aiCopyBrief').onclick=async()=>{try{await navigator.clipboard.writeText(narrative);showToast('Resumo executivo copiado.')}catch(e){showToast('Não foi possível copiar automaticamente.')}};
}
document.getElementById('aiThreshold').value=localJSON(AI_KEYS.threshold,7);document.getElementById('aiThreshold').onchange=e=>{const v=clamp(Number(e.target.value)||7,1,20);e.target.value=v;saveJSON(AI_KEYS.threshold,v);renderAI()};document.getElementById('aiScope').onchange=renderAI;
document.getElementById('aiResetAlerts').onclick=()=>{saveJSON(AI_KEYS.dismissed,[]);renderAI();showToast('Todos os alertas foram reabertos.')};
document.getElementById('aiBackup').onclick=()=>{const data={exportadoEm:new Date().toISOString(),periodo:DB.periodo,preferencias:{tema:localStorage.getItem('painelTheme'),role:localJSON(STRATEGY_KEYS.role,'diretoria'),threshold:localJSON(AI_KEYS.threshold,7)},historico:localJSON(STRATEGY_KEYS.imports,[]),aprovacoes:approvalState(),auditoria:strategyAudit(),alertasLidos:localJSON(AI_KEYS.dismissed,[])};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='backup_painel_precos_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Backup dos ajustes exportado.')};

/* ---------- EXPORTAR CSV ---------- */
function csvEscape(v){
  const s = String(v==null?'':v);
  if(/[";\n,]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}
function downloadCSV(filename, headers, rows){
  const lines = [headers.map(csvEscape).join(';')];
  rows.forEach(r=>lines.push(r.map(csvEscape).join(';')));
  const csv = '\uFEFF'+lines.join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado: '+filename);
}
document.getElementById('btnExportVend').addEventListener('click', ()=>{
  if(!currentVendorItems.length){ showToast('Nada para exportar.'); return; }
  const headers = ['Produto','Quantidade (kg)','Faturamento (R$)','Tabela (R$)','Preço médio (R$)','Preço de venda (R$)','Líq. s/ Rapel (R$)','Ops'];
  const rows = currentVendorItems.map(it=>[it.produto, it.qtd, it.fat.toFixed(2), it.ptab||'', it.pmed.toFixed(2), it.pvenda!=null?it.pvenda.toFixed(2):'', it.pliq!=null?it.pliq.toFixed(2):'', it.ops]);
  downloadCSV(`vendedor_${currentVendorName.replace(/[^a-zA-Z0-9]+/g,'_')}_${periodoAtual}.csv`, headers, rows);
});
document.getElementById('btnExportProd').addEventListener('click', ()=>{
  if(!currentProdSellers.length){ showToast('Nada para exportar.'); return; }
  const headers = ['Vendedor','Quantidade (kg)','Faturamento (R$)','Preço médio (R$)','Preço de venda (R$)','Líq. s/ Rapel (R$)'];
  const rows = currentProdSellers.map(s=>[s.vend, s.qtd, s.fat.toFixed(2), s.pmed.toFixed(2), s.pvenda!=null?s.pvenda.toFixed(2):'', s.pliq!=null?s.pliq.toFixed(2):'']);
  downloadCSV(`produto_${currentProdName.replace(/[^a-zA-Z0-9]+/g,'_').slice(0,40)}_${periodoAtual}.csv`, headers, rows);
});
document.getElementById('btnExportCli').addEventListener('click', ()=>{
  if(!currentCliProducts.length){ showToast('Nada para exportar.'); return; }
  const headers = ['Produto','Quantidade (kg)','Faturamento (R$)','Preço médio (R$)','Tabela (R$)','Ops'];
  const rows = currentCliProducts.map(p=>[p.produto, p.qtd, p.fat.toFixed(2), p.pmed.toFixed(2), p.ptab||'', p.ops]);
  downloadCSV(`cliente_${currentCliName.replace(/[^a-zA-Z0-9]+/g,'_').slice(0,40)}_${periodoAtual}.csv`, headers, rows);
});

/* ---------- TOAST ---------- */
let _toastTimer=null;
function showToast(msg){
  let t = document.getElementById('_toast');
  if(!t){ t = document.createElement('div'); t.id='_toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ---------- BUSCA GLOBAL ---------- */
const gsInput = document.getElementById('globalSearch');
const gsResults = document.getElementById('globalSearchResults');
gsInput.addEventListener('input', ()=>{
  const q = gsInput.value.trim().toLowerCase();
  if(q.length<2){ gsResults.style.display='none'; gsResults.innerHTML=''; return; }
  const vMatches = Object.keys(DB.vendors).filter(v=>v.toLowerCase().includes(q)).slice(0,6);
  const pMatches = Object.keys(DB.products).filter(p=>p.toLowerCase().includes(q)).slice(0,6);
  if(!vMatches.length && !pMatches.length){
    gsResults.innerHTML = '<div class="gs-empty">Nenhum resultado neste período.</div>';
    gsResults.style.display='block'; return;
  }
  let html = '';
  if(vMatches.length){
    html += '<div class="gs-group-label">Vendedores</div>';
    html += vMatches.map(v=>`<div class="gs-item" data-type="vend" data-val="${esc(v)}">${esc(v)}<span class="muted">${fmtK(DB.vendors[v].fat)}</span></div>`).join('');
  }
  if(pMatches.length){
    html += '<div class="gs-group-label">Produtos</div>';
    html += pMatches.map(p=>`<div class="gs-item" data-type="prod" data-val="${esc(p)}">${esc(p)}</div>`).join('');
  }
  gsResults.innerHTML = html;
  gsResults.style.display='block';
});
gsResults.addEventListener('click', e=>{
  const item = e.target.closest('.gs-item'); if(!item) return;
  const type = item.dataset.type, val = item.dataset.val;
  if(type==='vend'){
    document.querySelector('.tab[data-t="vend"]').click();
    gestorVend='todos';
    document.querySelectorAll('#gestV .gbtn').forEach(b=>b.classList.toggle('on', b.dataset.g==='todos'));
    rebuildSelVend();
    selV.value = val;
    renderVendor(); renderTeamSummary();
  } else {
    document.querySelector('.tab[data-t="prod"]').click();
    gestorProd='todos';
    document.querySelectorAll('#gestP .gbtn').forEach(b=>b.classList.toggle('on', b.dataset.g==='todos'));
    const qP = document.getElementById('qProd'); if(qP) qP.value='';
    rebuildSelProd();
    selP.value = val;
    renderProd();
  }
  gsInput.value=''; gsResults.style.display='none'; gsResults.innerHTML='';
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.global-search-wrap')) gsResults.style.display='none';
});

/* ---------- COPIAR LINK COM FILTRO ATUAL ---------- */
function buildShareLink(){
  const params = new URLSearchParams();
  params.set('p', periodoAtual);
  const activeTab = document.querySelector('.tab.on');
  const t = activeTab ? activeTab.dataset.t : 'geral';
  params.set('t', t);
  if(t==='vend'){ params.set('g', gestorVend); if(selV.value) params.set('v', selV.value); }
  if(t==='prod'){ params.set('g', gestorProd); if(selP.value) params.set('pr', selP.value); }
  if(t==='cli'){ if(selCli.value) params.set('c', selCli.value); }
  return location.origin + location.pathname + '#' + params.toString();
}
document.getElementById('btnShareLink').addEventListener('click', ()=>{
  const link = buildShareLink();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(()=>showToast('Link copiado!')).catch(()=>{
      window.prompt('Copie o link abaixo:', link);
    });
  } else {
    window.prompt('Copie o link abaixo:', link);
  }
});
function applyShareParams(){
  if(!location.hash || location.hash.length<2) return;
  const params = new URLSearchParams(location.hash.substring(1));
  const p = params.get('p');
  if(p && ALLDB[p]){
    document.querySelectorAll('#periodBar .pbtn').forEach(b=>b.classList.toggle('on', b.dataset.p===p));
    switchPeriod(p);
  }
  const t = params.get('t') || 'geral';
  const tabBtn = document.querySelector(`.tab[data-t="${t}"]`);
  if(tabBtn) tabBtn.click();
  if(t==='vend'){
    const g = params.get('g');
    if(g){
      const gbtn = document.querySelector(`#gestV .gbtn[data-g="${g}"]`);
      if(gbtn){ document.querySelectorAll('#gestV .gbtn').forEach(b=>b.classList.remove('on')); gbtn.classList.add('on'); gestorVend=g; rebuildSelVend(); }
    }
    const v = params.get('v');
    if(v && DB.vendors[v]){ selV.value=v; renderVendor(); renderTeamSummary(); }
  }
  if(t==='prod'){
    const g = params.get('g');
    if(g){
      const gbtn = document.querySelector(`#gestP .gbtn[data-g="${g}"]`);
      if(gbtn){ document.querySelectorAll('#gestP .gbtn').forEach(b=>b.classList.remove('on')); gbtn.classList.add('on'); gestorProd=g; }
    }
    const pr = params.get('pr');
    if(pr && DB.products[pr]){ selP.value=pr; renderProd(); }
  }
  if(t==='cli'){
    const c = params.get('c');
    if(c && DB.clients && DB.clients[c]){ selCli.value=c; renderCli(); }
  }
}
applyShareParams();

/* ---------- CURVA ABC DE CLIENTES ---------- */
function renderABC(){
  const el = document.getElementById('abcContent');
  const clients = DB.clients || {};
  const arr = Object.entries(clients).map(([n,c])=>({n,fat:c.fat})).sort((a,b)=>b.fat-a.fat);
  if(!arr.length){ el.innerHTML=''; return; }
  const total = arr.reduce((s,c)=>s+c.fat,0);
  let cum=0;
  const withCum = arr.map(c=>{ cum+=c.fat; const cumPct=cum/total*100; let cls = cumPct<=80?'A':cumPct<=95?'B':'C'; return {...c, pct:c.fat/total*100, cumPct, cls}; });
  const countA = withCum.filter(c=>c.cls==='A').length;
  const countB = withCum.filter(c=>c.cls==='B').length;
  const countC = withCum.filter(c=>c.cls==='C').length;
  const fatA = withCum.filter(c=>c.cls==='A').reduce((s,c)=>s+c.fat,0);
  const fatB = withCum.filter(c=>c.cls==='B').reduce((s,c)=>s+c.fat,0);
  const fatC = withCum.filter(c=>c.cls==='C').reduce((s,c)=>s+c.fat,0);
  const donut = donutSVG([
    {pct: fatA/total*100, color:'var(--green)'},
    {pct: fatB/total*100, color:'var(--amber)'},
    {pct: fatC/total*100, color:'var(--red)'},
  ]);
  const top10 = withCum.slice(0,10);
  const top10Pct = top10.length ? (top10.reduce((s,c)=>s+c.fat,0)/total*100) : 0;
  const showAll = el.dataset.expanded === '1';
  const listToShow = showAll ? withCum : withCum.slice(0,10);
  const rows = listToShow.map((c,i)=>`
    <div class="abc-row">
      <div class="abc-badge ${c.cls}">${c.cls}</div>
      <div class="nm" title="${esc(c.n)}">${i+1}. ${esc(c.n)}</div>
      <div class="v">${fmtBRL(c.fat)}</div>
      <div class="cum">${c.cumPct.toFixed(1)}%</div>
    </div>`).join('');
  el.innerHTML = `
    <div class="abc-card">
      <h3>Curva ABC de clientes</h3>
      <div class="abc-sub">Os 10 maiores clientes representam <b>${top10Pct.toFixed(1)}%</b> do faturamento deste período · ${arr.length} clientes no total</div>
      <div class="abc-donut-row">
        ${donut}
        <div class="abc-summary" style="flex:1">
          <div class="abc-chip A"><div class="l">Classe A (até 80%)</div><div class="v">${countA} cliente${countA!=1?'s':''}</div></div>
          <div class="abc-chip B"><div class="l">Classe B (80–95%)</div><div class="v">${countB} cliente${countB!=1?'s':''}</div></div>
          <div class="abc-chip C"><div class="l">Classe C (95–100%)</div><div class="v">${countC} cliente${countC!=1?'s':''}</div></div>
        </div>
      </div>
      ${rows}
      ${withCum.length>10?`<span class="abc-toggle" id="abcToggleBtn">${showAll?'Mostrar menos ▲':`Mostrar todos os ${withCum.length} clientes ▼`}</span>`:''}
    </div>`;
  const toggleBtn = document.getElementById('abcToggleBtn');
  if(toggleBtn) toggleBtn.onclick = ()=>{ el.dataset.expanded = showAll ? '0' : '1'; renderABC(); };
}

/* ---------- COMPARTILHAR NO WHATSAPP ---------- */
function buildWhatsAppText(){
  const activeTab = document.querySelector('.tab.on');
  const t = activeTab ? activeTab.dataset.t : 'geral';
  let lines = [`*Painel Preço Médio · Apucarana*`, `Período: ${DB.periodo}`, ''];
  if(t==='vend' && gestorVend!=='todos'){
    const teamVendors = vendNames.filter(v=>vendorInGestor(v, gestorVend));
    let totalFat=0, qtdWithTab=0, fatWithTab=0, tabFat=0;
    teamVendors.forEach(vn=>{
      DB.vendors[vn].items.forEach(it=>{
        totalFat+=it.fat;
        if(it.ptab>0){ qtdWithTab+=it.qtd; fatWithTab+=it.fat; tabFat+=it.ptab*it.qtd; }
      });
    });
    const avgPrice = qtdWithTab? fatWithTab/qtdWithTab : 0;
    const avgTab = qtdWithTab? tabFat/qtdWithTab : 0;
    const diff = avgPrice-avgTab;
    const pct = avgTab? diff/avgTab*100 : 0;
    lines.push(`*Equipe ${gestorVend}*`);
    lines.push(`Faturamento: ${fmtK(totalFat)}`);
    lines.push(`Preço vs tabela: ${diff>=0?'+':''}${fmtBRL(diff)} (${pct>=0?'+':''}${pct.toFixed(1)}%)`);
  } else {
    lines.push(`Faturamento total: ${fmtK(DB.totals.fat)}`);
    lines.push(`Vendedores: ${DB.totals.nvend} · Produtos: ${DB.totals.nprod}`);
    const stats = collectItemStats();
    const abaixo = stats.filter(s=>s.pct<=-10).length;
    if(abaixo>0) lines.push(`⚠ ${abaixo} produto${abaixo>1?'s':''} vendido${abaixo>1?'s':''} mais de 10% abaixo da tabela`);
  }
  lines.push('', buildShareLink());
  return lines.join('\n');
}
document.getElementById('btnWhatsApp').addEventListener('click', ()=>{
  const text = buildWhatsAppText();
  window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank');
});

/* ---------- LEMBRAR ÚLTIMO FILTRO ---------- */
function saveLastFilter(){
  try{
    const activeTab = document.querySelector('.tab.on');
    const t = activeTab ? activeTab.dataset.t : 'geral';
    const state = { p: periodoAtual, t, gV: gestorVend, gP: gestorProd, gG: gestorGeral };
    localStorage.setItem('painelLastFilterV3', JSON.stringify(state));
  }catch(e){}
}
function loadLastFilter(){
  try{
    const raw = localStorage.getItem('painelLastFilterV3');
    if(!raw) return;
    const st = JSON.parse(raw);
    if(st.p && ALLDB[st.p] && st.p!==periodoAtual){
      document.querySelectorAll('#periodBar .pbtn').forEach(b=>b.classList.toggle('on', b.dataset.p===st.p));
      switchPeriod(st.p);
    }
    if(st.gG){
      const gbtn = document.querySelector(`#gestG .gbtn[data-g="${st.gG}"]`);
      if(gbtn){ document.querySelectorAll('#gestG .gbtn').forEach(b=>b.classList.remove('on')); gbtn.classList.add('on'); gestorGeral=st.gG; }
    }
    if(st.gV){
      const gbtn = document.querySelector(`#gestV .gbtn[data-g="${st.gV}"]`);
      if(gbtn){ document.querySelectorAll('#gestV .gbtn').forEach(b=>b.classList.remove('on')); gbtn.classList.add('on'); gestorVend=st.gV; rebuildSelVend(); }
    }
    if(st.gP){
      const gbtn = document.querySelector(`#gestP .gbtn[data-g="${st.gP}"]`);
      if(gbtn){ document.querySelectorAll('#gestP .gbtn').forEach(b=>b.classList.remove('on')); gbtn.classList.add('on'); gestorProd=st.gP; }
    }
    if(st.t){
      const tabBtn = document.querySelector(`.tab[data-t="${st.t}"]`);
      if(tabBtn) tabBtn.click();
    }
  }catch(e){}
}
/* só aplica o filtro lembrado se não veio um link compartilhado explícito */
if(!location.hash || location.hash.length<2){ loadLastFilter(); }

/* ---------- ANIMAÇÃO DOS NÚMEROS DO KPI ---------- */
function animateKpis(){
  document.querySelectorAll('#kpis .kpi .val').forEach(el=>{
    const raw = el.innerHTML;
    const m = raw.match(/^(R\$\s*)?([\d.,]+)(.*)$/s);
    if(!m) return;
    const numStr = m[2].replace(/\./g,'').replace(',', '.');
    const endVal = parseFloat(numStr);
    if(isNaN(endVal)) return;
    const prefix = m[1]||''; const suffix = m[3]||'';
    const decimals = m[2].includes(',') ? m[2].split(',')[1].length : 0;
    const start = performance.now(); const duration=650;
    function tick(now){
      const t = Math.min((now-start)/duration,1);
      const eased = 1-Math.pow(1-t,3);
      const val = endVal*eased;
      el.innerHTML = prefix + val.toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) + suffix;
      if(t<1) requestAnimationFrame(tick); else el.innerHTML = raw;
    }
    requestAnimationFrame(tick);
  });
}

/* ---------- ATALHO DE TECLADO ---------- */
document.addEventListener('keydown', (e)=>{
  if(e.key==='/' && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='SELECT'){
    e.preventDefault();
    document.getElementById('globalSearch').focus();
  }
  if(e.key==='Escape'){
    gsResults.style.display='none';
    document.activeElement.blur();
  }
});

/* ---------- TOUR RÁPIDO (primeira visita) ---------- */
const TOUR_STEPS = [
  { title:'Bem-vindo ao Pricing Command Center', text:'A nova Central de Decisão transforma preço, volume e tabela em prioridades comerciais. Este tour mostra os principais recursos.' },
  { title:'Central de Decisão', text:'O índice de saúde, o vazamento de receita e a fila de cinco decisões mostram imediatamente onde agir e quanto pode ser recuperado.' },
  { title:'Busca global', text:'Logo abaixo das abas tem um campo de busca — digite o nome de um vendedor ou produto e ele te leva direto pra tela certa. Atalho: aperte "/" em qualquer lugar do painel.' },
  { title:'Períodos e equipes', text:'No topo dá pra trocar o período analisado, e em várias abas dá pra filtrar só a equipe do Miguel, Rafael ou Leonardo.' },
  { title:'Exportar e compartilhar', text:'Os botões "Exportar CSV", "Copiar link" e "WhatsApp" deixam prontos pra mandar exatamente o que está filtrado na tela, sem reconstruir nada.' },
  { title:'Corredores, riscos e cenários', text:'Clique nos vendedores, produtos, alertas e bolhas para aprofundar a análise. No final da Central há um simulador combinado de preço e volume.' },
  { title:'Visão Geral e Comparar períodos', text:'A Visão Geral mantém os gráficos operacionais; Comparar períodos mostra quem cresceu ou caiu entre semanas.' },
];
let tourIdx = 0;
function renderTourStep(){
  const s = TOUR_STEPS[tourIdx];
  const overlay = document.getElementById('tourOverlay');
  const isLast = tourIdx === TOUR_STEPS.length-1;
  overlay.innerHTML = `
    <div class="tour-card">
      <div class="step-lab">Passo ${tourIdx+1} de ${TOUR_STEPS.length}</div>
      <h4>${s.title}</h4>
      <p>${s.text}</p>
      <div class="tour-dots">${TOUR_STEPS.map((_,i)=>`<span class="tour-dot ${i===tourIdx?'on':''}"></span>`).join('')}</div>
      <div class="tour-actions">
        <button class="tour-skip" id="tourSkip">Pular tour</button>
        <button class="tour-next" id="tourNext">${isLast?'Concluir':'Próximo'}</button>
      </div>
    </div>`;
  document.getElementById('tourSkip').onclick = closeTour;
  document.getElementById('tourNext').onclick = ()=>{
    if(isLast) closeTour();
    else { tourIdx++; renderTourStep(); }
  };
}
function closeTour(){
  const overlay = document.getElementById('tourOverlay');
  if(overlay) overlay.remove();
  try{ localStorage.setItem('painelTourSeenV3','1'); }catch(e){}
}
function maybeStartTour(){
  try{
    if(localStorage.getItem('painelTourSeenV3')==='1') return;
  }catch(e){}
  const overlay = document.createElement('div');
  overlay.id = 'tourOverlay';
  overlay.className = 'tour-overlay';
  document.body.appendChild(overlay);
  tourIdx = 0;
  renderTourStep();
}
setTimeout(maybeStartTour, 600);

/* ---------- MODO APRESENTAÇÃO ---------- */
document.getElementById('presentToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('presentation-mode');
});

/* ---------- SPARKLINE DIÁRIA POR VENDEDOR ---------- */
function vendorDailySeries(vname){
  const map = {};
  const vd = DB.vendors[vname];
  if(!vd) return [];
  vd.items.forEach(it=>{ it.rows.forEach(r=>{ map[r.data] = (map[r.data]||0) + r.fat; }); });
  const days = Object.keys(map).sort((a,b)=>{
    const da = a.split('/').reverse().join('-'), db = b.split('/').reverse().join('-');
    return da.localeCompare(db);
  });
  return days.map(d=>map[d]);
}
function sparklineSVG(values, w, h){
  w = w||58; h = h||20;
  if(values.length<2) return '';
  const max = Math.max(...values, 0.0001), min = Math.min(...values, 0);
  const range = (max-min)||1;
  const step = w/(values.length-1);
  const pts = values.map((v,i)=>`${(i*step).toFixed(1)},${(h-((v-min)/range*h)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible;flex:none"><polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* ---------- MAPA DE CALOR DE VENDAS (todos os períodos) ---------- */
function computeAllDaysRevenue(){
  const map = {};
  Object.values(ALLDB).forEach(period=>{
    Object.entries(period.vendors).forEach(([vname,vd])=>{
      if(!vendorInGestor(vname, gestorGeral)) return;
      vd.items.forEach(it=>{ it.rows.forEach(r=>{ map[r.data] = (map[r.data]||0) + r.fat; }); });
    });
  });
  return map;
}
function renderCalendarHeatmap(){
  const map = computeAllDaysRevenue();
  const entries = Object.entries(map).map(([d,v])=>{
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d); if(!m) return null;
    return {date:new Date(+m[3],+m[2]-1,+m[1]), d, v};
  }).filter(Boolean).sort((a,b)=>a.date-b.date);
  if(entries.length<4) return '';
  const maxV = Math.max(...entries.map(e=>e.v),0.0001);
  const cells = entries.map(e=>{
    const alpha = 0.12 + (e.v/maxV)*0.88;
    const dlabel = e.date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    return `<div class="heat-cell" style="opacity:${alpha.toFixed(2)}" title="${dlabel}: ${fmtBRL(e.v)}"></div>`;
  }).join('');
  return `
    <div class="evo-card chart-card chart-heat">
      <h3>Mapa de calor de vendas <span class="sub" style="font-weight:500;color:var(--muted)">· todos os períodos carregados</span></h3>
      <div class="heat-strip">${cells}</div>
    </div>`;
}

/* ---------- MATRIZ VENDEDOR × DIA DA SEMANA ---------- */
function computeVendorWeekdayMatrix(){
  const vendors = Object.entries(DB.vendors).filter(([n])=>vendorInGestor(n,gestorGeral))
    .sort((a,b)=>b[1].fat-a[1].fat).slice(0,10);
  return vendors.map(([vname,vd])=>{
    const sums=[0,0,0,0,0,0,0];
    vd.items.forEach(it=>it.rows.forEach(r=>{
      const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.data||''); if(!m) return;
      const dt=new Date(+m[3],+m[2]-1,+m[1]);
      sums[(dt.getDay()+6)%7]+=r.fat;
    }));
    return {vname, sums};
  });
}
function renderWeekdayMatrix(){
  const matrix = computeVendorWeekdayMatrix();
  if(!matrix.length) return '';
  const maxV = Math.max(...matrix.flatMap(m=>m.sums), 0.0001);
  const DIAS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const headerCells = DIAS.map(d=>`<div class="wm-h">${d}</div>`).join('');
  const rows = matrix.map(m=>{
    const cells = m.sums.map(v=>{
      const alpha = v>0 ? (0.15+(v/maxV)*0.85) : 0.05;
      return `<div class="wm-cell" style="opacity:${alpha.toFixed(2)}" title="${fmtBRL(v)}"></div>`;
    }).join('');
    return `<div class="wm-row"><div class="wm-nm">${avatarHTML(m.vname,'sz-sm')} ${m.vname}</div><div class="wm-cells">${cells}</div></div>`;
  }).join('');
  return `
    <div class="evo-card chart-card chart-weekday-matrix">
      <h3>Vendedores × dia da semana <span class="sub" style="font-weight:500;color:var(--muted)">· ${DB.periodo}</span></h3>
      <div class="wm-grid">
        <div class="wm-row wm-header"><div class="wm-nm"></div><div class="wm-cells">${headerCells}</div></div>
        ${rows}
      </div>
    </div>`;
}

/* ---------- GRÁFICO DE BOLHAS (preço × volume) ---------- */
function renderBubbleChart(){
  const prods = Object.entries(DB.products).filter(([,p])=>p.ptab>0 && p.qtd>0);
  if(prods.length<3) return '';
  const W=720,H=320,padL=54,padR=20,padT=20,padB=36;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const xs = prods.map(([,p])=>p.pmed), ys = prods.map(([,p])=>p.qtd);
  const maxFat = Math.max(...prods.map(([,p])=>p.fat),0.0001);
  const minX=Math.min(...xs), maxX=Math.max(...xs), maxY=Math.max(...ys);
  const x = v => padL + (v-minX)/((maxX-minX)||1)*innerW;
  const y = v => padT + innerH - v/(maxY||1)*innerH;
  const bubbles = prods.map(([name,p])=>{
    const r = 4 + Math.sqrt(p.fat/maxFat)*22;
    const diff = p.pmed-p.ptab;
    const color = diff>=0 ? 'var(--green)' : 'var(--red)';
    return `<circle cx="${x(p.pmed).toFixed(1)}" cy="${y(p.qtd).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.5" stroke="${color}" stroke-width="1.2"><title>${esc(name)} — ${fmtBRL(p.pmed)} · ${fmtN(p.qtd)} kg · ${fmtBRL(p.fat)}</title></circle>`;
  }).join('');
  const gridLines = [0,0.25,0.5,0.75,1].map(f=>{
    const yy = padT+innerH*(1-f);
    return `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>`;
  }).join('');
  return `
    <div class="evo-card chart-card chart-bubble">
      <h3>Preço médio × Volume por produto <span class="sub" style="font-weight:500;color:var(--muted)">· tamanho = faturamento · ${DB.periodo}</span></h3>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">
        ${gridLines}
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+innerH}" stroke="var(--line)" stroke-width="1"/>
        <line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="var(--line)" stroke-width="1"/>
        <text x="${padL}" y="${H-6}" font-size="9.5" fill="var(--muted)" font-family="Inter">Preço médio →</text>
        <text x="8" y="${padT+10}" font-size="9.5" fill="var(--muted)" font-family="Inter">Volume ↑</text>
        ${bubbles}
      </svg>
      <div class="muted" style="margin-top:8px">Bolhas <span style="color:var(--green);font-weight:700">verdes</span> = acima da tabela · <span style="color:var(--red);font-weight:700">vermelhas</span> = abaixo. Passe o mouse pra ver detalhes.</div>
    </div>`;
}

/* ---------- DONUT (usado na curva ABC) ---------- */
function donutSVG(segments){
  const R=42, C=2*Math.PI*R;
  let offset=0;
  const paths = segments.filter(s=>s.pct>0).map(s=>{
    const len = C*(s.pct/100);
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len.toFixed(1)} ${(C-len).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 60 60)"/>`;
    offset += len;
    return el;
  }).join('');
  return `<svg viewBox="0 0 120 120" width="110" height="110" style="flex:none">${paths}</svg>`;
}

/* ---------- SIMULADOR DE CENÁRIO ---------- */
function renderSimulador(){
  const v = selV.value, d = DB.vendors[v];
  if(!d) return '';
  return `
    <div class="sim-card">
      <h4>🎯 Simulador — e se o preço médio mudasse?</h4>
      <div class="sim-row">
        <input type="range" id="simSlider" class="sim-slider" min="-15" max="15" step="0.5" value="0">
        <div class="sim-val" id="simValLabel">+0,0%</div>
      </div>
      <div class="sim-result" id="simResult">Ajuste o controle pra ver o impacto estimado no faturamento de ${esc(v)}, mantendo o mesmo volume vendido.</div>
    </div>`;
}
function wireSimulador(){
  const slider = document.getElementById('simSlider');
  if(!slider) return;
  const label = document.getElementById('simValLabel');
  const result = document.getElementById('simResult');
  const v = selV.value, d = DB.vendors[v];
  if(!d) return;
  slider.oninput = ()=>{
    const pct = parseFloat(slider.value);
    label.textContent = (pct>=0?'+':'')+pct.toFixed(1).replace('.',',')+'%';
    const novoFat = d.fat*(1+pct/100);
    const diff = novoFat-d.fat;
    result.innerHTML = `Faturamento estimado: <b>${fmtBRL(novoFat)}</b> <span class="${diff>=0?'above-g':'below-r'}">(${diff>=0?'+':''}${fmtBRL(diff)})</span> — mantendo o mesmo volume vendido, só variando o preço médio.`;
  };
}

/* ---------- ANOTAÇÕES ---------- */
function noteKey(kind, name){ return 'painelNota_'+kind+'_'+name; }
function getNote(kind, name){ try{ return localStorage.getItem(noteKey(kind,name)) || ''; }catch(e){ return ''; } }
function setNote(kind, name, text){ try{ localStorage.setItem(noteKey(kind,name), text); }catch(e){} }
function noteWidgetHTML(kind, name){
  const existing = getNote(kind, name);
  return `
    <div class="note-wrap">
      <span class="note-toggle" id="noteToggle_${kind}">📝 ${existing?'Ver/editar anotação':'Adicionar anotação'}</span>
      <div class="note-box ${existing?'open':''}" id="noteBox_${kind}">
        <textarea id="noteText_${kind}" placeholder="Ex: negociação de contrato em andamento, cliente reclamou do preço…">${esc(existing)}</textarea>
        <div class="note-saved" id="noteSaved_${kind}">Salvo ✓</div>
      </div>
    </div>`;
}
function wireNoteWidget(kind, name){
  const toggle = document.getElementById('noteToggle_'+kind);
  const box = document.getElementById('noteBox_'+kind);
  const textarea = document.getElementById('noteText_'+kind);
  const saved = document.getElementById('noteSaved_'+kind);
  if(!toggle || !box || !textarea) return;
  toggle.onclick = ()=> box.classList.toggle('open');
  let t=null;
  textarea.oninput = ()=>{
    setNote(kind, name, textarea.value);
    saved.classList.add('show');
    clearTimeout(t);
    t = setTimeout(()=>saved.classList.remove('show'), 1500);
  };
}

/* ---------- RELATÓRIO EXECUTIVO ---------- */
function buildExecutiveReport(){
  const T = DB.totals;
  const intel = computePricingIntel();
  const stats = collectItemStats();
  const abaixo = stats.filter(s=>s.pct<=-10).length;
  const topVendor = Object.entries(DB.vendors).sort((a,b)=>b[1].fat-a[1].fat)[0];
  const topProduct = Object.entries(DB.products).sort((a,b)=>b[1].fat-a[1].fat)[0];
  const clients = DB.clients||{};
  const clientArr = Object.entries(clients).map(([n,c])=>c.fat).sort((a,b)=>b-a);
  const top10Fat = clientArr.slice(0,10).reduce((s,v)=>s+v,0);
  const totalCliFat = clientArr.reduce((s,v)=>s+v,0);
  const top10Pct = totalCliFat? (top10Fat/totalCliFat*100) : 0;
  let txt = '';
  txt += `RELATÓRIO EXECUTIVO — PREÇO MÉDIO APUCARANA\n`;
  txt += `Período: ${DB.periodo}\n`;
  txt += `Gerado em: ${new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}\n\n`;
  txt += `FATURAMENTO TOTAL: ${fmtBRL(T.fat)}\n`;
  txt += `Volume: ${T.qtd.toLocaleString('pt-BR')} kg · Vendedores ativos: ${T.nvend} · Produtos: ${T.nprod} · Clientes atendidos: ${T.nclientes||'—'}\n\n`;
  txt += `SAÚDE DE PREÇO: ${intel.score}/100 — ${intel.tier.label}\n`;
  txt += `Índice de preço vs. tabela: ${intel.priceIndex.toFixed(1)}%\n`;
  txt += `Vazamento potencial de receita: −${fmtBRL(intel.loss)}\n`;
  txt += `Valor capturado acima da tabela: +${fmtBRL(intel.gain)}\n`;
  txt += `Saldo líquido do preço: ${fmtSignedMoney(intel.net)}\n`;
  txt += `Volume em situação crítica: ${intel.criticalQty.toLocaleString('pt-BR')} kg\n\n`;
  if(topVendor) txt += `Vendedor destaque: ${topVendor[0]} (${fmtBRL(topVendor[1].fat)})\n`;
  if(topProduct) txt += `Produto destaque: ${topProduct[0]} (${fmtBRL(topProduct[1].fat)})\n`;
  txt += `Concentração de clientes: os 10 maiores representam ${top10Pct.toFixed(1)}% do faturamento\n\n`;
  if(abaixo>0) txt += `⚠ ATENÇÃO: ${abaixo} produto(s) vendido(s) mais de 10% abaixo da tabela neste período.\n\n`;
  else txt += `✓ Nenhum produto vendido mais de 10% abaixo da tabela neste período.\n\n`;
  const riskV=intel.sellers.slice().sort((a,b)=>b.loss-a.loss)[0];
  const riskP=intel.products.slice().sort((a,b)=>b.loss-a.loss)[0];
  const oppP=intel.products.slice().sort((a,b)=>b.gain-a.gain)[0];
  txt += `PRIORIDADES RECOMENDADAS\n`;
  if(riskV) txt += `1. Vendedor para plano de ação: ${riskV.name} — ${fmtBRL(riskV.loss)} abaixo da tabela.\n`;
  if(riskP) txt += `2. Produto para recuperação de preço: ${riskP.name} — ${fmtBRL(riskP.loss)} de impacto.\n`;
  if(oppP) txt += `3. Oportunidade a replicar: ${oppP.name} — ${fmtBRL(oppP.gain)} capturados acima da tabela.\n`;
  txt += `4. Potencial máximo de recuperação mantendo o volume: ${fmtBRL(intel.loss)}.\n\n`;
  txt += `Relatório gerado automaticamente a partir do Painel de Preço Médio · GTF / Canção Alimentos.`;
  return txt;
}
document.getElementById('btnReport').addEventListener('click', ()=>{
  document.getElementById('reportBody').textContent = buildExecutiveReport();
  document.getElementById('reportModal').style.display = 'flex';
});
document.getElementById('btnPrint').addEventListener('click', ()=>window.print());
document.getElementById('reportClose').addEventListener('click', ()=>{
  document.getElementById('reportModal').style.display = 'none';
});
document.getElementById('reportModal').addEventListener('click', (e)=>{
  if(e.target.id==='reportModal') document.getElementById('reportModal').style.display = 'none';
});
document.getElementById('reportCopy').addEventListener('click', ()=>{
  const txt = document.getElementById('reportBody').textContent;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=>showToast('Relatório copiado!')).catch(()=>window.prompt('Copie o texto:', txt));
  } else { window.prompt('Copie o texto:', txt); }
});

/* ---------- COMPARAR VENDEDORES ---------- */
function fillVvvSelects(){
  const names = Object.keys(DB.vendors).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const opts = names.map(n=>`<option value="${n}">${n}</option>`).join('');
  const a = document.getElementById('selVvvA'), b = document.getElementById('selVvvB');
  a.innerHTML = opts; b.innerHTML = opts;
  if(names.length>1){ a.value = names[0]; b.value = names[1]; }
}
function renderVvv(){
  const nA = document.getElementById('selVvvA').value, nB = document.getElementById('selVvvB').value;
  const dA = DB.vendors[nA], dB = DB.vendors[nB];
  const cont = document.getElementById('vvvContent');
  if(!dA || !dB){ cont.innerHTML=''; return; }
  const prodsA = new Map(dA.items.map(it=>[it.produto,it]));
  const prodsB = new Map(dB.items.map(it=>[it.produto,it]));
  const allProds = new Set([...prodsA.keys(), ...prodsB.keys()]);
  const rows = [...allProds].map(p=>{
    const ia = prodsA.get(p), ib = prodsB.get(p);
    return {p, fatA: ia?ia.fat:0, fatB: ib?ib.fat:0, pmedA: ia?ia.pmed:null, pmedB: ib?ib.pmed:null};
  }).filter(r=>r.fatA>0 || r.fatB>0).sort((a,b)=>(b.fatA+b.fatB)-(a.fatA+a.fatB));
  const bodyRows = rows.map(r=>`
    <tr>
      <td><div class="prod">${r.p}</div></td>
      <td class="r num muted">${r.fatA?fmtBRL(r.fatA):'—'}</td>
      <td class="r num">${r.fatB?fmtBRL(r.fatB):'—'}</td>
      <td class="r num muted hidem">${r.pmedA!=null?fmtBRL(r.pmedA):'—'}</td>
      <td class="r num hidem">${r.pmedB!=null?fmtBRL(r.pmedB):'—'}</td>
    </tr>`).join('');
  cont.innerHTML = `
    <div class="vsum" style="margin-top:16px">
      <div class="box"><div class="lab">${name_with_avatar_lab(nA)}</div><div class="v num">${fmtK(dA.fat)}</div></div>
      <div class="box"><div class="lab">${name_with_avatar_lab(nB)}</div><div class="v num">${fmtK(dB.fat)}</div></div>
      <div class="box amber"><div class="lab">Preço médio ${nA.split(' ')[0]}</div><div class="v num">${fmtBRL(dA.pmed)}</div></div>
      <div class="box amber"><div class="lab">Preço médio ${nB.split(' ')[0]}</div><div class="v num">${fmtBRL(dB.pmed)}</div></div>
    </div>
    <div class="tablecard">
      <div class="tablecard-scroll">
      <table class="sticky-col">
        <thead><tr>
          <th>Produto</th>
          <th class="r">${nA.split(' ')[0]}</th>
          <th class="r">${nB.split(' ')[0]}</th>
          <th class="r hidem">Preço ${nA.split(' ')[0]}</th>
          <th class="r hidem">Preço ${nB.split(' ')[0]}</th>
        </tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="5" class="empty">Nenhum produto em comum.</td></tr>'}</tbody>
      </table>
      </div>
    </div>`;
}
function name_with_avatar_lab(n){ return n; }
fillVvvSelects();
document.getElementById('selVvvA').addEventListener('change', renderVvv);
document.getElementById('selVvvB').addEventListener('change', renderVvv);
renderVvv();

/* ---------- RESUMO DO VENDEDOR PARA WHATSAPP ---------- */
function buildVendorSummary(){
  const v = selV.value, d = DB.vendors[v];
  if(!d) return '';
  const primeiroNome = v.split(' ')[0];
  let txt = '';
  txt += `*Resumo de vendas — ${primeiroNome}*\n`;
  txt += `Período: ${DB.periodo}\n`;
  txt += `${'─'.repeat(24)}\n\n`;
  txt += `*Faturamento:* ${fmtBRL(d.fat)}\n`;
  txt += `*Volume:* ${fmtN(d.qtd)} kg\n`;
  txt += `*Preço médio geral:* ${fmtBRL(d.pmed)}\n`;
  txt += `*Produtos vendidos:* ${d.nprod}\n`;

  // total de OPs do vendedor
  const totalOps = d.items.reduce((s,it)=>s+it.ops,0);
  txt += `*Total de OPs:* ${totalOps}\n`;

  // desempenho vs tabela
  let qtdTab=0, fatTab=0, tabRef=0, nAcima=0, nAbaixo=0;
  d.items.forEach(it=>{
    if(it.ptab>0){
      qtdTab += it.qtd; fatTab += it.fat; tabRef += it.ptab*it.qtd;
      const diff = it.pmed - it.ptab;
      if(diff > 0.005) nAcima++; else if(diff < -0.005) nAbaixo++;
    }
  });
  if(qtdTab>0){
    const precoReal = fatTab/qtdTab, precoTab = tabRef/qtdTab;
    const diff = precoReal - precoTab;
    const pct = precoTab ? (diff/precoTab*100) : 0;
    txt += `\n*vs Tabela:* ${diff>=0?'+':''}${fmtBRL(diff)} (${diff>=0?'+':''}${pct.toFixed(1)}%)\n`;
    txt += `${nAcima} produto(s) acima · ${nAbaixo} abaixo da tabela\n`;
  }

  // detalhe por produto (top 15 por faturamento)
  txt += `\n${'─'.repeat(24)}\n*PRODUTOS*\n\n`;
  const itens = d.items.slice().sort((a,b)=>b.fat-a.fat);
  const mostrar = itens.slice(0, 15);
  mostrar.forEach(it=>{
    txt += `• *${it.produto}*\n`;
    txt += `   ${fmtN(it.qtd)} kg · ${fmtBRL(it.fat)} · ${it.ops} OP${it.ops>1?'s':''}\n`;
    txt += `   Preço médio: ${fmtBRL(it.pmed)}`;
    if(it.ptab>0){
      const dl = it.pmed - it.ptab;
      txt += ` (tabela ${fmtBRL(it.ptab)} · ${dl>=0?'+':''}${fmtBRL(dl)})`;
    }
    txt += `\n\n`;
  });
  if(itens.length > mostrar.length){
    txt += `_+ ${itens.length - mostrar.length} outro(s) produto(s)_\n\n`;
  }
  txt += `${'─'.repeat(24)}\n_GTF · Filiais 01052 e 1026 · gerado em ${new Date().toLocaleDateString('pt-BR')}_`;
  return txt;
}
document.getElementById('btnVendWpp').addEventListener('click', ()=>{
  const txt = buildVendorSummary();
  if(!txt){ showToast('Selecione um vendedor primeiro.'); return; }
  window.open('https://wa.me/?text='+encodeURIComponent(txt), '_blank');
});


/* ---------- TEMA CLARO/ESCURO ---------- */
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
/* ---------- ATUALIZAR COM A ÚLTIMA VERSÃO ---------- */
document.getElementById('forceRefresh').addEventListener('click', async ()=>{
  const btn = document.getElementById('forceRefresh');
  btn.style.opacity = '0.5';
  try{
    if('caches' in window){
      const names = await caches.keys();
      await Promise.all(names.map(n=>caches.delete(n)));
    }
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
  }catch(e){}
  location.reload();
});

function applyThemeIcon(theme){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;
  // mostra o ícone da ação (sol = "voltar pro claro", lua = "ir pro escuro")
  btn.innerHTML = theme==='dark' ? ICON_SUN : ICON_MOON;
}
(function(){
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyThemeIcon(current);
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try{ localStorage.setItem('painelTheme', next); }catch(e){}
    applyThemeIcon(next);
  });
})();

/* ==================================================================
   ABA PREÇO POR ITEM — todos os itens, por linha de produto
   Base própria, agregada por produto, com 5 períodos de setembro.
   Fonte: Relatório de Vendas Apucarana, 01/09 a 29/09/2026 (29/09 17:20).
================================================================== */
const ITENS = {"periodos":["p1","p2","p3","p4","p5"],"dados":{"p1":{"periodo":"01 a 04/09/2026","nvendas":1574,"nclientes":452,"fat":1421409.59,"qtd":137794.1,"pmed":10.3155,"nprod":78,"indice":93.8,"vazamento":105435.64,"captura":11488.73,"itens":[{"produto":"CONG. FILE DE PEITO PV CX 20 KG","linha":"Congelados in natura","vendas":84,"qtd":31340.0,"fat":416843.4,"pmed":13.3007,"min":10.0,"max":14.0,"lista":14.4,"multilista":false,"desvio":-0.07634,"impacto":-34452.06},{"produto":"CONG. COXA E SOBRECOXA PV CX 18 KG","linha":"Congelados in natura","vendas":93,"qtd":18252.0,"fat":127839.42,"pmed":7.0041,"min":6.1,"max":7.6,"lista":7.5,"multilista":true,"desvio":-0.06612,"impacto":-9051.17},{"produto":"RESFR. (FILE DE PEITO INDIVIDUAL) CX PP 20 KG (CANCAO ALIMENTOS)","linha":"Resfriados","vendas":72,"qtd":6400.0,"fat":84366.8,"pmed":13.1823,"min":10.0,"max":13.99,"lista":12.8,"multilista":false,"desvio":0.029867,"impacto":2446.72},{"produto":"CONG. FILEZINHO SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":81,"qtd":5500.0,"fat":79140.0,"pmed":14.3891,"min":12.8,"max":15.3,"lista":15.45,"multilista":true,"desvio":-0.068667,"impacto":-5834.95},{"produto":"CONG. RECORTES BARRA 18 KG FRANGOS CANCAO","linha":"Congelados in natura","vendas":1,"qtd":10008.0,"fat":75060.0,"pmed":7.5,"min":7.5,"max":7.5,"lista":9.5,"multilista":false,"desvio":-0.210526,"impacto":-20016.0},{"produto":"CONG. (MEIO DA ASA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":52,"qtd":2320.0,"fat":57836.2,"pmed":24.9294,"min":22.9,"max":25.8,"lista":25.5,"multilista":false,"desvio":-0.022376,"impacto":-1323.79},{"produto":"CONG. COXA E SOBRECOXA A PASSARINHO IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":48,"qtd":5440.0,"fat":43508.5,"pmed":7.9979,"min":7.0,"max":8.9,"lista":9.2,"multilista":true,"desvio":-0.130663,"impacto":-6539.42},{"produto":"CONG. COXINHA DA ASA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":87,"qtd":4350.0,"fat":43262.5,"pmed":9.9454,"min":8.6,"max":10.5,"lista":10.6,"multilista":false,"desvio":-0.061755,"impacto":-2847.51},{"produto":"CONG. COXA E SOBRECOXA C/ PORCAO DORSAL PV CX 18 KG","linha":"Congelados in natura","vendas":27,"qtd":5958.0,"fat":36583.74,"pmed":6.1403,"min":6.0,"max":6.7,"lista":6.7,"multilista":false,"desvio":-0.083537,"impacto":-3334.69},{"produto":"CONG. COXINHA DA ASA PV CX 20 KG","linha":"Congelados in natura","vendas":26,"qtd":3820.0,"fat":35134.0,"pmed":9.1974,"min":8.9,"max":9.9,"lista":9.8,"multilista":false,"desvio":-0.06149,"impacto":-2301.93},{"produto":"RESFR. (COXA E SOBRECOXA INDIVIDUAL) CX PP 18KG (CANCAO)","linha":"Resfriados","vendas":49,"qtd":4698.0,"fat":31794.66,"pmed":6.7677,"min":6.4,"max":7.0,"lista":7.0,"multilista":false,"desvio":-0.033186,"impacto":-1091.35},{"produto":"CONG. FILE DE PEITO S/ PELE S/ SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":36,"qtd":1750.0,"fat":25832.0,"pmed":14.7611,"min":14.5,"max":15.0,"lista":16.0,"multilista":false,"desvio":-0.077431,"impacto":-2168.07},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 2 KG CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":38,"qtd":3120.0,"fat":25027.7,"pmed":8.0217,"min":7.5,"max":9.5,"lista":8.0,"multilista":false,"desvio":0.002712,"impacto":67.7},{"produto":"RESFR. COXINHA DA ASA PV CX 20 KG","linha":"Resfriados","vendas":21,"qtd":2660.0,"fat":20086.0,"pmed":7.5511,"min":6.0,"max":9.3,"lista":9.0,"multilista":false,"desvio":-0.160989,"impacto":-3854.07},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":18,"qtd":1160.0,"fat":15462.0,"pmed":13.3293,"min":10.0,"max":14.1,"lista":14.0,"multilista":false,"desvio":-0.047907,"impacto":-778.01},{"produto":"RESFR. C/ OSSO MEIO DAS ASAS BDJ PV CX 10,2 KG","linha":"Resfriados","vendas":22,"qtd":652.8,"fat":15131.7,"pmed":23.1797,"min":21.0,"max":23.8,"lista":24.5,"multilista":false,"desvio":-0.05389,"impacto":-861.89},{"produto":"RESFR. S/ OSSO FILE DE PEITO BDJ PV CX 11,2 KG","linha":"Resfriados","vendas":11,"qtd":996.8,"fat":14762.05,"pmed":14.8094,"min":12.0,"max":15.2,"lista":14.0,"multilista":false,"desvio":0.057814,"impacto":806.81},{"produto":"RESFR. FRANGO C/ MIÚDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":31,"qtd":1900.0,"fat":14372.0,"pmed":7.5642,"min":6.8,"max":7.8,"lista":8.0,"multilista":false,"desvio":-0.054475,"impacto":-828.02},{"produto":"LASANHA A BOLONHESA CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":44,"qtd":979.2000000000002,"fat":14017.68,"pmed":14.3154,"min":14.0,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.005875,"impacto":-82.84},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 1,1 KG CAIXA PP 9,9 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":54,"qtd":1574.100000000001,"fat":13937.42,"pmed":8.8542,"min":8.0,"max":10.89,"lista":8.0,"multilista":false,"desvio":0.106775,"impacto":1344.6},{"produto":"CONG. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":30,"qtd":1480.0,"fat":13904.0,"pmed":9.3946,"min":8.5,"max":11.5,"lista":8.7,"multilista":false,"desvio":0.079839,"impacto":1028.01},{"produto":"FILE DE TILAPIA CONGELADA IQF 800 G CX PP 10,4 (CANCAO ALIMENTOS)","linha":"Pescados","vendas":7,"qtd":353.6,"fat":13582.3,"pmed":38.4115,"min":38.0,"max":41.5,"lista":38.5,"multilista":false,"desvio":-0.002299,"impacto":-31.29},{"produto":"CONG. C/ OSSO PES GRADE A PCT 2 X 7,5 KG CX 15 KG G2","linha":"Congelados in natura","vendas":7,"qtd":1410.0,"fat":12864.0,"pmed":9.1234,"min":9.0,"max":9.8,"lista":9.5,"multilista":false,"desvio":-0.039642,"impacto":-531.01},{"produto":"CMS FRANGO BLOCO 18 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":6012.0,"fat":11723.4,"pmed":1.95,"min":1.95,"max":1.95,"lista":2.4,"multilista":false,"desvio":-0.1875,"impacto":-2705.4},{"produto":"CONG. FRANGO TEMPERADO C/ MIUDOS (PESCOCO MOELA E FIGADO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":1120.0,"fat":10976.0,"pmed":9.8,"min":9.8,"max":9.8,"lista":10.5,"multilista":false,"desvio":-0.066667,"impacto":-784.0},{"produto":"CONG. (FILEZINHO SASSAMI S/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":4,"qtd":900.0,"fat":10956.0,"pmed":12.1733,"min":12.0,"max":12.9,"lista":12.3,"multilista":false,"desvio":-0.010301,"impacto":-114.03},{"produto":"RESFR. MIÚDOS CORACAO PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":7,"qtd":380.0,"fat":10444.0,"pmed":27.4842,"min":10.7,"max":31.5,"lista":29.0,"multilista":true,"desvio":-0.052269,"impacto":-576.0},{"produto":"CONG. MIÚDOS FIGADO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":21,"qtd":2440.0,"fat":9568.8,"pmed":3.9216,"min":3.8,"max":4.1,"lista":5.0,"multilista":false,"desvio":-0.21568,"impacto":-2631.3},{"produto":"CONG. SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":27,"qtd":860.0,"fat":9115.0,"pmed":10.5988,"min":10.2,"max":10.7,"lista":11.1,"multilista":false,"desvio":-0.045153,"impacto":-431.03},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO EM BIFES IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":29,"qtd":510.0,"fat":8340.6,"pmed":16.3541,"min":15.5,"max":16.83,"lista":16.0,"multilista":false,"desvio":0.022131,"impacto":180.59},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 700 G CX PP 7 KG","linha":"Empanados de frango","vendas":41,"qtd":385.0,"fat":7297.22,"pmed":18.9538,"min":18.0,"max":19.4,"lista":18.0,"multilista":false,"desvio":0.052989,"impacto":367.21},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":35,"qtd":462.0,"fat":6353.48,"pmed":13.7521,"min":12.99,"max":16.49,"lista":13.35,"multilista":false,"desvio":0.03012,"impacto":185.77},{"produto":"LASANHA DE FRANGO CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":24,"qtd":424.7999999999999,"fat":6041.52,"pmed":14.222,"min":14.0,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.012361,"impacto":-75.61},{"produto":"CONG. MIÚDOS (CORACAO) PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":6,"qtd":180.0,"fat":5754.0,"pmed":31.9667,"min":31.8,"max":32.5,"lista":32.5,"multilista":false,"desvio":-0.016409,"impacto":-95.99},{"produto":"CONG. S/ OSSO C/ PELE FILE DE COXA E SOBRECOXA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":12,"qtd":460.0,"fat":5726.0,"pmed":12.4478,"min":11.5,"max":13.0,"lista":11.1,"multilista":false,"desvio":0.121423,"impacto":619.99},{"produto":"CONG. PEITO C/ OSSO PV CX 18 KG","linha":"Congelados in natura","vendas":15,"qtd":576.0,"fat":5490.9,"pmed":9.5328,"min":9.2,"max":9.9,"lista":10.3,"multilista":false,"desvio":-0.074485,"impacto":-441.91},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PCT 800 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":27,"qtd":470.4000000000001,"fat":5068.03,"pmed":10.7739,"min":9.97,"max":11.23,"lista":11.0,"multilista":false,"desvio":-0.020555,"impacto":-106.36},{"produto":"RESFR. S/ OSSO FILEZINHO SASSAMI BDJ PV CX 11,4 KG","linha":"Resfriados","vendas":9,"qtd":330.6,"fat":4834.51,"pmed":14.6234,"min":11.0,"max":15.2,"lista":14.0,"multilista":false,"desvio":0.044529,"impacto":206.1},{"produto":"FILE DE TILAPIA CONGELADA IQF 400 G CX PP 10,4 KG","linha":"Pescados","vendas":11,"qtd":114.4,"fat":4786.6,"pmed":41.8409,"min":41.0,"max":42.0,"lista":38.5,"multilista":false,"desvio":0.086777,"impacto":382.2},{"produto":"LASANHA QUATRO QUEIJOS CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":22,"qtd":331.2,"fat":4726.66,"pmed":14.2713,"min":14.0,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.008938,"impacto":-42.63},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 11 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":10,"qtd":264.0,"fat":4673.02,"pmed":17.7008,"min":17.53,"max":18.0,"lista":16.5,"multilista":true,"desvio":0.072776,"impacto":317.01},{"produto":"RESFR. PEITO C/ OSSO PV CX 18 KG","linha":"Resfriados","vendas":14,"qtd":468.0,"fat":4447.8,"pmed":9.5038,"min":9.2,"max":9.7,"lista":9.1,"multilista":false,"desvio":0.044374,"impacto":188.98},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 400 G CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":24,"qtd":390.0,"fat":4089.4,"pmed":10.4856,"min":8.7,"max":11.5,"lista":8.7,"multilista":false,"desvio":0.205241,"impacto":696.38},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 300G CAIXA PP 3 KG","linha":"Empanados de frango","vendas":55,"qtd":246.0,"fat":3947.76,"pmed":16.0478,"min":13.3,"max":16.9,"lista":13.7,"multilista":false,"desvio":0.171372,"impacto":577.56},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":12,"qtd":210.0,"fat":3802.82,"pmed":18.1087,"min":17.4,"max":18.99,"lista":18.0,"multilista":false,"desvio":0.006039,"impacto":22.83},{"produto":"CONG. SAMBIQUIRA PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":14,"qtd":900.0,"fat":3397.86,"pmed":3.7754,"min":3.6,"max":4.1,"lista":4.0,"multilista":false,"desvio":-0.05615,"impacto":-202.14},{"produto":"CONG. MIÚDOS (CORACAO) BDJ 20 X 600 G CX 12 KG","linha":"Congelados in natura","vendas":5,"qtd":96.0,"fat":3255.36,"pmed":33.91,"min":33.16,"max":34.16,"lista":33.0,"multilista":false,"desvio":0.027576,"impacto":87.36},{"produto":"POLENTA PALITO TRADICIONAL CONGELADA PACOTE 1 KG CX PP 10 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":27,"qtd":410.0,"fat":2853.2,"pmed":6.959,"min":6.49,"max":7.0,"lista":7.0,"multilista":true,"desvio":-0.005857,"impacto":-16.81},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 1 KG CX 7 KG","linha":"Empanados de frango","vendas":12,"qtd":161.0,"fat":2522.73,"pmed":15.6691,"min":15.0,"max":16.3,"lista":15.0,"multilista":false,"desvio":0.044607,"impacto":107.73},{"produto":"MANDIOCA TOLETE CONGELADA PACOTE 1 KG CX PP 12 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":10,"qtd":216.0,"fat":2226.0,"pmed":10.3056,"min":10.0,"max":10.5,"lista":8.5,"multilista":false,"desvio":0.212424,"impacto":390.01},{"produto":"RESFR. C/ OSSO COXINHA DA ASA BDJ PV CX 10,5 KG","linha":"Resfriados","vendas":10,"qtd":210.0,"fat":2197.65,"pmed":10.465,"min":6.0,"max":11.3,"lista":10.3,"multilista":true,"desvio":0.016019,"impacto":34.65},{"produto":"RESFR. C/ OSSO SOBRECOXA BDJ PV CX 13 KG","linha":"Resfriados","vendas":12,"qtd":208.0,"fat":2111.2,"pmed":10.15,"min":7.8,"max":10.6,"lista":8.8,"multilista":false,"desvio":0.153409,"impacto":280.8},{"produto":"BOLINHO DE TILAPIA CONG PCT 300 G CX 4,2 KG","linha":"Pescados","vendas":9,"qtd":63.00000000000001,"fat":2079.0,"pmed":33.0,"min":33.0,"max":33.0,"lista":33.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"CONG. (COXA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":14,"qtd":210.0,"fat":1779.9,"pmed":8.4757,"min":7.9,"max":8.7,"lista":9.2,"multilista":false,"desvio":-0.078728,"impacto":-152.1},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 300 G CX 3 KG","linha":"Empanados de frango","vendas":23,"qtd":81.0,"fat":1726.29,"pmed":21.3122,"min":13.3,"max":29.8,"lista":15.0,"multilista":true,"desvio":0.420813,"impacto":511.29},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (ISCAS DE TILAPIA) PCT 400 G CX PP 3,2 KG","linha":"Pescados","vendas":5,"qtd":35.2,"fat":1660.8,"pmed":47.1818,"min":45.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.048484,"impacto":76.8},{"produto":"RESFR. ASA PV CX 20 KG","linha":"Resfriados","vendas":3,"qtd":120.0,"fat":1350.0,"pmed":11.25,"min":10.0,"max":11.5,"lista":11.0,"multilista":false,"desvio":0.022727,"impacto":30.0},{"produto":"CONG. C/ OSSO COXINHA DA ASA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":2,"qtd":132.0,"fat":1208.4,"pmed":9.1545,"min":9.1,"max":9.7,"lista":10.5,"multilista":false,"desvio":-0.128143,"impacto":-177.61},{"produto":"RESFR. S/ OSSO S/ PELE PEITO S/ SASSAMI PCT PV CX 20 KG","linha":"Resfriados","vendas":1,"qtd":120.0,"fat":1200.0,"pmed":10.0,"min":10.0,"max":10.0,"lista":12.8,"multilista":false,"desvio":-0.21875,"impacto":-336.0},{"produto":"CONG. (COXA E SOBRECOXA A PASSARINHO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":3,"qtd":140.0,"fat":1130.0,"pmed":8.0714,"min":7.8,"max":8.5,"lista":8.2,"multilista":false,"desvio":-0.015683,"impacto":-18.0},{"produto":"EMPANADO DE TILAPIA (SMALL FISH) CONG PCT 400 G CX 3,2 KG","linha":"Pescados","vendas":10,"qtd":96.00000000000003,"fat":1120.0,"pmed":11.6667,"min":10.0,"max":15.0,"lista":15.0,"multilista":false,"desvio":-0.22222,"impacto":-320.0},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 6,6 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":9,"qtd":59.40000000000001,"fat":1071.84,"pmed":18.0444,"min":17.5,"max":18.9,"lista":16.5,"multilista":false,"desvio":0.0936,"impacto":91.74},{"produto":"SANDUICHE FUT BURGUER BACON C/ REQUEIJAO CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":9,"qtd":27.0,"fat":1049.87,"pmed":38.884,"min":33.27,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.0279,"impacto":-30.13},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PACOTE 300 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":9,"qtd":86.39999999999999,"fat":1028.74,"pmed":11.9067,"min":11.5,"max":12.17,"lista":11.0,"multilista":false,"desvio":0.082427,"impacto":78.34},{"produto":"CONG. PESCOCO S/ PELE C/ OSSO PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":6,"qtd":252.0,"fat":969.66,"pmed":3.8479,"min":3.57,"max":4.09,"lista":3.5,"multilista":true,"desvio":0.0994,"impacto":87.67},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":5,"qtd":60.0,"fat":903.48,"pmed":15.058,"min":14.99,"max":15.2,"lista":15.0,"multilista":false,"desvio":0.003867,"impacto":3.48},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (FILE DE TILAPIA) PCT 600 G CX PP 6 KG","linha":"Pescados","vendas":3,"qtd":18.0,"fat":840.0,"pmed":46.6667,"min":42.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.037038,"impacto":30.0},{"produto":"CONG. S/ OSSO S/ PELE PEITO S/ SASSAMI PV CX 20 KG","linha":"Congelados in natura","vendas":1,"qtd":60.0,"fat":713.4,"pmed":11.89,"min":11.89,"max":11.89,"lista":12.1,"multilista":false,"desvio":-0.017355,"impacto":-12.6},{"produto":"BOLINHO DE FRANGO FUT CHICKEN C/ RECHEIO CREMOSO DE QUEIJO CONG PTC 300 G CX 4,2 KG","linha":"Empanados de frango","vendas":5,"qtd":21.0,"fat":642.26,"pmed":30.584,"min":29.96,"max":31.0,"lista":30.0,"multilista":false,"desvio":0.019467,"impacto":12.26},{"produto":"CONG. C/ OSSO COXA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":2,"qtd":96.0,"fat":628.8,"pmed":6.55,"min":6.5,"max":6.7,"lista":8.5,"multilista":false,"desvio":-0.229412,"impacto":-187.2},{"produto":"CONG. FILE DE SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":1,"qtd":40.0,"fat":620.0,"pmed":15.5,"min":15.5,"max":15.5,"lista":13.0,"multilista":false,"desvio":0.192308,"impacto":100.0},{"produto":"CONG. GALINHA INTEIRA (CABECA PESCOCO MOELA E PES) CX PP 20 KG (MISTER FRANGO)","linha":"Congelados in natura","vendas":5,"qtd":100.0,"fat":620.0,"pmed":6.2,"min":6.2,"max":6.2,"lista":5.6,"multilista":false,"desvio":0.107143,"impacto":60.0},{"produto":"SANDUICHE FUT BURGUER MAIONESE GRILL CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":5,"qtd":13.5,"fat":539.32,"pmed":39.95,"min":39.93,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.00125,"impacto":-0.67},{"produto":"CONG. (MEIO DA ASA C/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":476.0,"pmed":23.8,"min":23.8,"max":23.8,"lista":23.8,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"SANDUICHE FUT BURGUER C/ MOLHO DE PICLES CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":4,"qtd":10.8,"fat":413.48,"pmed":38.285,"min":33.27,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.042875,"impacto":-18.52},{"produto":"RESFR. C/ OSSO COXA BDJ PV CX 11,1 KG","linha":"Resfriados","vendas":1,"qtd":44.4,"fat":354.76,"pmed":7.99,"min":7.99,"max":7.99,"lista":6.5,"multilista":false,"desvio":0.229231,"impacto":66.16},{"produto":"EMPANADO DE TILAPIA CONG (SMALL FISH) PCT 1,5 KG CX 10,5 KG","linha":"Pescados","vendas":1,"qtd":10.5,"fat":126.0,"pmed":12.0,"min":12.0,"max":12.0,"lista":15.0,"multilista":false,"desvio":-0.2,"impacto":-31.5},{"produto":"CONG. MIÚDOS (FIGADO) BLOCO 20KG (MISTER FRANGO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":82.0,"pmed":4.1,"min":4.1,"max":4.1,"lista":4.0,"multilista":false,"desvio":0.025,"impacto":2.0}]},"p2":{"periodo":"05 a 11/09/2026","nvendas":1864,"nclientes":445,"fat":1466239.01,"qtd":136805.4,"pmed":10.7177,"nprod":75,"indice":95.84,"vazamento":79415.09,"captura":15761.8,"itens":[{"produto":"CONG. FILE DE PEITO PV CX 20 KG","linha":"Congelados in natura","vendas":88,"qtd":18640.0,"fat":251485.0,"pmed":13.4917,"min":12.5,"max":15.6,"lista":14.4,"multilista":false,"desvio":-0.063076,"impacto":-16930.71},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 2 KG CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":46,"qtd":28040.0,"fat":200292.6,"pmed":7.1431,"min":7.0,"max":9.12,"lista":8.0,"multilista":false,"desvio":-0.107113,"impacto":-24027.48},{"produto":"CONG. FILEZINHO SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":147,"qtd":9570.0,"fat":140352.7,"pmed":14.6659,"min":12.8,"max":15.8,"lista":15.45,"multilista":true,"desvio":-0.050751,"impacto":-7503.84},{"produto":"CONG. COXINHA DA ASA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":147,"qtd":11560.0,"fat":114888.8,"pmed":9.9385,"min":9.3,"max":10.9,"lista":10.6,"multilista":true,"desvio":-0.062406,"impacto":-7646.94},{"produto":"CONG. COXA E SOBRECOXA PV CX 18 KG","linha":"Congelados in natura","vendas":69,"qtd":13248.0,"fat":95416.2,"pmed":7.2023,"min":6.59,"max":8.1,"lista":7.5,"multilista":false,"desvio":-0.039693,"impacto":-3943.93},{"produto":"FILE DE TILAPIA CONGELADA IQF 400 G CX PP 10,4 KG","linha":"Pescados","vendas":74,"qtd":2236.000000000001,"fat":86745.36,"pmed":38.7949,"min":38.0,"max":43.0,"lista":38.5,"multilista":false,"desvio":0.00766,"impacto":659.4},{"produto":"RESFR. (FILE DE PEITO INDIVIDUAL) CX PP 20 KG (CANCAO ALIMENTOS)","linha":"Resfriados","vendas":71,"qtd":6220.0,"fat":83112.8,"pmed":13.3622,"min":12.0,"max":13.99,"lista":12.8,"multilista":false,"desvio":0.043922,"impacto":3496.88},{"produto":"CONG. COXINHA DA ASA PV CX 20 KG","linha":"Congelados in natura","vendas":20,"qtd":5120.0,"fat":47037.0,"pmed":9.1869,"min":9.0,"max":9.7,"lista":9.8,"multilista":false,"desvio":-0.062561,"impacto":-3139.07},{"produto":"RESFR. (COXA E SOBRECOXA INDIVIDUAL) CX PP 18KG (CANCAO)","linha":"Resfriados","vendas":50,"qtd":6444.0,"fat":45197.46,"pmed":7.0139,"min":6.4,"max":7.5,"lista":7.0,"multilista":false,"desvio":0.001986,"impacto":89.57},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 1,1 KG CAIXA PP 9,9 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":126,"qtd":4088.700000000001,"fat":35615.65,"pmed":8.7108,"min":8.5,"max":10.89,"lista":8.0,"multilista":false,"desvio":0.08885,"impacto":2906.25},{"produto":"CONG. (MEIO DA ASA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":48,"qtd":1270.0,"fat":32946.8,"pmed":25.9424,"min":24.0,"max":26.79,"lista":25.5,"multilista":false,"desvio":0.017349,"impacto":561.85},{"produto":"CONG. SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":73,"qtd":2550.0,"fat":25527.8,"pmed":10.0109,"min":8.75,"max":10.98,"lista":11.1,"multilista":false,"desvio":-0.098117,"impacto":-2777.21},{"produto":"RESFR. FRANGO C/ MIÚDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":29,"qtd":2660.0,"fat":20154.0,"pmed":7.5767,"min":7.0,"max":8.5,"lista":8.0,"multilista":false,"desvio":-0.052913,"impacto":-1125.98},{"produto":"CONG. COXA E SOBRECOXA C/ PORCAO DORSAL PV CX 18 KG","linha":"Congelados in natura","vendas":11,"qtd":3096.0,"fat":19685.7,"pmed":6.3584,"min":5.79,"max":6.99,"lista":6.7,"multilista":false,"desvio":-0.050985,"impacto":-1057.59},{"produto":"CONG. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":15,"qtd":2180.0,"fat":19123.8,"pmed":8.7724,"min":8.1,"max":10.79,"lista":8.7,"multilista":false,"desvio":0.008322,"impacto":157.83},{"produto":"RESFR. MIÚDOS CORACAO PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":5,"qtd":640.0,"fat":18499.8,"pmed":28.9059,"min":28.0,"max":32.5,"lista":29.5,"multilista":false,"desvio":-0.020139,"impacto":-380.22},{"produto":"CONG. COXA E SOBRECOXA A PASSARINHO IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":62,"qtd":2010.0,"fat":17415.8,"pmed":8.6646,"min":7.3,"max":9.49,"lista":9.2,"multilista":true,"desvio":-0.058196,"impacto":-1076.15},{"produto":"RESFR. S/ OSSO FILE DE PEITO BDJ PV CX 11,2 KG","linha":"Resfriados","vendas":15,"qtd":1019.2,"fat":15315.78,"pmed":15.0273,"min":14.5,"max":15.2,"lista":14.0,"multilista":false,"desvio":0.073379,"impacto":1047.02},{"produto":"CONG. FILE DE PEITO S/ PELE S/ SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":28,"qtd":900.0,"fat":13612.9,"pmed":15.1254,"min":14.5,"max":15.7,"lista":16.0,"multilista":false,"desvio":-0.054662,"impacto":-787.14},{"produto":"CONG. PEITO C/ OSSO PV CX 18 KG","linha":"Congelados in natura","vendas":17,"qtd":1170.0,"fat":11475.0,"pmed":9.8077,"min":9.5,"max":10.1,"lista":10.3,"multilista":false,"desvio":-0.047796,"impacto":-575.99},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PACOTE 300 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":73,"qtd":998.4000000000011,"fat":11369.76,"pmed":11.388,"min":11.3,"max":12.17,"lista":11.0,"multilista":false,"desvio":0.035273,"impacto":387.38},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 300G CAIXA PP 3 KG","linha":"Empanados de frango","vendas":107,"qtd":726.0,"fat":11000.73,"pmed":15.1525,"min":13.97,"max":16.5,"lista":13.7,"multilista":false,"desvio":0.106022,"impacto":1054.52},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":7,"qtd":720.0,"fat":9850.0,"pmed":13.6806,"min":13.5,"max":14.0,"lista":14.0,"multilista":false,"desvio":-0.022814,"impacto":-229.97},{"produto":"RESFR. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":4,"qtd":1120.0,"fat":9740.0,"pmed":8.6964,"min":8.5,"max":9.5,"lista":8.5,"multilista":false,"desvio":0.023106,"impacto":219.97},{"produto":"RESFR. COXINHA DA ASA PV CX 20 KG","linha":"Resfriados","vendas":15,"qtd":880.0,"fat":7796.0,"pmed":8.8591,"min":6.0,"max":9.4,"lista":9.0,"multilista":false,"desvio":-0.015656,"impacto":-123.99},{"produto":"POLENTA PALITO TRADICIONAL CONGELADA PACOTE 1 KG CX PP 10 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":81,"qtd":1100.0,"fat":7711.2,"pmed":7.0102,"min":6.99,"max":7.99,"lista":7.0,"multilista":false,"desvio":0.001457,"impacto":11.22},{"produto":"RESFR. C/ OSSO MEIO DAS ASAS BDJ PV CX 10,2 KG","linha":"Resfriados","vendas":9,"qtd":326.4,"fat":7602.06,"pmed":23.2906,"min":21.0,"max":24.5,"lista":24.5,"multilista":false,"desvio":-0.049363,"impacto":-394.75},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO EM BIFES IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":20,"qtd":440.0,"fat":7142.9,"pmed":16.2339,"min":15.5,"max":16.83,"lista":16.0,"multilista":false,"desvio":0.014619,"impacto":102.92},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 700 G CX PP 7 KG","linha":"Empanados de frango","vendas":37,"qtd":350.0,"fat":6522.11,"pmed":18.6346,"min":17.5,"max":19.0,"lista":18.0,"multilista":false,"desvio":0.035256,"impacto":222.11},{"produto":"EMPANADO DE TILAPIA CONG (SMALL FISH) PCT 1,5 KG CX 10,5 KG","linha":"Pescados","vendas":7,"qtd":535.5,"fat":6226.5,"pmed":11.6275,"min":8.2,"max":12.0,"lista":15.0,"multilista":false,"desvio":-0.224833,"impacto":-1805.97},{"produto":"EMPANADO DE TILAPIA (SMALL FISH) CONG PCT 400 G CX 3,2 KG","linha":"Pescados","vendas":10,"qtd":739.2000000000002,"fat":5899.2,"pmed":7.9805,"min":7.5,"max":15.0,"lista":15.0,"multilista":false,"desvio":-0.467967,"impacto":-5188.81},{"produto":"CONG. MIÚDOS (CORACAO) BDJ 20 X 600 G CX 12 KG","linha":"Congelados in natura","vendas":10,"qtd":168.0,"fat":5734.8,"pmed":34.1357,"min":32.5,"max":34.8,"lista":33.0,"multilista":false,"desvio":0.034415,"impacto":190.8},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 400 G CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":33,"qtd":480.0,"fat":5083.6,"pmed":10.5908,"min":8.0,"max":12.25,"lista":8.7,"multilista":false,"desvio":0.217333,"impacto":907.58},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PCT 800 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":30,"qtd":451.2000000000001,"fat":4947.17,"pmed":10.9645,"min":10.49,"max":11.5,"lista":11.0,"multilista":false,"desvio":-0.003227,"impacto":-16.02},{"produto":"CONG. S/ OSSO C/ PELE FILE DE COXA E SOBRECOXA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":11,"qtd":380.0,"fat":4914.0,"pmed":12.9316,"min":12.5,"max":13.2,"lista":11.1,"multilista":false,"desvio":0.165009,"impacto":696.01},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":26,"qtd":322.0,"fat":4471.53,"pmed":13.8867,"min":12.99,"max":16.0,"lista":13.35,"multilista":false,"desvio":0.040202,"impacto":172.82},{"produto":"LASANHA A BOLONHESA CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":22,"qtd":295.1999999999999,"fat":4322.66,"pmed":14.6432,"min":14.16,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.016889,"impacto":71.79},{"produto":"RESFR. S/ OSSO S/ PELE PEITO S/ SASSAMI PCT PV CX 20 KG","linha":"Resfriados","vendas":5,"qtd":360.0,"fat":4198.0,"pmed":11.6611,"min":7.0,"max":13.5,"lista":12.8,"multilista":false,"desvio":-0.088977,"impacto":-410.0},{"produto":"RESFR. S/ OSSO FILEZINHO SASSAMI BDJ PV CX 11,4 KG","linha":"Resfriados","vendas":4,"qtd":228.0,"fat":3448.16,"pmed":15.1235,"min":14.9,"max":15.2,"lista":14.0,"multilista":false,"desvio":0.08025,"impacto":256.16},{"produto":"CONG. MIÚDOS (CORACAO) PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":3,"qtd":100.0,"fat":3298.0,"pmed":32.98,"min":32.5,"max":33.7,"lista":32.5,"multilista":false,"desvio":0.014769,"impacto":48.0},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":8,"qtd":182.0,"fat":3235.54,"pmed":17.7777,"min":17.4,"max":18.9,"lista":18.0,"multilista":false,"desvio":-0.01235,"impacto":-40.46},{"produto":"CONG. SAMBIQUIRA PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":10,"qtd":720.0,"fat":2847.42,"pmed":3.9548,"min":3.7,"max":4.9,"lista":4.0,"multilista":false,"desvio":-0.0113,"impacto":-32.54},{"produto":"FILE DE TILAPIA CONGELADA IQF 800 G CX PP 10,4 (CANCAO ALIMENTOS)","linha":"Pescados","vendas":5,"qtd":62.40000000000001,"fat":2593.76,"pmed":41.5667,"min":39.9,"max":42.0,"lista":38.5,"multilista":false,"desvio":0.079655,"impacto":191.36},{"produto":"RESFR. ASA PV CX 20 KG","linha":"Resfriados","vendas":4,"qtd":220.0,"fat":2480.0,"pmed":11.2727,"min":11.0,"max":11.5,"lista":11.0,"multilista":false,"desvio":0.024791,"impacto":59.99},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 1 KG CX 7 KG","linha":"Empanados de frango","vendas":13,"qtd":147.0,"fat":2288.02,"pmed":15.5648,"min":13.99,"max":16.99,"lista":15.0,"multilista":false,"desvio":0.037653,"impacto":83.03},{"produto":"BOLINHO DE TILAPIA CONG PCT 300 G CX 4,2 KG","linha":"Pescados","vendas":13,"qtd":67.2,"fat":2217.6,"pmed":33.0,"min":33.0,"max":33.0,"lista":33.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 300 G CX 3 KG","linha":"Empanados de frango","vendas":25,"qtd":99.0,"fat":2134.59,"pmed":21.5615,"min":15.8,"max":23.3,"lista":15.0,"multilista":false,"desvio":0.437433,"impacto":649.59},{"produto":"CONG. (FILEZINHO SASSAMI S/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":3,"qtd":140.0,"fat":1774.0,"pmed":12.6714,"min":12.5,"max":12.8,"lista":12.3,"multilista":false,"desvio":0.030195,"impacto":52.0},{"produto":"CONG. MIÚDOS FIGADO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":13,"qtd":360.0,"fat":1654.8,"pmed":4.5967,"min":3.99,"max":5.4,"lista":5.0,"multilista":false,"desvio":-0.08066,"impacto":-145.19},{"produto":"CONG. (COXA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":10,"qtd":160.0,"fat":1535.0,"pmed":9.5938,"min":9.5,"max":9.8,"lista":9.2,"multilista":false,"desvio":0.042804,"impacto":63.01},{"produto":"CONG. C/ OSSO PES GRADE A PCT 2 X 7,5 KG CX 15 KG G2","linha":"Congelados in natura","vendas":6,"qtd":135.0,"fat":1534.5,"pmed":11.3667,"min":10.2,"max":11.7,"lista":9.5,"multilista":false,"desvio":0.196495,"impacto":252.0},{"produto":"LASANHA QUATRO QUEIJOS CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":12,"qtd":100.8,"fat":1497.38,"pmed":14.855,"min":14.16,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.031597,"impacto":45.86},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 6,6 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":10,"qtd":79.2,"fat":1417.42,"pmed":17.8967,"min":16.68,"max":18.9,"lista":16.5,"multilista":false,"desvio":0.084648,"impacto":110.62},{"produto":"RESFR. C/ OSSO SOBRECOXA BDJ PV CX 13 KG","linha":"Resfriados","vendas":7,"qtd":130.0,"fat":1355.9,"pmed":10.43,"min":9.5,"max":10.6,"lista":8.8,"multilista":false,"desvio":0.185227,"impacto":211.9},{"produto":"BOLINHO DE FRANGO FUT CHICKEN C/ RECHEIO CREMOSO DE QUEIJO CONG PTC 300 G CX 4,2 KG","linha":"Empanados de frango","vendas":7,"qtd":42.0,"fat":1293.6,"pmed":30.8,"min":30.0,"max":31.0,"lista":30.0,"multilista":false,"desvio":0.026667,"impacto":33.6},{"produto":"LASANHA DE FRANGO CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":11,"qtd":86.40000000000002,"fat":1272.89,"pmed":14.7325,"min":14.16,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.02309,"impacto":28.73},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 11 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":5,"qtd":66.0,"fat":1197.68,"pmed":18.1467,"min":17.98,"max":18.9,"lista":16.5,"multilista":false,"desvio":0.0998,"impacto":108.68},{"produto":"RESFR. C/ OSSO COXINHA DA ASA BDJ PV CX 10,5 KG","linha":"Resfriados","vendas":6,"qtd":105.0,"fat":1176.0,"pmed":11.2,"min":10.8,"max":11.3,"lista":10.3,"multilista":false,"desvio":0.087379,"impacto":94.5},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (ISCAS DE TILAPIA) PCT 400 G CX PP 3,2 KG","linha":"Pescados","vendas":5,"qtd":19.2,"fat":892.8,"pmed":46.5,"min":42.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.033333,"impacto":28.8},{"produto":"CONG. (COXA E SOBRECOXA A PASSARINHO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":100.0,"fat":810.0,"pmed":8.1,"min":8.1,"max":8.1,"lista":8.2,"multilista":false,"desvio":-0.012195,"impacto":-10.0},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":4,"qtd":48.0,"fat":748.8,"pmed":15.6,"min":15.5,"max":15.7,"lista":15.0,"multilista":false,"desvio":0.04,"impacto":28.8},{"produto":"CONG. FILE DE SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":3,"qtd":40.0,"fat":617.0,"pmed":15.425,"min":15.0,"max":15.6,"lista":13.0,"multilista":false,"desvio":0.186538,"impacto":97.0},{"produto":"RESFR. C/ OSSO COXA BDJ PV CX 11,1 KG","linha":"Resfriados","vendas":2,"qtd":77.69999999999999,"fat":604.51,"pmed":7.78,"min":7.5,"max":7.99,"lista":6.5,"multilista":false,"desvio":0.196923,"impacto":99.46},{"produto":"SANDUICHE FUT BURGUER BACON C/ REQUEIJAO CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":5,"qtd":13.5,"fat":537.95,"pmed":39.848,"min":39.5,"max":39.94,"lista":40.0,"multilista":false,"desvio":-0.0038,"impacto":-2.05},{"produto":"MANDIOCA TOLETE CONGELADA PACOTE 1 KG CX PP 12 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":4,"qtd":48.0,"fat":515.76,"pmed":10.745,"min":10.5,"max":10.99,"lista":8.5,"multilista":false,"desvio":0.264118,"impacto":107.76},{"produto":"CONG. (MEIO DA ASA C/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":490.0,"pmed":24.5,"min":24.5,"max":24.5,"lista":23.8,"multilista":false,"desvio":0.029412,"impacto":14.0},{"produto":"COXINHA DA ASA EMPANADA TRADICIONAL PCT 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":2,"qtd":14.0,"fat":392.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-28.0},{"produto":"SANDUICHE FUT BURGUER C/ MOLHO DE PICLES CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":3,"qtd":8.100000000000001,"fat":323.46,"pmed":39.9333,"min":39.93,"max":39.94,"lista":40.0,"multilista":false,"desvio":-0.001667,"impacto":-0.54},{"produto":"SANDUICHE FUT BURGUER MAIONESE GRILL CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":3,"qtd":8.100000000000001,"fat":323.46,"pmed":39.9333,"min":39.93,"max":39.94,"lista":40.0,"multilista":false,"desvio":-0.001667,"impacto":-0.54},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (FILE DE TILAPIA) PCT 600 G CX PP 6 KG","linha":"Pescados","vendas":1,"qtd":6.0,"fat":294.0,"pmed":49.0,"min":49.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.088889,"impacto":24.0},{"produto":"CONG. PESCOCO S/ PELE C/ OSSO PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":2,"qtd":54.0,"fat":231.84,"pmed":4.2933,"min":3.99,"max":4.9,"lista":3.5,"multilista":false,"desvio":0.226657,"impacto":42.84},{"produto":"BATATA NOISETTE CONG PCT 400 G CX 10 KG","linha":"Vegetais e acompanhamentos","vendas":2,"qtd":20.0,"fat":225.0,"pmed":11.25,"min":11.25,"max":11.25,"lista":8.0,"multilista":false,"desvio":0.40625,"impacto":65.0},{"produto":"COXINHA DA ASA EMPANADA APIMENTADA PTC 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":1,"qtd":7.0,"fat":196.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-14.0},{"produto":"CONG. FRANGO C/ MIUDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":180.0,"pmed":9.0,"min":9.0,"max":9.0,"lista":8.9,"multilista":false,"desvio":0.011236,"impacto":2.0},{"produto":"RESFR. PEITO C/ OSSO PV CX 18 KG","linha":"Resfriados","vendas":1,"qtd":18.0,"fat":171.0,"pmed":9.5,"min":9.5,"max":9.5,"lista":9.1,"multilista":false,"desvio":0.043956,"impacto":7.2}]},"p3":{"periodo":"12 a 18/09/2026","nvendas":2327,"nclientes":575,"fat":2153785.33,"qtd":192021.9,"pmed":11.2164,"nprod":78,"indice":96.7,"vazamento":97499.04,"captura":23971.27,"itens":[{"produto":"CONG. FILE DE PEITO PV CX 20 KG","linha":"Congelados in natura","vendas":121,"qtd":29480.0,"fat":411561.6,"pmed":13.9607,"min":12.9,"max":14.8,"lista":14.4,"multilista":false,"desvio":-0.030507,"impacto":-12950.56},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 2 KG CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":69,"qtd":30540.0,"fat":218770.6,"pmed":7.1634,"min":7.0,"max":9.5,"lista":8.0,"multilista":false,"desvio":-0.104575,"impacto":-25549.76},{"produto":"CONG. COXINHA DA ASA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":153,"qtd":17550.0,"fat":174961.0,"pmed":9.9693,"min":9.4,"max":10.9,"lista":10.6,"multilista":true,"desvio":-0.0595,"impacto":-11068.78},{"produto":"RESFR. (FILE DE PEITO INDIVIDUAL) CX PP 20 KG (CANCAO ALIMENTOS)","linha":"Resfriados","vendas":107,"qtd":12240.0,"fat":146793.0,"pmed":11.9929,"min":10.0,"max":14.1,"lista":12.8,"multilista":false,"desvio":-0.063055,"impacto":-9878.9},{"produto":"CONG. FILEZINHO SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":131,"qtd":7250.0,"fat":108015.5,"pmed":14.8987,"min":12.9,"max":15.79,"lista":15.45,"multilista":true,"desvio":-0.035683,"impacto":-3996.92},{"produto":"CONG. COXA E SOBRECOXA PV CX 18 KG","linha":"Congelados in natura","vendas":86,"qtd":12492.0,"fat":92648.16,"pmed":7.4166,"min":6.5,"max":8.2,"lista":7.5,"multilista":true,"desvio":-0.01112,"impacto":-1041.83},{"produto":"CONG. (MEIO DA ASA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":77,"qtd":3000.0,"fat":75380.6,"pmed":25.1269,"min":24.5,"max":26.6,"lista":25.5,"multilista":false,"desvio":-0.014631,"impacto":-1119.3},{"produto":"CONG. (FILEZINHO SASSAMI S/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":6,"qtd":6260.0,"fat":71015.8,"pmed":11.3444,"min":11.0,"max":12.99,"lista":12.3,"multilista":false,"desvio":-0.077691,"impacto":-5982.06},{"produto":"CONG. FILE DE PEITO S/ PELE S/ SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":56,"qtd":4680.0,"fat":68739.5,"pmed":14.6879,"min":12.9,"max":15.9,"lista":16.0,"multilista":false,"desvio":-0.082006,"impacto":-6140.63},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 1,1 KG CAIXA PP 9,9 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":109,"qtd":7791.299999999987,"fat":65244.47,"pmed":8.374,"min":8.0,"max":9.99,"lista":8.0,"multilista":false,"desvio":0.04675,"impacto":2913.95},{"produto":"CONG. COXA E SOBRECOXA C/ PORCAO DORSAL PV CX 18 KG","linha":"Congelados in natura","vendas":22,"qtd":6318.0,"fat":41296.5,"pmed":6.5363,"min":6.49,"max":6.9,"lista":6.7,"multilista":false,"desvio":-0.024433,"impacto":-1034.26},{"produto":"FILE DE TILAPIA CONGELADA IQF 800 G CX PP 10,4 (CANCAO ALIMENTOS)","linha":"Pescados","vendas":12,"qtd":1060.8,"fat":41216.34,"pmed":38.854,"min":37.5,"max":41.5,"lista":38.5,"multilista":false,"desvio":0.009195,"impacto":375.52},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO EM BIFES IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":44,"qtd":2520.0,"fat":40191.6,"pmed":15.949,"min":15.0,"max":16.89,"lista":16.0,"multilista":false,"desvio":-0.003188,"impacto":-128.52},{"produto":"CONG. COXA E SOBRECOXA A PASSARINHO IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":78,"qtd":4630.0,"fat":38883.5,"pmed":8.3982,"min":7.99,"max":9.2,"lista":9.2,"multilista":false,"desvio":-0.087152,"impacto":-3712.33},{"produto":"RESFR. (COXA E SOBRECOXA INDIVIDUAL) CX PP 18KG (CANCAO)","linha":"Resfriados","vendas":65,"qtd":4824.0,"fat":35842.68,"pmed":7.4301,"min":6.8,"max":7.8,"lista":7.0,"multilista":false,"desvio":0.061443,"impacto":2074.8},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PCT 800 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":51,"qtd":2860.799999999998,"fat":30861.41,"pmed":10.7877,"min":10.0,"max":12.15,"lista":10.3,"multilista":true,"desvio":0.04735,"impacto":1395.21},{"produto":"CONG. SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":43,"qtd":2470.0,"fat":25763.2,"pmed":10.4304,"min":9.8,"max":10.98,"lista":11.1,"multilista":false,"desvio":-0.060324,"impacto":-1653.91},{"produto":"CONG. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":31,"qtd":2940.0,"fat":24997.0,"pmed":8.5024,"min":8.1,"max":11.25,"lista":8.7,"multilista":false,"desvio":-0.022713,"impacto":-580.94},{"produto":"RESFR. S/ OSSO FILE DE PEITO BDJ PV CX 11,2 KG","linha":"Resfriados","vendas":32,"qtd":1668.8,"fat":24851.34,"pmed":14.8917,"min":14.5,"max":15.5,"lista":14.0,"multilista":false,"desvio":0.063693,"impacto":1488.07},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 1 KG CX 7 KG","linha":"Empanados de frango","vendas":33,"qtd":1750.0,"fat":22964.62,"pmed":13.1226,"min":12.5,"max":16.0,"lista":14.0,"multilista":true,"desvio":-0.062671,"impacto":-1535.45},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 700 G CX PP 7 KG","linha":"Empanados de frango","vendas":64,"qtd":1274.0,"fat":22328.74,"pmed":17.5265,"min":16.5,"max":19.0,"lista":18.0,"multilista":false,"desvio":-0.026306,"impacto":-603.24},{"produto":"CONG. PEITO C/ OSSO PV CX 18 KG","linha":"Congelados in natura","vendas":26,"qtd":2196.0,"fat":21466.62,"pmed":9.7753,"min":8.8,"max":10.5,"lista":10.3,"multilista":false,"desvio":-0.050942,"impacto":-1152.24},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":6,"qtd":1420.0,"fat":19708.0,"pmed":13.8789,"min":12.2,"max":14.2,"lista":14.0,"multilista":false,"desvio":-0.00865,"impacto":-171.96},{"produto":"CONG. FILE DE SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":11,"qtd":1220.0,"fat":18913.2,"pmed":15.5026,"min":15.2,"max":15.9,"lista":13.0,"multilista":false,"desvio":0.192508,"impacto":3053.17},{"produto":"CONG. (MEIO DA ASA C/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":15,"qtd":760.0,"fat":18174.8,"pmed":23.9142,"min":23.8,"max":24.0,"lista":23.8,"multilista":false,"desvio":0.004798,"impacto":86.79},{"produto":"RESFR. FRANGO C/ MIÚDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":36,"qtd":2160.0,"fat":17891.0,"pmed":8.2829,"min":7.2,"max":8.5,"lista":8.0,"multilista":false,"desvio":0.035362,"impacto":611.06},{"produto":"CONG. MIÚDOS (CORACAO) PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":16,"qtd":520.0,"fat":16651.8,"pmed":32.0227,"min":29.9,"max":34.3,"lista":32.5,"multilista":false,"desvio":-0.014686,"impacto":-248.2},{"produto":"RESFR. COXINHA DA ASA PV CX 20 KG","linha":"Resfriados","vendas":34,"qtd":1640.0,"fat":15500.8,"pmed":9.4517,"min":9.0,"max":9.7,"lista":9.0,"multilista":false,"desvio":0.050189,"impacto":740.79},{"produto":"LASANHA A BOLONHESA CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":49,"qtd":972.0000000000007,"fat":14160.74,"pmed":14.5687,"min":14.0,"max":16.0,"lista":14.4,"multilista":false,"desvio":0.011715,"impacto":163.98},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":43,"qtd":868.0,"fat":11761.68,"pmed":13.5503,"min":12.99,"max":14.0,"lista":13.35,"multilista":false,"desvio":0.015004,"impacto":173.86},{"produto":"FILE DE TILAPIA CONGELADA IQF 400 G CX PP 10,4 KG","linha":"Pescados","vendas":15,"qtd":270.4000000000001,"fat":10857.6,"pmed":40.1538,"min":38.25,"max":42.0,"lista":38.5,"multilista":false,"desvio":0.042956,"impacto":447.19},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (FILE DE TILAPIA) PCT 600 G CX PP 6 KG","linha":"Pescados","vendas":20,"qtd":216.0,"fat":10222.8,"pmed":47.3278,"min":46.5,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.051729,"impacto":502.8},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 6,6 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":35,"qtd":528.0000000000002,"fat":9513.77,"pmed":18.0185,"min":16.16,"max":19.8,"lista":16.5,"multilista":true,"desvio":0.09203,"impacto":801.77},{"produto":"CONG. COXINHA DA ASA PV CX 20 KG","linha":"Congelados in natura","vendas":9,"qtd":980.0,"fat":9484.0,"pmed":9.6776,"min":9.5,"max":10.0,"lista":9.8,"multilista":false,"desvio":-0.01249,"impacto":-119.95},{"produto":"RESFR. MIÚDOS CORACAO PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":10,"qtd":300.0,"fat":9426.0,"pmed":31.42,"min":29.9,"max":32.5,"lista":29.5,"multilista":false,"desvio":0.065085,"impacto":576.0},{"produto":"CONG. MIÚDOS (CORACAO) BDJ 20 X 600 G CX 12 KG","linha":"Congelados in natura","vendas":18,"qtd":276.0,"fat":9286.8,"pmed":33.6478,"min":33.0,"max":34.0,"lista":33.0,"multilista":false,"desvio":0.01963,"impacto":178.79},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":24,"qtd":427.0,"fat":7592.62,"pmed":17.7813,"min":17.4,"max":18.9,"lista":18.0,"multilista":false,"desvio":-0.01215,"impacto":-93.38},{"produto":"RESFR. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":3,"qtd":840.0,"fat":7240.0,"pmed":8.619,"min":8.5,"max":9.0,"lista":8.5,"multilista":false,"desvio":0.014,"impacto":99.96},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 400 G CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":46,"qtd":650.0,"fat":7012.8,"pmed":10.7889,"min":8.7,"max":11.5,"lista":8.7,"multilista":false,"desvio":0.240103,"impacto":1357.79},{"produto":"POLENTA PALITO TRADICIONAL CONGELADA PACOTE 1 KG CX PP 10 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":56,"qtd":970.0,"fat":6673.2,"pmed":6.8796,"min":6.4,"max":7.0,"lista":7.0,"multilista":true,"desvio":-0.0172,"impacto":-116.79},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 300G CAIXA PP 3 KG","linha":"Empanados de frango","vendas":59,"qtd":405.0,"fat":6146.85,"pmed":15.1774,"min":13.99,"max":16.9,"lista":13.7,"multilista":false,"desvio":0.107839,"impacto":598.35},{"produto":"SANDUICHE FUT BURGUER BACON C/ REQUEIJAO CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":7,"qtd":153.8999999999999,"fat":5974.45,"pmed":38.8204,"min":38.66,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.02949,"impacto":-181.54},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 11 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":9,"qtd":341.0,"fat":5935.49,"pmed":17.4061,"min":17.2,"max":18.0,"lista":16.5,"multilista":false,"desvio":0.054915,"impacto":308.98},{"produto":"EMPANADO DE TILAPIA (SMALL FISH) CONG PCT 400 G CX 3,2 KG","linha":"Pescados","vendas":13,"qtd":448.0,"fat":5824.0,"pmed":13.0,"min":10.0,"max":15.0,"lista":14.0,"multilista":true,"desvio":-0.071429,"impacto":-448.0},{"produto":"SANDUICHE FUT BURGUER MAIONESE GRILL CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":6,"qtd":148.5,"fat":5758.51,"pmed":38.7778,"min":38.66,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.030555,"impacto":-181.5},{"produto":"RESFR. C/ OSSO MEIO DAS ASAS BDJ PV CX 10,2 KG","linha":"Resfriados","vendas":18,"qtd":234.6,"fat":5686.5,"pmed":24.2391,"min":24.0,"max":24.5,"lista":24.5,"multilista":false,"desvio":-0.010649,"impacto":-61.21},{"produto":"CONG. MIÚDOS FIGADO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":25,"qtd":1160.0,"fat":5655.6,"pmed":4.8755,"min":4.0,"max":5.2,"lista":5.0,"multilista":false,"desvio":-0.0249,"impacto":-144.42},{"produto":"EMPANADO DE TILAPIA CONG (SMALL FISH) PCT 1,5 KG CX 10,5 KG","linha":"Pescados","vendas":6,"qtd":682.5,"fat":5457.9,"pmed":7.9969,"min":7.99,"max":8.0,"lista":15.0,"multilista":false,"desvio":-0.466873,"impacto":-4779.62},{"produto":"SANDUICHE FUT BURGUER C/ MOLHO DE PICLES CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":3,"qtd":140.4,"fat":5434.78,"pmed":38.7092,"min":38.66,"max":39.94,"lista":40.0,"multilista":false,"desvio":-0.03227,"impacto":-181.23},{"produto":"RESFR. S/ OSSO FILEZINHO SASSAMI BDJ PV CX 11,4 KG","linha":"Resfriados","vendas":12,"qtd":353.4,"fat":5291.88,"pmed":14.9742,"min":14.49,"max":15.5,"lista":14.0,"multilista":false,"desvio":0.069586,"impacto":344.28},{"produto":"RESFR. ASA PV CX 20 KG","linha":"Resfriados","vendas":17,"qtd":460.0,"fat":5243.8,"pmed":11.3996,"min":11.0,"max":11.5,"lista":11.0,"multilista":false,"desvio":0.036327,"impacto":183.82},{"produto":"RESFR. PEITO C/ OSSO PV CX 18 KG","linha":"Resfriados","vendas":16,"qtd":486.0,"fat":4620.6,"pmed":9.5074,"min":9.5,"max":9.7,"lista":9.1,"multilista":false,"desvio":0.044769,"impacto":198.0},{"produto":"CONG. S/ OSSO C/ PELE FILE DE COXA E SOBRECOXA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":10,"qtd":340.0,"fat":4392.0,"pmed":12.9176,"min":12.5,"max":13.5,"lista":11.1,"multilista":false,"desvio":0.163748,"impacto":617.98},{"produto":"CONG. C/ OSSO PES GRADE A PCT 2 X 7,5 KG CX 15 KG G2","linha":"Congelados in natura","vendas":10,"qtd":420.0,"fat":4249.5,"pmed":10.1179,"min":9.7,"max":11.6,"lista":9.5,"multilista":false,"desvio":0.065042,"impacto":259.52},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PACOTE 300 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":16,"qtd":345.6,"fat":3997.63,"pmed":11.5672,"min":10.9,"max":12.17,"lista":11.0,"multilista":false,"desvio":0.051564,"impacto":196.02},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (ISCAS DE TILAPIA) PCT 400 G CX PP 3,2 KG","linha":"Pescados","vendas":13,"qtd":83.19999999999999,"fat":3920.93,"pmed":47.1265,"min":46.5,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.047256,"impacto":176.92},{"produto":"CONG. GALINHA INTEIRA (CABECA PESCOCO MOELA E PES) CX PP 20 KG (MISTER FRANGO)","linha":"Congelados in natura","vendas":15,"qtd":500.0,"fat":3900.0,"pmed":7.8,"min":7.8,"max":7.8,"lista":5.6,"multilista":false,"desvio":0.392857,"impacto":1100.0},{"produto":"CONG. (COXA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":23,"qtd":460.0,"fat":3779.7,"pmed":8.2167,"min":6.9,"max":8.9,"lista":9.2,"multilista":false,"desvio":-0.10688,"impacto":-452.32},{"produto":"CONG. C/ OSSO COXA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":2,"qtd":672.0,"fat":3748.8,"pmed":5.5786,"min":5.5,"max":7.7,"lista":8.5,"multilista":false,"desvio":-0.343694,"impacto":-1963.18},{"produto":"LASANHA DE FRANGO CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":22,"qtd":251.9999999999999,"fat":3711.31,"pmed":14.7274,"min":14.0,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.022736,"impacto":82.5},{"produto":"MANDIOCA TOLETE CONGELADA PACOTE 1 KG CX PP 12 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":18,"qtd":300.0,"fat":3200.4,"pmed":10.668,"min":9.9,"max":10.9,"lista":8.5,"multilista":false,"desvio":0.255059,"impacto":650.4},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 300 G CX 3 KG","linha":"Empanados de frango","vendas":43,"qtd":156.0,"fat":3122.4,"pmed":20.0154,"min":16.0,"max":23.3,"lista":15.0,"multilista":true,"desvio":0.33436,"impacto":782.4},{"produto":"BOLINHO DE TILAPIA CONG PCT 300 G CX 4,2 KG","linha":"Pescados","vendas":11,"qtd":92.4,"fat":3049.2,"pmed":33.0,"min":33.0,"max":33.0,"lista":33.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"CONG. PESCOCO S/ PELE C/ OSSO PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":9,"qtd":720.0,"fat":2977.56,"pmed":4.1355,"min":3.99,"max":4.8,"lista":3.5,"multilista":false,"desvio":0.181571,"impacto":457.56},{"produto":"CONG. SAMBIQUIRA PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":9,"qtd":684.0,"fat":2829.6,"pmed":4.1368,"min":3.99,"max":4.7,"lista":4.0,"multilista":false,"desvio":0.0342,"impacto":93.57},{"produto":"COXINHA DA ASA EMPANADA TRADICIONAL PCT 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":4,"qtd":91.0,"fat":2494.8,"pmed":27.4154,"min":27.0,"max":30.0,"lista":27.9,"multilista":true,"desvio":-0.017369,"impacto":-44.1},{"produto":"LASANHA QUATRO QUEIJOS CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":17,"qtd":165.6,"fat":2421.5,"pmed":14.6226,"min":14.0,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.015458,"impacto":36.86},{"produto":"RESFR. C/ OSSO SOBRECOXA BDJ PV CX 13 KG","linha":"Resfriados","vendas":11,"qtd":221.0,"fat":2354.3,"pmed":10.6529,"min":9.5,"max":10.9,"lista":8.8,"multilista":false,"desvio":0.210557,"impacto":409.49},{"produto":"RESFR. C/ OSSO COXINHA DA ASA BDJ PV CX 10,5 KG","linha":"Resfriados","vendas":17,"qtd":189.0,"fat":2083.2,"pmed":11.0222,"min":10.8,"max":11.3,"lista":10.3,"multilista":true,"desvio":0.070117,"impacto":136.5},{"produto":"CONG. FRANGO TEMPERADO C/ MIUDOS (PESCOCO MOELA E FIGADO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":200.0,"fat":2000.0,"pmed":10.0,"min":10.0,"max":10.0,"lista":10.5,"multilista":false,"desvio":-0.047619,"impacto":-100.0},{"produto":"BOLINHO DE FRANGO FUT CHICKEN C/ RECHEIO CREMOSO DE QUEIJO CONG PTC 300 G CX 4,2 KG","linha":"Empanados de frango","vendas":12,"qtd":54.60000000000002,"fat":1726.2,"pmed":31.6154,"min":30.0,"max":33.0,"lista":30.0,"multilista":false,"desvio":0.053847,"impacto":88.2},{"produto":"RESFR. (SOBRECOXAS) PCT CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":2,"qtd":100.0,"fat":894.0,"pmed":8.94,"min":8.9,"max":9.0,"lista":8.7,"multilista":false,"desvio":0.027586,"impacto":24.0},{"produto":"CONG. FRANGO C/ MIUDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":2,"qtd":60.0,"fat":528.0,"pmed":8.8,"min":8.6,"max":8.9,"lista":8.9,"multilista":false,"desvio":-0.011236,"impacto":-6.0},{"produto":"BATATA NOISETTE CONG PCT 400 G CX 10 KG","linha":"Vegetais e acompanhamentos","vendas":3,"qtd":40.0,"fat":463.0,"pmed":11.575,"min":11.25,"max":11.9,"lista":8.0,"multilista":false,"desvio":0.446875,"impacto":143.0},{"produto":"COXINHA DA ASA EMPANADA APIMENTADA PTC 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":1,"qtd":14.0,"fat":392.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-28.0},{"produto":"FILE DE TILAPIA CONGELADA EM PEDACOS PCT IQF 6 KG CX PP 12 KG (CANCAO ALIMENTOS)","linha":"Pescados","vendas":1,"qtd":12.0,"fat":360.0,"pmed":30.0,"min":30.0,"max":30.0,"lista":34.0,"multilista":false,"desvio":-0.117647,"impacto":-48.0},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":1,"qtd":12.0,"fat":199.2,"pmed":16.6,"min":16.6,"max":16.6,"lista":15.0,"multilista":false,"desvio":0.106667,"impacto":19.2},{"produto":"RESFR. C/ OSSO COXA BDJ PV CX 11,1 KG","linha":"Resfriados","vendas":1,"qtd":11.1,"fat":94.35,"pmed":8.5,"min":8.5,"max":8.5,"lista":6.5,"multilista":false,"desvio":0.307692,"impacto":22.2}]},"p4":{"periodo":"19 a 24/09/2026","nvendas":2568,"nclientes":608,"fat":1938307.86,"qtd":171622.0,"pmed":11.2941,"nprod":86,"indice":99.25,"vazamento":54975.03,"captura":40298.43,"itens":[{"produto":"CONG. FILE DE PEITO PV CX 20 KG","linha":"Congelados in natura","vendas":104,"qtd":15500.0,"fat":217153.0,"pmed":14.0099,"min":12.5,"max":15.6,"lista":14.4,"multilista":false,"desvio":-0.02709,"impacto":-6046.55},{"produto":"CONG. COXINHA DA ASA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":162,"qtd":15590.0,"fat":161271.9,"pmed":10.3446,"min":9.9,"max":21.7,"lista":10.6,"multilista":true,"desvio":-0.024094,"impacto":-3981.69},{"produto":"CONG. FILEZINHO SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":156,"qtd":9810.0,"fat":148279.0,"pmed":15.1151,"min":14.0,"max":16.5,"lista":15.45,"multilista":true,"desvio":-0.021676,"impacto":-3285.37},{"produto":"CONG. COXA E SOBRECOXA PV CX 18 KG","linha":"Congelados in natura","vendas":111,"qtd":16596.0,"fat":124444.62,"pmed":7.4985,"min":6.99,"max":8.5,"lista":7.5,"multilista":false,"desvio":-0.0002,"impacto":-24.89},{"produto":"RESFR. (FILE DE PEITO INDIVIDUAL) CX PP 20 KG (CANCAO ALIMENTOS)","linha":"Resfriados","vendas":107,"qtd":6360.0,"fat":90654.4,"pmed":14.2538,"min":13.5,"max":14.9,"lista":12.8,"multilista":false,"desvio":0.113578,"impacto":9246.17},{"produto":"CONG. COXINHA DA ASA PV CX 20 KG","linha":"Congelados in natura","vendas":35,"qtd":8420.0,"fat":82663.6,"pmed":9.8175,"min":9.5,"max":10.5,"lista":9.8,"multilista":false,"desvio":0.001786,"impacto":147.35},{"produto":"CONG. COXA E SOBRECOXA A PASSARINHO IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":137,"qtd":9450.0,"fat":80383.5,"pmed":8.5062,"min":8.3,"max":9.99,"lista":9.2,"multilista":true,"desvio":-0.075413,"impacto":-6556.41},{"produto":"RESFR. (COXA E SOBRECOXA INDIVIDUAL) CX PP 18KG (CANCAO)","linha":"Resfriados","vendas":95,"qtd":10692.0,"fat":79363.98,"pmed":7.4227,"min":7.0,"max":8.3,"lista":7.0,"multilista":false,"desvio":0.060386,"impacto":4519.51},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 2 KG CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":91,"qtd":9500.0,"fat":77445.1,"pmed":8.1521,"min":7.7,"max":9.5,"lista":8.0,"multilista":false,"desvio":0.019013,"impacto":1444.95},{"produto":"CONG. (MEIO DA ASA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":50,"qtd":2950.0,"fat":75732.0,"pmed":25.6719,"min":24.0,"max":26.7,"lista":25.7,"multilista":true,"desvio":-0.001093,"impacto":-82.89},{"produto":"FILE DE TILAPIA CONGELADA IQF 400 G CX PP 10,4 KG","linha":"Pescados","vendas":27,"qtd":1352.0,"fat":55248.44,"pmed":40.8642,"min":38.25,"max":43.0,"lista":38.5,"multilista":false,"desvio":0.061408,"impacto":3196.4},{"produto":"CONG. PEITO C/ OSSO PV CX 18 KG","linha":"Congelados in natura","vendas":40,"qtd":5310.0,"fat":54051.66,"pmed":10.1792,"min":9.5,"max":10.9,"lista":10.3,"multilista":false,"desvio":-0.011728,"impacto":-641.45},{"produto":"CONG. FILE DE PEITO S/ PELE S/ SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":46,"qtd":3020.0,"fat":45645.2,"pmed":15.1143,"min":14.3,"max":16.9,"lista":16.0,"multilista":false,"desvio":-0.055356,"impacto":-2674.81},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 1,1 KG CAIXA PP 9,9 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":144,"qtd":4346.100000000004,"fat":36444.28,"pmed":8.3855,"min":8.0,"max":9.98,"lista":8.0,"multilista":false,"desvio":0.048188,"impacto":1675.42},{"produto":"CONG. FRANGO C/ MIUDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":23,"qtd":4000.0,"fat":34762.0,"pmed":8.6905,"min":8.2,"max":9.2,"lista":8.9,"multilista":false,"desvio":-0.023539,"impacto":-838.0},{"produto":"RESFR. S/ OSSO FILE DE PEITO BDJ PV CX 11,2 KG","linha":"Resfriados","vendas":40,"qtd":2161.6,"fat":33887.73,"pmed":15.6772,"min":14.9,"max":16.8,"lista":14.0,"multilista":false,"desvio":0.1198,"impacto":3625.44},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO EM BIFES IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":11,"qtd":1920.0,"fat":30333.0,"pmed":15.7984,"min":15.7,"max":18.9,"lista":16.0,"multilista":false,"desvio":-0.0126,"impacto":-387.07},{"produto":"CONG. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":27,"qtd":3440.0,"fat":28775.8,"pmed":8.3651,"min":8.05,"max":10.5,"lista":8.7,"multilista":false,"desvio":-0.038494,"impacto":-1152.06},{"produto":"CONG. (MEIO DA ASA C/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":23,"qtd":1180.0,"fat":28142.0,"pmed":23.8492,"min":23.5,"max":24.9,"lista":23.8,"multilista":false,"desvio":0.002067,"impacto":58.06},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 700 G CX PP 7 KG","linha":"Empanados de frango","vendas":25,"qtd":1792.0,"fat":25027.31,"pmed":13.9661,"min":11.4,"max":19.98,"lista":18.0,"multilista":false,"desvio":-0.224106,"impacto":-7228.75},{"produto":"CONG. (FILEZINHO SASSAMI S/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":6,"qtd":1860.0,"fat":23373.8,"pmed":12.5666,"min":12.0,"max":13.2,"lista":12.3,"multilista":false,"desvio":0.021675,"impacto":495.88},{"produto":"RESFR. FRANGO C/ MIÚDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":45,"qtd":2560.0,"fat":21316.2,"pmed":8.3266,"min":7.9,"max":8.8,"lista":8.0,"multilista":false,"desvio":0.040825,"impacto":836.1},{"produto":"FILE DE TILAPIA CONGELADA IQF 800 G CX PP 10,4 (CANCAO ALIMENTOS)","linha":"Pescados","vendas":19,"qtd":488.7999999999998,"fat":19446.44,"pmed":39.784,"min":38.5,"max":41.5,"lista":38.5,"multilista":false,"desvio":0.033351,"impacto":627.62},{"produto":"CONG. MIÚDOS FIGADO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":23,"qtd":4440.0,"fat":19117.6,"pmed":4.3058,"min":3.99,"max":5.4,"lista":5.0,"multilista":false,"desvio":-0.13884,"impacto":-3082.25},{"produto":"RESFR. COXINHA DA ASA PV CX 20 KG","linha":"Resfriados","vendas":35,"qtd":1880.0,"fat":17920.0,"pmed":9.5319,"min":9.0,"max":10.1,"lista":9.0,"multilista":false,"desvio":0.0591,"impacto":999.97},{"produto":"RESFR. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":18,"qtd":2100.0,"fat":17447.2,"pmed":8.3082,"min":8.0,"max":9.5,"lista":8.5,"multilista":false,"desvio":-0.022565,"impacto":-402.78},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PCT 800 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":34,"qtd":1420.799999999999,"fat":15339.46,"pmed":10.7964,"min":10.0,"max":11.11,"lista":11.0,"multilista":false,"desvio":-0.018509,"impacto":-289.27},{"produto":"FILE DE TILAPIA CONGELADA EM PEDACOS PCT IQF 6 KG CX PP 12 KG (CANCAO ALIMENTOS)","linha":"Pescados","vendas":2,"qtd":552.0,"fat":14244.0,"pmed":25.8043,"min":25.6,"max":35.0,"lista":34.0,"multilista":false,"desvio":-0.24105,"impacto":-4524.03},{"produto":"CONG. SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":24,"qtd":1260.0,"fat":13623.5,"pmed":10.8123,"min":10.2,"max":11.7,"lista":11.1,"multilista":false,"desvio":-0.025919,"impacto":-362.5},{"produto":"CONG. COXA E SOBRECOXA C/ PORCAO DORSAL PV CX 18 KG","linha":"Congelados in natura","vendas":20,"qtd":1890.0,"fat":13061.88,"pmed":6.911,"min":6.7,"max":7.3,"lista":6.7,"multilista":false,"desvio":0.031493,"impacto":398.79},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 1 KG CX 7 KG","linha":"Empanados de frango","vendas":13,"qtd":1225.0,"fat":12804.61,"pmed":10.4527,"min":9.99,"max":16.9,"lista":14.0,"multilista":true,"desvio":-0.253379,"impacto":-4345.44},{"produto":"CONG. MIÚDOS (CORACAO) PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":13,"qtd":380.0,"fat":12654.0,"pmed":33.3,"min":29.9,"max":34.5,"lista":32.5,"multilista":false,"desvio":0.024615,"impacto":304.0},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 300G CAIXA PP 3 KG","linha":"Empanados de frango","vendas":99,"qtd":798.0,"fat":12292.5,"pmed":15.4041,"min":15.0,"max":16.67,"lista":13.7,"multilista":false,"desvio":0.124387,"impacto":1359.87},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":12,"qtd":792.0,"fat":12141.6,"pmed":15.3303,"min":15.0,"max":17.0,"lista":15.0,"multilista":false,"desvio":0.02202,"impacto":261.6},{"produto":"RESFR. S/ OSSO FILEZINHO SASSAMI BDJ PV CX 11,4 KG","linha":"Resfriados","vendas":28,"qtd":775.2,"fat":12017.88,"pmed":15.5029,"min":14.9,"max":15.8,"lista":14.0,"multilista":false,"desvio":0.10735,"impacto":1165.05},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 400 G CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":45,"qtd":1220.0,"fat":11746.7,"pmed":9.6284,"min":8.0,"max":11.98,"lista":8.7,"multilista":false,"desvio":0.106713,"impacto":1132.65},{"produto":"RESFR. MIÚDOS CORACAO PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":9,"qtd":340.0,"fat":10792.0,"pmed":31.7412,"min":31.0,"max":33.8,"lista":29.5,"multilista":false,"desvio":0.075973,"impacto":762.01},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":32,"qtd":602.0,"fat":10652.04,"pmed":17.6944,"min":17.2,"max":18.99,"lista":18.0,"multilista":false,"desvio":-0.016978,"impacto":-183.97},{"produto":"LASANHA A BOLONHESA CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":53,"qtd":655.2000000000002,"fat":9426.02,"pmed":14.3865,"min":13.5,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.000938,"impacto":-8.85},{"produto":"CONG. (COXA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":9,"qtd":1060.0,"fat":8901.9,"pmed":8.398,"min":8.0,"max":9.5,"lista":9.2,"multilista":false,"desvio":-0.087174,"impacto":-850.12},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PACOTE 300 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":21,"qtd":767.9999999999999,"fat":8602.27,"pmed":11.2009,"min":9.96,"max":12.17,"lista":11.0,"multilista":false,"desvio":0.018264,"impacto":154.29},{"produto":"RESFR. C/ OSSO MEIO DAS ASAS BDJ PV CX 10,2 KG","linha":"Resfriados","vendas":22,"qtd":305.9999999999999,"fat":7731.6,"pmed":25.2667,"min":24.5,"max":25.5,"lista":24.5,"multilista":false,"desvio":0.031294,"impacto":234.61},{"produto":"CONG. S/ OSSO C/ PELE FILE DE COXA E SOBRECOXA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":16,"qtd":560.0,"fat":7253.4,"pmed":12.9525,"min":12.5,"max":13.3,"lista":11.1,"multilista":false,"desvio":0.166892,"impacto":1037.4},{"produto":"EMPANADO DE TILAPIA (SMALL FISH) CONG PCT 400 G CX 3,2 KG","linha":"Pescados","vendas":21,"qtd":707.2000000000004,"fat":6636.8,"pmed":9.3846,"min":8.0,"max":15.0,"lista":15.0,"multilista":false,"desvio":-0.37436,"impacto":-3971.21},{"produto":"CONG. C/ OSSO PES GRADE A PCT 2 X 7,5 KG CX 15 KG G2","linha":"Congelados in natura","vendas":16,"qtd":630.0,"fat":6429.15,"pmed":10.205,"min":9.5,"max":10.9,"lista":9.5,"multilista":false,"desvio":0.074211,"impacto":444.15},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":30,"qtd":406.0,"fat":5653.62,"pmed":13.9252,"min":12.99,"max":14.0,"lista":13.35,"multilista":false,"desvio":0.043086,"impacto":233.53},{"produto":"CONG. SAMBIQUIRA PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":24,"qtd":1368.0,"fat":5469.84,"pmed":3.9984,"min":3.39,"max":4.7,"lista":4.0,"multilista":false,"desvio":-0.0004,"impacto":-2.19},{"produto":"RESFR. ASA PV CX 20 KG","linha":"Resfriados","vendas":12,"qtd":460.0,"fat":5224.0,"pmed":11.3565,"min":10.9,"max":12.1,"lista":11.0,"multilista":false,"desvio":0.032409,"impacto":163.99},{"produto":"SANDUICHE FUT BURGUER BACON C/ REQUEIJAO CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":17,"qtd":129.6,"fat":5176.9,"pmed":39.9452,"min":39.9,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.00137,"impacto":-7.1},{"produto":"RESFR. C/ OSSO COXINHA DA ASA BDJ PV CX 10,5 KG","linha":"Resfriados","vendas":26,"qtd":462.0,"fat":5110.35,"pmed":11.0614,"min":10.8,"max":12.3,"lista":10.3,"multilista":false,"desvio":0.073922,"impacto":351.77},{"produto":"SANDUICHE FUT BURGUER MAIONESE GRILL CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":14,"qtd":124.2,"fat":4961.09,"pmed":39.9443,"min":39.9,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.001393,"impacto":-6.92},{"produto":"SANDUICHE FUT BURGUER C/ MOLHO DE PICLES CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":12,"qtd":118.8,"fat":4745.09,"pmed":39.9418,"min":39.9,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.001455,"impacto":-6.91},{"produto":"CONG. PESCOCO S/ PELE C/ OSSO PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":17,"qtd":972.0,"fat":4375.08,"pmed":4.5011,"min":3.99,"max":4.7,"lista":3.5,"multilista":false,"desvio":0.286029,"impacto":973.07},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 6,6 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":20,"qtd":244.1999999999999,"fat":4340.29,"pmed":17.7735,"min":16.16,"max":18.5,"lista":16.5,"multilista":false,"desvio":0.077182,"impacto":310.99},{"produto":"LASANHA DE FRANGO CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":29,"qtd":287.9999999999999,"fat":4131.14,"pmed":14.3443,"min":13.5,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.003868,"impacto":-16.04},{"produto":"CONG. MIÚDOS (CORACAO) BDJ 20 X 600 G CX 12 KG","linha":"Congelados in natura","vendas":9,"qtd":120.0,"fat":4098.0,"pmed":34.15,"min":33.0,"max":36.0,"lista":33.0,"multilista":false,"desvio":0.034848,"impacto":138.0},{"produto":"CONG. C/ OSSO COXA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":3,"qtd":696.0,"fat":3928.8,"pmed":5.6448,"min":5.5,"max":9.9,"lista":8.5,"multilista":false,"desvio":-0.335906,"impacto":-1987.22},{"produto":"CONG. FILE DE SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":8,"qtd":240.0,"fat":3851.4,"pmed":16.0475,"min":14.9,"max":16.2,"lista":13.0,"multilista":false,"desvio":0.234423,"impacto":731.4},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 11 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":14,"qtd":209.0,"fat":3762.0,"pmed":18.0,"min":18.0,"max":18.0,"lista":16.5,"multilista":false,"desvio":0.090909,"impacto":313.5},{"produto":"POLENTA PALITO TRADICIONAL CONGELADA PACOTE 1 KG CX PP 10 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":41,"qtd":540.0,"fat":3672.1,"pmed":6.8002,"min":6.2,"max":7.01,"lista":7.0,"multilista":false,"desvio":-0.028543,"impacto":-107.89},{"produto":"RESFR. PEITO C/ OSSO PV CX 18 KG","linha":"Resfriados","vendas":12,"qtd":360.0,"fat":3643.2,"pmed":10.12,"min":9.5,"max":10.5,"lista":9.1,"multilista":false,"desvio":0.112088,"impacto":367.2},{"produto":"RESFR. C/ OSSO SOBRECOXA BDJ PV CX 13 KG","linha":"Resfriados","vendas":17,"qtd":325.0,"fat":3581.5,"pmed":11.02,"min":9.5,"max":11.2,"lista":8.8,"multilista":false,"desvio":0.252273,"impacto":721.5},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 300 G CX 3 KG","linha":"Empanados de frango","vendas":43,"qtd":159.0,"fat":3231.18,"pmed":20.3219,"min":15.0,"max":23.3,"lista":15.0,"multilista":false,"desvio":0.354793,"impacto":846.18},{"produto":"LASANHA QUATRO QUEIJOS CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":22,"qtd":223.2,"fat":3153.38,"pmed":14.1281,"min":13.5,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.018882,"impacto":-60.69},{"produto":"RESFR. MIÚDOS CORACAO BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":8,"qtd":96.0,"fat":3072.0,"pmed":32.0,"min":32.0,"max":32.0,"lista":36.0,"multilista":false,"desvio":-0.111111,"impacto":-384.0},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (ISCAS DE TILAPIA) PCT 400 G CX PP 3,2 KG","linha":"Pescados","vendas":11,"qtd":54.4,"fat":2510.4,"pmed":46.1471,"min":42.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.025491,"impacto":62.4},{"produto":"MANDIOCA TOLETE CONGELADA PACOTE 1 KG CX PP 12 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":16,"qtd":228.0,"fat":2377.2,"pmed":10.4263,"min":9.8,"max":10.9,"lista":8.5,"multilista":false,"desvio":0.226624,"impacto":439.2},{"produto":"BOLINHO DE TILAPIA CONG PCT 300 G CX 4,2 KG","linha":"Pescados","vendas":10,"qtd":54.60000000000001,"fat":1801.8,"pmed":33.0,"min":33.0,"max":33.0,"lista":33.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"COXINHA DA ASA EMPANADA TRADICIONAL PCT 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":5,"qtd":49.0,"fat":1372.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-98.0},{"produto":"CONG. (COXAS INTERFOLHADO) CX PP 18 KG","linha":"Congelados in natura","vendas":2,"qtd":162.0,"fat":1253.7,"pmed":7.7389,"min":7.5,"max":7.93,"lista":7.0,"multilista":false,"desvio":0.105557,"impacto":119.7},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (FILE DE TILAPIA) PCT 600 G CX PP 6 KG","linha":"Pescados","vendas":4,"qtd":24.0,"fat":1131.0,"pmed":47.125,"min":46.5,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.047222,"impacto":51.0},{"produto":"RESFR. MIÚDOS MOELA BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":9,"qtd":108.0,"fat":1026.0,"pmed":9.5,"min":9.5,"max":9.5,"lista":11.0,"multilista":false,"desvio":-0.136364,"impacto":-162.0},{"produto":"RESFR. C/ OSSO PES BDJ PV CX 7,5 KG","linha":"Resfriados","vendas":6,"qtd":90.0,"fat":900.0,"pmed":10.0,"min":10.0,"max":10.0,"lista":12.7,"multilista":false,"desvio":-0.212598,"impacto":-243.0},{"produto":"EMPANADO DE TILAPIA CONG (SMALL FISH) PCT 1,5 KG CX 10,5 KG","linha":"Pescados","vendas":1,"qtd":94.5,"fat":756.0,"pmed":8.0,"min":8.0,"max":8.0,"lista":15.0,"multilista":false,"desvio":-0.466667,"impacto":-661.5},{"produto":"RESFR. (SOBRECOXAS) PCT CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":1,"qtd":80.0,"fat":720.0,"pmed":9.0,"min":9.0,"max":9.0,"lista":8.7,"multilista":false,"desvio":0.034483,"impacto":24.0},{"produto":"RESFR. MIÚDOS FIGADO BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":9,"qtd":108.0,"fat":702.0,"pmed":6.5,"min":6.5,"max":6.5,"lista":7.0,"multilista":false,"desvio":-0.071429,"impacto":-54.0},{"produto":"RESFR. S/ OSSO S/ PELE PEITO S/ SASSAMI PCT PV CX 20 KG","linha":"Resfriados","vendas":2,"qtd":40.0,"fat":584.0,"pmed":14.6,"min":14.6,"max":14.6,"lista":12.8,"multilista":false,"desvio":0.140625,"impacto":72.0},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":1,"qtd":40.0,"fat":576.0,"pmed":14.4,"min":14.4,"max":14.4,"lista":14.0,"multilista":false,"desvio":0.028571,"impacto":16.0},{"produto":"RESFR. C/ OSSO S/ PELE PESCOCO BDJ 15 X 600 G CX 12 KG","linha":"Resfriados","vendas":7,"qtd":84.0,"fat":420.0,"pmed":5.0,"min":5.0,"max":5.0,"lista":6.7,"multilista":false,"desvio":-0.253731,"impacto":-142.8},{"produto":"COXINHA DA ASA EMPANADA APIMENTADA PTC 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":2,"qtd":14.0,"fat":392.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-28.0},{"produto":"BOLINHO DE FRANGO FUT CHICKEN C/ RECHEIO CREMOSO DE QUEIJO CONG PTC 300 G CX 4,2 KG","linha":"Empanados de frango","vendas":3,"qtd":12.6,"fat":386.23,"pmed":30.6533,"min":29.96,"max":31.0,"lista":30.0,"multilista":false,"desvio":0.021777,"impacto":8.23},{"produto":"CONG. FILEZINHO SASSAMI S/ OSSO S/ PELE BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":1,"qtd":24.0,"fat":384.0,"pmed":16.0,"min":16.0,"max":16.0,"lista":15.0,"multilista":false,"desvio":0.066667,"impacto":24.0},{"produto":"RESFR. C/ OSSO SAMBIQUIRA BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":6,"qtd":72.0,"fat":360.0,"pmed":5.0,"min":5.0,"max":5.0,"lista":6.2,"multilista":false,"desvio":-0.193548,"impacto":-86.4},{"produto":"BATATA NOISETTE CONG PCT 400 G CX 10 KG","linha":"Vegetais e acompanhamentos","vendas":3,"qtd":30.0,"fat":337.5,"pmed":11.25,"min":11.25,"max":11.25,"lista":8.0,"multilista":false,"desvio":0.40625,"impacto":97.5},{"produto":"CONG. GALINHA INTEIRA (CABECA PESCOCO MOELA E PES) CX PP 20 KG (MISTER FRANGO)","linha":"Congelados in natura","vendas":1,"qtd":40.0,"fat":312.0,"pmed":7.8,"min":7.8,"max":7.8,"lista":5.6,"multilista":false,"desvio":0.392857,"impacto":88.0},{"produto":"CONG. C/ OSSO COXINHA DA ASA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":1,"qtd":12.0,"fat":144.0,"pmed":12.0,"min":12.0,"max":12.0,"lista":10.5,"multilista":false,"desvio":0.142857,"impacto":18.0}]},"p5":{"periodo":"25 a 29/09/2026","nvendas":1577,"nclientes":439,"fat":1234738.06,"qtd":118523.3,"pmed":10.4177,"nprod":89,"indice":96.96,"vazamento":68114.13,"captura":29353.95,"itens":[{"produto":"CONG. COXA E SOBRECOXA PV CX 18 KG","linha":"Congelados in natura","vendas":70,"qtd":26838.0,"fat":194535.72,"pmed":7.2485,"min":7.13,"max":8.3,"lista":7.5,"multilista":false,"desvio":-0.033533,"impacto":-6749.76},{"produto":"CONG. FILE DE PEITO PV CX 20 KG","linha":"Congelados in natura","vendas":70,"qtd":12480.0,"fat":178388.4,"pmed":14.2939,"min":14.0,"max":15.6,"lista":14.4,"multilista":false,"desvio":-0.007368,"impacto":-1324.13},{"produto":"RESFR. (FILE DE PEITO INDIVIDUAL) CX PP 20 KG (CANCAO ALIMENTOS)","linha":"Resfriados","vendas":113,"qtd":8420.0,"fat":117943.0,"pmed":14.0075,"min":13.8,"max":15.0,"lista":12.8,"multilista":false,"desvio":0.094336,"impacto":10167.15},{"produto":"RESFR. (COXA E SOBRECOXA INDIVIDUAL) CX PP 18KG (CANCAO)","linha":"Resfriados","vendas":96,"qtd":10098.0,"fat":73092.6,"pmed":7.2383,"min":6.4,"max":7.8,"lista":7.0,"multilista":false,"desvio":0.034043,"impacto":2406.35},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 700 G CX PP 7 KG","linha":"Empanados de frango","vendas":64,"qtd":4725.0,"fat":58244.97,"pmed":12.327,"min":11.4,"max":19.0,"lista":18.0,"multilista":false,"desvio":-0.315167,"impacto":-26804.92},{"produto":"CONG. COXINHA DA ASA PV CX 20 KG","linha":"Congelados in natura","vendas":29,"qtd":5260.0,"fat":50573.6,"pmed":9.6148,"min":9.49,"max":10.1,"lista":9.8,"multilista":false,"desvio":-0.018898,"impacto":-974.15},{"produto":"CONG. COXINHA DA ASA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":55,"qtd":4030.0,"fat":42223.2,"pmed":10.4772,"min":10.2,"max":11.7,"lista":10.6,"multilista":false,"desvio":-0.011585,"impacto":-494.88},{"produto":"CONG. COXA E SOBRECOXA C/ PORCAO DORSAL PV CX 18 KG","linha":"Congelados in natura","vendas":17,"qtd":6012.0,"fat":39236.4,"pmed":6.5263,"min":6.49,"max":7.4,"lista":6.7,"multilista":false,"desvio":-0.025925,"impacto":-1044.28},{"produto":"RESFR. COXINHA DA ASA PV CX 20 KG","linha":"Resfriados","vendas":50,"qtd":3660.0,"fat":34391.4,"pmed":9.3966,"min":9.0,"max":9.6,"lista":9.0,"multilista":false,"desvio":0.044067,"impacto":1451.56},{"produto":"CONG. FILEZINHO SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":48,"qtd":1880.0,"fat":29097.9,"pmed":15.4776,"min":14.0,"max":16.5,"lista":15.45,"multilista":false,"desvio":0.001786,"impacto":51.89},{"produto":"RESFR. S/ OSSO FILE DE PEITO BDJ PV CX 11,2 KG","linha":"Resfriados","vendas":44,"qtd":1836.8,"fat":28368.93,"pmed":15.4448,"min":14.5,"max":15.8,"lista":14.0,"multilista":false,"desvio":0.1032,"impacto":2653.81},{"produto":"CONG. PEITO C/ OSSO PV CX 18 KG","linha":"Congelados in natura","vendas":18,"qtd":2592.0,"fat":26281.8,"pmed":10.1396,"min":9.8,"max":10.7,"lista":10.3,"multilista":false,"desvio":-0.015573,"impacto":-415.76},{"produto":"CONG. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":25,"qtd":3160.0,"fat":26102.0,"pmed":8.2601,"min":8.05,"max":10.5,"lista":8.7,"multilista":false,"desvio":-0.050563,"impacto":-1390.08},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 1 KG CX 7 KG","linha":"Empanados de frango","vendas":16,"qtd":1988.0,"fat":20897.87,"pmed":10.512,"min":9.99,"max":15.99,"lista":14.0,"multilista":true,"desvio":-0.249143,"impacto":-6934.14},{"produto":"CONG. (MEIO DA ASA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":30,"qtd":720.0,"fat":18558.8,"pmed":25.7761,"min":24.6,"max":26.79,"lista":25.5,"multilista":false,"desvio":0.010827,"impacto":198.79},{"produto":"RESFR. FRANGO C/ MIÚDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":30,"qtd":2060.0,"fat":16972.6,"pmed":8.2391,"min":8.2,"max":8.5,"lista":8.0,"multilista":false,"desvio":0.029888,"impacto":492.55},{"produto":"CONG. (MEIO DA ASA C/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":8,"qtd":640.0,"fat":15382.0,"pmed":24.0344,"min":23.0,"max":24.5,"lista":23.8,"multilista":false,"desvio":0.009849,"impacto":150.02},{"produto":"EMPANADO DE TILAPIA (SMALL FISH) CONG PCT 400 G CX 3,2 KG","linha":"Pescados","vendas":13,"qtd":1644.8,"fat":13195.2,"pmed":8.0224,"min":7.5,"max":12.0,"lista":15.0,"multilista":false,"desvio":-0.465173,"impacto":-11476.76},{"produto":"LASANHA A BOLONHESA CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":21,"qtd":1015.200000000001,"fat":13103.57,"pmed":12.9074,"min":12.15,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.103653,"impacto":-1515.29},{"produto":"CONG. (FILEZINHO SASSAMI S/ OSSO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":2,"qtd":1020.0,"fat":12766.0,"pmed":12.5157,"min":12.5,"max":13.3,"lista":12.3,"multilista":false,"desvio":0.017537,"impacto":220.01},{"produto":"RESFR. MIÚDOS CORACAO PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":14,"qtd":400.0,"fat":12430.0,"pmed":31.075,"min":30.5,"max":32.0,"lista":29.5,"multilista":false,"desvio":0.05339,"impacto":630.0},{"produto":"RESFR. S/ OSSO FILEZINHO SASSAMI BDJ PV CX 11,4 KG","linha":"Resfriados","vendas":34,"qtd":775.1999999999998,"fat":11950.28,"pmed":15.4157,"min":14.99,"max":15.8,"lista":14.0,"multilista":false,"desvio":0.101121,"impacto":1097.45},{"produto":"CONG. S/ OSSO C/ PELE FILE DE COXA E SOBRECOXA PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":10,"qtd":940.0,"fat":11708.0,"pmed":12.4553,"min":12.3,"max":13.2,"lista":11.1,"multilista":false,"desvio":0.122099,"impacto":1273.98},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":17,"qtd":868.0,"fat":11528.86,"pmed":13.2821,"min":12.99,"max":17.49,"lista":13.35,"multilista":false,"desvio":-0.005086,"impacto":-58.94},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 2 KG CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":38,"qtd":1350.0,"fat":11368.8,"pmed":8.4213,"min":7.9,"max":9.0,"lista":8.0,"multilista":false,"desvio":0.052663,"impacto":568.76},{"produto":"RESFR. C/ OSSO MEIO DAS ASAS BDJ PV CX 10,2 KG","linha":"Resfriados","vendas":29,"qtd":438.5999999999998,"fat":11263.86,"pmed":25.6814,"min":24.5,"max":26.0,"lista":24.5,"multilista":false,"desvio":0.04822,"impacto":518.16},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO EM BIFES IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":16,"qtd":610.0,"fat":9845.7,"pmed":16.1405,"min":15.7,"max":16.7,"lista":16.0,"multilista":false,"desvio":0.008781,"impacto":85.7},{"produto":"CONG. COXA E SOBRECOXA A PASSARINHO IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":30,"qtd":1040.0,"fat":9001.6,"pmed":8.6554,"min":8.3,"max":9.7,"lista":9.2,"multilista":false,"desvio":-0.059196,"impacto":-566.38},{"produto":"FILE DE TILAPIA CONGELADA IQF 400 G CX PP 10,4 KG","linha":"Pescados","vendas":16,"qtd":187.2,"fat":7698.08,"pmed":41.1222,"min":39.5,"max":43.0,"lista":38.5,"multilista":false,"desvio":0.068109,"impacto":490.88},{"produto":"CONG. FRANGO C/ MIUDOS (2 FIGADO 2 PESCOCO) CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":13,"qtd":860.0,"fat":7478.0,"pmed":8.6953,"min":8.2,"max":9.0,"lista":8.9,"multilista":false,"desvio":-0.023,"impacto":-176.04},{"produto":"RESFR. PEITO C/ OSSO PV CX 18 KG","linha":"Resfriados","vendas":21,"qtd":738.0,"fat":7415.82,"pmed":10.0485,"min":9.7,"max":10.5,"lista":9.1,"multilista":false,"desvio":0.104231,"impacto":699.99},{"produto":"CONG. MIÚDOS (CORACAO) PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":9,"qtd":220.0,"fat":7365.8,"pmed":33.4809,"min":31.99,"max":33.8,"lista":32.5,"multilista":false,"desvio":0.030182,"impacto":215.8},{"produto":"CONG. C/ OSSO COXA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":7,"qtd":1344.0,"fat":6864.0,"pmed":5.1071,"min":5.0,"max":6.0,"lista":8.5,"multilista":false,"desvio":-0.399165,"impacto":-4560.06},{"produto":"CONG. MIÚDOS (CORACAO) BDJ 20 X 600 G CX 12 KG","linha":"Congelados in natura","vendas":15,"qtd":192.0,"fat":6690.24,"pmed":34.845,"min":34.0,"max":36.0,"lista":33.0,"multilista":false,"desvio":0.055909,"impacto":354.24},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 1,1 KG CAIXA PP 9,9 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":40,"qtd":742.4999999999994,"fat":6641.71,"pmed":8.9451,"min":8.0,"max":9.99,"lista":8.0,"multilista":false,"desvio":0.118138,"impacto":701.74},{"produto":"RESFR. C/ OSSO COXINHA DA ASA BDJ PV CX 10,5 KG","linha":"Resfriados","vendas":35,"qtd":577.5,"fat":6396.6,"pmed":11.0764,"min":10.5,"max":11.3,"lista":10.3,"multilista":false,"desvio":0.075379,"impacto":448.37},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PCT 800 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":24,"qtd":518.4000000000002,"fat":5696.26,"pmed":10.9881,"min":10.9,"max":11.0,"lista":11.0,"multilista":false,"desvio":-0.001082,"impacto":-6.17},{"produto":"RESFR. MIÚDOS MOELA PCT 20 X 1 KG CX 20 KG","linha":"Resfriados","vendas":7,"qtd":540.0,"fat":4415.0,"pmed":8.1759,"min":8.0,"max":11.25,"lista":8.5,"multilista":false,"desvio":-0.038129,"impacto":-175.01},{"produto":"RESFR. C/ OSSO SOBRECOXA BDJ PV CX 13 KG","linha":"Resfriados","vendas":23,"qtd":377.0,"fat":4082.0,"pmed":10.8276,"min":9.5,"max":11.2,"lista":8.8,"multilista":false,"desvio":0.230409,"impacto":764.41},{"produto":"CONG. C/ OSSO PES GRADE A PCT 2 X 7,5 KG CX 15 KG G2","linha":"Congelados in natura","vendas":9,"qtd":390.0,"fat":3937.5,"pmed":10.0962,"min":9.5,"max":10.7,"lista":9.5,"multilista":false,"desvio":0.062758,"impacto":232.52},{"produto":"BATATA PALITO CONGELADA 9 X 9 MM PACOTE 400 G CAIXA PP 10 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":20,"qtd":350.0,"fat":3733.7,"pmed":10.6677,"min":9.75,"max":12.25,"lista":8.7,"multilista":false,"desvio":0.226172,"impacto":688.7},{"produto":"EMPANADO DE FRANGO CONG (CHICKEN) PCT 300G CAIXA PP 3 KG","linha":"Empanados de frango","vendas":56,"qtd":234.0,"fat":3707.07,"pmed":15.8422,"min":13.7,"max":16.0,"lista":13.7,"multilista":false,"desvio":0.156365,"impacto":501.27},{"produto":"CONG. FILE DE PEITO S/ PELE S/ SASSAMI IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":13,"qtd":190.0,"fat":3088.7,"pmed":16.2563,"min":15.5,"max":16.9,"lista":16.0,"multilista":false,"desvio":0.016019,"impacto":48.7},{"produto":"CONG. MIÚDOS FIGADO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":19,"qtd":600.0,"fat":3010.6,"pmed":5.0177,"min":4.75,"max":5.4,"lista":5.0,"multilista":false,"desvio":0.00354,"impacto":10.62},{"produto":"FILE DE TILAPIA CONGELADA IQF 800 G CX PP 10,4 (CANCAO ALIMENTOS)","linha":"Pescados","vendas":7,"qtd":72.8,"fat":2984.8,"pmed":41.0,"min":39.0,"max":41.5,"lista":38.5,"multilista":false,"desvio":0.064935,"impacto":182.0},{"produto":"RESFR. MIÚDOS CORACAO BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":7,"qtd":84.0,"fat":2688.0,"pmed":32.0,"min":32.0,"max":32.0,"lista":36.0,"multilista":false,"desvio":-0.111111,"impacto":-336.0},{"produto":"RESFR. ASA PV CX 20 KG","linha":"Resfriados","vendas":10,"qtd":240.0,"fat":2640.0,"pmed":11.0,"min":11.0,"max":11.0,"lista":11.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"SANDUICHE FUT BURGUER BACON C/ REQUEIJAO CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":15,"qtd":70.2,"fat":2533.06,"pmed":36.0835,"min":32.0,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.097912,"impacto":-274.94},{"produto":"EMPANADO DE TILAPIA CONG (SMALL FISH) PCT 1,5 KG CX 10,5 KG","linha":"Pescados","vendas":2,"qtd":283.5,"fat":2268.0,"pmed":8.0,"min":8.0,"max":8.0,"lista":15.0,"multilista":false,"desvio":-0.466667,"impacto":-1984.5},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO PCT 20 X 1 KG CX 20 KG","linha":"Congelados in natura","vendas":3,"qtd":140.0,"fat":2084.0,"pmed":14.8857,"min":14.5,"max":15.1,"lista":14.0,"multilista":false,"desvio":0.063264,"impacto":124.0},{"produto":"FILEZINHO DE FRANGO EMPANADO CONG PCT 1KG CAIXA PP 7 KG","linha":"Empanados de frango","vendas":9,"qtd":112.0,"fat":1998.29,"pmed":17.8419,"min":17.49,"max":18.0,"lista":18.0,"multilista":false,"desvio":-0.008783,"impacto":-17.71},{"produto":"POLENTA PALITO TRADICIONAL CONGELADA PACOTE 1 KG CX PP 10 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":12,"qtd":290.0,"fat":1955.2,"pmed":6.7421,"min":5.99,"max":7.0,"lista":7.0,"multilista":false,"desvio":-0.036843,"impacto":-74.79},{"produto":"LASANHA DE FRANGO CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":11,"qtd":136.8,"fat":1902.53,"pmed":13.9074,"min":12.15,"max":15.5,"lista":14.4,"multilista":false,"desvio":-0.034208,"impacto":-67.39},{"produto":"CONG. SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":9,"qtd":160.0,"fat":1771.0,"pmed":11.0687,"min":10.5,"max":11.5,"lista":11.1,"multilista":false,"desvio":-0.00282,"impacto":-5.01},{"produto":"CONG. S/ OSSO S/ PELE FILE DE PEITO BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":8,"qtd":96.0,"fat":1575.6,"pmed":16.4125,"min":15.4,"max":17.0,"lista":15.0,"multilista":false,"desvio":0.094167,"impacto":135.6},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (ISCAS DE TILAPIA) PCT 400 G CX PP 3,2 KG","linha":"Pescados","vendas":7,"qtd":28.8,"fat":1398.4,"pmed":48.5556,"min":45.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.079013,"impacto":102.4},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 11 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":6,"qtd":77.0,"fat":1386.0,"pmed":18.0,"min":18.0,"max":18.0,"lista":16.5,"multilista":false,"desvio":0.090909,"impacto":115.5},{"produto":"EMPANADO DE FRANGO (FUT CHICKEN) CONG PCT 300 G CX 3 KG","linha":"Empanados de frango","vendas":20,"qtd":66.0,"fat":1310.1,"pmed":19.85,"min":15.0,"max":23.3,"lista":15.0,"multilista":false,"desvio":0.323333,"impacto":320.1},{"produto":"MANDIOCA TOLETE CONGELADA PACOTE 1 KG CX PP 12 KG PROD CANCAO","linha":"Vegetais e acompanhamentos","vendas":9,"qtd":120.0,"fat":1264.56,"pmed":10.538,"min":9.9,"max":10.99,"lista":8.5,"multilista":false,"desvio":0.239765,"impacto":244.56},{"produto":"RESFR. (SOBRECOXAS) PCT CX PP 20 KG (CANCAO)","linha":"Resfriados","vendas":2,"qtd":140.0,"fat":1248.0,"pmed":8.9143,"min":8.8,"max":9.0,"lista":8.7,"multilista":false,"desvio":0.024632,"impacto":30.0},{"produto":"CONG. (COXAS INTERFOLHADO) CX PP 18 KG","linha":"Congelados in natura","vendas":2,"qtd":162.0,"fat":1198.8,"pmed":7.4,"min":7.4,"max":7.4,"lista":7.0,"multilista":false,"desvio":0.057143,"impacto":64.8},{"produto":"LASANHA QUATRO QUEIJOS CONG BDJ 600 G CX 7,2 KG","linha":"Pratos prontos","vendas":9,"qtd":79.20000000000002,"fat":1157.98,"pmed":14.6209,"min":14.15,"max":15.5,"lista":14.4,"multilista":false,"desvio":0.01534,"impacto":17.5},{"produto":"ANEIS DE CEBOLA EMPANADAS CONGELADA PACOTE 1,1 KG CX PP 6,6 KG (CANCAO ALIMENTOS)","linha":"Vegetais e acompanhamentos","vendas":8,"qtd":59.40000000000001,"fat":1069.73,"pmed":18.0089,"min":17.28,"max":18.5,"lista":16.5,"multilista":false,"desvio":0.091448,"impacto":89.63},{"produto":"BATATA NOISETTE CONG PCT 400 G CX 10 KG","linha":"Vegetais e acompanhamentos","vendas":7,"qtd":90.0,"fat":1014.9,"pmed":11.2767,"min":11.25,"max":11.49,"lista":8.0,"multilista":false,"desvio":0.409587,"impacto":294.9},{"produto":"CONG. PESCOCO S/ PELE C/ OSSO PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":5,"qtd":234.0,"fat":1001.52,"pmed":4.28,"min":3.99,"max":4.7,"lista":3.5,"multilista":false,"desvio":0.222857,"impacto":182.52},{"produto":"CONG. C/ OSSO COXINHA DA ASA BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":3,"qtd":96.0,"fat":990.0,"pmed":10.3125,"min":10.0,"max":12.2,"lista":10.5,"multilista":false,"desvio":-0.017857,"impacto":-18.0},{"produto":"SANDUICHE FUT BURGUER MAIONESE GRILL CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":8,"qtd":27.0,"fat":982.15,"pmed":36.376,"min":32.0,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.0906,"impacto":-97.85},{"produto":"BOLINHO DE TILAPIA CONG PCT 300 G CX 4,2 KG","linha":"Pescados","vendas":7,"qtd":29.4,"fat":970.2,"pmed":33.0,"min":33.0,"max":33.0,"lista":33.0,"multilista":false,"desvio":0.0,"impacto":0.0},{"produto":"SANDUICHE FUT BURGUER C/ MOLHO DE PICLES CONG PCT 18 X 150 G CX 2,7 KG","linha":"Pratos prontos","vendas":7,"qtd":24.3,"fat":874.31,"pmed":35.98,"min":32.0,"max":40.0,"lista":40.0,"multilista":false,"desvio":-0.1005,"impacto":-97.69},{"produto":"PEIXE TEMPERADO EMPANADO CONGELADO (FILE DE TILAPIA) PCT 600 G CX PP 6 KG","linha":"Pescados","vendas":2,"qtd":18.0,"fat":858.0,"pmed":47.6667,"min":47.0,"max":49.0,"lista":45.0,"multilista":false,"desvio":0.05926,"impacto":48.0},{"produto":"CMS FRANGO 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":300.0,"fat":780.0,"pmed":2.6,"min":2.6,"max":2.6,"lista":2.5,"multilista":false,"desvio":0.04,"impacto":30.0},{"produto":"CONG. FRANGO (S/ MIUDOS) PCT 1,750/1,850 KG CX PP 14,4 KG (CANCAO ALIMENTOS)","linha":"Congelados in natura","vendas":1,"qtd":72.0,"fat":727.2,"pmed":10.1,"min":10.1,"max":10.1,"lista":9.5,"multilista":false,"desvio":0.063158,"impacto":43.2},{"produto":"CONG. SAMBIQUIRA PCT 18 X 1 KG CX 18 KG","linha":"Congelados in natura","vendas":7,"qtd":180.0,"fat":723.6,"pmed":4.02,"min":4.0,"max":4.2,"lista":4.0,"multilista":false,"desvio":0.005,"impacto":3.6},{"produto":"COXINHA DA ASA EMPANADA TRADICIONAL PCT 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":3,"qtd":21.0,"fat":588.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-42.0},{"produto":"RESFR. MIÚDOS MOELA BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":5,"qtd":60.0,"fat":570.0,"pmed":9.5,"min":9.5,"max":9.5,"lista":11.0,"multilista":false,"desvio":-0.136364,"impacto":-90.0},{"produto":"CONG. FILE DE SOBRECOXA IQF PCT 10 X 1 KG CX 10 KG","linha":"Congelados in natura","vendas":2,"qtd":30.0,"fat":476.0,"pmed":15.8667,"min":15.8,"max":16.0,"lista":13.0,"multilista":false,"desvio":0.220515,"impacto":86.0},{"produto":"RESFR. C/ OSSO PES BDJ PV CX 7,5 KG","linha":"Resfriados","vendas":4,"qtd":45.0,"fat":450.0,"pmed":10.0,"min":10.0,"max":10.0,"lista":12.7,"multilista":false,"desvio":-0.212598,"impacto":-121.5},{"produto":"CONG. (COXA PACOTE IQF) CX PP 10 KG","linha":"Congelados in natura","vendas":3,"qtd":40.0,"fat":362.0,"pmed":9.05,"min":8.8,"max":9.3,"lista":9.2,"multilista":false,"desvio":-0.016304,"impacto":-6.0},{"produto":"RESFR. C/ OSSO S/ PELE PESCOCO BDJ 15 X 600 G CX 12 KG","linha":"Resfriados","vendas":4,"qtd":60.0,"fat":300.0,"pmed":5.0,"min":5.0,"max":5.0,"lista":6.7,"multilista":false,"desvio":-0.253731,"impacto":-102.0},{"produto":"RESFR. C/ OSSO SAMBIQUIRA BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":5,"qtd":60.0,"fat":300.0,"pmed":5.0,"min":5.0,"max":5.0,"lista":6.2,"multilista":false,"desvio":-0.193548,"impacto":-72.0},{"produto":"CONG. FRANGO (S/ MIUDOS) PCT 1,650/1,750 KG CX PP 13,6 KG (CANCAO ALIMENTOS)","linha":"Congelados in natura","vendas":2,"qtd":27.2,"fat":269.28,"pmed":9.9,"min":9.9,"max":9.9,"lista":9.5,"multilista":false,"desvio":0.042105,"impacto":10.88},{"produto":"RESFR. MIÚDOS FIGADO BDJ 20 X 600 G CX 12 KG","linha":"Resfriados","vendas":3,"qtd":36.0,"fat":234.0,"pmed":6.5,"min":6.5,"max":6.5,"lista":7.0,"multilista":false,"desvio":-0.071429,"impacto":-18.0},{"produto":"PAO DE QUEIJO TRADICIONAL CONGELADO PACOTE 300 G CX PP 9,6 KG (CANCAO)","linha":"Vegetais e acompanhamentos","vendas":2,"qtd":19.2,"fat":221.76,"pmed":11.55,"min":11.5,"max":11.6,"lista":11.0,"multilista":false,"desvio":0.05,"impacto":10.56},{"produto":"CONG. FILEZINHO SASSAMI S/ OSSO S/ PELE BDJ 12 X 1 KG CX 12 KG","linha":"Congelados in natura","vendas":1,"qtd":12.0,"fat":200.4,"pmed":16.7,"min":16.7,"max":16.7,"lista":15.0,"multilista":false,"desvio":0.113333,"impacto":20.4},{"produto":"COXINHA DA ASA EMPANADA APIMENTADA PTC 10 X 700 G CX 7 KG","linha":"Empanados de frango","vendas":1,"qtd":7.0,"fat":196.0,"pmed":28.0,"min":28.0,"max":28.0,"lista":30.0,"multilista":false,"desvio":-0.066667,"impacto":-14.0},{"produto":"CONG. GALINHA INTEIRA (CABECA PESCOCO MOELA E PES) CX PP 20 KG (MISTER FRANGO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":160.0,"pmed":8.0,"min":8.0,"max":8.0,"lista":5.6,"multilista":false,"desvio":0.428571,"impacto":48.0},{"produto":"CONG. (COXA E SOBRECOXA A PASSARINHO) PCT 10 KG CX PP 20 KG (CANCAO)","linha":"Congelados in natura","vendas":1,"qtd":20.0,"fat":156.0,"pmed":7.8,"min":7.8,"max":7.8,"lista":8.2,"multilista":false,"desvio":-0.04878,"impacto":-8.0},{"produto":"BOLINHO DE FRANGO FUT CHICKEN C/ RECHEIO CREMOSO DE QUEIJO CONG PTC 300 G CX 4,2 KG","linha":"Empanados de frango","vendas":1,"qtd":4.2,"fat":130.2,"pmed":31.0,"min":31.0,"max":31.0,"lista":30.0,"multilista":false,"desvio":0.033333,"impacto":4.2},{"produto":"RESFR. C/ OSSO COXA BDJ PV CX 11,1 KG","linha":"Resfriados","vendas":1,"qtd":11.1,"fat":94.35,"pmed":8.5,"min":8.5,"max":8.5,"lista":6.5,"multilista":false,"desvio":0.307692,"impacto":22.2}]}}};
const PI_ORDER = ITENS.periodos;
let piPer = PI_ORDER[PI_ORDER.length-1];
let piBusca = '', piLinha = 'todas', piOrd = 'fat', piDesc = true;

const PId = k => ITENS.dados[k];
const piBrl  = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const piBrl2 = n => 'R$ ' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const piNum  = (n,d=0) => n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const piK    = n => Math.abs(n)>=1e6 ? 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi'
                  : Math.abs(n)>=1e3 ? 'R$ '+(n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mil'
                  : piBrl(n);
const piPct  = (v,d=1) => (v>=0?'+':'−') + Math.abs(v*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}) + '%';
const piSeta = v => v>0 ? '↑' : v<0 ? '↓' : '→';

/* seta + sinal junto do valor: a cor nunca carrega sozinha o significado */
function piChip(v){
  if(v===null||v===undefined||!isFinite(v)) return '<span class="pi-chip flat">sem tabela</span>';
  const cls = Math.abs(v)<0.0005 ? 'flat' : (v>0 ? 'up' : 'down');
  return `<span class="pi-chip ${cls}">${piSeta(v)} ${piPct(v)}</span>`;
}
const piCurto = n => n.replace(/^(RESFR\.|CARNE\s+(CONGELADA|RESFRIADA)\s+DE\s+FRANGO)\s*/i,'')
                      .replace(/\s*\(CANCAO[^)]*\)/i,'').replace(/\s*(PCT|CX|BDJ)\s.*$/i,'').trim() || n;

const piLinhas = () => [...new Set(PI_ORDER.flatMap(k => PId(k).itens.map(i => i.linha)))].sort((a,b)=>a.localeCompare(b,'pt-BR'));

function piFiltrado(){
  const q = piBusca.trim().toLowerCase();
  const l = PId(piPer).itens.filter(i =>
    (piLinha === 'todas' || i.linha === piLinha) &&
    (!q || i.produto.toLowerCase().includes(q)));
  const chave = {
    produto:i=>i.produto, linha:i=>i.linha, vendas:i=>i.vendas, qtd:i=>i.qtd, fat:i=>i.fat,
    min:i=>i.min, pmed:i=>i.pmed, max:i=>i.max, lista:i=>i.lista, desvio:i=>i.desvio ?? 0
  }[piOrd] || (i=>i.fat);
  return l.slice().sort((a,b)=>{
    const x=chave(a), y=chave(b);
    const c = (typeof x === 'string') ? x.localeCompare(y,'pt-BR') : x-y;
    return piDesc ? -c : c;
  });
}
/* série de preço médio do produto ao longo dos períodos (null = sem venda) */
function piSerie(produto){
  return PI_ORDER.map(k => { const i = PId(k).itens.find(x => x.produto === produto); return i ? i.pmed : null; });
}
function piDeltaSerie(s){
  const v = s.filter(x => x !== null);
  return v.length < 2 ? null : v[v.length-1]/v[0] - 1;
}
function piSpark(s,w=96,h=24){
  const v = s.filter(x=>x!==null);
  if(v.length<2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const lo=Math.min(...v), hi=Math.max(...v), rg=(hi-lo)||1;
  const x=i=>3+i/(s.length-1)*(w-6), y=val=>h-4-(val-lo)/rg*(h-8);
  let d='',ini=false;
  s.forEach((val,i)=>{ if(val===null) return; d+=(ini?'L':'M')+x(i).toFixed(1)+' '+y(val).toFixed(1)+' '; ini=true; });
  const dots=s.map((val,i)=> val===null?'' :
    `<circle cx="${x(i).toFixed(1)}" cy="${y(val).toFixed(1)}" r="${i===s.length-1?2.6:1.6}"
      fill="var(--primary)" opacity="${i===s.length-1?1:.5}"/>`).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d.trim()}" fill="none" stroke="var(--primary)" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>${dots}</svg>`;
}

/* ---------- gráfico: preço médio geral por período ---------- */
function piChartLinha(){
  const W=720,H=190,L=50,R=18,T=18,B=34,iw=W-L-R,ih=H-T-B;
  const vals=PI_ORDER.map(k=>PId(k).pmed);
  const lo=Math.min(...vals)*0.985, hi=Math.max(...vals)*1.015;
  const x=i=>L+(PI_ORDER.length===1?iw/2:i/(PI_ORDER.length-1)*iw);
  const y=v=>T+ih-(v-lo)/((hi-lo)||1)*ih;
  const grid=[0,.25,.5,.75,1].map(f=>{const yy=T+ih*f,v=hi-(hi-lo)*f;
    return `<line class="g" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/>
            <text class="ax" x="${L-8}" y="${yy+3}" text-anchor="end">${piNum(v,2)}</text>`;}).join('');
  const path=vals.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
  const area=`${path} L ${x(vals.length-1).toFixed(1)} ${T+ih} L ${x(0).toFixed(1)} ${T+ih} Z`;
  const pts=vals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="${PI_ORDER[i]===piPer?6:4.5}"
      fill="${PI_ORDER[i]===piPer?'var(--primary)':'var(--card)'}" stroke="var(--primary)" stroke-width="2"/>
    <text class="vl" x="${i===0?x(i)+4:i===vals.length-1?x(i)-4:x(i)}" y="${y(v)-13}"
      text-anchor="${i===0?'start':i===vals.length-1?'end':'middle'}">${piNum(v,2)}</text>`).join('');
  const labs=PI_ORDER.map((k,i)=>`<text class="ax" x="${x(i)}" y="${H-10}" text-anchor="middle">${esc(PId(k).periodo.replace('/2026',''))}</text>`).join('');
  return `<svg class="pi-chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Preço médio geral por período, em reais por quilo">
    <defs><linearGradient id="piArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--primary)" stop-opacity=".18"/>
      <stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#piArea)"/>
    <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"/>${pts}${labs}</svg>`;
}

/* ---------- render ---------- */
function renderItem(){
  const host = document.getElementById('itemContent');
  if(!host) return;
  const d = PId(piPer);
  const i0 = PI_ORDER.indexOf(piPer);
  const ant = i0>0 ? PId(PI_ORDER[i0-1]) : null;
  const dl = (a,b) => (ant && b) ? (a/b-1) : null;
  const linhas = piFiltrado();
  const todos = d.itens;

  const fat = linhas.reduce((s,i)=>s+i.fat,0);
  const qtd = linhas.reduce((s,i)=>s+i.qtd,0);
  const ven = linhas.reduce((s,i)=>s+i.vendas,0);
  const base = linhas.reduce((s,i)=>s+i.lista*i.qtd,0);
  const vaz = linhas.filter(i=>i.pmed<i.lista).reduce((s,i)=>s+(i.lista-i.pmed)*i.qtd,0);
  const cap = linhas.filter(i=>i.pmed>i.lista).reduce((s,i)=>s+(i.pmed-i.lista)*i.qtd,0);
  const indice = base ? fat/base*100 : null;
  const pmed = qtd ? fat/qtd : 0;
  const recorte = piLinha === 'todas';

  const kpis = [
    {l:'Faturamento',u:'BRL',v:piK(fat),b:'var(--primary)',
     s:`${piNum(ven)} vendas · ${piNum(d.nclientes)} clientes`, d: recorte ? dl(d.fat, ant&&ant.fat) : null},
    {l:'Volume',u:'KG',v:piNum(qtd,0),sm:'kg',b:'#8a8f98',
     s:`${piNum(linhas.length)} de ${piNum(todos.length)} itens`, d: recorte ? dl(d.qtd, ant&&ant.qtd) : null},
    {l:'Preço médio',u:'R$/KG',v:piBrl2(pmed),b:'var(--primary)',
     s:'faturamento ÷ quantidade', d: recorte ? dl(d.pmed, ant&&ant.pmed) : null},
    {l:'Índice vs tabela',u:'%',v:indice===null?'—':piNum(indice,1),sm:indice===null?'':'%',
     b: indice!==null && indice>=100 ? 'var(--pi-pos)' : 'var(--pi-neg)',
     s: indice===null ? 'sem preço de lista'
        : (indice>=100 ? `${piNum(indice-100,1)}% acima da tabela` : `${piNum(100-indice,1)}% abaixo da tabela`),
     d: recorte && ant ? (d.indice/ant.indice-1) : null}
  ].map(c=>`<div class="pi-kpi" style="--b:${c.b}">
      <div class="t"><span class="l">${c.l}</span><span class="u">${c.u}</span></div>
      <div class="v">${c.v}${c.sm?`<small>${c.sm}</small>`:''}</div>
      <div class="s">${c.d!==null&&c.d!==undefined?piChip(c.d)+' ':''}<span>${c.s}</span></div></div>`).join('');

  const cols = [
    ['produto','Produto',''],['vendas','Vendas','r'],['qtd','Qtd (kg)','r'],['fat','Faturamento','r'],
    ['min','Mín','r'],['pmed','Médio','r'],['max','Máx','r'],['lista','Lista','r'],['desvio','vs Lista','r']
  ].map(([k,t,c])=>`<th class="${c}" data-o="${k}">${t}${piOrd===k?`<span class="arw">${piDesc?'▼':'▲'}</span>`:''}</th>`).join('');

  const corpo = linhas.length ? linhas.map(i=>`<tr>
      <td class="pi-prod">${esc(i.produto)}<span class="pi-tag">${esc(i.linha)}</span>${i.multilista?'<span class="pi-tag" title="mais de um preço de lista no período">2+ listas</span>':''}</td>
      <td class="r">${piNum(i.vendas)}</td><td class="r">${piNum(i.qtd,0)}</td>
      <td class="r">${piBrl(i.fat)}</td>
      <td class="r dim">${piNum(i.min,2)}</td><td class="r strong">${piNum(i.pmed,2)}</td>
      <td class="r dim">${piNum(i.max,2)}</td><td class="r dim">${piNum(i.lista,2)}</td>
      <td class="r">${piChip(i.desvio)}</td></tr>`).join('')
    : '<tr><td colspan="9" class="pi-empty">Nenhum produto encontrado com esse filtro.</td></tr>';

  /* barras: quem mais puxa o preço, para cima e para baixo */
  const abaixo = linhas.filter(i=>i.impacto<0).sort((a,b)=>a.impacto-b.impacto).slice(0,8);
  const acima  = linhas.filter(i=>i.impacto>0).sort((a,b)=>b.impacto-a.impacto).slice(0,8);
  const destaque = [...acima, ...abaixo.slice().reverse()];
  const maxAbs = Math.max(...destaque.map(i=>Math.abs(i.desvio||0)), 0.02);
  const barras = destaque.length ? destaque.map(i=>{
    const w=Math.abs(i.desvio)/maxAbs*48, pos=i.desvio>=0;
    return `<div class="pi-dv">
      <div class="n">${esc(piCurto(i.produto))}<small>${esc(i.linha)} · ${piNum(i.qtd,0)} kg · lista ${piNum(i.lista,2)}</small></div>
      <div class="pi-track"><div class="pi-fill" style="${pos?`left:50%;width:${w}%`:`right:50%;width:${w}%`};
        background:${pos?'var(--pi-pos)':'var(--pi-neg)'}"></div></div>
      <div class="v ${pos?'pos':'neg'}">${piSeta(i.desvio)} ${piPct(i.desvio)}<br>
        <small style="color:var(--muted);font-weight:400">${i.impacto>=0?'+':'−'}${piBrl(Math.abs(i.impacto))}</small></div></div>`;
  }).join('') : '<div class="pi-empty">Sem itens neste recorte.</div>';

  /* evolução por produto */
  const acum = new Map();
  PI_ORDER.forEach(k => PId(k).itens.forEach(i => {
    if(piLinha!=='todas' && i.linha!==piLinha) return;
    const q = piBusca.trim().toLowerCase();
    if(q && !i.produto.toLowerCase().includes(q)) return;
    const a = acum.get(i.produto) || {produto:i.produto, linha:i.linha, fat:0, qtd:0};
    a.fat+=i.fat; a.qtd+=i.qtd; acum.set(i.produto,a);
  }));
  const evo = [...acum.values()].sort((a,b)=>b.fat-a.fat).map(p=>{
    const s=piSerie(p.produto);
    const cels=s.map((v,i)=> v===null ? '<td class="r dim">—</td>'
      : `<td class="r${PI_ORDER[i]===piPer?' strong':''}">${piNum(v,2)}</td>`).join('');
    return `<tr><td class="pi-prod">${esc(p.produto)}<span class="pi-tag">${esc(p.linha)}</span></td>
      <td style="padding:5px 11px">${piSpark(s)}</td>${cels}
      <td class="r">${piChip(piDeltaSerie(s))}</td>
      <td class="r">${piNum(p.qtd,0)}</td><td class="r">${piBrl(p.fat)}</td></tr>`;
  }).join('');
  const totS=PI_ORDER.map(k=>PId(k).pmed);

  host.innerHTML = `
    <div class="pi-bar"><span class="pi-lbl">Período · preço por item</span>
      ${PI_ORDER.map(k=>`<button class="pi-pbtn${k===piPer?' on':''}" data-p="${k}">${esc(PId(k).periodo.replace('/2026',''))}</button>`).join('')}
    </div>

    <div class="pi-ctrl">
      <div class="pi-seg">
        ${[['todas','Todas as linhas'], ...piLinhas().map(l=>[l,l])].map(([k,t])=>{
          const n = k==='todas' ? todos.length : todos.filter(i=>i.linha===k).length;
          return `<button class="pi-sbtn${piLinha===k?' on':''}" data-c="${esc(k)}"${n?'':' disabled style="opacity:.45;cursor:default"'}>${esc(t)} <span style="opacity:.6;font-weight:500">${n}</span></button>`;
        }).join('')}
      </div>
      <input type="text" id="piQ" placeholder="Filtrar produto…" value="${esc(piBusca)}" aria-label="Filtrar produto">
    </div>

    <div class="pi-kpis">${kpis}</div>

    <div class="pi-card">
      <div class="pi-head"><div><span class="over">Evolução · ${PI_ORDER.length} períodos</span>
        <h3>Preço médio geral de setembro</h3>
        <p>Todos os itens, faturamento ÷ quantidade. O ponto cheio marca o período selecionado.</p></div>
        <span class="pi-badge">R$/kg</span></div>
      <div class="pi-body">${piChartLinha()}</div>
    </div>

    <div class="pi-card">
      <div class="pi-head"><div><span class="over">${esc(d.periodo)}</span>
        <h3>Preço médio por item</h3>
        <p>Mínimo, médio e máximo praticados e o desvio contra o preço de tabela.
           Clique no cabeçalho para ordenar.</p></div>
        <span class="pi-badge">${linhas.length} itens</span></div>
      <div class="pi-scroll"><table>
        <thead><tr>${cols}</tr></thead><tbody>${corpo}</tbody>
        ${linhas.length?`<tfoot><tr><td>TOTAL</td><td class="r">${piNum(ven)}</td>
          <td class="r">${piNum(qtd,0)}</td><td class="r">${piBrl(fat)}</td><td class="r"></td>
          <td class="r">${piNum(pmed,2)}</td><td class="r"></td><td class="r"></td>
          <td class="r">${indice===null?'':piChip(indice/100-1)}</td></tr></tfoot>`:''}
      </table></div>
      <div class="pi-note">Preço médio = faturamento ÷ quantidade (média ponderada). Mín e Máx são os preços
        unitários extremos praticados no período.</div>
    </div>

    <div class="pi-card">
      <div class="pi-head"><div><span class="over">Aderência à tabela</span>
        <h3>Quem mais puxa o preço para cima e para baixo</h3>
        <p>Barras à direita da linha central indicam preço acima da tabela; à esquerda, abaixo.
           O valor em reais é a diferença contra a tabela multiplicada pelo volume.</p></div>
        <span class="pi-badge">${indice===null?'—':piNum(indice,1)+'% da tabela'}</span></div>
      <div class="pi-body">
        <div class="pi-dv" style="border-bottom:2px solid var(--line)">
          <div class="n"><b>Abaixo da tabela</b><small>valor que deixou de entrar</small></div>
          <div class="v neg">↓ ${piBrl(vaz)}</div></div>
        <div class="pi-dv" style="border-bottom:2px solid var(--line)">
          <div class="n"><b>Acima da tabela</b><small>valor capturado a mais</small></div>
          <div class="v pos">↑ ${piBrl(cap)}</div></div>
        ${barras}
      </div>
    </div>

    <div class="pi-card">
      <div class="pi-head"><div><span class="over">Setembro 2026</span>
        <h3>Preço médio por produto, período a período</h3>
        <p>A variação compara o primeiro e o último período com venda. Traço indica item sem venda no período.</p></div>
        <span class="pi-badge">${acum.size} produtos</span></div>
      <div class="pi-scroll"><table style="min-width:940px">
        <thead><tr><th>Produto</th><th>Trajetória</th>
          ${PI_ORDER.map(k=>`<th class="r">${esc(PId(k).periodo.replace('/2026',''))}</th>`).join('')}
          <th class="r">Variação</th><th class="r">Qtd total</th><th class="r">Fat. total</th></tr></thead>
        <tbody>${evo || '<tr><td colspan="10" class="pi-empty">Nenhum produto neste recorte.</td></tr>'}</tbody>
        <tfoot><tr><td>TOTAL GERAL (todos os itens)</td><td>${piSpark(totS)}</td>
          ${totS.map(v=>`<td class="r">${piNum(v,2)}</td>`).join('')}
          <td class="r">${piChip(totS[totS.length-1]/totS[0]-1)}</td>
          <td class="r">${piNum(PI_ORDER.reduce((s,k)=>s+PId(k).qtd,0),0)}</td>
          <td class="r">${piBrl(PI_ORDER.reduce((s,k)=>s+PId(k).fat,0))}</td></tr></tfoot>
      </table></div>
      <div class="pi-note">Fonte: Relatório de Vendas Apucarana, 01/09 a 29/09/2026, gerado em 29/09 às 17:20.
        Oportunidades fechadas e ganhas.</div>
    </div>`;

  /* interações */
  host.querySelectorAll('.pi-pbtn').forEach(b => b.onclick = () => {
    piPer = b.dataset.p;
    try{ localStorage.setItem('painelItemPeriodo', piPer); }catch(e){}
    renderItem();
  });
  host.querySelectorAll('.pi-sbtn').forEach(b => b.onclick = () => {
    piLinha = b.dataset.c;
    try{ localStorage.setItem('painelItemLinha', piLinha); }catch(e){}
    renderItem();
  });
  const q = document.getElementById('piQ');
  if(q) q.addEventListener('input', e => {
    piBusca = e.target.value; renderItem();
    const n = document.getElementById('piQ');
    if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  });
  host.querySelectorAll('thead th[data-o]').forEach(th => th.onclick = () => {
    const k = th.dataset.o;
    if(piOrd === k) piDesc = !piDesc; else { piOrd = k; piDesc = (k !== 'produto'); }
    renderItem();
  });
}

try{
  const p = localStorage.getItem('painelItemPeriodo'); if(p && ITENS.dados[p]) piPer = p;
  const l = localStorage.getItem('painelItemLinha');   if(l) piLinha = l;
}catch(e){}

/* ---------- instalação da aba (não depende de alteração no index.html) ---------- */
function piInstall(){
  if(!document.getElementById('piStyle')){
    const st = document.createElement('style');
    st.id = 'piStyle';
    st.textContent = "/* ============ ABA PRE\u00c7O POR ITEM ============\n   Tokens pr\u00f3prios, escopados, para n\u00e3o interferir no resto do painel.\n   Par divergente validado para daltonismo (deutan \u0394E 15,4 claro / 9,1 escuro).\n   O sinal e a seta acompanham todo valor: a cor nunca \u00e9 o \u00fanico indicador. */\n#view-item{--pi-pos:#169b74;--pi-neg:#b32d25;\n  --pi-pos-soft:#e6f5ef;--pi-neg-soft:#fbeae8;--pi-grid:#ece8e2}\n:root[data-theme=\"dark\"] #view-item{--pi-pos:#27a87e;--pi-neg:#c94540;\n  --pi-pos-soft:rgba(39,168,126,.14);--pi-neg-soft:rgba(201,69,64,.16);--pi-grid:#25282e}\n\n#view-item .pi-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}\n#view-item .pi-kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;\n  padding:14px 15px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden}\n#view-item .pi-kpi::before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:var(--b,var(--primary))}\n#view-item .pi-kpi .t{display:flex;justify-content:space-between;align-items:center;gap:8px}\n#view-item .pi-kpi .l{font-size:9.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}\n#view-item .pi-kpi .u{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);opacity:.7}\n#view-item .pi-kpi .v{font-family:'Space Grotesk','Inter',sans-serif;font-size:24px;font-weight:700;\n  letter-spacing:-.7px;margin-top:8px;line-height:1.05}\n#view-item .pi-kpi .v small{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:0;margin-left:3px}\n#view-item .pi-kpi .s{margin-top:7px;font-size:11.5px;color:var(--muted)}\n\n#view-item .pi-chip{display:inline-flex;align-items:center;gap:3px;border-radius:7px;padding:2px 6px;\n  font:600 11px/1.35 'Inter',sans-serif;white-space:nowrap}\n#view-item .pi-chip.up{background:var(--pi-pos-soft);color:var(--pi-pos)}\n#view-item .pi-chip.down{background:var(--pi-neg-soft);color:var(--pi-neg)}\n#view-item .pi-chip.flat{background:var(--track-bg,rgba(0,0,0,.05));color:var(--muted)}\n\n#view-item .pi-card{background:var(--card);border:1px solid var(--line);border-radius:16px;\n  box-shadow:var(--shadow-sm);margin-bottom:16px;overflow:hidden}\n#view-item .pi-head{padding:15px 17px 12px;border-bottom:1px solid var(--line);display:flex;\n  align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}\n#view-item .pi-head > div:first-child{flex:1 1 240px;min-width:0}\n#view-item .pi-head .over{font-size:9.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--primary)}\n#view-item .pi-head h3{font-family:'Space Grotesk','Inter',sans-serif;font-size:15.5px;font-weight:600;\n  letter-spacing:-.2px;margin-top:4px}\n#view-item .pi-head p{font-size:12px;color:var(--muted);margin-top:4px}\n#view-item .pi-badge{font-size:10.5px;font-weight:600;color:var(--muted);\n  background:var(--track-bg,rgba(0,0,0,.05));border-radius:8px;padding:5px 10px;white-space:nowrap}\n#view-item .pi-body{padding:15px 17px}\n\n#view-item .pi-ctrl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:13px}\n#view-item .pi-ctrl input,#view-item .pi-ctrl select{border:1px solid var(--line);background:var(--card);\n  color:var(--ink);border-radius:11px;padding:9px 12px;font:400 13px 'Inter',sans-serif;min-width:180px}\n#view-item .pi-seg{display:flex;gap:6px;flex-wrap:wrap}\n#view-item .pi-sbtn{border:1px solid var(--line);background:var(--card);color:var(--muted);\n  border-radius:11px;padding:9px 13px;font:600 12.5px/1 'Inter',sans-serif;cursor:pointer;transition:.15s}\n#view-item .pi-sbtn:hover{color:var(--ink)}\n#view-item .pi-sbtn.on{background:var(--primary);border-color:var(--primary);color:#fff}\n\n#view-item .pi-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}\n#view-item table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:760px}\n#view-item thead th{background:var(--thead-bg,rgba(0,0,0,.03));color:var(--muted);font-size:9.5px;\n  font-weight:600;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:10px 11px;\n  border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}\n#view-item thead th.r{text-align:right}\n#view-item thead th:hover{color:var(--ink)}\n#view-item thead th .arw{opacity:.45;font-size:8px;margin-left:3px}\n#view-item tbody td{padding:9px 11px;border-bottom:1px solid var(--pi-grid);vertical-align:middle}\n#view-item tbody td.r{text-align:right;font-variant-numeric:tabular-nums}\n#view-item tbody tr:hover{background:var(--row-hover,rgba(0,0,0,.02))}\n#view-item .pi-prod{font-weight:500;line-height:1.35;min-width:240px;max-width:360px}\n#view-item .pi-tag{display:inline-block;font-size:9.5px;font-weight:600;letter-spacing:.06em;\n  text-transform:uppercase;color:var(--muted);background:var(--track-bg,rgba(0,0,0,.05));\n  border-radius:6px;padding:2px 6px;margin-top:3px}\n#view-item tfoot td{padding:10px 11px;border-top:2px solid var(--line);font-weight:600;\n  background:var(--thead-bg,rgba(0,0,0,.03));font-variant-numeric:tabular-nums}\n#view-item tfoot td.r{text-align:right}\n#view-item .strong{font-weight:600}\n#view-item .dim{color:var(--muted)}\n#view-item .pos{color:var(--pi-pos)}\n#view-item .neg{color:var(--pi-neg)}\n\n#view-item .pi-dv{display:grid;grid-template-columns:minmax(150px,1.4fr) 1fr auto;gap:12px;\n  align-items:center;padding:9px 0;border-bottom:1px solid var(--pi-grid)}\n#view-item .pi-dv:last-child{border-bottom:0}\n#view-item .pi-dv .n{font-size:12.5px;line-height:1.35}\n#view-item .pi-dv .n small{display:block;color:var(--muted);font-size:10.5px;opacity:.85}\n#view-item .pi-track{position:relative;height:22px}\n#view-item .pi-track::before{content:'';position:absolute;left:50%;top:0;bottom:0;width:1px;\n  background:var(--muted);opacity:.45}\n#view-item .pi-fill{position:absolute;top:4px;height:14px;border-radius:4px}\n#view-item .pi-dv .v{font:600 12px/1 'Inter',sans-serif;font-variant-numeric:tabular-nums;\n  white-space:nowrap;min-width:70px;text-align:right}\n\n#view-item .pi-note{font-size:11.5px;color:var(--muted);padding:11px 17px;border-top:1px solid var(--line);\n  background:var(--thead-bg,rgba(0,0,0,.03))}\n#view-item .pi-empty{padding:24px;text-align:center;color:var(--muted);font-size:13px}\n\n@media (max-width:900px){#view-item .pi-kpis{grid-template-columns:1fr 1fr}}\n@media (max-width:560px){\n  #view-item .pi-dv{grid-template-columns:1fr auto;gap:8px}\n  #view-item .pi-track{grid-column:1/-1}\n  #view-item .pi-ctrl input,#view-item .pi-ctrl select{min-width:0;width:100%}\n  #view-item .pi-kpi .v{font-size:20px}\n}\n\n#view-item .pi-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:13px}\n#view-item .pi-lbl{font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;\n  color:var(--muted);margin-right:2px}\n#view-item .pi-pbtn{border:1px solid var(--line);background:var(--card);color:var(--muted);\n  border-radius:11px;padding:8px 13px;font:600 12.5px/1 'Inter',sans-serif;cursor:pointer;transition:.15s}\n#view-item .pi-pbtn:hover{color:var(--ink)}\n#view-item .pi-pbtn.on{background:var(--primary);border-color:var(--primary);color:#fff}\n#view-item .pi-chart{width:100%;display:block;overflow:visible}\n#view-item .pi-chart .g{stroke:var(--pi-grid);stroke-width:1}\n#view-item .pi-chart .ax{fill:var(--muted);font-size:10px;font-family:'Inter',sans-serif}\n#view-item .pi-chart .vl{fill:var(--ink);font-size:10.5px;font-weight:600;\n  font-family:'Inter',sans-serif;font-variant-numeric:tabular-nums}\n#view-item .pi-tag + .pi-tag{margin-left:4px}";
    document.head.appendChild(st);
  }

  let sec = document.getElementById('view-item');
  if(!sec){
    sec = document.createElement('section');
    sec.id = 'view-item';
    sec.style.display = 'none';
    sec.innerHTML = '<div id="itemContent"></div>';
    const ref = document.getElementById('view-prod') || document.getElementById('view-vvv');
    if(ref && ref.parentNode) ref.parentNode.insertBefore(sec, ref.nextSibling);
    else document.body.appendChild(sec);
  }

  let btn = document.querySelector('.tab[data-t="item"]');
  if(!btn){
    const tabs = document.querySelectorAll('.tab');
    if(!tabs.length) return;
    const ref = document.querySelector('.tab[data-t="prod"]') || tabs[tabs.length-1];
    btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.t = 'item';
    btn.textContent = 'Preço por item';
    ref.parentNode.insertBefore(btn, ref.nextSibling);
  }

  /* o handler original já rodou antes desta linha, então o botão novo precisa do seu próprio */
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    ['view-intel','view-strategy','view-ai','view-geral','view-vend','view-prod',
     'view-cli','view-comp','view-vvv'].forEach(id => {
       const el = document.getElementById(id);
       if(el) el.style.display = 'none';
     });
    sec.style.display = '';
    sec.classList.remove('view-anim'); void sec.offsetWidth; sec.classList.add('view-anim');
    renderItem();
  };
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', piInstall);
else piInstall();
