'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, Loader2, CheckCircle2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionPlanModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  articleId?: string
  proposal: {
    titre: string
    description: string
    secteur?: string
    budget?: string
  }
  userContext?: any
  onPlanCreated?: (plan: any) => void
}

export default function ActionPlanModal({
  isOpen,
  onClose,
  userId,
  articleId,
  proposal,
  userContext,
  onPlanCreated
}: ActionPlanModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`${API_URL}/api/action-plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          articleId,
          proposal,
          userContext
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la génération du plan')
      }

      setSuccess(true)
      
      // Notifier le parent
      if (onPlanCreated) {
        onPlanCreated(data.plan)
      }

      // Ne pas fermer automatiquement - laisser l'utilisateur choisir

    } catch (err: any) {
      console.error('Erreur génération plan:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-black">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Rocket className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Plan d'Action Immédiat</h2>
                  <p className="text-sm opacity-90">Transformez cette opportunité en réalité</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{proposal.titre}</h3>
              <p className="text-gray-600 text-sm line-clamp-3">{proposal.description}</p>
              
              <div className="flex gap-2 mt-3">
                {proposal.secteur && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {proposal.secteur}
                  </span>
                )}
                {proposal.budget && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {proposal.budget}
                  </span>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                Votre plan d'action personnalisé
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>10 actions concrètes</strong> et actionnables</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Priorisées</strong> par ordre d'importance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Checklist interactive</strong> avec barre de progression</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Commentaires et pièces jointes</strong> pour chaque action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span><strong>Sauvegardé</strong> dans l'onglet "Plans d'action" de "Mes Projets"</span>
                </li>
              </ul>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
              >
                <p className="text-red-700 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Success */}
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-green-700 font-medium">Plan d'action créé avec succès !</p>
                </div>
                <p className="text-green-600 text-sm ml-8">
                  📋 Votre plan est enregistré dans l'onglet <strong>"Plans d'action"</strong> de <strong>"Mes Projets"</strong>
                </p>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {success ? (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => window.location.href = '/business/mes-projets?tab=plans'}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Rocket className="w-5 h-5" />
                    Visualiser mon plan
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={isGenerating}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5" />
                        Générer mon plan
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {isGenerating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-gray-500 mt-4"
              >
                ✨ Notre IA analyse votre opportunité et crée un plan personnalisé...
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
