// Farm tasks, encarts propres à chaque liste (21/11, demande de François) : modèle des sept jours (Réglages → « Modifier
// les encarts des jours… », ou « ⋯ » d'un jour), encarts d'une autre liste (« ⋯ » → « Encarts de cette liste… »), nom, ordre,
// couleur, ajout, suppression (on choisit où vont les tâches : aucune n'est supprimée, les astreintes suivent), horloge
// (agenda et heure) dans le modèle seulement, création d'une liste (Aucun encart / Comme les jours / Les miens), tâche
// déplacée (encart du même nom, sinon hors encart), ancien réglage lu tel quel (aucune migration).
// Lancement depuis la racine du dépôt : node tests/encarts-listes.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8972, PORT_BASE = 8973;
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
// Encarts affichés d'une liste : « RDV, P1, Marché »
const etiquettes = (page, L) => page.evaluate((L) => Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart-tete .etiq`)).map((x) => x.textContent).join(', '), L);
// Contenu d'une liste, encart par encart : « : Hors | rdv: … | p1: A, B »
const contenu = (page, L) => page.evaluate((L) => Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart`)).map((e) => ((e.querySelector('.etiq') || {}).textContent || '') + ': ' + Array.from(e.querySelectorAll('li.t[data-id]')).map((li) => (li.querySelector('.tx') || {}).textContent).join(', ')).join(' | '), L);
const listeNommee = (base, nom) => { const l = base.lire('taches/listes') || {}; return Object.keys(l).find((k) => l[k] && l[k].nom === nom); };
async function connecter(page, id) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', id);
  await page.fill('#authMdp', MDP[id]);
  await page.click('#authOk');
}
const capture = async (page, nom) => { if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pause(250); await page.screenshot({ path: path.join(CAPTURES, nom) }); } };

