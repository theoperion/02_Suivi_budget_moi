// 9.34 : rappel « Rien noté depuis 4 jours », voyage remis une seule fois (jdMig 1 → 2), aide « changer de téléphone ».
// usage : node lotX6.js <dossier de l'appli> [dossier captures]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'x6');
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
  const al = p => p.evaluate(() => alertes().filter(a => a.id.startsWith('rien')).map(a => a.txt.replace(/<[^>]+>/g, '')));
  { const { p, ctx } = await page('2026-11-20T10:00:00+01:00', SAL.concat([L(100, '2026-11-05', 'Courses', 40), L(101, '2026-11-15', 'Courses', 40)]), null, VU);
    R.a1 = await al(p); await p.evaluate(() => rendre(true)); await p.screenshot({ path: path.join(SHOTS, 'x6-rappel.png') }); await ctx.close();
    ok(R.a1.length === 1 && /5 jours/.test(R.a1[0]) && /Ajoute-le/.test(R.a1[0]), `rien depuis le 15/11 → rappel (${R.a1})`); }
  { const { p, ctx } = await page('2026-11-20T10:00:00+01:00', SAL.concat([L(100, '2026-11-05', 'Courses', 40), L(101, '2026-11-18', 'Courses', 40)]), null, VU);
    R.a2 = await al(p); await ctx.close(); ok(R.a2.length === 0, `saisie le 18/11 → pas de rappel (${R.a2})`); }
  { const { p, ctx } = await page('2026-11-20T10:00:00+01:00', [L(100, '2026-11-15', 'Courses', 40)], null, VU);
    R.a3 = await al(p); await ctx.close(); ok(R.a3.length === 0, `appli utilisée depuis moins de 7 jours → pas de rappel (${R.a3})`); }
  { const { p, ctx, PRF } = await page('2026-11-20T10:00:00+01:00', SAL, { jeu: { exclus: ['Courses'], jd: [], jdMig: 1 } }, VU);
    await p.waitForTimeout(1500); R.jd = JSON.stringify(PRF.jeu); 
    R.aide = await p.evaluate(() => /CHANGER DE TÉLÉPHONE/.test(document.documentElement.innerHTML + JSON.stringify(typeof MODE_EMPLOI !== 'undefined' ? MODE_EMPLOI : '')) || /CHANGER DE TÉLÉPHONE/.test(String(rendreForm)));
    await ctx.close();
    const lui = JSON.parse(R.jd), jdAttendu = (html.match(/const JD_DEFAUT = (.*);/) || [])[1];
    const voyage = /2026-11-07/.test(jdAttendu || '');
    ok(lui.jdMig === 2 && (voyage ? JSON.stringify(lui.jd).includes('2026-11-07') : true), `voyage remis une fois si JD_DEFAUT l'a (${R.jd})`); }
  ok(/CHANGER DE TÉLÉPHONE/.test(html), 'aide « changer de téléphone » présente');
  await b.close();
  console.log('VERDICT:', KO.length ? 'ÉCHEC' : 'OK');
  console.log('ERREURS JS:', errs.length ? errs.join(' | ') : 'aucune');
})();
