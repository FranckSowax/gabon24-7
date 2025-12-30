import { supabase } from './supabase'

// Re-export supabase for backward compatibility
export { supabase }

export interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export interface AuthState {
  user: User | null
  loading: boolean
}

// Connexion avec email/mot de passe
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

// Inscription avec email/mot de passe
export const signUp = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  })
  return { data, error }
}

// Connexion avec Google
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  return { data, error }
}

// Déconnexion
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Erreur Supabase signOut:', error)
      throw error
    }
    
    // Nettoyer le localStorage/sessionStorage si nécessaire
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.clear()
    }
    
    return { error: null }
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error)
    return { error }
  }
}

// Obtenir l'utilisateur actuel
export const getCurrentUser = () => {
  return supabase.auth.getUser()
}

// Obtenir la session actuelle
export const getCurrentSession = async () => {
  // Vérifier si nous sommes côté client
  if (typeof window === 'undefined') {
    return { data: { session: null }, error: null }
  }
  return await supabase.auth.getSession()
}

// Écouter les changements d'authentification
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  // Vérifier si nous sommes côté client
  if (typeof window === 'undefined') {
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
  return supabase.auth.onAuthStateChange(callback)
}
