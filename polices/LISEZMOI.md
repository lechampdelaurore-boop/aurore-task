# Polices de l'appli (charte douce, étape 42)

Trois polices libres, copiées sans modification depuis les paquets Fontsource 5.3.0 (versions variables, jeu de caractères « latin », qui couvre le français) :

| Fichier | Police | Usage |
|---|---|---|
| `bricolage-grotesque.woff2` | Bricolage Grotesque (© 2022 The Bricolage Grotesque Project Authors) | titres |
| `dm-sans.woff2` | DM Sans (© 2014 The DM Sans Project Authors) | boutons, onglets, noms de produits, quantités |
| `open-sans.woff2` | Open Sans (© 2020 The Open Sans Project Authors) | texte courant |

Licence : SIL Open Font License 1.1, texte complet dans `OFL.txt`. Les polices sont servies par le site lui-même et gardées hors ligne par `sw.js` : aucune police n'est chargée depuis un autre site.

## Apparence pixel art (étape 53, 22/11/2026)

Seulement dans l'apparence « Pixel art » (Réglages → Apparence de cet appareil). L'apparence classique ne les charge pas.

| Fichier | Police | Usage |
|---|---|---|
| `press-start-2p.woff2` | Press Start 2P (© 2012 The Press Start 2P Project Authors, nom réservé « Press Start 2P ») | titres des listes, barre, boutons du menu |
| `vt323.woff2` | VT323 (© 2011 The VT323 Project Authors) | texte des tâches et des fenêtres |
| `signes-pixel.woff2` | Signes pixel (dessinée pour Farm tasks) | les signes que les deux polices n'ont pas : ⋯ ▲ ▼ ● → − ✓ 🕘 |

Press Start 2P et VT323 sont copiées sans modification depuis les paquets Fontsource 5.3.0 (jeu « latin », les mêmes fichiers que la maquette validée) ; licence SIL Open Font License 1.1 (`OFL.txt`). « Signes pixel » est faite par `apparence/fabriquer-signes.py` (8 signes dessinés point par point, 700 octets) ; elle suit la licence du dépôt. Pour la refaire : `pip install fonttools brotli`, puis `python3 apparence/fabriquer-signes.py` depuis la racine du dépôt.
