'use client'
// Version 2.0.2 - Force rebuild for mobile modal fix - 2025-10-23 23:28

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Sparkles, TrendingUp, Clock, Target, ArrowRight, Lightbulb, DollarSign, Users, AlertCircle, Building2, Zap, Wallet, Star, CheckCircle, Menu, ChevronLeft, ChevronRight, Bookmark, ChevronDown, Save, ExternalLink, X } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import EnrichmentDisplay from '@/components/business/EnrichmentDisplay'
import { useOpportunityEnrichment } from '@/hooks/useOpportunityEnrichment'
import PersonalizationFormInline from '@/components/forms/PersonalizationFormInline'
import { useAuth } from '@/contexts/AuthContext'
import TopUpModal from '@/components/credits/TopUpModal'
import TrainingSummaryModal from '@/components/training/TrainingSummaryModal'
import SavedContextsManager from '@/components/business/SavedContextsManager'
import SkillTestModal from '@/components/skill-test/SkillTestModal'
import ActionPlanModal from '@/components/action-plan/ActionPlanModal'
import { getCurrentSession, getCurrentUser } from '@/lib/auth'
import { getProxiedImage } from '@/lib/imageProxy'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Helper: Promise timeout to avoid infinite spinners on slow networks
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Opération') : Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} trop longue, vérifiez votre connexion réseau.`)), ms)
  })
  try {
    const result = await Promise.race([promise, timeout]) as T
    return result
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

// Helper: get Supabase auth headers (Bearer token)
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { supabase } = await import('@/lib/auth')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return headers
}

// Helper: fetch + json with abort-based timeout
async function fetchJsonWithTimeout(url: string, options: RequestInit, ms: number, label = 'Opération') {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    // json() can also hang if the stream stalls; parse with its own timeout
    const json = await withTimeout(res.json().catch(() => null), Math.max(5000, Math.floor(ms / 2)), label)
    return { res, json }
  } finally {
    clearTimeout(to)
  }
}

interface Article {
  id: string
  title: string
  summary: string
  source: string
  published_at: string
  image_url?: string
  imageUrl?: string  // Support pour les deux formats
  url: string
}

interface AnalyseContextuelle {
  secteur_principal: string
  problematique_centrale: string
  acteurs_impactes: string
  urgence_score: number
  ressources_disponibles: string
}

interface SecteurOpportunite {
  nom: string
  description: string
  score_potentiel: number
}

interface Analysis {
  id: string
  analyse_contextuelle?: AnalyseContextuelle
  secteurs_opportunites?: SecteurOpportunite[]
  enrichment?: {
    status: string
    level: string
    factual_data?: any
    market_research?: any
    confidence_score?: number
    data_sources: string[]
    upgrade_available: boolean
    upgrade_message?: string
  }
  saved_opportunity_id?: string
}

interface ProjectProposal {
  titre: string
  description: string
  premiers_investissements: string
  delai_lancement: string
  avantages: string[]
  defis: string[]
  score_faisabilite: number
}

interface ProposalsResponse {
  propositions: ProjectProposal[]
}

const budgetLevels = [
  {
    id: 'micro',
    name: 'Micro-Budget',
    range: '0 - 500,000 XAF',
    icon: Wallet,
    color: 'from-green-500 to-emerald-600',
    description: 'Démarrage minimal, idéal pour tester son idée'
  },
  {
    id: 'petit',
    name: 'Petit Budget',
    range: '500,000 - 2,000,000 XAF',
    icon: DollarSign,
    color: 'from-blue-500 to-cyan-600',
    description: 'Lancement avec quelques améliorations'
  },
  {
    id: 'moyen',
    name: 'Budget Moyen',
    range: '2,000,000 - 10,000,000 XAF',
    icon: TrendingUp,
    color: 'from-purple-500 to-violet-600',
    description: 'Développement sérieux avec scale-up'
  },
  {
    id: 'confortable',
    name: 'Budget Confortable',
    range: '10,000,000+ XAF',
    icon: Star,
    color: 'from-orange-500 to-red-600',
    description: 'Vision complète avec expansion'
  }
]

const howItWorksSteps = [
  {
    icon: "📰",
    title: "Sélectionnez un article",
    description: "Choisissez une actualité gabonaise"
  },
  {
    icon: "🤖",
    title: "IA analyse",
    description: "Notre IA identifie les secteurs d'opportunités"
  },
  {
    icon: "🎯",
    title: "Choisissez votre secteur",
    description: "Sélectionnez le domaine qui vous intéresse"
  },
  {
    icon: "💰",
    title: "Définissez votre budget",
    description: "Indiquez votre capacité d'investissement"
  },
  {
    icon: "🚀",
    title: "Recevez vos propositions",
    description: "3 projets personnalisés vous attendent"
  }
]

