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
  const activeSec = document.getElementById('view-'+t);
  if(activeSec){ activeSec.classList.remove('view-anim'); void activeSec.offsetWidth; activeSec.classList.add('view-anim'); }
  if(t==='intel') renderIntel();
  if(t==='strategy') renderStrategy();
  if(t==='ai') renderAI();
  if(t==='geral') renderGeral();
  if(t==='vvv') { renderVvv(); }
  if(t==='cli') { rebuildSelCli(); renderABC(); }
  if(t==='comp') { renderComp(); }
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
