// Étape 55 (docs/CONTRAT_CHRONOMETRE.md) : chronomètre des tâches (téléphone seulement, en option) et historique des
// tâches réalisées (toujours actif, dans un nœud à part de la base : taches-historique, choix de François du 27/11).
// Faux Firebase, données inventées (tests/donnees-apparence.cjs), heure figée un mardi à 9 h puis avancée à la main.
// Couvre la partie 5 du contrat : mode éteint (rien ne change), Réglages (ferme seulement), ▶ ⏸ ▶ ■ (une écriture groupée,
// ligne d'historique, « Faites récemment », chrono effacé), un seul chrono en marche par personne, cocher sans chrono,
// cocher une mère (une ligne + sous-tâches chronométrées), suppression (pas de ligne), « Remettre » / « Annuler » retire
// la ligne, temps exact après rechargement et hors ligne (heure du toucher), chrono partagé entre deux téléphones, ordinateur
// sans bouton (cocher y termine le chrono), chrono oublié (3 choix, « vu » gelé), historique (période lue par clés, jamais
// en entier, filtres, 50 par page), export CSV relu, correction et droits, aucune écriture en consultant ou exportant,
// règle pas encore publiée (la tâche cochée n'est pas perdue, la ligne attend sur l'appareil puis repart).
// Lancement depuis la racine du dépôt : node tests/chronometre.cjs   (APPARENCE=pixel pour le pixel art ; CAPTURES=dossier)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
const donnees = require('./donnees-apparence.cjs');
const { PIXEL } = require('./apparence-env.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const PORT_SITE = 8986, PORT_BASE = 8987;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', martin: 'mdp-martin-1', lea: 'mdp-lea-1' };
const CAPTURES = process.env.CAPTURES || '';
const MIN = 60000, H = 3600000;
// Mardi 24/11/2026, 9 h (heure de Paris) : semaine ISO 48 (du lundi 23 au dimanche 29).
const T0 = new Date('2026-11-24T09:00:00+01:00').getTime();
const TEL = { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true };
const PC = { viewport: { width: 1920, height: 1080 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true };

function serveurSite() {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (f.endsWith('/')) f += 'index.html';
      if (f === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_DB_URL='http://localhost:${PORT_BASE}';window.RECOLTE_AUTH_URL='http://localhost:${PORT_BASE}/v1';window.RECOLTE_JETON_URL='http://localhost:${PORT_BASE}/v1';`); }
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
const capture = async (page, nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, { recursive: true }); await pause(400); await page.screenshot({ path: path.join(CAPTURES, nom) }); };
const hist = (base) => base.lire('taches-historique') || {};
const lignes = (base) => Object.entries(hist(base)).map(([k, l]) => ({ k, ...l }));
const chrono = (base, p, t) => base.lire(`taches/chrono/${p}/${t}`);
const tache = (L, id) => `.pan[data-l="${L}"] li.t[data-id="${id}"]`;
const btn = (L, id, k) => `${tache(L, id)} .chr-${k}`;

async function connecter(page, qui, liste = 'mardi') {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', qui);
  await page.fill('#authMdp', MDP[qui]);
  await page.click('#authOk');
  await page.waitForSelector(`.pan[data-l="${liste}"] li.t`);
  await attendreQue(() => page.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await page.evaluate(() => document.fonts.ready);
  await pause(300);
}
async function appareil(nav, opts, qui, t, liste) {
  const ctx = await nav.newContext(opts);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(t);
  page.erreurs = []; page.on('pageerror', (e) => page.erreurs.push(String(e)));
  await connecter(page, qui, liste);
  return { ctx, page };
}
const heure = async (pages, t) => { for (const p of pages) await p.clock.setFixedTime(t); await pause(1300); };
const envoye = (page) => attendreQue(() => page.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
const aller = async (page, L) => { await page.click(`#bande .pil[data-l="${L}"]`); await pause(500); };
const patchsDepuis = (base, n) => base.patchs.slice(n).filter((x) => !(x.cles.length === 1 && /\/vu$/.test(x.cles[0])));

(async () => {
  const D = donnees(T0);
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  base.profil(base.creerCompte('francois@ferme.invalid', MDP.francois), 'ferme');
  base.profil(base.creerCompte('martin@ferme.invalid', MDP.martin), 'equipe');
  base.profil(base.creerCompte('lea@ferme.invalid', MDP.lea), 'equipe');
  D.reglages.personnes.martin = { nom: 'Martin', initiale: 'M', couleur: 'violet', ordre: 5 };
  base.poser('taches', JSON.parse(JSON.stringify(D)));
  const nav = await chromium.launch();

  // ================= 1. Mode éteint (par défaut) : la case à cocher seule, l'historique se remplit quand même =================
  let { ctx: ctxA, page: A } = await appareil(nav, TEL, 'francois', T0);
  const { ctx: ctxC, page: C } = await appareil(nav, PC, 'francois', T0);
  verifie(await A.evaluate(() => !document.querySelector('.chr-btn') && document.getElementById('chrBande').hidden), 'mode éteint (par défaut) : aucun bouton ▶ ⏸ ■ ni bandeau sur le téléphone');
  verifie(await C.evaluate(() => !document.querySelector('.chr-btn')), 'mode éteint : aucun bouton sur l\'ordinateur');
  verifie(base.lire('taches/reglages/chronometre') === null, 'le réglage n\'existe pas dans la base au départ (éteint)');
  let n0 = base.patchs.length;
  await A.click(`${tache('mardi', 'm5')} .coche`);
  await attendreQue(() => lignes(base).length === 1);
  let L = lignes(base);
  verifie(L.length === 1 && L[0].chrono === false && L[0].debut === undefined && L[0].duree === undefined && L[0].fin === T0 && L[0].by === 'francois' && L[0].liste === 'mardi' && L[0].listeNom === 'Mardi' && L[0].texte === 'Trier les factures du mois' && L[0].tache === 'm5',
    'cocher sans chrono (mode éteint) : une ligne « sans chrono » (fin = heure du toucher, pas de début ni de durée) ' + JSON.stringify(L[0]));
  let P = patchsDepuis(base, n0);
  verifie(P.length === 1 && P[0].p === '' && P[0].cles.includes('taches/t/m5') && P[0].cles.includes('taches/faites/m5') && P[0].cles.includes('taches-historique/' + L[0].k), 'une seule écriture groupée : tâche cochée, « Faites récemment » et ligne d\'historique ' + JSON.stringify(P));
  verifie(base.lire('taches/faites/m5/h/' + L[0].k) === true, '« Faites récemment » garde le lien vers la ligne d\'historique (champ h)');
  verifie(/^[0-9a-z]{14}$/.test(L[0].k) && L[0].k.slice(0, 9) === T0.toString(36).padStart(9, '0'), 'clé horodatée : l\'heure de fin en base 36 sur 9 caractères, puis 5 au hasard (' + L[0].k + ')');
  verifie(base.lire('taches/historique') === null, 'rien sous taches/ : l\'historique est hors du flux en direct');

  // ================= 2. Réglages : la case « Mode chronomètre » (ferme seulement) =================
  const { ctx: ctxM, page: M } = await appareil(nav, TEL, 'martin', T0);
  await M.click('#avatar'); await M.click('#versReglages'); await M.waitForSelector('#reglDlg[open]');
  verifie(await M.evaluate(() => document.getElementById('reglChrono').disabled && !document.getElementById('reglChronoQui').hidden), 'compte de l\'équipe : la case « Mode chronomètre » est grisée (« Réglé par un compte de la ferme »)');
  await M.click('#reglDlg [data-a="fermer"]');
  await A.click('#avatar'); await A.click('#versReglages'); await A.waitForSelector('#reglDlg[open]');
  const r1 = await A.evaluate(() => { const c = document.getElementById('reglChrono'); return { coche: c.checked, grise: c.disabled, texte: document.getElementById('reglChronoBloc').textContent.replace(/\s+/g, ' ').trim() }; });
  verifie(!r1.coche && !r1.grise && /Chronomètre Mode chronomètre\s*Éteint par défaut/.test(r1.texte) && /Ouvrir l'historique/.test(r1.texte), 'Réglages → « Chronomètre » : case « Mode chronomètre » décochée, aide, « Ouvrir l\'historique… » ' + JSON.stringify(r1));
  await A.evaluate(() => document.getElementById('reglChronoBloc').scrollIntoView());
  await A.check('#reglChrono');
  await capture(A, 'telephone-1-reglages.png');
  await A.click('#reglForm [type="submit"]');
  await attendreQue(() => base.lire('taches/reglages/chronometre') === true);
  verifie(base.lire('taches/reglages/chronometre') === true, 'Enregistrer : taches/reglages/chronometre = true (pour toute la ferme)');
  await attendreQue(() => A.evaluate(() => !!document.querySelector('.chr-btn')));

  // ================= 3. Téléphone : ▶ ⏸ ■ ; ordinateur : rien =================
  const s3 = await A.evaluate(() => Array.from(document.querySelectorAll('.pan[data-l="mardi"] li.t[data-id]')).map((li) => li.dataset.id + ':' + Array.from(li.querySelectorAll('.chr-btn')).map((b) => b.dataset.a).join('+')));
  verifie(s3.length > 3 && s3.every((x) => /:chr-start$/.test(x)), 'mode allumé : chaque tâche du téléphone a ▶ (et rien d\'autre tant qu\'aucun chrono ne tourne) ' + s3.join(' '));
  await attendreQue(() => C.evaluate(() => document.querySelector('.pan[data-l="mardi"]') && true));
  await pause(500);
  verifie(await C.evaluate(() => !document.querySelector('.chr-btn, .chr-etat, li.chr-on') && document.getElementById('chrBande').hidden), 'ordinateur, mode allumé : aucun bouton chronomètre, aucune ligne changée');
  const zone = await A.evaluate(() => { const b = document.querySelector('.pan[data-l="mardi"] .chr-btn').getBoundingClientRect(); const s = getComputedStyle(document.querySelector('.pan[data-l="mardi"] .chr-btn'), '::after'); return { l: b.width, h: b.height, ext: s.inset }; });
  verifie(zone.l >= 32 && zone.h >= 32, 'bouton ▶ d\'au moins 32 points, zone à toucher élargie par ::after ' + JSON.stringify(zone));
  const zoneMin = await A.evaluate(() => { const b = document.querySelector('.pan[data-l="mardi"] .chr-btn'), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return [[x - 21, y], [x + 21, y], [x, y - 21], [x, y + 21]].map(([u, v]) => { const e = document.elementFromPoint(u, v); return e && e.closest('.chr-btn') === b ? 'ok' : (e ? e.className || e.tagName : 'rien'); }); });
  verifie(zoneMin.every((x) => x === 'ok'), 'zone à toucher de 44 points autour du centre du bouton (R3) ' + zoneMin.join());
  const forme = await A.evaluate(() => Array.from(document.querySelector('.chr-start svg').querySelectorAll('path')).filter((p) => getComputedStyle(p).display !== 'none').map((p) => p.getAttribute('class')));
  verifie(PIXEL ? forme.join() === 'px' : forme.join() === 'lisse', 'triangle ▶ dessiné en forme pleine' + (PIXEL ? ', en marches (pixel art)' : ', lisse (classique)') + ' : ' + forme.join());

  // ▶ sur « Nettoyer les caisses »
  n0 = base.patchs.length;
  await A.click(btn('mardi', 'm3', 'start'));
  await attendreQue(() => chrono(base, 'francois', 'm3'));
  let c = chrono(base, 'francois', 'm3');
  verifie(c && c.etat === 'marche' && c.debut === T0 && c.depuis === T0 && c.cumul === 0 && c.by === 'francois' && c.liste === 'mardi' && c.texte === 'Nettoyer les caisses', '▶ : chrono dans la base (taches/chrono/francois/m3), en marche, début = heure du toucher ' + JSON.stringify(c));
  verifie(patchsDepuis(base, n0).length === 1, '▶ = une seule écriture');
  await attendreQue(() => A.evaluate(() => !document.getElementById('chrBande').hidden));
  await heure([A], T0 + 90 * 1000);
  let s = await A.evaluate(() => ({ li: document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"]').className, etat: (document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-etat') || {}).textContent, btns: Array.from(document.querySelectorAll('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-btn')).map((b) => b.dataset.a).join('+'), bande: document.getElementById('chrBande').textContent, bandeBtns: Array.from(document.querySelectorAll('#chrBande .chr-btn')).map((b) => b.dataset.a).join('+') }));
  verifie(/chr-marche/.test(s.li) && s.etat === 'En cours · 00:01:30' && s.btns === 'chr-pause+chr-stop', 'en marche : ⏸ et ■, « En cours · 00:01:30 » calculé depuis l\'heure de départ ' + JSON.stringify(s));
  verifie(s.bande.includes('Nettoyer les caisses') && s.bande.includes('00:01:30') && s.bandeBtns === 'chr-pause+chr-stop', 'bandeau « en cours » sous la barre du haut : ⏸ ■, la tâche et son temps');
  await capture(A, 'telephone-2-en-cours.png');

  // Le même chrono sur un deuxième téléphone de la même personne
  const { ctx: ctxB, page: B } = await appareil(nav, TEL, 'francois', T0 + 90 * 1000);
  await pause(800);
  s = await B.evaluate(() => ({ etat: (document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-etat') || {}).textContent, bande: document.getElementById('chrBande').hidden }));
  verifie(s.etat === 'En cours · 00:01:30' && !s.bande, 'deuxième téléphone de la même personne : le même chrono, le même temps (partagé par la base) ' + JSON.stringify(s));

  // Un deuxième ▶ met le premier en pause
  await heure([A, B], T0 + 5 * MIN);
  n0 = base.patchs.length;
  await A.click(btn('mardi', 'm2', 'start'));
  await attendreQue(() => chrono(base, 'francois', 'm2'));
  const c3 = chrono(base, 'francois', 'm3'), c2 = chrono(base, 'francois', 'm2');
  verifie(c3.etat === 'pause' && c3.cumul === 5 * MIN && c3.depuis === undefined && c2.etat === 'marche' && c2.debut === T0 + 5 * MIN, '▶ sur une autre tâche : la première passe en pause (5 min gardées), la nouvelle démarre (R4) ' + JSON.stringify({ c3, c2 }));
  verifie(patchsDepuis(base, n0).length === 1, 'pause de l\'une et départ de l\'autre : une seule écriture');
  const marche = Object.values(base.lire('taches/chrono/francois')).filter((x) => x.etat === 'marche').length;
  verifie(marche === 1, 'une personne n\'a qu\'un chrono en marche (' + marche + ')');
  await attendreQue(() => B.evaluate(() => (document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-etat') || {}).textContent === 'En pause · 00:05:00'));
  s = await B.evaluate(() => ({ e3: (document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-etat') || {}).textContent, b3: Array.from(document.querySelectorAll('.pan[data-l="mardi"] li.t[data-id="m3"] .chr-btn')).map((b) => b.dataset.a).join('+'), cl: document.querySelector('.pan[data-l="mardi"] li.t[data-id="m3"]').className }));
  verifie(s.e3 === 'En pause · 00:05:00' && s.b3 === 'chr-start+chr-stop' && /chr-pause/.test(s.cl), 'deuxième téléphone, tout de suite : « En pause · 00:05:00 », ▶ (reprendre) et ■ ' + JSON.stringify(s));
  await capture(A, 'telephone-3-marche-et-pause.png');

  // ⏸ puis ▶ (reprise) puis ■
  await heure([A, B], T0 + 10 * MIN);
  await A.click(btn('mardi', 'm2', 'pause'));
  await attendreQue(() => (chrono(base, 'francois', 'm2') || {}).etat === 'pause');
  verifie(chrono(base, 'francois', 'm2').cumul === 5 * MIN, '⏸ : temps gardé (5 min), plus de départ en cours');
  await heure([A, B], T0 + 15 * MIN);
  await A.click(btn('mardi', 'm2', 'start'));
  await attendreQue(() => (chrono(base, 'francois', 'm2') || {}).etat === 'marche');
  verifie(chrono(base, 'francois', 'm2').depuis === T0 + 15 * MIN && chrono(base, 'francois', 'm2').debut === T0 + 5 * MIN, '▶ après ⏸ : reprise, le début reste celui du premier ▶');
  await heure([A, B], T0 + 20 * MIN);
  n0 = base.patchs.length;
  let avant = lignes(base).length;
  await A.click(btn('mardi', 'm2', 'stop'));
  await attendreQue(() => lignes(base).length === avant + 1);
  L = lignes(base).filter((l) => l.tache === 'm2');
  verifie(L.length === 1 && L[0].chrono === true && L[0].debut === T0 + 5 * MIN && L[0].fin === T0 + 20 * MIN && L[0].duree === 10 * MIN && L[0].pause === 5 * MIN && L[0].by === 'francois', '■ : une ligne avec début, fin, 10 min de travail et 5 min de pause (pauses déduites) ' + JSON.stringify(L[0]));
  verifie(!base.lire('taches/t/m2') && !base.lire('taches/t/m2a') && base.lire('taches/faites/m2') && !chrono(base, 'francois', 'm2'), '■ : la tâche et ses sous-tâches partent dans « Faites récemment », le chrono est effacé');
  P = patchsDepuis(base, n0);
  verifie(P.length === 1 && P[0].cles.length === 6, '■ : une seule écriture groupée (tâche, 2 sous-tâches, Faites récemment, chrono, ligne) ' + JSON.stringify(P));
  verifie(lignes(base).filter((l) => l.fin === T0 + 20 * MIN).length === 1, '■ sur une mère dont les sous-tâches n\'ont pas de chrono : une seule ligne');
  await attendreQue(() => B.evaluate(() => !document.querySelector('.pan[data-l="mardi"] li.t[data-id="m2"]')));
  verifie(await B.evaluate(() => document.getElementById('chrBande').hidden), 'deuxième téléphone : plus de bandeau (aucun chrono en marche)');

  // Cocher la case d'une tâche en pause = ■
  await heure([A, B], T0 + 22 * MIN);
  avant = lignes(base).length;
  await A.click(`${tache('mardi', 'm3')} .coche`);
  await attendreQue(() => lignes(base).length === avant + 1);
  L = lignes(base).filter((l) => l.tache === 'm3');
  verifie(L.length === 1 && L[0].chrono === true && L[0].duree === 5 * MIN && L[0].fin === T0 + 22 * MIN && !chrono(base, 'francois', 'm3'), 'cocher la case d\'une tâche dont le chrono est en pause : comme ■ (5 min, chrono effacé) ' + JSON.stringify(L[0]));

  // Mère cochée : une ligne pour elle + une pour la sous-tâche chronométrée
  await aller(A, 'mercredi');
  await A.click(btn('mercredi', 'w2a', 'start'));
  await attendreQue(() => chrono(base, 'francois', 'w2a'));
  await heure([A, B], T0 + 30 * MIN);
  avant = lignes(base).length;
  await A.click(`${tache('mercredi', 'w2')} .coche`);
  await attendreQue(() => lignes(base).length === avant + 2);
  L = lignes(base).filter((l) => l.tache === 'w2' || l.tache === 'w2a');
  const lw2 = L.find((l) => l.tache === 'w2'), lw2a = L.find((l) => l.tache === 'w2a');
  verifie(L.length === 2 && lw2 && lw2.chrono === false && lw2a && lw2a.chrono === true && lw2a.duree === 8 * MIN, 'cocher une mère : une ligne « sans chrono » pour elle et une pour sa sous-tâche chronométrée (8 min) ' + JSON.stringify(L));
  verifie(Object.keys(base.lire('taches/faites/w2/h') || {}).length === 2, '« Faites récemment » de la mère garde les deux lignes');

  // Supprimer (≠ réaliser) : pas de ligne, chrono effacé
  await aller(A, 'mardi');
  await A.click(btn('mardi', 'm4', 'start'));
  await attendreQue(() => chrono(base, 'francois', 'm4'));
  avant = lignes(base).length;
  await A.click(`${tache('mardi', 'm4')} .pt`); await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-a="supprimer-tache"]');
  await attendreQue(() => !base.lire('taches/t/m4'));
  await pause(500);
  verifie(lignes(base).length === avant && !chrono(base, 'francois', 'm4'), 'supprimer une tâche chronométrée : aucune ligne d\'historique, chrono effacé (R6)');

  // « Annuler » juste après avoir coché : la ligne est retirée (R8)
  avant = lignes(base).length;
  await A.click(`${tache('mardi', 'm1')} .coche`);
  await attendreQue(() => lignes(base).length === avant + 1);
  await A.click('#bandeau [data-a="annuler"]');
  await attendreQue(() => lignes(base).length === avant && base.lire('taches/t/m1'));
  verifie(lignes(base).length === avant && !!base.lire('taches/t/m1') && !base.lire('taches/faites/m1'), '« Annuler » (ou « Remettre ») : la tâche revient et sa ligne d\'historique est retirée');
  // « Remettre » depuis « Faites récemment »
  avant = lignes(base).length;
  await A.click(`${tache('mardi', 'm1')} .coche`);
  await attendreQue(() => lignes(base).length === avant + 1);
  await pause(3200);
  await A.click('.pan[data-l="mardi"] .pan-tete [data-a="menu-liste"]'); await A.waitForSelector('#listeDlg[open]');
  await A.click('#listeDlg [data-a="faites"]'); await A.waitForSelector('#choixDlg[open]');
  await A.click('#choixListe [data-f="m1"]');
  await attendreQue(() => lignes(base).length === avant);
  await A.click('#choixDlg [data-a="fermer"]');
  verifie(lignes(base).length === avant && !!base.lire('taches/t/m1'), '« Faites récemment » → « Remettre » : la ligne d\'historique est retirée');

  // Hors ligne : l'heure du toucher, pas celle de l'envoi
  await heure([A, B], T0 + 40 * MIN);
  await ctxA.setOffline(true);
  await A.click(btn('mardi', 'm1', 'start'));
  await pause(400);
  verifie(!chrono(base, 'francois', 'm1') && await A.evaluate(() => (document.querySelector('.pan[data-l="mardi"] li.t[data-id="m1"] .chr-etat') || {}).textContent === 'En cours · 00:00:00'), 'hors ligne : ▶ s\'affiche tout de suite, rien n\'est encore envoyé');
  await heure([A, B], T0 + 45 * MIN);
  await ctxA.setOffline(false);
  await A.evaluate(() => dispatchEvent(new Event('online')));
  await attendreQue(() => chrono(base, 'francois', 'm1'), 20000);
  verifie((chrono(base, 'francois', 'm1') || {}).debut === T0 + 40 * MIN, 'revenu en ligne : le chrono part avec l\'heure du toucher (9 h 40), pas celle de l\'envoi (9 h 45)');
  // Rechargement : le temps est recalculé depuis la base
  await heure([A, B], T0 + 52 * MIN);
  await A.reload(); await A.waitForSelector('.pan[data-l="mardi"] li.t[data-id="m1"] .chr-etat'); await pause(1200);
  verifie(await A.evaluate(() => document.querySelector('.pan[data-l="mardi"] li.t[data-id="m1"] .chr-etat').textContent) === 'En cours · 00:12:00', 'après rechargement : « En cours · 00:12:00 » (calculé depuis les heures, jamais un compteur)');

  // Ordinateur : cocher une tâche dont le chrono tourne sur un téléphone la termine
  await heure([A, B, C], T0 + 60 * MIN);
  await attendreQue(() => C.evaluate(() => !!document.querySelector('.pan[data-l="mardi"] li.t[data-id="m1"]')));
  avant = lignes(base).length;
  await C.click(`${tache('mardi', 'm1')} .coche`);
  await attendreQue(() => lignes(base).length === avant + 1);
  L = lignes(base).filter((l) => l.tache === 'm1');
  verifie(L.length === 1 && L[0].chrono === true && L[0].duree === 20 * MIN && !chrono(base, 'francois', 'm1'), 'ordinateur : cocher une tâche dont le chrono tourne sur le téléphone la termine (20 min), aucune donnée en suspens');
  await attendreQue(() => A.evaluate(() => document.getElementById('chrBande').hidden));

  // ================= 4. Chrono oublié (R9) =================
  await ctxB.close();
  base.poser('taches/chrono/francois/j5', { by: 'francois', texte: 'Tailler la haie du chemin', liste: 'jeudi', debut: T0 - 20 * H, cumul: 0, depuis: T0 - 20 * H, etat: 'marche', vu: T0 - 18 * H });
  base.poser('taches/chrono/francois/v3', { by: 'francois', texte: 'Tour des cultures', liste: 'vendredi', debut: T0 - 14 * H, cumul: 0, depuis: T0 - 14 * H, etat: 'marche', vu: T0 - 13 * H });
  base.poser('taches/chrono/lea/j3', { by: 'lea', texte: 'Saisie des apports du mois', liste: 'jeudi', debut: T0 - 30 * H, cumul: 0, depuis: T0 - 30 * H, etat: 'marche', vu: T0 - 29 * H });
  base.poser('taches/chrono/lea/j4', { by: 'lea', texte: 'Pilotage (une fois par mois)', liste: 'jeudi', debut: T0 - 3 * H, cumul: 0, depuis: T0 - 3 * H, etat: 'marche', vu: T0 - 2 * H });
  await heure([A], T0 + 60 * MIN);
  await A.reload();
  await A.waitForSelector('#oubliDlg[open]');
  await pause(1500);
  s = await A.evaluate(() => ({ t: document.getElementById('oubliTexte').textContent, b: document.getElementById('oubliVu').textContent, bv: !document.getElementById('oubliVu').hidden }));
  verifie(/Tailler la haie du chemin|Tour des cultures/.test(s.t) && /lancé par vous/.test(s.t) && s.bv, 'à l\'ouverture : « Un chronomètre est resté en marche » pour mon chrono de plus de 12 heures ' + JSON.stringify(s));
  verifie(chrono(base, 'francois', 'j5').vu === T0 - 18 * H && chrono(base, 'francois', 'v3').vu === T0 - 13 * H, 'le « dernier geste » n\'est pas écrasé tant que la question attend');
  await capture(A, 'telephone-5-chrono-oublie.png');
  const vus = [];
  for (let i = 0; i < 4; i++) {
    if (!(await A.evaluate(() => document.getElementById('oubliDlg').open))) break;
    const t = await A.evaluate(() => document.getElementById('oubliTexte').textContent);
    vus.push(t.split('»')[0].replace('« ', '').trim());
    if (/Tailler/.test(t)) await A.click('#oubliVu');
    else if (/Tour des cultures/.test(t)) await A.click('#oubliLaisser');
    else await A.click('#oubliMaint');
    await pause(500);
  }
  verifie(vus.length === 3 && vus.includes('Saisie des apports du mois') && !vus.some((x) => /Pilotage/.test(x)), 'trois chronos proposés : les deux miens (plus de 12 h) et celui de Léa (plus de 24 h) ; pas celui de Léa de 3 h ' + JSON.stringify(vus));
  await attendreQue(() => lignes(base).some((l) => l.tache === 'j5') && lignes(base).some((l) => l.tache === 'j3'));
  const lj5 = lignes(base).find((l) => l.tache === 'j5'), lj3 = lignes(base).find((l) => l.tache === 'j3');
  verifie(lj5 && lj5.fin === T0 - 18 * H && lj5.duree === 2 * H && lj5.by === 'francois', '« Arrêter à <dernier geste> » : la tâche est terminée à l\'heure du dernier geste (2 h) ' + JSON.stringify(lj5));
  verifie(lj3 && lj3.fin === T0 + 60 * MIN && lj3.by === 'lea' && lj3.duree === 31 * H, '« Arrêter maintenant » (chrono de Léa de plus de 24 h) : sa ligne à elle, finie maintenant ' + JSON.stringify(lj3 && { by: lj3.by, duree: lj3.duree }));
  verifie((chrono(base, 'francois', 'v3') || {}).etat === 'marche' && !!base.lire('taches/t/v3'), '« Laisser en marche » : rien ne s\'arrête');
  verifie((chrono(base, 'lea', 'j4') || {}).etat === 'marche', 'le chrono de Léa de 3 h n\'est pas proposé ni touché');
  await heure([A], T0 + 75 * MIN);
  await attendreQue(() => (chrono(base, 'francois', 'v3') || {}).vu === T0 + 75 * MIN, 4000);
  verifie((chrono(base, 'francois', 'v3') || {}).vu === T0 + 75 * MIN, 'après « Laisser en marche », le dernier geste reprend (toutes les 10 minutes, appli ouverte)');
  base.poser('taches/chrono/francois/v3', null);
  base.poser('taches/chrono/lea/j4', null);

  // ================= 5. Historique : écran, période lue par clés, filtres, pages, export =================
  // 60 lignes inventées de Martin cette semaine, 3 de la semaine passée, 1 de l'an dernier.
  const extra = {};
  for (let i = 0; i < 60; i++) { const fin = T0 - 20 * H + i * 10 * MIN; extra[fin.toString(36).padStart(9, '0') + 'x' + String(i).padStart(4, '0')] = { liste: 'lundi', listeNom: 'Lundi', tache: 'z' + i, texte: 'Désherbage planche ' + i, by: 'martin', fin, chrono: true, debut: fin - 30 * MIN, duree: 25 * MIN, pause: 5 * MIN }; }
  for (let i = 0; i < 3; i++) { const fin = T0 - 6 * 24 * H + i * H; extra[fin.toString(36).padStart(9, '0') + 'y' + String(i).padStart(4, '0')] = { liste: 'lundi', listeNom: 'Lundi', tache: 'y' + i, texte: 'Semaine passée ' + i, by: 'martin', fin, chrono: false }; }
  const vieux = T0 - 400 * 24 * H; extra[vieux.toString(36).padStart(9, '0') + 'vieux'] = { liste: 'lundi', listeNom: 'Lundi', tache: 'q', texte: 'L\'an dernier', by: 'martin', fin: vieux, chrono: false };
  for (const [k, v] of Object.entries(extra)) base.poser('taches-historique/' + k, v);
  const lect0 = base.journal.length, req0 = base.requetes.length;
  await A.click('#avatar'); await A.click('#versReglages'); await A.waitForSelector('#reglDlg[open]');
  await A.click('#reglHist'); await A.waitForSelector('#histDlg[open]');
  await attendreQue(() => A.evaluate(() => /tâches/.test(document.getElementById('histResume').textContent) && !/Lecture/.test(document.getElementById('histLignes').textContent)));
  const nMoi = lignes(base).filter((l) => l.fin >= new Date('2026-11-23T00:00:00+01:00').getTime() && l.fin < new Date('2026-11-30T00:00:00+01:00').getTime()).length;
  s = await A.evaluate(() => ({ r: document.getElementById('histResume').textContent, n: document.querySelectorAll('#histLignes .hl').length, suite: document.getElementById('histSuite').hidden ? '' : document.getElementById('histSuite').textContent, note: document.getElementById('histNote').textContent }));
  verifie(s.r.startsWith('Semaine 48 · du 23/11 au 29/11') && s.r.includes(nMoi + ' tâches'), 'Historique (Réglages → « Ouvrir l\'historique… ») : cette semaine par défaut, semaine ISO 48, ' + nMoi + ' tâches ' + JSON.stringify(s.r));
  verifie(s.n === 50 && /Afficher la suite/.test(s.suite), 'pages de 50 lignes, « Afficher la suite » ' + JSON.stringify({ n: s.n, suite: s.suite }));
  verifie(/sans limite de durée/.test(s.note), 'l\'écran dit que l\'historique est gardé sans limite de durée');
  const lectHist = base.journal.slice(lect0).filter((x) => x.m === 'GET' && x.p.startsWith('taches-historique'));
  const reqs = base.requetes.slice(req0);
  verifie(lectHist.length === 1 && reqs.length === 1 && /startAt=/.test(reqs[0]) && /endAt=/.test(reqs[0]), 'la base n\'est lue que pour la période (une requête par clés startAt/endAt), jamais en entier ' + JSON.stringify(reqs));
  const premiere = await A.evaluate(() => document.querySelector('#histLignes .hl-t').textContent);
  verifie(premiere === 'Saisie des apports du mois' || premiere === 'Tailler la haie du chemin' || /Désherbage|Trier|Nettoyer|Mercuriale|Semer/.test(premiere), 'les plus récentes en premier (' + premiere + ')');
  await capture(A, 'telephone-6-historique.png');
  await A.click('#histSuite'); await pause(300);
  verifie(await A.evaluate(() => document.querySelectorAll('#histLignes .hl').length) === nMoi && await A.evaluate(() => document.getElementById('histSuite').hidden), '« Afficher la suite » : toutes les lignes de la période');
  // Filtres
  await A.selectOption('#histQui', 'francois'); await pause(300);
  const nF = lignes(base).filter((l) => l.by === 'francois' && l.fin >= T0 - 24 * H).length;
  s = await A.evaluate(() => document.getElementById('histResume').textContent);
  verifie(s.includes(nF + ' tâche'), 'filtre « personne » : ' + nF + ' lignes de François ' + JSON.stringify(s));
  await A.selectOption('#histChr', 'non'); await pause(300);
  const nFs = lignes(base).filter((l) => l.by === 'francois' && l.fin >= T0 - 24 * H && l.duree === undefined).length;
  s = await A.evaluate(() => ({ r: document.getElementById('histResume').textContent, d: Array.from(document.querySelectorAll('#histLignes .hl-d')).map((x) => x.textContent) }));
  verifie(s.r.includes(nFs + ' tâche') && s.d.every((x) => x === 'sans chrono'), 'filtre « sans chrono » : ' + nFs + ' lignes, toutes « sans chrono » ' + JSON.stringify(s.r));
  await A.selectOption('#histChr', ''); await A.selectOption('#histQui', ''); await A.selectOption('#histListe', 'mercredi'); await pause(300);
  s = await A.evaluate(() => document.getElementById('histResume').textContent);
  verifie(s.includes('2 tâches'), 'filtre « liste » (Mercredi) : 2 tâches ' + JSON.stringify(s));
  await A.selectOption('#histListe', '');
  await A.selectOption('#histPer', 'semaine-1');
  await attendreQue(() => A.evaluate(() => /Semaine 47/.test(document.getElementById('histResume').textContent) && /3 tâches/.test(document.getElementById('histResume').textContent)));
  verifie(await A.evaluate(() => /Semaine 47 · du 16\/11 au 22\/11/.test(document.getElementById('histResume').textContent) && /3 tâches/.test(document.getElementById('histResume').textContent)), 'période « La semaine passée » : semaine 47, 3 tâches (l\'an dernier n\'est pas lu)');
  verifie(base.requetes.length === req0 + 2, 'changer de période : une nouvelle requête par clés, et rien d\'autre');
  // Export
  await A.selectOption('#histPer', 'semaine');
  await attendreQue(() => A.evaluate(() => /Semaine 48/.test(document.getElementById('histResume').textContent) && !/Lecture/.test(document.getElementById('histLignes').textContent)));
  const ecr0 = base.journal.filter((x) => x.m !== 'GET').length;
  const [tele] = await Promise.all([A.waitForEvent('download'), A.click('#histExport')]);
  const fichier = path.join(os.tmpdir(), 'chrono-export-' + process.pid + '.csv');
  await tele.saveAs(fichier);
  const brut = fs.readFileSync(fichier); const csv = brut.toString('utf8');
  const rangs = csv.replace(/^﻿/, '').trim().split('\r\n');
  verifie(tele.suggestedFilename() === 'historique-taches-2026-11-23_2026-11-29.csv', 'nom du fichier : ' + tele.suggestedFilename());
  verifie(brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf, 'UTF-8 avec marque d\'ordre (accents corrects dans Excel)');
  verifie(rangs[0] === 'liste;tâche;personne;début;fin;pause_min;durée_min;chronomètre', 'colonnes : ' + rangs[0]);
  verifie(rangs.length === nMoi + 1, 'une ligne par tâche réalisée de la période (' + (rangs.length - 1) + ' sur ' + nMoi + ')');
  const r2 = rangs.find((x) => x.includes('Semer les mâches sous tunnel'));
  verifie(r2 === 'Mardi;Semer les mâches sous tunnel;François;2026-11-24 09:05;2026-11-24 09:20;5;10;oui', 'ligne chronométrée : dates AAAA-MM-JJ HH:MM, pause et durée en minutes ' + r2);
  const r5 = rangs.find((x) => x.includes('Trier les factures'));
  verifie(r5 === 'Mardi;Trier les factures du mois;François;;2026-11-24 09:00;;;non', 'ligne sans chrono : début et durée vides ' + r5);
  verifie(rangs.slice(1).every((x) => x.split(';').length === 8), 'toujours 8 colonnes séparées par « ; »');
  verifie(base.journal.filter((x) => x.m !== 'GET').length === ecr0, 'consulter et exporter : aucune écriture dans la base');
  fs.rmSync(fichier, { force: true });
  // Virgule décimale : une durée de 7,5 minutes
  base.poser('taches-historique/' + (T0 - H).toString(36).padStart(9, '0') + 'demi0', { liste: 'mardi', listeNom: 'Mardi', tache: 'k', texte: 'Peser; "vite"', by: 'martin', fin: T0 - H, chrono: true, debut: T0 - H - 8 * MIN, duree: 7.5 * MIN, pause: 0.5 * MIN });
  await A.selectOption('#histPer', 'mois');
  await attendreQue(() => A.evaluate(() => /novembre 2026/.test(document.getElementById('histResume').textContent) && !/Lecture/.test(document.getElementById('histLignes').textContent)));
  const [tele2] = await Promise.all([A.waitForEvent('download'), A.click('#histExport')]);
  await tele2.saveAs(fichier);
  const csv2 = fs.readFileSync(fichier, 'utf8'); fs.rmSync(fichier, { force: true });
  verifie(csv2.includes('Mardi;"Peser; ""vite""";Martin;2026-11-24 07:52;2026-11-24 08:00;0,5;7,5;oui'), 'virgule décimale française (7,5 min) et texte avec « ; » ou guillemets entouré de guillemets');
  verifie(tele2.suggestedFilename() === 'historique-taches-2026-11-01_2026-11-30.csv', 'export du mois : ' + tele2.suggestedFilename());

  // Correction (R10) : François (ferme) corrige toutes les lignes
  await A.selectOption('#histPer', 'semaine');
  await attendreQue(() => A.evaluate(() => /Semaine 48/.test(document.getElementById('histResume').textContent) && !/Lecture/.test(document.getElementById('histLignes').textContent)));
  const lm2 = lignes(base).find((l) => l.tache === 'm2');
  await A.click(`#histLignes .hl-corr[data-h="${lm2.k}"]`); await A.waitForSelector('#corrDlg[open]');
  s = await A.evaluate(() => ({ d: document.getElementById('corrDeb').value, f: document.getElementById('corrFin').value, p: document.getElementById('corrPause').value, du: document.getElementById('corrDuree').textContent }));
  verifie(s.d === '2026-11-24T09:05' && s.f === '2026-11-24T09:20' && s.p === '5' && s.du === 'Durée : 10 min', '« Corriger » : début, fin, pause, durée ' + JSON.stringify(s));
  await A.fill('#corrPause', '2'); await pause(200);
  verifie(await A.evaluate(() => document.getElementById('corrDuree').textContent) === 'Durée : 13 min', 'la durée se recalcule (pause 2 min : 13 min)');
  await A.fill('#corrPause', '30'); await pause(200);
  verifie(await A.evaluate(() => !document.getElementById('corrErr').hidden), 'une pause plus longue que le temps passé est refusée');
  await A.fill('#corrPause', '2');
  await capture(A, 'telephone-7-corriger.png');
  await A.click('#corrForm [type="submit"]');
  await attendreQue(() => (base.lire('taches-historique/' + lm2.k) || {}).corr);
  const lc = base.lire('taches-historique/' + lm2.k);
  verifie(lc.pause === 2 * MIN && lc.duree === 13 * MIN && lc.debut === T0 + 5 * MIN && lc.fin === T0 + 20 * MIN && lc.corr.by === 'francois' && lc.corr.at === T0 + 75 * MIN, 'Enregistrer : pause et durée corrigées, début et fin gardés à la seconde, corr = qui et quand ' + JSON.stringify(lc));
  await pause(300);
  verifie(await A.evaluate((k) => document.querySelector(`#histLignes .hl-corr[data-h="${k}"]`).textContent.includes('13 min') && document.querySelector(`#histLignes .hl-corr[data-h="${k}"]`).textContent.includes('corrigée'), lm2.k), 'l\'écran montre la correction tout de suite (13 min, « corrigée »)');
  // Supprimer une ligne
  const lz = Object.keys(extra)[0];
  await A.click('#histSuite');
  await A.click(`#histLignes .hl-corr[data-h="${lz}"]`); await A.waitForSelector('#corrDlg[open]');
  await A.click('#corrSuppr'); await A.waitForSelector('#confDlg[open]'); await A.click('#confOui');
  await attendreQue(() => !base.lire('taches-historique/' + lz));
  verifie(!base.lire('taches-historique/' + lz), 'François supprime une ligne de Martin (compte de la ferme : toutes les lignes)');
  await A.click('#histDlg [data-a="fermer"]');
  await A.click('#reglDlg [data-a="fermer"]');

  // Martin (équipe) : seulement ses lignes
  await M.reload(); await M.waitForSelector('.pan[data-l="mercredi"] li.t', { state: 'attached' }); await pause(600);
  await M.click('.pan[data-l="mardi"] .pan-tete [data-a="menu-liste"]'); await M.waitForSelector('#listeDlg[open]');
  await M.click('#listeDlg [data-a="historique"]'); await M.waitForSelector('#histDlg[open]');
  await attendreQue(() => M.evaluate(() => !/Lecture/.test(document.getElementById('histLignes').textContent) && /tâche/.test(document.getElementById('histResume').textContent)));
  s = await M.evaluate(() => ({ liste: document.getElementById('histListe').value, corr: Array.from(document.querySelectorAll('#histLignes .hl-corr')).map((b) => b.dataset.h), tout: document.querySelectorAll('#histLignes .hl').length }));
  const aMartin = lignes(base).filter((l) => l.liste === 'mardi' && l.by === 'martin' && l.fin >= T0 - 48 * H).map((l) => l.k);
  verifie(s.liste === 'mardi' && s.tout > aMartin.length && s.corr.length === aMartin.length && s.corr.every((k) => aMartin.includes(k)), '« ⋯ » d\'une liste → « Historique de cette liste » : filtre sur la liste ; Martin ne peut corriger que ses lignes, aucune de François ' + JSON.stringify(s));
  await M.selectOption('#histListe', 'lundi'); await pause(300);
  s = await M.evaluate(() => ({ corr: document.querySelectorAll('#histLignes .hl-corr').length, tout: document.querySelectorAll('#histLignes .hl').length }));
  verifie(s.corr > 0 && s.corr === s.tout, 'Martin peut corriger ses propres lignes ' + JSON.stringify(s));
  await M.click('#histDlg [data-a="fermer"]');
  // Martin a son propre chrono, sans toucher à ceux des autres
  await aller(M, 'mercredi');
  await M.click(btn('mercredi', 'w3', 'start'));
  await attendreQue(() => chrono(base, 'martin', 'w3'));
  verifie(!!chrono(base, 'martin', 'w3') && !base.lire('taches/chrono/francois/w3'), 'compte de l\'équipe : son chrono sous taches/chrono/martin');

  // ================= 6. Ordinateur : historique en tableau =================
  await C.reload(); await C.waitForSelector('.pan[data-l="mercredi"] li.t'); await pause(500);
  await C.click('.menu [data-a="reglages"]'); await C.waitForSelector('#reglDlg[open]');
  if (CAPTURES) { await C.evaluate(() => document.getElementById('reglChronoBloc').scrollIntoView({ block: 'center' })); await capture(C, 'ordinateur-0-reglages.png'); }
  await C.click('#reglHist'); await C.waitForSelector('#histDlg[open]');
  await attendreQue(() => C.evaluate(() => !!document.querySelector('#histLignes table.hist-tab tbody tr')));
  s = await C.evaluate(() => ({ th: Array.from(document.querySelectorAll('.hist-tab th')).map((x) => x.textContent).join('|'), l: document.getElementById('histDlg').getBoundingClientRect().width }));
  verifie(s.th === 'Tâche|Qui|Liste|Début|Fin|Durée' && s.l > 900, 'ordinateur : l\'historique en tableau (Tâche, Qui, Liste, Début, Fin, Durée) dans une large fenêtre ' + JSON.stringify(s));
  await capture(C, 'ordinateur-1-historique.png');
  await C.click('#histDlg [data-a="fermer"]'); await C.click('#reglDlg [data-a="fermer"]');
  verifie(await C.evaluate(() => !document.querySelector('.chr-btn, li.chr-on, .chr-etat') && document.getElementById('chrBande').hidden), 'ordinateur : toujours aucun bouton, même avec un chrono de Martin en cours');
  await capture(C, 'ordinateur-2-listes-sans-boutons.png');

  // ================= 7. Règle pas encore publiée : la tâche cochée n'est pas perdue =================
  base.reglesAvantHistorique = true;
  await aller(A, 'jeudi');
  await A.click(`${tache('jeudi', 'j1')} .coche`);
  await attendreQue(() => !base.lire('taches/t/j1'), 10000);
  await pause(800);
  s = await A.evaluate(() => ({ att: (JSON.parse(localStorage.getItem('taches.histAttente') || '[]')).length, pend: JSON.parse(localStorage.getItem('taches.pending') || '[]').length, band: document.getElementById('bandeau').textContent }));
  verifie(!base.lire('taches/t/j1') && !!base.lire('taches/faites/j1') && !lignes(base).some((l) => l.tache === 'j1'), 'règle de l\'historique refusée : la tâche est quand même cochée dans la base');
  verifie(s.att === 1 && s.pend === 0 && /reste sur cet appareil/.test(s.band), 'la ligne d\'historique attend sur l\'appareil, avec un message ' + JSON.stringify(s));
  base.reglesAvantHistorique = false;
  await A.reload(); await A.waitForSelector('.pan li.t');
  await attendreQue(() => lignes(base).some((l) => l.tache === 'j1'), 10000);
  verifie(lignes(base).some((l) => l.tache === 'j1') && await A.evaluate(() => JSON.parse(localStorage.getItem('taches.histAttente') || '[]').length === 0), 'règle publiée, appli rouverte : la ligne en attente part dans la base');

  // ================= 8. Mode éteint de nouveau : les boutons disparaissent, l'historique continue =================
  await A.click('#avatar'); await A.click('#versReglages'); await A.waitForSelector('#reglDlg[open]');
  await A.uncheck('#reglChrono'); await A.click('#reglForm [type="submit"]');
  await attendreQue(() => base.lire('taches/reglages/chronometre') === null);
  await attendreQue(() => A.evaluate(() => !document.querySelector('.chr-btn')));
  verifie(base.lire('taches/reglages/chronometre') === null && await A.evaluate(() => !document.querySelector('.chr-btn') && document.getElementById('chrBande').hidden), 'décocher « Mode chronomètre » : le réglage est retiré, plus aucun bouton');

  const erreurs = [A, C, M].flatMap((p) => p.erreurs);
  verifie(erreurs.length === 0, 'aucune erreur dans les pages ' + JSON.stringify(erreurs));
  await nav.close();
  site.close(); base.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTout est vert.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
