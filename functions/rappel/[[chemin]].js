// Rappel du matin (étape 45B) : un petit programme Cloudflare Pages (« Pages Function »), servi avec l'appli sous
// https://<site>/rappel/… seulement. Le reste du site ne passe jamais par ici.
//
// Toutes les 5 minutes, une horloge Cloudflare (cloudflare/horloge-rappel.js, un « Worker » à part) appelle
// POST /rappel/tic. Pour chaque personne dont le rappel est actif (taches/rappels/<personne>, réglé dans Réglages) :
// à l'heure dite, les jours cochés, le programme envoie la liste du jour en notification à ses téléphones
// (taches/abonnements/<personne>/…) ; tant que « J'ai lu ma liste » n'est pas touché (taches/lu/<personne>/<date>),
// il la renvoie toutes les « repete » minutes, jusqu'à l'heure « jusqua ». Appeler /rappel/tic plus souvent
// n'envoie rien de plus : tout dépend de l'heure et de ce qui est déjà envoyé (rappel/envois/<personne>).
//
// Notifications : standard « Web Push » (VAPID, contenu chiffré aes128gcm), sans bibliothèque. La paire de clés
// d'envoi est créée par le programme lui-même au premier besoin et gardée dans la base sous rappel/vapid, que seul
// le compte « rappel » lit : personne n'a de clé à copier.
//
// Le programme se connecte à la base avec le compte au profil « rappel », qui lit taches/, écrit taches/lu et
// taches/abonnements (téléphones qui n'existent plus), et lit et écrit rappel/. Rien d'autre.
//
// Réglages, saisis par la ferme dans Cloudflare (Paramètres du projet, Variables et secrets) ; jamais dans le dépôt :
//   RAPPEL_MDP     (secret, obligatoire) mot de passe du compte « rappel » de Firebase.
//   RAPPEL_COMPTE  (facultatif) identifiant du compte, « rappel » par défaut (complété par « @ferme.invalid »).
//   CLE_WEB, DB_URL (facultatifs) : sinon lus dans cle-web.js et config.js du site, comme l'appli.
//   AUTH_URL       (essais seulement) adresse de Firebase Authentication.
//   PUSH_HTTP      (essais seulement) « oui » : accepte un service de notification en http (faux serveur local).
// Appels :
//   GET  /rappel/etat   le programme est-il prêt ? (sans détail privé)
//   GET  /rappel/cle    clé publique d'envoi (l'appli en a besoin pour abonner un téléphone)
//   POST /rappel/tic    envoie ce qui est dû (appelé par l'horloge)
//   POST /rappel/essai  {endpoint} : envoie tout de suite la liste du jour à ce téléphone (s'il est abonné)
//   POST /rappel/lu     {endpoint} : « J'ai lu ma liste » touché sous la notification (Android)
// Rien de propre à une ferme ici : personnes, heures et listes viennent de la base.

const DOMAINE_COMPTES = 'ferme.invalid';
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MAX_LIGNES = 8;
const PREMIER_ENVOI_MAX = 120; // minutes après l'heure du rappel où le premier envoi part encore (horloge en retard)
const MAX_CORPS = 4096;

// Mémoire de l'instance (Cloudflare la garde quelques minutes) : jeton du compte, fichiers du site, clés, essais.
const memo = { jeton: null, fin: 0, fichiers: {}, vapid: null, essais: {}, tic: 0 };

function texte(corps, statut) {
  return new Response(corps + '\n', { status: statut || 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
class Refus extends Error { constructor(statut, msg) { super(msg); this.statut = statut; } }

// ---------- Base64 « url » et octets ----------
export function b64u(octets) {
  let s = ''; const u = new Uint8Array(octets);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deB64u(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const b = atob(s), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0), r = new Uint8Array(n); let i = 0;
  for (const p of parts) { r.set(p, i); i += p.length; }
  return r;
}
const enc = (s) => new TextEncoder().encode(s);

// ---------- Heure locale d'une personne (son fuseau, réglé par son téléphone) ----------
export function ici(fuseau, quand) {
  let f;
  try { f = new Intl.DateTimeFormat('en-GB', { timeZone: fuseau || 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }); }
  catch (e) { f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }); }
  const p = {}; f.formatToParts(new Date(quand)).forEach((x) => { p[x.type] = x.value; });
  const jour = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, jour };
}
const minutes = (hm) => { const m = /^(\d\d):(\d\d)$/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; };

