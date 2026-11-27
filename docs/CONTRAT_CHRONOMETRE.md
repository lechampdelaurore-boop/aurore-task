# Contrat : chronomètre des tâches et vrai historique

*Étape 55 de la feuille de route. Rédigé le 27/11/2026 (Sonnet 5.5 · Moyen), **avant tout code**. Demande de François (26/11 et 27/11) : un chronomètre par tâche avec les boutons d'un magnétoscope (▶ démarrer, ⏸ pause, ■ terminer), en option (éteint par défaut, la case à cocher reste le fonctionnement normal), et un historique des tâches réalisées qui fonctionne **dans tous les cas**, chronomètre allumé ou non, facile à sortir en tableur.*

**État : maquettes montrées à François le 27/11/2026, qui les trouve « correctes » avec une précision : le chronomètre servira uniquement sur téléphone (voir R2). Les cinq points de la partie 4 ont été confirmés par François le 27/11/2026 ; le 27/11 à 12 h 44, il est revenu sur le cinquième : l'historique est gardé **sans limite de durée** (la recommandation de Claude). Code écrit le 27/11/2026 (Opus 5.5 · Élevé), « vas-y » de François du 27/11 ; l'historique est rangé dans un **dossier à part de la base**, `taches-historique/` (choix de François du 27/11, voir partie 3). La règle de ce dossier est à publier par François (ou par Claude sur son « vas-y » écrit), après une sauvegarde de la base.**

Maquettes (données inventées, autre ferme) : dossier `chronometre-taches/maquette/` des fichiers du projet (classique et pixel art, téléphone et ordinateur) et `NOTE-MAQUETTES.md`.

## 1. Ce que l'on veut obtenir

1. Un **mode chronomètre**, allumé ou éteint dans les Réglages. Éteint (par défaut) : l'appli est exactement celle d'aujourd'hui.
2. Allumé, sur le téléphone, chaque tâche a un bouton **▶** ; une tâche en marche montre **⏸** et **■** et son temps ; une tâche en pause montre **▶** et **■**.
3. Un **historique des tâches réalisées** : tâche, qui, liste, début, fin, pause, durée. Rempli à chaque tâche cochée ou terminée, **même sans chronomètre**.
4. Un **export en tableur** (fichier `.csv`, une ligne par tâche réalisée).
5. Un format d'historique que la Récolte du Cumul (étape 51 de liste-recolte) et, plus tard, Ouvre ta ferme pourront réutiliser.

## 2. Règles (comportement voulu)

**R1. Option dans les Réglages.** Réglages → « Chronomètre » → case à cocher « Mode chronomètre », **décochée au départ**, avec une phrase d'aide (maquette). Le réglage vaut pour **toute la ferme** (clé `taches/reglages/chronometre`, `true` ou absent) : tout le monde voit les mêmes boutons. Sous la case, l'entrée « Ouvrir l'historique… ».

**R2. Téléphone seulement.** Les boutons ▶ ⏸ ■ et le bandeau « en cours » n'existent que sur l'écran de téléphone (le même seuil que le panneau « Nouvelle tâche », moins de 1000 px). **Sur ordinateur : aucun bouton chronomètre, aucun changement de la liste** (demande de François du 27/11). Sur ordinateur, cocher une tâche dont le chrono tourne sur un téléphone la **termine** comme ■ (R6) : aucune donnée ne reste en suspens. La case du mode et l'historique (écran et export) restent accessibles sur ordinateur, car c'est là qu'un tableur s'ouvre le plus facilement. *Confirmé par François le 27/11.*

**R3. Boutons façon magnétoscope.** ▶ triangle vers la droite = démarrer ou reprendre ; ⏸ deux barres verticales = pause ; ■ carré = terminer. Dessinés en formes pleines, sans texte, zone à toucher d'au moins 44 points, couleurs de la charte (classique : vert, orange, rouge ; pixel art : carrés à cadre brun, sans coins arrondis). Le temps s'écrit « 00:12:34 », « En pause · 00:41:08 ».

