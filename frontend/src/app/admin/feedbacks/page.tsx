'use client'

import { useState, useEffect } from 'react'
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Star, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Filter,
  User,
  Mail,
  Calendar,
  MoreVertical,
  Check,
  Eye
} from 'lucide-react'

interface Feedback {
  id: string
  user_id: string | null
  type: string
  message: string
  rating: number | null
  status: string
  created_at: string
  updated_at: string
  users?: {
    email: string
    full_name: string
    avatar_url: string
  } | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  general: { label: 'Avis général', icon: MessageSquare, color: 'bg-blue-100 text-blue-600' },
  bug: { label: 'Bug signalé', icon: Bug, color: 'bg-red-100 text-red-600' },
  feature: { label: 'Suggestion', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-600' }
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  reviewed: { label: 'Examiné', color: 'bg-blue-100 text-blue-700', icon: Eye },
  resolved: { label: 'Résolu', color: 'bg-green-100 text-green-700', icon: CheckCircle }
}

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/feedback`)
      const data = await response.json()
      if (data.success) {
        setFeedbacks(data.feedbacks || [])
      }
    } catch (error) {
      console.error('Erreur chargement feedbacks:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFeedbacks()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchFeedbacks()
  }

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id)
    try {
      const response = await fetch(`${API_URL}/api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await response.json()
      if (data.success) {
        setFeedbacks(prev => 
          prev.map(f => f.id === id ? { ...f, status: newStatus } : f)
        )
      }
    } catch (error) {
      console.error('Erreur mise à jour statut:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredFeedbacks = feedbacks.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false
    if (filterType !== 'all' && f.type !== filterType) return false
    return true
  })

  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter(f => f.status === 'pending').length,
    reviewed: feedbacks.filter(f => f.status === 'reviewed').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedbacks Utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les retours et suggestions des utilisateurs</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Examinés</p>
              <p className="text-2xl font-bold text-blue-600">{stats.reviewed}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Résolus</p>
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-gray-100">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="reviewed">Examinés</option>
          <option value="resolved">Résolus</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">Tous les types</option>
          <option value="general">Avis général</option>
          <option value="bug">Bug signalé</option>
          <option value="feature">Suggestion</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {filteredFeedbacks.length} résultat(s)
        </span>
      </div>

      {/* Feedbacks List */}
      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun feedback</h3>
            <p className="text-gray-500">Aucun feedback ne correspond à vos critères de filtrage.</p>
          </div>
        ) : (
          filteredFeedbacks.map((feedback) => {
            const typeInfo = typeConfig[feedback.type] || typeConfig.general
            const statusInfo = statusConfig[feedback.status] || statusConfig.pending
            const TypeIcon = typeInfo.icon
            const StatusIcon = statusInfo.icon

            return (
              <div
                key={feedback.id}
                className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 lg:w-48 flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                      {feedback.users?.full_name?.[0] || feedback.users?.email?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {feedback.users?.full_name || 'Utilisateur'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {feedback.users?.email || 'Anonyme'}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        <TypeIcon className="w-3 h-3 mr-1" />
                        {typeInfo.label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </span>
                      {feedback.rating && (
                        <span className="inline-flex items-center text-xs text-gray-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < feedback.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{feedback.message}</p>
                    <p className="text-xs text-gray-400 mt-2 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(feedback.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 lg:flex-shrink-0">
                    {feedback.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(feedback.id, 'reviewed')}
                        disabled={updatingId === feedback.id}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {updatingId === feedback.id ? '...' : 'Marquer examiné'}
                      </button>
                    )}
                    {feedback.status === 'reviewed' && (
                      <button
                        onClick={() => updateStatus(feedback.id, 'resolved')}
                        disabled={updatingId === feedback.id}
                        className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {updatingId === feedback.id ? '...' : 'Marquer résolu'}
                      </button>
                    )}
                    {feedback.status === 'resolved' && (
                      <span className="px-3 py-1.5 text-xs font-medium text-green-600 flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Traité
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
