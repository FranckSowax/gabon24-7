'use client'

import { useState, useEffect, useRef } from 'react'
import { ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FeedBanner {
  id: string
  title: string
  image_url: string
  mobile_image_url?: string
  redirect_url: string
  position: number
  is_active: boolean
  priority: number
  view_count: number
  click_count: number
  start_date: string
  end_date: string | null
}

interface FeedBannerAdProps {
  position: number // Position dans le feed (7, 14, 21)
}

export default function FeedBannerAd({ position }: FeedBannerAdProps) {
  const [banner, setBanner] = useState<FeedBanner | null>(null)
  const [loading, setLoading] = useState(true)
  const [parallaxOffset, setParallaxOffset] = useState(0)
  const [mounted, setMounted] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  // Marquer le composant comme monté (évite les erreurs d'hydratation)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Effet parallaxe au scroll
  useEffect(() => {
    const handleScroll = () => {
      if (bannerRef.current) {
        const rect = bannerRef.current.getBoundingClientRect()
        const windowHeight = window.innerHeight
        // Calculer l'offset parallaxe basé sur la position dans la fenêtre
        const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height)
        const offset = (scrollProgress - 0.5) * 100 // -50px à +50px
        setParallaxOffset(offset)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    loadBanner()
  }, [position])

  const loadBanner = async () => {
    try {
      const now = new Date().toISOString()
      
      // Récupérer les bannières actives pour cette position
      const { data, error } = await supabase
        .from('feed_banners')
        .select('*')
        .eq('position', position)
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Erreur chargement bannière:', error)
        setLoading(false)
        return
      }

      if (!data) {
        setLoading(false)
        return
      }

      setBanner(data)

      // Incrémenter les vues
      await incrementViews(data.id)

      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement bannière feed:', error)
      setLoading(false)
    }
  }

  const incrementViews = async (bannerId: string) => {
    try {
      await supabase.rpc('increment_feed_banner_views', { banner_id: bannerId })
    } catch (error) {
      console.error('Erreur incrémentation vues:', error)
    }
  }

  const handleClick = async () => {
    if (!banner) return

    try {
      // Incrémenter les clics
      await supabase.rpc('increment_feed_banner_clicks', { banner_id: banner.id })

      // Rediriger
      window.open(banner.redirect_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('Erreur clic bannière:', error)
    }
  }

  if (loading || !banner) {
    return null
  }

  return (
    <div className="w-full my-6 group">
      {/* Badge "Publicité" */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          📢 Publicité
        </span>
        <span className="text-xs text-gray-400">
          Annonce sponsorisée
        </span>
      </div>

      {/* Bannière cliquable avec effet parallaxe */}
      <div
        ref={bannerRef}
        onClick={handleClick}
        className="relative w-full rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 hover:border-orange-300 h-auto lg:h-[280px]"
      >
        {/* Image Mobile (800x500) - visible sur mobile uniquement via CSS */}
        {banner.mobile_image_url && (
          <img
            src={banner.mobile_image_url}
            alt={banner.title}
            className="w-full h-full object-cover block lg:hidden"
          />
        )}
        
        {/* Fallback mobile: Si pas d'image mobile, utiliser l'image desktop */}
        {!banner.mobile_image_url && (
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover block lg:hidden"
          />
        )}
        
        {/* Image Desktop (1200x400) - visible sur desktop avec parallaxe */}
        <img
          src={banner.image_url}
          alt={banner.title}
          className="w-full h-full object-cover transition-transform duration-100 ease-out hidden lg:block"
          style={{ 
            transform: mounted ? `translateY(${parallaxOffset}px) scale(1.1)` : 'scale(1.1)',
          }}
        />

        {/* Overlay au hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white rounded-full p-3 shadow-lg">
            <ExternalLink className="w-6 h-6 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>Cliquez pour en savoir plus</span>
        <span className="flex items-center gap-1">
          <span>👁️ {banner.view_count.toLocaleString()}</span>
          <span className="mx-1">•</span>
          <span>🔗 {banner.click_count.toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}
