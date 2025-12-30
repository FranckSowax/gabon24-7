'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface HeroSlide {
  id: string
  sort_order: number
  is_active: boolean
  badge_text: string | null
  badge_color: string
  title: string
  subtitle: string | null
  description: string | null
  button_text: string | null
  button_url: string | null
  button_style: 'primary' | 'secondary' | 'outline'
  background_type: 'gradient' | 'image' | 'color'
  background_value: string
  background_image: string | null
  text_color: string
}

export default function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [autoplay, setAutoplay] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Charger les slides depuis Supabase
  useEffect(() => {
    loadSlides()
  }, [])

  const loadSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      setSlides(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement slides:', error)
      setLoading(false)
    }
  }

  // Autoplay (changement automatique toutes les 5 secondes)
  useEffect(() => {
    if (!autoplay || slides.length <= 1) return

    const interval = setInterval(() => {
      nextSlide()
    }, 5000)

    return () => clearInterval(interval)
  }, [autoplay, currentSlide, slides.length])

  const nextSlide = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
      setIsTransitioning(false)
    }, 300)
  }

  const prevSlide = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
      setIsTransitioning(false)
    }, 300)
  }

  const goToSlide = (index: number) => {
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentSlide(index)
      setIsTransitioning(false)
    }, 300)
    setAutoplay(false) // Désactiver autoplay quand l'utilisateur clique
  }

  if (loading) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl animate-pulse" />
    )
  }

  if (slides.length === 0) {
    return null
  }

  const slide = slides[currentSlide]

  return (
    <div className="relative w-full">
      {/* Slide actuel */}
      <div
        className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 text-white rounded-2xl mb-4 sm:mb-8 shadow-2xl border border-white/20 hover:shadow-orange-500/25 transition-all duration-500 w-full min-h-[140px] sm:min-h-[160px]"
      >
        {/* Effets de fond animés */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 animate-pulse"></div>
          <div className="absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-bounce"></div>
          <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/10 rounded-lg rotate-45 animate-spin" style={{ animationDuration: '20s' }}></div>
        </div>

        {/* Contenu du slide */}
        <div className={`relative z-20 p-3 sm:p-4 lg:p-6 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-full">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-6">
              {/* Partie gauche : Texte */}
              <div className="flex flex-1 flex-col space-y-2">
                <div className="flex flex-col gap-1.5">
                  {/* Badge */}
                  {slide.badge_text && (
                    <div
                      className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide shadow-lg w-fit text-black"
                      style={{ backgroundColor: slide.badge_color }}
                    >
                      {slide.badge_text}
                    </div>
                  )}

                  {/* Titre */}
                  <div className="text-base sm:text-xl lg:text-2xl font-black tracking-tight">
                    {slide.title}
                    {slide.subtitle && (
                      <span className="ml-1 sm:ml-2 text-sm sm:text-lg lg:text-xl bg-gradient-to-r from-yellow-300 to-white bg-clip-text text-transparent">
                        {slide.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {slide.description && (
                  <p className="text-white/90 text-xs sm:text-sm leading-relaxed line-clamp-2">
                    {slide.description}
                  </p>
                )}
              </div>

              {/* Partie droite : Bouton CTA */}
              {slide.button_text && slide.button_url && (
                <div className="flex flex-shrink-0 w-full sm:w-auto">
                  <a
                    href={slide.button_url}
                    className={`group/btn relative w-full sm:w-auto font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden flex items-center justify-center text-[11px] sm:text-xs lg:text-sm ${
                      slide.button_style === 'primary'
                        ? 'bg-gradient-to-r from-white to-orange-50 text-orange-600'
                        : slide.button_style === 'secondary'
                        ? 'bg-white/20 text-white border border-white/40'
                        : 'bg-transparent text-white border-2 border-white'
                    }`}
                  >
                    <span className="relative z-10">
                      {slide.button_text}
                    </span>
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Effet de brillance au survol */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
          <div className="absolute inset-0 rounded-2xl border border-white/20 group-hover:border-white/40 transition-colors duration-500"></div>
        </div>
      </div>

      {/* Navigation (si plusieurs slides) - Cachée sur mobile */}
      {slides.length > 1 && (
        <>
          {/* Indicateurs (dots) - Desktop uniquement */}
          <div className="hidden sm:flex absolute bottom-3 left-1/2 -translate-x-1/2 z-30 gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === index
                    ? 'bg-white w-8 h-2'
                    : 'bg-white/50 w-2 h-2 hover:bg-white/70'
                }`}
                aria-label={`Aller au slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
