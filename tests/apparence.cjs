// Farm tasks, étape 53 : choisir l'apparence, classique ou pixel art (contrat docs/CONTRAT_APPARENCE_PIXEL_ART.md,
// quatre points confirmés par François le 22/11/2026). Tests T1, T2, T4 à T12 du contrat (T3 = les autres fichiers de
// tests lancés avec APPARENCE=pixel). Faux Firebase, données inventées (tests/donnees-apparence.cjs), heure figée.
// T2 compare l'apparence classique de cette version à celle de la référence REF (par défaut origin/main) : 0 point
// différent attendu. Lancement depuis la racine du dépôt : node tests/apparence.cjs
//   (CAPTURES=dossier pour garder les captures des deux apparences ; REF=… pour une autre référence que origin/main ;
//   SEUL=T2 pour ne lancer qu'une partie)
// Il faut pdftotext et pdffonts (paquet poppler) pour T8.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
const donnees = require('./donnees-apparence.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.md': 'text/plain' };
const PORT_SITE = 8994, PORT_BASE = 8995, PORT_REF = 8996, PORT_BASE_REF = 8997;
const CLE = 'cle-de-test';
const MDP = 'mdp-francois-1';
const CAPTURES = process.env.CAPTURES || '';
const REF = process.env.REF || 'origin/main';
// SEUL=T2 (ou T1,T5,TEL,T12,T8,T9,T11, séparés par des virgules) : ne lancer que ces parties, pour chercher une panne.
const SEUL = (process.env.SEUL || '').split(',').filter(Boolean);
const fait = (t) => !SEUL.length || SEUL.includes(t);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apparence-'));
// Lundi 23/11/2026, 9 h (heure de Paris) : la liste du jour est Lundi, les mêmes données à chaque essai.
const T0 = new Date('2026-11-23T09:00:00+01:00').getTime();
const PC = { viewport: { width: 1920, height: 1080 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' };
const TEL = { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' };
const PIXEL = 'pixel', CLASSIQUE = 'classique';

function serveurSite(racine, port, base) {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (f.endsWith('/')) f += 'index.html';
      if (f === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_DB_URL='http://localhost:${base}';window.RECOLTE_AUTH_URL='http://localhost:${base}/v1';window.RECOLTE_JETON_URL='http://localhost:${base}/v1';`); }
      if (f === '/cle-web.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(`window.RECOLTE_CLE_WEB='${CLE}';`); }
      const chemin = path.join(racine, f);
      if (!chemin.startsWith(racine) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(chemin)] || 'application/octet-stream' });
      fs.createReadStream(chemin).pipe(r);
    });
    s.listen(port, () => ok(s));
  });
}

let echecs = 0;
function verifie(cond, msg) { console.log((cond ? 'OK    ' : 'ÉCHEC ') + msg); if (!cond) echecs++; }
const attendreQue = async (fn, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { if (await fn()) return true; } catch (e) { /* page en cours */ } await new Promise((x) => setTimeout(x, 120)); } return false; };
const pause = (ms) => new Promise((x) => setTimeout(x, ms));
const capture = async (page, nom, opts = {}) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, { recursive: true }); await pause(300); await page.screenshot({ path: path.join(CAPTURES, nom), ...opts }); };
const ecritures = (base) => base.journal.filter((x) => x.m !== 'GET').length;

// Un appareil : contexte du navigateur, heure figée, apparence déjà choisie (ou aucune : appareil neuf).
async function appareil(nav, opts, apparence, site) {
  const ctx = await nav.newContext(opts);
  if (apparence) await ctx.addInitScript((a) => { if (!sessionStorage.getItem('apparence-posee')) { localStorage.setItem('taches.apparence', JSON.stringify(a)); sessionStorage.setItem('apparence-posee', '1'); } }, apparence);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(T0);
  page.erreurs = []; page.on('pageerror', (e) => page.erreurs.push(String(e)));
  page.polices = []; page.on('request', (r) => { if (/\.woff2$/.test(r.url())) page.polices.push(new URL(r.url()).host + ' ' + r.url().replace(/^.*\//, '')); });
  page.site = site;
  return { ctx, page };
}
async function connecter(page) {
  await page.goto(page.site + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', 'francois');
  await page.fill('#authMdp', MDP);
  await page.click('#authOk');
  await page.waitForSelector('.pan[data-l="lundi"] li.t');
  await attendreQue(() => page.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await page.evaluate(() => document.fonts.ready);
  await pause(300);
}
const estPc = (page) => page.evaluate(() => matchMedia('(min-width: 1000px)').matches);
async function ouvrirReglages(page) {
  if (await estPc(page)) await page.click('.menu [data-a="reglages"]');
  else { await page.click('#avatar'); await page.waitForSelector('#compteDlg[open]'); await page.click('#versReglages'); }
  await page.waitForSelector('#reglDlg[open]');
}
const fermerTout = (page) => page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
// Rapport de contraste WCAG entre deux couleurs « rgb(…) ».
function contraste(a, b) {
  const lum = (c) => { const v = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return Math.round((l1 + 0.05) / (l2 + 0.05) * 100) / 100;
}
// Compare deux captures PNG (même taille) dans une page : nombre de points différents.
async function pointsDifferents(page, a, b) {
  if (a.equals(b)) return 0;
  return page.evaluate(async ([a, b]) => {
    const lire = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; };
    const A = await lire(a), B = await lire(b);
    if (A.w !== B.w || A.h !== B.h) return -1;
    let n = 0; for (let i = 0; i < A.d.length; i += 4) if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) n++;
    return n;
  }, [a.toString('base64'), b.toString('base64')]);
}

(async () => {
  const D = donnees(T0);
  const site = await serveurSite(RACINE, PORT_SITE, PORT_BASE);
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  base.profil(base.creerCompte('francois@ferme.invalid', MDP), 'ferme');
  base.poser('taches', JSON.parse(JSON.stringify(D)));
  const SITE = `http://localhost:${PORT_SITE}`;
  const nav = await chromium.launch();

  // ================= T1 et T4 : le choix, gardé sur l'appareil seulement, jamais écrit dans la base =================
  if (fait('T1')) {
    const { ctx, page: P } = await appareil(nav, PC, null, SITE);
    await connecter(P);
    verifie(await P.evaluate(() => !document.documentElement.hasAttribute('data-apparence') && localStorage.getItem('taches.apparence') === null && !document.documentElement.hasAttribute('style')), 'T1. appareil neuf : apparence classique, aucun attribut sur <html>');
    await ouvrirReglages(P);
    const rub = await P.evaluate(() => { const g = document.getElementById('appChoix'), b = Array.from(g.querySelectorAll('.app-b')), h = g.previousElementSibling.previousElementSibling, suiv = g.nextElementSibling;
      return { titre: h.textContent, phrase: g.previousElementSibling.textContent, boutons: b.map((x) => x.textContent.trim() + ':' + x.getAttribute('aria-pressed')), avantImpression: suiv && suiv.textContent === 'Papier de secours', images: b.every((x) => x.querySelector('img')), types: b.every((x) => x.type === 'button') }; });
    verifie(rub.titre === 'Apparence de cet appareil' && rub.phrase === 'Ce choix ne vaut que pour cet appareil. Les autres gardent le leur.' && rub.boutons.join() === 'Classique:true,Pixel art:false' && rub.avantImpression && rub.images && rub.types,
      'R1. Réglages : rubrique « Apparence de cet appareil » juste avant « Papier de secours », Classique (coché) et Pixel art, chacun avec sa vignette ' + JSON.stringify(rub));
    const avant = ecritures(base);
    await P.click('#appChoix [data-apparence-choix="pixel"]');
    await pause(1500);
    const apres = await P.evaluate(() => ({ attr: document.documentElement.getAttribute('data-apparence'), cle: localStorage.getItem('taches.apparence'), theme: document.querySelector('meta[name="theme-color"]').content, ouvert: document.getElementById('reglDlg').open, presse: Array.from(document.querySelectorAll('#appChoix .app-b')).map((b) => b.getAttribute('aria-pressed')).join() }));
    verifie(apres.attr === 'pixel' && apres.cle === '"pixel"' && apres.ouvert && apres.presse === 'false,true', 'T1. « Pixel art » : tout de suite, attribut posé, clé taches.apparence = "pixel", Réglages toujours ouverts, bouton marqué ' + JSON.stringify(apres));
    verifie(apres.theme === '#3a2420', 'R17. barre du navigateur du téléphone (theme-color) brun #3a2420 en pixel art');
    verifie(ecritures(base) === avant, `T1. aucune écriture dans la base (${ecritures(base) - avant} appel PUT, PATCH, POST ou DELETE de plus)`);
    await P.click('#reglDlg [data-a="fermer"]');
    verifie(await P.evaluate(() => document.documentElement.getAttribute('data-apparence') === 'pixel'), 'R2. « Annuler » des Réglages ne revient pas sur l\'apparence');
    // T4 : au rechargement, l'attribut est là avant le premier affichage (le corps de la page n'existe pas encore).
    await P.addInitScript(() => { window.__vu = []; const voir = (q) => window.__vu.push(q + ':' + document.documentElement.getAttribute('data-apparence'));
      new MutationObserver((m, o) => { if (document.body) { voir('corps'); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
      requestAnimationFrame(() => voir('premiere-image')); });
    await P.reload(); await P.waitForSelector('.pan[data-l="lundi"] li.t');
    const vu = await P.evaluate(() => window.__vu);
    verifie(vu.length >= 2 && vu.every((x) => /:pixel$/.test(x)), 'T4. au rechargement, pixel art dès le premier affichage, sans éclair du classique (' + vu.join(', ') + ')');
    verifie(ecritures(base) === avant, 'T1. rechargement en pixel art : toujours aucune écriture');
    await ouvrirReglages(P);
    verifie(await P.evaluate(() => Array.from(document.querySelectorAll('#appChoix .app-b')).map((b) => b.getAttribute('aria-pressed')).join() === 'false,true'), 'T1. après rechargement : « Pixel art » toujours coché');
    await P.click('#appChoix [data-apparence-choix="classique"]');
    const cl = await P.evaluate(() => ({ attr: document.documentElement.hasAttribute('data-apparence'), style: document.documentElement.hasAttribute('style'), cle: localStorage.getItem('taches.apparence'), theme: document.querySelector('meta[name="theme-color"]').content }));
    verifie(!cl.attr && !cl.style && cl.cle === '"classique"' && cl.theme === '#373737', 'T1. retour à « Classique » : attribut retiré, rien sur <html>, barre du navigateur #373737 ' + JSON.stringify(cl));
    await P.evaluate(() => localStorage.setItem('taches.apparence', '"violet"'));
    await P.reload(); await P.waitForSelector('.pan[data-l="lundi"] li.t');
    verifie(await P.evaluate(() => !document.documentElement.hasAttribute('data-apparence')), 'R4. valeur inconnue dans la clé : classique');
    await P.evaluate(() => localStorage.setItem('taches.apparence', 'pixel-pas-json'));
    await P.reload(); await P.waitForSelector('.pan[data-l="lundi"] li.t');
    verifie(await P.evaluate(() => !document.documentElement.hasAttribute('data-apparence')) && P.erreurs.length === 0, 'R4. clé abîmée : classique, sans erreur dans la page' + (P.erreurs.length ? ' : ' + P.erreurs.join(' / ') : ''));
    // Un autre onglet du même appareil suit le choix ; l'écran de connexion suit aussi le choix.
    const P2 = await ctx.newPage(); await P2.goto(SITE + '/'); await P2.waitForSelector('.pan[data-l="lundi"] li.t');
    await P.evaluate(() => { localStorage.setItem('taches.apparence', '"pixel"'); });
    await P2.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'taches.apparence' })));
    verifie(await P2.evaluate(() => document.documentElement.getAttribute('data-apparence') === 'pixel'), 'un autre onglet du même appareil suit le choix');
    await P2.close();
    await ctx.close();
    // Un autre appareil (autre mémoire) garde le sien : classique.
    const { ctx: c2, page: Q } = await appareil(nav, TEL, null, SITE);
    await connecter(Q);
    verifie(await Q.evaluate(() => !document.documentElement.hasAttribute('data-apparence')), 'R3. un autre appareil (même compte) reste en classique');
    await c2.close();
  }

  // ================= T5, T6, T7, T10 : l'habillage pixel art (ordinateur 1920 × 1080) =================
  const navAsc = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  if (fait('T5')) {
    const { ctx, page: P } = await appareil(navAsc, PC, PIXEL, SITE);
    const autres = []; P.on('request', (r) => { const u = new URL(r.url()); if (!['localhost:' + PORT_SITE, 'localhost:' + PORT_BASE].includes(u.host) && u.protocol !== 'data:') autres.push(r.url()); });
    await connecter(P);
    await capture(P, 'pixel-ordinateur-1-sept-jours.png');
    const s = await P.evaluate(() => {
      const cs = (q, p) => getComputedStyle(document.querySelector(q), p || null);
      const pan = document.querySelector('.pan[data-l="lundi"]');
      return {
        barre: cs('.barre').backgroundColor, filet: cs('.barre').borderBottomColor + '/' + cs('.barre').borderBottomWidth,
        tete: cs('.pan[data-l="lundi"] .pan-tete').backgroundImage, titre: cs('.pan-titre').color + '/' + cs('.pan-titre').textShadow + '/' + cs('.pan-titre').fontFamily,
        cadre: getComputedStyle(pan, '::before').borderImageSource + '/' + getComputedStyle(pan, '::before').borderImageSlice, ajout: cs('.ajout-ligne').color,
        tache: cs('.pan[data-l="lundi"] li.t .tx').fontFamily + '/' + cs('.pan[data-l="lundi"] li.t .tx').fontSize,
        filtres: Array.from(document.querySelectorAll('*')).filter((e) => { const c = getComputedStyle(e); return c.filter !== 'none' || c.backdropFilter !== 'none'; }).length,
        fond: getComputedStyle(document.body, '::before').backgroundImage + '|' + getComputedStyle(document.body, '::before').backgroundSize + '|' + getComputedStyle(document.body, '::before').position + '|' + getComputedStyle(document.body, '::before').imageRendering,
        menu: cs('.menu').backgroundImage, logo: getComputedStyle(document.querySelector('.menu-nom'), '::before').backgroundImage + '/' + getComputedStyle(document.querySelector('.menu-nom'), '::before').width,
        arrondis: Array.from(document.querySelectorAll('#piste *, .barre *, .menu *')).filter((e) => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0).map((e) => e.className).slice(0, 5),
      };
    });
    verifie(s.barre === 'rgb(58, 36, 32)' && s.filet === 'rgb(240, 138, 60)/4px', 'T5. barre du haut brun #3a2420, filet orange #f08a3c de 4 points');
    verifie(/rgb\(224, 112, 159\)/.test(s.tete) && /rgb\(248, 180, 208\)/.test(s.tete) && /rgb\(196, 80, 138\)/.test(s.tete) && /rgb\(58, 32, 22\)/.test(s.tete) && /rgb\(247, 220, 196\)/.test(s.tete), 'T5. haut des listes rose #e0709f, reflet #f8b4d0, ombre #c4508a, trait #3a2016, filet #f7dcc4');
    verifie(/^rgb\(255, 255, 255\)\//.test(s.titre) && /rgb\(138, 42, 90\)/.test(s.titre) && /Press Start 2P/.test(s.titre), 'T5. titre des listes blanc, contour #8a2a5a, Press Start 2P');
    verifie(/cadre-carte\.png/.test(s.cadre) && /^url.*\/15 15 21 fill$/.test(s.cadre), 'T5. cadre des cartes posé par border-image (cadre-carte.png, 9 morceaux) : ' + s.cadre.replace(/url\("?[^)]*\/(cadre-carte\.png)"?\)/, '$1'));
    verifie(s.ajout === 'rgb(168, 64, 111)', 'T5. « Ajouter une tâche » rose #a8406f');
    verifie(/VT323/.test(s.tache) && /\/17px$/.test(s.tache), 'T5. tâches en VT323 de 17 points sur l\'ordinateur (' + s.tache + ')');
    verifie(/fond-ordinateur\.png/.test(s.fond) && /\|1920px 1080px\|fixed\|pixelated$/.test(s.fond), 'A1. fond de l\'ordinateur 480 × 270 agrandi 4 fois (1920 × 1080), calque fixe, sans lissage');
    verifie(/linear-gradient/.test(s.menu) && /70%/.test(s.menu) && /80%/.test(s.menu) && /logo-pixel\.png/.test(s.logo) && /\/64px$/.test(s.logo), 'A3. menu de gauche crème jusqu\'à 70 %, fondu jusqu\'à 80 %, logo pixel de 64 points');
    verifie(s.filtres === 0, 'T11. aucun filtre graphique (filter, backdrop-filter) dans la page');
    verifie(s.arrondis.length === 0, 'A9. aucun arrondi lisse dans les listes, la barre et le menu' + (s.arrondis.length ? ' (' + s.arrondis.join(', ') + ')' : ''));
    // T6 : polices chargées depuis le site ; aucun signe dessiné par une police du système.
    const polices = await P.evaluate(async () => { await document.fonts.load('17px VT323'); await document.fonts.load('13px "Press Start 2P"'); await document.fonts.load('17px "Signes pixel"');
      return { vt: document.fonts.check('17px VT323'), ps: document.fonts.check('13px "Press Start 2P"'), sp: document.fonts.check('17px "Signes pixel"'), urls: [] }; });
    polices.urls = [...new Set(P.polices)];
    verifie(polices.vt && polices.ps && polices.sp && ['vt323.woff2', 'press-start-2p.woff2', 'signes-pixel.woff2'].every((f) => polices.urls.includes('localhost:' + PORT_SITE + ' ' + f)) && polices.urls.every((u) => u.startsWith('localhost:' + PORT_SITE + ' ')), 'T6. VT323, Press Start 2P et Signes pixel chargées depuis le site (' + polices.urls.join(', ') + ')');
    const cdp = await ctx.newCDPSession(P);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const policesDe = async (sel) => { const { root } = await cdp.send('DOM.getDocument', { depth: -1 }); const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
      const r = []; for (const id of nodeIds) { const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id }); r.push(...fonts.map((f) => f.familyName)); } return [...new Set(r)]; };
    await ouvrirReglages(P);
    await P.click('#reglEncModif'); await P.waitForSelector('#encDlg[open]');
    const signes = { fleches: await policesDe('#encDlg .enc-fl button'), horloge: await policesDe('#reglEnc .etiq'), points: await policesDe('#reglDlg .regl-aide') };
    const ok = (l) => l.length > 0 && l.every((f) => /^(VT323|Press Start 2P|Signes pixel)$/.test(f));
    verifie(ok(signes.fleches) && signes.fleches.includes('Signes pixel'), 'T6. ▲ ▼ des encarts dessinés en pixels (polices utilisées : ' + signes.fleches.join(', ') + ')');
    verifie(ok(signes.horloge) && signes.horloge.includes('Signes pixel'), 'T6. 🕘 de l\'encart de l\'horloge dessiné en pixels (' + signes.horloge.join(', ') + ')');
    verifie(ok(signes.points) && signes.points.includes('Signes pixel'), 'T6. « ⋯ » des textes d\'aide dessiné en pixels (' + signes.points.join(', ') + ')');
    await capture(P, 'pixel-ordinateur-encarts.png');
    await fermerTout(P);
    // T7 : contrastes, mesurés sur les couleurs réelles de la page.
    const paires = await P.evaluate(() => {
      const cs = (q) => getComputedStyle(document.querySelector(q)), creme = 'rgb(255, 244, 228)';
      const p = (nom, q, fond, gros) => { const c = cs(q); return { nom, txt: c.color, fond: fond || c.backgroundColor, gros: !!gros, contour: /rgb\(138, 42, 90\)/.test(c.textShadow) }; };
      return [
        p('tâche', '.pan[data-l="lundi"] li.t:not(.sep) .tx:not([style])', creme), p('heure', '.heure', creme), p('texte secondaire (Aucune tâche)', '.vide', creme),
        p('Ajouter une tâche', '.ajout-ligne', creme), p('Faites récemment', '.faites-lien', creme), p('barre du haut', '.barre-in', 'rgb(58, 36, 32)'),
        p('menu de gauche', '.menu label', 'rgb(255, 246, 232)'), p('entrée du menu', '.nav:not(.on)', 'rgb(255, 246, 232)'),
        p('Rendez-vous de l\'agenda', '.outils .btn[data-a="agenda"]', null, true), p('Répartir les astreintes', '.outils .btn[data-a="repartir"]', null, true), p('Nouvelle liste', '.outils .btn[data-a="nouvelle-liste"]', null, true),
        p('bouton principal', '#reglDlg .btn.principal'), p('bouton qui supprime', '#tacheDlg .btn.danger'), p('bouton secondaire', '#reglDlg .btn.outil'),
        p('titre d\'une liste', '.pan-titre', 'rgb(224, 112, 159)', true), p('entrée choisie du menu', '.nav.on'),
      ];
    });
    const lignes = paires.map((x) => ({ ...x, r: contraste(x.txt, x.fond) }));
    const rates = lignes.filter((x) => x.r < (x.gros ? 3 : 4.5) && !x.contour);
    console.log('      contrastes : ' + lignes.map((x) => `${x.nom} ${x.r}${x.contour ? ' (+ contour #8a2a5a)' : ''}`).join(' ; '));
    verifie(rates.length === 0, 'T7. contrastes : texte ordinaire au moins 4,5, gros titres au moins 3, blanc sur rose seulement avec son contour' + (rates.length ? ' (trop faibles : ' + rates.map((x) => x.nom + ' ' + x.r).join(', ') + ')' : ''));
    // T10 : sept listes entières sur 1920, aucun ascenseur de côté, ascenseur vertical de 8 points.
    const t10 = await P.evaluate(() => { const pi = document.getElementById('piste'), r = pi.getBoundingClientRect(); const pans = Array.from(pi.querySelectorAll('.pan:not(.cachee)'));
      return { entieres: pans.filter((p) => { const b = p.getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5; }).map((p) => p.dataset.l),
        cote: pans.filter((p) => { const c = p.querySelector('.pan-corps'); return c.scrollWidth > c.clientWidth; }).map((p) => p.dataset.l), larg: pans[0].getBoundingClientRect().width }; });
    verifie(t10.entieres.slice(0, 7).join() === 'lundi,mardi,mercredi,jeudi,vendredi,samedi,dimanche' && t10.larg >= 230 && t10.larg <= 300 && t10.cote.length === 0, `T10. 1920 points : les sept jours entiers (colonnes de ${Math.round(t10.larg)} points), aucun ascenseur de côté dans une liste` + (t10.cote.length ? ' (sauf ' + t10.cote.join(', ') + ')' : ''));
    const asc = await P.evaluate(() => { const c = document.querySelector('.pan[data-l="lundi"] .pan-corps'); c.style.maxHeight = '300px'; const l = c.offsetWidth - c.clientWidth; const st = getComputedStyle(c, '::-webkit-scrollbar-thumb'); c.style.maxHeight = ''; return { l, coul: st.backgroundColor }; });
    verifie(asc.l === 8, `T10. ascenseur vertical d'une liste trop longue : ${asc.l} points (8 attendus)`);
    // Les autres listes (on tire la piste) : capture de la maquette « autres listes ».
    await P.evaluate(() => { const pi = document.getElementById('piste'), p = document.querySelector('.pan[data-l="astreintes"]'); pi.scrollLeft = p.offsetLeft - pi.offsetLeft - 14; });
    await capture(P, 'pixel-ordinateur-2-autres-listes.png');
    verifie(autres.length === 0, 'T9. pixel art : aucune requête vers un autre site' + (autres.length ? ' (' + autres.join(', ') + ')' : ''));
    verifie(P.erreurs.length === 0, 'ordinateur en pixel art : aucune erreur dans la page' + (P.erreurs.length ? ' : ' + P.erreurs.join(' / ') : ''));
    await ctx.close();
  }

  // ================= Téléphone en pixel art : T5, T7 (zones à toucher), A1 =================
  if (fait('TEL')) {
    const { ctx, page: T } = await appareil(navAsc, TEL, PIXEL, SITE);
    await connecter(T);
    await T.click('#bande .pil[data-l="lundi"]'); await pause(500);
    await capture(T, 'pixel-telephone-3-lundi-haut.png');
    const s = await T.evaluate(() => { const cs = (q, p) => getComputedStyle(document.querySelector(q), p || null);
      return { tache: cs('.pan[data-l="lundi"] li.t .tx').fontSize, titre: cs('.pan-titre').fontSize, fond: cs('body', '::before').backgroundImage + '|' + cs('body', '::before').backgroundSize,
        logo: getComputedStyle(document.querySelector('.barre-nom'), '::before').width, bande: cs('.bande').backgroundColor + '/' + cs('.bande').borderTopColor,
        plusE: cs('.pan[data-l="lundi"] .pt.plus-e').backgroundColor, vu: (() => { const p = document.querySelector('.pan[data-l="lundi"]').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth; })() }; });
    verifie(s.tache === '23px' && s.titre === '18px', `T5. téléphone : tâches en VT323 de 23 points, titre de 18 points (${s.tache}, ${s.titre})`);
    verifie(/fond-telephone\.png/.test(s.fond) && /\|390px 844px$/.test(s.fond), 'A1. fond du téléphone 195 × 422 agrandi 2 fois (390 × 844) ' + s.fond.replace(/^.*\|/, ''));
    verifie(s.logo === '32px' && s.bande === 'rgb(58, 36, 32)/rgb(240, 138, 60)' && s.plusE === 'rgb(224, 112, 159)', 'A2, A6, A8. logo de 32 points dans la barre, bande du bas brune à filet orange, « + » des encarts en boutons roses');
    // Zones à toucher d'au moins 44 × 44 points (taille + zone de clic agrandie par ::after).
    const zones = await T.evaluate(() => {
      const z = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); const ext = a.content !== 'none' && a.position === 'absolute' ? -parseFloat(a.left || 0) : 0, exy = a.content !== 'none' && a.position === 'absolute' ? -parseFloat(a.top || 0) : 0;
        return { q, l: Math.round(b.width + 2 * Math.max(0, ext)), h: Math.round(b.height + 2 * Math.max(0, exy)) }; };
      return ['.pan[data-l="lundi"] li.t .coche', '.pan[data-l="lundi"] li.t .pt', '.pan[data-l="lundi"] .menu-l', '.pan[data-l="lundi"] .plus', '.pan[data-l="lundi"] .pt.plus-e', '#bande .pil', '.pan[data-l="lundi"] .faites-lien:not([hidden])'].map(z).filter(Boolean);
    });
    const petites = zones.filter((x) => x.l < 44 || x.h < 44);
    verifie(petites.length === 0, 'T7. téléphone : zones à toucher d\'au moins 44 × 44 points (' + zones.map((x) => `${x.q.replace(/^.*\] /, '')} ${x.l}×${x.h}`).join(', ') + ')');
    await T.evaluate(() => { const c = document.querySelector('.pan[data-l="lundi"] .pan-corps'); c.scrollTop = c.scrollHeight; });
    await capture(T, 'pixel-telephone-4-lundi-bas.png');
    verifie(T.erreurs.length === 0, 'téléphone en pixel art : aucune erreur dans la page' + (T.erreurs.length ? ' : ' + T.erreurs.join(' / ') : ''));
    await ctx.close();
  }
  await navAsc.close();

  // ================= T12 : changer d'apparence pendant une saisie =================
  if (fait('T12')) {
    const { ctx, page: P } = await appareil(nav, PC, null, SITE);
    await connecter(P);
    await P.evaluate(() => { const pi = document.getElementById('piste'); pi.scrollLeft = 120; const c = document.querySelector('.pan[data-l="lundi"] .pan-corps'); c.style.maxHeight = '400px'; c.scrollTop = 60; });
    await P.click('.pan[data-l="mardi"] .ajout-ligne'); await P.waitForSelector('.pan[data-l="mardi"] textarea.ed');
    await P.keyboard.type('Tâche en cours de saisie');
    const avant = await P.evaluate(() => { const c = document.querySelector('.pan[data-l="lundi"] .pan-corps'), h = c.getBoundingClientRect().top, l = Array.from(c.querySelectorAll('li.t')).find((e) => e.getBoundingClientRect().bottom > h + 1); return { x: document.getElementById('piste').scrollLeft, y: c.scrollTop, haut: l && l.dataset.id }; });
    await P.evaluate(() => ouvrirReglages());
    await P.click('#appChoix [data-apparence-choix="pixel"]'); await pause(300);
    await P.click('#reglDlg [data-a="fermer"]'); await pause(300);
    const apres = await P.evaluate(() => { const t = document.querySelector('.pan[data-l="mardi"] textarea.ed'); const c = document.querySelector('.pan[data-l="lundi"] .pan-corps'), h = c.getBoundingClientRect().top, l = Array.from(c.querySelectorAll('li.t')).find((e) => e.getBoundingClientRect().bottom > h + 1); return { attr: document.documentElement.getAttribute('data-apparence'), texte: t ? t.value : null, x: document.getElementById('piste').scrollLeft, y: c.scrollTop, haut: l && l.dataset.id }; });
    const enregistree = !!Object.values(base.lire('taches/t') || {}).find((t) => t.texte === 'Tâche en cours de saisie');
    verifie(apres.attr === 'pixel' && (apres.texte === 'Tâche en cours de saisie' || enregistree), `T12. changer d'apparence pendant une saisie : le texte saisi n'est pas perdu (${apres.texte !== null ? 'toujours dans la ligne' : 'enregistré'})`);
    // La hauteur des lignes change d'une apparence à l'autre : le navigateur garde la même tâche en haut de la liste
    // (le nombre de points défilés peut donc changer un peu, c'est voulu).
    verifie(apres.x === avant.x && apres.haut && apres.haut === avant.haut, `T12. la position dans les listes ne bouge pas (piste ${avant.x} → ${apres.x} ; tâche en haut de Lundi ${avant.haut} → ${apres.haut}, défilée ${avant.y} → ${apres.y} points)`);
    await ctx.close();
  }

  // ================= T8 : l'impression reste sobre (même texte, mêmes polices) =================
  if (fait('T8')) {
    const lire = async (apparence) => {
      const { ctx, page: P } = await appareil(nav, PC, apparence, SITE);
      await connecter(P);
      await P.evaluate(() => { window.print = () => {}; });
      await ouvrirReglages(P); await P.click('#reglImp'); await P.waitForSelector('#impDlg[open]');
      await P.click('#impOk'); await pause(500);
      await P.emulateMedia({ media: 'print' });
      const f = path.join(TMP, `impression-${apparence}.pdf`);
      await P.pdf({ path: f, preferCSSPageSize: true, printBackground: true });
      await ctx.close();
      return { texte: execFileSync('pdftotext', [f, '-']).toString(), polices: execFileSync('pdffonts', [f]).toString().split('\n').slice(2).filter(Boolean).map((l) => l.split(/\s+/)[0].replace(/^[A-Z]{6}\+/, '')).sort(), f };
    };
    const c = await lire(CLASSIQUE), p = await lire(PIXEL);
    verifie(c.texte.length > 500 && c.texte === p.texte, `T8. impression : même texte en classique et en pixel art (${c.texte.length} caractères)`);
    verifie(c.polices.join() === p.polices.join() && !p.polices.some((x) => /VT323|PressStart|Press|Signes/i.test(x)), 'T8. impression : mêmes polices, ni Press Start 2P ni VT323 (' + [...new Set(p.polices)].join(', ') + ')');
    if (CAPTURES) fs.copyFileSync(p.f, path.join(CAPTURES, 'impression-depuis-pixel-art.pdf'));
  }

  // ================= T9 : hors ligne =================
  if (fait('T9')) {
    const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
    const shell = JSON.parse(sw.match(/var SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    const voulus = ['./apparence/fond-ordinateur.png', './apparence/fond-telephone.png', './apparence/cadre-carte.png', './apparence/logo-pixel.png', './apparence/coche-pixel.svg', './apparence/vignette-classique.png', './apparence/vignette-pixel.png', './polices/press-start-2p.woff2', './polices/vt323.woff2', './polices/signes-pixel.woff2'];
    const manque = voulus.filter((f) => !shell.includes(f) || !fs.existsSync(path.join(RACINE, f)));
    verifie(manque.length === 0, 'T9. chaque nouveau fichier existe et est gardé hors ligne (SHELL de sw.js)' + (manque.length ? ' (manque : ' + manque.join(', ') + ')' : ''));
    // Tout fichier appelé par le bloc pixel art est dans la liste.
    const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
    const bloc = html.slice(html.indexOf('PIXEL-ART-DEBUT'), html.indexOf('PIXEL-ART-FIN'));
    const appels = [...new Set([...bloc.matchAll(/url\(([^)"']+)\)/g)].map((m) => './' + m[1]))];
    verifie(appels.length >= 8 && appels.every((f) => shell.includes(f)), 'T9. tous les fichiers appelés par le bloc pixel art sont gardés hors ligne (' + appels.length + ')');
    let cacheRef = '';
    try { cacheRef = (execSync(`git -C "${RACINE}" show ${REF}:sw.js`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(/var CACHE = '([^']+)'/) || [])[1] || ''; } catch (e) { /* pas de référence */ }
    const cache = (sw.match(/var CACHE = '([^']+)'/) || [])[1];
    verifie(!cacheRef || cache !== cacheRef || REF === 'HEAD', `T9. CACHE changé (${cache} ; ${REF} : ${cacheRef || 'introuvable'})`);
    const { ctx, page: P } = await appareil(nav, TEL, null, SITE);
    await connecter(P);
    await P.evaluate(() => navigator.serviceWorker.ready);
    await P.reload(); await P.waitForSelector('.pan[data-l="lundi"] li.t');
    await attendreQue(() => P.evaluate(() => !!navigator.serviceWorker.controller));
    await pause(1500);
    await ctx.setOffline(true);
    await ouvrirReglages(P);
    await P.click('#appChoix [data-apparence-choix="pixel"]'); await pause(300);
    await fermerTout(P);
    const hors = await P.evaluate(async () => {
      const f = async (u) => { try { const r = await fetch(u); return r.ok && (await r.blob()).size > 100; } catch (e) { return false; } };
      await Promise.all(['23px VT323', '18px "Press Start 2P"', '20px "Signes pixel"'].map((x) => document.fonts.load(x).catch(() => null)));
      return { fond: await f('apparence/fond-telephone.png'), cadre: await f('apparence/cadre-carte.png'), polices: document.fonts.check('23px VT323') && document.fonts.check('18px "Press Start 2P"'), attr: document.documentElement.getAttribute('data-apparence') };
    });
    verifie(hors.attr === 'pixel' && hors.fond && hors.cadre && hors.polices, 'T9. sans réseau, passer en pixel art affiche le fond, le cadre et les polices (gardés par le service) ' + JSON.stringify(hors));
    await capture(P, 'pixel-telephone-hors-ligne.png');
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ================= T11 : pas plus de 20 % plus lent (processeur ralenti 4 fois, 150 tâches sur les sept jours) =================
  if (fait('T11')) {
    const D2 = JSON.parse(JSON.stringify(D));
    for (let i = 0; i < 110; i++) D2.t['perf' + i] = { liste: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i % 7], parent: '', encart: ['', 'p1', 'p2'][i % 3], ordre: 500 + i, texte: 'Tâche de mesure numéro ' + i + (i % 4 ? '' : ' avec un texte un peu plus long qui passe à la ligne'), by: 'francois', at: T0 };
    base.poser('taches', D2);
    const mesure = async (apparence) => {
      const { ctx, page: P } = await appareil(nav, PC, apparence, SITE);
      await connecter(P);
      const cdp = await ctx.newCDPSession(P); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const t = await P.evaluate(async () => { const r = [];
        for (let i = 0; i < 9; i++) { const d = performance.now(); rendre(true); document.body.getBoundingClientRect(); await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0))); r.push(performance.now() - d); }
        r.sort((a, b) => a - b); return r[4]; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await ctx.close();
      return Math.round(t);
    };
    const nb = Object.keys(D2.t).length;
    const c = await mesure(CLASSIQUE), p = await mesure(PIXEL);
    verifie(p <= c * 1.2, `T11. ${nb} tâches, processeur ralenti 4 fois : affichage des listes en ${p} ms en pixel art contre ${c} ms en classique (au plus 20 % de plus)`);
    base.poser('taches', JSON.parse(JSON.stringify(D)));
  }

  // ================= T2 : l'apparence classique ne change pas d'un point =================
  if (fait('T2')) {
    const refDir = path.join(TMP, 'reference');
    let refOk = false;
    try { fs.mkdirSync(refDir); execSync(`git -C "${RACINE}" archive ${REF} | tar -x -C "${refDir}"`, { stdio: ['ignore', 'ignore', 'pipe'] }); refOk = fs.existsSync(path.join(refDir, 'index.html')); } catch (e) { refOk = false; }
    verifie(refOk, `T2. version de référence (${REF}) extraite pour la comparaison`);
    if (refOk) {
      const siteRef = await serveurSite(refDir, PORT_REF, PORT_BASE_REF);
      const baseRef = await fauxFirebase(PORT_BASE_REF, { comptes: { cle: CLE } });
      baseRef.profil(baseRef.creerCompte('francois@ferme.invalid', MDP), 'ferme');
      baseRef.poser('taches', JSON.parse(JSON.stringify(D)));
      const vues = [
        ['sept jours', async () => {}],
        ['liste longue défilée', async (P, pc) => { if (pc) await P.evaluate(() => { document.querySelector('.pan[data-l="lundi"] .pan-corps').scrollTop = 120; }); else { await P.evaluate(() => { document.querySelector('.pan[data-l="lundi"] .pan-corps').scrollTop = 400; }); } }],
        ['menu ⋯ d\'une tâche', async (P) => { await P.click('.pan[data-l="lundi"] li.t[data-id="l5"] .pt', { force: true }); await P.waitForSelector('#tacheDlg[open]'); }],
        ['Réglages', async (P) => { await ouvrirReglages(P);
          // Attendre les vignettes de la rubrique (sur la branche) avant de la masquer : une image qui arrive pendant la capture
          // fait redessiner la page, et les coins arrondis du menu peuvent alors changer de quelques points.
          await P.waitForFunction(() => Array.from(document.querySelectorAll('#appChoix img')).every((i) => i.complete)); await pause(300);
          await P.evaluate(() => { const g = document.getElementById('appChoix'); if (g) { g.previousElementSibling.previousElementSibling.style.display = 'none'; g.previousElementSibling.style.display = 'none'; g.style.display = 'none'; }
            // Rubrique « Chronomètre » et « Historique » (étape 55) : nouvelle, masquée comme « Apparence ».
            const c = document.getElementById('reglChronoBloc'); if (c) c.style.display = 'none'; }); }],
        ['liste verrouillée', async (P, pc) => { if (pc) await P.evaluate(() => { const pi = document.getElementById('piste'), p = document.querySelector('.pan[data-l="archives"]'); pi.scrollLeft = p.offsetLeft - pi.offsetLeft; }); else { await P.click('#bande .pil[data-l="archives"]'); } }],
      ];
      for (const [nomEcran, opts] of [['ordinateur 1920 × 1080', PC], ['téléphone 390 × 844', { ...TEL, deviceScaleFactor: 1 }]]) {
        const pc = nomEcran.startsWith('ordinateur');
        for (const [nomVue, faire] of vues) {
          const caps = [];
          for (const s of [SITE, `http://localhost:${PORT_REF}`]) {
            const { ctx, page: P } = await appareil(nav, opts, null, s);
            await P.emulateMedia({ reducedMotion: 'reduce' });
            await connecter(P);
            if (!pc) { await P.click('#bande .pil[data-l="lundi"]'); await pause(600); }
            await faire(P, pc); await pause(700);
            // Attendre que le défilement (doux) soit fini : même position trois fois de suite.
            let pos = '', memes = 0;
            for (let i = 0; i < 40 && memes < 3; i++) { await pause(200); const p2 = await P.evaluate(() => document.getElementById('piste').scrollLeft + '/' + Array.from(document.querySelectorAll('.pan-corps')).map((c) => c.scrollTop).join()); memes = p2 === pos ? memes + 1 : 0; pos = p2; }
            await P.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.tagName !== 'BODY' && document.activeElement.closest('dialog') === null && document.activeElement.blur());
            caps.push(await P.screenshot({ animations: 'disabled', caret: 'hide' }));
            await ctx.close();
          }
          const { ctx: cc, page: C } = await appareil(nav, PC, null, SITE); await C.goto(SITE + '/');
          const n = await pointsDifferents(C, caps[0], caps[1]); await cc.close();
          verifie(n === 0, `T2. classique, ${nomEcran}, ${nomVue} : ${n} point différent de ${REF}${nomVue === 'Réglages' ? ' (rubriques « Apparence » et « Chronomètre » masquées : seules différences permises)' : ''}`);
          if (n !== 0 && CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); fs.writeFileSync(path.join(CAPTURES, `T2-${pc ? 'pc' : 'tel'}-${nomVue.replace(/\W+/g, '-')}-branche.png`), caps[0]); fs.writeFileSync(path.join(CAPTURES, `T2-${pc ? 'pc' : 'tel'}-${nomVue.replace(/\W+/g, '-')}-ref.png`), caps[1]); }
        }
      }
      siteRef.close(); baseRef.close();
    }
  }

  await nav.close();
  site.close(); base.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTout est vert.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
