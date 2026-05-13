'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Clock, DollarSign, Target, Briefcase, GraduationCap, ArrowRight } from 'lucide-react'

export interface BudgetOption {
  id: string
  name: string
  range: string
  color?: string
  description?: string
  icon?: React.ComponentType<any>
}

interface UserContextInline {
  situation: string
  competences: string[]
  disponibilite: string
  objectif_delai: string
  contraintes: string
  experience_entrepreneuriale: string
  budget_principal: string // id of selected budget option
}

interface PersonalizationFormInlineProps {
  budgetOptions: BudgetOption[]
  onSubmit: (context: UserContextInline) => void
  isLoading?: boolean
  onSaveProfile?: (context: UserContextInline) => Promise<void>
  userId?: string | null
  initialContext?: UserContextInline | null
}

export default function PersonalizationFormInline({ budgetOptions, onSubmit, isLoading = false, onSaveProfile, userId, initialContext }: PersonalizationFormInlineProps) {
  const [step, setStep] = useState(1)
  const totalSteps = 4
  const [savingProfile, setSavingProfile] = useState(false)
  const [form, setForm] = useState<UserContextInline>(initialContext || {
    situation: '',
    competences: [],
    disponibilite: '',
    objectif_delai: '',
    contraintes: '',
    experience_entrepreneuriale: '',
    budget_principal: ''
  })

  // Mettre à jour le formulaire quand initialContext change
  useEffect(() => {
    if (initialContext) {
      setForm(initialContext)
    }
  }, [initialContext])

  const toggleCompetence = (value: string) => {
    setForm(prev => ({
      ...prev,
      competences: prev.competences.includes(value)
        ? prev.competences.filter(v => v !== value)
        : [...prev.competences, value]
    }))
  }

  const canNext = () => {
    switch (step) {
      case 1: return form.situation && form.experience_entrepreneuriale
      case 2: return form.competences.length > 0
      case 3: return form.disponibilite && form.objectif_delai
      case 4: return form.budget_principal
      default: return false
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canNext()) return
    onSubmit(form)
  }

  const handleSaveProfile = async () => {
    if (!onSaveProfile || !userId || !canNext()) return
    setSavingProfile(true)
    try {
      await onSaveProfile(form)
    } catch (error) {
      console.error('❌ Erreur sauvegarde profil:', error)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress */}
      <div>
        <div className="bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-[#6a7556] to-[#4d553e] h-2 rounded-full transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-gray-400 text-xs mt-2">Étape {step} sur {totalSteps}</p>
      </div>

      {/* Step 1: Situation & Expérience */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Votre situation
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['salarié','étudiant','entrepreneur','chercheur_emploi','retraité','autre'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, situation: value }))}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    form.situation === value ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {value.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Votre expérience entrepreneuriale
            </label>
            <div className="space-y-2">
              {[
                { value: 'débutant', label: 'Débutant (première fois)' },
                { value: 'intermédiaire', label: 'Intermédiaire (quelques expériences)' },
                { value: 'expérimenté', label: 'Expérimenté (plusieurs businesses)' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, experience_entrepreneuriale: opt.value }))}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    form.experience_entrepreneuriale === opt.value ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Compétences */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Vos compétences (multi-sélection)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['Commerce/Vente','Marketing Digital','Informatique/Tech','Gestion/Comptabilité','Communication','Langues étrangères','Artisanat','Service client','Logistique/Transport','Agriculture','Éducation/Formation','Santé/Bien-être'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCompetence(c)}
                  className={`p-3 rounded-lg border transition-all text-left text-sm ${
                    form.competences.includes(c) ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {c}
                  {form.competences.includes(c) && <span className="float-right">✓</span>}
                </button>
              ))}
            </div>
            <p className="text-gray-400 text-sm mt-2">{form.competences.length} compétence(s) sélectionnée(s)</p>
          </div>
        </motion.div>
      )}

      {/* Step 3: Disponibilité & Objectif */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Votre disponibilité
            </label>
            <div className="space-y-2">
              {[
                { value: 'temps_partiel', label: 'Temps partiel (soirs/weekends)' },
                { value: 'temps_complet', label: 'Temps complet' },
                { value: 'weekends', label: 'Weekends uniquement' },
                { value: 'soirées', label: 'Soirées uniquement' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, disponibilite: opt.value }))}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    form.disponibilite === opt.value ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" /> Délai de lancement souhaité
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['1_mois','3_mois','6_mois','1_an'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, objectif_delai: d }))}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    form.objectif_delai === d ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {d.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 4: Budget principal & Contraintes */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <label className="block text-[#4d553e] font-bold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget de démarrage (principal)
            </label>
            <div className="grid grid-cols-1 gap-4">
              {budgetOptions.map(level => {
                const Icon = level.icon
                const selected = form.budget_principal === level.id
                return (
                  <div
                    key={level.id}
                    onClick={() => setForm(prev => ({ ...prev, budget_principal: level.id }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selected ? 'bg-gradient-to-r from-[#4d553e]/20 to-[#6a7556]/20 border-[#4d553e]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 bg-gradient-to-r ${level.color || 'from-slate-600 to-slate-700'} rounded-lg`}>
                        {Icon ? <Icon className="w-6 h-6 text-white" /> : <DollarSign className="w-6 h-6 text-white" />}
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-white mb-1">{level.name}</h5>
                        <p className="text-gray-300 text-sm mb-1">{level.range}</p>
                        {level.description && <p className="text-gray-400 text-xs">{level.description}</p>}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-white font-medium mb-3">Contraintes particulières (optionnel)</label>
            <textarea
              value={form.contraintes}
              onChange={(e) => setForm(prev => ({ ...prev, contraintes: e.target.value }))}
              placeholder="Ex: Pas de stock, uniquement digital, besoin d'horaires flexibles..."
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        </motion.div>
      )}

      {/* Bouton sauvegarde profil (step 4 uniquement) */}
      {step === 4 && userId && onSaveProfile && canNext() && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💾</div>
            <div className="flex-1">
              <h5 className="text-white font-semibold mb-1">Sauvegarder ce profil ?</h5>
              <p className="text-gray-300 text-sm mb-3">Réutilisez ce contexte plus tard pour gagner du temps</p>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {savingProfile ? 'Sauvegarde...' : '💾 Sauvegarder mon profil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(prev => Math.max(1, prev - 1))}
          disabled={step === 1}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Précédent
        </button>

        {step < totalSteps ? (
          <button
            type="button"
            onClick={() => setStep(prev => prev + 1)}
            disabled={!canNext()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canNext() || isLoading}
            className="px-6 py-2 bg-gradient-to-r from-[#6a7556] to-[#4d553e] text-white rounded-lg hover:from-[#4d553e] hover:to-[#3a4030] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Génération...' : '✨ Générer mes propositions'}
          </button>
        )}
      </div>
    </form>
  )
}