**R4. Une personne, un chrono.** Chaque personne a **au plus un chronomètre en marche**. Démarrer une autre tâche **met la première en pause** (pas de perte) : la première garde son temps en pause et peut être reprise ou terminée plus tard (au codage : un chrono par personne **et par tâche**, `taches/chrono/<by>/<tâche>`, sinon la pause aurait perdu le temps de la première tâche). La personne est celle du compte connecté (`by`). Le chrono est **gardé dans la base**, donc partagé entre les appareils de cette personne : démarré sur un téléphone, il apparaît sur un autre ; ■ depuis n'importe lequel le termine. Une personne ne touche pas au chrono d'une autre (sauf l'arrêt d'un chrono oublié, R9).

**R5. Cocher n'est pas chronométrer.** La case à cocher garde son rôle : cocher une tâche sans chrono l'inscrit à l'historique **sans début ni durée** (« sans chrono », fin = heure du toucher). Ce n'est pas une erreur : c'est ce qui permet à l'historique de fonctionner chronomètre éteint.

**R6. Terminer (■ ou case).** En **une seule écriture groupée** : la tâche est cochée comme aujourd'hui (elle part dans « Faites récemment », avec son bouton « Remettre »), la ligne d'historique est écrite (R7), le chrono est effacé. Cocher la case d'une tâche dont le chrono tourne ou est en pause fait la même chose que ■. Cocher une tâche mère coche ses sous-tâches comme aujourd'hui ; **une seule ligne** d'historique pour la mère, plus une ligne pour chaque sous-tâche dont le chrono était lancé. Supprimer une tâche (≠ la réaliser) **n'écrit rien** dans l'historique et efface son chrono éventuel.

**R7. Historique : une ligne par tâche réalisée.** Nœud `taches-historique/<id>` (**à la racine de la base, hors de `taches/`**, partie 3) : `{liste (id), listeNom (nom au moment), tache (id), texte, by (qui), debut (ms, absent si sans chrono), fin (ms), duree (ms de travail, pauses déduites, absent si sans chrono), pause (ms), chrono (true/false), corr ({by, at} si corrigée à la main)}`, plus un champ facultatif `rattachement` (R12, vide aujourd'hui). La ligne garde le **texte** et le **nom de la liste** tels qu'ils étaient : renommer ou supprimer la tâche ou la liste plus tard ne change pas l'historique. La clé `<id>` est horodatée (ordre chronologique) : l'heure de fin en base 36 sur 9 caractères, puis 5 caractères au hasard. Elle est écrite **dans la même écriture groupée** que la tâche cochée (mise à jour à plusieurs chemins depuis la racine).

**R8. Remettre une tâche faite.** « Remettre » (menu « ⋯ » → Faites récemment) **retire la ligne d'historique** de cette réalisation (lien par le champ `h` de l'enregistrement `faites`) : une tâche remise n'est pas réalisée. Le temps chronométré est perdu (la tâche repart sans chrono). Si « Faites récemment » a déjà effacé l'enregistrement (7 jours), la ligne d'historique reste, c'est le but de l'historique.

**R9. Chrono oublié.** Tant que la personne a l'appli ouverte, l'appareil met à jour `vu` du chrono (au plus toutes les 10 minutes, une écriture de quelques octets). Si un chrono **en marche** a plus de **12 heures** (ou dure depuis la veille), la prochaine ouverture de l'appli par cette personne (ou, à défaut, par n'importe qui pour un chrono qui date de plus de 24 heures) montre la fenêtre de la maquette : « Arrêter à <dernier geste> », « Arrêter maintenant », « Laisser en marche ». Aucun arrêt automatique en silence.

**R10. Correction d'un temps oublié.** Dans l'historique, toucher une ligne ouvre « Corriger » : début, fin et pause modifiables (la durée se recalcule), ou suppression de la ligne. Le champ `corr` garde qui a corrigé et quand. Chacun corrige **ses** lignes ; François (profil « ferme ») corrige toutes les lignes. *Confirmé par François le 27/11.*

