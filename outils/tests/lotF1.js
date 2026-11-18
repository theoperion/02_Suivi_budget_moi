const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2];
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function donnees(journal) {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }],
    journal, libres: 5, controle: { mois: '', solde: null, especes: null }, avenir: [], defis: {}, prefs: {}, url: 'x', apiVersion: '5.8', anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (nom, mode, fn, init) => {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const srv = { journal: [{ row: 5, mois: 'Novembre 2026', lib: 'Café', cat: 'Courses', montant: 3, date: '2026-11-02' }], calls: [], ops: [], lots: [], prefs: {}, mode, delai: 0 };
    if (init) init(srv);
    p.on('pageerror', e => errs.push(nom + ' · ' + e.message));
    await p.route('**/*', async r => {
      const u = r.request().url();
      if (u.startsWith('https://script.google.com')) {
        const q = JSON.parse(r.request().postData()); srv.calls.push(q.action);
        if (srv.delai) await new Promise(f => setTimeout(f, srv.delai));
        const renum = () => srv.journal.forEach((l, i) => { l.row = 5 + i; });
        const pareil = (l, a) => l && a && l.mois === a.mois && l.lib === a.lib && l.cat === a.cat && Math.abs(l.montant - a.montant) < 0.005;
        const un = (q) => {
          srv.ops.push(q.action + (q.ligne ? ':' + q.ligne.lib : '') + (q.row ? ':' + q.row : '') + (q.cle ? ':' + q.cle + '=' + JSON.stringify(q.valeur) : ''));
          if (q.action === 'add') {
            const n = srv.ops.filter(a => a.startsWith('add')).length;
            if (srv.mode === 'occupe' && n === 1) return { ok: false, error: 'OCCUPE', message: 'Fichier occupé' };
            if (srv.mode === 'invalide') return { ok: false, error: 'INVALIDE', message: 'Mois inconnu : ' + q.ligne.mois };
            if (q.ligne.lib === 'Bloqué') return { ok: false, error: srv.erreurBloque || 'SERVEUR', message: 'Panne simulée' };
            const row = 5 + srv.journal.length; srv.journal.push(Object.assign({ row }, q.ligne)); return { ok: true, row };
          }
          if (q.action === 'update') { const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu)) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' }; Object.assign(l, { mois: q.ligne.mois, lib: q.ligne.lib, cat: q.ligne.cat, montant: q.ligne.montant }); return { ok: true, row: q.row }; }
          if (q.action === 'delete') { const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu)) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' }; if (q.row > 5) { srv.journal.splice(q.row - 5, 1); renum(); } else Object.assign(l, { mois: '', lib: '', cat: '', montant: 0 }); return { ok: true, row: q.row, decale: q.row > 5 }; }
          if (q.action === 'pref-set') { srv.prefs[q.cle] = q.valeur; return { ok: true }; }
          return { ok: true };
        };
        let res;
        if (q.action === 'data') res = { ok: true, data: donnees(srv.journal) };
        else if (q.action === 'lot') {
          if (srv.mode === 'ancien') res = { ok: false, error: 'ACTION', message: 'Action inconnue : lot' };
          else { srv.lots.push(q.ops.map(o => o.action)); res = { ok: true, res: q.ops.map(un) }; }
        }
        else res = un(q);
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
      }
      if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
      return r.fulfill({ status: 200, body: '' });
    });
    const pre = html.includes("'jauge.' + k") ? 'jauge.' : (html.match(/localStorage.getItem\('([^']+)'/) || [])[1];
    await p.addInitScript(([pre, api]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem(pre + 'key', JSON.stringify('k')); localStorage.setItem(pre + 'api', JSON.stringify(api)); localStorage.setItem(pre + 'apiDefautVu', JSON.stringify(api)); localStorage.setItem(pre + 'tutoVu', 'true'); } }, [pre, API]);
    await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
    const out = await fn(p, srv); await ctx.close(); return out;
  };
  const ajouter = (p, lib = 'Pain', montant = 2.5) => p.evaluate(([lib, montant]) => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib, cat: 'Courses', montant, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); return e.id; }, [lib, montant]);
  const srvTxt = srv => srv.journal.map(l => l.row + ':' + l.lib + ':' + l.montant).join(' | ');
  const cliTxt = p => p.evaluate(() => S.journal.filter(e => !e.deleted).map(e => e.row + ':' + e.lib + ':' + e.montant).join(' | '));
  const R = {};
  R.base = await run('base', 'ok', async (p, srv) => { await ajouter(p); await p.waitForTimeout(3000); return { lignesServeur: srv.journal.length, file: await p.evaluate(() => S.queue.length) }; });
  R.occupe = await run('occupe', 'occupe', async (p, srv) => { await ajouter(p); await p.waitForTimeout(1500); const pendant = await p.evaluate(() => ({ file: S.queue.length, local: S.journal.some(e => e.lib === 'Pain') })); await p.waitForTimeout(10000); return { pendant, apres: { lignesServeur: srv.journal.length, file: await p.evaluate(() => S.queue.length), local: await p.evaluate(() => S.journal.filter(e => e.lib === 'Pain').length) } }; });
  R.invalide = await run('invalide', 'invalide', async (p, srv) => { await ajouter(p); await p.waitForTimeout(4000); return { rejets: await p.evaluate(() => LS.get('rejets', []).map(r => r.lib + '|' + r.msg)), file: await p.evaluate(() => S.queue.length), boutonEnvois: await p.evaluate(() => { ouvrirReglages(); return /Envois refusés/.test(document.querySelector('#sheetIn').innerText); }) }; });
  R.reconnexion = await run('reconnexion', 'ok', async (p, srv) => {
    await p.route('https://script.google.com/**', r => r.abort()); // hors ligne
    await ajouter(p); await p.waitForTimeout(500);
    await p.evaluate(() => verrouiller('Clé incorrecte.')); await p.unroute('https://script.google.com/**');
    await p.fill('#kin', 'k'); await p.click('#kgo'); await p.waitForTimeout(4000);
    return { lignesServeur: srv.journal.length, local: await p.evaluate(() => S.journal.filter(e => e.lib === 'Pain').length) };
  });
  R.formOuvert = await run('form', 'ok', async (p, srv) => {
    await p.evaluate(() => { ouvrirSaisie(S.journal[0]); }); srv.journal = []; // la ligne est supprimée ailleurs
    await p.evaluate(() => rafraichir(true)); await p.waitForTimeout(1500);
    const pendant = await p.evaluate(() => S.journal.length);
    await p.evaluate(() => fermer()); await p.waitForTimeout(1500);
    return { pendantFormulaire: pendant, apresFermeture: await p.evaluate(() => S.journal.length) };
  });
  R.a_bloque = await run('a_bloque', 'ok', async (p, srv) => {
    srv.delai = 200;
    await ajouter(p, 'Pain'); await ajouter(p, 'Bloqué'); await ajouter(p, 'Lait');
    await p.waitForTimeout(6000);
    const file = await p.evaluate(() => S.queue.map(o => descOp(o) + ' → ' + statutOp(o)));
    const feuille = await p.evaluate(() => { S.form = { mode: 'file', arm: false }; rendreForm(); ouvrirSheet(); return { texte: document.querySelector('#sheetIn').innerText.replace(/\s+/g, ' ').match(/1\. .*?ABANDONNER CET ENVOI/)[0], boutons: document.querySelectorAll('[data-act=file-drop]').length }; });
    // abandon de cet envoi précis (2 touches)
    await p.click('[data-act=file-drop][data-i="0"]'); await p.click('[data-act=file-drop][data-i="0"]'); await p.waitForTimeout(300);
    return { serveur: srvTxt(srv), lots: srv.lots.slice(0, 3), file, feuille, fileApresAbandon: await p.evaluate(() => S.queue.length), localBloque: await p.evaluate(() => S.journal.filter(e => e.lib === 'Bloqué').map(e => e.pending)) };
  });
  R.b_memeElement = await run('b_meme', 'ok', async (p, srv) => {
    srv.delai = 400;
    // 1) ajout + modification + suppression saisis vite
    await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Vite', cat: 'Courses', montant: 4, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id });
      e.montant = 5; e.pending = true; enfiler({ op: 'update', id: e.id }); supprimer(e); });
    // 2) ajout + 2 modifications saisis vite
    await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Reste', cat: 'Courses', montant: 1, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id });
      e.montant = 2; enfiler({ op: 'update', id: e.id }); e.lib = 'Reste final'; e.montant = 7; enfiler({ op: 'update', id: e.id }); });
    await p.waitForTimeout(5000);
    return { serveur: srvTxt(srv), client: await cliTxt(p), ops: srv.ops, lots: srv.lots, file: await p.evaluate(() => S.queue.length) };
  });
  const troisLignes = srv => { srv.journal.push({ row: 6, mois: 'Novembre 2026', lib: 'Thé', cat: 'Courses', montant: 4, date: '2026-11-02' }, { row: 7, mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 2, date: '2026-11-02' }, { row: 8, mois: 'Novembre 2026', lib: 'Riz', cat: 'Courses', montant: 6, date: '2026-11-02' }); };
  // c1 : suppression de la ligne 6 + modifications des lignes 7 et 8, parties dans le MÊME lot (un réglage occupe l'envoi avant)
  // c2 : la suppression part seule, les modifications suivent dans l'envoi d'après
  for (const [nom, avant] of [['c1_memeLot', true], ['c2_lotSuivant', false]]) R[nom] = await run(nom, 'ok', async (p, srv) => {
    srv.delai = 300;
    await p.evaluate(avant => { if (avant) setPref('x', 1); const [, b, c, d] = S.journal.slice().sort((x, y) => x.row - y.row);
      supprimer(b); c.montant = 9; c.pending = true; enfiler({ op: 'update', id: c.id }); d.montant = 8; d.pending = true; enfiler({ op: 'update', id: d.id }); }, avant);
    await p.waitForTimeout(4000);
    return { serveur: srvTxt(srv), client: await cliTxt(p), ops: srv.ops.filter(o => !o.startsWith('pref')), lots: srv.lots, file: await p.evaluate(() => S.queue.length), toasts: await p.evaluate(() => document.body.innerText.match(/Pas enregistr[^\n]*/g)) };
  }, troisLignes);
  // c3 : deux suppressions (lignes 6 et 7) + modification de la ligne 8, saisies ensemble
  R.c3_deuxSuppr = await run('c3', 'ok', async (p, srv) => {
    srv.delai = 300;
    await p.evaluate(() => { setPref('x', 1); const [, b, c, d] = S.journal.slice().sort((x, y) => x.row - y.row);
      supprimer(b); supprimer(c); d.montant = 8; d.pending = true; enfiler({ op: 'update', id: d.id }); });
    await p.waitForTimeout(4000);
    return { serveur: srvTxt(srv), client: await cliTxt(p), ops: srv.ops.filter(o => !o.startsWith('pref')), lots: srv.lots, file: await p.evaluate(() => S.queue.length), toasts: await p.evaluate(() => document.body.innerText.match(/Pas enregistr[^\n]*/g)) };
  }, troisLignes);
  R.d_ancien = await run('d_ancien', 'ancien', async (p, srv) => {
    srv.delai = 200;
    await ajouter(p, 'Pain'); await ajouter(p, 'Bloqué'); await ajouter(p, 'Lait');
    await p.waitForTimeout(6000);
    return { serveur: srvTxt(srv), appels: srv.calls.filter(a => a !== 'data'), file: await p.evaluate(() => S.queue.map(o => descOp(o) + ' → ' + statutOp(o))) };
  });
  R.e_prefs = await run('e_prefs', 'ok', async (p, srv) => {
    srv.delai = 400;
    await p.evaluate(() => { setPref('theme', 'a'); setPref('theme', 'b'); setPref('theme', 'c'); setPref('autre', 1); });
    await p.waitForTimeout(3000);
    return { prefs: srv.prefs, ops: srv.ops };
  });
  console.log(JSON.stringify(R, null, 1)); console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
