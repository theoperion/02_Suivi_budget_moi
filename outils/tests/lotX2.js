// Lot L2 (jeu) : on ne gagne plus rien sans rien saisir, retraits d'épargne, épargne nette, envies mûres,
// défi du mois verrouillé après le 5, « ne cassent pas les séries » (essentiels, à partir d'aujourd'hui), restes mis de côté par mois, derDep.
// usage : node lotX2.js <dossier de l'appli> [dossier captures]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'x2');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const PRE = (html.match(/localStorage\.getItem\('([^']+)' \+ k\)/) || [])[1] || 'jauge.'; // préfixe de stockage (jauge., jauge-clem., jauge-devlin.)
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CATS = [
  { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 11, nom: "Retraits d'épargne (Livret A)", groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Sans alerte' },
  { ligne: 13, nom: 'Restaurants', groupe: 'Vie courante', type: 'Dépense', budget: 150, suivi: 'Mensuel' },
  { ligne: 14, nom: 'Pharmacie', groupe: 'Vie courante', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 15, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
  { ligne: 16, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 17, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' },
  { ligne: 18, nom: 'Retrait livret', groupe: 'Épargne', type: 'Retrait', budget: null, suivi: '' }];
const L = (row, date, cat, montant, lib) => { const [y, m] = date.split('-').map(Number); return { row, mois: MOIS[m - 1] + ' ' + y, lib: lib || cat, cat, montant, date }; };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function serie(debut, fin, pas, cat, montant, row0) { const o = []; let r = row0; for (let d = new Date(debut + 'T00:00:00'); iso(d) <= fin; d.setDate(d.getDate() + pas)) o.push(L(r++, iso(d), cat, montant)); return o; }
const SAL = [L(1, '2026-11-01', 'Salaire', 2000), L(2, '2026-12-01', 'Salaire', 2000), L(3, '2027-01-01', 'Salaire', 2000)];
function donnees(journal, prefs, defis) {
  return { categories: CATS, mois: [2026, 2027].flatMap(y => MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: null,
    echeancier: [], journal: JSON.parse(JSON.stringify(journal)), libres: 50, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: defis || {}, prefs: JSON.parse(JSON.stringify(prefs || {})), url: 'x', apiVersion: '5.13', anomalies: '✅', lu: '2027-01-01T09:00:00.000Z' };
}
let b; const errs = [], R = {}, KO = [];
const ok = (c, msg) => { if (!c) KO.push(msg); console.log((c ? '✅ ' : '❌ ') + msg); };
async function page(date, journal, prefs, ls, defis) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(date)); p.on('pageerror', e => errs.push(e.message));
  const PRF = Object.assign({}, prefs || {});
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData());
      const un = o => { if (o.action === 'pref-set') PRF[o.cle] = o.valeur; return o.action === 'data' ? { ok: true, data: donnees(journal, PRF, defis) } : o.action === 'add' ? { ok: true, row: 900 } : { ok: true }; };
      let res; if (q.action === 'lot') { const l = (q.ops || q.lot || q.envois || []).map(o => un(Object.assign({ action: o.action }, o.payload || o))); res = { ok: true, res: l, resultats: l }; } else res = un(q);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); }
    if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' }); });
  await p.addInitScript(([api, ls, pre]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); const set = (k, v) => localStorage.setItem(pre + k, JSON.stringify(v));
    set('key', 'k'); set('api', api); set('apiDefautVu', api); localStorage.setItem(pre + 'tutoVu', 'true'); Object.entries(ls || {}).forEach(([k, v]) => set(k, v)); } }, [API, ls, PRE]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000);
  await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); });
  return { p, ctx, PRF };
}
const FAITS = () => { const e = etatJeu(), f = e.f, g = id => e.succes.find(s => s.id === id).ok, r = n => (e.rec.find(x => x[0] === n) || [0, 0, 0, 0])[3];
  return { xp: e.xp, joursSans: f.joursSans, serie: f.serieJours, nVert: f.nVert, taux10: f.taux10, nZero: f.nZero, nSaisis: f.nSaisis, epargne: Math.round(f.epargne), nSucces: e.succes.filter(s => s.ok).length,
    sucOk: e.succes.filter(s => s.ok).map(s => s.id), cote1000: g('cote-1000'), recCote: r('Restes mis de côté'), recEnv: r("Envies abandonnées (liste d'envies)"), recMois: r('Mois bouclés'), M: f.M.map(x => [x.m, x.vert, Math.round(x.taux * 100)]), sansDep: joursSansDepense() }; };
