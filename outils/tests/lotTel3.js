// Sauvegarde Drive du mode téléphone (sauvegarde.js), avec un faux Google (connexion, Drive, Sheets) :
// A activation (fichier technique + Google Sheet aux onglets du fichier budget) ; B sauvegarde automatique après une saisie ;
// C accès Google expiré : rien de perdu, message, puis « Sauvegarder maintenant » renouvelle et sauvegarde ;
// D nouveau téléphone : « Reprendre ma sauvegarde du Drive » (2 touchers) redonne toutes les données.
// Usage : node outils/tests/lotTel3.js <dossier de l'appli> [dossier captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };

// ---------- Faux Google ----------
const G = { fichiers: {}, sheets: {}, demandes: [], appels: [], expire: false };
const GIS = `window.google = { accounts: { oauth2: { initTokenClient: c => ({ requestAccessToken: o => { window.__gis = (window.__gis || []).concat([o]); setTimeout(() => c.callback({ access_token: 'jeton', expires_in: 3600 }), 20); } }) } } };`;
async function fauxGoogle(page) {
  await page.route('https://accounts.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: GIS }));
  const rep = (r, o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o || {}) });
  await page.route(/googleapis\.com/, async r => {
    const q = r.request(), u = new URL(q.url()), m = q.method(), corps = q.postData() || '';
    G.appels.push(m + ' ' + u.pathname);
    if (G.expire) { G.expire = false; return rep(r, { error: { message: 'expiré' } }, 401); }
    if (u.pathname === '/upload/drive/v3/files' && m === 'POST') { // création multipart
      const parts = corps.split(/\r\n--[^\r\n]+/); const json = parts.map(p => p.split('\r\n\r\n')[1]).filter(Boolean);
      const id = 'f' + (Object.keys(G.fichiers).length + 1); G.fichiers[id] = { meta: JSON.parse(json[0]), contenu: json[1] }; return rep(r, { id });
    }
    let x = /^\/upload\/drive\/v3\/files\/(\w+)$/.exec(u.pathname);
    if (x && m === 'PATCH') { if (!G.fichiers[x[1]]) return rep(r, { error: { message: 'absent' } }, 404); G.fichiers[x[1]].contenu = corps; return rep(r, { id: x[1] }); }
    if (u.pathname === '/drive/v3/files' && m === 'GET') { const L = Object.keys(G.fichiers).filter(k => G.fichiers[k].meta.appProperties && G.fichiers[k].meta.appProperties.jauge === 'sauvegarde'); return rep(r, { files: L.map(id => ({ id, modifiedTime: '2026-11-20T18:00:00Z' })) }); }
    x = /^\/drive\/v3\/files\/(\w+)$/.exec(u.pathname);
    if (x && u.searchParams.get('alt') === 'media') return r.fulfill({ status: 200, contentType: 'application/json', body: G.fichiers[x[1]].contenu });
    if (u.pathname === '/v4/spreadsheets' && m === 'POST') {
      const d = JSON.parse(corps), id = 's' + (Object.keys(G.sheets).length + 1);
      G.sheets[id] = { titre: d.properties.title, onglets: {} }; d.sheets.forEach(s => { G.sheets[id].onglets[s.properties.title] = []; });
      return rep(r, { spreadsheetId: id, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + id, sheets: d.sheets.map((s, i) => ({ properties: { title: s.properties.title, sheetId: 100 + i, gridProperties: { rowCount: 1000 } } })) });
    }
    x = /^\/v4\/spreadsheets\/(\w+)(:batchUpdate|\/values:batchClear|\/values:batchUpdate)?$/.exec(u.pathname);
    if (x) {
      const S = G.sheets[x[1]]; if (!S) return rep(r, { error: { message: 'absent' } }, 404);
      if (x[2] === '/values:batchClear') { Object.keys(S.onglets).forEach(k => { S.onglets[k] = []; }); return rep(r, {}); }
      if (x[2] === '/values:batchUpdate') { JSON.parse(corps).data.forEach(d => { S.onglets[d.range.replace(/^'(.*)'!A1$/, '$1').replace(/''/g, "'")] = d.values; }); return rep(r, {}); }
      return rep(r, { spreadsheetId: x[1] });
    }
    return rep(r, { error: { message: 'inconnu ' + u.pathname } }, 400);
  });
}
const lignesJournal = () => { const s = Object.values(G.sheets)[0]; return s ? (s.onglets['Journal'] || []).map(L => L[1]) : []; };
const contenuJSON = () => { const f = Object.values(G.fichiers)[0]; return f ? JSON.parse(f.contenu) : null; };

