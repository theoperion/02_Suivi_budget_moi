// (9.48) Boutons Livret A / LDDS / LEP dans ÉPARGNE (Théo seulement) : le livret est mis au début du libellé,
// règle livretDe() partagée avec le script de son fichier Portefeuille & Épargne.
// Usage : node outils/tests/lotLivrets.js <dossier de l'appli> [captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };
(async () => {
  const b = await chromium.launch();
  const { p, errs } = await B.page(b, '2026-11-20T18:30:00', B.journal('2026-11-01', '2026-11-20', () => false), {}, {}, []);
  const regle = await p.evaluate(() => ['Livret A', 'livret a · vacances', 'LDDS', 'ldds', 'LEP', 'Lép', 'Livret A / LEP', 'Retrait livret', 'Livret Jeune', 'LEPx', 'PEA', 'Lepidoptère', ''].map(l => [l, livretDe(l)]));
  const att = { 'Livret A': 'Livret A', 'livret a · vacances': 'Livret A', 'LDDS': 'LDDS', 'ldds': 'LDDS', 'LEP': 'LEP', 'Lép': 'LEP', 'Livret A / LEP': 'Livret A', 'Retrait livret': null, 'Livret Jeune': null, 'LEPx': null, 'PEA': null, 'Lepidoptère': null, '': null };
  ok('A_regle', regle.every(([l, v]) => v === att[l]), regle);
  const a = await p.evaluate(() => { ouvrirSaisie(null); S.form.type = 'Épargne'; S.form.sens = 'depot'; S.form.cat = 'Livret A'; rendreForm(); return document.querySelector('#sheetIn').innerText; });
  ok('B_boutons', /SUR QUEL COMPTE/.test(a) && /LDDS/.test(a) && /Autre placement/.test(a) && /rien n’est recopié/.test(a), a.slice(0, 600));
  await p.click('[data-act="livret"][data-n="LDDS"]');
  const c = await p.evaluate(() => ({ lib: S.form.lib, val: document.querySelector('#lib').value, txt: document.querySelector('#sheetIn').innerText }));
  ok('C_choix', c.lib === 'LDDS' && c.val === 'LDDS' && /Recopié tout seul/.test(c.txt) && /LDDS, apport/.test(c.txt), c);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'livrets.png') });
  await p.evaluate(() => { S.form.lib = 'LDDS · vacances'; rendreForm(); });
  await p.click('[data-act="livret"][data-n="LEP"]');
  const d = await p.evaluate(() => S.form.lib);
  await p.click('[data-act="livret"][data-n=""]');
  const e = await p.evaluate(() => S.form.lib);
  ok('D_changer', d === 'LEP · vacances' && e === 'vacances', { d, e });
  await p.evaluate(() => { S.form.lib = 'Retrait livret'; S.form.sens = 'retrait'; rendreForm(); });
  await p.click('[data-act="livret"][data-n="Livret A"]');
  const f = await p.evaluate(() => ({ lib: S.form.lib, txt: document.querySelector('#sheetIn').innerText }));
  ok('E_retrait', f.lib === 'Livret A' && /Livret A, retrait/.test(f.txt), f.lib);
  const g = await p.evaluate(async () => { S.form.sens = 'depot'; S.form.cat = 'Livret A'; S.form.montant = '200'; S.form.lib = ''; rendreForm(); document.querySelector('[data-act="livret"][data-n="LEP"]').click(); S._saveT = 0; enregistrer(); return { l: S.journal.filter(x => x.lib === 'LEP').map(x => [x.cat, x.montant]), dern: S.journal.slice(-2).map(x => [x.lib, x.cat, x.montant]) }; });
  ok('F_enregistre', g.l.length === 1 && g.l[0][1] === 200, g);
  const h = await p.evaluate(() => { fermer(); ouvrirSaisie(null); S.form.type = 'Dépense'; rendreForm(); return /SUR QUEL COMPTE/.test(document.querySelector('#sheetIn').innerText); });
  ok('G_pasEnDepense', !h, h);
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
