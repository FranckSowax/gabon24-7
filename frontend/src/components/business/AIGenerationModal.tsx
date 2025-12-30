'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, Sparkles, FileText, Target, TrendingUp, Users, DollarSign } from 'lucide-react'

interface AIGenerationModalProps {
  isOpen: boolean
  onClose?: () => void
}

interface GenerationStep {
  id: string
  label: string
  icon: React.ReactNode
  duration: number // en millisecondes
}

const GENERATION_STEPS: GenerationStep[] = [
  {
    id: 'analyze',
    label: 'Analyse de votre idée...',
    icon: <Sparkles className="w-5 h-5" />,
    duration: 2000
  },
  {
    id: 'market',
    label: 'Étude du marché gabonais...',
    icon: <TrendingUp className="w-5 h-5" />,
    duration: 2500
  },
  {
    id: 'audience',
    label: 'Identification de la cible...',
    icon: <Users className="w-5 h-5" />,
    duration: 2000
  },
  {
    id: 'strategy',
    label: 'Élaboration de la stratégie...',
    icon: <Target className="w-5 h-5" />,
    duration: 2500
  },
  {
    id: 'financial',
    label: 'Modèle financier...',
    icon: <DollarSign className="w-5 h-5" />,
    duration: 2000
  },
  {
    id: 'document',
    label: 'Génération du document cadre...',
    icon: <FileText className="w-5 h-5" />,
    duration: 3000
  }
]

export default function AIGenerationModal({ isOpen, onClose }: AIGenerationModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) {
      // Reset quand le modal se ferme
      setCurrentStepIndex(0)
      setCompletedSteps([])
      return
    }

    // Simuler la progression des étapes
    const totalSteps = GENERATION_STEPS.length
    let stepIndex = 0

    const progressSteps = () => {
      if (stepIndex < totalSteps) {
        const currentStep = GENERATION_STEPS[stepIndex]
        
        // Marquer l'étape comme complétée après sa durée
        const timer = setTimeout(() => {
          setCompletedSteps(prev => [...prev, currentStep.id])
          stepIndex++
          
          if (stepIndex < totalSteps) {
            setCurrentStepIndex(stepIndex)
            progressSteps()
          }
        }, currentStep.duration)

        return () => clearTimeout(timer)
      }
    }

    progressSteps()
  }, [isOpen])

  if (!isOpen) return null

  const progress = ((completedSteps.length) / GENERATION_STEPS.length) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Génération IA en cours</h3>
            </div>
            <p className="text-white/90 text-sm">
              Notre IA analyse votre projet et génère un document cadre personnalisé
            </p>
          </div>

          {/* Progress Bar */}
          <div className="px-6 pt-4">
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
              />
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
              {Math.round(progress)}% complété
            </p>
          </div>

          {/* Steps List */}
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {GENERATION_STEPS.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id)
              const isCurrent = index === currentStepIndex && !isCompleted
              const isPending = index > currentStepIndex

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-all
                    ${isCompleted ? 'bg-green-50 border border-green-200' : ''}
                    ${isCurrent ? 'bg-purple-50 border border-purple-200' : ''}
                    ${isPending ? 'bg-gray-50 border border-gray-200 opacity-50' : ''}
                  `}
                >
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 p-2 rounded-lg
                    ${isCompleted ? 'bg-green-100 text-green-600' : ''}
                    ${isCurrent ? 'bg-purple-100 text-purple-600' : ''}
                    ${isPending ? 'bg-gray-100 text-gray-400' : ''}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1">
                    <p className={`
                      text-sm font-medium
                      ${isCompleted ? 'text-green-700' : ''}
                      ${isCurrent ? 'text-purple-700' : ''}
                      ${isPending ? 'text-gray-500' : ''}
                    `}>
                      {step.label}
                    </p>
                  </div>

                  {/* Status Badge */}
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex-shrink-0"
                    >
                      <span className="text-xs font-semibold text-green-600">
                        ✓ Terminé
                      </span>
                    </motion.div>
                  )}
                  {isCurrent && (
                    <div className="flex-shrink-0">
                      <span className="text-xs font-semibold text-purple-600">
                        En cours...
                      </span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Veuillez patienter, cela peut prendre quelques secondes...</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
