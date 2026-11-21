# Contrat : imprimer toutes les listes (le papier de secours)

*Étape 52 de la feuille de route. Rédigé le 21/11/2026, **avant tout code**. Demande de François (21/11) : « Je veux qu'on puisse imprimer la totalité des listes, chaque tâche visible, au cas où il y aurait un problème réseau. Certaines listes ont un ascenseur : je ne peux pas juste imprimer l'écran ou faire une capture. Il faut un outil spécifique. »*

**État : les quatre points de la partie 4 ont été confirmés par François le 21/11/2026, tous selon la recommandation de Claude. Prêt à coder (Opus 5.5 · Élevé).**

Maquette d'exemple (données inventées, autre ferme) : `maquette-impression.pdf` et `.png` dans le dossier `impression-taches/` des fichiers du projet.

## 1. Pourquoi une capture ou « Ctrl+P » sur l'écran ne marche pas

L'écran de Farm tasks est une page de la hauteur de la fenêtre, dont chaque liste défile dans sa propre colonne (`.pan-corps` et la piste des listes ont leur ascenseur, `body` est bloqué à `100dvh` avec `overflow:hidden`). Le navigateur imprime ce qu'il voit : la partie de la liste visible, coupée. Il faut donc **fabriquer une page d'impression à part**, qui contient toutes les tâches en continu, et masquer l'appli le temps de l'impression.

## 2. La solution proposée, en une phrase

Un bouton **« Imprimer… »** ouvre une petite fenêtre où l'on coche les listes et quelques options, puis l'appli construit une **page d'impression dédiée** (A4, tâches à la suite, cases vides à cocher au stylo, sous-tâches comprises, encarts en bandeaux) à partir de **la copie des données gardée sur l'appareil**, et lance l'impression du navigateur ; « Enregistrer au format PDF » de la fenêtre d'impression donne le PDF.

## 3. Règles (comportement voulu)