(async () => {
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.aurore, 'ferme'); base.profil(uid.martin, 'equipe');

  const navigateur = await chromium.launch();
  const ctxA = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR' });
  const A = await ctxA.newPage();
  const erreursA = []; A.on('pageerror', (e) => erreursA.push(String(e)));
  await connecter(A, 'francois');
  const LJ = IDS[jourIdx()], L2 = IDS[(jourIdx() + 1) % 7];
  verifie(await attendreQue(async () => (await etiquettes(A, LJ)) === 'RDV, P1, P2'), 'au départ : RDV, P1, P2 dans les jours (fichier de départ de la ferme)');

  // Des tâches dans P2 (un jour et le lendemain, une sous-tâche), une astreinte en P2, une ancienne liste réglée à l'ancienne.
  await A.evaluate(([LJ, L2]) => {
    const t0 = Date.now();
    ecrire({
      't/p1a': { liste: LJ, parent: '', encart: 'p1', ordre: 1, texte: 'Tâche P1', by: 'francois', at: t0 },
      't/p2a': { liste: LJ, parent: '', encart: 'p2', ordre: 1, texte: 'Tâche P2 a', by: 'francois', at: t0 },
      't/p2b': { liste: LJ, parent: '', encart: 'p2', ordre: 2, texte: 'Tâche P2 b', by: 'francois', at: t0 },
      't/p2s': { liste: LJ, parent: 'p2b', encart: 'p2', ordre: 1, texte: 'Sous P2', by: 'francois', at: t0 },
      't/p2c': { liste: L2, parent: '', encart: 'p2', ordre: 1, texte: 'Autre P2', by: 'francois', at: t0 },
      't/ast1': { liste: 'astreintes', parent: '', ordre: 1, texte: 'Astreinte P2', zone: 'p2', jours: '0123456', by: 'francois', at: t0 },
      'listes/ancienne': { nom: 'Ancienne', type: 'simple', ordre: 50, encarts: { rdv: true, p1: false, p2: false }, by: 'francois', at: t0 },
      't/vieux': { liste: 'ancienne', parent: '', encart: 'rdv', ordre: 1, texte: 'Vieux RDV', by: 'francois', at: t0 },
    });
  }, [LJ, L2]);
  verifie(await attendreQue(async () => (await contenu(A, LJ)).includes('P2: Tâche P2 a, Tâche P2 b, Sous P2')), 'tâches posées dans P2');
  verifie(await attendreQue(async () => (await etiquettes(A, 'ancienne')) === 'RDV'), 'ancienne liste réglée à l\'ancienne (encarts du modèle montrés ou cachés) : lue telle quelle, RDV seulement');
  const avant = Object.keys(tachesBase(base)).length;

  // ---------- Modèle des sept jours, depuis le « ⋯ » d'un jour ----------
  await A.click(`.pan[data-l="${LJ}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  verifie(await A.evaluate(() => !!document.querySelector('#listeDlg [data-a="encarts-jours"]') && !document.querySelector('#listeDlg [data-a="encarts-liste"]')), 'menu d\'un jour : « Encarts des sept jours… »');
  await A.click('#listeDlg [data-a="encarts-jours"]'); await A.waitForSelector('#encDlg[open]');
  verifie(await A.evaluate(() => Array.from(document.querySelectorAll('#encLignes [data-enc]')).map((x) => x.value).join(',') === 'RDV,P1,P2' && document.querySelector('#encLignes [data-k="rdv"] [data-ea="heure"]').getAttribute('aria-pressed') === 'true' && document.querySelectorAll('#encLignes [aria-pressed="true"][data-ea="heure"]').length === 1), 'fenêtre du modèle : RDV, P1, P2, l\'horloge sur RDV (une seule)');
  verifie(await A.evaluate(() => document.querySelector('#encLignes [data-k="rdv"] [data-ea="haut"]').disabled && document.querySelector('#encLignes [data-k="p2"] [data-ea="bas"]').disabled), 'flèches : pas de ▲ pour le premier, pas de ▼ pour le dernier');
  await A.click('#encLignes [data-k="rdv"] [data-ea="suppr"]', { force: true }); // aria-disabled : on peut le toucher, il explique
  verifie(await A.evaluate(() => !document.getElementById('encSupprDlg').open && /horloge/.test(document.getElementById('encMsg').textContent) && !document.getElementById('encMsg').hidden), 'l\'encart à l\'horloge ne se supprime pas tant qu\'un autre ne l\'a pas');
  await A.click('#encAj');
  verifie(await A.evaluate(() => { const x = document.querySelectorAll('#encLignes [data-enc]'); return x.length === 4 && x[3].value === 'Encart 4'; }), '« Ajouter un encart » : « Encart 4 »');
  const nouveau = await A.evaluate(() => document.querySelectorAll('#encLignes [data-enc]')[3].dataset.enc);
  await A.fill(`#encLignes [data-enc="${nouveau}"]`, 'Marché');
  await A.click(`#encLignes [data-k="${nouveau}"] [data-ea="couleur"]`);
  await A.click('#encLignes .enc-pal [data-ecoul="violet"]');
  await A.click(`#encLignes [data-k="${nouveau}"] [data-ea="haut"]`);
  verifie(await A.evaluate(() => Array.from(document.querySelectorAll('#encLignes [data-enc]')).map((x) => x.value).join(',') === 'RDV,P1,Marché,P2'), 'nom gardé, ▲ : Marché passe avant P2');
  await capture(A, '1-telephone-encarts-des-jours.png');
  await A.click('#encLignes [data-k="p2"] [data-ea="suppr"]'); await A.waitForSelector('#encSupprDlg[open]');
  verifie(await A.evaluate(() => { const t = document.getElementById('encSupprTexte').textContent; return /4 tâches, dans 2 listes et 1 astreinte/.test(t) && Array.from(document.querySelectorAll('#encSupprChoix label')).map((l) => l.textContent.split(/RDV|P1|Marché/)[0] || l.textContent).length === 4; }), 'supprimer P2 : « 4 tâches, dans 2 listes et 1 astreinte », choix RDV, P1, Marché ou hors encart ' + JSON.stringify(await A.evaluate(() => document.getElementById('encSupprTexte').textContent)));
  await capture(A, '2-telephone-supprimer-un-encart.png');
  await A.click('#encSupprChoix input[value="p1"]');
  await A.click('#encSupprOui');
  verifie(await A.evaluate(() => Array.from(document.querySelectorAll('#encLignes [data-enc]')).map((x) => x.value).join(',') === 'RDV,P1,Marché'), 'P2 retiré de la fenêtre');
  verifie((base.lire('taches/t/p2a') || {}).encart === 'p2' && !(base.lire('taches/reglages') || {}).encartsInfo, 'rien d\'écrit avant « Enregistrer »');
  await A.click('#encOk');
  verifie(await attendreQue(() => { const r = base.lire('taches/reglages') || {}; return r.encarts && Object.keys(r.encarts).sort().join(',') === ['p1', 'rdv', nouveau].sort().join(',') && r.encarts[nouveau] === 'Marché' && r.encarts.rdv === 'RDV' && r.encarts.p1 === 'P1' && r.encartsInfo[nouveau].couleur === 'violet' && r.encartsInfo[nouveau].ordre === 3 && r.encartHeure === 'rdv'; }), 'base : modèle RDV, P1, Marché (violet, 3e), horloge sur RDV');
  verifie(await attendreQue(() => ['p2a', 'p2b', 'p2s', 'p2c'].every((k) => (base.lire('taches/t/' + k) || {}).encart === 'p1') && base.lire('taches/t/ast1').zone === 'p1'), 'les tâches de P2 (sous-tâche comprise) et l\'astreinte vont dans P1');
  verifie(Object.keys(tachesBase(base)).length === avant, 'aucune tâche supprimée (' + avant + ' tâches avant et après)');
  verifie(await attendreQue(async () => (await contenu(A, LJ)) === 'RDV:  | P1: Tâche P1, Tâche P2 a, Tâche P2 b, Sous P2 | Marché: '), 'le jour : RDV, P1 (les tâches de P2 à la suite), Marché ' + JSON.stringify(await contenu(A, LJ)));
  verifie(await A.evaluate((L) => { const e = Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart-tete .etiq`)).pop(); return getComputedStyle(e).backgroundColor === 'rgb(239, 227, 247)'; }, LJ), 'Marché en violet');
  verifie(await attendreQue(async () => (await etiquettes(A, L2)) === 'RDV, P1, Marché' && (await etiquettes(A, 'ancienne')) === 'RDV'), 'tous les jours ont le nouveau modèle ; l\'ancienne liste ne change pas');

  // ---------- Nouvelle liste « Courses » : « Les miens » ----------
  await A.click('.pil.nouv'); await A.waitForSelector('#nomDlg[open]');
  verifie(await A.evaluate(() => !document.getElementById('nomEnc').hidden && document.querySelector('#nomEnc input:checked').value === 'aucun' && document.getElementById('nomEncJours').textContent === 'RDV · P1 · Marché'), 'nouvelle liste : Aucun encart (coché), Comme les jours (RDV · P1 · Marché), Les miens');
  await A.fill('#nomVal', 'Courses');
  await A.click('#nomEnc input[value="miens"]');
  await capture(A, '3-telephone-nouvelle-liste.png');
  await A.click('#nomForm [type="submit"]');
  verifie(await attendreQue(() => A.evaluate(() => document.getElementById('encDlg').open && /Courses/.test(document.getElementById('encTitre').textContent) && !document.querySelector('#encLignes [data-enc]') && !document.querySelector('#encLignes [data-ea="heure"]'))), '« Les miens » : la fenêtre des encarts de Courses s\'ouvre, vide, sans horloge');
  for (const n of ['Très Allier', 'Biocoop', 'Carrefour']) {
    await A.click('#encAj');
    await A.fill('#encLignes .enc-l:last-of-type input', n);
  }
  await capture(A, '4-telephone-encarts-de-courses.png');
  await A.click('#encOk');
  const LC = listeNommee(base, 'Courses');
  verifie(await attendreQue(() => { const p = LC && base.lire(`taches/listes/${LC}/encartsPropres`); return p && Object.values(p).sort((a, b) => a.ordre - b.ordre).map((x) => x.nom).join(',') === 'Très Allier,Biocoop,Carrefour'; }), 'base : Courses a ses trois encarts');
  verifie(await attendreQue(async () => (await etiquettes(A, LC)) === 'Très Allier, Biocoop, Carrefour'), 'Courses affiche Très Allier, Biocoop, Carrefour');
  verifie((await etiquettes(A, LJ)) === 'RDV, P1, Marché' && (await etiquettes(A, 'ancienne')) === 'RDV', 'les autres listes ne changent pas');
  await A.evaluate((L) => ecrire({ ['t/carf']: { liste: L, parent: '', encart: Object.entries(D.listes[L].encartsPropres).find(([, x]) => x.nom === 'Carrefour')[0], ordre: 1, texte: 'Café', by: 'francois', at: Date.now() } }), LC);
  verifie(await attendreQue(async () => (await contenu(A, LC)).includes('Carrefour: Café')), 'une tâche dans Carrefour');
  await capture(A, '5-telephone-liste-courses.png');

  // ---------- « Comme les jours » à la création ; déplacer une tâche (même nom, sinon hors encart) ----------
  await A.click('.pil.nouv'); await A.waitForSelector('#nomDlg[open]');
  await A.fill('#nomVal', 'Semaine'); await A.click('#nomEnc input[value="jours"]'); await A.click('#nomForm [type="submit"]');
  const LS = await (async () => { await attendreQue(() => listeNommee(base, 'Semaine')); return listeNommee(base, 'Semaine'); })();
  verifie(await attendreQue(async () => (await etiquettes(A, LS)) === 'RDV, P1, Marché') && !(await A.evaluate(() => document.getElementById('encDlg').open)), '« Comme les jours » : Semaine reçoit RDV, P1, Marché (ses propres encarts)');
  await A.evaluate((L) => allerA(L), LJ);
  await A.click(`${ligne(LJ, 'Tâche P1')} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-a="deplacer"]'); await A.waitForSelector('#choixDlg[open]');
  await A.click(`#choixDlg [data-l="${LS}"]`);
  verifie(await attendreQue(() => { const t = base.lire('taches/t/p1a'); return t.liste === LS && t.encart === 'p1'; }), 'déplacée vers Semaine : dans son P1 (même nom)');
  await A.evaluate((L) => allerA(L), LJ);
  await A.click(`${ligne(LJ, 'Tâche P2 a')} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-a="deplacer"]'); await A.waitForSelector('#choixDlg[open]');
  await A.click(`#choixDlg [data-l="${LC}"]`);
  verifie(await attendreQue(() => { const t = base.lire('taches/t/p2a'); return t.liste === LC && t.encart === ''; }), 'déplacée vers Courses (pas de P1) : hors encart');

  // ---------- Courses : supprimer Carrefour (sa tâche hors encart) ; « ⋯ » d'une liste ; Semaine : « Aucun encart » ----------
  await A.evaluate((L) => allerA(L), LC);
  await A.click(`.pan[data-l="${LC}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  verifie(await A.evaluate(() => !!document.querySelector('#listeDlg [data-a="encarts-liste"]') && !document.querySelector('#listeDlg [data-a="ajouter-encart"]') && !document.querySelector('#listeDlg [data-a="encarts-jours"]')), 'menu d\'une autre liste : « Encarts de cette liste… »');
  await A.click('#listeDlg [data-a="encarts-liste"]'); await A.waitForSelector('#encDlg[open]');
  await A.click('#encLignes .enc-l:last-of-type [data-ea="suppr"]'); await A.waitForSelector('#encSupprDlg[open]');
  verifie(await A.evaluate(() => /1 tâche, dans 1 liste/.test(document.getElementById('encSupprTexte').textContent)), 'supprimer Carrefour : « 1 tâche, dans 1 liste »');
  await A.click('#encSupprChoix input[value=""]'); await A.click('#encSupprOui'); await A.click('#encOk');
  verifie(await attendreQue(() => { const p = base.lire(`taches/listes/${LC}/encartsPropres`) || {}; const t = base.lire('taches/t/carf'); return Object.keys(p).length === 2 && t && t.encart === ''; }), 'Carrefour supprimé, Café hors encart (pas supprimé)');
  await A.evaluate((L) => allerA(L), LS);
  await A.click(`.pan[data-l="${LS}"] [data-a="menu-liste"]`); await A.waitForSelector('#listeDlg[open]');
  await A.click('#listeDlg [data-a="encarts-liste"]'); await A.waitForSelector('#encDlg[open]');
  await A.click('#encDepart [data-a="aucun-encart"]');
  verifie(await A.evaluate(() => !document.querySelector('#encLignes [data-enc]') && /1 tâche ira hors encart/.test(document.getElementById('encMsg').textContent)), '« Aucun encart » : plus d\'encart, « 1 tâche ira hors encart »');
  await A.click('#encDepart [data-a="comme-jours"]');
  verifie(await A.evaluate(() => Array.from(document.querySelectorAll('#encLignes [data-enc]')).map((x) => x.value).join(',') === 'RDV,P1,Marché'), '« Comme les jours » les remet');
  await A.click('#encDepart [data-a="aucun-encart"]'); await A.click('#encOk');
  verifie(await attendreQue(() => base.lire(`taches/listes/${LS}/encartsPropres`) === null && base.lire('taches/t/p1a').encart === '' && base.lire('taches/t/p1a').liste === LS), 'Semaine sans encart, sa tâche hors encart');
  verifie(await attendreQue(async () => (await etiquettes(A, LS)) === ''), 'Semaine n\'affiche plus d\'encart');

  // ---------- Ordinateur (Aurore) : mêmes encarts, fenêtre des encarts ----------
  const ctxP = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const P = await ctxP.newPage();
  const erreursP = []; P.on('pageerror', (e) => erreursP.push(String(e)));
  await connecter(P, 'aurore');
  verifie(await attendreQue(async () => (await etiquettes(P, LC)) === 'Très Allier, Biocoop' && (await etiquettes(P, LJ)) === 'RDV, P1, Marché'), 'ordinateur : Courses (Très Allier, Biocoop) et les jours (RDV, P1, Marché)');
  await P.evaluate((L) => document.querySelector(`.pan[data-l="${L}"]`).scrollIntoView({ inline: 'nearest' }), LC);
  await capture(P, '6-ordinateur-listes.png');
  await P.click('.menu [data-a="reglages"]'); await P.waitForSelector('#reglDlg[open]');
  verifie(await P.evaluate(() => document.getElementById('reglEnc').textContent.replace(/\s/g, '') === 'RDV🕘P1Marché'), 'Réglages : résumé des encarts des jours, horloge sur RDV');
  await P.click('#reglEncModif'); await P.waitForSelector('#encDlg[open]');
  await capture(P, '7-ordinateur-encarts-des-jours.png');
  await P.click('#encLignes [data-k="p1"] [data-ea="heure"]');
  await P.click('#encOk');
  verifie(await attendreQue(() => (base.lire('taches/reglages') || {}).encartHeure === 'p1'), 'horloge déplacée sur P1');
  await P.click('#reglDlg [data-a="fermer"]');
  await A.evaluate((L) => ecrire({ ['t/h1']: { liste: L, parent: '', encart: 'p1', ordre: 9, heure: '07:15', texte: 'Livraison', by: 'francois', at: Date.now() } }), L2);
  verifie(await attendreQue(() => P.evaluate((L) => { const t = Array.from(document.querySelectorAll(`.pan[data-l="${L}"] .encart[data-e="p1"] li.t .tx`)); return t.length && t[0].textContent === '07:15 Livraison'; }, L2)), 'l\'encart à l\'horloge montre l\'heure et trie par heure (P1)');

  const erreurs = erreursA.concat(erreursP);
  verifie(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await navigateur.close(); site.close(); base.close();
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
