"use strict";

/* =========================================================
   1. LES ÉLÉMENTS DE LA PAGE
   ========================================================= */
const champMontant = document.getElementById("montant");
const champTitre = document.getElementById("titre");
const champNote = document.getElementById("note");
const blocNonObligatoire = document.getElementById("champs-non-obligatoire");
const blocObligatoire = document.getElementById("champs-obligatoire");
const boutonDate = document.getElementById("date-affichee");
const champDate = document.getElementById("date-modif");
const boutonEnregistrer = document.getElementById("enregistrer");
const zoneMessage = document.getElementById("message");
const listeDepenses = document.getElementById("liste-depenses");
const listeTitres = document.getElementById("titres-connus");
const boutonExporter = document.getElementById("exporter");
const boutonImporter = document.getElementById("importer");
const champFichier = document.getElementById("fichier-import");

/* Numéro de version du format de sauvegarde. Il sera utile
   le jour où le modèle de données changera : on saura lire
   les anciens fichiers au lieu de les refuser. */
const FORMAT_SAUVEGARDE = 1;

/* =========================================================
   2. L'ÉTAT DE LA SAISIE EN COURS
   Une seule source de vérité : tout ce que l'utilisateur
   a choisi est ici, et nulle part ailleurs.
   ========================================================= */
const etat = {
  date: new Date(),
  type: "non_obligatoire",
  quoi: null,
  pour_qui: null,
};

/* Libellés lisibles, lus directement dans le HTML.
   Renommer un bouton suffit : rien à changer ici. */
const LIBELLES = {};
document.querySelectorAll(".choix").forEach((b) => {
  LIBELLES[b.dataset.value] = b.textContent.trim();
});

/* =========================================================
   3. LA DATE
   ========================================================= */
function formaterDate(d) {
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const estAujourdhui = d.toDateString() === new Date().toDateString();
  if (estAujourdhui) return "aujourd'hui, " + heure;
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return jour + ", " + heure;
}

/* Format exigé par <input type="datetime-local"> : 2026-08-26T13:42
   Ne jamais utiliser toISOString() ici : elle renvoie l'heure UTC
   et décalerait la saisie d'une ou deux heures. */
function versValeurInput(d) {
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" + deuxChiffres(d.getMonth() + 1) +
    "-" + deuxChiffres(d.getDate()) +
    "T" + deuxChiffres(d.getHours()) +
    ":" + deuxChiffres(d.getMinutes())
  );
}

function afficherDate() {
  boutonDate.textContent = formaterDate(etat.date);
}

boutonDate.addEventListener("click", () => {
  champDate.value = versValeurInput(etat.date);
  boutonDate.hidden = true;
  champDate.hidden = false;
  champDate.focus();
});

function fermerChampDate() {
  if (champDate.value) etat.date = new Date(champDate.value);
  champDate.hidden = true;
  boutonDate.hidden = false;
  afficherDate();
}

champDate.addEventListener("change", fermerChampDate);
champDate.addEventListener("blur", fermerChampDate);

/* =========================================================
   4. LES BOUTONS DE CHOIX
   Un seul bouton actif par groupe (data-groupe).
   ========================================================= */
document.querySelectorAll(".choix").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const groupe = bouton.dataset.groupe;

    document
      .querySelectorAll('.choix[data-groupe="' + groupe + '"]')
      .forEach((autre) => autre.setAttribute("aria-pressed", "false"));

    bouton.setAttribute("aria-pressed", "true");
    etat[groupe] = bouton.dataset.value;

    if (groupe === "type") appliquerType();
    effacerMessage();
  });
});

function appliquerType() {
  const estObligatoire = etat.type === "obligatoire";
  blocObligatoire.hidden = !estObligatoire;
  blocNonObligatoire.hidden = estObligatoire;
}

/* =========================================================
   5. MESSAGES ET MISES EN FORME
   ========================================================= */
function afficherMessage(texte, succes = false) {
  zoneMessage.textContent = texte;
  zoneMessage.classList.toggle("ok", succes);
}

function effacerMessage() {
  afficherMessage("");
}