// Réglage d'une personne, avec les valeurs par défaut de l'appli.
export function reglage(r) {
  r = r || {};
  const rep = [0, 5, 10, 15, 30].includes(Number(r.repete)) ? Number(r.repete) : (r.repete == null ? 10 : 0);
  return { actif: !!r.actif, heure: minutes(r.heure) != null ? r.heure : '07:30', jours: String(r.jours == null ? '012345' : r.jours),
    repete: rep, jusqua: minutes(r.jusqua) != null ? r.jusqua : '09:00', fuseau: String(r.fuseau || 'Europe/Paris') };
}

// Ce qui est dû maintenant pour une personne : null (rien), 'premier' ou 'rappel'.
export function du(r, h, lu, envoi, maintenant) {
  if (!r.actif || !r.jours.includes(String(h.jour)) || lu) return null;
  const m = minutes(h.hm), deb = minutes(r.heure), fin = Math.max(minutes(r.jusqua), deb);
  if (m < deb) return null;
  if (!envoi || envoi.date !== h.date) return (m - deb <= PREMIER_ENVOI_MAX || m <= fin) ? 'premier' : null;
  if (!r.repete || m > fin) return null;
  return maintenant - Number(envoi.at || 0) >= r.repete * 60000 - 45000 ? 'rappel' : null;
}

// ---------- La liste du jour d'une personne (ses tâches et celles de tout le monde) ----------
export function listeDuJour(taches, jour, pid, reglages) {
  const listes = (taches && taches.listes) || {}, t = (taches && taches.t) || {};
  const L = Object.keys(listes).find((k) => listes[k] && listes[k].type === 'jour' && Number(listes[k].jour) === jour);
  if (!L) return { nom: JOURS[jour], lignes: [] };
  const encarts = (listes[L].encarts && typeof listes[L].encarts === 'object') ? listes[L].encarts : {};
  const noms = Object.assign({ rdv: 'RDV', p1: 'P1', p2: 'P2' }, (reglages && reglages.encarts) || {});
  const rang = { rdv: 1, p1: 2, p2: 3 };
  const racines = Object.keys(t).map((id) => Object.assign({ id }, t[id])).filter((x) => x && x.liste === L && !x.sep && String(x.texte || '').trim() &&
    !(x.parent && t[x.parent] && t[x.parent].liste === L) && (!x.pour || x.pour === pid));
  racines.forEach((x) => { x.e = x.encart && encarts[x.encart] ? x.encart : ''; });
  racines.sort((a, b) => (rang[a.e] || 0) - (rang[b.e] || 0) ||
    (a.e === 'rdv' ? String(a.heure || '99:99').localeCompare(String(b.heure || '99:99')) : 0) ||
    (Number(a.ordre) || 0) - (Number(b.ordre) || 0) || (Number(a.at) || 0) - (Number(b.at) || 0));
  return { nom: String(listes[L].nom || JOURS[jour]), lignes: racines.map((x) => (x.e === 'rdv' && /^\d\d:\d\d$/.test(x.heure || '') ? x.heure.replace(':', ' h ') + ' · ' : (x.e === 'rdv' ? noms.rdv + ' · ' : '')) + String(x.texte).replace(/\s+/g, ' ').trim()) };
}
export function message(liste, rappel, essai) {
  const l = liste.lignes, vus = l.slice(0, MAX_LIGNES).map((x) => '• ' + (x.length > 70 ? x.slice(0, 69) + '…' : x));
  if (l.length > MAX_LIGNES) vus.push(`… et ${l.length - MAX_LIGNES} autre${l.length - MAX_LIGNES > 1 ? 's' : ''}`);
  return {
    titre: (essai ? 'Essai · ' : rappel ? 'Pas encore lue · ' : '') + liste.nom + (l.length ? ` : ${l.length} tâche${l.length > 1 ? 's' : ''}` : ''),
    texte: vus.length ? vus.join('\n') : 'Rien dans la liste du jour.',
    tag: 'rappel', url: './?rappel=1', essai: !!essai,
  };
}

