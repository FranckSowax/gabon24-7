'use client'

import { useState, useEffect } from 'react'
import { Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  budget: number
  views: number
  clicks: number
}

interface CampaignCalendarProps {
  campaignType: 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'
}

const CAMPAIGN_INFO = {
  'banner-home': {
    name: 'Bannière Page d\'Accueil',
    limit: 10,
    icon: '🏠',
    color: 'blue'
  },
  'banner-feed': {
    name: 'Bannière Feed Articles',
    limit: 1,
    icon: '📰',
    color: 'green'
  },
  'video-home': {
    name: 'Vidéo Home',
    limit: 1,
    icon: '🎬',
    color: 'purple'
  },
  'article-trending': {
    name: 'Article Sponsorisé Tendances',
    limit: null,
    icon: '🔥',
    color: 'orange'
  }
}

export default function CampaignCalendar({ campaignType }: CampaignCalendarProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  const info = CAMPAIGN_INFO[campaignType]
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  useEffect(() => {
    loadCampaigns()
  }, [campaignType, selectedMonth])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      
      // Période: 3 mois avant et 3 mois après le mois sélectionné
      const startDate = new Date(selectedMonth)
      startDate.setMonth(startDate.getMonth() - 3)
      
      const endDate = new Date(selectedMonth)
      endDate.setMonth(endDate.getMonth() + 4)

      const response = await fetch(
        `${API_URL}/api/campaigns/calendar/${campaignType}?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
      )

      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Erreur chargement calendrier:', error)
    } finally {
      setLoading(false)
    }
  }

  const changeMonth = (offset: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + offset)
    setSelectedMonth(newDate)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getDaysBetween = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = Math.abs(endDate.getTime() - startDate.getTime())
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { text: 'ACTIF', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending: { text: 'EN ATTENTE', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      rejected: { text: 'REJETÉ', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    }
    
    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    )
  }

  const getColorClass = (color: string) => {
    const colors = {
      blue: 'border-blue-500 bg-blue-50',
      green: 'border-green-500 bg-green-50',
      purple: 'border-purple-500 bg-purple-50',
      orange: 'border-orange-500 bg-orange-50'
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <span className="ml-3 text-gray-600">Chargement du calendrier...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{info.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{info.name}</h2>
              <p className="text-sm text-gray-600">
                {info.limit === null ? (
                  <span className="text-green-600 font-semibold">♾️ Illimité</span>
                ) : (
                  <span>
                    Limite: <strong className="text-orange-600">{info.limit}</strong> campagne{info.limit > 1 ? 's' : ''} simultanée{info.limit > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            ← Mois précédent
          </button>
          <div className="px-4 py-2 bg-gray-100 rounded-lg font-semibold text-gray-900">
            {selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Mois suivant →
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-semibold mb-1">Total campagnes</div>
          <div className="text-2xl font-bold text-blue-900">{campaigns.length}</div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-semibold mb-1">Actives</div>
          <div className="text-2xl font-bold text-green-900">
            {campaigns.filter(c => c.status === 'active').length}
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-600 font-semibold mb-1">En attente</div>
          <div className="text-2xl font-bold text-yellow-900">
            {campaigns.filter(c => c.status === 'pending').length}
          </div>
        </div>
      </div>

      {/* Liste des campagnes */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold mb-1">Aucune campagne pour cette période</p>
          <p className="text-sm text-gray-500">Créez votre première campagne pour commencer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className={`border-l-4 ${getColorClass(info.color)} rounded-lg p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900">{campaign.name}</h3>
                    {getStatusBadge(campaign.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">📅 Début:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {formatDate(campaign.start_date)}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">📅 Fin:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {formatDate(campaign.end_date)}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">⏱️ Durée:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {getDaysBetween(campaign.start_date, campaign.end_date)} jours
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">💰 Budget:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {campaign.budget.toLocaleString()} FCFA
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">👁️ Vues:</span>
                      <span className="ml-2 font-semibold text-blue-600">
                        {campaign.views.toLocaleString()}
                      </span>
                    </div>
                    
                    <div>
                      <span className="text-gray-600">🔗 Clics:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        {campaign.clicks.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
