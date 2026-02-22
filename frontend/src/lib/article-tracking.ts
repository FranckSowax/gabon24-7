import { supabase } from './supabase'
import axios from '@/lib/axios'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface ArticleView {
  userId: string
  articleId: string
  articleTitle?: string
  articleUrl?: string
  source?: string
}

export interface ReadingHistoryItem {
  userId: string
  articleId: string
  articleTitle: string
  articleContent?: string
  articleSummary?: string
  articleUrl?: string
  articleSource?: string
  articleCategory?: string
  articlePublishedAt?: string
  articleImageUrl?: string
  readingDuration?: number
  deviceType?: string
}

// Service pour tracker les vues d'articles
export const articleTrackingService = {
  // Enregistrer une vue d'article (simple tracking)
  async trackArticleView(view: ArticleView): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('👤 Utilisateur non connecté, pas de tracking')
        return false
      }

      // Envoyer au backend pour enregistrement
      const response = await axios.post(`${API_URL}/api/article-views/track`, {
        userId: user.id,
        articleId: view.articleId,
        articleTitle: view.articleTitle,
        articleUrl: view.articleUrl,
        source: view.source || 'rss'
      })

      if (response.data.success) {
        console.log('✅ Vue article trackée:', view.articleId)
        return true
      }

      return false
    } catch (error) {
      console.error('❌ Erreur tracking article:', error)
      return false
    }
  },

  // Enregistrer un article lu avec contenu complet dans l'historique
  async recordReadingHistory(item: ReadingHistoryItem): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('👤 Utilisateur non connecté, pas d\'historique')
        return false
      }

      // Valider et convertir la date de publication
      let validPublishedAt = null
      if (item.articlePublishedAt) {
        try {
          const parsedDate = new Date(item.articlePublishedAt)
          if (!isNaN(parsedDate.getTime())) {
            validPublishedAt = parsedDate.toISOString()
          }
        } catch {}
      }

      // Enregistrement direct via Supabase (évite les erreurs 500 du backend)
      const { error } = await supabase
        .from('user_reading_history')
        .upsert({
          user_id: user.id,
          article_id: String(item.articleId),
          article_title: item.articleTitle || null,
          article_summary: item.articleSummary || null,
          article_url: item.articleUrl || null,
          article_source: item.articleSource || null,
          article_category: item.articleCategory || null,
          article_published_at: validPublishedAt,
          image_url: item.articleImageUrl || null,
          reading_duration: item.readingDuration || 0,
          device_type: item.deviceType || 'web',
          read_at: new Date().toISOString(),
          reading_progress: 100
        }, {
          onConflict: 'user_id,article_id'
        })

      if (error) {
        console.error('❌ Erreur Supabase historique:', error)
        return false
      }

      console.log('✅ Article ajouté à l\'historique (Supabase direct):', item.articleId)
      return true
    } catch (error) {
      console.error('❌ Erreur enregistrement historique:', error)
      return false
    }
  },

  // Récupérer le nombre d'articles lus par l'utilisateur connecté
  async getUserArticlesCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 0

      const response = await axios.get(`${API_URL}/api/article-views/count/${user.id}`)
      return response.data.count || 0
    } catch (error) {
      console.error('❌ Erreur récupération count articles:', error)
      return 0
    }
  },

  // Récupérer l'historique des articles lus
  async getUserArticlesHistory(limit = 50, offset = 0): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const response = await axios.get(`${API_URL}/api/article-views/history/${user.id}?limit=${limit}&offset=${offset}`)
      return response.data.history || []
    } catch (error) {
      console.error('❌ Erreur récupération historique articles:', error)
      return []
    }
  },

  // Helper pour créer un ID d'article unique
  generateArticleId(title: string, url?: string): string {
    const baseString = url || title
    return btoa(baseString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 50)
  }
}

// Hook pour tracker automatiquement les clics sur les articles
export const useArticleTracking = () => {
  const trackClick = async (article: {
    id?: string
    title: string
    url?: string
    source?: string
  }) => {
    const articleId = article.id || articleTrackingService.generateArticleId(article.title, article.url)
    
    await articleTrackingService.trackArticleView({
      userId: '', // Sera rempli automatiquement par le service
      articleId,
      articleTitle: article.title,
      articleUrl: article.url,
      source: article.source || 'rss'
    })
  }

  return { trackClick }
}
