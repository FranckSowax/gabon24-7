'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Sparkles, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import ApiErrorAlert from '@/components/common/ApiErrorAlert'

interface AIActionModalProps {
  isOpen: boolean
  onClose: () => void
  actionName: string
  actionIcon: React.ReactNode
  status: 'generating' | 'success' | 'error'
  progress?: number
  message?: string
  errorMessage?: string
  onRetry?: () => void
  onCancel?: () => void
  creditsUsed?: number
}

export default function AIActionModal({
  isOpen,
  onClose,
  actionName,
  actionIcon,
  status,
  progress = 0,
  message = 'Génération en cours...',
  errorMessage,
  onRetry,
  onCancel,
  creditsUsed = 0
}: AIActionModalProps) {
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)

  // Reset confirmation state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setShowCancelConfirm(false)
    }
  }, [isOpen])

  const handleCancelClick = () => {
    setShowCancelConfirm(true)
  }

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false)
    onCancel?.()
  }

  const getStatusColor = () => {
    switch (status) {
      case 'generating': return 'from-blue-500 to-purple-600'
      case 'success': return 'from-green-500 to-emerald-600'
      case 'error': return 'from-red-500 to-orange-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'generating': 
        return <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
      case 'success': 
        return <CheckCircle className="w-16 h-16 text-green-400" />
      case 'error': 
        return <AlertCircle className="w-16 h-16 text-red-400" />
      default: 
        return null
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={status !== 'generating' ? onClose : undefined}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-white/10 overflow-hidden"
            >
              {/* Header avec gradient */}
              <div className={`bg-gradient-to-r ${getStatusColor()} p-6 relative`}>
                {status !== 'generating' && (
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                )}
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    {actionIcon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{actionName}</h2>
                    <p className="text-white/80 text-sm">
                      {status === 'generating' && 'Génération IA en cours...'}
                      {status === 'success' && 'Génération terminée !'}
                      {status === 'error' && 'Erreur de génération'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Erreur avec ApiErrorAlert */}
                {status === 'error' && errorMessage && (
                  <ApiErrorAlert 
                    error={errorMessage}
                    onRetry={onRetry}
                    showRetry={!!onRetry}
                  />
                )}

                {/* Status Icon (sauf erreur) */}
                {status !== 'error' && (
                  <div className="flex justify-center">
                    {getStatusIcon()}
                  </div>
                )}

                {/* Message (sauf erreur) */}
                {status !== 'error' && (
                  <div className="text-center">
                    <p className="text-white text-lg font-medium mb-2">
                      {message}
                    </p>
                    
                    {status === 'generating' && (
                      <p className="text-gray-400 text-sm">
                        Cela peut prendre quelques secondes...
                      </p>
                    )}

                    {status === 'success' && (
                      <p className="text-gray-400 text-sm">
                        Le document a été généré avec succès
                      </p>
                    )}
                  </div>
                )}

                {/* Progress Bar (only for generating) */}
                {status === 'generating' && (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                      />
                    </div>
                    <p className="text-center text-sm text-gray-400">
                      {progress}%
                    </p>
                  </div>
                )}

                {/* Actions */}
                {status === 'success' && (
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
                    >
                      Voir le document
                    </button>
                  </div>
                )}

                {status === 'error' && !onRetry && (
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                )}

                {/* Info supplémentaire et bouton annuler pour generating */}
                {status === 'generating' && (
                  <>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-gray-300">
                          <p className="font-medium text-white mb-1">Intelligence Artificielle</p>
                          <p>Notre IA analyse votre projet et génère un document personnalisé adapté au contexte gabonais.</p>
                        </div>
                      </div>
                    </div>

                    {/* Bouton annuler */}
                    {onCancel && (
                      <button
                        onClick={handleCancelClick}
                        className="w-full px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium border border-gray-700 hover:border-red-500/30"
                      >
                        Annuler la génération
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Modal de confirmation d'annulation */}
            <AnimatePresence>
              {showCancelConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
                  onClick={(e) => e.stopPropagation()}
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
                        <strong>Attention :</strong> L'annulation consommera tout de même{' '}
                        <strong>{creditsUsed} crédits</strong> car le traitement a déjà commencé.
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
