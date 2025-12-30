/**
 * Configuration API - Migration Netlify → Express
 * URL de base pour les appels API backend
 */

// URL API backend
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Helper pour construire URL complète
export function apiUrl(endpoint: string): string {
  // Retirer le slash initial si présent
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
}

// Mapping des anciennes routes Netlify vers nouvelles routes Express
export const API_ROUTES = {
  // Actu++
  actuPlus: '/api/actu-plus',
  
  // Opportunités
  analyzeOpportunity: '/api/opportunities/analyze',
  generateOpportunitiesByBudget: '/api/opportunities/generate-by-budget',
  enhanceOpportunity: '/api/opportunities/enhance',
  generateBusinessIdeas: '/api/opportunities/business-ideas',
  
  // Audio
  audioSummary: '/api/audio/generate-summary',
  audioSettings: '/api/audio/settings',
  
  // Alertes
  processAlerts: '/api/alerts/process',
  getMatches: (userId: string) => `/api/alerts/matches/${userId}`,
  createAlert: '/api/alerts/create',
  updateAlert: (alertId: string) => `/api/alerts/${alertId}`,
  deleteAlert: (alertId: string) => `/api/alerts/${alertId}`,
  
  // Credits
  checkBalance: '/api/credits/check-balance',
  consumeCredits: '/api/credits/consume',
  addCredits: '/api/credits/add',
  getHistory: (userId: string) => `/api/credits/history/${userId}`,
  getBalance: (userId: string) => `/api/credits/balance/${userId}`,
  
  // Articles (déjà sur Express)
  articles: '/api/articles',
  
  // Autres routes existantes...
} as const;

// Helper fetch avec gestion d'erreurs
export async function apiFetch(endpoint: string, options?: RequestInit) {
  const url = apiUrl(endpoint);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}
