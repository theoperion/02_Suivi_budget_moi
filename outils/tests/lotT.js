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
  const ouvrir = async () => { await p.evaluate(() => { S.tab = 'home'; rendre(); }); await p.click('.fab'); await p.waitForTimeout(300);
    await p.click('#sheetIn [data-act=type][data-t="Dépense"]'); await p.waitForTimeout(100);
    for (const k of ['3', '0']) await p.click(`#sheetIn .pad [data-k="${k}"]`); await p.click('#sheetIn [data-act=partage]'); await p.waitForTimeout(150); };
  await ouvrir();
  for (const n of ['Carla', 'Clément', 'Léa', 'Kevin', 'Devlin', 'Hugo', 'Inès', 'Max']) { await p.fill('#pnouv', n); await p.click('#sheetIn [data-act=pajout]'); await p.waitForTimeout(120); }
  await attendre(); await p.waitForTimeout(800);
  R.pref = srv.prefs.envies && srv.prefs.envies.pn;
  await p.evaluate(() => fermer());
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  await ouvrir();
  R.apresRecharge = await p.evaluate(() => [...document.querySelectorAll('#sheetIn [data-act=pnom], #sheetIn [data-act=pnom-tous]')].map(b => b.innerText));
  await p.screenshot({ path: path.join(SHOTS, 'noms.png') });
  await p.click('#sheetIn [data-act=pnom-gerer]'); await p.waitForTimeout(150); await p.click('#sheetIn [data-act=pnom-x][data-n="Hugo"]'); await p.waitForTimeout(150);
  await p.click('#sheetIn [data-act=pnom-gerer]'); await p.waitForTimeout(150); await p.click('#sheetIn [data-act=pnom-tous]'); await p.waitForTimeout(150);
  R.apresRetrait = await p.evaluate(() => [...document.querySelectorAll('#sheetIn [data-act=pnom]')].map(b => b.innerText));
  console.log(JSON.stringify(R, null, 1)); console.log('ERREURS JS:', errs.length ? errs : 'aucune'); await b.close();
})();
