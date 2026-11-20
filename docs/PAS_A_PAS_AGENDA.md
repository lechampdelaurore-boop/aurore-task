# Pas-à-pas : brancher Google Agenda (étape 36D)

*Gratuit. L'adresse secrète de l'agenda est saisie par François seul ; Claude ne la voit jamais.*

## Ce qui tourne

- `functions/agenda/[[chemin]].js` : programme servi avec le site sous `/agenda/…` (déployé tout seul avec le site). Il lit l'agenda seulement quand quelqu'un de la ferme touche le bouton agenda, et seulement pour un compte qui ouvre les tâches.
- Un seul réglage : le secret Cloudflare `AGENDA_ICAL`, l'« adresse secrète au format iCal » de l'agenda (plusieurs agendas : plusieurs adresses séparées par un espace).

## Étapes

1. **François** copie l'adresse secrète de l'agenda : sur un ordinateur, Google Agenda → roue dentée → Paramètres → à gauche, sous « Paramètres de mes agendas », l'agenda voulu → « Intégrer l'agenda » → **« Adresse secrète au format iCal »** → copier (bouton à droite).
2. **François** la colle dans Cloudflare : Workers & Pages → projet `aurore-task` → Settings → Variables and Secrets → Add → type **Secret**, nom `AGENDA_ICAL`, valeur : l'adresse copiée → Save. (Claude peut préparer l'écran avec le type et le nom ; François colle la valeur.)
3. **Claude** relance le dernier déploiement (Deployments → « ⋯ » → Retry deployment) et vérifie `https://aurore-task.pages.dev/agenda/etat` : « AGENDA PRÊT ».
4. **Essai** : dans Aurore Task, toucher l'icône agenda de la barre du haut. Le bandeau dit combien de rendez-vous ont été posés.

## Si l'adresse fuit

Dans Google Agenda, même écran : « Réinitialiser » l'adresse secrète, puis recommencer l'étape 2 avec la nouvelle.
