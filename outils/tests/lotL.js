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
    J(9, 'Novembre', 'Billets avion', 'Voyage', 650, '2026-11-05'), J(30, 'Janvier', 'Prêt', 'Prêt à des proches', 314.25, '2026-01-10'), J(31, 'Février', 'Prêt', 'Prêt à des proches', 252, '2026-02-10'), J(32, 'Mars', 'Prêt', 'Prêt à des proches', 182.3, '2026-03-10'), J(33, 'Avril', 'Virement PEA', 'Épargne', 300, '2026-04-10'), J(34, 'Juillet', 'Retrait Livret A', "Retraits d'épargne (LEP/Livret A)", 1255.37, '2026-07-10'), J(35, 'Août', 'Remboursé', 'Retrait : prêts remboursés', 100, '2026-08-10')],
  prefs: { objectifs: { '2026': 2000 } }, adds: [], prefsSet: []
};
function donnees() {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
      { ligne: 13, nom: 'Voyage', groupe: 'Loisirs', type: 'Dépense', budget: 50, suivi: 'Annuel' },
      { ligne: 20, nom: 'Épargne', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' }, { ligne: 22, nom: "Retraits d'épargne (LEP/Livret A)", groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' }, { ligne: 23, nom: 'Retrait : prêts remboursés', groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' }, { ligne: 21, nom: 'Prêt à des proches', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: 'Annuel' },
      { ligne: 14, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: [{ ligne: 6, lib: 'Virement livret', cat: 'Épargne', montant: 100, freq: 'Mensuel', jour: 25, f: 1, g: 12, h: null, i: null, pause: false }, { ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }],
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

  R.ep = await p.evaluate(() => ({ bilan: bilanEpargne(2026), ep: epAnnee(2026), etat: etatObjectif(2026) && Math.round(etatObjectif(2026).ep), epVnov: calc(2026, 11).epV, epVjan: calc(2026, 1).epV }));
  await p.evaluate(() => { S.form = { mode: 'objdetail', y: 2026 }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(500);
  R.detail = (await txt('#sheetIn')).slice(-330); await p.evaluate(() => { fermer(); S.tab = 'stats'; rendre(); }); R.home = await p.evaluate(() => { S.tab = 'home'; rendre(); return 1; }); await p.screenshot({ path: path.join(SHOTS, 'objdetail.png') });
  R.bloc = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = blocObjectif(); return d.innerText.replace(/\s+/g, ' '); }); console.log(JSON.stringify(R, null, 1)); console.log('ERREURS JS:', errs.length ? errs : 'aucune'); await b.close();
})();
