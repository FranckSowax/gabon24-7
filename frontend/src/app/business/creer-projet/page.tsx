'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Lightbulb, Target, DollarSign, Users, TrendingUp, Loader2, Rocket,
  ArrowRight, ArrowLeft, CheckCircle2, Circle, Sparkles
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import AIGenerationModal from '@/components/business/AIGenerationModal'

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
      setCurrentStep(prev => Math.min(prev + 1, 5))
      setError('')
    } else {
      setError('Veuillez remplir tous les champs obligatoires')
    }
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
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                👥 Taille de l'équipe nécessaire ? *
              </label>
              <select
                value={formData.team_size}
                onChange={(e) => handleInputChange('team_size', e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-sm"
              >
                <option value="">Sélectionnez...</option>
                <option value="solo">Solo (1 personne)</option>
                <option value="2-5">Petite équipe (2-5 personnes)</option>
                <option value="6-10">Équipe moyenne (6-10 personnes)</option>
                <option value="11+">Grande équipe (11+ personnes)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                🎯 Compétences clés nécessaires ? * (Sélectionnez plusieurs)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SKILLS_OPTIONS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      formData.key_skills.includes(skill)
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                📅 Timeline de lancement ? *
              </label>
              <select
                value={formData.timeline}
                onChange={(e) => handleInputChange('timeline', e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-sm"
              >
                <option value="">Sélectionnez...</option>
                <option value="1-3-mois">1-3 mois</option>
                <option value="3-6-mois">3-6 mois</option>
                <option value="6-12-mois">6-12 mois</option>
                <option value="12+-mois">Plus de 12 mois</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">
                📍 Localisation du projet ?
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Ex: Libreville, Gabon"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-sm"
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
    </div>
  )
}
