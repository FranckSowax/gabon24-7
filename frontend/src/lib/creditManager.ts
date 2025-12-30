/**
 * CREDIT MANAGER - Système de gestion des crédits
 * Synchronisé avec Supabase pour gérer le solde et les transactions
 */

import { supabase } from './supabase'

export interface CreditTransaction {
  id?: string
  user_id: string
  type: 'credit_purchase' | 'credit_usage' | 'credit_refund' | 'subscription_change'
  amount: number
  credits?: number
  description: string
  status: 'completed' | 'pending' | 'failed'
  metadata?: any
  created_at?: string
}

export interface CreditBalance {
  userId: string
  balance: number
  lastUpdated: Date
}

/**
 * Récupérer le solde de crédits d'un utilisateur
 */
export async function getCreditBalance(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('credits_balance')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Erreur récupération solde:', error)
      return 0
    }

    return data?.credits_balance || 0
  } catch (error) {
    console.error('Erreur getCreditBalance:', error)
    return 0
  }
}

/**
 * Débiter des crédits (consommation)
 */
export async function debitCredits(
  userId: string,
  credits: number,
  description: string,
  metadata?: any
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    // 1. Vérifier le solde actuel
    const currentBalance = await getCreditBalance(userId)
    
    if (currentBalance < credits) {
      return {
        success: false,
        newBalance: currentBalance,
        error: `Solde insuffisant. Vous avez ${currentBalance} crédits, ${credits} requis.`
      }
    }

    // 2. Débiter les crédits
    const newBalance = currentBalance - credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        credits_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Erreur débit crédits:', updateError)
      return {
        success: false,
        newBalance: currentBalance,
        error: 'Erreur lors du débit'
      }
    }

    // 3. Enregistrer la transaction
    await recordTransaction({
      user_id: userId,
      type: 'credit_usage',
      amount: 0,
      credits: credits,
      description: description,
      status: 'completed',
      metadata: metadata
    })

    return {
      success: true,
      newBalance: newBalance
    }
  } catch (error) {
    console.error('Erreur debitCredits:', error)
    return {
      success: false,
      newBalance: 0,
      error: 'Erreur système'
    }
  }
}

/**
 * Créditer des crédits (achat, bonus, remboursement)
 */
export async function creditCredits(
  userId: string,
  credits: number,
  amount: number, // Prix en FCFA
  description: string,
  type: 'credit_purchase' | 'credit_refund' = 'credit_purchase',
  metadata?: any
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    // 1. Récupérer le solde actuel
    const currentBalance = await getCreditBalance(userId)

    // 2. Créditer les crédits
    const newBalance = currentBalance + credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        credits_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Erreur crédit crédits:', updateError)
      return {
        success: false,
        newBalance: currentBalance,
        error: 'Erreur lors du crédit'
      }
    }

    // 3. Enregistrer la transaction
    await recordTransaction({
      user_id: userId,
      type: type,
      amount: amount,
      credits: credits,
      description: description,
      status: 'completed',
      metadata: metadata
    })

    return {
      success: true,
      newBalance: newBalance
    }
  } catch (error) {
    console.error('Erreur creditCredits:', error)
    return {
      success: false,
      newBalance: 0,
      error: 'Erreur système'
    }
  }
}

/**
 * Enregistrer une transaction dans l'historique
 */
export async function recordTransaction(transaction: CreditTransaction): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: transaction.user_id,
        type: transaction.type,
        amount: transaction.amount,
        credits: transaction.credits,
        description: transaction.description,
        status: transaction.status,
        metadata: transaction.metadata,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Erreur enregistrement transaction:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Erreur recordTransaction:', error)
    return false
  }
}

/**
 * Vérifier si l'utilisateur a assez de crédits
 */
export async function hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
  const balance = await getCreditBalance(userId)
  return balance >= requiredCredits
}

/**
 * Récupérer l'historique des transactions
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Erreur récupération historique:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Erreur getTransactionHistory:', error)
    return []
  }
}

/**
 * Coûts des fonctionnalités en crédits (valeurs par défaut)
 * Basés sur coûts IA réels (Déc 2024): Gemini 2.0 Flash, GPT-4o-mini, OpenAI TTS-1
 * Ces valeurs sont écrasées par celles de la DB via pricingService
 */
export const CREDIT_COSTS = {
  ARTICLE_PREMIUM: 1,          // Déverrouiller un article premium
  AUDIO_SUMMARY: 5,            // Générer un résumé audio (~800 tokens + TTS 30s)
  AI_ANALYSIS: 6,              // Analyse IA approfondie (~5000 tokens)
  VEILLE_REPORT: 5,            // Rapport de veille complet (~3500 tokens)
  OPPORTUNITY_ANALYSIS: 6,     // Analyse d'opportunité (~4000 tokens)
  CUSTOM_ALERT: 2,             // Créer une alerte personnalisée
} as const

// Mapping entre les clés legacy et les nouvelles clés
const FEATURE_KEY_MAP: Record<keyof typeof CREDIT_COSTS, string> = {
  ARTICLE_PREMIUM: 'article_premium',
  AUDIO_SUMMARY: 'audio_summary',
  AI_ANALYSIS: 'ai_analysis',
  VEILLE_REPORT: 'veille_report',
  OPPORTUNITY_ANALYSIS: 'opportunity_analysis',
  CUSTOM_ALERT: 'custom_alert',
}

