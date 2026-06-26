"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Building2, User, MapPin, Phone, FileText, Send, Loader2, Sparkles } from 'lucide-react'

const LETTER_GEN_STEPS = ['Analyse du destinataire…', 'Structuration du courrier…', 'Rédaction du contenu…', 'Mise en forme…', 'Finalisation…']

interface GenerateLetterModalProps {
  isOpen: boolean
  onClose: () => void
  project: any
  userId: string
  onSuccess: (letter: any) => void
}

const RECIPIENT_TYPES = [
  { value: 'administration', label: 'Administration / Ministère' },
  { value: 'banque', label: 'Banque / Institution financière' },
  { value: 'partenaire', label: 'Partenaire commercial' },
  { value: 'investisseur', label: 'Investisseur' },
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'client', label: 'Client potentiel' },
  { value: 'autres', label: 'Autres' }
]

const LETTER_PURPOSES = [
  { value: 'demande_financement', label: 'Demande de financement' },
  { value: 'demande_autorisation', label: 'Demande d\'autorisation administrative' },
  { value: 'proposition_partenariat', label: 'Proposition de partenariat' },
  { value: 'demande_soutien', label: 'Demande de soutien institutionnel' },
  { value: 'presentation_projet', label: 'Présentation du projet' },
  { value: 'demande_rdv', label: 'Demande de rendez-vous' },
  { value: 'remerciement', label: 'Remerciement' },
  { value: 'relance', label: 'Relance / Suivi' },
  { value: 'autres', label: 'Autre objectif' }
]

export default function GenerateLetterModal({ isOpen, onClose, project, userId, onSuccess }: GenerateLetterModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Progression simulée pendant la génération IA du courrier
  useEffect(() => {
    if (!isGenerating) { setProgress(0); return }
    setProgress(5)
    const t = setInterval(() => setProgress(p => Math.min(93, p + 4)), 1400)
    return () => clearInterval(t)
  }, [isGenerating])
  const [formData, setFormData] = useState({
    recipientType: '',
    recipientName: '',
    recipientAddress: '',
    recipientContact: '',
    recipientPosition: '',
    letterSubject: '',
    letterPurpose: '',
    specificContext: '',
    specificRequests: ''
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.recipientType || !formData.recipientName || !formData.letterSubject || !formData.letterPurpose) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          projectId: project.id,
          ...formData
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess(data.letter)
        onClose()
        // Reset form
        setFormData({
          recipientType: '',
          recipientName: '',
          recipientAddress: '',
          recipientContact: '',
          recipientPosition: '',
          letterSubject: '',
          letterPurpose: '',
          specificContext: '',
          specificRequests: ''
        })
      } else {
        throw new Error(data.error || 'Erreur lors de la génération')
      }
    } catch (error: any) {
      console.error('❌ Erreur génération courrier:', error)
      alert(error.message || 'Erreur lors de la génération du courrier')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal - Bottom sheet sur mobile, centré sur desktop */}
        <motion.div
          className="relative z-10 w-full sm:max-w-4xl sm:mx-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 100, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.98 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Overlay de progression pendant la génération IA */}
          {isGenerating && (
            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur flex items-center justify-center p-6">
              <div className="text-center max-w-sm w-full">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#697357] to-[#4d553e] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-200 animate-pulse" />
                </div>
                <h3 className="font-bold text-slate-900">Génération du courrier…</h3>
                <p className="text-xs text-slate-500 mt-1">{LETTER_GEN_STEPS[Math.min(LETTER_GEN_STEPS.length - 1, Math.floor(progress / 20))]}</p>
                <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div animate={{ width: `${Math.round(progress)}%` }} transition={{ ease: 'easeOut', duration: 0.6 }} className="h-full bg-gradient-to-r from-[#8a9576] to-[#697357]" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> {Math.round(progress)}% · IA
                </div>
                <p className="text-[11px] text-slate-400 mt-3">Ne fermez pas cette fenêtre.</p>
              </div>
            </div>
          )}

          {/* Header - Compact sur mobile */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-gray-900 truncate">Générer un courrier</h3>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Courrier professionnel adapté à votre projet</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white transition-colors flex-shrink-0 ml-2">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Body - Scroll optimisé mobile */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
            <div className="space-y-5 sm:space-y-6">
              {/* Informations destinataire */}
              <div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Informations du destinataire
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Type de destinataire <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      value={formData.recipientType}
                      onChange={(e) => handleChange('recipientType', e.target.value)}
                    >
                      <option value="">Sélectionnez un type</option>
                      {RECIPIENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Nom du destinataire <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Ex: Ministère de l'Économie"
                      value={formData.recipientName}
                      onChange={(e) => handleChange('recipientName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Fonction du destinataire
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Ex: Directeur Général"
                      value={formData.recipientPosition}
                      onChange={(e) => handleChange('recipientPosition', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Contact
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Email ou téléphone"
                      value={formData.recipientContact}
                      onChange={(e) => handleChange('recipientContact', e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Adresse
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Adresse complète du destinataire"
                      value={formData.recipientAddress}
                      onChange={(e) => handleChange('recipientAddress', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Objet et objectif du courrier */}
              <div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  Objet et objectif du courrier
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Objectif du courrier <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                      value={formData.letterPurpose}
                      onChange={(e) => handleChange('letterPurpose', e.target.value)}
                    >
                      <option value="">Sélectionnez un objectif</option>
                      {LETTER_PURPOSES.map(purpose => (
                        <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Objet du courrier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Ex: Demande de financement pour projet d'agro-industrie"
                      value={formData.letterSubject}
                      onChange={(e) => handleChange('letterSubject', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Contexte spécifique
                    </label>
                    <textarea
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                      rows={2}
                      placeholder="Ajoutez des détails sur le contexte, les raisons de votre démarche..."
                      value={formData.specificContext}
                      onChange={(e) => handleChange('specificContext', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Demandes spécifiques
                    </label>
                    <textarea
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                      rows={2}
                      placeholder="Précisez ce que vous demandez, les actions attendues du destinataire..."
                      value={formData.specificRequests}
                      onChange={(e) => handleChange('specificRequests', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Info bulle */}
              <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>Astuce :</strong> Plus vous fournirez de détails, plus le courrier sera précis et adapté à votre situation.
                </p>
              </div>
            </div>
          </div>

          {/* Footer - Responsive avec boutons empilés sur mobile */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-medium text-sm sm:text-base"
              disabled={isGenerating}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isGenerating || !formData.recipientType || !formData.recipientName || !formData.letterSubject || !formData.letterPurpose}
              className="px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Génération en cours...</span>
                  <span className="sm:hidden">Génération...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Générer le courrier</span>
                  <span className="sm:hidden">Générer</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