function formaterMontant(n) {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

/* Neutralise le HTML contenu dans un texte saisi par
   l'utilisateur, avant de l'injecter dans la page. */
function echapper(texte) {
  const noeud = document.createElement("span");
  noeud.textContent = texte;
  return noeud.innerHTML;
}

function libelle(valeur) {
  return LIBELLES[valeur] || valeur;
}

function decrire(depense) {
  if (depense.est_obligatoire) return depense.titre;
  return libelle(depense.quoi) + " · " + libelle(depense.pour_qui);
}

/* =========================================================
   6. LECTURE DU MONTANT
   Renvoie un nombre, ou null si la saisie est inutilisable.
   ========================================================= */
function lireMontant() {
  const brut = champMontant.value.trim().replace(",", ".");
  const valeur = parseFloat(brut);
  if (!isFinite(valeur) || valeur <= 0) return null;
  return Math.round(valeur * 100) / 100;
}

/* =========================================================
   7. ENREGISTREMENT
   ========================================================= */
boutonEnregistrer.addEventListener("click", async () => {
  const montant = lireMontant();
  if (montant === null) {
    afficherMessage("Montant manquant ou invalide.");
    champMontant.focus();
    return;
  }

  const depense = {
    date: etat.date.toISOString(),
    montant: montant,
    est_obligatoire: etat.type === "obligatoire",
    titre: null,
    quoi: null,
    pour_qui: null,
    note: champNote.value.trim() || null,
  };

  if (depense.est_obligatoire) {
    const titre = champTitre.value.trim();
    if (!titre) {
      afficherMessage("Titre manquant.");
      champTitre.focus();
      return;
    }
    depense.titre = titre;
  } else {
    if (!etat.quoi) {
      afficherMessage("Choisis une catégorie dans « Quoi ».");
      return;
    }
    if (!etat.pour_qui) {
      afficherMessage("Choisis « Pour qui ».");
      return;
    }
    depense.quoi = etat.quoi;
    depense.pour_qui = etat.pour_qui;
  }

  try {
    await ajouterDepense(depense);
    reinitialiser();
    await rafraichirListe();
    await rafraichirTitres();
    afficherMessage("Dépense enregistrée.", true);
  } catch (erreur) {
    console.error(erreur);
    afficherMessage("Échec de l'enregistrement. Réessaie.");
  }
});

/* =========================================================
   8. REMISE À ZÉRO APRÈS ENREGISTREMENT
   Le type (obligatoire ou non) est volontairement conservé :
   on saisit souvent plusieurs dépenses de même nature à la suite.
   ========================================================= */
function reinitialiser() {
  champMontant.value = "";
  champTitre.value = "";
  champNote.value = "";

  etat.quoi = null;
  etat.pour_qui = null;
  etat.date = new Date();

  document
    .querySelectorAll('.choix[data-groupe="quoi"], .choix[data-groupe="pour_qui"]')
    .forEach((b) => b.setAttribute("aria-pressed", "false"));

  afficherDate();
}

/* =========================================================
   9. LISTE DES DERNIÈRES DÉPENSES
   ========================================================= */
async function rafraichirListe() {
  const dernieres = await listerDepenses(10);
  listeDepenses.innerHTML = "";

  if (dernieres.length === 0) {
    listeDepenses.innerHTML = '<li class="vide">Aucune dépense enregistrée.</li>';
    return;
  }

  dernieres.forEach((d) => {
    const ligne = document.createElement("li");
    ligne.className = "ligne";
    ligne.innerHTML =
      '<div class="ligne-texte">' +
      '<span class="ligne-titre">' + echapper(decrire(d)) + "</span>" +
      '<span class="ligne-date">' + formaterDate(new Date(d.date)) + "</span>" +
      "</div>" +
      '<span class="ligne-montant">' + formaterMontant(d.montant) + "</span>" +
      '<button type="button" class="supprimer" data-id="' + d.id +
      '" aria-label="Supprimer">&times;</button>';
    listeDepenses.appendChild(ligne);
  });
}

/* Un seul gestionnaire pour toute la liste : les boutons de
   suppression sont recréés à chaque rafraîchissement, on écoute
   donc le conteneur, qui lui ne bouge jamais. */
listeDepenses.addEventListener("click", async (evenement) => {
  const bouton = evenement.target.closest(".supprimer");
  if (!bouton) return;

  if (!confirm("Supprimer cette dépense ?")) return;

  await supprimerDepense(Number(bouton.dataset.id));
  await rafraichirListe();
  await rafraichirTitres();
  afficherMessage("Dépense supprimée.", true);
});

/* =========================================================
   10. AUTOCOMPLÉTION DES TITRES OBLIGATOIRES
   ========================================================= */
async function rafraichirTitres() {
  const titres = await titresConnus();
  listeTitres.innerHTML = "";
  titres.forEach((t) => {
    const option = document.createElement("option");
    option.value = t;
    listeTitres.appendChild(option);
  });
}

/* =========================================================
   11. EXPORT
   ========================================================= */
function nomDuJour() {
  const d = new Date();
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + deuxChiffres(d.getMonth() + 1) + "-" + deuxChiffres(d.getDate());
}

boutonExporter.addEventListener("click", async () => {
  try {
    const depenses = await listerDepenses();
    if (depenses.length === 0) {
      afficherMessage("Aucune dépense à exporter.");
      return;
    }

    const sauvegarde = {
      format: FORMAT_SAUVEGARDE,
      exporte_le: new Date().toISOString(),
      depenses: depenses,
    };

    /* On fabrique un fichier en mémoire, puis on simule un clic
       sur un lien de téléchargement pointant vers lui. */
    const fichier = new Blob([JSON.stringify(sauvegarde, null, 2)], {
      type: "application/json",
    });
    const adresse = URL.createObjectURL(fichier);

    const lien = document.createElement("a");
    lien.href = adresse;
    lien.download = "depenses-" + nomDuJour() + ".json";
    lien.click();

    URL.revokeObjectURL(adresse);
    afficherMessage(depenses.length + " dépenses exportées.", true);
  } catch (erreur) {
    console.error(erreur);
    afficherMessage("Échec de l'export.");
  }
});

/* =========================================================
   12. IMPORT
   ========================================================= */

/* Refuse tout fichier qui ne ressemble pas à une sauvegarde.
   Mieux vaut un import refusé qu'une base corrompue. */
function validerSauvegarde(donnees) {
  if (!donnees || !Array.isArray(donnees.depenses)) {
    throw new Error("Structure inattendue");
  }

  donnees.depenses.forEach((d) => {
    const dateValide = typeof d.date === "string" && !isNaN(new Date(d.date));
    const montantValide = typeof d.montant === "number" && isFinite(d.montant);
    if (!dateValide || !montantValide || typeof d.est_obligatoire !== "boolean") {
      throw new Error("Dépense invalide dans le fichier");
    }
  });

  return donnees.depenses;
}

boutonImporter.addEventListener("click", () => champFichier.click());

champFichier.addEventListener("change", async () => {
  const fichier = champFichier.files[0];
  if (!fichier) return;

  try {
    const depenses = validerSauvegarde(JSON.parse(await fichier.text()));

    const actuelles = await listerDepenses();
    const avertissement =
      "Importer " + depenses.length + " dépenses ?\n\n" +
      "Les " + actuelles.length + " dépenses actuelles seront intégralement remplacées.";
    if (!confirm(avertissement)) return;

    await remplacerTout(depenses);
    await rafraichirListe();
    await rafraichirTitres();
    afficherMessage(depenses.length + " dépenses importées.", true);
  } catch (erreur) {
    console.error(erreur);
    afficherMessage("Fichier illisible ou invalide. Rien n'a été modifié.");
  } finally {
    /* Vider le champ permet de réimporter le même fichier
       deux fois de suite : sans ça, l'événement ne repart pas. */
    champFichier.value = "";
  }
});

/* =========================================================
   13. DÉMARRAGE
   ========================================================= */
async function demarrer() {
  /* Demande au navigateur de ne pas effacer les données en cas
     de manque de place. Ce n'est pas une garantie : l'export
     de sauvegarde reste indispensable. */
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist();
  }

  /* Enregistre le service worker, qui rend l'application
     installable et utilisable hors ligne. Un échec n'est pas
     bloquant : l'application fonctionne quand même. */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((erreur) => {
      console.warn("Service worker non enregistré :", erreur);
    });
  }

  afficherDate();
  appliquerType();

  try {
    await rafraichirListe();
    await rafraichirTitres();
  } catch (erreur) {
    console.error(erreur);
    afficherMessage("Base de données inaccessible. La page doit être ouverte en http, pas en file.");
  }
}

demarrer();
