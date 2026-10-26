// Ahorrómetro — service worker
// La app vive 100% en tu navegador (localStorage); el SW solo garantiza que
// el HTML y sus recursos carguen sin conexión. Sin backend, sin analytics.
const CACHE = "ahorrometro-v2";
const ASSETS = [
  "./ahorrometro.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(()=>{}))
      .then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

// Network-first: si hay red, serví lo fresco y actualizá la copia; sin red, la copia.
self.addEventListener("fetch", e=>{
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        if(res && res.status === 200){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(()=> caches.match(e.request).then(c => c || Response.error()))
  );
});