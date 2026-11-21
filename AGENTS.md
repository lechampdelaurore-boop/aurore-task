# Consignes pour les agents IA

**Farm tasks** (nom affiché depuis le 20/11/2026, anciennement « Aurore Task » ; l'adresse `aurore-task.pages.dev`, le dépôt `aurore-task` et le projet Cloudflare gardent l'ancien nom) : les listes de tâches partagées de la ferme (remplace Google Tasks), du Champ de l'Aurore (GAEC, Tronget, Allier), utilisées par François, Aurore et Martin. Appli web statique, hébergée sur Cloudflare Pages (déploie depuis `main`), à son adresse à elle. Cahier des charges : `docs/CAHIER_DES_CHARGES_AURORE_TASK.md`.

Née le 18/11/2026 dans le dépôt `liste-recolte` (le Cumul), sortie dans ce dépôt le 19/11/2026. **Règle de François : un outil, un dépôt, une adresse.** Ne jamais ajouter un autre outil ici, ni remettre Aurore Task dans un autre dépôt.

## Avant de commencer

1. Lire ce fichier, puis la section « Où on en est » de `docs/ETAT_DU_PROJET.md`.
2. Lire `README.md` et le reste des registres seulement pour ce que la tâche demande.
3. Le dépôt fait foi. Si le dépôt et ce que dit François se contredisent, le lui signaler au lieu de trancher seul.

## Registres (à tenir à jour dans la même PR que le changement)

| Fichier | Contenu |
|---|---|
| `docs/ETAT_DU_PROJET.md` | Où on en est, ce qui est vérifié ou non |
| `docs/ROADMAP.md` | Étapes, avec modèle et effort, et celles réservées à François |
| `docs/DECISIONS.md` | Décisions validées par François, avec la date |
| `CHANGELOG.md` | Historique des changements |

## Façon de travailler

- Écrire à François en français, en le vouvoyant, en phrases simples, sans jargon non expliqué. Il dicte souvent à la voix : un mot bizarre est sans doute une erreur de dictée, lui demander plutôt que deviner.
- Toute modification passe par une PR, registres compris. Jamais d'écriture directe sur `main`. Une PR par sujet.
- Mesurer avant d'écrire (lancer les tests, noter leur état), vérifier après. Ce qui n'a pas été vérifié est dit « non vérifié ».
- Ne jamais voir, saisir, écrire ni consigner une clé, un jeton, un mot de passe ou l'adresse électronique de François. **Ne jamais ouvrir ni afficher `cle-web.js`** (clé web collée par François) ni le diff d'une PR qui le change : les tests servent leur propre version de ce fichier.
- Ne jamais réduire l'outil au seul cas de cette ferme : rien de propre à une ferme dans le code (prénoms, couleurs, noms des encarts, nom affiché : réglages de la base, sinon `referentiel/taches-depart.json`).
- Ne jamais donner l'adresse `*.github.io` de ce compte : elle ouvre l'appli d'un autre membre de la famille.

## La base (commune avec le Cumul)

- Même base Firebase et mêmes comptes que le Cumul (dépôt `liste-recolte`). Aurore Task n'écrit que sous `taches/`, jamais ailleurs. **Les règles de la base sont dans `liste-recolte` (`docs/regles-base/fermees.json`)** : une règle se change par une PR là-bas, puis seul François la publie dans la console, ou Claude sur son autorisation écrite, après une sauvegarde de la base.
- Profils qui ouvrent les tâches : `ferme` et `equipe`. Connexion gardée sur l'appareil sous `taches.compte`.
- Un seul flux en direct (le Cumul ouvert dans le même navigateur en garde quatre vers la même base : cinq sur les six permis).
- Les tâches sont des données réelles et partagées : jamais de suppression ni de modification en masse sans le « vas-y » de François.

## Modifier l'appli

- Tout tient dans `index.html`, sans bibliothèque ni étape de construction. Garder ça.
- Garder les gestes de Google Tasks (cahier des charges, partie 3) : si une nouveauté les gêne, les gestes gagnent.
- Charte **d'origine** du module d'irrigation (demande de François du 18/11) ; trois polices hébergées dans `polices/` (licence OFL), jamais chargées d'un autre site.
- Après toute modification de `index.html`, `config.js`, des icônes ou de `referentiel/` : changer `CACHE` dans `sw.js`.
- Lancer `node tests/taches.cjs`, `node tests/taches-encarts.cjs` `node tests/taches-astreintes.cjs`, `node tests/menu-tache.cjs`, `node tests/rappel.cjs`, `node tests/agenda.cjs`, `node tests/encarts-listes.cjs` et `node tests/couleur-sous-taches.cjs` avant d'ouvrir la PR et coller la sortie réelle dans la PR. Un contrôle omis l'est avec sa raison.
- Textes en français, phrases courtes, gros éléments tactiles.
- Rappel du matin (étape 45, 19/11/2026) : réglages `taches/rappels/<personne>`, lecture `taches/lu/<personne>/<date>`, téléphones `taches/abonnements/<personne>/<n°>`. Envoi par `functions/rappel/[[chemin]].js` (un seul fichier, sans dépendance ni import), réveillé par `cloudflare/horloge-rappel.js` ; compte `rappel` (profil `rappel`) ; secret `RAPPEL_MDP` saisi par François dans Cloudflare, jamais dans le dépôt ni dans un fichier `.dev.vars`. Les clés d'envoi sont sous `rappel/vapid` dans la base : ne jamais les lire, les afficher ni les recopier. Mise en service : `docs/PAS_A_PAS_RAPPEL.md`.

- Google Agenda (étape 36D, 20/11/2026) : `functions/agenda/[[chemin]].js` (un seul fichier, sans dépendance) lit l'adresse secrète iCal du secret Cloudflare `AGENDA_ICAL`, saisi par François seul, jamais dans le dépôt ni dans un fichier `.dev.vars`, jamais affiché ni renvoyé par le programme. L'appli range (`rangerAgenda`) ; mémoire `taches/agenda/<clé>`. Test : `node tests/agenda.cjs`. Mise en service : `docs/PAS_A_PAS_AGENDA.md`.

## Accord de François nécessaire

Tout ce qui touche les vraies données en masse, un service payant ou l'hébergeur (Cloudflare ou autre), l'ouverture d'un accès à d'autres personnes, et toute étape que `docs/ROADMAP.md` lui réserve.
