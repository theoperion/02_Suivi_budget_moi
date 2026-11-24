# Idées pour l'appli Budget (non finalisées)

Ce fichier n'est **pas** lu automatiquement : seulement quand Théo le demande. Il ne contient que des idées sur le Budget. Rien ici n'est validé : chaque idée repasse par Théo avant d'être construite.

## 1. Vendre l'appli Budget (en pause)

**Conditions avant de commencer** (décision de Théo, 23/11/2026) :
1. Le projet ne démarre que si l'appli **n'a plus besoin de Google Sheets** (sinon trop compliqué à installer chez un client).
2. Avant toute vente : demander à l'INRAE l'**autorisation de cumul d'activités** (Théo est agent public) ; tout développer sur son temps et son matériel perso.

**Ce qui a été discuté (21-22/11)** :
- Modèle préféré de Théo : **une seule appli à achat unique**, très aboutie et sans bug. Piste : version gratuite (saisie, jauge, budgets) + fonctions à débloquer (jeu, stats avancées, objectifs, export…). À comparer : tout débloquer d'un coup, accès payé à l'année, abonnement.
- Sans Google Sheet : données sur le téléphone + **sauvegarde automatique dans le Google Drive de l'utilisateur** (piste préférée ; chantier de quelques semaines : stockage local, sauvegarde/restauration, export/import). Option « expert » : son propre Google Sheet.
- **Play Store** : même code emballé (quelques jours ; compte ~25 $ une fois ; politique de confidentialité ; commission ~15 % ; nouveaux comptes : ~12 testeurs pendant 14 jours, à vérifier). App Store Apple plus difficile ; iPhone = installation depuis le lien.
- Indispensable au lancement : bouton « Signaler un problème » (diagnostic sans montants ni libellés, avec accord), mises à jour automatiques, installation quasi automatique, batterie de tests.
- Statut : micro-entreprise même pour des ventes uniques ; cotisations ~20 % ; effet possible sur la prime d'activité ; abonnement Claude (~240 €/mois) non déductible. Vérifier taux et seuils auprès de l'URSSAF ou d'un expert-comptable ; Kevin accompagne des micro-entreprises (questions à lui poser).
- Étapes de validation : installation réussie avec Kevin et Clément → 10 inconnus sur la version gratuite → 1re vente → 100 € sur un mois.
- Estimation franche donnée le 22/11 (« ça marche bien », 6 mois) : ~5 000 installations, ~3 % d'acheteurs à ~20 € → ~1 000 € de ventes/mois → **≈ 350–450 € nets/mois** (fourchette 200–1 000 €). Le plus probable : un complément modeste ; un gros succès est rare.
- Motivation de Théo : financer des voyages (100 €/mois ≈ un voyage par an, à suivre dans une tirelire « Voyages ») ; découvrir ce monde ; un revenu en plus si son métier change.
- Se faire connaître : vidéos d'écran sans visage, astuces budget, défis ; régularité ; communautés budget/épargne ; angle « pas développeur, je crée mes applis avec l'IA » et « budget en jeu ». Jamais de faux témoignages ni de « devenez riche ».
- Concurrence : légale, ne rien copier (nom, logo, design) ; vérifier le nom à l'INPI.

**Avis de Théo du 24/11/2026 : pas une bonne idée pour l'instant** (beaucoup d'applis de budget existent déjà, et c'est un gros chantier). Gardé pour mémoire.

**Les trois façons de vendre sans Google Sheets** (bilan du 24/11, après l'essai du mode « données sur ce téléphone », construit en 9.44, voir `moteur.js` et `sauvegarde.js`) :
1. **Appli web vendue avec un code d'accès** (comme aujourd'hui) : pas de store ni de commission ; données sur le téléphone ; sauvegarde dans le Drive de la personne, mais Google n'accorde l'accès qu'1 h : un toucher « Sauvegarder » de temps en temps (ou un export de fichier).
2. **Play Store** (la même appli emballée en vraie application, type Capacitor) : Android sauvegarde tout seul les données de l'appli dans le compte Google de la personne, sans aucun toucher. Le plus confortable ; ~15 % de commission, démarches Google, nouveaux comptes : testeurs pendant 14 jours.
3. **Serveur de synchronisation** (type Firebase) : sauvegarde invisible et plusieurs appareils, mais Théo hébergerait les données de ses clients (coût, responsabilité, vie privée).
Avis donné : pour des inconnus, le Play Store (2) est la meilleure piste, sans être obligatoire.

## 2. Rapport de bugs à distance
Diagnostic sans montants ni libellés envoyé à Théo pour corriger à distance (partir de l'onglet « Rapport de bugs » existant). Utile aussi pour Clément et Devlin après leur transfert, s'ils sont d'accord.

## 3. Une autre solution que Google Sheets pour Clément et Devlin (idée de Théo, 23/11)
Leur laisser le choix : Google Sheet ou un autre stockage (ex. Firebase). Points francs à trancher avant : avec Firebase, c'est Théo qui héberge la base (coût, entretien, et il pourrait techniquement voir leurs montants), alors qu'il a décidé de ne plus héberger leurs applis. Alternative plus cohérente : données sur leur téléphone + sauvegarde dans **leur** Google Drive (la même piste que pour la vente, au point 1). C'est un chantier ponctuel, pas un agent.
