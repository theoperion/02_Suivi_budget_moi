// Lot G2 (adapté 9.6 / lot H2 : plus d'option « achat en ligne ») : achats plaisir (liste d'envies, petits achats, achat en ligne, prix en heures de travail, enveloppe plaisir)
// (l'ancien lotG2.js « mode d'emploi / aides » est gardé sous lotG2-aides.js)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'g2achats');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const J = (row, mois, lib, cat, montant, date, x) => Object.assign({ row, mois: mois + ' 2026', lib, cat, montant, date }, x || {});
const srv = {
  journal: [
    // octobre : 5 petits achats jusqu'au 18, un le 25, un à 45 €
    J(5, 'Octobre', 'Pain', 'Courses', 10, '2026-10-02'), J(6, 'Octobre', 'BD', 'Loisirs', 12, '2026-10-05'), J(7, 'Octobre', 'Gadget', 'Divers', 8, '2026-10-10'),
    J(8, 'Octobre', 'Marché', 'Courses', 25, '2026-10-15'), J(9, 'Octobre', 'Café', 'Courses', 5, '2026-10-18'), J(10, 'Octobre', 'Livre', 'Loisirs', 15, '2026-10-25'), J(11, 'Octobre', 'Plein', 'Courses', 45, '2026-10-12'),
    // novembre : 4 petits achats (3 + 12 + 12 + 10 = 37 €) ; 30 € pile et 40 € ne comptent pas
    J(12, 'Novembre', 'Café', 'Courses', 3, '2026-11-02'), J(13, 'Novembre', 'Ciné', 'Loisirs', 12, '2026-11-08'), J(14, 'Novembre', 'Cadeau', 'Courses', 30, '2026-11-03'),
    J(15, 'Novembre', 'Bowling', 'Loisirs', 12, '2026-11-16'), J(16, 'Novembre', 'Courses', 'Courses', 40, '2026-11-17'), J(17, 'Novembre', 'Appli', 'Divers', 10, '2026-11-18')],
  prefs: {}, calls: [], adds: [], updates: [], prefsSet: []
};
function donnees() {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
      { ligne: 13, nom: 'Divers', groupe: 'Divers', type: 'Dépense', budget: 30, suivi: 'Mensuel' },
      { ligne: 14, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' },
      { ligne: 15, nom: 'Avances (on me doit)', groupe: 'Avances', type: 'Dépense', budget: null, suivi: 'Sans alerte' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }],
    // comme le vrai script : especes / enLigne n'apparaissent que s'ils sont vrais (espèces l'emporte)
    journal: srv.journal.map(l => { const o = Object.assign({}, l); if (!o.especes) delete o.especes; if (!o.enLigne || o.especes) delete o.enLigne; return o; }),
    libres: 5, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: JSON.parse(JSON.stringify(srv.prefs)), url: 'x', apiVersion: '5.11', anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-18T10:00:00+01:00')); // mercredi
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com')) {
      const q = JSON.parse(r.request().postData()); srv.calls.push(q.action);
      const un = o => {
        if (o.action === 'data') return { ok: true, data: donnees() };
        if (o.action === 'add') { srv.adds.push(o.ligne); const row = 5 + srv.journal.length; srv.journal.push({ row, mois: o.ligne.mois, lib: o.ligne.lib, cat: o.ligne.cat, montant: o.ligne.montant, date: o.ligne.date, especes: o.ligne.especes === true, enLigne: o.ligne.especes !== true && o.ligne.enLigne === true }); return { ok: true, row }; }
        if (o.action === 'update') { srv.updates.push(o.ligne); const l = srv.journal.find(x => x.row === o.row); if (l) { Object.assign(l, { mois: o.ligne.mois, lib: o.ligne.lib, cat: o.ligne.cat, montant: o.ligne.montant }); if (typeof o.ligne.especes === 'boolean' || typeof o.ligne.enLigne === 'boolean') { l.especes = o.ligne.especes === true; l.enLigne = !l.especes && o.ligne.enLigne === true; } } return { ok: true, row: o.row }; }
        if (o.action === 'pref-set') { const t = JSON.stringify(o.valeur); srv.prefsSet.push({ cle: o.cle, long: t.length }); if (t.length > 8000) return { ok: false, error: 'INVALIDE', message: 'Trop de données.' }; if (o.valeur == null) delete srv.prefs[o.cle]; else srv.prefs[o.cle] = JSON.parse(t); return { ok: true }; }
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
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  const attendre = async () => { for (let i = 0; i < 60; i++) { if (await p.evaluate(() => !S.queue.length && !S.busy)) return; await p.waitForTimeout(250); } };
  const txt = s => p.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, s);
  const accueil = async () => { await p.evaluate(() => { fermer(); S.tab = 'home'; S.y = now.getFullYear(); S.m = now.getMonth() + 1; rendre(true); }); return txt('.achb'); };
  const R = {}, ok = {};
  // l'horloge est figée : on l'avance de quelques secondes avant chaque ENREGISTRER (anti double appui de 1,2 s)
  let T = Date.parse('2026-11-18T10:00:00+01:00'); const tic = async () => { T += 5000; await p.clock.setFixedTime(new Date(T)); };
  // ---------- B · petits achats, E · enveloppe ----------
  R.accueil = await accueil();
  R.B = await p.evaluate(() => { const a = petitsAchats(2026, 11, 18), o = petitsAchats(2026, 10, 18); return { n: a.n, total: a.total, oct: o.n, octTotal: o.total, txt: comparePetits().txt }; });
  ok.B = R.B.n === 4 && R.B.total === 37 && R.B.oct === 4 && R.B.txt === "autant qu'en octobre" && /PETITS ACHATS CE MOIS 4 · 37 €/.test(R.accueil) && /autant qu'en octobre/.test(R.accueil);
  R.E = await p.evaluate(() => enveloppePlaisir());
  ok.E = R.E.env === 30 && R.E.auto === 30 && R.E.dep === 22 && R.E.reste === 8 && R.E.lundi === '2026-11-16' && /il te reste 8 € cette semaine/.test(R.accueil);
  await p.evaluate(() => { const e = document.querySelector('.achb'); e.previousElementSibling.scrollIntoView(); scrollBy(0, -90); }); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(SHOTS, 'accueil.png') });
  await p.click('[data-act=petits]'); await p.waitForTimeout(300);
  R.feuillePetits = await p.$$eval('#sheetIn .up', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok.Bliste = R.feuillePetits.length === 4;
  await p.screenshot({ path: path.join(SHOTS, 'feuille-petits.png') });
  // ---------- D · taux horaire 15 €/h ----------
  await p.click('#sheetIn [data-act=achats-reglages]'); await p.waitForTimeout(300);
  await p.fill('#sheetIn [data-f=taux]', '15');
  await p.screenshot({ path: path.join(SHOTS, 'feuille-reglages-achats.png') });
  await p.click('#sheetIn [data-act=ach-ok]'); await attendre();
  R.prefTaux = srv.prefs.envies && srv.prefs.envies.r;
  await p.evaluate(() => ouvrirSaisie()); await p.waitForTimeout(300);
  await p.click('#sheetIn [data-act=cat][data-cat=Courses]');
  for (const k of ['3', '3', ',', '7', '5']) await p.click(`#sheetIn .pad [data-k="${k}"]`);
  R.D = await txt('#hhint');
  ok.D = !!R.prefTaux && R.prefTaux.taux === 15 && R.D === '≈ 2 h 15 de travail' && await p.evaluate(() => heuresTravail(6.25, 15) === '≈ 25 min' && heuresTravail(10, 0) === '');
  // ---------- C (9.6) : option « achat en ligne » retirée ; espèces seules ----------
  for (let i = 0; i < 5; i++) await p.click('#sheetIn .pad [data-k="⌫"]');
  for (const k of ['1', '2', ',', '5']) await p.click(`#sheetIn .pad [data-k="${k}"]`);
  const sansEnl = !(await p.$('#sheetIn [data-act=enl]'));
  await p.click('#sheetIn [data-act=esp]'); const c2 = await p.evaluate(() => S.form.especes); await p.click('#sheetIn [data-act=esp]'); const c3 = await p.evaluate(() => S.form.especes);
  R.Cespeces = { sansEnl, c2, c3 };
  await p.screenshot({ path: path.join(SHOTS, 'saisie-en-ligne-heures.png') });
  await tic(); await p.click('#sheetIn [data-act=save]'); await attendre();
  R.Cenvoi = srv.adds.map(a => ({ lib: a.lib, montant: a.montant, especes: a.especes, aEnLigne: 'enLigne' in a }));
  await p.evaluate(() => rafraichir(true)); await p.waitForTimeout(1500);
  R.Cjournal = await p.evaluate(() => { S.tab = 'journal'; rendre(true); return [...document.querySelectorAll('#liste .jl')].map(x => x.innerText.replace(/\s+/g, ' ').trim()).filter(t => /en ligne|📦/.test(t)); });
  await p.evaluate(() => { ouvrirSaisie(S.journal.find(e => e.montant === 12.5)); ouvrirSheet(); });
  await p.click('#sheetIn [data-act=esp]'); await tic(); await p.click('#sheetIn [data-act=save]'); await attendre();
  R.Cupdate = srv.updates.map(u => ({ especes: u.especes, aEnLigne: 'enLigne' in u }));
  ok.C = sansEnl && c2 === true && c3 === false && R.Cenvoi.some(a => a.montant === 12.5 && a.especes === false && !a.aEnLigne) && R.Cjournal.length === 0
    && R.Cupdate.some(u => u.especes === true && !u.aEnLigne);
  await p.waitForTimeout(1800); // remet la ligne en carte bancaire (comme l'original remettait « en ligne »)
  await p.evaluate(() => { ouvrirSaisie(S.journal.find(x => x.montant === 12.5)); }); await p.click('#sheetIn [data-act=esp]'); await tic(); await p.click('#sheetIn [data-act=save]'); await attendre();
  R.accueilC = await accueil(); ok.Ccarte = /5 · 50 €/.test(R.accueilC) && !/en ligne/.test(R.accueilC);
  // ---------- A · liste d'envies ----------
  await p.click('[data-act=envies]'); await p.waitForTimeout(300);
  await p.fill('#sheetIn [data-f=lib]', 'Casque Bluetooth'); await p.fill('#sheetIn [data-f=prix]', '45');
  R.Aheures = await txt('#envh');
  await p.click('#sheetIn [data-act=env-add]'); await attendre();
  await p.fill('#sheetIn [data-f=lib]', 'Jeu vidéo'); await p.fill('#sheetIn [data-f=prix]', '20'); await p.click('#sheetIn [data-act=env-cat][data-cat=Loisirs]');
  await p.click('#sheetIn [data-act=env-add]'); await attendre();
  R.Apref1 = JSON.parse(JSON.stringify(srv.prefs.envies));
  R.Astats1 = await p.evaluate(() => enviesStats());
  await p.screenshot({ path: path.join(SHOTS, 'feuille-envies-attente.png') });
  await p.clock.setFixedTime(new Date('2026-11-24T10:00:00+01:00'));
  R.Astats6j = await p.evaluate(() => { rendre(true); return enviesStats(); });
  await p.clock.setFixedTime(new Date('2026-11-25T10:00:00+01:00')); T = Date.parse('2026-11-25T10:00:00+01:00');
  R.Astats7j = await p.evaluate(() => { fermer(); rendre(true); return enviesStats(); });
  R.accueilA = await accueil();
  await p.click('[data-act=envies]'); await p.waitForTimeout(300);
  R.Aboutons = await p.evaluate(() => ({ ach: document.querySelectorAll('#sheetIn [data-act=env-ach]').length, ren: document.querySelectorAll('#sheetIn .envm [data-act=env-ren]').length }));
  await p.screenshot({ path: path.join(SHOTS, 'feuille-envies-mures.png') });
  const xpAvant = await p.evaluate(() => { S._etat = null; return etatJeu().xp; });
  const idCasque = R.Apref1.l.find(x => x.l === 'Casque Bluetooth').i, idJeu = R.Apref1.l.find(x => x.l === 'Jeu vidéo').i;
  await p.click(`#sheetIn [data-act=env-ren][data-i="${idCasque}"]`); await attendre();
  R.Astats2 = await p.evaluate(() => enviesStats());
  R.Axp = (await p.evaluate(() => { S._etat = null; return etatJeu().xp; })) - xpAvant;
  await p.click(`#sheetIn [data-act=env-ach][data-i="${idJeu}"]`); await p.waitForTimeout(300);
  R.Asaisie = await p.evaluate(() => ({ mode: S.form.mode, montant: S.form.montant, lib: S.form.lib, cat: S.form.cat, envie: !!S.form.envie }));
  await tic(); await p.click('#sheetIn [data-act=save]'); await attendre();
  R.Aachat = srv.adds.filter(a => a.lib === 'Jeu vidéo').map(a => ({ montant: a.montant, cat: a.cat }));
  R.Astats3 = await p.evaluate(() => enviesStats());
  // renoncer avant le délai
  await p.evaluate(() => ouvrirEnvies()); await p.fill('#sheetIn [data-f=lib]', 'Coque'); await p.fill('#sheetIn [data-f=prix]', '15'); await p.click('#sheetIn [data-act=env-add]'); await attendre();
  const idCoque = srv.prefs.envies.l.find(x => x.l === 'Coque').i;
  await p.screenshot({ path: path.join(SHOTS, 'feuille-envies-attente2.png') });
  await p.click(`#sheetIn .envw [data-act=env-ren][data-i="${idCoque}"]`); await attendre();
  R.Astats4 = await p.evaluate(() => enviesStats());
  R.Apref2 = JSON.parse(JSON.stringify(srv.prefs.envies));
  { const h = await p.evaluate(() => document.querySelector('#sheetIn').scrollHeight); await p.setViewportSize({ width: 390, height: Math.min(4000, h + 60) }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOTS, 'feuille-envies-historique.png') }); await p.setViewportSize({ width: 390, height: 844 }); }
  // compactage : 300 envies décidées → < 7000 caractères, rien de perdu dans les compteurs
  R.Acompact = await p.evaluate(() => { const q = { l: [], ren: { n: 0, eco: 0 }, ach: { n: 0, eco: 0 }, r: {} }; for (let i = 0; i < 300; i++) q.l.push({ i: 'x' + i, l: 'Envie numéro ' + i + ' assez longue', p: 10, c: 'Loisirs', d: '2026-01-01', s: i % 2 ? 'ren' : 'ach', f: '2026-01-08', x: '2026-01-0' + (1 + i % 9) });
    const c = compacterEnvies(q), ren = c.l.filter(x => x.s === 'ren').length + c.ren.n; return { long: JSON.stringify(c).length, gardees: c.l.length, ren, eco: c.ren.eco + c.l.filter(x => x.s === 'ren').length * 10 }; });
  ok.A = R.Apref1.l.length === 2 && R.Apref1.l.every(x => x.s === 'att' && x.d === '2026-11-18' && x.f === '2026-11-25') && R.Apref1.l.find(x => x.l === 'Jeu vidéo').c === 'Loisirs'
    && R.Aheures === '≈ 3 h de travail' && R.Astats1.attente === 2 && R.Astats1.mures === 0 && R.Astats6j.mures === 0 && R.Astats7j.mures === 2
    && /2 MÛRES/.test(R.accueilA) && R.Aboutons.ach === 2 && R.Aboutons.ren === 2
    && R.Astats2.renoncees === 1 && R.Astats2.economise === 45 && R.Axp === 10
    && R.Asaisie.mode === 'add' && R.Asaisie.montant === '20' && R.Asaisie.lib === 'Jeu vidéo' && R.Asaisie.cat === 'Loisirs' && R.Asaisie.envie
    && R.Aachat.length === 1 && R.Aachat[0].montant === 20 && R.Astats3.achetees === 1 && R.Astats3.mures === 0
    && R.Astats4.renoncees === 2 && R.Astats4.economise === 60 && R.Apref2.l.filter(x => x.s === 'ren').length === 2
    && R.Acompact.long < 7000 && R.Acompact.ren === 150 && R.Acompact.eco === 1500
    && srv.prefsSet.every(x => x.cle !== 'envies' || x.long < 7000);
  // mode discret : les montants du bloc sont floutés
  R.discret = await p.evaluate(() => { LS.set('discret', true); fermer(); S.tab = 'home'; rendre(true); const s = document.querySelector('.achb .tl span:last-child'), v = document.querySelector('.achb .achv'); return [getComputedStyle(s).filter, v ? getComputedStyle(v).filter : null]; });
  await p.evaluate(() => { document.querySelector('.achb').previousElementSibling.scrollIntoView(); scrollBy(0, -90); }); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(SHOTS, 'accueil-discret.png') });
  ok.discret = R.discret.every(f => /blur/.test(f || ''));
  await p.evaluate(() => { LS.set('discret', false); rendre(true); });
  // dépassement de l'enveloppe (la semaine du 23 : Jeu vidéo 20 € + concert 30 € > 30 €)
  srv.journal.push(J(99, 'Novembre', 'Concert', 'Loisirs', 30, '2026-11-25')); await p.evaluate(() => rafraichir(true)); await p.waitForTimeout(1500);
  R.depasse = await accueil(); ok.Edepasse = /dépassé de 20 €/.test(R.depasse);
  await p.evaluate(() => { document.querySelector('.achb').previousElementSibling.scrollIntoView(); scrollBy(0, -90); }); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(SHOTS, 'accueil-depasse.png') });
  // ---------- Remboursement d'avance reçu en espèces ----------
  const argent = () => p.evaluate(() => { const t = soldeCalcule(now.getFullYear(), now.getMonth() + 1), s = partageSolde(t); return { total: Math.round(t * 100) / 100, banque: s.banque, especes: s.esp }; });
  const a0 = await argent();
  await p.evaluate(() => { fermer(); ouvrirSaisie(); }); await p.waitForTimeout(300);
  await p.click('#sheetIn [data-act=cat][data-cat=Courses]');
  for (const k of ['1', '0', '0']) await p.click(`#sheetIn .pad [data-k="${k}"]`);
  await p.click('#sheetIn [data-act=partage]'); await p.fill('#pnouv', 'Léa'); await p.click('#sheetIn [data-act=pajout]');
  await tic(); await p.click('#sheetIn [data-act=save]'); await attendre();
  const a1 = await argent();
  await accueil(); await p.click('[data-act=remb][data-n="Léa"]'); await p.waitForTimeout(300);
  await p.click('#sheetIn [data-act=remb-esp]');
  await p.screenshot({ path: path.join(SHOTS, 'remboursement-especes.png') });
  await p.click('#sheetIn [data-act=remb-ok]'); await attendre();
  const a2 = await argent();
  await p.waitForTimeout(1800); await p.evaluate(() => rafraichir(true)); await p.waitForTimeout(1500);
  const a3 = await argent();
  R.remb = { a0, a1, a2, a3, envoi: srv.adds.filter(a => /Avances/.test(a.cat)).map(a => ({ lib: a.lib, montant: a.montant, especes: a.especes })),
    relu: await p.evaluate(() => S.journal.filter(e => /Avances/.test(e.cat)).map(e => ({ montant: e.montant, especes: e.especes }))) };
  const d = (x, y) => Math.round((x - y) * 100) / 100;
  ok.rembEspeces = d(a1.total, a0.total) === -100 && d(a1.especes, a0.especes) === 0 && d(a1.banque, a0.banque) === -100
    && d(a3.total, a0.total) === -50 && d(a3.especes, a0.especes) === 50 && d(a3.banque, a0.banque) === -100 && JSON.stringify(a2) === JSON.stringify(a3)
    && R.remb.envoi.some(a => a.montant === 50 && !a.especes) && R.remb.envoi.some(a => a.montant === -50 && a.especes === true)
    && R.remb.relu.some(e => e.montant === -50 && e.especes === true);
  console.log(JSON.stringify(R, null, 1));
  console.log('CONTRÔLES:', JSON.stringify(ok));
  console.log('VERDICT:', Object.values(ok).every(Boolean) ? 'OK' : 'ÉCHEC'); console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
