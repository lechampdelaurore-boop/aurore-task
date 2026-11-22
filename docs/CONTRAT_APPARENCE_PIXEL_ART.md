# Contrat : choisir l'apparence, classique ou pixel art (Farm tasks)

*Étape 53 de la feuille de route. Rédigé le 22/11/2026, **avant tout code**, en Opus 5.5 · Élevé (exigence de François pour ce contrat). Contrat jumeau pour le Cumul : `docs/CONTRAT_APPARENCE_PIXEL_ART.md` du dépôt `liste-recolte` (étape 48 là-bas). Les deux contrats ont les mêmes règles ; seul ce qui est propre à chaque appli diffère.*

**Demande de François (22/11/2026, 13 h 38) :** « Est-ce que ce serait faisable d'avoir, en fait, dans les réglages du cumul et aussi dans les réglages de task, la possibilité d'avoir soit l'apparence actuelle, donc qui est inspirée du logiciel Ouvre ta ferme, avec une charte spécifique, soit l'apparence en pixel art ? » Puis (13 h 39) : rédiger le contrat seulement une fois la maquette du Cumul validée, ce qu'il a fait à 13 h 51.

**État : les quatre points de la partie 9 ont été confirmés par François le 22/11/2026 (14 h 19), tous selon la recommandation de Claude. Aucun code n'est écrit ; le code se fait ensuite (étape 53, Opus 5.5 · Élevé), Farm tasks avant le Cumul.**

**Références validées par François** (fichiers du projet, pas dans ce dépôt) :
- `maquette-pixel-art/farm-tasks-v3/` : maquette de Farm tasks validée le 21/11/2026 à 22 h 45 (`maquette-farm-tasks-v3.pdf`, captures 1 à 5, `CHARTE-PIXEL-ART.md`, `sources/`). Ne pas partir des versions v1 et v2.
- `maquette-pixel-art/cumul-v3/` : maquette du Cumul validée le 22/11/2026 à 13 h 51, écarts compris (`NOTE-ECARTS.md`).

L'annexe A recopie ici toutes les valeurs de la charte : **ce dépôt fait foi**, pas la copie des fichiers du projet.

---

## 1. En une phrase

Dans les Réglages, une rubrique **« Apparence de cet appareil »** propose deux choix, **Classique** (l'apparence d'aujourd'hui, inchangée) et **Pixel art** (la maquette validée). Le choix s'applique tout de suite, ne vaut que pour cet appareil, et ne change **que l'habillage** : mêmes listes, mêmes boutons au même endroit, mêmes gestes, mêmes données.

## 2. Ce que veulent dire « classique » et « pixel art »

- **Classique** : la charte d'origine du module d'irrigation d'Ouvre ta ferme, telle qu'elle est en ligne le 22/11/2026 (en-tête du style de `index.html`). Elle ne change pas d'un point : c'est la règle R6.
- **Pixel art** : la charte validée le 21/11/2026, décrite en entier dans l'annexe A : fond de ferme au coucher du soleil en gros pixels, barres brun foncé à filet orange, listes en « cartes » à cadre de pixels et haut rose, polices Press Start 2P et VT323, logo en pixels.

## 3. Règles (comportement voulu)

**R1. Où se fait le choix.** Dans la fenêtre Réglages, une rubrique **« Apparence de cet appareil »**, avec la phrase « Ce choix ne vaut que pour cet appareil. Les autres gardent le leur. » et deux gros boutons côte à côte : **Classique** et **Pixel art**, chacun avec une petite vignette de l'apparence (image fixe, quelques Ko). Le bouton choisi est marqué (coché, et annoncé comme tel aux lecteurs d'écran : `aria-pressed`). Placement recommandé : en bas, juste avant « Papier de secours ». Tout compte qui ouvre l'appli peut choisir (profils `ferme` et `equipe`) ; l'écran de connexion suit le choix déjà fait sur l'appareil.

**R2. Effet immédiat, indépendant de « Enregistrer ».** Toucher un des deux boutons change l'apparence tout de suite et la garde sur l'appareil, sans recharger la page. Les Réglages restent ouverts. « Annuler » et « Enregistrer » ne concernent que les réglages de la ferme (nom, personnes, encarts, rappel) : ils ne reviennent pas sur l'apparence. Rien n'est perdu au changement : liste ouverte, tâche en cours de saisie, position dans les listes.

