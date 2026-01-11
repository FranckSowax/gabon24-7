'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const articleId = searchParams?.get('aid')
  const { user } = useAuth()
  
  const [article, setArticle] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!articleId) {
      router.push('/business/analyzer')
      return
    }

    // Vérifier si l'utilisateur est connecté
    if (!user) {
      console.log('❌ Utilisateur non connecté, redirection...')
      // Sauvegarder l'URL actuelle pour revenir après connexion
      const currentUrl = `/business/analyzer/analysis?aid=${articleId}`
      router.push(`/auth/signin?redirect=${encodeURIComponent(currentUrl)}`)
      return
    }

    // Charger l'article et lancer l'analyse
    const loadAndAnalyze = async () => {
      try {
        console.log('📱 Mobile Analysis - Article ID:', articleId)
        console.log('📱 API URL:', API_URL)
        
        // Récupérer l'article
        console.log('📱 Fetching articles...')
        const articlesResponse = await fetch(`${API_URL}/api/articles`)
        
        if (!articlesResponse.ok) {
          throw new Error(`Erreur API articles: ${articlesResponse.status}`)
        }
        
        const articlesData = await articlesResponse.json()
        console.log('📱 Articles reçus:', articlesData.articles?.length || 0)
        console.log('📱 Type de articleId:', typeof articleId, 'Valeur:', articleId)
        
        // Comparer en string ET en number pour être sûr
        const foundArticle = articlesData.articles?.find((a: any) => 
          a.id === articleId || a.id === Number(articleId) || String(a.id) === articleId
        )
        
        if (!foundArticle) {
          console.error('❌ Article non trouvé. ID recherché:', articleId)
          console.error('❌ IDs disponibles:', articlesData.articles?.slice(0, 5).map((a: any) => a.id))
          throw new Error('Article non trouvé')
        }
        
        console.log('✅ Article trouvé:', foundArticle.title)
        setArticle(foundArticle)

        // Lancer l'analyse
        console.log('📱 Lancement analyse...')
        console.log('📱 User ID:', user?.id || 'non connecté')
        const analysisResponse = await fetch(`${API_URL}/api/opportunities/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || null,
            article: {
              id: foundArticle.id,
              title: foundArticle.title,
              summary: foundArticle.summary,
              content: foundArticle.content || foundArticle.summary,
              url: foundArticle.url,
              source: foundArticle.source
            }
          })
        })

        if (!analysisResponse.ok) {
          let errorData
          try {
            errorData = await analysisResponse.json()
          } catch {
            errorData = { error: await analysisResponse.text() }
          }
          console.error('❌ Erreur API analyse:', analysisResponse.status, errorData)

          // Si 401, rediriger vers la connexion
          if (analysisResponse.status === 401) {
            throw new Error('Veuillez vous connecter pour analyser cet article')
          }

          // Si 402, crédits insuffisants - rediriger vers achat
          if (analysisResponse.status === 402 || errorData.needsTopUp) {
            throw new Error('CREDITS_INSUFFISANTS')
          }

          // Si 503, service temporairement indisponible
          if (analysisResponse.status === 503 || errorData.isServiceIssue) {
            throw new Error('Service IA temporairement indisponible. Veuillez réessayer plus tard.')
          }

          throw new Error(errorData.error || `Erreur lors de l'analyse: ${analysisResponse.status}`)
        }

        const analysisData = await analysisResponse.json()
        console.log('✅ Analyse reçue:', analysisData)
        console.log('✅ Structure:', Object.keys(analysisData))
        
        // La réponse peut être directement l'analyse ou dans analysisData.analysis
        const finalAnalysis = analysisData.analysis || analysisData
        console.log('✅ Analyse finale:', finalAnalysis)
        setAnalysis(finalAnalysis)
        
        // Sauvegarder l'analyse dans localStorage pour la page de personnalisation
        localStorage.setItem('mobile_analysis', JSON.stringify(finalAnalysis))
        
        // Sauvegarder l'article original pour la page proposals
        localStorage.setItem('mobile_article', JSON.stringify({
          id: foundArticle.id,
          title: foundArticle.title,
          summary: foundArticle.summary,
          url: foundArticle.url,
          source: foundArticle.source
        }))
      } catch (err) {
        console.error('❌ Erreur complète:', err)
        const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue'
        console.error('❌ Message d\'erreur:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadAndAnalyze()
  }, [articleId, router, user])

  if (error) {
    const isCreditsError = error === 'CREDITS_INSUFFISANTS'

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          {isCreditsError ? (
            <>
              <div className="text-6xl mb-4">💳</div>
              <h2 className="text-xl font-bold text-white mb-2">Crédits insuffisants</h2>
              <p className="text-gray-300 mb-6">
                Vous n&apos;avez pas assez de crédits pour analyser cet article.
                Rechargez votre compte pour continuer.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/mon-profil?tab=credits')}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors"
                >
                  Acheter des crédits
                </button>
                <button
                  onClick={() => router.push('/business/analyzer')}
                  className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
                >
                  Retour
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => router.push('/business/analyzer')}
                className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-xl"
              >
                Retour
              </button>
            </>
          )}
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
            onClick={() => router.push('/business/analyzer')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Analyse Contextuelle</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Article sélectionné */}
        {article && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10"
          >
            <h2 className="text-white font-semibold mb-2">{article.title}</h2>
            <p className="text-gray-300 text-sm">{article.summary}</p>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <p className="text-white text-lg font-semibold mb-2">Analyse en cours...</p>
            <p className="text-gray-400 text-sm">L'IA analyse les opportunités business</p>
          </motion.div>
        )}

        {/* Analysis Results */}
        {!isLoading && analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Problématique */}
            {analysis.analyse_contextuelle?.problematique_centrale && (
              <div className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-semibold">Analyse Contextuelle</h3>
                </div>
                <p className="text-gray-200">{analysis.analyse_contextuelle.problematique_centrale}</p>
              </div>
            )}

            {/* Secteurs */}
            {analysis.secteurs_opportunites && analysis.secteurs_opportunites.length > 0 && (
              <div>
                <h3 className="text-white font-semibold mb-4">🎯 Secteurs d'opportunités identifiés</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Sélectionnez un secteur pour personnaliser votre contexte et générer des propositions adaptées
                </p>
                <div className="space-y-3">
                  {analysis.secteurs_opportunites.map((secteur: any, idx: number) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => router.push(`/business/analyzer/run?aid=${articleId}&sector=${encodeURIComponent(secteur.nom)}`)}
                      className="w-full text-left p-4 rounded-xl border transition-all bg-white/5 border-white/10 hover:bg-white/10 hover:border-yellow-400"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-white flex-1">{secteur.nom}</div>
                        <div className="ml-3 px-3 py-1 bg-yellow-400/20 rounded-full border border-yellow-400/30">
                          <span className="text-yellow-400 font-bold text-sm">
                            {secteur.score_pertinence || secteur.score || secteur.pertinence || 8}/10
                          </span>
                        </div>
                      </div>
                      {secteur.description && (
                        <div className="text-sm text-gray-300 mb-2">{secteur.description}</div>
                      )}
                      {secteur.potentiel && (
                        <div className="text-xs text-gray-400 mt-2">
                          💡 {secteur.potentiel}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  )
}
