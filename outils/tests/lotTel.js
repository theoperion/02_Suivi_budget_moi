// Moteur téléphone (moteur.js, phase 2) testé dans un vrai navigateur, sans réseau ni Google :
// A aller-retour (import → « data » identique), B chaque écriture, C rechargement (données gardées),
// D panne d'enregistrement (rien d'appliqué, OCCUPE), E envoi rejoué (pas de doublon).
// Usage : node outils/tests/lotTel.js <dossier de l'appli>   → « VERDICT: OK » et « ERREURS JS: aucune »
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2] || '.');
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js'); // base.js lit index.html au chargement
const OK = {}, R = {};
const ok = (k, v, info) => { OK[k] = !!v; if (!v) R[k] = info; };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.fulfill({ status: 404, body: '' });
    if (u.pathname === '/page-test.html') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script src="moteur.js"></script>' });
    const f = path.join(DIR, decodeURIComponent(u.pathname)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : 'text/html' }); });
  await p.goto('http://app.test/page-test.html');

  const journal = B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3'), [['2026-11-04', 'Restaurants', 32.5, { especes: true }], ['2026-11-06', 'Sorties', 12, { enLigne: true }]]);
  const ech = [{ ligne: 5, lib: 'Assurance', cat: 'Transport', montant: 45, freq: 'Mensuel', jour: 10, f: 1, g: 12, h: null, i: null, pause: false },
               { ligne: 7, lib: 'Taxe', cat: 'Bricoles', montant: 300, freq: 'Annuel', jour: 15, f: 10, g: 12, h: 2026, i: null, pause: false }];
  const src = Object.assign({}, {
    categories: B.CATS.concat([{ ligne: 21, nom: 'Remboursements prêts', groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' }]), mois: [2026, 2027].flatMap(y => B.MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: '2026-01-01',
    echeancier: ech, journal, libres: 31 - B.CATS.length - 1, controle: { mois: 'Octobre', solde: 1234.5, especes: 20 },
    avenir: [{ row: 4, mois: 'Décembre 2026', lib: 'Cadeaux', cat: 'Bricoles', montant: 80, fait: false, jour: null }],
    defis: { '2026-11': { cat: 'Restaurants', montant: 100 } }, prefs: { jeu: { a: 1 }, envies: { l: [] } }, apiVersion: '5.14' });

  const res = await p.evaluate(async src => {
    const out = {}; const M = new MoteurTelephone('test.');
    await M.importer(src, 'k');
    const data = async () => (await M.appel({ action: 'data', key: 'k' })).data;
    out.cleFausse = await M.appel({ action: 'data', key: 'x' });
    out.d0 = await data();
    const A = async (action, x) => M.appel(Object.assign({ action, key: 'k' }, x));
    const L = (lib, montant, o) => Object.assign({ mois: 'Novembre 2026', lib, cat: 'Courses', montant, date: '2026-11-18' }, o || {});
    out.add = await A('add', { ligne: L('Marché', 23.4, { uid: 'u1', especes: true }) });
    out.addBis = await A('add', { ligne: L('Marché', 23.4, { uid: 'u1', especes: true }) });   // rejoué : pas de doublon
    out.addMauvais = await A('add', { ligne: L('X', -5) });
    out.addMoisInconnu = await A('add', { ligne: L('X', 5, { mois: 'Mars 2031' }) });
    const r = out.add.row;
    out.upd = await A('update', { row: r, attendu: { mois: 'Novembre 2026', lib: 'Marché', cat: 'Courses', montant: 23.4 }, ligne: L('Marché bio', 25, { date: '2026-11-17', especes: false }) });
    out.updChange = await A('update', { row: r, attendu: { mois: 'Novembre 2026', lib: 'Faux', cat: 'Courses', montant: 1 }, ligne: L('Y', 1) });
    const d1 = await data(); out.ligneModifiee = d1.journal.find(l => l.row === r);
    const cible = d1.journal.find(l => l.row === 7);
    out.del = await A('delete', { row: 7, attendu: cible, uid: 'd1' });
    out.delBis = await A('delete', { row: 7, attendu: cible, uid: 'd1' });                  // rejoué : la ligne suivante n'est pas supprimée
    const d2 = await data(); out.nbAvant = d1.journal.length; out.nbApres = d2.journal.length; out.decalee = d2.journal.find(l => l.row === r - 1);
    out.echNew = await A('ech-save', { row: null, e: { lib: 'Netflix', cat: 'Streaming', montant: 13.49, freq: 'Mensuel', jour: 3 }, uid: 'e1' });
    out.echEdit = await A('ech-save', { row: 5, attendu: { lib: 'Assurance', cat: 'Transport', montant: 45 }, e: { lib: 'Assurance auto', cat: 'Transport', montant: 47, freq: 'Mensuel', jour: 10 } });
    out.echDel = await A('ech-del', { row: 7, attendu: { lib: 'Taxe', cat: 'Bricoles', montant: 300 } });
    out.av = await A('av-save', { row: null, a: { mois: 'Janvier 2027', lib: 'Vélo', cat: 'Sorties', montant: 200, jour: 5 }, uid: 'a1' });
    out.avPaye = await A('av-paye', { row: 4, attendu: { lib: 'Cadeaux', cat: 'Bricoles', montant: 80 }, ligne: L('Cadeaux', 80, { cat: 'Bricoles', mois: 'Novembre 2026' }) });
    out.budget = await A('budget', { nom: 'Courses', budget: 320, suivi: 'Sans alerte' });
    out.catAdd = await A('cat-add', { nom: 'Santé', groupe: 'Vie courante', budget: 40, suivi: 'Mensuel' });
    out.catRetrait = await A('cat-add', { nom: 'Retrait livret', groupe: 'Épargne', budget: 0, suivi: 'Sans alerte' });
    out.catEdit = await A('cat-edit', { ancien: 'Sorties', nom: 'Sorties & ciné', groupe: 'Loisirs' });
    out.catDelUtilisee = await A('cat-del', { nom: 'Restaurants' });
    out.catDel = await A('cat-del', { nom: 'Restaurants', cible: 'Sorties & ciné' });
    out.ctrl = await A('solde-ctrl', { mois: 'Novembre', solde: 1500, especes: 30 });
    out.dep = await A('solde-dep', { annee: 2027, valeur: 2000 });
    out.defi = await A('defi', { mois: '2026-12', cat: 'Courses', montant: 250 });
    out.pref = await A('pref-set', { cle: 'tirelires', valeur: [{ n: 'Voyage', m: 50 }] });
    out.prefTrop = await A('pref-set', { cle: 'jeu', valeur: 'x'.repeat(9000) });
    out.lot = await A('lot', { ops: [{ action: 'add', ligne: L('Pain', 1.2, { uid: 'l1' }) }, { action: 'add', ligne: L('Z', 0) }, { action: 'add', ligne: L('Lait', 0.99, { uid: 'l2' }) }] });
    out.d3 = await data(); out.rev = M.revision();
    // C : « rechargement » = nouveau moteur, lu depuis la mémoire du téléphone
    const M2 = new MoteurTelephone('test.'); out.d4 = (await M2.appel({ action: 'data', key: 'k' })).data; out.rev2 = M2.revision();
    // D : panne d'enregistrement → OCCUPE, rien d'appliqué, puis ça repasse
    const vrai = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new Error('disque plein'); };
    out.panne = await M2.appel({ action: 'add', key: 'k', ligne: L('Panne', 9, { uid: 'p1' }) });
    IDBObjectStore.prototype.put = vrai;
    out.apresPanne = (await M2.appel({ action: 'data', key: 'k' })).data.journal.filter(l => l.lib === 'Panne').length;
    out.reessai = await M2.appel({ action: 'add', key: 'k', ligne: L('Panne', 9, { uid: 'p1' }) });
    out.final = (await M2.appel({ action: 'data', key: 'k' })).data.journal.filter(l => l.lib === 'Panne').length;
    // liste de mois trop courte (s'arrête en juin 2026) : le moteur la prolonge jusqu'à décembre de l'an prochain
    const court = JSON.parse(JSON.stringify(src)); court.mois = court.mois.slice(0, 6); court.journal = court.journal.filter(l => /2026/.test(l.mois) && ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'].some(m => l.mois.startsWith(m))); court.avenir = [];
    const M3 = new MoteurTelephone('court.'); await M3.importer(court, 'k');
    const d5 = (await M3.appel({ action: 'data', key: 'k' })).data;
    out.moisCourt = { premier: d5.mois[0], dernier: d5.mois[d5.mois.length - 1], n: d5.mois.length };
    out.ajoutFutur = await M3.appel({ action: 'add', key: 'k', ligne: L('Plus tard', 5, { mois: 'Mars 2027' }) });
    out.soldeAnSuivant = await M3.appel({ action: 'solde-dep', key: 'k', annee: new Date().getFullYear() + 1, valeur: 10 });
    // alertes : charge déjà dans l'Échéancier (assurance 47 € ce mois-ci, saisie à 46 €), doublon, ✓ qui valide
    const Ma = new MoteurTelephone('anom.'); const sa = JSON.parse(JSON.stringify(src)); const mo = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][new Date().getMonth()] + ' ' + new Date().getFullYear();
    sa.journal = [{ row: 5, mois: mo, lib: 'Assurance auto', cat: 'Transport', montant: 46, date: null }, { row: 6, mois: mo, lib: 'Pain', cat: 'Courses', montant: 1, date: null }, { row: 7, mois: mo, lib: 'Pain', cat: 'Courses', montant: 1, date: null }, { row: 8, mois: mo, lib: 'Assurance auto ✓', cat: 'Transport', montant: 45, date: null }];
    sa.soldes = { [new Date().getFullYear()]: 1000 }; sa.avenir = [];
    await Ma.importer(sa, 'k'); out.anom = (await Ma.appel({ action: 'data', key: 'k' })).data.anomalies;
    // autre appli (préfixe différent) : rien
    out.autre = await new MoteurTelephone('autre.').appel({ action: 'data', key: 'k' });
    return out;
  }, src);

  // A : aller-retour
  const sans = d => { const x = JSON.parse(JSON.stringify(d)); delete x.lu; delete x.url; delete x.anomalies; return x; };
  const attendu = sans(Object.assign({}, src, { url: '' }));
  const d0 = sans(res.d0);
  ok('A_mois', src.mois.every((m, i) => d0.mois[i] === m) && d0.mois[d0.mois.length - 1] === 'Décembre ' + (new Date().getFullYear() + 1), d0.mois.slice(-3));
  ['categories', 'soldes', 'debut', 'echeancier', 'journal', 'libres', 'controle', 'avenir', 'defis', 'prefs', 'apiVersion'].forEach(k =>
    ok('A_' + k, JSON.stringify(d0[k]) === JSON.stringify(attendu[k]), { recu: JSON.stringify(d0[k]).slice(0, 300), attendu: JSON.stringify(attendu[k]).slice(0, 300) }));
  ok('A_cle', res.cleFausse.ok === false && res.cleFausse.error === 'CLE', res.cleFausse);
  // B : écritures
  ok('B_add', res.add.ok && res.add.row === journal.length + 5, res.add);
  ok('B_addRejoue', res.addBis.ok && res.addBis.deja === true && res.addBis.row === res.add.row, res.addBis);
  ok('B_refus', !res.addMauvais.ok && !res.addMoisInconnu.ok, [res.addMauvais, res.addMoisInconnu]);
  ok('B_update', res.upd.ok && res.ligneModifiee && res.ligneModifiee.lib === 'Marché bio' && res.ligneModifiee.montant === 25 && res.ligneModifiee.date === '2026-11-17' && !res.ligneModifiee.especes, res.ligneModifiee);
  ok('B_updateChange', res.updChange.error === 'CHANGE', res.updChange);
  ok('B_delete', res.del.ok && res.del.decale === true && res.nbApres === res.nbAvant - 1 && res.decalee && res.decalee.lib === 'Marché bio', { del: res.del, n: [res.nbAvant, res.nbApres], dec: res.decalee });
  ok('B_deleteRejoue', res.delBis.ok && res.delBis.deja === true, res.delBis);
  const d3 = res.d3;
  ok('B_ech', res.echNew.ok && res.echNew.row === 6 && res.echEdit.ok && res.echDel.ok && d3.echeancier.map(e => e.lib + ':' + e.montant).join('|') === 'Assurance auto:47|Netflix:13.49', d3.echeancier);
  ok('B_avenir', res.av.ok && res.avPaye.ok && d3.avenir.some(a => a.lib === 'Vélo' && a.mois === 'Janvier 2027' && a.jour === 5) && d3.avenir.some(a => a.lib === 'Cadeaux' && a.fait === true) && d3.journal.some(l => l.lib === 'Cadeaux'), d3.avenir);
  const cat = n => d3.categories.find(c => c.nom === n);
  ok('B_budget', cat('Courses').budget === 320 && cat('Courses').suivi === 'Sans alerte', cat('Courses'));
  ok('B_catAdd', res.catAdd.ok && cat('Santé') && cat('Santé').type === 'Dépense' && cat('Santé').budget === 40 && d3.libres === src.libres - 1 - 1 + 1, { r: res.catAdd, c: cat('Santé'), libres: d3.libres });
  ok('B_catEdit', res.catEdit.ok && cat('Sorties & ciné') && !cat('Sorties') && d3.journal.filter(l => l.cat === 'Sorties').length === 0 && d3.journal.some(l => l.cat === 'Sorties & ciné'), res.catEdit);
  ok('B_catDel', res.catDelUtilisee.error === 'UTILISEE' && res.catDel.ok && !cat('Restaurants') && d3.journal.filter(l => l.cat === 'Restaurants').length === 0 && d3.defis['2026-11'].cat === 'Sorties & ciné', { u: res.catDelUtilisee, d: res.catDel, defis: d3.defis });
  ok('B_soldes', d3.controle.mois === 'Novembre' && d3.controle.solde === 1500 && d3.controle.especes === 30 && d3.soldes['2027'] === 2000 && d3.soldes['2026'] === 1000, { c: d3.controle, s: d3.soldes });
  ok('B_defi', d3.defis['2026-12'] && d3.defis['2026-12'].montant === 250, d3.defis);
  ok('B_prefs', JSON.stringify(d3.prefs.tirelires) === '[{"n":"Voyage","m":50}]' && res.prefTrop.ok === false && JSON.stringify(d3.prefs.jeu) === '{"a":1}', { p: d3.prefs, t: res.prefTrop });
  ok('B_lot', res.lot.ok && res.lot.res.length === 3 && res.lot.res[0].ok && !res.lot.res[1].ok && res.lot.res[2].ok, res.lot);
  ok('B_especesEnLigne', d3.journal.some(l => l.lib === 'Restaurants' && l.especes) && d3.journal.some(l => l.lib === 'Sorties' && l.cat === 'Sorties & ciné' && l.enLigne), null);
  const fin = new Date().getFullYear() + 1;
  ok('B_typesRetrait', cat('Remboursements prêts') && cat('Remboursements prêts').type === 'Retrait' && cat('Retrait livret') && cat('Retrait livret').type === 'Retrait' && cat('Livret A').type === 'Épargne', [cat('Remboursements prêts'), cat('Retrait livret'), cat('Livret A')]);
  ok('B_moisProlonges', res.moisCourt.premier === 'Janvier 2026' && res.moisCourt.dernier === 'Décembre ' + fin && res.ajoutFutur.ok && res.soldeAnSuivant.ok, { m: res.moisCourt, a: res.ajoutFutur, s: res.soldeAnSuivant });
  ok('B_anomalies', /3 ANOMALIE/.test(res.anom) && /Déjà dans l'Échéancier \?  —  Journal, ligne 5/.test(res.anom) && /Doublon possible  —  Journal, ligne 6/.test(res.anom) && /Doublon possible  —  Journal, ligne 7/.test(res.anom) && !/ligne 8/.test(res.anom), res.anom);
  // C : rechargement
  ok('C_recharge', JSON.stringify(sans(res.d4)) === JSON.stringify(sans(d3)) && res.rev2 === res.rev && res.rev > 1, { rev: [res.rev, res.rev2] });
  // D : panne
  ok('D_panne', res.panne.ok === false && res.panne.error === 'OCCUPE' && res.apresPanne === 0 && res.reessai.ok && res.final === 1, { panne: res.panne, apres: res.apresPanne, reessai: res.reessai, final: res.final });
  ok('E_autreAppli', res.autre.ok === false && res.autre.error === 'SANS_CLE', res.autre);

  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
