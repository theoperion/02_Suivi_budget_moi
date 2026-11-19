// Tests ciblés lot G1 : nouvelles saisons (gagné/raté, dates exactes), éditions, vue par thème, succès non gagnables trop tôt
const { chromium } = require('playwright'); const fs = require('fs');
const FILE = process.argv[2], SP = '/tmp/claude-0/-home-user/90b26bed-93bd-5223-810a-380eb23bf8fd/scratchpad/testG1/';
const html = fs.readFileSync(FILE, 'utf8'); const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CATS = [
  { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
  { ligne: 13, nom: 'Restaurants', groupe: 'Vie courante', type: 'Dépense', budget: 150, suivi: 'Mensuel' },
  { ligne: 14, nom: 'Transport', groupe: 'Vie courante', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 15, nom: 'Sorties', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
  { ligne: 16, nom: 'Bricoles', groupe: 'Divers', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 17, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 18, nom: 'Streaming', groupe: 'Abonnements', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 19, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' }];
function donnees(journal, prefs, ech) {
  return { categories: CATS, mois: [2026, 2027, 2028, 2029, 2030, 2031].flatMap(y => MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: null,
    echeancier: ech || [], journal, libres: 50, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: prefs || {}, url: 'x', apiVersion: '5.11', anomalies: '✅', lu: '2026-11-05T09:00:00.000Z' };
}
async function page(b, date, journal, prefs, ls, ech) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = [];
  await p.clock.setFixedTime(new Date(date)); p.on('pageerror', e => errs.push(e.message));
  const PRF = Object.assign({}, prefs || {});
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData()); if (q.action === 'pref-set') PRF[q.cle] = q.valeur;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(q.action === 'data' ? { ok: true, data: donnees(journal, JSON.parse(JSON.stringify(PRF)), ech) } : { ok: true }) }); }
    if (u.startsWith('http://app.test/')) return r.fulfill({ status: 200, contentType: 'text/html', body: html });
    return r.fulfill({ status: 200, body: '' }); });
  await p.addInitScript(([api, ls]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); const set = (k, v) => localStorage.setItem('jauge.' + k, JSON.stringify(v));
    set('key', 'k'); set('api', api); set('apiDefautVu', api); localStorage.setItem('jauge.tutoVu', 'true'); set('anticipe', true); Object.entries(ls || {}).forEach(([k, v]) => set(k, v)); } }, [API, ls]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000); await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); });
  return { p, ctx, errs, PRF };
}
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// Journal : salaire chaque 1er ; une dépense « Transport » (casse le jour calme) chaque jour de casse(k) ; extra = lignes en plus
function journal(debut, fin, casse, extra) {
  const J = []; let row = 5;
  for (let d = new Date(debut + 'T00:00:00'); iso(d) < fin; d.setDate(d.getDate() + 1)) { const k = iso(d), y = d.getFullYear(), m = d.getMonth() + 1, mois = MOIS[m - 1] + ' ' + y;
    if (d.getDate() === 1) J.push({ row: row++, mois, lib: 'Salaire', cat: 'Salaire', montant: 2000, date: k });
    if (casse(k)) J.push({ row: row++, mois, lib: 'Bus', cat: 'Transport', montant: 2, date: k });
    if (d.getDate() % 4 === 2) J.push({ row: row++, mois, lib: 'Pain', cat: 'Courses', montant: 1, date: k }); } // (lot L2) preuve d'utilisation : une petite course (ne casse rien) tous les 4 jours
  (extra || []).forEach(([k, cat, montant, o]) => { const [y, m] = k.split('-').map(Number); J.push(Object.assign({ row: row++, mois: MOIS[m - 1] + ' ' + y, lib: cat, cat, montant, date: k }, o || {})); });
  return J;
}
module.exports = { page, journal, iso, MOIS, CATS };
