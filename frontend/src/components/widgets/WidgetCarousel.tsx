'use client'

/**
 * Galerie défilante des modules pratiques de l'accueil (météo, sondage,
 * trafic, journal TV, scores). Tous les modules ont la même taille et se
 * parcourent au doigt ou avec les flèches. Remplace les anciens menus
 * déroulants, qui cachaient ces modules derrière un clic.
 *
 * Chaque module n'est chargé qu'à son arrivée à l'écran (LazyMount).
 */

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import LazyMount from '@/components/utils/LazyMount'

export interface CarouselModule {
  key: string
  title: string
  icon: string
  render: () => ReactNode
}

interface WidgetCarouselProps {
  modules: CarouselModule[]
  title?: string
  className?: string
  /**
   * `scroll` (défaut) : galerie glissable, flèches et raccourcis.
   * `fit` : tous les modules côte à côte sur la largeur disponible, sans
   * défilement (utilisé sur ordinateur, où la largeur du fil suffit pour trois).
   */
  layout?: 'scroll' | 'fit'
}

// Même hauteur pour tous : celle des modules météo, sondage et trafic.
const SLIDE_HEIGHT = 'h-[500px]'

export default function WidgetCarousel({ modules, title = 'En ce moment', className = '', layout = 'scroll' }: WidgetCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(modules.length > 1)
  const [active, setActive] = useState(0)

  const update = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setCanPrev(track.scrollLeft > 4)
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
    const slides = Array.from(track.children) as HTMLElement[]
    const left = track.getBoundingClientRect().left
    let index = 0
    slides.forEach((slide, i) => {
      if (slide.getBoundingClientRect().left - left < slide.offsetWidth / 2) index = i
    })
    setActive(index)
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  const scrollToIndex = (index: number) => {
    const track = trackRef.current
    const slide = track?.children[index] as HTMLElement | undefined
    if (!track || !slide) return
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'smooth' })
  }

  const step = (direction: 1 | -1) => scrollToIndex(Math.min(modules.length - 1, Math.max(0, active + direction)))

  if (modules.length === 0) return null

  if (layout === 'fit') {
    return (
      <section aria-label={title} className={className}>
        <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${modules.length}, minmax(0, 1fr))` }}
        >
          {modules.map((module) => (
            <div
              key={module.key}
              role="group"
              aria-label={module.title}
              className={`min-w-0 ${SLIDE_HEIGHT} overflow-hidden rounded-3xl`}
            >
              <LazyMount className="w-full h-full">
                <div className="w-full h-full flex !flex-nowrap flex-col">{module.render()}</div>
              </LazyMount>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section aria-label={title} aria-roledescription="carrousel" className={className}>
      <div className="flex !flex-nowrap items-center justify-between mb-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <div className="flex !flex-nowrap items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canPrev}
            aria-label="Module précédent"
            className="p-1.5 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canNext}
            aria-label="Module suivant"
            className="p-1.5 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Raccourcis : nom de chaque module, pour y aller directement. */}
      {/* `!flex-nowrap` : globals.css fait passer toutes les rangées `.flex` à la ligne sous 768 px. */}
      <div className="flex !flex-nowrap gap-1.5 mb-3 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Modules">
        {modules.map((module, index) => (
          <button
            key={module.key}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => scrollToIndex(index)}
            className={`flex !flex-nowrap flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              active === index ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span aria-hidden="true">{module.icon}</span>
            {module.title}
          </button>
        ))}
      </div>

      <div
        ref={trackRef}
        onScroll={update}
        className="flex !flex-nowrap gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide pb-1"
      >
        {modules.map((module) => (
          <div
            key={module.key}
            role="group"
            aria-roledescription="module"
            aria-label={module.title}
            className={`snap-start flex-shrink-0 w-[85%] sm:w-[320px] ${SLIDE_HEIGHT} overflow-hidden rounded-3xl`}
          >
            <LazyMount className="w-full h-full">
              <div className="w-full h-full flex !flex-nowrap flex-col">{module.render()}</div>
            </LazyMount>
          </div>
        ))}
      </div>
    </section>
  )
}
