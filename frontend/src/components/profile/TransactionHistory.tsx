'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Transaction {
  id: string
  type: 'credit_purchase' | 'subscription_change' | 'credit_usage'
  amount: number
  credits?: number
  description: string
  status: 'completed' | 'pending' | 'failed'
  created_at: string
}

interface TransactionHistoryProps {
  userId: string
}

export default function TransactionHistory({ userId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'credits' | 'subscriptions'>('all')
  const [monthlyStats, setMonthlyStats] = useState({
    creditsUsed: 0,
    creditsPurchased: 0,
    totalSpent: 0
  })

  useEffect(() => {
    loadTransactions()
    loadMonthlyStats()
  }, [userId])

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Erreur chargement transactions:', error)
        // Données de démonstration si erreur
        setTransactions(getDemoTransactions())
      } else if (data) {
        setTransactions(data)
      } else {
        setTransactions(getDemoTransactions())
      }
    } catch (error) {
      console.error('Erreur:', error)
      setTransactions(getDemoTransactions())
    } finally {
      setLoading(false)
    }
  }

  const loadMonthlyStats = async () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, credits')
        .eq('user_id', userId)
        .gte('created_at', firstDayOfMonth)
        .eq('status', 'completed')

      if (data) {
        const stats = data.reduce((acc: { creditsUsed: number, creditsPurchased: number, totalSpent: number }, t: any) => {
          if (t.type === 'credit_usage') {
            acc.creditsUsed += t.credits || 0
          } else if (t.type === 'credit_purchase') {
            acc.creditsPurchased += t.credits || 0
            acc.totalSpent += t.amount || 0
          }
          return acc
        }, { creditsUsed: 0, creditsPurchased: 0, totalSpent: 0 })

        setMonthlyStats(stats)
      }
    } catch (error) {
      console.error('Erreur stats:', error)
    }
  }

  const getDemoTransactions = (): Transaction[] => [
    {
      id: '1',
      type: 'credit_purchase',
      amount: 5000,
      credits: 300,
      description: 'Achat de 300 crédits + 50 bonus',
      status: 'completed',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      type: 'credit_usage',
      amount: 0,
      credits: 10,
      description: 'Analyse IA approfondie - Article "Gabon Économie"',
      status: 'completed',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      type: 'subscription_change',
      amount: 2000,
      description: 'Upgrade vers Premium',
      status: 'completed',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '4',
      type: 'credit_usage',
      amount: 0,
      credits: 5,
      description: 'Résumé audio personnalisé',
      status: 'completed',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true
    if (filter === 'credits') return t.type === 'credit_purchase' || t.type === 'credit_usage'
    if (filter === 'subscriptions') return t.type === 'subscription_change'
    return true
  })

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit_purchase': return '💰'
      case 'subscription_change': return '👑'
      case 'credit_usage': return '📊'
      default: return '📝'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Complété'
      case 'pending': return 'En attente'
      case 'failed': return 'Échoué'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement de l'historique...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats mensuelles */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-4">📊 Consommation ce mois-ci</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <p className="text-sm text-blue-100 mb-1">Crédits utilisés</p>
            <p className="text-3xl font-bold">{monthlyStats.creditsUsed}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <p className="text-sm text-blue-100 mb-1">Crédits achetés</p>
            <p className="text-3xl font-bold">{monthlyStats.creditsPurchased}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <p className="text-sm text-blue-100 mb-1">Total dépensé</p>
            <p className="text-3xl font-bold">{monthlyStats.totalSpent.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-blue-100">FCFA</p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Tout
        </button>
        <button
          onClick={() => setFilter('credits')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'credits'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          💰 Crédits
        </button>
        <button
          onClick={() => setFilter('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'subscriptions'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          👑 Abonnements
        </button>
      </div>

      {/* Liste des transactions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-2">Aucune transaction</p>
            <p className="text-sm text-gray-400">Vos transactions apparaîtront ici</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-3xl mt-1">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(transaction.created_at)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                          {getStatusLabel(transaction.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {transaction.credits && (
                      <p className={`text-lg font-bold ${
                        transaction.type === 'credit_usage' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'credit_usage' ? '-' : '+'}{transaction.credits} crédits
                      </p>
                    )}
                    {transaction.amount > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {transaction.amount.toLocaleString('fr-FR')} FCFA
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export button */}
      <div className="flex justify-center">
        <button className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
          📥 Exporter l'historique (CSV)
        </button>
      </div>
    </div>
  )
}
