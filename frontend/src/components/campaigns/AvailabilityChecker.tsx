'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react'

interface AvailabilityCheckerProps {
  campaignType: string
  startDate: string
  durationDays: number
  onAvailabilityChange?: (available: boolean) => void
}

interface AvailabilityData {
  available: boolean
  limit: number | null
  current_count: number
  remaining: number
  message: string
  conflicting_campaigns?: Array<{
    id: string
    name: string
    start_date: string
    end_date: string
  }>
}

export default function AvailabilityChecker({
  campaignType,
  startDate,
  durationDays,
  onAvailabilityChange
}: AvailabilityCheckerProps) {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  useEffect(() => {
    if (startDate && durationDays > 0) {
      checkAvailability()
    }
  }, [campaignType, startDate, durationDays])

  const checkAvailability = async () => {
    try {
      setLoading(true)
      setError(null)

      // Calculer end_date
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(end.getDate() + durationDays)

      const response = await fetch(
        `${API_URL}/api/campaigns/availability?campaign_type=${campaignType}&start_date=${start.toISOString()}&end_date=${end.toISOString()}`
      )

      if (response.ok) {
        const data = await response.json()
        setAvailability(data)
        onAvailabilityChange?.(data.available)
      } else {
        setError('Erreur lors de la vérification')
      }
    } catch (err) {
      console.error('Erreur vérification disponibilité:', err)
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  if (!startDate || durationDays <= 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-5 h-5" />
          <span className="text-sm">Sélectionnez une date de début et une durée pour vérifier la disponibilité</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm text-blue-700">Vérification de la disponibilité...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      </div>
    )
  }

  if (!availability) {
    return null
  }

  // Illimité
  if (availability.limit === null) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-900">♾️ Aucune limite pour ce type de campagne</p>
            <p className="text-xs text-green-700 mt-1">Vous pouvez créer autant de campagnes que vous le souhaitez</p>
          </div>
        </div>
      </div>
    )
  }

  // Disponible
  if (availability.available) {
    return (
      <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-900 mb-1">
              ✅ Créneau disponible!
            </p>
            <p className="text-xs text-green-700 mb-2">
              {availability.remaining} créneau{availability.remaining > 1 ? 'x' : ''} disponible{availability.remaining > 1 ? 's' : ''} sur {availability.limit}
            </p>
            
            {availability.current_count > 0 && (
              <div className="bg-white rounded p-2 text-xs">
                <p className="text-gray-600">
                  📊 <strong>{availability.current_count}</strong> campagne{availability.current_count > 1 ? 's' : ''} déjà active{availability.current_count > 1 ? 's' : ''} pour cette période
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Non disponible
  return (
    <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-900 mb-1">
            ❌ Créneau non disponible
          </p>
          <p className="text-xs text-red-700 mb-3">
            Limite atteinte: <strong>{availability.current_count}/{availability.limit}</strong> campagnes actives pour cette période
          </p>

          {availability.conflicting_campaigns && availability.conflicting_campaigns.length > 0 && (
            <div className="bg-white rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-900 mb-2">
                📅 Campagnes en conflit:
              </p>
              {availability.conflicting_campaigns.map((campaign) => (
                <div key={campaign.id} className="text-xs bg-gray-50 rounded p-2">
                  <p className="font-semibold text-gray-900">{campaign.name}</p>
                  <p className="text-gray-600 mt-1">
                    Du {new Date(campaign.start_date).toLocaleDateString('fr-FR')} au{' '}
                    {new Date(campaign.end_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
            <p className="text-xs text-yellow-800">
              💡 <strong>Conseil:</strong> Choisissez une autre date de début ou réduisez la durée de la campagne
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
