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
| `index.html` | toute l'appli. `const VERSION = '9.41'` |
| `sw.js` | hors connexion. `const CACHE = PREFIXE + 'NN'` : +1 à chaque version |
| `apps-script/Code.js` | le script Google (`VERSION_API` 5.14), `.clasp.json` = script de Théo |
| `commun/personnes.json`, `commun/generer.py` | réglages et fabrication des copies 05/06 (remplacements exacts, s'arrête si un motif manque) |
| `outils/tests/*.js` | tests Playwright avec faux serveur |
| `.claude/agents/` | les agents de relecture (voir plus bas) |

## Publier une version
1. Modifier `index.html` (et `Code.js` si besoin) dans 02 ; monter `VERSION` et `CACHE`.
2. Syntaxe : extraire le `<script>` et `node --check`. Tests (plus bas). Regarder les captures.
3. Relecture par les agents selon le tableau.
4. Commit dans 02, `python3 commun/generer.py` (05 et 06 clonés à côté de 02), commit dans 05/06, pousser les 3 sur `main`.
5. Vérifier GitHub Pages (Actions « pages build and deployment » ; si bloqué en « queued », pousser un petit commit).
- **Script Google** (seulement si `Code.js` change) : monter `VERSION_API`, puis `clasp push` + `clasp deploy -i <id>` pour chacun (adresse inchangée ; `clasp login --no-localhost` avec le compte de Théo). Id de Théo : `AKfycbzdbw1TzpRU16ftWHzSf04CE_Y6lfvfH08uuHF1na_uz97gCLdYr5fylt8F_QvUQBwRzQ` ; les autres dans `commun/personnes.json`. Migration « une seule fois » = drapeau dans les propriétés du script.

## Tests
- `node outils/tests/<lot>.js <dossier de l'appli> [captures]` (Playwright global, pas de npm). lotX1 chiffres, lotX2/X4/X5 jeu, lotX3 envois, `codeX3.js` Code.js dans Node, `g3ui.js` interface (« TOUT VERT »), `jeu*.js` prennent le chemin d'`index.html`.
- Attendu : « VERDICT: OK » et **« ERREURS JS: aucune »**. Jamais contre le vrai serveur (bloqué dans le cloud).
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
| utilisateur | Théo au téléphone comprend tout du premier coup | à définir avec Théo (remplacera `conseil-ergonomie`) |
| avocat du diable | conteste les gros changements | à définir avec Théo (remplacera `conseil-avocat-du-diable`) |

| Changement | Qui relit |
|---|---|
| texte ou petit affichage | personne (Claude teste l'écran) |
| nouvel écran ou geste | utilisateur |
| calcul ou jeu | comptable + code-donnees |
| envois, réglages synchronisés, mise à jour | code-donnees |
| gros changement, nouvelle fonction | les 4 |

Théo peut toujours demander « le conseil » (les 4).

## En cours / à faire
- **Transfert de l'appli de Clément, mercredi 25/11/2026** : Clément suit lui-même les étapes sur son compte (fiche de transfert déjà remise à Théo) ; noter tout ce qui bloque. Ensuite retirer Clément de `commun/personnes.json` et adapter `generer.py`. Même chose pour Devlin plus tard. Théo n'hébergera plus leurs applis.
- Définir avec Théo les agents « utilisateur » et « avocat du diable », puis supprimer `conseil-ergonomie` et `conseil-avocat-du-diable`.
- Vidéo tuto du Budget : terminée (nuit du 23/11).
