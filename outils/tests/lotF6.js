// Lot F6 : espèces (« Payé en espèces », retrait au distributeur, banque / espèces après contrôle)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'f6');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const srv = {
  journal: [{ row: 5, mois: 'Novembre 2026', lib: 'Café', cat: 'Courses', montant: 3, date: '2026-11-02', especes: true }],
  soldes: { '2026': 1000 }, controle: { mois: '', solde: null, especes: null }, prefs: { jeu: { jd: [['2026-11-07', '2026-11-15']], jdMig: 1 } }, calls: [], adds: [] // jd fixé : même jeu sur toutes les copies (Clément n'a pas le voyage par défaut)
};
function donnees() {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: JSON.parse(JSON.stringify(srv.soldes)), debut: null,
    echeancier: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }],
    // comme le vrai script : especes n'apparaît que s'il est vrai
    journal: srv.journal.map(l => { const o = Object.assign({}, l); if (!o.especes) delete o.especes; return o; }),
    libres: 5, controle: Object.assign({}, srv.controle), avenir: [], defis: {}, prefs: JSON.parse(JSON.stringify(srv.prefs)), url: 'x', apiVersion: '5.10', anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com')) {
      const q = JSON.parse(r.request().postData()); srv.calls.push(q.action);
      let res = { ok: true };
      if (q.action === 'data') res = { ok: true, data: donnees() };
      else if (q.action === 'add') { srv.adds.push(q.ligne); const row = 5 + srv.journal.length; srv.journal.push({ row, mois: q.ligne.mois, lib: q.ligne.lib, cat: q.ligne.cat, montant: q.ligne.montant, date: q.ligne.date, especes: q.ligne.especes === true }); res = { ok: true, row }; }
      else if (q.action === 'update') { const l = srv.journal.find(x => x.row === q.row); if (l) Object.assign(l, q.ligne, { especes: typeof q.ligne.especes === 'boolean' ? q.ligne.especes : l.especes }); }
      else if (q.action === 'solde-dep') srv.soldes[String(q.annee)] = q.valeur;
      else if (q.action === 'solde-ctrl') srv.controle = { mois: q.mois, solde: q.solde, especes: q.especes || null };
      else if (q.action === 'pref-set') { const t = JSON.stringify(q.valeur); if (t.length > 8000) res = { ok: false, error: 'INVALIDE', message: 'Trop de données.' }; else if (q.valeur == null) delete srv.prefs[q.cle]; else srv.prefs[q.cle] = JSON.parse(t); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    }
    if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' });
  });
  const pre = html.includes("'jauge.' + k") ? 'jauge.' : (html.match(/localStorage.getItem\('([^']+)'/) || [])[1];
  await p.addInitScript(([pre, api]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem(pre + 'key', JSON.stringify('k')); localStorage.setItem(pre + 'api', JSON.stringify(api)); localStorage.setItem(pre + 'apiDefautVu', JSON.stringify(api)); localStorage.setItem(pre + 'tutoVu', 'true'); } }, [pre, API]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  const attendreFile = async () => { for (let i = 0; i < 40; i++) { if (await p.evaluate(() => !S.queue.length && !S.busy)) return; await p.waitForTimeout(250); } };
  const etat = () => p.evaluate(() => { const t = soldeCalcule(now.getFullYear(), now.getMonth() + 1), s = partageSolde(t); S.jmode = 'solde'; S.tab = 'home'; S.y = now.getFullYear(); S.m = now.getMonth() + 1; rendre(true); const l = document.querySelector('.gauge .lbl'); return { total: Math.round(t * 100) / 100, banque: s.banque, especes: s.esp, neg: s.neg, jauge: l ? l.innerText.replace(/\s+/g, ' ').trim() : null }; });
  const R = {};
  R.avant = await etat(); // ancienne ligne « espèces » sans contrôle : avertissement attendu
  // 1) contrôle 1800 banque + 50 espèces (par l'interface)
  await p.evaluate(() => { ouvrirSolde(); ouvrirSheet(); });
  await p.fill('#sheetIn [data-f=banque]', '1800'); await p.fill('#sheetIn [data-f=especes]', '50');
  await p.click('#sheetIn [data-act=s-ok]'); await attendreFile();
  R.controle1 = Object.assign(await etat(), { prefServeur: JSON.parse(JSON.stringify(srv.prefs.especes || null)) });
  // 2) dépense 12 € payée en espèces (par l'interface), datée aujourd'hui après le contrôle
  await p.evaluate(() => ouvrirSaisie()); await p.waitForTimeout(300);
  await p.click('#sheetIn [data-act=cat][data-cat=Courses]');
  await p.click('#sheetIn .pad [data-k="1"]'); await p.click('#sheetIn .pad [data-k="2"]');
  await p.click('#sheetIn [data-act=esp]'); await p.waitForTimeout(200);
  R.saisieHint = await p.evaluate(() => document.querySelector('#esphint').innerText);
  await p.screenshot({ path: path.join(SHOTS, 'saisie-especes.png') });
  await p.click('#sheetIn [data-act=save]'); await attendreFile();
  R.envoiAdd = srv.adds.map(a => ({ lib: a.lib, montant: a.montant, especes: a.especes }));
  R.depense = await etat();
  await p.evaluate(() => rafraichir(true)); await p.waitForTimeout(1500);
  R.relu = await p.evaluate(() => S.journal.filter(e => e.montant === 12).map(e => ({ row: e.row, especes: e.especes })));
  R.apresRelecture = await etat();
  R.journal = await p.evaluate(() => { S.tab = 'journal'; rendre(true); return [...document.querySelectorAll('#liste .jl')].map(x => x.innerText.replace(/\s+/g, ' ').trim()); });
  // fiche d'édition : l'interrupteur reflète l'état
  R.edition = await p.evaluate(() => { ouvrirSaisie(S.journal.find(e => e.montant === 12)); const c = document.querySelector('#sheetIn [data-act=esp]'); const r = { on: c.classList.contains('on'), txt: c.innerText }; fermer(); return r; });
  // 3) retrait de 40 € (par l'interface, depuis Mon solde)
  await p.evaluate(() => { ouvrirSolde(); ouvrirSheet(); });
  await p.click('#sheetIn [data-act=ret-open]'); await p.fill('#rm', '40');
  await p.screenshot({ path: path.join(SHOTS, 'retrait-form.png') });
  await p.click('#sheetIn [data-act=ret-ok]'); await attendreFile();
  await p.screenshot({ path: path.join(SHOTS, 'mon-solde.png'), fullPage: false });
  R.ticket = await p.evaluate(() => [...document.querySelectorAll('#sheetIn .ticket .tl')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  R.champEspecesApresRetrait = await p.evaluate(() => document.querySelector('#sheetIn [data-f=especes]').value);
  await p.evaluate(() => fermer()); await p.waitForTimeout(600);
  R.retrait = Object.assign(await etat(), { retraitsServeur: JSON.parse(JSON.stringify(srv.prefs.especes.r)) });
  await p.screenshot({ path: path.join(SHOTS, 'jauge-solde.png') });
  // 4) nouveau contrôle : la liste des retraits repart de zéro
  await p.evaluate(() => { ouvrirSolde(); ouvrirSheet(); });
  R.prerempli = await p.evaluate(() => document.querySelector('#sheetIn [data-f=especes]').value);
  await p.fill('#sheetIn [data-f=banque]', '1760'); await p.click('#sheetIn [data-act=s-ok]'); await attendreFile();
  R.controle2 = Object.assign(await etat(), { prefServeur: JSON.parse(JSON.stringify(srv.prefs.especes)) });
  console.log(JSON.stringify(R, null, 1));
  const ok = R.controle1.banque === 1800 && R.controle1.especes === 50 && /SUR TES COMPTES AUJOURD.HUI estimé \(\+ espèces 50.€\)/.test(R.controle1.jauge)
    && R.depense.especes === 38 && R.depense.banque === 1800 && R.depense.total === R.controle1.total - 12
    && R.retrait.especes === 78 && R.champEspecesApresRetrait === '78' && R.retrait.banque === 1760 && R.retrait.total === R.depense.total
    && R.controle2.prefServeur.r.length === 0 && R.envoiAdd.some(a => a.especes === true) && R.relu.length === 1 && R.relu[0].especes === true
    && R.edition.on && R.journal.some(t => /espèces/.test(t)) && R.avant.neg === true;
  console.log('VERDICT:', ok ? 'OK' : 'ÉCHEC'); console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
