'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, MapPin, Clock, ChevronLeft, ChevronRight, ExternalLink, Sparkles } from 'lucide-react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import axios from '@/lib/axios'

interface Event {
  id: string
  title: string
  description: string
  eventDate: string
  location: string
  url: string
  imageUrl?: string
  category: string
  organizer: string
  formattedDate: string
  timeUntil?: string
}

export default function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Calculer le temps restant avant l'événement
  const getTimeUntil = (dateString: string): string => {
    try {
      const eventDate = new Date(dateString)
      const now = new Date()
      const diff = eventDate.getTime() - now.getTime()

      if (diff < 0) return 'Événement passé'

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

      if (days > 0) return `Dans ${days}j ${hours}h`
      if (hours > 0) return `Dans ${hours}h`
      return 'Bientôt'
    } catch {
      return ''
    }
  }

  // Récupérer les événements depuis l'API
  const fetchEvents = useCallback(async () => {
    try {
      // Health check rapide
      try {
        await axios.get(`${API_URL}/api/events?health=1&_t=${Date.now()}`, { timeout: 4000 })
      } catch {
        // Fallback: cache local
        const cached = typeof window !== 'undefined' ? localStorage.getItem('events_cache') : null
        if (cached) {
          setEvents(JSON.parse(cached))
          setLoading(false)
          return
        }
        setLoading(false)
        return
      }

      const response = await axios.get(`${API_URL}/api/events`)

      if (response.data.success && response.data.events) {
        const adaptedEvents = response.data.events.map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description?.replace(/<[^>]*>/g, '') || '',
          eventDate: event.published_at,
          location: event.location || 'Libreville, Gabon',
          url: event.url,
          imageUrl: event.image_url || extractImageFromDescription(event.description),
          category: event.category || 'Événement',
          organizer: event.organizer || 'Eventime.ga',
          formattedDate: formatEventDate(event.published_at),
          timeUntil: getTimeUntil(event.published_at)
        }))
        setEvents(adaptedEvents)
        if (typeof window !== 'undefined') {
          localStorage.setItem('events_cache', JSON.stringify(adaptedEvents))
        }
      } else {
        setEvents([])
      }
    } catch (err) {
      console.error('Erreur chargement événements:', err)
      const cached = typeof window !== 'undefined' ? localStorage.getItem('events_cache') : null
      if (cached) {
        setEvents(JSON.parse(cached))
      } else {
        setError('Impossible de charger les événements')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Auto-slide (pause on hover)
  useEffect(() => {
    if (events.length <= 1 || isHovered) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev === events.length - 1 ? 0 : prev + 1))
    }, 6000)

    return () => clearInterval(interval)
  }, [events.length, isHovered])

  const goToSlide = (index: number) => setCurrentIndex(index)
  const goToNext = () => setCurrentIndex(currentIndex === events.length - 1 ? 0 : currentIndex + 1)
  const goToPrevious = () => setCurrentIndex(currentIndex === 0 ? events.length - 1 : currentIndex - 1)

  const extractImageFromDescription = (description: string): string | null => {
    if (!description) return null
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    return imgMatch ? imgMatch[1] : null
  }

  const formatEventDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Date à confirmer'
    }
  }

  const openEvent = (event: Event) => {
    window.open(event.url, '_blank', 'noopener,noreferrer')
  }

  // Proxy image si nécessaire
  const getProxiedImage = (url?: string, title?: string): string => {
    if (!url) return ''
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon24-7.com')
      const isSameOrigin = typeof window !== 'undefined' && u.hostname === window.location.hostname
      if (isSameOrigin) return url
    } catch {}
    return `${API_URL}/api/image-proxy?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || '')}`
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 animate-pulse" />
            <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="aspect-video bg-gray-100 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // État vide ou erreur
  if (error || events.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-gray-900">Événements à venir</h3>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-4">
            {error || 'Aucun événement prévu pour le moment'}
          </p>
          <button
            onClick={fetchEvents}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>
    )
  }

  const currentEvent = events[currentIndex]
  const eventImage = getProxiedImage(currentEvent?.imageUrl, currentEvent?.title)

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-gray-900">Événements à venir</h3>
        </div>
        {events.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevious}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Événement précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 font-medium px-2">
              {currentIndex + 1}/{events.length}
            </span>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Événement suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Image 16:9 */}
      <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-red-100 overflow-hidden">
        {eventImage ? (
          <img
            src={eventImage}
            alt={currentEvent.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/80 flex items-center justify-center mb-2">
                <Calendar className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>
        )}

        {/* Badge countdown */}
        {currentEvent.timeUntil && (
          <div className="absolute top-3 left-3">
            <div className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {currentEvent.timeUntil}
            </div>
          </div>
        )}

        {/* Badge catégorie */}
        <div className="absolute top-3 right-3">
          <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold shadow-lg">
            {currentEvent.category}
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Titre */}
        <h4 className="font-bold text-gray-900 mb-3 line-clamp-2 leading-snug">
          {currentEvent.title}
        </h4>

        {/* Métadonnées */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="truncate">{currentEvent.formattedDate}</span>
          </div>
          {currentEvent.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
              </div>
              <span className="truncate">{currentEvent.location}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {currentEvent.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {currentEvent.description}
          </p>
        )}

        {/* CTA Button */}
        <button
          onClick={() => openEvent(currentEvent)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
        >
          <span>Voir les détails</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Pagination dots */}
      {events.length > 1 && (
        <div className="px-4 pb-4">
          <div className="flex justify-center gap-1.5">
            {events.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-6 bg-gradient-to-r from-orange-500 to-red-500'
                    : 'w-1.5 bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={`Aller à l'événement ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 pb-4 pt-0">
        <a
          href="https://eventime.ga"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors py-2"
        >
          <span>Tous les événements sur Eventime.ga</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
