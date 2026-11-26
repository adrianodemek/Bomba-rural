// Service worker do Bomba Rural: entrega a arte (assets/ e lib/) guardada no aparelho pela tela
// "Baixando o jogo" (src/ui/Download.js). O resto (index.html, src/, lista.json) vem sempre da rede.
const ART = 'bomba-rural-arte';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const rel = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  // ?v=… é a própria tela de download buscando a versão nova: vai direto à rede.
  if (!/^(assets|lib)\//.test(rel) || rel === 'assets/lista.json' || url.searchParams.has('v')) return;
  const key = new URL(rel, self.registration.scope).href;
  e.respondWith(
    caches.open(ART)
      .then((c) => c.match(key))
      .then((hit) => hit || fetch(req))
      .catch(() => fetch(req)),
  );
});
