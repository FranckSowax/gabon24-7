/**
 * Système de gestion du panier publicitaire
 * Stockage localStorage avec fonctions CRUD
 */

export interface CartItem {
  id: string
  campaign_type: 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'
  name: string
  budget: number
  duration_days: number
  start_date: string
  // Détails spécifiques selon type
  details: {
    // Bannières
    banner_title?: string
    banner_description?: string
    desktop_image_url?: string
    mobile_image_url?: string
    // Vidéo
    video_title?: string
    video_description?: string
    video_url?: string
    // Commun
    redirect_url?: string
    design_request?: boolean
    design_request_notes?: string
  }
  added_at: string
}

const CART_STORAGE_KEY = 'gabon-insight-cart'

/**
 * Récupérer le panier depuis localStorage
 */
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY)
    return cart ? JSON.parse(cart) : []
  } catch (error) {
    console.error('Erreur lecture panier:', error)
    return []
  }
}

/**
 * Sauvegarder le panier dans localStorage
 */
export function saveCart(cart: CartItem[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    // Émettre événement pour mise à jour UI
    window.dispatchEvent(new Event('cart-updated'))
  } catch (error) {
    console.error('Erreur sauvegarde panier:', error)
  }
}

/**
 * Ajouter un item au panier
 */
export function addToCart(item: Omit<CartItem, 'id' | 'added_at'>): CartItem {
  const cart = getCart()
  
  const newItem: CartItem = {
    ...item,
    id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    added_at: new Date().toISOString()
  }
  
  cart.push(newItem)
  saveCart(cart)
  
  return newItem
}

/**
 * Retirer un item du panier
 */
export function removeFromCart(itemId: string): void {
  const cart = getCart()
  const filteredCart = cart.filter(item => item.id !== itemId)
  saveCart(filteredCart)
}

/**
 * Vider le panier
 */
export function clearCart(): void {
  saveCart([])
}

/**
 * Calculer le total du panier
 */
export function getCartTotal(): number {
  const cart = getCart()
  return cart.reduce((total, item) => total + item.budget, 0)
}

/**
 * Nombre d'items dans le panier
 */
export function getCartCount(): number {
  const cart = getCart()
  return cart.length
}

/**
 * Obtenir les infos d'un type de campagne
 */
export function getCampaignTypeInfo(type: string): {
  name: string
  icon: string
  color: string
} {
  const types = {
    'banner-home': {
      name: 'Bannière Page d\'Accueil',
      icon: '🏠',
      color: 'blue'
    },
    'banner-feed': {
      name: 'Bannière Feed Articles',
      icon: '📰',
      color: 'green'
    },
    'video-home': {
      name: 'Vidéo Home',
      icon: '🎬',
      color: 'purple'
    },
    'article-trending': {
      name: 'Article Sponsorisé',
      icon: '🔥',
      color: 'orange'
    }
  }
  
  return types[type as keyof typeof types] || types['banner-home']
}

/**
 * Formater le prix en FCFA
 */
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

/**
 * Calculer la date de fin d'une campagne
 */
export function calculateEndDate(startDate: string, durationDays: number): string {
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + durationDays)
  return end.toISOString()
}
