'use client'

import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useFlipAd } from './FlipAdContext'

export default function FlipAdBack() {
  const { config, onBackClick } = useFlipAd()

  const isClickable = config.redirectMode === 'on_back_click'
  const bg = config.backgroundCss || 'linear-gradient(135deg, #697357 0%, #4d553e 50%, #3a4030 100%)'

  return (
    <div
      role={isClickable ? 'button' : undefined}
      aria-label={isClickable ? config.title || 'Publicité BCEG' : undefined}
      aria-pressed={isClickable ? false : undefined}
      onClick={isClickable ? onBackClick : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onBackClick()
        }
      } : undefined}
      className={`relative w-full h-full overflow-hidden rounded-2xl p-4 shadow-lg ${isClickable ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-transform`}
      style={{ background: bg }}
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/10 blur-3xl pointer-events-none" />

      <div className="relative h-full flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          {config.imageUrl ? (
            <img
              src={config.imageUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/40 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur ring-2 ring-white/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
          )}
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30 self-center">
            Sponsorisé
          </span>
        </div>

        {config.title && (
          <h3 className="text-white font-bold text-base leading-tight mb-1">
            {config.title}
          </h3>
        )}
        {config.subtitle && (
          <p className="text-white/85 text-xs leading-relaxed mb-3 line-clamp-3">
            {config.subtitle}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/15">
          <span className="text-[10px] uppercase tracking-wider opacity-75 text-white">
            BCEG × Gabon Insight
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
            {config.ctaLabel || 'Découvrir →'}
            {isClickable && (
              <ArrowRight className="w-3 h-3" />
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