**R11. Consulter l'historique.** Écran (feuille sur téléphone, fenêtre sur ordinateur) ouvert par Réglages → « Ouvrir l'historique… » et par « ⋯ » d'une liste → « Historique de cette liste ». Filtres : personne, période (cette semaine par défaut, semaine passée, ce mois, dates au choix), liste, avec ou sans chrono. Il affiche le nombre de tâches et le total chronométré, les plus récentes en premier, par **pages de 50 lignes** (« Afficher la suite ») : la base n'est lue que pour la période demandée (requête sur la clé horodatée), jamais en entier. Numéros de semaine ISO si on affiche des semaines.

**R12. Export tableur.** Bouton « Exporter pour un tableur (.csv) » : fichier `historique-taches-<début>_<fin>.csv` de la **période et des filtres affichés**, encodé UTF-8 avec marque d'ordre (accents corrects dans Excel), séparateur point-virgule, dates `AAAA-MM-JJ HH:MM`, durées en **minutes** (nombre, virgule décimale française). Colonnes : `liste;tâche;personne;début;fin;pause_min;durée_min;chronomètre` (+ `rattachement` quand il existera). Une ligne par tâche réalisée, rien de calculé qui dépende du tableur. Marche hors ligne pour les lignes déjà reçues. Lecture seule : aucune écriture dans la base, aucun envoi.

**R13. Rattachement futur à Ouvre ta ferme.** Le champ `rattachement` ({`source`: "otf", `serie`: identifiant, `nom`}) est **réservé et vide** : aucun appel à OTF, aucune écriture chez OTF dans cette étape. L'étude de l'API d'OTF et le choix de la série à la saisie font l'objet d'une étape à part (règles inchangées : jamais plus de 4 requêtes par seconde, « vas-y » exprès de François pour toute écriture).

**R14. Format commun avec le Cumul.** La Récolte du Cumul (étape 51) réutilisera la **même forme de ligne** (`liste`, `texte`, `by`, `debut`, `fin`, `duree`, `pause`, `chrono`, `rattachement`) dans son propre nœud, avec un champ `outil` ("taches" ou "recolte") : un export réunira les deux. Ce contrat ne code rien côté Cumul.

**R15. Hors ligne et plusieurs appareils.** Démarrer, pause, reprise, ■ sont des écritures comme les autres : elles passent par la file d'attente hors ligne existante (`taches.pending`) et gardent l'heure du **toucher**, pas celle de l'envoi. Le temps affiché se calcule à partir des heures enregistrées (jamais un compteur qui s'incrémente), donc il reste juste appli fermée ou téléphone éteint. Deux appareils qui modifient le même chrono : la dernière écriture gagne, sans perte de ligne d'historique (qui n'est écrite qu'à ■).

**R15bis. Conservation sans limite.** Aucune ligne d'historique n'est jamais effacée par l'appli (choix de François du 27/11, 12 h 44). Les seules suppressions sont celles d'une personne : « Remettre » (R8) et « Supprimer la ligne » dans « Corriger » (R10, après confirmation).

**R15ter. Règle de la base pas encore publiée.** Si la base refuse l'écriture dans `taches-historique/` (règle pas encore publiée), la tâche est quand même cochée : la ligne d'historique est gardée sur l'appareil (clé `taches.histAttente`), un bandeau le dit une fois, et elle est renvoyée à chaque ouverture jusqu'à ce que la base l'accepte.

**R16. Impression et « Faites récemment ».** « Faites récemment » (7 jours, bouton « Remettre ») **reste tel quel**. L'impression des listes ne change pas ; l'historique n'est pas imprimé dans cette étape.

**R17. Plusieurs fermes (règle 15).** Rien de propre à la ferme de François : personnes, listes et noms viennent des données et des Réglages ; la maquette utilise une ferme inventée ; l'export est un fichier standard.

**R18. Les deux apparences.** Classique et pixel art : les boutons, le bandeau, les cartes de l'historique et la fenêtre « chrono oublié » existent dans les deux (maquettes validées sur les deux) ; classique identique au point près quand le mode est éteint ; la police pixel n'ayant pas ⏸ ▶ ■, ils sont dessinés en formes (SVG à angles droits).

## 3. Données et règles de la base

