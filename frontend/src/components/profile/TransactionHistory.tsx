'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Mapping des noms de services techniques → labels lisibles
const SERVICE_LABELS: Record<string, string> = {
  'analyze-opportunity': 'Analyse d\'opportunité',
  'business-plan': 'Business Plan IA',
  'audio-summary': 'Résumé audio',
  'article-analysis': 'Analyse d\'article',
  'chat': 'Chat IA',
  'whatsapp': 'WhatsApp Insight',
  'veille': 'Veille sectorielle',
  'quiz': 'Quiz',
  'training': 'Formation',
  'search': 'Recherche avancée',
}

function formatServiceName(serviceName?: string, description?: string): string {
  if (!serviceName && !description) return 'Utilisation de crédits'
  if (serviceName && SERVICE_LABELS[serviceName]) return SERVICE_LABELS[serviceName]
  if (serviceName) return serviceName.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
  return description || 'Utilisation de crédits'
}

interface CreditTransaction {
  id: string
  user_id: string
  type: string // 'purchase' | 'consumption' | 'subscription' | 'bonus' | 'refund' | 'expiry'
  amount: number // positive for credits in, negative for credits out
  description?: string
  service_name?: string
  balance_after?: number
  bonus_balance_after?: number
  price_paid_xaf?: number
  payment_method?: string
  payment_reference?: string
  package_id?: string
  status?: string
  metadata?: any
  created_at: string
}

interface EbillingPayment {
  id: string
  reference: string
  bill_id?: string
  amount: number // price in FCFA
  credits_to_add?: number
  bonus_credits?: number
  payment_type: string
  status: string
  description?: string
  created_at: string
}

interface DisplayTransaction {
  id: string
  type: string
  creditAmount: number // absolute number of credits (always positive for display)
  isDebit: boolean
  priceFcfa: number
  description: string
  serviceName?: string
  status: string
  created_at: string
  source: 'credit_transactions' | 'ebilling_payments'
  paymentReference?: string
  balanceAfter?: number
}

interface TransactionHistoryProps {
  userId: string
}

export default function TransactionHistory({ userId }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([])
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

      const allTransactions: DisplayTransaction[] = []

      // Map credit_transactions
      if (creditResult.status === 'fulfilled' && creditResult.value.data) {
        (creditResult.value.data as CreditTransaction[]).forEach(t => {
          const isDebit = t.amount < 0 || t.type === 'consumption'
          allTransactions.push({
            id: t.id,
            type: t.type,
            creditAmount: Math.abs(t.amount),
            isDebit,
            priceFcfa: t.price_paid_xaf || 0,
            description: t.description || formatServiceName(t.service_name),
            serviceName: t.service_name,
            status: t.status || 'completed',
            created_at: t.created_at,
            source: 'credit_transactions',
            paymentReference: t.payment_reference,
            balanceAfter: t.balance_after != null ? (t.balance_after + (t.bonus_balance_after || 0)) : undefined,
          })
        })
      }

      // Map ebilling_payments (pending/failed/cancelled only)
      if (ebillingResult.status === 'fulfilled' && ebillingResult.value.data) {
        (ebillingResult.value.data as EbillingPayment[]).forEach(p => {
          const alreadyExists = allTransactions.some(
            t => t.paymentReference === p.reference || t.paymentReference === p.bill_id
          )
          if (!alreadyExists) {
            allTransactions.push({
              id: p.id,
              type: p.payment_type === 'credits' ? 'purchase' : 'subscription',
              creditAmount: (p.credits_to_add || 0) + (p.bonus_credits || 0),
              isDebit: false,
              priceFcfa: p.amount || 0,
              description: p.description || `Paiement ${p.payment_type} - ${p.reference}`,
              status: p.status,
              created_at: p.created_at,
              source: 'ebilling_payments',
              paymentReference: p.reference,
            })
          }
        })
      }

      allTransactions.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      if (allTransactions.length > 0) {
        setTransactions(allTransactions)
      } else if (
        (creditResult.status === 'fulfilled' && creditResult.value.error) &&
        (ebillingResult.status === 'fulfilled' && ebillingResult.value.error)
      ) {
        setTransactions([])
      } else {
        setTransactions(allTransactions)
      }
    } catch (error) {
      console.error('Erreur:', error)
      setTransactions([])
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
      // Use select('*') to avoid failing on missing columns
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', firstDayOfMonth)

      if (error) {
        console.error('Erreur requête stats:', error)
        return
      }

      if (data && data.length > 0) {
        const stats = data.reduce((acc: { creditsUsed: number, creditsPurchased: number, totalSpent: number }, t: any) => {
          if (t.type === 'consumption') {
            acc.creditsUsed += Math.abs(t.amount || 0)
          } else if (['purchase', 'subscription', 'bonus'].includes(t.type)) {
            acc.creditsPurchased += Math.abs(t.amount || 0)
            acc.totalSpent += t.price_paid_xaf || 0
          }
          return acc
        }, { creditsUsed: 0, creditsPurchased: 0, totalSpent: 0 })

        setMonthlyStats(stats)
      }
    } catch (error) {
      console.error('Erreur stats:', error)
    }
  }

  const pendingPayments = transactions.filter(t => t.status === 'pending')

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true
    if (filter === 'credits') return ['purchase', 'consumption', 'bonus', 'refund'].includes(t.type)
    if (filter === 'subscriptions') return t.type === 'subscription'
    return true
  })

  const getTransactionIcon = (type: string, isDebit: boolean) => {
    if (isDebit) return '📊'
    switch (type) {
      case 'purchase': return '💰'
      case 'subscription': return '👑'
      case 'bonus': return '🎁'
      case 'refund': return '↩️'
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
                  ? `Un paiement de ${pendingPayments[0].priceFcfa?.toLocaleString('fr-FR')} FCFA est en attente de confirmation.`
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
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  tx.status === 'pending' ? 'bg-yellow-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-2xl mt-0.5">
                      {tx.status === 'pending' ? '⏳' : getTransactionIcon(tx.type, tx.isDebit)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {tx.isDebit
                          ? formatServiceName(tx.serviceName, tx.description)
                          : tx.description
                        }
                      </p>
                      {/* Service technique name pour les consommations */}
                      {tx.isDebit && tx.serviceName && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">
                          {tx.serviceName}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500">
                          {formatDate(tx.created_at)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(tx.status)}`}>
                          {getStatusLabel(tx.status)}
                        </span>
                        {tx.paymentReference && (
                          <span className="text-[11px] text-gray-400">
                            Réf: {tx.paymentReference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    {tx.creditAmount > 0 && (
                      <p className={`text-base font-bold ${
                        tx.isDebit
                          ? 'text-red-600'
                          : tx.status === 'pending'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                        {tx.isDebit ? '-' : '+'}{tx.creditAmount} crédit{tx.creditAmount > 1 ? 's' : ''}
                      </p>
                    )}
                    {tx.priceFcfa > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tx.priceFcfa.toLocaleString('fr-FR')} FCFA
                      </p>
                    )}
                    {tx.balanceAfter != null && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Solde: {tx.balanceAfter}
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
