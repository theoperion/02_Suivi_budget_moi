// Lot G (tâche 1, G1) : actualiser depuis le fichier malgré des envois bloqués, sans perdre ni doubler les modifications locales en attente.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2];
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const copie = x => JSON.parse(JSON.stringify(x));
function donnees(srv) {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: copie(srv.ech), journal: copie(srv.journal), libres: 5, controle: { mois: '', solde: null, especes: null },
    avenir: copie(srv.avenir), defis: {}, prefs: Object.assign({}, srv.prefs), url: 'x', apiVersion: '5.11', anomalies: '✅', lu: new Date().toISOString() };
}
let echecs = 0; const ok = (c, m, v) => { if (!c) echecs++; console.log((c ? 'OK   ' : 'ÉCHEC') + ' · ' + m + (v !== undefined ? ' · ' + JSON.stringify(v) : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (nom, fn, init) => {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const srv = { journal: [{ row: 5, mois: 'Novembre 2026', lib: 'Café', cat: 'Courses', montant: 3, date: '2026-11-02' }, { row: 6, mois: 'Novembre 2026', lib: 'Thé', cat: 'Courses', montant: 4, date: '2026-11-03' }],
      ech: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }], avenir: [],
      calls: [], ops: [], prefs: {}, bloque: true, delai: 50 };
    if (init) init(srv);
    p.on('pageerror', e => errs.push(nom + ' · ' + e.message));
    await p.route('**/*', async r => {
      const u = r.request().url();
      if (u.startsWith('https://script.google.com')) {
        const q = JSON.parse(r.request().postData()); srv.calls.push(q.action);
        if (srv.delai) await new Promise(f => setTimeout(f, srv.delai));
        const renum = () => srv.journal.forEach((l, i) => { l.row = 5 + i; });
        const pareil = (l, a) => l && a && l.mois === a.mois && l.lib === a.lib && l.cat === a.cat && Math.abs(l.montant - a.montant) < 0.005;
        const un = q => {
          srv.ops.push(q.action);
          if (srv.bloque) return { ok: false, error: 'SERVEUR', message: 'Panne simulée' }; // SERVEUR en boucle : l'envoi reste en file
          if (q.action === 'add') { const row = 5 + srv.journal.length; srv.journal.push(Object.assign({ row }, q.ligne)); return { ok: true, row }; }
          if (q.action === 'update') { const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu)) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' }; Object.assign(l, { mois: q.ligne.mois, lib: q.ligne.lib, cat: q.ligne.cat, montant: q.ligne.montant }); return { ok: true, row: q.row }; }
          if (q.action === 'delete') { const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu)) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' }; srv.journal.splice(q.row - 5, 1); renum(); return { ok: true, row: q.row, decale: true }; }
          if (q.action === 'pref-set') { srv.prefs[q.cle] = q.valeur; return { ok: true }; }
          if (q.action === 'ech-save' && q.row) { Object.assign(srv.ech.find(e => e.ligne === q.row), q.e); return { ok: true, row: q.row }; }
          if (q.action === 'ech-save') { const ligne = 5 + srv.ech.length; srv.ech.push(Object.assign({ ligne }, q.e)); return { ok: true, row: ligne }; }
          if (q.action === 'av-save') { const row = 5 + srv.avenir.length; srv.avenir.push(Object.assign({ row, fait: false }, q.a)); return { ok: true, row }; }
          return { ok: true };
        };
        let res;
        if (q.action === 'data') res = { ok: true, data: donnees(srv) };
        else if (q.action === 'lot') res = { ok: true, res: q.ops.map(un) };
        else res = un(q);
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
      }
      if (u.startsWith('http://app.test/')) return r.fulfill({ path: path.join(DIR, 'index.html') });
      return r.fulfill({ status: 200, body: '' });
    });
    await p.addInitScript(api => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem('jauge.key', JSON.stringify('k')); localStorage.setItem('jauge.api', JSON.stringify(api)); localStorage.setItem('jauge.apiDefautVu', JSON.stringify(api)); localStorage.setItem('jauge.tutoVu', 'true'); } }, API);
    await p.goto('http://app.test/index.html'); await p.waitForTimeout(2000);
    console.log('--- ' + nom);
    await fn(p, srv); await ctx.close();
  };
  // Actualise dès qu'aucun envoi n'est en route ; renvoie le nombre de lectures faites (0 = jamais appliquée).
  const actualiser = p => p.evaluate(async () => { for (let k = 0; k < 40; k++) { while (S.busy) await new Promise(f => setTimeout(f, 20)); const avant = S.journal; S.lastFetch = 0; await rafraichir(true); if (S.journal !== avant) return k + 1; await new Promise(f => setTimeout(f, 100)); } return 0; });
  const lignes = p => p.evaluate(() => S.journal.filter(e => !e.deleted && e.y === 2026 && e.m === 11).map(e => e.lib + ':' + e.montant + (e.pending ? '*' : '')).sort());
  const journalAffiche = p => p.evaluate(() => { S.tab = 'journal'; S.y = 2026; S.m = 11; rendre(); return document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText; });
  const nb = (txt, mot) => (txt.match(new RegExp(mot, 'g')) || []).length;
  const debloquer = async (p, srv, ms) => { srv.bloque = false; await p.evaluate(() => { S.queue.forEach(o => o.prochain = 0); pomper(); }); await p.waitForTimeout(ms || 3500); };

  await run('G1 ajout local bloqué + ligne ajoutée ailleurs', async (p, srv) => {
    await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 2.5, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); });
    await p.waitForTimeout(800);
    srv.journal.push({ row: 7, mois: 'Novembre 2026', lib: 'Ailleurs', cat: 'Courses', montant: 11, date: '2026-11-04' });
    const n = await actualiser(p);
    ok(n > 0, "actualisation faite malgré l'envoi bloqué", n);
    const L = await lignes(p);
    ok(L.includes('Ailleurs:11'), "la ligne d'ailleurs est visible", L);
    ok(L.filter(x => x.startsWith('Pain')).length === 1 && L.includes('Pain:2.5*'), "l'ajout local reste, une seule fois, en attente", L);
    ok(await p.evaluate(() => { const A = S.queue.filter(o => o.op === 'add'); return A.length === 1 && trouver(A[0].id) && trouver(A[0].id).lib === 'Pain'; }), "l'envoi en attente pointe toujours sur l'ajout");
    await actualiser(p);
    const t = await journalAffiche(p);
    ok(nb(t, 'Pain') === 1 && nb(t, 'Ailleurs') === 1, 'Journal affiché : Pain ×1, Ailleurs ×1 après une 2e actualisation', { Pain: nb(t, 'Pain'), Ailleurs: nb(t, 'Ailleurs') });
    await debloquer(p, srv);
    ok(srv.journal.filter(l => l.lib === 'Pain').length === 1, 'débloqué : écrit une seule fois dans le fichier', srv.journal.map(l => l.row + ':' + l.lib));
    const L2 = await lignes(p);
    ok(JSON.stringify(L2) === JSON.stringify(['Ailleurs:11', 'Café:3', 'Pain:2.5', 'Thé:4']), 'appli = fichier après envoi', L2);
  });

  await run('G2 modification locale bloquée', async (p, srv) => {
    await p.evaluate(() => { const e = S.journal.find(z => z.lib === 'Café'); e.montant = 9; e.pending = true; enfiler({ op: 'update', id: e.id }); });
    await p.waitForTimeout(800);
    srv.journal.push({ row: 7, mois: 'Novembre 2026', lib: 'Ailleurs', cat: 'Courses', montant: 11, date: '2026-11-04' });
    ok(await actualiser(p) > 0, 'actualisation faite');
    const L = await lignes(p);
    ok(L.includes('Café:9*') && !L.includes('Café:3') && L.includes('Ailleurs:11'), "valeur locale affichée (9, en attente), ligne d'ailleurs visible", L);
    await debloquer(p, srv);
    ok(srv.journal[0].montant === 9, 'débloqué : modification écrite sur la bonne ligne', srv.journal.map(l => l.row + ':' + l.lib + ':' + l.montant));
    ok(JSON.stringify(await lignes(p)) === JSON.stringify(['Ailleurs:11', 'Café:9', 'Thé:4']), 'appli = fichier après envoi', await lignes(p));
  });

  await run('G3 suppression locale bloquée', async (p, srv) => {
    await p.evaluate(() => supprimer(S.journal.find(z => z.lib === 'Thé')));
    await p.waitForTimeout(800);
    srv.journal.push({ row: 7, mois: 'Novembre 2026', lib: 'Ailleurs', cat: 'Courses', montant: 11, date: '2026-11-04' });
    ok(await actualiser(p) > 0, 'actualisation faite');
    const L = await lignes(p);
    ok(!L.some(x => x.startsWith('Thé')) && L.includes('Ailleurs:11') && L.includes('Café:3'), "la ligne supprimée reste masquée, celle d'ailleurs visible", L);
    const t = await journalAffiche(p);
    ok(nb(t, 'Thé') === 0 && nb(t, 'Ailleurs') === 1, 'Journal affiché sans Thé', { The: nb(t, 'Thé'), Ailleurs: nb(t, 'Ailleurs') });
    await debloquer(p, srv);
    ok(!srv.journal.some(l => l.lib === 'Thé') && srv.journal.some(l => l.lib === 'Ailleurs'), 'débloqué : seule la bonne ligne est supprimée', srv.journal.map(l => l.row + ':' + l.lib));
    ok(JSON.stringify(await lignes(p)) === JSON.stringify(['Ailleurs:11', 'Café:3']), 'appli = fichier après envoi', await lignes(p));
  });

  await run('G4 ligne modifiée ailleurs pendant une modification locale bloquée', async (p, srv) => {
    await p.evaluate(() => { const e = S.journal.find(z => z.lib === 'Café'); e.montant = 9; e.pending = true; enfiler({ op: 'update', id: e.id }); });
    await p.waitForTimeout(800);
    srv.journal[0].montant = 4; // la même ligne change ailleurs
    ok(await actualiser(p) > 0, 'actualisation faite');
    ok(JSON.stringify(await lignes(p)) === JSON.stringify(['Café:9*', 'Thé:4']), 'version locale gardée, pas de doublon', await lignes(p));
    await debloquer(p, srv, 4000);
    ok(srv.journal[0].montant === 4, 'le serveur tranche (CHANGE) : le fichier garde sa version', srv.journal[0].montant);
    ok(JSON.stringify(await lignes(p)) === JSON.stringify(['Café:4', 'Thé:4']), "puis l'appli se réaligne sur le fichier", await lignes(p));
  });

  await run('G5 échéancier, achat à venir, préférence, défi et budget en attente', async (p, srv) => {
    await p.evaluate(() => {
      const x = { id: uid(), ligne: null, srv: null, pending: true, lib: 'Box', cat: 'Loyer', montant: 30, freq: 'Mensuel', jour: 10, f: 1, g: 12, h: null, i: null, pause: false }; S.data.echeancier.push(x); enfiler({ op: 'ech-save', id: x.id });
      const l = S.data.echeancier.find(z => z.lib === 'Loyer'); l.montant = 550; l.pending = true; enfiler({ op: 'ech-save', id: l.id });
      const a = { id: uid(), row: null, mois: 'Décembre 2026', lib: 'Vélo', cat: 'Courses', montant: 200, jour: null, y: 2026, m: 12, fait: false, srv: null, pending: true }; S.data.avenir.push(a); enfiler({ op: 'av-save', id: a.id });
      setPref('essaiG', 'local'); S.data.defis['2026-11'] = { cat: 'Courses', montant: 250 }; appel('defi', { mois: '2026-11', cat: 'Courses', montant: 250 });
      const c = S.data.categories.find(z => z.nom === 'Courses'); c.budget = 280; appel('budget', { nom: 'Courses', budget: 280, suivi: 'Mensuel' });
    });
    await p.waitForTimeout(800);
    srv.ech.push({ ligne: 6, lib: 'Ailleurs-éch', cat: 'Loyer', montant: 12, freq: 'Mensuel', jour: 3, f: 1, g: 12, h: null, i: null, pause: false });
    srv.avenir.push({ row: 5, mois: 'Décembre 2026', lib: 'Ailleurs-av', cat: 'Courses', montant: 40, jour: null, fait: false });
    srv.prefs.autre = 'fichier';
    ok(await actualiser(p) > 0, 'actualisation faite');
    const R = await p.evaluate(() => ({ ech: S.data.echeancier.map(e => e.lib + ':' + e.montant).sort(), av: S.data.avenir.map(a => a.lib).sort(), prefs: S.data.prefs, defi: S.data.defis['2026-11'], budget: S.data.categories.find(z => z.nom === 'Courses').budget, file: S.queue.filter(o => !(o.op === 'call' && o.action === 'pref-set' && o.payload.cle === 'jeu')).length, ids: S.data.echeancier.map(e => e.id).concat(S.data.avenir.map(a => a.id)) }));
    ok(JSON.stringify(R.ech) === JSON.stringify(['Ailleurs-éch:12', 'Box:30', 'Loyer:550']), "échéancier : ligne d'ailleurs + ajout et modification locaux", R.ech);
    ok(JSON.stringify(R.av) === JSON.stringify(['Ailleurs-av', 'Vélo']), "à venir : ligne d'ailleurs + ajout local", R.av);
    ok(R.prefs.essaiG === 'local' && R.prefs.autre === 'fichier', 'préférences : locale en attente + celle du fichier', R.prefs);
    ok(R.defi && R.defi.montant === 250 && R.budget === 280, 'défi et budget en attente gardés', { defi: R.defi, budget: R.budget });
    ok(R.file === 6 && new Set(R.ids).size === R.ids.length, 'les 6 envois restent en file, identifiants uniques', R.file);
    await debloquer(p, srv);
    const F = await p.evaluate(() => ({ ech: S.data.echeancier.map(e => e.lib + ':' + e.montant).sort(), av: S.data.avenir.map(a => a.lib).sort(), file: S.queue.length }));
    ok(F.file === 0 && JSON.stringify(F.ech) === JSON.stringify(['Ailleurs-éch:12', 'Box:30', 'Loyer:550']), 'débloqué : file vide, échéancier = fichier', F);
  });

  await run("G6 catégorie en attente : pas d'actualisation (comportement d'avant)", async (p, srv) => {
    await p.evaluate(() => appel('cat-add', { nom: 'Nouvelle', groupe: 'Loisirs', budget: 0, suivi: 'Mensuel' }));
    await p.waitForTimeout(800);
    srv.journal.push({ row: 7, mois: 'Novembre 2026', lib: 'Ailleurs', cat: 'Courses', montant: 11, date: '2026-11-04' });
    await p.evaluate(async () => { S.lastFetch = 0; await rafraichir(true); });
    ok(!(await lignes(p)).includes('Ailleurs:11'), "pas d'actualisation tant que la catégorie attend", await lignes(p));
  });

  await run("G7 une écriture aboutit pendant la lecture : lecture ignorée", async (p, srv) => {
    srv.bloque = false; srv.delai = 600;
    const r = await p.evaluate(async () => { S.lastFetch = 0; const lect = rafraichir(true); await new Promise(f => setTimeout(f, 50));
      const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Pendant', cat: 'Courses', montant: 1, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id });
      await lect; return S.journal.filter(z => z.lib === 'Pendant').length; });
    ok(r === 1, "la lecture commencée avant l'écriture n'a ni perdu ni doublé l'ajout", r);
    await p.waitForTimeout(4000);
    ok(JSON.stringify(await lignes(p)) === JSON.stringify(['Café:3', 'Pendant:1', 'Thé:4']), 'puis appli = fichier', await lignes(p));
  });

  await run('G8 coupure réseau pendant un ajout : envoi incertain, pas d\'actualisation', async (p, srv) => {
    srv.bloque = false;
    await p.route('https://script.google.com/**', r => r.abort());
    await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Coupé', cat: 'Courses', montant: 1, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); });
    await p.waitForTimeout(500);
    await p.unroute('https://script.google.com/**');
    srv.journal.push({ row: 7, mois: 'Novembre 2026', lib: 'Coupé', cat: 'Courses', montant: 1, date: '2026-11-05' }); // le fichier l'avait peut-être déjà écrit
    const R = await p.evaluate(async () => { const inc = S.queue.some(o => o.incertain); S.lastFetch = 0; await rafraichir(true); return { inc, coupe: S.journal.filter(z => z.lib === 'Coupé' && !z.deleted).length }; });
    ok(R.inc && R.coupe === 1, 'envoi marqué incertain, aucune actualisation donc pas de doublon', R);
  });

  console.log('ERREURS JS:', errs.length ? errs : 'aucune'); console.log(echecs ? echecs + ' ÉCHEC(S)' : 'TOUT VERT');
  await b.close();
})();
