// Mode « données sur ce téléphone » dans l'appli (phase 2) :
// A passage (copie vérifiée) ; B saisie au doigt SANS réseau, enregistrée tout de suite ; C réouverture : la saisie est là,
// mode gardé ; D modification et suppression ; E Réglages › Où sont mes données ; F retour au fichier (le fichier, intact, revient) ;
// G passage refusé s'il reste des envois en attente.
// Usage : node outils/tests/lotTel2.js <dossier de l'appli> [dossier captures]
const path = require('path'); const DIR = path.resolve(process.argv[2] || '.'); const SHOTS = process.argv[3];
process.argv[2] = path.join(DIR, 'index.html'); const B = require('./base.js');
const { chromium } = require('playwright');
const OK = {}, R = {}; const ok = (k, v, info) => { OK[k] = !!v; R[k] = info; };

(async () => {
  const b = await chromium.launch();
  const journal = B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3'));
  const { p, errs } = await B.page(b, '2026-11-20T18:30:00', journal, {}, {}, []); await B.fauxGoogle(p);
  let reseau = true, appelsScript = 0;
  await p.route('https://script.google.com/**', r => { appelsScript++; return reseau ? r.fallback() : r.abort(); });
  const n0 = journal.length;
  // G : envoi en attente → passage refusé, rien ne change
  const g = await p.evaluate(async () => { S.queue.push({ action: 'add', u: 'x', ligne: {} }); S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await passerTelephone(); const r = { mode: S.mode, err: $('#ferr').textContent }; S.queue = []; sauver(); fermer(); return r; });
  ok('G_refusEnAttente', g.mode === 'fichier' && /en attente/.test(g.err), g);
  // A : passage
  const a = await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); const avant = document.querySelector('#sheetIn').innerText; await passerTelephone(); return { mode: S.mode, avant, n: S.journal.length, dep: LS.get('telDepuis', null) }; });
  ok('A_passage', a.mode === 'tel' && a.n === n0 && a.dep && a.dep.rev >= 1 && /PASSER SUR CE TÉLÉPHONE/.test(a.avant), { mode: a.mode, n: a.n, dep: a.dep });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'tel-toast.png') });
  // B : plus de réseau du tout, saisie au doigt
  reseau = false; const avantScript = appelsScript;
  await p.evaluate(() => { fermer(); ouvrirSaisie(null); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { S.form.montant = '12,50'; S.form.cat = 'Courses'; $('#lib').value = 'Boulangerie test'; S.form.lib = 'Boulangerie test'; });
  await p.evaluate(() => enregistrer()); await p.waitForTimeout(1500);
  const bb = await p.evaluate(() => ({ ligne: S.journal.find(e => /Boulangerie test/.test(e.lib || '')), q: S.queue.length, n: S.journal.length }));
  ok('B_saisieSansReseau', bb.ligne && bb.q === 0 && bb.n === n0 + 1 && appelsScript === avantScript, { b: bb, script: appelsScript - avantScript });
  // C : réouverture de l'appli (toujours sans réseau)
  await p.reload(); await p.waitForTimeout(2500);
  const c = await p.evaluate(async () => { await rafraichir(true); return { mode: S.mode, ligne: S.journal.find(e => /Boulangerie test/.test(e.lib || '')), n: S.journal.length, q: S.queue.length }; });
  ok('C_reouverture', c.mode === 'tel' && c.ligne && c.ligne.row && c.n === n0 + 1 && c.q === 0, c);
  // D : modification puis suppression
  const d = await p.evaluate(async () => {
    const e = S.journal.find(x => /Boulangerie test/.test(x.lib || '')); ouvrirSaisie(e); S.form.lib = 'Boulangerie modifiée'; S._saveT = 0; enregistrer();
    await new Promise(r => setTimeout(r, 1500)); await rafraichir(true);
    const m = S.journal.find(x => /Boulangerie modifiée/.test(x.lib || ''));
    const v = S.journal.find(x => x.lib === 'Bus'); const nAv = S.journal.length;
    ouvrirSaisie(v); document.querySelector('[data-act="del"]').click(); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-act="del"]').click();
    await new Promise(r => setTimeout(r, 1500)); await rafraichir(true);
    return { m: !!m, q: S.queue.length, rej: (LS.get('rejets', []) || []).length, nAv, nAp: S.journal.length };
  }).catch(e => ({ err: e.message }));
  ok('D_modifSuppr', d.m && d.q === 0 && d.rej === 0 && d.nAp === d.nAv - 1, d);
  // E : Réglages
  const e = await p.evaluate(async () => { ouvrirReglages(); const r = document.querySelector('#sheetIn').innerText; S.form = { mode: 'donnees' }; rendreForm(); await new Promise(x => setTimeout(x, 300)); return { r, d: document.querySelector('#sheetIn').innerText }; });
  ok('E_reglages', /Où sont mes données/.test(e.r) && /sur ce téléphone/.test(e.r) && !/Lien de mon script/.test(e.r) && /changement/.test(e.d), { r: e.r.slice(-300), d: e.d });
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'tel-donnees.png') });
  // F : retour au fichier (réseau revenu) : on retrouve le fichier tel quel
  reseau = true;
  const f = await p.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); document.querySelector('[data-act="donnees-fichier"]').click(); await new Promise(x => setTimeout(x, 100)); const arme = document.querySelector('#sheetIn').innerText; document.querySelector('[data-act="donnees-fichier"]').click(); await new Promise(x => setTimeout(x, 2500)); return { arme, mode: S.mode, n: S.journal.length, boul: S.journal.some(x => /Boulangerie/.test(x.lib || '')) }; });
  ok('F_retourFichier', f.mode === 'fichier' && f.n === n0 && !f.boul && /TOUCHE ENCORE/.test(f.arme), f);
  // H : saisie faite PENDANT la copie (fichier lent) → passage annulé, la saisie part bien au fichier
  {
    const { p: q, errs: e2, ctx } = await B.page(b, '2026-11-20T18:30:00', B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3')), {}, {}, []);
    let lent = false; await B.fauxGoogle(q);
    let envoisPendant = 0;
    await q.route('https://script.google.com/**', async r => { const pd = r.request().postData() || '{}', d = JSON.parse(pd); if (/Pendant/.test(pd) && d.action !== 'data') envoisPendant++; if (lent && d.action === 'data') await new Promise(x => setTimeout(x, 2000)); return r.fallback(); });
    lent = true;
    const h = await q.evaluate(async () => {
      S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet();
      const pr = passerTelephone();
      await new Promise(x => setTimeout(x, 300)); fermer(); ouvrirSaisie(null); S.form.montant = '7'; S.form.cat = 'Courses'; S.form.lib = 'Pendant'; enregistrer();
      await pr; await new Promise(x => setTimeout(x, 2500));
      return { mode: S.mode, q: S.queue.length, rejets: (LS.get('rejets', []) || []).length, err: ($('#ferr') || {}).textContent };
    }).catch(err => ({ err: err.message }));
    h.envoisAuFichier = envoisPendant; // le faux serveur ne garde pas les ajouts : on vérifie l'envoi lui-même
    ok('H_saisiePendantCopie', h.mode === 'fichier' && h.q === 0 && h.rejets === 0 && envoisPendant === 1, h);
    errs.push(...e2); await ctx.close();
  }
  // I : deux fenêtres de l'appli ouvertes en mode téléphone : aucune saisie n'efface l'autre
  {
    const { p: pa, errs: e3, ctx } = await B.page(b, '2026-11-20T18:30:00', B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3')), {}, {}, []);
    await B.fauxGoogle(pa); await pa.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await passerTelephone(); });
    const fs = require('fs'); const servir = pg => pg.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.fulfill({ status: 200, body: '' });
      const f = path.join(DIR, u.pathname === '/' ? 'index.html' : u.pathname.slice(1)); return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : 'text/html' }); });
    const pb = await ctx.newPage(); await servir(pb); pb.on('pageerror', x => e3.push(x.message)); await pb.clock.setFixedTime(new Date('2026-11-20T18:30:00'));
    await pb.goto('http://app.test/index.html'); await pb.waitForTimeout(2500);
    const ajoute = (pg, lib) => pg.evaluate(async lib => { await rafraichir(true); fermer(); ouvrirSaisie(null); S.form.montant = '3'; S.form.cat = 'Courses'; S.form.lib = lib; S._saveT = 0; enregistrer(); await new Promise(x => setTimeout(x, 1500)); }, lib);
    await ajoute(pa, 'FenetreA'); await ajoute(pb, 'FenetreB');
    const pc = await ctx.newPage(); await servir(pc); await pc.clock.setFixedTime(new Date('2026-11-20T18:30:00')); await pc.goto('http://app.test/index.html'); await pc.waitForTimeout(2500);
    const i = await pc.evaluate(async () => { await rafraichir(true); const L = S.journal.filter(x => /^Fenetre/.test(x.lib || '')); return { mode: S.mode, libs: L.map(x => x.lib + '@' + x.row) }; });
    ok('I_deuxFenetres', i.mode === 'tel' && i.libs.length === 2 && new Set(i.libs.map(x => x.split('@')[1])).size === 2, i);
    errs.push(...e3); await ctx.close();
  }
  // J : données du téléphone effacées → retour automatique au fichier, jamais bloqué
  {
    const { p: pj, errs: e4, ctx } = await B.page(b, '2026-11-20T18:30:00', B.journal('2026-10-01', '2026-11-20', k => k.endsWith('3')), {}, {}, []);
    await B.fauxGoogle(pj); await pj.evaluate(async () => { S.form = { mode: 'donnees' }; rendreForm(); ouvrirSheet(); await passerTelephone(); });
    await pj.evaluate(() => new Promise(ok => { const q = indexedDB.deleteDatabase('jauge.telephone'); q.onsuccess = q.onerror = q.onblocked = () => ok(); }));
    await pj.reload(); await pj.waitForTimeout(3000);
    const j = await pj.evaluate(async () => { await rafraichir(true); return { mode: S.mode, lock: !document.querySelector('#lock').hidden, n: S.journal.length, toast: document.querySelector('#toastT').textContent }; });
    ok('J_donneesEffacees', j.mode === 'fichier' && !j.lock && j.n > 0 && /effacées/.test(j.toast) && /sauvegarde Drive/.test(j.toast), j);
    errs.push(...e4); await ctx.close();
  }
  console.log(JSON.stringify(R, null, 1));
  Object.keys(OK).forEach(k => console.log((OK[k] ? 'OK    · ' : 'ÉCHEC · ') + k));
  console.log('VERDICT:', Object.values(OK).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune');
  await b.close();
})();
