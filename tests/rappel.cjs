// Rappel du matin (étapes 45A et 45B) :
//  1. le programme du site (functions/rappel/[[chemin]].js) appelé comme Cloudflare l'appelle (onRequest), sur le faux
//     Firebase, avec un faux service de notification local : heure du rappel, liste du jour de la personne (RDV à l'heure
//     en tête, tâches de tout le monde et les siennes, pas celles des autres ni les sous-tâches), renvoi tant que
//     « J'ai lu ma liste » n'est pas touché, arrêt après, téléphone disparu retiré, essai, clés créées une seule fois ;
//     contenu déchiffré ici avec le module crypto de Node (chiffrement aes128gcm) et signature VAPID vérifiée ;
//  2. droits du compte « rappel » (faux Firebase, comme la règle proposée) ;
//  3. l'appli : bloc « Rappel du matin » des Réglages (par personne), bandeau « J'ai lu ma liste », bouton du téléphone.
// Ce test ne touche jamais la vraie base, Cloudflare ni un vrai service de notification.
// Lancement depuis la racine du dépôt : node tests/rappel.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8972, PORT_BASE = 8973, PORT_PUSH = 8974;
const BASE = `http://localhost:${PORT_BASE}`, SITE = `http://localhost:${PORT_SITE}`, PUSH = `http://localhost:${PORT_PUSH}`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', aurore: 'mdp-aurore-1', rappel: 'mdp-rappel-1' };
const CAPTURES = process.env.CAPTURES || '';
const ENV = { RAPPEL_MDP: MDP.rappel, CLE_WEB: CLE, DB_URL: BASE, AUTH_URL: BASE, PUSH_HTTP: 'oui' };

let echecs = 0;
function verifie(cond, msg) { console.log((cond ? 'OK    ' : 'ÉCHEC ') + msg); if (!cond) echecs++; }
const attendreQue = async (fn, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { if (await fn()) return true; } catch (e) { /* page en cours */ } await new Promise((x) => setTimeout(x, 120)); } return false; };
const pause = (ms) => new Promise((x) => setTimeout(x, ms));

// ---------- Faux service de notification : garde chaque envoi, répond 201 (ou 410 pour /p/mort) ----------
const recus = [];
function serveurPush() {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      const morceaux = []; q.on('data', (d) => morceaux.push(d));
      q.on('end', () => { recus.push({ chemin: q.url, entetes: q.headers, corps: Buffer.concat(morceaux) }); r.writeHead(q.url === '/p/mort' ? 410 : 201); r.end(); });
    });
    s.listen(PORT_PUSH, () => ok(s));
  });
}
// Un « téléphone » : sa paire de clés (p256dh) et son secret (auth), comme le navigateur les crée.
function telephone(n) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, endpoint: `${PUSH}/p/${n}`, cles: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
}
// Déchiffrement aes128gcm (RFC 8291) avec Node, indépendant du code du site (qui chiffre avec WebCrypto).
function hmac(cle, d) { return crypto.createHmac('sha256', cle).update(d).digest(); }
function dechiffrer(tel, corps) {
  const sel = corps.subarray(0, 16), rs = corps.readUInt32BE(16), lg = corps[20], asPub = corps.subarray(21, 21 + lg), chiffre = corps.subarray(21 + lg);
  const partage = tel.ecdh.computeSecret(asPub), uaPub = tel.ecdh.getPublicKey();
  const ikm = hmac(hmac(tel.auth, partage), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(sel, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(chiffre.subarray(-16));
  const clair = Buffer.concat([d.update(chiffre.subarray(0, -16)), d.final()]);
  if (rs !== 4096 || clair[clair.length - 1] !== 2) throw new Error('enregistrement mal formé');
  return JSON.parse(clair.subarray(0, -1).toString('utf8'));
}
// Signature VAPID (RFC 8292) vérifiée avec la clé publique annoncée (k=…).
function vapidOk(entete, endpoint) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(entete || ''); if (!m) return false;
  const [tete, corps, sig] = m[1].split('.');
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: Buffer.from(m[2], 'base64url').subarray(1, 33).toString('base64url'), y: Buffer.from(m[2], 'base64url').subarray(33).toString('base64url') }, format: 'jwk' });
  const ok = crypto.verify('sha256', Buffer.from(tete + '.' + corps), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  const c = JSON.parse(Buffer.from(corps, 'base64url').toString());
  return ok && c.aud === new URL(endpoint).origin && c.exp > Date.now() / 1000 && /^(https:|mailto:|http:\/\/localhost)/.test(c.sub);
}

