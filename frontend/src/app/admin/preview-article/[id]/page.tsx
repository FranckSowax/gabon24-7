'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DOMPurify from 'dompurify'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, TrendingUp, Eye, Share2 } from 'lucide-react'

interface Article {
  id: string
  title: string
  summary: string
  content: string
  author: string
  category: string
  image_urls: string[]
  published_at: string
  view_count: number
  share_count: number
  is_published: boolean
  is_trending: boolean
  feed: {
    name: string
  }
}

export default function PreviewArticlePage() {
  const params = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    if (params?.id) {
      fetchArticle()
    }
  }, [params?.id])

  const fetchArticle = async () => {
    if (!params?.id) return
    
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*, feed:rss_feeds(name)')
        .eq('id', params.id as string)
        .single()

      if (error) throw error
      setArticle(data)
    } catch (error) {
      console.error('Erreur chargement article:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async (validate: boolean) => {
    if (!article) return
    
    setValidating(true)
    try {
      const updates: any = {
        is_published: validate,
        is_trending: validate, // Mettre en tendance si validé
      }

      // Si validation, ajouter date publication et vues initiales
      if (validate) {
        updates.published_at = new Date().toISOString()
        updates.view_count = 5000 + Math.floor(Math.random() * 3000) // Boost initial
        updates.share_count = 50 + Math.floor(Math.random() * 50)
        updates.whatsapp_share_count = 30 + Math.floor(Math.random() * 30)
      }

      const { error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', article.id)

      if (error) throw error

      alert(validate ? 
        '✅ Article validé et publié ! Il apparaît maintenant dans le feed.' :
        '❌ Article rejeté. La campagne reste en attente.'
      )
      router.push('/admin/campaigns')
    } catch (error: any) {
      console.error('Erreur validation:', error)
      alert('❌ Erreur: ' + error.message)
    } finally {
      setValidating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l'article...</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">Article introuvable</p>
          <button
            onClick={() => router.push('/admin/campaigns')}
            className="mt-4 text-orange-600 hover:text-orange-700"
          >
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Admin */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/admin/campaigns')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Retour Admin</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Badge statut */}
              {article.is_published ? (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  ✓ PUBLIÉ
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  ⏸ EN ATTENTE
                </span>
              )}

              {/* Boutons validation */}
              {!article.is_published && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleValidate(true)}
                    disabled={validating}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {validating ? 'Validation...' : 'Valider & Publier'}
                  </button>
                  <button
                    onClick={() => handleValidate(false)}
                    disabled={validating}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Article Preview - Style Gabon Insight */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Image de couverture */}
        {article.image_urls && article.image_urls.length > 0 && (
          <div className="mb-8 rounded-xl overflow-hidden shadow-lg">
            <img
              src={article.image_urls[0]}
              alt={article.title}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Métadonnées */}
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
            📢 {article.feed?.name || 'Gabon Insight'}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
            {article.category}
          </span>
          {article.is_trending && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Tendance
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {article.view_count.toLocaleString()} vues
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-4 h-4" />
            {article.share_count} partages
          </span>
        </div>

        {/* Titre */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          {article.title}
        </h1>

        {/* Résumé */}
        <div className="mb-8 p-6 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
          <p className="text-lg sm:text-xl text-gray-700 leading-relaxed font-serif italic">
            {article.summary}
          </p>
        </div>

        {/* Auteur */}
        <div className="mb-10 flex items-center gap-3 text-sm sm:text-base text-gray-600 border-b border-gray-200 pb-6">
          <span className="font-semibold text-orange-600">Gabon Insight</span>
          <span>•</span>
          <span>{new Date(article.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}</span>
        </div>

        {/* Contenu */}
        <div className="max-w-none">
          <div 
            className="text-gray-800 text-base sm:text-lg leading-relaxed space-y-6 font-serif"
            style={{ lineHeight: '1.8' }}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                article.content
                  .replace(/Paragraphe \d+ – /g, '')
                  .replace(/###\s+(.*)/g, '<h3 class="text-xl sm:text-2xl font-bold text-gray-900 mt-10 mb-5 font-sans">$1</h3>')
                  .replace(/##\s+(.*)/g, '<h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mt-12 mb-6 font-sans">$2</h2>')
                  .replace(/\n\n/g, '</p><p class="mb-6 text-gray-800">')
                  .replace(/^(.+)/, '<p class="mb-6 text-gray-800">$1')
                  + '</p>'
              )
            }}
          />
        </div>

        {/* Badge sponsorisé */}
        <div className="mt-12 p-6 bg-gray-100 rounded-xl text-center">
          <p className="text-sm text-gray-600">
            📢 Contenu sponsorisé • Article publicitaire
          </p>
        </div>
      </article>
    </div>
  )
}
