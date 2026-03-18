// Mijn Week – Service Worker
// SW_VERSION en SW_DATE worden automatisch bijgewerkt door GitHub Actions bij elke merge.
const SW_VERSION = 'v1.0.18';
const SW_DATE    = '17 mrt 2026';

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
  // version.json dynamisch serveren vanuit SW_VERSION – geen apart bestand nodig
  if (new URL(e.request.url).pathname.endsWith('/version.json')) {
    e.respondWith(new Response(JSON.stringify({v: SW_VERSION, date: SW_DATE}), {
      headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}
    }));
    return;
  }
  // HTML-navigaties, app-bestanden: altijd vers van server halen
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
