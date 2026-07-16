/* Alt-Service-Worker unter /garten/ – meldet sich selbst ab.

   Historie: Bis Juli 2026 lag die App unter /garten/ und registrierte hier einen
   Service Worker mit dem Cache 'garten-v1'. Seit dem Umzug liegt die App unter
   /garten/app/ (mit eigenem SW und eigenem Cache), und /garten/ ist die Landing Page.

   Ohne diese Datei würden alte Registrierungen weiterhin /garten/ kontrollieren und
   im Offline-Fall die alte, gecachte App statt der Landing Page ausliefern. Dieser
   SW räumt den alten Cache weg, meldet sich ab und lädt offene Seiten einmal neu.
   Danach läuft /garten/ ganz ohne Service Worker.

   Kein fetch-Handler: Alle Anfragen gehen unangetastet ans Netz.
*/
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      // Nur den alten App-Cache entfernen – der neue Cache der App unter /garten/app/
      // ('garten-app-v1') bleibt unangetastet.
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k === 'garten-v1').map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch (err) {
      // Abmelden darf nie blockieren
    }
  })());
});
