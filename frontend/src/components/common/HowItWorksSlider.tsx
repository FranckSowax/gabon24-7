'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type IconType = React.ComponentType<{ className?: string }>

export interface HowItWorksStep {
  title: string
  desc: string
  Icon?: IconType
  gradient?: string
}

interface HowItWorksSliderProps {
  steps: HowItWorksStep[]
  autoAdvanceMs?: number
  className?: string
}

export default function HowItWorksSlider({ steps, autoAdvanceMs = 4500, className = '' }: HowItWorksSliderProps) {
  const [index, setIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  useEffect(() => {
    if (!steps?.length) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % steps.length)
    }, autoAdvanceMs)
    return () => clearInterval(timer)
  }, [steps?.length, autoAdvanceMs])

  const prev = useCallback(() => setIndex((prev) => (prev - 1 + steps.length) % steps.length), [steps.length])
  const next = useCallback(() => setIndex((prev) => (prev + 1) % steps.length), [steps.length])

  // Touch handlers for mobile swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      next()
    } else if (isRightSwipe) {
      prev()
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  if (!steps || steps.length === 0) return null

  return (
    <div className={`relative ${className}`}>
      {/* Container with touch support */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {steps.map((s, i) => (
            <div
              key={i}
              className="w-full flex-shrink-0 px-2 sm:px-4"
              style={{ minWidth: '100%' }}
            >
              <div className="mx-auto max-w-md bg-white border border-orange-200 rounded-2xl shadow-lg p-4 sm:p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${s.gradient || 'from-orange-500 to-orange-600'} rounded-xl flex items-center justify-center shadow`}>
                    {s.Icon ? <s.Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" /> : <span className="text-white text-base">★</span>}
                  </div>
                  <span className="text-orange-600 font-semibold text-sm">{i + 1}/{steps.length}</span>
                </div>
                <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm sm:text-base text-gray-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows (desktop only) */}
      {steps.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Precedent"
            onClick={prev}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 left-0 items-center justify-center group z-10"
          >
            <span className="bg-white/90 border border-orange-200 shadow rounded-full p-2 text-gray-700 group-hover:bg-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Suivant"
            onClick={next}
            className="hidden sm:flex absolute top-1/2 -translate-y-1/2 right-0 items-center justify-center group z-10"
          >
            <span className="bg-white/90 border border-orange-200 shadow rounded-full p-2 text-gray-700 group-hover:bg-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </span>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {steps.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {steps.map((_, i) => (
            <button
              key={i}
              aria-label={`Aller a l'etape ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === index
                  ? 'w-6 bg-orange-600'
                  : 'w-2.5 bg-orange-300 hover:bg-orange-400'
              }`}
            />
          ))}
        </div>
      )}

      {/* Mobile swipe hint */}
      <p className="sm:hidden text-center text-xs text-gray-400 mt-2">
        Glissez pour naviguer
      </p>
    </div>
  )
}
