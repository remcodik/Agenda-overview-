// Mijn Week – Service Worker v1.0.7
// Strategie: altijd netwerk (network-only), nooit browser-cache.
// Verander SW_VERSION bij elke release → browser detecteert de wijziging
// → installeert direct → app herlaadt automatisch met nieuwe versie.
const SW_VERSION = 'v1.0.10';

self.addEventListener('install', () => {
  self.skipWaiting(); // activeer direct, wacht niet op oud tabblad
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k)))) // verwijder alle oude caches
      .then(() => self.clients.claim()) // neem direct controle over alle tabbladen
  );
});

// Reageer op postMessage vanuit de pagina (extra skip-waiting trigger)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // HTML-navigaties, app-bestanden én version.json: altijd vers van server halen
  if (e.request.mode === 'navigate' ||
      e.request.url.match(/\.(html|js|css|json)(\?.*)?$/)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        e.request.mode === 'navigate'
          ? new Response('<h2>Geen verbinding</h2><p>Controleer je internet en probeer opnieuw.</p>',
              { headers: { 'Content-Type': 'text/html' } })
          : fetch(e.request)
      )
    );
    return;
  }
  // Overige requests (ICS-fetches e.d.) normaal laten gaan
});