**R3. Un choix par appareil, et par appli.** Le choix est gardé dans la mémoire du navigateur sous la clé **`taches.apparence`** (`"classique"` ou `"pixel"`). Il n'est **jamais** écrit dans la base : rien sous `taches/`, rien dans la sauvegarde de chaque nuit, aucune règle de base à changer. Il ne suit pas la personne : Aurore ou Martin gardent le classique sur leur téléphone même si François passe en pixel art sur le sien. Le Cumul a son propre choix (autre adresse, donc autre mémoire) : choisir ici ne change pas le Cumul, et inversement. *(Point 1 de la partie 9, confirmé.)*

**R4. Par défaut : classique.** Un appareil qui n'a jamais choisi, ou dont la mémoire a été effacée, est en classique. Le jour de la mise en ligne, personne ne voit de changement tant qu'il n'a pas choisi. Une valeur inconnue dans la clé vaut classique.

**R5. Pas d'éclair au démarrage.** L'apparence est posée avant le premier affichage : un très court script en tête de page lit la clé et pose `data-apparence="pixel"` sur `<html>`. Au rechargement, on ne voit jamais l'apparence classique un instant avant le pixel art.

**R6. Le classique ne change pas d'un point.** Toutes les règles de style du pixel art sont dans **un seul bloc** de `index.html`, entre les marques `PIXEL-ART-DEBUT` et `PIXEL-ART-FIN`, et chacune commence par `:root[data-apparence="pixel"]`. En dehors de ce bloc, le code ne change que pour : le script de tête (R5), la rubrique des Réglages (R1), la couleur de la barre du navigateur (R17), et le rangement des signes que les polices pixel n'ont pas (R10). Vérification : les captures de l'apparence classique sont **identiques au point près** avant et après le changement (partie 6, test T2).

**R7. Un habillage, rien d'autre.** Même page, mêmes éléments, mêmes boutons au même endroit, même ordre. Gestes gardés tels quels (cahier des charges, partie 3, les gestes de Google Tasks gagnent toujours) : toucher, appui long, glisser une tâche au doigt et à la souris, sous-tâches par décalage, balayage entre listes sur le téléphone, « tirer les listes » à la souris sur l'ordinateur, survol d'une tâche, coche avec son animation et « Annuler », menus « ⋯ », ajout en rafale, « Faites récemment ». Aucune écriture de plus dans la base, aucun flux en direct de plus. Le code ne regarde pas l'apparence pour agir : seules exceptions permises, poser l'attribut (R5), la barre du navigateur (R17) et le facteur d'agrandissement du fond (annexe A, A1).

