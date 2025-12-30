// Types pour le système de suivi business

export type ProjectPhase = 
  | 'idea'           // Idée initiale
  | 'analysis'       // Analyse approfondie
  | 'planning'       // Planification
  | 'preparation'    // Préparation/Formation
  | 'business_plan'  // Business Plan
  | 'launch'         // Lancement
  | 'success'        // Réussite

export type StepStatus = 'todo' | 'in_progress' | 'completed'

export interface ActionStep {
  step: number
  title: string
  description?: string
  status: StepStatus
  completed_at?: string
}

export interface ContextElement {
  id?: string
  date: string
  type: 'budget' | 'resource' | 'contact' | 'skill' | 'constraint' | 'other'
  content: string
  author?: string
}

export interface AIAction {
  id: string
  project_id: string
  user_id: string
  action_type: string
  credits_consumed: number
  context_snapshot?: Record<string, any>
  result_content?: string
  created_at: string
}

export interface EnhancedProject {
  // Champs existants
  id: string
  user_id: string
  article_title: string
  article_summary: string
  article_url: string
  article_image_url?: string
  article_source?: string
  article_published_at?: string
  problematique_centrale: string
  secteur_principal: string
  secteur_selectionne: string
  budget_selectionne: string
  proposition_titre: string
  proposition_description: string
  proposition_investissement: string
  proposition_rentabilite: string
  proposition_revenus_mensuels: string
  proposition_actions_immediates: string[]
  proposition_avantages_concurrentiels: string[]
  proposition_score_faisabilite: number
  user_context?: any
  created_at: string
  updated_at?: string
  
  // Nouveaux champs de tracking
  current_phase: ProjectPhase
  progress_percentage: number
  total_credits_used: number
  context_updated_at?: string
  plan_action_steps: ActionStep[]
  cumulative_context: ContextElement[]
}

export interface AddContextFormData {
  type: ContextElement['type']
  content: string
}

export interface ReAnalysisContext {
  initialAnalysis: string
  cumulativeContext: ContextElement[]
  documents: Array<{
    type: string
    content: string
    summary?: string
  }>
  notes: Array<{
    content: string
    date: string
  }>
  budget: string
  sector: string
  planActionSteps?: ActionStep[]
}

export interface CreditTransaction {
  action_type: string
  credits_needed: number
  description: string
}

export const CREDIT_COSTS: Record<string, number> = {
  initial_analysis: 25,
  re_analysis: 25,
  'action-plan': 25,
  'skill-test': 30,
  'custom-training': 50,
  'business-plan': 100
}

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  idea: '💡 Idée',
  analysis: '🔍 Analyse',
  planning: '📋 Planification',
  preparation: '🎓 Préparation',
  business_plan: '📊 Business Plan',
  launch: '🚀 Lancement',
  success: '✅ Réussite'
}

export const CONTEXT_TYPE_LABELS: Record<ContextElement['type'], string> = {
  budget: '💰 Budget',
  resource: '🔧 Ressource',
  contact: '👤 Contact',
  skill: '🎯 Compétence',
  constraint: '⚠️ Contrainte',
  other: '📝 Autre'
}
