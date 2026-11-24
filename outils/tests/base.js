// Tests ciblés lot G1 : nouvelles saisons (gagné/raté, dates exactes), éditions, vue par thème, succès non gagnables trop tôt
const { chromium } = require('playwright'); const fs = require('fs');
const FILE = process.argv[2], SP = '/tmp/claude-0/-home-user/90b26bed-93bd-5223-810a-380eb23bf8fd/scratchpad/testG1/';
const html = fs.readFileSync(FILE, 'utf8'); const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CATS = [
  { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
  { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
  { ligne: 13, nom: 'Restaurants', groupe: 'Vie courante', type: 'Dépense', budget: 150, suivi: 'Mensuel' },
  { ligne: 14, nom: 'Transport', groupe: 'Vie courante', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 15, nom: 'Sorties', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
  { ligne: 16, nom: 'Bricoles', groupe: 'Divers', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 17, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 18, nom: 'Streaming', groupe: 'Abonnements', type: 'Dépense', budget: null, suivi: '' },
  { ligne: 19, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' }];
function donnees(journal, prefs, ech) {
  return { categories: CATS, mois: [2026, 2027, 2028, 2029, 2030, 2031].flatMap(y => MOIS.map(m => m + ' ' + y)), soldes: { '2026': 1000 }, debut: null,
    echeancier: ech || [], journal, libres: 22, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: prefs || {}, url: 'x', apiVersion: '5.11', anomalies: '✅', lu: '2026-11-05T09:00:00.000Z' };
}
async function page(b, date, journal, prefs, ls, ech) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = [];
  await p.clock.setFixedTime(new Date(date)); p.on('pageerror', e => errs.push(e.message));
  const PRF = Object.assign({}, prefs || {});
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData()); if (q.action === 'pref-set') PRF[q.cle] = q.valeur;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(q.action === 'data' ? { ok: true, data: donnees(journal, JSON.parse(JSON.stringify(PRF)), ech) } : { ok: true }) }); }
    if (/^http:\/\/app\.test\/(moteur\.js|sauvegarde\.js|apps-script\/Code\.js)/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(require('path').join(require('path').dirname(FILE), new URL(u).pathname.slice(1))) }); // mode téléphone (phase 2)
    if (u.startsWith('http://app.test/')) return r.fulfill({ status: 200, contentType: 'text/html', body: html });
    return r.fulfill({ status: 200, body: '' }); });
  await p.addInitScript(([api, ls]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); const set = (k, v) => localStorage.setItem('jauge.' + k, JSON.stringify(v));
    set('key', 'k'); set('api', api); set('apiDefautVu', api); localStorage.setItem('jauge.tutoVu', 'true'); set('anticipe', true); Object.entries(ls || {}).forEach(([k, v]) => set(k, v)); } }, [API, ls]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000); await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains').forEach(x => x.remove()); });
  return { p, ctx, errs, PRF };
}
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// Journal : salaire chaque 1er ; une dépense « Transport » (casse le jour calme) chaque jour de casse(k) ; extra = lignes en plus
function journal(debut, fin, casse, extra) {
  const J = []; let row = 5;
  for (let d = new Date(debut + 'T00:00:00'); iso(d) < fin; d.setDate(d.getDate() + 1)) { const k = iso(d), y = d.getFullYear(), m = d.getMonth() + 1, mois = MOIS[m - 1] + ' ' + y;
    if (d.getDate() === 1) J.push({ row: row++, mois, lib: 'Salaire', cat: 'Salaire', montant: 2000, date: k });
    if (casse(k)) J.push({ row: row++, mois, lib: 'Bus', cat: 'Transport', montant: 2, date: k });
    if (d.getDate() % 4 === 2) J.push({ row: row++, mois, lib: 'Pain', cat: 'Courses', montant: 1, date: k }); } // (lot L2) preuve d'utilisation : une petite course (ne casse rien) tous les 4 jours
  (extra || []).forEach(([k, cat, montant, o]) => { const [y, m] = k.split('-').map(Number); J.push(Object.assign({ row: row++, mois: MOIS[m - 1] + ' ' + y, lib: cat, cat, montant, date: k }, o || {})); });
  return J;
}
// ---------- Faux Google ----------
const GIS = `window.google = { accounts: { oauth2: { initTokenClient: c => ({ requestAccessToken: o => { window.__gis = (window.__gis || []).concat([o]); setTimeout(() => c.callback({ access_token: 'jeton', expires_in: 3600 }), 20); } }) } } };`;
// Faux Google (connexion, Drive, Sheets) pour les tests du mode téléphone. G : état partagé { fichiers, sheets, appels, expire, panne }.
async function fauxGoogle(page, G) {
  G = G || { fichiers: {}, sheets: {}, appels: [], expire: false, panne: null }; G.fichiers = G.fichiers || {}; G.sheets = G.sheets || {}; G.appels = G.appels || [];
  await page.route('https://accounts.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: GIS }));
  const rep = (r, o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o || {}) });
  await page.route(/googleapis\.com/, async r => {
    const q = r.request(), u = new URL(q.url()), m = q.method(), corps = q.postData() || '';
    G.appels.push(m + ' ' + u.pathname);
    if (G.expire) { G.expire = false; return rep(r, { error: { message: 'expiré' } }, 401); }
    if (G.panne && G.panne.test(m + ' ' + u.pathname)) { G.panne = null; return rep(r, { error: { message: 'panne' } }, 500); }
    if (u.pathname === '/upload/drive/v3/files' && m === 'POST') { // création multipart
      const parts = corps.split(/\r\n--[^\r\n]+/); const json = parts.map(p => p.split('\r\n\r\n')[1]).filter(Boolean);
      G.n = (G.n || 0) + 1; const id = 'f' + G.n; G.fichiers[id] = { meta: JSON.parse(json[0]), contenu: json[1] }; return rep(r, { id });
    }
    let x = /^\/upload\/drive\/v3\/files\/(\w+)$/.exec(u.pathname);
    if (x && m === 'PATCH') { if (!G.fichiers[x[1]]) return rep(r, { error: { message: 'absent' } }, 404); G.fichiers[x[1]].contenu = corps; return rep(r, { id: x[1] }); }
    if (u.pathname === '/drive/v3/files' && m === 'GET') { const v = /value='(\w+)'/.exec(u.searchParams.get('q') || ''); const L = Object.keys(G.fichiers).filter(k => G.fichiers[k].meta.appProperties && G.fichiers[k].meta.appProperties.jauge === (v ? v[1] : 'sauvegarde')).reverse(); return rep(r, { files: L.map(id => ({ id, modifiedTime: '2026-11-20T18:00:00Z' })) }); }
    x = /^\/drive\/v3\/files\/(\w+)$/.exec(u.pathname);
    if (x && m === 'DELETE') { delete G.fichiers[x[1]]; return r.fulfill({ status: 204, body: '' }); }
    if (x && u.searchParams.get('alt') === 'media') return r.fulfill({ status: 200, contentType: 'application/json', body: G.fichiers[x[1]].contenu });
    if (u.pathname === '/v4/spreadsheets' && m === 'POST') {
      const d = JSON.parse(corps), id = 's' + (Object.keys(G.sheets).length + 1);
      G.sheets[id] = { titre: d.properties.title, onglets: {} }; d.sheets.forEach(s => { G.sheets[id].onglets[s.properties.title] = []; });
      return rep(r, { spreadsheetId: id, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + id, sheets: d.sheets.map((s, i) => ({ properties: { title: s.properties.title, sheetId: 100 + i, gridProperties: { rowCount: 1000 } } })) });
    }
    x = /^\/v4\/spreadsheets\/(\w+)(:batchUpdate|\/values:batchClear|\/values:batchUpdate)?$/.exec(u.pathname);
    if (x) {
      const S = G.sheets[x[1]]; if (!S) return rep(r, { error: { message: 'absent' } }, 404);
      if (x[2] === '/values:batchClear') { JSON.parse(corps).ranges.forEach(rg => { const k = /^'(.*)'(?:!A(\d+):Z)?$/.exec(rg); const o = k[1].replace(/''/g, "'"); S.onglets[o] = k[2] ? (S.onglets[o] || []).slice(0, +k[2] - 1) : []; }); return rep(r, {}); }
      if (x[2] === '/values:batchUpdate') { JSON.parse(corps).data.forEach(d => { const o = d.range.replace(/^'(.*)'!A1$/, '$1').replace(/''/g, "'"); const old = S.onglets[o] || []; S.onglets[o] = d.values.concat(old.slice(d.values.length)); }); return rep(r, {}); }
      return rep(r, { spreadsheetId: x[1] });
    }
    return rep(r, { error: { message: 'inconnu ' + u.pathname } }, 400);
  });
  return G;
}
module.exports = { page, journal, iso, MOIS, CATS, fauxGoogle };
