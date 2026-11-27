// (9.57) Saisie REVENU/DÉPENSE : « montant réel » d'une ligne de l'Échéancier → écart automatique (+ ou −), au jour de la ligne, mois de la saisie.
// Usage : node outils/tests/lotReel.js <dossier de l'appli> [captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };
(async () => {
  const b = await chromium.launch();
  const ech = [{ ligne: 5, lib: 'Salaire INRAE', cat: 'Salaire', montant: 1757.6, freq: 'Mensuel', jour: 1, f: 1, g: 12, h: null, i: null, pause: false },
    { ligne: 6, lib: 'Netflix', cat: 'Streaming', montant: 13.49, freq: 'Mensuel', jour: 14, f: 1, g: 12, h: null, i: null, pause: false }];
  const { p, errs } = await B.page(b, '2026-11-27T13:30:00', B.journal('2026-11-01', '2026-11-27', () => false), {}, {}, ech);
  // A : REVENU › Salaire en décembre : la ligne apparaît ; aperçu de l'écart ; OK crée +37,88 € le 1er décembre
  const a = await p.evaluate(() => { ouvrirSaisie(null); S.form.type = 'Revenu'; S.form.cat = 'Salaire'; S.form.y = 2026; S.form.m = 12; rendreForm(); return document.querySelector('#sheetIn').innerText; });
  ok('A_ligne', /Salaire INRAE prévu en décembre : 1\s?757,60/.test(a.replace(/\s+/g, ' ')), a.slice(a.indexOf('Salaire INRAE') - 5, a.indexOf('Salaire INRAE') + 80));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'reel-revenu.png') });
  await p.fill('.reelsai', '1795,48');
  const ap = await p.evaluate(() => document.querySelector('.reelh').innerText);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'reel-apercu.png') });
  const gros = await p.evaluate(() => document.querySelector('#sheetIn .go').textContent);
  await p.click('#sheetIn .go'); // le gros bouton du bas note l'écart quand le champ est rempli
  const e = await p.evaluate(() => { const x = S.journal[S.journal.length - 1]; return [x.lib, x.cat, x.montant, x.date, x.y, x.m, !!S.form]; });
  ok('B_ecartPositif', /\+37,88/.test(ap) && /NOTER L'ÉCART DE \+37,88/.test(gros) && e[1] === 'Salaire' && Math.abs(e[2] - 37.88) < 0.001 && e[3] === '2026-12-01' && e[5] === 12 && /^Écart Salaire INRAE/.test(e[0]), { ap, gros, e });
  // C : DÉPENSE › Streaming en novembre, payé 15,99 → +2,50 le 14 ; payé 10 → −3,49
  const c = await p.evaluate(async () => { const r = [];
    for (const v of ['15,99', '10']) { ouvrirSaisie(null); S.form.type = 'Dépense'; S.form.cat = 'Streaming'; rendreForm(); document.querySelector('.reelsai').value = v; document.querySelector('[data-act="reel-saisie"]').click(); const x = S.journal[S.journal.length - 1]; r.push([x.montant, x.date]); }
    return r; });
  ok('C_depense', JSON.stringify(c) === '[[2.5,"2026-11-14"],[-5.99,"2026-11-14"]]', c); // 2e montant réel : seule la différence s'ajoute (total −3,49)
  // C2 : noter deux fois le même montant réel ne double pas l'écart ; un 2e montant différent n'ajoute que la différence
  const c2 = await p.evaluate(() => { const r = []; for (const v of ['1795,48', '1795,48', '1800']) { ouvrirSaisie(null); S.form.type = 'Revenu'; S.form.cat = 'Salaire'; S.form.y = 2026; S.form.m = 12; rendreForm(); document.querySelector('.reelsai').value = v; document.querySelector('[data-act="reel-saisie"]').click(); r.push(S.journal.filter(e => e.y === 2026 && e.m === 12 && /^Écart/.test(e.lib)).reduce((t, e) => t + e.montant, 0)); try { fermer(); } catch (x) {} } return r.map(v => Math.round(v * 100) / 100); });
  ok('C2_pasDeDoublon', JSON.stringify(c2) === '[37.88,37.88,42.4]', c2);
  // D : rien si la catégorie n'a pas de ligne d'Échéancier, ou en ÉPARGNE, ou montant vide (pas de ligne créée)
  const d = await p.evaluate(() => { ouvrirSaisie(null); S.form.type = 'Dépense'; S.form.cat = 'Courses'; rendreForm(); const r = [!!document.querySelector('.reelsai')];
    S.form.type = 'Revenu'; S.form.cat = 'Salaire'; rendreForm(); const n = S.journal.length; document.querySelector('[data-act="reel-saisie"]').click(); r.push(S.journal.length === n); return r; });
  ok('D_pasDeLigne', d[0] === false && d[1] === true, d);
  // E : l'aide « ? » s'ouvre et ramène à la saisie
  const ee = await p.evaluate(() => { document.querySelector('[data-act="info"][data-k="reel"]').click(); const t = document.querySelector('#sheetIn').innerText; document.querySelector('[data-act="info-retour"]').click(); return [/MONTANT RÉEL/.test(t), S.form.mode, S.form.cat]; });
  ok('E_aide', ee[0] && ee[1] === 'add' && ee[2] === 'Salaire', ee);
  // F (9.58) : un écart ne casse jamais un jour sans dépense, quelle que soit la catégorie (courante ou charge fixe), et n'est pas une preuve de saisie
  const ff = await p.evaluate(() => [casseSerie('Courses', [], 'Écart Navigo nov.'), casseSerie('Courses', [], 'ecart courses'), casseSerie('Loyer', [], 'Écart loyer'), casseSerie('Courses', [], 'Pain'), casseSerie('Loyer', [], 'Loyer'),
    estDepenseSaisie({ cat: 'Courses', date: '2026-11-20', montant: 4, lib: 'Écart Navigo' }), estDepenseSaisie({ cat: 'Courses', date: '2026-11-20', montant: 4, lib: 'Pain' })]);
  ok('F_ecartNeCassePas', JSON.stringify(ff) === '[false,false,false,true,true,false,true]', ff);
  // G (9.60) : toucher la catégorie (sans autre geste) fait apparaître / disparaître l'encadré
  const g = await p.evaluate(() => { ouvrirSaisie(null); S.form.type = 'Dépense'; S.form.cat = 'Courses'; rendreForm(); const r = [!!document.querySelector('.reelsai')];
    const st = document.querySelector('#sheetIn [data-act="cat"][data-cat="Streaming"]') || (() => { S.form.all = false; return null; })();
    const clic = n => { const b = document.querySelector(`#sheetIn [data-act="cat"][data-cat="${n}"]`); if (b) b.click(); else { S.form.cat = n; majReelBox(); } };
    clic('Streaming'); r.push(!!document.querySelector('.reelsai')); clic('Courses'); r.push(!!document.querySelector('.reelsai')); return r; });
  ok('G_categorieDirecte', JSON.stringify(g) === '[false,true,false]', g);
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
