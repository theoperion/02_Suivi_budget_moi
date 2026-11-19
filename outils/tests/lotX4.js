// 9.33 (lot F1) : preuve d'usage autour des événements / saisons / semaines / rentrée, épargne au plus haut niveau atteint,
// carte unique « nouvelles règles », nettoyage unique des jours avec dépenses non saisies (JD_RETIRES), renommage dans exH,
// défi lancé seulement du 1er au 5, mission « en attente », record recalculé, journal d'XP « validé grâce à ta saisie ».
// usage : node lotX4.js <dossier de l'appli> [dossier captures]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'x4');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const PRE = (html.match(/localStorage\.getItem\('([^']+)' \+ k\)/) || [])[1] || 'jauge.';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CATS = [
  { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Sans alerte' },
  { ligne: 13, nom: 'Restaurants', groupe: 'Vie courante', type: 'Dépense', budget: 150, suivi: 'Mensuel' },
  { ligne: 15, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
  { ligne: 16, nom: 'Bricoles', groupe: 'Divers', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 17, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' },
  { ligne: 18, nom: 'Retrait livret', groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' }];
const L = (row, date, cat, montant, lib) => { const [y, m] = date.split('-').map(Number); return { row, mois: MOIS[m - 1] + ' ' + y, lib: lib || cat, cat, montant, date }; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function serie(debut, fin, pas, cat, montant, row0) { const o = []; let r = row0; for (let d = new Date(debut + 'T00:00:00'); iso(d) <= fin; d.setDate(d.getDate() + pas)) o.push(L(r++, iso(d), cat, montant)); return o; }
const SAL = [L(1, '2026-11-01', 'Salaire', 2000), L(2, '2026-12-01', 'Salaire', 2000), L(3, '2027-01-01', 'Salaire', 2000)];
const JEU0 = { exclus: ['Courses'], jd: [] }; // pas de voyage : le test vaut pour toutes les copies
function donnees(journal, prefs, defis) {
  return { categories: CATS, mois: [2026, 2027].flatMap(y => MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: null,
    echeancier: [], journal: JSON.parse(JSON.stringify(journal)), libres: 50, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: defis || {}, prefs: JSON.parse(JSON.stringify(prefs || {})), url: 'x', apiVersion: '5.13', anomalies: '✅', lu: '2027-01-01T09:00:00.000Z' };
}
let b; const errs = [], R = {}, KO = [];
const ok = (c, msg) => { if (!c) KO.push(msg); console.log((c ? '✅ ' : '❌ ') + msg); };
// o.garder : ne pas retirer la carte des gains ; o.html : page servie à la place d'index.html
async function page(date, journal, prefs, ls, defis, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(date)); p.on('pageerror', e => errs.push(e.message));
  const PRF = JSON.parse(JSON.stringify(prefs || { jeu: JEU0 }));
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData());
      const un = x => { if (x.action === 'pref-set') PRF[x.cle] = x.valeur; return x.action === 'data' ? { ok: true, data: donnees(journal, PRF, defis) } : x.action === 'add' ? { ok: true, row: 900 } : { ok: true }; };
      let res; if (q.action === 'lot') { const l = (q.ops || q.lot || q.envois || []).map(x => un(Object.assign({ action: x.action }, x.payload || x))); res = { ok: true, res: l, resultats: l }; } else res = un(q);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); }
    if (u.startsWith('http://app.test/')) { const rel = decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html';
      if (rel === 'index.html' && o.html) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: o.html });
      const f = path.join(DIR, rel); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' }); });
  await p.addInitScript(([api, ls, pre]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); const set = (k, v) => localStorage.setItem(pre + k, JSON.stringify(v));
    set('key', 'k'); set('api', api); set('apiDefautVu', api); localStorage.setItem(pre + 'tutoVu', 'true'); Object.entries(ls || {}).forEach(([k, v]) => set(k, v)); } }, [API, ls, PRE]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000);
  if (!o.garder) await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); });
  return { p, ctx, PRF };
}
const VU = { nivVu: 1, xpVu: 0, echelle100: true, regles933: true }; // joueur déjà installé, règles 9.33 déjà annoncées
(async () => {
  b = await chromium.launch();
  // 1a. Black Friday (26–30/11/2026) : courses le 21/11 et le 02/12, rien entre → réussi ; preuve seulement le 15/11 → en attente puis raté
  { const J = SAL.concat([L(100, '2026-11-21', 'Courses', 40), L(101, '2026-12-02', 'Courses', 40)]);
    const { p, ctx } = await page('2026-12-05T10:00:00+01:00', J, null, VU);
    R.bf = await p.evaluate(() => { const e = etatSaisonEv(SAISONS_EV.find(d => d.id === 'blackfriday'), 2026, new Map(joursJeu())); return { ok: e.ok, rate: e.rate, attente: e.attente }; }); await ctx.close();
    ok(R.bf.ok && !R.bf.rate, `Black Friday : courses le 21/11 et le 02/12 → réussi (${JSON.stringify(R.bf)})`); }
  for (const [d, att] of [['2026-12-05T10:00:00+01:00', true], ['2026-12-10T10:00:00+01:00', false]]) {
    const { p, ctx } = await page(d, SAL.concat([L(100, '2026-11-15', 'Courses', 40)]), null, VU);
    const e = await p.evaluate(() => { const e = etatSaisonEv(SAISONS_EV.find(d => d.id === 'blackfriday'), 2026, new Map(joursJeu())); return { ok: e.ok, rate: e.rate, attente: e.attente, info: e.info }; }); await ctx.close();
    ok(att ? (e.attente && !e.rate && !e.ok) : (e.rate && !e.ok), `Black Friday sans dépense du 19/11 au 07/12, le ${d.slice(8, 10)}/12 → ${att ? 'en attente' : 'raté'} (${JSON.stringify(e)})`); }
  // 1b. Événement éclair à plafond (Cuisine maison 26–30/11) : même règle, carte « en attente »
  for (const [d, J, attendu] of [['2026-12-03T10:00:00+01:00', SAL, 'attente'], ['2026-12-03T10:00:00+01:00', SAL.concat([L(100, '2026-12-02', 'Courses', 40)]), 'reussi'], ['2026-12-09T10:00:00+01:00', SAL, 'rate']]) {
    const { p, ctx } = await page(d, J, null, VU);
    const e = await p.evaluate(() => { const o = { def: EVENEMENTS.find(x => x.id === 'maison'), debut: '2026-11-26', fin: '2026-11-30', cle: 'test' }; const x = etatEv(o);
      return { statut: x.statut, attente: x.attente, info: x.info, carte: carteEvMini(x).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; }); await ctx.close();
    const vu = e.attente ? 'attente' : e.statut;
    ok(vu === attendu && (attendu !== 'attente' || /en attente/.test(e.carte)), `Cuisine maison 26–30/11, le ${d.slice(8, 10)}/12 → ${attendu} (${vu} · ${e.carte.slice(-60)})`); }
  // 1c. Défi de la semaine 23–29/11 tenu, preuve seulement le 10/11 : en attente (pas compté) ; une course le 03/12 le valide
  { const { p, ctx } = await page('2026-12-03T10:00:00+01:00', SAL.concat([L(100, '2026-11-10', 'Courses', 40)]), { jeu: JEU0, semaines: { '2026-11-23': { cat: 'Loisirs', montant: 50 } } }, VU);
    R.sem = await p.evaluate(() => { const a = etatSemaines().reussis; S.journal.push({ row: 990, y: 2026, m: 12, mois: 'Décembre 2026', date: '2026-12-03', cat: 'Courses', lib: 'Courses', montant: 20 }); memo = new Map(); return [a, etatSemaines().reussis]; }); await ctx.close();
    ok(R.sem[0] === 0 && R.sem[1] === 1, `défi de la semaine sans preuve → en attente (${R.sem[0]}), validé par une saisie le 03/12 (${R.sem[1]})`); }
  // 1d. Rentrée 2027 sans aucune dépense saisie : le 03/10 en attente, le 10/10 ratée
  for (const [d, att] of [['2027-10-03T10:00:00+02:00', true], ['2027-10-10T10:00:00+02:00', false]]) {
    const { p, ctx } = await page(d, SAL, null, VU);
    const e = await p.evaluate(() => { const e = etatRentree(SAISONS_EV.find(x => x.id === 'rentree'), 2027); return e && { ok: e.ok, rate: e.rate, attente: e.attente }; }); await ctx.close();
    ok(e && (att ? (e.attente && !e.rate && !e.ok) : (e.rate && !e.ok)), `Rentrée sans dépense saisie, le ${d.slice(8, 10)}/10 → ${att ? 'en attente' : 'ratée'} (${JSON.stringify(e)})`); }
  // 2. Épargne : versé 1 000 € en novembre, retiré en décembre → le succès reste (plus haut niveau atteint)
  { const base = SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100));
    const { p, ctx } = await page('2027-01-19T10:00:00+01:00', base.concat([L(310, '2026-11-20', 'Livret A', 1000), L(311, '2026-12-05', 'Retrait livret', 1000), L(312, '2027-01-05', 'Livret A', 300)]), null, VU);
    R.ep = await p.evaluate(() => { const e = etatJeu(); return { ep: Math.round(e.f.epargne), cote: e.succes.find(s => s.id === 'cote-1000').ok, epV: e.f.M.map(x => Math.round(x.epV)) }; }); await ctx.close();
    ok(R.ep.ep === 1000 && R.ep.cote, `versé 1 000 (nov.), retiré 1 000 (déc.), versé 300 (janv.) → plus haut niveau 1 000 €, Tirelire pleine gardée (${JSON.stringify(R.ep)})`);
    ok(R.ep.epV.join() === '1000,-1000', `épargne mensuelle (Épargne régulière) toujours nette (${R.ep.epV.join()})`); }
  // 3. Premier lancement 9.33 : carte « Nouvelles règles », journal sans « ligne corrigée », puis plus rien au lancement suivant
  { const ls = { nivVu: 20, xpVu: 6000, prestVu: 0, echelle100: true, xpDetail: { 'r:Jours sans dépense courante': 5000, 'r:Mois bouclés': 1000 } };
    const { p, ctx } = await page('2027-01-19T10:00:00+01:00', SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100)), null, ls, null, { garder: true });
    R.r933 = await p.evaluate(() => ({ carte: (document.querySelector('#gains') || {}).innerText || '', log: (LS.get('xpLog', []) || []).map(libXPLog), xp: etatJeu().xp, nivVu: LS.get('nivVu', 0), flag: LS.get('regles933', false) }));
    await p.screenshot({ path: path.join(SHOTS, 'x4-regles933.png') });
    await p.evaluate(() => document.querySelectorAll('#gains').forEach(x => x.remove()));
    await p.reload(); await p.waitForTimeout(2000);
    R.r933b = await p.evaluate(() => (document.querySelector('#gains') || {}).innerText || ''); await ctx.close();
    const n = 6000 - R.r933.xp;
    ok(/NOUVELLES RÈGLES DU JEU/i.test(R.r933.carte) && R.r933.carte.includes('−' + n + ' XP') && /envies rapportent seulement une fois mûres/.test(R.r933.carte), `carte unique : « ${R.r933.carte.replace(/\s+/g, ' ').slice(0, 140)} »`);
    ok(R.r933.log.length > 0 && R.r933.log.every(t => /nouvelles règles/.test(t) && !/corrigée/.test(t)), `journal d'XP : recalcul noté comme tel (${R.r933.log.slice(0, 2).join(' | ')})`);
    ok(R.r933.flag && R.r933.nivVu < 20 && !/NOUVELLES RÈGLES/i.test(R.r933b), `drapeau posé, niveau mis à jour (${R.r933.nivVu}), pas de nouvelle carte ensuite (« ${R.r933b.slice(0, 40)} »)`); }
  // 4. JD_RETIRES : le voyage retiré une seule fois de la préférence (une période remise ensuite à la main reste)
  { const VOY = ['2026-11-07', '2026-11-15'], AUTRE = ['2026-12-01', '2026-12-02'];
    const h = /const JD_RETIRES = \[\];/.test(html) ? html.replace('const JD_RETIRES = [];', "const JD_RETIRES = [['2026-11-07', '2026-11-15']];") : html;
    const { p, ctx, PRF } = await page('2026-12-10T10:00:00+01:00', SAL, { jeu: { exclus: ['Courses'], jd: [VOY, AUTRE] } }, VU, null, { html: h });
    await p.waitForTimeout(500); R.jd1 = JSON.parse(JSON.stringify(PRF.jeu || {}));
    await p.evaluate(v => { majPrefJeu({ jd: [v].concat(getPref('jeu', {}).jd) }); figerJeu(); figerJeu(); }, VOY); await p.waitForTimeout(500);
    R.jd2 = JSON.parse(JSON.stringify(PRF.jeu || {})); await ctx.close();
    ok(JSON.stringify(R.jd1.jd) === JSON.stringify([AUTRE]) && R.jd1.jdMig === 1, `pref { jd: [voyage, 1–2 déc.] } → voyage retiré, drapeau posé (${JSON.stringify(R.jd1.jd)}, jdMig ${R.jd1.jdMig})`);
    ok(R.jd2.jd.length === 2, `voyage remis à la main ensuite → gardé (${JSON.stringify(R.jd2.jd)})`); }
  // 5. Renommer une catégorie : exclus ET chaque liste de exH
  { const { p, ctx, PRF } = await page('2027-01-19T10:00:00+01:00', SAL, { jeu: { exclus: ['Restaurants'], exH: [['', ['Courses', 'Restaurants']], ['2027-01-10', ['Restaurants']]], jd: [] } }, VU);
    await p.evaluate(() => renommerLocal('Restaurants', 'Restos')); await p.waitForTimeout(500);
    R.ren = await p.evaluate(() => getPref('jeu', {})); await ctx.close();
    ok(JSON.stringify(R.ren.exclus) === '["Restos"]' && JSON.stringify(R.ren.exH) === '[["",["Courses","Restos"]],["2027-01-10",["Restos"]]]', `renommer Restaurants → Restos : exclus et exH (${JSON.stringify(R.ren.exH)})`); }
  // 6. Défi du mois : nouveau défi seulement du 1er au 5
  { const { p, ctx } = await page('2027-01-19T10:00:00+01:00', SAL, null, VU);
    R.df = await p.evaluate(() => { const ligne = ligneDefiPerso(null, 1).replace(/<[^>]+>/g, ' '); ouvrirDefi(); const t = document.querySelector('#sheetIn').innerText, bouton = !!document.querySelector('#sheetIn [data-act=defi-ok]');
      fermer(); S.form = { mode: 'defi', y: 2027, m: 1, cat: 'Loisirs', montant: '50', existe: false }; rendreForm(); ouvrirSheet(); okDefi(); return { ligne, t, bouton, d: JSON.stringify((S.data.defis || {})['2027-1'] || null) }; });
    await p.evaluate(() => { fermer(); ouvrirDefi(); }); await p.waitForTimeout(300); await p.screenshot({ path: path.join(SHOTS, 'x4-defi-ferme.png') }); await ctx.close();
    ok(/Prochain défi à lancer du 1er au 5 du mois/.test(R.df.ligne) && /Prochain défi à lancer du 1er au 5 du mois/.test(R.df.t) && !R.df.bouton && R.df.d === 'null', `le 19 sans défi : pas de lancement (${R.df.ligne.replace(/\s+/g, ' ').trim()})`);
    const q = await page('2027-01-05T10:00:00+01:00', SAL, null, VU);
    R.df5 = await q.p.evaluate(() => { ouvrirDefi(); S.form.cat = 'Loisirs'; S.form.montant = '60'; okDefi(); return JSON.stringify((S.data.defis || {})['2027-1'] || null); }); await q.ctx.close();
    ok(/"montant":60/.test(R.df5), `le 5 : lancement possible (${R.df5})`);
    ok(/du 1er au 5 du mois/.test(html.match(/DÉFI DU MOIS', "[^"]+"/)[0]), "mode d'emploi DÉFI DU MOIS : lancement du 1er au 5"); }
  // 7. Mission « Huit jours calmes » de novembre : 7 jours gagnés + 5 en attente → en attente le 03/12, ratée le 10/12
  for (const [d, att] of [['2026-12-03T10:00:00+01:00', true], ['2026-12-10T10:00:00+01:00', false]]) {
    const J = SAL.concat(serie('2026-11-01', '2026-11-18', 1, 'Courses', 10, 100));
    const { p, ctx } = await page(d, J, { jeu: { exclus: [], jd: [] } }, VU);
    const e = await p.evaluate(() => { missionDe = () => Object.assign({}, MISSIONS.find(x => x.id === 'j8')); const e = etatMission(2026, 11); return { cur: e.cur, ok: e.ok, rate: e.rate, attente: e.attente, carte: carteSurpriseMini(e).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; }); await ctx.close();
    ok(e.cur === 7 && (att ? (e.attente && !e.rate && /en attente/.test(e.carte)) : (e.rate && /ratée/.test(e.carte))), `mission j8 de novembre, le ${d.slice(8, 10)}/12 → ${att ? 'en attente' : 'ratée'} (${JSON.stringify(e)})`); }
  // 8. Record de l'accueil : l'ancien record gardé sur le téléphone n'est plus relu
  { const { p, ctx } = await page('2027-01-19T10:00:00+01:00', SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100)), null, Object.assign({ recordSans: 99 }, VU));
    R.rec = await p.evaluate(() => ({ rec: recordSans(), max: maxSerie(joursJeu().map(x => x[1])), html: blocCoupDoeil().replace(/<[^>]+>/g, ' ') })); await ctx.close();
    ok(R.rec.rec === Math.max(R.rec.max, 0) && R.rec.rec !== 99 && !/record 99/.test(R.rec.html), `record = plus longue série calculée (${R.rec.rec}), pas l'ancien 99`); }
  // 9. Journal d'XP : des jours en attente validés par une saisie du jour
  { const J = SAL.concat(serie('2026-11-02', '2027-01-04', 3, 'Courses', 40, 100));
    const { p, ctx } = await page('2027-01-19T10:00:00+01:00', J, null, VU);
    R.log = await p.evaluate(() => { S.journal.push({ row: 991, y: 2027, m: 1, mois: 'Janvier 2027', date: '2027-01-19', cat: 'Courses', lib: 'Courses', montant: 20 }); memo = new Map(); S._jeu = null; annoncerJeu();
      return (LS.get('xpLog', []) || []).slice(0, 3).map(libXPLog); });
    await p.evaluate(() => { document.querySelectorAll('#gains').forEach(x => x.remove()); S.form = { mode: 'xplog' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, 'x4-xplog.png') }); await ctx.close();
    ok(R.log.some(t => /^7 jours sans dépense validés grâce à ta saisie$/.test(t)) && !R.log.some(t => /^Journée du/.test(t)), `journal : « ${R.log.join(' | ')} »`); }
  console.log(JSON.stringify(R).slice(0, 2500));
  console.log('VERDICT:', KO.length ? 'ÉCHEC (' + KO.length + ')' : 'OK');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune'); await b.close();
})();
