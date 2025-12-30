// Système de checklist détaillé pour le Plan d'Action adapté au Gabon

export interface ChecklistItem {
  id: string
  task: string
  description: string
  aiPrompt: string
  requiresDocument?: boolean
  documentType?: string
  placeholder: string
  estimatedTime: string
  priority: 'haute' | 'moyenne' | 'basse'
}

export interface ActionStep {
  step: number
  title: string
  objective: string
  duration: string
  icon: string
  checklist: ChecklistItem[]
}

export const ACTION_PLAN_STEPS: ActionStep[] = [
  {
    step: 1,
    title: "Validation et Étude Préliminaire",
    objective: "Valider la faisabilité du projet dans le contexte gabonais",
    duration: "2-4 semaines",
    icon: "🔍",
    checklist: [
      {
        id: "validation_contacts",
        task: "Identifier les contacts stratégiques au Gabon",
        description: "Lister les personnes/organisations à contacter pour valider votre idée",
        aiPrompt: "Liste 5-7 contacts stratégiques au Gabon pour valider ce projet : chambres de commerce (Libreville, Port-Gentil), ANPME, associations professionnelles du secteur, clients potentiels, mentors entrepreneurs. Inclus noms réels d'organisations et comment les contacter.",
        placeholder: "Ex: 1. Chambre de Commerce de Libreville (contact@ccil.ga, +241 XX XX XX XX)\n2. ANPME - Programme d'accompagnement...",
        estimatedTime: "2 jours",
        priority: "haute"
      },
      {
        id: "validation_reglementation",
        task: "Identifier les autorisations nécessaires",
        description: "Lister toutes les démarches administratives obligatoires au Gabon",
        aiPrompt: "Liste exhaustive des autorisations/licences à obtenir au Gabon pour ce secteur : RCCM (ANPI), patente (Mairie), autorisations sectorielles spécifiques, CNSS, inspection du travail, etc. Précise l'institution, documents requis, coût en FCFA, délai.",
        requiresDocument: true,
        documentType: "Checklist administrative PDF",
        placeholder: "Ex: 1. RCCM à l'ANPI (50,000 FCFA, 5 jours, documents: statuts, pièce identité...)\n2. Patente à la Mairie...",
        estimatedTime: "3 jours",
        priority: "haute"
      },
      {
        id: "validation_budget",
        task: "Établir le budget de démarrage détaillé",
        description: "Calculer tous les coûts initiaux en FCFA",
        aiPrompt: "Crée un budget de démarrage détaillé en FCFA pour le Gabon : 1) Frais administratifs (RCCM, patente, etc.), 2) Local (caution, loyer, aménagement), 3) Équipements, 4) Stock initial, 5) Marketing lancement, 6) Salaires 3 mois, 7) Fonds roulement. Total réaliste avec marge sécurité 20%.",
        requiresDocument: true,
        documentType: "Budget prévisionnel Excel/PDF",
        placeholder: "Ex: TOTAL: 3,500,000 FCFA\n- Administratif: 200,000 FCFA\n- Local: 800,000 FCFA...",
        estimatedTime: "2 jours",
        priority: "haute"
      },
      {
        id: "validation_emplacement",
        task: "Sélectionner l'emplacement stratégique",
        description: "Choisir le meilleur emplacement à Libreville/Port-Gentil",
        aiPrompt: "Propose 3 emplacements stratégiques au Gabon avec analyse détaillée : quartier, type de local, loyer moyen en FCFA, avantages (passage, parking, visibilité), inconvénients, accessibilité. Mentionne quartiers connus : Akanda, Mont-Bouët, Owendo, Centre-ville, etc.",
        placeholder: "Ex: Option 1: Local 40m² à Mont-Bouët\n- Loyer: 150,000 FCFA/mois\n- Avantages: Fort passage, marché à proximité...",
        estimatedTime: "1 semaine",
        priority: "haute"
      },
      {
        id: "validation_concurrence",
        task: "Analyser la concurrence locale",
        description: "Identifier et analyser les concurrents directs au Gabon",
        aiPrompt: "Identifie 3-5 concurrents directs au Gabon (noms réels si connus). Pour chacun : localisation, offre, prix en FCFA, forces, faiblesses, part de marché estimée. Propose stratégie différenciation claire.",
        requiresDocument: true,
        documentType: "Analyse concurrentielle PDF",
        placeholder: "Ex: Concurrent A (Libreville)\n- Offre: ...\n- Prix: 5,000-10,000 FCFA\n- Forces: Ancienneté, notoriété...",
        estimatedTime: "3 jours",
        priority: "moyenne"
      }
    ]
  },
  {
    step: 2,
    title: "Structuration Juridique et Administrative",
    objective: "Créer l'entité légale et obtenir les documents officiels",
    duration: "3-6 semaines",
    icon: "📋",
    checklist: [
      {
        id: "juridique_forme",
        task: "Choisir la forme juridique adaptée",
        description: "Sélectionner le statut juridique optimal pour votre projet",
        aiPrompt: "Compare les formes juridiques au Gabon pour ce projet : Entreprise Individuelle, SARL, SARLU, SA. Pour chacune : capital minimum en FCFA, nombre associés, responsabilité, fiscalité (IS, TVA), avantages/inconvénients. Recommande la meilleure option avec justification.",
        placeholder: "Ex: SARLU recommandée car:\n- 1 seul associé (vous)\n- Capital: 1,000,000 FCFA\n- Responsabilité limitée...",
        estimatedTime: "2 jours",
        priority: "haute"
      },
      {
        id: "juridique_statuts",
        task: "Rédiger les statuts de l'entreprise",
        description: "Préparer les statuts conformes à la législation gabonaise",
        aiPrompt: "Fournis structure détaillée des statuts pour cette forme juridique au Gabon : articles obligatoires, clauses importantes, capital social, répartition parts, gérance, décisions. Liste notaires à Libreville avec tarifs moyens en FCFA.",
        requiresDocument: true,
        documentType: "Projet de statuts Word/PDF",
        placeholder: "Ex: Articles des statuts:\nArticle 1 - Forme: SARLU\nArticle 2 - Dénomination: ...\nArticle 3 - Siège social: ...",
        estimatedTime: "1 semaine",
        priority: "haute"
      },
      {
        id: "juridique_anpi",
        task: "Compléter le dossier ANPI",
        description: "Préparer tous les documents pour l'immatriculation",
        aiPrompt: "Liste exhaustive documents ANPI Gabon : 1) Formulaire M0, 2) Statuts signés et enregistrés, 3) Attestation dépôt capital, 4) Pièces identité gérant, 5) Justificatif siège social, 6) Déclaration non-condamnation. Explique processus étape par étape avec délais et coûts en FCFA.",
        requiresDocument: true,
        documentType: "Dossier ANPI complet (ZIP)",
        placeholder: "Ex: Documents à préparer:\n☐ Formulaire M0 rempli\n☐ 3 exemplaires statuts signés\n☐ Attestation banque...",
        estimatedTime: "1 semaine",
        priority: "haute"
      },
      {
        id: "juridique_cnss",
        task: "S'inscrire à la CNSS",
        description: "Obtenir le numéro d'affiliation CNSS",
        aiPrompt: "Explique procédure inscription CNSS Gabon : documents requis, où se rendre (adresse CNSS Libreville), délai, coût. Détaille obligations : taux cotisations (16% employeur + 5% salarié), déclarations mensuelles, échéances.",
        requiresDocument: true,
        documentType: "Formulaire CNSS PDF",
        placeholder: "Ex: Démarches CNSS:\n1. Se rendre CNSS Libreville (Bd Triomphal)\n2. Documents: RCCM, statuts, liste salariés...",
        estimatedTime: "2 jours",
        priority: "haute"
      }
    ]
  },
  {
    step: 3,
    title: "Mise en Place Opérationnelle",
    objective: "Installer les infrastructures et recruter l'équipe",
    duration: "4-8 semaines",
    icon: "🏗️",
    checklist: [
      {
        id: "operationnel_local",
        task: "Trouver et aménager le local",
        description: "Signer le bail et préparer l'espace de travail",
        aiPrompt: "Guide complet location local au Gabon : 1) Négocier bail (durée, loyer FCFA, charges, caution), 2) Vérifier conformité (électricité, eau, sécurité), 3) Aménagement nécessaire avec budget FCFA, 4) Fournisseurs travaux à Libreville. Checklist avant signature bail.",
        requiresDocument: true,
        documentType: "Contrat de bail PDF",
        placeholder: "Ex: Local trouvé:\n- Adresse: Mont-Bouët, Libreville\n- Surface: 40m²\n- Loyer: 150,000 FCFA/mois...",
        estimatedTime: "2 semaines",
        priority: "haute"
      },
      {
        id: "operationnel_equipements",
        task: "Acheter les équipements essentiels",
        description: "Acquérir le matériel et mobilier nécessaires",
        aiPrompt: "Liste équipements prioritaires avec fournisseurs Gabon et prix FCFA : 1) Informatique (ordinateurs, imprimante, logiciels), 2) Mobilier (bureaux, chaises, rangements), 3) Équipements spécifiques au secteur, 4) Téléphonie/internet. Fournisseurs fiables à Libreville avec contacts.",
        requiresDocument: true,
        documentType: "Devis fournisseurs PDF",
        placeholder: "Ex: Équipements:\n- 2 ordinateurs: 800,000 FCFA (Gabon Informatique)\n- Mobilier: 300,000 FCFA...",
        estimatedTime: "1 semaine",
        priority: "haute"
      },
      {
        id: "operationnel_recrutement",
        task: "Recruter les premiers employés",
        description: "Publier annonces et embaucher",
        aiPrompt: "Guide recrutement au Gabon : 1) Rédiger annonce attractive, 2) Canaux diffusion (Facebook, LinkedIn, réseaux sociaux, écoles USTM/Omar Bongo, bouche-à-oreille), 3) Processus sélection (CV, entretien, test), 4) Contrat travail conforme code travail gabonais. Modèle annonce et contrat.",
        requiresDocument: true,
        documentType: "Contrats de travail PDF",
        placeholder: "Ex: Recrutement:\n- 1 Vendeur: 200,000 FCFA\n- 1 Assistant: 150,000 FCFA...",
        estimatedTime: "2 semaines",
        priority: "moyenne"
      }
    ]
  },
  {
    step: 4,
    title: "Stratégie Marketing et Commerciale",
    objective: "Faire connaître l'offre et acquérir les premiers clients",
    duration: "En continu",
    icon: "📢",
    checklist: [
      {
        id: "marketing_identite",
        task: "Créer l'identité visuelle",
        description: "Designer le logo et charte graphique",
        aiPrompt: "Guide création identité visuelle au Gabon : 1) Brief logo (valeurs, couleurs, style), 2) Graphistes à Libreville (contacts, tarifs 50,000-200,000 FCFA), 3) Éléments charte (logo, couleurs, typographie), 4) Supports (cartes visite, flyers, enseigne). Conseils design attractif pour marché gabonais.",
        requiresDocument: true,
        documentType: "Logo + Charte graphique (ZIP)",
        placeholder: "Ex: Identité visuelle:\n- Logo: Design moderne, couleurs vert/or\n- Graphiste: Studio XYZ, 150,000 FCFA...",
        estimatedTime: "1 semaine",
        priority: "haute"
      },
      {
        id: "marketing_digital",
        task: "Créer la présence en ligne",
        description: "Site web et réseaux sociaux",
        aiPrompt: "Stratégie digitale Gabon : 1) Site vitrine (développeurs locaux, coût 200,000-500,000 FCFA, hébergement), 2) Page Facebook (création, contenu), 3) Instagram, 4) WhatsApp Business (essentiel au Gabon). Planning publications, types contenus. Outils gratuits recommandés.",
        requiresDocument: true,
        documentType: "Plan de contenu digital Excel/PDF",
        placeholder: "Ex: Présence digitale:\n- Site: 300,000 FCFA (Dev local)\n- Facebook: 3 posts/semaine\n- WhatsApp Business: Catalogue produits...",
        estimatedTime: "2 semaines",
        priority: "haute"
      },
      {
        id: "marketing_prospects",
        task: "Identifier les premiers clients cibles",
        description: "Liste de 20-30 prospects prioritaires",
        aiPrompt: "Stratégie prospection Gabon : 1) Profil client idéal (B2B/B2C, localisation, budget), 2) Liste 20-30 prospects concrets (noms entreprises ou profils particuliers), 3) Approche personnalisée par type, 4) Script commercial adapté, 5) Suivi prospects (CRM simple Excel). Actions terrain immédiates.",
        requiresDocument: true,
        documentType: "Fichier prospects Excel",
        placeholder: "Ex: Prospects prioritaires:\n1. Entreprise A (Akanda) - Contact: M. X, Tél: ...\n2. Entreprise B (Owendo)...",
        estimatedTime: "1 semaine",
        priority: "haute"
      }
    ]
  },
  {
    step: 5,
    title: "Lancement et Suivi",
    objective: "Démarrer l'activité et piloter la performance",
    duration: "3-6 mois",
    icon: "🚀",
    checklist: [
      {
        id: "lancement_evenement",
        task: "Organiser l'événement de lancement",
        description: "Inauguration ou action spéciale",
        aiPrompt: "Événement lancement impactant au Gabon : 1) Format (inauguration, journée portes ouvertes, promotion spéciale), 2) Invités (prospects, partenaires, presse locale, influenceurs), 3) Animation, 4) Budget 100,000-500,000 FCFA détaillé, 5) Communication avant/pendant/après. Plan d'action complet.",
        requiresDocument: true,
        documentType: "Plan événement lancement PDF",
        placeholder: "Ex: Inauguration:\n- Date: 1er septembre, 10h-16h\n- Lieu: Notre local\n- Invités: 50 personnes\n- Animation: Dégustation, démonstration...\nBudget: 300,000 FCFA",
        estimatedTime: "2 semaines",
        priority: "haute"
      },
      {
        id: "lancement_kpis",
        task: "Définir les indicateurs de performance",
        description: "KPIs à suivre quotidiennement/hebdomadairement",
        aiPrompt: "Tableau de bord KPIs essentiels Gabon : 1) Chiffre affaires journalier/hebdomadaire/mensuel FCFA, 2) Nombre clients, 3) Panier moyen FCFA, 4) Taux conversion, 5) Trésorerie, 6) Stock. Objectifs réalistes mois 1-3-6. Outils suivi simples (Excel). Fréquence revue.",
        requiresDocument: true,
        documentType: "Tableau de bord KPIs Excel",
        placeholder: "Ex: Objectifs mois 1:\n- CA: 1,000,000 FCFA\n- Clients: 20\n- Panier moyen: 50,000 FCFA\n- Trésorerie min: 500,000 FCFA",
        estimatedTime: "2 jours",
        priority: "haute"
      },
      {
        id: "lancement_tresorerie",
        task: "Mettre en place le suivi de trésorerie",
        description: "Gérer les flux financiers au quotidien",
        aiPrompt: "Gestion trésorerie rigoureuse Gabon : 1) Prévisionnel trésorerie 6 mois (entrées/sorties FCFA), 2) Fonds roulement nécessaire, 3) Suivi quotidien (encaissements, décaissements), 4) Anticipation difficultés, 5) Solutions urgence (découvert, famille, microfinance). Outils Excel + conseils pratiques.",
        requiresDocument: true,
        documentType: "Prévisionnel trésorerie Excel",
        placeholder: "Ex: Trésorerie:\n- Fonds roulement: 2,000,000 FCFA\n- Suivi: Fichier Excel quotidien\n- Seuil alerte: 500,000 FCFA...",
        estimatedTime: "3 jours",
        priority: "haute"
      }
    ]
  }
]

