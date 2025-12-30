// Types pour le système de chat IA par projet

export type AIModelType = 'nano-gpt5' | 'agent-gpt4'

export interface ChatMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  credits_consumed: number
  created_at: string
}

export interface ChatConversation {
  id: string
  project_id: string
  user_id: string
  model_type: AIModelType
  created_at: string
  ended_at?: string
  total_messages: number
  total_credits_used: number
  conversation_summary?: string
  context_snapshot?: Record<string, any>
}

export interface AIModelOption {
  type: AIModelType
  name: string
  description: string
  icon: string
  color: string
  creditsPerMessage: number
  features: string[]
}

export const AI_MODELS: Record<AIModelType, AIModelOption> = {
  'nano-gpt5': {
    type: 'nano-gpt5',
    name: 'Expert Nano GPT-5',
    description: 'Modèle rapide et efficace pour des réponses précises',
    icon: '⚡',
    color: 'from-blue-500 to-cyan-600',
    creditsPerMessage: 5,
    features: [
      'Réponses rapides',
      'Conseils généraux',
      'Économique',
      'Parfait pour questions courtes'
    ]
  },
  'agent-gpt4': {
    type: 'agent-gpt4',
    name: 'Agent Spécialisé GPT-4',
    description: 'Agent expert avec analyse approfondie du contexte',
    icon: '🎯',
    color: 'from-purple-500 to-violet-600',
    creditsPerMessage: 15,
    features: [
      'Analyse approfondie',
      'Recommandations détaillées',
      'Contextualisation avancée',
      'Stratégies business complètes'
    ]
  }
}

export interface ChatContextData {
  project: {
    titre: string
    description: string
    secteur: string
    budget: string
    phase: string
    progression: number
  }
  cumulativeContext: Array<{
    type: string
    content: string
    date: string
  }>
  documents: Array<{
    type: string
    title: string
    summary: string
  }>
  planActionSteps?: Array<{
    step: number
    title: string
    status: string
  }>
  notes?: Array<{
    content: string
    date: string
  }>
}

export interface SendMessagePayload {
  conversationId?: string
  projectId: string
  userId: string
  modelType: AIModelType
  message: string
  contextData: ChatContextData
}

export interface SendMessageResponse {
  success: boolean
  conversationId: string
  message: ChatMessage
  creditsUsed: number
  error?: string
}
