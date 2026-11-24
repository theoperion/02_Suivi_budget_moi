// Code.js (Apps Script) testé en Node : faux SpreadsheetApp / PropertiesService / CacheService / LockService.
// Vérifie la mémoire durable des envois (uid), les renvois après coupure et le libellé écrit en texte.
// Usage : node outils/tests/codeX3.js <dossier de l'appli>
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = process.argv[2] || path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(DIR, 'apps-script', 'Code.js'), 'utf8');

// Feuille simulée : comme Sheets, un texte « =… » devient une formule, « 1,20 » un nombre, « 12/11 » une date,
// sauf s'il commence par une apostrophe (qui n'est pas gardée), ou si la cellule est au format « Texte brut » (@) :
// alors le texte est gardé tel quel, apostrophe comprise.
function convertir(v, texteBrut) {
  if (typeof v !== 'string') return v;
  if (texteBrut) return v;
  if (v[0] === "'") return v.slice(1);
  if (v[0] === '=') return '#ERROR!';
  if (/^[+-]?\d+([.,]\d+)?$/.test(v)) return Number(v.replace(',', '.'));
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(v)) return new Date(2026, +v.split('/')[1] - 1, +v.split('/')[0]);
  if (/^(vrai|true)$/i.test(v)) return true;
  return v;
}
function feuille(nom, lignes, cols) {
  const g = Array.from({ length: lignes }, () => Array(cols).fill('')), fmt = {};
  const brut = (i, j) => fmt[i + ':' + j] === '@';
  const sh = {
    nom, g,
    getMaxRows: () => g.length, getMaxColumns: () => g[0].length,
    insertRowsAfter: (a, n) => { for (let i = 0; i < n; i++) g.push(Array(g[0].length).fill('')); },
    insertColumnsAfter: (a, n) => g.forEach(r => { for (let i = 0; i < n; i++) r.push(''); }),
    deleteRow: r => { g.splice(r - 1, 1); const f2 = {}; Object.keys(fmt).forEach(k => { const [a, b] = k.split(':').map(Number); if (a !== r) f2[(a > r ? a - 1 : a) + ':' + b] = fmt[k]; }); Object.keys(fmt).forEach(k => delete fmt[k]); Object.assign(fmt, f2); },
    getRange: (r, c, nr, nc) => {
      if (typeof r === 'string') { const m = /^([A-Z])(\d+)(?::([A-Z])(\d+))?$/.exec(r); const C = x => x.charCodeAt(0) - 64; c = C(m[1]); nc = m[3] ? C(m[3]) - c + 1 : 1; nr = m[4] ? +m[4] - +m[2] + 1 : 1; r = +m[2]; }
      nr = nr || 1; nc = nc || 1;
      const R = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (g[r - 1 + i] || [])[c - 1 + j] ?? '')),
        getDisplayValues: () => R.getValues().map(x => x.map(String)),
        setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { g[r - 1 + i][c - 1 + j] = convertir(x, brut(r + i, c + j)); })); return R; },
        setValue: x => { g[r - 1][c - 1] = convertir(x, brut(r, c)); return R; },
        getValue: () => R.getValues()[0][0],
        setNumberFormat: f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fmt[(r + i) + ':' + (c + j)] = f; return R; }, clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) g[r - 1 + i][c - 1 + j] = ''; return R; },
        getFormula: () => '', setFormula: () => R
      };
      return R;
    }
  };
  return sh;
}
function monde() {
  const par = feuille('Paramètres', 100, 14), jou = feuille('Journal', 30, 14), ech = feuille('Échéancier', 30, 10), av = feuille('À venir', 30, 6);
  par.getRange(10, 1, 3, 1).setValues([['Salaire'], ['Courses'], ['Loyer']]);
  ['Octobre 2026', 'Novembre 2026', 'Décembre 2026'].forEach((m, i) => { par.g[3 + i][13] = m; });
  const feuilles = { 'Paramètres': par, 'Journal': jou, 'Échéancier': ech, 'À venir': av };
  const classeur = { getSheetByName: n => feuilles[n] || null, getSpreadsheetTimeZone: () => 'Europe/Paris', getRangeByName: () => null, getUrl: () => 'x', getName: () => 'test', insertSheet: n => (feuilles[n] = feuille(n, 5, 6)) };
  const props = {}, cache = {}, ecrit = { UIDS: 0 };
  const ctx = {
    console: { log() {}, error() {} }, JSON, Math, Date, Number, String, Array, Object, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => classeur, openById: () => classeur }, // openById : copies générées (ID_FICHIER renseigné)
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { if (String(v).length > 9000) throw new Error('trop long'); if (k in ecrit) ecrit[k]++; props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
    ContentService: { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  props.APP_KEY = 'k';
  // Chaque appel = une nouvelle exécution Apps Script (variables globales remises à zéro).
  const appel = req => { vm.runInContext('SS_ = null; UIDS_ = null; UIDS_SALE_ = false;', ctx); return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ key: 'k' }, req)) } })); }; // comme l'appli (doPost)
  return { appel, jou, ech, av, props, cache, ecrit };
}
const lignes = sh => sh.g.slice(4).filter(r => r.slice(0, 4).some(v => v !== '')).map(r => r[1] + ':' + r[3]).join(' | ');
const ligne = (lib, montant, uid) => ({ mois: 'Novembre 2026', lib, cat: 'Courses', montant, uid });
const OK = {}, R = {};

