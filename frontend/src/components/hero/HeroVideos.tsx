'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface HeroVideo {
  id: string
  title: string | null
  description: string | null
  cta_label: string | null
  cta_url: string | null
  video_url: string
}

export default function HeroVideos() {
  const [videos, setVideos] = useState<HeroVideo[]>([])
  const [index, setIndex] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/hero-videos/active`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.success && Array.isArray(d.videos)) setVideos(d.videos) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // À chaque changement de vidéo, masquer l'overlay
  useEffect(() => { setShowOverlay(false) }, [index])

  if (videos.length === 0) return null

  const current = videos[index]
  const hasOverlay = !!(current.title || current.description || (current.cta_label && current.cta_url))

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration || isNaN(v.duration)) return
    const timeLeft = v.duration - v.currentTime
    setShowOverlay(hasOverlay && timeLeft <= 5 && timeLeft > 0)
  }

  const handleEnded = () => {
    if (videos.length > 1) {
      setShowOverlay(false)
      setIndex((i) => (i + 1) % videos.length)
    }
  }

  return (
    <section className="w-full mb-6">
      <div className="relative w-full aspect-[21/9] overflow-hidden rounded-xl sm:rounded-2xl bg-black shadow-md">
        <video
          key={current.id}
          ref={videoRef}
          src={current.video_url}
          autoPlay
          muted
          playsInline
          loop={videos.length === 1}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Colonne de droite : Titre + texte + CTA (apparaît 5 s avant la fin) */}
        {hasOverlay && (
          <div
            className={`absolute inset-y-0 right-0 w-full sm:w-2/5 lg:w-1/3 flex flex-col justify-center gap-2 sm:gap-3 p-4 sm:p-6 text-right
              bg-gradient-to-l from-black/85 via-black/55 to-transparent
              transition-all duration-700 ${showOverlay ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6 pointer-events-none'}`}
          >
            {current.title && (
              <h2 className="text-white font-bold text-base sm:text-2xl lg:text-3xl leading-tight drop-shadow">
                {current.title}
              </h2>
            )}
            {current.description && (
              <p className="text-white/85 text-xs sm:text-sm lg:text-base leading-snug line-clamp-3 sm:line-clamp-4">
                {current.description}
              </p>
            )}
            {current.cta_label && current.cta_url && (
              <a
                href={current.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="self-end inline-flex items-center gap-1.5 mt-1 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-xs sm:text-sm font-semibold shadow-lg transition-colors"
              >
                {current.cta_label}
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            )}
          </div>
        )}

        {/* Indicateurs (si plusieurs vidéos) */}
        {videos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {videos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
