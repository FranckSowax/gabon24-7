'use client';

import React, { useState, useEffect } from 'react';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Event {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  url: string;
  published_at: string;
  location?: string;
  date?: string;
}

interface EventsSliderProps {
  className?: string;
}

const EventsSlider: React.FC<EventsSliderProps> = ({ className = '' }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch events from API
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Pré-vérification rapide
        try {
          const health = await fetch(`${API_URL}/api/events?health=1&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
          if (!health.ok) throw new Error('health not ok')
        } catch {
          // Fallback cache local
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

        const response = await fetch(`${API_URL}/api/events`);
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des événements');
        }
        
        const data = await response.json();
        const list = data.events || []
        setEvents(list);
        try { if (typeof window !== 'undefined') localStorage.setItem('events_cache', JSON.stringify(list)) } catch {}
      } catch (err) {
        console.error('Erreur chargement événements:', err);
        // dernier fallback: cache si dispo
        try {
          const cached = typeof window !== 'undefined' ? localStorage.getItem('events_cache') : null
          if (cached) {
            const parsed = JSON.parse(cached)
            setEvents(parsed)
            setLoading(false)
            return
          }
        } catch {}
        setError('Impossible de charger les événements');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Auto-slide every 8 seconds
  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === events.length - 1 ? 0 : prevIndex + 1
      );
    }, 8000);

    return () => clearInterval(interval);
  }, [events.length]);

  const nextSlide = () => {
    setCurrentIndex(currentIndex === events.length - 1 ? 0 : currentIndex + 1);
  };

  const prevSlide = () => {
    setCurrentIndex(currentIndex === 0 ? events.length - 1 : currentIndex - 1);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Date à confirmer';
    }
  };

  const extractImageFromDescription = (description: string): string | null => {
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    return imgMatch ? imgMatch[1] : null;
  };

  const cleanDescription = (description: string): string => {
    // Remove HTML tags and get first 100 characters
    const cleaned = description.replace(/<[^>]*>/g, '').trim();
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || events.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Événements</h3>
        </div>
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            {error || 'Aucun événement disponible'}
          </p>
        </div>
      </div>
    );
  }

  const currentEvent = events[currentIndex];
  const eventImage = currentEvent.image_url || extractImageFromDescription(currentEvent.description);
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
  const proxiedEventImage = eventImage && shouldProxyImage(eventImage)
    ? `${API_URL}/api/image-proxy?url=${encodeURIComponent(eventImage)}&title=${encodeURIComponent(currentEvent.title || '')}`
    : eventImage

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Événements</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevSlide}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Événement précédent"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={nextSlide}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Événement suivant"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Event Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4"
          >
            {/* Event Image */}
            {proxiedEventImage && (
              <div className="aspect-[3/4] mb-4 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={proxiedEventImage}
                  alt={currentEvent.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Event Info */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
                {currentEvent.title}
              </h4>

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{formatDate(currentEvent.published_at)}</span>
                </div>
                
                {currentEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{currentEvent.location}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {cleanDescription(currentEvent.description)}
              </p>

              <a
                href={currentEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Voir l'événement
              </a>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination Dots */}
        {events.length > 1 && (
          <div className="flex justify-center gap-1 pb-4">
            {events.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex 
                    ? 'bg-green-600' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Aller à l'événement ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsSlider;