**R8. Fidèle à la maquette validée.** Les écrans de la maquette (ordinateur, sept jours et autres listes ; téléphone, lundi en haut et en bas) doivent ressembler aux captures `farm-tasks-v3` : mêmes couleurs exactes (annexe A), mêmes cadres, mêmes polices et tailles, même logo. Les positions peuvent bouger de quelques points (la maquette était un calque posé sur l'appli ; le vrai code suit les vraies tailles). Un écart visible se signale à François avec une capture, il ne se tranche pas seul.

**R9. Les écrans que la maquette ne montre pas** suivent la charte « par analogie », selon les règles de l'annexe A (A9) : écran de connexion, menu « ⋯ » d'une tâche et d'une liste, fenêtres Encarts et Supprimer un encart, Choix (personnes, couleurs), Confirmation, Compte, Réglages, Imprimer, Nouvelle liste et Renommer, bandeau du bas (« Annuler », « Réglages enregistrés »), écran vide, liste cachée, rendez-vous de l'agenda, astreintes (« En pause », zone, heure), animation de la coche. **Chacun est montré à François en capture (téléphone et ordinateur) avant la fusion.**

**R10. Polices et signes.** Press Start 2P (titres) et VT323 (texte), licence SIL OFL 1.1, **hébergées dans `polices/`** comme les trois autres, jamais chargées d'un autre site, gardées hors ligne. Elles ne sont téléchargées que par un appareil en pixel art. Mesuré le 22/11 sur les fichiers de la maquette : elles ont tous les accents du français, « œ », « « » », « ’ », « … », mais **pas** `⋯ ▲ ▼ ● → 🕘` (VT323) ni, en plus, `−` (Press Start 2P). Ces signes, présents dans l'appli (menu « ⋯ », ▲▼ des encarts, etc.), doivent être **dessinés en petites icônes en pixels** ou **pris exprès dans la police classique de l'interface** (DM Sans), jamais laissés au hasard d'une police du système.

**R11. Lisibilité et accessibilité.**
- Tailles : tâches en VT323 de **17 points sur l'ordinateur** et **23 points sur le téléphone** (maquette) ; aucun texte de l'interface en VT323 sous 17 points sur l'ordinateur et 19 sur le téléphone ; les petits titres en Press Start 2P (bandeaux d'encart, boutons du haut) gardent les tailles de la maquette, de préférence arrondies au multiple de 8 le plus proche si la différence ne se voit pas (cette police est dessinée sur une grille de 8 points, elle est nette à 8, 16, 24).
- Zones à toucher : au moins 44 × 44 points sur le téléphone, comme en classique (cases, « ⋯ », « + », boutons du bas).
- Contraste mesuré (rapport WCAG) : texte ordinaire au moins 4,5 ; gros titres et icônes au moins 3. Mesures faites sur la charte : texte brun `#3b2a2f` sur crème 12,4 ; heure bleue `#1e5f86` sur crème 6,4 ; texte secondaire `#7a5a46` 5,7 ; « + » et « Ajouter une tâche » `#a8406f` sur crème 5,3 ; barre `#fff3e0` sur brun 13,2 ; boutons blancs sur vert `#3d6e5a` 5,9 et sur brun `#6e4a34` 7,8. **Deux points à surveiller** : (1) le titre blanc sur le haut rose `#e0709f` ne fait que 3,0 seul ; c'est son **contour `#8a2a5a`, obligatoire**, qui le rend lisible ; (2) le texte blanc du bouton « Répartir les astreintes » sur terre cuite `#d0604a` fait 3,85, trop peu pour un petit texte : **ajustement proposé `#b4503c` (5,1)**, presque la même teinte, visible sur les captures avant fusion (si François préfère la teinte de la maquette, on la garde).
- Au champ (soleil, gants) : **non vérifié** ; c'est l'essai de François sur son téléphone. VT323 est plus fine que l'Open Sans de l'appli.

**R12. L'impression reste sobre.** La page d'impression (étape 52, `docs/CONTRAT_IMPRESSION.md`) est **toujours en classique**, quelle que soit l'apparence : mêmes polices (Bricolage Grotesque, DM Sans, Open Sans), mêmes couleurs, pas de fond. Attention, elle lit aujourd'hui les variables `--f-texte` et `--f-titre` : le bloc pixel art ne doit pas les atteindre dans `#impPage`. Vérification : même texte (`pdftotext`) et mêmes polices dans le PDF (`pdffonts`) en classique et en pixel art.

**R13. Hors ligne.** Tous les nouveaux fichiers (fond, cadre, logo, icônes, deux polices) sont servis par le site et ajoutés à la liste `SHELL` de `sw.js`, et `CACHE` change. Un appareil qui a ouvert l'appli une fois avec le réseau peut passer en pixel art **sans réseau**. Poids ajouté : environ 350 Ko (fonds 205 + 110 Ko, polices 13 + 18 Ko, le reste quelques Ko), gardé une fois sur chaque appareil, même resté en classique : c'est le prix d'un changement qui marche toujours hors ligne. Aucune requête vers un autre site (test).

**R14. Ordinateur.** Les sept listes des jours tiennent **entières sur un écran de 1920 points**, comme aujourd'hui (largeur de liste calculée, 230 à 300 points) ; six sur 1600, puis on tire. Jamais d'ascenseur de côté dans une liste. Ascenseur vertical des listes de 8 points, crème foncé `#e6d3bd`, sans arrondi. La main pour « tirer les listes » reste dans le vide entre et sous les colonnes. Menu de gauche : logo en pixels de 64 points, « Farm tasks » dessous, crème jusqu'à 70 % de la hauteur puis fondu jusqu'à 80 %.