| Nœud | Contenu | Écrit par |
|---|---|---|
| `taches/reglages/chronometre` | `true` si le mode est allumé | profil ferme |
| `taches/chrono/<by>/<tâche>` | `{by, texte, liste, debut, cumul, depuis, etat ("marche"/"pause"), vu}` ; durée = `cumul` + (maintenant − `depuis`) si en marche | la personne |
| `taches-historique/<id>` | ligne de R7, **hors de `taches/`** | la personne (et corrections, R10) |

- **Pourquoi un dossier à part** (choix de François, 27/11) : l'appli suit `taches/` en direct et le relit en entier à chaque ouverture. Un historique sans limite rangé dedans grossirait cette lecture d'année en année. Dans `taches-historique/`, il n'est lu que pour la période affichée (requête sur la clé, ±3 jours de marge), et l'appareil garde une copie des 62 derniers jours pour l'hors-ligne (`taches.histo`).

- **Aucune migration** : les tâches et « Faites récemment » existants ne bougent pas ; l'historique commence le jour de la mise en service (avant : vide, dit clairement à l'écran).
- **Taille** : une ligne ≈ 250 octets ; 15 tâches réalisées par jour ≈ 1,4 Mo par an pour la ferme ; **conservation sans limite** (choix de François, 27/11, 12 h 44) : rien n'est effacé, l'écran de l'historique le dit (« gardé sans limite de durée »).
- **Règles de la base** : elles vivent dans le dépôt `liste-recolte` (`docs/regles-base/fermees.json`). La règle actuelle de `taches/` accepte déjà `taches/chrono` et `taches/reglages/chronometre` (vérifié le 27/11). Le dossier `taches-historique/` demande une **règle nouvelle** (lecture : ferme, équipe, sauvegarde ; écriture : ferme, équipe), ajoutée par une PR dans `liste-recolte` et à publier avec le **« vas-y » exprès de François, après une sauvegarde de la base**. La règle vérifie le profil, pas la personne : « chacun corrige ses lignes » (R10) est tenu par l'appli. Le dossier est ajouté à la **sauvegarde de nuit** (`outils-de-la-ferme`, `sauvegarde/reglages.json`).

## 4. Points confirmés par François (27/11/2026)

1. **Ordinateur** : pas de boutons chrono ; **historique et export disponibles** (selon la recommandation).
2. **Un seul chrono par personne**, le suivant met le précédent en pause (selon la recommandation).
3. **Chrono oublié** : fenêtre à l'ouverture après 12 h, jamais d'arrêt automatique (selon la recommandation).
4. **Corrections** : chacun corrige ses lignes, François toutes (selon la recommandation).
5. **Conservation : sans limite de durée.** François avait d'abord choisi « 2 ans, puis effacement automatique », puis est revenu sur ce choix le 27/11 à 12 h 44 (« OK pour sans limite. »), avant tout code. Aucun effacement automatique n'est codé.

## 5. Tests à prévoir (au codage)

Faux Firebase, heure figée, données inventées, téléphone et ordinateur, classique et pixel art (`APPARENCE=pixel`) : mode éteint = page identique à `origin/main` ; démarrer, pause, reprise, ■ (une écriture groupée, ligne d'historique, tâche dans « Faites récemment », chrono effacé) ; deuxième ▶ met le premier en pause ; cocher sans chrono (ligne « sans chrono ») ; cocher une mère (une ligne + sous-tâches chronométrées) ; suppression (pas de ligne) ; « Remettre » retire la ligne ; temps exact après rechargement et hors ligne ; chrono partagé entre deux appareils ; chrono oublié (3 choix) ; correction et droits (autre personne refusée) ; filtres, pagination, export CSV relu (BOM, `;`, minutes, accents) ; aucun bouton chrono ni changement de liste sur ordinateur ; aucune écriture quand on consulte ou exporte.

## 6. Hors périmètre

Publication de la règle de base (à faire par François ou sur son « vas-y ») ; liaison à Ouvre ta ferme ; chronomètre de la Récolte du Cumul ; rappel « vous avez un chrono en marche » par notification ; tableaux de productivité (graphiques) ; impression de l'historique.
