/**
 * Client API avec gestion d'erreurs, retry et timeout
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const DEFAULT_TIMEOUT = 30000 // 30 secondes
const MAX_RETRIES = 2

interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
}

/**
 * Fetch avec timeout
 */
async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: La requête a pris plus de ${timeout/1000}s`)
    }
    throw error
  }
}

/**
 * Fetch avec retry automatique
 */
async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = MAX_RETRIES, ...fetchOptions } = options
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions)
      return response
    } catch (error: any) {
      lastError = error
      console.warn(`Tentative ${attempt + 1}/${retries + 1} échouée:`, error.message)
      
      // Ne pas retry si c'est une erreur 4xx (client error)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error
      }
      
      // Attendre avant de retry (backoff exponentiel)
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Échec après plusieurs tentatives')
}

/**
 * Wrapper pour les appels API avec gestion d'erreurs complète
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`
  
  try {
    const response = await fetchWithRetry(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || 
        errorData.message || 
        `Erreur HTTP ${response.status}: ${response.statusText}`
      )
    }
    
    return await response.json()
  } catch (error: any) {
    console.error(`❌ Erreur API [${endpoint}]:`, error)
    
    // Messages d'erreur plus clairs
    if (error.message.includes('Failed to fetch')) {
      throw new Error(
        '🔌 Impossible de contacter le serveur. Vérifiez votre connexion internet ou réessayez plus tard.'
      )
    }
    
    if (error.message.includes('Timeout')) {
      throw new Error(
        '⏱️ Le serveur met trop de temps à répondre. Veuillez réessayer.'
      )
    }
    
    throw error
  }
}

/**
 * Vérifier si l'API est accessible
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {
      timeout: 5000,
      retries: 0
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Obtenir l'URL de l'API
 */
export function getApiUrl(): string {
  return API_URL
}

export default apiCall