**R15. Téléphone.** Barre du haut fixe, comme aujourd'hui ; logo de 32 points devant le nom de la ferme. Barre des jours en bas. Le menu « ⋯ » d'une tâche tient toujours dans un écran de 360 × 640, « Fermer » compris, sans défiler, y compris pour une astreinte en RDV (test `menu-tache.cjs` dans les deux apparences).

**R16. Plusieurs fermes.** Rien de propre à une ferme : titres des listes, nom de la ferme, personnes et leurs couleurs, encarts et leurs couleurs viennent des données, comme en classique. Le fond est **le même décor pour toutes les fermes**, dans un seul fichier facile à remplacer (`apparence/`). Les couleurs des encarts gardent leur sens (RDV bleu, P1 orange… selon les Réglages) ; seule leur forme change (bandeau en marches d'escalier).

**R17. Icône, onglet et barre du navigateur.** L'icône installée sur le téléphone, l'icône d'onglet et celle des notifications **restent le presse-papier actuel** : elles sont communes à tous les appareils (manifeste, fichiers d'icônes) et un logo d'onglet qui change d'une visite à l'autre ne se met pas à jour de façon sûre dans Chrome (voir la règle « nouveau logo, nouveaux noms de fichiers »). Dans l'appli, en pixel art, le logo est la version en pixels. La couleur de la barre du navigateur sur le téléphone (`theme-color`) passe au brun `#3a2420` en pixel art et revient à `#373737` en classique.

**R18. Aucune donnée touchée.** Pas de migration, pas d'écriture dans la base, pas de sauvegarde à faire avant. Rien à publier dans la console Firebase, rien sur Cloudflare.

## 4. Ce qui ne change pas

Les données et la base ; les règles de la base ; les gestes ; la place et l'ordre de chaque bouton ; les encarts en bandeau jusqu'au « + » ; les encarts propres à chaque liste ; la couleur qui passe aux sous-tâches ; le verrou ; les astreintes ; l'agenda ; le rappel du matin et ses notifications ; l'impression ; l'adresse, le nom, l'icône installée ; le comportement hors ligne ; l'apparence classique.

## 5. Fichiers prévus

| Fichier | Changement |
|---|---|
| `index.html` | Script de tête (R5) ; bloc `PIXEL-ART-DEBUT` … `PIXEL-ART-FIN` après le style actuel ; rubrique « Apparence de cet appareil » dans `#reglDlg` et quelques lignes pour la gérer ; signes de R10 ; `theme-color` (R17). Toujours un seul fichier, sans bibliothèque ni étape de construction. |
| `apparence/` (nouveau) | `fond-ordinateur.png` (480 × 270, 64 couleurs) et `fond-telephone.png` (195 × 422), repris tels quels de la maquette ; `cadre-carte.png` (petite image du cadre découpée en 9 morceaux, ombre comprise, voir annexe A) ; `logo-pixel.png` (32 × 32) ; icônes des signes de R10 ; vignettes des deux apparences pour R1 ; `LISEZMOI.md` (provenance et licence de chaque image, dont le fond, à François : point 2 de la partie 9). |
| `polices/` | `press-start-2p.woff2`, `vt323.woff2` (jeu « latin », copiés sans modification, même source que les trois autres) ; `LISEZMOI.md` et `OFL.txt` complétés (auteurs : Codeman38 pour Press Start 2P ; Peter Hull pour VT323). |
| `sw.js` | Nouveaux fichiers dans `SHELL`, `CACHE` changé. |
| `tests/apparence.cjs` (nouveau) | Tests T1 à T12 (partie 6). |
| Tests existants | Une variable `APPARENCE=pixel` fait tourner chaque test dans l'apparence pixel art (partie 6, T3). |
| `README.md`, registres | Mis à jour dans la même PR. |

Le petit programme qui fabrique `cadre-carte.png` à partir des couleurs de l'annexe A est gardé dans le dépôt (`apparence/fabriquer-cadre.cjs`), pour pouvoir refaire l'image sans deviner.

## 6. Tests à prévoir (chacun relié à une règle)

