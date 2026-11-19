# Historique des changements

## 2026-11-19

- **Aurore Task dans son propre dépôt** (règle de François : un outil, un dépôt, une adresse ; « vas-y » du 19/11). Code repris tel quel du dépôt `liste-recolte` (étapes 36A, 36B, 36C, fusionnées le 18/11) : `taches.html` → `index.html`, `taches.webmanifest` → `manifest.webmanifest` (adresse de départ et portée : tout le site), service hors ligne à part (`sw.js`, CACHE `aurore-task-v1`), icônes, polices, `referentiel/taches-depart.json`, cahier des charges, tests. Connexion gardée sous `taches.compte` (au lieu de la clé du Cumul) : on se reconnecte une fois. Même base, mêmes comptes, mêmes tâches. `cle-web.js` vide : la clé est collée par François. **Non vérifié** : le site Cloudflare (pas encore créé), les vrais téléphones.
