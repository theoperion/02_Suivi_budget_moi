# Budget « Jauge » : fiche pour Claude

Fiche courte, lue automatiquement. Elle ne parle **que** de l'appli Budget. Ancienne fiche (jusqu'au 23/11/2026) : `archives/CLAUDE_2026-11-23.md`, à ne lire que si Théo le demande.

## But
L'appli de budget de Théo (PWA, un seul fichier `index.html`), reliée à **son** Google Sheet par **son** script Apps Script. Deux copies générées automatiquement : Clément (`05_Suivi_budget_Clement`, jusqu'à son transfert) et Devlin (`06_Suivi_budget_Devlin`). Hébergement : GitHub Pages (`main`).

## Règles de travail
- Théo est **non technique** : Claude fait tout, lui parle en français simple, sans jargon, ne lui demande aucune manipulation technique.
- Claude propose → Théo valide (« go ») → Claude construit, teste, publie directement en ligne (pas de bêta).
- Toujours finir par : version publiée, tests passés, explication courte avec un exemple chiffré, et **quels agents ont relu et pourquoi** (une ligne).
- **Idées** : toute idée non finalisée sur le Budget va dans `IDEES.md` (jamais dans cette fiche). Ne lire `IDEES.md` que si Théo le demande. Une idée qui concerne une autre appli va dans le dépôt de cette appli.
- Cette conversation ne s'occupe que du Budget : un autre sujet → renvoyer Théo vers la bonne conversation.
- Économiser les crédits : agents seulement selon le tableau plus bas ; pour un petit changement, tester seulement l'écran concerné.
- Pas de tâche programmée sans demande explicite de Théo, une seule à la fois.

