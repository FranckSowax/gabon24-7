'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Headphones, Clock, PlayCircle, Volume2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AudioSummary {
  id: string
  time_slot?: string
  articles_count: number
  text_summary?: string
  audio_url?: string
  audio_duration_seconds?: number
  status: string
  created_at: string
}

const TIME_SLOT_LABELS: Record<string, { emoji: string; label: string }> = {
  morning: { emoji: '🌅', label: 'Résumé du matin' },
  afternoon: { emoji: '☀️', label: 'Résumé de l\'après-midi' },
  evening: { emoji: '🌙', label: 'Résumé du soir' }
}

const LANGUAGE_LABELS: Record<string, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇺🇸', label: 'English' },
  zh: { flag: '🇨🇳', label: '中文' }
}

export default function AudioSummaryWidget() {
  const [latestSummary, setLatestSummary] = useState<AudioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr')

  useEffect(() => {
    fetchLatestSummary()
  }, [selectedLanguage])

  async function fetchLatestSummary() {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/audio/latest-public?language=${selectedLanguage}`)
      const data = await res.json()
      
      if (data.success && data.summary) {
        setLatestSummary(data.summary)
      }
    } catch (error) {
      console.error('Erreur chargement résumé audio:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24)
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`
    } else if (diffHours > 0) {
      return `Il y a ${diffHours}h`
    } else if (diffMins > 0) {
      return `Il y a ${diffMins} min`
    } else {
      return 'À l\'instant'
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-6 animate-pulse">
        <div className="h-6 bg-blue-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-blue-200 rounded w-3/4"></div>
      </div>
    )
  }

  if (!latestSummary) {
    return null
  }

  const timeSlotInfo = latestSummary.time_slot 
    ? TIME_SLOT_LABELS[latestSummary.time_slot] 
    : { emoji: '📻', label: 'Résumé audio' }

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-6 mb-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Headphones className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {timeSlotInfo.emoji} {timeSlotInfo.label}
            </h3>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatTimeAgo(latestSummary.created_at)}
            </p>
          </div>
        </div>
        
        <Link 
          href="/audio/daily"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          Voir tous
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Sélecteur de langue */}
      <div className="flex gap-2 mb-4">
        {Object.entries(LANGUAGE_LABELS).map(([lang, info]) => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(lang)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedLanguage === lang
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{info.flag}</span>
            <span>{info.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 mb-4">
        <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
          {latestSummary.text_summary?.substring(0, 200)}...
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Volume2 className="w-4 h-4" />
            {latestSummary.articles_count} articles analysés
          </span>
          {latestSummary.audio_duration_seconds && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              ~{Math.round(latestSummary.audio_duration_seconds / 60)} min
            </span>
          )}
        </div>

        {latestSummary.audio_url ? (
          <Link
            href={`/audio/daily?play=${latestSummary.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all"
          >
            <PlayCircle className="w-5 h-5" />
            Écouter
          </Link>
        ) : (
          <Link
            href={`/audio/daily`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors"
          >
            Lire le résumé
          </Link>
        )}
      </div>
    </div>
  )
}
