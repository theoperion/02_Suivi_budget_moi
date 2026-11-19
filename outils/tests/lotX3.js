// Lot X3 · envois rejoués après une coupure (le fichier a écrit, la réponse s'est perdue).
// Faux serveur qui applique l'envoi PUIS coupe la réponse. Deux versions du script simulées :
//  - « 5.14 » : identifiant d'envoi (uid) retenu pour add / delete / ech-save / av-save, modification déjà faite = ok ;
//  - « 5.13 » : sans uid (l'appli doit se protéger seule en relisant le fichier).
// Vérifie P1 (pas de 2e suppression), P2 (modif sous une suppression incertaine pas perdue), P3 (pas de doublon
// Échéancier / À venir), P5 (figerJeu n'écrit pas avant la 1re actualisation), P6 (réglage trop gros), stockage plein.
// Usage : node outils/tests/lotX3.js <dossier de l'appli>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2] || path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const PRE = (html.match(/localStorage\.setItem\('([a-z-]+\.)' \+ k/) || [])[1] || 'jauge.';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function donnees(srv) {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 12, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: srv.ech.map(l => Object.assign({}, l)), journal: srv.journal.map(l => Object.assign({}, l)), libres: 5,
    controle: { mois: '', solde: null, especes: null }, avenir: srv.av.map(l => Object.assign({}, l)), defis: {}, prefs: JSON.parse(JSON.stringify(srv.prefs)),
    url: 'x', apiVersion: srv.v, anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (nom, init, fn) => {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    const srv = { v: '5.14', journal: [], av: [], prefs: {}, uids: {}, ech: [{ ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false }], ops: [], perdre: 0, local: null };
    init(srv);
    p.on('pageerror', e => errs.push(nom + ' · ' + e.message));
    await p.route('**/*', async r => {
      const u = r.request().url();
      if (u.startsWith('https://script.google.com')) {
        const q = JSON.parse(r.request().postData());
        const neuf = srv.v === '5.14';
        const renum = () => srv.journal.forEach((l, i) => { l.row = 5 + i; });
        const pareil = (l, a) => l && a && l.mois === a.mois && l.lib === a.lib && l.cat === a.cat && Math.abs(l.montant - a.montant) < 0.005;
        const un = q => {
          srv.ops.push(q.action + (q.row ? ':' + q.row : '') + (q.ligne ? ':' + q.ligne.lib : '') + (q.e ? ':' + q.e.lib : '') + (q.a ? ':' + q.a.lib : ''));
          const vu = k => neuf && q.uid && srv.uids[k + q.uid], retiens = (k, v) => { if (neuf && q.uid) srv.uids[k + q.uid] = v; };
          if (q.action === 'add') {
            if (srv.addNull) return { ok: true, row: null, deja: true }; // déjà fait, mais sa ligne a disparu du fichier depuis
            if (neuf && q.ligne.uid && srv.uids['add' + q.ligne.uid]) return { ok: true, row: srv.uids['add' + q.ligne.uid], deja: true };
            const row = 5 + srv.journal.length; srv.journal.push(Object.assign({ row }, q.ligne)); if (neuf && q.ligne.uid) srv.uids['add' + q.ligne.uid] = row; return { ok: true, row };
          }
          if (q.action === 'update') { const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu) && !(neuf && pareil(l, q.ligne))) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' }; Object.assign(l, { lib: q.ligne.lib, montant: q.ligne.montant }); return { ok: true, row: q.row }; }
          if (q.action === 'delete') {
            const d = vu('del'); if (d) return { ok: true, row: d, decale: true, deja: true };
            const l = srv.journal[q.row - 5]; if (!pareil(l, q.attendu)) return { ok: false, error: 'CHANGE', message: 'La ligne a changé dans le fichier.' };
            srv.journal.splice(q.row - 5, 1); renum(); retiens('del', q.row); return { ok: true, row: q.row, decale: true };
          }
          if (q.action === 'ech-save') {
            if (!q.row) { const d = vu('ech'); if (d) return { ok: true, row: d, deja: true }; const ligne = 5 + srv.ech.length; srv.ech.push(Object.assign({ ligne }, q.e)); retiens('ech', ligne); return { ok: true, row: ligne }; }
            return { ok: true, row: q.row };
          }
          if (q.action === 'av-save') {
            if (!q.row) { const d = vu('av'); if (d) return { ok: true, row: d, deja: true }; const row = 4 + srv.av.length; srv.av.push(Object.assign({ row, fait: false }, q.a)); retiens('av', row); return { ok: true, row }; }
            return { ok: true, row: q.row };
          }
          if (q.action === 'pref-set') { srv.prefs[q.cle] = q.valeur; return { ok: true }; }
          return { ok: true };
        };
        let res;
        if (q.action === 'data') { srv.ops.push('data'); res = { ok: true, data: donnees(srv) }; }
        else if (q.action === 'lot') res = { ok: true, res: q.ops.map(un) };
        else res = un(q);
        if (q.action !== 'data' && srv.perdre > 0) { srv.perdre--; return r.abort('internetdisconnected'); }
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
      }
      if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
      return r.fulfill({ status: 200, body: '' });
    });
    await p.addInitScript(([api, pre, local]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem(pre + 'key', '"k"'); localStorage.setItem(pre + 'api', JSON.stringify(api)); localStorage.setItem(pre + 'apiDefautVu', JSON.stringify(api)); localStorage.setItem(pre + 'tutoVu', 'true');
      if (local) Object.keys(local).forEach(k => localStorage.setItem(pre + k, JSON.stringify(local[k]))); } }, [API, PRE, srv.local]);
    await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
    const out = await fn(p, srv); await ctx.close(); return out;
  };
  const srvTxt = srv => srv.journal.map(l => l.row + ':' + l.lib + ':' + l.montant).join(' | ');
  const L = (row, lib, montant) => ({ row, mois: 'Novembre 2026', lib, cat: 'Courses', montant, date: '2026-11-02' });
  const toasts = p => p.evaluate(() => document.querySelector('#toastT') ? document.querySelector('#toastT').textContent : '');
  const etat = p => p.evaluate(() => ({ file: S.queue.length, client: S.journal.filter(e => !e.deleted).map(e => e.row + ':' + e.lib + ':' + e.montant).join(' | ') }));
  const R = {}, OK = {};
  for (const v of ['5.14', '5.13']) {
    // P1 : deux « Pain 1,20 » ; on en supprime UNE ; la réponse se perd après l'écriture.
    R['P1_' + v] = await run('P1 ' + v, srv => { srv.v = v; srv.journal = [L(5, 'Café', 3), L(6, 'Pain', 1.2), L(7, 'Pain', 1.2), L(8, 'Riz', 6)]; }, async (p, srv) => {
      await p.waitForTimeout(1500); srv.perdre = 1;
      await p.evaluate(() => supprimer(S.journal.find(z => z.row === 6)));
      await p.waitForTimeout(9000);
      return Object.assign({ serveur: srvTxt(srv), ops: srv.ops.filter(o => o !== 'data' && o !== 'pref-set') }, await etat(p));
    });
    OK['P1_' + v] = R['P1_' + v].serveur === '5:Café:3 | 6:Pain:1.2 | 7:Riz:6' && R['P1_' + v].file === 0 && R['P1_' + v].client === '5:Café:3 | 6:Pain:1.2 | 7:Riz:6';
    // P2 : suppression (réponse perdue) puis modification d'une ligne du dessous.
    R['P2_' + v] = await run('P2 ' + v, srv => { srv.v = v; srv.journal = [L(5, 'Café', 3), L(6, 'Thé', 4), L(7, 'Riz', 6)]; }, async (p, srv) => {
      await p.waitForTimeout(1500); srv.perdre = 1;
      await p.evaluate(() => supprimer(S.journal.find(z => z.row === 6)));
      await p.waitForTimeout(300);
      await p.evaluate(() => { const d = S.journal.find(z => z.lib === 'Riz'); d.montant = 9; d.pending = true; enfiler({ op: 'update', id: d.id }); });
      await p.waitForTimeout(9000);
      return Object.assign({ serveur: srvTxt(srv), ops: srv.ops.filter(o => o !== 'data' && o !== 'pref-set'), toast: await toasts(p) }, await etat(p));
    });
    OK['P2_' + v] = R['P2_' + v].serveur === '5:Café:3 | 6:Riz:9' && R['P2_' + v].file === 0 && R['P2_' + v].client === '5:Café:3 | 6:Riz:9' && !/Pas enregistr/.test(R['P2_' + v].toast);
    // P2 bis : modification PUIS suppression au-dessus, parties dans le même lot ; tout le lot perd sa réponse.
    R['P2bis_' + v] = await run('P2bis ' + v, srv => { srv.v = v; srv.journal = [L(5, 'Café', 3), L(6, 'Thé', 4), L(7, 'Riz', 6)]; }, async (p, srv) => {
      await p.waitForTimeout(1500); srv.perdre = 1;
      await p.evaluate(() => { S.busy = true; const d = S.journal.find(z => z.lib === 'Riz'); d.montant = 9; d.pending = true; enfiler({ op: 'update', id: d.id }); supprimer(S.journal.find(z => z.row === 6)); S.busy = false; pomper(); });
      await p.waitForTimeout(12000);
      return Object.assign({ serveur: srvTxt(srv), ops: srv.ops.filter(o => o !== 'data' && o !== 'pref-set'), toast: await toasts(p) }, await etat(p));
    });
    OK['P2bis_' + v] = R['P2bis_' + v].serveur === '5:Café:3 | 6:Riz:9' && R['P2bis_' + v].file === 0 && R['P2bis_' + v].client === '5:Café:3 | 6:Riz:9' && !/Pas enregistr/.test(R['P2bis_' + v].toast);
    // F3 : suppression de Thé faite mais réponse perdue, puis ajout « Pain 1,20 » corrigé à 2,50, tout en attente.
    // L'ajout attend que la suppression soit tranchée : sinon la réponse « déjà faite » redescendait aussi Pain (correction perdue).
    R['F3_' + v] = await run('F3 ' + v, srv => { srv.v = v; srv.journal = [L(5, 'Café', 5), L(6, 'Thé', 6), L(7, 'Riz', 7)]; }, async (p, srv) => {
      await p.waitForTimeout(1500); srv.perdre = 1;
      await p.evaluate(() => supprimer(S.journal.find(z => z.row === 6)));
      await p.waitForTimeout(300);
      await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-19', mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 1.2, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); e.montant = 2.5; enfiler({ op: 'update', id: e.id }); });
      await p.waitForTimeout(12000);
      return Object.assign({ serveur: srvTxt(srv), ops: srv.ops.filter(o => o !== 'pref-set'), toast: await toasts(p), rejets: await p.evaluate(() => JSON.stringify(LS.get('rejets', []))) }, await etat(p));
    });
    OK['F3_' + v] = R['F3_' + v].serveur === '5:Café:5 | 6:Riz:7 | 7:Pain:2.5' && R['F3_' + v].file === 0 && R['F3_' + v].client === '5:Café:5 | 6:Riz:7 | 7:Pain:2.5' && !/Pas enregistr|a changé/.test(R['F3_' + v].toast) && R['F3_' + v].rejets === '[]';
  }
  // B : suppression mise en file par la 9.32 (sans identifiant), déjà faite par le fichier, réponse perdue ; le script est passé en 5.14.
  // Il ne connaît pas cet envoi : l'appli doit relire le fichier avant de la renvoyer (sinon la 2e « Pain » identique serait effacée).
  R.B = await run('B', srv => {
    const avant = [L(5, 'Café', 3), L(6, 'Pain', 1.2), L(7, 'Pain', 1.2), L(8, 'Riz', 6)];
    srv.journal = [L(5, 'Café', 3), L(6, 'Pain', 1.2), L(7, 'Riz', 6)];
    const J = avant.map(r => Object.assign({ id: 'r' + r.row, row: r.row, date: r.date, especes: false, enLigne: false, y: 2026, m: 11, srv: { mois: r.mois, lib: r.lib, cat: r.cat, montant: r.montant } }, { mois: r.mois, lib: r.lib, cat: r.cat, montant: r.montant }));
    J[1].deleted = true; J[1].pending = true;
    srv.local = { cache: { data: Object.assign(donnees(Object.assign({}, srv, { journal: avant })), {}), journal: J }, queue: [{ op: 'delete', id: 'r6', incertain: true, essais: 1, err: 'Failed to fetch' }] };
  }, async (p, srv) => {
    await p.waitForTimeout(6000);
    return Object.assign({ serveur: srvTxt(srv), ops: srv.ops.filter(o => o !== 'pref-set') }, await etat(p));
  });
  OK.B = R.B.serveur === '5:Café:3 | 6:Pain:1.2 | 7:Riz:6' && R.B.file === 0 && R.B.ops[0] === 'data' && !R.B.ops.some(o => /^delete/.test(o));
  // D : ajout « déjà fait » dont la ligne est introuvable (row: null) → l'appli relit le fichier tout de suite.
  R.D = await run('D', srv => { srv.journal = [L(5, 'Café', 3)]; }, async (p, srv) => {
    await p.waitForTimeout(1500); srv.addNull = true; const n0 = srv.ops.length;
    await p.evaluate(() => { const e = { id: uid(), row: null, date: '2026-11-19', mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 1.2, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); });
    await p.waitForTimeout(900);
    return Object.assign({ ops: srv.ops.slice(n0).filter(o => o !== 'pref-set') }, await etat(p));
  });
  OK.D = R.D.ops[0] === 'add:Pain' && R.D.ops[1] === 'data' && R.D.file === 0 && R.D.client === '5:Café:3';
  // P3 : nouvelle charge dans l'Échéancier et nouvel achat prévu, réponse perdue → renvoyés (script 5.14).
  R.P3 = await run('P3', srv => { srv.journal = [L(5, 'Café', 3)]; }, async (p, srv) => {
    await p.waitForTimeout(1500); srv.perdre = 1;
    await p.evaluate(() => { const x = { id: 'n' + uid(), ligne: null, lib: 'Netflix', cat: 'Loyer', montant: 13, freq: 'Mensuel', jour: 10, f: 1, g: 12, h: null, i: null, pause: false, srv: null, pending: true }; S.data.echeancier.push(x); enfiler({ op: 'ech-save', id: x.id }); });
    await p.waitForTimeout(7000); srv.perdre = 1;
    await p.evaluate(() => { const a = { id: uid(), row: null, mois: 'Décembre 2026', lib: 'Vélo', cat: 'Courses', montant: 200, jour: 3, y: 2026, m: 12, fait: false, srv: null, pending: true }; S.data.avenir = S.data.avenir || []; S.data.avenir.push(a); enfiler({ op: 'av-save', id: a.id }); });
    await p.waitForTimeout(8000);
    return { ech: srv.ech.map(e => e.ligne + ':' + e.lib).join(' | '), av: srv.av.map(a => a.row + ':' + a.lib).join(' | '), ops: srv.ops.filter(o => o !== 'data' && o !== 'pref-set'), file: await p.evaluate(() => S.queue.length) };
  });
  OK.P3 = R.P3.ech === '5:Loyer | 6:Netflix' && R.P3.av === '4:Vélo' && R.P3.file === 0;
  // P5 : la préférence « jeu » du fichier (autre appareil) ne doit pas être écrasée par celle gardée sur le téléphone.
  R.P5 = await run('P5', srv => { srv.journal = [L(5, 'Café', 3)]; srv.prefs = { jeu: { jd: [['2026-10-01', '2026-10-03']], tirages: '' } };
    srv.local = { cache: { data: Object.assign(donnees(srv), { prefs: { jeu: { tirages: '' } } }), journal: [] } }; }, async (p, srv) => {
    await p.waitForTimeout(3000);
    return { ops: srv.ops, jd: JSON.stringify((srv.prefs.jeu || {}).jd) };
  });
  OK.P5 = R.P5.ops[0] === 'data' && R.P5.jd === JSON.stringify([['2026-10-01', '2026-10-03']]);
  // P6 : un réglage trop gros n'est pas envoyé en silence ; « jeu » est compacté.
  R.P6 = await run('P6', srv => { srv.journal = [L(5, 'Café', 3)]; }, async (p, srv) => {
    await p.waitForTimeout(2500); const n0 = srv.ops.length;
    const t = await p.evaluate(() => { setPref('envies', { l: Array.from({ length: 400 }, (_, i) => ({ i: 'x' + i, l: 'Envie numéro ' + i, p: 10 })) }); return document.querySelector('#toastT').textContent; });
    const jd = []; for (let i = 0; i < 400; i++) { const d = new Date(Date.UTC(2020, 0, 1 + i * 3)), e = new Date(Date.UTC(2020, 0, 2 + i * 3)); jd.push([d.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]); }
    await p.evaluate(jd => majPrefJeu({ jd }), jd);
    await p.waitForTimeout(2500);
    return { toast: t, enviesEnvoyees: 'envies' in srv.prefs, jeuServeur: srv.prefs.jeu ? JSON.stringify(srv.prefs.jeu).length : 0, jdServeur: srv.prefs.jeu && srv.prefs.jeu.jd.length };
  });
  OK.P6 = /trop gros pour ton fichier Google/.test(R.P6.toast) && !/seulement sur ce téléphone/.test(R.P6.toast) && !R.P6.enviesEnvoyees && R.P6.jeuServeur > 0 && R.P6.jeuServeur < 7900 && R.P6.jdServeur <= 60;
  // Stockage plein : la file d'envois est enregistrée avant le cache, et on prévient.
  R.plein = await run('plein', srv => { srv.journal = [L(5, 'Café', 3)]; }, async (p, srv) => {
    await p.waitForTimeout(2000); srv.perdre = 99;
    const pre = PRE;
    await p.evaluate(pre => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === pre + 'cache') throw new Error('QuotaExceededError'); return o.call(this, k, v); };
      const e = { id: uid(), row: null, date: '2026-11-19', mois: 'Novembre 2026', lib: 'Pain', cat: 'Courses', montant: 1.2, y: 2026, m: 11, srv: null, pending: true, nw: true }; S.journal.push(e); enfiler({ op: 'add', id: e.id }); }, pre);
    await p.waitForTimeout(1000);
    return { toast: await toasts(p), fileGardee: await p.evaluate(pre => (JSON.parse(localStorage.getItem(pre + 'queue')) || []).length, pre) };
  });
  OK.plein = /Mémoire du téléphone pleine/.test(R.plein.toast) && R.plein.fileGardee === 1;
  console.log(JSON.stringify(R, null, 1));
  console.log('CONTRÔLES:', JSON.stringify(OK));
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  console.log('VERDICT:', Object.values(OK).every(Boolean) && !errs.length ? 'OK' : 'ÉCHEC');
  await b.close();
})();
