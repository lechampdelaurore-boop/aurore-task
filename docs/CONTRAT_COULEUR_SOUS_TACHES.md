# Contrat : la couleur d'une tâche passe à ses sous-tâches

*Étape 50 de la feuille de route. Rédigé le 21/11/2026, **avant tout code**. Demande de François (21/11) : « Quand on choisit la couleur d'une tâche, toutes ses sous-tâches et sous-sous-tâches prennent la même couleur, par défaut. Si besoin, je peux changer individuellement. » Les cinq points ci-dessous ont été **confirmés par François le 21/11/2026**, tous selon la recommandation de Claude. **Codé le 21/11/2026** (`colorerTache` et `creer` dans `index.html`, test `tests/couleur-sous-taches.cjs`).*

## 1. Le comportement voulu, en une phrase

Dans le menu « ⋯ » d'une tâche, « Couleur du texte » colore la tâche **et ses sous-tâches à tous les niveaux** ; ensuite, chaque sous-tâche garde son propre choix de couleur, qu'on change à part.

## 2. Règles (avec la recommandation sur chaque point à trancher)

**R1. Recolorer une tâche mère** (point 1, confirmé). La nouvelle couleur est écrite sur la tâche et sur celles de ses descendantes qui **suivaient** leur mère, c'est-à-dire dont la couleur était **la même que l'ancienne couleur de leur mère directe**. Une sous-tâche colorée à la main (couleur différente de celle de sa mère) **n'est pas écrasée**, et ses propres sous-tâches non plus. On descend niveau par niveau et on s'arrête dès qu'une tâche ne suivait pas. *Raison : c'est ce que dit « par défaut » ; la couleur choisie à la main, un jour, ne disparaît pas sur un simple coup de pinceau sur la mère. Aucun nouveau champ dans la base : on compare seulement les couleurs.* Autre choix possible : tout écraser (plus simple, mais efface les couleurs mises à la main).

**R2. Nouvelle sous-tâche** (point 2, confirmé). Une sous-tâche créée sous une tâche colorée **prend la couleur de sa mère directe** au moment de sa création (touche « Entrée » pour en ajouter une autre à la suite : la couleur vient de la mère, pas de la sœur précédente). Sans couleur chez la mère : rien d'écrit. Ensuite elle est indépendante. Une tâche de premier niveau (sans mère) n'hérite de rien. Les tâches créées par l'agenda, le rappel ou « Répartir les astreintes » ne sont pas concernées (premier niveau, sans couleur).

