/**
 * CREDIT MANAGER - Lecture du solde et de l'historique de crédits.
 *
 * LECTURE SEULE. Ce fichier contenait des fonctions qui débitaient, créditaient
 * et initialisaient le solde directement depuis le navigateur. Elles ont été
 * retirées : aucune page ne les appelait, et la base refuse désormais ces
 * écritures. Tout mouvement de crédits passe par le serveur
 * (/api/credits-premium, /api/payments), qui est seul à pouvoir modifier un solde.
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
      .from('user_credits')
      .select('balance, bonus_balance')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Erreur récupération solde:', error)
      return 0
    }

    return (data?.balance || 0) + (data?.bonus_balance || 0)
  } catch (error) {
    console.error('Erreur getCreditBalance:', error)
    return 0
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
  AI_ANALYSIS: 15,             // Analyse IA approfondie (~5000 tokens)
  VEILLE_REPORT: 5,            // Rapport de veille complet (~3500 tokens)
  OPPORTUNITY_ANALYSIS: 15,    // Analyse d'opportunité (~4000 tokens)
  CUSTOM_ALERT: 2,             // Créer une alerte personnalisée
} as const
