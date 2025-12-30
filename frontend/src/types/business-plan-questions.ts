export interface BusinessPlanQuestion {
  id: string
  question: string
  placeholder: string
  aiPrompt: string
}

export interface BusinessPlanSection {
  section: number
  title: string
  objective: string
  questions: BusinessPlanQuestion[]
}

export const BUSINESS_PLAN_SECTIONS: BusinessPlanSection[] = [
  {
    section: 1,
    title: 'Résumé Exécutif',
    objective: 'Donner une vue d\'ensemble rapide et percutante du projet',
    questions: [
      {
        id: 'company_name',
        question: 'Quel est le nom de votre entreprise/projet ?',
        placeholder: 'Ex: GreenTech Gabon SARL',
        aiPrompt: 'Propose un nom professionnel et mémorable pour une entreprise dans ce secteur au Gabon'
      },
      {
        id: 'mission',
        question: 'Quelle est votre mission ?',
        placeholder: 'Ex: Fournir des solutions écologiques accessibles...',
        aiPrompt: 'Rédige une mission claire et inspirante pour ce projet'
      },
      {
        id: 'market_need',
        question: 'Quel besoin du marché visez-vous à résoudre ?',
        placeholder: 'Ex: Manque de solutions écologiques abordables...',
        aiPrompt: 'Identifie les besoins du marché gabonais dans ce secteur'
      },
      {
        id: 'solution',
        question: 'Quelle est votre solution/produit/service ?',
        placeholder: 'Ex: Plateforme de mise en relation...',
        aiPrompt: 'Décris une solution concrète et adaptée au contexte gabonais'
      },
      {
        id: 'value_proposition',
        question: 'Quelle est votre proposition de valeur unique ?',
        placeholder: 'Ex: Seule plateforme locale avec livraison 24h...',
        aiPrompt: 'Formule une proposition de valeur différenciante'
      },
      {
        id: 'objectives',
        question: 'Quels sont vos objectifs à court et long terme ?',
        placeholder: 'Ex: Court terme: 100 clients en 6 mois. Long terme: Leader national...',
        aiPrompt: 'Définis des objectifs SMART à court (6-12 mois) et long terme (3-5 ans)'
      },
      {
        id: 'funding_needed',
        question: 'Quel est le montant de financement recherché (en FCFA) et pour quoi faire ?',
        placeholder: 'Ex: 25 millions FCFA pour équipement, marketing et fonds de roulement',
        aiPrompt: 'Estime un besoin de financement réaliste en FCFA avec répartition'
      }
    ]
  },
  {
    section: 2,
    title: 'Présentation de l\'Entreprise',
    objective: 'Décrire l\'identité légale et opérationnelle de l\'entreprise',
    questions: [
      {
        id: 'legal_status',
        question: 'Quel est le statut juridique envisagé (SARL, SA, Entreprise Individuelle...) ?',
        placeholder: 'Ex: SARL avec capital de 1 million FCFA',
        aiPrompt: 'Recommande le statut juridique le plus adapté au Gabon pour ce type d\'activité'
      },
      {
        id: 'headquarters',
        question: 'Où sera situé le siège de l\'entreprise ?',
        placeholder: 'Ex: Libreville, quartier Akanda',
        aiPrompt: 'Suggère des localisations stratégiques au Gabon pour ce secteur'
      },
      {
        id: 'founders',
        question: 'Qui sont les fondateurs et leurs expériences ?',
        placeholder: 'Ex: Jean Mbongo, 10 ans d\'expérience dans...',
        aiPrompt: 'Décris un profil type de fondateurs avec compétences complémentaires'
      },
      {
        id: 'vision',
        question: 'Quelle est la vision long terme ?',
        placeholder: 'Ex: Devenir le leader régional en 5 ans',
        aiPrompt: 'Formule une vision ambitieuse mais réaliste pour ce projet'
      },
      {
        id: 'org_structure',
        question: 'Quelle est la structure actuelle ou projetée de l\'équipe (organigramme) ?',
        placeholder: 'Ex: Direction générale, Dept commercial, Dept technique...',
        aiPrompt: 'Propose une structure organisationnelle adaptée à la taille du projet'
      }
    ]
  },
  {
    section: 3,
    title: 'Analyse du Marché Gabonais',
    objective: 'Montrer votre compréhension du marché local',
    questions: [
      {
        id: 'sector',
        question: 'Quel est le secteur d\'activité ?',
        placeholder: 'Ex: Commerce de détail, Services numériques...',
        aiPrompt: 'Précise le secteur et sous-secteur avec codes NAF si pertinent'
      },
      {
        id: 'market_size',
        question: 'Quelle est la taille estimée du marché au Gabon ?',
        placeholder: 'Ex: 500 millions FCFA/an, 10 000 clients potentiels',
        aiPrompt: 'Estime la taille du marché gabonais pour ce secteur en FCFA et en volume'
      },
      {
        id: 'market_trends',
        question: 'Quelles tendances influencent ce secteur ?',
        placeholder: 'Ex: Digitalisation croissante, urbanisation...',
        aiPrompt: 'Identifie les tendances macro et micro actuelles du marché gabonais'
      },
      {
        id: 'target_segments',
        question: 'Quels sont les segments de clients visés ?',
        placeholder: 'Ex: Professionnels urbains 25-45 ans, PME...',
        aiPrompt: 'Définis des segments clients précis avec critères démographiques et comportementaux'
      },
      {
        id: 'buying_behaviors',
        question: 'Quels comportements d\'achat spécifiques au Gabon faut-il considérer ?',
        placeholder: 'Ex: Préférence paiement cash, achat groupé...',
        aiPrompt: 'Analyse les spécificités culturelles et comportementales d\'achat au Gabon'
      },
      {
        id: 'regulations',
        question: 'Y a-t-il des contraintes réglementaires locales ?',
        placeholder: 'Ex: Licence ARCEP, normes sanitaires...',
        aiPrompt: 'Liste les principales réglementations gabonaises applicables à ce secteur'
      }
    ]
  },
  {
    section: 4,
    title: 'Étude de la Concurrence',
    objective: 'Positionner votre projet par rapport aux acteurs existants',
    questions: [
      {
        id: 'competitors',
        question: 'Qui sont vos principaux concurrents locaux ?',
        placeholder: 'Ex: Entreprise A (leader 40% PDM), Entreprise B...',
        aiPrompt: 'Identifie les principaux concurrents potentiels au Gabon dans ce secteur'
      },
      {
        id: 'swot_competitors',
        question: 'Quels sont leurs points forts/faibles ?',
        placeholder: 'Ex: Force: notoriété. Faible: prix élevés, service client',
        aiPrompt: 'Analyse SWOT des concurrents typiques dans ce secteur au Gabon'
      },
      {
        id: 'competitor_pricing',
        question: 'Quelles sont leurs gammes de prix ?',
        placeholder: 'Ex: 5 000 - 50 000 FCFA selon produit',
        aiPrompt: 'Estime les fourchettes de prix pratiquées par la concurrence en FCFA'
      },
      {
        id: 'market_share',
        question: 'Quelle part de marché occupent-ils ?',
        placeholder: 'Ex: Leader 40%, Challenger 25%, Niche 10%...',
        aiPrompt: 'Estime la répartition des parts de marché dans ce secteur'
      },
      {
        id: 'differentiation',
        question: 'Quelle stratégie de différenciation adoptez-vous ?',
        placeholder: 'Ex: Prix compétitifs + service premium + livraison rapide',
        aiPrompt: 'Propose une stratégie de différenciation claire et défendable'
      }
    ]
  },
  {
    section: 5,
    title: 'Produits / Services Offerts',
    objective: 'Décrire précisément votre offre',
    questions: [
      {
        id: 'products_services',
        question: 'Quels sont vos produits ou services ?',
        placeholder: 'Ex: 3 formules d\'abonnement, service à la carte...',
        aiPrompt: 'Décris une gamme de produits/services cohérente et complète'
      },
      {
        id: 'problems_solved',
        question: 'À quels problèmes répondent-ils ?',
        placeholder: 'Ex: Gain de temps, économies, qualité garantie...',
        aiPrompt: 'Explicite les bénéfices clients concrets et mesurables'
      },
      {
        id: 'competitive_advantages',
        question: 'Quels sont les avantages compétitifs ?',
        placeholder: 'Ex: Technologie unique, partenariats exclusifs...',
        aiPrompt: 'Identifie les avantages compétitifs défendables'
      },
      {
        id: 'pricing_model',
        question: 'Quel est le modèle de tarification envisagé (en FCFA) ?',
        placeholder: 'Ex: Formule Basic 10 000 FCFA/mois, Premium 25 000 FCFA/mois',
        aiPrompt: 'Propose une grille tarifaire cohérente en FCFA avec justification'
      },
      {
        id: 'packages',
        question: 'Avez-vous prévu des options ou packages ?',
        placeholder: 'Ex: Pack Starter, Pack Pro, Pack Entreprise',
        aiPrompt: 'Conçois des packages attractifs avec montée en gamme'
      }
    ]
  },
  {
    section: 6,
    title: 'Modèle Économique (Business Model)',
    objective: 'Montrer comment l\'entreprise génère des revenus',
    questions: [
      {
        id: 'revenue_streams',
        question: 'Quels sont vos flux de revenus ?',
        placeholder: 'Ex: Ventes directes 70%, Abonnements 20%, Services 10%',
        aiPrompt: 'Détaille les différentes sources de revenus avec estimation du poids de chacune'
      },
      {
        id: 'distribution_channels',
        question: 'Quels canaux de distribution utilisez-vous ?',
        placeholder: 'Ex: Boutique physique, site web, revendeurs...',
        aiPrompt: 'Propose une stratégie multicanale adaptée au marché gabonais'
      },
      {
        id: 'business_model_type',
        question: 'Avez-vous un modèle d\'abonnement, de vente directe, B2B, B2C ?',
        placeholder: 'Ex: Mixte B2B (40%) et B2C (60%)',
        aiPrompt: 'Définis le modèle économique le plus adapté avec répartition'
      },
      {
        id: 'payment_policy',
        question: 'Quelle est votre politique de paiement ?',
        placeholder: 'Ex: Mobile Money, carte bancaire, cash, crédit 30j pour B2B',
        aiPrompt: 'Propose des modalités de paiement adaptées aux habitudes gabonaises'
      },
      {
        id: 'secondary_revenues',
        question: 'Y a-t-il des sources de revenus secondaires ?',
        placeholder: 'Ex: Publicité, commissions, formation...',
        aiPrompt: 'Identifie des revenus complémentaires potentiels'
      }
    ]
  },
  {
    section: 7,
    title: 'Stratégie Commerciale et Marketing',
    objective: 'Décrire comment vous allez acquérir et fidéliser vos clients',
    questions: [
      {
        id: 'communication_strategy',
        question: 'Quelle est votre stratégie de communication (digitale, locale, affichage, etc.) ?',
        placeholder: 'Ex: Facebook Ads, radio locale, affichage urbain...',
        aiPrompt: 'Conçois un mix communication adapté au marché gabonais'
      },
      {
        id: 'customer_acquisition',
        question: 'Quel est votre plan d\'acquisition client ?',
        placeholder: 'Ex: Offre lancement, parrainage, démos gratuites...',
        aiPrompt: 'Propose des tactiques d\'acquisition efficaces et mesurables'
      },
      {
        id: 'sales_channels',
        question: 'Quels sont vos canaux de vente (boutique, en ligne, partenaires) ?',
        placeholder: 'Ex: 2 boutiques Libreville, e-commerce, 5 revendeurs',
        aiPrompt: 'Définis une stratégie de distribution progressive'
      },
      {
        id: 'marketing_tools',
        question: 'Quels outils marketing comptez-vous utiliser (réseaux sociaux, flyers, SMS, SEO, etc.) ?',
        placeholder: 'Ex: Instagram, WhatsApp Business, flyers, SMS marketing',
        aiPrompt: 'Sélectionne les outils marketing les plus pertinents pour la cible'
      },
      {
        id: 'customer_relationship',
        question: 'Comment gérez-vous la relation client ?',
        placeholder: 'Ex: CRM, SAV téléphonique, programme fidélité...',
        aiPrompt: 'Propose une stratégie de fidélisation et service client'
      }
    ]
  },
  {
    section: 8,
    title: 'Plan Opérationnel',
    objective: 'Définir le fonctionnement quotidien du projet',
    questions: [
      {
        id: 'staffing_needs',
        question: 'Quels sont les besoins en personnel ?',
        placeholder: 'Ex: 1 gérant, 2 commerciaux, 1 comptable, 3 techniciens',
        aiPrompt: 'Définis les besoins RH par fonction avec profils requis'
      },
      {
        id: 'production_process',
        question: 'Quel est le processus de production / livraison ?',
        placeholder: 'Ex: Commande → Préparation 24h → Livraison 48h',
        aiPrompt: 'Décris un processus opérationnel clair étape par étape'
      },
      {
        id: 'infrastructure_needs',
        question: 'Avez-vous besoin de locaux, véhicules, matériel spécifique ?',
        placeholder: 'Ex: Local 100m², 2 véhicules, équipement informatique...',
        aiPrompt: 'Liste les besoins matériels et logistiques avec estimations'
      },
      {
        id: 'suppliers_partners',
        question: 'Quels fournisseurs ou partenaires avez-vous identifiés ?',
        placeholder: 'Ex: Fournisseur A (matières premières), Partenaire B (logistique)',
        aiPrompt: 'Identifie des partenaires stratégiques potentiels au Gabon'
      },
      {
        id: 'launch_steps',
        question: 'Quelles sont les étapes clés du lancement ?',
        placeholder: 'Ex: M1: Constitution, M2-3: Aménagement, M4: Lancement commercial',
        aiPrompt: 'Établis un rétroplanning de lancement sur 6-12 mois'
      }
    ]
  },
  {
    section: 9,
    title: 'Plan Financier (en FCFA)',
    objective: 'Projeter la viabilité financière du projet',
    questions: [
      {
        id: 'startup_capital',
        question: 'Quel est votre capital de départ ?',
        placeholder: 'Ex: 15 millions FCFA (apport 10M + emprunt 5M)',
        aiPrompt: 'Estime un capital de départ réaliste en FCFA avec sources'
      },
      {
        id: 'fixed_variable_costs',
        question: 'Quelles sont vos charges fixes/variables ?',
        placeholder: 'Ex: Fixes: loyer 300K, salaires 2M. Variables: achats 40% CA',
        aiPrompt: 'Détaille les charges fixes mensuelles et variables en % du CA'
      },
      {
        id: 'selling_prices',
        question: 'Quels sont vos prix de vente ?',
        placeholder: 'Ex: Produit A: 15 000 FCFA, Produit B: 35 000 FCFA',
        aiPrompt: 'Propose une grille de prix cohérente avec le marché'
      },
      {
        id: 'initial_investments',
        question: 'Quels investissements initiaux sont nécessaires ?',
        placeholder: 'Ex: Équipement 8M, Stock initial 3M, Marketing 2M',
        aiPrompt: 'Liste les investissements de départ avec montants en FCFA'
      },
      {
        id: 'break_even',
        question: 'Quel est votre seuil de rentabilité estimé ?',
        placeholder: 'Ex: 8 millions FCFA/mois, soit 160 ventes/mois',
        aiPrompt: 'Calcule le seuil de rentabilité en CA mensuel et volume'
      },
      {
        id: 'revenue_targets',
        question: 'Quels sont vos objectifs de chiffre d\'affaires ?',
        placeholder: 'Ex: An 1: 50M FCFA, An 2: 100M, An 3: 180M',
        aiPrompt: 'Projette des objectifs de CA réalistes sur 3 ans en FCFA'
      }
    ]
  },
  {
    section: 10,
    title: 'Annexes',
    objective: 'Apporter des documents complémentaires pour crédibiliser le projet',
    questions: [
      {
        id: 'founders_cv',
        question: 'Avez-vous les CV des fondateurs à inclure ?',
        placeholder: 'Ex: CV Jean Mbongo - 10 ans d\'expérience...',
        aiPrompt: 'Rédige un CV synthétique type pour un fondateur dans ce secteur'
      },
      {
        id: 'market_study',
        question: 'Disposez-vous d\'une étude de marché complète ?',
        placeholder: 'Ex: Enquête terrain 200 répondants, analyse concurrence...',
        aiPrompt: 'Décris les éléments clés d\'une étude de marché pertinente'
      },
      {
        id: 'financial_charts',
        question: 'Quels graphiques ou données financières détaillées souhaitez-vous inclure ?',
        placeholder: 'Ex: Évolution CA, structure coûts, projection trésorerie',
        aiPrompt: 'Liste les graphiques financiers essentiels à présenter'
      },
      {
        id: 'contracts_loi',
        question: 'Avez-vous des contrats ou lettres d\'intention de partenaires ?',
        placeholder: 'Ex: LOI avec fournisseur principal, promesse de financement',
        aiPrompt: 'Suggère des documents contractuels qui renforcent la crédibilité'
      },
      {
        id: 'field_research',
        question: 'Quelles recherches terrain avez-vous menées ?',
        placeholder: 'Ex: Visites sites concurrents, interviews clients potentiels',
        aiPrompt: 'Propose une méthodologie de recherche terrain applicable'
      }
    ]
  }
]