// ---------- Web Push : signature VAPID (RFC 8292) et chiffrement aes128gcm (RFC 8291) ----------
async function hmac(cle, donnees) {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees));
}
export async function chiffrer(contenu, p256dh, auth, essai) {
  const uaPub = deB64u(p256dh), secret = deB64u(auth);
  const paire = essai && essai.paire ? essai.paire : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));
  const uaCle = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaCle }, paire.privateKey, 256));
  const prkCle = await hmac(secret, partage);
  const ikm = await hmac(prkCle, concat(enc('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const sel = essai && essai.sel ? essai.sel : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sel, ikm);
  const cek = (await hmac(prk, concat(enc('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, concat(enc(contenu), new Uint8Array([2]))));
  const entete = new Uint8Array(21); entete.set(sel, 0); new DataView(entete.buffer).setUint32(16, 4096); entete[20] = asPub.length;
  return concat(entete, asPub, chiffre);
}
async function jetonVapid(vapid, endpoint, sujet) {
  const aud = new URL(endpoint).origin;
  const tete = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sujet })));
  const k = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc(tete + '.' + corps)));
  return `vapid t=${tete}.${corps}.${b64u(sig)}, k=${vapid.publique}`;
}
// Envoie une notification à un téléphone. Renvoie le statut du service de notification (201 = remis ; 404/410 = abonnement mort).
export async function pousser(abo, contenu, vapid, sujet) {
  const corps = await chiffrer(JSON.stringify(contenu), abo.cles.p256dh, abo.cles.auth);
  const r = await fetch(abo.endpoint, { method: 'POST', headers: {
    Authorization: await jetonVapid(vapid, abo.endpoint, sujet), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
    TTL: '3600', Urgency: 'high', Topic: 'rappel' }, body: corps });
  return r.status;
}

