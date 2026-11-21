// Hors ligne : la page passe d'abord par le réseau, sinon la dernière copie gardée.
// La base Firebase (autre domaine) n'est jamais mise en cache.
// Après toute modification de index.html, config.js, des icônes ou du fichier de départ : changer CACHE.
var CACHE = 'aurore-task-v20';
// Clé web reprise du site du Cumul (voir index.html) : gardée aussi pour l'ouverture hors ligne.
var CLE_SOURCE = 'https://liste-recolte.pages.dev/cle-web.js';
var SHELL = ['./', './index.html', './config.js', './cle-web.js', './manifest.webmanifest', './icons/taches.svg', './icons/taches-192.png', './referentiel/taches-depart.json', './polices/bricolage-grotesque.woff2', './polices/dm-sans.woff2', './polices/open-sans.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).then(function () { return c.add(new Request(CLE_SOURCE, { mode: 'no-cors' })).catch(function () {}); }); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method === 'GET' && req.url === CLE_SOURCE) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(CLE_SOURCE, copy); }); return res;
    }).catch(function () { return caches.match(CLE_SOURCE); }));
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(agenda|rappel)\//.test(url.pathname)) return; // programmes du site : jamais gardés (rendez-vous, état)
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined); });
  }));
});

// Rappel du matin (étape 45B) : la notification envoyée par le programme du site (functions/rappel/[[chemin]].js).
// Contenu chiffré par le programme : {titre, texte, tag, url}. Sur Android, bouton « J'ai lu ma liste » sous la
// notification ; sur iPhone (pas de boutons), toucher la notification ouvre l'appli, qui montre le bandeau.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texte: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Farm tasks', {
    body: d.texte || 'La liste du jour vous attend.',
    tag: d.tag || 'rappel', renotify: true, requireInteraction: true,
    icon: 'icons/taches-192.png', badge: 'icons/taches-192.png', lang: 'fr',
    data: { url: d.url || './?rappel=1' },
    actions: d.essai ? [] : [{ action: 'lu', title: 'J\'ai lu ma liste' }]
  }));
});
self.addEventListener('notificationclick', function (e) {
  var n = e.notification, url = new URL((n.data && n.data.url) || './?rappel=1', self.registration.scope).href;
  n.close();
  if (e.action === 'lu') {
    // Sans ouvrir l'appli : le programme du site note « lu » pour la personne de cet abonnement.
    e.waitUntil(self.registration.pushManager.getSubscription().then(function (s) {
      if (!s) return;
      return fetch('rappel/lu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) });
    }).catch(function () {}));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) { if (ws[i].url.indexOf(self.registration.scope) === 0 && 'focus' in ws[i]) { ws[i].navigate(url).catch(function () {}); return ws[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
