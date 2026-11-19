// Horloge du rappel du matin (étape 45B) : un tout petit « Worker » Cloudflare, à part du site, réveillé toutes les
// 5 minutes par un déclencheur planifié (« Cron Trigger » : */5 * * * *). Il ne fait qu'une chose : appeler
// POST <site>/rappel/tic. C'est le programme du site (functions/rappel/[[chemin]].js) qui décide quoi envoyer.
// Aucun secret ici. Réglage facultatif : SITE (adresse du site d'Aurore Task), sinon celle écrite ci-dessous.
// Pas-à-pas : docs/PAS_A_PAS_RAPPEL.md.
const SITE_PAR_DEFAUT = 'https://aurore-task.pages.dev';

export default {
  async scheduled(evenement, env, ctx) {
    const site = String(env.SITE || SITE_PAR_DEFAUT).replace(/\/+$/, '');
    ctx.waitUntil(fetch(site + '/rappel/tic', { method: 'POST' }).then((r) => r.text()).then((t) => console.log(t.trim())));
  },
  // Ouvrir l'adresse du Worker dans un navigateur : dit seulement à quoi il sert.
  async fetch() {
    return new Response('Horloge du rappel du matin d\'Aurore Task : appelle /rappel/tic toutes les 5 minutes.\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
