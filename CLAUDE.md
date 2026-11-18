# Budget « Jauge » : notice pour Claude (passation)

Ce fichier est lu automatiquement par Claude Code. Il résume tout ce qu'il faut savoir pour reprendre le projet.

## Qui, quoi

- **Théo** (propriétaire, francophone, **non technique**) : c'est Claude qui fait tout (code, tests, mise en ligne, scripts). Ne jamais lui demander de manipulation technique ; lui parler en français simple, sans jargon.
- **3 applis de budget** (PWA, un seul fichier `index.html`) :
  - `theoperion/02_Suivi_budget_moi` : l'appli de Théo, **le modèle** (c'est ici qu'on code).
  - `theoperion/05_Suivi_budget_Clement` et `theoperion/06_Suivi_budget_Devlin` : **générées** depuis le modèle par `commun/generer.py` (ne jamais les modifier à la main).
- Chaque appli parle à **son** Google Sheet via **son** script Apps Script (web app `doPost`).
- Hébergement : GitHub Pages (branche `main` de chaque dépôt).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | toute l'appli (HTML + CSS + JS, ~5 400 lignes). `const VERSION = '9.25'` |
| `sw.js` | service worker cache-first. `const CACHE = PREFIXE + 'NN'` : **à incrémenter à chaque version** |
| `manifest.json`, `icon-*.png` | PWA |
| `apps-script/Code.js` | API Apps Script (`VERSION_API`, actuellement 5.13), actions `data`, `add`, `update`, `delete`, `lot` (envois groupés), `pref-set`, `budget`, échéancier, à venir… |
| `apps-script/.clasp.json` | scriptId du script de Théo |
| `commun/personnes.json` | réglages propres à Clément et Devlin (titre, lien du script, préfixes de stockage et de cache, id du fichier, scriptId, id de déploiement) |
| `commun/generer.py` | fabrique les copies 05/06 : remplacements **exacts** (le script s'arrête si un motif n'est pas trouvé le bon nombre de fois) |
| `outils/tests/*.js` | tests Playwright avec faux serveur (voir plus bas) |

## Publier une nouvelle version (procédure complète)

1. Modifier `index.html` (et `Code.js` si besoin) dans **02**.
2. Monter `VERSION` dans `index.html` et `CACHE` dans `sw.js` (+1).
3. Vérifier la syntaxe : extraire le `<script>` et `node --check`.
4. Lancer les tests (voir plus bas). Regarder les captures d'écran à la main.
5. `git commit` dans 02, puis `python3 commun/generer.py` (les dépôts 05 et 06 doivent être clonés **à côté** de 02, dans le même dossier parent).
6. Commit dans 05 et 06, puis pousser **les 3** sur `main` (et sur la branche de travail si l'environnement l'impose).
7. Vérifier que GitHub Pages a bien publié (Actions « pages build and deployment »). Si un déploiement reste bloqué en « queued », pousser un petit commit (ex. README) pour en relancer un.
8. Mettre à jour le document de suivi et prévenir Théo avec un récap simple.

### Script Apps Script (seulement si `Code.js` change)

- Monter `VERSION_API`. `clasp push` puis `clasp deploy -i <id de déploiement>` pour **chacun** des 3 scripts (on met à jour le déploiement existant : l'adresse ne change jamais).
- Il faut d'abord `clasp login --no-localhost` avec le compte Google de Théo (il colle l'adresse de retour).
- Pour 05/06 : générer d'abord, puis `clasp push` / `clasp deploy` dans `../05…/apps-script` et `../06…/apps-script` (leur `.clasp.json` est généré).
- Ids de déploiement : Théo `AKfycbzdbw1TzpRU16ftWHzSf04CE_Y6lfvfH08uuHF1na_uz97gCLdYr5fylt8F_QvUQBwRzQ` ; Clément et Devlin : voir `commun/personnes.json`.
- Une migration de données « une seule fois » se fait dans `Code.js` avec un drapeau dans les propriétés du script (ex. `MIGR_COURSES`).

## Tests

