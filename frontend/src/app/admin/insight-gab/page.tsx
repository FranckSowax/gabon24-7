'use client'

import React, { useState, useEffect } from 'react'
import { Bot, RefreshCw, Database, FileText, CheckCircle, AlertCircle, Loader2, Clock, Activity, Key, Sparkles } from 'lucide-react'

interface SyncStatus {
  lastSyncedAt: string | null
  articlesCount: number
  enrichedArticlesCount: number
  storeStatus: 'active' | 'inactive' | 'unknown'
  geminiConfigured: boolean
}

export default function InsightGabAdminPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncedAt: null,
    articlesCount: 0,
    enrichedArticlesCount: 0,
    storeStatus: 'unknown',
    geminiConfigured: false
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
          enrichedArticlesCount: data.enrichedArticlesCount || 0,
          storeStatus: data.storeStatus || 'unknown',
          geminiConfigured: data.geminiConfigured || false
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
        setSyncResult({ success: true, message: data.message || 'Synchronisation lancee avec succes' })
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
      <div className="flex items-center justify-between flex-wrap gap-4">
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

      {/* Gemini API Key Warning */}
      {!isLoading && !syncStatus.geminiConfigured && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <strong>GEMINI_API_KEY non configuree !</strong>
            <p className="text-sm mt-1">Ajoutez la variable d'environnement GEMINI_API_KEY dans Railway pour activer le chatbot.</p>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gemini API Status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-yellow-600" />
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              syncStatus.geminiConfigured
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {syncStatus.geminiConfigured ? 'OK' : 'Manquant'}
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">API Gemini</h3>
          <p className="text-xs text-gray-500 mt-1">Cle API configuree</p>
        </div>

        {/* Store Status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
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
          <h3 className="text-base font-semibold text-gray-900">Store Supabase</h3>
          <p className="text-xs text-gray-500 mt-1">Base de donnees</p>
        </div>

        {/* Articles Count */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : syncStatus.articlesCount.toLocaleString()}
          </h3>
          <p className="text-xs text-gray-500 mt-1">Articles totaux</p>
        </div>

        {/* Enriched Articles */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {isLoading ? '-' : syncStatus.enrichedArticlesCount.toLocaleString()}
          </h3>
          <p className="text-xs text-gray-500 mt-1">Articles enrichis IA</p>
        </div>
      </div>

      {/* Last Sync Info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Derniere synchronisation</h3>
            <p className="text-lg font-semibold text-gray-900">
              {isLoading ? '-' : syncStatus.lastSyncedAt
                ? new Date(syncStatus.lastSyncedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Jamais synchronise'
              }
            </p>
          </div>
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
            <p><strong>Recherche dans Supabase</strong> : Les articles enrichis par l'IA (keywords, category, summary_ai) sont recherches en fonction de la question.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-xs">2</span>
            </div>
            <p><strong>Scoring intelligent</strong> : Les articles sont classes par pertinence (keywords, importance, recence, breaking news).</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 font-bold text-xs">3</span>
            </div>
            <p><strong>Generation de reponse</strong> : Gemini 1.5 Flash genere une reponse basee sur le contexte des articles.</p>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Informations techniques</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Modele :</span>
            <span className="ml-2 font-medium text-gray-900">Gemini 1.5 Flash</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Type :</span>
            <span className="ml-2 font-medium text-gray-900">Supabase + Gemini RAG</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Colonnes IA :</span>
            <span className="ml-2 font-medium text-gray-900">keywords, summary_ai, importance, sentiment</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Articles/requete :</span>
            <span className="ml-2 font-medium text-gray-900">8 max (scoring)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
