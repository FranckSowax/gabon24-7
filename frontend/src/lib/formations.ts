// Données de référence — Formations Entrepreneur BCEG

export interface FormationLevel {
  level: number
  title: string
  tagline: string
  financingCeiling: string // libellé affiché
  color: string // gradient tailwind
  topics: string[]
}

export const FORMATION_LEVELS: FormationLevel[] = [
  {
    level: 1,
    title: 'Niveau 1 — Fondamentaux',
    tagline: 'Les bases pour lancer et gérer son business au Gabon',
    financingCeiling: "Jusqu'à 1 000 000 FCFA",
    color: 'from-[#697357] to-[#4d553e]',
    topics: [
      'Valider son idée & son marché',
      'Modèle économique simple',
      'Bases de gestion & trésorerie (FCFA)',
      'Formalités : RCCM, NIF, OHADA',
      'Vendre & trouver ses premiers clients',
    ],
  },
  {
    level: 2,
    title: 'Niveau 2 — Développement',
    tagline: 'Structurer et faire croître une activité rentable',
    financingCeiling: "Jusqu'à 5 000 000 FCFA",
    color: 'from-[#8a9576] to-[#697357]',
    topics: [
      'Comptabilité & pilotage par les chiffres',
      'Business plan complet & prévisionnel',
      'Marketing digital & acquisition',
      'Gestion d\'équipe & organisation',
      'Fournisseurs, stocks & marges',
    ],
  },
  {
    level: 3,
    title: 'Niveau 3 — Croissance',
    tagline: 'Lever des fonds et changer d\'échelle',
    financingCeiling: 'Au-delà de 5 000 000 FCFA',
    color: 'from-[#4d553e] to-[#3a4030]',
    topics: [
      'Préparer une levée de fonds',
      'Stratégie de croissance & scaling',
      'Partenariats & appels d\'offres',
      'Gestion avancée & gouvernance',
      'Pitch investisseurs & BCEG',
    ],
  },
]

export const GABON_PROVINCES = [
  'Estuaire',
  'Haut-Ogooué',
  'Moyen-Ogooué',
  'Ngounié',
  'Nyanga',
  'Ogooué-Ivindo',
  'Ogooué-Lolo',
  'Ogooué-Maritime',
  'Woleu-Ntem',
]

export const FORMATION_SECTORS = [
  'Agriculture & élevage',
  'Commerce & distribution',
  'Restauration & alimentaire',
  'Numérique & technologie',
  'Services',
  'Artisanat & mode',
  'BTP & immobilier',
  'Transport & logistique',
  'Tourisme & événementiel',
  'Santé & bien-être',
  'Éducation & formation',
  'Autre',
]

export const PROJECT_STAGES = [
  { value: 'idee', label: 'Simple idée' },
  { value: 'en_cours', label: 'En cours de lancement' },
  { value: 'existant', label: 'Activité déjà existante' },
]

export const FORMATION_FORMATS = [
  { value: 'distanciel', label: 'Distanciel' },
  { value: 'presentiel', label: 'Présentiel' },
  { value: 'les_deux', label: 'Les deux' },
]