**R1. Marche sans réseau.** Les données viennent de la copie locale (`taches.copie`, celle qui fait déjà marcher l'appli hors ligne), jamais d'un appel réseau. Aucune écriture dans la base, aucun envoi : l'impression est en **lecture seule**. L'appli doit pouvoir être ouverte hors ligne (c'est déjà le cas, service worker) ; si l'appareil n'a jamais reçu les données (jamais connecté), le bouton est grisé avec la phrase « Pas encore de données sur cet appareil ».

**R2. Tout est imprimé, rien n'est coupé.** Chaque liste choisie est imprimée en entier, dans l'ordre de l'écran : tâches hors encart d'abord, puis chaque encart (RDV, P1, P2 ou ceux propres à la liste, avec leur nom et leur couleur pâle en bandeau), sous-tâches et sous-sous-tâches indentées à tous les niveaux, séparateurs en trait, astreintes avec leurs jours, zone et heure, rendez-vous de l'agenda tels qu'ils sont déjà dans la liste. Aucun ascenseur, aucun texte tronqué : un texte long passe à la ligne. Une tâche n'est jamais coupée entre deux pages ; un titre de liste ou d'encart n'est jamais seul en bas de page.

**R3. Case vide devant chaque tâche**, pour cocher au stylo. Les tâches cochées ne sont pas imprimées ; l'option « Faites récemment (7 jours) » les ajoute, case pleine, en fin de liste (décochée par défaut).

**R4. En-tête de page : l'heure de l'impression et la fraîcheur des données.** « Imprimé le samedi 21 novembre 2026 à 21 h 04 · données de cet appareil à jour à 20 h 52 ». On garde pour cela l'heure de la dernière réception dans une nouvelle clé locale `taches.copieLe` (sur l'appareil seulement, rien dans la base). S'il reste des modifications pas encore envoyées (`taches.pending`), elles sont **comprises** dans l'impression (elles sont déjà à l'écran) et l'en-tête le dit : « dont N modifications pas encore envoyées ». Le nom de la ferme vient du réglage de la base (jamais écrit en dur).

**R5. Choix des listes.** La fenêtre propose, toutes cochées au départ : les sept jours, Astreintes, les autres listes (une case par liste, y compris celles cachées de l'écran de l'ordinateur et les listes verrouillées). Trois raccourcis : « Tout », « Les sept jours », « Aucune ». Entrée aussi dans le menu « ⋯ » d'une liste : « Imprimer cette liste », qui ouvre la même fenêtre avec cette seule liste cochée.

**R6. Options** (retenues sur l'appareil, `taches.impression`) : papier **A4 portrait** (par défaut) ou **A4 paysage** ; **couleur** ou **noir et blanc** ; **gros caractères** ; **faites récemment** (R3). En noir et blanc : bandeaux d'encart en gris, texte noir, personne marquée par son initiale entre crochets (« [T] »), plus de couleur de texte (une tâche colorée est précédée d'un « ● »).

**R7. Mise en page.** Portrait : 2 colonnes, texte 9 pt, marges 12 mm ; paysage : 3 colonnes ; gros caractères : 11 pt, 1 colonne en portrait, 2 en paysage. Les listes se suivent dans la colonne ; une liste longue continue en haut de la colonne ou de la page suivante. Polices de l'appli (déjà hébergées, donc disponibles hors ligne). Personnes en pastille colorée avec l'initiale. Couleur du texte gardée en mode couleur.

**R8. Compte rendu avant d'imprimer.** La fenêtre affiche « 7 listes · 143 tâches » (comptées dans la copie locale) ; c'est le chiffre que le test compare à ce qui est imprimé. L'aperçu est celui du navigateur (fenêtre d'impression, qui montre déjà les pages).

**R9. Aucun effet sur l'écran.** La page d'impression est ajoutée au moment du clic et retirée après (`afterprint`), le reste de l'appli n'est pas touché ; règles d'impression seulement sous `@media print`. Aucun changement du téléphone ni de l'ordinateur hors le bouton et sa fenêtre. Comptes concernés : ceux qui ouvrent déjà les tâches (`ferme`, `equipe`).

**R10. Téléphone.** `window.print()` marche sur Android (Chrome : imprimer ou enregistrer en PDF) ; sur iPhone, Safari n'imprime pas toujours la page : le plan B est le même bouton avec un message « Utilisez Partager → Imprimer » (à vérifier sur un vrai iPhone, **non vérifié** pour l'instant).

**R11. Plusieurs fermes.** Rien de propre à une ferme : noms, encarts, couleurs, personnes viennent des données ; la maquette utilise une ferme inventée.

## 4. Points confirmés par François le 21/11/2026

1. **Confirmé.** **Mise en page par défaut** : **A4 portrait en 2 colonnes** (recommandé : 7 jours et les autres listes tiennent en 1 à 2 pages ; paysage et gros caractères en option) ; autre choix : une liste par page (plus de papier, plus lisible).
2. **Confirmé** (« toutes les tâches notées, sauf celles déjà faites »). **Contenu par défaut** : **tâches à faire seulement**, cases vides, sous-tâches comprises (recommandé) ; « Faites récemment » en option, décochée.
3. **Confirmé** (« couleur par défaut »). **Couleur** : **couleur par défaut**, noir et blanc en option (recommandé si l'imprimante est en couleur) ; ou noir et blanc par défaut.
4. **Confirmé** (« dans Réglages »). **Où mettre le bouton** : **Réglages → « Imprimer… »** et **« ⋯ » d'une liste → « Imprimer cette liste »** (recommandé : pas de bouton de plus dans la barre du haut) ; autre choix : une icône d'imprimante dans la barre du haut.

## 5. Ce qui ne change pas / ce qui est écarté

- Pas de bouton d'impression automatique, pas d'envoi par courriel, pas de PDF fabriqué sur un serveur : tout se fait dans le navigateur de l'appareil.
- Pas de lignes libres pour écrire ni de grille à remplir (pas demandé ; à ajouter plus tard si François le souhaite).
- Numéro de page : pas garanti selon les navigateurs, non retenu.

## 6. Plan de codage (Opus 5.5 · Élevé)

Tout dans `index.html` (bouton, fenêtre `#impDlg`, fonction `construireImpression(listes, options)` qui lit `IX`/`D`, `@media print`), `sw.js` (`CACHE` à incrémenter), nouveau `tests/impression.cjs` (voir ci-dessous), registres.

**Vérifications prévues (chaque point couvert par un test ou une vérification réelle)** :
- R2 : jeu de données avec encarts, sous-tâches sur 3 niveaux, séparateur, astreinte, liste de 150 tâches : le texte de **chaque** tâche non cochée apparaît une fois dans la page d'impression ; le compte imprimé = le compte affiché dans la fenêtre = le compte de la base.
- R2/R7 : en mode `print` (Playwright), aucun élément n'a d'ascenseur (`scrollHeight == clientHeight` partout) ; PDF généré, nombre de pages relevé, aucune tâche coupée.
- R1 : réseau coupé (`context.setOffline(true)`), l'impression se construit ; **aucune requête** envoyée ; la base fausse n'a reçu aucune écriture.
- R3 : cases vides ; faites récemment absentes par défaut, présentes avec l'option.
- R4 : heure d'impression et heure de la copie présentes ; modifications en attente comptées.
- R5/R6 : choix de listes (dont cachée et verrouillée), raccourcis, options retenues après rechargement ; noir et blanc : aucune couleur ni fond coloré.
- R9 : après impression, la page d'impression est retirée et l'appli est intacte ; les 8 autres fichiers de tests restent verts.
- **Non vérifiable ici** : imprimante réelle, iPhone, Firefox/Edge, rendu des couleurs sur papier.
