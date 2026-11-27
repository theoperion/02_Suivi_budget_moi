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
  const g = await p.evaluate(() => { fermer(); ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.cat = 'Livret A'; rendreForm(); const x = document.querySelector('#sheetIn').innerText; return { projet: /POUR UN PROJET/.test(x), lien: /CRÉER UNE TIRELIRE/.test(x) }; });
  ok('G_pasDeProjetActif', !g.projet && g.lien, g); // toutes terminées : plus de choix, mais le lien de création revient
  // H : image à la création, paliers annoncés une fois, objectif atteint → date gardée → +60 XP (une fois, au plus tôt le mois suivant)
  const h = await p.evaluate(async () => { const r = {}; fermer();
    S.form = { mode: 'tiredit' }; rendreForm(); ouvrirSheet(); document.querySelector('[data-act="tir-e"][data-e="✈️"]').click(); S.form.n = 'Rome'; S.form.o = '300'; document.querySelector('[data-act="tir-ok"]').click();
    const t0 = tirelires().find(t => t.n === 'Rome'); r.e = t0.e; r.c = t0.c;
    // créée en décembre 2026 (pour la récompense), remplie en janvier 2027
    setPref('tirelires', getPref('tirelires').map(t => t.n === 'Rome' ? Object.assign({}, t, { c: '2026-12' }) : t));
    LS.set('tirPal', {}); suiviTirelires(); r.pal0 = LS.get('tirPal', {}).rome;
    const toasts = []; const T0 = window.toast; window.toast = m => toasts.push(m);
    const add = (v, lib) => { ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.sens = 'verser'; S.form.cat = 'Livret A'; S.form.lib = lib; S.form.montant = String(v); S._saveT = 0; enregistrer(); };
    add(160, 'Livret A · Rome'); suiviTirelires(); r.t1 = toasts.slice();
    const xp0 = etatJeu().rec.find(x => /Tirelires remplies/.test(x[0]))[3];
    add(150, 'Livret A · Rome'); suiviTirelires(); r.t2 = toasts.slice(); r.a = tirelires().find(t => t.n === 'Rome').a;
    const xpN = () => etatJeu().rec.find(x => /Tirelires remplies/.test(x[0]))[3]; r.xp = [xp0, xpN()];
    // même mois : une 2e tirelire remplie ne rapporte pas plus (une récompense par mois)
    setPref('tirelires', getPref('tirelires').concat({ n: 'Lyon', o: 200, d: null, c: '2026-12', f: false, e: '🐷' })); add(200, 'Livret A · Lyon'); suiviTirelires(); r.xpMois = xpN();
    // supprimer une tirelire récompensée : l'XP reste
    fermer(); S.form = { mode: 'tirdetail', n: 'Rome' }; rendreForm(); ouvrirSheet(); document.querySelector('[data-act="tir-del"]').click(); document.querySelector('[data-act="tir-del"]').click();
    S._etat = null; memo = new Map(); r.xpSuppr = xpN(); r.visibles = tirelires().map(t => t.n);
    suiviTirelires(); r.t3 = toasts.filter(m => /Rome : objectif atteint/.test(m)).length; window.toast = T0;
    r.lig = ligneTirelire(tirelires(true).find(t => t.n === 'Rome')).includes('✈️'); return r; });
  ok('H_image_paliers_xp', h.e === '✈️' && h.pal0 === 0 && /moitié/.test(h.t1.join()) && /objectif atteint/.test(h.t2.join()) && h.a === '2027-01-15' && h.xp[0] === 0 && h.xp[1] === 1 && h.xpMois === 1 && h.xpSuppr === 1 && !h.visibles.includes('Rome') && h.t3 === 1 && h.lig, h);
  // I : barème selon l'objectif, la plus grosse par mois (nov. 2026 : 2 000 € et 600 € → 150 seulement ; déc. : 600 € → 60)
  const i = await p.evaluate(() => { const T = getPref('tirelires'); setPref('tirelires', T.concat([{ n: 'A1', o: 2000, c: '2026-10', a: '2026-11-20' }, { n: 'A2', o: 600, c: '2026-10', a: '2026-11-25' }, { n: 'A3', o: 600, c: '2026-11', a: '2026-12-03' }]));
    const N = nbTirRecompenses(); setPref('tirelires', T); S._etat = null; return N; });
  ok('I_bareme', JSON.stringify(i) === '[1,1,1]', i); // Rome (300 €, janv. 2027) + A3 (déc.) + A1 (nov.)
  // J : anciennes valeurs de la préférence (ancienne fonction) gardées quand on crée une tirelire
  const j = await p.evaluate(async () => { const r = {}, T = getPref('tirelires');
    for (const [k, v] of [['liste', [{ n: 'Voyage', m: 50 }]], ['objet', { Voyage: 50 }], ['texte', 'x']]) { setPref('tirelires', v); fermer();
      S.form = { mode: 'tiredit', n: 'Rome2' }; rendreForm(); ouvrirSheet(); document.querySelector('[data-act="tir-ok"]').click(); r[k] = JSON.stringify(getPref('tirelires').map(t => [t.n, t.m == null ? null : t.m])); }
    setPref('tirelires', T); return r; });
  ok('J_ancienneValeur', j.liste === '[["Voyage",50],["Rome2",null]]' && j.objet === '[["Voyage",50],["Rome2",null]]' && j.texte === '[["Rome2",null]]', j);
  // K : cochon dessiné, pièce qui tombe seulement si la tirelire a grossi depuis le dernier affichage
  const k = await p.evaluate(async () => { const r = {}, t = tirelires().find(x => x.n === 'Japon'), e = etatTirelire(t);
    LS.set('tirVu', {}); r.sansMemo = monteTir(t, e); LS.set('tirVu', { japon: e.total - 100 }); r.apres = monteTir(t, e) > 0;
    r.svg = /class="tirpiece"/.test(ligneTirelire(t)) && /class="cochon"/.test(ligneTirelire(t));
    suiviTirelires(); r.vu = monteTir(t, e); r.plein = /tirhalo/.test(cochonTir(1, 'x')) && !/tirhalo/.test(cochonTir(0.5, 'x')); return r; });
  ok('K_cochon', k.sansMemo === 0 && k.apres && k.svg && k.vu === 0 && k.plein, k);
  // L : écart « montant réel » au même jour que la ligne de l'Échéancier (Virement · Japon, le 2)
  const l = await p.evaluate(() => { const x = S.data.echeancier[0]; S.form = { mode: 'ech', id: x.id, ctx: { y: 2027, m: 1 }, reel: '40' }; ecartReel(); const e = S.journal[S.journal.length - 1]; return [e.lib, e.date, e.montant]; });
  ok('L_ecartJour', l[1] === '2027-01-02' && Math.abs(l[2] - 15) < 0.01, l);
  // M : image perso (emoji tapé), « Aucune », lettres refusées ; pourcentage qui monte (de → à) ; son coupable
  const m = await p.evaluate(async () => { const r = {}; fermer(); S.form = { mode: 'tirdetail', n: 'Japon' }; rendreForm(); ouvrirSheet();
    $('#tirperso').value = '🦄'; document.querySelector('[data-act="tir-emoji-perso"]').click(); r.perso = tirelires().find(t => t.n === 'Japon').e;
    $('#tirperso').value = 'abc'; document.querySelector('[data-act="tir-emoji-perso"]').click(); r.refus = tirelires().find(t => t.n === 'Japon').e;
    document.querySelector('[data-act="tir-emoji"][data-e=""]').click(); const t = tirelires().find(t => t.n === 'Japon'); r.aucune = t.e; r.titre = document.querySelector('#sheetIn .shead').innerText.trim().startsWith('JAPON');
    const e = etatTirelire(t); LS.set('tirVu', { japon: e.total - 200 }); r.pct = /class="tirpct" data-de="\d+" data-a="\d+"/.test(ligneTirelire(t));
    document.querySelector('[data-act="tir-son"]').click(); r.son = LS.get('sonTir', true); LS.set('sonTir', true); return r; });
  ok('M_image_pct_son', m.perso === '🦄' && m.refus === '🦄' && m.aucune === '' && m.titre && m.pct && m.son === false, m);
  // N : boutons « Mettre de côté » / « Retirer » dans le détail : saisie déjà réglée, retour au détail, la pièce tombe
  const nn = await p.evaluate(async () => { const r = {}; fermer(); setPref('tirelires', getPref('tirelires').map(t => t.n === 'Japon' ? Object.assign({}, t, { f: false, e: '🏯' }) : t));
    S.form = { mode: 'tirdetail', n: 'Japon' }; rendreForm(); ouvrirSheet(); r.icone = /choisi 🏯 Japon/.test(document.querySelector('#sheetIn').innerText);
    const t0 = etatTirelire(tirelires().find(t => t.n === 'Japon')).total; LS.set('tirVu', { japon: t0 });
    document.querySelector('[data-act="tir-verser"]').click(); r.form = [S.form.mode, S.form.type, S.form.sens, S.form.cat, S.form.lib].join('|');
    S.form.montant = '125'; S._saveT = 0; enregistrer(); r.apres = S.form && S.form.mode; r.piece = !!document.querySelector('#sheetIn .tirpiece');
    r.total = etatTirelire(tirelires().find(t => t.n === 'Japon')).total - t0;
    document.querySelector('[data-act="tir-retirer"]').click(); r.ret = [S.form.type, S.form.sens, S.form.cat, S.form.lib].join('|'); fermer(); r.retour = S.form && S.form.mode; return r; });
  ok('N_boutonsDetail', nn.icone && nn.form === "add|Épargne|verser|Livret A|Japon" && nn.apres === 'tirdetail' && nn.piece && Math.abs(nn.total - 125) < 0.01 && nn.ret === "Épargne|retrait|Retraits d'épargne|Japon" && nn.retour === 'tirdetail', nn);
  // O : rythme (en avance / il manque), rejouer, baisse au retrait, marques, carte « Nouveau mois », fête à 100 %
  const oo = await p.evaluate(async () => { const r = {}; fermer();
    // Rythme : objectif 1 200 €, de nov. 2026 à avril 2027 (6 mois) ; le 15 janv. 2027 : 2 mois + 14/31 écoulés sur 6 → attendu ≈ 490,32 €
    setPref('tirelires', getPref('tirelires').concat({ n: 'Rythme', o: 1200, d: '2027-04', c: '2026-11', e: '🚲' }));
    const t = tirelires().find(x => x.n === 'Rythme'), e = etatTirelire(t); r.avance = Math.round(e.avance * 100) / 100;
    S.form = { mode: 'tirdetail', n: 'Rythme' }; rendreForm(); ouvrirSheet(); r.txt = /Il manque 490/.test(document.querySelector('#sheetIn').innerText); r.marques = /<line x1="44"/.test(document.querySelector('#sheetIn').innerHTML);
    LS.set('tirVu', { rythme: 0 }); document.querySelector('[data-act="tir-rejouer"]').click(); r.rejoue = !!document.querySelector('#sheetIn .cochon.tirbalance') && !!document.querySelector('#sheetIn .tirpiece');
    LS.set('tirVu', { japon: 9999 }); const tj = tirelires().find(x => x.n === 'Japon'); r.baisse = /--d:-\d+px/.test(ligneTirelire(tj)) && !/tirpiece/.test(ligneTirelire(tj));
    LS.set('debMoisVu', 0); const N0 = now; now = new Date(2027, 0, 5, 10); memo = new Map(); const E = etatDebutMois(); r.carte = E && E.tir ? E.tir.map(x => [x.t.n, x.besoin, x.ok]) : null;
    S.form = null; fermer(); r.html = /Rythme : mets/.test(carteBilanMois());
    S.journal.push({ id: 'rv1', row: null, date: '2027-01-05', mois: 'Janvier 2027', lib: 'Livret A · Rythme', cat: 'Livret A', montant: 300, y: 2027, m: 1 }); memo = new Map();
    const E2 = etatDebutMois(); r.fait = E2 ? E2.tir.filter(x => x.t.n === 'Rythme').map(x => [x.besoin, x.ok]) : 'carte fermée';
    S.journal = S.journal.filter(x => x.id !== 'rv1'); now = N0; memo = new Map();
    let fete = 0; const C0 = window.celebrer; window.celebrer = () => fete++; LS.set('tirPal', { rythme: 3 }); setPref('tirelires', getPref('tirelires').map(x => x.n === 'Rythme' ? Object.assign({}, x, { o: 1 }) : x)); suiviTirelires(); await new Promise(z => setTimeout(z, 1400)); window.celebrer = C0; r.fete = fete;
    setPref('tirelires', getPref('tirelires').filter(x => x.n !== 'Rythme')); return r; });
  ok('O_animationsUtiles', oo.avance === -490.32 && oo.txt && oo.marques && oo.rejoue && oo.baisse && oo.carte && oo.carte.some(x => x[0] === 'Rythme' && x[1] === 300 && !x[2]) && oo.html && JSON.stringify(oo.fait) === '[[300,true]]' && oo.fete >= 1, oo);
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
