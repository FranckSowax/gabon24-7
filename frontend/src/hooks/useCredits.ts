import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface CreditBalance {
  balance: number
  bonus_balance: number
  total_balance: number
  is_low_balance: boolean
  total_earned: number
  total_spent: number
}

interface ConsumeResult {
  success: boolean
  transaction_id?: string
  balance?: number
  bonus_balance?: number
  total_balance?: number
  consumed?: number
  error?: string
}

export function useCredits() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger le solde
  const fetchBalance = useCallback(async () => {
    if (!user?.id) {
      setBalance(null)
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/credits-premium/balance/${user.id}`)
      const data = await res.json()
      
      if (data.success) {
        setBalance(data)
        setError(null)
      } else {
        throw new Error(data.error || 'Erreur chargement solde')
      }
    } catch (err: any) {
      setError(err.message)
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Charger au montage et quand l'utilisateur change
  useEffect(() => {
    fetchBalance()
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  // Consommer des crédits
  const consume = useCallback(async (
    serviceName: string,
    amount: number,
    description?: string,
    referenceId?: string,
    metadata?: any
  ): Promise<ConsumeResult> => {
    if (!user?.id) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    try {
      const res = await fetch(`${API_URL}/api/credits-premium/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          serviceName,
          amount,
          description: description || `Utilisation de ${serviceName}`,
          referenceId,
          metadata
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        // Rafraîchir le solde
        await fetchBalance()
      }
      
      return data
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [user?.id, fetchBalance])

  // Vérifier si l'utilisateur a assez de crédits
  const hasEnough = useCallback((amount: number): boolean => {
    return (balance?.total_balance || 0) >= amount
  }, [balance])

  // Vérifier avant de consommer
  const check = useCallback(async (serviceName: string): Promise<{
    has_enough: boolean
    balance: number
    required: number
    missing: number
  }> => {
    if (!user?.id) {
      return { has_enough: false, balance: 0, required: 0, missing: 0 }
    }

    try {
      const res = await fetch(`${API_URL}/api/credits-premium/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          serviceName
        })
      })
      
      const data = await res.json()
      return data.success ? data : { has_enough: false, balance: 0, required: 0, missing: 0 }
    } catch (err) {
      return { has_enough: false, balance: 0, required: 0, missing: 0 }
    }
  }, [user?.id])

  return {
    balance: balance?.total_balance || 0,
    balanceDetails: balance,
    loading,
    error,
    consume,
    hasEnough,
    check,
    refresh: fetchBalance,
    isLowBalance: balance?.is_low_balance || false
  }
}
