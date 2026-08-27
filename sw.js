/* =========================================================
   SERVICE WORKER
   Il met les fichiers de l'application en cache pour qu'elle
   démarre sans réseau. Il ne touche jamais aux données :
   celles-ci vivent dans IndexedDB, pas ici.

   IMPORTANT : à chaque modification d'un fichier du projet,
   incrémenter VERSION ci-dessous. Sinon le téléphone continuera
   d'afficher l'ancienne version, indéfiniment.
   ========================================================= */

const VERSION = "v6";
const CACHE = "depenses-" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  "./style.css",
  "./db.js",
  "./app.js",
  "./manifest.json",
  "./icone-192.png",
  "./icone-512.png",
];

/* Installation : on télécharge et on range tous les fichiers. */
self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS))
  );
  self.skipWaiting();
});

/* Activation : on supprime les caches des versions précédentes. */
self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom))
      )
    )
  );
  self.clients.claim();
});

/* Interception des requêtes : on sert d'abord le cache,
   et on ne va sur le réseau que si le fichier en est absent.
   C'est ce qui permet un démarrage instantané et hors ligne. */
self.addEventListener("fetch", (evenement) => {
  if (evenement.request.method !== "GET") return;

  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => {
      return reponse || fetch(evenement.request);
    })
  );
});
