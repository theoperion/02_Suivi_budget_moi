// Lot H2 : bouton retour (History), saisie compacte, accueil (achats plaisir en bas, plus de lien mode d'emploi),
// taux horaire automatique, courbe « solde prévu » avec un budget annuel dépassé.
// usage : node lotH2.js <copie> [dossier captures] [parties séparées par des virgules : courbe,retour,saisie,accueil,taux]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'h2'), PARTS = (process.argv[4] || 'courbe,retour,saisie,accueil,taux').split(',');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const J = (row, mois, lib, cat, montant, date) => ({ row, mois: mois + ' 2026', lib, cat, montant, date });
const srv = {
  journal: [
    J(5, 'Août', 'Paie', 'Salaire', 1961, '2026-08-28'), J(6, 'Septembre', 'Paie', 'Salaire', 1961, '2026-09-28'),
    J(7, 'Octobre', 'Paie', 'Salaire', 1961, '2026-10-28'), J(8, 'Novembre', 'Courses', 'Courses', 100, '2026-11-03'),
    // budget annuel Voyage 600 € (50 €/mois) entièrement dépassé en novembre
    J(9, 'Novembre', 'Billets avion', 'Voyage', 650, '2026-11-05')],
  prefs: {}, adds: [], prefsSet: []
};
function donnees() {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
      { ligne: 13, nom: 'Voyage', groupe: 'Loisirs', type: 'Dépense', budget: 50, suivi: 'Annuel' },
      { ligne: 14, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }],
    journal: srv.journal.map(l => Object.assign({}, l)),
    libres: 5, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: JSON.parse(JSON.stringify(srv.prefs)), url: 'x', apiVersion: '5.11', anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: 'Europe/Paris', hasTouch: false }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-16T10:00:00+01:00'));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com')) {
      const q = JSON.parse(r.request().postData());
      const un = o => {
        if (o.action === 'data') return { ok: true, data: donnees() };
        if (o.action === 'add') { srv.adds.push(o.ligne); return { ok: true, row: 100 + srv.adds.length }; }
        if (o.action === 'pref-set') { srv.prefsSet.push(o.cle); if (o.valeur == null) delete srv.prefs[o.cle]; else srv.prefs[o.cle] = JSON.parse(JSON.stringify(o.valeur)); return { ok: true }; }
        return { ok: true };
      };
      let res;
      if (q.action === 'lot') { const ops = q.ops || q.lot || q.envois || []; const l = ops.map(o => un(Object.assign({ action: o.action }, o.payload || o))); res = { ok: true, res: l, resultats: l }; } else res = un(q);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    }
    if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' });
  });
  await p.addInitScript(([api]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('jauge.key', JSON.stringify('k')); localStorage.setItem('jauge.api', JSON.stringify(api)); localStorage.setItem('jauge.apiDefautVu', JSON.stringify(api)); localStorage.setItem('jauge.tutoVu', 'true'); } }, [API]);
  // page précédente dans l'historique (comme le lanceur du téléphone) pour voir si « retour » quitte l'appli
  await p.goto('http://app.test/avant.html'); await p.evaluate(() => { document.body.innerHTML = 'AVANT'; });
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  const attendre = async () => { for (let i = 0; i < 60; i++) { if (await p.evaluate(() => !S.queue.length && !S.busy)) return; await p.waitForTimeout(250); } };
  const txt = s => p.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/[\s\u00a0\u202f]+/g, ' ').trim() : null; }, s);
  const R = {}, ok = {};

  // ---------- 5 · courbe « solde prévu » ----------
  if (PARTS.includes('courbe')) {
    R.courbe = await p.evaluate(() => {
      const pts = courbeSolde(), at = (m, j) => { const x = pts.find(q => q.m === m && q.j === j); return x ? Math.round(x.s * 100) / 100 : null; };
      const bn = bilan(2026, 11), bd = bilan(2026, 12);
      return { nov: { budVar: bn.budVar, vr: bn.vr, prevVar: bn.prevVar, resteBud: bn.resteBud, fin: Math.round(bn.fin) },
        dec: { budVar: bd.budVar, prevVar: bd.prevVar, resteBud: bd.resteBud },
        s16: at(11, 16), s17: at(11, 17), s30: at(11, 30), s1dec: at(12, 1), s31: at(12, 31),
        penteNov: Math.round((at(11, 29) - at(11, 30)) * 100) / 100, penteDec: Math.round((at(12, 10) - at(12, 11)) * 100) / 100 };
    });
    await p.evaluate(() => { S.tab = 'home'; rendre(); }); await p.waitForTimeout(800);
    const pb = await p.$('.pbas'); if (pb) { await pb.scrollIntoViewIfNeeded(); await pb.screenshot({ path: path.join(SHOTS, 'courbe.png') }); }
  }

  // ---------- 1 · bouton retour ----------
  if (PARTS.includes('retour')) {
    const etat = () => p.evaluate(() => ({ url: location.pathname, tab: S.tab, sheet: document.querySelector('#sheet').classList.contains('on'), mode: S.form && S.form.mode, plein: !!document.querySelector('#plein.on'), story: !!document.querySelector('.story'), corps: document.body.innerText.length > 50 }));
    const back = async () => { await p.goBack({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400); return etat(); };
    const Rr = R.retour = {};
    await p.click('.fab'); await p.waitForTimeout(300); Rr.saisieOuverte = await etat();
    Rr.b1 = await back();                                 // ferme la saisie
    Rr.b2 = await back();                                 // déjà sur l'accueil : reste (avertissement)
    await p.click('[data-act="tab:journal"]'); await p.waitForTimeout(300);
    await p.click('[data-act="tab:prevu"]'); await p.waitForTimeout(300);
    Rr.b3 = await back();                                 // prévu → accueil
    // plusieurs ouvertures/fermetures au bouton ✕
    for (let i = 0; i < 3; i++) { await p.click('.fab'); await p.waitForTimeout(250); await p.click('#sheetIn [data-act=close]'); await p.waitForTimeout(250); }
    await p.click('[data-act=gear]'); await p.waitForTimeout(300); Rr.reglages = await etat();
    Rr.b4 = await back();                                 // ferme les réglages
    await p.click('.fab'); await p.waitForTimeout(250);
    Rr.b5 = await back();
    await p.click('[data-act="tab:stats"]'); await p.waitForTimeout(300);
    await p.click('.fab'); await p.waitForTimeout(250);
    Rr.b6 = await back();                                 // ferme la feuille, reste sur stats
    Rr.b7 = await back();                                 // stats → accueil
    // plein écran (affiche de succès) au-dessus d'une feuille
    await p.evaluate(() => { S.form = { mode: 'videotheque' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(300);
    const aff = await p.$('#sheetIn [data-act=plein]'); if (aff) { await aff.click(); await p.waitForTimeout(300); }
    Rr.pleinOuvert = await etat();
    Rr.b8 = await back();                                 // ferme le plein écran, la feuille reste
    Rr.b9 = await back();                                 // ferme la feuille
    // story
    await p.evaluate(() => { const sl = slidesMois(2026, 10); lancerStory(sl.length ? sl : [{ bg: '#000', k: 'T', big: 'X' }]); }); await p.mouse.click(5, 400); await p.waitForTimeout(200);
    Rr.storyOuverte = await etat();
    Rr.b10 = await back();
    Rr.b11 = await back();                                // accueil : reste
    Rr.b12 = await back();                                // 9.15 : reste dans l'appli
    await back(); await back(); Rr.b13 = await back();   // plusieurs retours rapides : toujours l'appli, page non vide
    ok.retour = Rr.saisieOuverte.sheet && !Rr.b1.sheet && Rr.b1.url === '/index.html' && Rr.b2.url === '/index.html' && Rr.b2.tab === 'home' && Rr.b2.corps
      && Rr.b3.tab === 'home' && Rr.b3.url === '/index.html' && Rr.reglages.sheet && !Rr.b4.sheet && Rr.b4.url === '/index.html' && !Rr.b5.sheet && Rr.b5.url === '/index.html'
      && !Rr.b6.sheet && Rr.b6.tab === 'stats' && Rr.b7.tab === 'home' && Rr.b7.url === '/index.html'
      && (!aff || (Rr.pleinOuvert.plein && !Rr.b8.plein && Rr.b8.sheet && !Rr.b9.sheet && Rr.b9.url === '/index.html'))
      && Rr.storyOuverte.story && !Rr.b10.story && Rr.b10.url === '/index.html' && Rr.b11.url === '/index.html' && Rr.b12.url === '/index.html' && Rr.b13.url === '/index.html' && Rr.b13.corps;
    await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  }

  // ---------- 2 · saisie compacte ----------
  if (PARTS.includes('saisie')) {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.click('.fab'); await p.waitForTimeout(400);
    await p.click('#sheetIn [data-act=cat][data-cat=Courses]');
    for (const k of ['1', '2', ',', '5']) await p.click(`#sheetIn .pad [data-k="${k}"]`);
    await p.screenshot({ path: path.join(SHOTS, 'saisie-844.png') });
    R.saisie844 = await p.evaluate(() => ({ amt: getComputedStyle(document.querySelector('#amt')).fontSize, haut: document.querySelector('#sheet').getBoundingClientRect().height, tout: document.querySelector('#sheet').scrollHeight }));
    // clavier ouvert : viewport réduit à 390 × 450, libellé en focus
    await p.click('#lib'); await p.setViewportSize({ width: 390, height: 450 }); await p.waitForTimeout(500);
    await p.keyboard.type('Marché');
    await p.screenshot({ path: path.join(SHOTS, 'saisie-450-clavier.png') });
    R.saisie450 = await p.evaluate(() => { const vis = s => { const e = document.querySelector(s); if (!e) return 'absent'; const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1; };
      return { amt: vis('#amt'), cats: vis('#sheetIn [data-act=cat][data-cat=Courses]'), lib: vis('#lib'), date: vis('#sheetIn .dsrow'), save: vis('#sheetIn [data-act=save]'), pad: getComputedStyle(document.querySelector('#sheetIn .pad')).display }; });
    ok.saisie450 = Object.entries(R.saisie450).every(([k, v]) => k === 'pad' || v === true);
    // on touche ENREGISTRER directement depuis le libellé
    await p.clock.setFixedTime(new Date(Date.parse('2026-11-16T10:00:10+01:00')));
    await p.click('#sheetIn [data-act=save]'); await attendre();
    R.saisieEnvoi = srv.adds.map(a => ({ lib: a.lib, cat: a.cat, montant: a.montant, enLigne: a.enLigne }));
    ok.saisieEnvoi = R.saisieEnvoi.length === 1 && R.saisieEnvoi[0].lib === 'Marché' && R.saisieEnvoi[0].montant === 12.5 && !('enLigne' in srv.adds[0]);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
    R.enLigneUI = await p.evaluate(() => { ouvrirSaisie(); const x = !!document.querySelector('#sheetIn [data-act=enl]'); fermer(); return x; });
    ok.sansEnLigne = !R.enLigneUI && !/📦/.test(await p.evaluate(() => { S.tab = 'journal'; rendre(); return document.querySelector('#view').innerText; }));
    await p.evaluate(() => { S.tab = 'home'; rendre(); });
  }

  // ---------- 3 · accueil ----------
  if (PARTS.includes('accueil')) {
    await p.evaluate(() => { fermer(); S.tab = 'home'; rendre(); }); await p.waitForTimeout(500);
    R.accueil = await p.evaluate(() => { const secs = [...document.querySelectorAll('#view .sec')].map(s => s.innerText.split('\n')[0].trim()); return { secs, lien: !!document.querySelector('#view [data-act=mode-emploi]'),
      dernier: (() => { const k = [...document.querySelector('#view').children].filter(e => e.offsetHeight); return k.slice(-2).map(e => e.className).join(' / '); })() }; });
    R.reglageAides = await p.evaluate(() => { const a0 = LS.get('regAff', false); LS.set('regAff', true); S.form = { mode: 'reglages' }; rendreForm(); ouvrirSheet(); const t = document.querySelector('#sheetIn').innerText; fermer(); LS.set('regAff', a0); const i = t.indexOf('Aides et explications'); return t.slice(i, i + 160).replace(/\s+/g, ' '); });
    const sx = R.accueil.secs; ok.accueil = sx[sx.length - 1] === 'ACHATS PLAISIR' && !R.accueil.lien && /reste dans ⚙ Réglages/.test(R.reglageAides);
    await p.evaluate(() => scrollTo(0, 1e5)); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(SHOTS, 'accueil-bas.png') });
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, 'accueil-haut.png') });
  }

  // ---------- 4 · taux horaire ----------
  if (PARTS.includes('taux')) {
    R.taux = {};
    R.taux.auto = await p.evaluate(() => { const t = tauxHoraire(); return t; });
    R.taux.a35 = await p.evaluate(() => { const p0 = prefEnvies(); p0.r.hs = 35; sauverEnvies(p0); return tauxHoraire(); });
    await p.evaluate(() => { const p0 = prefEnvies(); delete p0.r.hs; sauverEnvies(p0); });
    await p.evaluate(() => ouvrirReglagesAchats()); await p.waitForTimeout(300);
    R.taux.feuille = await txt('#sheetIn .tauxauto');
    await p.screenshot({ path: path.join(SHOTS, 'reglages-achats-auto.png') });
    // taux manuel
    await p.fill('#sheetIn [data-f=taux]', '15'); await p.click('#sheetIn [data-act=ach-ok]'); await attendre();
    R.taux.manuel = await p.evaluate(() => tauxHoraire());
    R.taux.prefManuel = srv.prefs.envies && srv.prefs.envies.r;
    R.taux.heures = await p.evaluate(() => heuresTravail(30));
    await p.evaluate(() => ouvrirReglagesAchats()); await p.waitForTimeout(300);
    R.taux.feuilleManuel = await txt('#sheetIn .tauxauto');
    await p.screenshot({ path: path.join(SHOTS, 'reglages-achats-manuel.png') });
    await p.click('#sheetIn [data-act=taux-auto]'); await p.waitForTimeout(200);
    await p.click('#sheetIn [data-act=ach-ok]'); await attendre();
    R.taux.retourAuto = await p.evaluate(() => tauxHoraire());
    R.taux.prefAuto = srv.prefs.envies && srv.prefs.envies.r;
    // heures par semaine 35 via la feuille
    await p.evaluate(() => ouvrirReglagesAchats()); await p.waitForTimeout(300);
    await p.fill('#sheetIn [data-f=hs]', '35'); await p.click('#sheetIn [data-act=ach-ok]'); await attendre();
    R.taux.feuille35 = await p.evaluate(() => tauxHoraire());
    // le salaire évolue : novembre payé 2 100 € → le taux suit dès que novembre est terminé (on se place le 2 décembre)
    R.taux.sansHistorique = await p.evaluate(() => { const j = S.journal; S.journal = j.filter(e => !(e.cat === 'Salaire' && e.m < 10)); memo = new Map(); const t = tauxHoraire(); S.journal = j; memo = new Map(); return t; });
    R.taux.echeancier = await p.evaluate(() => { const j = S.journal, c = S.data.categories; S.journal = j.filter(e => e.cat !== 'Salaire'); S.data.categories = c.map(x => x.nom === 'Salaire' ? Object.assign({}, x, { nom: 'Revenus divers' }) : x);
      S.data.echeancier.push({ ligne: 9, lib: 'Paie', cat: 'Revenus divers', montant: 1800, freq: 'Mensuel', jour: 28, f: 1, g: 12, h: null, i: null, pause: false }); memo = new Map(); cacheCats = null;
      const t = tauxHoraire(); S.journal = j; S.data.categories = c; S.data.echeancier.pop(); memo = new Map(); cacheCats = null; return t; });
    const T = R.taux; console.log('DIAG', [T.auto.taux === 11.7, T.auto.auto === true, T.auto.salaire === 1961, T.a35.taux === 12.93, /11,70 €\/h/.test(T.feuille || ''), /1 961 €/.test(T.feuille || ''), T.manuel.taux === 15, T.manuel.auto === false, T.prefManuel.taux === 15, T.heures === '≈ 2 h', T.retourAuto.taux === 11.7, !('taux' in (T.prefAuto || {})), T.feuille35.taux === 12.93, T.sansHistorique.salaire === 1961, T.echeancier.salaire === 1800].join());
    ok.taux = T.auto.taux === 11.7 && T.auto.auto === true && T.auto.salaire === 1961 && T.a35.taux === 12.93 && /11,70 €\/h/.test(T.feuille || '') && /1 961 €/.test(T.feuille || '')
      && T.manuel.taux === 15 && T.manuel.auto === false && T.prefManuel.taux === 15 && T.heures === '≈ 2 h'
      && T.retourAuto.taux === 11.7 && T.retourAuto.auto === true && !('taux' in (T.prefAuto || {})) && T.feuille35.taux === 12.93
      && T.sansHistorique.salaire === 1961 && T.echeancier.salaire === 1800;
  }

  console.log(JSON.stringify(R, null, 1));
  console.log('CONTRÔLES:', JSON.stringify(ok));
  console.log('VERDICT:', Object.values(ok).every(Boolean) ? 'OK' : 'ÉCHEC'); console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
