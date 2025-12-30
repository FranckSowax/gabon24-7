'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Share2, Bookmark, Clock, Eye, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { articleTrackingService } from '@/lib/article-tracking'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Article {
  id: string
  title: string
  summary: string
  content: string
  source: string
  publishedAt: string
  published_at?: string
  category: string
  viewCount: string
  view_count: number
  url: string
  imageUrl?: string
  author?: string
  trending?: boolean
}

export function ArticlePageClient() {
  const params = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  useEffect(() => {
    const fetchArticle = async () => {
      if (!params?.id) return

      try {
        // Récupérer l'article depuis Supabase
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', params?.id)
          .single()

        if (error) {
          console.error('Erreur récupération article:', error)
          return
        }

        if (data) {
          setArticle({
            id: data.id,
            title: data.title,
            summary: data.summary || data.description,
            content: data.content || data.summary || data.description,
            source: data.source,
            publishedAt: data.published_at || data.created_at,
            category: data.category, // ✅ Catégorie IA
            viewCount: data.view_count?.toString() || '0',
            view_count: data.view_count || 0,
            url: data.url || data.link,
            imageUrl: data.image_url,
            author: data.author,
            trending: data.trending || false
          })

          // Tracker la vue si utilisateur connecté
          if (user) {
            await articleTrackingService.recordReadingHistory({
              userId: user.id,
              articleId: data.id,
              articleTitle: data.title,
              articleContent: data.content || data.summary,
              articleSummary: data.summary || data.description,
              articleUrl: data.url || data.link,
              articleSource: data.source,
              articleCategory: data.category, // ✅ Catégorie IA
              articlePublishedAt: data.published_at || data.created_at,
              readingDuration: 0, // Sera mis à jour au départ
              deviceType: 'web'
            })
          }

          // Incrémenter le compteur de vues
          const updatedCount = (data.view_count || 0) + 1
          await supabase
            .from('articles')
            .update({ view_count: updatedCount })
            .eq('id', params?.id)

          // Mettre à jour l'état local pour refléter immédiatement l'incrémentation
          setArticle(prev => prev ? { ...prev, view_count: updatedCount, viewCount: String(updatedCount) } : prev)
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticle()
  }, [params?.id, user])

  const handleShare = () => {
    if (!article) return
    
    const text = `${article.title}\n\n${article.summary}\n\nSource: ${article.source}\nVia Gabon Insight`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  const toggleFavorite = async () => {
    if (!user || !article) return

    try {
      if (isFavorite) {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('article_id', article.id)
        setIsFavorite(false)
      } else {
        await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            article_id: article.id,
            article_title: article.title,
            article_url: article.url
          })
        setIsFavorite(true)
      }
    } catch (error) {
      console.error('Erreur favoris:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Date inconnue'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article non trouvé</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mobile/desktop */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            
            {user && (
              <button
                onClick={toggleFavorite}
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                  isFavorite ? 'text-orange-500' : 'text-gray-600'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <article className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Image de l'article */}
          {(() => {
            const shouldProxyImage = (url?: string) => {
              if (!url) return false
              if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return false
              try {
                const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon-insight.netlify.app')
                const isSameOrigin = typeof window !== 'undefined' && u.hostname === window.location.hostname
                return !isSameOrigin
              } catch {
                return false
              }
            }
            const raw = article.imageUrl
            const proxied = raw && shouldProxyImage(raw)
              ? `${API_URL}/api/image-proxy?url=${encodeURIComponent(raw)}&title=${encodeURIComponent(article.title || '')}`
              : raw
            return proxied ? (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={proxied}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null
          })()}

          <div className="p-4 sm:p-6 lg:p-8">
            {/* Métadonnées */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-4">
              <div className="flex items-center space-x-1">
                <span className="font-medium text-orange-600">{article.source}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(article.publishedAt)}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{`${Number(article.view_count ?? article.viewCount ?? 0)} ${Number(article.view_count ?? article.viewCount ?? 0) > 1 ? 'vues' : 'vue'}`}</span>
              </div>

              {article.author && (
                <div className="flex items-center space-x-1">
                  <span>Par {article.author}</span>
                </div>
              )}
            </div>

            {/* Titre */}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {article.title}
            </h1>

            {/* Résumé */}
            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-gray-700 font-medium">{article.summary}</p>
            </div>

            {/* Contenu */}
            <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
              <div 
                className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: article.content.replace(/\n/g, '<br>') 
                }}
              />
            </div>

            {/* Actions en bas */}
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <button
                    onClick={handleShare}
                    className="flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Partager sur WhatsApp</span>
                  </button>
                  
                  {article.url && (
                    <button
                      onClick={() => window.open(article.url, '_blank')}
                      className="flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                    >
                      <span className="hidden sm:inline">Source originale</span>
                      <span className="sm:hidden">Source</span>
                    </button>
                  )}
                </div>

                {user && (
                  <button
                    onClick={toggleFavorite}
                    className={`flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 rounded-lg transition-colors text-sm sm:text-base ${
                      isFavorite 
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                    <span className="hidden sm:inline">{isFavorite ? 'Retiré des favoris' : 'Ajouter aux favoris'}</span>
                    <span className="sm:hidden">{isFavorite ? 'Retiré' : 'Favoris'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </article>
      </div>
      {/* Bouton remonter en haut (desktop + mobile) */}
      <ScrollToTop />
    </div>
  )
}
