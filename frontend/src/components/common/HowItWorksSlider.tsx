'use client'

import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!steps?.length) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % steps.length)
    }, autoAdvanceMs)
    return () => clearInterval(timer)
  }, [steps?.length, autoAdvanceMs])

  const prev = () => setIndex((prev) => (prev - 1 + steps.length) % steps.length)
  const next = () => setIndex((prev) => (prev + 1) % steps.length)

  if (!steps || steps.length === 0) return null

  return (
    <div className={`relative ${className}`}>
      {/* Piste */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {steps.map((s, i) => (
            <div key={i} className="min-w-full px-1 sm:px-2">
              <div className="mx-auto max-w-md bg-white border border-orange-200 rounded-2xl shadow-lg p-5 sm:p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-r ${s.gradient || 'from-orange-500 to-orange-600'} rounded-xl flex items-center justify-center shadow`}>
                    {s.Icon ? <s.Icon className="w-7 h-7 text-white" /> : <span className="text-white text-base">★</span>}
                  </div>
                  <span className="text-orange-600 font-semibold text-sm">{i + 1}/{steps.length}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flèches (desktop) */}
      {steps.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Précédent"
            onClick={prev}
            className="hidden sm:flex absolute inset-y-0 left-0 items-center justify-center w-10 group"
          >
            <span className="bg-white/90 border border-orange-200 shadow rounded-full p-2.5 text-gray-700 group-hover:bg-white">
              <ChevronLeft className="w-6 h-6" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Suivant"
            onClick={next}
            className="hidden sm:flex absolute inset-y-0 right-0 items-center justify-center w-10 group"
          >
            <span className="bg-white/90 border border-orange-200 shadow rounded-full p-2.5 text-gray-700 group-hover:bg-white">
              <ChevronRight className="w-6 h-6" />
            </span>
          </button>
        </>
      )}

      {/* Points */}
      {steps.length > 1 && (
        <div className="flex items-center justify-center gap-2.5 mt-3">
          {steps.map((_, i) => (
            <button
              key={i}
              aria-label={`Aller à l'étape ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-3 rounded-full transition-all ${i === index ? 'w-7 bg-orange-600' : 'w-3 bg-orange-300 hover:bg-orange-400'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
