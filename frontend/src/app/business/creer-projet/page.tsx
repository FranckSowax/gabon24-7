'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lightbulb, Target, DollarSign, Users, TrendingUp, Loader2, Rocket,
  ArrowRight, ArrowLeft, CheckCircle2, Circle, Sparkles, Zap, Star,
  Clock, MapPin, Trophy, Crown, Medal, Award
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import AIGenerationModal from '@/components/business/AIGenerationModal'
import TransitionSlide from '@/components/business/TransitionSlide'
import BcegScoreBadge, { BcegBreakdown, BcegScoreColor } from '@/components/bceg/BcegScoreBadge'
import BcegSimulator from '@/components/bceg/BcegSimulator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ProjectFormData {
  // Étape 1: Idée & Vision
  project_idea: string
  project_vision: string
  problem_solving: string
  
  // Étape 2: Marché & Cible
  target_audience: string
  market_size: string
  competitors: string
  unique_value: string
  
  // Étape 3: Business Model
  revenue_model: string
  pricing_strategy: string
  cost_structure: string
  funding_needed: string
  
  // Étape 4: Ressources & Timeline
  team_size: string
  key_skills: string[]
  timeline: string
  location: string
  
  // Étape 5: Objectifs & Métriques
  short_term_goals: string
  long_term_goals: string
  success_metrics: string
  risks: string
}

const STEPS = [
  { 
    id: 1, 
    title: 'Idée & Vision', 
    subtitle: 'Votre concept',
    icon: Lightbulb, 
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-orange-50',
    borderColor: 'border-yellow-500'
  },
  { 
    id: 2, 
    title: 'Marché & Cible', 
    subtitle: 'Votre audience',
    icon: Target, 
    color: 'from-blue-500 to-purple-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-purple-50',
    borderColor: 'border-blue-500'
  },
  { 
    id: 3, 
    title: 'Business Model', 
    subtitle: 'Votre stratégie',
    icon: DollarSign, 
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50',
    borderColor: 'border-green-500'
  },
  { 
    id: 4, 
    title: 'Ressources', 
    subtitle: 'Votre équipe',
    icon: Users, 
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
    borderColor: 'border-purple-500'
  },
  { 
    id: 5, 
    title: 'Objectifs', 
    subtitle: 'Votre vision',
    icon: TrendingUp, 
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-gradient-to-br from-orange-50 to-red-50',
    borderColor: 'border-orange-500'
  }
]

// Compétences disponibles pour sélection
const SKILLS_OPTIONS = [
  'Développement Web', 'Marketing Digital', 'Design', 'Vente',
  'Finance', 'Gestion de Projet', 'Juridique', 'Logistique',
  'Service Client', 'Production', 'Communication', 'RH'
]

