'use client'

import { useState, useEffect } from 'react'
import { Coins, TrendingUp, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface CreditBalanceData {
  balance: number
  bonus_balance: number
  total_balance: number
  is_low_balance: boolean
  total_earned: number
  total_spent: number
}

interface CreditBalanceProps {
  onTopUp?: () => void
  showDetails?: boolean
  compact?: boolean
}

export default function CreditBalance({ onTopUp, showDetails = true, compact = false }: CreditBalanceProps) {
  const { user } = useAuth()
  const [balance, setBalance] = useState<CreditBalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [masked, setMasked] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBalance = async () => {
    if (!user?.id) return

    try {
      setRefreshing(true)
      const res = await fetch(`${API_URL}/api/credits-premium/balance/${user.id}`)
      const data = await res.json()
      
      if (data.success) {
        setBalance(data)
      }
    } catch (error) {
      console.error('Erreur chargement solde:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchBalance()
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  if (loading) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border border-orange-200 animate-pulse`}>
        <div className="h-6 bg-orange-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-orange-200 rounded w-3/4"></div>
      </div>
    )
  }

  if (!balance) return null

  const displayBalance = masked ? '***' : balance.total_balance.toLocaleString()
  const isLowBalance = balance.is_low_balance

  return (
    <div className={`${compact ? 'p-3' : 'p-4'} bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 rounded-xl border-2 ${isLowBalance ? 'border-red-300' : 'border-orange-300'} shadow-md hover:shadow-lg transition-all`}>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium">Solde Crédits</p>
            {isLowBalance && (
              <p className="text-xs text-red-600 font-semibold">⚠️ Solde faible</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMasked(!masked)}
            className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors"
            title={masked ? 'Afficher' : 'Masquer'}
          >
            {masked ? <Eye className="w-4 h-4 text-gray-600" /> : <EyeOff className="w-4 h-4 text-gray-600" />}
          </button>
          
          <button
            onClick={fetchBalance}
            disabled={refreshing}
            className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Solde principal */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{displayBalance}</span>
          <span className="text-sm text-gray-600 font-medium">crédits</span>
        </div>
        
        {!masked && showDetails && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600">{balance.balance} achetés</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-600">{balance.bonus_balance} bonus</span>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      {!compact && showDetails && !masked && (
        <div className="grid grid-cols-2 gap-2 mb-3 pt-3 border-t border-orange-200">
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-600">Total gagné</p>
            <p className="text-sm font-semibold text-green-600">+{balance.total_earned}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-600">Total dépensé</p>
            <p className="text-sm font-semibold text-gray-700">-{balance.total_spent}</p>
          </div>
        </div>
      )}

      {/* Bouton recharge */}
      {onTopUp && (
        <button
          onClick={onTopUp}
          className={`w-full ${compact ? 'py-2' : 'py-2.5'} bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Recharger</span>
        </button>
      )}
    </div>
  )
}
