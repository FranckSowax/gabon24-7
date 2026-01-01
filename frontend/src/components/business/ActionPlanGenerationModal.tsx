'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, Sparkles, ClipboardList, Target, TrendingUp, Users, FileCheck, X, AlertTriangle } from 'lucide-react'

interface ActionPlanGenerationModalProps {
  isOpen: boolean
  onCancel?: () => void
  creditsUsed?: number
}

const GENERATION_STEPS = [
  {
    id: 'analyze',
    label: 'Analyse du projet...',
    icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 1500
  },
  {
    id: 'market',
    label: 'Étude du contexte gabonais...',
    icon: <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 2000
  },
  {
    id: 'strategy',
    label: 'Élaboration de la stratégie...',
    icon: <Target className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 1500
  },
  {
    id: 'team',
    label: 'Planification des ressources...',
    icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 1500
  },
  {
    id: 'steps',
    label: 'Création des étapes d\'action...',
    icon: <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 2000
  },
  {
    id: 'finalize',
    label: 'Finalisation du plan...',
    icon: <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />,
    duration: 1500
  }
]

export default function ActionPlanGenerationModal({ isOpen, onCancel, creditsUsed = 25 }: ActionPlanGenerationModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0)
  const [completedSteps, setCompletedSteps] = React.useState<string[]>([])
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0)
      setCompletedSteps([])
      setShowCancelConfirm(false)
      return
    }

    const totalSteps = GENERATION_STEPS.length
    let stepIndex = 0

    const progressSteps = () => {
      if (stepIndex < totalSteps) {
        const currentStep = GENERATION_STEPS[stepIndex]

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

  const handleCancelClick = () => {
    setShowCancelConfirm(true)
  }

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false)
    onCancel?.()
  }

  if (!isOpen) return null

  const progress = ((completedSteps.length) / GENERATION_STEPS.length) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-4 sm:p-6 text-white flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Génération en cours</h3>
              </div>
              {onCancel && (
                <button
                  onClick={handleCancelClick}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Annuler"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-white/90 text-xs sm:text-sm">
              Création d'un plan d'action personnalisé en 5 étapes
            </p>
          </div>

          {/* Progress Bar */}
          <div className="px-4 sm:px-6 pt-4 flex-shrink-0">
            <div className="bg-gray-200 rounded-full h-2 sm:h-2.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"
              />
            </div>
            <p className="text-center text-xs sm:text-sm text-gray-600 mt-2">
              {Math.round(progress)}% complété
            </p>
          </div>

          {/* Steps List */}
          <div className="p-4 sm:p-6 space-y-2 sm:space-y-3 overflow-y-auto flex-1 overscroll-contain">
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
                    flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg transition-all
                    ${isCompleted ? 'bg-green-50 border border-green-200' : ''}
                    ${isCurrent ? 'bg-orange-50 border border-orange-200' : ''}
                    ${isPending ? 'bg-gray-50 border border-gray-200 opacity-50' : ''}
                  `}
                >
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 p-1.5 sm:p-2 rounded-lg
                    ${isCompleted ? 'bg-green-100 text-green-600' : ''}
                    ${isCurrent ? 'bg-orange-100 text-orange-600' : ''}
                    ${isPending ? 'bg-gray-100 text-gray-400' : ''}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </motion.div>
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`
                      text-xs sm:text-sm font-medium truncate
                      ${isCompleted ? 'text-green-700' : ''}
                      ${isCurrent ? 'text-orange-700' : ''}
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
                      <span className="text-[10px] sm:text-xs font-semibold text-green-600">
                        ✓
                      </span>
                    </motion.div>
                  )}
                  {isCurrent && (
                    <div className="flex-shrink-0">
                      <span className="text-[10px] sm:text-xs font-semibold text-orange-600">
                        ...
                      </span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-orange-600" />
                <span>Veuillez patienter...</span>
              </div>
              {onCancel && (
                <button
                  onClick={handleCancelClick}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Modal de confirmation d'annulation */}
        <AnimatePresence>
          {showCancelConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm w-full mx-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900">
                    Annuler la génération ?
                  </h4>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-xs sm:text-sm text-amber-800">
                    <strong>Attention :</strong> L'annulation consommera tout de même <strong>{creditsUsed} crédits</strong> car le traitement a déjà commencé.
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Voulez-vous vraiment annuler ? Cette action est irréversible.
                </p>

                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Continuer
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Annuler quand même
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  )
}
