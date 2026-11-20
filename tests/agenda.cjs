// Google Agenda (étape 36D) :
//  1. lecture du format iCal (programme functions/agenda/[[chemin]].js) : rendez-vous simples, à l'heure UTC, journée
//     entière sur plusieurs jours, répétés (chaque semaine, dernier samedi du mois, nombre limité, chaque année),
//     exception, occurrence déplacée, annulé, rappels ignorés ; heure d'été ;
//  2. le programme appelé comme Cloudflare l'appelle (onRequest), sur le faux Firebase et un faux agenda local :
//     « AGENDA PRÊT » ou non, connexion demandée, compte du magasin refusé, l'adresse secrète jamais renvoyée ;
//  3. l'appli (téléphone, fuseau de Paris) : bouton de la barre du haut, rendez-vous rangés dans l'encart RDV de leur
//     jour avec l'heure et le signe « agenda », rien en double au deuxième appui, mise à jour du titre et de l'heure,
//     annulé retiré (dans « Faites récemment »), supprimé à la main qui ne revient pas, tâche écrite à la main intacte.
// Ce test ne touche jamais la vraie base, Cloudflare ni un vrai agenda.
// Lancement depuis la racine du dépôt : node tests/agenda.cjs   (CAPTURES=dossier pour garder les captures)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium, devices } = require('playwright');
const fauxFirebase = require('./faux-firebase.cjs');

const RACINE = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PORT_SITE = 8976, PORT_BASE = 8977, PORT_ICS = 8978;
const BASE = `http://localhost:${PORT_BASE}`, SITE = `http://localhost:${PORT_SITE}`;
const SECRET = `http://localhost:${PORT_ICS}/calendar/ical/secret-0123456789/private-abcdef/basic.ics`;
const CLE = 'cle-de-test';
const MDP = { francois: 'mdp-francois-1', tresallier: 'mdp-magasin-1' };
const CAPTURES = process.env.CAPTURES || '';
const ENV = { AGENDA_ICAL: SECRET, DB_URL: BASE };
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

let echecs = 0;
function verifie(cond, msg) { console.log((cond ? 'OK    ' : 'ÉCHEC ') + msg); if (!cond) echecs++; }
const attendreQue = async (fn, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { if (await fn()) return true; } catch (e) { /* page en cours */ } await new Promise((x) => setTimeout(x, 120)); } return false; };

