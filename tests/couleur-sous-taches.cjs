// Farm tasks, étape 50 : la couleur d'une tâche passe à ses sous-tâches et sous-sous-tâches (contrat
// docs/CONTRAT_COULEUR_SOUS_TACHES.md, cinq points confirmés par François le 21/11/2026). Faux Firebase,
// téléphone (Pixel 5) puis ordinateur (1440×900).
// Lancement depuis la racine du dépôt : node tests/couleur-sous-taches.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
const { PIXEL } = require('./apparence-env.cjs'); // APPARENCE=pixel : le même test dans l'apparence pixel art (étape 53)


const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8980, PORT_BASE = 8981;
const BASE = `http://localhost:${PORT_BASE}`;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', aurore: 'mdp-aurore-1', martin: 'mdp-martin-1' };
const CAPTURES = process.env.CAPTURES || '';
const IDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

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
const jourIdx = () => (new Date().getDay() + 6) % 7;
const tachesBase = (base) => base.lire('taches/t') || {};
const parTexte = (base, texte) => Object.entries(tachesBase(base)).find(([, t]) => t.texte === texte);
const ligne = (L, texte) => `.pan[data-l="${L}"] li.t[data-id]:has(> .tx:has-text("${texte}"))`;
const capture = async (page, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pause(250); await page.screenshot({ path: path.join(CAPTURES, nom) }); } };
async function connecter(page, id) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', id);
  await page.fill('#authMdp', MDP[id]);
  await page.click('#authOk');
}
// Couleur dans la base ('' si absente ou vidée) de chaque identité donnée : « m:rouge s1:rouge … »
const couleurs = (base, ids) => ids.map((k) => k + ':' + ((tachesBase(base)[k] || {}).couleur || '')).join(' ');
const attendCouleurs = (base, attendu) => attendreQue(() => couleurs(base, attendu.split(' ').map((x) => x.split(':')[0])) === attendu);
// Compte les appels à ecrire() de la page (une écriture groupée = 1) et les PATCH reçus par la base.
const compteur = (page) => page.evaluate(() => { if (!window.__ecr) { const o = window.ecrire; window.__ecr = { n: 0 }; window.ecrire = function (c) { window.__ecr.n++; return o(c); }; } window.__ecr.n = 0; });
const nbEcrire = (page) => page.evaluate(() => window.__ecr.n);
const nbPatch = (base, depuis) => base.journal.slice(depuis).filter((x) => x.m === 'PATCH' || x.m === 'PUT').length;

