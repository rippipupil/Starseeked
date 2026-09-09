const CACHE_NAME = 'starseeked-shell-v6';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

// Antes esto era "cache-first": si un archivo ya estaba guardado, se
// servía siempre esa copia y nunca se volvía a comprobar si había una
// versión nueva en el servidor, así que una actualización de la app podía
// quedarse invisible indefinidamente en un dispositivo que ya la hubiera
// abierto antes. Ahora se intenta primero la red (para tener siempre el
// código más reciente) y solo se usa la copia guardada si no hay
// conexión, para que la app se pueda seguir abriendo sin internet.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