export default function BusinessAnalyzerPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [selectedSecteur, setSelectedSecteur] = useState<SecteurOpportunite | null>(null)
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null)
  const [proposals, setProposals] = useState<ProjectProposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProposals, setIsLoadingProposals] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [savingProjects, setSavingProjects] = useState<Set<number>>(new Set())
  const [savedProjects, setSavedProjects] = useState<Set<number>>(new Set())
  const [savedProjectIds, setSavedProjectIds] = useState<Map<number, string>>(new Map())
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const { user, loading: authLoading } = useAuth()
  // Stocke le dernier contexte utilisateur soumis depuis le formulaire inline
  const [lastUserContext, setLastUserContext] = useState<any>(null)
  // Génération formation (Replicate)
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false)
  const [trainingForIndex, setTrainingForIndex] = useState<number | null>(null)
  const [generatedTraining, setGeneratedTraining] = useState<any>(null)
  const [generatedTrainingId, setGeneratedTrainingId] = useState<string | null>(null)
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false)
  // Modal de sauvegarde de contexte
  const [showSaveContextModal, setShowSaveContextModal] = useState(false)
  const [contextName, setContextName] = useState('')
  const [savingContext, setSavingContext] = useState(false)
  // Test de compétence
  const [isGeneratingSkillTest, setIsGeneratingSkillTest] = useState(false)
  const [skillTestForIndex, setSkillTestForIndex] = useState<number | null>(null)
  const [generatedSkillTest, setGeneratedSkillTest] = useState<any>(null)
  const [generatedSkillTestId, setGeneratedSkillTestId] = useState<string | null>(null)
  const [showSkillTestModal, setShowSkillTestModal] = useState(false)
  
  // Plan d'action
  const [showActionPlanModal, setShowActionPlanModal] = useState(false)
  const [selectedProposalForActionPlan, setSelectedProposalForActionPlan] = useState<number | null>(null)
  
  // Modal mobile propositions - États séparés pour éviter interférence avec desktop
  const [showMobileProposalModal, setShowMobileProposalModal] = useState(false)
  const [mobileSelectedSecteur, setMobileSelectedSecteur] = useState<SecteurOpportunite | null>(null)
  const [mobileProposals, setMobileProposals] = useState<ProjectProposal[]>([])  
  const [mobileIsLoadingProposals, setMobileIsLoadingProposals] = useState(false)
  const [mobileLastUserContext, setMobileLastUserContext] = useState<any>(null)
  
  // WhatsApp welcome guide
  const [fromWhatsApp, setFromWhatsApp] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [showWhatsAppGuide, setShowWhatsAppGuide] = useState(false)

  // Détection desktop pour rendu conditionnel
  const [isDesktop, setIsDesktop] = useState(false)
  
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768) // md breakpoint
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])
  
  // Hook pour l'enrichissement des opportunités
  const { enrichment, isEnriching, error: enrichmentError, enrichOpportunity } = useOpportunityEnrichment()

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % howItWorksSteps.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  // Helper: ensure we have a userId (wait briefly for mobile session readiness)
  const ensureUserId = async (): Promise<string | null> => {
    let currentUserId = user?.id || null
    if (currentUserId) return currentUserId
    // Try immediate session
    try {
      const { data: { session } } = await getCurrentSession()
      currentUserId = session?.user?.id || null
    } catch {}
    if (currentUserId) return currentUserId
    // Try direct getUser
    try {
      const { data } = await getCurrentUser()
      currentUserId = (data as any)?.user?.id || null
    } catch {}
    if (currentUserId) return currentUserId
    // Retry up to ~4s to let Supabase restore session on mobile
    for (let i = 0; i < 8 && !currentUserId; i++) {
      try {
        const [{ data: { session } }, { data }] = await Promise.all([
          getCurrentSession(),
          getCurrentUser()
        ])
        currentUserId = session?.user?.id || (data as any)?.user?.id || null
      } catch {}
      if (!currentUserId) {
        await new Promise(res => setTimeout(res, 500))
      }
    }
    return currentUserId
  }

  // Pré-sélectionner un article si aid est présent dans l'URL
  // Si l'article n'est pas dans la liste chargée, le récupérer par ID
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const aid = params.get('aid')
    const source = params.get('source')
    if (source === 'whatsapp') setFromWhatsApp(true)
    if (!aid) return

    // Si les articles sont chargés, chercher dedans
    if (articles.length > 0) {
      const found = articles.find(a => a.id === aid)
      if (found) {
        setSelectedArticle(found)
        return
      }
    }

    // Article non trouvé dans la liste : le récupérer par ID depuis l'API
    if (!loading) {
      const fetchArticleById = async () => {
        try {
          const response = await fetch(`${API_URL}/api/articles/${aid}`)
          const data = await response.json()
          if (data.success && data.article) {
            // Ajouter l'article en tête de liste et le sélectionner
            setArticles(prev => {
              if (prev.find(a => a.id === data.article.id)) return prev
              return [data.article, ...prev]
            })
            setSelectedArticle(data.article)
          }
        } catch (error) {
          console.error('Erreur récupération article par ID:', error)
        }
      }
      fetchArticleById()
    }
  }, [articles, loading])

  // WhatsApp guide: check auth + credit balance
  useEffect(() => {
    if (!fromWhatsApp || authLoading) return

    if (!user) {
      setShowWhatsAppGuide(true)
      return
    }

    // User is logged in, check credit balance
    const checkCredits = async () => {
      try {
        const res = await fetch(`${API_URL}/api/credits/stats?type=balance&userId=${user.id}`)
        const data = await res.json()
        if (data.success) {
          const total = (data.balance || 0) + (data.bonus_balance || 0)
          setCreditBalance(total)
          if (total < 15) setShowWhatsAppGuide(true)
        }
      } catch {
        // Silently fail, user can still use the page normally
      }
    }
    checkCredits()
  }, [fromWhatsApp, authLoading, user, API_URL])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % howItWorksSteps.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + howItWorksSteps.length) % howItWorksSteps.length)
  }

  // Soumission du formulaire inline DESKTOP: génère des propositions en tenant compte du contexte utilisateur
  const handleInlinePersonalizationSubmit = async (userContext: any) => {
    if (!selectedSecteur || !analysis) return
    setIsLoadingProposals(true)
    setProposals([])
    // Aligne l'ancien flux: on considère le budget sélectionné dans le formulaire comme budget principal
    setSelectedBudget(userContext.budget_principal || null)
    setLastUserContext(userContext)
    try {
      const budgetRange = budgetLevels.find(b => b.id === (userContext.budget_principal || ''))?.range || userContext.budget_principal
      
      // Utiliser la nouvelle route generate-proposals (compatible Netlify)
      const response = await fetch(`${API_URL}/api/opportunities/generate-proposals`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          userId: user?.id || null,
          secteur: selectedSecteur.nom,
          budget: budgetRange,
          problematique: analysis?.analyse_contextuelle?.problematique_centrale || '',
          userContext: {
            situation: userContext.situation || '',
            competences: userContext.competences || userContext.competences_actuelles || [],
            disponibilite: userContext.disponibilite || '',
            objectif_delai: userContext.objectif_delai || userContext.delai_lancement || '',
            experience_entrepreneuriale: userContext.experience_entrepreneuriale || '',
            contraintes: userContext.contraintes || ''
          },
          article: selectedArticle ? {
            title: selectedArticle.title,
            summary: selectedArticle.summary,
            source: selectedArticle.source,
            url: selectedArticle.url
          } : undefined
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Erreur API:', errorData)
        throw new Error(errorData.error || 'Erreur lors de la génération des propositions')
      }
      
      const data: any = await response.json()
      console.log('✅ Propositions reçues:', data)
      
      if (data.success && data.propositions) {
        console.log('✅ Setting proposals:', data.propositions.length, 'items')
        console.log('✅ selectedBudget:', userContext.budget_principal)
        setProposals(data.propositions)
      } else {
        throw new Error('Format de réponse invalide')
      }
    } catch (error) {
      console.error('❌ Erreur génération personnalisée:', error)
      alert('Erreur lors de la génération des propositions: ' + (error as Error).message)
    } finally {
      console.log('✅ isLoadingProposals = false')
      setIsLoadingProposals(false)
    }
  }

  // Soumission du formulaire MOBILE: workflow séparé pour éviter toute interférence
  const handleMobilePersonalizationSubmit = async (userContext: any) => {
    if (!mobileSelectedSecteur || !analysis) return
    setMobileIsLoadingProposals(true)
    setMobileProposals([])
    setMobileLastUserContext(userContext)
    try {
      const budgetRange = budgetLevels.find(b => b.id === (userContext.budget_principal || ''))?.range || userContext.budget_principal
      
      console.log('📱 Mobile: Génération propositions pour', mobileSelectedSecteur.nom, 'avec budget', budgetRange)

      const response = await fetch(`${API_URL}/api/opportunities/generate-proposals`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          userId: user?.id || null,
          secteur: mobileSelectedSecteur.nom,
          budget: budgetRange,
          problematique: analysis?.analyse_contextuelle?.problematique_centrale || '',
          userContext: {
            situation: userContext.situation || '',
            competences: userContext.competences || userContext.competences_actuelles || [],
            disponibilite: userContext.disponibilite || '',
            objectif_delai: userContext.objectif_delai || userContext.delai_lancement || '',
            experience_entrepreneuriale: userContext.experience_entrepreneuriale || '',
            contraintes: userContext.contraintes || ''
          },
          article: selectedArticle ? {
            title: selectedArticle.title,
            summary: selectedArticle.summary,
            source: selectedArticle.source,
            url: selectedArticle.url
          } : undefined
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Mobile: Erreur API:', errorData)
        throw new Error(errorData.error || 'Erreur lors de la génération des propositions')
      }
      
      const data: any = await response.json()
      console.log('✅ Mobile: Propositions reçues:', data)
      
      if (data.success && data.propositions) {
        console.log('✅ Mobile: Setting', data.propositions.length, 'propositions')
        setMobileProposals(data.propositions)
      } else {
        throw new Error('Format de réponse invalide')
      }
    } catch (error) {
      console.error('❌ Mobile: Erreur génération:', error)
      alert('Erreur lors de la génération des propositions: ' + (error as Error).message)
    } finally {
      console.log('✅ Mobile: isLoadingProposals = false')
      setMobileIsLoadingProposals(false)
    }
  }

  // Génération du test de compétence
  const handleGenerateSkillTest = async (proposalIndex: number) => {
    const currentUserId = await ensureUserId()
    if (!currentUserId) {
      alert('Veuillez vous connecter pour générer le test de compétence')
      router.push('/auth/signin')
      return
    }
    
    if (!selectedArticle || !analysis || !proposals[proposalIndex]) {
      alert('Sélectionnez une proposition d\'abord')
      return
    }
    
    setIsGeneratingSkillTest(true)
    setSkillTestForIndex(proposalIndex)
    setGeneratedSkillTest(null)
    
    try {
      const proposal = proposals[proposalIndex]
      const budgetRange = budgetLevels.find(b => b.id === (selectedBudget || lastUserContext?.budget_principal))?.range
        || selectedBudget || lastUserContext?.budget_principal || ''
      
      const response = await fetch(`${API_URL}/api/skill-test/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          articleId: selectedArticle.id,
          proposal: {
            titre: proposal.titre,
            description: proposal.description,
            secteur: selectedSecteur?.nom,
            budget: budgetRange,
            premiers_investissements: proposal.premiers_investissements,
            delai_lancement: proposal.delai_lancement
          },
          userContext: lastUserContext || {},
          articleContext: {
            title: selectedArticle.title,
            summary: selectedArticle.summary,
            problematique: analysis?.analyse_contextuelle?.problematique_centrale
          }
        })
      })
      
      if (!response.ok) throw new Error('Erreur lors de la génération du test')
      
      const data = await response.json()
      setGeneratedSkillTest(data.test)
      setGeneratedSkillTestId(data.testId)
      setShowSkillTestModal(true)
      
      console.log('✅ Test de compétence généré:', data.test, 'ID:', data.testId)
      
    } catch (error) {
      console.error('❌ Erreur génération test:', error)
      alert('Erreur lors de la génération du test de compétence')
    } finally {
      setIsGeneratingSkillTest(false)
    }
  }

  // Fonction pour sauvegarder le contexte utilisateur
  const handleSaveContext = async () => {
    if (!user?.id || !contextName.trim() || !lastUserContext) {
      alert('Veuillez entrer un nom pour ce contexte')
      return
    }

    setSavingContext(true)
    try {
      const response = await fetch(`${API_URL}/api/user-contexts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          contextName: contextName.trim(),
          ...lastUserContext
        })
      })

      const data = await response.json()

      if (data.success) {
        setShowSaveContextModal(false)
        setContextName('')
        alert('✅ Contexte sauvegardé avec succès !')
      } else {
        alert(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur sauvegarde contexte:', error)
      alert('Erreur lors de la sauvegarde du contexte')
    } finally {
      setSavingContext(false)
    }
  }

  // Fonction pour sauvegarder un projet
  // Fonction pour sauvegarder le sommaire de formation dans Documents générés
  const saveTrainingSummaryToDocuments = async (training: any, trainingId: string, projectId: string, proposal: any) => {
    try {
      // Formater le contenu du sommaire
      const modulesText = training.modules.map((m: any, idx: number) => 
        `### Module ${idx + 1}: ${m.competence}\n` +
        `**Priorité**: ${m.priority} | **Niveau**: ${m.level}\n` +
        `**Objectif**: ${m.objective}\n` +
        `**Durée estimée**: ${m.duration}\n\n`
      ).join('\n')

      const pricingText = training.pricing ? 
        `\n## 💰 Tarification\n\n` +
        `- **Par module**: ${training.pricing.per_module} crédits/module\n` +
        `- **Formation complète**: ${training.pricing.full_training} crédits\n` +
        `- **Économie**: ${training.pricing.savings} crédits\n\n` : ''

      const fullContent = 
        `# ${training.title}\n\n` +
        `**Durée totale**: ${training.total_duration || 'Non spécifiée'}\n` +
        `**Marge d'exécution**: ${training.execution_margin || 'Non spécifiée'}\n\n` +
        `---\n\n` +
        `## 📚 Modules de formation\n\n` +
        modulesText +
        pricingText +
        `---\n\n` +
        `*Formation générée automatiquement pour le projet: ${proposal.titre}*`

      // Sauvegarder dans project_documents
      const response = await fetch(`${API_URL}/api/project-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user?.id,
          documentType: 'custom-training',
          title: training.title,
          content: fullContent,
          promptUsed: 'Formation générée via dropdown Aller + Loin',
          contextAdded: `Proposition: ${proposal.titre}`,
          metadata: {
            trainingId,
            moduleCount: training.modules.length,
            totalDuration: training.total_duration,
            pricing: training.pricing,
            generatedFrom: 'analyzer-dropdown'
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        console.log('✅ Sommaire de formation sauvegardé dans Documents générés:', data.document.id)
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde sommaire formation:', error)
      // Ne pas bloquer l'utilisateur si la sauvegarde échoue
    }
  }

  const saveProject = async (proposalIndex: number) => {
    if (!selectedArticle || !analysis || !selectedSecteur || !selectedBudget || !proposals[proposalIndex]) {
      alert('Données manquantes pour la sauvegarde')
      return
    }

    // Vérifier que l'utilisateur est connecté
    if (!user?.id) {
      alert('Vous devez être connecté pour sauvegarder un projet')
      return
    }

    setSavingProjects(prev => new Set(prev).add(proposalIndex))

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await getCurrentSession()
      if (!session?.access_token) {
        throw new Error('Token d\'authentification manquant')
      }

      const response = await fetch(`${API_URL}/api/saved-projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          article: selectedArticle,
          analysis,
          secteurSelectionne: selectedSecteur.nom,
          budgetSelectionne: selectedBudget,
          proposition: proposals[proposalIndex],
          userContext: lastUserContext // Ajouter le contexte utilisateur complet
        })
      })

      const result = await response.json()

      if (result.success) {
        setSavedProjects(prev => new Set(prev).add(proposalIndex))
        // Sauvegarder l'ID du projet pour référence future
        if (result.projectId) {
          setSavedProjectIds(prev => new Map(prev).set(proposalIndex, result.projectId))
        }
        alert('Projet sauvegardé avec succès!')
      } else {
        throw new Error(result.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Erreur lors de la sauvegarde du projet')
    } finally {
      setSavingProjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(proposalIndex)
        return newSet
      })
    }
  }

  // Sauvegarde projet MOBILE: utilise les états mobiles séparés
  const saveMobileProject = async (proposalIndex: number) => {
    if (!selectedArticle || !analysis || !mobileSelectedSecteur || !mobileProposals[proposalIndex]) {
      alert('Données manquantes pour la sauvegarde')
      return
    }

    if (!user?.id) {
      alert('Vous devez être connecté pour sauvegarder un projet')
      return
    }

    setSavingProjects(prev => new Set(prev).add(proposalIndex))

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await getCurrentSession()
      if (!session?.access_token) {
        throw new Error('Token d\'authentification manquant')
      }

      const budgetValue = mobileLastUserContext?.budget_principal || ''

      const response = await fetch(`${API_URL}/api/saved-projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          article: selectedArticle,
          analysis,
          secteurSelectionne: mobileSelectedSecteur.nom,
          budgetSelectionne: budgetValue,
          proposition: mobileProposals[proposalIndex],
          userContext: mobileLastUserContext
        })
      })

      const result = await response.json()

      if (result.success) {
        setSavedProjects(prev => new Set(prev).add(proposalIndex))
        if (result.projectId) {
          setSavedProjectIds(prev => new Map(prev).set(proposalIndex, result.projectId))
        }
        alert('Projet sauvegardé avec succès!')
      } else {
        throw new Error(result.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('📱 Mobile: Error saving project:', error)
      alert('Erreur lors de la sauvegarde du projet')
    } finally {
      setSavingProjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(proposalIndex)
        return newSet
      })
    }
  }

  // Fetch recent articles
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(`${API_URL}/api/articles?tab=all&limit=120`)
        const data = await response.json()
        setArticles(data.articles || [])
        console.log('📈 Articles chargés pour opportunités IA:', data.articles?.length || 0)
        // Debug: vérifier si les articles ont bien un champ source
        if (data.articles && data.articles.length > 0) {
          console.log('🔍 Premier article:', {
            title: data.articles[0].title,
            source: data.articles[0].source,
            image_url: data.articles[0].image_url
          })
        }
      } catch (error) {
        console.error('Error fetching articles:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [])

  // Sélectionne uniquement l'article (ne lance pas l'analyse)
  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article)
    setAnalysis(null)
    setSelectedSecteur(null)
    setSelectedBudget(null)
    setProposals([])
    setIsLoading(false)
  }

  const handleAnalyzeArticle = async (article: Article) => {
    setIsLoading(true)
    setSelectedArticle(article)
    setAnalysis(null)
    setSelectedSecteur(null)
    setSelectedBudget(null)
    setProposals([])

    try {
      const currentUserId = await ensureUserId()
      if (!currentUserId) {
        alert('Veuillez vous connecter pour utiliser l\'analyse IA')
        // S'assurer d'arrêter le spinner si redirection
        setIsLoading(false)
        router.push('/auth/signin')
        return
      }

      const { res, json } = await fetchJsonWithTimeout(`${API_URL}/api/opportunities/analyze`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          article: {
            title: article.title,
            summary: article.summary,
            source: article.source,
            url: article.url
          },
          userId: currentUserId
        })
      }, 35000, 'Analyse')

      // Gestion des erreurs avec messages améliorés
      if (!res.ok) {
        const errorData = (json as any) || {}
        
        // 401: Non connecté
        if (res.status === 401 || errorData.requireLogin) {
          alert('🔐 Connexion requise\n\nVeuillez vous connecter pour utiliser l\'analyse IA.')
          window.location.href = '/auth/signin'
          return
        }
        
        // 402: Crédits insuffisants
        if (res.status === 402 || errorData.needsTopUp) {
          if (errorData.details?.required && errorData.details?.available !== undefined) {
            alert(`💰 Crédits insuffisants\n\nReq uis: ${errorData.details.required} crédits\nDisponible: ${errorData.details.available} crédits\n\nRechargez votre compte pour continuer.`)
          }
          setShowTopUpModal(true)
          return
        }
        
        // 503: Problème de service (quota OpenAI ou rate limit)
        if (res.status === 503 || errorData.isServiceIssue) {
          let message = '⚠️ Service temporairement indisponible\n\n'
          
          if (errorData.reason === 'quota_exceeded') {
            message += 'Le budget IA est temporairement épuisé. Réessayez dans quelques heures.'
          } else if (errorData.reason === 'rate_limit_hour') {
            message += 'Limite horaire atteinte. Réessayez dans quelques minutes.'
          } else if (errorData.reason === 'rate_limit_day') {
            message += 'Limite journalière atteinte. Réessayez demain.'
          } else if (errorData.reason === 'too_many_errors') {
            message += 'Service en maintenance suite à des erreurs. Réessayez plus tard.'
          } else {
            message += errorData.error || 'Le service est temporairement saturé. Réessayez plus tard.'
          }
          
          alert(message)
          return
        }
        
        // Autres erreurs
        const errorMessage = errorData.error || 'Erreur lors de l\'analyse'
        throw new Error(errorMessage)
      }

      if (!json) throw new Error('Réponse vide ou invalide')
      
      console.log('🔍 Réponse Analyse reçue:', json);
      if (json.analyse_contextuelle) {
        console.log('✅ analyse_contextuelle présente:', json.analyse_contextuelle);
      } else {
        console.warn('⚠️ analyse_contextuelle MANQUANTE dans la réponse');
      }

      setAnalysis(json as any)
      
      // Si l'enrichissement est présent dans la réponse, on l'utilise
      if ((json as any).enrichment) {
        // L'enrichissement est déjà inclus dans la réponse
        console.log('✅ Enrichissement automatique reçu:', (json as any).enrichment)
      }
    } catch (error) {
      console.error('❌ Erreur analyse:', error)
      
      // Message d'erreur détaillé
      let errorMsg = '❌ Erreur lors de l\'analyse\n\n'
      
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          errorMsg += '🚫 Le quota OpenAI est dépassé.\nLe service sera de nouveau disponible sous peu.'
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMsg += '⏱️ La requête a pris trop de temps.\nRéessayez avec un article plus court.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMsg += '🌐 Problème de connexion réseau.\nVérifiez votre connexion internet.'
        } else {
          errorMsg += error.message
        }
      } else {
        errorMsg += 'Une erreur inattendue s\'est produite.'
      }
      
      alert(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSecteur = (secteur: SecteurOpportunite) => {
    setSelectedSecteur(secteur)
    setSelectedBudget(null)
    setProposals([])
  }

  const handleSelectBudget = async (budgetLevel: string) => {
    if (!selectedSecteur || !analysis) return
    
    setIsLoadingProposals(true)
    setSelectedBudget(budgetLevel)
    setProposals([])

    try {
      const response = await fetch(`${API_URL}/api/opportunities/generate-by-budget`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          secteur: selectedSecteur.nom,
          budget: budgetLevels.find(b => b.id === budgetLevel)?.range || budgetLevel,
          problematique: analysis?.analyse_contextuelle?.problematique_centrale || ''
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération des propositions')
      }

      const data: ProposalsResponse = await response.json()
      setProposals(data.propositions)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la génération des propositions')
    } finally {
      setIsLoadingProposals(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Chargement des articles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header onMobileMenuToggle={() => setIsSidebarOpen(true)} />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          isMobileOpen={isSidebarOpen}
          onMobileClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full py-4 sm:py-8 px-4 lg:px-8 max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 hidden lg:block">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  Analyseur Business IA
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Sélectionnez un article gabonais et découvrez les opportunités business enrichies par notre IA MCP
              </p>
              <p className="text-sm text-gray-400 mt-2">
                ✨ Analyse IA optimisée - Version 2.2 - Fonctions corrigées
              </p>
            </motion.div>


            <div className="grid lg:grid-cols-[minmax(400px,1fr)_minmax(500px,1.3fr)] gap-6">
          {/* Section Articles */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Articles Récents</h2>
            </div>

            <div className="space-y-4 max-h-[800px] overflow-y-auto">
              {articles.map((article) => (
                <motion.div
                  key={article.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedArticle?.id === article.id
                      ? 'bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border-yellow-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => handleSelectArticle(article)}
                >
                  <div className="flex gap-4">
                    {/* Vignette image (utilise image_url proxifiée de Supabase) */}
                    <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 relative">
                      {(() => {
                        // Détecter si c'est un article Facebook
                        const isFacebookArticle = article.url && article.url.includes('facebook.com')
                        
                        // Pour Facebook, utiliser la route spéciale facebook-og
                        let imageUrl = article.image_url
                        let proxiedUrl = null
                        
                        if (isFacebookArticle && !imageUrl) {
                          // Utiliser la route spéciale pour extraire l'image Open Graph
                          proxiedUrl = `${API_URL}/api/image-proxy/facebook-image?url=${encodeURIComponent(article.url)}`
                        } else if (imageUrl) {
                          // Utiliser l'image normale avec proxy CORS
                          proxiedUrl = getProxiedImage(imageUrl, article.title)
                        }
                        
                        return proxiedUrl ? (
                          <>
                            <img
                              src={proxiedUrl}
                              alt={article.title}
                              className="w-full h-full rounded-lg object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement
                                el.style.display = 'none'
                                const fallback = el.nextElementSibling as HTMLElement | null
                                if (fallback) fallback.classList.remove('hidden')
                              }}
                            />
                            <div className="hidden w-full h-full rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center border border-white/10">
                              <Sparkles className="w-8 h-8 text-blue-400" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center border border-white/10">
                            <Sparkles className="w-8 h-8 text-blue-400" />
                          </div>
                        )
                      })()}
                    </div>
                    
                    {/* Contenu article */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-white line-clamp-2 flex-1">
                          {article.title}
                        </h3>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors group"
                          title="Lire l'article complet"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-yellow-400" />
                        </a>
                      </div>
                      <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                        {article.summary}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        {article.source && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span className="text-xs font-medium text-blue-300">{article.source}</span>
                          </div>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{new Date(article.published_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Section Analyse */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            {!selectedArticle && (
              <div className="text-center py-12">
                <Lightbulb className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Sélectionnez un article
                </h3>
                <p className="text-gray-300">
                  Choisissez un article pour découvrir les opportunités business qu'il révèle
                </p>
              </div>
            )}

            {selectedArticle && isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Analyse en cours...
                </h3>
                <p className="text-gray-300">
                  Notre IA analyse l'article pour identifier les opportunités
                </p>
              </div>
            )}

            {selectedArticle && !isLoading && !analysis && (
              <div className="">
                {/* Desktop: bouton de validation sans répéter l'article */}
                <div className="hidden lg:flex">
                  <button
                    onClick={() => handleAnalyzeArticle(selectedArticle)}
                    className="inline-flex items-center justify-center py-3 px-4 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-600 hover:to-yellow-500 text-black font-semibold shadow-lg shadow-orange-500/30 transition-all"
                  >
                    Analyser cet article
                  </button>
                </div>
              </div>
            )}

            {analysis && (
              <div className="space-y-6">
                {/* Analyse contextuelle */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Analyse Contextuelle</h3>
                  </div>
                  
                  <div className="bg-white/5 rounded-xl p-4 mb-4">
                    <p className="text-gray-300 mb-3">
                      Nous avons analysé des opportunités à travers cette problématique :
                    </p>
                    <p className="text-white font-medium bg-gradient-to-r from-yellow-400/20 to-orange-500/20 p-3 rounded-lg border border-yellow-400/30">
                      {analysis?.analyse_contextuelle?.problematique_centrale || 'Problématique non disponible'}
                    </p>
                  </div>
                </div>

                {/* Enrichissement MCP intégré dans l'analyse - pas d'affichage séparé */}

                {/* Secteurs d'opportunités */}
                {!selectedSecteur ? (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Secteurs d'activité identifiés pour entreprendre :
                    </h4>
                    <div className="space-y-3">
                      {(analysis?.secteurs_opportunites || []).map((secteur, index) => (
                        <React.Fragment key={index}>
                          {/* Mobile card → ouvre le modal */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="md:hidden p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all"
                            onClick={() => {
                              // États mobiles séparés
                              setMobileSelectedSecteur(secteur)
                              setMobileProposals([])
                              setMobileIsLoadingProposals(false)
                              setMobileLastUserContext(null)
                              setShowMobileProposalModal(true)
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-semibold text-white mb-1">{secteur.nom}</h5>
                                <p className="text-gray-300 text-sm">{secteur.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-yellow-400 font-bold">
                                  {secteur.score_potentiel}/10
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400" />
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-white/60">
                              Appuyer pour générer 3 idées de projets concrètes
                            </div>
                          </motion.div>

                          {/* Desktop card → workflow inline conservé */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="hidden md:block p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition-all"
                            onClick={() => handleSelectSecteur(secteur)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-semibold text-white mb-1">{secteur.nom}</h5>
                                <p className="text-gray-300 text-sm">{secteur.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-yellow-400 font-bold">
                                  {secteur.score_potentiel}/10
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400" />
                              </div>
                            </div>
                          </motion.div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : !selectedBudget ? (
                  isDesktop ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">
                        Secteur sélectionné : {selectedSecteur.nom}
                      </h4>
                      <button
                        onClick={() => setSelectedSecteur(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        ← Retour
                      </button>
                    </div>

                    {/* Gestionnaire de contextes sauvegardés */}
                    <SavedContextsManager
                      userId={user?.id || null}
                      currentContext={lastUserContext}
                      onLoadContext={(context) => {
                        // Charger le contexte et passer directement au choix du budget
                        const loadedContext = {
                          situation: context.situation,
                          competences: context.competences,
                          disponibilite: context.disponibilite,
                          objectif_delai: context.objectif_delai,
                          experience_entrepreneuriale: context.experience_entrepreneuriale,
                          contraintes: context.contraintes,
                          budget_principal: context.budget_principal
                        }
                        setLastUserContext(loadedContext)
                        // Auto-submit avec le contexte chargé
                        handleInlinePersonalizationSubmit(loadedContext)
                      }}
                      onSaveContext={(name) => {
                        console.log('✅ Contexte sauvegardé:', name)
                      }}
                    />

                    <div className="mb-4">
                      <h5 className="text-white font-semibold mb-1">🎯 Personnalisez votre contexte</h5>
                      <p className="text-gray-300 text-sm">Renseignez votre profil pour adapter les propositions à votre situation.</p>
                    </div>
                    <PersonalizationFormInline
                      budgetOptions={budgetLevels as any}
                      onSubmit={handleInlinePersonalizationSubmit}
                      isLoading={isLoadingProposals}
                      userId={user?.id}
                      onSaveProfile={async (context) => {
                        if (!user?.id) return
                        const contextName = `Profil ${new Date().toLocaleDateString()}`
                        try {
                          const response = await fetch(`${API_URL}/api/user-contexts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              userId: user.id,
                              contextName,
                              situation: context.situation || '',
                              competences: context.competences || [],
                              disponibilite: context.disponibilite || '',
                              objectif_delai: context.objectif_delai || '',
                              experience_entrepreneuriale: context.experience_entrepreneuriale || '',
                              contraintes: context.contraintes || '',
                              budget_principal: context.budget_principal || ''
                            })
                          })
                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || 'Erreur sauvegarde')
                          }
                          alert('\u2705 Profil sauvegardé avec succès !')
                        } catch (error) {
                          console.error('\u274c Erreur:', error)
                          alert(`\u274c ${error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'}`)
                        }
                      }}
                    />
                  </div>
                  ) : null
                ) : (
                  isDesktop ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">
                        Propositions pour {selectedSecteur.nom}
                      </h4>
                      <button
                        onClick={() => setSelectedBudget(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        ← Retour
                      </button>
                    </div>
                    
                    {isLoadingProposals ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                        <p className="text-gray-300">Génération des propositions...</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {proposals.map((proposal, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 bg-white/5 rounded-xl border border-white/10"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h5 className="font-semibold text-white">{proposal.titre}</h5>
                              <div className="text-yellow-400 font-bold text-sm">
                                {proposal.score_faisabilite}%
                              </div>
                            </div>
                            
                            <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                              {proposal.description}
                            </p>
                            
                            <div className="mb-4">
                              {proposal.premiers_investissements && (
                                <div className="mb-3">
                                  <p className="text-gray-400 text-xs mb-2">Premiers investissements :</p>
                                  {(() => {
                                    const val: any = proposal.premiers_investissements as any
                                    // Fonction pour supprimer les montants XAF
                                    const removeAmounts = (text: string) => 
                                      text.replace(/:\s*[\d,.]+\s*(k|M|million|millions)?\s*XAF/gi, '')
                                          .replace(/\s*[\d,.]+\s*(k|M|million|millions)?\s*XAF/gi, '')
                                          .trim()
                                    const items = Array.isArray(val)
                                      ? (val as string[]).map(removeAmounts)
                                      : String(val || '')
                                          .split(/(?:\s*[•–—]\s+|\s-\s|[,;]|\n)+/)
                                          .map(s => removeAmounts(s.trim()))
                                          .filter(Boolean)
                                    if (items.length > 1) {
                                      return (
                                        <ul className="text-white text-sm space-y-2 pl-4">
                                          {items.map((it, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                              <span className="text-yellow-400 mt-1.5 flex-shrink-0">•</span>
                                              <span>{it}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )
                                    }
                                    return (
                                      <p className="text-white font-medium text-sm">{removeAmounts(String(val))}</p>
                                    )
                                  })()}
                                </div>
                              )}
                              {proposal.delai_lancement && (
                                <div>
                                  <p className="text-gray-400 text-xs mb-1">Délai de lancement</p>
                                  <p className="text-white font-medium">{proposal.delai_lancement}</p>
                                </div>
                              )}
                            </div>
                            
                            {proposal.avantages && proposal.avantages.length > 0 && (
                              <div className="mb-4">
                                <p className="text-gray-400 text-xs mb-2">Avantages :</p>
                                <div className="space-y-2">
                                  {proposal.avantages.slice(0, 2).map((avantage: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                      <p className="text-gray-300 text-sm leading-relaxed">{avantage}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <button 
                                onClick={() => saveProject(index)}
                                disabled={savingProjects.has(index)}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                  savedProjects.has(index)
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                              >
                                {savingProjects.has(index) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Sauvegarde...
                                  </>
                                ) : savedProjects.has(index) ? (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    Sauvegardé
                                  </>
                                ) : (
                                  <>
                                    <Bookmark className="w-4 h-4" />
                                    Sauvegarder
                                  </>
                                )}
                              </button>
                              <button 
                                onClick={() => {
                                  const projectId = savedProjectIds.get(index)
                                  if (!projectId) {
                                    alert('⚠️ Veuillez d\'abord sauvegarder ce projet pour accéder aux options avancées')
                                    return
                                  }
                                  router.push(`/business/mes-projets?projectId=${projectId}&openCard=true`)
                                }}
                                disabled={!savedProjects.has(index)}
                                className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                  savedProjects.has(index)
                                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-500 hover:to-orange-600'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                                title={!savedProjects.has(index) ? 'Sauvegardez d\'abord le projet' : 'Accéder au projet'}
                              >
                                <span className="inline-flex items-center gap-2">
                                  Aller + Loin
                                  <ArrowRight className="w-4 h-4" />
                                </span>
                              </button>
                            </div>
                          </motion.div>
                        ))}
                        </div>
                      </>
                    )}
                  </div>
                  ) : null
                )}
              </div>
            )}
            </motion.div>
          </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom slide-up CTA */}
      <AnimatePresence>
        {selectedArticle && !isLoading && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="lg:hidden fixed bottom-4 left-0 right-0 z-50 px-4"
          >
            <button
              onClick={() => router.push(`/business/analyzer/analysis?aid=${encodeURIComponent(selectedArticle.id)}`)}
              className={"w-full py-3 px-4 rounded-xl text-black font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 shadow-orange-500/30"}
              aria-label={'Analyser cet article'}
            >
              Analyser cet article
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Proposal Modal - États séparés pour workflow indépendant */}
      <AnimatePresence>
        {showMobileProposalModal && mobileSelectedSecteur && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileProposalModal(false)} />
            <div className="relative w-full sm:w-[640px] max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2 text-white/90">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold">{mobileSelectedSecteur.nom}</span>
                </div>
                <button aria-label="Fermer" onClick={() => setShowMobileProposalModal(false)} className="text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                {!mobileProposals || mobileProposals.length === 0 ? (
                  <>
                    {!mobileIsLoadingProposals && (
                      <div>
                        {/* Gestionnaire de contextes sauvegardés - Mobile */}
                        <SavedContextsManager
                          userId={user?.id || null}
                          currentContext={mobileLastUserContext}
                          onLoadContext={(context) => {
                            // Charger le contexte et auto-submit
                            const loadedContext = {
                              situation: context.situation,
                              competences: context.competences,
                              disponibilite: context.disponibilite,
                              objectif_delai: context.objectif_delai,
                              experience_entrepreneuriale: context.experience_entrepreneuriale,
                              contraintes: context.contraintes,
                              budget_principal: context.budget_principal
                            }
                            setMobileLastUserContext(loadedContext)
                            handleMobilePersonalizationSubmit(loadedContext)
                          }}
                          onSaveContext={(name) => {
                            console.log('✅ Mobile: Contexte sauvegardé:', name)
                          }}
                        />

                        <div className="text-white/90 font-medium mb-4">Personnalisez votre contexte</div>
                        <PersonalizationFormInline
                          budgetOptions={budgetLevels as any}
                          onSubmit={handleMobilePersonalizationSubmit}
                          isLoading={mobileIsLoadingProposals}
                          userId={user?.id}
                        />
                      </div>
                    )}
                    {mobileIsLoadingProposals && (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                        <div className="text-white/90">Génération des propositions...</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    {mobileProposals.map((proposal, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 bg-white/5 rounded-xl border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h5 className="font-semibold text-white">{proposal.titre}</h5>
                          <div className="text-yellow-400 font-bold text-sm">
                            {proposal.score_faisabilite}%
                          </div>
                        </div>
                        
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                          {proposal.description}
                        </p>
                        
                        <div className="mb-4">
                          {proposal.premiers_investissements && (
                            <div className="mb-3">
                              <p className="text-gray-400 text-xs mb-2">Premiers investissements :</p>
                              {(() => {
                                const val: any = proposal.premiers_investissements as any
                                // Fonction pour supprimer les montants XAF
                                const removeAmounts = (text: string) => 
                                  text.replace(/:\s*[\d,.]+\s*(k|M|million|millions)?\s*XAF/gi, '')
                                      .replace(/\s*[\d,.]+\s*(k|M|million|millions)?\s*XAF/gi, '')
                                      .trim()
                                const items = Array.isArray(val)
                                  ? (val as string[]).map(removeAmounts)
                                  : String(val || '')
                                      .split(/(?:\s*[•–—]\s+|\s-\s|[,;]|\n)+/)
                                      .map(s => removeAmounts(s.trim()))
                                      .filter(Boolean)
                                if (items.length > 1) {
                                  return (
                                    <ul className="text-white text-sm space-y-2 pl-4">
                                      {items.map((it, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-yellow-400 mt-1.5 flex-shrink-0">•</span>
                                          <span>{it}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                }
                                return (
                                  <p className="text-white font-medium text-sm">{removeAmounts(String(val))}</p>
                                )
                              })()}
                            </div>
                          )}
                          {proposal.delai_lancement && (
                            <div>
                              <p className="text-gray-400 text-xs mb-1">Délai de lancement</p>
                              <p className="text-white font-medium">{proposal.delai_lancement}</p>
                            </div>
                          )}
                        </div>
                        
                        {proposal.avantages && proposal.avantages.length > 0 && (
                          <div className="mb-4">
                            <p className="text-gray-400 text-xs mb-2">Avantages :</p>
                            <div className="space-y-2">
                              {proposal.avantages.slice(0, 2).map((avantage: string, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-gray-300 text-sm leading-relaxed">{avantage}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => saveMobileProject(index)}
                            disabled={savingProjects.has(index)}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              savedProjects.has(index)
                                ? 'bg-green-600 text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            {savingProjects.has(index) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Sauvegarde...
                              </>
                            ) : savedProjects.has(index) ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Sauvegardé
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-4 h-4" />
                                Sauvegarder
                              </>
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              const projectId = savedProjectIds.get(index)
                              if (!projectId) {
                                alert('⚠️ Veuillez d\'abord sauvegarder ce projet pour accéder aux options avancées')
                                return
                              }
                              router.push(`/business/mes-projets?projectId=${projectId}&openCard=true`)
                            }}
                            disabled={!savedProjects.has(index)}
                            className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                              savedProjects.has(index)
                                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-500 hover:to-orange-600'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                            title={!savedProjects.has(index) ? 'Sauvegardez d\'abord le projet' : 'Accéder au projet'}
                          >
                            <ArrowRight className="w-4 h-4" />
                            Aller + Loin
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal guidage WhatsApp */}
      {showWhatsAppGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => user && setShowWhatsAppGuide(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Analyseur Business IA</h2>
            <p className="text-gray-500 text-sm mb-6">
              Transformez cet article en projet business avec notre IA
            </p>

            <div className="space-y-3 text-left mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  user ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {user ? '\u2713' : '1'}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {user ? 'Connecte' : 'Connectez-vous'}
                  </div>
                  {!user && <div className="text-xs text-gray-500">Gratuit, en 30 secondes</div>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  creditBalance !== null && creditBalance >= 15
                    ? 'bg-green-100 text-green-600'
                    : user ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {creditBalance !== null && creditBalance >= 15 ? '\u2713' : '2'}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {creditBalance !== null && creditBalance >= 15
                      ? `${creditBalance} credits disponibles`
                      : 'Rechargez vos credits'}
                  </div>
                  <div className="text-xs text-gray-500">L&apos;analyse coute 15 credits</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Lancez l&apos;analyse</div>
                  <div className="text-xs text-gray-500">Business plan, budget, strategie</div>
                </div>
              </div>
            </div>

            {!user ? (
              <button
                onClick={() => {
                  const currentUrl = window.location.pathname + window.location.search
                  window.location.href = `/auth/signin?redirectTo=${encodeURIComponent(currentUrl)}`
                }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Se connecter
              </button>
            ) : creditBalance !== null && creditBalance < 15 ? (
              <button
                onClick={() => { setShowWhatsAppGuide(false); setShowTopUpModal(true) }}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Recharger mes credits
              </button>
            ) : (
              <button
                onClick={() => setShowWhatsAppGuide(false)}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Commencer l&apos;analyse
              </button>
            )}

            {user && (
              <button onClick={() => setShowWhatsAppGuide(false)} className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Fermer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de recharge crédits */}
      <TopUpModal
        open={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        onPurchased={() => setShowTopUpModal(false)}
      />

      {/* Modal Sommaire Formation */}
      <TrainingSummaryModal
        open={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        training={generatedTraining}
        trainingId={generatedTrainingId}
        userId={user?.id}
        onNeedsTopUp={() => setShowTopUpModal(true)}
      />

      {/* Modal Test de Compétence */}
      <SkillTestModal
        open={showSkillTestModal}
        onClose={() => setShowSkillTestModal(false)}
        test={generatedSkillTest}
        proposalTitle={skillTestForIndex !== null ? proposals[skillTestForIndex]?.titre || '' : ''}
        testId={generatedSkillTestId}
        userId={user?.id}
      />

      {/* Modal Plan d'Action */}
      <ActionPlanModal
        isOpen={showActionPlanModal}
        onClose={() => {
          setShowActionPlanModal(false)
          setSelectedProposalForActionPlan(null)
        }}
        userId={user?.id || ''}
        articleId={selectedArticle?.id}
        proposal={selectedProposalForActionPlan !== null ? {
          titre: proposals[selectedProposalForActionPlan]?.titre || '',
          description: proposals[selectedProposalForActionPlan]?.description || '',
          secteur: selectedSecteur?.nom,
          budget: budgetLevels.find(b => b.id === selectedBudget)?.range || selectedBudget || undefined
        } : {
          titre: '',
          description: '',
          secteur: undefined,
          budget: undefined
        }}
        userContext={lastUserContext}
        onPlanCreated={(plan) => {
          console.log('✅ Plan d\'action créé:', plan)
          // Optionnel: rediriger vers la page Mes Documents
          // router.push('/business/mes-projets')
        }}
      />

      {/* Modal de sauvegarde de contexte */}
      {showSaveContextModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">💾 Sauvegarder ce contexte</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom du contexte
              </label>
              <input
                type="text"
                value={contextName}
                onChange={(e) => setContextName(e.target.value)}
                placeholder="Ex: Profil Entrepreneur Tech"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                maxLength={50}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveContextModal(false)
                  setContextName('')
                }}
                className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveContext}
                disabled={savingContext || !contextName.trim()}
                className="flex-1 px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {savingContext ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
