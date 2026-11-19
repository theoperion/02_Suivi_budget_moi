// Lot X1 : courbe du solde = bilan().fin (achat prévu courant, Échéancier courant, mois suivant, ligne sans date),
// retrait d'épargne rangé en « Revenu » (pas un revenu, solde inchangé), épargne NETTE dans les bilans et les stats.
// usage : node lotX1.js <copie> [dossier captures]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2], SHOTS = process.argv[3] || path.join(__dirname, 'x1');
fs.mkdirSync(SHOTS, { recursive: true });
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const API = (html.match(/const API_DEFAUT = '([^']+)'/) || [])[1];
const PFX = (html.match(/localStorage\.getItem\('([^']+)' \+ k\)/) || [])[1] || 'jauge.';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const J = (row, mois, lib, cat, montant, date) => ({ row, mois: mois + ' 2026', lib, cat, montant, date });
const RET = "Retraits d'épargne (LEP/Livret A)";
const srv = {
  journal: [
    J(5, 'Octobre', 'Paie', 'Salaire', 2000, '2026-10-01'), J(6, 'Octobre', 'Courses', 'Courses', 250, '2026-10-04'),
    J(7, 'Octobre', 'Livret', 'Livret A', 300, '2026-10-05'), J(8, 'Octobre', 'Prêt à Paul', 'Prêt à Paul', 200, '2026-10-06'),
    J(9, 'Octobre', 'Retrait LEP', RET, 100, '2026-10-07'),
    J(10, 'Novembre', 'Paie', 'Salaire', 2000, '2026-11-01'), J(11, 'Novembre', 'Courses', 'Courses', 120, '2026-11-03'),
    J(12, 'Novembre', 'Ciné', 'Sorties', 20, '2026-11-08'),
    J(13, 'Novembre', 'Marché (sans date)', 'Courses', 15, null)],
  prefs: {}, adds: []
};
function donnees() {
  return { categories: [
      { ligne: 10, nom: 'Salaire', groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 11, nom: RET, groupe: 'Revenus', type: 'Revenu', budget: null, suivi: '' },
      { ligne: 12, nom: 'Courses', groupe: 'Vie courante', type: 'Dépense', budget: 300, suivi: 'Mensuel' },
      { ligne: 13, nom: 'Sorties', groupe: 'Loisirs', type: 'Dépense', budget: 100, suivi: 'Mensuel' },
      { ligne: 14, nom: 'Streaming', groupe: 'Loisirs', type: 'Dépense', budget: null, suivi: '' },
      { ligne: 15, nom: 'Loyer', groupe: 'Charges fixes', type: 'Dépense', budget: null, suivi: '' },
      { ligne: 16, nom: 'Livret A', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' },
      { ligne: 17, nom: 'Prêt à Paul', groupe: 'Épargne', type: 'Épargne', budget: null, suivi: '' }],
    mois: MOIS.map(m => m + ' 2026'), soldes: { '2026': 1000 }, debut: null,
    echeancier: [
      { ligne: 5, lib: 'Loyer', cat: 'Loyer', montant: 500, freq: 'Mensuel', jour: 5, f: 1, g: 12, h: null, i: null, pause: false },
      // ligne d'Échéancier dans une catégorie COURANTE (Loisirs), le 20 : comptée à sa date dans la courbe
      { ligne: 6, lib: 'Abonnement vidéo', cat: 'Streaming', montant: 40, freq: 'Mensuel', jour: 20, f: 1, g: 12, h: null, i: null, pause: false }],
    journal: srv.journal.map(l => Object.assign({}, l)),
    libres: 5, controle: { mois: '', solde: null, especes: null },
    avenir: [{ row: 3, mois: 'Novembre 2026', jour: 25, lib: 'Concert', cat: 'Sorties', montant: 30, fait: false },
      { row: 4, mois: 'Décembre 2026', jour: 10, lib: 'Resto', cat: 'Sorties', montant: 30, fait: false },
      { row: 5, mois: 'Décembre 2026', jour: 12, lib: 'Livret décembre', cat: 'Livret A', montant: 150, fait: false }],
    defis: {}, prefs: JSON.parse(JSON.stringify(srv.prefs)), url: 'x', apiVersion: '5.13', anomalies: '✅', lu: new Date().toISOString() };
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: 'Europe/Paris' }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-16T10:00:00+01:00'));
  await p.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com')) {
      const q = JSON.parse(r.request().postData());
      const un = o => {
        if (o.action === 'data') return { ok: true, data: donnees() };
        if (o.action === 'add') { srv.adds.push(o.ligne); return { ok: true, row: 100 + srv.adds.length }; }
        if (o.action === 'pref-set') { if (o.valeur == null) delete srv.prefs[o.cle]; else srv.prefs[o.cle] = JSON.parse(JSON.stringify(o.valeur)); return { ok: true }; }
        return { ok: true };
      };
      let res;
      if (q.action === 'lot') { const ops = q.ops || q.lot || q.envois || []; const l = ops.map(o => un(Object.assign({ action: o.action }, o.payload || o))); res = { ok: true, res: l, resultats: l }; } else res = un(q);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    }
    if (u.startsWith('http://app.test/')) { const f = path.join(DIR, decodeURIComponent(new URL(u).pathname.slice(1)) || 'index.html'); return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.fulfill({ path: path.join(DIR, 'index.html') }); }
    return r.fulfill({ status: 200, body: '' });
  });
  await p.addInitScript(([api, x]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.setItem(x + 'key', JSON.stringify('k')); localStorage.setItem(x + 'api', JSON.stringify(api)); localStorage.setItem(x + 'apiDefautVu', JSON.stringify(api)); localStorage.setItem(x + 'tutoVu', 'true'); } }, [API, PFX]);
  await p.goto('http://app.test/index.html'); await p.waitForTimeout(2500);
  const R = await p.evaluate(() => {
    const T = h => String(h).replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ').trim();
    const r2 = v => Math.round(v * 100) / 100;
    const dep0 = soldeDepart(2026) + Array.from({ length: 10 }, (_, i) => calc(2026, i + 1).restant).reduce((a, v) => a + v, 0);
    const P = courbeSolde(), nov = P.filter(x => x.m === 11), dec = P.filter(x => x.m === 12);
    const finNov = dep0 + bilan(2026, 11).fin, finDec = finNov + bilan(2026, 12).fin;
    const Q = courbeSoldeMois(2026, 12);
    const c10 = calc(2026, 10), c11 = calc(2026, 11);
    // jour de la ligne sans date : comptée aujourd'hui (le 16), pas dès le 1er
    const p15 = nov.find(x => x.j === 15).s, p16 = nov.find(x => x.j === 16).s;
    S.y = 2026; S.m = 10; const acc = T(vueAccueil()); S.y = 2026; S.m = 11;
    const bm = bilanMois(2026, 10), ba = bilanAnnee(2026);
    S.bilVue = 'mois'; const lb = T(blocBilans());
    const st = T(statsAnnee(2026));
    const lA = moisAnnee(2026);
    return {
      courbeNov: r2(nov[nov.length - 1].s), attenduNov: r2(finNov), courbeDec: r2(dec[dec.length - 1].s), attenduDec: r2(finDec),
      courbeMoisDec: Q ? r2(Q[Q.length - 1].s) : null, p15: r2(p15), p16: r2(p16), soldeAuj: r2(soldeCalcule(2026, 11)),
      rev10: c10.rev, restant10: c10.restant, ep10: c10.ep, epN10: c10.epN, epR10: c10.epR, nd10: r2(c10.restant + c10.ep + c10.av), rev11: c11.rev,
      ticket: (acc.match(/REVENUS [^A-Z]*|ÉPARGNE (VERSÉE|RETIRÉE) [^A-Z]*|PRÊTS À DES PROCHES [^A-Z]*|RESTE [^A-Z]*/g) || []).map(s => s.trim()),
      bilanMoisEp: bm.c.epN, bilanAnneeEp: ba.ep, bilanAnneeRev: ba.rev, listeBilans: (lb.match(/OCTOBRE 2026[^€]*€[^€]*épargnés/) || [''])[0],
      statsEp: (st.match(/MON ÉPARGNE [^«]*?PLACÉS( · [^R]*RETIRÉS)?/) || [''])[0],
      decDep: r2(lA[11].dep), decAttendu: r2(lA[11].b.fix + lA[11].b.prevVar), taux: tauxHoraire().salaire
    };
  });
  const ok = {
    courbeNov: Math.abs(R.courbeNov - R.attenduNov) < 0.01,
    courbeDec: Math.abs(R.courbeDec - R.attenduDec) < 0.01 && Math.abs(R.courbeMoisDec - R.attenduDec) < 0.01,
    sansDate: Math.abs(R.p16 - R.soldeAuj) < 0.01 && Math.abs((R.p15 - R.p16) - 15) < 0.01, // le 15 : avant la ligne « sans date » de 15 €
    revenus: R.rev10 === 2000 && R.rev11 === 2000,
    solde: Math.abs(R.restant10 - (2000 - 250 - 500 - 40 - 300 - 200 + 100)) < 0.01,
    epNette: R.epN10 === 200 && R.epR10 === 100 && R.ep10 === 400,
    nonDepense: Math.abs(R.nd10 - (2000 - 250 - 500 - 40)) < 0.01, // le retrait n'est plus « non dépensé »
    ticket: R.ticket.some(s => /^REVENUS 2 000,00/.test(s)) && R.ticket.some(s => /^ÉPARGNE VERSÉE −200,00/.test(s)) && R.ticket.some(s => /^PRÊTS À DES PROCHES −200,00/.test(s)),
    bilans: R.bilanMoisEp === 200 && R.bilanAnneeEp === 200 && R.bilanAnneeRev === 2000 && /200 € épargnés/.test(R.listeBilans),
    stats: /200 € PLACÉS · 100 € RETIRÉS|200 € PLACÉS$/.test(R.statsEp),
    decSansEpargne: Math.abs(R.decDep - R.decAttendu) < 0.01, // le Livret prévu en décembre n'est pas une dépense
    taux: R.taux === 2000
  };
  await p.screenshot({ path: path.join(SHOTS, 'x1-accueil.png'), fullPage: false });
  console.log(JSON.stringify(R, null, 1)); console.log(JSON.stringify(ok));
  console.log('VERDICT:', Object.values(ok).every(Boolean) ? 'OK' : 'ÉCHEC');
  console.log('ERREURS JS:', errs.length ? errs : 'aucune'); await b.close();
})();
