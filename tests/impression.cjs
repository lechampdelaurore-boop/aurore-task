// Farm tasks, étape 52 : imprimer toutes les listes, le papier de secours (contrat docs/CONTRAT_IMPRESSION.md, quatre
// points confirmés par François le 21/11/2026). Faux Firebase, données inventées (une autre ferme), ordinateur (1440×900)
// puis téléphone (Pixel 5). Les PDF sont fabriqués par Chromium (page.pdf, mode impression) et relus par pdfinfo et pdftotext.
// Lancement depuis la racine du dépôt : node tests/impression.cjs   (CAPTURES=dossier pour garder captures et PDF d'exemple)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
const { sautePixel } = require('./apparence-env.cjs'); // APPARENCE=pixel : le même test dans l'apparence pixel art (étape 53)

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8990, PORT_BASE = 8991;
const BASE = `http://localhost:${PORT_BASE}`;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', martin: 'mdp-martin-1' };
const CAPTURES = process.env.CAPTURES || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'impression-'));
const IDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

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
const capture = async (page, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pause(250); await page.screenshot({ path: path.join(CAPTURES, nom) }); } };
const garderPdf = (src, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); fs.copyFileSync(src, path.join(CAPTURES, nom)); } };
const compact = (s) => String(s).replace(/\s+/g, '');
async function connecter(page, id) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', id);
  await page.fill('#authMdp', MDP[id]);
  await page.click('#authOk');
}

// ---------- Les données (inventées : « Ferme du Petit Pré ») ----------
function donnees() {
  const t0 = Date.now(), listes = {}, t = {};
  IDS.forEach((id, j) => { listes[id] = { nom: JOURS[j], type: 'jour', jour: j, ordre: j + 1, by: 'francois', at: t0 }; });
  listes.astreintes = { nom: 'Astreintes', type: 'astreintes', ordre: 8, by: 'francois', at: t0 };
  listes.courses = { nom: 'Liste de courses', type: 'simple', ordre: 9, by: 'francois', at: t0,
    encartsPropres: { quinc: { nom: 'Quincaillerie', couleur: 'bleu', ordre: 1 }, coop: { nom: 'Coopérative', couleur: 'orange', ordre: 2 }, pharma: { nom: 'Pharmacie vétérinaire', couleur: 'gris', ordre: 3 } } };
  listes.longue = { nom: 'Longue liste', type: 'simple', ordre: 10, by: 'francois', at: t0 };
  listes.archives = { nom: 'Archives', type: 'simple', ordre: 11, by: 'francois', at: t0, verrou: { by: 'francois', at: t0 } };
  let o = 0;
  const T = (id, liste, texte, plus = {}) => { t[id] = { liste, parent: '', encart: '', ordre: ++o, texte, by: 'francois', at: t0, ...plus }; };
  // Lundi : RDV à l'heure (dont un de l'agenda), P1 avec sous-tâches sur 4 niveaux, séparateur, couleur, personnes ; P2 ; hors encart.
  T('l1', 'lundi', 'Vétérinaire, vaccins des brebis', { encart: 'rdv', heure: '09:30', pour: 'max' });
  T('l2', 'lundi', 'Livraison du foin chez Dubois', { encart: 'rdv', heure: '14:00', origine: 'g:abc' });
  T('l3', 'lundi', 'Réparer la clôture du pré nord', { encart: 'p1', pour: 'max' });
  T('l4', 'lundi', 'Appeler le garage pour le tracteur', { encart: 'p1', couleur: 'rouge', pour: 'lea' });
  T('l4a', 'lundi', 'Demander un devis', { parent: 'l4', couleur: 'rouge' });
  T('l4a1', 'lundi', 'Comparer avec le devis de l\'an dernier', { parent: 'l4a' });
  T('l4a1x', 'lundi', 'Ressortir la facture du classeur bleu', { parent: 'l4a1' });
  T('l4s', 'lundi', '', { parent: 'l4', sep: true });
  T('l4b', 'lundi', 'Date de passage possible ?', { parent: 'l4' });
  T('l5', 'lundi', 'Ranger l\'atelier', { encart: 'p2' });
  T('l6', 'lundi', 'Une tâche au texte très long pour vérifier qu\'il passe à la ligne sans jamais être coupé : nettoyer les gouttières de la bergerie, vérifier les descentes d\'eau, remplacer le coude cassé côté chemin, puis prévenir le voisin que l\'échelle reste dans la grange jusqu\'à jeudi soir.');
  // Mardi : une sous-tâche ; mercredi : rien (encarts vides).
  T('m1', 'mardi', 'Semer les mâches sous tunnel', { encart: 'p1', pour: 'theo' });
  T('m1a', 'mardi', 'Rang 1 à 4', { parent: 'm1' });
  T('m2', 'mardi', 'Nettoyer les caisses', { encart: 'p2', couleur: 'vert' });
  // Astreintes.
  T('a1', 'astreintes', 'Traite du soir', { jours: '012', zone: 'rdv', heure: '18:00', pour: 'theo' });
  T('a2', 'astreintes', 'Tour des animaux', { jours: '56', zone: 'p1', pause: true });
  // Liste de courses : ses propres encarts, une tâche hors encart.
  T('c0', 'courses', 'Penser au pain');
  T('c1', 'courses', 'Fil de clôture, 200 m', { encart: 'quinc' });
  T('c2', 'courses', 'Piquets acacia ×20', { encart: 'quinc' });
  T('c3', 'courses', 'Sacs de granulés ×10', { encart: 'coop' });
  T('c4', 'courses', 'Antiparasitaire', { encart: 'pharma' });
  // Longue liste : 150 tâches (plus qu'un écran), quelques-unes longues, des sous-tâches.
  for (let i = 1; i <= 150; i++) {
    const n = String(i).padStart(3, '0');
    T('g' + n, 'longue', `Planche ${n} : désherber` + (i % 25 === 0 ? ', biner entre les rangs, arroser au goutte-à-goutte et noter la date du prochain passage dans le cahier' : ''), i % 30 === 0 ? { parent: 'g' + String(i - 1).padStart(3, '0') } : {});
  }
  // Archives : liste verrouillée.
  T('x1', 'archives', 'Vieille tâche gardée pour mémoire');
  // Une tâche d'une liste disparue : jamais imprimée (elle n'est pas non plus à l'écran).
  T('z1', 'liste-effacee', 'Tâche orpheline');
  const faites = {
    f1: { at: t0 - 3600e3, by: 'francois', liste: 'lundi', texte: 'Commander les plants', t: { f1: { liste: 'lundi', parent: '', ordre: 50, texte: 'Commander les plants' }, f1a: { liste: 'lundi', parent: 'f1', ordre: 1, texte: 'Laitues feuille de chêne' } } },
    f2: { at: t0 - 1800e3, by: 'francois', liste: 'lundi', texte: 'Tâche supprimée par erreur', supprime: true, t: { f2: { liste: 'lundi', parent: '', ordre: 51, texte: 'Tâche supprimée par erreur' } } },
  };
  const reglages = { nom: 'Ferme du Petit Pré', encarts: { rdv: 'RDV', p1: 'P1', p2: 'P2' },
    personnes: { theo: { nom: 'Théo', initiale: 'T', couleur: 'bleu', ordre: 1 }, lea: { nom: 'Léa', initiale: 'L', couleur: 'rose', ordre: 2 }, max: { nom: 'Max', initiale: 'M', couleur: 'rouge', ordre: 3 } } };
  return { listes, t, faites, reglages };
}

