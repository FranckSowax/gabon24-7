import React from 'react'
import { TrendingUp, CheckCircle2, Circle, Clock, Zap, Lock, FileText } from 'lucide-react'

interface ProgressBarProps {
  progress: number
  totalSteps?: number
  completedSteps?: number
  phase?: string
  showDetails?: boolean
}

const PHASES = {
  idea: { label: '💡 Idée', color: 'from-gray-500 to-gray-600' },
  analysis: { label: '🔍 Analyse', color: 'from-blue-500 to-cyan-600' },
  planning: { label: '📋 Planification', color: 'from-purple-500 to-violet-600' },
  preparation: { label: '🎓 Préparation', color: 'from-orange-500 to-red-600' },
  business_plan: { label: '📊 Business Plan', color: 'from-green-500 to-emerald-600' },
  launch: { label: '🚀 Lancement', color: 'from-yellow-500 to-orange-500' },
  success: { label: '✅ Réussite', color: 'from-green-600 to-emerald-700' }
}

export default function ProgressBar({ 
  progress, 
  totalSteps = 0, 
  completedSteps = 0,
  phase = 'idea',
  showDetails = true 
}: ProgressBarProps) {
  const currentPhase = PHASES[phase as keyof typeof PHASES] || PHASES.idea

  return (
    <div className="space-y-3">
      {/* Header */}
      {showDetails && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              Progression globale
            </span>
            <span className={`px-2 py-0.5 bg-gradient-to-r ${currentPhase.color} text-white text-xs font-bold rounded-full`}>
              {currentPhase.label}
            </span>
          </div>
          
          {totalSteps > 0 && (
            <span className="text-sm font-bold text-yellow-400">
              {completedSteps}/{totalSteps} étapes
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/20">
          <div 
            className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 transition-all duration-700 ease-out relative overflow-hidden"
            style={{ width: `${Math.min(progress, 100)}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        
        {/* Percentage badge */}
        <div className="absolute -top-1 transition-all duration-700 ease-out" style={{ left: `calc(${Math.min(progress, 100)}% - 20px)` }}>
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-white">
            {progress}%
          </div>
        </div>
      </div>

      {/* Milestones */}
      {showDetails && totalSteps > 0 && (
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            {completedSteps} complétées
          </span>
          {completedSteps < totalSteps && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-400" />
              {totalSteps - completedSteps} restantes
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Composant pour afficher les étapes du plan d'action
interface ActionStepProps {
  step: {
    step: number
    title: string
    description?: string
    status: 'todo' | 'in_progress' | 'completed'
  }
  onToggleStatus?: (step: number) => void
  onOpenAction?: (step: any) => void
  onNavigateToBusinessPlan?: () => void
}

export function ActionStep({ step, onToggleStatus, onOpenAction, onNavigateToBusinessPlan }: ActionStepProps) {
  // Détecter si l'étape concerne le business plan
  const isBusinessPlanStep = step.title.toLowerCase().includes('business plan') ||
                             step.description?.toLowerCase().includes('business plan')
  
  // Bloquer l'étape business plan si elle n'est pas complétée
  const isBlocked = isBusinessPlanStep && step.status !== 'completed'
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-orange-400 animate-pulse" />
      default:
        return <Circle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (step.status) {
      case 'completed':
        return 'bg-green-500/20 border-green-500/50'
      case 'in_progress':
        return 'bg-orange-500/20 border-orange-500/50'
      default:
        return 'bg-white/5 border-white/10'
    }
  }

  // Rendu spécial pour étapes business plan bloquées
  if (isBlocked && onNavigateToBusinessPlan) {
    return (
      <div className="p-3 sm:p-4 rounded-lg border-2 bg-gray-500/10 border-gray-500/30 opacity-60 relative">
        {/* Badge bloqué */}
        <div className="absolute -top-2 -right-2 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Bloqué
        </div>
        
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <Lock className="w-5 h-5 text-gray-500" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm sm:text-base text-gray-400">
                {step.step}. {step.title}
              </h4>
              
              <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                <p className="text-xs text-orange-200 mb-2">
                  📊 Cette étape nécessite la création d'un Business Plan. Utilisez l'outil dédié pour créer votre ébauche de business plan professionnel.
                </p>
                <button
                  onClick={onNavigateToBusinessPlan}
                  className="w-full sm:w-auto text-xs sm:text-sm px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <FileText className="w-4 h-4" />
                  Créer mon Business Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${getStatusColor()}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {getStatusIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <h4 className={`font-semibold text-sm sm:text-base flex-1 ${step.status === 'completed' ? 'text-green-300 line-through' : 'text-white'}`}>
              {step.step}. {step.title}
            </h4>
            
            <div className="flex gap-2 flex-shrink-0">
              {onOpenAction && step.status !== 'completed' && !isBlocked && (
                <button
                  onClick={() => onOpenAction(step)}
                  className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold transition-all flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                  Action
                </button>
              )}
              
              {onToggleStatus && step.status !== 'completed' && !isBlocked && (
                <button
                  onClick={() => onToggleStatus(step.step)}
                  className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                >
                  ✓ Marquer
                </button>
              )}
            </div>
          </div>
          
          {step.description && (
            <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">{step.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
