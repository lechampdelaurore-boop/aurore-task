// Aurore Task : le menu « ⋯ » d'une tâche tient entier dans l'écran d'un petit téléphone, bouton « Fermer » compris,
// sans défilement (demande de François du 20/11 : « on est obligé de scroller pour valider »). Cas les plus hauts :
// tâche d'un jour dans l'encart RDV (avec l'heure), astreinte en RDV (jours, zone, heure, « En pause »), séparateur.
// Écrans : 360×640 et 375×667 (petits Android et iPhone SE), puis Pixel 5. Ordinateur : la fenêtre au milieu, inchangée.
// Lancement depuis la racine du dépôt : node tests/menu-tache.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8966, PORT_BASE = 8967;
const BASE = `http://localhost:${PORT_BASE}`;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', aurore: 'mdp-aurore-1', martin: 'mdp-martin-1' };
const CAPTURES = process.env.CAPTURES || '';

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
const parTexte = (base, texte) => Object.entries(base.lire('taches/t') || {}).find(([, t]) => t.texte === texte);
const ligne = (L, texte) => `.pan[data-l="${L}"] li.t[data-id]:has(> .tx:has-text("${texte}"))`;

async function connecter(page, id) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', id);
  await page.fill('#authMdp', MDP[id]);
  await page.click('#authOk');
}

// Mesure du menu ouvert : défile-t-il, dépasse-t-il de l'écran, « Fermer » est-il entier dans l'écran ?
const mesure = (page) => page.evaluate(() => {
  const d = document.getElementById('tacheDlg'), r = d.getBoundingClientRect();
  const f = d.querySelector('[data-a="fermer"]').getBoundingClientRect();
  const s = d.querySelector('[data-a="supprimer-tache"]').getBoundingClientRect();
  const petits = Array.from(d.querySelectorAll('button:not([disabled]), input, textarea')).filter((b) => b.offsetParent).filter((b) => (b.type === 'checkbox' ? b.closest('label') : b).getBoundingClientRect().height < 36).length; // une case à cocher compte par sa ligne entière
  return { haut: Math.round(r.top), bas: Math.round(r.bottom), H: innerHeight, defile: d.scrollHeight - d.clientHeight, fermerBas: Math.round(f.bottom), supprBas: Math.round(s.bottom), petits };
});

