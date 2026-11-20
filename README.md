# Farm tasks

*Anciennement « Aurore Task » (renommée le 20/11/2026 ; l'adresse et le dépôt gardent l'ancien nom).*

Les listes de tâches partagées de la ferme, sur le téléphone et l'ordinateur : sept listes de jours, des listes libres, les astreintes, des encarts RDV / P1 / P2, des personnes en couleur. Elle remplace Google Tasks en gardant ses gestes.

**Adresse :** celle du site Cloudflare de ce dépôt (voir `docs/ETAT_DU_PROJET.md`). L'ancienne adresse `https://liste-recolte.pages.dev/taches` y renvoie.

**Installer sur l'écran d'accueil** : Chrome sur Android, menu ⋮ puis « Ajouter à l'écran d'accueil » (ou « Installer l'appli ») ; Safari sur iPhone, Partager puis « Sur l'écran d'accueil ». Icône verte « Farm tasks ».

**Rappel du matin** : Réglages → « Rappel du matin ». Chacun choisit son heure et ses jours ; à l'heure dite, la liste du jour arrive en notification et revient tant que « J'ai lu ma liste » n'est pas touché. Sur le téléphone : « Recevoir sur ce téléphone ». Sur iPhone, ajouter d'abord Farm tasks à l'écran d'accueil.

**Connexion** : les mêmes comptes que le Cumul (`francois`, `aurore`, `martin`). On se connecte une fois par appareil.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'appli (sans bibliothèque). |
| `config.js` | Adresse de la base Firebase (commune avec le Cumul). |
| `cle-web.js` | Clé web de Firebase, collée par la ferme (jamais par un agent). Vide ici : la page et le programme du rappel reprennent celle du site du Cumul (`https://liste-recolte.pages.dev/cle-web.js`, même base). |
| `sw.js` | Mode hors ligne. |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil. |
| `polices/` | Polices de la charte (licence OFL). |
| `referentiel/taches-depart.json` | Réglages de départ propres à une ferme (nom, personnes, encarts), lus tant que la base n'a pas les siens. |
| `functions/rappel/` | Programme du rappel du matin (notifications), servi sous `/rappel/…`. |
| `cloudflare/horloge-rappel.js` | Horloge Cloudflare qui réveille ce programme toutes les 5 minutes. |
| `functions/agenda/` | Lecture de Google Agenda (adresse secrète iCal, réglage `AGENDA_ICAL`), servie sous `/agenda/…`. |
| `tests/` | Essais automatiques (navigateur simulé, faux Firebase) : `node tests/taches.cjs`, `node tests/taches-encarts.cjs`, `node tests/taches-astreintes.cjs`, `node tests/rappel.cjs`, `node tests/agenda.cjs`. |
| `docs/` | Cahier des charges, registres, pas-à-pas. |

Pour une autre ferme : remplacer `referentiel/taches-depart.json`, `config.js` et `cle-web.js`, et publier la règle `taches` de sa base (modèle dans le dépôt `liste-recolte`, `docs/regles-base/fermees.json`).

Licence : PolyForm Noncommercial 1.0.0 (`LICENSE`).
