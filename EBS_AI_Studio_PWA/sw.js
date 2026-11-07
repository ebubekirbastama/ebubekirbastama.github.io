/* EBS AI Studio Pro — installable application shell. */
const VERSION = 'ebs-studio-static-v9' ;
const SHELL = new URL('./', self.registration.scope);
const CACHE = VERSION + '-shell';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    SHELL.href,
    new URL('manifest.webmanifest', SHELL).href,
    new URL('main.js', SHELL).href,
    new URL('ffmpeg-worker.js', SHELL).href,
    new URL('demucs-worker.js', SHELL).href,
    new URL('style.css', SHELL).href,
    new URL('icons/icon-192.png', SHELL).href,
    new URL('icons/icon-512.png', SHELL).href
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('ebs-studio-pwa-') || key.startsWith('ebs-studio-static-')) && key !== CACHE).map(key => caches.delete(key)))),self.clients.claim()]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  // Do not store user media, model weights, or large WASM binaries.
  if (/\.(?:wasm|ort|gz|gzipped|mp4|mov|avi|mkv|webm|wav|mp3)$/i.test(url.pathname) || url.pathname.includes('/demucs/')) return;
  if(request.mode === 'navigate'){
    event.respondWith(fetch(request).then(response => {
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(SHELL.href,copy)));}
      return response;
    }).catch(async () => (await caches.match(SHELL.href)) || Response.error()));
    return;
  }
  if (!/\.(?:js|css|png|svg|webmanifest|ico)$/i.test(url.pathname))return;
  event.respondWith(fetch(request).then(response => {
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,copy)));}
    return response;
  }).catch(async () => (await caches.match(request)) || Response.error()));
});
