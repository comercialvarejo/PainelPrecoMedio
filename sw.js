/* ------------------------------------------------------------------
   Service worker do Painel de Preço Médio — Apucarana
   Permite instalar como aplicativo e usar offline.

   >>> Ao publicar uma nova versão, altere SW_VERSION abaixo. <<<
------------------------------------------------------------------- */

const SW_VERSION = 'v2';
const CACHE = `painel-preco-medio-${SW_VERSION}`;

/* Arquivos que compõem o aplicativo (baixados na instalação). */
const PRECACHE = [
  './',
  './index.html',
  './painel_preco_medio_apucarana.html',
  './assets/app.js',
  './data/alldb.json',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

/* Biblioteca externa usada na aba "Gestão 360" (importação de Excel). */
const CDN_ALLOWED = ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];

/* ---------- instalação ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll falha por inteiro se um item falhar; aqui cada item é independente
    await Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' }))));
  })());
});

/* ---------- ativação: limpa versões antigas ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('painel-preco-medio-') && k !== CACHE)
          .map(k => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* ---------- permite atualizar sem fechar o app ---------- */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- estratégias de rede ---------- */

// Rede primeiro, cache como reserva (dados e páginas: sempre o mais recente possível)
async function networkFirst(request, preloadPromise) {
  const cache = await caches.open(CACHE);
  try {
    const preload = preloadPromise ? await preloadPromise : null;
    const fresh = preload || await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request) || await cache.match('./index.html');
    if (cached) return cached;
    throw err;
  }
}

// Cache primeiro, atualizando em segundo plano (ícones, script, manifest)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || network || fetch(request);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navegação (abrir o app): rede primeiro, offline cai no index.html do cache
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, event.preloadResponse));
    return;
  }

  if (sameOrigin) {
    // Base de dados: sempre tenta a versão mais recente
    if (url.pathname.endsWith('/data/alldb.json')) {
      event.respondWith(networkFirst(req));
      return;
    }
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // CDN da biblioteca de planilhas: guarda uma cópia para uso offline
  if (CDN_ALLOWED.some(u => req.url.startsWith(u))) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