(async () => {
  const b = await chromium.launch();
  const journal = B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3'));
  const { p, errs, ctx } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, []);
  await fauxGoogle(p);
  await p.evaluate(() => { window.__svgDelai = 300; });
  await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await passerTelephone(); });
  // A : activation
  const a0 = await p.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); return document.querySelector('#sheetIn').innerText; });
  await p.click('[data-act="drive-connecter"]'); await p.waitForTimeout(1500);
  const a = await p.evaluate(() => ({ svg: LS.get('svg', null), gis: window.__gis, txt: document.querySelector('#sheetIn').innerText }));
  const js = contenuJSON(), sh = Object.values(G.sheets)[0];
  ok('A_activation', /Pas encore activée/.test(a0) && a.svg && a.svg.sheet && a.svg.json && a.gis && a.gis[0].prompt === 'consent' && js && js.classeur && sh
    && Object.keys(sh.onglets).join(',') === 'Journal,Échéancier,Paramètres,À venir' && lignesJournal().filter(x => x === 'Bus').length === journal.filter(l => l.lib === 'Bus').length
    && /Dernière sauvegarde/.test(a.txt) && /à jour/.test(a.txt) && /Ouvrir la sauvegarde/.test(a.txt), { svg: a.svg, gis: a.gis, onglets: sh && Object.keys(sh.onglets), txt: a.txt.slice(0, 400) });
  const cats = sh ? (sh.onglets['Paramètres'] || []).slice(9, 13).map(L => L.slice(0, 3).join('|')) : [];
  ok('A_formatParametres', cats[0] === 'Salaire|Revenus|Revenu' && sh.onglets['Journal'][3][12] === 'Saisi le', { cats, entete: sh && sh.onglets['Journal'][3] });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'svg-active.png') });
  // B : saisie → sauvegarde automatique (délai raccourci pour le test)
  const nAvant = G.appels.length;
  await p.evaluate(async () => { fermer(); ouvrirSaisie(null); S.form.montant = '4,20'; S.form.cat = 'Courses'; S.form.lib = 'Croissants'; enregistrer(); await new Promise(x => setTimeout(x, 2500)); });
  const bjs = contenuJSON(), bTxt = JSON.stringify(bjs);
  ok('B_auto', /Croissants/.test(bTxt) && lignesJournal().includes('Croissants') && G.appels.slice(nAvant).some(x => /^PATCH/.test(x)), { appels: G.appels.slice(nAvant) });
  // C : accès expiré → message, rien de perdu, puis « Sauvegarder maintenant »
  G.expire = true;
  await p.evaluate(async () => { ouvrirSaisie(null); S.form.montant = '2'; S.form.cat = 'Courses'; S.form.lib = 'Baguette'; S._saveT = 0; enregistrer(); await new Promise(x => setTimeout(x, 2500)); });
  const c1 = await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await new Promise(x => setTimeout(x, 500)); return { txt: document.querySelector('#sheetIn').innerText, ligne: S.journal.some(e => e.lib === 'Baguette' && e.row) }; });
  await p.click('[data-act="drive-sauver"]'); await p.waitForTimeout(2000);
  const c2 = await p.evaluate(() => ({ gis: window.__gis, txt: document.querySelector('#sheetIn').innerText }));
  ok('C_expire', c1.ligne && /expiré|renouveler/.test(c1.txt) && /à sauvegarder/.test(c1.txt) && lignesJournal().includes('Baguette') && c2.gis.length === 2 && c2.gis[1].prompt === '' && /à jour/.test(c2.txt),
    { c1: c1.txt.slice(0, 500), gis: c2.gis, c2: c2.txt.slice(0, 300) });
  errs.length; await ctx.close();
  // D : nouveau téléphone (mémoire vide), mode fichier → reprendre la sauvegarde
  const { p: q, errs: e2, ctx: ctx2 } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, []);
  await fauxGoogle(q);
  await q.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); });
  await q.click('[data-act="drive-restaurer"]'); await q.waitForTimeout(1500);
  const d1 = await q.evaluate(() => ({ mode: S.mode, txt: document.querySelector('#sheetIn').innerText }));
  await q.click('[data-act="drive-restaurer"]'); await q.waitForTimeout(2000);
  const d2 = await q.evaluate(async () => { await rafraichir(true); return { mode: S.mode, libs: S.journal.filter(e => /Croissants|Baguette/.test(e.lib || '')).map(e => e.lib), n: S.journal.length }; });
  ok('D_restauration', d1.mode === 'fichier' && /TOUCHE ENCORE/.test(d1.txt) && d2.mode === 'tel' && d2.libs.length === 2 && d2.n === journal.length + 2, { d1: d1.txt.slice(0, 300), d2 });
  if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'svg-restaure.png') });
  errs.push(...e2); await ctx2.close();
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