// ---------- Faux agenda (adresse « secrète » locale) ----------
let ICS = '', icsStatut = 200;
function serveurIcs() {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      if (!q.url.startsWith('/calendar/ical/secret-0123456789/')) { r.writeHead(404); return r.end(); }
      r.writeHead(icsStatut, { 'Content-Type': 'text/calendar; charset=utf-8' }); r.end(icsStatut === 200 ? ICS : '');
    });
    s.listen(PORT_ICS, () => ok(s));
  });
}
function serveurSite(mod) {
  return new Promise((ok) => {
    const s = http.createServer(async (q, r) => {
      let f = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (f.startsWith('/agenda/')) {
        const rep = await mod.onRequest({ request: new Request(SITE + q.url, { method: q.method, headers: q.headers }), env: ENV, params: {} });
        r.writeHead(rep.status, { 'Content-Type': rep.headers.get('Content-Type') }); return r.end(await rep.text());
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

// Jours à Paris : aujourd'hui + n, en « AAAAMMJJ » (iCal) et en « AAAA-MM-JJ », et son n° (0 = lundi).
function jourParis(n) {
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
  const t = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + n));
  const iso = t.toISOString().slice(0, 10);
  return { ical: iso.replace(/-/g, ''), iso, jour: (t.getUTCDay() + 6) % 7 };
}
const J1 = jourParis(1), J2 = jourParis(2), J3 = jourParis(3), J4 = jourParis(4), J8 = jourParis(8), J0 = jourParis(0);
function agenda(evts) {
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\r\nX-WR-TIMEZONE:Europe/Paris\r\n' +
    evts.map((e) => 'BEGIN:VEVENT\r\n' + e.join('\r\n') + '\r\nEND:VEVENT\r\n').join('') + 'END:VCALENDAR\r\n';
}
const DENTISTE = (h, titre) => [`DTSTART;TZID=Europe/Paris:${J1.ical}T${h}00`, `DTEND;TZID=Europe/Paris:${J1.ical}T${h}00`, `SUMMARY:${titre}`, 'UID:dentiste@google.com'];
const MARCHE = ['DTSTART;VALUE=DATE:' + J2.ical, 'DTEND;VALUE=DATE:' + J4.ical, 'SUMMARY:Salon bio\\, Moulins', 'UID:salon@google.com'];
const VETO = [`DTSTART;TZID=Europe/Paris:${J3.ical}T143000`, 'SUMMARY:Véto', 'UID:veto@google.com'];
const LOIN = [`DTSTART;TZID=Europe/Paris:${J8.ical}T100000`, 'SUMMARY:Trop loin', 'UID:loin@google.com'];
const HIER = [`DTSTART;TZID=Europe/Paris:${J0.ical}T060000`, 'SUMMARY:Aujourd\'hui', 'UID:auj@google.com'];
const BANQUE = [`DTSTART;TZID=Europe/Paris:${J3.ical}T090000`, 'SUMMARY:Banque', 'UID:banque@google.com'];

(async () => {
  const mod = await import(pathToFileURL(path.join(RACINE, 'functions/agenda/[[chemin]].js')).href);

  // ---------- 1. Lecture du format iCal ----------
  const exemple = agenda([
    ['DTSTART;TZID=Europe/Paris:20261124T090000', 'DTEND;TZID=Europe/Paris:20261124T100000', 'SUMMARY:Dentiste\\, Moulins', 'UID:a1@google.com'],
    ['DTSTART:20261125T130000Z', 'SUMMARY:Appel', 'UID:a2@google.com', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'SUMMARY:pas un rendez-vous', 'END:VALARM'],
    ['DTSTART;VALUE=DATE:20261126', 'DTEND;VALUE=DATE:20261128', 'SUMMARY:Salon bio', 'UID:a3@google.com'],
    ['DTSTART;TZID=Europe/Paris:20260105T070000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TH', 'EXDATE;TZID=Europe/Paris:20261126T070000', 'SUMMARY:Livraison', 'UID:a4@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261130T080000', 'RECURRENCE-ID;TZID=Europe/Paris:20261130T070000', 'SUMMARY:Livraison décalée', 'UID:a4@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261101T180000', 'RRULE:FREQ=MONTHLY;BYDAY=-1SA', 'SUMMARY:Réunion fin de mois', 'UID:a5@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261127T100000', 'SUMMARY:Annulé', 'STATUS:CANCELLED', 'UID:a6@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261101T060000', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Fini', 'UID:a7@google.com'],
    ['DTSTART;VALUE=DATE:20200811', 'RRULE:FREQ=YEARLY', 'SUMMARY:Anniversaire', 'UID:a8@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261001T090000', 'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261124T225959Z', 'SUMMARY:Toutes les deux semaines', 'UID:a9@google.com'],
    ['DTSTART;TZID=Europe/Paris:20261123T23', 'SUMMARY:Date mal formée', 'UID:a10@google.com'],
  ]);
  const evts = mod.lireIcal(exemple);
  const r1 = mod.rendezVous(evts, '2026-11-21', '2026-12-01', 'Europe/Paris');
  const vu = r1.map((x) => x.date + ' ' + (x.heure || 'journée') + ' ' + x.titre);
  console.log('      ' + vu.join(' | '));
  verifie(vu.includes('2026-11-24 09:00 Dentiste, Moulins'), 'rendez-vous simple : jour, heure de Paris, virgule échappée');
  verifie(vu.includes('2026-11-25 14:00 Appel') && !vu.some((x) => /pas un rendez-vous/.test(x)), 'heure UTC remise à l\'heure de Paris (13 h Z → 14 h) ; le rappel (VALARM) n\'est pas un rendez-vous');
  verifie(vu.includes('2026-11-26 journée Salon bio') && vu.includes('2026-11-27 journée Salon bio') && !vu.includes('2026-11-28 journée Salon bio'), 'journée entière sur deux jours : chaque jour, sans heure (fin non comprise)');
  verifie(vu.includes('2026-11-23 07:00 Livraison') && !vu.includes('2026-11-26 07:00 Livraison') && vu.includes('2026-11-30 08:00 Livraison décalée') && !vu.includes('2026-11-30 07:00 Livraison'), 'répété chaque lundi et jeudi : exception (jeudi 26 sauté), occurrence déplacée (lundi 30 à 8 h)');
  verifie(vu.includes('2026-11-28 18:00 Réunion fin de mois'), 'répété « dernier samedi du mois »');
  verifie(!vu.some((x) => /Annulé|Fini/.test(x)), 'annulé : absent ; répété 3 fois seulement (fini depuis début novembre) : absent');
  verifie(!vu.some((x) => /deux semaines/.test(x)), 'répété toutes les deux semaines jusqu\'au 24 novembre : pas les semaines sans, ni après la fin');
  const r2 = mod.rendezVous(evts, '2026-11-12', '2026-11-13', 'Europe/Paris').map((x) => x.titre);
  verifie(r2.includes('Toutes les deux semaines'), 'toutes les deux semaines : bien présent une semaine sur deux (jeudi 12 novembre)');
  verifie(mod.rendezVous(evts, '2027-08-11', '2027-08-12', 'Europe/Paris').some((x) => x.titre === 'Anniversaire'), 'répété chaque année (journée entière)');
  const ete = mod.rendezVous(mod.lireIcal(agenda([['DTSTART;TZID=Europe/Paris:20260601T090000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Été', 'UID:e@g']])), '2026-07-06', '2026-07-07', 'Europe/Paris');
  verifie(ete.length === 1 && ete[0].heure === '09:00', 'répété commencé en été : reste à 9 h (heure d\'été)');
  const hiv = mod.rendezVous(mod.lireIcal(agenda([['DTSTART;TZID=Europe/Paris:20260601T090000', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Hiver', 'UID:h@g']])), '2026-11-23', '2026-11-24', 'Europe/Paris');
  verifie(hiv.length === 1 && hiv[0].heure === '09:00', 'le même en hiver : toujours 9 h à la montre');
  const k1 = mod.cle('dentiste@google.com', '2026-11-24');
  verifie(/^g[a-z0-9]+_20261124$/.test(k1) && k1 === mod.cle('dentiste@google.com', '2026-11-24') && k1 !== mod.cle('dentiste2@google.com', '2026-11-24'), 'clé d\'un rendez-vous : stable, différente d\'un rendez-vous à l\'autre, permise dans la base');
  verifie(new Set(r1.map((x) => x.k)).size === r1.length, 'chaque rendez-vous de la semaine a sa propre clé');

  // ---------- 2. Le programme du site ----------
  const ics = await serveurIcs(), site = await serveurSite(mod);
  const base = await fauxFirebase(PORT_BASE, { comptes: { cle: CLE } });
  const uid = {};
  for (const id of Object.keys(MDP)) uid[id] = base.creerCompte(id + '@ferme.invalid', MDP[id]);
  base.profil(uid.francois, 'ferme'); base.profil(uid.tresallier, 'magasin:ta');
  const connexion = async (id) => (await (await fetch(`${BASE}/v1/accounts:signInWithPassword?key=${CLE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@ferme.invalid', password: MDP[id], returnSecureToken: true }) })).json()).idToken;
  const appel = async (chemin, jeton, env) => {
    const r = await mod.onRequest({ request: new Request('https://essai.pages.dev/agenda/' + chemin, { headers: jeton ? { Authorization: 'Bearer ' + jeton } : {} }), env: env || ENV, params: {} });
    return { statut: r.status, corps: await r.text() };
  };
  let e = await appel('etat', null, { DB_URL: BASE });
  verifie(/AGENDA_ICAL : manquant/.test(e.corps) && /AGENDA PAS PRÊT/.test(e.corps), '/agenda/etat sans réglage : « AGENDA PAS PRÊT »');
  e = await appel('etat');
  verifie(/saisi \(1 agenda\)/.test(e.corps) && /AGENDA PRÊT/.test(e.corps) && !e.corps.includes('secret-0123456789'), '/agenda/etat avec le réglage : « AGENDA PRÊT », sans montrer l\'adresse');
  ICS = agenda([DENTISTE('0900', 'Dentiste'), MARCHE, VETO, LOIN, HIER]);
  e = await appel('semaine?fuseau=Europe/Paris');
  verifie(e.statut === 401, 'sans connexion : refusé (401)');
  e = await appel('semaine?fuseau=Europe/Paris', await connexion('tresallier'));
  verifie(e.statut === 403, 'compte du magasin (n\'ouvre pas les tâches) : refusé (403)');
  const jf = await connexion('francois');
  e = await appel('semaine?fuseau=Europe/Paris', jf);
  const s1 = JSON.parse(e.corps);
  verifie(e.statut === 200 && s1.de === J1.iso && s1.a === J8.iso, `compte de la ferme : les 7 jours à partir de demain (${s1.de} → ${s1.a}, non compris)`);
  verifie(s1.rdv.map((x) => x.titre).join('|') === 'Dentiste|Salon bio, Moulins|Salon bio, Moulins|Véto', 'rendez-vous de la semaine seulement (ni aujourd\'hui ni le 8e jour), dans l\'ordre');
  verifie(!e.corps.includes('secret-0123456789'), 'l\'adresse secrète n\'est jamais renvoyée');
  icsStatut = 404;
  e = await appel('semaine', jf);
  verifie(e.statut === 502 && /illisible \(404\)/.test(e.corps) && !e.corps.includes('secret'), 'adresse de l\'agenda fausse : message clair, sans l\'adresse');
  icsStatut = 200;

  // ---------- 3. L'appli ----------
  const navigateur = await chromium.launch();
  const ctx = await navigateur.newContext({ ...devices['Pixel 5'], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const A = await ctx.newPage();
  const erreurs = []; A.on('pageerror', (x) => erreurs.push(String(x)));
  await A.goto(SITE + '/');
  await A.waitForSelector('#authDlg[open]');
  await A.fill('#authId', 'francois'); await A.fill('#authMdp', MDP.francois); await A.click('#authOk');
  verifie(await attendreQue(() => A.evaluate(() => document.querySelectorAll('#piste .pan').length >= 8)), 'connecté, listes de départ là');
  verifie(await A.isVisible('#agendaBtn'), 'bouton « agenda » dans la barre du haut du téléphone');
  const listes = () => base.lire('taches/listes') || {};
  const listeDe = (j) => Object.keys(listes()).find((k) => listes()[k].type === 'jour' && listes()[k].jour === j);
  // Une tâche écrite à la main dans le RDV de demain.
  base.poser('taches/t/main1', { liste: listeDe(J1.jour), parent: '', encart: 'rdv', ordre: 1, heure: '08:00', texte: 'Écrit à la main', by: 'francois', at: 1 });
  const taches = () => Object.entries(base.lire('taches/t') || {});
  const agendaT = () => taches().filter(([, t]) => /^g:/.test(t.origine || ''));
  const parTitre = (titre) => agendaT().filter(([, t]) => t.texte === titre);
  const bandeau = () => A.evaluate(() => document.querySelector('#bandeau').hidden ? '' : document.querySelector('#bandeau').firstElementChild.textContent);

  await A.click('#agendaBtn');
  verifie(await attendreQue(() => agendaT().length === 4), 'premier appui : 4 rendez-vous posés');
  console.log('      bandeau : ' + await bandeau());
  verifie(/4 rendez-vous ajoutés/.test(await bandeau()), 'bandeau : « 4 rendez-vous ajoutés »');
  const [, dent] = parTitre('Dentiste')[0] || [, {}];
  verifie(dent.liste === listeDe(J1.jour) && dent.encart === 'rdv' && dent.heure === '09:00' && dent.parent === '', `Dentiste : liste ${JOURS[J1.jour]}, encart RDV, 9 h 00`);
  const salons = parTitre('Salon bio, Moulins').map(([, t]) => t);
  verifie(salons.length === 2 && salons.some((t) => t.liste === listeDe(J2.jour)) && salons.some((t) => t.liste === listeDe(J3.jour)) && salons.every((t) => !t.heure && t.encart === 'rdv'), 'salon sur deux jours : dans le RDV de chacun des deux jours, sans heure');
  verifie(!parTitre('Trop loin').length && !parTitre('Aujourd\'hui').length, 'ni le 8e jour ni aujourd\'hui');
  const pan1 = `.pan[data-l="${listeDe(J1.jour)}"]`;
  verifie(await attendreQue(() => A.evaluate((s) => { const li = Array.from(document.querySelectorAll(s + ' .encart[data-e="rdv"] li.t')).find((x) => /Dentiste/.test(x.textContent)); return !!li && /09:00/.test(li.textContent) && !!li.querySelector('.origine[title="Agenda"]'); }, pan1)), 'à l\'écran : « 09:00 Dentiste » dans RDV, avec le signe « agenda »');
  const memo = base.lire('taches/agenda') || {};
  verifie(Object.keys(memo).length === 4 && Object.values(memo).every((m) => m.t && m.date && m.at), 'mémoire de ce qui est posé : taches/agenda (4)');
  if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await A.evaluate((s) => document.querySelector(s).scrollIntoView(), pan1); await A.screenshot({ path: path.join(CAPTURES, 'agenda-telephone.png') }); }

  await A.waitForTimeout(400);
  await A.click('#agendaBtn');
  verifie(await attendreQue(async () => /4 déjà là/.test(await bandeau())), 'deuxième appui sans changement : « 4 déjà là »');
  verifie(agendaT().length === 4, 'rien en double');

  // Changements dans l'agenda : Dentiste déplacé à 10 h 30 et renommé, Véto annulé, Banque ajoutée.
  ICS = agenda([DENTISTE('1030', 'Dentiste Moulins'), MARCHE, BANQUE, LOIN]);
  await A.waitForTimeout(400);
  await A.click('#agendaBtn');
  verifie(await attendreQue(() => parTitre('Banque').length === 1 && !parTitre('Véto').length), 'troisième appui : Banque ajoutée, Véto retiré');
  console.log('      bandeau : ' + await bandeau());
  verifie(/1 rendez-vous ajouté/.test(await bandeau()) && /1 mis à jour/.test(await bandeau()) && /1 retiré/.test(await bandeau()), 'bandeau : 1 ajouté, 1 mis à jour, 1 retiré');
  const d2 = parTitre('Dentiste Moulins')[0];
  verifie(!!d2 && d2[1].heure === '10:30' && d2[0] === parTitre('Dentiste Moulins')[0][0], 'Dentiste : même tâche, nouveau titre et nouvelle heure (10 h 30)');
  verifie(Object.values(base.lire('taches/faites') || {}).some((f) => f.texte === 'Véto' && f.supprime), 'Véto annulé : rangé dans « Faites récemment » (on peut le remettre)');
  const main = base.lire('taches/t/main1');
  verifie(main && main.texte === 'Écrit à la main' && main.heure === '08:00', 'la tâche écrite à la main n\'a pas bougé');

  // Retouche à la main de l'heure : gardée tant que l'agenda ne change pas.
  await A.evaluate((id) => { var c = {}; c['t/' + id + '/heure'] = '11:00'; ecrire(c); }, d2[0]);
  await attendreQue(() => base.lire('taches/t/' + d2[0]).heure === '11:00');
  // Suppression à la main de la Banque.
  const banque = parTitre('Banque')[0][0];
  await A.evaluate((id) => retirer(id, 'Supprimée'), banque);
  await attendreQue(() => !base.lire('taches/t/' + banque));
  await A.waitForTimeout(400);
  await A.click('#agendaBtn');
  verifie(await attendreQue(async () => /déjà là/.test(await bandeau())), 'quatrième appui fait');
  verifie(!parTitre('Banque').length, 'rendez-vous supprimé à la main : ne revient pas');
  verifie(base.lire('taches/t/' + d2[0]).heure === '11:00', 'heure retouchée à la main : gardée (l\'agenda n\'a pas changé)');

  // Une liste verrouillée n'est pas touchée.
  await A.evaluate((L) => verrouiller(L, true), listeDe(J4.jour));
  await attendreQue(() => !!base.lire('taches/listes/' + listeDe(J4.jour) + '/verrou'));
  ICS = agenda([DENTISTE('1030', 'Dentiste Moulins'), MARCHE, BANQUE, [`DTSTART;TZID=Europe/Paris:${J4.ical}T080000`, 'SUMMARY:Dans une liste verrouillée', 'UID:v@g']]);
  await A.waitForTimeout(500);
  await A.click('#agendaBtn');
  verifie(await attendreQue(async () => /verrouillée/.test(await bandeau())), 'liste verrouillée : rien posé, et le bandeau le dit');
  verifie(!parTitre('Dans une liste verrouillée').length, 'rien dans la liste verrouillée');

  // Agenda illisible : message clair.
  icsStatut = 500;
  await A.waitForTimeout(400);
  await A.click('#agendaBtn');
  verifie(await attendreQue(async () => /Agenda non lu : agenda n° 1 illisible/.test(await bandeau())), 'agenda illisible : « Agenda non lu : … »');
  icsStatut = 200;

  verifie(!erreurs.length, 'aucune erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' / ') : ''));
  await navigateur.close(); site.close(); ics.close(); base.close && base.close();
  console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
  process.exit(echecs ? 1 : 0);
})().catch((x) => { console.error(x); process.exit(1); });
