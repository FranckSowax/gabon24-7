'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Plus, Check, Loader2, Newspaper, TrendingUp, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface RelatedArticle {
  id: string
  title: string
  summary: string
  ai_summary?: string
  url: string
  source: string
  image_urls?: string[]
  published_at: string
  category?: string
  sentiment?: string
  keywords?: string[]
  relevanceScore: number
  view_count?: number
  reading_time_minutes?: number
}

interface RelatedArticlesProps {
  projectId: string
  projectTitle: string
  projectDescription: string
  secteur: string
  problematique?: string
  onArticleAdded?: () => void
}

export default function RelatedArticles({
  projectId,
  projectTitle,
  projectDescription,
  secteur,
  problematique,
  onArticleAdded
}: RelatedArticlesProps) {
  const [articles, setArticles] = useState<RelatedArticle[]>([])
  const [addedArticles, setAddedArticles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<string[]>([])

  useEffect(() => {
    fetchRelatedArticles()
  }, [projectId, projectTitle, problematique])

  const fetchRelatedArticles = async () => {
    setLoading(true)
    setError(null)

    try {
      // Utiliser le nouvel endpoint avec problématique si disponible
      const endpoint = problematique 
        ? `${API_URL}/api/related-articles/search-by-problematique`
        : `${API_URL}/api/related-articles/search`

      const body = problematique
        ? {
            problematique,
            secteur,
            projectTitle
          }
        : {
            projectTitle,
            projectDescription,
            secteur,
            limit: 3
          }

      console.log('🔍 Recherche articles avec:', problematique ? 'problématique' : 'description')

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setArticles(data.articles || [])
        setKeywords(data.keywords || [])
        console.log(`✅ ${data.articles?.length || 0} articles trouvés`)
      } else {
        setError(data.error || 'Erreur lors de la recherche')
      }
    } catch (err) {
      console.error('Erreur fetch articles connexes:', err)
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToContext = async (article: RelatedArticle) => {
    setAdding(article.id)

    try {
      const response = await fetch(`${API_URL}/api/related-articles/add-to-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          articleId: article.id,
          articleData: article
        })
      })

      const data = await response.json()

      if (data.success) {
        setAddedArticles(prev => {
          const newSet = new Set(prev)
          newSet.add(article.id)
          return newSet
        })
        if (onArticleAdded) onArticleAdded()
      }
    } catch (err) {
      console.error('Erreur ajout article:', err)
      alert('Erreur lors de l\'ajout de l\'article')
    } finally {
      setAdding(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 24) {
      return `il y a ${diffHours}h`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `il y a ${diffDays}j`
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <p className="text-blue-300">Recherche d'articles connexes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-6 border border-blue-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-400" />
            Articles Connexes
          </h3>
        </div>
        <div className="text-center py-6">
          <Newspaper className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">Aucun article connexe trouvé</p>
          <p className="text-gray-500 text-sm">
            {problematique 
              ? 'Nous recherchons des articles traitant de votre problématique...'
              : 'Essayez de générer un plan d\'action pour enrichir le contexte'}
          </p>
          {keywords.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Mots-clés recherchés :</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {keywords.slice(0, 5).map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-6 border border-blue-500/20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-blue-400" />
            Articles Connexes ({articles.length}/3)
          </h3>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {keywords.slice(0, 3).map((keyword, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={fetchRelatedArticles}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence>
          {articles.map((article, index) => {
            const isAdded = addedArticles.has(article.id)
            const isAdding = adding === article.id

            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-blue-400/50 transition-all"
              >
                {/* Image */}
                {article.image_urls && article.image_urls[0] && (
                  <div className="w-full h-32 rounded-lg overflow-hidden mb-3">
                    <img
                      src={article.image_urls[0]}
                      alt={article.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Titre */}
                <h4 className="font-semibold text-white text-sm mb-2 line-clamp-2">
                  {article.title}
                </h4>

                {/* Résumé */}
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                  {article.summary || article.ai_summary || 'Pas de résumé disponible'}
                </p>

                {/* Meta info */}
                <div className="flex items-center justify-between text-xs mb-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>{article.source}</span>
                    <span>•</span>
                    <span>{formatDate(article.published_at)}</span>
                  </div>
                  {article.relevanceScore && (
                    <div className="flex items-center gap-1 text-yellow-400">
                      <TrendingUp className="w-3 h-3" />
                      <span className="font-bold">{Math.round(article.relevanceScore)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Lire
                  </a>
                  
                  <button
                    onClick={() => handleAddToContext(article)}
                    disabled={isAdded || isAdding}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      isAdded
                        ? 'bg-green-500/20 text-green-400 cursor-default'
                        : isAdding
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                    }`}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Ajout...
                      </>
                    ) : isAdded ? (
                      <>
                        <Check className="w-3 h-3" />
                        Ajouté
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        Ajouter au contexte
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