export default function CreerProjetPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [transitionFrom, setTransitionFrom] = useState(0)
  const [transitionTo, setTransitionTo] = useState(0)

  // ✅ TOUS LES useState DOIVENT ÊTRE AVANT LES RETOURS CONDITIONNELS
  const [formData, setFormData] = useState<ProjectFormData>({
    project_idea: '',
    project_vision: '',
    problem_solving: '',
    target_audience: '',
    market_size: '',
    competitors: '',
    unique_value: '',
    revenue_model: '',
    pricing_strategy: '',
    cost_structure: '',
    funding_needed: '',
    team_size: '',
    key_skills: [],
    timeline: '',
    location: '',
    short_term_goals: '',
    long_term_goals: '',
    success_metrics: '',
    risks: ''
  })

  // BCEG Score temps réel (Phase 2)
  const [bcegScore, setBcegScore] = useState<{ score: number; color: BcegScoreColor; breakdown?: BcegBreakdown; advice?: { axis: string; tip: string }[]; loading: boolean }>({
    score: 0,
    color: 'red',
    loading: true,
  })

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setBcegScore(s => ({ ...s, loading: true }))
        const res = await fetch(`${API_URL}/api/bceg/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: currentStep, ...formData }),
        })
        const json = await res.json()
        if (json?.success) {
          setBcegScore({ score: json.score, color: json.color, breakdown: json.breakdown, advice: json.advice, loading: false })
        } else {
          setBcegScore(s => ({ ...s, loading: false }))
        }
      } catch {
        setBcegScore(s => ({ ...s, loading: false }))
      }
    }, 600)
    return () => clearTimeout(t)
  }, [formData, currentStep])

  const handleInputChange = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      key_skills: prev.key_skills.includes(skill)
        ? prev.key_skills.filter(s => s !== skill)
        : [...prev.key_skills, skill]
    }))
  }

  // Vérification authentification obligatoire (après tous les hooks)
  useEffect(() => {
    // Attendre que le chargement soit terminé avant de rediriger
    if (!loading && !user) {
      // Rediriger vers la page de connexion avec URL de retour
      router.push('/auth/signin?redirect=/business/creer-projet')
    }
  }, [user, loading, router])

  // Afficher un loader pendant la vérification d'authentification
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Vérification de votre connexion...</p>
        </div>
      </div>
    )
  }

  // Si pas connecté (après chargement), afficher un message (avant redirection)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Redirection vers la page de connexion...</p>
        </div>
      </div>
    )
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.project_idea && formData.project_vision && formData.problem_solving)
      case 2:
        return !!(formData.target_audience && formData.market_size && formData.unique_value)
      case 3:
        return !!(formData.revenue_model && formData.pricing_strategy)
      case 4:
        return !!(formData.team_size && formData.key_skills.length > 0 && formData.timeline)
      case 5:
        return !!(formData.short_term_goals && formData.long_term_goals)
      default:
        return false
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      // Afficher l'écran de transition avant de passer à l'étape suivante
      setTransitionFrom(currentStep)
      setTransitionTo(currentStep + 1)
      setShowTransition(true)
      setError('')
    } else {
      setError('Veuillez remplir tous les champs obligatoires')
    }
  }

  const handleTransitionContinue = () => {
    setShowTransition(false)
    setCurrentStep(transitionTo)
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    setError('')
  }

  const handleSubmit = async () => {
    if (!user) {
      alert('Vous devez être connecté pour créer un projet')
      router.push('/login')
      return
    }

    if (!validateStep(5)) {
      setError('Veuillez remplir tous les champs obligatoires')
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      // Générer le document cadre avec IA
      const response = await fetch(`${API_URL}/api/projects/generate-framework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          formData
        })
      })

      const data = await response.json()

      if (data.success) {
        // Rediriger vers le projet créé
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                💡 Quelle est votre idée de projet ? *
              </label>
              <textarea
                value={formData.project_idea}
                onChange={(e) => handleInputChange('project_idea', e.target.value)}
                placeholder="Ex: Créer une plateforme de livraison de repas gabonais à Libreville..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🎯 Quelle est votre vision à long terme ? *
              </label>
              <textarea
                value={formData.project_vision}
                onChange={(e) => handleInputChange('project_vision', e.target.value)}
                placeholder="Ex: Devenir le leader de la livraison de repas au Gabon d'ici 3 ans..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🔧 Quel problème résolvez-vous ? *
              </label>
              <textarea
                value={formData.problem_solving}
                onChange={(e) => handleInputChange('problem_solving', e.target.value)}
                placeholder="Ex: Difficulté à trouver des repas de qualité livrés rapidement..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all resize-none text-sm"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                👥 Qui est votre audience cible ? *
              </label>
              <textarea
                value={formData.target_audience}
                onChange={(e) => handleInputChange('target_audience', e.target.value)}
                placeholder="Ex: Jeunes professionnels de 25-40 ans à Libreville, familles..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                📊 Quelle est la taille du marché ? *
              </label>
              <input
                type="text"
                value={formData.market_size}
                onChange={(e) => handleInputChange('market_size', e.target.value)}
                placeholder="Ex: 500,000 habitants à Libreville, marché estimé à 2M FCFA/mois"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🏆 Qui sont vos concurrents ?
              </label>
              <textarea
                value={formData.competitors}
                onChange={(e) => handleInputChange('competitors', e.target.value)}
                placeholder="Ex: Jumia Food, restaurants locaux avec livraison..."
                className="w-full h-24 px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                ✨ Quelle est votre valeur unique ? *
              </label>
              <textarea
                value={formData.unique_value}
                onChange={(e) => handleInputChange('unique_value', e.target.value)}
                placeholder="Ex: Livraison en 30 minutes, focus sur cuisine gabonaise authentique..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-sm"
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                💰 Comment allez-vous générer des revenus ? *
              </label>
              <textarea
                value={formData.revenue_model}
                onChange={(e) => handleInputChange('revenue_model', e.target.value)}
                placeholder="Ex: Commission de 15% sur chaque commande, abonnement premium..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                💵 Quelle est votre stratégie de prix ? *
              </label>
              <input
                type="text"
                value={formData.pricing_strategy}
                onChange={(e) => handleInputChange('pricing_strategy', e.target.value)}
                placeholder="Ex: Livraison 1,000 FCFA, commission restaurant 15%"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                📉 Quels sont vos coûts principaux ?
              </label>
              <textarea
                value={formData.cost_structure}
                onChange={(e) => handleInputChange('cost_structure', e.target.value)}
                placeholder="Ex: Salaires livreurs, marketing, maintenance plateforme..."
                className="w-full h-24 px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                💸 Quel financement avez-vous besoin ?
              </label>
              <input
                type="text"
                value={formData.funding_needed}
                onChange={(e) => handleInputChange('funding_needed', e.target.value)}
                placeholder="Ex: 5,000,000 FCFA pour démarrage"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all text-sm"
              />
            </div>

            {/* Simulateur BCEG en direct (Phase 2) */}
            <div className="mt-2">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-1">
                <BcegSimulator
                  initialMontant={
                    // Parser une éventuelle valeur déjà saisie
                    Number((formData.funding_needed || '').replace(/\D/g, '')) || 5_000_000
                  }
                  initialApportPct={20}
                  initialDureeMois={24}
                  initialType="entreprise"
                  compact
                />
              </div>
              <p className="mt-2 text-xs text-gray-600 italic">
                💡 Joue avec les sliders pour voir comment ton crédit BCEG s'adapte à ton apport et ta durée — l'apport conseillé est de <strong>20 %</strong>.
              </p>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            {/* Taille de l'équipe - Version gamifiée avec cartes */}
            <div>
              <label className="block text-gray-800 font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Taille de l'équipe nécessaire ? *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'solo', label: 'Solo', icon: Crown, desc: '1 personne', color: 'from-yellow-400 to-orange-500' },
                  { value: '2-5', label: 'Startup', icon: Zap, desc: '2-5 personnes', color: 'from-blue-400 to-purple-500' },
                  { value: '6-10', label: 'Équipe', icon: Trophy, desc: '6-10 personnes', color: 'from-green-400 to-emerald-500' },
                  { value: '11+', label: 'Entreprise', icon: Rocket, desc: '11+ personnes', color: 'from-purple-400 to-pink-500' }
                ].map(option => (
                  <motion.button
                    key={option.value}
                    onClick={() => handleInputChange('team_size', option.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      formData.team_size === option.value
                        ? 'border-purple-500 bg-purple-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${option.color} flex items-center justify-center mb-2 mx-auto`}>
                      <option.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-semibold text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.desc}</div>
                    {formData.team_size === option.value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Compétences - Version gamifiée avec badges */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Compétences clés * <span className="text-xs text-purple-500 ml-2">({formData.key_skills.length} sélectionnées)</span>
              </label>
              {/* Barre de progression des compétences */}
              <div className="mb-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((formData.key_skills.length / 4) * 100, 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {SKILLS_OPTIONS.map((skill, i) => (
                  <motion.button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-3 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1.5 ${
                      formData.key_skills.includes(skill)
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {formData.key_skills.includes(skill) && (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {skill}
                  </motion.button>
                ))}
              </div>
              {formData.key_skills.length >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-2 text-green-600 text-sm"
                >
                  <Trophy className="w-4 h-4" />
                  Excellent ! Équipe polyvalente
                </motion.div>
              )}
            </div>

            {/* Timeline - Version gamifiée avec slider visuel */}
            <div>
              <label className="block text-gray-800 font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Timeline de lancement ? *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: '1-3-mois', label: '1-3 mois', icon: Zap, emoji: '🚀' },
                  { value: '3-6-mois', label: '3-6 mois', icon: Star, emoji: '⭐' },
                  { value: '6-12-mois', label: '6-12 mois', icon: Target, emoji: '🎯' },
                  { value: '12+-mois', label: '12+ mois', icon: Crown, emoji: '👑' }
                ].map((option, i) => (
                  <motion.button
                    key={option.value}
                    onClick={() => handleInputChange('timeline', option.value)}
                    whileHover={{ y: -2 }}
                    className={`relative p-3 rounded-xl text-center transition-all ${
                      formData.timeline === option.value
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <div className="text-xs font-medium">{option.label}</div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Localisation */}
            <div>
              <label className="block text-gray-800 font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-500" />
                Localisation du projet
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Ex: Libreville, Gabon"
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🎯 Objectifs court terme (3-6 mois) ? *
              </label>
              <textarea
                value={formData.short_term_goals}
                onChange={(e) => handleInputChange('short_term_goals', e.target.value)}
                placeholder="Ex: Lancer MVP, acquérir 100 premiers clients, partenariats avec 10 restaurants..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🚀 Objectifs long terme (1-3 ans) ? *
              </label>
              <textarea
                value={formData.long_term_goals}
                onChange={(e) => handleInputChange('long_term_goals', e.target.value)}
                placeholder="Ex: 10,000 utilisateurs actifs, expansion à Port-Gentil, rentabilité..."
                className="w-full h-24 px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                📊 Comment mesurerez-vous le succès ?
              </label>
              <textarea
                value={formData.success_metrics}
                onChange={(e) => handleInputChange('success_metrics', e.target.value)}
                placeholder="Ex: Nombre de commandes/mois, taux de satisfaction client, chiffre d'affaires..."
                className="w-full h-24 px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                ⚠️ Quels sont les risques identifiés ?
              </label>
              <textarea
                value={formData.risks}
                onChange={(e) => handleInputChange('risks', e.target.value)}
                placeholder="Ex: Concurrence forte, coûts logistiques élevés, adoption lente..."
                className="w-full h-24 px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all resize-none"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }
  const currentStepData = STEPS[currentStep - 1]
  const progress = (currentStep / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
        
        <main className="flex-1 lg:ml-64 pt-4 pb-10 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Progression collée au header */}
          <div className="py-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500"
              />
            </div>
            <div className="flex justify-between mt-2 px-1">
              {STEPS.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1 transition-all ${
                    step.id === currentStep 
                      ? 'text-white scale-105' 
                      : step.id < currentStep
                      ? 'text-green-400'
                      : 'text-white/40'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : step.id === currentStep ? (
                    <Circle className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px] font-medium hidden sm:inline">{step.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contenu principal */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Infos étape */}
            <div className="hidden lg:block lg:col-span-1">
              <div className={`${currentStepData.bgColor} rounded-2xl p-5 border ${currentStepData.borderColor} shadow-xl`}>
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentStepData.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <currentStepData.icon className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{currentStepData.title}</h2>
                <p className="text-sm text-gray-600 mb-3">{currentStepData.subtitle}</p>
                <p className="text-xs text-gray-600">Étape {currentStep} sur {STEPS.length}</p>
              </div>

              {/* BCEG Score temps réel (Phase 2) */}
              <div className="mt-4 bg-slate-900/85 backdrop-blur border border-amber-300/20 rounded-2xl p-4 shadow-xl sticky top-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏦</span>
                  <h3 className="text-sm font-bold text-white">Bancabilité BCEG</h3>
                </div>
                <BcegScoreBadge
                  score={bcegScore.score}
                  color={bcegScore.color}
                  breakdown={bcegScore.breakdown}
                  advice={bcegScore.advice}
                  size="lg"
                  showBreakdown
                  loading={bcegScore.loading}
                />
                <p className="mt-3 text-[10px] text-white/50 leading-relaxed">
                  Ce score évolue à chaque champ rempli — vise <strong className="text-emerald-300">70+ </strong>pour soumettre à la BCEG.
                </p>
              </div>
            </div>

            {/* Formulaire */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl p-5 sm:p-6 shadow-xl"
                >
                  <div className="space-y-4 mb-6">
                    {renderStepContent()}
                  </div>

                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
                      <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
                    {currentStep > 1 ? (
                      <button onClick={handlePrevious} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Précédent</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {currentStep < 5 ? (
                      <button onClick={handleNext} className={`flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r ${currentStepData.color} text-white font-bold rounded-lg hover:shadow-lg transition-all hover:scale-105`}>
                        <span>Suivant</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={handleSubmit} disabled={isGenerating} className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGenerating ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>Génération...</span></>) : (<><Rocket className="w-5 h-5" /><span>Générer mon Projet</span></>)}
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
      </div>

      {/* Modal de génération IA */}
      <AIGenerationModal isOpen={isGenerating} />

      {/* Écran de transition entre les étapes */}
      <AnimatePresence>
        {showTransition && (
          <TransitionSlide
            fromStep={transitionFrom}
            toStep={transitionTo}
            completedData={{
              project_idea: formData.project_idea,
              target_audience: formData.target_audience,
              revenue_model: formData.revenue_model,
              team_size: formData.team_size
            }}
            onContinue={handleTransitionContinue}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