async function essaiTelephone(navigateur, base, nom, options) {
  const ctx = await navigateur.newContext({ ...options, locale: 'fr-FR' });
  const A = await ctx.newPage();
  const erreurs = []; A.on('pageerror', (e) => erreurs.push(String(e)));
  await connecter(A, 'francois');
  await A.waitForSelector('.pan[data-l="astreintes"]');
  await attendreQue(() => A.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  const cas = [
    ['lundi', 'RDV ' + nom, 'tâche d\'un jour en RDV (heure)'],
    ['astreintes', 'Astreinte ' + nom, 'astreinte en RDV (jours, zone, heure, « En pause »)'],
  ];
  // Une tâche dans l'encart RDV du lundi, une astreinte passée en RDV.
  await A.click('#bande .pil[data-l="lundi"]'); await pause(400);
  await A.click('.pan[data-l="lundi"] .encart-tete [data-a="ajouter"][data-e="rdv"]'); await A.waitForSelector('.pan[data-l="lundi"] textarea.ed');
  await A.keyboard.type(cas[0][1]); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  await A.click('#bande .pil[data-l="astreintes"]'); await pause(400);
  await A.click('.pan[data-l="astreintes"] .plus'); await A.waitForSelector('.pan[data-l="astreintes"] textarea.ed');
  await A.keyboard.type(cas[1][1]); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  await attendreQue(() => parTexte(base, cas[0][1]) && parTexte(base, cas[1][1]));
  await A.click(`${ligne('astreintes', cas[1][1])} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-azone="rdv"]'); await A.waitForSelector('#tacheHeure');
  await A.click('#tacheDlg [data-a="fermer"]'); await pause(250);

  for (const [L, texte, quoi] of cas) {
    await A.click(`#bande .pil[data-l="${L}"]`); await pause(400);
    await A.click(`${ligne(L, texte)} .pt`); await A.waitForSelector('#tacheDlg[open]'); await pause(250);
    verifie(await A.evaluate(() => !!document.getElementById('tacheHeure')), `${nom}, ${quoi} : le champ de l'heure est là (cas le plus haut)`);
    const m = await mesure(A);
    console.log(`      ${nom}, ${quoi} : menu de ${m.haut} à ${m.bas} px pour un écran de ${m.H} px, défilement ${m.defile} px, « Fermer » en bas à ${m.fermerBas} px`);
    verifie(m.defile <= 0, `${nom}, ${quoi} : le menu ne défile pas`);
    verifie(m.haut >= 0 && m.bas <= m.H && m.fermerBas <= m.H && m.supprBas <= m.H, `${nom}, ${quoi} : menu entier dans l'écran, « Fermer » et « Supprimer » compris`);
    verifie(m.petits === 0, `${nom}, ${quoi} : aucun bouton de moins de 36 px de haut (gros éléments tactiles)`);
    if (CAPTURES) await A.screenshot({ path: path.join(CAPTURES, `${nom}-${L}.png`) });
    // « Fermer » se touche sans défiler et ferme bien le menu.
    await A.click('#tacheDlg [data-a="fermer"]');
    verifie(await attendreQue(() => A.evaluate(() => !document.getElementById('tacheDlg').open)), `${nom}, ${quoi} : « Fermer » ferme le menu`);
  }
  // Texte très long (plusieurs lignes) : si le menu doit défiler, « Fermer » et « Supprimer » restent collés en bas, visibles.
  await A.click('#bande .pil[data-l="lundi"]'); await pause(400);
  await A.click(`${ligne('lundi', cas[0][1])} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.fill('#tacheTexte', 'Texte long '.repeat(30)); await pause(200);
  const m = await mesure(A);
  verifie(m.fermerBas <= m.H && m.supprBas <= m.H, `${nom}, texte de plusieurs lignes : « Fermer » toujours visible en bas (à ${m.fermerBas} px pour ${m.H} px)`);
  await A.fill('#tacheTexte', cas[0][1]); await A.click('#tacheDlg [data-a="fermer"]'); await pause(200);
  verifie(erreurs.length === 0, `${nom} : aucune erreur dans la page` + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await ctx.close();
}

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.aurore, 'ferme'); base.profil(uid.martin, 'equipe');
  if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
  const navigateur = await chromium.launch();

  const tel = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 5'].userAgent });
  await essaiTelephone(navigateur, base, '360x640', tel(360, 640));
  await essaiTelephone(navigateur, base, '375x667', tel(375, 667));
  await essaiTelephone(navigateur, base, 'Pixel5', devices['Pixel 5']);

  // Ordinateur : la fenêtre reste au milieu, à sa taille d'avant (420 px de large, marges de 18 px, cases de 44 px).
  const ctxP = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const P = await ctxP.newPage();
  await connecter(P, 'aurore');
  await P.waitForSelector('.pan[data-l="lundi"]');
  await P.locator(ligne('lundi', 'RDV 360x640')).hover();
  await P.click(`${ligne('lundi', 'RDV 360x640')} .pt`); await P.waitForSelector('#tacheDlg[open]'); await pause(250);
  const pc = await P.evaluate(() => {
    const d = document.getElementById('tacheDlg'), r = d.getBoundingClientRect(), cs = getComputedStyle(d);
    const act = d.querySelector('.act').getBoundingClientRect().height, btn = d.querySelector('.btn').getBoundingClientRect().height;
    const seg = d.querySelector('.seg button').getBoundingClientRect().height, coul = d.querySelector('.couleurs button').getBoundingClientRect().height;
    return { l: Math.round(r.width), centre: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2, pad: cs.paddingTop, act, btn, seg, coul, poignee: getComputedStyle(d.querySelector('.poignee-f')).display };
  });
  console.log('      ordinateur :', JSON.stringify(pc));
  verifie(pc.l === 420 && pc.centre && pc.pad === '18px' && pc.poignee === 'none', 'ordinateur : fenêtre de 420 px au milieu, marges de 18 px, sans poignée (inchangé)');
  verifie(pc.act === 44 && pc.btn === 44 && pc.seg === 40 && pc.coul === 44, 'ordinateur : lignes et boutons à leur taille d\'avant (44, 44, 40, 44 px)');
  if (CAPTURES) await P.screenshot({ path: path.join(CAPTURES, 'ordinateur.png') });
  await ctxP.close();

  await navigateur.close(); site.close(); base.close();
  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
