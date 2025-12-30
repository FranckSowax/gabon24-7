'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Clock, MapPin, DollarSign, Target, Lightbulb, Briefcase, GraduationCap } from 'lucide-react'

interface UserContext {
  situation: string
  competences: string[]
  disponibilite: string
  budget_personnel: string
  objectif_delai: string
  contraintes: string
  experience_entrepreneuriale: string
  secteurs_interesse: string[]
}

interface PersonalizationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (context: UserContext) => void
  isLoading?: boolean
}

const situationOptions = [
  { value: 'salarié', label: 'Salarié', icon: '👔' },
  { value: 'étudiant', label: 'Étudiant', icon: '🎓' },
  { value: 'entrepreneur', label: 'Entrepreneur', icon: '🚀' },
  { value: 'chercheur_emploi', label: 'Chercheur d\'emploi', icon: '🔍' },
  { value: 'retraité', label: 'Retraité', icon: '🏖️' },
  { value: 'autre', label: 'Autre', icon: '💼' }
]

const competencesOptions = [
  'Commerce/Vente', 'Marketing Digital', 'Informatique/Tech', 'Gestion/Comptabilité',
  'Communication', 'Langues étrangères', 'Artisanat', 'Service client',
  'Logistique/Transport', 'Agriculture', 'Éducation/Formation', 'Santé/Bien-être'
]

const disponibiliteOptions = [
  { value: 'temps_partiel', label: 'Temps partiel (soirs/weekends)' },
  { value: 'temps_complet', label: 'Temps complet' },
  { value: 'weekends', label: 'Weekends uniquement' },
  { value: 'soirées', label: 'Soirées uniquement' }
]

const experienceOptions = [
  { value: 'débutant', label: 'Débutant (première fois)' },
  { value: 'intermédiaire', label: 'Intermédiaire (quelques expériences)' },
  { value: 'expérimenté', label: 'Expérimenté (plusieurs businesses)' }
]

export default function PersonalizationModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}: PersonalizationModalProps) {
  const [formData, setFormData] = useState<UserContext>({
    situation: '',
    competences: [],
    disponibilite: '',
    budget_personnel: '',
    objectif_delai: '',
    contraintes: '',
    experience_entrepreneuriale: '',
    secteurs_interesse: []
  })

  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

  const handleCompetenceToggle = (competence: string) => {
    setFormData(prev => ({
      ...prev,
      competences: prev.competences.includes(competence)
        ? prev.competences.filter(c => c !== competence)
        : [...prev.competences, competence]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const canProceed = () => {
    switch(currentStep) {
      case 1: return formData.situation && formData.experience_entrepreneuriale
      case 2: return formData.competences.length > 0
      case 3: return formData.disponibilite && formData.objectif_delai
      case 4: return formData.budget_personnel
      default: return false
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">🎯 Personnalisez votre proposition</h2>
              <p className="text-gray-400 text-sm mt-1">
                Étape {currentStep} sur {totalSteps} - Parlons de vous !
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="bg-gray-800 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Situation & Expérience */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Quelle est votre situation actuelle ?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {situationOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, situation: option.value }))}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          formData.situation === option.value
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span className="text-lg mr-2">{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Votre expérience entrepreneuriale ?
                  </label>
                  <div className="space-y-2">
                    {experienceOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, experience_entrepreneuriale: option.value }))}
                        className={`w-full p-3 rounded-lg border transition-all text-left ${
                          formData.experience_entrepreneuriale === option.value
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Compétences */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Quelles sont vos compétences principales ? (Sélectionnez plusieurs)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {competencesOptions.map(competence => (
                      <button
                        key={competence}
                        type="button"
                        onClick={() => handleCompetenceToggle(competence)}
                        className={`p-3 rounded-lg border transition-all text-left text-sm ${
                          formData.competences.includes(competence)
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {competence}
                        {formData.competences.includes(competence) && (
                          <span className="float-right">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    {formData.competences.length} compétence(s) sélectionnée(s)
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Disponibilité & Objectifs */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Votre disponibilité ?
                  </label>
                  <div className="space-y-2">
                    {disponibiliteOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, disponibilite: option.value }))}
                        className={`w-full p-3 rounded-lg border transition-all text-left ${
                          formData.disponibilite === option.value
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Dans combien de temps souhaitez-vous lancer ?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['1_mois', '3_mois', '6_mois', '1_an'].map(delai => (
                      <button
                        key={delai}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, objectif_delai: delai }))}
                        className={`p-3 rounded-lg border transition-all text-center ${
                          formData.objectif_delai === delai
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {delai.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Budget & Contraintes */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-white font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Budget personnel disponible (en plus du budget principal) ?
                  </label>
                  <select
                    value={formData.budget_personnel}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget_personnel: e.target.value }))}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Sélectionnez votre budget</option>
                    <option value="0-50000">0 - 50,000 XAF</option>
                    <option value="50000-100000">50,000 - 100,000 XAF</option>
                    <option value="100000-200000">100,000 - 200,000 XAF</option>
                    <option value="200000+">Plus de 200,000 XAF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-3">
                    Contraintes particulières ? (optionnel)
                  </label>
                  <textarea
                    value={formData.contraintes}
                    onChange={(e) => setFormData(prev => ({ ...prev, contraintes: e.target.value }))}
                    placeholder="Ex: Pas de stock, uniquement digital, besoin d'horaires flexibles..."
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                  />
                </div>
              </motion.div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>

              <div className="flex gap-3">
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    disabled={!canProceed()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canProceed() || isLoading}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Génération...
                      </>
                    ) : (
                      <>
                        ✨ Créer ma proposition
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
