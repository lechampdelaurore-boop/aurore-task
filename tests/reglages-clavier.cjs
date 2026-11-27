// Farm tasks : en ouvrant les Réglages, aucun champ n'est pris d'office (demande de François du 27/11/2026 : sur le
// téléphone, menu « F » → Réglages ouvrait la page déjà dans le champ « Nom affiché en haut », clavier sorti).
// Vérifie, sur le téléphone (Pixel 5 et 360×640) et l'ordinateur, que rien de saisissable n'a le focus à l'ouverture,
// qu'aucun contour de focus ne se voit, que Tab mène toujours au premier champ et que « Ajouter une personne »
// met toujours dans le prénom. Tourne aussi en pixel art : APPARENCE=pixel node tests/reglages-clavier.cjs
// Lancement depuis la racine du dépôt : node tests/reglages-clavier.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
require('./apparence-env.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 9002, PORT_BASE = 9003;
const BASE = `http://localhost:${PORT_BASE}`;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1' };

function serveurSite() {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (f.endsWith('/')) f += 'index.html';
      if (f === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_DB_URL='${BASE}';window.RECOLTE_AUTH_URL='${BASE}/v1';window.RECOLTE_JETON_URL='${BASE}/v1';`); }
      if (f === '/cle-web.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_CLE_WEB='${CLE}';`); }
      const chemin = path.join(RACINE, f);
      if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(chemin)] || 'application/octet-stream' });
      fs.createReadStream(chemin).pipe(r);
    });
    s.listen(PORT_SITE, () => ok(s));
  });
}

let echecs = 0;
function verifie(cond, msg) { console.log((cond ? 'OK    ' : 'ÉCHEC ') + msg); if (!cond) echecs++; }
const attendreQue = async (fn, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { if (await fn()) return true; } catch (e) { /* page en cours */ } await new Promise((x) => setTimeout(x, 120)); } return false; };
const pause = (ms) => new Promise((x) => setTimeout(x, ms));

// Ce qui a le focus : un champ où l'on écrit fait sortir le clavier du téléphone.
const focus = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const saisie = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  const cs = a ? getComputedStyle(a) : null;
  return { tag: a ? a.tagName : '', id: a ? a.id : '', saisie, dansRegl: !!a && !!a.closest('#reglDlg'), contour: cs ? cs.outlineStyle + ' ' + cs.outlineWidth : '' };
});

async function essai(navigateur, nom, options) {
  const ctx = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const P = await ctx.newPage();
  const erreurs = []; P.on('pageerror', (e) => erreurs.push(String(e)));
  await P.goto(SITE + '/');
  await P.waitForSelector('#authDlg[open]');
  await P.fill('#authId', 'francois'); await P.fill('#authMdp', MDP.francois); await P.click('#authOk');
  await P.waitForSelector('.pan[data-l="lundi"]');
  await attendreQue(() => P.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  const pc = await P.evaluate(() => matchMedia('(min-width: 1000px)').matches);
  for (let fois = 1; fois <= 2; fois++) {
    if (pc) await P.click('.menu [data-a="reglages"]');
    else { await P.click('#avatar'); await P.waitForSelector('#compteDlg[open]'); await P.click('#versReglages'); }
    await P.waitForSelector('#reglDlg[open]'); await pause(400);
    const f = await focus(P);
    console.log(`      ${nom}, ouverture n° ${fois} : focus sur ${JSON.stringify(f)}`);
    verifie(!f.saisie, `${nom}, ouverture n° ${fois} des Réglages : aucun champ n'a le focus (pas de clavier)`);
    verifie(f.dansRegl && /none|0px/.test(f.contour), `${nom}, ouverture n° ${fois} : le focus reste dans les Réglages, sans contour visible`);
    await P.click('#reglDlg [data-a="fermer"]'); await pause(250);
  }
  // Clavier physique : Tab mène toujours au premier champ, « Ajouter une personne » met toujours dans le prénom.
  if (pc) await P.click('.menu [data-a="reglages"]'); else { await P.click('#avatar'); await P.click('#versReglages'); }
  await P.waitForSelector('#reglDlg[open]'); await pause(300);
  await P.keyboard.press('Tab');
  verifie((await focus(P)).id === 'reglNom', `${nom} : Tab mène au champ « Nom affiché en haut »`);
  await P.click('#reglAjPers'); await pause(150);
  verifie(await P.evaluate(() => document.activeElement === document.querySelector('#reglPers').lastElementChild.querySelector('.p-nom')), `${nom} : « Ajouter une personne » met toujours dans le prénom`);
  await P.click('#reglDlg [data-a="fermer"]'); await pause(250);
  verifie(erreurs.length === 0, `${nom} : aucune erreur dans la page` + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await ctx.close();
}

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = base.creerCompte('francois@ferme.invalid', MDP.francois);
  base.profil(uid, 'ferme');
  const navigateur = await chromium.launch();
  await essai(navigateur, 'téléphone Pixel 5 (« F » → Réglages)', devices['Pixel 5']);
  await essai(navigateur, 'téléphone 360×640 (« F » → Réglages)', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 5'].userAgent });
  await essai(navigateur, 'ordinateur 1440×900', { viewport: { width: 1440, height: 900 } });
  await navigateur.close(); site.close(); base.close();
  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
