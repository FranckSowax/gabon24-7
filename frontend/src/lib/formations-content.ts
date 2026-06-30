// Contenu pédagogique — Niveau 1 « Fondamentaux »
// Jeu de démarrage : 5 modules (cours markdown) + QCM. Contexte gabonais (FCFA, OHADA…).
// Sert aussi de source de seed pour la Phase 2 (tables formation_courses / quizzes).

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface FormationModule {
  id: string
  level: number
  order: number
  title: string
  summary: string
  durationMin: number
  content: string // markdown léger (#, ##, -, **gras**)
  quiz: { passScore: number; questions: QuizQuestion[] }
}

export const LEVEL1_MODULES: FormationModule[] = [
  {
    id: 'n1-m1-idee-marche',
    level: 1,
    order: 1,
    title: 'Valider son idée & son marché',
    summary: 'Vérifier qu\'un vrai besoin existe avant d\'investir le moindre franc.',
    durationMin: 25,
    content: `# Valider son idée & son marché

La première erreur de l'entrepreneur débutant est de **tomber amoureux de son idée** au lieu de tomber amoureux du **problème** de ses clients. Une bonne affaire commence toujours par un besoin réel et un client prêt à payer.

## 1. Partir d'un problème, pas d'un produit
Demandez-vous : *quel problème concret est-ce que je résous, et pour qui ?*
- Mauvais : « Je veux ouvrir un restaurant. »
- Bon : « Les employés du quartier Glass à Libreville n'ont pas de déjeuner sain et rapide à moins de 2 000 FCFA. »

## 2. Définir son client cible
Décrivez précisément **une seule** personne type : où vit-elle, combien gagne-t-elle, qu'achète-t-elle déjà ? Un projet pour « tout le Gabon » est un projet pour personne.

## 3. L'étude de marché de terrain
Pas besoin de cabinet : allez parler à **10 à 20 clients potentiels**.
- Observez les marchés (Mont-Bouët, Nkembo…) et les commerces qui marchent déjà.
- Posez des questions ouvertes : « Comment faites-vous aujourd'hui ? Combien dépensez-vous ? »
- **Ne vendez pas encore** : écoutez.

## 4. Tester avant d'investir
Lancez une **version minimale** : quelques produits, une page WhatsApp Business, une vente test au marché. Si personne n'achète à petite échelle, le problème ne disparaîtra pas en grand.

## 5. Regarder la concurrence
S'il existe déjà des concurrents, **c'est bon signe** : le marché existe. La question devient : *qu'est-ce que je fais mieux, moins cher, ou plus pratique ?*

> 🟢 À retenir : un projet validé = un problème réel + un client identifié + une preuve que des gens veulent payer.`,
    quiz: {
      passScore: 70,
      questions: [
        {
          question: 'Par quoi doit commencer une bonne idée de business ?',
          options: ['Un beau logo', 'Un problème réel vécu par des clients', 'Un local bien situé', 'Un financement'],
          correctIndex: 1,
          explanation: 'On part toujours d\'un problème réel et d\'un client prêt à payer, pas du produit.',
        },
        {
          question: 'Que vaut-il mieux faire pour une étude de marché quand on débute ?',
          options: ['Payer un cabinet cher', 'Aller parler directement à 10–20 clients potentiels', 'Attendre d\'avoir le financement', 'Copier exactement un concurrent'],
          correctIndex: 1,
          explanation: 'Le terrain (parler aux clients, observer les marchés) est gratuit et bien plus fiable au démarrage.',
        },
        {
          question: 'Cibler « tout le Gabon » est…',
          options: ['Une bonne stratégie', 'Trop vague : un projet pour tout le monde est un projet pour personne', 'Obligatoire pour la BCEG', 'Recommandé au niveau 1'],
          correctIndex: 1,
          explanation: 'Il faut définir précisément UN client cible pour bien répondre à son besoin.',
        },
        {
          question: 'Avoir des concurrents sur son marché signifie souvent…',
          options: ['Qu\'il faut abandonner', 'Que le marché existe et qu\'il faut se différencier', 'Qu\'on ne gagnera jamais d\'argent', 'Qu\'il faut baisser ses prix à perte'],
          correctIndex: 1,
          explanation: 'La présence de concurrents prouve une demande ; la clé est de faire mieux / moins cher / plus pratique.',
        },
      ],
    },
  },
  {
    id: 'n1-m2-modele-eco',
    level: 1,
    order: 2,
    title: 'Le modèle économique (comment gagner de l\'argent)',
    summary: 'Prix, coûts, marge : comprendre comment l\'activité devient rentable.',
    durationMin: 25,
    content: `# Le modèle économique

Un modèle économique répond à une question simple : **comment l'argent entre, et combien il en reste ?**

## 1. Le prix de vente
Le prix ne se fixe pas « au feeling ». Trois repères :
- **Le coût** : combien me coûte chaque unité ?
- **La concurrence** : à combien vendent les autres ?
- **La valeur perçue** : combien le client est prêt à payer ?

## 2. La marge, le vrai nerf de la guerre
**Marge = Prix de vente − Coût d'achat/production.**

Exemple — vente de jus naturels :
- Coût par bouteille (fruits, bouteille, transport) : **400 FCFA**
- Prix de vente : **1 000 FCFA**
- **Marge brute : 600 FCFA par bouteille** (60 %).

Si vous vendez 50 bouteilles/jour : 50 × 600 = **30 000 FCFA de marge/jour**.

## 3. Couvrir ses charges fixes
Les charges fixes tombent même si vous ne vendez rien : loyer, électricité, salaire, forfait.
- Charges fixes du mois : **300 000 FCFA**
- Marge par bouteille : **600 FCFA**
- **Point mort = 300 000 ÷ 600 = 500 bouteilles/mois** pour ne rien perdre.

## 4. Diversifier (avec prudence)
Plusieurs sources de revenus stabilisent l'activité (vente sur place + livraison + grosses commandes événements). Mais au début, **faites une chose bien** avant de multiplier.

> 🟢 À retenir : connaître sa marge et son point mort, c'est savoir si l'activité est viable.`,
    quiz: {
      passScore: 70,
      questions: [
        {
          question: 'Comment se calcule la marge brute ?',
          options: ['Prix de vente + coût', 'Prix de vente − coût d\'achat/production', 'Chiffre d\'affaires × 2', 'Coût ÷ prix'],
          correctIndex: 1,
          explanation: 'Marge brute = Prix de vente − Coût. C\'est ce qui reste avant les charges fixes.',
        },
        {
          question: 'Charges fixes 300 000 FCFA/mois, marge de 600 FCFA par unité. Quel est le point mort ?',
          options: ['300 unités', '500 unités', '600 unités', '1 000 unités'],
          correctIndex: 1,
          explanation: '300 000 ÷ 600 = 500 unités à vendre pour couvrir les charges fixes.',
        },
        {
          question: 'Un prix de vente devrait tenir compte de…',
          options: ['Uniquement du coût', 'Uniquement des concurrents', 'Du coût, de la concurrence ET de la valeur perçue', 'De l\'humeur du jour'],
          correctIndex: 2,
          explanation: 'Les trois repères ensemble donnent un prix juste et rentable.',
        },
        {
          question: 'Au démarrage, vaut-il mieux…',
          options: ['Multiplier tout de suite les activités', 'Faire une chose bien avant de diversifier', 'Vendre à perte pour attirer', 'Ignorer les charges fixes'],
          correctIndex: 1,
          explanation: 'La concentration au départ évite la dispersion ; on diversifie une fois la base solide.',
        },
      ],
    },
  },
  {
    id: 'n1-m3-gestion-tresorerie',
    level: 1,
    order: 3,
    title: 'Bases de gestion & trésorerie (FCFA)',
    summary: 'Séparer l\'argent perso et pro, suivre les entrées/sorties, éviter la panne de caisse.',
    durationMin: 30,
    content: `# Bases de gestion & trésorerie

Beaucoup d'activités rentables **ferment quand même** : elles manquent de cash au mauvais moment. La trésorerie, c'est l'oxygène du business.

## 1. Séparer l'argent perso et l'argent du business
La règle d'or n°1. Ouvrez un **compte (ou un Mobile Money) dédié** à l'activité. Versez-vous un **salaire fixe** au lieu de piocher dans la caisse.

## 2. Tout noter : entrées et sorties
Un simple cahier ou un tableur suffit pour commencer :
- **Entrées** : ventes, acomptes.
- **Sorties** : achats, loyer, transport, forfait, salaires.

Sans suivi, on croit gagner de l'argent alors qu'on en perd.

## 3. Trésorerie ≠ bénéfice
- Le **bénéfice** se calcule sur une période (mois, année).
- La **trésorerie** = l'argent **disponible aujourd'hui** en caisse/compte.

On peut être bénéficiaire mais en panne de caisse (ex. clients qui paient en retard, stock acheté trop tôt).

## 4. Anticiper les trous de caisse
- Gardez un **matelas de sécurité** (idéalement 1 mois de charges).
- Méfiez-vous des **ventes à crédit** : facturez des acomptes.
- Achetez le stock selon les ventes réelles, pas « au cas où ».

## 5. Calculer son résultat simplement
**Résultat = Total entrées − Total sorties.** Faites ce calcul **chaque mois** : c'est votre tableau de bord.

> 🟢 À retenir : on ne gère bien que ce qu'on mesure. Notez tout, séparez perso/pro, surveillez le cash.`,
    quiz: {
      passScore: 70,
      questions: [
        {
          question: 'Quelle est la règle d\'or n°1 de la gestion ?',
          options: ['Vendre le plus cher possible', 'Séparer l\'argent personnel de l\'argent du business', 'Ne jamais épargner', 'Tout payer en espèces'],
          correctIndex: 1,
          explanation: 'Séparer perso/pro (compte ou Mobile Money dédié + salaire fixe) est la base de toute gestion saine.',
        },
        {
          question: 'La trésorerie, c\'est…',
          options: ['Le bénéfice de l\'année', 'L\'argent réellement disponible aujourd\'hui', 'Le chiffre d\'affaires', 'La valeur du stock'],
          correctIndex: 1,
          explanation: 'La trésorerie est le cash disponible maintenant ; on peut être rentable mais à court de trésorerie.',
        },
        {
          question: 'Peut-on être bénéficiaire et en panne de caisse ?',
          options: ['Non, jamais', 'Oui (ex. clients qui paient en retard, stock acheté trop tôt)', 'Seulement les grandes entreprises', 'Uniquement en cas de vol'],
          correctIndex: 1,
          explanation: 'Bénéfice et trésorerie sont deux choses différentes : les décalages de paiement créent des trous de caisse.',
        },
        {
          question: 'Bonne pratique face aux ventes à crédit ?',
          options: ['Tout vendre à crédit', 'Demander des acomptes et limiter le crédit', 'Ne jamais facturer', 'Acheter plus de stock'],
          correctIndex: 1,
          explanation: 'Les acomptes protègent la trésorerie ; le crédit non maîtrisé est une cause fréquente de faillite.',
        },
      ],
    },
  },
  {
    id: 'n1-m4-formalites',
    level: 1,
    order: 4,
    title: 'Se mettre en règle : RCCM, NIF, OHADA',
    summary: 'Les démarches de base pour être une entreprise officielle au Gabon.',
    durationMin: 20,
    content: `# Se mettre en règle au Gabon

Être formalisé ouvre des portes : **compte bancaire pro, marchés, et surtout financement** (la BCEG demande une entreprise en règle).

## 1. Choisir son statut
- **Entreprise individuelle** : simple, rapide, idéale pour démarrer seul.
- **Société (SARL / SAS sous OHADA)** : pour s'associer, protéger son patrimoine, grandir.

Le droit des affaires au Gabon suit les **Actes uniformes OHADA** (communs à 17 pays africains).

## 2. Les démarches clés
- **RCCM** (Registre du Commerce et du Crédit Mobilier) : l'immatriculation officielle de l'entreprise, via l'**ANPI-Gabon** (guichet unique).
- **NIF** (Numéro d'Identification Fiscale) auprès de la **DGI** : indispensable pour facturer et payer ses impôts.
- **CNSS** : dès que vous avez des salariés, déclaration et cotisations sociales.

## 3. Facturer correctement
Une facture en règle mentionne : nom de l'entreprise, RCCM, NIF, date, détail, montant en **FCFA**, et coordonnées. C'est exigé pour les clients sérieux et les administrations.

## 4. Pourquoi se formaliser tôt
- Accès au **financement** (BCEG, banques) et aux **appels d'offres**.
- **Crédibilité** auprès des fournisseurs et clients.
- Éviter les **sanctions** et travailler sereinement.

> 🟢 À retenir : RCCM + NIF = la base. C'est souvent la condition d'entrée pour demander un financement.`,
    quiz: {
      passScore: 70,
      questions: [
        {
          question: 'Que désigne le RCCM ?',
          options: ['Un impôt mensuel', 'L\'immatriculation officielle de l\'entreprise au registre du commerce', 'Un compte Mobile Money', 'Une assurance'],
          correctIndex: 1,
          explanation: 'Le RCCM est l\'immatriculation de l\'entreprise (via l\'ANPI-Gabon, guichet unique).',
        },
        {
          question: 'À quoi sert le NIF ?',
          options: ['À ouvrir un marché', 'À s\'identifier fiscalement (facturer, payer ses impôts)', 'À recruter', 'À importer'],
          correctIndex: 1,
          explanation: 'Le NIF (DGI) est le numéro d\'identification fiscale, indispensable pour facturer légalement.',
        },
        {
          question: 'Le droit des affaires applicable au Gabon repose sur…',
          options: ['Le code Napoléon', 'Les Actes uniformes OHADA', 'La loi américaine', 'Aucune règle'],
          correctIndex: 1,
          explanation: 'Le Gabon est membre de l\'OHADA ; les Actes uniformes régissent le droit des affaires.',
        },
        {
          question: 'Pourquoi se formaliser tôt est utile pour le financement ?',
          options: ['Ça ne sert à rien', 'Une entreprise en règle (RCCM/NIF) est souvent exigée pour demander un financement', 'Ça augmente les impôts uniquement', 'Ça empêche de vendre'],
          correctIndex: 1,
          explanation: 'Les financeurs (dont la BCEG) demandent une entreprise formalisée : c\'est la porte d\'entrée.',
        },
      ],
    },
  },
  {
    id: 'n1-m5-vendre-clients',
    level: 1,
    order: 5,
    title: 'Vendre & trouver ses premiers clients',
    summary: 'Proposition de valeur, canaux (WhatsApp, marché), Mobile Money, fidélisation.',
    durationMin: 25,
    content: `# Vendre & trouver ses premiers clients

Une entreprise sans clients n'est qu'un projet. Vendre s'apprend, et au Gabon, **WhatsApp et le bouche-à-oreille** sont des armes redoutables — gratuites.

## 1. Clarifier sa proposition de valeur
En une phrase : *pour [client], je résous [problème] grâce à [solution], mieux que [alternative].*
Exemple : « Pour les bureaux de Libreville, je livre un déjeuner sain en 30 min, moins cher qu'un resto. »

## 2. Choisir ses canaux
- **WhatsApp Business** : catalogue, réponses rapides, statut pour montrer les produits.
- **Le terrain** : marchés, quartiers, événements.
- **Le bouche-à-oreille** : un client satisfait en amène 3. Demandez-le.

## 3. Faciliter le paiement
Acceptez **Airtel Money / Moov Money** en plus des espèces. Un paiement facile = plus de ventes. Envoyez une confirmation après chaque commande.

## 4. Le premier client est le plus dur
- Proposez une **offre de lancement** limitée.
- Donnez un **échantillon** ou une démonstration.
- Soignez **excessivement** vos 10 premiers clients : ce sont vos ambassadeurs.

## 5. Fidéliser coûte moins cher que prospecter
Un client qui revient rapporte plus et coûte moins. Gardez le contact (liste WhatsApp), récompensez la fidélité, et **demandez des avis**.

> 🟢 À retenir : proposition de valeur claire + canaux simples (WhatsApp/terrain) + paiement Mobile Money + soin des premiers clients = premières ventes.`,
    quiz: {
      passScore: 70,
      questions: [
        {
          question: 'Une bonne proposition de valeur précise…',
          options: ['Le logo et les couleurs', 'Pour qui, quel problème, quelle solution, mieux que quelle alternative', 'Le nombre d\'employés', 'Le capital social'],
          correctIndex: 1,
          explanation: 'La proposition de valeur relie client + problème + solution + différenciation.',
        },
        {
          question: 'Quel canal gratuit et puissant pour vendre au Gabon ?',
          options: ['La télévision nationale', 'WhatsApp Business et le bouche-à-oreille', 'Les panneaux d\'autoroute', 'La radio FM payante'],
          correctIndex: 1,
          explanation: 'WhatsApp Business + bouche-à-oreille sont gratuits et très efficaces localement.',
        },
        {
          question: 'Pourquoi accepter Airtel Money / Moov Money ?',
          options: ['Pour compliquer', 'Parce qu\'un paiement facile augmente les ventes', 'Pour éviter de facturer', 'Ce n\'est pas utile'],
          correctIndex: 1,
          explanation: 'Faciliter le paiement (Mobile Money) lève un frein à l\'achat et augmente les ventes.',
        },
        {
          question: 'Que faire de ses 10 premiers clients ?',
          options: ['Les ignorer', 'Les soigner excessivement : ce sont les ambassadeurs', 'Leur vendre plus cher', 'Les oublier après la vente'],
          correctIndex: 1,
          explanation: 'Les premiers clients satisfaits génèrent le bouche-à-oreille et la fidélité.',
        },
      ],
    },
  },
]

