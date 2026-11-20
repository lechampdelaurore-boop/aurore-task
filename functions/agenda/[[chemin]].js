// Google Agenda (étape 36D) : un petit programme Cloudflare Pages (« Pages Function »), servi avec l'appli sous
// https://<site>/agenda/… seulement. Le reste du site ne passe jamais par ici.
//
// Google donne à chaque agenda une « adresse secrète au format iCal » (un lien privé qui contient ses rendez-vous).
// Ce programme lit ce lien et renvoie à l'appli les rendez-vous des 7 jours qui suivent (à partir du lendemain),
// seulement à un compte de la ferme connecté (profil qui ouvre les tâches). Lecture seule : rien n'est jamais
// écrit dans l'agenda, ni dans la base par ce programme. C'est l'appli qui range les rendez-vous dans les encarts
// RDV, quand on touche « Mettre à jour les rendez-vous » (jamais tout seul).
//
// Réglages, saisis par la ferme dans Cloudflare (Paramètres du projet, Variables et secrets) ; jamais dans le dépôt :
//   AGENDA_ICAL  (secret, obligatoire) l'adresse secrète iCal de l'agenda. Plusieurs agendas : plusieurs adresses
//                séparées par un espace ou un retour à la ligne.
//   DB_URL       (facultatif) adresse de la base : sinon lue dans config.js du site, comme l'appli.
// Appels :
//   GET /agenda/etat                      le programme est-il prêt ? (sans détail privé, jamais l'adresse)
//   GET /agenda/semaine?fuseau=Europe/Paris   (en-tête Authorization: Bearer <jeton de connexion de l'appli>)
//       → {de, a, rdv: [{k, date, jour, heure, titre}]}   de : demain ; a : le jour après le 7e (non compris) ;
//         k : clé stable de ce rendez-vous ce jour-là ; jour : 0 = lundi … 6 = dimanche ; heure : 'HH:MM' ou null
//         (journée entière).
// Rien de propre à une ferme ici : l'agenda vient du réglage, le fuseau de l'appareil.

const JOURS_PAR_DEFAUT = 7;
const MAX_TITRE = 200;
const MAX_ICAL = 5 * 1024 * 1024;
const memo = { fichiers: {}, acces: {} };

