'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useFlipAd } from './FlipAdContext'
import FlipAdBack from './FlipAdBack'

interface FlipProfileCardProps {
  children: React.ReactNode
}

export default function FlipProfileCard({ children }: FlipProfileCardProps) {
  const { flipped, config } = useFlipAd()
  const frontRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!frontRef.current) return
    const el = frontRef.current
    const sync = () => setHeight(el.offsetHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [children])

  // Si la feature est désactivée : rendu direct sans wrapper 3D
  if (!config.enabled) {
    return <>{children}</>
  }

  // Mode reduced-motion : cross-fade simple au lieu de la rotation 3D
  if (reducedMotion) {
    return (
      <div className="relative" style={{ height }}>
        <div
          ref={frontRef}
          className={`transition-opacity duration-300 ${
            flipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {children}
        </div>
        {flipped && (
          <div className="absolute inset-0 transition-opacity duration-300">
            <FlipAdBack />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative"
      style={{
        perspective: '1200px',
        height,
      }}
    >
      <div
        className="relative w-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          height: height || 'auto',
        }}
      >
        {/* Face avant — la carte profil existante, intacte */}
        <div
          ref={frontRef}
          className="w-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: flipped ? 'absolute' : 'relative',
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>

        {/* Face arrière — la pub */}
        <div
          className="w-full absolute inset-0"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <FlipAdBack />
        </div>
      </div>
    </div>
  )
}
