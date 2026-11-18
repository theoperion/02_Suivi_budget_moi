const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const DIR = process.argv[2];
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith('http://app.test/')) return r.fulfill({ path: path.join(DIR, 'index.html') }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"error":"CLE"}' }); });
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(1000);
  const R = await p.evaluate(() => {
    const out = {};
    S.data = { categories: [{ nom: 'Salaire', groupe: 'Revenus', type: 'Revenu' }, { nom: 'Assurance', groupe: 'Charges fixes', type: 'Dépense' }, { nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' }, { nom: 'Avances', groupe: 'Avances', type: 'Avance' }],
      echeancier: [], avenir: [], soldes: { '2026': 1000 }, defis: {}, prefs: {}, mois: [] };
    S.journal = [];
    const t = { lib: 'Assurance', cat: 'Assurance', montant: 30, freq: 'Trimestriel', jour: 5, f: 11, g: 12, h: null, i: null };
    out.C1_trimestriel_sans_annee = [1,2,3,4,5,6,7,8,9,10,11,12].filter(m => echMontant(t, 2027, m, true));
    const a = { lib: 'Box', cat: 'Assurance', montant: 100, freq: 'Annuel', jour: 5, f: 12, g: 12, h: null, i: null };
    // C2 : simule « arrêter après » en novembre 2026
    now = new Date(2026, 10, 5); const st = Object.assign({}, a, { i: now.getFullYear(), g: now.getMonth() + 1 });
    out.C2_annuel_arrete_nov = { dec2026: echMontant(st, 2026, 12, true), dec2025: echMontant(st, 2025, 12, true) };
    S.data.echeancier = [{ id: 'e1', lib: 'Loyer', cat: 'Assurance', montant: 500, freq: 'Mensuel', jour: 31, f: 1, g: 12, h: null, i: null }];
    memo = new Map(); out.C4_jour31_avril = occurrences(2026, 4).map(o => o.jour);
    S.form = { partage: true, noms: ['Léa', 'Tom'], part: '' }; window.montantNum = () => 10; // 10 € à 3
    try { out.C6_10e_a_3 = partage(); } catch (e) { out.C6_10e_a_3 = String(e); }
    S.form = null;
    S.data.soldes = { '2026': 1000 }; memo = new Map();
    out.C7_solde_janvier_2027 = soldeDepart(2027); out.C7_fin_2026 = soldeFin(2026, 12);
    return out;
  });
  console.log(JSON.stringify(R)); console.log('ERREURS:', errs.length ? errs : 'aucune'); await b.close();
})();
