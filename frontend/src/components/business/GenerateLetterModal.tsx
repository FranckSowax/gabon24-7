"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Building2, User, MapPin, Phone, FileText, Send, Loader2 } from 'lucide-react'

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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Générer un courrier</h3>
                <p className="text-sm text-gray-600">Courrier professionnel adapté à votre projet</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            <div className="space-y-6">
              {/* Informations destinataire */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Informations du destinataire
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de destinataire <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom du destinataire <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Ministère de l'Économie"
                      value={formData.recipientName}
                      onChange={(e) => handleChange('recipientName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fonction du destinataire
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Directeur Général"
                      value={formData.recipientPosition}
                      onChange={(e) => handleChange('recipientPosition', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Email ou téléphone"
                      value={formData.recipientContact}
                      onChange={(e) => handleChange('recipientContact', e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Adresse
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Adresse complète du destinataire"
                      value={formData.recipientAddress}
                      onChange={(e) => handleChange('recipientAddress', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Objet et objectif du courrier */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Objet et objectif du courrier
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Objectif du courrier <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Objet du courrier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Demande de financement pour projet d'agro-industrie"
                      value={formData.letterSubject}
                      onChange={(e) => handleChange('letterSubject', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contexte spécifique
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="Ajoutez des détails sur le contexte, les raisons de votre démarche..."
                      value={formData.specificContext}
                      onChange={(e) => handleChange('specificContext', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Demandes spécifiques
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="Précisez ce que vous demandez, les actions attendues du destinataire..."
                      value={formData.specificRequests}
                      onChange={(e) => handleChange('specificRequests', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Info bulle */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 <strong>Astuce :</strong> Plus vous fournirez de détails, plus le courrier sera précis et adapté à votre situation.
                  L'IA utilisera les informations de votre projet pour personnaliser le contenu.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-medium"
              disabled={isGenerating}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isGenerating || !formData.recipientType || !formData.recipientName || !formData.letterSubject || !formData.letterPurpose}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Générer le courrier
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
