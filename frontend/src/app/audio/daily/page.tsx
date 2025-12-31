'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { Headphones, PlayCircle, Clock, Calendar, Sparkles, ArrowRight, Volume2, PauseCircle, RefreshCw } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AudioSummary {
  id: string
  summary_type: 'daily' | 'custom'
  time_slot?: string
  language?: string
  article_ids: string[]
  articles_count: number
  text_summary?: string
  audio_url?: string
  audio_duration_seconds?: number
  status: string
  created_at: string
}

const TIME_SLOT_LABELS: Record<string, { emoji: string; label: string; bgColor: string }> = {
  morning: { emoji: '🌅', label: 'Résumé du matin', bgColor: 'from-orange-100 to-yellow-100' },
  afternoon: { emoji: '☀️', label: 'Résumé de l\'après-midi', bgColor: 'from-blue-100 to-cyan-100' },
  evening: { emoji: '🌙', label: 'Résumé du soir', bgColor: 'from-indigo-100 to-purple-100' }
}

const LANGUAGE_LABELS: Record<string, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇺🇸', label: 'English' },
  zh: { flag: '🇨🇳', label: '中文' }
}

export default function AudioDailyPage() {
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Protection de la page
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signin?redirect=/audio/daily')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [user, subscriptionPlan, authLoading, router])

  if (authLoading || !user || subscriptionPlan?.slug !== 'pro') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr')
  const [currentSummary, setCurrentSummary] = useState<AudioSummary | null>(null)
  const [history, setHistory] = useState<AudioSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Charger le dernier résumé pour la langue sélectionnée
  async function fetchLatestSummary() {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/audio/latest-public?language=${selectedLanguage}`)
      const data = await res.json()
      
      if (data.success && data.summary) {
        setCurrentSummary(data.summary)
      } else {
        setCurrentSummary(null)
      }
    } catch (error) {
      console.error('Erreur chargement résumé:', error)
      setCurrentSummary(null)
    } finally {
      setLoading(false)
    }
  }

  // Charger les 3 derniers résumés de la langue sélectionnée
  async function fetchHistory() {
    try {
      setLoadingHistory(true)
      const res = await fetch(`${API_URL}/api/audio/public?language=${selectedLanguage}&limit=3`)
      const data = await res.json()
      
      if (data.success) {
        // Exclure le résumé actuel de l'historique
        const filtered = (data.summaries || []).filter((s: AudioSummary) => 
          currentSummary ? s.id !== currentSummary.id : true
        )
        setHistory(filtered.slice(0, 3))
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchLatestSummary()
  }, [selectedLanguage])

  useEffect(() => {
    if (currentSummary) {
      fetchHistory()
    }
  }, [currentSummary, selectedLanguage])

  // Gestion du lecteur audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentSummary])

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
  }

  const timeSlotInfo = currentSummary?.time_slot && TIME_SLOT_LABELS[currentSummary.time_slot]
    ? TIME_SLOT_LABELS[currentSummary.time_slot] 
    : { emoji: '📻', label: 'Résumé audio', bgColor: 'from-gray-100 to-gray-200' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 lg:ml-64 pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* En-tête avec bouton personnalisé */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-md border border-blue-200 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium text-sm">Résumés Audio Quotidiens</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                  Édition du Jour
                </h1>
                <p className="text-gray-600 mt-2">Restez informé avec nos résumés automatiques - 7h, 13h et 20h</p>
              </div>

              <Link
                href="/audio/custom"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
              >
                <Sparkles className="w-5 h-5" />
                <span>Résumé Personnalisé</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Bouton mobile pour résumé personnalisé */}
            <Link
              href="/audio/custom"
              className="sm:hidden flex items-center justify-center gap-2 w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium shadow-lg mb-6"
            >
              <Sparkles className="w-5 h-5" />
              <span>Créer un résumé personnalisé</span>
            </Link>

            {/* Sélecteur de langue */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-200 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Choisir la langue :</label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(LANGUAGE_LABELS).map(([lang, info]) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedLanguage === lang
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-105'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{info.flag}</span>
                    <span className="text-sm sm:text-base">{info.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lecteur audio principal */}
            {loading ? (
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-200 mb-6">
                <div className="flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              </div>
            ) : currentSummary ? (
              <div className={`bg-gradient-to-br ${timeSlotInfo.bgColor} rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 mb-6`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{timeSlotInfo.emoji}</span>
                      <h2 className="text-2xl font-bold text-gray-900">{timeSlotInfo.label}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatTimeAgo(currentSummary.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-4 h-4" />
                        {currentSummary.articles_count} articles analysés
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={fetchLatestSummary}
                    className="p-3 bg-white/80 hover:bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
                    title="Actualiser"
                  >
                    <RefreshCw className="w-5 h-5 text-gray-700" />
                  </button>
                </div>

                {/* Lecteur audio */}
                {currentSummary.audio_url ? (
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <audio ref={audioRef} src={currentSummary.audio_url} preload="metadata" className="hidden" />
                    
                    {/* Contrôles */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlay}
                        className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
                      >
                        {isPlaying ? (
                          <PauseCircle className="w-7 h-7 sm:w-8 sm:h-8" />
                        ) : (
                          <PlayCircle className="w-7 h-7 sm:w-8 sm:h-8" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span>{formatDuration(currentTime)}</span>
                          <span>{formatDuration(duration || currentSummary.audio_duration_seconds || 0)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={duration || currentSummary.audio_duration_seconds || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                    <p className="text-yellow-800 text-sm">
                      📝 Résumé textuel disponible • Audio en cours de génération...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-200 mb-6 text-center">
                <div className="text-6xl mb-4">🎙️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun résumé disponible</h3>
                <p className="text-gray-600">
                  Les résumés audio sont générés automatiquement à 7h, 13h et 20h.
                  <br />
                  Revenez bientôt ou créez un résumé personnalisé !
                </p>
                <Link
                  href="/audio/custom"
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium shadow-lg"
                >
                  <Sparkles className="w-5 h-5" />
                  Créer un résumé personnalisé
                </Link>
              </div>
            )}

            {/* Historique des 3 derniers résumés */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Résumés récents</h2>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                </div>
              ) : history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun historique disponible pour cette langue.</p>
              ) : (
                <div className="grid gap-4">
                  {history.map((summary) => {
                    const timeSlot = summary.time_slot && TIME_SLOT_LABELS[summary.time_slot] ? TIME_SLOT_LABELS[summary.time_slot] : null
                    return (
                      <div
                        key={summary.id}
                        className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {timeSlot && <span className="text-2xl">{timeSlot.emoji}</span>}
                              <h3 className="font-semibold text-gray-900">
                                {timeSlot?.label || 'Résumé audio'}
                              </h3>
                            </div>
                            <p className="text-sm text-gray-600">
                              {formatTimeAgo(summary.created_at)} • {summary.articles_count} articles
                            </p>
                          </div>

                          {summary.audio_duration_seconds && (
                            <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                              ⏱️ {Math.round(summary.audio_duration_seconds / 60)} min
                            </span>
                          )}
                        </div>

                        {summary.audio_url && (
                          <audio controls src={summary.audio_url} className="w-full" preload="none">
                            Votre navigateur ne supporte pas l'élément audio.
                          </audio>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <ScrollToTop />
    </div>
  )
}
