/**
 * PRICING SERVICE - Service centralisé de tarification
 * Charge les tarifs depuis Supabase et les met en cache
 */

import { supabase } from './supabase'

export interface PricingConfig {
  feature_key: string
  feature_name: string
  credits_cost: number
  ai_model: string | null
  estimated_api_cost_usd: number | null
  is_active: boolean
}

// Cache local des tarifs
let pricingCache: Map<string, PricingConfig> = new Map()
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Valeurs par défaut basées sur coûts IA réels (Déc 2024)
 * Modèles: Gemini 2.0 Flash, GPT-4o-mini, OpenAI TTS-1
 * 1 crédit = 10 FCFA | Marge x40-80 sur coûts API
 */
const DEFAULT_PRICING: Record<string, number> = {
  // Business (Gemini 2.0 Flash - quasi gratuit)
  initial_analysis: 8,
  re_analysis: 8,
  action_plan: 10,
  skill_test: 10,
  custom_training: 10,
  business_plan: 15,
  motivation_letter: 8,
  
  // Content (GPT-4o-mini + TTS)
  article_premium: 1,
  audio_summary: 5,
  ai_analysis: 6,
  
  // Veille (GPT-4o-mini)
  veille_report: 5,
  custom_alert: 2,
  opportunity_analysis: 6,
  
  // Chat (GPT-4o-mini)
  chat_message: 1,
  document_analysis: 6,
}

/**
 * Charger les tarifs depuis Supabase
 */
export async function loadPricingFromDB(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('feature_key, feature_name, credits_cost, ai_model, estimated_api_cost_usd, is_active')
      .eq('is_active', true)

    if (error) {
      console.warn('Erreur chargement tarifs, utilisation des valeurs par défaut:', error)
      return
    }

    // Mettre à jour le cache
    pricingCache.clear()
    for (const item of data || []) {
      pricingCache.set(item.feature_key, item)
    }
    cacheTimestamp = Date.now()
    
    console.log(`✅ ${pricingCache.size} tarifs chargés depuis la DB`)
  } catch (error) {
    console.error('Erreur loadPricingFromDB:', error)
  }
}

/**
 * Vérifier si le cache est valide
 */
function isCacheValid(): boolean {
  return pricingCache.size > 0 && (Date.now() - cacheTimestamp) < CACHE_DURATION
}

/**
 * Obtenir le coût en crédits d'une fonctionnalité
 */
export async function getFeatureCost(featureKey: string): Promise<number> {
  // Recharger le cache si nécessaire
  if (!isCacheValid()) {
    await loadPricingFromDB()
  }

  // Chercher dans le cache
  const cached = pricingCache.get(featureKey)
  if (cached) {
    return cached.credits_cost
  }

  // Fallback sur les valeurs par défaut
  return DEFAULT_PRICING[featureKey] || 0
}

/**
 * Obtenir la configuration complète d'une fonctionnalité
 */
export async function getFeatureConfig(featureKey: string): Promise<PricingConfig | null> {
  if (!isCacheValid()) {
    await loadPricingFromDB()
  }

  return pricingCache.get(featureKey) || null
}

/**
 * Vérifier si une fonctionnalité est active
 */
export async function isFeatureActive(featureKey: string): Promise<boolean> {
  if (!isCacheValid()) {
    await loadPricingFromDB()
  }

  const config = pricingCache.get(featureKey)
  return config?.is_active ?? true // Par défaut actif si non trouvé
}

/**
 * Obtenir tous les tarifs (pour affichage)
 */
export async function getAllPricing(): Promise<PricingConfig[]> {
  if (!isCacheValid()) {
    await loadPricingFromDB()
  }

  return Array.from(pricingCache.values())
}

/**
 * Obtenir la valeur du crédit en FCFA
 */
export async function getCreditValueFCFA(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'credit_value_fcfa')
      .single()

    if (error || !data) {
      return 10 // Valeur par défaut: 1 crédit = 10 FCFA
    }

    return parseInt(data.value) || 10
  } catch (error) {
    console.error('Erreur getCreditValueFCFA:', error)
    return 10
  }
}

/**
 * Forcer le rechargement du cache
 */
export async function refreshPricingCache(): Promise<void> {
  cacheTimestamp = 0
  await loadPricingFromDB()
}

/**
 * Hook React pour utiliser les tarifs
 */
export function usePricing() {
  const [pricing, setPricing] = React.useState<Map<string, PricingConfig>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [creditValue, setCreditValue] = React.useState(10)

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      await loadPricingFromDB()
      setPricing(new Map(pricingCache))
      const value = await getCreditValueFCFA()
      setCreditValue(value)
      setLoading(false)
    }
    load()
  }, [])

  const getCost = (featureKey: string): number => {
    return pricing.get(featureKey)?.credits_cost || DEFAULT_PRICING[featureKey] || 0
  }

  const getCostInFCFA = (featureKey: string): number => {
    return getCost(featureKey) * creditValue
  }

  const isActive = (featureKey: string): boolean => {
    return pricing.get(featureKey)?.is_active ?? true
  }

  return {
    pricing,
    loading,
    creditValue,
    getCost,
    getCostInFCFA,
    isActive,
    refresh: refreshPricingCache
  }
}

// Import React pour le hook
import React from 'react'

/**
 * Export des coûts par défaut pour compatibilité avec le code existant
 * Ces valeurs seront écrasées par les valeurs de la DB si disponibles
 */
export const CREDIT_COSTS = DEFAULT_PRICING

/**
 * Fonction helper pour obtenir le coût de manière synchrone (utilise le cache)
 * À utiliser uniquement après que loadPricingFromDB() a été appelé
 */
export function getFeatureCostSync(featureKey: string): number {
  const cached = pricingCache.get(featureKey)
  return cached?.credits_cost || DEFAULT_PRICING[featureKey] || 0
}
