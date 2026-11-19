# Aurore Task

Les listes de tâches partagées de la ferme, sur le téléphone et l'ordinateur : sept listes de jours, des listes libres, les astreintes, des encarts RDV / P1 / P2, des personnes en couleur. Elle remplace Google Tasks en gardant ses gestes.

**Adresse :** celle du site Cloudflare de ce dépôt (voir `docs/ETAT_DU_PROJET.md`). L'ancienne adresse `https://liste-recolte.pages.dev/taches` y renvoie.

**Installer sur l'écran d'accueil** : Chrome sur Android, menu ⋮ puis « Ajouter à l'écran d'accueil » (ou « Installer l'appli ») ; Safari sur iPhone, Partager puis « Sur l'écran d'accueil ». Icône verte « Aurore Task ».

**Connexion** : les mêmes comptes que le Cumul (`francois`, `aurore`, `martin`). On se connecte une fois par appareil.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'appli (sans bibliothèque). |
| `config.js` | Adresse de la base Firebase (commune avec le Cumul). |
| `cle-web.js` | Clé web de Firebase, collée par la ferme (jamais par un agent). |
| `sw.js` | Mode hors ligne. |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil. |
| `polices/` | Polices de la charte (licence OFL). |
| `referentiel/taches-depart.json` | Réglages de départ propres à une ferme (nom, personnes, encarts), lus tant que la base n'a pas les siens. |
| `tests/` | Essais automatiques (navigateur simulé, faux Firebase) : `node tests/taches.cjs`, `node tests/taches-encarts.cjs`, `node tests/taches-astreintes.cjs`. |
| `docs/` | Cahier des charges, registres, pas-à-pas. |

Pour une autre ferme : remplacer `referentiel/taches-depart.json`, `config.js` et `cle-web.js`, et publier la règle `taches` de sa base (modèle dans le dépôt `liste-recolte`, `docs/regles-base/fermees.json`).

Licence : PolyForm Noncommercial 1.0.0 (`LICENSE`).
