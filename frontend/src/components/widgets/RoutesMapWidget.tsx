'use client'

// Widget Trafic en temps réel - Modernisé (Dec 2025)
import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, Navigation, Clock, Sun, Moon, Car } from 'lucide-react'

interface Route {
  id: string
  title: string
  subtitle?: string
  embed_url: string
  html_content?: string
  display_order: number
  is_active: boolean
  created_at: string
  category?: 'morning' | 'evening' // Nouvelle catégorie
}

export default function RoutesMapWidget() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // État pour les styles dynamiques basés sur l'heure (évite hydration mismatch)
  const [timeBasedStyles, setTimeBasedStyles] = useState({
    gradient: 'from-teal-50 via-cyan-50 to-sky-50', // Valeur par défaut (jour)
    isNight: false
  })

  useEffect(() => {
    loadRoutes()
  }, [])

  // Défilement automatique toutes les 8 secondes
  useEffect(() => {
    if (routes.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % routes.length
        setSelectedRoute(routes[nextIndex])
        return nextIndex
      })
    }, 8000) // 8 secondes par carte

    return () => clearInterval(interval)
  }, [routes, isPaused])

  // Synchroniser currentIndex avec selectedRoute lors du chargement
  useEffect(() => {
    if (selectedRoute && routes.length > 0) {
      const index = routes.findIndex(r => r.id === selectedRoute.id)
      if (index !== -1 && index !== currentIndex) {
        setCurrentIndex(index)
      }
    }
  }, [selectedRoute, routes])

  // Grouper les itinéraires par catégorie
  const morningRoutes = routes.filter(route => route.category === 'morning')
  const eveningRoutes = routes.filter(route => route.category === 'evening')
  const otherRoutes = routes.filter(route => !route.category)

  const loadRoutes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/routes`)
      const data = await response.json()
      
      if (data.success && data.routes) {
        const activeRoutes = data.routes
          .filter((route: Route) => route.is_active)
          .sort((a: Route, b: Route) => a.display_order - b.display_order)
        setRoutes(activeRoutes)
        if (activeRoutes.length > 0) {
          setSelectedRoute(activeRoutes[0]) // Sélectionner le premier itinéraire par défaut
        }
      } else {
        // Données de démonstration avec différentes catégories
        const demoRoutes = [
          {
            id: '1',
            title: 'Centre-ville → Aéroport',
            subtitle: 'Distance: 15km | Durée estimée: 25 min',
            embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469135780246!2d9.375362!3d0.4698661!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
            display_order: 1,
            is_active: true,
            created_at: new Date().toISOString(),
            category: 'morning' as const
          },
          {
            id: '2', 
            title: 'Owendo → Centre-ville',
            subtitle: 'Distance: 12km | Durée estimée: 20 min',
            embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469135780246!2d9.375362!3d0.4698661!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
            display_order: 2,
            is_active: true,
            created_at: new Date().toISOString(),
            category: 'morning' as const
          },
          {
            id: '3',
            title: 'Aéroport → Centre-ville',
            subtitle: 'Distance: 15km | Durée estimée: 30 min',
            embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469135780246!2d9.375362!3d0.4698661!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
            display_order: 3,
            is_active: true,
            created_at: new Date().toISOString(),
            category: 'evening' as const
          }
        ]
        setRoutes(demoRoutes)
        setSelectedRoute(demoRoutes[0])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des trajets:', error)
      setError('Impossible de charger les trajets')
      // Données de démonstration en cas d'erreur
      const fallbackRoutes = [
        {
          id: '1',
          title: 'Centre-ville → Aéroport',
          subtitle: 'Distance: 15km | Durée estimée: 25 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469135780246!2d9.375362!3d0.4698661!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 1,
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]
      setRoutes(fallbackRoutes)
      setSelectedRoute(fallbackRoutes[0])
    } finally {
      setLoading(false)
    }
  }

  const selectRoute = (route: Route) => {
    setSelectedRoute(route)
    setIsDropdownOpen(false)
    const index = routes.findIndex(r => r.id === route.id)
    if (index !== -1) {
      setCurrentIndex(index)
    }
    // Pause le slider pendant 20 secondes lors d'une sélection manuelle
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 20000)
  }

  const goToNext = () => {
    const nextIndex = (currentIndex + 1) % routes.length
    setCurrentIndex(nextIndex)
    setSelectedRoute(routes[nextIndex])
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 20000)
  }

  const goToPrevious = () => {
    const prevIndex = (currentIndex - 1 + routes.length) % routes.length
    setCurrentIndex(prevIndex)
    setSelectedRoute(routes[prevIndex])
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 20000)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setSelectedRoute(routes[index])
    setIsPaused(true)
    setTimeout(() => setIsPaused(false), 20000)
  }

  // Calcul des styles côté client uniquement (évite hydration mismatch)
  useEffect(() => {
    const updateTimeStyles = () => {
      const hour = new Date().getHours()
      let gradient = 'from-teal-50 via-cyan-50 to-sky-50'
      if (hour >= 6 && hour < 12) gradient = 'from-emerald-50 via-teal-50 to-cyan-50'
      else if (hour >= 12 && hour < 18) gradient = 'from-teal-50 via-cyan-50 to-sky-50'
      else if (hour >= 18 && hour < 21) gradient = 'from-indigo-100 via-purple-100 to-pink-100'
      else gradient = 'from-slate-800 via-slate-900 to-gray-900'

      setTimeBasedStyles({
        gradient,
        isNight: hour >= 21 || hour < 6
      })
    }

    updateTimeStyles()
    const interval = setInterval(updateTimeStyles, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className={`rounded-3xl h-[500px] bg-gradient-to-br ${timeBasedStyles.gradient} shadow-xl border border-white/20 p-4`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/30 rounded-xl w-2/3"></div>
          <div className="h-4 bg-white/20 rounded-lg w-1/2"></div>
          <div className="h-64 bg-white/20 rounded-2xl mt-4"></div>
        </div>
      </div>
    )
  }

  if (error || routes.length === 0) {
    return (
      <div className={`rounded-3xl h-[500px] bg-gradient-to-br ${timeBasedStyles.gradient} ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-800'} shadow-xl border border-white/20 p-4`}>
        <div className="h-full flex flex-col items-center justify-center text-center">
          <Car className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Aucun trajet disponible</h3>
          <p className={`text-sm ${timeBasedStyles.isNight ? 'text-white/60' : 'text-gray-500'}`}>
            Revenez plus tard pour découvrir nos itinéraires
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-3xl h-[500px] overflow-hidden bg-gradient-to-br ${timeBasedStyles.gradient} ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-800'} shadow-xl border border-white/20`}>
      {/* Contenu principal */}
      <div className="p-4 h-full box-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-white/50'}`}>
              <Car className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Trafic en temps réel</h3>
              <p className={`text-xs ${timeBasedStyles.isNight ? 'text-white/60' : 'text-gray-500'}`}>
                {routes.length} itinéraire{routes.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {routes.length > 1 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-white/50'}`}>
              <span className="font-medium">{currentIndex + 1}/{routes.length}</span>
            </div>
          )}
        </div>

        {/* Carte */}
        {selectedRoute && (
          <div className={`flex-1 rounded-2xl overflow-hidden ${timeBasedStyles.isNight ? 'bg-white/5' : 'bg-white/40'} relative`}>
            {selectedRoute.html_content || (selectedRoute.embed_url && selectedRoute.embed_url.trim().startsWith('<iframe')) ? (
              <div 
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-none"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(selectedRoute.html_content || selectedRoute.embed_url, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen', 'frameborder', 'src'] })
                }}
              />
            ) : selectedRoute.embed_url ? (
              <iframe
                src={selectedRoute.embed_url}
                className="w-full h-full border-none"
                allowFullScreen
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                title={selectedRoute.title}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col gap-2 p-4 text-center">
                <MapPin className="w-8 h-8 opacity-50" />
                <p className="text-sm">Carte non disponible pour ce trajet</p>
              </div>
            )}

            {/* Navigation sur la carte */}
            {routes.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-200 active:scale-95
                    ${timeBasedStyles.isNight ? 'bg-black/50 hover:bg-black/70' : 'bg-white/80 hover:bg-white'} shadow-lg`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNext}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-200 active:scale-95
                    ${timeBasedStyles.isNight ? 'bg-black/50 hover:bg-black/70' : 'bg-white/80 hover:bg-white'} shadow-lg`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Sélecteur d'itinéraire */}
        <div className="mt-3 relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 active:scale-[0.98]
              ${timeBasedStyles.isNight ? 'bg-white/10 hover:bg-white/15' : 'bg-white/50 hover:bg-white/70'}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Navigation className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <div className="text-left min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {selectedRoute?.title || 'Sélectionner un itinéraire'}
                </div>
                {selectedRoute?.subtitle && (
                  <div className={`text-xs truncate ${timeBasedStyles.isNight ? 'text-white/60' : 'text-gray-500'}`}>
                    {selectedRoute.subtitle}
                  </div>
                )}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Menu dropdown */}
          {isDropdownOpen && (
            <div className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto
              ${timeBasedStyles.isNight ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-200'}`}>
              
              {/* Catégorie Matin */}
              {morningRoutes.length > 0 && (
                <div>
                  <div className={`flex items-center gap-2 px-3 py-2 ${timeBasedStyles.isNight ? 'bg-orange-500/20' : 'bg-orange-50'}`}>
                    <Sun className="w-4 h-4 text-orange-500" />
                    <span className={`text-xs font-semibold ${timeBasedStyles.isNight ? 'text-orange-300' : 'text-orange-700'}`}>Matinée</span>
                  </div>
                  {morningRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectRoute(route)}
                      className={`w-full text-left p-3 transition-colors text-sm
                        ${selectedRoute?.id === route.id 
                          ? timeBasedStyles.isNight ? 'bg-white/10' : 'bg-orange-50' 
                          : timeBasedStyles.isNight ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`font-medium ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-900'}`}>{route.title}</div>
                      {route.subtitle && (
                        <div className={`text-xs mt-0.5 ${timeBasedStyles.isNight ? 'text-white/50' : 'text-gray-500'}`}>{route.subtitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Catégorie Soir */}
              {eveningRoutes.length > 0 && (
                <div>
                  <div className={`flex items-center gap-2 px-3 py-2 ${timeBasedStyles.isNight ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span className={`text-xs font-semibold ${timeBasedStyles.isNight ? 'text-indigo-300' : 'text-indigo-700'}`}>Soir</span>
                  </div>
                  {eveningRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectRoute(route)}
                      className={`w-full text-left p-3 transition-colors text-sm
                        ${selectedRoute?.id === route.id 
                          ? timeBasedStyles.isNight ? 'bg-white/10' : 'bg-indigo-50' 
                          : timeBasedStyles.isNight ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`font-medium ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-900'}`}>{route.title}</div>
                      {route.subtitle && (
                        <div className={`text-xs mt-0.5 ${timeBasedStyles.isNight ? 'text-white/50' : 'text-gray-500'}`}>{route.subtitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Autres itinéraires */}
              {otherRoutes.length > 0 && (
                <div>
                  {(morningRoutes.length > 0 || eveningRoutes.length > 0) && (
                    <div className={`flex items-center gap-2 px-3 py-2 ${timeBasedStyles.isNight ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className={`text-xs font-semibold ${timeBasedStyles.isNight ? 'text-white/70' : 'text-gray-700'}`}>Autres</span>
                    </div>
                  )}
                  {otherRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => selectRoute(route)}
                      className={`w-full text-left p-3 transition-colors text-sm
                        ${selectedRoute?.id === route.id 
                          ? timeBasedStyles.isNight ? 'bg-white/10' : 'bg-gray-100' 
                          : timeBasedStyles.isNight ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`font-medium ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-900'}`}>{route.title}</div>
                      {route.subtitle && (
                        <div className={`text-xs mt-0.5 ${timeBasedStyles.isNight ? 'text-white/50' : 'text-gray-500'}`}>{route.subtitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Indicateurs de navigation */}
        {routes.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {routes.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  currentIndex === index
                    ? 'bg-teal-500 w-4'
                    : timeBasedStyles.isNight ? 'bg-white/30 w-2 hover:bg-white/50' : 'bg-gray-300 w-2 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
