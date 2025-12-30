import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Favorite {
  id: number
  user_id: string
  article_id: string
  article_title: string
  article_url: string
  article_source: string
  article_image_url?: string
  created_at: string
  updated_at: string
}

export interface Article {
  id: number | string
  title: string
  url?: string
  source?: string
  image_url?: string
}

// Obtenir le token d'authentification
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// Ajouter un article aux favoris
export const addToFavorites = async (article: Article): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }
    
    console.log('📤 addToFavorites - envoi:', { 
      articleId: article.id, 
      title: article.title,
      url: article.url,
      source: article.source
    })
    
    // Toggle favori côté backend Express
    const resp = await fetch(`${API_URL}/api/reading-history/toggle-favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        articleId: String(article.id),
        articleTitle: article.title || '',
        articleUrl: article.url || '',
        articleSource: article.source || ''
      })
    })

    if (resp.ok) {
      console.log('✅ addToFavorites - succès')
      return { success: true }
    }
    const err = await resp.json().catch(() => ({}))
    console.log('❌ addToFavorites - échec:', err)
    return { success: false, error: err.error || 'Erreur lors de l\'ajout aux favoris' }
  } catch (error) {
    console.error('❌ addToFavorites - erreur:', error)
    return { success: false, error: 'Erreur réseau' }
  }
}

// Supprimer un article des favoris
export const removeFromFavorites = async (articleId: number | string, articleTitle?: string, articleUrl?: string, articleSource?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    console.log('📤 removeFromFavorites - envoi:', { articleId })

    // Toggle à nouveau (retire si déjà favori)
    const resp = await fetch(`${API_URL}/api/reading-history/toggle-favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        articleId: String(articleId),
        articleTitle: articleTitle || '',
        articleUrl: articleUrl || '',
        articleSource: articleSource || ''
      })
    })

    if (resp.ok) {
      console.log('✅ removeFromFavorites - succès')
      return { success: true }
    }
    const err = await resp.json().catch(() => ({}))
    console.log('❌ removeFromFavorites - échec:', err)
    return { success: false, error: err.error || 'Erreur lors de la suppression des favoris' }
  } catch (error) {
    console.error('❌ removeFromFavorites - erreur:', error)
    return { success: false, error: 'Erreur réseau' }
  }
}

// Récupérer les favoris de l'utilisateur
export const getFavorites = async (): Promise<{ favorites: Favorite[]; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { favorites: [], error: 'Utilisateur non connecté' }
    }

    // Utiliser l'historique de lecture filtré par favoris
    const resp = await fetch(`${API_URL}/api/reading-history/history/${user.id}?favorites=true&limit=1000`)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      return { favorites: [], error: err.error || 'Erreur lors de la récupération des favoris' }
    }
    const json = await resp.json().catch(() => ({}))
    const history = Array.isArray(json.history) ? json.history : []

    // Mapper vers le type Favorite attendu
    const favorites: Favorite[] = history
      .filter((h: any) => {
        const rawId = h.article_id ?? h.articleId
        const s = String(rawId)
        return !!rawId && s !== 'NaN' && s !== 'undefined' && s !== 'null' && s.trim() !== ''
      })
      .map((h: any) => ({
        id: h.id || 0,
        user_id: user.id,
        article_id: String(h.article_id ?? h.articleId),
        article_title: String(h.article_title ?? h.articleTitle ?? ''),
        article_url: String(h.article_url ?? h.articleUrl ?? ''),
        article_source: String(h.article_source ?? h.articleSource ?? ''),
        article_image_url: h.article_image_url ?? h.image_url ?? h.imageUrl,
        created_at: h.created_at || new Date().toISOString(),
        updated_at: h.updated_at || h.created_at || new Date().toISOString()
      }))

    return { favorites }
  } catch (error) {
    console.error('Erreur getFavorites:', error)
    return { favorites: [], error: 'Erreur réseau' }
  }
}

// Vérifier si un article est en favoris
export const isFavorite = async (articleId: number | string): Promise<boolean> => {
  try {
    const { favorites } = await getFavorites()
    return favorites.some(fav => fav.article_id === articleId.toString())
  } catch (error) {
    console.error('Erreur isFavorite:', error)
    return false
  }
}
