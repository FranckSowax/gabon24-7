/**
 * Authentification des connexions Socket.IO vers le backend.
 *
 * Le serveur de jeu refuse toute connexion sans jeton Supabase. Cette fonction
 * se passe telle quelle à l'option `auth` de `io()` : elle est rappelée à chaque
 * (re)connexion, donc avec un jeton à jour même après son renouvellement.
 *
 * @example
 *   const socket = io(API_URL, { auth: socketAuth, transports: ['websocket', 'polling'] })
 */

import { supabase } from './supabase'

export function socketAuth(callback: (data: { token?: string }) => void): void {
  void (async () => {
    try {
      if (!supabase) {
        callback({})
        return
      }
      const { data } = await supabase.auth.getSession()
      callback({ token: data?.session?.access_token ?? undefined })
    } catch {
      // Sans jeton, le serveur refusera la connexion : rien d'autre à faire ici
      callback({})
    }
  })()
}
