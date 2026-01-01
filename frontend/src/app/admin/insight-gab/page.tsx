'use client'

import React, { useState, useEffect } from 'react'
import { Bot, RefreshCw, Database, FileText, CheckCircle, AlertCircle, Loader2, Play, Clock, Activity } from 'lucide-react'

interface SyncStatus {
  lastSyncedAt: string | null
  articlesCount: number
  storeStatus: 'active' | 'inactive' | 'unknown'
}

export default function InsightGabAdminPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncedAt: null,
    articlesCount: 0,
    storeStatus: 'unknown'
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/insight-gab/status`)
      if (response.ok) {
        const data = await response.json()
        setSyncStatus({
          lastSyncedAt: data.lastSyncedAt || null,
          articlesCount: data.articlesCount || 0,
          storeStatus: data.storeStatus || 'unknown'
        })
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Trigger sync
  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/insight-gab/sync`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setSyncResult({ success: true, message: data.message || 'Synchronisation lancée avec succès' })
        // Refresh status after a delay
        setTimeout(fetchStatus, 3000)
      } else {
        setSyncResult({ success: false, message: data.error || 'Erreur lors de la synchronisation' })
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncResult({ success: false, message: 'Impossible de contacter le serveur' })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insight Gab RAG</h1>
            <p className="text-gray-500 text-sm">Gestion de la base de connaissances IA</p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
          <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
        </button>
      </div>

      {/* Sync Result Alert */}
      {syncResult && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          syncResult.success
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {syncResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span>{syncResult.message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Store Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              syncStatus.storeStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : syncStatus.storeStatus === 'inactive'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
            }`}>
              {syncStatus.storeStatus === 'active' ? 'Actif' : syncStatus.storeStatus === 'inactive' ? 'Inactif' : 'Inconnu'}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Store Gemini</h3>
          <p className="text-sm text-gray-500 mt-1">Base de connaissances RAG</p>
        </div>

        {/* Articles Count */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-gray-900">
            {isLoading ? '-' : syncStatus.articlesCount.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-500 mt-1">Articles indexés</p>
        </div>

        {/* Last Sync */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {isLoading ? '-' : syncStatus.lastSyncedAt
              ? new Date(syncStatus.lastSyncedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Jamais'
            }
          </h3>
          <p className="text-sm text-gray-500 mt-1">Dernière synchronisation</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Comment fonctionne Insight Gab ?
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-xs">1</span>
            </div>
            <p><strong>Indexation des articles</strong> : Les articles de Gabon 24/7 sont régulièrement synchronisés vers un FileSearchStore Gemini.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-xs">2</span>
            </div>
            <p><strong>Recherche sémantique</strong> : Quand un utilisateur pose une question, Gemini recherche les articles pertinents dans la base.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-xs">3</span>
            </div>
            <p><strong>Génération de réponse</strong> : L'IA génère une réponse contextualisée basée sur les articles trouvés.</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-white/60 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-2">Actions recommandées :</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Synchroniser après l'ajout de nouveaux articles importants
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Vérifier le statut du store régulièrement
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              La synchronisation automatique se fait lors du traitement RSS
            </li>
          </ul>
        </div>
      </div>

      {/* Technical Info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Informations techniques</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Modèle :</span>
            <span className="ml-2 font-medium text-gray-900">Gemini 1.5 Flash</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Type :</span>
            <span className="ml-2 font-medium text-gray-900">FileSearchStore RAG</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Store :</span>
            <span className="ml-2 font-medium text-gray-900">Gabon24-7 Knowledge Base</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Batch size :</span>
            <span className="ml-2 font-medium text-gray-900">100 articles/sync</span>
          </div>
        </div>
      </div>
    </div>
  )
}