- `npm` n'est pas nécessaire : Playwright est installé globalement dans l'environnement cloud.
- Lancer : `node outils/tests/lotH2.js <dossier de l'appli> [dossier captures]` (idem lotA, lotB, lotF1, lotF6, lotG, lotG2-h2, lotI, lotJ, lotK, lotL, lotM). Les `jeu*.js` prennent le chemin de `index.html`.
- Ils simulent le serveur Apps Script (`page.route`) et figent l'horloge. Résultat attendu : « VERDICT: OK » quand il existe, et **« ERREURS JS: aucune »** partout.
- Pour Clément/Devlin, certains tests codent en dur le préfixe de stockage `jauge.` : remplacer par `jauge-clem.` / `jauge-devlin.` dans une copie.
- `g3ui.js` a un contrôle « défi de la semaine visible » qui échoue depuis que les dépenses essentielles ne servent plus de défi (les données de test n'ont que Courses) : c'est le test qui est à mettre à jour, pas l'appli.
- Dans le cloud, `script.google.com` et `github.io` sont bloqués : on ne teste jamais contre le vrai serveur.

## Notions importantes du code

- **Préférences synchronisées** (propriétés du script, clés `PREFS_OK_`) : tirelires, voyages, escalier, semaines, objectifs, jeu, especes, envies. Limite ~8 000 caractères par clé.
- **Journal** : colonne M « Saisi le », colonne N « Payé en » (Espèces). L'option « achat en ligne » a été supprimée.
- `calc(y, m)` : bilan d'un mois (Journal + Échéancier). `bilan(y, m)` ajoute la fin de mois prévue (`resteBudgets` : part des budgets **des jours restants**, catégorie par catégorie).
- `budgets(y, m)` : un budget « Annuel » se suit sur l'année (`annuel`, `dep` cumulé). « Sans alerte » = essentiel (courses) : jamais de défi, pas de rythme.
- Épargne : les catégories dont le nom contient « prêt » ne sont **pas** de l'épargne (objectif, stats), mais comptent dans le solde. L'objectif compte l'épargne **nette** (versements − retraits d'épargne, `estRetraitEp` reconnaît aussi un revenu nommé « retrait … épargne/livret/LEP… »). Saisie : ÉPARGNE › « ↓ Mettre de côté » / « ↑ Retirer » (`f.sens`).
- Jeu : 100 niveaux (`xpNiveau`), 10 rangs, récompense à chaque niveau, ~1/3 des cosmétiques via succès/défis ; les succès reflètent la réalité (pas de mémorisation) ; vitrine : affiches à gauche, écussons à droite.
- Bouton retour : une entrée d'historique « garde » ; « retour » ne fait **jamais** sortir de l'appli (sinon écran blanc sous Firefox Android).
- Carte « Nouveau mois » (du 1er au 7) : bilan, conseils de budgets (mensuels + annuels), objectif d'épargne en janvier, contrôle du solde.

## Décisions déjà prises avec Théo (ne pas revenir dessus sans lui)

- Pas de vibrations. Pas d'« achat en ligne ». Petit achat = moins de 20 €.
- Taux horaire : salaire moyen 3 mois ÷ (heures/semaine × 52/12) ; 38 h 40 pour Théo, 35 h par défaut pour les autres (`HEURES_SEMAINE_DEFAUT`, remplacé par le générateur).
- Les 5 boutons du haut restent tels quels. « Budgets tenus » = 3 mois verts. Ancien succès « Régulier » renommé « Semainier ».
- Idée « mettre de côté chaque mois pour les budgets annuels » : écartée (trop lourd).
- Mode d'emploi : seulement dans Réglages (pas sur l'accueil).
- Prêts à des proches : se saisissent dans DÉPENSE › « Payé pour d'autres aussi » (ma part 0 €), plus dans ÉPARGNE. « Autres revenus » = vrais revenus en plus (cadeau, vente…), jamais un retrait d'épargne.

## À faire / en attente

- **Transfert de l'appli de Clément le mercredi 25 novembre 2026** (fiche de transfert déjà remise à Théo). Ensuite : retirer Clément de `commun/personnes.json` (et adapter `generer.py`). Même chose pour Devlin plus tard. Théo n'hébergera plus leurs applis.
- Mettre à jour `g3ui.js` (voir Tests).

## Façon de travailler avec Théo

- Il valide les propositions avant le travail (« vas-y », « go »), puis veut tout en ligne directement (pas de version bêta).
- Toujours finir par : version publiée, tests passés, explication courte et concrète, avec un exemple chiffré.
- Un document de suivi (« mode d'emploi ») existe sur son ancien compte Claude ; s'il n'est plus accessible, ce fichier le remplace.
