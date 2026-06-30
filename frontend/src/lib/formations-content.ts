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
