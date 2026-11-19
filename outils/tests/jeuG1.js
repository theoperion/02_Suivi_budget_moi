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
const ETAT = id => `(() => { const d = SAISONS_EV.find(x => x.id === '${id}'), y = +'__Y__'; const e = etatSaisonEv(d, y, new Map(joursJeu())); return e ? { a: e.a, b: e.b, ok: e.ok, rate: e.rate, cur: e.cur, max: e.max, info: e.info, ed: editionsDe('${id}') } : null; })()`;
async function cas(b, nom, date, J, id, y, prefs, ech, apres) {
  const { p, ctx, errs } = await page(b, date, J, prefs, {}, ech);
  const r = await p.evaluate(ETAT(id).replace('__Y__', y)); if (apres) r.apres = await p.evaluate(apres);
  await ctx.close(); return [nom, r, errs];
}
(async () => {
  const b = await chromium.launch(); const R = {}, ERR = []; const run = async (...a) => { const [n, r, e] = await cas(b, ...a); R[n] = r; ERR.push(...e.map(x => n + ': ' + x)); };
  const tous = () => true;
  // Janvier léger 2027 : 8 jours calmes (2 → 9 janvier) = gagné ; 7 = raté
  await run('janvier-8-gagne', '2027-02-01T12:00:00', journal('2026-11-01', '2027-02-01', k => !(k >= '2027-01-02' && k <= '2027-01-09')), 'janvier', 2027);
  await run('janvier-7-rate', '2027-02-01T12:00:00', journal('2026-11-01', '2027-02-01', k => !(k >= '2027-01-02' && k <= '2027-01-08')), 'janvier', 2027);
  await run('janvier-1er-ne-compte-pas', '2027-02-01T12:00:00', journal('2026-11-01', '2027-02-01', k => !(k >= '2027-01-01' && k <= '2027-01-08')), 'janvier', 2027);
  // Soldes d'hiver 2027 : du mer. 13/01 au mar. 09/02 ; budget Sorties 100 €/mois au prorata → 93,4 € × 80 % = 74,7 €
  await run('soldes-hiver-70-gagne', '2027-02-10T12:00:00', journal('2026-11-01', '2027-02-10', tous, [['2027-01-20', 'Sorties', 40], ['2027-02-05', 'Bricoles', 30]]), 'soldes', 2027);
  await run('soldes-hiver-80-rate', '2027-02-10T12:00:00', journal('2026-11-01', '2027-02-10', tous, [['2027-01-20', 'Sorties', 40], ['2027-02-05', 'Bricoles', 40]]), 'soldes', 2027);
  await run('soldes-hors-periode-ignore', '2027-02-10T12:00:00', journal('2026-11-01', '2027-02-10', tous, [['2027-01-12', 'Sorties', 90], ['2027-02-10', 'Sorties', 90]]), 'soldes', 2027);
  await run('soldes-ete-gagne', '2027-07-28T12:00:00', journal('2026-11-01', '2027-07-28', tous, [['2027-01-20', 'Sorties', 95], ['2027-07-10', 'Sorties', 50]]), 'soldes', 2027);
  // Saint-Valentin 2027 : Sorties (100) + Restaurants (150) = 250 € de budget en février
  await run('valentin-240-gagne', '2027-03-02T12:00:00', journal('2026-11-01', '2027-03-02', tous, [['2027-02-14', 'Restaurants', 140], ['2027-02-20', 'Sorties', 100]]), 'valentin', 2027);
  await run('valentin-260-rate', '2027-03-02T12:00:00', journal('2026-11-01', '2027-03-02', tous, [['2027-02-14', 'Restaurants', 160], ['2027-02-20', 'Sorties', 100]]), 'valentin', 2027);
  await run('valentin-en-cours', '2027-02-15T12:00:00', journal('2026-11-01', '2027-02-15', tous, [['2027-02-14', 'Restaurants', 140]]), 'valentin', 2027);
  // Grand ménage 2027 : abonnement arrêté fin mars (échéancier) = gagné dès mars ; sinon raté en avril ; bouton en mars
  const abo = (i, g) => [{ ligne: 6, lib: 'Streaming', cat: 'Streaming', montant: 13.49, freq: 'Mensuel', jour: 1, f: 1, g, h: null, i, pause: false }];
  await run('menage-fin-mars-gagne', '2027-03-10T12:00:00', journal('2026-11-01', '2027-03-10', tous), 'menage', 2027, {}, abo(2027, 3));
  await run('menage-fin-juin-rate', '2027-04-02T12:00:00', journal('2026-11-01', '2027-04-02', tous), 'menage', 2027, {}, abo(2027, 6));
  await run('menage-ancien-arret-2026', '2027-04-02T12:00:00', journal('2026-11-01', '2027-04-02', tous), 'menage', 2027, {}, abo(2026, 12));
  await run('menage-bouton', '2027-03-15T12:00:00', journal('2026-11-01', '2027-03-15', tous), 'menage', 2027, {}, abo(null, 12),
    `(() => { const c = [...document.querySelectorAll('[data-act="menage-ok"]')]; S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'defis'; rendre(); const bt = document.querySelector('[data-act="menage-ok"]'); if (!bt) return 'pas de bouton'; bt.click(); const d = SAISONS_EV.find(x => x.id === 'menage'); const e = etatSaisonEv(d, 2027, new Map(joursJeu())); return { ok: e.ok, pref: JSON.stringify(getPref('jeu', {}).menage) }; })()`);
  await run('menage-bouton-fevrier-ne-compte-pas', '2027-04-02T12:00:00', journal('2026-11-01', '2027-04-02', tous), 'menage', 2027, { jeu: { anticipe: true, menage: ['2027-02-27'] } }, abo(null, 12));
  // Rentrée 2027 : tous les budgets de septembre tenus (Courses 300, Restaurants 150, Sorties 100)
  await run('rentree-gagne', '2027-10-02T12:00:00', journal('2026-11-01', '2027-10-02', tous, [['2027-09-10', 'Courses', 290], ['2027-09-12', 'Restaurants', 100]]), 'rentree', 2027);
  await run('rentree-rate', '2027-10-02T12:00:00', journal('2026-11-01', '2027-10-02', tous, [['2027-09-10', 'Courses', 310]]), 'rentree', 2027);
  // Black Friday 2026 : jeudi 26/11 → lundi 30/11
  await run('bf-gagne', '2026-12-01T12:00:00', journal('2026-11-01', '2026-12-01', tous, [['2026-11-25', 'Sorties', 30], ['2026-12-01', 'Bricoles', 20], ['2026-11-27', 'Courses', 40]]), 'blackfriday', 2026);
  await run('bf-divers-rate', '2026-12-01T12:00:00', journal('2026-11-01', '2026-12-01', tous, [['2026-11-28', 'Bricoles', 9]]), 'blackfriday', 2026);
  await run('bf-en-ligne-rate', '2026-12-01T12:00:00', journal('2026-11-01', '2026-12-01', tous, [['2026-11-30', 'Courses', 25, { enLigne: true }]]), 'blackfriday', 2026, {}, null,
    `(() => { const e = S.journal.find(x => x.date === '2026-11-30' && x.cat === 'Courses' && x.lib !== 'Pain'); const avant = e.enLigne; e.enLigne = true; memo = new Map(); S._jeu = null; const r = etatSaisonEv(SAISONS_EV.find(x => x.id === 'blackfriday'), 2026, new Map(joursJeu())); return { champServeurConserve: avant === true, ok: r.ok, rate: r.rate, info: r.info }; })()`);
  await run('bf-2027-dates', '2027-11-20T12:00:00', journal('2026-11-01', '2027-11-20', tous), 'blackfriday', 2027);
  // Éditions : Janvier léger réussi 2027, 2028, 2029 (puis 2030) → bronze, argent, or (+ ambiance dorée), puis une étoile
  for (const [y, att] of [[2027, 1], [2028, 2], [2029, 3], [2030, 4]]) {
    const J = journal('2026-11-01', (y) + '-02-01', k => !(k.slice(5, 7) === '01' && k.slice(8) >= '02' && k.slice(8) <= '12'));
    const { p, ctx, errs } = await page(b, y + '-02-01T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true });
    R['edition-' + y] = await p.evaluate(att => { const n = editionsDe('janvier'), d = SAISONS_EV.find(x => x.id === 'janvier');
      const o = { attendu: att, editions: n, nom: nomEdition(n), nivEcusson: nivEdition(n), etoiles: etoilesEdition(n), xpJanvier: etatJeu().rec.find(r => r[0] === 'Janvier léger')[3],
        ambiance: debloque(tousCosm().find(o => o.id === 'janvier'), 1), ambianceOr: debloque(tousCosm().find(o => o.id === 'janvier-or'), 1) };
      S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'succes'; rendre(); const g = [...document.querySelectorAll('.evgrid')][1]; o.grille = g ? [...g.children].map(x => x.innerText.replace(/\n/g, ' ')).filter(t => /Janvier/.test(t)).join('') : '';
      return o; }, att);
    if (y === 2030) { await p.evaluate(() => { const g = [...document.querySelectorAll('.evgrid')][1]; g.scrollIntoView(); }); await p.waitForTimeout(400); await p.screenshot({ path: SP + 'editions-2030.png' }); }
    if (y === 2029) { await p.evaluate(() => { LS.set('cos_ambiance', 'janvier-or'); appliquerCosmetiques(); S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'defis'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(400); R['edition-2029'].ambOr = await p.evaluate(() => document.documentElement.dataset.amb + '/' + document.documentElement.dataset.ambor); await p.screenshot({ path: SP + 'ambiance-janvier-or.png' }); }
    ERR.push(...errs); await ctx.close(); }
  // Trop tôt : 1,5 mois d'historique très vertueux (aucun des nouveaux succès), et vue par thème + collection en capture
  { const J = journal('2026-11-01', '2026-12-14', () => false, [['2026-11-03', 'Livret A', 1200], ['2026-12-03', 'Livret A', 1200]]);
    const { p, ctx, errs } = await page(b, '2026-12-14T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true, controles: [{ date: '05/11', mois: 'nov. 2026', ecart: 3, solde: 1000 }, { date: '02/12', mois: 'déc. 2026', ecart: 0, solde: 1200 }] });
    R.tropTot = await p.evaluate(() => { const nv = ['jours-21', 'an-jours-100', 'an-jours-150', 'an-jours-200', 'avent-3', 'budgets-3', 'mois-leger-3', 'semaine-legere', 'controle-6', 'saisie-3', 'epargne-6', 'fidele-saisons-1', 'fidele-saisons-2', 'fidele-saisons-3', 'mieux-an'];
      const e = etatJeu(); return { nbSucces: SUCCES.length, gagnesNouveaux: e.succes.filter(s => nv.includes(s.id) && s.ok).map(s => s.id), progres: e.succes.filter(s => nv.includes(s.id)).map(s => s.id + ' ' + s.cur + '/' + s.max).join(' · '),
        supprimes: ['jours-30', 'jours-60', 'jours-90', 'jours-tot-100', 'jours-tot-200', 'jours-tot-365'].filter(id => SUCCES.some(s => s.id === id) || AFFICHES[id]), sansAffiche: SUCCES.filter(s => !AFFICHES[s.id]).map(s => s.id),
        niv: e.niv, xp: e.xp, rang: e.rang, titre: e.titre }; });
    await p.evaluate(() => { S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'succes'; rendre(); document.querySelector('[data-act="svue"][data-t="theme"]').click(); });
    await p.waitForTimeout(200);
    R.theme = await p.evaluate(() => ({ memo: LS.get('succesVue'), themes: [...document.querySelectorAll('.sthh')].map(x => x.innerText.replace(/\n/g, ' ')),
      tous: THEMES_SUC.map(t => t[0] + ':' + SUCCES.filter(s => themeSucces(s.id) === t[0]).length).join(' '),
      ordreOK: THEMES_SUC.every(t => { const L = etatJeu().succes.filter(s => themeSucces(s.id) === t[0]).sort((a, b) => (DN[a.d] - DN[b.d]) || (a.max - b.max)); return L.every((s, i) => !i || DN[L[i - 1].d] <= DN[s.d]); }) }));
    await p.evaluate(() => { document.querySelector('[data-act="sthm"][data-t="calme"]').click(); }); await p.waitForTimeout(200);
    R.themeCalme = await p.evaluate(() => [...document.querySelectorAll('.sthm.on .suc b')].map(x => x.innerText).join(' | '));
    await p.evaluate(() => { const z = document.querySelector('.sthm'); z.scrollIntoView(); scrollBy(0, -120); }); await p.waitForTimeout(500);
    await p.screenshot({ path: SP + 'succes-theme.png' });
    await p.evaluate(() => { scrollTo(0, 0); }); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'succes-niveau.png' });
    await p.evaluate(() => { S.progT = 'style'; S.collT = 'ambiance'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(500); await p.screenshot({ path: SP + 'collection-ambiance.png', fullPage: true });
    await p.evaluate(() => { S.collT = 'titre'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'collection-titres.png', fullPage: true });
    await p.evaluate(() => { S.collT = 'accent'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'collection-accents.png', fullPage: true });
    // vue mémorisée après rechargement
    await p.reload(); await p.waitForTimeout(1800); R.themeApresRecharge = await p.evaluate(() => { document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'succes'; rendre(); return (document.querySelector('[data-act="svue"].on') || {}).innerText; });
    ERR.push(...errs); await ctx.close(); }
  // Carte « nouvelle échelle » : ancien utilisateur (nivVu posé, pas de echelle100) → carte une fois
  { const J = journal('2026-11-01', '2026-12-14', k => k.slice(8) % 3 === 0);
    const { p, ctx, errs } = await page(b, '2026-12-14T12:00:00', J, {}, { nivVu: 9, xpVu: 900, xpDetail: {}, prestVu: 0 });
    R.echelle = await p.evaluate(() => ({ vuApresChargement: LS.get('echelle100'), nivVu: LS.get('nivVu') }));
    R.echelle.carte = await p.evaluate(() => { LS.set('echelle100', false); LS.set('nivVu', 9); annoncerJeu(); return (document.querySelector('#gains') || {}).innerText; });
    R.echelle.deuxiemeFois = await p.evaluate(() => { document.querySelectorAll('#gains').forEach(x => x.remove()); annoncerJeu(); return (document.querySelector('#gains') || { innerText: '' }).innerText; });
    ERR.push(...errs); await ctx.close(); }
  console.log(JSON.stringify(R, null, 1)); console.log('ERREURS:', ERR.length ? ERR : 'aucune'); await b.close();
})();
