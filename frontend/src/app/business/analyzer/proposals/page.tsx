'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, Bookmark, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function ProposalsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  const articleId = searchParams?.get('aid')
  const sector = searchParams?.get('sector')
  
  const [proposals, setProposals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savedProjects, setSavedProjects] = useState<Set<number>>(new Set())
  const [savingProjects, setSavingProjects] = useState<Set<number>>(new Set())
  const [savedProjectIds, setSavedProjectIds] = useState<Map<number, string>>(new Map())
  const [selectedBudget, setSelectedBudget] = useState<string>('')
  const [userContext, setUserContext] = useState<any>(null)
  const [originalArticle, setOriginalArticle] = useState<any>(null)

  useEffect(() => {
    if (!articleId || !sector || !user) {
      router.push('/business/analyzer')
      return
    }

    // Charger les propositions depuis le localStorage (temporaire)
    // En production, elles seraient chargées depuis l'API
    const storedProposals = localStorage.getItem('mobile_proposals')
    if (storedProposals) {
      setProposals(JSON.parse(storedProposals))
    }
    
    // Charger le budget sélectionné et le contexte utilisateur
    const storedBudget = localStorage.getItem('mobile_selected_budget')
    if (storedBudget) {
      setSelectedBudget(storedBudget)
    }
    
    const storedContext = localStorage.getItem('mobile_user_context')
    if (storedContext) {
      setUserContext(JSON.parse(storedContext))
    }
    
    // Charger l'article original
    const storedArticle = localStorage.getItem('mobile_article')
    if (storedArticle) {
      setOriginalArticle(JSON.parse(storedArticle))
    }
    
    setIsLoading(false)
  }, [articleId, sector, user, router])

  const saveProject = async (index: number) => {
    if (!user || savedProjects.has(index)) return
    
    setSavingProjects(prev => new Set(prev).add(index))
    
    try {
      const proposal = proposals[index]
      const analysis = JSON.parse(localStorage.getItem('mobile_analysis') || '{}')
      
      // Construire l'objet article depuis localStorage ou données disponibles
      const article = {
        id: articleId,
        title: originalArticle?.title || proposal.titre,
        summary: originalArticle?.summary || proposal.description,
        url: originalArticle?.url || '',
        source: originalArticle?.source || '',
        published_at: new Date().toISOString()
      }
      
      const response = await fetch(`${API_URL}/api/saved-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          article: article,
          analysis: analysis,
          secteurSelectionne: sector,
          budgetSelectionne: selectedBudget || userContext?.budget_principal || 'Non spécifié',
          proposition: proposal,
          userContext: userContext || {}
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erreur API:', response.status, errorText)
        throw new Error('Erreur lors de la sauvegarde')
      }

      const data = await response.json()
      
      if (data.success) {
        const projectId = data.projectId
        
        setSavedProjects(prev => new Set(prev).add(index))
        
        // Sauvegarder l'ID du projet
        if (projectId) {
          setSavedProjectIds(prev => new Map(prev).set(index, projectId))
        }
        
        // Notification succès
        alert('✅ Projet sauvegardé avec succès !')
      } else {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      alert(`❌ Erreur lors de la sauvegarde du projet\n\n${errorMessage}`)
    } finally {
      setSavingProjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white">Chargement des propositions...</p>
        </div>
      </div>
    )
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
            <h1 className="text-xl font-bold text-white">Propositions</h1>
            <p className="text-sm text-gray-400">{decodeURIComponent(sector || '')}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {proposals.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-2xl border border-white/10 p-8 text-center"
          >
            <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-white font-semibold text-xl mb-2">Aucune proposition disponible</h2>
            <p className="text-gray-300 mb-6">
              Retournez à la personnalisation pour générer des propositions adaptées
            </p>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-xl"
            >
              Retour
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-xl border border-white/10 p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white flex-1">{proposal.titre}</h3>
                  <div className="ml-3 px-3 py-1 bg-yellow-400/20 rounded-full border border-yellow-400/30">
                    <span className="text-yellow-400 font-bold text-sm">
                      {proposal.score_faisabilite}%
                    </span>
                  </div>
                </div>
                
                {/* Description */}
                <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                  {proposal.description}
                </p>
                
                {/* Investissements & Délai */}
                <div className="mb-4 space-y-3">
                  {proposal.premiers_investissements && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2">Premiers investissements :</p>
                      {(() => {
                        const val: any = proposal.premiers_investissements
                        const items = Array.isArray(val)
                          ? val
                          : String(val || '')
                              .split(/(?:\s*[•–—]\s+|\s-\s|[,;]|\n)+/)
                              .map(s => s.trim())
                              .filter(Boolean)
                        
                        // Fonction pour supprimer les montants XAF et parenthèses vides
                        const removeXAF = (text: string) => {
                          return text
                            .replace(/\d{1,3}(?:[,.\s]\d{3})*\s*(?:XAF|FCFA|F\s*CFA)/gi, '')
                            .replace(/\(\s*\)/g, '') // Supprimer parenthèses vides
                            .replace(/\s+/g, ' ') // Normaliser espaces
                            .trim()
                        }
                        
                        if (items.length > 1) {
                          return (
                            <ul className="list-disc list-inside text-white text-sm space-y-1">
                              {items.map((it, i) => (
                                <li key={i}>{removeXAF(it)}</li>
                              ))}
                            </ul>
                          )
                        }
                        return <p className="text-white font-medium text-sm">{removeXAF(String(val))}</p>
                      })()}
                    </div>
                  )}
                  {proposal.delai_lancement && (
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Délai de lancement</p>
                      <p className="text-white font-medium text-sm">{proposal.delai_lancement}</p>
                    </div>
                  )}
                </div>
                
                {/* Avantages */}
                {proposal.avantages && proposal.avantages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs mb-2">Avantages :</p>
                    <div className="space-y-1">
                      {proposal.avantages.slice(0, 2).map((avantage: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <p className="text-gray-300 text-sm">{avantage}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      saveProject(index)
                    }}
                    disabled={savingProjects.has(index)}
                    className={`flex-1 py-3 sm:py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 touch-manipulation ${
                      savedProjects.has(index)
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20 active:bg-white/30'
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
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const projectId = savedProjectIds.get(index)
                      if (!projectId) {
                        alert('⚠️ Veuillez d\'abord sauvegarder ce projet pour accéder aux options avancées')
                        return
                      }
                      router.push(`/business/mes-projets?projectId=${projectId}&openCard=true`)
                    }}
                    disabled={!savedProjects.has(index)}
                    className={`flex-1 py-3 sm:py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 active:from-yellow-600 active:to-orange-700 transition-all flex items-center justify-center gap-2 touch-manipulation ${
                      !savedProjects.has(index) ? 'opacity-50 cursor-not-allowed bg-gray-600' : ''
                    }`}
                  >
                    Aller + Loin
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProposalsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    }>
      <ProposalsContent />
    </Suspense>
  )
}
