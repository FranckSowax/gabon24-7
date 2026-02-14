import { createClient } from '@supabase/supabase-js'

// Singleton pattern to ensure only one Supabase client instance
let supabaseInstance: any = null

const getSupabaseClient = () => {
  if (typeof window !== 'undefined' && (window as any).__supabaseInstance) {
    return (window as any).__supabaseInstance
  }

  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // Env vars are baked in at build time by Next.js — if missing, Supabase is unavailable
      console.error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — set in deployment dashboard'
      )
      return null as any
    }

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
