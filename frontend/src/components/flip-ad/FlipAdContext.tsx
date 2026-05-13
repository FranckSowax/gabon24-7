'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface FlipAdConfig {
  enabled: boolean
  durationMs: number
  imageUrl?: string
  title?: string
  subtitle?: string
  ctaLabel?: string
  backgroundCss?: string
  /** Mode de redirection :
   * - 'none' : pas de redirection (juste l'animation)
   * - 'after_flip' : redirige automatiquement à la fin du flip
   * - 'on_back_click' : redirige uniquement si l'user clique sur la face arrière
   */
  redirectMode: 'none' | 'after_flip' | 'on_back_click'
}

// Config MVP par défaut (sera remplacée par fetch DB en Phase 2)
const DEFAULT_CONFIG: FlipAdConfig = {
  enabled: true,
  durationMs: 4000,
  imageUrl: '/646710125_122187790628463229_813105913342150168_n.jpg',
  title: 'BCEG · Crédits dès 5 %',
  subtitle: 'Programme CATR / FAMAD — Préparez votre dossier et obtenez votre financement.',
  ctaLabel: 'Découvrir →',
  backgroundCss: 'linear-gradient(135deg, #697357 0%, #4d553e 50%, #3a4030 100%)',
  redirectMode: 'after_flip',
}

interface FlipAdContextValue {
  config: FlipAdConfig
  flipped: boolean
  /** Déclenche un flip puis exécute href selon le redirectMode */
  triggerFlip: (href?: string) => void
  /** Click sur la face arrière (pour mode on_back_click) */
  onBackClick: () => void
}

const FlipAdContext = createContext<FlipAdContextValue | null>(null)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function FlipAdProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [config, setConfig] = useState<FlipAdConfig>(DEFAULT_CONFIG)
  const [flipped, setFlipped] = useState(false)

  // Fetch config publique au mount (cache 60s côté CDN)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/flip-ad`, { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (json?.success && json.config) {
          const c = json.config
          setConfig({
            enabled: !!c.enabled,
            durationMs: c.duration_ms || 4000,
            imageUrl: c.image_url || DEFAULT_CONFIG.imageUrl,
            title: c.title || DEFAULT_CONFIG.title,
            subtitle: c.subtitle || DEFAULT_CONFIG.subtitle,
            ctaLabel: c.cta_label || DEFAULT_CONFIG.ctaLabel,
            backgroundCss: c.background_css || DEFAULT_CONFIG.backgroundCss,
            redirectMode: c.redirect_mode || 'after_flip',
          })
        } else if (json?.success && !json.config) {
          // Pas de config active → désactivé
          setConfig({ ...DEFAULT_CONFIG, enabled: false })
        }
      } catch {
        // garde le DEFAULT_CONFIG en cas d'erreur réseau
      }
    })()
    return () => { alive = false }
  }, [])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHrefRef = useRef<string | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => clearTimer(), [])

  const triggerFlip = useCallback((href?: string) => {
    if (!config.enabled) {
      if (href) router.push(href)
      return
    }
    clearTimer()
    pendingHrefRef.current = href || null
    setFlipped(true)

    // Navigation immédiate (pas de décalage) — la pub continue à jouer
    // dans la sidebar pendant que la nouvelle page se charge.
    if (config.redirectMode === 'after_flip' && href) {
      router.push(href)
    }

    timerRef.current = setTimeout(() => {
      setFlipped(false)
      timerRef.current = null
      pendingHrefRef.current = null
    }, config.durationMs)
  }, [config, router])

  const onBackClick = useCallback(() => {
    if (config.redirectMode === 'on_back_click' && pendingHrefRef.current) {
      clearTimer()
      const href = pendingHrefRef.current
      setFlipped(false)
      pendingHrefRef.current = null
      router.push(href)
    }
  }, [config, router])

  return (
    <FlipAdContext.Provider value={{ config, flipped, triggerFlip, onBackClick }}>
      {children}
    </FlipAdContext.Provider>
  )
}

export function useFlipAd(): FlipAdContextValue {
  const ctx = useContext(FlipAdContext)
  if (!ctx) {
    return {
      config: DEFAULT_CONFIG,
      flipped: false,
      triggerFlip: () => {},
      onBackClick: () => {},
    }
  }
  return ctx
}
