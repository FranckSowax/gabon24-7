'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Transaction {
  id: string
  type: 'credit_purchase' | 'subscription_change' | 'credit_usage' | 'purchase'
  amount: number
  credits?: number
  description: string
  status: 'completed' | 'pending' | 'failed' | 'cancelled'
  created_at: string
  source?: 'credit_transactions' | 'ebilling_payments'
  payment_reference?: string
}

interface TransactionHistoryProps {
  userId: string
}

export default function TransactionHistory({ userId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
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
      // Charger les deux sources en parallèle
      const [creditResult, ebillingResult] = await Promise.allSettled([
        supabase
          .from('credit_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('ebilling_payments')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['pending', 'failed', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const allTransactions: Transaction[] = []

      // Ajouter les credit_transactions (complétées)
      if (creditResult.status === 'fulfilled' && creditResult.value.data) {
        creditResult.value.data.forEach((t: any) => {
          allTransactions.push({
            ...t,
            source: 'credit_transactions',
          })
        })
      }

      // Ajouter les ebilling_payments non-complétées (pending/failed/cancelled)
      if (ebillingResult.status === 'fulfilled' && ebillingResult.value.data) {
        ebillingResult.value.data.forEach((p: any) => {
          // Éviter les doublons (si déjà dans credit_transactions)
          const alreadyExists = allTransactions.some(
            t => t.payment_reference === p.reference || t.payment_reference === p.bill_id
          )
          if (!alreadyExists) {
            allTransactions.push({
              id: p.id,
              type: p.payment_type === 'credits' ? 'credit_purchase' : 'subscription_change',
              amount: p.amount || 0,
              credits: (p.credits_to_add || 0) + (p.bonus_credits || 0),
              description: p.description || `Paiement ${p.payment_type} - ${p.reference}`,
              status: p.status,
              created_at: p.created_at,
              source: 'ebilling_payments',
              payment_reference: p.reference,
            })
          }
        })
      }

      // Trier par date décroissante
      allTransactions.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      if (allTransactions.length > 0) {
        setTransactions(allTransactions)
      } else if (
        (creditResult.status === 'fulfilled' && creditResult.value.error) &&
        (ebillingResult.status === 'fulfilled' && ebillingResult.value.error)
      ) {
        setTransactions(getDemoTransactions())
      } else {
        setTransactions(allTransactions)
      }
    } catch (error) {
      console.error('Erreur:', error)
      setTransactions(getDemoTransactions())
    } finally {
      setLoading(false)
    }
  }

  const handleReconcile = async () => {
    setReconciling(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) return

      const response = await fetch(`${API_URL}/api/payments/reconcile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json()

      if (data.success && data.reconciled > 0) {
        // Recharger les transactions après réconciliation
        await loadTransactions()
        await loadMonthlyStats()
      }
    } catch (error) {
      console.error('Erreur réconciliation:', error)
    } finally {
      setReconciling(false)
    }
  }

  const loadMonthlyStats = async () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    try {
      const { data } = await supabase
        .from('credit_transactions')
        .select('type, amount, credits:amount')
        .eq('user_id', userId)
        .gte('created_at', firstDayOfMonth)

      if (data) {
        const stats = data.reduce((acc: { creditsUsed: number, creditsPurchased: number, totalSpent: number }, t: any) => {
          if (t.type === 'credit_usage') {
            acc.creditsUsed += t.credits || 0
          } else if (t.type === 'credit_purchase' || t.type === 'purchase') {
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

  const pendingPayments = transactions.filter(t => t.status === 'pending')

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true
    if (filter === 'credits') return t.type === 'credit_purchase' || t.type === 'credit_usage' || t.type === 'purchase'
    if (filter === 'subscriptions') return t.type === 'subscription_change'
    return true
  })

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit_purchase':
      case 'purchase': return '💰'
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
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Complété'
      case 'pending': return 'En attente'
      case 'failed': return 'Échoué'
      case 'cancelled': return 'Annulé'
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
        <p className="mt-4 text-gray-600">Chargement de l&apos;historique...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerte paiements en attente */}
      {pendingPayments.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-800">
                {pendingPayments.length} paiement{pendingPayments.length > 1 ? 's' : ''} en attente
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                {pendingPayments.length === 1
                  ? `Un paiement de ${pendingPayments[0].amount?.toLocaleString('fr-FR')} FCFA est en attente de confirmation.`
                  : `Des paiements sont en attente de confirmation par le service de paiement.`
                }
              </p>
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                {reconciling ? 'Vérification en cours...' : 'Vérifier le statut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats mensuelles */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-4">Consommation ce mois-ci</h3>
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
          Crédits
        </button>
        <button
          onClick={() => setFilter('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            filter === 'subscriptions'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Abonnements
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
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  transaction.status === 'pending' ? 'bg-yellow-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-3xl mt-1">
                      {transaction.status === 'pending' ? '⏳' : getTransactionIcon(transaction.type)}
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
                        {transaction.payment_reference && (
                          <span className="text-xs text-gray-400">
                            Réf: {transaction.payment_reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {transaction.credits ? (
                      <p className={`text-lg font-bold ${
                        transaction.type === 'credit_usage' ? 'text-red-600'
                          : transaction.status === 'pending' ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                        {transaction.type === 'credit_usage' ? '-' : '+'}{transaction.credits} crédits
                      </p>
                    ) : null}
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
          Exporter l&apos;historique (CSV)
        </button>
      </div>
    </div>
  )
}
