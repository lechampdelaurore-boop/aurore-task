# Pas-à-pas : mettre en service le rappel du matin (étape 45B)

*Rien de payant : offre gratuite de Cloudflare (Pages Functions et un Worker avec déclencheur planifié) et de Firebase. Les secrets sont saisis par François seul ; Claude ne les voit jamais.*

## Ce qui tourne

- `functions/rappel/[[chemin]].js` : programme servi avec le site sous `/rappel/…` (déployé tout seul avec le site).
- `cloudflare/horloge-rappel.js` : un tout petit Worker à part, « rappel-horloge », réveillé toutes les 5 minutes (`*/5 * * * *`), qui appelle `POST <site>/rappel/tic`. Sans secret.
- Compte Firebase `rappel@ferme.invalid`, profil `rappel` : lit `taches/`, écrit `taches/lu` et `taches/abonnements`, lit et écrit `rappel/` (paire de clés d'envoi créée par le programme, envois du jour). Règle dans le dépôt `liste-recolte`, `docs/regles-base/fermees.json`.

## Étapes

1. **François** crée le compte dans la console Firebase : Authentication → Users → Add user ; adresse `rappel@ferme.invalid`, mot de passe de son choix (long, au hasard). Il le garde pour l'étape 3. Il donne à Claude l'identifiant du compte créé (UID, une suite de lettres et de chiffres : ce n'est pas un secret).
2. **Claude** (autorisation écrite de François du 19/11) : exporte une sauvegarde de la base, pose le profil `rappel` sous `profils/<UID>`, publie la règle (texte de `fermees.json` du dépôt `liste-recolte`, vérifié identique après rechargement).
3. **François** saisit le secret dans Cloudflare : Workers & Pages → projet `aurore-task` → Settings → Variables and Secrets → Add → type **Secret**, nom `RAPPEL_MDP`, valeur : le mot de passe de l'étape 1 → Save. Puis Deployments → dernier déploiement → « Retry deployment » (Claude peut le faire).
4. **Claude** crée le Worker « rappel-horloge » (Workers & Pages → Create → Worker → Hello World → Deploy, puis Edit code : coller `cloudflare/horloge-rappel.js` → Deploy), lui ajoute la variable `SITE` (adresse du site) si elle diffère de `https://aurore-task.pages.dev`, et le déclencheur : Settings → Trigger events → Add → Cron trigger → `*/5 * * * *`.
5. **Vérification** : `https://<site>/rappel/etat` doit dire « RAPPEL PRÊT ». Puis, sur chaque téléphone : Aurore Task → Réglages → « Rappel du matin » → cocher, régler l'heure → « Recevoir sur ce téléphone » → « Envoyer un essai ».

## iPhone

Les notifications d'une appli web n'arrivent sur iPhone (iOS 16.4 et plus) que si Aurore Task est **ajoutée à l'écran d'accueil** et ouverte depuis son icône. Pas de bouton sous la notification sur iPhone : la toucher ouvre l'appli, qui montre « J'ai lu ma liste » en haut.