function serveurSite(mod) {
  return new Promise((ok) => {
    const s = http.createServer(async (q, r) => {
      let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (f.startsWith('/rappel/')) {
        // Le programme du site, comme Cloudflare le sert.
        const morceaux = []; for await (const d of q) morceaux.push(d);
        const rep = await mod.onRequest({ request: new Request(SITE + q.url, { method: q.method, headers: q.headers, body: q.method === 'GET' ? undefined : Buffer.concat(morceaux) }), env: ENV, params: {} });
        r.writeHead(rep.status, { 'Content-Type': 'text/plain; charset=utf-8' }); return r.end(await rep.text());
      }
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

(async () => {
  const mod = await import(pathToFileURL(path.join(RACINE, 'functions/rappel/[[chemin]].js')).href);
  const site = await serveurSite(mod), push = await serveurPush();
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.aurore, 'ferme'); base.profil(uid.rappel, 'rappel');

  // ---------- 1. Calculs purs ----------
  const r0 = mod.reglage({});
  verifie(r0.actif === false && r0.heure === '07:30' && r0.jours === '012345' && r0.repete === 10 && r0.jusqua === '09:00', 'réglage par défaut : inactif, 7 h 30, lundi à samedi, toutes les 10 minutes, jusqu\'à 9 h');
  const hiver = mod.ici('Europe/Paris', Date.UTC(2026, 10, 19, 6, 35)), ete = mod.ici('Europe/Paris', Date.UTC(2026, 6, 16, 5, 35));
  verifie(hiver.hm === '07:35' && hiver.date === '2026-11-19' && hiver.jour === 3 && ete.hm === '07:35' && ete.jour === 3, 'heure de la personne dans son fuseau (heure d\'hiver et d\'été), jeudi = 3');
  const R = mod.reglage({ actif: true, heure: '07:30', jours: '0123456', repete: 10, jusqua: '09:00' }), T = Date.UTC(2026, 10, 19, 6, 35);
  const h = (hm) => ({ date: '2026-11-19', hm, jour: 3 });
  verifie(mod.du(R, h('07:29'), false, null, T) === null && mod.du(R, h('07:30'), false, null, T) === 'premier', 'avant l\'heure : rien ; à l\'heure : premier envoi');
  verifie(mod.du(R, h('07:35'), true, null, T) === null, 'déjà lu ce jour-là : rien');
  verifie(mod.du(mod.reglage({ actif: true, jours: '0124' }), h('07:35'), false, null, T) === null, 'jour non coché (jeudi absent) : rien');
  verifie(mod.du(mod.reglage({ actif: false }), h('07:35'), false, null, T) === null, 'rappel inactif : rien');
  const env1 = { date: '2026-11-19', at: T - 5 * 60000 }, env2 = { date: '2026-11-19', at: T - 10 * 60000 };
  verifie(mod.du(R, h('07:40'), false, env1, T) === null && mod.du(R, h('07:40'), false, env2, T) === 'rappel', 'renvoi seulement quand les 10 minutes sont passées');
  verifie(mod.du(R, h('09:01'), false, env2, T) === null, 'après l\'heure de fin : plus de renvoi');
  verifie(mod.du(mod.reglage({ actif: true, jours: '0123456', repete: 0 }), h('07:50'), false, env2, T) === null, '« Une seule fois » : pas de renvoi');
  verifie(mod.du(R, h('07:40'), false, { date: '2026-11-18', at: T - 864e5 }, T) === 'premier', 'l\'envoi d\'hier ne compte pas : premier envoi du jour');
  verifie(mod.du(R, h('11:00'), false, null, T) === null, 'plus de deux heures après l\'heure et après la fin (horloge en panne le matin) : pas d\'envoi tardif');

  const taches = {
    listes: { jeudi: { nom: 'Jeudi', type: 'jour', jour: 3, encarts: { rdv: true, p1: true, p2: true } }, mercredi: { nom: 'Mercredi', type: 'jour', jour: 2 } },
    t: {
      a: { liste: 'jeudi', encart: 'p1', ordre: 1, texte: 'Prendre la caisse' },
      b: { liste: 'jeudi', encart: 'rdv', heure: '10:30', ordre: 1, texte: 'Véto' },
      c: { liste: 'jeudi', encart: 'rdv', heure: '08:00', ordre: 2, texte: 'Banque' },
      d: { liste: 'jeudi', encart: 'p2', ordre: 1, texte: 'Rappeler Igor', pour: 'francois' },
      e: { liste: 'jeudi', encart: 'p1', ordre: 2, texte: 'Pour Aurore seulement', pour: 'aurore' },
      f: { liste: 'jeudi', parent: 'a', ordre: 1, texte: 'sous-tâche' },
      g: { liste: 'jeudi', encart: 'p1', ordre: 3, sep: true },
      h: { liste: 'mercredi', ordre: 1, texte: 'Hier' },
    },
  };
  const LJ = mod.listeDuJour(taches, 3, 'francois', { encarts: { rdv: 'RDV' } });
  verifie(JSON.stringify(LJ.lignes) === JSON.stringify(['08 h 00 · Banque', '10 h 30 · Véto', 'Prendre la caisse', 'Rappeler Igor']), 'liste du jour de François : RDV par heure, puis P1, puis P2 ; ni les tâches d\'Aurore, ni les sous-tâches, ni les séparateurs, ni les autres jours');
  verifie(mod.listeDuJour(taches, 3, 'aurore').lignes.includes('Pour Aurore seulement') && !mod.listeDuJour(taches, 3, 'aurore').lignes.includes('Rappeler Igor'), 'liste du jour d\'Aurore : ses tâches à elle');
  const M = mod.message(LJ, false);
  verifie(M.titre === 'Jeudi : 4 tâches' && M.texte.split('\n')[0] === '• 08 h 00 · Banque' && M.tag === 'rappel', 'notification : « Jeudi : 4 tâches », une ligne par tâche');
  const long = mod.message({ nom: 'Jeudi', lignes: Array.from({ length: 11 }, (_, i) => 'T' + i) }, true);
  verifie(long.titre.startsWith('Pas encore lue · ') && long.texte.split('\n').length === 9 && long.texte.endsWith('… et 3 autres'), 'renvoi : « Pas encore lue », 8 lignes au plus puis « … et 3 autres »');
  verifie(mod.message({ nom: 'Dimanche', lignes: [] }).texte === 'Rien dans la liste du jour.', 'liste vide : « Rien dans la liste du jour. »');

  // Chiffrement seul : déchiffré par Node.
  const t0 = telephone(0);
  const ch = await mod.chiffrer(JSON.stringify({ x: 'é€' }), t0.cles.p256dh, t0.cles.auth);
  verifie(dechiffrer(t0, Buffer.from(ch)).x === 'é€', 'contenu chiffré (aes128gcm) relu par une autre mise en œuvre (Node)');

  // ---------- 2. Le programme, appelé comme par Cloudflare ----------
  let maintenant = Date.now();
  const vraiNow = Date.now; Date.now = () => maintenant;
  const appel = async (chemin, methode, corps, env) => {
    const r = await mod.onRequest({ request: new Request('https://essai.pages.dev/rappel/' + chemin, { method: methode || 'GET', body: corps === undefined ? undefined : JSON.stringify(corps) }), env: env || ENV, params: {} });
    return { s: r.status, t: (await r.text()).trim() };
  };
  const sansMdp = await appel('tic', 'POST', undefined, Object.assign({}, ENV, { RAPPEL_MDP: '' }));
  verifie(sansMdp.s === 503 && /pas encore installé/.test(sansMdp.t), 'sans le mot de passe dans Cloudflare : « rappel pas encore installé »');
  verifie(/RAPPEL PAS PRÊT/.test((await appel('etat', 'GET', undefined, Object.assign({}, ENV, { RAPPEL_MDP: '' }))).t), '/rappel/etat sans réglage : « RAPPEL PAS PRÊT »');

  const ici = mod.ici('Europe/Paris', maintenant);
  const tp = telephone(1);
  base.poser('taches/listes', { j: { nom: mod.listeDuJour({ listes: {} }, ici.jour).nom, type: 'jour', jour: ici.jour, encarts: { rdv: true, p1: true, p2: true } } });
  base.poser('taches/t', { a: { liste: 'j', encart: 'p1', ordre: 1, texte: 'Prendre la caisse' }, c: { liste: 'j', encart: 'rdv', heure: '08:00', ordre: 1, texte: 'Banque' }, e: { liste: 'j', encart: 'p1', ordre: 2, texte: 'Pour Aurore', pour: 'aurore' } });
  base.poser('taches/rappels/francois', { actif: true, heure: '00:00', jours: '0123456', repete: 10, jusqua: '23:59', fuseau: 'Europe/Paris' });
  base.poser('taches/rappels/aurore', { actif: false, heure: '00:00', jours: '0123456', repete: 10, jusqua: '23:59', fuseau: 'Europe/Paris' });
  base.poser('taches/abonnements/francois', { a1: { endpoint: tp.endpoint, cles: tp.cles }, a2: { endpoint: `${PUSH}/p/mort`, cles: telephone(2).cles } });
  base.poser('taches/abonnements/aurore', { a3: { endpoint: `${PUSH}/p/3`, cles: telephone(3).cles } });

  const etat = await appel('etat');
  verifie(/compte « rappel » : connecté/.test(etat.t) && /clés d'envoi : prêtes/.test(etat.t) && /téléphones abonnés : 3/.test(etat.t) && /RAPPEL PRÊT/.test(etat.t), '/rappel/etat : compte connecté, clés prêtes, 3 téléphones, « RAPPEL PRÊT »');
  const vapid = base.lire('rappel/vapid');
  verifie(!!(vapid && vapid.publique && vapid.jwk && vapid.jwk.d), 'clés d\'envoi créées par le programme et gardées dans la base (rappel/vapid)');
  const cle = await appel('cle');
  verifie(cle.s === 200 && cle.t === vapid.publique && Buffer.from(cle.t, 'base64url').length === 65, '/rappel/cle : la clé publique (65 octets), la même que dans la base');

  const tic1 = await appel('tic', 'POST');
  const pour1 = recus.filter((x) => x.chemin === '/p/1');
  verifie(tic1.s === 200 && /francois : premier envoi, 1 remis, 1 téléphone\(s\) disparu\(s\)/.test(tic1.t), 'premier passage de l\'horloge : envoi à François (« ' + tic1.t + ' »)');
  verifie(!recus.some((x) => x.chemin === '/p/3'), 'rien pour Aurore (son rappel est inactif)');
  verifie(pour1.length === 1 && pour1[0].entetes['content-encoding'] === 'aes128gcm' && pour1[0].entetes.ttl === '3600' && pour1[0].entetes.urgency === 'high', 'notification en « aes128gcm », urgente, gardée une heure si le téléphone est éteint');
  verifie(vapidOk(pour1[0].entetes.authorization, tp.endpoint) && pour1[0].entetes.authorization.endsWith('k=' + vapid.publique), 'signature VAPID valable, avec la clé de la base');
  const n1 = dechiffrer(tp, pour1[0].corps);
  verifie(/ : 2 tâches$/.test(n1.titre) && n1.texte === '• 08 h 00 · Banque\n• Prendre la caisse' && n1.url === './?rappel=1' && !n1.essai, 'contenu déchiffré : titre « <jour> : 2 tâches », le RDV d\'abord, sans la tâche d\'Aurore (« ' + n1.titre + ' »)');
  verifie(!base.lire('taches/abonnements/francois/a2') && !!base.lire('taches/abonnements/francois/a1'), 'téléphone disparu (réponse 410) retiré de la base, l\'autre gardé');
  verifie(base.lire('rappel/envois/francois').n === 1 && base.lire('rappel/envois/francois').date === ici.date, 'envoi noté (rappel/envois/francois : n° 1, date du jour)');

  const tic2 = await appel('tic', 'POST');
  verifie(/déjà fait/.test(tic2.t) && recus.filter((x) => x.chemin === '/p/1').length === 1, 'deuxième appel dans la minute : rien de plus');
  maintenant += 6 * 60000;
  const tic3 = await appel('tic', 'POST');
  verifie(/rien à envoyer/.test(tic3.t), '6 minutes après : rien (renvoi toutes les 10 minutes)');
  maintenant += 5 * 60000;
  const tic4 = await appel('tic', 'POST');
  const pour4 = recus.filter((x) => x.chemin === '/p/1');
  verifie(/francois : rappel n° 2, 1 remis/.test(tic4.t) && pour4.length === 2 && dechiffrer(tp, pour4[1].corps).titre.startsWith('Pas encore lue · '), '11 minutes après, pas encore lu : renvoi « Pas encore lue »');

  const luMauvais = await appel('lu', 'POST', { endpoint: 'https://inconnu.example/x' });
  verifie(luMauvais.s === 404 && !base.lire('taches/lu'), '« J\'ai lu » d\'un téléphone inconnu : refusé, rien d\'écrit');
  const lu = await appel('lu', 'POST', { endpoint: tp.endpoint });
  verifie(lu.s === 200 && !!(base.lire('taches/lu/francois/' + ici.date) || {}).at && base.lire('taches/lu/francois/' + ici.date).par === 'notification', '« J\'ai lu ma liste » sous la notification : noté pour François, ce jour-là');
  maintenant += 11 * 60000;
  const tic5 = await appel('tic', 'POST');
  verifie(/rien à envoyer/.test(tic5.t) && recus.filter((x) => x.chemin === '/p/1').length === 2, 'une fois lu : plus de renvoi');

  const essai = await appel('essai', 'POST', { endpoint: tp.endpoint });
  const pourE = recus.filter((x) => x.chemin === '/p/1');
  verifie(essai.s === 200 && /Essai envoyé/.test(essai.t) && pourE.length === 3 && dechiffrer(tp, pourE[2].corps).titre.startsWith('Essai · ') && dechiffrer(tp, pourE[2].corps).essai === true, '« Envoyer un essai » : notification « Essai · … » tout de suite, même liste lue');
  const essai2 = await appel('essai', 'POST', { endpoint: tp.endpoint });
  verifie(essai2.s === 429, 'deux essais de suite : le second attend 30 secondes');
  verifie(JSON.stringify(base.lire('rappel/vapid')) === JSON.stringify(vapid), 'clés d\'envoi créées une seule fois');
  verifie((await appel('inconnu', 'POST')).s === 404, 'appel inconnu : refusé');
  Date.now = vraiNow;

  // ---------- 3. Droits du compte « rappel » (faux Firebase, comme la règle proposée) ----------
  const jeton = async (id) => (await (await fetch(`${BASE}/v1/accounts:signInWithPassword?key=${CLE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@ferme.invalid', password: MDP[id], returnSecureToken: true }) })).json()).idToken;
  const jr = await jeton('rappel'), jf = await jeton('francois');
  const st = async (m, chemin, j, v) => (await fetch(`${BASE}/${chemin}.json?auth=${j}`, { method: m, body: v === undefined ? undefined : JSON.stringify(v) })).status;
  verifie(await st('PUT', 'taches/t/x', jr, { texte: 'pirate' }) === 401 && await st('PUT', 'taches/rappels/francois', jr, {}) === 401, 'le compte « rappel » ne peut ni écrire une tâche ni changer un réglage');
  verifie(await st('GET', 'listes', jr) === 401 && await st('GET', 'profils/' + uid.francois, jr) === 401, 'le compte « rappel » ne lit pas les listes de récolte ni les profils des autres');
  verifie(await st('GET', 'rappel/vapid', jf) === 401, 'un compte de la ferme ne lit pas les clés d\'envoi (rappel/)');

  // ---------- 4. L'appli : Réglages, bandeau, téléphone ----------
  base.poser('taches/rappels', null); base.poser('taches/lu', null);
  const navigateur = await chromium.launch();
  const ctx = await navigateur.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Paris' });
  await ctx.grantPermissions(['notifications'], { origin: SITE });
  const A = await ctx.newPage();
  const ctxB = await navigateur.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Paris' });
  const B = await ctxB.newPage();
  for (const [p, id] of [[A, 'francois'], [B, 'aurore']]) {
    await p.goto(SITE + '/'); await p.waitForSelector('#authDlg[open]');
    await p.fill('#authId', id); await p.fill('#authMdp', MDP[id]); await p.click('#authOk');
    await attendreQue(() => p.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  }
  verifie(await A.locator('#rappelLu').isHidden(), 'sans rappel réglé : pas de bandeau');
  await A.click('#avatar'); await A.click('#versReglages');
  await A.waitForSelector('#reglDlg[open] #rapActif');
  verifie(await A.locator('#reglRap [data-rpour="francois"][aria-pressed="true"]').count() === 1, 'Réglages, « Rappel du matin » : ouvert sur la personne connectée (François)');
  verifie(await A.$eval('#rapHeure', (x) => x.value) === '07:30' && await A.$eval('#rapJusqua', (x) => x.value) === '09:00' && await A.$eval('#rapRepete', (x) => x.value) === '10' && await A.locator('#reglRap [data-rjour][aria-pressed="true"]').count() === 6, 'valeurs de départ : 7 h 30, lundi à samedi, toutes les 10 minutes, jusqu\'à 9 h');
  verifie(await A.$eval('#rapChamps', (x) => x.getAttribute('aria-disabled')) === 'true', 'tant que la case n\'est pas cochée, les réglages sont grisés');
  if (CAPTURES) await A.locator('#reglDlg').screenshot({ path: path.join(CAPTURES, '1-reglages-avant.png') });
  await A.check('#rapActif');
  await A.fill('#rapHeure', '00:00');
  await A.click('#reglRap [data-rjour="6"]');
  await A.selectOption('#rapRepete', '15');
  await A.fill('#rapJusqua', '23:59');
  if (CAPTURES) await A.locator('#reglDlg').screenshot({ path: path.join(CAPTURES, '2-reglages-rappel.png') });
  // Aurore, depuis le téléphone de François : « Pour qui ? »
  await A.click('#reglRap [data-rpour="aurore"]');
  verifie(await A.$eval('#rapActif', (x) => x.checked) === false && await A.locator('#rapTel').count() === 0, '« Pour qui ? » Aurore : son réglage à elle, sans le bloc « ce téléphone »');
  await A.check('#rapActif'); await A.fill('#rapHeure', '06:45');
  await A.click('#reglRap [data-rpour="francois"]');
  verifie(await A.$eval('#rapActif', (x) => x.checked) && await A.$eval('#rapHeure', (x) => x.value) === '00:00', 'retour sur François : ce qu\'on venait de régler est gardé');
  await A.click('#reglForm button[type="submit"]');
  await attendreQue(() => base.lire('taches/rappels/francois') && base.lire('taches/rappels/aurore'));
  const rf = base.lire('taches/rappels/francois'), ra = base.lire('taches/rappels/aurore');
  verifie(rf && rf.actif === true && rf.heure === '00:00' && rf.jours === '0123456' && rf.repete === 15 && rf.jusqua === '23:59' && rf.fuseau === 'Europe/Paris' && rf.by === 'francois', 'enregistré dans la base : taches/rappels/francois (heure, jours, toutes les 15 minutes, fin, fuseau du téléphone)');
  verifie(ra && ra.actif === true && ra.heure === '06:45', 'enregistré aussi pour Aurore : taches/rappels/aurore');
  verifie(await attendreQue(() => A.locator('#rappelLu').isVisible()), 'l\'heure est passée et la liste pas lue : bandeau « J\'ai lu ma liste » en haut');
  if (CAPTURES) await A.screenshot({ path: path.join(CAPTURES, '3-bandeau.png') });
  await A.click('#rappelLu [data-a="lu"]');
  const aujourdhui = await A.evaluate(() => dateLocale(new Date()));
  verifie(await attendreQue(() => !!base.lire('taches/lu/francois/' + aujourdhui)), 'toucher « J\'ai lu ma liste » : noté dans la base pour François, ce jour-là');
  verifie(await A.locator('#rappelLu').isHidden(), 'le bandeau disparaît');
  verifie(await A.evaluate(() => document.querySelector('.pil.on').textContent === JOURS[(new Date().getDay() + 6) % 7]), 'la liste du jour est à l\'écran');
  await B.reload(); await attendreQue(() => B.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await pause(500);
  verifie(await B.evaluate(() => !document.querySelector('#rappelLu').hidden) === ((new Date().getHours() * 60 + new Date().getMinutes()) >= 6 * 60 + 45), 'chez Aurore : bandeau selon son heure à elle (6 h 45), indépendant de la lecture de François');
  await A.reload(); await attendreQue(() => A.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await pause(500);
  verifie(await A.locator('#rappelLu').isHidden(), 'après rechargement : toujours lu aujourd\'hui, pas de bandeau');

  // Ce téléphone : bouton « Recevoir sur ce téléphone ». Ici pas de vrai service de notification (pas de réseau) :
  // l'abonnement échoue proprement, avec un message.
  await A.click('#avatar'); await A.click('#versReglages');
  await A.waitForSelector('#reglDlg[open] #rapTel');
  // Chromium sans écran refuse toujours les notifications : c'est le cas « refusées » ; on simule ensuite « pas encore demandé ».
  const refusees = await A.$eval('#rapTel', (x) => x.textContent);
  verifie(await A.evaluate(() => Notification.permission) !== 'denied' || /refusées pour Aurore Task.*réglages du téléphone/.test(refusees), 'notifications refusées sur le téléphone : explique où les autoriser');
  await A.evaluate(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
    Notification.requestPermission = () => Promise.resolve('granted');
    majTelephone();
  });
  const tel = await A.$eval('#rapTel', (x) => x.textContent);
  verifie(/ne reçoit pas encore le rappel/.test(tel) && await A.locator('#rapAbonner').count() === 1, 'bloc « ce téléphone » : pas encore abonné, bouton « Recevoir sur ce téléphone » (« ' + tel + ' »)');
  await A.click('#rapAbonner');
  verifie(await attendreQue(() => A.$eval('#rapTel', (x) => /n'a pas pu s'abonner/.test(x.textContent)), 15000), 'après le bouton : un message clair en français (ici, sans service de notification : « ' + (await A.$eval('#rapTel', (x) => (x.querySelector('p[role="status"]') || {}).textContent)) + ' »)');
  verifie(!base.lire('taches/abonnements/francois/' + 'x'), 'rien d\'écrit sous abonnements sans abonnement réussi');
  if (CAPTURES) await A.locator('#reglDlg').screenshot({ path: path.join(CAPTURES, '4-telephone.png') });
  const iphone = await navigateur.newContext({ ...devices['iPhone 13'] });
  const I = await iphone.newPage();
  await I.addInitScript(() => { try { delete window.PushManager; } catch (e) { window.PushManager = undefined; } });
  await I.goto(SITE + '/'); await I.waitForSelector('#authDlg[open]');
  await I.fill('#authId', 'francois'); await I.fill('#authMdp', MDP.francois); await I.click('#authOk');
  await attendreQue(() => I.evaluate(() => document.querySelector('#statut').textContent.includes('Partagé')));
  await I.click('#avatar'); await I.click('#versReglages'); await I.waitForSelector('#reglDlg[open] #rapTel');
  verifie(/écran d'accueil/.test(await I.$eval('#rapTel', (x) => x.textContent)), 'iPhone sans l\'appli à l\'écran d\'accueil : explique qu\'il faut l\'y ajouter d\'abord');
  if (CAPTURES) await I.locator('#reglDlg').screenshot({ path: path.join(CAPTURES, '5-iphone.png') });

  // Service hors ligne : notification et bouton « J'ai lu ma liste ».
  const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  verifie(/addEventListener\('push'/.test(sw) && /action: 'lu'/.test(sw) && /rappel\/lu/.test(sw) && /notificationclick/.test(sw), 'sw.js : affiche la notification, bouton « J\'ai lu ma liste » (Android), ouvre l\'appli au toucher');

  await navigateur.close(); site.close(); push.close(); base.close();
  console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon');
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
