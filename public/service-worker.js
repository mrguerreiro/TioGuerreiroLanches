const CACHE_NAME = 'tio-guerreiro-v8';
const ARQUIVOS_ESSENCIAIS = [
  './',
  'index.html',
  'css/style.css',
  'js/api.js',
  'js/app.js',
  'manifest.json',
  'img/logo.jpeg',
  'icons/icon-192.png',
  'icons/icon-512.png'
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
  if (url.pathname.includes('/api/') || url.pathname.includes('/admin') || url.pathname.includes('admin.js')) {
    return;
  }

  // HTML/CSS/JS: tenta a rede primeiro (para nunca servir versão desatualizada) e usa o cache só como reserva offline.
  const ehImagem = evento.request.destination === 'image';
  if (ehImagem) {
    evento.respondWith(
      caches.match(evento.request).then((respostaCache) => {
        return respostaCache || fetch(evento.request).then((respostaRede) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(evento.request, respostaRede.clone());
            return respostaRede;
          });
        });
      })
    );
    return;
  }

  evento.respondWith(
    fetch(evento.request)
      .then((respostaRede) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(evento.request, respostaRede.clone());
          return respostaRede;
        });
      })
      .catch(() => caches.match(evento.request))
  );
});


// Notificações de andamento do pedido enviadas pelo servidor.
self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (err) {
    dados = { texto: evento.data ? evento.data.text() : '' };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo || 'Tio Guerreiro Lanches', {
      body: dados.texto || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/favicon-32.png',
      tag: dados.tag,
      renotify: !!dados.tag,
      data: { url: dados.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || './', self.registration.scope).href;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((janela) => janela.url === destino);
      return aberta ? aberta.focus() : self.clients.openWindow(destino);
    })
  );
});
