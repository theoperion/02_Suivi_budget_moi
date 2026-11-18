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
  const run = async (nom, mode, fn) => {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const srv = { journal: [{ row: 5, mois: 'Novembre 2026', lib: 'Café', cat: 'Courses', montant: 3, date: '2026-11-02' }], calls: [], mode };
    p.on('pageerror', e => errs.push(nom + ' · ' + e.message));
    await p.route('**/*', async r => {
      const u = r.request().url();
      if (u.startsWith('https://script.google.com')) {
        const q = JSON.parse(r.request().postData()); srv.calls.push(q.action);
        let res;
        if (q.action === 'data') res = { ok: true, data: donnees(srv.journal) };
        else if (q.action === 'add') {
          const n = srv.calls.filter(a => a === 'add').length;
          if (srv.mode === 'occupe' && n === 1) res = { ok: false, error: 'OCCUPE', message: 'Fichier occupé' };
          else if (srv.mode === 'invalide') res = { ok: false, error: 'INVALIDE', message: 'Mois inconnu : ' + q.ligne.mois };
          else { const row = 5 + srv.journal.length; srv.journal.push(Object.assign({ row }, q.ligne)); res = { ok: true, row }; }
        } else res = { ok: true };
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
  const ajouter = p => p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-05', mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 2.5, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); });
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
  console.log(JSON.stringify(R, null, 1)); console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
