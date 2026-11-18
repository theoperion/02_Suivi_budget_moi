// G3 : Réglages réorganisés, tout activé, sans vibrations
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOT = process.argv[3] || '';
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
let echecs = 0; const ok = (c, m, v) => { if (!c) echecs++; console.log((c ? 'OK   ' : 'ÉCHEC') + ' · ' + m + (v !== undefined ? ' · ' + JSON.stringify(v) : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const data = { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 13, nom: 'Loisirs', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' }, // depuis le lot H, Courses (essentiel) ne sert plus de défi
      { ligne: 12, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026').concat(MOIS.map(m => m + ' 2027')), soldes: { '2026': 1000 }, debut: null,
    echeancier: [], journal: [{ row: 5, mois: 'Novembre 2026', lib: 'Café', cat: 'Courses', montant: 3, date: '2026-11-02' }], libres: 5,
    controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: {}, url: 'https://docs.google.com/x', apiVersion: '5.11', anomalies: '✅', lu: new Date().toISOString() };
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com')) { const q = JSON.parse(r.request().postData()); const res = q.action === 'data' ? { ok: true, data } : q.action === 'lot' ? { ok: true, res: q.ops.map(() => ({ ok: true })) } : { ok: true }; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); }
    if (u.startsWith('http://app.test/')) return r.fulfill({ path: path.join(DIR, 'index.html') });
    return r.fulfill({ status: 200, body: '' });
  });
  await p.addInitScript(api => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('jauge.key', JSON.stringify('k')); localStorage.setItem('jauge.api', JSON.stringify(api)); localStorage.setItem('jauge.apiDefautVu', JSON.stringify(api)); localStorage.setItem('jauge.tutoVu', 'true');
    localStorage.setItem('jauge.off', JSON.stringify(['jeu', 'defi', 'series', 'saison', 'alertes', 'pj'])); localStorage.setItem('jauge.vibre', 'true'); } }, API);
  let vib = 0; await p.exposeFunction('__vib', () => { vib++; });
  await p.addInitScript(() => { try { navigator.vibrate = () => { window.__vib(); return true; }; } catch (e) {} });
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000);
  const clic = async sel => { await p.click(sel); await p.waitForTimeout(250); };
  const txt = () => p.evaluate(() => document.querySelector('#sheetIn').innerText);
  // fonctionnalités : tout disponible et actif, même avec l'ancienne préférence « off » et sans accès anticipé
  const f = await p.evaluate(() => ({ anticipe: ACCES_ANTICIPE, dispo: FEAT.map(x => dispo(x[0])), on: ['jeu','defi','series','bilan','alertes','saison','semaine','resume','objectif','pj','avances'].every(on), ouvert: ['saison','semaine','resume','objectif','alertes','cosmetiques'].every(ouvert), progres: progresVisible() }));
  ok(f.dispo.every(Boolean) && f.on && f.ouvert && f.progres, 'tout est disponible et actif', f);
  const ext = await p.evaluate(() => { const L = typeof listeCos === 'function' ? listeCos() : null; return { mascotte: typeof mascotte === 'function', cosEtendu: dispo('cosmetiques') }; });
  ok(ext.cosEtendu, 'collection étendue disponible', ext);
  // Progrès : onglets visibles
  const prog = await p.evaluate(() => { S.tab = 'stats'; S.statsVue = 'progres'; rendre(); const t = document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText; return { semaine: /SEMAINE/i.test(t), prochainement: /PROCHAINEMENT/.test(t), html: t.slice(0, 300) }; });
  ok(!prog.prochainement, 'plus de « PROCHAINEMENT » dans Progrès', prog.html);
  const onglets = await p.evaluate(() => [...document.querySelectorAll('[data-act=ptab]')].map(b => b.dataset.t));
  ok(['bilans','defis','succes','style'].every(k => onglets.includes(k)), 'onglets Progrès : bilans, défis, succès, style', onglets);
  const pt = {};
  for (const k of ['defis', 'bilans', 'style']) { await p.evaluate(k => { S.progT = k; rendre(); }, k); pt[k] = await p.evaluate(() => (document.querySelector('main') || document.body).innerText); }
  ok(/SEMAINE/i.test(pt.defis) || /semaine/i.test(pt.defis), 'défi de la semaine visible', pt.defis.slice(0, 200));
  ok(/OBJECTIF|Objectif/.test(pt.defis), "objectif d'épargne visible");
  ok(/SEMAINE/.test(pt.bilans), 'résumé de la semaine visible (bilans)');
  ok(/novembre sobre|NOVEMBRE SOBRE|avent|AVENT|saison|SAISON/i.test(pt.defis), 'saisons visibles', pt.defis.slice(0, 400));
  ok(/THÈME|Thème|MASCOTTE|Mascotte|TAMPON|Tampon/.test(pt.style), 'collection étendue visible', pt.style.slice(0, 200));
  const al = await p.evaluate(() => typeof blocAlertes === 'function' && ouvert('alertes'));
  ok(al, 'alertes futées actives');
  // Réglages
  await p.evaluate(() => { S.tab = 'home'; rendre(); S.form = { mode: 'reglages' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(400);
  let t = await txt();
  ok(!/FONCTIONNALITÉS ET NOUVEAUTÉS|Vibrations|Accès anticipé|DÉBLOQUER/.test(t), 'plus de section Fonctionnalités, ni Vibrations, ni accès anticipé');
  ok(/CHAQUE MOIS/.test(t) && /À faire ce mois-ci/.test(t), 'carte Chaque mois, contrôle à faire', t.slice(0, 200));
  const ordre = ['CHAQUE MOIS', 'MON BUDGET', 'AFFICHAGE', 'MON FICHIER ET AIDE'].map(k => t.indexOf(k));
  ok(ordre.every((x, i) => x >= 0 && (!i || x > ordre[i - 1])), 'sections dans l\'ordre', ordre);
  ok(!/APPARENCE/.test(t) && !/Mode discret/.test(t), 'bloc Affichage replié par défaut');
  ok(t.indexOf("Mode d'emploi") > t.indexOf('MON FICHIER ET AIDE'), "Mode d'emploi dans Mon fichier et aide");
  if (SHOT) await p.screenshot({ path: SHOT + '-ferme.png', fullPage: false });
  if (SHOT) { await p.evaluate(() => { document.querySelector('#sheet').scrollTop = 9999; }); await p.waitForTimeout(150); await p.screenshot({ path: SHOT + '-ferme-bas.png' }); await p.evaluate(() => { document.querySelector('#sheet').scrollTop = 0; }); }
  await clic('[data-act=regaff]'); t = await txt();
  ok(/APPARENCE/.test(t) && /ORDRE DES BUDGETS/.test(t) && /ALERTE « LIMITE »/.test(t) && /Aides et explications/.test(t) && /Mode discret/.test(t), 'bloc ouvert : apparence, ordre, alerte, aides, discret');
  if (SHOT) { await p.screenshot({ path: SHOT + '-ouvert.png' }); await p.evaluate(() => { document.querySelector('#sheet').scrollTop = 600; }); await p.waitForTimeout(150); await p.screenshot({ path: SHOT + '-ouvert-bas.png' }); await p.evaluate(() => { document.querySelector('#sheet').scrollTop = 0; }); }
  await clic('[data-act=discret]'); ok(await p.evaluate(() => LS.get('discret', false)) && /APPARENCE/.test(await txt()), 'mode discret basculé, bloc reste ouvert');
  await clic('[data-act=discret]');
  await clic('[data-act=seuil][data-t="0.95"]'); ok(await p.evaluate(() => seuil()) === 0.95, 'seuil réglé');
  await clic('[data-act=regaff]'); ok(!/APPARENCE/.test(await txt()) && await p.evaluate(() => LS.get('regAff', true)) === false, 'bloc refermé, mémorisé');
  await clic('[data-act=regaff]'); await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); }); ok(/APPARENCE/.test(await txt()), 'état ouvert mémorisé à la réouverture');
  await clic('[data-act=regaff]');
  // boutons Chaque mois
  await clic('.regm[data-act="go:solde"]'); t = await txt(); ok(/MON SOLDE/.test(t) && /NOUVEAU CONTRÔLE/.test(t), 'Contrôle du solde ouvre Mon solde');
  await clic('[data-act="go:reglages"]');
  await clic('.regm[data-act=ret-go]'); t = await txt(); ok(/RETRAIT AU DISTRIBUTEUR/.test(t) && await p.evaluate(() => document.activeElement && document.activeElement.id === 'rm'), 'Retrait ouvre directement le formulaire de retrait');
  await clic('[data-act="go:reglages"]');
  await clic('.regm[data-act="go:budgets"]'); t = await txt(); ok(/Courses/.test(t), 'Budgets par catégorie s\'ouvre', t.slice(0, 80));
  await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); });
  await clic('[data-act="go:cats"]'); ok(/NOUVELLE CATÉGORIE/.test(await txt()), 'Catégories et favorites'); await clic('[data-act="go:reglages"]');
  await clic('#sheetIn [data-act=exclus]'); t = await txt(); ok(/JOURS SANS DÉPENSE/.test(t), 'Catégories qui ne cassent pas les séries');
  await clic('[data-act=exclus-tog][data-cat=Courses]'); await clic('[data-act=exclus-ok]'); t = await txt(); ok(/CHAQUE MOIS/.test(t) && /aucune pour l'instant/.test(t), 'enregistrer revient aux Réglages, liste à jour (Courses retirée)', t.slice(0, 400));
  await clic('#sheetIn [data-act=achats-reglages]'); ok(/ACHATS PLAISIR|TAUX HORAIRE/i.test(await txt()), 'Achats plaisir (Réglages) s\'ouvre');
  await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); ouvrirSheet(); });
  await clic('#sheetIn [data-act="go:aide"]'); t = await txt(); ok(/CHAQUE MOIS/.test(t) || t.length > 200, "Mode d'emploi s'ouvre"); await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); });
  await clic('[data-act="go:lien"]'); await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); });
  await clic('#sheetIn [data-act=refresh]'); await p.waitForTimeout(500);
  // contrôle fait ce mois-ci
  await p.evaluate(() => { LS.set('ctrlFait', nowYM()); LS.set('controles', [{ date: '02/' + String(now.getMonth() + 1).padStart(2, '0'), mois: 'x', ecart: 0, solde: 1 }]); S.form = { mode: 'reglages' }; rendreForm(); ouvrirSheet(); });
  t = await txt(); ok(/✓ fait le 2 nov\./.test(t), 'contrôle fait : « ✓ fait le 2 nov. »', t.slice(0, 160));
  // vibrations
  await p.evaluate(() => { S.form = null; fermer(); vibrer(); }); 
  ok(vib === 0, 'aucune vibration', vib);
  // largeur
  const W = await p.evaluate(() => { S.form = { mode: 'reglages' }; rendreForm(); ouvrirSheet(); return document.documentElement.scrollWidth; }); ok(W <= 390, 'pas de défilement horizontal', W);
  if (SHOT) { await p.waitForTimeout(300); await p.screenshot({ path: SHOT + '-fait.png' }); }
  ok(!errs.length, 'aucune erreur JS', errs);
  console.log(echecs ? echecs + ' ÉCHEC(S)' : 'TOUT VERT'); await b.close(); process.exit(echecs ? 1 : 0);
})();