- **T1 (R3, R4, R18)** : appareil neuf → classique, aucun attribut sur `<html>`. Choisir « Pixel art » dans les Réglages → attribut posé, clé `taches.apparence` = `"pixel"`, **aucune écriture** reçue par la fausse base (aucun PUT, PATCH ni DELETE de plus dans le journal des appels du faux Firebase). Recharger → toujours pixel art. Revenir à « Classique » → attribut retiré. Valeur inconnue → classique.
- **T2 (R6)** : captures de l'apparence classique (téléphone 390 × 844 et ordinateur 1920 × 1080 ; sept jours, une liste longue, menu « ⋯ », Réglages, liste verrouillée) faites sur `main` puis sur la branche, avec les mêmes données inventées et la même heure figée : **0 point différent**. (La rubrique des Réglages est la seule différence permise, et seulement sur la capture des Réglages.)
- **T3 (R7)** : **tous les tests existants passent aussi avec `APPARENCE=pixel`**, sauf les vérifications d'aspect propres au classique (tailles et couleurs mesurées dans `taches.cjs`, `taches-encarts.cjs`, etc.), marquées comme telles et remplacées par leur équivalent pixel art dans `apparence.cjs`. La liste des vérifications sautées est collée dans la PR.
- **T4 (R5)** : au premier affichage (observateur posé avant le chargement), `<html>` a déjà `data-apparence="pixel"`.
- **T5 (R8, annexe A)** : en pixel art, couleurs et tailles calculées par le navigateur : barre `#3a2420` à filet `#f08a3c` ; haut des listes `#e0709f` ; titre blanc avec contour `#8a2a5a` ; intérieur `#fff4e4` ; « Ajouter une tâche » `#a8406f` ; tâches 17 points (ordinateur) et 23 points (téléphone) en VT323 ; cadre posé par `border-image` ; polices chargées depuis le site.
- **T6 (R10)** : `document.fonts.check` vrai pour les deux polices ; aucun des signes de R10 affiché dans une police du système (chaque bouton « ⋯ », ▲, ▼ montre l'icône ou la police DM Sans).
- **T7 (R11)** : contrastes calculés sur les couleurs réelles de la page (liste de paires collée dans la PR) ; zones à toucher d'au moins 44 points sur le téléphone.
- **T8 (R12)** : impression en pixel art et en classique : même texte (`pdftotext`) et mêmes polices (`pdffonts` : ni Press Start 2P ni VT323).
- **T9 (R13)** : chaque nouveau fichier est dans `SHELL` ; `CACHE` différent de `main` ; aucune requête vers un autre domaine que le site et la base, dans les deux apparences ; avec le service worker actif et le réseau coupé, passer en pixel art affiche le fond et les polices.
- **T10 (R14, R15)** : ordinateur 1920 × 1080 en pixel art : sept listes entières ; aucun ascenseur de côté dans une liste ; ascenseur vertical de 8 points. Téléphone 360 × 640 : menu « ⋯ » d'une tâche en entier.
- **T11 (performance)** : avec un processeur ralenti 4 fois (outil de Chrome), affichage des sept jours avec 150 tâches : pas plus de 20 % plus lent qu'en classique ; aucun filtre graphique (`filter`, `backdrop-filter`) sur un élément qui défile.
- **T12 (R2)** : changer d'apparence pendant qu'une tâche est en saisie (Réglages ouverts par-dessus) : le texte saisi est toujours là après ; la liste affichée et sa position sont les mêmes.

Avant d'ouvrir la PR : tous les tests de `AGENTS.md`, dans les deux apparences, sorties réelles collées.

## 7. Ce qui restera non vérifié après le code

Les vrais téléphones (soleil, gants, iPhone), Firefox et Edge, l'écran de François. Ils seront dits « non vérifiés » dans le compte rendu, et François essaie sur ses appareils.

## 8. Découpage et réglage

- **Étape 53, une seule PR de code** pour Farm tasks, en **Opus 5.5 · Élevé**. Le Cumul a sa propre étape et sa propre PR (contrat jumeau), jamais en même temps (un seul fil de code à la fois).
- La PR montre à François les captures des écrans de la maquette et de ceux de R9, téléphone et ordinateur. **Elle n'est fusionnée qu'après son accord sur ces captures.**
- Après fusion : vérifier le déploiement (contrôle Cloudflare du commit de `main`) avant de dire que c'est en ligne. Rien à faire sur l'hébergeur.

## 9. Points confirmés par François (22/11/2026, 14 h 19)

Chaque point a été choisi par François sur une carte de décision, tous selon la recommandation.

1. **Confirmé : le choix vaut pour un appareil** (pas pour une personne, ni pour toute la ferme), et chaque appli a le sien. Recommandation : oui. Raisons : Aurore et Martin gardent le classique s'ils veulent, rien n'est écrit dans la base, ça marche sans réseau.
2. **Confirmé : l'image est à François** (« Elle est à moi : photo, dessin ou IA »), elle est publiée avec l'appli et `apparence/LISEZMOI.md` le dit. **L'image du fond** (la ferme japonaise au coucher du soleil, fournie par François) va dans un dépôt **public** : il faut savoir d'où elle vient. Recommandation : si François l'a faite lui-même (photo, dessin ou outil d'image), on la publie et `apparence/LISEZMOI.md` le dit ; si elle vient d'un site, on ne la publie pas et on en fait une autre avant le code.
3. **Confirmé : la page du magasin reste en classique.** **La page du magasin** (Cumul seulement, employés des magasins) : voir le contrat du Cumul. Sans effet sur Farm tasks.
4. **Confirmé : l'ordre**, Farm tasks d'abord. recommandation, **Farm tasks d'abord** (la charte y est née, la page est deux fois plus courte que celle du Cumul, on y règle le cadre, les polices et le hors ligne), puis le Cumul.

