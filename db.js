"use strict";

/* =========================================================
   ACCÈS À LA BASE DE DONNÉES
   Tout le désordre d'IndexedDB est enfermé dans ce fichier.
   Le reste de l'application n'utilise que les quatre
   fonctions du bas : ajouter, lister, supprimer, titres.
   ========================================================= */

const NOM_BASE = "suivi-depenses";
const VERSION_BASE = 1;
const MAGASIN = "depenses";

let basePromesse = null;

/* Ouvre la base, ou renvoie l'ouverture déjà en cours.
   IndexedDB fonctionne par événements ; on l'emballe dans
   une promesse pour pouvoir écrire "await" ensuite. */
function ouvrirBase() {
  if (basePromesse) return basePromesse;

  basePromesse = new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM_BASE, VERSION_BASE);

    /* Appelé une seule fois : à la toute première ouverture,
       ou si on augmente VERSION_BASE plus tard. C'est ici que
       la structure de la base se crée. */
    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains(MAGASIN)) {
        const magasin = base.createObjectStore(MAGASIN, {
          keyPath: "id",
          autoIncrement: true,
        });
        magasin.createIndex("par_date", "date");
      }
    };

    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });

  return basePromesse;
}

/* Convertit une requête IndexedDB en promesse. */
function enPromesse(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

/* Ouvre une transaction et renvoie le magasin de données.
   "readonly" pour lire, "readwrite" pour écrire. */
async function magasinDepenses(mode) {
  const base = await ouvrirBase();
  return base.transaction(MAGASIN, mode).objectStore(MAGASIN);
}

/* =========================================================
   LES QUATRE FONCTIONS PUBLIQUES
   ========================================================= */

/* Enregistre une dépense. L'identifiant est attribué
   automatiquement et renvoyé. */
async function ajouterDepense(depense) {
  const magasin = await magasinDepenses("readwrite");
  return enPromesse(magasin.add(depense));
}

/* Renvoie les dépenses, de la plus récente à la plus ancienne.
   limite = 0 signifie "toutes". */
async function listerDepenses(limite = 0) {
  const magasin = await magasinDepenses("readonly");
  const toutes = await enPromesse(magasin.getAll());

  /* Les dates sont stockées au format ISO, donc l'ordre
     alphabétique est aussi l'ordre chronologique. */
  toutes.sort((a, b) => b.date.localeCompare(a.date));

  return limite > 0 ? toutes.slice(0, limite) : toutes;
}

/* Supprime une dépense par son identifiant. */
async function supprimerDepense(id) {
  const magasin = await magasinDepenses("readwrite");
  return enPromesse(magasin.delete(id));
}

/* Liste sans doublons des titres déjà utilisés,
   pour alimenter l'autocomplétion des dépenses obligatoires. */
async function titresConnus() {
  const toutes = await listerDepenses();
  const titres = toutes
    .filter((d) => d.est_obligatoire && d.titre)
    .map((d) => d.titre);
  return [...new Set(titres)];
}

/* Remplace la totalité du contenu de la base par les dépenses
   fournies. Tout se joue dans une seule transaction : si une
   seule ligne échoue, rien n'est modifié. C'est ce qui évite
   de se retrouver avec une base à moitié importée. */
async function remplacerTout(depenses) {
  const base = await ouvrirBase();
  return new Promise((resoudre, rejeter) => {
    const transaction = base.transaction(MAGASIN, "readwrite");
    const magasin = transaction.objectStore(MAGASIN);

    magasin.clear();
    depenses.forEach((d) => magasin.put(d));

    transaction.oncomplete = () => resoudre(depenses.length);
    transaction.onerror = () => rejeter(transaction.error);
  });
}
