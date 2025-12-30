'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthState, onAuthStateChange, getCurrentSession } from '@/lib/auth'
import { getUserSubscription, UserSubscription, getFreemiumPlan, SubscriptionPlan } from '@/lib/subscription'

// Cache local pour éviter les appels répétés
const SESSION_CACHE_KEY = 'gabon24_session_cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 heures (au lieu de 5 minutes)

interface CachedSession {
  user: User | null
  timestamp: number
}

// Helper: Promise timeout optimisé avec timeout court
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback?: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (fallback !== undefined) {
        console.warn(`⏱️ Timeout (${ms}ms) - Utilisation valeur par défaut`)
      }
      reject(new Error('Timeout'))
    }, ms)
  })
  try {
    const result = await Promise.race([promise, timeout]) as T
    if (timeoutId) clearTimeout(timeoutId)
    return result
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)
    if (fallback !== undefined) {
      return fallback
    }
    throw error
  }
}

// Lire le cache local (utilisé comme fallback rapide)
function getCachedSession(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY)
    if (!cached) return null
    const parsed: CachedSession = JSON.parse(cached)
    // Vérifier si le cache n'est pas expiré (24h)
    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(SESSION_CACHE_KEY)
      return null
    }
    return parsed.user
  } catch {
    return null
  }
}

// Sauvegarder dans le cache local (synchronisé avec Supabase)
function setCachedSession(user: User | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      const cache: CachedSession = { user, timestamp: Date.now() }
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache))
    } else {
      // Supprimer le cache si déconnexion
      localStorage.removeItem(SESSION_CACHE_KEY)
    }
  } catch (error) {
    console.warn('Erreur sauvegarde cache:', error)
  }
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  subscription: UserSubscription | null
  subscriptionPlan: SubscriptionPlan | null
  refreshSubscription: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null)

  // Plan par défaut (fallback rapide)
  const DEFAULT_PLAN: SubscriptionPlan = {
    id: 'default-free',
    name: 'Freemium',
    slug: 'free',
    price_monthly: 0,
    price_yearly: 0,
    features: ['5 articles par jour', 'Accès aux Archives générales', 'Accès section Business', 'Newsletter hebdomadaire'],
    limitations: {
      gov_sources: 1,
      search_days: 7,
      daily_articles: 5,
      offline_articles: 0
    },
    is_popular: false,
    sort_order: 1
  }

  // Fonction OPTIMISÉE pour charger l'abonnement utilisateur (non-bloquante)
  const loadUserSubscription = async (userId: string) => {
    try {
      // Timeout court : 3 secondes max
      const userSub = await withTimeout(
        getUserSubscription(userId),
        3000,
        null
      )
      
      if (userSub) {
        setSubscription(userSub)
        setSubscriptionPlan(userSub.plan || DEFAULT_PLAN)
      } else {
        // Pas d'abonnement, utiliser plan freemium
        setSubscription(null)
        setSubscriptionPlan(DEFAULT_PLAN)
      }
    } catch (error) {
      // En cas d'erreur, utiliser plan par défaut immédiatement
      console.warn('⚠️ Erreur abonnement (fallback plan par défaut):', error)
      setSubscription(null)
      setSubscriptionPlan(DEFAULT_PLAN)
    }
  }

  // Fonction pour rafraîchir l'abonnement
  const refreshSubscription = async () => {
    if (user) {
      await loadUserSubscription(user.id)
    }
  }

  useEffect(() => {
    // Vérifier si nous sommes côté client
    if (typeof window === 'undefined') {
      return
    }

    let authSubscription: any = null

    // Initialisation RAPIDE avec persistance de session
    const initializeAuth = async () => {
      try {
        console.log('🔐 Init Auth (persistance activée)...')
        
        // 1. PLAN PAR DÉFAUT IMMÉDIAT
        setSubscriptionPlan(DEFAULT_PLAN)
        
        // 2. VÉRIFIER SESSION SUPABASE EN PRIORITÉ (elle est déjà persistée)
        try {
          const { data: { session } } = await withTimeout(
            getCurrentSession(),
            5000, // 5 secondes pour vérifier la session
            { data: { session: null } }
          )
          
          const currentUser = session?.user ?? null
          
          if (currentUser) {
            console.log('👤 Session Supabase valide (persistée)')
            setUser(currentUser)
            setCachedSession(currentUser) // Synchroniser le cache
            setLoading(false)
            setInitialized(true)
            // Charger l'abonnement en arrière-plan
            loadUserSubscription(currentUser.id).catch(console.warn)
          } else {
            // Pas de session Supabase, vérifier le cache comme fallback
            const cachedUser = getCachedSession()
            if (cachedUser) {
              console.log('💾 Utilisateur en cache (fallback)')
              setUser(cachedUser)
              loadUserSubscription(cachedUser.id).catch(console.warn)
            } else {
              console.log('👤 Non connecté')
            }
            setLoading(false)
            setInitialized(true)
          }
        } catch (sessionError) {
          console.warn('⚠️ Erreur session Supabase, utilisation cache:', sessionError)
          // Fallback sur le cache
          const cachedUser = getCachedSession()
          if (cachedUser) {
            console.log('💾 Utilisateur en cache (après erreur)')
            setUser(cachedUser)
            loadUserSubscription(cachedUser.id).catch(console.warn)
          }
          setLoading(false)
          setInitialized(true)
        }
        
        console.log('✅ Auth initialisé')
      } catch (error) {
        console.warn('⚠️ Init auth (fallback mode):', error)
        setSubscriptionPlan(DEFAULT_PLAN)
        setInitialized(true)
        setLoading(false)
      }
    }

    // Listener auth OPTIMISÉ (non-bloquant)
    const setupAuthListener = () => {
      const { data: { subscription } } = onAuthStateChange((event, session) => {
        console.log('🔄 Auth change:', event)
        
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setCachedSession(currentUser)
        
        if (currentUser) {
          // NON-BLOQUANT : charger en arrière-plan
          loadUserSubscription(currentUser.id).catch(console.warn)
        } else {
          setSubscription(null)
          setSubscriptionPlan(DEFAULT_PLAN)
        }
      })
      authSubscription = subscription
    }

    // Initialiser et configurer le listener
    initializeAuth()
    setupAuthListener()

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe()
      }
    }
  }, [])

  const signOut = async () => {
    const { signOut: supabaseSignOut } = await import('@/lib/auth')
    await supabaseSignOut()
    setSubscription(null)
    setSubscriptionPlan(DEFAULT_PLAN)
    setCachedSession(null)
  }

  const value = {
    user,
    loading,
    subscription,
    subscriptionPlan,
    signOut,
    refreshSubscription
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