---

## Annexe A : la charte pixel art (valeurs à respecter)

Recopiée de `CHARTE-PIXEL-ART.md` (maquette validée le 21/11/2026, 22 h 45), complétée par ce que montrent les captures et `sources/skin.css`, `carte.css`, `carte-px.cjs`.

**A1. Le fond.** Image de François convertie en vrai pixel art, **64 couleurs, sans tramage**. Ordinateur : 480 × 270 pixels, agrandie **4 fois sans lissage** pour 1920 × 1080 (`image-rendering: pixelated`). Téléphone : 195 × 422, agrandie **2 fois**. Toujours un facteur **entier** (jamais un demi-pixel) : pour une autre taille d'écran, le plus petit facteur entier qui couvre la fenêtre, centré ; le reste, s'il y en a, en `#2a1810`. Le fond ne bouge pas quand on fait défiler : il est posé sur un calque fixe (pas `background-attachment: fixed`, qu'iPhone ne sait pas faire).

**A2. Barres.** Barre du haut (et du bas sur le téléphone) brun foncé `#3a2420`, filet orange `#f08a3c` de 4 points, ombre `#2a1810`. Texte crème `#fff3e0` en VT323 (22 points ordinateur, 19 à 21 téléphone). Point de l'état « Partagé » carré vert `#6fd08a`. Pastille de la personne : carré rose `#e0709f`, lettre blanche en Press Start 2P, marches `#f8b4d0` / `#a8406f`.

**A3. Menu de gauche (ordinateur).** Crème `rgba(255,246,232,.95)` jusqu'à 70 % de la hauteur, fondu jusqu'à 0 à 80 %. Logo pixel 64 × 64 points, « Farm tasks » dessous en Press Start 2P 11 points `#b84a2a` avec ombre `#ffd3a8`. Entrées en VT323 20 points `#6a5348` ; entrée choisie sur rose `#e0709f`, texte blanc, marches `#f8b4d0` / `#a8406f`. Petits titres (« Listes affichées ») en Press Start 2P 7 points `#8a6a52`. Cases des listes affichées : carrés roses à coche blanche dessinée en pixels.

**A4. Les cartes (une par liste).** Un pixel du cadre = **3 × 3 points**. Cadre de **5 pixels**, de l'extérieur vers l'intérieur : `#3a2016`, `#c9875a`, `#e8a874`, `#3a2016`, puis l'intérieur crème `#fff4e4`. Coins **en escalier**, rentrés de 5, 3, 2, 1 et 1 pixels. Ombre en escalier **6 points** plus bas (`rgba(42,24,16,.55)`), **dessinée dans l'image du cadre**, pas par un filtre. Technique : `border-image` avec `cadre-carte.png` découpée en 9 morceaux (les coins gardent leur escalier, les bords s'étirent), `background-clip: padding-box` pour que le crème ne déborde pas des coins. Pas de canevas.

**A5. Le haut de chaque carte.** Rose `#e0709f`, reflet `#f8b4d0` sur la première ligne, ombre `#c4508a` sur l'avant-dernière, trait `#3a2016` puis filet `#f7dcc4` dessous. Titre de la liste en Press Start 2P, **blanc avec contour `#8a2a5a`** de 3 points (13 points ordinateur, 17 à 18 téléphone). Boutons ronds « ⋯ » et « + » devenus carrés crème `#fff4e4`, signe `#a8406f`, marches `#8a2a5a`, petit relief `#f2cfa8`. **Aucun dessin ni icône dans les cartes** (demande de François).

**A6. Contenu des cartes.** « Ajouter une tâche » et les « + » des encarts en rose `#a8406f` ; sur le téléphone, les « + » des encarts sont des boutons roses (`#e0709f`, signe blanc, marches `#f8b4d0` / `#a8406f`). Tâches en VT323 `#3b2a2f`, **17 points ordinateur, 23 points téléphone** (interligne 18 et 24). Séparation des tâches : pointillé `#efcdb4` de 3 points. Séparateur : tirets `#c9a98c` de 4 points. Heure des rendez-vous `#1e5f86`. Petites icônes d'origine (agenda, astreinte) `#a07a5c`, tracées sans lissage. Cases à cocher blanches à marches `#8a6a52` (13 points ordinateur, 18 téléphone). Pastilles des personnes en carrés à marches, couleur de la personne (Réglages). Bandeaux d'encart en Press Start 2P 8 points (10 sur le téléphone), en marches de la couleur de l'encart (Réglages). « Faites récemment » en VT323 `#8a6a52` (sur le téléphone, crème à contour brun, posé sur le fond). Liste verrouillée : pointillés `#c9b49a` à l'intérieur de la carte, encadré « Liste verrouillée » `#f6e6d2` à marches `#e2c8ac`, texte `#7a5a46`. Ascenseur 8 points `#e6d3bd`, carré.

**A7. Haut de l'écran (ordinateur).** Titre « Planning » (ou nom de la page) en Press Start 2P 22 points, blanc, contour et ombre `#8a2a1e`. Boutons en Press Start 2P 9 points, blancs, reliefs en pixels et ombre `#2a1810` : « Rendez-vous de l'agenda » vert `#3d6e5a` (reliefs `#8cc4a4` / `#1e3a2e`) ; « Répartir les astreintes » terre cuite (voir R11) ; « + Nouvelle liste » brun `#6e4a34` (reliefs `#b88a62` / `#3a2420`).

**A8. Le logo.** Le presse-papier sur ciel orangé en pixel art, grille 32 × 32, contour brun foncé (`logos-cumul/pixel-art/farm-tasks-2-presse-papier.png` des fichiers du projet, réduit à 32 × 32). 64 points dans le menu de l'ordinateur, 32 points dans la barre du téléphone. Agrandi sans lissage.

**A9. Règles « par analogie » pour les écrans non maquettés.**
- Une fenêtre (Réglages, menus « ⋯ », Encarts, Imprimer…) est une **carte** : même cadre, haut rose avec son titre en blanc à contour, intérieur crème. Sur le téléphone, la feuille qui monte du bas garde sa forme et sa poignée.
- Bouton principal (« Enregistrer », « Imprimer », « Fermer » quand il est seul) : rose foncé `#a8406f`, texte blanc, reliefs `#e0709f` / `#6a1e44`. Bouton secondaire (« Annuler », « Se déconnecter ») : crème `#fff4e4`, texte `#3b2a2f`, marches `#8a6a52`. Bouton qui supprime : terre cuite foncée (R11).
- Champ à remplir : fond blanc, marches `#8a6a52`, texte VT323 d'au moins 20 points (au moins 16 points réels sur l'iPhone, sinon il zoome).
- Cases et boutons radio : carrés à marches, coche blanche dessinée en pixels sur rose.
- Bandeau du bas (« Annuler ») : brun `#3a2420`, texte crème, filet orange.
- Animation de la coche : la même qu'en classique (même durée, mêmes étapes), avec le vert `#3d6e5a` à la place du vert de la charte d'origine.
- Couleurs qui portent un sens (personnes, encarts, couleur du texte d'une tâche) : celles des Réglages, jamais remplacées.
- Pas d'arrondi lisse nulle part : coins carrés ou en escalier.
