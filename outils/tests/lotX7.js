// 9.36 : dans le détail de l'objectif d'épargne, toucher une ligne ouvre sa fiche de modification (Journal ou Échéancier).
// usage : node lotX7.js <dossier de l'appli> [dossier captures]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'x7');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const PRE = (html.match(/localStorage\.getItem\('([^']+)' \+ k\)/) || [])[1] || 'jauge.';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CATS = [
  { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Sans alerte' },
  { ligne: 13, nom: 'Restaurants', groupe: 'Vie courante', type: 'Dépense', budget: 150, suivi: 'Mensuel' },
  { ligne: 15, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
  { ligne: 16, nom: 'Bricoles', groupe: 'Divers', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 17, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' },
  { ligne: 18, nom: 'Retrait livret', groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' }];
const L = (row, date, cat, montant, lib) => { const [y, m] = date.split('-').map(Number); return { row, mois: MOIS[m - 1] + ' ' + y, lib: lib || cat, cat, montant, date }; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function serie(debut, fin, pas, cat, montant, row0) { const o = []; let r = row0; for (let d = new Date(debut + 'T00:00:00'); iso(d) <= fin; d.setDate(d.getDate() + pas)) o.push(L(r++, iso(d), cat, montant)); return o; }
const SAL = [L(1, '2026-11-01', 'Salaire', 2000), L(2, '2026-12-01', 'Salaire', 2000), L(3, '2027-01-01', 'Salaire', 2000)];
const JEU0 = { exclus: ['Courses'], jd: [] }; // pas de voyage : le test vaut pour toutes les copies
function donnees(journal, prefs, defis) {
  return { categories: CATS, mois: [2026, 2027].flatMap(y => MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: null,
    echeancier: [], journal: JSON.parse(JSON.stringify(journal)), libres: 50, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: defis || {}, prefs: JSON.parse(JSON.stringify(prefs || {})), url: 'x', apiVersion: '5.13', anomalies: '✅', lu: '2027-01-01T09:00:00.000Z' };
}
let b; const errs = [], R = {}, KO = [];
const ok = (c, msg) => { if (!c) KO.push(msg); console.log((c ? '✅ ' : '❌ ') + msg); };
// o.garder : ne pas retirer la carte des gains ; o.html : page servie à la place d'index.html
async function page(date, journal, prefs, ls, defis, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(date)); p.on('pageerror', e => errs.push(e.message));
  const PRF = JSON.parse(JSON.stringify(prefs || { jeu: JEU0 }));
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData());
      const un = x => { if (x.action === 'pref-set') PRF[x.cle] = x.valeur; return x.action === 'data' ? { ok: true, data: donnees(journal, PRF, defis) } : x.action === 'add' ? { ok: true, row: 900 } : { ok: true }; };
      let res; if (q.action === 'lot') { const l = (q.ops || q.lot || q.envois || []).map(x => un(Object.assign({ action: x.action }, x.payload || x))); res = { ok: true, res: l, resultats: l }; } else res = un(q);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); }
    if (u.startsWith('http://app.test/')) { const rel = decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html';
      if (rel === 'index.html' && o.html) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: o.html });
      const f = path.join(DIR, rel); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' }); });
  await p.addInitScript(([api, ls, pre]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); const set = (k, v) => localStorage.setItem(pre + k, JSON.stringify(v));
    set('key', 'k'); set('api', api); set('apiDefautVu', api); localStorage.setItem(pre + 'tutoVu', 'true'); Object.entries(ls || {}).forEach(([k, v]) => set(k, v)); } }, [API, ls, PRE]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000);
  if (!o.garder) await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); });
  return { p, ctx, PRF };
}
const VU = { nivVu: 1, xpVu: 0, echelle100: true, regles933: true }; // joueur déjà installé, règles 9.33 déjà annoncées
(async () => {
  b = await chromium.launch();
  const J = SAL.concat([L(100, '2026-11-05', 'Courses', 40), L(101, '2026-07-10', 'Livret A', 300, 'Virement livret'), L(102, '2026-08-12', 'Retrait livret', 120, 'Retrait vacances')]);
  const { p, ctx } = await page('2026-11-19T10:00:00+01:00', J, null, VU);
  await p.evaluate(() => { S.form = { mode: 'objdetail', y: 2026 }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(400);
  R.lignes = await p.evaluate(() => [...document.querySelectorAll('#sheetIn .objl')].map(x => x.dataset.act + ':' + x.innerText.replace(/\s+/g, ' ')));
  await p.screenshot({ path: path.join(SHOTS, 'x7-detail.png') });
  await p.evaluate(() => [...document.querySelectorAll('#sheetIn .objl')].find(x => /Retrait vacances/.test(x.innerText)).click()); await p.waitForTimeout(400);
  R.fiche = await p.evaluate(() => ({ mode: S.form && S.form.mode, lib: S.form && S.form.lib, montant: S.form && S.form.montant, txt: document.querySelector('#sheetIn').innerText.slice(0, 60) }));
  await p.screenshot({ path: path.join(SHOTS, 'x7-fiche.png') });
  // ✕ → retour au détail ; ENREGISTRER (montant 150) → retour au détail avec le nouveau total ; ✕ du détail → fermé
  await p.evaluate(() => fermer()); await p.waitForTimeout(200); R.apresX = await p.evaluate(() => S.form && S.form.mode);
  await p.evaluate(() => [...document.querySelectorAll('#sheetIn .objl')].find(x => /Retrait vacances/.test(x.innerText)).click()); await p.waitForTimeout(300);
  await p.evaluate(() => { S.form.montant = '150'; const b = [...document.querySelectorAll('#sheetIn button')].find(x => /ENREGISTRER/.test(x.textContent)); b.click(); }); await p.waitForTimeout(500);
  R.apresSave = await p.evaluate(() => ({ mode: S.form && S.form.mode, txt: (document.querySelector('#sheetIn') || {}).innerText || '' }));
  // SUPPRIMER depuis le détail → la ligne disparaît et le total est recalculé
  await p.evaluate(() => [...document.querySelectorAll('#sheetIn .objl')].find(x => /Retrait vacances/.test(x.innerText)).click()); await p.waitForTimeout(300);
  await p.evaluate(async () => { for (let i = 0; i < 2; i++) { const b = [...document.querySelectorAll('#sheetIn button')].find(x => /SUPPRIMER/.test(x.textContent)); if (!b) break; b.click(); await new Promise(r => setTimeout(r, 300)); } });
  await p.waitForTimeout(400);
  R.apresDel = await p.evaluate(() => ({ mode: S.form && S.form.mode, txt: (document.querySelector('#sheetIn') || {}).innerText || '' }));
  ok(R.apresDel.mode === 'objdetail' && !/Retrait vacances/.test(R.apresDel.txt) && /ÉPARGNE NETTE\s*300,00/.test(R.apresDel.txt), `après SUPPRIMER → ligne partie, épargne nette 300 (${R.apresDel.txt.replace(/\s+/g, ' ').slice(-60)})`);
  await p.evaluate(() => fermer()); await p.waitForTimeout(200); R.fin = await p.evaluate(() => ({ form: S.form, on: $('#sheet').classList.contains('on'), ro: S.retourObj || null }));
  await ctx.close();
  ok(R.apresX === 'objdetail', `✕ sur la fiche → retour au détail (${R.apresX})`);
  ok(R.apresSave.mode === 'objdetail' && /150,00/.test(R.apresSave.txt), `après ENREGISTRER → détail à jour (${R.apresSave.mode})`);
  ok(!R.fin.form && !R.fin.on && !R.fin.ro, `✕ du détail → tout est fermé (${JSON.stringify(R.fin)})`);
  ok(R.lignes.length === 2 && R.lignes.every(t => /^obj-ligne:/.test(t)), `2 lignes touchables (${R.lignes.join(' | ')})`);
  ok(R.fiche.mode === 'edit' && /Retrait vacances/.test(R.fiche.lib || ''), `toucher « Retrait vacances » ouvre sa fiche (${JSON.stringify(R.fiche)})`);
  await b.close();
  console.log('VERDICT:', KO.length ? 'ÉCHEC' : 'OK');
  console.log('ERREURS JS:', errs.length ? errs.join(' | ') : 'aucune');
})();
