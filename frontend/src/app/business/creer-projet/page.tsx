'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lightbulb, DollarSign, Rocket, Loader2,
  ArrowRight, ArrowLeft, CheckCircle2, Circle,
  Clock, Crown, Trophy, Zap, Users
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BcegBackdrop from '@/components/bceg/BcegBackdrop'
import AIGenerationModal from '@/components/business/AIGenerationModal'
import BcegSimulator from '@/components/bceg/BcegSimulator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ProjectFormData {
  // Étape 1 — Mon idée
  project_idea: string
  problem_solving: string
  target_audience: string
  unique_value: string

  // Étape 2 — Mon modèle
  revenue_model: string
  funding_needed: string
  team_size: string
  timeline: string

  // Étape 3 — Mes objectifs
  short_term_goals: string
  long_term_goals: string

  // Champs conservés pour compat backend (vides côté form)
  project_vision: string
  market_size: string
  competitors: string
  pricing_strategy: string
  cost_structure: string
  key_skills: string[]
  location: string
  success_metrics: string
  risks: string
}

const STEPS = [
  { id: 1, title: 'Mon idée', subtitle: 'L\'essence de votre projet', icon: Lightbulb },
  { id: 2, title: 'Mon modèle', subtitle: 'Revenus, équipe & timing', icon: DollarSign },
  { id: 3, title: 'Mes objectifs', subtitle: 'Où voulez-vous aller ?', icon: Rocket },
]

const TEAM_OPTIONS = [
  { value: 'solo', label: 'Solo', desc: '1 personne', icon: Crown },
  { value: '2-5', label: 'Petite', desc: '2-5 personnes', icon: Zap },
  { value: '6-10', label: 'Moyenne', desc: '6-10 personnes', icon: Trophy },
  { value: '11+', label: 'Grande', desc: '11+ personnes', icon: Rocket },
]

const TIMELINE_OPTIONS = [
  { value: '1-3-mois', label: '1-3 mois', emoji: '🚀' },
  { value: '3-6-mois', label: '3-6 mois', emoji: '⭐' },
  { value: '6-12-mois', label: '6-12 mois', emoji: '🎯' },
  { value: '12+-mois', label: '12+ mois', emoji: '👑' },
]

