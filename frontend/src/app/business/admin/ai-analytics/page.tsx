'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, DollarSign, Activity, Clock, AlertTriangle, 
  CheckCircle, XCircle, BarChart3, PieChart, RefreshCw,
  Download, Zap, Database
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface QuotaStatus {
  status: string
  percentageUsed: number
  totalSpent: number
  remainingBudget: number
  monthlyBudget: number
  requestsToday: number
  requestsThisHour: number
  totalRequests: number
  estimatedRequestsLeft: number
  recentErrorsCount: number
}

interface ServiceCosts {
  [key: string]: number
}

interface CacheStats {
  memory: {
    size: number
    maxSize: number
  }
  database: {
    totalEntries: number
    totalHits: number
    topAnalyses: any[]
  }
}

export default function AIAnalyticsPage() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [costs, setCosts] = useState<{ openai: ServiceCosts, internal: ServiceCosts } | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchData = async () => {
    setLoading(true)
    try {
      // Récupérer le statut du quota
      const statusRes = await fetch(`${API_URL}/api/ai/admin/status`)
      const statusData = await statusRes.json()
      
      if (statusData.success) {
        setQuota(statusData.quota)
        setCosts(statusData.costs)
      }

      // Récupérer les stats du cache
      const cacheRes = await fetch(`${API_URL}/api/ai/admin/cache-stats`)
      const cacheData = await cacheRes.json()
      
      if (cacheData.success) {
        setCacheStats(cacheData.stats)
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erreur chargement données:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Auto-refresh toutes les 30 secondes
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'critical': return 'text-orange-500'
      case 'exhausted': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-6 h-6" />
      case 'warning': return <AlertTriangle className="w-6 h-6" />
      case 'critical': return <XCircle className="w-6 h-6" />
      case 'exhausted': return <XCircle className="w-6 h-6" />
      default: return <Activity className="w-6 h-6" />
    }
  }

  const handleResetQuota = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser le quota mensuel ?')) return
    
    try {
      const res = await fetch(`${API_URL}/api/ai/admin/reset-quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmReset: true })
      })
      
      const data = await res.json()
      if (data.success) {
        alert('✅ Quota réinitialisé avec succès')
        fetchData()
      } else {
        alert('❌ Erreur: ' + data.error)
      }
    } catch (error) {
      alert('❌ Erreur lors de la réinitialisation')
    }
  }

  if (loading && !quota) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🤖 Analytics IA
              </h1>
              <p className="text-gray-600">
                Monitoring du quota OpenAI et des performances
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              <button
                onClick={handleResetQuota}
                className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-all"
              >
                Reset Quota
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
          </p>
        </motion.div>

        {quota && (
          <>
            {/* Status général */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-xl p-8 mb-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={getStatusColor(quota.status)}>
                    {getStatusIcon(quota.status)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Status: <span className={getStatusColor(quota.status)}>
                        {quota.status.toUpperCase()}
                      </span>
                    </h2>
                    <p className="text-gray-600">
                      {quota.percentageUsed}% du budget mensuel utilisé
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-600">
                    ${quota.totalSpent.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">
                    sur ${quota.monthlyBudget}
                  </div>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${quota.percentageUsed}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    quota.percentageUsed >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    quota.percentageUsed >= 80 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                    'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                />
              </div>
            </motion.div>

            {/* Métriques clés */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <MetricCard
                icon={<DollarSign className="w-6 h-6" />}
                title="Budget Restant"
                value={`$${quota.remainingBudget.toFixed(2)}`}
                subtitle={`${quota.estimatedRequestsLeft} requêtes estimées`}
                color="green"
              />
              <MetricCard
                icon={<Activity className="w-6 h-6" />}
                title="Requêtes Aujourd'hui"
                value={quota.requestsToday.toString()}
                subtitle={`${quota.requestsThisHour} cette heure`}
                color="blue"
              />
              <MetricCard
                icon={<TrendingUp className="w-6 h-6" />}
                title="Total Requêtes"
                value={quota.totalRequests.toString()}
                subtitle="Depuis le dernier reset"
                color="purple"
              />
              <MetricCard
                icon={<AlertTriangle className="w-6 h-6" />}
                title="Erreurs Récentes"
                value={quota.recentErrorsCount.toString()}
                subtitle="5 dernières minutes"
                color={quota.recentErrorsCount > 5 ? "red" : "gray"}
              />
            </div>

            {/* Coûts par service */}
            {costs && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl shadow-xl p-6"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    Coûts OpenAI (USD)
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(costs.openai).map(([service, cost]) => (
                      <div key={service} className="flex justify-between items-center">
                        <span className="text-gray-700">{service}</span>
                        <span className="font-mono font-bold text-gray-900">
                          ${(cost as number).toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl shadow-xl p-6"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Crédits Internes
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(costs.internal).map(([service, credits]) => (
                      <div key={service} className="flex justify-between items-center">
                        <span className="text-gray-700">{service}</span>
                        <span className="font-mono font-bold text-gray-900">
                          {credits} crédits
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            {/* Stats du cache */}
            {cacheStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl shadow-xl p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  Statistiques du Cache
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {cacheStats.database.totalEntries}
                    </div>
                    <div className="text-sm text-gray-600">Analyses en cache</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {cacheStats.database.totalHits}
                    </div>
                    <div className="text-sm text-gray-600">Réutilisations</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {cacheStats.memory.size}/{cacheStats.memory.maxSize}
                    </div>
                    <div className="text-sm text-gray-600">Cache mémoire</div>
                  </div>
                </div>

                {cacheStats.database.totalHits > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Économies réalisées</h4>
                      <span className="text-sm text-gray-600">
                        Grâce au cache
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="text-2xl font-bold text-green-700 mb-1">
                          ${(cacheStats.database.totalHits * 0.015).toFixed(2)}
                        </div>
                        <div className="text-xs text-green-600">Budget OpenAI économisé</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="text-2xl font-bold text-blue-700 mb-1">
                          {cacheStats.database.totalHits * 2}
                        </div>
                        <div className="text-xs text-blue-600">Crédits économisés</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  color: string
}

function MetricCard({ icon, title, value, subtitle, color }: MetricCardProps) {
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
    >
      <div className={`${colors[color as keyof typeof colors]} text-white p-3 rounded-lg w-fit mb-3`}>
        {icon}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </motion.div>
  )
}
