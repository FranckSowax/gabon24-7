import { createClient } from '@supabase/supabase-js'

// Utiliser les variables d'environnement en priorité, avec fallback sur les valeurs hardcodées si nécessaire
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODg5MjYsImV4cCI6MjA3MDM2NDkyNn0.MLTnZFSSosMt3Lu7BeFR8LFW4ihaUo5Dx2g9sUJeHLA'

// Singleton pattern to ensure only one Supabase client instance
let supabaseInstance: any = null

const getSupabaseClient = () => {
  if (typeof window !== 'undefined' && (window as any).__supabaseInstance) {
    return (window as any).__supabaseInstance
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'gabon-insight-auth', // Unique storage key
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        // Augmenter le timeout de connexion (par défaut 10s)
        timeout: 20000,
      }
    })
    
    if (typeof window !== 'undefined') {
      (window as any).__supabaseInstance = supabaseInstance
    }
  }
  return supabaseInstance
}

// Export the singleton instance
export const supabase = getSupabaseClient()

// Export createClient function for components that need fresh instances (discouraged)
export { createClient }
