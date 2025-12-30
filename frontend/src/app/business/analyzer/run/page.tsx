"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import PersonalizationFormInline from '@/components/forms/PersonalizationFormInline'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const budgetLevels = [
  { 
    id: 'micro', 
    name: 'Micro-Budget',
    range: '0 - 500,000 XAF', 
    description: 'Démarrage minimal, idéal pour tester son idée',
    color: 'from-green-400 to-emerald-500'
  },
  { 
    id: 'petit', 
    name: 'Petit Budget',
    range: '500,000 - 2,000,000 XAF', 
    description: 'Lancement avec quelques améliorations',
    color: 'from-blue-400 to-cyan-500'
  },
  { 
    id: 'moyen', 
    name: 'Budget Moyen',
    range: '2,000,000 - 10,000,000 XAF', 
    description: 'Développement sérieux avec scale-up',
    color: 'from-purple-400 to-pink-500'
  },
  { 
    id: 'confortable', 
    name: 'Budget Confortable',
    range: '10,000,000+ XAF', 
    description: 'Vision complète avec expansion',
    color: 'from-orange-400 to-red-500'
  }
]

function PersonalizationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  const articleId = searchParams?.get('aid')
  const sector = searchParams?.get('sector')
  
  const [isLoading, setIsLoading] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [savedContexts, setSavedContexts] = useState<any[]>([])
  const [showContextSelector, setShowContextSelector] = useState(false)
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [preloadedContext, setPreloadedContext] = useState<any>(null)
  const [hasExistingContext, setHasExistingContext] = useState(false)

  useEffect(() => {
    if (!articleId || !sector) {
      router.push('/business/analyzer')
      return
    }

    if (!user) {
      const currentUrl = `/business/analyzer/run?aid=${articleId}&sector=${encodeURIComponent(sector)}`
      router.push(`/auth/signin?redirect=${encodeURIComponent(currentUrl)}`)
      return
    }

    // Charger l'analyse depuis localStorage (sauvegardée par la page analysis)
    const storedAnalysis = localStorage.getItem('mobile_analysis')
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis))
      } catch (err) {
        console.error('Erreur parsing analysis:', err)
      }
    }

    // Charger les contextes sauvegardés de l'utilisateur
    if (user?.id) {
      loadSavedContexts()
    }
  }, [articleId, sector, user, router])

  const loadSavedContexts = async () => {
    if (!user?.id) return
    
    setLoadingContexts(true)
    try {
      const response = await fetch(`${API_URL}/api/user-contexts/${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const contexts = data.contexts || []
        setSavedContexts(contexts)
        
        // Si l'utilisateur a des contextes
        if (contexts.length > 0) {
          setHasExistingContext(true)
          setShowContextSelector(true)
          
          // Précharger le dernier contexte utilisé (le plus récent)
          const latestContext = contexts[0]
          const preloaded = {
            situation: latestContext.situation || '',
            competences: latestContext.competences || [],
            disponibilite: latestContext.disponibilite || '',
            objectif_delai: latestContext.objectif_delai || '',
            experience_entrepreneuriale: latestContext.experience_entrepreneuriale || '',
            contraintes: latestContext.contraintes || '',
            budget_principal: latestContext.budget_principal || ''
          }
          setPreloadedContext(preloaded)
          console.log('✅ Contexte préchargé:', latestContext.context_name)
        }
      }
    } catch (error) {
      console.error('Erreur chargement contextes:', error)
    } finally {
      setLoadingContexts(false)
    }
  }

  const handleSaveContext = async (userContext: any) => {
    if (!user?.id) return
    
    // Vérifier si un contexte existe déjà
    if (hasExistingContext) {
      const confirmUpdate = confirm('Un contexte existe déjà. Voulez-vous le mettre à jour ?')
      if (!confirmUpdate) return
    }
    
    const contextName = hasExistingContext 
      ? savedContexts[0]?.context_name 
      : prompt('Nom de ce contexte personnalisé:')
    
    if (!contextName?.trim()) return
    
    try {
      const response = await fetch(`${API_URL}/api/user-contexts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          contextName: contextName.trim(),
          ...userContext
        })
      })
      
      if (response.ok) {
        alert('✅ Contexte sauvegardé avec succès !')
        await loadSavedContexts()
      } else {
        throw new Error('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur sauvegarde contexte:', error)
      alert('❌ Erreur lors de la sauvegarde du contexte')
    }
  }

  const handlePersonalizationSubmit = async (userContext: any) => {
    if (!user || !articleId || !sector) return
    
    setIsLoading(true)
    
    try {
      const budgetRange = budgetLevels.find(b => b.id === userContext.budget_principal)?.range || userContext.budget_principal
      
      console.log('📱 Génération propositions:', { 
        userId: user.id,
        sector, 
        budget: budgetRange,
        userContext 
      })
      
      // Extraire la problématique de l'analyse
      const problematique = analysis?.problematique_identifiee || 
                           analysis?.problematique || 
                           `Opportunité identifiée dans le secteur ${sector}`
      
      const payload = {
        userId: user.id,
        secteur: sector,
        budget: budgetRange,
        problematique: problematique,
        userContext: {
          situation: userContext.situation || '',
          competences: userContext.competences || [],
          disponibilite: userContext.disponibilite || '',
          objectif_delai: userContext.objectif_delai || '',
          experience_entrepreneuriale: userContext.experience_entrepreneuriale || '',
          contraintes: userContext.contraintes || ''
        }
      }
      
      console.log('📱 Payload envoyé:', JSON.stringify(payload, null, 2))
      
      const response = await fetch(`${API_URL}/api/opportunities/generate-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('📱 Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erreur API:', response.status, errorText)
        throw new Error(`Erreur ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      
      if (data.success && data.propositions) {
        // Sauvegarder les propositions dans localStorage pour la page suivante
        localStorage.setItem('mobile_proposals', JSON.stringify(data.propositions))
        
        // Sauvegarder le budget sélectionné et le contexte utilisateur
        if (budgetRange) {
          localStorage.setItem('mobile_selected_budget', budgetRange)
        }
        if (userContext) {
          localStorage.setItem('mobile_user_context', JSON.stringify(userContext))
        }
        
        // Rediriger vers la page des propositions avec les données
        router.push(`/business/analyzer/proposals?aid=${articleId}&sector=${encodeURIComponent(sector)}`)
      }
    } catch (error) {
      console.error('❌ Erreur génération propositions:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert(`Erreur lors de la génération des propositions\n\n${errorMessage}\n\nVérifiez la console pour plus de détails.`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!articleId || !sector) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Personnalisation</h1>
            <p className="text-sm text-gray-400">{decodeURIComponent(sector)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Sélecteur de contextes sauvegardés */}
        {showContextSelector && savedContexts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="text-2xl">💾</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Contextes sauvegardés</h3>
                <p className="text-gray-300 text-sm">
                  Chargez un profil existant ou créez-en un nouveau
                </p>
              </div>
              <button
                onClick={() => setShowContextSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2">
              {savedContexts.map((context, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Charger ce contexte dans le formulaire
                    // TODO: Implémenter le chargement du contexte
                    alert(`Chargement du contexte: ${context.context_name}`)
                  }}
                  className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-blue-400 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{context.context_name}</div>
                      <div className="text-gray-400 text-xs mt-1">
                        {new Date(context.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-blue-400">→</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-white font-semibold mb-2">🎯 Personnalisez votre contexte</h2>
          <p className="text-gray-300 text-sm mb-6">
            Renseignez votre profil pour adapter les propositions à votre situation.
          </p>
          
          <PersonalizationFormInline
            budgetOptions={budgetLevels as any}
            onSubmit={handlePersonalizationSubmit}
            isLoading={isLoading}
            userId={user?.id}
            onSaveProfile={handleSaveContext}
            initialContext={preloadedContext}
          />
        </motion.div>
      </div>
    </div>
  )
}

export default function AnalyzerRunPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    }>
      <PersonalizationPage />
    </Suspense>
  )
}
