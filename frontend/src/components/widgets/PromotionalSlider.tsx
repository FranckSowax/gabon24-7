'use client'

import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import axios from '@/lib/axios'

interface Slide {
  id: string
  title: string
  description?: string
  image_url: string
  image_url_banner?: string
  image_url_mobile?: string
  link_url?: string
  ctaText: string
  companyName: string
  displayOrder: number
  slideType?: 'image' | 'html'
  htmlContent?: string
}

export default function PromotionalSlider() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Récupérer les slides depuis l'API
  const fetchSlides = async () => {
    try {
      console.log('📢 Récupération des slides publicitaires...')
      // Pré-vérification rapide (fonction froide)
      try {
        await axios.get(`${API_URL}/api/slides?health=1&_t=${Date.now()}` , { timeout: 4000 })
      } catch {
        // Fallback cache local si dispo
        try {
          const cached = typeof window !== 'undefined' ? localStorage.getItem('slides_cache') : null
          if (cached) {
            const slides = JSON.parse(cached)
            setSlides(slides)
            setIsLoading(false)
            return
          }
        } catch {}
        setIsLoading(false)
        return
      }

      const response = await axios.get(`${API_URL}/api/slides`)
      
      if (response.data.success && response.data.slides) {
        setSlides(response.data.slides)
        try { if (typeof window !== 'undefined') localStorage.setItem('slides_cache', JSON.stringify(response.data.slides)) } catch {}
        console.log(`✅ ${response.data.slides.length} slides chargés`)
        setIsLoading(false)
      } else {
        console.warn('⚠️ Aucun slide publicitaire trouvé')
        setSlides([])
        setIsLoading(false)
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des slides:', error)
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('slides_cache') : null
        if (cached) {
          const slides = JSON.parse(cached)
          setSlides(slides)
          setIsLoading(false)
          return
        }
      } catch {}
      setError('Impossible de charger les publicités')
      setIsLoading(false)
    }
  }

  // Enregistrer une vue de slide
  const trackView = async (slideId: string) => {
    try {
      await axios.post(`${API_URL}/api/slides`, {
        slideId,
        action: 'view',
        userAgent: navigator.userAgent,
        referrer: document.referrer
      })
    } catch (error) {
      console.error('❌ Erreur tracking vue:', error)
    }
  }

  // Enregistrer un clic de slide
  const trackClick = async (slideId: string) => {
    try {
      await axios.post(`${API_URL}/api/slides`, {
        slideId,
        action: 'click',
        userAgent: navigator.userAgent,
        referrer: document.referrer
      })
    } catch (error) {
      console.error('❌ Erreur tracking clic:', error)
    }
  }

  // Charger les slides au montage du composant
  useEffect(() => {
    fetchSlides()
    
    // Detect mobile screen size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-slide toutes les 6 secondes
  useEffect(() => {
    if (slides.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex === slides.length - 1 ? 0 : prevIndex + 1
        
        // Tracker la vue du nouveau slide
        if (slides[nextIndex]) {
          trackView(slides[nextIndex].id)
        }
        
        return nextIndex
      })
    }, 6000)

    return () => clearInterval(interval)
  }, [slides])

  // Tracker la vue du premier slide
  useEffect(() => {
    if (slides.length > 0 && slides[currentIndex]) {
      trackView(slides[currentIndex].id)
    }
  }, [slides])

  // Navigation manuelle
  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    if (slides[index]) {
      trackView(slides[index].id)
    }
  }

  // Gérer le clic sur un slide
  const handleSlideClick = async (slide: any) => {
    // Enregistrer le clic
    await trackClick(slide.id)

    if (slide.link_url) {
      window.open(slide.link_url, '_blank', 'noopener,noreferrer')
    }
  }

  const getSlideImage = (slide: Slide) => {
    if (isMobile) {
      // Sur mobile, utiliser l'image mobile si elle existe et n'est pas une URL blob
      const mobileImage = slide.image_url_mobile;
      if (mobileImage && !mobileImage.startsWith('blob:')) {
        return mobileImage;
      }
      // Fallback sur image banner puis image de base
      return slide.image_url_banner || slide.image_url;
    }
    // Sur desktop, utiliser banner puis image de base
    return slide.image_url_banner || slide.image_url;
  }

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

  // Afficher un placeholder pendant le chargement pour debug
  if (isLoading) {
    return (
      <div className="w-full mb-6">
        <div className="bg-gray-200 rounded-lg h-32 sm:h-40 flex items-center justify-center">
          <div className="text-gray-500">Chargement des publicités...</div>
        </div>
      </div>
    )
  }

  // Afficher un message si pas de slides pour debug
  if (error || slides.length === 0) {
    return (
      <div className="w-full mb-6">
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-center">
          <div className="text-yellow-800">
            {error ? `Erreur: ${error}` : 'Aucune publicité disponible pour le moment'}
          </div>
        </div>
      </div>
    )
  }

  const currentSlide = slides[currentIndex]

  return (
    <div className="w-full mb-6">
      <div className="relative bg-gradient-to-r from-orange-500 to-red-500 rounded-lg overflow-hidden shadow-lg cursor-pointer group">
        {/* Slide principal */}
        <div 
          className="relative flex items-center w-full"
          style={{ 
            minHeight: isMobile ? '280px' : '240px',
            maxHeight: isMobile ? '400px' : '320px',
            aspectRatio: isMobile ? '4/5' : '21/9'
          }}
          onClick={() => handleSlideClick(currentSlide)}
        >
          {/* Contenu du slide - Image ou HTML */}
          {currentSlide.slideType === 'html' && currentSlide.htmlContent ? (
            <div 
              className="w-full h-full rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentSlide.htmlContent) }}
            />
          ) : currentSlide.image_url ? (
            <div className="w-full h-full">
              {(() => {
                const raw = getSlideImage(currentSlide)
                const proxied = raw && shouldProxyImage(raw)
                  ? `${API_URL}/api/image-proxy?url=${encodeURIComponent(raw)}&title=${encodeURIComponent(currentSlide.title || '')}`
                  : raw
                return (
                  <img 
                    src={proxied || ''} 
                    alt={currentSlide.title}
                    className="w-full h-full rounded-lg"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                    referrerPolicy="no-referrer"
                  />
                )
              })()}
            </div>
          ) : null}

          {/* Contenu du slide - positionné en overlay en bas */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 rounded-b-lg">
            <div className="flex items-center justify-between w-full text-white">
              <div className="flex-1">
              {/* Badge "Publicité" */}
              <div className="mb-2">
                <span className="inline-block bg-white/20 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                  📢 Publicité
                </span>
              </div>

              {/* Titre */}
              <h3 className="text-white font-bold text-lg sm:text-xl mb-1 line-clamp-1">
                {currentSlide.title}
              </h3>

              {/* Description */}
              {currentSlide.description && (
                <p className="text-white/90 text-sm mb-2 line-clamp-2">
                  {currentSlide.description}
                </p>
              )}

              {/* Nom de l'entreprise */}
              <p className="text-white/80 text-xs">
                Par {currentSlide.companyName}
              </p>
            </div>

            {/* Call to Action */}
            <div className="ml-4">
              <div className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium text-sm group-hover:bg-orange-50 transition-colors duration-200 shadow-md">
                {currentSlide.ctaText}
              </div>
            </div>
            </div>
          </div>

          {/* Effet hover */}
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        </div>

        {/* Indicateurs de pagination - Rectangles arrondis */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1.5">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  goToSlide(index)
                }}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/50 hover:bg-white/70 w-4'
                }`}
                aria-label={`Aller au slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Compteur de slides */}
        {slides.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/30 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
            {currentIndex + 1}/{slides.length}
          </div>
        )}
      </div>
    </div>
  )
}
