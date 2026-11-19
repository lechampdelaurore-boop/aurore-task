// Clé web reprise du site du Cumul : ce dépôt n'a pas sa propre clé (cle-web.js vide), la page charge alors
// https://liste-recolte.pages.dev/cle-web.js (même base Firebase). Ici ce fichier distant est simulé.
// Vérifie : clé vide + fichier distant présent → fenêtre de connexion ; fichier distant absent → « pas encore ouverte » ;
// clé locale présente → le fichier distant n'est pas demandé.
// Lancement depuis la racine du dépôt : node tests/cle-reprise.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const PORT = 8966, SITE = `http://localhost:${PORT}`;
const DISTANT = 'https://liste-recolte.pages.dev/cle-web.js';
let cleLocale = '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

let echecs = 0;
function verifie(cond, msg) { console.log((cond ? 'OK    ' : 'ÉCHEC ') + msg); if (!cond) echecs++; }

(async () => {
  const site = http.createServer((q, r) => {
    let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (f.endsWith('/')) f += 'index.html';
    if (f === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end("window.RECOLTE_DB_URL='http://localhost:1';"); }
    if (f === '/cle-web.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_CLE_WEB = '${cleLocale}';`); }
    const chemin = path.join(RACINE, f);
    if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(chemin)] || 'application/octet-stream' });
    fs.createReadStream(chemin).pipe(r);
  });
  await new Promise((ok) => site.listen(PORT, ok));
  const nav = await chromium.launch();

  async function essai(distant) {
    const ctx = await nav.newContext({ serviceWorkers: 'block' });
    let demande = 0;
    await ctx.route(DISTANT, (rt) => { demande++; return distant ? rt.fulfill({ status: 200, contentType: 'text/javascript', body: `window.RECOLTE_CLE_WEB='${distant}';` }) : rt.fulfill({ status: 404, body: '' }); });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => (rt.request().url() === DISTANT ? rt.fallback() : rt.abort()));
    const p = await ctx.newPage();
    await p.goto(SITE + '/');
    await p.waitForTimeout(800);
    const r = { demande, cle: await p.evaluate(() => window.RECOLTE_CLE_WEB), auth: await p.locator('#authDlg[open]').count(), texte: await p.evaluate(() => document.body.innerText) };
    await ctx.close();
    return r;
  }

  cleLocale = '';
  let r = await essai('cle-du-cumul');
  verifie(r.demande === 1 && r.cle === 'cle-du-cumul', 'clé locale vide : la clé est reprise du site du Cumul');
  verifie(r.auth === 1 && !/pas encore ouverte/.test(r.texte), 'la fenêtre de connexion s\'ouvre');

  r = await essai('');
  verifie(r.demande === 1 && r.auth === 0 && /pas encore ouverte/.test(r.texte), 'site du Cumul injoignable : « pas encore ouverte », sans plantage');

  cleLocale = 'cle-locale';
  r = await essai('cle-du-cumul');
  verifie(r.demande === 0 && r.cle === 'cle-locale' && r.auth === 1, 'clé collée un jour dans ce dépôt : elle reste prioritaire, rien n\'est demandé ailleurs');

  await nav.close(); site.close();
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
