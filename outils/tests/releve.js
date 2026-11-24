// Relevé de l'appli (chantier « nettoyage », 24/11/2026) : ouvre chaque écran et chaque fenêtre avec des données fixes,
// et écrit tout le texte affiché + les calculs de chaque mois dans un fichier. Avant/après un nettoyage, les deux relevés
// doivent être identiques (diff vide) : rien n'a changé pour l'utilisateur.
// Usage : node outils/tests/releve.js <chemin d'index.html> <fichier de sortie> [tel]
// « tel » : passe d'abord l'appli en mode « données sur ce téléphone » (phase 2) : le relevé doit être le même qu'avec le fichier.
const { chromium } = require('playwright'); const fs = require('fs');
const B = require('./base.js');
const SORTIE = process.argv[3] || 'releve.txt';

// Données riches : janvier → 20 novembre 2026, toutes les catégories, échéancier, épargne, retrait, prêt, espèces.
const extra = [];
for (let m = 1; m <= 11; m++) {
  const mm = String(m).padStart(2, '0');
  extra.push([`2026-${mm}-03`, 'Loyer', 650], [`2026-${mm}-05`, 'Courses', 42.37 + m], [`2026-${mm}-09`, 'Restaurants', 23.5 * (m % 3 + 1)],
    [`2026-${mm}-12`, 'Sorties', 15 + m * 3.1], [`2026-${mm}-14`, 'Streaming', 13.49], [`2026-${mm}-15`, 'Livret A', 100],
    [`2026-${mm}-18`, 'Bricoles', 7.8, { especes: true }], [`2026-${mm}-19`, 'Courses', 61.05]);
}
extra.push(['2026-06-20', 'Livret A', -150, { lib: 'Retrait livret' }], ['2026-10-21', 'Restaurants', 300], ['2026-11-02', 'Sorties', 49.99]);
const journal = B.journal('2026-01-01', '2026-11-20', k => k.endsWith('7') || k.endsWith('1'), extra);
const ech = [
  { ligne: 5, lib: 'Assurance auto', cat: 'Transport', montant: 45, freq: 'Mensuel', jour: 10, f: 1, g: 12, h: null, i: null, pause: false },
  { ligne: 6, lib: 'Abonnement musique', cat: 'Streaming', montant: 10.99, freq: 'Mensuel', jour: 25, f: 3, g: 12, h: 2026, i: null, pause: false }];

const ETATS = [];
for (const m of [1, 6, 10, 11]) for (const tab of ['home', 'journal']) ETATS.push({ tab, y: 2026, m });
for (const v of ['mois', 'tout']) ETATS.push({ tab: 'prevu', y: 2026, m: 11, prevuVue: v });
for (const v of ['mois', 'annee']) ETATS.push({ tab: 'stats', y: 2026, m: 11, statsVue: v });
for (const t of ['bilans', 'defis', 'succes', 'style']) ETATS.push({ tab: 'stats', y: 2026, m: 11, statsVue: 'progres', progT: t });
ETATS.push({ tab: 'journal', y: 2026, m: 11, filtre: { cat: 'Courses', q: '', grp: null } });

const FENETRES = ['ouvrirReglages()', 'ouvrirSaisie(null)', "ouvrirCat('Courses')", 'ouvrirSolde()', 'ouvrirDefi()', 'ouvrirEnvies()',
  'ouvrirPetits()', 'ouvrirReglagesAchats()', "S.form={mode:'file',arm:false};rendreForm();ouvrirSheet()", "S.form={mode:'xplog'};rendreForm();ouvrirSheet()",
  "S.form={mode:'videotheque'};rendreForm();ouvrirSheet()", "S.form={mode:'vitrine'};rendreForm();ouvrirSheet()",
  "S.form={mode:'objdetail',y:2026};rendreForm();ouvrirSheet()", "S.form={mode:'tuto'};rendreForm();ouvrirSheet()",
  "ouvrirSaisie(S.journal.find(e=>e.cat==='Courses'))", "ouvrirEch(S.data.echeancier[0])"];

(async () => {
  const b = await chromium.launch();
  const { p, ctx, errs } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, ech);
  const out = [];
  if (process.argv[4] === 'tel') {
    const t = await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await passerTelephone(); return { mode: S.mode, err: (document.querySelector('#ferr') || {}).textContent || '' }; });
    if (t.mode !== 'tel') { console.log('PASSAGE EN MODE TÉLÉPHONE IMPOSSIBLE : ' + JSON.stringify(t)); process.exit(1); }
    await p.reload(); await p.waitForTimeout(2500); await p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains,.story').forEach(x => x.remove()); });
    out.push('MODE: ' + await p.evaluate(() => S.mode));
  }
  // Calculs bruts de chaque mois (chiffres exacts, avant mise en forme)
  out.push('=== CALCULS ===');
  out.push(await p.evaluate(() => {
    const r = []; const f = (n, x) => { try { return n + ' ' + JSON.stringify(x()); } catch (e) { return n + ' ERREUR ' + e.message; } };
    for (let m = 1; m <= 12; m++) r.push(f('calc 2026-' + m, () => calc(2026, m)), f('bilan 2026-' + m, () => bilan(2026, m)), f('budgets 2026-' + m, () => budgets(2026, m)));
    return r.join('\n');
  }));
  for (const e of ETATS) {
    const t = await p.evaluate(e => { try { fermer(); } catch (x) {} Object.assign(S, e); rendre(); return document.querySelector('#view').innerText; }, e);
    out.push('=== ÉCRAN ' + JSON.stringify(e) + ' ===', t);
  }
  for (const f of FENETRES) {
    const t = await p.evaluate(f => { try { fermer(); } catch (x) {} S.tab = 'home'; S.y = 2026; S.m = 11; rendre();
      try { (0, eval)(f); } catch (x) { return 'ERREUR ' + x.message; } return document.querySelector('#sheet').innerText; }, f);
    out.push('=== FENÊTRE ' + f + ' ===', t);
  }
  out.push('=== ERREURS JS ===', errs.join('\n') || 'aucune');
  fs.writeFileSync(SORTIE, out.join('\n'));
  console.log('Relevé écrit : ' + SORTIE + ' (' + out.join('\n').length + ' caractères) · ERREURS JS: ' + (errs.length ? errs.join(' | ') : 'aucune'));
  await b.close();
})();
