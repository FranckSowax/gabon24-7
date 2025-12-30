"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingCart, CreditCard, Printer } from 'lucide-react'

interface TrainingSummaryModalProps {
  open: boolean
  onClose: () => void
  training: any
  trainingId: string | null
  userId?: string
  onNeedsTopUp?: () => void
}

export default function TrainingSummaryModal({ open, onClose, training, trainingId, userId, onNeedsTopUp }: TrainingSummaryModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isPurchasing, setIsPurchasing] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    // Reset selection when training changes
    setSelected(new Set())
  }, [trainingId])

  const modules = Array.isArray(training?.modules) ? training.modules : []
  const moduleCount = modules.length
  const perModule = training?.pricing?.per_module ?? null
  const fullTraining = training?.pricing?.full_training ?? null

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handlePurchase = async (type: 'full' | 'module') => {
    if (!trainingId) {
      alert('Formation manquante. Veuillez régénérer la formation.')
      return
    }
    if (type === 'module' && selected.size === 0) {
      alert('Sélectionnez au moins un module')
      return
    }
    
    setIsPurchasing(true)
    
    // SIMULATION DÉMO : Pas d'appel API réel
    try {
      // Simuler un délai de paiement
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      console.log('🎓 Achat simulé (DÉMO):', {
        type,
        trainingId,
        moduleIds: type === 'module' ? Array.from(selected) : 'all'
      })
      
      // Si l'ID est temporaire, stocker les données en sessionStorage
      if (trainingId.startsWith('temp_')) {
        console.log('💾 Stockage données formation temporaire en sessionStorage');
        sessionStorage.setItem(`training_${trainingId}`, JSON.stringify(training));
      }
      
      // Construire l'URL avec les modules sélectionnés
      const moduleParams = type === 'module' 
        ? `&modules=${Array.from(selected).join(',')}` 
        : ''
      
      // Rediriger vers la page de formation
      window.location.href = `/training/${trainingId}?purchased=true${moduleParams}`
      
    } catch (e: any) {
      console.error('Purchase error:', e)
      alert(e?.message || 'Erreur lors de l\'achat')
      setIsPurchasing(false)
    }
  }

  const handlePrint = () => {
    try {
      window.print()
    } catch (e) {}
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-3xl mx-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-900/60 to-slate-800/40">
              <h3 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  {training?.title || 'Sommaire de la formation'}
                </span>
              </h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-white overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Instructions */}
              <div className="mb-6 p-4 rounded-xl bg-blue-500/20 border border-blue-400/30">
                <h4 className="font-bold text-blue-300 mb-2">📚 Comment ça marche ?</h4>
                <ol className="text-sm text-gray-200 space-y-1 list-decimal pl-5">
                  <li>Cochez les modules qui vous intéressent OU achetez la formation complète</li>
                  <li>Cliquez sur "Acheter" (paiement simulé en démo)</li>
                  <li>Les modules seront générés progressivement avec l'IA</li>
                  <li>Consultez votre formation personnalisée !</li>
                </ol>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mb-4">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">{moduleCount} modules</span>
                {training?.execution_margin && (
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10">Marge: {training.execution_margin}</span>
                )}
                {selected.size > 0 && (
                  <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-400/30 text-green-300 font-semibold">
                    ✓ {selected.size} module{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Modules list */}
              <ol className="space-y-3 list-decimal pl-5 mb-6">
                {modules.map((m: any, idx: number) => {
                  const moduleId = Number(m.id) || (idx + 1);
                  const isSelected = selected.has(moduleId);
                  
                  return (
                    <li key={idx} className={`
                      rounded-lg border p-4 transition-all
                      ${isSelected 
                        ? 'bg-green-500/10 border-green-400/30' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }
                    `}>
                      <div className="flex items-start justify-between gap-4">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => toggleSelect(moduleId)}
                        >
                          <div className="font-semibold text-yellow-300 mb-1">
                            {m.competence}
                          </div>
                          {m.objective && (
                            <div className="text-sm text-gray-300">{m.objective}</div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span>⏱️ {m.duration}</span>
                            <span>📊 {m.priority}</span>
                            <span>🎯 {m.level}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 pt-1">
                          <label className="cursor-pointer flex items-center">
                            <input
                              type="checkbox"
                              className="w-5 h-5 text-green-500 rounded cursor-pointer accent-green-500"
                              checked={isSelected}
                              onChange={() => toggleSelect(moduleId)}
                            />
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Footer avec boutons */}
            <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-slate-900/60 to-slate-800/40">
              {/* Pricing */}
              <div className="mb-4 text-sm text-gray-200">
                {perModule != null && (
                  <div>💰 Prix par module: <span className="font-semibold text-yellow-300">{perModule} crédits</span></div>
                )}
                {fullTraining != null && (
                  <div>🎓 Formation complète: <span className="font-semibold text-orange-300">{fullTraining} crédits</span></div>
                )}
              </div>

              {/* Bouton accès direct si formation existe déjà */}
              {trainingId && !trainingId.startsWith('temp_') && (
                <div className="mb-4">
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg text-lg"
                    onClick={() => window.location.href = `/training/${trainingId}?purchased=true`}
                  >
                    📖 Accéder à la formation complète
                  </button>
                  <p className="text-center text-xs text-gray-300 mt-2">
                    ✅ Formation déjà générée - Cliquez pour consulter vos modules
                  </p>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                  onClick={() => handlePurchase('full')}
                  disabled={isPurchasing}
                >
                  {isPurchasing ? (
                    <>⏳ Traitement...</>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Formation complète
                    </>
                  )}
                </button>
                
                <button
                  className={`
                    inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all
                    ${selected.size > 0
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                      : 'bg-white/10 border border-white/20 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  onClick={() => handlePurchase('module')}
                  disabled={isPurchasing || selected.size === 0}
                >
                  {isPurchasing ? (
                    <>⏳ Traitement...</>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Modules ({selected.size})
                    </>
                  )}
                </button>
                
                <button
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-all"
                  onClick={handlePrint}
                >
                  <Printer className="w-5 h-5" />
                  Imprimer
                </button>
              </div>

              {selected.size === 0 && (
                <p className="mt-3 text-xs text-center text-gray-400">
                  💡 Sélectionnez au moins un module ou achetez la formation complète
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