// ---------- Base (compte « rappel ») ----------
async function fichier(env, url, chemin) {
  const m = memo.fichiers[chemin];
  if (m && Date.now() - m.t < 10 * 60 * 1000) return m.v;
  if (!env.ASSETS) throw new Refus(503, 'ERREUR programme mal installé (fichiers du site illisibles)');
  const r = await env.ASSETS.fetch(new URL(chemin, url));
  if (!r.ok) throw new Refus(503, 'ERREUR fichier du site illisible : ' + chemin);
  const v = await r.text(); memo.fichiers[chemin] = { t: Date.now(), v };
  return v;
}
// Dernière valeur non vide de « window.NOM = '…' » dans un fichier du site (cle-web.js, config.js).
function valeurDe(src, nom) {
  const re = new RegExp('window\\.' + nom + "\\s*=\\s*['\"]([^'\"]+)['\"]", 'g'); let m, v = '';
  while ((m = re.exec(src))) v = m[1];
  return v.trim();
}
async function base(env, url) {
  const cleWeb = env.CLE_WEB || valeurDe(await fichier(env, url, '/cle-web.js'), 'RECOLTE_CLE_WEB');
  const db = (env.DB_URL || valeurDe(await fichier(env, url, '/config.js'), 'RECOLTE_DB_URL')).replace(/\/+$/, '');
  if (!cleWeb || !db) throw new Refus(503, 'ERREUR site pas encore relié à sa base (clé web ou adresse de la base absente)');
  if (!memo.jeton || memo.fin - Date.now() < 5 * 60 * 1000) {
    const id = String(env.RAPPEL_COMPTE || 'rappel').trim();
    const email = id.includes('@') ? id : id.toLowerCase() + '@' + DOMAINE_COMPTES;
    const auth = (env.AUTH_URL || 'https://identitytoolkit.googleapis.com').replace(/\/+$/, '');
    const r = await fetch(`${auth}/v1/accounts:signInWithPassword?key=${encodeURIComponent(cleWeb)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: env.RAPPEL_MDP, returnSecureToken: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.idToken) throw new Refus(503, 'ERREUR le compte « rappel » ne se connecte pas (' + String((j.error && j.error.message) || r.status) + ')');
    memo.jeton = j.idToken; memo.fin = Date.now() + (Number(j.expiresIn) || 3600) * 1000;
  }
  const u = (chemin, q) => { const x = new URL(db + '/' + chemin + '.json'); x.searchParams.set('auth', memo.jeton); if (q) Object.keys(q).forEach((k) => x.searchParams.set(k, q[k])); return x.href; };
  const lit = async (chemin) => { const r = await fetch(u(chemin)); if (!r.ok) throw new Refus(503, `ERREUR la base refuse la lecture de ${chemin} (${r.status})`); return r.json(); };
  const ecrit = async (chemin, v, methode) => { const r = await fetch(u(chemin), { method: methode || 'PUT', body: JSON.stringify(v) }); if (!r.ok) throw new Refus(503, `ERREUR la base refuse l'écriture de ${chemin} (${r.status})`); };
  return { lit, ecrit, efface: async (chemin) => { const r = await fetch(u(chemin), { method: 'DELETE' }); return r.ok; } };
}
// Paire de clés d'envoi : lue dans rappel/vapid, créée au premier besoin.
async function cles(b) {
  if (memo.vapid) return memo.vapid;
  let v = await b.lit('rappel/vapid');
  if (!v || !v.jwk || !v.publique) {
    const p = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', p.privateKey);
    v = { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }, publique: b64u(await crypto.subtle.exportKey('raw', p.publicKey)), at: Date.now() };
    await b.ecrit('rappel/vapid', v);
    v = (await b.lit('rappel/vapid')) || v; // deux appels en même temps : celle qui reste dans la base gagne
  }
  memo.vapid = v; return v;
}
let httpPermis = false;
function abonnementsDe(abos) {
  const r = [];
  Object.keys(abos || {}).forEach((pid) => Object.keys(abos[pid] || {}).forEach((n) => {
    const a = abos[pid][n];
    if (a && (httpPermis ? /^https?:\/\//.test(a.endpoint || '') : /^https:\/\//.test(a.endpoint || '')) && a.cles && a.cles.p256dh && a.cles.auth) r.push({ pid, n, endpoint: a.endpoint, cles: a.cles });
  }));
  return r;
}
async function envoyerA(b, liste, contenu, vapid, sujet) {
  let remis = 0, morts = 0, refus = 0;
  for (const a of liste) {
    let s = 0;
    try { s = await pousser(a, contenu, vapid, sujet); } catch (e) { s = 0; }
    if (s >= 200 && s < 300) remis++;
    else if (s === 404 || s === 410) { morts++; await b.efface(`taches/abonnements/${a.pid}/${a.n}`); }
    else refus++;
  }
  return { remis, morts, refus };
}

// ---------- Appels ----------
async function tic(env, url, maintenant) {
  const b = await base(env, url);
  const [rappels, lus, abos, envois] = await Promise.all([b.lit('taches/rappels'), b.lit('taches/lu'), b.lit('taches/abonnements'), b.lit('rappel/envois')]);
  const tous = abonnementsDe(abos), lignes = [];
  let taches = null, vapid = null;
  for (const pid of Object.keys(rappels || {})) {
    const r = reglage(rappels[pid]), h = ici(r.fuseau, maintenant);
    const quoi = du(r, h, !!(lus && lus[pid] && lus[pid][h.date]), envois && envois[pid], maintenant);
    const siens = tous.filter((a) => a.pid === pid);
    if (!quoi || !siens.length) continue;
    if (!taches) { const [listes, t, regl] = await Promise.all([b.lit('taches/listes'), b.lit('taches/t'), b.lit('taches/reglages')]); taches = { listes, t, reglages: regl }; }
    if (!vapid) vapid = await cles(b);
    const res = await envoyerA(b, siens, message(listeDuJour(taches, h.jour, pid, taches.reglages), quoi === 'rappel'), vapid, url.origin);
    const n = envois && envois[pid] && envois[pid].date === h.date ? (Number(envois[pid].n) || 0) + 1 : 1;
    await b.ecrit(`rappel/envois/${pid}`, { date: h.date, at: maintenant, n });
    lignes.push(`${pid} : ${quoi === 'premier' ? 'premier envoi' : 'rappel n° ' + n}, ${res.remis} remis${res.morts ? `, ${res.morts} téléphone(s) disparu(s)` : ''}${res.refus ? `, ${res.refus} refusé(s)` : ''}`);
  }
  return texte('OK ' + (lignes.length ? lignes.join(' ; ') : 'rien à envoyer'));
}
async function corpsJson(request) {
  const t = await request.text();
  if (t.length > MAX_CORPS) throw new Refus(413, 'ERREUR message trop long');
  try { return JSON.parse(t || '{}'); } catch (e) { throw new Refus(400, 'ERREUR message illisible'); }
}
async function trouver(b, endpoint) {
  if (!/^https?:\/\//.test(String(endpoint || ''))) throw new Refus(400, 'ERREUR téléphone inconnu');
  const a = abonnementsDe(await b.lit('taches/abonnements')).find((x) => x.endpoint === endpoint);
  if (!a) throw new Refus(404, 'ERREUR ce téléphone n\'est pas abonné : touchez « Recevoir sur ce téléphone »');
  return a;
}
async function essai(env, url, request, maintenant) {
  const { endpoint } = await corpsJson(request);
  const b = await base(env, url), a = await trouver(b, endpoint);
  if (memo.essais[endpoint] && maintenant - memo.essais[endpoint] < 30000) return texte('ERREUR un essai vient de partir : attendre 30 secondes', 429);
  memo.essais[endpoint] = maintenant;
  const [rappels, listes, t, regl] = await Promise.all([b.lit('taches/rappels'), b.lit('taches/listes'), b.lit('taches/t'), b.lit('taches/reglages')]);
  const h = ici(reglage(rappels && rappels[a.pid]).fuseau, maintenant);
  const res = await envoyerA(b, [a], message(listeDuJour({ listes, t }, h.jour, a.pid, regl), false, true), await cles(b), url.origin);
  if (res.remis) return texte('OK Essai envoyé : la notification arrive dans quelques secondes.');
  if (res.morts) return texte('ERREUR ce téléphone n\'est plus abonné : touchez « Recevoir sur ce téléphone »', 410);
  return texte('ERREUR le service de notification du téléphone a refusé l\'envoi', 502);
}
async function lu(env, url, request, maintenant) {
  const { endpoint } = await corpsJson(request);
  const b = await base(env, url), a = await trouver(b, endpoint);
  const r = reglage(await b.lit(`taches/rappels/${a.pid}`)), h = ici(r.fuseau, maintenant);
  await b.ecrit(`taches/lu/${a.pid}/${h.date}`, { at: maintenant, par: 'notification' });
  return texte('OK lu');
}
async function etat(env, url) {
  const l = [];
  l.push('réglage Cloudflare RAPPEL_MDP : ' + (env.RAPPEL_MDP ? 'saisi' : 'manquant'));
  if (!env.RAPPEL_MDP) return texte(l.join('\n') + '\nRAPPEL PAS PRÊT');
  try {
    const b = await base(env, url);
    l.push('compte « rappel » : connecté');
    const v = await cles(b);
    l.push('clés d\'envoi : ' + (v && v.publique ? 'prêtes' : 'absentes'));
    const n = abonnementsDe(await b.lit('taches/abonnements')).length;
    l.push(`téléphones abonnés : ${n}`);
    l.push('RAPPEL PRÊT');
  } catch (e) { l.push(e.message || String(e)); l.push('RAPPEL PAS PRÊT'); }
  return texte(l.join('\n'));
}

export async function onRequest(context) {
  const { request, env } = context;
  httpPermis = env.PUSH_HTTP === 'oui';
  const url = new URL(request.url), chemin = url.pathname.replace(/^\/rappel\/?/, '').replace(/\/+$/, ''), maintenant = Date.now();
  try {
    if (chemin === 'etat' && request.method === 'GET') return await etat(env, url);
    if (!env.RAPPEL_MDP) return texte('ERREUR rappel pas encore installé : la ferme n\'a pas saisi ses réglages dans Cloudflare', 503);
    if (chemin === 'cle' && request.method === 'GET') { const v = await cles(await base(env, url)); return texte(v.publique); }
    if (request.method !== 'POST') return texte('ERREUR appel inconnu', 404);
    if (chemin === 'tic') {
      if (maintenant - memo.tic < 50000) return texte('OK déjà fait il y a moins d\'une minute');
      memo.tic = maintenant;
      return await tic(env, url, maintenant);
    }
    if (chemin === 'essai') return await essai(env, url, request, maintenant);
    if (chemin === 'lu') return await lu(env, url, request, maintenant);
    return texte('ERREUR appel inconnu', 404);
  } catch (e) {
    if (e instanceof Refus) return texte(e.message, e.statut);
    return texte('ERREUR ' + (e && e.message ? e.message : String(e)), 500);
  }
}
