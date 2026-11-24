// Sauvegarde Drive du mode téléphone (sauvegarde.js), avec un faux Google (connexion, Drive, Sheets) :
// A activation (fichier technique + Google Sheet aux onglets du fichier budget) ; B sauvegarde automatique après une saisie ;
// C accès Google expiré : rien de perdu, message, puis « Sauvegarder maintenant » renouvelle et sauvegarde ;
// D nouveau téléphone : « Reprendre ma sauvegarde du Drive » (2 touchers) redonne toutes les données.
// Usage : node outils/tests/lotTel3.js <dossier de l'appli> [dossier captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };

const G = { fichiers: {}, sheets: {}, appels: [], expire: false, panne: null };
const fauxGoogle = pg => B.fauxGoogle(pg, G);
const lignesJournal = () => { const s = Object.values(G.sheets)[0]; return s ? (s.onglets['Journal'] || []).map(L => L[1]) : []; };
const contenuJSON = () => { const f = Object.values(G.fichiers)[0]; return f ? JSON.parse(f.contenu) : null; };

(async () => {
  const b = await chromium.launch();
  const journal = B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3'));
  const { p, errs, ctx } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, []);
  await fauxGoogle(p);
  await p.evaluate(() => { window.__svgDelai = 300; });
  // F : en mode fichier, aucun appel à Google (ouverture, saisie)
  await p.evaluate(async () => { ouvrirSaisie(null); S.form.montant = '1'; S.form.cat = 'Courses'; S.form.lib = 'Avant'; enregistrer(); await new Promise(x => setTimeout(x, 2000)); });
  ok('F_aucunAppelGoogleEnModeFichier', G.appels.length === 0, G.appels);
  // A : le passage demande l'accord Google, copie, crée la sauvegarde, puis bascule
  const a0 = await p.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); return document.querySelector('#sheetIn').innerText; });
  await p.click('[data-act="donnees-tel"]'); await p.waitForTimeout(2500);
  await p.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(600);
  const a = await p.evaluate(() => ({ mode: S.mode, svg: LS.get('svg', null), gis: window.__gis, txt: document.querySelector('#sheetIn').innerText }));
  const js = contenuJSON(), sh = Object.values(G.sheets)[0];
  ok('A_activation', /PASSER SUR CE TÉLÉPHONE/.test(a0) && a.mode === 'tel' && a.svg && a.svg.sheet && a.svg.json && a.gis && a.gis[0].prompt === 'consent' && js && js.classeur && sh
    && Object.keys(sh.onglets).join(',') === 'Journal,Échéancier,Paramètres,À venir' && lignesJournal().filter(x => x === 'Bus').length === journal.filter(l => l.lib === 'Bus').length
    && /Dernière sauvegarde/.test(a.txt) && /à jour/.test(a.txt) && /Ouvrir ma sauvegarde/.test(a.txt) && Object.values(G.fichiers).filter(f => f.meta.appProperties.jauge === 'copie').length === 1, { svg: a.svg, gis: a.gis, onglets: sh && Object.keys(sh.onglets), txt: a.txt.slice(0, 400) });
  const cats = sh ? (sh.onglets['Paramètres'] || []).slice(9, 13).map(L => L.slice(0, 3).join('|')) : [];
  ok('A_formatParametres', cats[0] === 'Salaire|Revenus|Revenu' && sh.onglets['Journal'][3][12] === 'Saisi le', { cats, entete: sh && sh.onglets['Journal'][3] });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'svg-active.png') });
  // B : saisie → sauvegarde automatique (délai raccourci pour le test)
  const nAvant = G.appels.length;
  await p.evaluate(async () => { fermer(); ouvrirSaisie(null); S.form.montant = '4,20'; S.form.cat = 'Courses'; S.form.lib = 'Croissants'; S._saveT = 0; enregistrer(); await new Promise(x => setTimeout(x, 2500)); });
  const bjs = contenuJSON(), bTxt = JSON.stringify(bjs);
  ok('B_auto', /Croissants/.test(bTxt) && lignesJournal().includes('Croissants') && G.appels.slice(nAvant).some(x => /^PATCH/.test(x)), { appels: G.appels.slice(nAvant) });
  // C : accès expiré → message, rien de perdu, puis « Sauvegarder maintenant »
  G.expire = true;
  await p.evaluate(async () => { ouvrirSaisie(null); S.form.montant = '2'; S.form.cat = 'Courses'; S.form.lib = 'Baguette'; S._saveT = 0; enregistrer(); await new Promise(x => setTimeout(x, 2500)); });
  const c1 = await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await new Promise(x => setTimeout(x, 500)); return { txt: document.querySelector('#sheetIn').innerText, ligne: S.journal.some(e => e.lib === 'Baguette' && e.row) }; });
  await p.click('[data-act="drive-sauver"]'); await p.waitForTimeout(2000);
  const c2 = await p.evaluate(() => ({ gis: window.__gis, txt: document.querySelector('#sheetIn').innerText }));
  ok('C_expire', c1.ligne && /en pause/.test(c1.txt) && /pas encore sauvegardé/.test(c1.txt) && lignesJournal().includes('Baguette') && c2.gis.length === 2 && c2.gis[1].prompt === '' && /à jour/.test(c2.txt),
    { c1: c1.txt.slice(0, 500), gis: c2.gis, c2: c2.txt.slice(0, 300) });
  // E : panne de Google au milieu d'une sauvegarde automatique : le Sheet garde ses lignes, la suivante répare
  const avantPanne = lignesJournal().length; G.panne = /values:batchUpdate/;
  await p.evaluate(async () => { ouvrirSaisie(null); S.form.montant = '3'; S.form.cat = 'Courses'; S.form.lib = 'Pain complet'; S._saveT = 0; enregistrer(); await new Promise(x => setTimeout(x, 2500)); });
  const e1 = { lignes: lignesJournal().length, json: /Pain complet/.test(JSON.stringify(contenuJSON())) };
  await p.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(600);
  await p.click('[data-act="drive-sauver"]'); await p.waitForTimeout(2000);
  ok('E_panneEnCours', e1.lignes === avantPanne && e1.json && lignesJournal().includes('Pain complet'), { e1, apres: lignesJournal().length });
  errs.length; await ctx.close();
  // D : nouveau téléphone (mémoire vide), mode fichier → reprendre la sauvegarde
  const { p: q, errs: e2, ctx: ctx2 } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, []);
  await fauxGoogle(q);
  await q.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); });
  await q.click('[data-act="drive-restaurer"]'); await q.waitForTimeout(1500);
  const d1 = await q.evaluate(() => ({ mode: S.mode, txt: document.querySelector('#sheetIn').innerText }));
  await q.click('[data-act="drive-restaurer"]'); await q.waitForTimeout(2000);
  const d2 = await q.evaluate(async () => { await rafraichir(true); return { mode: S.mode, libs: S.journal.filter(e => /Croissants|Baguette|Pain complet/.test(e.lib || '')).map(e => e.lib), n: S.journal.length }; });
  await q.evaluate(async () => { window.__svgDelai = 300; SV_ = null; ouvrirSaisie(null); S.form.montant = '5'; S.form.cat = 'Courses'; S.form.lib = 'Après reprise'; enregistrer(); await new Promise(x => setTimeout(x, 300)); });
  await q.evaluate(() => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); }); await q.waitForTimeout(500); await q.click('[data-act="drive-sauver"]'); await q.waitForTimeout(2000);
  ok('D_restauration', d1.mode === 'fichier' && /TOUCHE ENCORE/.test(d1.txt) && d2.mode === 'tel' && d2.libs.length === 3 && d2.n === journal.length + 3, { d1: d1.txt.slice(0, 300), d2 });
  ok('D_memeSheet', Object.keys(G.sheets).length === 1 && lignesJournal().includes('Après reprise'), { sheets: Object.keys(G.sheets) });
  if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'svg-restaure.png') });
  errs.push(...e2); await ctx2.close();
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