// Helper functions
export function getActionStep(stepNumber: number): ActionStep | undefined {
  return ACTION_PLAN_STEPS.find(s => s.step === stepNumber)
}

export function getAllChecklistItems(): ChecklistItem[] {
  return ACTION_PLAN_STEPS.flatMap(step => step.checklist)
}

export function getChecklistItemsByStep(stepNumber: number): ChecklistItem[] {
  const step = getActionStep(stepNumber)
  return step?.checklist || []
}

// Fonction pour personnaliser le plan d'action en fonction du projet
export function getPersonalizedActionPlan(projectData: {
  titre: string
  secteur: string
  budget: string
  description: string
}): ActionStep[] {
  const { titre, secteur, budget, description } = projectData
  
  // Contexte du projet pour personnaliser les prompts IA
  const projectContext = `Projet: ${titre}\nSecteur: ${secteur}\nBudget: ${budget}\nDescription: ${description}`
  
  return ACTION_PLAN_STEPS.map(step => ({
    ...step,
    checklist: step.checklist.map(item => ({
      ...item,
      // Personnaliser le prompt IA avec le contexte du projet
      aiPrompt: `CONTEXTE DU PROJET:\n${projectContext}\n\nTÂCHE:\n${item.aiPrompt}`,
      // Personnaliser le placeholder avec le titre du projet
      placeholder: item.placeholder.replace(/Ex:/g, `Ex pour "${titre}":`)
    }))
  }))
}