export default function CreerProjetPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [formData, setFormData] = useState<ProjectFormData>({
    project_idea: '',
    problem_solving: '',
    target_audience: '',
    unique_value: '',
    revenue_model: '',
    funding_needed: '',
    team_size: '',
    timeline: '',
    short_term_goals: '',
    long_term_goals: '',
    // compat backend
    project_vision: '',
    market_size: '',
    competitors: '',
    pricing_strategy: '',
    cost_structure: '',
    key_skills: [],
    location: '',
    success_metrics: '',
    risks: '',
  })

  const handleInputChange = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin?redirect=/business/creer-projet')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <BcegBackdrop opacity={0.45} />
        <div className="relative z-10 text-center">
          <Loader2 className="w-12 h-12 text-[#697357] animate-spin mx-auto mb-4" />
          <p className="text-[#697357] text-lg font-semibold">Vérification…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <BcegBackdrop opacity={0.45} />
        <div className="relative z-10 text-center">
          <Loader2 className="w-12 h-12 text-[#697357] animate-spin mx-auto mb-4" />
          <p className="text-[#697357] text-lg font-semibold">Redirection…</p>
        </div>
      </div>
    )
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.project_idea && formData.problem_solving && formData.target_audience && formData.unique_value)
      case 2:
        return !!(formData.revenue_model && formData.team_size && formData.timeline)
      case 3:
        return !!(formData.short_term_goals && formData.long_term_goals)
      default:
        return false
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
      setError('')
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setError('Veuillez remplir tous les champs obligatoires')
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    setError('')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setError('Veuillez remplir tous les champs obligatoires')
      return
    }
    setIsGenerating(true)
    setError('')
    try {
      const { supabase: sb } = await import('@/lib/auth')
      const { data: { session } } = await sb.auth.getSession()
      const token = session?.access_token
      const response = await fetch(`${API_URL}/api/projects/generate-framework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          formData,
        }),
      })
      const data = await response.json()
      if (data.success) {
        router.push(`/business/mes-projets?new=${data.project.id}`)
      } else {
        throw new Error(data.error || 'Erreur lors de la génération')
      }
    } catch (err: any) {
      console.error('Erreur création projet:', err)
      setError(err.message || 'Erreur réseau')
    } finally {
      setIsGenerating(false)
    }
  }

  const progress = (currentStep / STEPS.length) * 100
  const currentStepData = STEPS[currentStep - 1]
  const StepIcon = currentStepData.icon

  return (
    <div className="min-h-screen relative">
      <BcegBackdrop opacity={0.5} />
      <div className="relative z-10">
        <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        <div className="flex">
          <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

          <main className="flex-1 lg:ml-64 pt-4 pb-12 min-h-screen">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

              {/* Barre de progression */}
              <div className="py-3">
                <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full bg-gradient-to-r from-[#697357] to-[#4d553e]"
                  />
                </div>
                <div className="flex justify-between mt-2 px-1">
                  {STEPS.map(step => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex items-center gap-1.5 transition-all ${
                        step.id === currentStep ? 'text-[#697357] font-bold'
                          : step.id < currentStep ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.id < currentStep ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className={`w-4 h-4 ${step.id === currentStep ? 'fill-current' : ''}`} />
                      )}
                      <span className="text-xs hidden sm:inline">{step.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero étape */}
              <motion.div
                key={`hero-${currentStep}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#697357] to-[#4d553e] rounded-2xl p-5 sm:p-6 mb-5 text-white shadow-lg shadow-[#697357]/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                    <StepIcon className="w-6 h-6 text-amber-200" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 mb-0.5">
                      Étape {currentStep} sur {STEPS.length}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold leading-tight">{currentStepData.title}</h2>
                    <p className="text-sm opacity-85">{currentStepData.subtitle}</p>
                  </div>
                </div>
              </motion.div>

              {/* Formulaire */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-200"
                >
                  {currentStep === 1 && (
                    <Step1
                      formData={formData}
                      onChange={handleInputChange}
                    />
                  )}
                  {currentStep === 2 && (
                    <Step2
                      formData={formData}
                      onChange={handleInputChange}
                    />
                  )}
                  {currentStep === 3 && (
                    <Step3
                      formData={formData}
                      onChange={handleInputChange}
                    />
                  )}

                  {error && (
                    <div className="mt-5 bg-rose-50 border border-rose-200 rounded-lg p-3">
                      <p className="text-rose-700 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 pt-5 mt-5 border-t border-slate-100">
                    {currentStep > 1 ? (
                      <button
                        onClick={handlePrevious}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all text-sm"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {currentStep < 3 ? (
                      <button
                        onClick={handleNext}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold rounded-lg shadow-md shadow-[#697357]/30 transition-all"
                      >
                        <span>Continuer</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold rounded-lg shadow-md shadow-[#697357]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Génération…</span>
                          </>
                        ) : (
                          <>
                            <Rocket className="w-4 h-4" />
                            <span>Créer mon projet</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              <p className="text-center text-xs text-slate-500 mt-4">
                💡 Vos réponses sont sauvegardées localement et utilisées pour générer votre dossier projet.
              </p>
            </div>
          </main>
        </div>

        <AIGenerationModal isOpen={isGenerating} />
      </div>
    </div>
  )
}

// ===== Étape 1 — Mon idée =====
function Step1({ formData, onChange }: { formData: ProjectFormData; onChange: (f: any, v: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="💡 Votre idée de projet" required>
        <textarea
          value={formData.project_idea}
          onChange={(e) => onChange('project_idea', e.target.value)}
          placeholder="Ex : Plateforme de livraison de repas gabonais à Libreville"
          rows={3}
          className={inputBase}
        />
      </Field>

      <Field label="🔧 Le problème que vous résolvez" required>
        <textarea
          value={formData.problem_solving}
          onChange={(e) => onChange('problem_solving', e.target.value)}
          placeholder="Ex : Manque d'options de livraison rapide pour la cuisine locale"
          rows={2}
          className={inputBase}
        />
      </Field>

      <Field label="👥 À qui s'adresse votre projet ?" required>
        <textarea
          value={formData.target_audience}
          onChange={(e) => onChange('target_audience', e.target.value)}
          placeholder="Ex : Jeunes professionnels 25-40 ans à Libreville"
          rows={2}
          className={inputBase}
        />
      </Field>

      <Field label="✨ Ce qui vous rend unique" required>
        <textarea
          value={formData.unique_value}
          onChange={(e) => onChange('unique_value', e.target.value)}
          placeholder="Ex : Livraison en 30 min de spécialités 100 % gabonaises"
          rows={2}
          className={inputBase}
        />
      </Field>
    </div>
  )
}

// ===== Étape 2 — Mon modèle =====
function Step2({ formData, onChange }: { formData: ProjectFormData; onChange: (f: any, v: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="💰 Comment allez-vous gagner de l'argent ?" required>
        <textarea
          value={formData.revenue_model}
          onChange={(e) => onChange('revenue_model', e.target.value)}
          placeholder="Ex : Commission de 15 % sur chaque commande + abonnement premium"
          rows={2}
          className={inputBase}
        />
      </Field>

      <Field label="💸 Financement nécessaire (FCFA)">
        <input
          type="text"
          value={formData.funding_needed}
          onChange={(e) => onChange('funding_needed', e.target.value)}
          placeholder="Ex : 5 000 000"
          className={inputBase}
        />
      </Field>

      {/* Simulateur BCEG simplifié */}
      <div className="rounded-xl bg-[#697357]/5 border border-[#697357]/20 p-3">
        <BcegSimulator
          initialMontant={Number((formData.funding_needed || '').replace(/\D/g, '')) || 5_000_000}
          initialApportPct={20}
          initialDureeMois={24}
          initialType="entreprise"
          compact
        />
        <p className="mt-2 text-[11px] text-slate-600">
          Apport BCEG conseillé : <strong className="text-[#697357]">20 %</strong>
        </p>
      </div>

      <Field label="👥 Taille de votre équipe" required>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEAM_OPTIONS.map(opt => {
            const Icon = opt.icon
            const selected = formData.team_size === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onChange('team_size', opt.value)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  selected
                    ? 'border-[#697357] bg-[#697357]/10'
                    : 'border-slate-200 bg-white hover:border-[#697357]/40'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${
                  selected ? 'bg-[#697357] text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`text-sm font-bold ${selected ? 'text-[#697357]' : 'text-slate-900'}`}>{opt.label}</div>
                <div className="text-[11px] text-slate-500">{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="⏱️ Quand voulez-vous lancer ?" required>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIMELINE_OPTIONS.map(opt => {
            const selected = formData.timeline === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onChange('timeline', opt.value)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  selected
                    ? 'border-[#697357] bg-[#697357]/10'
                    : 'border-slate-200 bg-white hover:border-[#697357]/40'
                }`}
              >
                <div className="text-xl mb-1">{opt.emoji}</div>
                <div className={`text-xs font-medium ${selected ? 'text-[#697357]' : 'text-slate-700'}`}>{opt.label}</div>
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

// ===== Étape 3 — Mes objectifs =====
function Step3({ formData, onChange }: { formData: ProjectFormData; onChange: (f: any, v: any) => void }) {
  return (
    <div className="space-y-5">
      <Field label="🎯 Vos objectifs dans 6 mois" required>
        <textarea
          value={formData.short_term_goals}
          onChange={(e) => onChange('short_term_goals', e.target.value)}
          placeholder="Ex : Lancer le MVP, acquérir 100 premiers clients, signer 10 restaurants partenaires"
          rows={3}
          className={inputBase}
        />
      </Field>

      <Field label="🚀 Votre vision à 1-3 ans" required>
        <textarea
          value={formData.long_term_goals}
          onChange={(e) => onChange('long_term_goals', e.target.value)}
          placeholder="Ex : 10 000 utilisateurs actifs, expansion à Port-Gentil, équilibre financier"
          rows={3}
          className={inputBase}
        />
      </Field>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <p className="font-bold mb-1">💡 Et après ?</p>
        <p className="opacity-90">
          Notre IA va générer votre dossier projet (description, plan d'action, score BCEG…).
          Vous pourrez ensuite affiner et soumettre à la BCEG.
        </p>
      </div>
    </div>
  )
}

// ===== Helpers =====
const inputBase = 'w-full px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#697357] focus:ring-2 focus:ring-[#697357]/20 transition-all resize-none text-sm'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-800 font-semibold mb-2 text-sm">
        {label} {required && <span className="text-[#697357]">*</span>}
      </label>
      {children}
    </div>
  )
}