// Textes des tâches à faire qu'on doit retrouver, une fois chacune, pour un ensemble de listes.
const aFaire = (d, listes) => Object.values(d.t).filter((x) => listes.includes(x.liste) && !x.sep).map((x) => x.texte);
// Textes imprimés (sans l'heure ni le « ● » du noir et blanc), tâches à faire seulement.
const imprimes = (page, sel = '.imp-t:not(.faite) .imp-tx') => page.evaluate((sel) => Array.from(document.querySelectorAll('#impPage ' + sel)).map((e) => e.textContent.replace(/^● /, '').replace(/^\d\d:\d\d /, '')), sel);
const memes = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
// Imprime sans ouvrir la vraie fenêtre d'impression : window.print est remplacé par un compteur.
const sansFenetre = (page) => page.evaluate(() => { window.__print = 0; window.print = () => { window.__print++; }; });
async function pdf(page, nom) {
  await page.emulateMedia({ media: 'print' });
  const f = path.join(TMP, nom);
  await page.pdf({ path: f, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const info = execFileSync('pdfinfo', [f]).toString();
  const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1]);
  const [, w, h] = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/) || [];
  const textes = [];
  for (let i = 1; i <= pages; i++) textes.push(execFileSync('pdftotext', ['-f', String(i), '-l', String(i), f, '-']).toString());
  return { f, pages, l: Number(w), h: Number(h), textes };
}
// Chaque texte est entier sur une seule page (jamais coupé entre deux pages), et une seule fois en tout.
function entiers(p, textes) {
  const pages = p.textes.map(compact), rates = [];
  for (const x of textes) {
    const c = compact(x), sur = pages.filter((pg) => pg.includes(c)).length, fois = pages.reduce((n, pg) => n + pg.split(c).length - 1, 0);
    if (sur !== 1) rates.push(x);
    else if (fois < 1) rates.push(x);
  }
  return rates;
}
async function ouvrirParReglages(P) {
  await P.click('.menu [data-a="reglages"]');
  await P.waitForSelector('#reglDlg[open]');
  await P.click('#reglImp');
  await P.waitForSelector('#impDlg[open]');
}

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.martin, 'equipe');
  const D = donnees();
  base.poser('taches', JSON.parse(JSON.stringify(D)));
  const TOUTES = Object.keys(D.listes);
  const navigateur = await chromium.launch();

  // ================= Ordinateur =================
  const ctxP = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const P = await ctxP.newPage();
  const erreurs = []; P.on('pageerror', (e) => erreurs.push(String(e)));
  await connecter(P, 'francois');
  await P.waitForSelector('.pan[data-l="longue"] li.t');
  await attendreQue(() => P.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await pause(400);
  const N = aFaire(D, TOUTES).length;

  // R4 : l'heure de la dernière réception est gardée sur l'appareil (taches.copieLe), jamais dans la base.
  const copieLe = await P.evaluate(() => Number(JSON.parse(localStorage.getItem('taches.copieLe'))));
  verifie(copieLe > Date.now() - 60e3 && copieLe <= Date.now(), 'R4. heure de la dernière réception gardée sur l\'appareil (taches.copieLe)');
  verifie(!JSON.stringify(base.lire('taches') || {}).includes('copieLe'), 'R4. rien de cette heure dans la base');

  // R5 : la fenêtre, toutes les listes cochées (cachée et verrouillée comprises), le compte.
  await P.click('#affichees input[data-l="longue"]'); // « Longue liste » cachée de l'écran de l'ordinateur
  await pause(200);
  verifie(await P.evaluate(() => document.querySelector('.pan[data-l="longue"]').classList.contains('cachee')), 'R5. préparation : « Longue liste » cachée de l\'écran');
  await ouvrirParReglages(P);
  const fen = await P.evaluate(() => ({
    n: document.querySelectorAll('#impListes input').length, coches: document.querySelectorAll('#impListes input:checked').length,
    texte: document.querySelector('#impListes').textContent, compte: document.querySelector('#impCompte').textContent,
    quand: document.querySelector('#impQuand').textContent,
    opts: [document.querySelector('#impOpts [value="portrait"]').checked, document.querySelector('#impOpts [value="couleur"]').checked, document.querySelector('#impGros').checked, document.querySelector('#impFaites').checked],
  }));
  verifie(fen.n === 11 && fen.coches === 11, `R5. Réglages → « Imprimer… » : les 11 listes proposées, toutes cochées (${fen.coches}/${fen.n})`);
  verifie(fen.texte.includes('Longue liste (cachée)') && fen.texte.includes('Archives (verrouillée)'), 'R5. la liste cachée et la liste verrouillée sont proposées (et cochées)');
  verifie(fen.compte === `11 listes · ${N} tâches`, `R8. compte annoncé « ${fen.compte} » = compte de la base (${N} tâches à faire)`);
  verifie(/^Données de cet appareil à jour à \d\d h \d\d\.$/.test(fen.quand), `R4. fraîcheur annoncée dans la fenêtre : « ${fen.quand} »`);
  verifie(JSON.stringify(fen.opts) === '[true,true,false,false]', 'R6. options par défaut : A4 portrait, couleur, sans gros caractères, sans « Faites récemment »');
  await capture(P, '1-ordinateur-fenetre.png');
  await P.click('#impDlg [data-imp="aucune"]');
  verifie(await P.evaluate(() => document.querySelectorAll('#impListes input:checked').length === 0 && document.querySelector('#impOk').disabled && document.querySelector('#impCompte').textContent === '0 liste · 0 tâche'), 'R5. raccourci « Aucune » : rien de coché, bouton Imprimer grisé');
  await P.click('#impDlg [data-imp="jours"]');
  const jours = await P.evaluate(() => Array.from(document.querySelectorAll('#impListes input:checked')).map((c) => c.dataset.l));
  verifie(memes(jours, IDS) && await P.evaluate(() => document.querySelector('#impCompte').textContent) === `7 listes · ${aFaire(D, IDS).length} tâches`, 'R5. raccourci « Les sept jours » : les sept jours seulement, compte à jour');
  await P.click('#impDlg [data-imp="tout"]');
  verifie(await P.evaluate(() => document.querySelectorAll('#impListes input:checked').length) === 11, 'R5. raccourci « Tout » : les 11 listes');

  // R6 : options retenues sur l'appareil (après une impression), retrouvées après rechargement.
  await sansFenetre(P);
  await P.click('#impOpts [value="paysage"]'); await P.click('#impOpts [value="nb"]'); await P.check('#impGros'); await P.check('#impFaites');
  await P.click('#impOk');
  verifie(await P.evaluate(() => window.__print === 1 && !document.querySelector('#impDlg').open), '« Imprimer » : la fenêtre se ferme et l\'impression du navigateur est lancée');
  await P.reload();
  await P.waitForSelector('.pan[data-l="lundi"] li.t');
  await ouvrirParReglages(P);
  const retenues = await P.evaluate(() => [document.querySelector('#impOpts [value="paysage"]').checked, document.querySelector('#impOpts [value="nb"]').checked, document.querySelector('#impGros').checked, document.querySelector('#impFaites').checked]);
  verifie(JSON.stringify(retenues) === '[true,true,true,true]', 'R6. après rechargement, les options choisies sont retrouvées (paysage, noir et blanc, gros caractères, faites récemment)');
  verifie(await P.evaluate(() => document.querySelectorAll('#impListes input:checked').length) === 11, 'R5. après rechargement, toutes les listes de nouveau cochées (le choix des listes n\'est pas retenu)');
  await P.click('#impDlg [data-a="fermer"]'); await P.click('#reglDlg [data-a="fermer"]');
  await P.evaluate(() => localStorage.removeItem('taches.impression'));

  // R1 : sans réseau, avec une modification pas encore envoyée.
  await attendreQue(() => P.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await ctxP.setOffline(true);
  base.couperFlux();
  verifie(await attendreQue(() => P.evaluate(() => document.querySelector('#statut').textContent.includes('Hors ligne'))), 'R1. préparation : réseau coupé (statut « Hors ligne »)');
  await P.evaluate(() => ecrire({ 't/hl1': { liste: 'mardi', parent: '', encart: 'p2', ordre: 99, texte: 'Écrite sans réseau', by: 'francois', at: Date.now() } }));
  await attendreQue(() => P.evaluate(() => pending.length === 1));
  const journal0 = base.journal.length;
  await sansFenetre(P);
  await ouvrirParReglages(P);
  verifie(await P.evaluate(() => document.querySelector('#impCompte').textContent) === `11 listes · ${N + 1} tâches`, `R8. hors ligne, la tâche pas encore envoyée est comptée (${N + 1})`);
  verifie(/, dont 1 modification pas encore envoyée\.$/.test(await P.evaluate(() => document.querySelector('#impQuand').textContent)), 'R4. la fenêtre dit « dont 1 modification pas encore envoyée »');
  // Le clic sur « Imprimer » est suivi d'un bout à l'autre sans rien laisser passer d'autre : aucune requête, aucun flux ouvert.
  const requetes = []; const surRequete = (r) => requetes.push(r.url()); P.on('request', surRequete);
  const appels = await P.evaluate(() => {
    let n = 0; const f = window.fetch, x = XMLHttpRequest.prototype.open, E = window.EventSource;
    window.fetch = function () { n++; return f.apply(this, arguments); };
    XMLHttpRequest.prototype.open = function () { n++; return x.apply(this, arguments); };
    window.EventSource = function () { n++; return new E(...arguments); };
    document.querySelector('#impOk').click();
    window.fetch = f; XMLHttpRequest.prototype.open = x; window.EventSource = E;
    return n;
  });
  await pause(300);
  P.off('request', surRequete);
  verifie(appels === 0 && requetes.length === 0, `R1. impression hors ligne : aucune requête (${appels} appel, ${requetes.length} requête vue par le navigateur)`);
  verifie(base.journal.length === journal0, 'R1. la base n\'a rien reçu');
  verifie(await P.evaluate(() => window.__print === 1 && !!document.querySelector('#impPage')), 'R1. la page d\'impression est construite et l\'impression lancée');
  verifie(await P.evaluate(() => document.querySelector('#reglDlg').open), 'les Réglages restent ouverts derrière (rien de ce qui y était tapé n\'est perdu)');
  await P.click('#reglDlg [data-a="fermer"]');

  // R2 : chaque tâche à faire une fois, les tâches faites absentes ; R3 cases vides ; R4 en-tête.
  const NT = N + 1, txt = await imprimes(P);
  const attendus = aFaire(D, TOUTES).concat(['Écrite sans réseau']);
  verifie(txt.length === NT && memes(txt, attendus), `R2. chaque tâche à faire imprimée une fois (${txt.length} imprimées, ${NT} attendues), sous-tâches à tous les niveaux comprises`);
  verifie(!txt.includes('Tâche orpheline'), 'R2. une tâche d\'une liste disparue (pas à l\'écran) n\'est pas imprimée');
  const page1 = await P.evaluate(() => {
    const q = (s) => Array.from(document.querySelectorAll('#impPage ' + s));
    const parTexte = (t) => q('.imp-t').find((e) => e.querySelector('.imp-tx').textContent.endsWith(t));
    const niveau = (t) => Number(parTexte(t).style.getPropertyValue('--n'));
    const lundi = document.querySelector('#impPage .imp-liste[data-l="lundi"]');
    return {
      titre: document.querySelector('#impPage h1').textContent, quand: document.querySelector('#impPage .imp-quand').textContent,
      listes: q('.imp-liste').map((s) => s.querySelector('.imp-titre').textContent),
      cases: q('.imp-t:not(.faite) .imp-case').length, pleines: q('.imp-t.faite').length,
      caseFond: getComputedStyle(q('.imp-case')[0]).backgroundColor,
      niveaux: ['Demander un devis', 'Comparer avec le devis de l\'an dernier', 'Ressortir la facture du classeur bleu', 'Date de passage possible ?'].map(niveau),
      sep: lundi.querySelectorAll('.imp-sep').length,
      encLundi: Array.from(lundi.querySelectorAll('.imp-enc')).map((e) => e.textContent + '|' + getComputedStyle(e).backgroundColor),
      ordreLundi: Array.from(lundi.querySelectorAll('.imp-enc, .imp-tx')).map((e) => e.textContent.slice(0, 18)),
      mercredi: Array.from(document.querySelectorAll('#impPage .imp-liste[data-l="mercredi"] .imp-enc, #impPage .imp-liste[data-l="mercredi"] .imp-vide')).map((e) => e.textContent).join('|'),
      courses: Array.from(document.querySelectorAll('#impPage .imp-liste[data-l="courses"] .imp-enc, #impPage .imp-liste[data-l="courses"] .imp-tx')).map((e) => e.textContent).join('|'),
      heure: parTexte('Vétérinaire, vaccins des brebis').querySelector('.imp-tx').textContent,
      rouge: getComputedStyle(parTexte('Appeler le garage pour le tracteur').querySelector('.imp-tx')).color,
      pastille: (() => { const p = parTexte('Réparer la clôture du pré nord').querySelector('.imp-pas'); return p ? p.textContent + '|' + getComputedStyle(p).backgroundColor : ''; })(),
      ast: Array.from(document.querySelectorAll('#impPage .imp-liste[data-l="astreintes"] .imp-ast')).map((e) => e.textContent),
      faite: !!q('.imp-tx').find((e) => e.textContent.includes('Commander les plants')),
    };
  });
  verifie(page1.titre === 'Ferme du Petit Pré · Toutes les listes', `R4/R11. titre : « ${page1.titre} » (nom de la ferme lu dans les réglages)`);
  const auj = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  verifie(page1.quand.startsWith(`Imprimé le ${auj} à `) && /données de cet appareil à jour à \d\d h \d\d, dont 1 modification pas encore envoyée$/.test(page1.quand), `R4. en-tête : « ${page1.quand} »`);
  verifie(JSON.stringify(page1.listes) === JSON.stringify(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Astreintes', 'Liste de courses', 'Longue liste', 'Archives']), 'R2/R5. les 11 listes dans l\'ordre de l\'écran, la cachée et la verrouillée comprises');
  verifie(page1.cases === NT && page1.caseFond === 'rgb(255, 255, 255)', `R3. une case vide devant chaque tâche (${page1.cases})`);
  verifie(page1.pleines === 0 && !page1.faite, 'R3. par défaut, aucune tâche faite imprimée');
  verifie(JSON.stringify(page1.niveaux) === '[1,2,3,1]', `R2. sous-tâches indentées à leur niveau (1, 2, 3, 1 : ${page1.niveaux})`);
  verifie(page1.sep === 1, 'R2. le séparateur est imprimé en trait');
  verifie(JSON.stringify(page1.encLundi) === JSON.stringify(['RDV|rgb(225, 234, 255)', 'P1|rgb(251, 230, 207)', 'P2|rgb(242, 242, 245)']), `R2. encarts du jour en bandeaux de leur couleur pâle (${page1.encLundi.join(', ')})`);
  verifie(page1.ordreLundi[0].startsWith('Une tâche au texte') && page1.ordreLundi[1] === 'RDV', 'R2. tâches hors encart d\'abord, puis les encarts');
  verifie(page1.mercredi === 'RDV|Aucune tâche|P1|Aucune tâche|P2|Aucune tâche', 'R2. un encart vide est imprimé avec « Aucune tâche »');
  verifie(page1.courses === 'Penser au pain|Quincaillerie|Fil de clôture, 200 m|Piquets acacia ×20|Coopérative|Sacs de granulés ×10|Pharmacie vétérinaire|Antiparasitaire', 'R2. une liste à ses propres encarts : ses encarts, dans son ordre');
  verifie(page1.heure === '09:30 Vétérinaire, vaccins des brebis', 'R2. l\'heure d\'un rendez-vous est imprimée devant');
  verifie(page1.rouge === 'rgb(176, 42, 55)', 'R7. en couleur, la couleur du texte est gardée');
  verifie(page1.pastille === 'M|rgb(251, 224, 227)', `R7. la personne en pastille colorée avec l'initiale (${page1.pastille})`);
  verifie(JSON.stringify(page1.ast) === JSON.stringify(['Lun, Mar, Mer · RDV 18:00', 'Sam, Dim · P1 · En pause']), `R2. astreintes avec leurs jours, zone, heure (${page1.ast.join(' / ')})`);

  // R2/R7 en mode impression : l'appli masquée, rien n'a d'ascenseur, deux colonnes.
  await P.emulateMedia({ media: 'print' });
  const imp = await P.evaluate(() => {
    const els = [document.querySelector('#impPage')].concat(Array.from(document.querySelectorAll('#impPage *')));
    const asc = els.filter((e) => e.tagName !== 'STYLE' && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) && getComputedStyle(e).display !== 'inline');
    const visibles = Array.from(document.body.children).filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id || e.className || e.tagName);
    return { asc: asc.length, visibles, cols: getComputedStyle(document.querySelector('#impPage .imp-cols')).columnCount, police: getComputedStyle(document.querySelector('#impPage')).fontSize };
  });
  await P.emulateMedia({ media: 'screen' });
  verifie(imp.asc === 0, `R2. en mode impression, aucun élément de la page n'a d'ascenseur (${imp.asc})`);
  verifie(JSON.stringify(imp.visibles) === '["impPage"]', `R9. en mode impression, seule la page d'impression est montrée (${imp.visibles.join(', ')})`);
  verifie(imp.cols === '2' && imp.police === '12px', `R7. portrait : 2 colonnes, texte 9 pt (${imp.cols} colonnes, ${imp.police})`);
  verifie(await P.evaluate(() => getComputedStyle(document.querySelector('#impPage')).display === 'none' && getComputedStyle(document.querySelector('.app')).display !== 'none'), 'R9. à l\'écran, la page d\'impression reste invisible et l\'appli inchangée');

  // Le PDF (portrait, couleur, toutes les listes) : chaque tâche entière sur une seule page.
  const p1 = await pdf(P, 'toutes.pdf');
  verifie(p1.l < p1.h && Math.round(p1.l) === 595 && Math.round(p1.h) === 842, `R7. PDF en A4 portrait (${p1.l} × ${p1.h} points), ${p1.pages} pages`);
  const coupees = entiers(p1, attendus);
  verifie(coupees.length === 0, `R2. PDF : chaque tâche entière sur une seule page, aucune coupée ni perdue (${coupees.length} en défaut${coupees.length ? ' : ' + coupees.slice(0, 3).join(' / ') : ''})`);
  verifie(compact(p1.textes[0]).includes(compact('Ferme du Petit Pré · Toutes les listes')), 'R4. PDF : le titre en haut de la première page');
  const seuls = (p, titres) => titres.filter(([titre, premiere]) => { const i = p.textes.findIndex((pg) => compact(pg).includes(compact(premiere))); return i < 0 || !compact(p.textes[i]).includes(compact(titre)); }).map(([t]) => t);
  const s1 = seuls(p1, [['Lundi', 'Une tâche au texte très long'], ['Astreintes', 'Traite du soir'], ['Liste de courses', 'Penser au pain'], ['Longue liste', 'Planche 001 : désherber'], ['Archives', 'Vieille tâche gardée pour mémoire']]);
  verifie(s1.length === 0, `R2. PDF : chaque titre de liste est sur la même page que sa première tâche (jamais seul en bas) ${s1.join(', ')}`);
  garderPdf(p1.f, 'exemple-toutes-les-listes.pdf');

  // R9 : après l'impression, la page est retirée (au bout du délai de garde) et l'appli est intacte.
  const pans = await P.evaluate(() => document.querySelectorAll('.pan').length);
  await P.evaluate(() => { IMP_GARDE_MS = 150; dispatchEvent(new Event('afterprint')); });
  verifie(await attendreQue(() => P.evaluate(() => !document.querySelector('#impPage') && !document.body.classList.contains('imprime'))), 'R9. après l\'impression, la page d\'impression est retirée');
  verifie(await P.evaluate((n) => document.querySelectorAll('.pan').length === n && !!document.querySelector('.pan[data-l="lundi"] li.t[data-id="l1"]'), pans), 'R9. l\'appli est intacte (mêmes listes, mêmes tâches à l\'écran)');

  // « Ctrl+P » sur l'appli (sans passer par la fenêtre) : toutes les listes, en entier.
  await P.evaluate(() => { impDernier = null; IMP_GARDE_MS = 120000; dispatchEvent(new Event('beforeprint')); });
  verifie(await P.evaluate(() => document.querySelectorAll('#impPage .imp-liste').length) === 11 && (await imprimes(P)).length === NT, '« Ctrl+P » sur l\'appli : la page d\'impression complète est construite (11 listes, toutes les tâches)');
  await P.evaluate(() => { IMP_GARDE_MS = 150; dispatchEvent(new Event('afterprint')); });
  await attendreQue(() => P.evaluate(() => !document.querySelector('#impPage')));
  await P.evaluate(() => { IMP_GARDE_MS = 120000; });

  // R5/R6 : « ⋯ » d'une liste → « Imprimer cette liste » ; paysage, noir et blanc, faites récemment.
  await P.click('.pan[data-l="lundi"] .menu-l');
  await P.waitForSelector('#listeDlg[open]');
  await P.click('#listeDlg [data-a="imprimer-liste"]');
  await P.waitForSelector('#impDlg[open]');
  const NL = aFaire(D, ['lundi']).length;
  const seule = await P.evaluate(() => ({ coches: Array.from(document.querySelectorAll('#impListes input:checked')).map((c) => c.dataset.l), compte: document.querySelector('#impCompte').textContent }));
  verifie(JSON.stringify(seule.coches) === '["lundi"]' && seule.compte === `1 liste · ${NL} tâches`, `R5. « ⋯ » de Lundi → « Imprimer cette liste » : Lundi seul coché, « ${seule.compte} »`);
  await P.click('#impOpts [value="paysage"]'); await P.click('#impOpts [value="nb"]'); await P.check('#impFaites');
  verifie(await P.evaluate(() => document.querySelector('#impCompte').textContent) === `1 liste · ${NL} tâches · 2 faites récemment`, 'R8. avec « Faites récemment », le compte des faites s\'ajoute (2 : la tâche et sa sous-tâche ; pas la supprimée)');
  await sansFenetre(P);
  await P.click('#impOk');
  const nb = await P.evaluate(() => {
    const q = (s) => Array.from(document.querySelectorAll('#impPage ' + s));
    const gris = (c) => { const m = c.match(/\d+(\.\d+)?/g); return !m || (m[0] === m[1] && m[1] === m[2]) || (m.length === 4 && Number(m[3]) === 0); };
    const couleurs = [];
    [document.querySelector('#impPage')].concat(q('*')).forEach((e) => { const s = getComputedStyle(e); [s.color, s.backgroundColor, s.borderTopColor].forEach((c) => { if (!gris(c)) couleurs.push(e.className + ':' + c); }); });
    return {
      titre: document.querySelector('#impPage h1').textContent, listes: q('.imp-liste').length, couleurs,
      faites: q('.imp-t.faite .imp-tx').map((e) => e.textContent), pleine: getComputedStyle(q('.imp-t.faite .imp-case')[0]).backgroundColor,
      sous: q('.imp-sous').map((e) => e.textContent), init: q('.imp-pas').map((e) => e.textContent).join(' '),
      rond: q('.imp-tx').map((e) => e.textContent).filter((t) => t.startsWith('● ')),
    };
  });
  verifie(nb.titre === 'Ferme du Petit Pré · Lundi' && nb.listes === 1, `R5. une seule liste imprimée, titre « ${nb.titre} »`);
  verifie(nb.couleurs.length === 0, `R6. noir et blanc : aucune couleur ni fond coloré (${nb.couleurs.length}${nb.couleurs.length ? ' : ' + nb.couleurs.slice(0, 3).join(', ') : ''})`);
  verifie(nb.init === '[M] [M] [L]', `R6. noir et blanc : personne en initiale entre crochets (${nb.init})`);
  verifie(JSON.stringify(nb.rond) === JSON.stringify(['● Appeler le garage pour le tracteur', '● Demander un devis']), 'R6. noir et blanc : une tâche colorée est précédée d\'un « ● »');
  verifie(JSON.stringify(nb.faites) === JSON.stringify(['Commander les plants', 'Laitues feuille de chêne']) && nb.pleine === 'rgb(34, 34, 34)' && JSON.stringify(nb.sous) === '["Faites récemment"]', 'R3. option « Faites récemment » : en fin de liste, case pleine, avec sa sous-tâche ; la tâche supprimée n\'y est pas');
  const p2 = await pdf(P, 'lundi.pdf');
  verifie(p2.l > p2.h && Math.round(p2.l) === 842, `R7. option paysage : PDF en A4 paysage (${p2.l} × ${p2.h} points), ${p2.pages} page`);
  verifie(entiers(p2, aFaire(D, ['lundi'])).length === 0 && compact(p2.textes.join('')).includes(compact('Commander les plants')), 'R2. PDF paysage : les tâches de Lundi entières, et les faites');
  verifie(await P.evaluate(() => getComputedStyle(document.querySelector('#impPage .imp-cols')).columnCount) === '3', 'R7. paysage : 3 colonnes');
  garderPdf(p2.f, 'exemple-lundi-paysage-noir-et-blanc.pdf');

  // R7 : gros caractères : 11 pt, 1 colonne en portrait, 2 en paysage.
  for (const [pays, cols] of [[true, '2'], [false, '1']]) {
    // Comme après un clic sur « Imprimer » (page.pdf passe aussi par « avant l'impression », qui reprend ce choix).
    await P.evaluate(({ pays }) => { impDernier = { listes: ['lundi', 'longue'], o: { paysage: pays, nb: false, gros: true, faites: false }, at: Date.now() }; construireImpression(impDernier.listes, impDernier.o); }, { pays });
    await P.emulateMedia({ media: 'print' });
    const g = await P.evaluate(() => [getComputedStyle(document.querySelector('#impPage .imp-cols')).columnCount, getComputedStyle(document.querySelector('#impPage')).fontSize]);
    await P.emulateMedia({ media: 'screen' });
    verifie(g[0] === cols && g[1] === '14.6667px', `R7. gros caractères en ${pays ? 'paysage' : 'portrait'} : ${g[0]} colonne(s), texte 11 pt (${g[1]})`);
  }
  const p3 = await pdf(P, 'gros.pdf');
  const coupees3 = entiers(p3, aFaire(D, ['lundi', 'longue']));
  verifie(seuls(p3, [['Longue liste', 'Planche 001 : désherber']]).length === 0, 'R2. PDF gros caractères : le titre « Longue liste » sur la même page que sa première tâche');
  verifie(coupees3.length === 0 && p3.pages > 3, `R2. PDF gros caractères, une colonne, ${p3.pages} pages : aucune tâche coupée entre deux pages (${coupees3.length})`);
  garderPdf(p3.f, 'exemple-gros-caracteres.pdf');
  await P.evaluate(() => retirerImpression());

  // R1 : sans données sur l'appareil, le bouton est grisé et le dit ; « Ctrl+P » ne construit rien.
  const sans = await P.evaluate(() => {
    if (es) { es.close(); es = null; }
    S = {}; pending = []; recalculer(); ouvrirReglages();
    const r = [document.querySelector('#reglImp').disabled, document.querySelector('#reglImpAide').textContent];
    dispatchEvent(new Event('beforeprint'));
    r.push(!!document.querySelector('#impPage'));
    document.querySelector('#reglDlg').close();
    return r;
  });
  verifie(sans[0] === true && sans[1] === 'Pas encore de données sur cet appareil.' && sans[2] === false, 'R1. sans données sur l\'appareil : « Imprimer… » grisé, « Pas encore de données sur cet appareil. »');
  verifie(erreurs.length === 0, 'ordinateur : aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  await ctxP.close();

  // ================= Téléphone (compte de l'équipe) =================
  const ctxT = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
  const T = await ctxT.newPage();
  const erreursT = []; T.on('pageerror', (e) => erreursT.push(String(e)));
  await connecter(T, 'martin');
  await T.waitForSelector('.pan[data-l="lundi"] li.t');
  await attendreQue(() => T.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await T.click('#bande .pil[data-l="courses"]');
  await pause(400);
  await T.click('.pan[data-l="courses"] .menu-l');
  await T.waitForSelector('#listeDlg[open]');
  verifie(await T.isVisible('#listeDlg [data-a="imprimer-liste"]'), 'téléphone : « Imprimer cette liste » dans le menu « ⋯ » de la liste');
  await T.click('#listeDlg [data-a="imprimer-liste"]');
  await T.waitForSelector('#impDlg[open]');
  const tel = await T.evaluate(() => {
    const d = document.querySelector('#impDlg').getBoundingClientRect(), ok = document.querySelector('#impOk').getBoundingClientRect();
    return { compte: document.querySelector('#impCompte').textContent, largeur: d.width <= innerWidth + 0.5, ok: ok.height >= 44, vu: ok.bottom <= innerHeight + 0.5, debord: document.querySelector('#impDlg').scrollWidth <= document.querySelector('#impDlg').clientWidth };
  });
  verifie(tel.compte === `1 liste · ${aFaire(D, ['courses']).length} tâches` && tel.largeur && tel.debord && tel.ok, `téléphone : la fenêtre tient dans la largeur de l'écran, bouton de 44 px, « ${tel.compte} »`);
  verifie(tel.vu, 'téléphone : le bouton « Imprimer » est visible en bas de l\'écran sans faire défiler la fenêtre');
  await capture(T, '2-telephone-fenetre.png');
  await sansFenetre(T);
  await T.click('#impOk');
  verifie(await T.evaluate(() => window.__print === 1) && memes(await imprimes(T), aFaire(D, ['courses'])), 'téléphone : impression lancée, la liste de courses entière dans la page d\'impression');
  const p4 = await pdf(T, 'telephone.pdf');
  verifie(entiers(p4, aFaire(D, ['courses'])).length === 0 && p4.l < p4.h, 'téléphone : PDF A4 portrait avec toute la liste');
  verifie(erreursT.length === 0, 'téléphone : aucune erreur JavaScript' + (erreursT.length ? ' : ' + erreursT.join(' | ') : ''));

  if (CAPTURES) {
    // Aperçu de la première page du PDF d'exemple, pour le compte rendu.
    try { execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', path.join(CAPTURES, 'exemple-toutes-les-listes.pdf'), path.join(CAPTURES, '3-pdf-page-1')]); } catch (e) { console.log('(aperçu PNG non fabriqué : ' + e.message + ')'); }
  }
  await navigateur.close();
  site.close(); base.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