**R3. « Noir » = « aucune couleur »** (point 3, confirmé). Choisir « Noir » est un choix comme un autre : il se propage selon R1 (les sous-tâches qui suivaient redeviennent noires ; dans la base, le champ `couleur` est vidé comme aujourd'hui). Inversement, colorer une mère noire colore les sous-tâches noires (elles suivaient). Les anciens gris (`gris`, affichés en gris depuis le 20/11) comptent comme une couleur à part pour la comparaison : une mère grise recolorée entraîne ses sous-tâches grises.

**R4. Déplacer une sous-tâche** (point 4, confirmé). Un déplacement (glisser, indenter, désindenter, changer de liste) **ne change aucune couleur** : la tâche emporte sa couleur et celle de ses sous-tâches. Ensuite, elle suit sa nouvelle mère seulement si on recolore cette mère **et** que sa couleur est égale à l'ancienne de celle-ci (R1). *Raison : un déplacement qui recolore en silence surprendrait.*

**R5. Données existantes** (point 5). **Rien n'est modifié à la mise en service** : aucune migration, aucune écriture en masse. Les tâches et sous-tâches d'aujourd'hui gardent leurs couleurs. La règle ne joue que **quand François (ou Aurore, ou Martin) touche une pastille de couleur** : l'écriture porte alors sur cette tâche et son arbre seulement, jamais sur le reste de la liste. Pas de « vas-y » à demander pour ça, car c'est le geste de la personne ; il n'y a rien à sauvegarder avant.

## 3. Cas limites

| Cas | Comportement |
|---|---|
| Choisir la couleur déjà en place | Rien n'est écrit. |
| Sous-tâche colorée à la main, sa mère recolorée | Elle reste telle quelle, avec ses propres sous-tâches (R1). |
| Sous-sous-tâche qui suivait sa mère, mère-sous-tâche qui suit la grand-mère | Les trois changent d'un coup. |
| Chaîne rompue au milieu | Seul ce qui est au-dessus de la rupture change. |
| Séparateur parmi les sous-tâches | Ignoré (il n'a pas de texte, donc pas de couleur) ; il ne coupe pas la descente. |
| Tâche sans sous-tâche | Comme aujourd'hui, une seule écriture. |
| Liste verrouillée | Pas de menu de couleur, rien ne change. |
| Hors ligne | Toutes les couleurs sont écrites en **une seule écriture groupée** (comme déjà le déplacement d'une tâche et de ses sous-tâches) : soit tout, soit rien, et la synchronisation reprend d'un bloc. |
| Deux personnes recolorent en même temps | Le dernier gagne sur chaque tâche (comme tout le reste de l'appli) ; aucun blocage. |
| Sous-tâche supprimée entre-temps | Ignorée. |
| Tâche déjà cochée / effacée | Non concernée (elles n'apparaissent plus). |
| Annuler | Pas de « Annuler » pour une couleur aujourd'hui, et on n'en ajoute pas : on rechoisit l'ancienne couleur (les sous-tâches qui suivaient suivent de nouveau, R1). |
| Autre ferme | Rien de propre à la ferme de François : la règle ne dépend ni des noms ni des couleurs choisies. |

## 4. Ce qui ne change pas

La couleur reste un champ `couleur` par tâche (`taches/t/<id>/couleur`). Pas de nouveau champ, pas de règle de base à republier, pas de migration. Le menu garde sa forme ; les écrans, le glisser et le hors-ligne ne bougent pas.

## 5. Tests à prévoir (nouveau `tests/couleur-sous-taches.cjs`, faux Firebase, téléphone et ordinateur)

1. Mère avec 2 sous-tâches et 1 sous-sous-tâche toutes noires : choisir « Rouge » colore les quatre, en **une** seule écriture.
2. Une sous-tâche en bleu à la main : recolorer la mère en vert la laisse bleue, ainsi que sa sous-sous-tâche ; ses sœurs deviennent vertes.
3. « Noir » sur une mère rouge : les sous-tâches rouges redeviennent noires, le champ est vidé, la bleue reste bleue.
4. Mère grise ancienne : recolorée, ses sous-tâches grises suivent.
5. Nouvelle sous-tâche sous une mère rouge (menu « + sous-tâche » et touche Entrée enchaînée) : rouge ; sous une mère noire : aucun champ écrit ; tâche de premier niveau : aucun champ.
6. Déplacer une sous-tâche rouge sous une mère verte : elle reste rouge ; un séparateur parmi les sous-tâches ne change rien et ne coupe pas la descente.
7. Même couleur rechoisie : zéro écriture. Liste verrouillée : pas de pastilles.
8. Non-régression : les autres tests (`taches.cjs`, `taches-encarts.cjs`, `taches-astreintes.cjs`, `menu-tache.cjs`, `rappel.cjs`, `agenda.cjs`, `encarts-listes.cjs`) restent verts ; `CACHE` de `sw.js` incrémenté.
9. **Non vérifié d'avance** : de vrais téléphones, comme le reste de l'appli.

## 6. Pour le codage (fil Opus 5.5, ensuite)

Code concerné : `changerTache(id, 'couleur', v)` appelé par le menu (`data-coul`, vers la ligne 1562 de `index.html`) devient une fonction `colorerTache(id, v)` qui calcule le lot avec `enfants()` et `descendants()` puis appelle `ecrire()` une fois ; `creer()` (ligne 977) copie la couleur de la mère. Modèle / effort : Opus 5.5 · Moyen (une fonction, un test).
