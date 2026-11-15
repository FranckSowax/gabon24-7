/**
 * Pont d'authentification vers l'API backend.
 *
 * Module à effet de bord, importé une seule fois par le provider racine. Il ajoute
 * le jeton Supabase (`Authorization: Bearer ...`) aux appels `fetch` et `axios`
 * destinés au backend quand l'appelant ne l'a pas fait lui-même.
 *
 * WHY: le backend exige désormais un jeton sur les routes utilisateur, admin et
 * de paiement, alors que la plupart des écrans appellent `fetch` directement,
 * sans en-tête. Centraliser l'ajout ici évite de modifier des dizaines d'écrans
 * et garantit qu'aucun nouvel appel ne l'oublie.
 *
 * Sécurité : le jeton n'est envoyé qu'aux origines du backend listées ci-dessous,
 * jamais à un autre domaine.
 */

import axios from 'axios'
import { supabase } from './supabase'

const BACKEND_ORIGINS: string[] = (() => {
  const candidates = [
    process.env.NEXT_PUBLIC_API_URL,
    'https://gabon24-7-production.up.railway.app',
    'https://gabon-insight-production.up.railway.app',
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : undefined,
  ]
  const origins = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      origins.add(new URL(candidate).origin)
    } catch {
      // URL de configuration invalide : ignorée
    }
  }
  return Array.from(origins)
})()

/**
 * Lectures (GET) qui exigent un jeton. Les autres GET restent sans en-tête pour
 * ne pas déclencher de pré-vol CORS sur les pages publiques (articles, météo...).
 * Toutes les requêtes d'écriture (POST, PUT, PATCH, DELETE) reçoivent le jeton.
 */
const AUTHENTICATED_GET_PREFIXES = [
  '/api/admin',
  '/api/ai/admin',
  '/api/alerts',
  '/api/article-views',
  '/api/campaigns',
  '/api/collaboration',
  '/api/credits',
  '/api/credits-premium',
  '/api/game',
  '/api/payments',
  '/api/project-actions',
  '/api/project-chat',
  '/api/project-documents',
  '/api/project-notes',
  '/api/project-timeline',
  '/api/reading-history',
  '/api/skill-test',
  '/api/training',
  '/api/user',
  '/api/veille',
  '/api/action-plans',
]

function needsToken(rawUrl: string, method: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl, window.location.href)
  } catch {
    return false
  }
  if (!BACKEND_ORIGINS.includes(url.origin)) return false
  if (method !== 'GET' && method !== 'HEAD') return true
  return AUTHENTICATED_GET_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  )
}

async function getAccessToken(): Promise<string | null> {
  try {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token ?? null
  } catch {
    return null
  }
}

declare global {
  interface Window {
    __apiAuthBridgeInstalled?: boolean
  }
}

function installFetchBridge(): void {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const isRequest = typeof Request !== 'undefined' && input instanceof Request
      const rawUrl = typeof input === 'string' ? input : isRequest ? (input as Request).url : String(input)
      const method = (init?.method || (isRequest ? (input as Request).method : 'GET')).toUpperCase()

      if (needsToken(rawUrl, method)) {
        const headers = new Headers(init?.headers ?? (isRequest ? (input as Request).headers : undefined))
        if (!headers.has('Authorization')) {
          const token = await getAccessToken()
          if (token) {
            headers.set('Authorization', `Bearer ${token}`)
            return originalFetch(input, { ...init, headers })
          }
        }
      }
    } catch {
      // En cas de doute, la requête part telle que l'appelant l'a écrite
    }
    return originalFetch(input, init)
  }
}

function installAxiosBridge(): void {
  axios.interceptors.request.use(async (config) => {
    try {
      const rawUrl = axios.getUri(config)
      const method = (config.method || 'get').toUpperCase()
      if (needsToken(rawUrl, method) && !config.headers?.Authorization) {
        const token = await getAccessToken()
        if (token) config.headers.set('Authorization', `Bearer ${token}`)
      }
    } catch {
      // Idem : ne jamais bloquer une requête à cause du pont
    }
    return config
  })
}

if (typeof window !== 'undefined' && !window.__apiAuthBridgeInstalled) {
  window.__apiAuthBridgeInstalled = true
  installFetchBridge()
  installAxiosBridge()
}

export {}