export const LEVEL2_MODULES: FormationModule[] = [
  {
    id: 'n2-m1-comptabilite',
    level: 2,
    order: 1,
    title: 'Comptabilité & pilotage par les chiffres',
    summary: 'Lire ses chiffres pour décider : compte de résultat, marge, indicateurs clés.',
    durationMin: 30,
    content: `# Comptabilité & pilotage par les chiffres

Au niveau 1, vous notiez entrées et sorties. Au niveau 2, vous **pilotez** : les chiffres deviennent une boussole de décision.

## 1. Le compte de résultat (simplifié)
Sur une période (mois/an) :
- **Chiffre d'affaires (CA)** = total des ventes.
- **− Coûts variables** (achats, matières) = **Marge brute**.
- **− Charges fixes** (loyer, salaires, énergie) = **Résultat**.

## 2. Les indicateurs à suivre chaque mois
- **Taux de marge** = Marge brute ÷ CA. Permet de comparer dans le temps.
- **Panier moyen** = CA ÷ nombre de ventes.
- **Trésorerie nette** = ce qui reste réellement disponible.

## 3. Le plan comptable OHADA
Les entreprises au Gabon suivent le **SYSCOHADA**. Pas besoin d'être expert : tenez des comptes propres et faites-vous accompagner d'un comptable pour les déclarations.

## 4. Décider grâce aux chiffres
- Marge qui baisse ? → renégocier les achats ou revoir les prix.
- Un produit qui ne dégage aucune marge ? → l'arrêter ou le retravailler.
- Trop de charges fixes ? → ajuster avant la crise de trésorerie.

> 🟢 À retenir : la comptabilité n'est pas une corvée administrative, c'est votre tableau de bord de décision.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Comment obtient-on la marge brute ?', options: ['CA + charges fixes', 'CA − coûts variables', 'CA × 2', 'Résultat − impôts'], correctIndex: 1, explanation: 'Marge brute = Chiffre d\'affaires − coûts variables (achats/matières).' },
        { question: 'Le taux de marge se calcule par…', options: ['Marge brute ÷ CA', 'CA ÷ marge', 'Charges ÷ CA', 'CA × marge'], correctIndex: 0, explanation: 'Taux de marge = Marge brute ÷ CA ; il se suit dans le temps.' },
        { question: 'Quel référentiel comptable s\'applique au Gabon ?', options: ['Le PCG français', 'Le SYSCOHADA', 'Les US GAAP', 'Aucun'], correctIndex: 1, explanation: 'Les entreprises OHADA, dont le Gabon, appliquent le SYSCOHADA.' },
        { question: 'À quoi sert le pilotage par les chiffres ?', options: ['À remplir des papiers', 'À décider (prix, achats, arrêt d\'un produit)', 'À payer plus d\'impôts', 'À rien'], correctIndex: 1, explanation: 'Les chiffres guident les décisions : prix, coûts, gamme, trésorerie.' },
      ],
    },
  },
  {
    id: 'n2-m2-business-plan',
    level: 2,
    order: 2,
    title: 'Business plan complet & prévisionnel',
    summary: 'Construire un dossier crédible et un prévisionnel chiffré pour convaincre.',
    durationMin: 35,
    content: `# Business plan complet & prévisionnel

Le business plan raconte **où vous allez et comment**, avec des chiffres. C'est le document clé pour un financement BCEG.

## 1. Les sections essentielles
- **Résumé** (le projet en 1 page).
- **Problème & solution**, **marché & cible**.
- **Offre & modèle économique**.
- **Stratégie commerciale**.
- **Équipe**.
- **Prévisionnel financier**.

## 2. Le prévisionnel financier
Sur 12 à 36 mois :
- **Prévision de ventes** (réaliste, justifiée).
- **Compte de résultat prévisionnel** (CA − coûts − charges).
- **Plan de trésorerie** mois par mois.
- **Plan de financement** : besoins (matériel, stock, fonds de roulement) et ressources (apport, prêt).

## 3. Des hypothèses réalistes
Un prévisionnel trop optimiste détruit la crédibilité. Justifiez chaque chiffre (« 20 ventes/jour car le marché voisin en fait 30 »). Prévoyez un scénario prudent.

## 4. Le besoin en fonds de roulement (BFR)
C'est l'argent immobilisé pour fonctionner (stock + créances clients − dettes fournisseurs). Beaucoup de financements servent à couvrir le BFR, pas seulement le matériel.

> 🟢 À retenir : un bon business plan = une histoire claire + des chiffres réalistes et justifiés.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Le prévisionnel financier couvre généralement…', options: ['1 semaine', '12 à 36 mois', '10 ans précis', 'La journée'], correctIndex: 1, explanation: 'On projette typiquement sur 12 à 36 mois (ventes, résultat, trésorerie).' },
        { question: 'Qu\'est-ce que le BFR ?', options: ['Un impôt', 'L\'argent immobilisé pour fonctionner (stock + créances − dettes fournisseurs)', 'Le bénéfice net', 'Le capital social'], correctIndex: 1, explanation: 'Le besoin en fonds de roulement finance le cycle d\'exploitation.' },
        { question: 'Un prévisionnel trop optimiste…', options: ['Rassure toujours le financeur', 'Détruit la crédibilité du dossier', 'Est obligatoire', 'N\'a aucun effet'], correctIndex: 1, explanation: 'Des hypothèses irréalistes décrédibilisent ; mieux vaut justifier et rester prudent.' },
        { question: 'Quelle section ouvre un business plan ?', options: ['Le prévisionnel', 'Le résumé (projet en 1 page)', 'Les annexes', 'La conclusion'], correctIndex: 1, explanation: 'Le résumé synthétise le projet et donne envie de lire la suite.' },
      ],
    },
  },
  {
    id: 'n2-m3-marketing',
    level: 2,
    order: 3,
    title: 'Marketing digital & acquisition',
    summary: 'Attirer des clients en continu : contenu, réseaux, WhatsApp, fidélisation.',
    durationMin: 25,
    content: `# Marketing digital & acquisition

Au niveau 2, on passe du bouche-à-oreille à une **machine à clients** régulière.

## 1. Le tunnel d'acquisition
- **Attirer** (contenu, pub, réseaux).
- **Convertir** (offre claire, preuve sociale, paiement facile).
- **Fidéliser** (suivi, relances, programme de fidélité).

## 2. Les canaux qui marchent au Gabon
- **WhatsApp Business** : catalogue, listes de diffusion, statut quotidien.
- **Facebook / TikTok** : vidéos courtes des produits, avant/après, témoignages.
- **Google / fiche établissement** pour être trouvé localement.

## 3. Le contenu qui vend
Montrez le produit en situation, les clients satisfaits, les coulisses. Publiez **régulièrement** (mieux vaut 3 posts utiles/semaine que 10 d'un coup puis plus rien).

## 4. Mesurer pour progresser
- **Coût d'acquisition client (CAC)** : combien dépensé pour gagner 1 client.
- **Taux de conversion** : visiteurs → acheteurs.
- Doublez ce qui marche, coupez ce qui ne marche pas.

> 🟢 À retenir : un marketing efficace = un tunnel clair + des canaux adaptés + de la régularité + des mesures.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Quelles sont les 3 étapes d\'un tunnel d\'acquisition ?', options: ['Acheter, stocker, jeter', 'Attirer, convertir, fidéliser', 'Produire, exporter, taxer', 'Recruter, former, licencier'], correctIndex: 1, explanation: 'Attirer → convertir → fidéliser structure l\'acquisition.' },
        { question: 'Le CAC désigne…', options: ['Le chiffre d\'affaires', 'Le coût pour acquérir un client', 'La caisse', 'Le capital'], correctIndex: 1, explanation: 'CAC = coût d\'acquisition client ; à comparer à ce que rapporte le client.' },
        { question: 'Pour le contenu, mieux vaut…', options: ['Publier 10 fois puis disparaître', 'Publier régulièrement (ex. 3 fois/semaine)', 'Ne jamais publier', 'Copier les concurrents'], correctIndex: 1, explanation: 'La régularité bat les pics ponctuels pour la visibilité.' },
        { question: 'Un bon réflexe d\'analyse marketing ?', options: ['Tout garder identique', 'Doubler ce qui marche, couper ce qui ne marche pas', 'Ignorer les chiffres', 'Augmenter les prix au hasard'], correctIndex: 1, explanation: 'On optimise en renforçant ce qui performe et en coupant le reste.' },
      ],
    },
  },
  {
    id: 'n2-m4-equipe',
    level: 2,
    order: 4,
    title: 'Gestion d\'équipe & organisation',
    summary: 'Recruter, déléguer, organiser le travail sans tout porter seul.',
    durationMin: 25,
    content: `# Gestion d'équipe & organisation

Une activité qui grandit ne peut plus reposer sur une seule personne. Savoir **déléguer** est une compétence d'entrepreneur.

## 1. Recruter la bonne personne
- Définissez le **besoin réel** avant de recruter (quelles tâches ?).
- Recrutez d'abord sur l'**attitude et la fiabilité**, formez ensuite le métier.
- Commencez petit : stage, temps partiel, prestation.

## 2. Cadrer le travail
- Des **rôles clairs** : qui fait quoi.
- Des **procédures simples** pour les tâches répétitives (ouverture, caisse, livraison).
- Des objectifs mesurables.

## 3. Le cadre légal (rappel)
Dès l'embauche : **contrat**, déclaration **CNSS**, respect du droit du travail gabonais. Cela protège l'entreprise comme le salarié.

## 4. Motiver et fidéliser
Un bon salaire ne suffit pas : reconnaissance, perspectives, bonne ambiance. Un turnover élevé coûte cher (recrutement + formation à refaire).

> 🟢 À retenir : déléguer avec des rôles clairs et un cadre légal permet à l'entreprise de grandir sans s'effondrer.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Sur quoi recruter en priorité au démarrage ?', options: ['Le diplôme le plus élevé', 'L\'attitude et la fiabilité (former le métier ensuite)', 'Le lien familial', 'Le plus bas salaire'], correctIndex: 1, explanation: 'L\'attitude/fiabilité prime ; les compétences techniques s\'acquièrent.' },
        { question: 'Quelle déclaration sociale à l\'embauche au Gabon ?', options: ['Aucune', 'La CNSS', 'Le RCCM', 'Le NIF'], correctIndex: 1, explanation: 'L\'employeur déclare le salarié et cotise à la CNSS.' },
        { question: 'Pour les tâches répétitives, il faut…', options: ['Tout improviser', 'Des procédures simples', 'Tout faire soi-même', 'Ne rien noter'], correctIndex: 1, explanation: 'Des procédures claires rendent l\'organisation reproductible et délégable.' },
        { question: 'Un turnover élevé…', options: ['Est gratuit', 'Coûte cher (recruter et former à nouveau)', 'Améliore la marge', 'Est sans impact'], correctIndex: 1, explanation: 'Remplacer et reformer coûte du temps et de l\'argent.' },
      ],
    },
  },
  {
    id: 'n2-m5-achats-stocks',
    level: 2,
    order: 5,
    title: 'Fournisseurs, stocks & marges',
    summary: 'Négocier, gérer ses stocks et protéger ses marges.',
    durationMin: 25,
    content: `# Fournisseurs, stocks & marges

Acheter mieux et gérer son stock, c'est gagner de l'argent **sans vendre plus**.

## 1. Négocier ses achats
- Comparez **plusieurs fournisseurs**.
- Négociez **volume, délai de paiement, qualité constante**.
- Sécurisez au moins **deux sources** pour ne pas dépendre d'un seul.

## 2. Gérer le stock
- **Trop de stock** = argent immobilisé + risque de perte (péremption, invendus).
- **Pas assez** = ruptures et ventes perdues.
- Suivez les **ventes réelles** pour réapprovisionner au bon moment.

## 3. Protéger sa marge
- Recalculez vos prix quand les coûts augmentent (carburant, change, transport).
- Surveillez la **casse, le vol, les remises** non maîtrisées.
- Distinguez produits **à forte marge** et produits **d'appel**.

## 4. Le cas de l'import
Beaucoup de produits sont importés : intégrez **transport, douane, taux de change** dans le coût de revient réel, sinon la marge est une illusion.

> 🟢 À retenir : la marge se gagne aussi à l'achat et dans le stock, pas seulement à la vente.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Pourquoi sécuriser deux fournisseurs ?', options: ['Pour payer plus cher', 'Pour ne pas dépendre d\'une seule source', 'Pour compliquer', 'C\'est interdit'], correctIndex: 1, explanation: 'Deux sources réduisent le risque de rupture et renforcent la négociation.' },
        { question: 'Un stock trop important…', options: ['Est toujours bon', 'Immobilise de l\'argent et risque la perte', 'Augmente la marge', 'N\'a pas d\'effet'], correctIndex: 1, explanation: 'Le surstock immobilise du cash et expose aux invendus/péremption.' },
        { question: 'Quand les coûts augmentent, il faut…', options: ['Garder le même prix coûte que coûte', 'Recalculer et ajuster ses prix', 'Vendre à perte', 'Arrêter de vendre'], correctIndex: 1, explanation: 'Sans ajustement, la hausse des coûts détruit la marge.' },
        { question: 'Pour un produit importé, le coût de revient inclut…', options: ['Seulement le prix d\'achat', 'Transport, douane et taux de change', 'Rien de plus', 'Uniquement la TVA'], correctIndex: 1, explanation: 'Transport, douane et change font partie du coût réel à l\'import.' },
      ],
    },
  },
]

export const LEVEL3_MODULES: FormationModule[] = [
  {
    id: 'n3-m1-levee-fonds',
    level: 3,
    order: 1,
    title: 'Préparer une levée de fonds',
    summary: 'Comprendre les types de financement et préparer un dossier solide.',
    durationMin: 30,
    content: `# Préparer une levée de fonds

Changer d'échelle demande souvent des capitaux. Encore faut-il choisir le **bon type de financement** et être **prêt**.

## 1. Les types de financement
- **Dette** (prêt bancaire, BCEG) : à rembourser avec intérêts ; vous gardez le contrôle.
- **Capital** (investisseur) : argent contre une part de l'entreprise ; pas de remboursement mais dilution.
- **Subventions / concours** : non remboursables, très sélectifs.

## 2. Combien lever, pour quoi ?
Demandez un montant **justifié** par un plan d'emploi des fonds précis (matériel, BFR, recrutement, marketing). Trop peu = on s'arrête en route ; trop = on dilue ou on s'endette inutilement.

## 3. Être "investment ready"
- Comptes propres et à jour.
- Business plan + prévisionnel crédibles.
- Entreprise formalisée (RCCM, NIF) et en règle.
- Indicateurs de traction (ventes, clients, croissance).

## 4. Les ratios que regarde un financeur
- **Capacité de remboursement** (le projet génère-t-il assez de cash ?).
- **Apport personnel** (engagement du porteur).
- **Garanties** éventuelles.

> 🟢 À retenir : on ne "demande pas de l'argent", on présente un projet finançable, chiffré et prêt.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'La dette (prêt) implique…', options: ['De céder des parts', 'Un remboursement avec intérêts, sans céder le contrôle', 'Aucune obligation', 'Une subvention'], correctIndex: 1, explanation: 'Le prêt se rembourse avec intérêts mais ne dilue pas le capital.' },
        { question: 'Le financement en capital signifie…', options: ['Un prêt à rembourser', 'De l\'argent contre une part de l\'entreprise (dilution)', 'Une avance fournisseur', 'Un impôt'], correctIndex: 1, explanation: 'L\'investisseur entre au capital ; pas de remboursement mais dilution.' },
        { question: 'Être "investment ready", c\'est notamment…', options: ['Avoir des comptes propres, un BP crédible, être en règle', 'Avoir un beau logo', 'Promettre des chiffres énormes', 'Cacher ses chiffres'], correctIndex: 0, explanation: 'Comptes à jour, dossier crédible et entreprise formalisée rassurent le financeur.' },
        { question: 'Un financeur regarde surtout…', options: ['La couleur du logo', 'La capacité de remboursement et l\'apport', 'Le nombre d\'abonnés', 'L\'ancienneté du gérant uniquement'], correctIndex: 1, explanation: 'Capacité à générer du cash, apport et garanties sont déterminants.' },
      ],
    },
  },
  {
    id: 'n3-m2-croissance',
    level: 3,
    order: 2,
    title: 'Stratégie de croissance & scaling',
    summary: 'Passer de "ça marche" à "ça grandit" sans casser la machine.',
    durationMin: 25,
    content: `# Stratégie de croissance & scaling

Grandir n'est pas juste "vendre plus" : c'est **répéter ce qui marche** de façon rentable et maîtrisée.

## 1. Trouver son moteur de croissance
Identifiez le **levier principal** : plus de points de vente ? livraison ? nouveaux produits ? nouvelle ville ? Concentrez les efforts sur le levier le plus rentable.

## 2. Standardiser avant de dupliquer
On ne duplique bien que ce qui est **standardisé** : procédures, recettes, formation. Sinon la qualité chute en grandissant.

## 3. Les pièges du scaling
- Grandir trop vite **sans trésorerie** (croissance = besoin de cash).
- Perdre la **qualité** et la relation client.
- Recruter sans organisation.

## 4. Mesurer la croissance saine
Une croissance saine garde une **marge** correcte et une **trésorerie** maîtrisée. Croître en perdant de l'argent à chaque vente n'est pas grandir, c'est couler plus vite.

> 🟢 À retenir : scaler = standardiser + financer la croissance + préserver marge et qualité.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Avant de dupliquer une activité, il faut…', options: ['Tout improviser', 'La standardiser (procédures, formation)', 'Baisser la qualité', 'Licencier'], correctIndex: 1, explanation: 'On ne duplique bien que ce qui est standardisé et documenté.' },
        { question: 'Un piège classique du scaling ?', options: ['Trop de trésorerie', 'Grandir trop vite sans cash', 'Trop de procédures', 'Trop de clients fidèles'], correctIndex: 1, explanation: 'La croissance consomme du cash : grandir sans trésorerie est dangereux.' },
        { question: 'Une croissance saine préserve…', options: ['La marge et la trésorerie', 'Uniquement le chiffre d\'affaires', 'Rien', 'Le logo'], correctIndex: 0, explanation: 'Croître en gardant marge et trésorerie maîtrisées est la clé.' },
        { question: 'Que faire de son moteur de croissance ?', options: ['L\'ignorer', 'Concentrer les efforts sur le levier le plus rentable', 'Tout faire à la fois', 'Changer chaque semaine'], correctIndex: 1, explanation: 'Concentrer les ressources sur le levier le plus rentable accélère sainement.' },
      ],
    },
  },
  {
    id: 'n3-m3-partenariats',
    level: 3,
    order: 3,
    title: 'Partenariats & appels d\'offres',
    summary: 'Décrocher des contrats B2B, répondre aux marchés publics et privés.',
    durationMin: 25,
    content: `# Partenariats & appels d'offres

Les gros volumes viennent souvent des **entreprises et institutions**, pas seulement des particuliers.

## 1. Vendre en B2B
- Cycle de vente plus long, mais **commandes plus grosses et récurrentes**.
- Soignez le **professionnalisme** : devis clair, facture en règle (RCCM/NIF), délais tenus.

## 2. Répondre à un appel d'offres
- Lisez **tout le cahier des charges** ; respectez chaque critère.
- Préparez les **pièces administratives** (existence légale, attestations, références).
- Proposez un prix **compétitif mais rentable**, et une offre technique solide.

## 3. Construire des partenariats
- Partenaires complémentaires (un menuisier + un livreur + un showroom).
- Accords gagnant-gagnant écrits (qui apporte quoi, qui gagne quoi).

## 4. La crédibilité, votre meilleur atout
Références clients, photos de réalisations, témoignages : un dossier qui rassure gagne le contrat, même face à moins cher.

> 🟢 À retenir : le B2B et les appels d'offres exigent rigueur administrative, prix juste et crédibilité prouvée.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Le B2B se caractérise souvent par…', options: ['De toutes petites ventes', 'Des commandes plus grosses et récurrentes, cycle plus long', 'Aucune facture', 'Pas de devis'], correctIndex: 1, explanation: 'Le B2B = volumes plus importants et récurrents, mais cycle de vente plus long.' },
        { question: 'Pour répondre à un appel d\'offres, il faut d\'abord…', options: ['Ignorer le cahier des charges', 'Lire et respecter tout le cahier des charges', 'Proposer le prix le plus bas à perte', 'Envoyer un SMS'], correctIndex: 1, explanation: 'Le respect du cahier des charges et des pièces exigées est éliminatoire.' },
        { question: 'Un bon partenariat repose sur…', options: ['Un accord flou oral', 'Un accord gagnant-gagnant clair (qui apporte/gagne quoi)', 'La dépendance totale', 'La concurrence interne'], correctIndex: 1, explanation: 'Des rôles et bénéfices clairs et écrits font durer le partenariat.' },
        { question: 'Face à un concurrent moins cher, votre atout est…', options: ['Baisser à perte', 'La crédibilité prouvée (références, réalisations)', 'Abandonner', 'Critiquer le concurrent'], correctIndex: 1, explanation: 'Les preuves de sérieux rassurent et font gagner même sans être le moins cher.' },
      ],
    },
  },
  {
    id: 'n3-m4-gouvernance',
    level: 3,
    order: 4,
    title: 'Gestion avancée & gouvernance',
    summary: 'Structurer la direction, gérer les risques et la conformité en grandissant.',
    durationMin: 25,
    content: `# Gestion avancée & gouvernance

Une entreprise qui grandit doit se **structurer** pour rester pilotable et fiable.

## 1. Séparer les rôles
Direction, opérations, finances : clarifiez qui décide quoi. Évitez que tout repose sur le fondateur.

## 2. Piloter avec un tableau de bord
Quelques indicateurs suivis chaque mois : CA, marge, trésorerie, créances clients, satisfaction. Décidez sur des faits, pas des impressions.

## 3. Gérer les risques
- **Trésorerie** : garder un matelas, suivre les encaissements.
- **Dépendance** : ne pas dépendre d'un seul client ou fournisseur.
- **Conformité** : déclarations fiscales et sociales à jour (DGI, CNSS).
- **Assurances** quand l'activité l'exige.

## 4. Réinvestir intelligemment
Le bénéfice peut être réinvesti (capacité, équipe, stock) ou distribué. Une partie doit toujours **renforcer la trésorerie** et préparer l'avenir.

> 🟢 À retenir : gouvernance = rôles clairs + pilotage par indicateurs + maîtrise des risques + conformité.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Un risque majeur à surveiller ?', options: ['Avoir trop de clients', 'Dépendre d\'un seul client ou fournisseur', 'Tenir ses comptes', 'Payer ses impôts'], correctIndex: 1, explanation: 'La dépendance à une source unique fragilise l\'entreprise.' },
        { question: 'La conformité, c\'est notamment…', options: ['Ignorer la DGI', 'Tenir à jour les déclarations fiscales (DGI) et sociales (CNSS)', 'Ne pas facturer', 'Payer en liquide uniquement'], correctIndex: 1, explanation: 'Déclarations fiscales et sociales à jour évitent sanctions et blocages.' },
        { question: 'Bonne pratique de gouvernance ?', options: ['Tout faire reposer sur le fondateur', 'Séparer les rôles (direction, opérations, finances)', 'Aucune règle', 'Décider sur des impressions'], correctIndex: 1, explanation: 'Des rôles clairs rendent l\'entreprise pilotable et résiliente.' },
        { question: 'Que faire d\'une partie du bénéfice ?', options: ['Tout dépenser', 'En réinvestir et renforcer la trésorerie', 'L\'ignorer', 'Le cacher'], correctIndex: 1, explanation: 'Réinvestir et consolider la trésorerie prépare l\'avenir.' },
      ],
    },
  },
  {
    id: 'n3-m5-pitch-bceg',
    level: 3,
    order: 5,
    title: 'Pitch investisseurs & BCEG',
    summary: 'Présenter son projet de façon convaincante pour obtenir un financement.',
    durationMin: 25,
    content: `# Pitch investisseurs & BCEG

Le meilleur projet peut échouer s'il est mal présenté. Le **pitch** transforme un dossier en décision favorable.

## 1. La structure d'un pitch efficace
- **Le problème** (clair et réel).
- **Votre solution** et ce qui la rend unique.
- **Le marché** et la traction (ce que vous avez déjà prouvé).
- **Le modèle** (comment vous gagnez de l'argent).
- **L'équipe**.
- **La demande** : combien, pour quoi, et le retour attendu.

## 2. Parler chiffres avec confiance
Connaissez par cœur : CA, marge, point mort, montant demandé, emploi des fonds, capacité de remboursement. L'hésitation sur ses chiffres inquiète.

## 3. Adapté à la BCEG
La BCEG finance des entrepreneurs gabonais sérieux et préparés. Montrez : entreprise en règle, projet viable, impact local (emplois, valeur ajoutée), et un plan de remboursement réaliste.

## 4. Anticiper les objections
Préparez les réponses aux questions difficiles : « Et si les ventes sont plus lentes ? », « Quelle garantie ? », « Pourquoi vous ? ». Un porteur qui anticipe rassure.

> 🟢 À retenir : un bon pitch = histoire claire + chiffres maîtrisés + demande précise + réponses aux objections.`,
    quiz: {
      passScore: 70,
      questions: [
        { question: 'Que doit contenir la "demande" d\'un pitch ?', options: ['Juste un montant vague', 'Combien, pour quoi, et le retour/plan de remboursement', 'Rien', 'Le logo'], correctIndex: 1, explanation: 'La demande précise le montant, l\'emploi des fonds et le remboursement/retour.' },
        { question: 'Face à un financeur, sur ses chiffres il faut…', options: ['Hésiter', 'Les maîtriser (CA, marge, point mort, remboursement)', 'Les inventer', 'Les cacher'], correctIndex: 1, explanation: 'Maîtriser ses chiffres inspire confiance ; l\'hésitation inquiète.' },
        { question: 'Ce que valorise la BCEG, c\'est notamment…', options: ['Un projet flou', 'Une entreprise en règle, viable, à impact local, plan de remboursement réaliste', 'Beaucoup d\'abonnés', 'Le hasard'], correctIndex: 1, explanation: 'Sérieux, viabilité, impact local et remboursement réaliste sont clés.' },
        { question: 'Anticiper les objections permet de…', options: ['Perdre du temps', 'Rassurer le financeur', 'Énerver l\'investisseur', 'Rien'], correctIndex: 1, explanation: 'Préparer les réponses aux questions difficiles renforce la crédibilité.' },
      ],
    },
  },
]

// Accès par numéro de niveau
export const MODULES_BY_LEVEL: Record<number, FormationModule[]> = {
  1: LEVEL1_MODULES,
  2: LEVEL2_MODULES,
  3: LEVEL3_MODULES,
}
