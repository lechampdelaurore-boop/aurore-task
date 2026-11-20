// Aurore Task, étape 36B : encarts RDV / P1 / P2 dans les listes des jours, heure des rendez-vous (triés par heure),
// « Pour qui ? » (pastille ronde de la personne), couleur du texte, changement de zone, encart vide supprimé à la main
// et rajouté par le menu de la liste, glisser d'un encart à l'autre, verrou (liste figée sur tous les appareils),
// Réglages (nom affiché, personnes, noms des encarts) sur la base, fichier de départ de la ferme.
// Lancement depuis la racine du dépôt : node tests/taches-encarts.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8962, PORT_BASE = 8963;
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

// Contenu affiché d'une liste, encart par encart : « rdv: 08:00 Banque, 09:30 Véto | p1: … »
const encarts = (page, L) => page.evaluate((L) => Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart`)).map((e) => e.dataset.e + ': ' + Array.from(e.querySelectorAll('li.t[data-id]')).map((li) => (li.querySelector('.tx') || {}).textContent).join(', ')).join(' | '), L);
const tachesBase = (base) => base.lire('taches/t') || {};
const parTexte = (base, texte) => Object.entries(tachesBase(base)).find(([, t]) => t.texte === texte);
const ligne = (L, texte) => `.pan[data-l="${L}"] li.t[data-id]:has(> .tx:has-text("${texte}"))`;

async function connecter(page, id) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', id);
  await page.fill('#authMdp', MDP[id]);
  await page.click('#authOk');
}
async function glisserDoigt(cdp, x, y, x2, y2) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await pause(650);
  for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (x2 - x) * i / 14, y: y + (y2 - y) * i / 14 }] }); await pause(25); }
  await pause(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(250);
}
const centre = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.aurore, 'ferme'); base.profil(uid.martin, 'equipe');

  // ---------- Fichier de départ de la ferme, rien de la ferme dans le code ----------
  const depart = JSON.parse(fs.readFileSync(path.join(RACINE, 'referentiel/taches-depart.json'), 'utf8'));
  verifie(depart.nom && ['francois', 'aurore', 'martin'].every((k) => depart.personnes[k] && depart.personnes[k].nom && depart.personnes[k].initiale) && depart.personnes.aurore.couleur === 'rose' && depart.personnes.martin.couleur === 'bleu' && depart.personnes.francois.couleur === 'rouge', 'fichier de départ : nom de la ferme, trois personnes (Aurore rose, Martin bleu, François rouge)');
  verifie(depart.encarts && depart.encarts.rdv === 'RDV' && depart.encarts.p1 === 'P1' && depart.encarts.p2 === 'P2', 'fichier de départ : noms des encarts RDV, P1, P2');
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  verifie(!/Champ de l'Aurore|Tronget|François|Aurore'|Martin/.test(html.replace(/Aurore Task/g, '')), 'rien de propre à la ferme dans le code (prénoms et nom lus dans le fichier de départ)');
  verifie(/taches-depart\.json/.test(fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8')), 'le fichier de départ est gardé pour le mode hors ligne');

  const navigateur = await chromium.launch();
  const ctxA = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
  const A = await ctxA.newPage();
  const erreursA = []; A.on('pageerror', (e) => erreursA.push(String(e)));
  const cdpA = await ctxA.newCDPSession(A);
  await connecter(A, 'francois');
  const LJ = IDS[jourIdx()], L2 = IDS[(jourIdx() + 1) % 7];
  verifie(await attendreQue(() => A.evaluate((L) => document.querySelectorAll(`.pan[data-l="${L}"] .encart`).length === 3, LJ)), 'liste du jour : trois encarts');
  verifie(await attendreQue(() => A.evaluate((L) => Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart-tete .etiq`)).map((x) => x.textContent).join(' ') === 'RDV P1 P2', LJ)), 'dans l\'ordre RDV, P1, P2 (noms du fichier de départ)');
  verifie(await A.evaluate(() => !document.querySelector('.pan[data-l="astreintes"] .encart-tete')), 'la liste Astreintes n\'a pas d\'encarts');
  verifie(await attendreQue(() => A.evaluate(() => document.getElementById('nomFerme').textContent === "Le Champ de l'Aurore")), 'nom de la ferme en haut, lu dans le fichier de départ');
  verifie(await A.evaluate(() => { const a = document.getElementById('avatar'); return a.textContent === 'F' && getComputedStyle(a).backgroundColor === 'rgb(251, 224, 227)'; }), 'pastille du compte : initiale et couleur de la personne (rouge)');

  // ---------- « + » du haut : hors des encarts, au-dessus de RDV (19/11) ; « + » d'un encart : dans cet encart ----------
  await A.click(`.pan[data-l="${LJ}"] .plus`);
  await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.type('Désherber carottes'); await A.keyboard.press('Enter');
  await A.keyboard.type('Commander terreau'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(() => { const a = parTexte(base, 'Désherber carottes'), b = parTexte(base, 'Commander terreau'); return a && b && a[1].encart === '' && b[1].encart === ''; }), '« + » du haut : les tâches vont hors des encarts (en rafale)');
  verifie(await attendreQue(async () => (await encarts(A, LJ)).startsWith(': Désherber carottes, Commander terreau | rdv:  | p1:  | p2: ')), 'affichées en haut de la liste, au-dessus de RDV, sans étiquette');
  // Puis on la glisse où on veut : « Désherber carottes » dans P1, au doigt.
  const dh = await centre(A, `${ligne(LJ, 'Désherber carottes')} .tx`), p1t = await centre(A, `.pan[data-l="${LJ}"] .encart[data-e="p1"] .encart-tete`);
  await glisserDoigt(cdpA, dh.x, dh.y, dh.x, p1t.b.y); // la ligne soulevée laisse sa place : P1 remonte d'une ligne
  verifie(await attendreQue(() => parTexte(base, 'Désherber carottes')[1].encart === 'p1'), 'puis glissée au doigt dans P1');
  // « + » des encarts : même aspect que le « + » de la liste (rond vert plein sur le téléphone).
  verifie(await A.evaluate((L) => { const a = getComputedStyle(document.querySelector(`.pan[data-l="${L}"] .plus`)), b = getComputedStyle(document.querySelector(`.pan[data-l="${L}"] .encart-tete [data-a="ajouter"]`)); return a.backgroundColor === b.backgroundColor && a.color === b.color && b.backgroundColor === 'rgb(11, 105, 77)' && b.borderRadius === '50%'; }, LJ), 'téléphone : le « + » des encarts a le même aspect que le « + » de la liste (rond vert plein, « + » blanc)');
  await A.click(`${ligne(LJ, 'Commander terreau')} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-zone="p1"]'); await A.click('#tacheDlg [data-a="fermer"]'); await pause(200);
  verifie(await attendreQue(() => parTexte(base, 'Commander terreau')[1].encart === 'p1'), 'ou rangée par « Zone du jour » (menu de la tâche) : P1');
  await A.click(`.pan[data-l="${LJ}"] .encart-tete [data-a="ajouter"][data-e="rdv"]`);
  await A.waitForSelector(`.pan[data-l="${LJ}"] .encart[data-e="rdv"] textarea.ed`);
  await A.keyboard.type('Véto'); await A.keyboard.press('Enter');
  await A.keyboard.type('Banque'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(() => { const a = parTexte(base, 'Véto'), b = parTexte(base, 'Banque'); return a && b && a[1].encart === 'rdv' && b[1].encart === 'rdv'; }), '« + » de l\'encart RDV : les tâches vont dans RDV');

  // ---------- Menu de la tâche : heure, pour qui, couleur, zone ----------
  const menu = async (texte) => { await A.click(`${ligne(LJ, texte)} .pt`); await A.waitForSelector('#tacheDlg[open]'); };
  const fermer = async () => { await A.click('#tacheDlg [data-a="fermer"]'); await pause(200); };
  await menu('Véto');
  verifie(await A.evaluate(() => ['Pour qui ?', 'Zone du jour', 'Heure du rendez-vous', 'Couleur du texte'].every((t) => document.getElementById('tacheDlg').textContent.includes(t))), 'menu d\'une tâche RDV : pour qui, zone, heure, couleur du texte');
  await A.fill('#tacheHeure', '09:30'); await A.dispatchEvent('#tacheHeure', 'change'); await fermer();
  await menu('Banque');
  await A.fill('#tacheHeure', '08:00'); await A.dispatchEvent('#tacheHeure', 'change'); await fermer();
  verifie(await attendreQue(() => parTexte(base, 'Véto')[1].heure === '09:30' && parTexte(base, 'Banque')[1].heure === '08:00'), 'heure enregistrée dans la base');
  verifie(await attendreQue(async () => (await encarts(A, LJ)).startsWith('rdv: 08:00 Banque, 09:30 Véto')), 'RDV triés par heure, heure en tête de ligne');

  await menu('Désherber carottes');
  verifie(await A.evaluate(() => !document.getElementById('tacheHeure')), 'pas d\'heure hors de RDV');
  verifie(await A.evaluate(() => Array.from(document.querySelectorAll('#tacheDlg [data-pour]')).map((b) => b.textContent).join(',') === 'Tout le monde,FFrançois,AAurore,MMartin'), '« Pour qui ? » : Tout le monde et les trois personnes avec leur pastille');
  await A.click('#tacheDlg [data-pour="aurore"]');
  await A.click('#tacheDlg [data-coul="rouge"]');
  await fermer();
  verifie(await attendreQue(() => parTexte(base, 'Désherber carottes')[1].pour === 'aurore' && parTexte(base, 'Désherber carottes')[1].couleur === 'rouge'), 'pour Aurore, texte rouge : dans la base');
  // Couleurs proposées : le gris remplacé par le bleu (demande du 20/11) ; une tâche déjà grise reste affichée en gris.
  verifie(await A.evaluate(() => { const b = Array.from(document.querySelectorAll('#tacheDlg [data-coul]')); return b.length === 6 && b.map((x) => x.getAttribute('aria-label')).join(',') === 'Noir,Rouge,Orange,Vert,Violet,Bleu' && !document.querySelector('#tacheDlg [data-coul="gris"]') && getComputedStyle(document.querySelector('#tacheDlg [data-coul="bleu"]')).color === 'rgb(26, 95, 180)'; }), 'couleurs du texte : six choix, le dernier est le bleu (plus de gris)');
  const tx = async () => A.evaluate((id) => getComputedStyle(document.querySelector(`li.t[data-id="${id}"] .tx`)).color, parTexte(base, 'Désherber carottes')[0]);
  await menu('Désherber carottes'); await A.click('#tacheDlg [data-coul="bleu"]'); await fermer();
  verifie(await attendreQue(() => parTexte(base, 'Désherber carottes')[1].couleur === 'bleu') && await tx() === 'rgb(26, 95, 180)', 'texte bleu : « bleu » dans la base, affiché en bleu');
  await A.evaluate((id) => changerTache(id, 'couleur', 'gris'), parTexte(base, 'Désherber carottes')[0]);
  verifie(await attendreQue(() => parTexte(base, 'Désherber carottes')[1].couleur === 'gris') && await attendreQue(async () => await tx() === 'rgb(95, 95, 95)'), 'tâche déjà en gris (avant le 20/11) : toujours affichée en gris');
  await menu('Désherber carottes');
  verifie(await A.evaluate(() => !document.querySelector('#tacheDlg [data-coul][aria-pressed="true"]')), 'tâche grise : aucun choix allumé dans le menu, un toucher la passe dans une autre couleur');
  await A.click('#tacheDlg [data-coul="rouge"]'); await fermer();
  await attendreQue(() => parTexte(base, 'Désherber carottes')[1].couleur === 'rouge');
  verifie(await A.evaluate((s) => { const li = document.querySelector(s); const p = li.querySelector('.pastille'); return p && p.textContent === 'A' && getComputedStyle(p).borderRadius === '50%' && getComputedStyle(p).backgroundColor === 'rgb(251, 227, 239)' && getComputedStyle(li.querySelector('.tx')).color === 'rgb(176, 42, 55)'; }, `li.t[data-id="${parTexte(base, 'Désherber carottes')[0]}"]`), 'pastille ronde « A » rose à droite, texte en rouge');

  await menu('Commander terreau');
  await A.click('#tacheDlg [data-zone="p2"]'); await fermer();
  verifie(await attendreQue(() => parTexte(base, 'Commander terreau')[1].encart === 'p2'), 'changer de zone : la tâche passe en P2');
  verifie(await attendreQue(async () => /p2: Commander terreau$/.test(await encarts(A, LJ))), 'et s\'affiche dans P2');

  // ---------- Sous-tâche : reste dans l'encart de sa mère ----------
  await menu('Désherber carottes');
  await A.click('#tacheDlg [data-a="sous-tache"]');
  await A.waitForSelector(`.pan[data-l="${LJ}"] textarea.ed`);
  await A.keyboard.type('Rang nord'); await A.keyboard.press('Enter'); await A.keyboard.press('Escape');
  verifie(await attendreQue(async () => /p1: Désherber carottes, Rang nord \|/.test(await encarts(A, LJ))), 'une sous-tâche reste dans l\'encart de sa tâche mère');

  // ---------- Glisser au doigt d'un encart à l'autre ----------
  const de = await centre(A, `${ligne(LJ, 'Commander terreau')} .tx`);
  const vers = await centre(A, `.pan[data-l="${LJ}"] .encart[data-e="p1"] ${'li.t[data-id]'}:last-child`);
  await glisserDoigt(cdpA, de.x, de.y, de.x, vers.b.y + vers.b.height - 4);
  verifie(await attendreQue(() => parTexte(base, 'Commander terreau')[1].encart === 'p1'), 'glisser au doigt de P2 vers P1 : la tâche change d\'encart');
  verifie(await attendreQue(async () => (await encarts(A, LJ)).includes('p2: ')), 'P2 vide reste affiché (on ne le supprime qu\'à la main)');

  // ---------- Encart vide : supprimé à la main, rajouté par le menu de la liste ----------
  if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await A.screenshot({ path: path.join(CAPTURES, 'telephone-encart-vide.png') }); }
  // Plus de petit lien « Supprimer l'encart » sous l'encart (un toucher le supprimait) : il est dans le menu « ⋯ » de la liste (19/11).
  verifie(await A.evaluate((L) => { const p = document.querySelector(`.pan[data-l="${L}"]`); return !p.querySelector('.encart-tete [data-a*="suppr"]') && !/Supprimer l'encart/.test(p.querySelector('.bloc').textContent); }, LJ), 'plus de « Supprimer l\'encart » collé au « + » de l\'encart');
  await A.click(`.pan[data-l="${LJ}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  verifie(await A.evaluate(() => { const d = document.getElementById('listeDlg'); return d.textContent.includes('Supprimer l\'encart P2') && !!d.querySelector('[data-a="supprimer-encart"][data-e="p2"]') && !d.querySelector('[data-a="supprimer-encart"][data-e="p1"]') && !d.querySelector('[data-a="supprimer-encart"][data-e="rdv"]'); }), 'menu « ⋯ » de la liste : « Supprimer l\'encart P2 » (vide), rien pour P1 ni RDV (pas vides)');
  if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await A.screenshot({ path: path.join(CAPTURES, 'telephone-menu-supprimer-encart.png') }); }
  verifie(await A.evaluate((L) => !!document.querySelector(`.pan[data-l="${L}"] .encart[data-e="p2"]`), LJ), 'ouvrir le menu ne supprime rien');
  await A.click('#listeDlg [data-a="supprimer-encart"][data-e="p2"]');
  verifie(await attendreQue(() => { const e = base.lire(`taches/listes/${LJ}/encarts`); return e && e.p2 === false && e.p1 === true && e.rdv === true; }), 'encart P2 supprimé (dans la base)');
  verifie(await attendreQue(() => A.evaluate((L) => !document.querySelector(`.pan[data-l="${L}"] .encart[data-e="p2"]`), LJ)), 'et plus affiché');
  await A.click(`.pan[data-l="${LJ}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  verifie(await A.evaluate(() => document.getElementById('listeDlg').textContent.includes('Ajouter l\'encart P2')), 'menu de la liste : « Ajouter l\'encart P2 »');
  await A.click('#listeDlg [data-a="ajouter-encart"][data-e="p2"]');
  verifie(await attendreQue(() => base.lire(`taches/listes/${LJ}/encarts/p2`) === true), 'encart P2 rajouté');
  verifie(await attendreQue(() => A.evaluate((L) => !!document.querySelector(`.pan[data-l="${L}"] .encart[data-e="p2"]`), LJ)), 'et de nouveau affiché');
  if (await A.evaluate(() => document.getElementById('listeDlg').open)) await A.click('#listeDlg [data-a="fermer"]');
  await pause(200);

  // ---------- Tâches d'avant les encarts (36A) : gardées, en haut, sans étiquette ----------
  await A.evaluate((L) => ecrire({ ['t/ancienne1']: { liste: L, parent: '', ordre: 1, texte: 'Tâche d\'avant', by: 'francois', at: Date.now() } }), LJ);
  verifie(await attendreQue(async () => (await encarts(A, LJ)).startsWith(": Tâche d'avant | rdv:")), 'une tâche sans encart (écrite avant 36B) reste affichée, au-dessus des encarts');

  // ---------- Verrou ----------
  const ctxB = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
  const B = await ctxB.newPage();
  const erreursB = []; B.on('pageerror', (e) => erreursB.push(String(e)));
  await connecter(B, 'martin');
  await B.waitForSelector(`.pan[data-l="${LJ}"] li.t[data-id]`);
  verifie(await attendreQue(() => B.evaluate(() => document.getElementById('avatar').textContent === 'M' && getComputedStyle(document.getElementById('avatar')).backgroundColor === 'rgb(225, 234, 255)')), 'Martin : sa pastille bleue en haut');
  await A.click(`.pan[data-l="${LJ}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  await A.click('#listeDlg [data-a="verrouiller"]');
  if (await A.evaluate(() => document.getElementById('listeDlg').open)) await A.click('#listeDlg [data-a="fermer"]');
  verifie(await attendreQue(() => { const v = base.lire(`taches/listes/${LJ}/verrou`); return v && v.by === 'francois'; }), 'verrou posé dans la base (qui et quand)');
  for (const [P, nom] of [[A, 'ce téléphone'], [B, 'l\'autre téléphone']]) {
    verifie(await attendreQue(() => P.evaluate((L) => { const p = document.querySelector(`.pan[data-l="${L}"]`); return p.querySelectorAll('li.t.fige').length >= 5 && !p.querySelector('li.t .coche') && !p.querySelector('li.t .pt') && !p.querySelector('[data-a="suppr-encart"]') && !p.querySelector('.encart-tete [data-a="ajouter"]') && getComputedStyle(p.querySelector('.plus')).display === 'none' && !p.querySelector('.puce') && Array.from(p.querySelectorAll('li.t.fige:not(.sep)')).every((li) => li.firstElementChild.classList.contains('tx')) && (() => { const v = p.querySelector('.verrou-info'); return !v.hidden && !!v.querySelector('svg') && v.textContent.includes('Liste verrouillée'); })() && (() => { const o = getComputedStyle(p.querySelector('.bloc')); return o.outlineStyle === 'dashed' && o.outlineColor === 'rgb(196, 196, 204)'; })(); }, LJ)), `liste verrouillée sur ${nom} : ni case, ni menu, ni « + », rien devant les tâches (pas de point noir) ; le cadenas et « Liste verrouillée » sous le titre ; contour gris en pointillés autour de la liste`);
  }
  verifie(await B.evaluate((L) => { const v = document.querySelector(`.pan[data-l="${L}"] .verrou-info`); return v && !v.hidden && v.textContent.length > 0; }, LJ), 'un bandeau dit que la liste est verrouillée');
  await B.click(`${ligne(LJ, 'Véto')} .tx`); await pause(300);
  verifie(await B.evaluate(() => !document.querySelector('textarea.ed')), 'toucher une tâche verrouillée n\'ouvre pas la modification');
  const avant = JSON.stringify(parTexte(base, 'Banque')[1]);
  const v1 = await centre(B, `${ligne(LJ, 'Banque')} .tx`), v2 = await centre(B, `${ligne(LJ, 'Commander terreau')} .tx`);
  const cdpB = await ctxB.newCDPSession(B);
  await glisserDoigt(cdpB, v1.x, v1.y, v2.x, v2.y + 10);
  verifie(JSON.stringify(parTexte(base, 'Banque')[1]) === avant && !(await B.evaluate(() => !!document.querySelector('.vol'))), 'appui long sur une liste verrouillée : rien ne bouge');
  await A.click(`.pan[data-l="${LJ}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  verifie(await A.evaluate(() => { const t = document.getElementById('listeDlg').textContent; return t.includes('Déverrouiller la liste') && !t.includes('Supprimer la liste') && !t.includes('Ajouter l\'encart') && !t.includes('Supprimer l\'encart'); }), 'menu d\'une liste verrouillée : « Déverrouiller », pas de suppression (ni liste, ni encart)');
  await A.click('#listeDlg [data-a="deverrouiller"]');
  if (await A.evaluate(() => document.getElementById('listeDlg').open)) await A.click('#listeDlg [data-a="fermer"]');
  verifie(await attendreQue(() => base.lire(`taches/listes/${LJ}/verrou`) === null), 'déverrouillée');
  verifie(await attendreQue(() => B.evaluate((L) => !document.querySelector(`.pan[data-l="${L}"] li.t.fige`) && !!document.querySelector(`.pan[data-l="${L}"] li.t .coche`), LJ)), 'les cases reviennent sur l\'autre téléphone');

  // ---------- Réglages (depuis la pastille du compte) ----------
  await A.click('#avatar'); await A.waitForSelector('#compteDlg[open]');
  await A.click('#versReglages'); await A.waitForSelector('#reglDlg[open]');
  verifie(await A.evaluate(() => document.getElementById('reglNom').value === "Le Champ de l'Aurore" && document.querySelectorAll('#reglPers .pers-l').length === 3 && document.querySelector('#reglPers .pers-l[data-p="martin"] .p-coul').value === 'bleu'), 'Réglages : nom, trois personnes avec leur couleur');
  await A.fill('#reglNom', 'Ferme de test');
  await A.selectOption('#reglPers .pers-l[data-p="martin"] .p-coul', 'vert');
  await A.click('#reglAjPers');
  await A.locator('#reglPers .pers-l').last().locator('.p-nom').fill('Léa');
  verifie(await A.evaluate(() => document.querySelector('#reglPers .pers-l:last-child .p-ini').value === 'L'), 'initiale remplie toute seule');
  await A.fill('#reglEnc [data-enc="p1"]', 'Urgent');
  await A.click('#reglForm [type="submit"]');
  verifie(await attendreQue(() => { const r = base.lire('taches/reglages'); return r && r.nom === 'Ferme de test' && r.personnes.martin.couleur === 'vert' && r.personnes.francois.nom && r.encarts.p1 === 'Urgent' && Object.values(r.personnes).some((p) => p.nom === 'Léa' && p.initiale === 'L'); }), 'Réglages enregistrés dans la base (taches/reglages)');
  verifie(await attendreQue(() => B.evaluate((L) => document.getElementById('nomFerme').textContent === 'Ferme de test' && Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .etiq`)).map((x) => x.textContent).includes('Urgent') && getComputedStyle(document.getElementById('avatar')).backgroundColor === 'rgb(214, 236, 223)', LJ)), 'sur l\'autre téléphone : nouveau nom, encart « Urgent », Martin en vert');
  await B.click(`${ligne(LJ, 'Véto')} .pt`); await B.waitForSelector('#tacheDlg[open]');
  verifie(await B.evaluate(() => Array.from(document.querySelectorAll('#tacheDlg [data-pour]')).some((b) => b.textContent === 'LLéa')), 'la nouvelle personne apparaît dans « Pour qui ? »');
  await B.click('#tacheDlg [data-a="fermer"]');
  await A.click('#avatar'); await A.waitForSelector('#compteDlg[open]'); await A.click('#versReglages'); await A.waitForSelector('#reglDlg[open]');
  await A.click('#reglPers .pers-l:last-child .p-suppr');
  await A.click('#reglForm [type="submit"]');
  verifie(await attendreQue(() => { const r = base.lire('taches/reglages'); return r && Object.keys(r.personnes).length === 3; }), 'personne retirée');

  // ---------- Ordinateur : bouton Réglages du menu, clic droit refusé sur une liste verrouillée ----------
  const ctxP = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const P = await ctxP.newPage();
  const erreursP = []; P.on('pageerror', (e) => erreursP.push(String(e)));
  await connecter(P, 'aurore');
  await P.waitForSelector(`.pan[data-l="${LJ}"] li.t[data-id]`);
  await P.click('.menu [data-a="reglages"]');
  verifie(await attendreQue(() => P.evaluate(() => document.getElementById('reglDlg').open)), 'ordinateur : « Réglages » du menu ouvre les réglages');
  await P.click('#reglDlg [data-a="fermer"]');
  await P.evaluate((L) => verrouiller(L, true), L2);
  await P.waitForSelector(`.pan[data-l="${L2}"] .verrou-info:not([hidden])`);
  await P.evaluate((L) => ecrire({ ['t/fige1']: { liste: L, parent: '', encart: 'p1', ordre: 1, texte: 'Tâche figée', by: 'aurore', at: Date.now() } }), L2);
  await P.waitForSelector(`${ligne(L2, 'Tâche figée')}`);
  await P.evaluate((L) => document.querySelector(`.pan[data-l="${L}"]`).scrollIntoView({ inline: 'nearest' }), L2);
  await P.click(`${ligne(L2, 'Tâche figée')} .tx`, { button: 'right' }); await pause(300);
  verifie(await P.evaluate(() => !document.getElementById('tacheDlg').open), 'clic droit sur une tâche verrouillée : pas de menu');
  verifie(await P.evaluate((L) => { const o = getComputedStyle(document.querySelector(`.pan[data-l="${L}"]`)); return o.outlineStyle === 'dashed' && o.outlineColor === 'rgb(196, 196, 204)' && o.outlineWidth === '2px'; }, L2), 'ordinateur : la colonne verrouillée a un contour gris en pointillés');
  verifie(await P.evaluate((L) => getComputedStyle(document.querySelector(`.pan[data-l="${L}"]`)).outlineStyle === 'none', LJ), 'une colonne non verrouillée n\'en a pas');
  if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await P.screenshot({ path: path.join(CAPTURES, 'ordinateur-verrou.png') }); }
  await P.click(`.pan[data-l="${L2}"] [data-a="menu-liste"]`); await P.waitForSelector('#listeDlg[open]');
  await P.click('#listeDlg [data-a="deverrouiller"]');
  if (await P.evaluate(() => document.getElementById('listeDlg').open)) await P.click('#listeDlg [data-a="fermer"]');
  await P.click(`${ligne(L2, 'Tâche figée')} .tx`, { button: 'right' });
  verifie(await attendreQue(() => P.evaluate(() => document.getElementById('tacheDlg').open)), 'déverrouillée : le clic droit ouvre le menu');
  verifie(await P.evaluate((L) => getComputedStyle(document.querySelector(`.pan[data-l="${L}"]`)).outlineStyle === 'none', L2), 'déverrouillée : le contour disparaît');
  await P.click('#tacheDlg [data-a="fermer"]');
  // « Ajouter une tâche » sur l'ordinateur : hors des encarts, au-dessus de RDV ; « + » des encarts au même aspect (vert).
  await P.evaluate((L) => document.querySelector(`.pan[data-l="${L}"]`).scrollIntoView({ inline: 'nearest' }), L2);
  await P.click(`.pan[data-l="${L2}"] .ajout-ligne`);
  verifie(await P.evaluate((L) => { const t = document.querySelector(`.pan[data-l="${L}"] textarea.ed`), e = t && t.closest('.encart'); return !!e && e.dataset.e === '' && !e.previousElementSibling && !!e.nextElementSibling && e.nextElementSibling.dataset.e === 'rdv'; }, L2), 'ordinateur : « Ajouter une tâche » ouvre la ligne hors des encarts, au-dessus de RDV');
  await P.keyboard.type('Tâche du haut'); await P.keyboard.press('Enter'); await P.keyboard.press('Escape');
  verifie(await attendreQue(() => { const x = parTexte(base, 'Tâche du haut'); return x && x[1].encart === '' && x[1].liste === L2; }), 'enregistrée sans encart');
  const plusPC = await P.evaluate((L) => { const a = document.querySelector(`.pan[data-l="${L}"] .ajout-ligne`), b = document.querySelector(`.pan[data-l="${L}"] .encart-tete [data-a="ajouter"]`); const ia = a.querySelector('svg').getBoundingClientRect(), ib = b.querySelector('svg').getBoundingClientRect(); return { ca: getComputedStyle(a).color, cb: getComputedStyle(b).color, fond: getComputedStyle(b).backgroundColor, ta: ia.width, tb: ib.width }; }, L2);
  verifie(plusPC.ca === plusPC.cb && plusPC.cb === 'rgb(11, 105, 77)' && plusPC.fond === 'rgba(0, 0, 0, 0)' && plusPC.ta === plusPC.tb, 'ordinateur : le « + » des encarts a le même aspect que celui de « Ajouter une tâche » (vert, même taille) ' + JSON.stringify(plusPC));
  await P.click(`.pan[data-l="${L2}"] .encart-tete [data-a="ajouter"][data-e="p2"]`);
  verifie(await P.evaluate((L) => { const t = document.querySelector(`.pan[data-l="${L}"] textarea.ed`); return !!t && t.closest('.encart').dataset.e === 'p2'; }, L2), 'le « + » d\'un encart écrit toujours dans cet encart (P2)');
  await P.keyboard.press('Escape');

  if (CAPTURES) {
    fs.mkdirSync(CAPTURES, { recursive: true });
    await A.screenshot({ path: path.join(CAPTURES, 'telephone-encarts.png') });
    await P.screenshot({ path: path.join(CAPTURES, 'ordinateur-encarts.png') });
    await A.click(`${ligne(LJ, 'Désherber carottes')} .pt`); await A.waitForSelector('#tacheDlg[open]'); await pause(300);
    await A.screenshot({ path: path.join(CAPTURES, 'telephone-menu-tache.png') });
    await A.click('#tacheDlg [data-a="fermer"]');
    await A.click('#avatar'); await A.click('#versReglages'); await pause(300);
    await A.screenshot({ path: path.join(CAPTURES, 'telephone-reglages.png') });
    await A.click('#reglDlg [data-a="fermer"]');
    await A.evaluate((L) => verrouiller(L, true), LJ); await pause(400);
    await A.screenshot({ path: path.join(CAPTURES, 'telephone-verrou.png') });
    await A.evaluate((L) => verrouiller(L, false), LJ);
    await P.screenshot({ path: path.join(CAPTURES, 'ordinateur.png') });
  }

  const erreurs = erreursA.concat(erreursB, erreursP);
  verifie(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await navigateur.close(); site.close(); base.close();
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
