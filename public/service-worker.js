const CACHE_NAME = 'tio-guerreiro-v2';
const ARQUIVOS_ESSENCIAIS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  '/img/logo.jpeg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => Promise.all(
      chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Nunca cachear chamadas de API nem o painel administrativo: sempre buscar versão atual.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/js/admin.js')) {
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      return respostaCache || fetch(evento.request).then((respostaRede) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(evento.request, respostaRede.clone());
          return respostaRede;
        });
      }).catch(() => respostaCache);
    })
  );
});