// P4 : un ajout renvoyé le lendemain (mémoire de 6 h vidée) ne crée pas de doublon.
{ const w = monde();
  w.appel({ action: 'add', ligne: ligne('Café', 3, 'u1') });
  for (const k in w.cache) delete w.cache[k]; // CacheService vidé (6 h passées)
  const r = w.appel({ action: 'add', ligne: ligne('Café', 3, 'u1') });
  R.P4 = { journal: lignes(w.jou), r }; OK.P4 = lignes(w.jou) === 'Café:3' && r.deja === true && r.row === 5; }
// Ajout rejoué après des suppressions au-dessus : la ligne renvoyée est sa nouvelle place.
{ const w = monde();
  w.appel({ action: 'add', ligne: ligne('A', 1, 'a') }); w.appel({ action: 'add', ligne: ligne('B', 2, 'b') }); w.appel({ action: 'add', ligne: ligne('C', 3, 'c') });
  w.appel({ action: 'delete', row: 6, attendu: ligne('B', 2), uid: 'dB' });
  const r = w.appel({ action: 'add', ligne: ligne('C', 3, 'c') });
  R.addDecale = { journal: lignes(w.jou), r }; OK.addDecale = r.row === 6 && lignes(w.jou) === 'A:1 | C:3'; }
// (24/11/2026) La lecture de l'ancienne mémoire de 6 h (CacheService, avant 5.14) a été retirée du script : plus de cas à tester.
// P1 : suppression renvoyée (uid) → la 2e ligne identique reste.
{ const w = monde();
  ['Café', 'Pain', 'Pain', 'Riz'].forEach((l, i) => w.appel({ action: 'add', ligne: ligne(l, l === 'Pain' ? 1.2 : 3, 'x' + i) }));
  const r1 = w.appel({ action: 'delete', row: 6, attendu: ligne('Pain', 1.2), uid: 'd1' });
  const r2 = w.appel({ action: 'lot', ops: [{ action: 'delete', row: 6, attendu: ligne('Pain', 1.2), uid: 'd1' }] });
  R.P1 = { journal: lignes(w.jou), r1, r2 }; OK.P1 = lignes(w.jou) === 'Café:3 | Pain:1.2 | Riz:3' && r2.res[0].ok && r2.res[0].deja && r2.res[0].decale === true; }
// Modification renvoyée (déjà faite) → ok, pas « La ligne a changé ».
{ const w = monde();
  w.appel({ action: 'add', ligne: ligne('Riz', 6, 'r') });
  const a = w.appel({ action: 'update', row: 5, attendu: ligne('Riz', 6), ligne: ligne('Riz', 9) });
  const b = w.appel({ action: 'update', row: 5, attendu: ligne('Riz', 6), ligne: ligne('Riz', 9) });
  const c = w.appel({ action: 'update', row: 5, attendu: ligne('Riz', 6), ligne: ligne('Riz', 12) });
  OK.updateRejoue = a.ok && b.ok && !c.ok && c.error === 'CHANGE' && lignes(w.jou) === 'Riz:9'; }
