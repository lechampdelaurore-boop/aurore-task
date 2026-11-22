# Images de l'apparence pixel art (étape 53, 22/11/2026)

Seulement dans l'apparence « Pixel art » (Réglages → Apparence de cet appareil), sauf les deux vignettes qui sont dans les Réglages des deux apparences. Contrat : `docs/CONTRAT_APPARENCE_PIXEL_ART.md`. Charte validée par François le 21/11/2026 (maquette Farm tasks v3). Toutes ces images sont gardées hors ligne par `sw.js`.

| Fichier | Ce que c'est | D'où il vient |
|---|---|---|
| `fond-ordinateur.png` | Fond de l'ordinateur, ferme japonaise au coucher du soleil, 480 × 270 points, 64 couleurs. La page l'agrandit d'un nombre entier de fois (4 fois en 1920 × 1080), sans lissage. | Image de François (maquette v3, `sources/bg-480.png`), copiée sans modification. Publiée avec son accord (point 2 du contrat, 22/11/2026). |
| `fond-telephone.png` | Fond du téléphone, même scène recadrée en hauteur, 195 × 422 points, 64 couleurs. | Image de François (maquette v3, `sources/bg2-phone.png`), copiée sans modification. Même accord. |
| `cadre-carte.png` | Cadre des cartes et des fenêtres, 33 × 39 points (11 × 13 pixels du cadre, chacun de 3 × 3 points), découpé en 9 morceaux par la page (`border-image`). | Fait par `fabriquer-cadre.cjs` (même dessin que `sources/carte-px.cjs` de la maquette). Pour le refaire : `node apparence/fabriquer-cadre.cjs`. |
| `logo-pixel.png` | Logo presse-papiers en pixels, 32 × 32 points (affiché à 64 points dans le menu de l'ordinateur, 32 sur le téléphone). | Logo de Farm tasks en pixel art (maquette v3, `sources/logo.png`, 512 × 512, 16 points par pixel), réduit à 32 × 32 sans lissage (un point par pixel du dessin). |
| `coche-pixel.svg` | Coche blanche des cases cochées des Réglages, 7 × 7 pixels. | Dessinée pour Farm tasks. |
| `vignette-classique.png`, `vignette-pixel.png` | Petites images des deux boutons « Classique » et « Pixel art » des Réglages, 300 × 180 points (affichées à 150 × 90). | Capture des sept jours avec les données inventées des tests (`tests/donnees-apparence.cjs`, « Ferme du Petit Pré », rien de la vraie ferme), fenêtre de 1500 × 900, réduite à 300 × 180 et ramenée à 64 couleurs. |

Les deux fichiers `fabriquer-*` ne sont pas servis à l'appli (aucune page ne les charge) ; ils servent seulement à refaire le cadre et la police des signes (`polices/signes-pixel.woff2`, voir `polices/LISEZMOI.md`).
