// Tests ciblés lot H1 : journal d'XP, petit cochon / mascotte, paliers de récompenses, essentiels hors défis, vitrine gauche/droite, écussons
const { chromium } = require('playwright'); const { page, journal } = require('./base.js');
const SP = '/tmp/claude-0/-home-user/90b26bed-93bd-5223-810a-380eb23bf8fd/scratchpad/testH1/';
let ech = 0; const ok = (c, m, v) => { if (!c) ech++; console.log((c ? 'OK   ' : 'ÉCHEC') + ' · ' + m + (v !== undefined ? ' · ' + JSON.stringify(v) : '')); };
const nettoie = p => p.evaluate(() => { try { fermer(); } catch (e) {} document.querySelectorAll('.lvlup,#gains,canvas').forEach(x => x.remove()); });
(async () => {
  const b = await chromium.launch(); const ERR = [];
  const J = journal('2026-11-01', '2026-12-14', k => +k.slice(8) % 3 === 0, [['2026-11-03', 'Livret A', 175], ['2026-12-02', 'Courses', 60], ['2026-12-03', 'Sorties', 25]]);
  // --- 1. Journal d'XP complet ---
  { const log = Array.from({ length: 150 }, (_, i) => { const d = new Date(2026, 10, 1 + Math.floor(i / 5)); return { j: d.toISOString().slice(0, 10), h: String(10 + i % 5).padStart(2, '0') + ':00', k: 'r:Jours sans dépense courante', v: i % 7 ? 5 : -5 }; }).reverse();
    const { p, ctx, errs } = await page(b, '2026-12-14T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true, xpLog: log });
    await nettoie(p);
    await p.evaluate(() => { S.form = { mode: 'xplog' }; rendreForm(); ouvrirSheet(); });
    const avant = await p.evaluate(() => document.querySelectorAll('#sheetIn #xpjournal + .ticket .tl').length);
    await p.click('#sheetIn [data-act=xplog]'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => { const L = [...document.querySelectorAll('#sheetIn #xpjournal + .ticket .tl')].map(x => x.innerText.replace(/\n/g, ' ')); return { n: L.length, premier: L[0], dernier: L[L.length - 1], bouton: document.querySelector('#sheetIn [data-act=xplog]').innerText, garde: LS.get('xpLog').length }; });
    ok(avant === 8 && r.n >= 150, 'journal : 8 lignes puis tout le journal dans la feuille', { avant, n: r.n });
    ok(/01\/12|30\/11|^/.test(r.premier) && /01\/11/.test(r.dernier), 'journal : du plus récent au plus ancien', [r.premier, r.dernier]);
    await p.waitForTimeout(300); await p.screenshot({ path: SP + 'journal-xp.png' });
    // un nouveau gain s'ajoute en tête sans tronquer à 100
    const n2 = await p.evaluate(() => { const e = etatJeu(); LS.set('xpDetail', {}); journaliserXP(e); return LS.get('xpLog').length; });
    ok(n2 > 150, 'journal : plus de 100 lignes gardées', n2);
    ERR.push(...errs); await ctx.close(); }
  // --- 2. Petit cochon : mascotte (tirelire) et événement d'épargne ---
  { const { p, ctx, errs } = await page(b, '2026-11-16T12:00:00', J.filter(e => e.date < '2026-11-16'), {}, { nivVu: 1, xpVu: 0, echelle100: true, cos_mascotte: 'on' });
    await nettoie(p);
    const r = await p.evaluate(() => { const e = etatJeu(), co = planEvenements().map(etatEv).find(x => x.def.id === 'cochon'); return { niv: e.niv, xp: e.xp, masc: !!document.querySelector('.gauge .masc'), mtxt: (document.querySelector('.gauge .masc') || {}).innerText, cos: cos('mascotte'), cochon: co && { debut: co.debut, fin: co.fin, statut: co.statut, info: co.info }, jd: joursAvecDep(), badge: badgesGagnes().some(b => b.id === 'e:cochon') }; });
    ok(r.masc && r.cos === 'on', 'tirelire 🐷 affichée à côté de la jauge même au niveau ' + r.niv, r);
    ok(r.cochon && r.cochon.statut === 'reussi' && r.badge, 'événement Petit cochon réussi malgré les jours avec dépenses non saisies', r.cochon);
    ERR.push(...errs); await ctx.close(); }
  // --- 3. Paliers ---
  { const { p, ctx, errs } = await page(b, '2026-12-14T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true });
    await nettoie(p);
    const r = await p.evaluate(() => { const L = tousCosm(), vides = [];
      for (let n = 2; n <= 100; n++) { const c = L.filter(o => parNiveau(o) && o.niv === n).length, t = TITRES.some((x, k) => k && nivTitre(k) === n); if (!c && !t) vides.push(n); }
      const nd = L.filter(o => !(parNiveau(o) && o.niv <= 1)), hors = nd.filter(o => !parNiveau(o));
      const prem = []; for (let n = 2; n <= 15; n++) prem.push(n + ': ' + L.filter(o => parNiveau(o) && o.niv === n).map(o => o.nom + ' [' + o.t + ']').concat(TITRES.filter((x, k) => k && nivTitre(k) === n).map(x => 'titre ' + x)).join(' + '));
      const rep = { niveau: nd.filter(parNiveau).length, succes: hors.filter(o => o.suc).length, defis: hors.filter(o => o.df).length, saisons: hors.filter(o => o.saison).length, prestige: hors.filter(o => o.prest).length };
      return { vides, prem, rep, part: Math.round(hors.length / nd.length * 100), pr: prochaineRecompense(1), pr10: prochaineRecompense(10), x11: xpNiveau(11), x2: xpNiveau(2), x3: xpNiveau(3), niv: etatJeu().niv, xp: etatJeu().xp }; });
    ok(!r.vides.length, 'au moins une récompense à chaque niveau 2-100', r.vides);
    ok(r.part >= 30, 'part des cosmétiques hors niveau', r.part + ' %'); console.log(JSON.stringify(r, null, 1));
    await p.evaluate(() => { S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'style'; S.collT = 'skin'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(500);
    const lab = await p.evaluate(() => [...document.querySelectorAll('.cit small')].map(x => x.innerText).join(' | '));
    ok(/NIVEAU 2|CHOISIR/.test(lab) && /DÉFI/i.test(lab), 'collection : chaque verrou dit comment se débloquer', lab);
    await p.screenshot({ path: SP + 'collection.png', fullPage: false });
    await p.evaluate(() => { const z = document.querySelector('.coll'); if (z) z.scrollIntoView(); }); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'collection2.png' });
    await p.evaluate(() => { S.progT = 'succes'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(400);
    const carte = await p.evaluate(() => document.querySelector('.niv').innerText.replace(/\n/g, ' | '));
    ok(/Prochaine récompense/.test(carte), 'carte de niveau : prochaine récompense', carte);
    await p.screenshot({ path: SP + 'niveau.png' });
    await p.evaluate(() => { const e = Object.assign({}, etatJeu(), niveauDe(xpNiveau(2) + 5)); ecranNiveau(1, e); }); await p.waitForTimeout(1600);
    const lv = await p.evaluate(() => document.querySelector('.lvlup').innerText.replace(/\n/g, ' | '));
    ok(/Prochaine récompense/.test(lv) && /Minimal/.test(lv), 'montée au niveau 2 : jauge + accent et prochaine récompense', lv);
    await p.screenshot({ path: SP + 'lvlup2.png' });
    // un cosmétique de défi se débloque et s'annonce
    const dfa = await p.evaluate(() => { document.querySelectorAll('.lvlup').forEach(x => x.remove()); LS.set('cosmDf', []); const e = etatJeu(); const f0 = e.f.semOk; e.f.semOk = 1; annoncerGains(e, [], [], { gagnes: [], neuf: null }, { plus: [], moins: [] }); const t = (document.querySelector('#gains') || {}).innerText; e.f.semOk = f0; return { t, corail: debloque(tousCosm().find(o => o.id === 'corail'), 1) }; });
    ok(/Corail/.test(dfa.t || ''), 'annonce d\'un cosmétique gagné par un défi', dfa);
    ERR.push(...errs); await ctx.close(); }
  // --- 4. Essentiels hors défis ---
  { const J2 = journal('2026-11-01', '2027-06-20', k => +k.slice(8) % 3 === 0, [].concat(...Array.from({ length: 30 }, (_, i) => { const d = new Date(2026, 10, 2 + i * 7); const k = d.toISOString().slice(0, 10); return [[k, 'Courses', 90], [k, 'Restaurants', 12]]; })));
    const { p, ctx, errs } = await page(b, '2027-06-20T12:00:00', J2, {}, { nivVu: 1, xpVu: 0, echelle100: true });
    await nettoie(p);
    const r = await p.evaluate(() => { const bd = budgetsDefiables().map(c => c.nom), ps = propositionSemaine(), E = [...essentiels()];
      const plan = planEvenements().map(x => x.def.id), poche = EVENEMENTS.find(d => d.id === 'poche'), c = ctxEv(), f = poche.filtre(c, {}), folie = EVENEMENTS.find(d => d.id === 'folie').filtre(c, {});
      const mis = []; for (let m = 1; m <= 12; m++) { const x = missionDe(2027, m); if (x && x.cat) mis.push(x.cat); }
      // catégorie « Sans alerte » ajoutée à la volée
      const CA = cats(); const cantine = { nom: 'Cantine pro', groupe: 'Vie courante', type: 'Dépense', budget: 80, suivi: 'Sans alerte' };
      return { bd, ps, E, panier: plan.filter(x => x === 'panier').length, nplan: plan.length, pocheCourses: f({ cat: 'Courses' }), pocheResto: f({ cat: 'Restaurants' }), folieCourses: folie({ cat: 'Courses' }), mis, chips: (() => { const n0 = now; now = new Date(n0.getFullYear(), n0.getMonth(), 3, 12); ouvrirDefi(); const t = [...document.querySelectorAll('#sheetIn [data-act=defi-cat]')].map(x => x.dataset.cat); fermer(); now = n0; return t; })() }; }); // (9.33) un défi se lance du 1er au 5 : on regarde la liste un 3 du mois
    ok(!r.bd.includes('Courses') && r.chips.length > 0 && !r.chips.includes('Courses'), 'défi du mois : pas les courses', r.chips);
    ok(r.ps && r.ps.cat !== 'Courses', 'défi de la semaine : pas les courses', r.ps);
    ok(!r.mis.includes('Courses'), 'mission coup de frein : pas les courses', r.mis);
    ok(r.panier === 0 && !r.pocheCourses && r.pocheResto && !r.folieCourses, 'événements à plafond : essentiels ignorés, Petit panier plus tiré', r);
    ERR.push(...errs); await ctx.close();
    // Sans alerte
    const { p: p2, ctx: c2, errs: e2 } = await page(b, '2027-06-20T12:00:00', J2, {}, { nivVu: 1, xpVu: 0, echelle100: true });
    const r2 = await p2.evaluate(() => { const c = cats().find(x => x.nom === 'Restaurants'); c.suivi = 'Sans alerte'; return { bd: budgetsDefiables().map(c => c.nom), E: [...essentiels()], ps: propositionSemaine(), resto: (S._ev = null, ctxEv().resto) }; });
    ok(!r2.bd.includes('Restaurants') && r2.E.includes('Restaurants') && !(r2.ps && r2.ps.cat === 'Restaurants') && !r2.resto.includes('Restaurants'), 'catégorie « Sans alerte » : jamais en défi', r2);
    ERR.push(...e2); await c2.close(); }
  // --- 5/6. Vitrine gauche/droite + écussons ---
  { const { p, ctx, errs, PRF } = await page(b, '2026-12-14T12:00:00', J, {}, { nivVu: 1, xpVu: 0, echelle100: true, cos_mascotte: 'on' });
    await nettoie(p);
    const ids = await p.evaluate(() => badgesGagnes().map(b => b.id));
    const s = ids.filter(x => x.startsWith('s:')).slice(0, 3), e = ids.filter(x => x.startsWith('e:')).slice(0, 3);
    // ancienne vitrine mélangée (2 affiches + 1 écusson) : migrée par type
    await p.evaluate(v => { setPref('jeu', Object.assign({}, getPref('jeu', {}) || {}, { vitrine: v })); rendre(true); }, [s[0], e[0], s[1]]);
    const m1 = await p.evaluate(() => ({ g: document.querySelectorAll('.gauge .vitr:not(.vitrd) .badge2').length, d: document.querySelectorAll('.gauge .vitr.vitrd .badge2').length }));
    ok(m1.g === 2 && m1.d === 1, 'migration : affiches à gauche, écussons à droite', { ids, m1 });
    for (const id of [s[2], e[1], e[2]]) if (id) await p.evaluate(id => basculerVitrine(id), id);
    const r = await p.evaluate(() => { const G = document.querySelector('.gauge'), rg = G.getBoundingClientRect(), box = x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
      return { g: document.querySelectorAll('.gauge .vitr:not(.vitrd) .badge2').length, d: document.querySelectorAll('.gauge .vitr.vitrd .badge2').length, gauge: box(G), svg: box(G.querySelector('svg')), vg: box(G.querySelector('.vitr:not(.vitrd)')), vd: box(G.querySelector('.vitrd')), masc: box(G.querySelector('.masc')), largeur: document.documentElement.scrollWidth }; });
    ok(r.g === 3 && r.d === Math.min(3, e.length), '3 affiches à gauche, écussons à droite', r);
    ok(r.largeur <= 390, 'pas de défilement horizontal', r.largeur);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400); await p.screenshot({ path: SP + 'accueil-vitrine.png' });
    // 4e affiche refusée, 4e écusson côté droit indépendant
    const refus = await p.evaluate(sid => { const av = (vitrine() || []).length; basculerVitrine(sid); return [av, (vitrine() || []).length]; }, ids.filter(x => x.startsWith('s:'))[3]);
    ok(refus[0] === refus[1], '4e affiche refusée (3 max à gauche)', refus);
    await p.evaluate(() => { S.form = { mode: 'vitrine' }; rendreForm(); ouvrirSheet(); }); await p.waitForTimeout(400);
    const fv = await p.evaluate(() => [...document.querySelectorAll('#sheetIn .sec')].map(x => x.innerText.replace(/\n/g, ' ')));
    ok(fv.length === 2 && /GAUCHE/.test(fv[0]) && /DROITE/.test(fv[1]), 'feuille vitrine par côté', fv);
    await p.screenshot({ path: SP + 'feuille-vitrine.png' });
    // 390 → 360 et 430
    for (const w of [360, 430]) { await p.evaluate(() => fermer()); await p.setViewportSize({ width: w, height: 800 }); await p.evaluate(() => { S.tab = 'home'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(300); await p.screenshot({ path: SP + 'accueil-vitrine-' + w + '.png', clip: { x: 0, y: 0, width: w, height: 420 } }); }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => { S.tab = 'stats'; S.statsVue = 'progres'; S.progT = 'succes'; rendre(); scrollTo(0, 0); }); await p.waitForTimeout(300);
    const has = await p.evaluate(() => !!document.querySelector('[data-act=ecussons-go]'));
    await p.click('[data-act=ecussons-go]'); await p.waitForTimeout(400);
    const vis = await p.evaluate(() => { const z = document.getElementById('ecussons'); const r = z.getBoundingClientRect(); return Math.round(r.top); });
    ok(has && vis < 200, 'bouton « Mes écussons » mène aux écussons', { has, vis });
    await p.screenshot({ path: SP + 'ecussons.png' });
    await p.evaluate(() => { S.progT = 'defis'; rendre(); scrollTo(0, 0); }); const hd = await p.evaluate(() => !!document.querySelector('[data-act=ecussons-go]'));
    ok(hd, 'bouton aussi dans DÉFIS', hd);
    ERR.push(...errs); await ctx.close(); }
  console.log('ÉCHECS:', ech, '· ERREURS JS:', ERR.length ? ERR : 'aucune'); await b.close();
})();