(async () => {
  b = await chromium.launch();
  const T = '2027-01-19T10:00:00+01:00';
  // 1. Salaire seul : rien de gagné (avant : 54 jours, 4 060 XP, 20 succès)
  { const { p, ctx } = await page(T, SAL); R.salaire = await p.evaluate(FAITS); R.salRec = await p.evaluate(() => etatJeu().rec.filter(r => r[3] > 0).map(r => r[0] + ':' + r[3])); await ctx.close();
    ok(R.salaire.joursSans === 0, `salaire seul → 0 jour sans dépense (${R.salaire.joursSans})`);
    ok(R.salaire.nVert === 0 && R.salaire.taux10 === 0 && R.salaire.nZero === 0 && R.salaire.recMois === 0, `salaire seul → aucun mois vert / 10 % / sans faute / bouclé (${JSON.stringify(R.salaire.M)})`);
    ok(R.salaire.xp === 0 && R.salaire.nSucces === 0, `salaire seul → 0 XP, 0 succès (${R.salaire.xp} XP, ${R.salaire.sucOk.join(',')})`); }
  // 2. Contrôle : courses tous les 5 jours (essentiel, ne casse pas) → les jours comptent toujours
  { const J = SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100)); const { p, ctx } = await page(T, J, { jeu: { exclus: ['Courses'] } });
    R.courses = await p.evaluate(FAITS);
    R.attente = await p.evaluate(() => joursJeu().slice(-4)); await ctx.close();
    ok(R.courses.joursSans >= 70 && R.courses.serie >= 21, `courses saisies tous les 5 jours → jours gagnés (${R.courses.joursSans} jours, série ${R.courses.serie})`);
    ok(R.courses.nVert === 2 && R.courses.recMois === 2, `courses saisies → novembre et décembre verts et bouclés (${R.courses.nVert})`); }
  // 2b. Plus aucune dépense saisie depuis le 4 janvier : les derniers jours attendent (null), les plus anciens (sans rien autour) ne comptent pas
  { const J = SAL.concat(serie('2026-11-02', '2027-01-04', 3, 'Courses', 40, 100)); const { p, ctx } = await page(T, J, { jeu: { exclus: ['Courses'] } });
    R.trou = await p.evaluate(() => Object.fromEntries(joursJeu().filter(x => x[0] >= '2027-01-10').map(x => [x[0].slice(8), x[1]]))); await ctx.close();
    ok(R.trou['10'] === true && R.trou['11'] === true && R.trou['12'] === null && R.trou['18'] === null, `dernière dépense le 4 → jusqu'au 11 gagné, du 12 au 18 en attente (${JSON.stringify(R.trou)})`); }
  // 3. Retrait 1 500 € : un mois rouge reste rouge (catégorie Retrait ou revenu « Retraits d'épargne »)
  for (const cat of ['Retrait livret', "Retraits d'épargne (Livret A)"]) {
    const J = SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100), [L(300, '2026-12-10', 'Loisirs', 2500), L(301, '2026-12-11', cat, 1500)]);
    const { p, ctx } = await page(T, J, { jeu: { exclus: ['Courses'] } }); const f = await p.evaluate(FAITS);
    const dec = f.M.find(x => x[0] === 12); R['retrait_' + cat] = dec; await ctx.close();
    ok(dec && dec[1] === false && dec[2] < 10, `retrait 1 500 € (${cat}) → décembre pas vert, pas 10 % non dépensé (${JSON.stringify(dec)})`); }
  // 4. Épargne nette (9.33 : plus haut niveau atteint) : verser 1 000 € puis les retirer le même mois → pas de « Tirelire pleine » ; verser seulement → oui
  { const base = SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100));
    const a = await page(T, base.concat([L(310, '2026-11-20', 'Livret A', 1000), L(311, '2026-11-25', 'Retrait livret', 1000)])); R.epNet = await a.p.evaluate(FAITS); await a.ctx.close();
    const a2 = await page(T, base.concat([L(310, '2026-11-20', 'Livret A', 1000), L(311, '2026-11-25', "Retraits d'épargne (Livret A)", 1000)])); R.epNet2 = await a2.p.evaluate(FAITS); await a2.ctx.close();
    const c = await page(T, base.concat([L(310, '2026-11-20', 'Livret A', 1000)])); R.epVerse = await c.p.evaluate(FAITS); await c.ctx.close();
    ok(!R.epNet.cote1000 && R.epNet.epargne === 0 && !R.epNet2.cote1000 && R.epNet2.epargne === 0, `versé 1 000 puis retiré 1 000 → épargne nette 0, pas de Tirelire pleine (${R.epNet.epargne} / ${R.epNet2.epargne})`);
    ok(R.epVerse.cote1000 && R.epVerse.epargne === 1000, `versé 1 000 → Tirelire pleine (${R.epVerse.epargne})`); }
  // 5. Envies : 30 renoncements immédiats → 0 XP ; 3 envies mûres abandonnées la même semaine → 2 × 10 XP
  { const l = []; for (let i = 0; i < 30; i++) l.push({ i: 'n' + i, l: 'Truc ' + i, p: 10, c: '', d: '2027-01-18', s: 'ren', f: '2027-01-25', x: '2027-01-18' });
    for (let i = 0; i < 3; i++) l.push({ i: 'm' + i, l: 'Mûre ' + i, p: 20, c: '', d: '2027-01-01', s: 'ren', f: '2027-01-08', x: '2027-01-12' });
    l.push({ i: 'att', l: 'Casque', p: 50, c: '', d: '2027-01-18', s: 'att', f: '2027-01-25' }); l.push({ i: 'mur', l: 'Montre', p: 80, c: '', d: '2027-01-05', s: 'att', f: '2027-01-12' });
    const { p, ctx } = await page(T, SAL, { envies: { l } }); R.env = await p.evaluate(FAITS);
    ok(R.env.recEnv === 2, `30 renoncements immédiats + 3 mûres la même semaine → 2 envies avec XP (${R.env.recEnv})`);
    await p.evaluate(() => ouvrirEnvies()); await p.waitForTimeout(300);
    await p.click('#sheetIn .envw [data-act=env-ren][data-i="att"]'); await p.waitForTimeout(300);
    R.toastAtt = await p.evaluate(() => (document.querySelector('#toast') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 200));
    await p.waitForTimeout(4500);
    await p.click('#sheetIn .envm [data-act=env-ren][data-i="mur"]'); await p.waitForTimeout(300);
    R.toastMur = await p.evaluate(() => (document.querySelector('#toast') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 200));
    R.env2 = await p.evaluate(() => etatJeu().rec.find(x => x[0] === "Envies abandonnées (liste d'envies)")[3]);
    ok(/pas d'XP avant la date/.test(R.toastAtt) && !/\+10 XP/.test(R.toastAtt), `renoncer avant la date → toast sans XP (${R.toastAtt.slice(0, 80)})`);
    ok(/\+10 XP/.test(R.toastMur) && R.env2 === 3, `renoncer à une envie mûre (autre semaine) → +10 XP (${R.env2})`);
    await p.evaluate(() => { S.form = { mode: 'xpinfo' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(300);
    R.xpinfo = await p.evaluate(() => document.querySelector('#sheetIn').innerText);
    ok(/Envie mûre abandonnée/.test(R.xpinfo) && /semaine avant ou la semaine après/.test(R.xpinfo), "« Comment gagner de l'XP » : envies et règle des jours expliquées");
    await p.screenshot({ path: path.join(SHOTS, 'x2-xpinfo.png') }); await ctx.close(); }
  // 6. Défi du mois : plafond ≤ budget ; après le 5 : seulement baisser, ni relever, ni abandonner
  { const defis = { '2027-1': { cat: 'Loisirs', montant: 80 } };
    const { p, ctx, PRF } = await page(T, SAL.concat([L(320, '2027-01-03', 'Loisirs', 30)]), {}, null, defis);
    const essai = async (cat, montant) => { await p.evaluate(([cat, montant]) => { ouvrirDefi(); S.form.cat = cat; S.form.montant = montant; okDefi(); }, [cat, montant]); await p.waitForTimeout(200);
      return p.evaluate(() => ({ err: (document.querySelector('#ferr') || {}).textContent || '', d: JSON.stringify(S.data.defis['2027-1'] || null) })); };
    R.def150 = await essai('Loisirs', '150'); R.def90 = await essai('Loisirs', '90');
    await p.evaluate(() => { ouvrirDefi(); }); await p.waitForTimeout(200);
    R.defUI = await p.evaluate(() => ({ del: !!document.querySelector('#sheetIn [data-act=defi-del]'), chips: [...document.querySelectorAll('#sheetIn [data-act=defi-cat]')].map(x => x.textContent), note: document.querySelector('#sheetIn').innerText }));
    await p.screenshot({ path: path.join(SHOTS, 'x2-defi-verrou.png') });
    await p.evaluate(() => retirerDefi()); await p.waitForTimeout(200); R.defDel = await p.evaluate(() => JSON.stringify(S.data.defis['2027-1'] || null));
    R.def70 = await essai('Loisirs', '70'); await ctx.close();
    ok(/ne peut pas dépasser ton budget/.test(R.def150.err) && /80/.test(R.def150.d), `plafond 150 € > budget 100 € → refusé (${R.def150.err})`);
    ok(/seulement baisser/.test(R.def90.err) && /80/.test(R.def90.d), `le 19, relever 80 → 90 € → refusé (${R.def90.err})`);
    ok(!R.defUI.del && R.defUI.chips.join() === 'Loisirs' && /verrouillé/.test(R.defUI.note), `le 19 : pas de bouton abandonner, un seul budget proposé (${R.defUI.chips.join()})`);
    ok(/80/.test(R.defDel), 'le 19 : abandon refusé');
    ok(R.def70.err === '' && /"montant":70/.test(R.def70.d), `le 19, baisser à 70 € → accepté (${R.def70.d})`); }
  { const defis = { '2027-1': { cat: 'Loisirs', montant: 80 } };
    const { p, ctx } = await page('2027-01-04T10:00:00+01:00', SAL, {}, null, defis);
    R.libre = await p.evaluate(() => { ouvrirDefi(); S.form.montant = '95'; okDefi(); const a = JSON.stringify(S.data.defis['2027-1']); ouvrirDefi(); const del = !!document.querySelector('#sheetIn [data-act=defi-del]'); retirerDefi(); return { a, del, apres: JSON.stringify(S.data.defis['2027-1'] || null) }; });
    await ctx.close();
    ok(/"montant":95/.test(R.libre.a) && R.libre.del && R.libre.apres === 'null', `le 4 : relever à 95 € et abandonner restent possibles (${JSON.stringify(R.libre)})`); }
  // 7. « Ne cassent pas les séries » : essentiels seulement, changement à partir d'aujourd'hui, ancienne valeur compatible
  { const J = SAL.concat(serie('2026-11-02', '2027-01-17', 4, 'Courses', 40, 100), [L(330, '2026-12-10', 'Restaurants', 25)]);
    const { p, ctx, PRF } = await page(T, J, { jeu: { exclus: ['Courses', 'Restaurants'] } });
    R.ex0 = await p.evaluate(() => ({ d10: new Map(joursJeu()).get('2026-12-10'), n: joursJeu().filter(x => x[1] === true).length }));
    await p.evaluate(() => { const el = document.querySelector('[data-act=exclus]'); if (el) el.click(); else { S.form = { mode: 'exclus', ex: exclusSerie().slice(), retour: null }; rendreForm(); ouvrirSheet(); } }); await p.waitForTimeout(300);
    R.exChips = await p.evaluate(() => [...document.querySelectorAll('#sheetIn [data-act=exclus-tog]')].map(x => x.dataset.cat));
    await p.screenshot({ path: path.join(SHOTS, 'x2-exclus.png') });
    await p.evaluate(() => { const b = [...document.querySelectorAll('#sheetIn [data-act=exclus-tog]')].find(x => x.dataset.cat === 'Courses'); b.click(); }); await p.waitForTimeout(150);
    await p.evaluate(() => { const b = [...document.querySelectorAll('#sheetIn [data-act=exclus-tog]')].find(x => x.dataset.cat === 'Restaurants'); b.click(); }); await p.waitForTimeout(150);
    await p.click('#sheetIn [data-act=exclus-ok]'); await p.waitForTimeout(500);
    R.ex1 = await p.evaluate(() => ({ d10: new Map(joursJeu()).get('2026-12-10'), n: joursJeu().filter(x => x[1] === true).length, auj: exclusSerie(), hier: exclusSerie('2027-01-18'), loisirs: (() => { S.form = { mode: 'exclus', ex: [], retour: null }; rendreForm(); const b = document.querySelector('#sheetIn [data-cat=Loisirs]'); return !!b; })() }));
    R.exPref = PRF.jeu; await ctx.close();
    ok(R.ex0.d10 === true, `ancienne valeur { exclus: [Courses, Restaurants] } lue comme avant : le 10/12 (resto) gagné (${R.ex0.d10})`);
    ok(R.exChips.includes('Courses') && R.exChips.includes('Pharmacie') && R.exChips.includes('Restaurants') && !R.exChips.includes('Loisirs') && !R.exChips.includes('Loyer'), `liste proposée : essentiels + déjà coché (${R.exChips.join(', ')})`);
    ok(R.ex1.d10 === true && R.ex1.n === R.ex0.n, `décocher Courses et Restaurants le 19/01 → le passé ne bouge pas (${R.ex0.n} → ${R.ex1.n} jours)`);
    ok(R.ex1.auj.length === 0 && R.ex1.hier.join() === 'Courses,Restaurants' && !R.ex1.loisirs, `liste du jour vide, celle d'hier gardée ; Loisirs jamais proposé (${JSON.stringify(R.exPref)})`); }
  // 8. Restes mis de côté : l'XP compte par mois, pas par ligne
  { const J = SAL.concat(serie('2026-11-02', '2027-01-17', 5, 'Courses', 40, 100), [L(340, '2026-12-28', 'Livret A', 50, 'Reste mis de côté'), L(341, '2026-12-29', 'Livret A', 50, 'Reste mis de côté'), L(342, '2026-12-30', 'Livret A', 50, 'Reste mis de côté')]);
    const { p, ctx } = await page(T, J); R.cote = await p.evaluate(FAITS); await ctx.close();
    ok(R.cote.recCote === 1, `3 lignes « mis de côté » en décembre → 1 × 25 XP (${R.cote.recCote})`); }
  // 9. derDep sans ligne : ne casse plus la journée (avant : restait « avec dépense » après suppression de la ligne)
  { const J = SAL.concat(serie('2026-11-02', '2027-01-17', 3, 'Courses', 40, 100));
    const { p, ctx } = await page(T, J, { jeu: { exclus: ['Courses'] } }, { derDep: '2027-01-18' });
    R.derDep = await p.evaluate(() => ({ j18: new Map(joursJeu()).get('2027-01-18'), sans: joursSansDepense() })); await ctx.close();
    ok(R.derDep.j18 === true && R.derDep.sans >= 60, `derDep = 18/01 sans ligne → le 18 reste sans dépense, série intacte (${JSON.stringify(R.derDep)})`); }
  console.log(JSON.stringify(R, (k, v) => k === 'xpinfo' ? undefined : v).slice(0, 3000));
  console.log('VERDICT:', KO.length ? 'ÉCHEC (' + KO.length + ')' : 'OK');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune'); await b.close();
})();
