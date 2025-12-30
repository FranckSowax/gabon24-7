'use client'

import { useState, useEffect } from 'react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import axios from 'axios'

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
}

export default function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Récupérer les événements depuis l'API (avec pré-vérification & cache)
  const fetchEvents = async () => {
    try {
      console.log('🎉 Récupération des événements...')
      // Pré-vérification rapide pour éviter d'attendre une fonction froide
      try {
        await axios.get(`${API_URL}/api/events?health=1&_t=${Date.now()}`, { timeout: 4000 })
      } catch {
        // Fallback instantané: utiliser cache local s'il existe
        try {
          const cached = typeof window !== 'undefined' ? localStorage.getItem('events_cache') : null
          if (cached) {
            const parsed = JSON.parse(cached)
            setEvents(parsed)
            setLoading(false)
            return
          }
        } catch {}
        setLoading(false)
        return
      }

      const response = await axios.get(`${API_URL}/api/events`)
      
      if (response.data.success && response.data.events) {
        // Adapter les données du nouveau format API
        const adaptedEvents = response.data.events.map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          eventDate: event.published_at,
          location: event.location || 'Lieu à confirmer',
          url: event.url,
          imageUrl: event.image_url || extractImageFromDescription(event.description),
          category: 'Événement',
          organizer: 'Eventime.ga',
          formattedDate: formatEventDate(event.published_at)
        }));
        setEvents(adaptedEvents)
        try { if (typeof window !== 'undefined') localStorage.setItem('events_cache', JSON.stringify(adaptedEvents)) } catch {}
        console.log(`✅ ${adaptedEvents.length} événements chargés`)
      } else {
        console.warn('⚠️ Aucun événement trouvé')
        setEvents([])
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des événements:', error)
      // Dernier fallback: cache local s'il existe
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('events_cache') : null
        if (cached) {
          const parsed = JSON.parse(cached)
          setEvents(parsed)
          setLoading(false)
          return
        }
      } catch {}
      setError('Impossible de charger les événements')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  // Charger les événements au montage du composant
  useEffect(() => {
    fetchEvents()
  }, [])

  // Auto-slide toutes les 8 secondes
  useEffect(() => {
    if (events.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === events.length - 1 ? 0 : prevIndex + 1
      )
    }, 8000)

    return () => clearInterval(interval)
  }, [events.length])

  // Navigation manuelle
  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const goToNext = () => {
    setCurrentIndex(currentIndex === events.length - 1 ? 0 : currentIndex + 1)
  }

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? events.length - 1 : currentIndex - 1)
  }

  // Fonction pour extraire l'image depuis la description
  const extractImageFromDescription = (description: string): string | null => {
    if (!description) return null;
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    return imgMatch ? imgMatch[1] : null;
  }

  // Fonction pour formater la date
  const formatEventDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Date à confirmer';
    }
  }

  // Ouvrir l'événement sur eventime.ga
  const openEvent = (event: Event) => {
    window.open(event.url, '_blank')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="text-orange-500 mr-2">🎉</span>
          Événements à venir
        </h3>
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-3"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error || events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="text-orange-500 mr-2">🎉</span>
          Événements à venir
        </h3>
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📅</div>
          <p className="text-gray-500 text-sm">
            {error || 'Aucun événement à venir pour le moment'}
          </p>
          <button 
            onClick={fetchEvents}
            className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium"
          >
            Actualiser
          </button>
        </div>
      </div>
    )
  }

  const currentEvent = events[currentIndex]
  const shouldProxyImage = (url?: string) => {
    if (!url) return false
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return false
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon-insight.netlify.app')
      const isSameOrigin = typeof window !== 'undefined' && u.hostname === window.location.hostname
      return !isSameOrigin
    } catch {
      return false
    }
  }
  const eventImageSrc = currentEvent?.imageUrl
  const proxiedEventImage = eventImageSrc && shouldProxyImage(eventImageSrc)
    ? `${API_URL}/api/image-proxy?url=${encodeURIComponent(eventImageSrc)}&title=${encodeURIComponent(currentEvent?.title || '')}`
    : eventImageSrc

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <span className="text-orange-500 mr-2">🎉</span>
        Événements à venir
      </h3>

      <div className="relative">
        {/* Slider principal */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 min-h-[200px]">
          <div className="p-4">
            {/* Image de l'événement */}
            {proxiedEventImage && (
              <div className="mb-3">
                <img 
                  src={proxiedEventImage} 
                  alt={currentEvent.title}
                  className="w-full h-60 object-cover rounded-lg aspect-[3/4]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Catégorie */}
            <div className="mb-2">
              <span className="inline-block bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                {currentEvent.category}
              </span>
            </div>

            {/* Titre */}
            <h4 className="font-bold text-gray-800 text-sm mb-2 line-clamp-2 leading-tight">
              {currentEvent.title}
            </h4>

            {/* Date et lieu */}
            <div className="text-xs text-gray-600 mb-2">
              <div className="flex items-center mb-1">
                <span className="mr-1">📅</span>
                <span className="truncate">{currentEvent.formattedDate}</span>
              </div>
              {currentEvent.location && (
                <div className="flex items-center">
                  <span className="mr-1">📍</span>
                  <span className="truncate">{currentEvent.location}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {currentEvent.description && (
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                {currentEvent.description}
              </p>
            )}

            {/* Bouton d'action */}
            <button
              onClick={() => openEvent(currentEvent)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <span className="mr-2">🔗</span>
              Voir sur Eventime.ga
            </button>
          </div>
        </div>

        {/* Navigation */}
        {events.length > 1 && (
          <>
            {/* Indicateurs de pagination */}
            <div className="flex justify-center mt-3 space-x-2">
              {events.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentIndex 
                      ? 'bg-orange-500 w-4' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Aller à l'événement ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Compteur d'événements */}
        {events.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {currentIndex + 1}/{events.length}
          </div>
        )}
      </div>

      {/* Lien vers tous les événements */}
      <div className="mt-4 text-center">
        <a 
          href="https://eventime.ga" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-orange-500 hover:text-orange-600 text-sm font-medium transition-colors duration-200"
        >
          Voir tous les événements →
        </a>
      </div>
    </div>
  )
}
