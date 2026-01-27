const CACHE_NAME = 'ajuste-estoque-cache-v4'; // Versão incrementada para a correção
console.log(`Service Worker: Carregado. Pronto para instalar o cache: ${CACHE_NAME}`);

const urlsToCache = [
  './ajustaEstoqueApp.html',
  './js/apiConfig.js', // CORRIGIDO: Agora aponta para o arquivo local
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Evento de instalação recebido.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`Service Worker: Cache ${CACHE_NAME} aberto. Adicionando URLs ao cache.`);
        return cache.addAll(urlsToCache)
          .then(() => {
            console.log('Service Worker: Todos os arquivos foram cacheados com sucesso.');
          })
          .catch(error => {
            console.error('Service Worker: Falha ao adicionar arquivos ao cache:', error);
          });
      })
      .catch(error => {
        console.error('Service Worker: Falha ao abrir o cache:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Evento de ativação recebido.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`Service Worker: Deletando cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Limpeza de caches antigos concluída. Ativado com sucesso.');
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
