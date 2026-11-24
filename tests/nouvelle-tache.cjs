// Étape 54 : sur le téléphone, une nouvelle tâche s'écrit dans un panneau en bas, avec « Enregistrer », comme Google Tasks
// (demande de François du 24/11, fonctionnement et maquette validés le 24/11 : « oui » ; ordinateur inchangé, carte du 24/11).
// Faux Firebase, données inventées (tests/donnees-apparence.cjs), heure figée un mardi.
// Téléphone (Pixel 5) : tout « + » et « Ajouter une sous-tâche » ouvrent le panneau ; ligne « où ira la tâche » ;
// « Enregistrer » grisé tant que le champ est vide ; « Pour qui ? », « Couleur du texte », « Heure » (encart de l'agenda) ;
// Enregistrer = enregistre et ferme ; Entrée = enregistre et reste ouvert (rafale) ; Entrée sur vide = ferme ; toucher à côté,
// Échap = ferme sans rien écrire, le texte revient au prochain « + » de la même liste ; une seule écriture par tâche ;
// Entrée après une modification ; panneau au-dessus du clavier ; hors ligne. Ordinateur : la ligne dans la liste, inchangée.
// Lancement depuis la racine du dépôt : node tests/nouvelle-tache.cjs   (APPARENCE=pixel pour le pixel art ; CAPTURES=dossier)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');
const donnees = require('./donnees-apparence.cjs');
const { PIXEL, sautePixel } = require('./apparence-env.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const PORT_SITE = 8998, PORT_BASE = 8999;
const SITE = `http://localhost:${PORT_SITE}`;
const CLE = 'cle-de-test';
const MDP = 'mdp-francois-1';
const CAPTURES = process.env.CAPTURES || '';
// Mardi 24/11/2026, 9 h (heure de Paris) : la liste du jour est Mardi.
const T0 = new Date('2026-11-24T09:00:00+01:00').getTime();
const TEL = { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' };
const PC = { viewport: { width: 1920, height: 1080 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' };

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
const capture = async (page, nom) => { if (!CAPTURES) return; fs.mkdirSync(CAPTURES, { recursive: true }); await pause(300); await page.screenshot({ path: path.join(CAPTURES, nom) }); };
const ecritures = (base) => base.journal.filter((x) => x.m !== 'GET').length;
const taches = (base) => base.lire('taches/t') || {};
const parTexte = (base, texte) => Object.entries(taches(base)).find(([, t]) => t.texte === texte);
// Les tâches d'une liste, dans l'ordre affiché : « texte » (encart ou « - »), avec le niveau en retrait.
const ordre = (page, L) => page.evaluate((L) => Array.from(document.querySelectorAll(`.pan[data-l="${L}"] li.t[data-id]`)).map((li) => '  '.repeat(+li.dataset.n) + (li.querySelector('.tx') || {}).textContent + ' [' + (li.closest('.encart') ? li.closest('.encart').dataset.e || '-' : '-') + ']'), L);
const etat = (page) => page.evaluate(() => {
  const d = document.getElementById('nouvDlg'), ta = document.getElementById('nouvTexte'), ok = document.getElementById('nouvOk');
  return { ouvert: d.open, ou: document.getElementById('nouvOu').textContent, texte: ta.value, place: ta.placeholder, focus: document.activeElement === ta, grise: !!ok && ok.disabled,
    icones: Array.from(document.querySelectorAll('#nouvOutils .nouv-ic')).map((b) => b.dataset.n), ligne: !!document.querySelector('textarea.ed') };
});

async function connecter(page) {
  await page.goto(SITE + '/');
  await page.waitForSelector('#authDlg[open]');
  await page.fill('#authId', 'francois');
  await page.fill('#authMdp', MDP);
  await page.click('#authOk');
  await page.waitForSelector('.pan[data-l="mardi"] li.t');
  await attendreQue(() => page.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await page.evaluate(() => document.fonts.ready);
  await pause(300);
}
const plusEncart = (L, e) => `.pan[data-l="${L}"] .encart-tete [data-a="ajouter"][data-e="${e}"]`;

(async () => {
  const D = donnees(T0);
  const site = await serveurSite();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  base.profil(base.creerCompte('francois@ferme.invalid', MDP), 'ferme');
  base.poser('taches', JSON.parse(JSON.stringify(D)));
  const nav = await chromium.launch();

  // ================= Téléphone =================
  const ctx = await nav.newContext(TEL);
  const A = await ctx.newPage();
  await A.clock.setFixedTime(T0);
  const erreurs = []; A.on('pageerror', (e) => erreurs.push(String(e)));
  await connecter(A);
  await capture(A, 'telephone-0-avant.png');

  // 1. « + » de l'encart P1 : le panneau, rien d'écrit.
  let n0 = ecritures(base);
  await A.click(plusEncart('mardi', 'p1'));
  await A.waitForSelector('#nouvDlg[open]');
  let s = await etat(A);
  verifie(s.ouvert && s.focus && !s.ligne, '« + » d\'un encart : le panneau s\'ouvre, le curseur est dans le champ, pas de ligne dans la liste ' + JSON.stringify(s));
  verifie(s.ou === 'Mardi · P1' && s.place === 'Nouvelle tâche', 'ligne « où ira la tâche » : « Mardi · P1 », champ « Nouvelle tâche » (' + s.ou + ')');
  verifie(s.grise, '« Enregistrer » grisé tant que rien n\'est écrit');
  verifie(s.icones.join() === 'pour,coul', 'icônes « Pour qui ? » et « Couleur du texte » (pas d\'heure hors de l\'encart de l\'agenda) : ' + s.icones.join());
  const geo = await A.evaluate(() => { const d = document.getElementById('nouvDlg').getBoundingClientRect(), ok = document.getElementById('nouvOk').getBoundingClientRect(), ic = Array.from(document.querySelectorAll('.nouv-ic')).map((b) => b.getBoundingClientRect());
    return { bas: Math.round(innerHeight - d.bottom), gauche: Math.round(d.left), large: Math.round(d.width), ok: [ok.width, ok.height], ic: ic.map((r) => Math.min(r.width, r.height)), okDroite: Math.round(innerWidth - ok.right) }; });
  verifie(geo.bas === 0 && geo.gauche === 0 && geo.large === 390, 'panneau collé en bas, sur toute la largeur ' + JSON.stringify(geo));
  verifie(geo.ok[0] >= 44 && geo.ok[1] >= 44 && geo.ic.every((x) => x >= 44), 'zones à toucher d\'au moins 44 points (icônes et « Enregistrer ») ' + JSON.stringify(geo));
  verifie(geo.okDroite < 40, '« Enregistrer » à droite, comme Google Tasks');
  await capture(A, 'telephone-1-panneau-vide.png');
  await A.keyboard.type('   ');
  verifie((await etat(A)).grise, 'des espaces seulement : « Enregistrer » reste grisé');
  await A.click('#nouvOk', { force: true });
  verifie((await etat(A)).ouvert && ecritures(base) === n0, 'toucher « Enregistrer » grisé : rien ne se passe');
  await A.fill('#nouvTexte', '');
  await A.keyboard.type('Rentrer le bois');
  s = await etat(A);
  verifie(!s.grise, 'on écrit : « Enregistrer » devient actif');
  if (!sautePixel('« Enregistrer » vert, grisé en gris')) {
    const c = await A.evaluate(() => getComputedStyle(document.getElementById('nouvOk')).color);
    verifie(c === 'rgb(11, 105, 77)', '« Enregistrer » actif en vert de la charte (' + c + ')');
  }
  if (PIXEL) {
    const c = await A.evaluate(() => { const b = document.getElementById('nouvOk'); return getComputedStyle(b).backgroundColor; });
    verifie(c === 'rgb(168, 64, 111)', 'pixel art : « Enregistrer » actif en rose #a8406f (' + c + ')');
  }
  await capture(A, 'telephone-2-texte-ecrit.png');
  // Pour qui ? puis couleur.
  await A.click('#nouvOutils [data-n="pour"]');
  verifie(await A.evaluate(() => !document.getElementById('nouvChoix').hidden && document.querySelectorAll('#nouvChoix [data-npour]').length === 5), '« Pour qui ? » : Tout le monde et les quatre personnes');
  await capture(A, 'telephone-3-pour-qui.png');
  await A.click('#nouvChoix [data-npour="theo"]');
  verifie(await A.evaluate(() => document.getElementById('nouvChoix').hidden && document.querySelector('#nouvOutils [data-n="pour"] .pastille').textContent === 'T'), 'Théo choisi : le choix se referme, l\'icône montre sa pastille « T »');
  await A.click('#nouvOutils [data-n="coul"]');
  verifie(await A.evaluate(() => document.querySelectorAll('#nouvChoix [data-ncoul]').length === 6), '« Couleur du texte » : les six couleurs');
  await capture(A, 'telephone-4-couleur.png');
  await A.click('#nouvChoix [data-ncoul="rouge"]');
  verifie(await A.evaluate(() => getComputedStyle(document.getElementById('nouvTexte')).color === 'rgb(176, 42, 55)'), 'rouge choisi : le texte du champ s\'écrit en rouge');
  verifie(ecritures(base) === n0, 'rien n\'est écrit dans la base avant « Enregistrer » (' + (ecritures(base) - n0) + ')');
  await A.click('#nouvOk');
  verifie(await attendreQue(() => A.evaluate(() => !document.getElementById('nouvDlg').open)), '« Enregistrer » : le panneau se ferme');
  let t = await attendreQue(() => !!parTexte(base, 'Rentrer le bois')) && parTexte(base, 'Rentrer le bois')[1];
  verifie(t && t.liste === 'mardi' && t.encart === 'p1' && t.parent === '' && t.pour === 'theo' && t.couleur === 'rouge' && t.by === 'francois', 'enregistrée dans la base : Mardi, P1, pour Théo, en rouge ' + JSON.stringify(t));
  verifie(ecritures(base) - n0 === 1, 'une seule écriture pour la tâche et ses réglages (' + (ecritures(base) - n0) + ')');
  let o = await ordre(A, 'mardi');
  verifie(o.indexOf('Rentrer le bois [p1]') >= 0 && o[o.indexOf('Rentrer le bois [p1]') + 1] === 'Semer les mâches sous tunnel [p1]', 'la tâche arrive en haut de P1, comme avant ' + JSON.stringify(o));
  await pause(100);
  await capture(A, 'telephone-5-apres-enregistrer.png');

  // 2. « + » de la liste : hors des encarts, au-dessus de RDV ; Entrée en rafale ; Entrée sur vide ferme.
  n0 = ecritures(base);
  await A.click('.pan[data-l="mardi"] .plus');
  await A.waitForSelector('#nouvDlg[open]');
  s = await etat(A);
  verifie(s.ou === 'Mardi' && s.texte === '' && s.focus, '« + » de la liste : « Mardi » seul (hors encart), champ vide (' + s.ou + ')');
  await A.keyboard.type('Première'); await A.keyboard.press('Enter');
  s = await etat(A);
  verifie(s.ouvert && s.texte === '' && s.focus && s.grise && s.ou === 'Mardi', 'Entrée (« OK ») : enregistre, le panneau reste ouvert et vide pour la suivante');
  await A.keyboard.type('Deuxième'); await A.keyboard.press('Enter');
  await A.keyboard.press('Enter');
  verifie(!(await etat(A)).ouvert, 'Entrée sur un champ vide : le panneau se ferme');
  o = await ordre(A, 'mardi');
  verifie(o[0] === 'Première [-]' && o[1] === 'Deuxième [-]' && o[2].startsWith('13:00'), 'rafale : dans l\'ordre tapé, en haut de la liste, au-dessus de RDV ' + JSON.stringify(o.slice(0, 3)));
  verifie(ecritures(base) - n0 === 2, 'deux tâches, deux écritures (' + (ecritures(base) - n0) + ')');

  // 3. Fermer sans enregistrer : toucher à côté, Échap ; le texte revient au prochain « + » de la même liste.
  n0 = ecritures(base);
  await A.click(plusEncart('mardi', 'p2'));
  await A.keyboard.type('Brouillon du mardi');
  const cadre = await A.evaluate(() => { const r = document.getElementById('nouvDlg').getBoundingClientRect(); return { x: r.left + 6, y: r.top + 4 }; });
  await A.mouse.click(cadre.x, cadre.y);
  verifie((await etat(A)).ouvert, 'toucher le cadre du panneau ne le ferme pas');
  await A.mouse.click(195, 150);
  verifie(!(await etat(A)).ouvert, 'toucher à côté du panneau (le fond assombri) le ferme');
  verifie(ecritures(base) === n0 && !parTexte(base, 'Brouillon du mardi'), 'fermé sans enregistrer : rien d\'écrit');
  await A.click(plusEncart('mardi', 'p1'));
  s = await etat(A);
  verifie(s.texte === 'Brouillon du mardi' && !s.grise, 'le texte laissé revient au prochain « + » de la même liste, « Enregistrer » actif');
  await A.keyboard.press('Escape');
  verifie(!(await etat(A)).ouvert, 'Échap (ou le retour du téléphone) ferme le panneau');
  await A.click('.pil[data-l="mercredi"]'); await pause(500);
  await A.click(plusEncart('mercredi', 'p1'));
  s = await etat(A);
  verifie(s.texte === '' && s.ou === 'Mercredi · P1', 'une autre liste : panneau vide');
  await A.keyboard.press('Escape');
  await A.click('.pil[data-l="mardi"]'); await pause(500);
  await A.click(plusEncart('mardi', 'p2'));
  verifie((await etat(A)).texte === 'Brouillon du mardi', 'le texte de Mardi est toujours là');
  await A.fill('#nouvTexte', '');
  verifie((await etat(A)).grise, 'champ vidé : « Enregistrer » grisé');
  await A.keyboard.press('Escape');
  await A.click(plusEncart('mardi', 'p2'));
  verifie((await etat(A)).texte === '', 'champ vidé puis fermé : plus de texte gardé');
  await A.keyboard.press('Escape');
  verifie(ecritures(base) === n0, 'aucune écriture pendant ces ouvertures et fermetures');

  // 4. Sous-tâche depuis le menu « ⋯ » : la ligne dit sous quelle tâche ; elle arrive sous les autres sous-tâches.
  await A.click('.pan[data-l="mardi"] li.t:has(> .tx:text-is("Semer les mâches sous tunnel")) .pt');
  await A.waitForSelector('#tacheDlg[open]');
  await A.click('#tacheDlg [data-a="sous-tache"]');
  await A.waitForSelector('#nouvDlg[open]');
  s = await etat(A);
  verifie(s.ou === 'Sous-tâche de « Semer les mâches sous tunnel »' && s.place === 'Nouvelle sous-tâche' && s.focus, '« Ajouter une sous-tâche » : le panneau dit sous quelle tâche (' + s.ou + ')');
  await capture(A, 'telephone-6-sous-tache.png');
  await A.keyboard.type('Rangs 5 à 8'); await A.keyboard.press('Enter'); await A.keyboard.press('Enter');
  t = await attendreQue(() => !!parTexte(base, 'Rangs 5 à 8')) && parTexte(base, 'Rangs 5 à 8')[1];
  verifie(t && t.parent === 'm2' && t.liste === 'mardi', 'sous-tâche enregistrée sous « Semer les mâches »');
  o = await ordre(A, 'mardi');
  const iA = o.indexOf('  Arroser après le semis [p1]');
  verifie(iA >= 0 && o[iA + 1] === '  Rangs 5 à 8 [p1]', 'elle arrive sous les autres sous-tâches ' + JSON.stringify(o.slice(iA - 2, iA + 2)));

  // 5. Encart de l'agenda (RDV) : l'icône « Heure ».
  await A.click(plusEncart('mardi', 'rdv'));
  s = await etat(A);
  verifie(s.icones.join() === 'pour,coul,heure', 'encart RDV : icône « Heure » en plus (' + s.icones.join() + ')');
  await A.keyboard.type('Vétérinaire');
  await A.click('#nouvOutils [data-n="heure"]');
  await A.fill('#nouvHeure', '10:30');
  verifie(await A.evaluate(() => document.querySelector('#nouvOutils [data-n="heure"]').textContent === '10:30'), 'l\'heure choisie s\'affiche sur l\'icône');
  await capture(A, 'telephone-7-heure.png');
  await A.click('#nouvOk');
  t = await attendreQue(() => !!parTexte(base, 'Vétérinaire')) && parTexte(base, 'Vétérinaire')[1];
  verifie(t && t.encart === 'rdv' && t.heure === '10:30', 'rendez-vous enregistré avec son heure (10:30)');
  verifie(await attendreQue(() => A.evaluate(() => Array.from(document.querySelectorAll('.pan[data-l="mardi"] li.t .tx')).some((x) => x.textContent === '10:30 Vétérinaire'))), 'affiché « 10:30 Vétérinaire »');

  // 6. Toucher le texte d'une tâche, puis Entrée : la modification est gardée, la suivante s'écrit dans le panneau, juste en dessous.
  await A.click('.pan[data-l="mardi"] li.t:has(> .tx:text-is("Nettoyer les caisses")) .tx');
  await A.waitForSelector('.pan[data-l="mardi"] textarea.ed');
  await A.keyboard.press('End'); await A.keyboard.type(' vides');
  await A.keyboard.press('Enter');
  s = await etat(A);
  verifie(s.ouvert && s.focus && s.ou === 'Mardi · P1' && !s.ligne, 'modification puis Entrée : le panneau s\'ouvre pour la suivante ' + JSON.stringify(s));
  verifie(await attendreQue(() => !!parTexte(base, 'Nettoyer les caisses vides')), 'la modification est enregistrée');
  await A.keyboard.type('Juste après'); await A.keyboard.press('Enter'); await A.keyboard.press('Enter');
  o = await ordre(A, 'mardi');
  verifie(o[o.indexOf('Nettoyer les caisses vides [p1]') + 1] === 'Juste après [p1]', 'la nouvelle tâche est juste en dessous');

  // 7. Le clavier du téléphone couvre le bas de l'écran : le panneau se pose juste au-dessus.
  await A.click(plusEncart('mardi', 'p1'));
  const auDessus = await A.evaluate(() => {
    const vrai = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: innerHeight - 300, offsetTop: 0, width: innerWidth } });
    suivreClavier();
    const r = document.getElementById('nouvDlg').getBoundingClientRect(), bas = Math.round(innerHeight - r.bottom);
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vrai });
    suivreClavier();
    return { bas, apres: Math.round(innerHeight - document.getElementById('nouvDlg').getBoundingClientRect().bottom) };
  });
  verifie(auDessus.bas === 300 && auDessus.apres === 0, 'clavier de 300 points : le panneau se pose juste au-dessus, puis redescend ' + JSON.stringify(auDessus));
  await A.keyboard.press('Escape');

  // 8. Hors ligne : la tâche s'affiche tout de suite et part au retour du réseau.
  await ctx.setOffline(true);
  await A.evaluate(() => window.dispatchEvent(new Event('offline')));
  await A.click(plusEncart('mardi', 'p2'));
  await A.keyboard.type('Écrite hors ligne'); await A.click('#nouvOk');
  verifie(await attendreQue(async () => (await ordre(A, 'mardi')).includes('Écrite hors ligne [p2]')), 'hors ligne : la tâche s\'affiche tout de suite');
  verifie(!parTexte(base, 'Écrite hors ligne'), 'hors ligne : pas encore dans la base');
  await ctx.setOffline(false);
  await A.evaluate(() => window.dispatchEvent(new Event('online')));
  verifie(await attendreQue(() => !!parTexte(base, 'Écrite hors ligne'), 20000), 'retour du réseau : la tâche part dans la base');

  // 9. Liste verrouillée : pas de « + », donc pas de panneau.
  await A.click('.pil[data-l="archives"]'); await pause(500);
  verifie(await A.evaluate(() => { const p = document.querySelector('.pan[data-l="archives"]'); return getComputedStyle(p.querySelector('.plus')).display === 'none'; }), 'liste verrouillée : pas de « + »');
  verifie(await A.evaluate(() => { ouvrirNouveau('archives', '', null, ''); return !document.getElementById('nouvDlg').open; }), 'liste verrouillée : le panneau ne s\'ouvre pas');
  verifie(erreurs.length === 0, 'téléphone : aucune erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await ctx.close();

  // ================= Ordinateur : inchangé (la ligne dans la liste, comme Google Tasks sur ordinateur) =================
  const cP = await nav.newContext(PC);
  const P = await cP.newPage();
  await P.clock.setFixedTime(T0);
  const erreursP = []; P.on('pageerror', (e) => erreursP.push(String(e)));
  await connecter(P);
  await P.click(plusEncart('mardi', 'p1'));
  await P.waitForSelector('.pan[data-l="mardi"] textarea.ed');
  verifie(await P.evaluate(() => !document.getElementById('nouvDlg').open && document.activeElement.matches('.pan[data-l="mardi"] .encart[data-e="p1"] textarea.ed')), 'ordinateur : « + » ouvre la ligne dans la liste, pas de panneau');
  await P.keyboard.type('Sur ordinateur'); await P.keyboard.press('Enter');
  verifie(await P.evaluate(() => document.activeElement && document.activeElement.matches('textarea.ed') && !document.getElementById('nouvDlg').open), 'ordinateur : Entrée enregistre et ouvre la ligne suivante, comme avant');
  await P.keyboard.press('Escape');
  verifie(await attendreQue(() => !!parTexte(base, 'Sur ordinateur')), 'ordinateur : la tâche est enregistrée');
  await capture(P, 'ordinateur-inchange.png');
  verifie(erreursP.length === 0, 'ordinateur : aucune erreur dans la page' + (erreursP.length ? ' : ' + erreursP.join(' / ') : ''));
  await cP.close();

  await nav.close(); site.close();
  console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
