'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Activity, AlertCircle, CheckCircle, Clock, Database, Rss } from 'lucide-react'

interface SyncStats {
  totalFeeds: number
  processed: number
  newArticles: number
  timestamp: string
  results: Array<{
    feedName: string
    newArticles: number
    status: 'success' | 'error'
    error?: string
  }>
}

interface FeedStatus {
  id: string
  name: string
  url: string
  last_sync: string
  status: 'active' | 'error' | 'inactive'
  articles_count: number
  error_message?: string
}

export default function RSSMonitoringPage() {
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [feedsStatus, setFeedsStatus] = useState<FeedStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchMonitoringData = async () => {
    try {
      // Récupérer les statistiques de synchronisation
      const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rss/monitor`)
      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        setFeedsStatus(stats.feeds || [])
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erreur lors du chargement des données de monitoring:', error)
    } finally {
      setLoading(false)
    }
  }

  const runManualSync = async () => {
    setSyncing(true)
    try {
      // Lancer une synchronisation complète par batch
      let offset = 0
      let totalNewArticles = 0
      const allResults: any[] = []

      while (true) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rss/sync-batch?offset=${offset}`)
        if (!response.ok) break

        const batch = await response.json()
        totalNewArticles += batch.totalNewArticles || 0
        allResults.push(...(batch.results || []))

        if (!batch.batch?.hasMoreBatches) break
        offset = batch.batch.nextOffset || offset + 2
      }

      setSyncStats({
        totalFeeds: allResults.length,
        processed: allResults.length,
        newArticles: totalNewArticles,
        timestamp: new Date().toISOString(),
        results: allResults
      })

      // Rafraîchir les données
      await fetchMonitoringData()
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchMonitoringData()
    
    // Auto-refresh toutes les 5 minutes
    const interval = setInterval(fetchMonitoringData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'error': return 'text-red-600 bg-red-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      case 'inactive': return <Clock className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-orange-600 mb-4" />
            <p className="text-gray-600">Chargement des données de monitoring...</p>
          </div>
        </div>
      </div>
    )
  }

  const activeFeeds = feedsStatus.filter(f => f.status === 'active').length
  const errorFeeds = feedsStatus.filter(f => f.status === 'error').length
  const totalArticles = feedsStatus.reduce((sum, f) => sum + f.articles_count, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Monitoring RSS</h1>
              <p className="text-gray-600">
                Dernière mise à jour: {lastUpdate.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={fetchMonitoringData}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Actualiser</span>
              </button>
              <button
                onClick={runManualSync}
                disabled={syncing}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                <Rss className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Synchronisation...' : 'Sync Manuel'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Flux</p>
                <p className="text-2xl font-bold text-gray-900">{feedsStatus.length}</p>
              </div>
              <Rss className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Flux Actifs</p>
                <p className="text-2xl font-bold text-green-600">{activeFeeds}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Flux en Erreur</p>
                <p className="text-2xl font-bold text-red-600">{errorFeeds}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Articles</p>
                <p className="text-2xl font-bold text-blue-600">{totalArticles.toLocaleString()}</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Dernière Synchronisation */}
        {syncStats && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Dernière Synchronisation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Flux Traités</p>
                <p className="text-2xl font-bold text-blue-600">{syncStats.processed}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Nouveaux Articles</p>
                <p className="text-2xl font-bold text-green-600">{syncStats.newArticles}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Timestamp</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(syncStats.timestamp).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>

            {/* Résultats par flux */}
            {syncStats.results.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Résultats par Flux</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {syncStats.results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{result.feedName}</p>
                        <p className="text-xs text-gray-600">{result.newArticles} nouveaux articles</p>
                      </div>
                      <div className={`p-1 rounded-full ${result.status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {result.status === 'success' ? 
                          <CheckCircle className="w-4 h-4 text-green-600" /> : 
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Liste des Flux */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">État des Flux RSS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flux
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Articles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dernière Sync
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Erreur
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feedsStatus.map((feed) => (
                  <tr key={feed.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{feed.name}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{feed.url}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feed.status)}`}>
                        {getStatusIcon(feed.status)}
                        {feed.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {feed.articles_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {feed.last_sync ? new Date(feed.last_sync).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {feed.error_message && (
                        <div className="max-w-xs truncate" title={feed.error_message}>
                          {feed.error_message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
