# État du projet : Aurore Task

## Où on en est

*Au 19 novembre 2026. Source : lecture du dépôt et demandes de François du 18/11 et du 19/11.*

- **Aurore Task sort du dépôt du Cumul (19/11)**, sur la règle de François (« un outil, un dépôt, une adresse ») et son « vas-y ». Cause : l'appli Cumul installée couvrait tout le site `liste-recolte.pages.dev`, `/taches` compris ; sur le téléphone de François, Android rangeait Aurore Task dedans (logo du Cumul, l'icône du Cumul qui rouvrait Aurore Task). Ce dépôt reprend le code tel qu'il était le 18/11 au soir (étapes 36A, 36B, 36C). Même base et mêmes comptes : les tâches déjà saisies ne bougent pas. Vérifié : les trois tests (`tests/taches.cjs`, `tests/taches-encarts.cjs`, `tests/taches-astreintes.cjs`), sur le faux Firebase. **À faire par François** : créer le site Cloudflare relié à ce dépôt et coller la clé web (`docs/PAS_A_PAS_SITE.md`), puis, sur chaque téléphone, supprimer les deux icônes (Cumul et Aurore Task), réinstaller le Cumul depuis https://liste-recolte.pages.dev et Aurore Task depuis la nouvelle adresse, et s'y reconnecter. **Non vérifié** : le site Cloudflare, la connexion depuis la nouvelle adresse, les vrais téléphones.
- **Ensuite** : le rappel du matin (étapes 45A et 45B de `docs/ROADMAP.md`), demandé par François le 19/11.

## Ce qui existe (fait dans le dépôt liste-recolte, 18/11)

- **Socle (36A)** : sept listes « jour » et Astreintes, listes libres, tâches et sous-tâches sur plusieurs niveaux, séparateur, cocher avec animation et « Annuler », « Faites récemment » 7 jours, glisser au doigt et à la souris, balayage entre listes, colonnes sur l'ordinateur, hors ligne, partage en direct.
- **Encarts, personnes, couleur du texte, verrou, Réglages (36B)**.
- **Astreintes (36C)** : jours, zone, heure, « En pause », « Répartir les astreintes » à la main.
- **Compte de Martin (36E)** : profil `equipe`, tâches seulement.
- Reste du cahier : **36D** (Google Agenda), qui attend l'adresse secrète de l'agenda, à saisir par François dans Cloudflare.

**Non vérifié** depuis le début : les vrais téléphones.
