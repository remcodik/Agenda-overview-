// Mijn Week – Service Worker v0.8.5
// Strategie: altijd netwerk (network-only), nooit browser-cache.
// Update dit bestand bij elke release → browser detecteert de wijziging
// en laadt direct de nieuwe versie van de app.
const SW_VERSION = 'v0.8.5';

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

self.addEventListener('fetch', e => {
  // Alleen HTML-pagina's van dezelfde origin: altijd vers van server halen
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        new Response('<h2>Geen verbinding</h2><p>Controleer je internet en probeer opnieuw.</p>',
          { headers: { 'Content-Type': 'text/html' } })
      )
    );
  }
  // Overige requests (ICS-fetches e.d.) normaal laten gaan
});