// P3 : Échéancier et À venir, nouvelle ligne renvoyée → pas de 2e ligne.
{ const w = monde();
  const e = { lib: 'Netflix', cat: 'Loyer', montant: 13, freq: 'Mensuel', jour: 10, f: 1, g: 12 };
  const r1 = w.appel({ action: 'ech-save', row: null, e, uid: 'n1' }), r2 = w.appel({ action: 'ech-save', row: null, e, uid: 'n1' });
  const a = { mois: 'Décembre 2026', lib: 'Vélo', cat: 'Courses', montant: 200, jour: 3 };
  const s1 = w.appel({ action: 'av-save', row: null, a, uid: 'v1' }), s2 = w.appel({ action: 'av-save', row: null, a, uid: 'v1' });
  const nEch = w.ech.g.slice(4).filter(r => r[0] !== '').length, nAv = w.av.g.slice(3).filter(r => r[1] !== '').length;
  const d1 = w.appel({ action: 'ech-del', row: r1.row, attendu: { lib: 'Netflix', cat: 'Loyer', montant: 13 } }), d2 = w.appel({ action: 'ech-del', row: r1.row, attendu: { lib: 'Netflix', cat: 'Loyer', montant: 13 } });
  R.P3 = { r1, r2, s1, s2, nEch, nAv, d2 }; OK.P3 = r1.ok && r2.deja && r2.row === r1.row && s2.deja && s2.row === s1.row && nEch === 1 && nAv === 1 && d1.ok && d2.ok; }
// P7 : libellés « =x », « +3 », « 1,20 », « 12/11 », « Vrai » écrits en texte, puis modifiables sans « La ligne a changé ».
{ const w = monde(), libs = ['=SOMME(A1)', '+3 cafés', '1,20', '12/11', 'Vrai', '-5', '@Paul', 'nov. 12', 'Pain'];
  libs.forEach((l, i) => w.appel({ action: 'add', ligne: ligne(l, 2, 'l' + i) }));
  const lus = w.jou.g.slice(4, 4 + libs.length).map(r => r[1]);
  const maj = libs.map((l, i) => w.appel({ action: 'update', row: 5 + i, attendu: ligne(l, 2), ligne: ligne(l, 3) }).ok);
  R.P7 = { lus, maj }; OK.P7 = JSON.stringify(lus) === JSON.stringify(libs) && maj.every(Boolean); }
// Libellés à risque dans l'Échéancier et « À venir » : gardés tels quels ; une cellule déjà en texte brut ne garde pas d'apostrophe en trop.
{ const w = monde();
  const e = w.appel({ action: 'ech-save', row: null, e: { lib: '1,20', cat: 'Loyer', montant: 13, freq: 'Mensuel', jour: 10, f: 1, g: 12 }, uid: 'e7' });
  const a = w.appel({ action: 'av-save', row: null, a: { mois: 'Décembre 2026', lib: '12/11', cat: 'Courses', montant: 20, jour: 3 }, uid: 'a7' });
  w.appel({ action: 'add', ligne: ligne('=2+2', 1, 't1') });
  const u = w.appel({ action: 'update', row: 5, attendu: ligne('=2+2', 1), ligne: ligne('+33 6', 1) });
  R.texte = { ech: w.ech.g[e.row - 1][0], av: w.av.g[a.row - 1][1], jou: w.jou.g[4][1], u };
  OK.texte = R.texte.ech === '1,20' && R.texte.av === '12/11' && R.texte.jou === '+33 6' && u.ok; }
// Un lot de 10 ajouts : la propriété UIDS n'est écrite qu'une fois (et contient les 10).
{ const w = monde();
  const r = w.appel({ action: 'lot', ops: Array.from({ length: 10 }, (_, i) => Object.assign({ action: 'add' }, { ligne: ligne('L' + i, 1, 'lot' + i) })) });
  const m = JSON.parse(w.props.UIDS || '{}');
  R.uidsUneFois = { ecritures: w.ecrit.UIDS, n: Object.keys(m).length };
  OK.uidsUneFois = r.ok && r.res.every(x => x.ok) && w.ecrit.UIDS === 1 && Object.keys(m).length === 10; }
// Mémoire bornée : 2 000 envois → la propriété reste sous 9 000 caractères, les plus récents sont gardés.
{ const w = monde();
  for (let i = 0; i < 2000; i++) w.appel({ action: 'delete', row: 5, attendu: ligne('Z', 1), uid: 'z' + i }); // refusés (CHANGE) : rien de retenu
  for (let i = 0; i < 400; i++) w.appel({ action: 'add', ligne: ligne('L' + i, 1, 'uidlong' + i) });
  const t = w.props.UIDS || '', m = JSON.parse(t);
  R.borne = { taille: t.length, n: Object.keys(m).length }; OK.borne = t.length <= 8000 && 'add:uidlong399' in m && !('add:uidlong0' in m) && !Object.keys(m).some(k => k.startsWith('del:')); }
console.log(JSON.stringify(R, null, 1));
console.log('CONTRÔLES:', JSON.stringify(OK));
console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
