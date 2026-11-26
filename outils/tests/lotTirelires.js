// (9.49) Tirelires de projet : création, choix dans ÉPARGNE (après le livret), total versé − retiré depuis la création
// (passage d'année compris), Échéancier compté, nom exact (« Japonais » ≠ « Japon »), terminer / supprimer.
// Usage : node outils/tests/lotTirelires.js <dossier de l'appli> [captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
B.CATS.push({ ligne: 20, nom: "Retraits d'épargne", groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' });
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };
(async () => {
  const b = await chromium.launch();
  const extra = [['2026-10-20', 'Livret A', 999, { lib: 'Livret A · Japon' }], // avant la création : ne compte pas
    ['2026-11-10', 'Livret A', 300, { lib: 'Livret A · Japon' }], ['2026-12-05', 'Livret A', 200, { lib: 'LDDS · vacances · japon' }],
    ['2026-12-06', 'Livret A', 50, { lib: 'Livret A · Japonais' }], ['2027-01-08', "Retraits d'épargne", 120, { lib: 'Livret A · Japon' }]];
  const ech = [{ ligne: 5, lib: 'Virement · Japon', cat: 'Livret A', montant: 25, freq: 'Mensuel', jour: 2, f: 1, g: 12, h: null, i: null, pause: false }];
  const prefs = { tirelires: [{ n: 'Japon', o: 2000, d: '2027-06', c: '2026-11', f: false }] };
  const { p, errs } = await B.page(b, '2027-01-15T18:30:00', B.journal('2026-10-01', '2027-01-15', () => false, extra), prefs, {}, ech);
  // A : total depuis nov. 2026 = 300 + 200 + Échéancier (nov., déc., janv. : 3 × 25) − 120 = 455 ; « Japonais » et octobre exclus
  const a = await p.evaluate(() => { const t = tirelires()[0], e = etatTirelire(t); return { total: e.total, n: e.L.length, reste: e.reste, pm: e.parMois, libs: e.L.map(x => x.lib) }; });
  ok('A_total', Math.abs(a.total - 455) < 0.01 && a.n === 6 && Math.abs(a.reste - 1545) < 0.01 && Math.abs(a.pm - 1545 / 6) < 0.01, a);
  // B : section dans Progrès › Défis
  const bb = await p.evaluate(() => { Object.assign(S, { tab: 'stats', statsVue: 'progres', progT: 'defis', y: 2027, m: 1 }); rendre(); return document.querySelector('#view').innerText; });
  ok('B_section', /MES TIRELIRES/.test(bb) && /Japon/.test(bb) && /encore 1\s?545/.test(bb) && /258\s?€\/mois/.test(bb), bb.slice(bb.indexOf('MES TIRELIRES'), bb.indexOf('MES TIRELIRES') + 200));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'tir-progres.png') });
  const ac = await p.evaluate(() => { Object.assign(S, { tab: 'home', y: 2027, m: 1 }); rendre(); return document.querySelector('#view').innerText; });
  ok('B2_accueil', /MES TIRELIRES/.test(ac) && /Japon/.test(ac), ac.slice(ac.indexOf('MES TIRELIRES'), ac.indexOf('MES TIRELIRES') + 120));
  if (SHOTS) { await p.evaluate(() => { const z = [...document.querySelectorAll('.sec')].find(x => /TIRELIRES/.test(x.textContent)); if (z) z.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(SHOTS, 'tir-accueil.png') }); }
  // C : création d'une 2e tirelire, doublon refusé, nom de livret refusé
  const c = await p.evaluate(async () => { const r = {}; Object.assign(S, { tab: 'stats', statsVue: 'progres', progT: 'defis' }); rendre();
    document.querySelector('[data-act="tir-new"]').click(); await new Promise(x => setTimeout(x, 100));
    S.form.n = 'japon'; document.querySelector('[data-act="tir-ok"]').click(); r.dbl = $('#ferr').textContent;
    S.form.n = 'LDDS'; document.querySelector('[data-act="tir-ok"]').click(); r.liv = $('#ferr').textContent;
    S.form.n = 'Baltes'; S.form.o = '1 200'; S.form.d = ''; document.querySelector('[data-act="tir-ok"]').click();
    r.t = tirelires().map(t => [t.n, t.o, t.d, t.c, t.f]); return r; });
  ok('C_creation', /déjà/.test(c.dbl) && /livret/.test(c.liv) && JSON.stringify(c.t[1]) === '["Baltes",1200,null,"2027-01",false]', c);
  // D : choix dans le formulaire ÉPARGNE, avec le livret
  const d = await p.evaluate(() => { ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.sens = 'verser'; S.form.cat = 'Livret A'; rendreForm();
    const t0 = document.querySelector('#sheetIn').innerText; const r = { proj: /POUR UN PROJET/.test(t0) };
    document.querySelector('[data-act="livret"][data-n="Livret A"]').click(); document.querySelector('[data-act="tir-pick"][data-n="Baltes"]').click(); r.a = S.form.lib;
    document.querySelector('[data-act="tir-pick"][data-n="Japon"]').click(); r.b = S.form.lib;
    document.querySelector('[data-act="livret"][data-n="LEP"]').click(); r.c = S.form.lib; r.livret = livretDe(S.form.lib);
    document.querySelector('[data-act="tir-pick"][data-n=""]').click(); r.d = S.form.lib;
    S.form.lib = 'Retrait livret'; S.form.sens = 'retrait'; rendreForm(); document.querySelector('[data-act="tir-pick"][data-n="Japon"]').click(); r.e = S.form.lib; return r; });
  ok('D_formulaire', d.proj && d.a === 'Livret A · Baltes' && d.b === 'Livret A · Japon' && d.c === 'LEP · Japon' && d.livret === 'LEP' && d.d === 'LEP' && d.e === 'Japon', d);
  if (SHOTS) { await p.evaluate(() => { S.form.lib = 'Livret A · Japon'; S.form.sens = 'verser'; rendreForm(); }); await p.screenshot({ path: path.join(SHOTS, 'tir-saisie.png') }); }
  // E : enregistrer un versement → la tirelire monte
  const e = await p.evaluate(() => { S.form.lib = 'Livret A · Japon'; S.form.sens = 'verser'; S.form.cat = 'Livret A'; S.form.montant = '100'; S._saveT = 0; enregistrer(); return etatTirelire(tirelires()[0]).total; });
  ok('E_versement', Math.abs(e - 555) < 0.01, e);
  // F : détail, terminer (plus proposée à la saisie), supprimer (lignes intactes)
  const f = await p.evaluate(async () => { const r = {}; fermer(); S.form = { mode: 'tirdetail', n: 'Japon' }; rendreForm(); ouvrirSheet(); r.det = document.querySelector('#sheetIn').innerText;
    document.querySelector('[data-act="tir-fin"]').click(); r.fin = tirelires().find(t => t.n === 'Japon').f;
    fermer(); ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.sens = 'verser'; S.form.cat = 'Livret A'; rendreForm(); r.chip = !!document.querySelector('[data-act="tir-pick"][data-n="Japon"]');
    fermer(); S.form = { mode: 'tirdetail', n: 'Baltes' }; rendreForm(); ouvrirSheet(); document.querySelector('[data-act="tir-del"]').click(); document.querySelector('[data-act="tir-del"]').click();
    r.reste = tirelires().map(t => t.n); r.lignes = S.journal.filter(x => /Japon/.test(x.lib || '')).length; return r; });
  ok('F_detail_fin_suppr', /555/.test(f.det) && /Japonais/.test(f.det) === false && f.fin === true && !f.chip && JSON.stringify(f.reste) === '["Japon"]' && f.lignes === 5, { fin: f.fin, chip: f.chip, reste: f.reste, lignes: f.lignes, det: f.det.slice(0, 300) });
  // G : sans tirelire, pas de ligne « POUR UN PROJET ? »
  const g = await p.evaluate(() => { fermer(); ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.cat = 'Livret A'; rendreForm(); return /POUR UN PROJET/.test(document.querySelector('#sheetIn').innerText); });
  ok('G_pasDeProjetActif', !g, g);
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
