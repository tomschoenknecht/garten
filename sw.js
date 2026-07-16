/* Service Worker – Mein Gemüsegarten (PWA)
   Strategie:
   - Navigation (HTML): network-first mit Offline-Fallback auf den Cache.
     Du deployst oft → online bekommst du IMMER die neueste Version,
     offline springt der zuletzt gesehene Stand ein.
   - Cross-Origin (Supabase Auth/Daten, CDN, Unsplash): komplett durchgelassen,
     nie vom SW abgefangen → keine veralteten Daten, keine Auth-Probleme.
   - Same-Origin-Assets (Icons, Manifest, Katalog-/Garten-Fotos): cache-first,
     im Hintergrund aktualisiert (stale-while-revalidate).
*/
const CACHE = 'garten-v1';
// Nur Assets precachen, die in JEDER Umgebung unter gleichem relativen Pfad
// existieren (lokal heißt die HTML gartenapp.html, deployed index.html –
// die HTML kommt deshalb erst zur Laufzeit beim ersten Navigate in den Cache).
const ASSETS = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                         // nur GET behandeln
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // cross-origin durchlassen

  // Navigation → network-first, Offline-Fallback auf gecachte HTML.
  // NUR die App selbst wird als Offline-Kopie gespeichert. Andere Seiten unter diesem
  // Pfad (z. B. die Landing Page unter /info/) dürfen die App-Kopie NICHT überschreiben –
  // sonst zeigt die installierte App offline plötzlich die Werbeseite.
  if (req.mode === 'navigate') {
    const p = url.pathname.replace(/\/+$/, '/');
    const istApp = p.endsWith('/') || p.endsWith('/index.html');
    const istAppRoot = istApp && !/\/(info|willkommen)\//.test(url.pathname);
    e.respondWith(
      fetch(req)
        .then(res => {
          if (istAppRoot && res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => istAppRoot
          ? caches.match('./index.html').then(r => r || caches.match('./'))
          : Response.error())
    );
    return;
  }

  // Same-Origin-Assets → cache-first + Hintergrund-Aktualisierung
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