function json(obj, statut) {
  return new Response(JSON.stringify(obj), { status: statut || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
function texte(corps, statut) {
  return new Response(corps + '\n', { status: statut || 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
class Refus extends Error { constructor(statut, msg) { super(msg); this.statut = statut; } }

// ---------- Dates « murales » (jour et heure sans fuseau) ----------
const p2 = (n) => String(n).padStart(2, '0');
export function jourTexte(y, m, d) { return y + '-' + p2(m) + '-' + p2(d); }
function jourNum(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; } // n° de jour
function deNum(n) { const t = new Date(n * 864e5); return jourTexte(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
function jourSemaine(s) { return (new Date(jourNum(s) * 864e5).getUTCDay() + 6) % 7; } // 0 = lundi
function fuseauValide(f) { try { new Intl.DateTimeFormat('fr', { timeZone: f }); return true; } catch (e) { return false; } }

// Jour et heure qu'affiche une montre dans ce fuseau à l'instant t (ms).
export function ici(fuseau, t) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
  return { date: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute, y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
// Instant (ms) où une montre de ce fuseau affiche ce jour et cette heure (heure d'été comprise).
export function instant(fuseau, y, m, d, h, mi, s) {
  const voulu = Date.UTC(y, m - 1, d, h, mi, s || 0);
  let t = voulu;
  for (let i = 0; i < 3; i++) {
    const v = ici(fuseau, t), vu = Date.UTC(v.y, v.m - 1, v.d, v.h, v.mi, v.s);
    if (vu === voulu) break;
    t += voulu - vu;
  }
  return t;
}

// ---------- Lecture du format iCal (RFC 5545), le nécessaire pour Google Agenda ----------
function deplier(src) { return String(src).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n'); }
function ligne(l) {
  // NOM;PARAM=VAL;PARAM="V:AL":valeur  (les deux-points entre guillemets ne coupent pas)
  let i = 0, guil = false;
  for (; i < l.length; i++) { const c = l[i]; if (c === '"') guil = !guil; else if (c === ':' && !guil) break; }
  if (i >= l.length) return null;
  const tete = l.slice(0, i).split(';'), params = {};
  tete.slice(1).forEach((p) => { const j = p.indexOf('='); if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, ''); });
  return { nom: tete[0].toUpperCase(), params, valeur: l.slice(i + 1) };
}
function texteIcal(v) { return String(v).replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim(); }

// Une date iCal : {jour:'AAAA-MM-JJ', h, mi, s, entier (journée entière), utc (finit par Z), tz}
export function dateIcal(valeur, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(valeur).trim());
  if (!m) return null;
  const entier = !m[4] || (params && params.VALUE === 'DATE');
  return { jour: m[1] + '-' + m[2] + '-' + m[3], h: entier ? 0 : +m[4], mi: entier ? 0 : +m[5], s: entier ? 0 : +(m[6] || 0), entier, utc: !!m[7], tz: params && params.TZID ? params.TZID : null };
}
// Instant (ms) d'une date iCal non entière ; fuseau de secours si le fuseau donné n'est pas connu.
function instantDe(dt, secours) {
  const [y, m, d] = dt.jour.split('-').map(Number);
  if (dt.utc) return Date.UTC(y, m - 1, d, dt.h, dt.mi, dt.s);
  const f = dt.tz && fuseauValide(dt.tz) ? dt.tz : secours;
  return instant(f, y, m, d, dt.h, dt.mi, dt.s);
}

export function lireIcal(src) {
  const evts = []; let cur = null, prof = 0;
  for (const l of deplier(src)) {
    if (!l) continue;
    const up = l.toUpperCase();
    if (up === 'BEGIN:VEVENT') { cur = { exdates: [] }; prof = 0; continue; }
    if (!cur) continue;
    if (up.startsWith('BEGIN:')) { prof++; continue; } // VALARM… : ignoré
    if (up.startsWith('END:')) { if (prof > 0) { prof--; continue; } if (up === 'END:VEVENT') { evts.push(cur); cur = null; } continue; }
    if (prof > 0) continue;
    const p = ligne(l); if (!p) continue;
    if (p.nom === 'UID') cur.uid = p.valeur.trim();
    else if (p.nom === 'SUMMARY') cur.titre = texteIcal(p.valeur);
    else if (p.nom === 'DTSTART') cur.debut = dateIcal(p.valeur, p.params);
    else if (p.nom === 'DTEND') cur.fin = dateIcal(p.valeur, p.params);
    else if (p.nom === 'DURATION') cur.duree = p.valeur.trim();
    else if (p.nom === 'RRULE') cur.rrule = regle(p.valeur);
    else if (p.nom === 'EXDATE') p.valeur.split(',').forEach((v) => { const d = dateIcal(v, p.params); if (d) cur.exdates.push(d); });
    else if (p.nom === 'RECURRENCE-ID') cur.recid = dateIcal(p.valeur, p.params);
    else if (p.nom === 'STATUS') cur.annule = p.valeur.trim().toUpperCase() === 'CANCELLED';
  }
  return evts.filter((e) => e.debut);
}

const JOURS_ICAL = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
function regle(v) {
  const r = {};
  v.split(';').forEach((x) => { const i = x.indexOf('='); if (i > 0) r[x.slice(0, i).toUpperCase()] = x.slice(i + 1).toUpperCase(); });
  const o = { freq: r.FREQ, intervalle: Math.max(1, parseInt(r.INTERVAL, 10) || 1), nombre: r.COUNT ? parseInt(r.COUNT, 10) : null,
    jusqua: r.UNTIL ? dateIcal(r.UNTIL, {}) : null, wkst: Math.max(0, JOURS_ICAL.indexOf(r.WKST || 'MO')) };
  o.parJour = r.BYDAY ? r.BYDAY.split(',').map((x) => { const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(x); return m ? { n: m[1] ? parseInt(m[1], 10) : 0, j: JOURS_ICAL.indexOf(m[2]) } : null; }).filter(Boolean) : null;
  o.parJourMois = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map((x) => parseInt(x, 10)).filter((n) => n) : null;
  o.parMois = r.BYMONTH ? r.BYMONTH.split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 12) : null;
  return o;
}
// Le jour s (AAAA-MM-JJ) est-il le n-ième (n > 0) ou le n-ième en partant de la fin (n < 0) jour j de son mois ?
function nieme(s, n, j) {
  if (jourSemaine(s) !== j) return false;
  const d = +s.slice(8, 10), y = +s.slice(0, 4), m = +s.slice(5, 7), dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (n > 0) return Math.ceil(d / 7) === n;
  return Math.ceil((dernier - d + 1) / 7) === -n;
}
function convient(r, debut, s) {
  const d0 = jourNum(debut), d = jourNum(s);
  const y0 = +debut.slice(0, 4), m0 = +debut.slice(5, 7), j0 = +debut.slice(8, 10);
  const y = +s.slice(0, 4), m = +s.slice(5, 7), j = +s.slice(8, 10);
  const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const jourMois = (liste) => liste.some((n) => (n > 0 ? j === n : j === dernier + n + 1));
  if (r.parMois && r.parMois.indexOf(m) < 0) return false;
  if (r.freq === 'DAILY') {
    if ((d - d0) % r.intervalle) return false;
    if (r.parJour && !r.parJour.some((x) => x.j === jourSemaine(s))) return false;
    return !r.parJourMois || jourMois(r.parJourMois);
  }
  if (r.freq === 'WEEKLY') {
    const semaine = (n) => Math.floor((n - ((jourSemaine(deNum(n)) - r.wkst + 7) % 7)) / 7);
    if ((semaine(d) - semaine(d0)) % r.intervalle) return false;
    const js = r.parJour ? r.parJour.map((x) => x.j) : [jourSemaine(debut)];
    return js.indexOf(jourSemaine(s)) >= 0;
  }
  if (r.freq === 'MONTHLY') {
    if (((y - y0) * 12 + (m - m0)) % r.intervalle) return false;
    if (r.parJour) return r.parJour.some((x) => (x.n ? nieme(s, x.n, x.j) : jourSemaine(s) === x.j)) && (!r.parJourMois || jourMois(r.parJourMois));
    if (r.parJourMois) return jourMois(r.parJourMois);
    return j === j0;
  }
  if (r.freq === 'YEARLY') {
    if ((y - y0) % r.intervalle) return false;
    if (r.parJour) {
      if (!r.parMois) return false; // « le n-ième lundi de l'année » : pas utilisé par Google Agenda
      return r.parJour.some((x) => (x.n ? nieme(s, x.n, x.j) : jourSemaine(s) === x.j));
    }
    if (r.parJourMois) return (r.parMois || [m0]).indexOf(m) >= 0 && jourMois(r.parJourMois);
    return m === (r.parMois ? m : m0) && j === j0;
  }
  return false;
}

// Clé stable d'un rendez-vous ce jour-là, permise dans la base (pas de . # $ [ ] /).
export function cle(uid, jour) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = String(uid);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'g' + (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + '_' + jour.replace(/-/g, '');
}

// Les rendez-vous des jours [de, a[ (AAAA-MM-JJ, a non compris), dans le fuseau donné.
export function rendezVous(evts, de, a, fuseau) {
  const nDe = jourNum(de), nA = jourNum(a), sortie = [], vus = {};
  const remplaces = {}; // uid → { jour d'origine: true } : occurrences remplacées par une version modifiée
  evts.forEach((e) => { if (e.recid && e.uid) (remplaces[e.uid] = remplaces[e.uid] || {})[e.recid.jour] = true; });

  function ajouter(e, debutOcc, jourOrigine) {
    if (e.annule) return;
    const titre = (e.titre || '(Sans titre)').slice(0, MAX_TITRE), uid = e.uid || (e.titre + '|' + e.debut.jour);
    if (debutOcc.entier) {
      // Journée entière : chaque jour couvert (fin non comprise), dans la fenêtre.
      let n0 = jourNum(debutOcc.jour), n1 = n0 + 1;
      if (e.fin && e.fin.entier) n1 = Math.max(n0 + 1, n0 + (jourNum(e.fin.jour) - jourNum(e.debut.jour)));
      for (let n = Math.max(n0, nDe); n < Math.min(n1, nA); n++) {
        const k = cle(uid, jourOrigine) + (n === n0 ? '' : '_' + (n - n0));
        if (!vus[k]) { vus[k] = 1; sortie.push({ k, date: deNum(n), jour: jourSemaine(deNum(n)), heure: null, titre }); }
      }
      return;
    }
    const t = instantDe(debutOcc, fuseau), v = ici(fuseau, t), n = jourNum(v.date);
    if (n < nDe || n >= nA) return;
    const k = cle(uid, jourOrigine);
    if (!vus[k]) { vus[k] = 1; sortie.push({ k, date: v.date, jour: jourSemaine(v.date), heure: v.hm, titre }); }
  }

  evts.forEach((e) => {
    if (e.recid) { ajouter(e, e.debut, e.recid.jour); return; } // occurrence modifiée d'un rendez-vous répété
    if (!e.rrule || !e.rrule.freq) { ajouter(e, e.debut, e.debut.jour); return; }
    if (e.annule) return;
    const r = e.rrule, exclus = {}, rempl = (e.uid && remplaces[e.uid]) || {};
    e.exdates.forEach((x) => { exclus[x.jour] = true; });
    const fin = r.jusqua ? (r.jusqua.utc && !e.debut.entier ? r.jusqua : null) : null;
    const tFin = fin ? instantDe(fin, fuseau) : null, jFin = r.jusqua ? r.jusqua.jour : null;
    // Jour par jour depuis le début (un jour de marge : un fuseau peut décaler d'un jour), en comptant pour COUNT.
    const n0 = jourNum(e.debut.jour), nMax = nA + 1;
    let compte = 0;
    for (let n = n0; n <= nMax; n++) {
      const s = deNum(n);
      if (n !== n0 && !convient(r, e.debut.jour, s)) continue; // le jour du début compte toujours (RFC 5545)
      const occ = Object.assign({}, e.debut, { jour: s });
      if (jFin) {
        if (tFin !== null) { if (instantDe(occ, fuseau) > tFin) break; } else if (s > jFin) break;
      }
      compte++;
      if (r.nombre && compte > r.nombre) break;
      if (exclus[s] || rempl[s]) continue;
      if (n >= nDe - 1) ajouter(e, occ, s);
    }
  });
  return sortie.sort((x, y) => (x.date + (x.heure || '')).localeCompare(y.date + (y.heure || '')));
}

// ---------- Fichiers du site et accès ----------
async function fichier(env, url, chemin) {
  const m = memo.fichiers[chemin];
  if (m && Date.now() - m.t < 10 * 60 * 1000) return m.v;
  if (!env.ASSETS) throw new Refus(503, 'programme mal installé (fichiers du site illisibles)');
  const r = await env.ASSETS.fetch(new URL(chemin, url));
  if (!r.ok) throw new Refus(503, 'fichier du site illisible : ' + chemin);
  const v = await r.text(); memo.fichiers[chemin] = { t: Date.now(), v };
  return v;
}
function valeurDe(src, nom) {
  const re = new RegExp('window\\.' + nom + "\\s*=\\s*['\"]([^'\"]+)['\"]", 'g'); let m, v = '';
  while ((m = re.exec(src))) v = m[1];
  return v.trim();
}
async function baseUrl(env, url) {
  const db = (env.DB_URL || valeurDe(await fichier(env, url, '/config.js'), 'RECOLTE_DB_URL')).replace(/\/+$/, '');
  if (!db) throw new Refus(503, 'site pas encore relié à sa base');
  return db;
}
// Le jeton de l'appli ouvre-t-il les tâches ? (la règle de la base décide : profils qui ouvrent taches/)
async function verifierAcces(env, url, jeton) {
  if (!jeton || jeton.length > 4096) throw new Refus(401, 'connexion demandée');
  const m = memo.acces[jeton];
  if (m && Date.now() - m < 5 * 60 * 1000) return;
  const db = await baseUrl(env, url);
  const r = await fetch(db + '/taches/listes.json?shallow=true&auth=' + encodeURIComponent(jeton), { cache: 'no-store' }).catch(() => null);
  if (!r) throw new Refus(503, 'base injoignable');
  if (r.status === 401 || r.status === 403) throw new Refus(403, 'ce compte n\'ouvre pas les tâches');
  if (!r.ok) throw new Refus(503, 'base injoignable (' + r.status + ')');
  memo.acces[jeton] = Date.now();
}
function adresses(env) {
  return String(env.AGENDA_ICAL || '').split(/\s+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)).slice(0, 5)
    .map((x) => x.replace(/^webcal:\/\//i, 'https://'));
}
async function lireAgendas(env) {
  const liste = adresses(env), evts = [];
  if (!liste.length) throw new Refus(503, 'agenda pas encore réglé (AGENDA_ICAL)');
  for (let i = 0; i < liste.length; i++) {
    // L'adresse est secrète : jamais renvoyée ni écrite dans un message.
    const r = await fetch(liste[i], { headers: { Accept: 'text/calendar' }, cf: { cacheTtl: 0 } }).catch(() => null);
    if (!r || !r.ok) throw new Refus(502, 'agenda n° ' + (i + 1) + ' illisible' + (r ? ' (' + r.status + ')' : '') + ' : vérifier l\'adresse secrète');
    const t = await r.text();
    if (t.length > MAX_ICAL) throw new Refus(502, 'agenda n° ' + (i + 1) + ' trop gros');
    if (!/BEGIN:VCALENDAR/i.test(t)) throw new Refus(502, 'agenda n° ' + (i + 1) + ' : ce n\'est pas une adresse au format iCal');
    lireIcal(t).forEach((e) => { if (liste.length > 1 && e.uid) e.uid = i + ':' + e.uid; evts.push(e); });
  }
  return evts;
}

export async function onRequest(ctx) {
  const { request, env } = ctx, url = new URL(request.url);
  const chemin = url.pathname.replace(/^\/agenda\/?/, '').replace(/\/+$/, '');
  try {
    if (chemin === 'etat' && request.method === 'GET') {
      const n = adresses(env).length;
      return texte('réglage Cloudflare AGENDA_ICAL : ' + (n ? 'saisi (' + n + ' agenda' + (n > 1 ? 's' : '') + ')' : 'manquant') + '\n' + (n ? 'AGENDA PRÊT' : 'AGENDA PAS PRÊT'));
    }
    if (chemin === 'semaine' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      await verifierAcces(env, url, auth.replace(/^Bearer\s+/i, '').trim());
      const f = url.searchParams.get('fuseau') || 'Europe/Paris', fuseau = fuseauValide(f) ? f : 'Europe/Paris';
      const nb = Math.min(14, Math.max(1, parseInt(url.searchParams.get('jours'), 10) || JOURS_PAR_DEFAUT));
      const auj = ici(fuseau, Date.now()).date, de = deNum(jourNum(auj) + 1), a = deNum(jourNum(auj) + 1 + nb);
      const rdv = rendezVous(await lireAgendas(env), de, a, fuseau);
      return json({ de, a, fuseau, rdv });
    }
    return texte('inconnu', 404);
  } catch (e) {
    if (e instanceof Refus) return json({ erreur: e.message }, e.statut);
    return json({ erreur: 'erreur du programme' }, 500);
  }
}
