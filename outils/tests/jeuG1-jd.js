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
    if (casse(k)) J.push({ row: row++, mois, lib: 'Bus', cat: 'Transport', montant: 2, date: k }); }
  (extra || []).forEach(([k, cat, montant, o]) => { const [y, m] = k.split('-').map(Number); J.push(Object.assign({ row: row++, mois: MOIS[m - 1] + ' ' + y, lib: cat, cat, montant, date: k }, o || {})); });
  return J;
}
const ETAT = id => `(() => { const d = SAISONS_EV.find(x => x.id === '${id}'), y = +'__Y__'; const e = etatSaisonEv(d, y, new Map(joursJeu())); return e ? { a: e.a, b: e.b, ok: e.ok, rate: e.rate, cur: e.cur, max: e.max, info: e.info, ed: editionsDe('${id}') } : null; })()`;
async function cas(b, nom, date, J, id, y, prefs, ech, apres) {
  const { p, ctx, errs } = await page(b, date, J, prefs, {}, ech);
  const r = await p.evaluate(ETAT(id).replace('__Y__', y)); if (apres) r.apres = await p.evaluate(apres);
  await ctx.close(); return [nom, r, errs];
}
(async () => {
  const b = await chromium.launch(); const R = {}, ERR = [];
  const ETATJ = `(() => { const e = etatJeu(), g = id => e.succes.find(s => s.id === id).ok; return { jd: JSON.stringify(joursAvecDep()), serie: e.f.serieJours, joursSans: e.f.joursSans, j3: g('jours-3'), j7: g('jours-7'), j14: g('jours-14'), nov: e.f.novOk, semOk: e.f.semOk, ev: e.f.evOk.map(x => x.cle).join(','), serieAccueil: joursSansDepense(), xp: e.xp, mission: (etatMission(2026, 11) || {}).id + ' ' + (etatMission(2026, 11) || {}).ok }; })()`;
  // A : seulement des salaires ; on regarde le 20 novembre 2026 (sans période / avec la période par défaut)
  const J = journal('2026-11-01', '2026-11-20', () => false);
  const sem = { '2026-11-09': { cat: 'Courses', montant: 50 }, '2026-11-02': { cat: 'Courses', montant: 50 } };
  for (const [nom, prefs] of [['sansPeriode', { semaines: sem, jeu: { anticipe: true, jd: [] } }], ['parDefaut', { semaines: sem }]]) {
    const { p, ctx, errs, PRF } = await page(b, '2026-11-20T12:00:00', J, prefs, { nivVu: 1, xpVu: 0, echelle100: true });
    R[nom] = await p.evaluate(ETATJ); R[nom].prefEcrite = JSON.stringify((PRF.jeu || {}).jd);
    if (nom === 'parDefaut') {
      await p.evaluate(() => { S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'defis'; rendre(); }); R.bouton = await p.evaluate(() => (document.querySelector('[data-act="jd"]') || {}).innerText);
      await p.click('[data-act="jd"]'); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'jd-ecran.png' });
      await p.click('[data-act="jd-del"]'); await p.waitForTimeout(200); R.apresRetrait = await p.evaluate(ETATJ);
      await p.fill('#jda', '2026-11-07'); await p.fill('#jdb', '2026-11-15'); await p.click('[data-act="jd-add"]'); await p.waitForTimeout(200); R.apresAjout = await p.evaluate(ETATJ);
      R.prefFinale = JSON.stringify((PRF.jeu || {}).jd);
    }
    ERR.push(...errs); await ctx.close(); }
  // B : Novembre sobre gagné uniquement grâce aux jours 7 → 16 → perdu avec la période
  const J2 = journal('2026-11-01', '2026-12-01', k => !(k >= '2026-11-07' && k <= '2026-11-16'));
  for (const [nom, prefs] of [['novSans', { jeu: { anticipe: true, jd: [] } }], ['novAvec', {}]]) {
    const { p, ctx, errs } = await page(b, '2026-12-01T12:00:00', J2, prefs, { nivVu: 1, xpVu: 0, echelle100: true });
    R[nom] = await p.evaluate(ETATJ); ERR.push(...errs); await ctx.close(); }
  // C : indices — chaque succès, éclair et saison en a un ; vidéothèque et grille
  { const { p, ctx, errs } = await page(b, '2026-11-20T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true });
    R.indices = await p.evaluate(() => ({ manquants: SUCCES.map(s => s.id).concat(EVENEMENTS.map(d => d.id), toutesSaisons().map(d => d.id)).filter(id => !INDICES[id]), total: Object.keys(INDICES).length,
      vid: (S.form = { mode: 'videotheque' }, rendreForm(), ouvrirSheet(), document.querySelectorAll('#sheetIn .indice').length) }));
    await p.waitForTimeout(400); await p.screenshot({ path: SP + 'indices-videotheque.png' });
    await p.evaluate(() => { fermer(); S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'succes'; rendre(); document.querySelector('.evgrid').scrollIntoView(); }); await p.waitForTimeout(400); await p.screenshot({ path: SP + 'indices-eclairs.png' });
    ERR.push(...errs); await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); console.log('ERREURS:', ERR.length ? ERR : 'aucune'); await b.close();
})();
