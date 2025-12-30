// Questions pour générer le Plan d'Action adapté au contexte gabonais

export interface ActionPlanQuestion {
  id: string
  question: string
  aiPrompt: string
  placeholder: string
  category?: string
}

export interface ActionPlanPhase {
  phase: number
  title: string
  objective: string
  duration: string
  questions: ActionPlanQuestion[]
}

export const ACTION_PLAN_PHASES: ActionPlanPhase[] = [
  {
    phase: 1,
    title: "Validation et Étude Préliminaire",
    objective: "Valider la faisabilité du projet dans le contexte gabonais",
    duration: "2-4 semaines",
    questions: [
      {
        id: "validation_1",
        question: "Quelles sont les premières personnes/organisations à contacter au Gabon pour valider votre idée ?",
        aiPrompt: "Liste 5-7 contacts stratégiques au Gabon (chambres de commerce, associations professionnelles, clients potentiels, mentors). Inclus des noms d'organisations réelles à Libreville/Port-Gentil si pertinent.",
        placeholder: "Ex: Chambre de Commerce de Libreville, ANPME, clients potentiels dans le secteur..."
      },
      {
        id: "validation_2",
        question: "Quelles autorisations/licences devez-vous obtenir auprès des autorités gabonaises ?",
        aiPrompt: "Liste les démarches administratives spécifiques au Gabon : RCCM, patente, autorisations sectorielles, CNSS, etc. Précise les institutions (ANPI, Mairie, Ministères concernés).",
        placeholder: "Ex: Inscription RCCM à l'ANPI, patente à la Mairie, autorisation sanitaire..."
      },
      {
        id: "validation_3",
        question: "Quel budget initial minimum devez-vous mobiliser en FCFA ?",
        aiPrompt: "Estime un budget de démarrage réaliste en FCFA pour le contexte gabonais, en détaillant : frais administratifs, équipements, stock initial, marketing, fonds de roulement 3 mois.",
        placeholder: "Ex: 2,500,000 FCFA (détaillé par poste)"
      },
      {
        id: "validation_4",
        question: "Où allez-vous implanter votre activité à Libreville/Port-Gentil/autre ville ?",
        aiPrompt: "Suggère 3-4 emplacements stratégiques avec avantages/inconvénients. Mentionne des quartiers/zones connus : Akanda, Owendo, Mont-Bouët, Centre-ville, etc.",
        placeholder: "Ex: Local commercial à Mont-Bouët (passage élevé, loyer 150,000 FCFA/mois)"
      },
      {
        id: "validation_5",
        question: "Qui seront vos 3 premiers concurrents directs au Gabon ?",
        aiPrompt: "Identifie 3 concurrents existants au Gabon (noms réels si connus ou types d'entreprises). Analyse leurs forces/faiblesses et comment vous différencier.",
        placeholder: "Ex: Entreprise X à Libreville (leader mais cher), Entreprise Y (qualité moyenne)..."
      }
    ]
  },
  {
    phase: 2,
    title: "Structuration Juridique et Administrative",
    objective: "Créer l'entité légale et obtenir les documents officiels",
    duration: "3-6 semaines",
    questions: [
      {
        id: "juridique_1",
        question: "Quelle forme juridique choisissez-vous et pourquoi ?",
        aiPrompt: "Recommande la forme juridique adaptée au Gabon : Entreprise Individuelle, SARL, SARLU, SA. Explique avantages/inconvénients, capital minimum, nombre d'associés, fiscalité.",
        placeholder: "Ex: SARLU (1 associé, capital 1,000,000 FCFA, responsabilité limitée)"
      },
      {
        id: "juridique_2",
        question: "Quelles sont les étapes précises d'immatriculation à l'ANPI ?",
        aiPrompt: "Détaille le processus ANPI au Gabon : 1) Réservation nom, 2) Statuts notariés, 3) Dépôt capital, 4) Dossier ANPI, 5) RCCM. Liste documents requis et délais.",
        placeholder: "Ex: 1. Réserver nom (2 jours), 2. Rédiger statuts chez notaire (1 semaine)..."
      },
      {
        id: "juridique_3",
        question: "Comment allez-vous ouvrir un compte bancaire professionnel au Gabon ?",
        aiPrompt: "Liste 3-4 banques gabonaises (BGFI, Orabank, UGB, Ecobank) avec conditions d'ouverture compte pro : documents, dépôt minimum, frais mensuels.",
        placeholder: "Ex: BGFI Bank - Dépôt 500,000 FCFA, frais 5,000 FCFA/mois, documents : RCCM, statuts..."
      },
      {
        id: "juridique_4",
        question: "Quelles sont vos obligations fiscales et sociales au Gabon ?",
        aiPrompt: "Explique : 1) Impôts (IS, TVA, patente), 2) CNSS (cotisations employeur/employé), 3) Déclarations mensuelles/annuelles. Donne taux et échéances.",
        placeholder: "Ex: IS 30%, TVA 18%, CNSS 21% (16% employeur + 5% employé), déclaration mensuelle..."
      },
      {
        id: "juridique_5",
        question: "Avez-vous besoin d'un expert-comptable gabonais ? Si oui, comment le choisir ?",
        aiPrompt: "Recommande si expert-comptable nécessaire selon taille. Liste critères choix : inscription Ordre, expérience secteur, honoraires moyens au Gabon (50,000-200,000 FCFA/mois).",
        placeholder: "Ex: Oui, pour tenir comptabilité et déclarations fiscales. Honoraires ~100,000 FCFA/mois"
      }
    ]
  },
  {
    phase: 3,
    title: "Mise en Place Opérationnelle",
    objective: "Installer les infrastructures et recruter l'équipe",
    duration: "4-8 semaines",
    questions: [
      {
        id: "operationnel_1",
        question: "Quels équipements/matériels devez-vous acquérir en priorité ?",
        aiPrompt: "Liste équipements essentiels avec fournisseurs au Gabon et prix en FCFA. Distingue : équipements de base, mobilier, informatique, véhicule si nécessaire.",
        placeholder: "Ex: Ordinateurs (2x 400,000 FCFA chez Gabon Informatique), mobilier (300,000 FCFA)..."
      },
      {
        id: "operationnel_2",
        question: "Combien de personnes recruter au démarrage et pour quels postes ?",
        aiPrompt: "Propose organigramme initial réaliste pour le Gabon : nombre, postes, salaires moyens en FCFA, profils. Mentionne SMIG gabonais (150,000 FCFA).",
        placeholder: "Ex: 1 vendeur (200,000 FCFA), 1 assistant (150,000 FCFA), vous-même (gérant)"
      },
      {
        id: "operationnel_3",
        question: "Où et comment allez-vous recruter vos premiers employés au Gabon ?",
        aiPrompt: "Suggère canaux recrutement au Gabon : sites (Emploi.ga, JobGabon), réseaux sociaux, écoles/universités (Omar Bongo, USTM), bouche-à-oreille. Donne conseils entretien.",
        placeholder: "Ex: Publier annonce sur Emploi.ga, contacter USTM pour stagiaires, réseau LinkedIn Gabon"
      },
      {
        id: "operationnel_4",
        question: "Quels fournisseurs/partenaires locaux devez-vous identifier ?",
        aiPrompt: "Liste types de fournisseurs nécessaires au Gabon avec exemples : matières premières, services, logistique. Conseils négociation et paiement (cash/crédit 30j).",
        placeholder: "Ex: Fournisseur matières premières (Owendo), transporteur (DHL Gabon), imprimeur (Libreville)"
      },
      {
        id: "operationnel_5",
        question: "Comment allez-vous gérer la logistique et les stocks au Gabon ?",
        aiPrompt: "Explique gestion stocks adaptée au Gabon : rotation, stockage (entrepôt/local), inventaires, gestion ruptures. Mentionne contraintes locales (coupures électricité, etc.).",
        placeholder: "Ex: Stock minimum 1 mois, inventaire hebdomadaire, générateur pour conservation produits"
      }
    ]
  },
  {
    phase: 4,
    title: "Stratégie Marketing et Commerciale",
    objective: "Faire connaître l'offre et acquérir les premiers clients",
    duration: "En continu dès le lancement",
    questions: [
      {
        id: "marketing_1",
        question: "Comment allez-vous vous faire connaître auprès des Gabonais ?",
        aiPrompt: "Propose stratégie marketing adaptée au Gabon : réseaux sociaux (Facebook, WhatsApp Business), radio locale, flyers, bouche-à-oreille. Budget réaliste en FCFA.",
        placeholder: "Ex: Page Facebook + pub 50,000 FCFA/mois, flyers 100,000 FCFA, radio locale 200,000 FCFA"
      },
      {
        id: "marketing_2",
        question: "Quelle sera votre stratégie de prix en FCFA ?",
        aiPrompt: "Définit grille tarifaire en FCFA : prix de base, remises éventuelles, positionnement vs concurrence. Justifie par rapport pouvoir d'achat gabonais.",
        placeholder: "Ex: Prix unitaire 5,000 FCFA (vs concurrent 7,000 FCFA), remise 10% dès 10 unités"
      },
      {
        id: "marketing_3",
        question: "Comment allez-vous gérer les paiements clients au Gabon ?",
        aiPrompt: "Liste moyens de paiement acceptés au Gabon : cash (FCFA), mobile money (Airtel Money, Moov Money), virement bancaire, chèque. Avantages/risques de chacun.",
        placeholder: "Ex: Cash (70%), Airtel Money (20%), virement (10%). Pas de crédit au démarrage"
      },
      {
        id: "marketing_4",
        question: "Qui seront vos 10 premiers clients cibles au Gabon ?",
        aiPrompt: "Identifie profil client idéal au Gabon : particuliers/entreprises, quartier, pouvoir d'achat, besoins. Suggère 3-5 prospects concrets à démarcher en priorité.",
        placeholder: "Ex: PME à Akanda (10 entreprises identifiées), particuliers classe moyenne Mont-Bouët"
      },
      {
        id: "marketing_5",
        question: "Quelle sera votre présence en ligne (site web, réseaux sociaux) ?",
        aiPrompt: "Recommande présence digitale minimale pour le Gabon : site vitrine (coût 200,000-500,000 FCFA), Facebook, Instagram, WhatsApp Business. Fréquence publications.",
        placeholder: "Ex: Site vitrine (300,000 FCFA), page Facebook active (3 posts/semaine), WhatsApp Business"
      }
    ]
  },
  {
    phase: 5,
    title: "Lancement et Premiers Mois",
    objective: "Démarrer l'activité et ajuster selon les retours terrain",
    duration: "3-6 premiers mois",
    questions: [
      {
        id: "lancement_1",
        question: "Quelle date de lancement visez-vous et pourquoi ?",
        aiPrompt: "Suggère période favorable au Gabon : éviter saison des pluies si pertinent, profiter événements locaux, considérer budget disponible. Propose calendrier rétro-planifié.",
        placeholder: "Ex: Lancement 1er septembre (rentrée scolaire, forte demande), préparation juillet-août"
      },
      {
        id: "lancement_2",
        question: "Comment allez-vous organiser votre événement/action de lancement ?",
        aiPrompt: "Propose idée lancement adaptée au Gabon : inauguration, promotion spéciale, partenariat influenceur local, démonstration. Budget 100,000-500,000 FCFA.",
        placeholder: "Ex: Inauguration avec dégustation, invitation 50 prospects, budget 300,000 FCFA"
      },
      {
        id: "lancement_3",
        question: "Quels indicateurs allez-vous suivre chaque semaine/mois ?",
        aiPrompt: "Liste KPIs essentiels : CA en FCFA, nombre clients, panier moyen, taux conversion, trésorerie. Explique comment mesurer et objectifs réalistes premiers mois.",
        placeholder: "Ex: CA mensuel (objectif 1,000,000 FCFA mois 1), 20 clients, panier moyen 50,000 FCFA"
      },
      {
        id: "lancement_4",
        question: "Comment allez-vous gérer votre trésorerie les 6 premiers mois ?",
        aiPrompt: "Explique gestion trésorerie au Gabon : prévoir fonds roulement 3-6 mois, anticiper délais paiement clients, négocier délais fournisseurs. Tableau prévisionnel en FCFA.",
        placeholder: "Ex: Fonds roulement 2,000,000 FCFA, paiement fournisseurs 30j, clients cash immédiat"
      },
      {
        id: "lancement_5",
        question: "Quand et comment allez-vous ajuster votre offre selon les retours clients ?",
        aiPrompt: "Propose méthode collecte feedback au Gabon : enquêtes WhatsApp, appels clients, observation terrain. Fréquence revue offre (mensuelle). Critères ajustement.",
        placeholder: "Ex: Enquête WhatsApp après chaque vente, revue mensuelle, ajuster prix/produits selon demande"
      }
    ]
  }
]

// Fonction helper pour obtenir une phase
export function getActionPlanPhase(phaseNumber: number): ActionPlanPhase | undefined {
  return ACTION_PLAN_PHASES.find(p => p.phase === phaseNumber)
}

// Fonction helper pour obtenir toutes les questions
export function getAllActionPlanQuestions(): ActionPlanQuestion[] {
  return ACTION_PLAN_PHASES.flatMap(phase => phase.questions)
}
