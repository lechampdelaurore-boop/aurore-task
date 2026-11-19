# Pas-à-pas : mettre Aurore Task en ligne à sa propre adresse

*Pour François. Environ 10 minutes. Rien de payant (offre gratuite de Cloudflare Pages, comme pour le Cumul).*

## 1. Créer le site sur Cloudflare

1. Ouvrir https://dash.cloudflare.com et se connecter (le même compte que pour le Cumul).
2. Menu de gauche : **Workers & Pages**, puis le bouton **Create** (ou « Créer »).
3. Choisir l'onglet **Pages**, puis **Connect to Git** (« Importer un dépôt Git »).
4. Choisir le compte GitHub `lechampdelaurore-boop`, puis le dépôt **aurore-task**. S'il n'apparaît pas : lien « Configure GitHub App » / « Ajouter un compte », et cocher le dépôt `aurore-task` dans la liste des dépôts permis.
5. Réglages :
   - **Project name** : `aurore-task` (c'est ce qui donne l'adresse `aurore-task.pages.dev` ; si ce nom est déjà pris ailleurs, Cloudflare ajoute un petit suffixe : noter l'adresse donnée) ;
   - **Production branch** : `main` ;
   - **Framework preset** : None ;
   - **Build command** : vide ;
   - **Build output directory** : `/`.
6. **Save and Deploy**. Attendre « Success ». Donner l'adresse obtenue à Claude.

## 2. Clé web : rien à faire

Depuis le 19/11, la page reprend toute seule la clé web déjà en ligne sur le site du Cumul (`https://liste-recolte.pages.dev/cle-web.js`, même base Firebase) quand `cle-web.js` est vide ici. Claude ne la voit jamais. Les étapes ci-dessous ne servent que si l'on veut un jour qu'Aurore Task ne dépende plus du site du Cumul.

1. Sur GitHub, ouvrir le dépôt **liste-recolte**, puis le fichier `cle-web.js`, et copier la valeur entre apostrophes de la dernière ligne (`window.RECOLTE_CLE_WEB = '…';`).
2. Ouvrir le dépôt **aurore-task**, le fichier `cle-web.js`, le crayon (« Edit »), coller la valeur entre les deux apostrophes de la dernière ligne.
3. **Commit changes**, choisir « Commit directly to the main branch » (c'est la seule exception permise : un secret que vous seul écrivez), puis **Commit changes**.
4. Cloudflare remet le site à jour tout seul en une minute.

## 3. Sur chaque téléphone

1. Supprimer de l'écran d'accueil l'icône **Aurore Task** et l'icône **Cumul** (appui long, « Supprimer » ou « Désinstaller »).
2. Ouvrir https://liste-recolte.pages.dev dans Chrome et réinstaller le Cumul (menu ⋮, « Ajouter à l'écran d'accueil »).
3. Ouvrir la nouvelle adresse d'Aurore Task et l'installer de la même façon.
4. Ouvrir Aurore Task et se connecter (même identifiant et même mot de passe que pour le Cumul). Les tâches déjà saisies sont là.