const FEATURE_DESCRIPTIONS: Record<keyof typeof CREDIT_COSTS, string> = {
  ARTICLE_PREMIUM: 'Déverrouillage article premium',
  AUDIO_SUMMARY: 'Résumé audio personnalisé',
  AI_ANALYSIS: 'Analyse IA approfondie',
  VEILLE_REPORT: 'Rapport de veille complet',
  OPPORTUNITY_ANALYSIS: 'Analyse d\'opportunité',
  CUSTOM_ALERT: 'Alerte personnalisée',
}

/**
 * Helper pour débiter selon une fonctionnalité
 * Utilise le service de tarification pour obtenir le coût dynamique
 */
export async function debitForFeature(
  userId: string,
  feature: keyof typeof CREDIT_COSTS,
  additionalInfo?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  // Importer dynamiquement pour éviter les dépendances circulaires
  const { getFeatureCost } = await import('./pricingService')
  
  // Obtenir le coût depuis la DB ou utiliser la valeur par défaut
  const featureKey = FEATURE_KEY_MAP[feature]
  const cost = await getFeatureCost(featureKey) || CREDIT_COSTS[feature]
  
  const description = additionalInfo 
    ? `${FEATURE_DESCRIPTIONS[feature]} - ${additionalInfo}`
    : FEATURE_DESCRIPTIONS[feature]

  return debitCredits(userId, cost, description, { feature, featureKey })
}

/**
 * Helper pour débiter avec une clé de fonctionnalité directe
 */
export async function debitForFeatureKey(
  userId: string,
  featureKey: string,
  description: string,
  additionalInfo?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const { getFeatureCost } = await import('./pricingService')
  
  const cost = await getFeatureCost(featureKey)
  if (cost === 0) {
    console.warn(`Coût non trouvé pour la fonctionnalité: ${featureKey}`)
  }
  
  const fullDescription = additionalInfo 
    ? `${description} - ${additionalInfo}`
    : description

  return debitCredits(userId, cost, fullDescription, { featureKey })
}

/**
 * Initialiser le solde de crédits pour un nouvel utilisateur
 */
export async function initializeUserCredits(userId: string, initialCredits: number = 50): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ credits_balance: initialCredits })
      .eq('id', userId)

    if (error) {
      console.error('Erreur initialisation crédits:', error)
      return false
    }

    // Enregistrer la transaction de bienvenue
    await recordTransaction({
      user_id: userId,
      type: 'credit_purchase',
      amount: 0,
      credits: initialCredits,
      description: 'Crédits de bienvenue',
      status: 'completed',
      metadata: { reason: 'welcome_bonus' }
    })

    return true
  } catch (error) {
    console.error('Erreur initializeUserCredits:', error)
    return false
  }
}

/**
 * Hook React pour gérer les crédits
 */
export function useCreditManager(userId: string | undefined) {
  const [balance, setBalance] = React.useState<number>(0)
  const [loading, setLoading] = React.useState(true)
  const [pricingLoaded, setPricingLoaded] = React.useState(false)

  React.useEffect(() => {
    if (userId) {
      loadBalance()
    }
  }, [userId])

  // Charger les tarifs au montage
  React.useEffect(() => {
    const loadPricing = async () => {
      try {
        const { loadPricingFromDB } = await import('./pricingService')
        await loadPricingFromDB()
        setPricingLoaded(true)
      } catch (error) {
        console.error('Erreur chargement tarifs:', error)
      }
    }
    loadPricing()
  }, [])

  const loadBalance = async () => {
    if (!userId) return
    setLoading(true)
    const newBalance = await getCreditBalance(userId)
    setBalance(newBalance)
    setLoading(false)
  }

  const debit = async (
    credits: number,
    description: string,
    metadata?: any
  ) => {
    if (!userId) return { success: false, error: 'Non connecté' }
    const result = await debitCredits(userId, credits, description, metadata)
    if (result.success) {
      setBalance(result.newBalance)
    }
    return result
  }

  const credit = async (
    credits: number,
    amount: number,
    description: string,
    metadata?: any
  ) => {
    if (!userId) return { success: false, error: 'Non connecté' }
    const result = await creditCredits(userId, credits, amount, description, 'credit_purchase', metadata)
    if (result.success) {
      setBalance(result.newBalance)
    }
    return result
  }

  const debitForFeatureAction = async (
    feature: keyof typeof CREDIT_COSTS,
    additionalInfo?: string
  ) => {
    if (!userId) return { success: false, error: 'Non connecté' }
    const result = await debitForFeature(userId, feature, additionalInfo)
    if (result.success) {
      setBalance(result.newBalance)
    }
    return result
  }

  // Nouvelle fonction pour débiter avec une clé de fonctionnalité
  const debitByFeatureKey = async (
    featureKey: string,
    description: string,
    additionalInfo?: string
  ) => {
    if (!userId) return { success: false, error: 'Non connecté' }
    const result = await debitForFeatureKey(userId, featureKey, description, additionalInfo)
    if (result.success) {
      setBalance(result.newBalance)
    }
    return result
  }

  // Obtenir le coût d'une fonctionnalité
  const getFeatureCostAsync = async (featureKey: string): Promise<number> => {
    const { getFeatureCost } = await import('./pricingService')
    return getFeatureCost(featureKey)
  }

  return {
    balance,
    loading,
    pricingLoaded,
    refresh: loadBalance,
    debit,
    credit,
    debitForFeature: debitForFeatureAction,
    debitByFeatureKey,
    getFeatureCost: getFeatureCostAsync,
    hasEnough: (required: number) => balance >= required
  }
}

// Note: React import pour le hook
import React from 'react'