async function menu(page, L, texte) { await page.click(`${ligne(L, texte)} .pt`); await page.waitForSelector('#tacheDlg[open]'); }
async function choisir(page, L, texte, coul) { await menu(page, L, texte); await page.click(`#tacheDlg [data-coul="${coul}"]`); await page.click('#tacheDlg [data-a="fermer"]'); await pause(200); }

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.aurore, 'ferme'); base.profil(uid.martin, 'equipe');
  const navigateur = await chromium.launch();
  const LJ = IDS[jourIdx()], L2 = IDS[(jourIdx() + 1) % 7];

  // ================= Téléphone =================
  const ctxA = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
  const A = await ctxA.newPage();
  const erreursA = []; A.on('pageerror', (e) => erreursA.push(String(e)));
  await connecter(A, 'francois');
  await A.waitForSelector(`.pan[data-l="${LJ}"]`);
  await attendreQue(() => A.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  // Un arbre noir hors encart : Mère > Sous 1 > Sous-sous 1, Sous 2 > Sous-sous 2, séparateur, Sous 3 ; une mère grise
  // ancienne ; deux tâches pour le déplacement ; une tâche témoin ailleurs dans la liste.
  await A.evaluate((LJ) => {
    const t0 = Date.now(), b = { liste: LJ, encart: '', by: 'francois', at: t0 };
    ecrire({
      't/m': { ...b, parent: '', ordre: 1, texte: 'Mère' },
      't/s1': { ...b, parent: 'm', ordre: 1, texte: 'Sous 1' },
      't/ss1': { ...b, parent: 's1', ordre: 1, texte: 'Sous-sous 1' },
      't/s2': { ...b, parent: 'm', ordre: 2, texte: 'Sous 2' },
      't/ss2': { ...b, parent: 's2', ordre: 1, texte: 'Sous-sous 2' },
      't/sep': { ...b, parent: 'm', ordre: 3, texte: '', sep: true },
      't/s3': { ...b, parent: 'm', ordre: 4, texte: 'Sous 3' },
      't/g': { ...b, parent: '', ordre: 2, texte: 'Mère grise', couleur: 'gris' },
      't/g1': { ...b, parent: 'g', ordre: 1, texte: 'Grise 1', couleur: 'gris' },
      't/g2': { ...b, parent: 'g', ordre: 2, texte: 'Rouge à la main', couleur: 'rouge' },
      't/v': { ...b, parent: '', ordre: 3, texte: 'Mère verte', couleur: 'vert' },
      't/r': { ...b, parent: '', ordre: 4, texte: 'Rouge à déplacer', couleur: 'rouge' },
      't/r1': { ...b, parent: 'r', ordre: 1, texte: 'Sous rouge', couleur: 'rouge' },
      't/temoin': { ...b, parent: '', ordre: 5, texte: 'Témoin' },
    });
  }, LJ);
  await A.waitForSelector(ligne(LJ, 'Sous-sous 2'));
  const ARBRE = ['m', 's1', 'ss1', 's2', 'ss2', 'sep', 's3'];
  await attendreQue(() => !!tachesBase(base).temoin);
  await pause(600);

  // 1. Tout noir → Rouge : les six tâches rouges, en une seule écriture ; le séparateur sans couleur ; le témoin intact.
  await compteur(A); let j0 = base.journal.length;
  await choisir(A, LJ, 'Mère', 'rouge');
  verifie(await attendCouleurs(base, 'm:rouge s1:rouge ss1:rouge s2:rouge ss2:rouge sep: s3:rouge temoin:'), '1. « Rouge » sur la mère : mère, sous-tâches et sous-sous-tâches rouges ; séparateur sauté sans couper la descente (Sous 3 rouge) ; témoin intact');
  verifie(await nbEcrire(A) === 1 && nbPatch(base, j0) === 1, `1. une seule écriture groupée (ecrire : ${await nbEcrire(A)}, envois à la base : ${nbPatch(base, j0)})`);
  verifie(await A.evaluate(() => getComputedStyle(document.querySelector('li.t[data-id="ss2"] .tx')).color === 'rgb(176, 42, 55)'), '1. la sous-sous-tâche s\'affiche en rouge');
  await capture(A, '1-telephone-mere-rouge.png');

  // 2. Sous 2 en bleu à la main (avec sa sous-sous-tâche, qui la suivait), puis Mère en vert : Sous 2 et Sous-sous 2 restent bleues.
  await choisir(A, LJ, 'Sous 2', 'bleu');
  verifie(await attendCouleurs(base, 'm:rouge s1:rouge ss1:rouge s2:bleu ss2:bleu s3:rouge'), '2. « Bleu » sur Sous 2 : elle et sa sous-sous-tâche en bleu, le reste de l\'arbre ne bouge pas');
  await choisir(A, LJ, 'Mère', 'vert');
  verifie(await attendCouleurs(base, 'm:vert s1:vert ss1:vert s2:bleu ss2:bleu s3:vert'), '2. « Vert » sur la mère : Sous 2 (bleue à la main) et sa sous-sous-tâche restent bleues ; les sœurs passent en vert');
  await capture(A, '2-telephone-sous-tache-bleue-gardee.png');

  // 3. « Noir » sur la mère : les vertes redeviennent noires (champ vidé), la bleue reste bleue.
  await choisir(A, LJ, 'Mère', '');
  verifie(await attendCouleurs(base, 'm: s1: ss1: s2:bleu ss2:bleu s3:'), '3. « Noir » sur la mère : les sous-tâches qui la suivaient redeviennent noires (champ vidé), la bleue reste bleue');
  // « Noir » = la couleur du texte ordinaire : #111 en classique, brun très foncé #3b2a2f en pixel art.
  verifie(await A.evaluate((P) => getComputedStyle(document.querySelector('li.t[data-id="ss1"] .tx')).color === (P ? 'rgb(59, 42, 47)' : 'rgb(17, 17, 17)'), PIXEL), '3. Sous-sous 1 s\'affiche en noir');

  // 4. Mère grise ancienne recolorée : ses sous-tâches grises suivent, la rouge à la main reste rouge.
  await choisir(A, LJ, 'Mère grise', 'orange');
  verifie(await attendCouleurs(base, 'g:orange g1:orange g2:rouge'), '4. ancienne mère grise en « Orange » : sa sous-tâche grise suit, la rouge reste rouge');

  // 5. Nouvelles sous-tâches. Sous une mère rouge (menu « Ajouter une sous-tâche » puis Entrée enchaînée) : rouges.
  await choisir(A, LJ, 'Mère', 'rouge');
  await attendCouleurs(base, 'm:rouge s1:rouge');
  await menu(A, LJ, 'Mère'); await A.click('#tacheDlg [data-a="sous-tache"]');
  await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.type('Nouvelle A'); await A.keyboard.press('Enter');
  await A.keyboard.type('Nouvelle B'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(() => { const a = parTexte(base, 'Nouvelle A'), b = parTexte(base, 'Nouvelle B'); return a && b && a[1].parent === 'm' && b[1].parent === 'm' && a[1].couleur === 'rouge' && b[1].couleur === 'rouge'; }), '5. sous-tâches créées sous la mère rouge (menu, puis Entrée enchaînée) : rouges dès leur création');
  // La couleur vient de la mère, pas de la sœur précédente : Nouvelle A en bleu, puis Entrée après elle.
  await choisir(A, LJ, 'Nouvelle A', 'bleu');
  await attendreQue(() => parTexte(base, 'Nouvelle A')[1].couleur === 'bleu');
  await A.click(`${ligne(LJ, 'Nouvelle A')} .tx`); await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.press('End'); await A.keyboard.press('Enter');
  await A.keyboard.type('Nouvelle C'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(() => { const c = parTexte(base, 'Nouvelle C'); return c && c[1].parent === 'm' && c[1].couleur === 'rouge'; }), '5. Entrée après une sœur bleue : la nouvelle prend la couleur de la mère (rouge), pas celle de la sœur');
  // Sous une mère noire : aucun champ. Tâche de premier niveau : aucun champ.
  await menu(A, LJ, 'Témoin'); await A.click('#tacheDlg [data-a="sous-tache"]');
  await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.type('Sous témoin'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  await A.click(`.pan[data-l="${LJ}"] .plus`); await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.type('Racine neuve'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(() => { const s = parTexte(base, 'Sous témoin'), r = parTexte(base, 'Racine neuve'); return s && r && s[1].parent === 'temoin' && !('couleur' in s[1]) && r[1].parent === '' && !('couleur' in r[1]); }), '5. sous une mère noire : aucun champ couleur ; tâche de premier niveau : aucun champ couleur');

  // 6. Déplacer « Rouge à déplacer » (et sa sous-tâche) sous la mère verte (« Décaler à droite ») : couleurs inchangées.
  await menu(A, LJ, 'Rouge à déplacer'); await A.click('#tacheDlg [data-a="droite"]'); await pause(200);
  if (await A.evaluate(() => document.getElementById('tacheDlg').open)) { await A.click('#tacheDlg [data-a="fermer"]'); await pause(200); }
  verifie(await attendreQue(() => { const t = tachesBase(base); return t.r.parent === 'v' && t.r.couleur === 'rouge' && t.r1.couleur === 'rouge' && t.v.couleur === 'vert'; }), '6. sous-tâche rouge déplacée sous une mère verte : elle garde sa couleur, sa sous-tâche aussi');
  // Puis la mère verte passe en violet : la rouge ne la suivait pas, elle reste rouge.
  await choisir(A, LJ, 'Mère verte', 'violet');
  verifie(await attendCouleurs(base, 'v:violet r:rouge r1:rouge'), '6. la mère verte recolorée en violet : la sous-tâche rouge déplacée reste rouge');

  // 7. Même couleur rechoisie : zéro écriture.
  await compteur(A); j0 = base.journal.length;
  await choisir(A, LJ, 'Mère', 'rouge');
  await pause(400);
  verifie(await nbEcrire(A) === 0 && nbPatch(base, j0) === 0, `7. « Rouge » rechoisi sur une mère déjà rouge : rien d'écrit (ecrire : ${await nbEcrire(A)}, envois : ${nbPatch(base, j0)})`);
  verifie(await A.evaluate(() => document.querySelectorAll('#tacheDlg [data-coul]').length === 6), '7. menu : six couleurs, comme avant');
  // Aucune autre tâche de la base touchée depuis le début : la tâche témoin et les astreintes n'ont jamais de couleur.
  verifie(!('couleur' in tachesBase(base).temoin), '7. la tâche témoin (hors de l\'arbre) n\'a jamais été écrite');
  verifie(erreursA.length === 0, 'téléphone : aucune erreur dans la page' + (erreursA.length ? ' : ' + erreursA.join(' | ') : ''));

  // ================= Ordinateur =================
  const ctxP = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const P = await ctxP.newPage();
  const erreursP = []; P.on('pageerror', (e) => erreursP.push(String(e)));
  await connecter(P, 'aurore');
  await P.waitForSelector(ligne(LJ, 'Sous-sous 1'));
  await attendreQue(() => P.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await compteur(P); j0 = base.journal.length;
  await choisir(P, LJ, 'Mère', 'orange');
  verifie(await attendCouleurs(base, 'm:orange s1:orange ss1:orange s2:bleu ss2:bleu s3:orange'), 'ordinateur : « Orange » sur la mère : l\'arbre suit, la bleue reste bleue');
  verifie(await nbEcrire(P) === 1 && nbPatch(base, j0) === 1, 'ordinateur : une seule écriture groupée');
  verifie(await attendreQue(() => A.evaluate(() => getComputedStyle(document.querySelector('li.t[data-id="ss1"] .tx')).color === 'rgb(161, 77, 6)')), 'le téléphone de François voit Sous-sous 1 en orange (partage en direct)');
  await capture(P, '3-ordinateur-mere-orange.png');

  // Liste verrouillée : plus de menu sur les tâches, et rien n'est écrit même si on appelait la fonction.
  await P.evaluate((L) => ecrire({ ['listes/' + L + '/verrou']: { by: 'aurore', at: Date.now() } }), LJ);
  await attendreQue(() => P.evaluate((L) => !document.querySelector(`.pan[data-l="${L}"] li.t .pt`), LJ));
  await compteur(P);
  await P.evaluate(() => colorerTache('m', 'vert'));
  verifie(await P.evaluate((L) => !document.querySelector(`.pan[data-l="${L}"] li.t .pt`), LJ) && await nbEcrire(P) === 0 && (tachesBase(base).m || {}).couleur === 'orange', 'liste verrouillée : pas de menu (donc pas de pastilles), rien d\'écrit');
  verifie(erreursP.length === 0, 'ordinateur : aucune erreur dans la page' + (erreursP.length ? ' : ' + erreursP.join(' | ') : ''));

  await navigateur.close(); site.close(); base.close();
  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
