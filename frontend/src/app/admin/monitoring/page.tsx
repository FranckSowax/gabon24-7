'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  Server, 
  Database, 
  Zap,
  RefreshCw,
  Shield,
  Bot,
  BarChart2,
  Terminal,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  HardDrive
} from 'lucide-react'

// Types
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error'
  timestamp: number
  issues: Array<{
    severity: string
    message: string
  }>
  metrics: {
    uptime: number
    requestsTotal: number
    errorRate: string
    avgResponseTime: string
    memoryUsage: string
  }
}

interface PerformanceMetrics {
  timestamp: number
  uptime: number
  requests: {
    total: number
    success: number
    errors: number
    successRate: string
    requestsPerMinute: number
    byStatusCode: Record<string, number>
    topEndpoints: Array<{
      endpoint: string
      count: number
      avgDuration: number
      errorRate: string
    }>
  }
  performance: {
    averageResponseTime: number
    slowRequestsCount: number
    recentSlowRequests: any[]
  }
  resources: {
    memory: {
      used: string
      total: string
      percentage: string
    }
    process: {
      pid: number
      uptime: string
      nodeVersion: string
    }
  }
  errors: {
    total: number
    byType: Record<string, number>
    recent: any[]
  }
  database: {
    queries: number
    errors: number
    slowQueries: any[]
  }
}

export default function MonitoringPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => {
    loadData()
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Récupérer le token admin depuis le localStorage
      const token = localStorage.getItem('supabase.auth.token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Charger health status (public)
      const healthRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/monitoring/health`)
      if (healthRes.ok) {
        const healthData = await healthRes.json()
        setHealthStatus(healthData.data)
      }

      // Charger métriques complètes (admin)
      const metricsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/monitoring/metrics`,
        { headers }
      )
      
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData.data)
      } else if (metricsRes.status === 401) {
        setError('Authentification requise pour voir les métriques détaillées')
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('Erreur monitoring:', err)
      setError('Impossible de charger les données de monitoring')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500 bg-green-50'
      case 'degraded': return 'text-yellow-500 bg-yellow-50'
      case 'error': return 'text-red-500 bg-red-50'
      default: return 'text-gray-500 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-orange-500" />
            Monitoring APM
          </h1>
          <p className="text-gray-600 mt-1">
            Performance et santé de l'application en temps réel
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Dernière màj: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Statut de santé */}
      {healthStatus && (
        <div className={`rounded-xl p-6 border-2 ${
          healthStatus.status === 'healthy' 
            ? 'bg-green-50 border-green-200' 
            : healthStatus.status === 'degraded'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(healthStatus.status)}
              <div>
                <h2 className="text-xl font-bold capitalize">
                  {healthStatus.status === 'healthy' ? 'Système opérationnel' : 
                   healthStatus.status === 'degraded' ? 'Système dégradé' : 
                   'Système en erreur'}
                </h2>
                <p className="text-sm text-gray-600">
                  {healthStatus.issues.length === 0 
                    ? 'Tous les systèmes fonctionnent normalement' 
                    : `${healthStatus.issues.length} problème(s) détecté(s)`}
                </p>
              </div>
            </div>
            <Clock className="w-6 h-6 text-gray-400" />
          </div>

          {/* Issues */}
          {healthStatus.issues.length > 0 && (
            <div className="space-y-2 mt-4">
              {healthStatus.issues.map((issue, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Métriques principales */}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-500 text-sm font-medium">Uptime</h3>
                <Shield className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatUptime(metrics.uptime)}</p>
              <p className="text-xs text-gray-500 mt-1">Temps d'activité</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-500 text-sm font-medium">Temps de réponse</h3>
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{metrics.performance.averageResponseTime}ms</p>
              <p className="text-xs text-gray-500 mt-1">Moyenne sur 100 dernières requêtes</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-500 text-sm font-medium">Requêtes</h3>
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{metrics.requests.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.requests.requestsPerMinute}/min • {metrics.requests.successRate} succès
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-500 text-sm font-medium">Mémoire</h3>
                <HardDrive className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{metrics.resources.memory.used}</p>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.resources.memory.percentage} utilisé
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Endpoints */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-500" />
                  Top 10 Endpoints
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {metrics.requests.topEndpoints.slice(0, 10).map((endpoint, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium text-gray-900 truncate">{endpoint.endpoint}</p>
                      <p className="text-xs text-gray-500">{endpoint.count} requêtes</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{endpoint.avgDuration}ms</p>
                        <p className="text-xs text-gray-500">Moy.</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        parseFloat(endpoint.errorRate) < 1 ? 'bg-green-50 text-green-600' : 
                        parseFloat(endpoint.errorRate) < 5 ? 'bg-yellow-50 text-yellow-600' : 
                        'bg-red-50 text-red-600'
                      }`}>
                        {endpoint.errorRate} erreurs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Codes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-purple-500" />
                  Codes HTTP
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {Object.entries(metrics.requests.byStatusCode)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([code, count]) => (
                    <div key={code} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${
                          code.startsWith('2') ? 'text-green-600' :
                          code.startsWith('3') ? 'text-blue-600' :
                          code.startsWith('4') ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {code}
                        </span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${
                            code.startsWith('2') ? 'bg-green-500' :
                            code.startsWith('3') ? 'bg-blue-500' :
                            code.startsWith('4') ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${(count / metrics.requests.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Erreurs récentes et requêtes lentes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Erreurs récentes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Erreurs récentes ({metrics.errors.total})
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {metrics.errors.recent.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Aucune erreur récente</p>
                ) : (
                  metrics.errors.recent.slice(0, 10).map((err: any, idx: number) => (
                    <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-medium text-red-600">{err.type}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{err.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Requêtes lentes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Requêtes lentes ({metrics.performance.slowRequestsCount})
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {metrics.performance.recentSlowRequests.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Aucune requête lente</p>
                ) : (
                  metrics.performance.recentSlowRequests.slice(0, 10).map((req: any, idx: number) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-mono font-medium text-yellow-700">{req.endpoint}</span>
                        <span className="text-xs font-bold text-yellow-600">{req.duration}ms</span>
                      </div>
                      <p className="text-xs text-gray-600">{req.method} {req.url}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Base de données */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-500" />
                Base de données
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Requêtes totales</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.database.queries.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Requêtes lentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{metrics.database.slowQueries.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Erreurs DB</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.database.errors}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
