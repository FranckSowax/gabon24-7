'use client'

import { useState, useEffect } from 'react'
import { History, TrendingUp, TrendingDown, RefreshCw, Calendar, Package as PackageIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Transaction {
  id: string
  type: 'purchase' | 'consume' | 'bonus' | 'refund' | 'admin_adjustment' | 'welcome_bonus'
  amount: number
  balance_after: number
  bonus_balance_after: number
  description: string
  service_name?: string
  package_id?: string
  created_at: string
  status: string
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  purchase: { label: 'Achat', color: 'text-green-600 bg-green-50', icon: TrendingUp },
  consume: { label: 'Consommation', color: 'text-red-600 bg-red-50', icon: TrendingDown },
  bonus: { label: 'Bonus', color: 'text-yellow-600 bg-yellow-50', icon: PackageIcon },
  refund: { label: 'Remboursement', color: 'text-blue-600 bg-blue-50', icon: RefreshCw },
  admin_adjustment: { label: 'Ajustement', color: 'text-purple-600 bg-purple-50', icon: RefreshCw },
  welcome_bonus: { label: 'Bienvenue', color: 'text-yellow-600 bg-yellow-50', icon: PackageIcon }
}

export default function CreditHistory() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(20)

  const fetchHistory = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/credits-premium/history/${user.id}?limit=${limit}`)
      const data = await res.json()
      
      if (data.success) {
        setTransactions(data.transactions)
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [user?.id, limit])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `Il y a ${diffMins} min`
    } else if (diffHours < 24) {
      return `Il y a ${diffHours}h`
    } else {
      const days = Math.floor(diffHours / 24)
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Historique des transactions</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
              <div className="w-10 h-10 bg-gray-300 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Historique des transactions</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Aucune transaction pour le moment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Historique des transactions</h3>
        </div>
        <button
          onClick={fetchHistory}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Liste des transactions */}
      <div className="space-y-2">
        {transactions.map((tx) => {
          const typeInfo = TYPE_LABELS[tx.type] || TYPE_LABELS.consume
          const Icon = typeInfo.icon
          const isPositive = tx.amount > 0
          
          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
            >
              {/* Icône */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Détails */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(tx.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate">{tx.description}</p>
                {tx.service_name && (
                  <p className="text-xs text-gray-500 mt-1">Service: {tx.service_name}</p>
                )}
              </div>

              {/* Montant */}
              <div className="text-right">
                <p className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{tx.amount}
                </p>
                <p className="text-xs text-gray-500">
                  Solde: {tx.balance_after + tx.bonus_balance_after}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bouton charger plus */}
      {transactions.length >= limit && (
        <button
          onClick={() => setLimit(limit + 20)}
          className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Charger plus
        </button>
      )}
    </div>
  )
}