## Où est quoi
| Fichier | Rôle |
|---|---|
| `index.html` | toute l'appli. `const VERSION = '9.42'` |
| `sw.js` | hors connexion. `const CACHE = PREFIXE + 'NN'` : +1 à chaque version |
| `apps-script/Code.js` | le script Google (`VERSION_API` 5.14), `.clasp.json` = script de Théo |
| `commun/personnes.json`, `commun/generer.py` | réglages et fabrication des copies 05/06 (remplacements exacts, s'arrête si un motif manque). `generer.py --une <reglages.json> <dossier>` : une seule copie (utilisé par le robot) |
| `commun/mise-a-jour.yml` | robot GitHub copié dans le dépôt d'une personne qui héberge son appli : chaque nuit, prend `main` de 02 et fabrique sa copie avec son `reglages.json`. **Tout nouveau fichier de l'appli (icônes comprises) doit être ajouté à `fabriquer()` de `generer.py`**, sinon les copies ne le reçoivent pas. Ne jamais casser `--une` (test : `outils/tests/generer.sh`, lancé par `tout.sh`). Tout nouveau réglage lu avec une valeur par défaut (`p.get(…, défaut)`) : on ne peut plus modifier le `reglages.json` d'une personne transférée, une clé manquante bloquerait ses mises à jour |
| `outils/tests/*.js` | tests Playwright avec faux serveur |
| `.claude/agents/` | les agents de relecture (voir plus bas) |

## Publier une version
1. Modifier `index.html` (et `Code.js` si besoin) dans 02 ; monter `VERSION` et `CACHE`.
2. Syntaxe : extraire le `<script>` et `node --check`. Tests (plus bas). Regarder les captures.
3. Relecture par les agents selon le tableau.
4. Commit dans 02, `python3 commun/generer.py` (05 et 06 clonés à côté de 02), commit dans 05/06, pousser les 3 **directement sur `main`** (accord de Théo du 24/11 : pas de demande de fusion, même si l'environnement cloud impose une branche de travail).
5. Vérifier GitHub Pages (Actions « pages build and deployment » ; si bloqué en « queued », pousser un petit commit).
- **Script Google** (seulement si `Code.js` change) : pour une personne transférée (Clément), personne ne redéploie son script : monter `API_ATTENDUE` dans `index.html` pour que son appli affiche « Apps Script pas à jour », et prévenir Théo pour qu'il la prévienne (marche à suivre dans le README de son dépôt). Sinon : monter `VERSION_API`, puis `clasp push` + `clasp deploy -i <id>` pour chacun (adresse inchangée ; `clasp login --no-localhost` avec le compte de Théo). Id de Théo : `AKfycbzdbw1TzpRU16ftWHzSf04CE_Y6lfvfH08uuHF1na_uz97gCLdYr5fylt8F_QvUQBwRzQ` ; les autres dans `commun/personnes.json`. Migration « une seule fois » = drapeau dans les propriétés du script.

## Tests
- `node outils/tests/<lot>.js <dossier de l'appli> [captures]` (Playwright global, pas de npm). lotX1 chiffres, lotX2/X4/X5 jeu, lotX3 envois, `codeX3.js` Code.js dans Node, `g3ui.js` interface (« TOUT VERT »), `jeu*.js` prennent le chemin d'`index.html`.
- Attendu : « VERDICT: OK » et **« ERREURS JS: aucune »**. Jamais contre le vrai serveur (bloqué dans le cloud).
- **Tout d'un coup** (24/11) : `bash outils/tests/tout.sh <appli> <dossier résultats>` lance tous les lots + `releve.js` (texte de 19 écrans, 16 fenêtres, calculs des 12 mois). Pour un changement qui ne doit rien changer à l'écran : lancer sur l'ancienne version (`git archive HEAD | tar -x -C …`) et la nouvelle, puis `diff -r` (seuls des identifiants aléatoires de lotG2-h2 peuvent différer). Les captures des tests (sous-dossiers de `outils/tests/`) sont ignorées par `.gitignore` : ne jamais les mettre dans le dépôt (public).
- Copies 05/06 : remplacer le préfixe `jauge.` par `jauge-clem.` / `jauge-devlin.` dans une copie des tests.

## Notions du code
- `calc(y, m)` : bilan d'un mois (Journal + Échéancier) ; `bilan(y, m)` ajoute la fin prévue (`resteBudgets`, budgets des jours restants) ; `budgets(y, m)` (annuel suivi sur l'année, « Sans alerte » = essentiel).
- Épargne : nette = versements − retraits (`estRetraitEp` reconnaît aussi un revenu « retrait … épargne/livret/LEP »). Catégories « prêt » : pas de l'épargne, mais dans le solde.
- Préférences synchronisées (clés `PREFS_OK_`, ~8 000 caractères max) : tirelires, voyages, escalier, semaines, objectifs, jeu, especes, envies (`pn`/`px` = prénoms de « Payé pour d'autres »).
- Journal : colonne M « Saisi le », N « Payé en » (Espèces).
- Mises à jour : le service worker prend les fichiers frais, l'appli se recharge seule au retour au premier plan, jamais pendant une saisie. Bouton retour : ne fait jamais sortir de l'appli.
- Jeu : 100 niveaux, 10 rangs, récompense à chaque niveau ; succès = la réalité. Carte « Nouveau mois » du 1er au 7.

## Décisions de Théo (ne pas revenir dessus sans lui)
- Pas de vibrations, pas d'« achat en ligne ». Petit achat = moins de 20 €. Les 5 boutons du haut restent tels quels. Mode d'emploi seulement dans Réglages.
- Taux horaire : salaire moyen 3 mois ÷ (heures/semaine × 52/12) ; 38 h 40 pour Théo, 35 h par défaut (`HEURES_SEMAINE_DEFAUT`).
- Saisie : montant d'abord, puis libellé ; « Entrée » enregistre. Prêts à des proches : DÉPENSE › « Payé pour d'autres ». « Autres revenus » = vrais revenus, jamais un retrait d'épargne.
- Un retrait d'épargne n'est jamais un revenu ; ticket et bilans montrent l'épargne **nette** et une ligne « PRÊTS À DES PROCHES ».
- Jours sans dépense : une charge fixe saisie à la main casse la journée (sauf « Écart … », sans tenir compte des majuscules/accents) ; l'Échéancier jamais ; un jour ne compte qu'une fois terminé.
- Jeu (9.33) : jour sans dépense, événement, saison ou défi de la semaine comptent seulement s'il y a une dépense saisie dans les 7 jours autour ; envie abandonnée +10 XP si mûre, après 7 jours et dès 20 €, 2 par semaine ; défi du mois lancé du 1er au 5 (plafond ≥ 10 % sous le budget) ; « ne cassent pas les séries » = essentiels seulement (depuis le 19/11/2026) ; restes mis de côté 25 XP/mois ; « Budgets tenus » = 3 mois verts.
- Écarté : mettre de côté chaque mois pour les budgets annuels ; regrouper toutes les applis en une grande appli (23/11).

## Agents (4 au plus, propres au Budget)
Méthode de création (la même pour tous les dépôts) : besoin réel → rôle en une phrase → 5 à 8 points de contrôle validés par Théo → interdits (lire/tester, ne rien modifier) → réponse ✅/⚠/« non concerné » avec preuve → quand l'appeler → **essai avec une erreur cachée** dans une copie, consigne corrigée s'il la rate.

| Agent | Rôle | État |
|---|---|---|
| `comptable` | chaque montant juste et partout pareil, le jeu suit les règles | ✅ essai réussi (23/11) |
| `code-donnees` | rien ne casse, aucune saisie perdue, copies 05/06 bonnes | ✅ essai réussi (23/11) |
| `utilisateur` | Théo au téléphone comprend tout du premier coup (captures clair + sombre) | ✅ essai réussi (24/11) |
| `avocat-du-diable` | conteste chaque idée ou gros changement (avant construction, et toute liste d'idées avant de la présenter à Théo) | ✅ essai réussi (24/11) |

| Changement | Qui relit |
|---|---|
| texte ou petit affichage | personne (Claude teste l'écran) |
| nouvel écran ou geste | utilisateur |
| calcul ou jeu | comptable + code-donnees |
| envois, réglages synchronisés, mise à jour | code-donnees |
| gros changement, nouvelle fonction | les 4 |

Théo peut toujours demander « le conseil » (les 4).

## En cours / à faire
- **Transfert de l'appli de Clément, mercredi 25/11/2026** (maintenu, choix de Théo du 24/11) : Clément suit lui-même les étapes sur son compte (fiche de transfert déjà remise à Théo) ; noter tout ce qui bloque. **Préparé le 24/11** : son dépôt 05 contient `reglages.json` + le robot `.github/workflows/mise-a-jour.yml` : il recevra chaque nuit les nouvelles versions de Théo (dont la phase 2) sans rien faire. Après le transfert : mettre à jour `reglages.json` dans SON dépôt si son lien de script change, puis retirer Clément de `commun/personnes.json` (le robot le remplace). Même chose pour Devlin plus tard. Théo n'hébergera plus leurs applis.
- Vidéo tuto du Budget : terminée (nuit du 23/11).
- **Mardi 24/11** : élucider avec Théo la sauvegarde automatique sur le téléphone (voir `IDEES.md`, points 1 et 3).
- Quand on traitera chaque autre appli : y déplacer ses idées gardées dans `archives/CLAUDE_2026-11-23.md` (Versus : fait le 24/11 ; ligues et boss → Compagnie de l'Aube ; Chez moi ; Carnet d'entretien).
- **Fin du tri des applis** : décider avec Théo où ranger `IDEES.md` et `archives/` (le dépôt est public ; pour l'instant ils restent ici, choix de Théo du 24/11).
- **Chantier en cours** : (1) nettoyage **fait en 9.42** (24/11) : le code était déjà propre (presque pas de code mort ni de doublons) ; retiré le mode « appli servie par Apps Script » (`IN_GAS`) et `ACCES_ANTICIPE` ; ajouté `tout.sh` et `releve.js`. Choix : pas de réorganisation du fichier (risque sans gain visible). Reste à retirer `api()` de `Code.js` au prochain déploiement du script. (2) **phase 2, plan validé par Théo le 24/11** : données sur le téléphone + sauvegarde automatique dans le Drive de chacun. Idée centrale : le « moteur téléphone » = le même `Code.js` exécuté dans le téléphone sur une vraie imitation du tableur (pas celle de codeX3 : dates, formules, colonne N, A3, B43:B45 à traiter), Code.js à mettre dans `ASSETS` de sw.js, base de données préfixée par appli. Ordre : 0) prototype de connexion au Drive sur les vrais téléphones (Théo et Clément Android, Devlin iPhone ; appli installée sur l'écran d'accueil chez les trois) → continuer ou arrêter ; 1) moteur ; 2) sauvegarde Drive (compteur de versions, pas l'heure) ; 3) bascule chez Théo en essai (tableur gardé intact) ; 4) Devlin ; 5) Clément (via son robot). Théo d'accord pour créer un projet Google Cloud à son nom (guidé). Durée honnête : 6 à 9 séances, chacune relue par les 4. Gain : surtout pour plus tard (sortir de Google Sheets, condition de la vente).
- Tests : lotX3 vérifie depuis le 23/11 qu'une saisie hors connexion n'est jamais abandonnée (cas H).
