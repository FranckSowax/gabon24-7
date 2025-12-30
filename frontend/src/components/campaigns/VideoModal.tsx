'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VideoCampaign {
  id: string
  name: string
  video_url: string
  video_title: string
  video_description: string
  redirect_url: string
  status: string
  views: number
  clicks: number
}

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function VideoModal({ isOpen, onClose }: VideoModalProps) {
  const [campaign, setCampaign] = useState<VideoCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [canClose, setCanClose] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadCampaign()
    }
  }, [isOpen])

  // Countdown pour activer le bouton fermer après 5 secondes
  useEffect(() => {
    if (isOpen && campaign) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanClose(true)
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isOpen, campaign])

  const loadCampaign = async () => {
    try {
      const now = new Date().toISOString()
      
      // Récupérer campagne vidéo active
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('campaign_type', 'video-home')
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Erreur chargement campagne vidéo:', error)
        setLoading(false)
        onClose()
        return
      }

      if (!data) {
        setLoading(false)
        onClose()
        return
      }

      setCampaign(data)
      
      // Incrémenter les vues
      await incrementViews(data.id)
      
      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement campagne vidéo:', error)
      setLoading(false)
      onClose()
    }
  }

  const incrementViews = async (campaignId: string) => {
    try {
      await supabase.rpc('increment_campaign_views', { campaign_id: campaignId })
    } catch (error) {
      console.error('Erreur incrémentation vues:', error)
    }
  }

  const handleClick = async () => {
    if (!campaign) return

    try {
      // Incrémenter les clics
      await supabase.rpc('increment_campaign_clicks', { campaign_id: campaign.id })

      // Rediriger
      window.open(campaign.redirect_url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('Erreur clic campagne:', error)
    }
  }

  const handleClose = () => {
    if (canClose) {
      // Arrêter la vidéo
      if (videoRef.current) {
        videoRef.current.pause()
      }
      onClose()
    }
  }

  if (!isOpen || loading || !campaign) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-sm">
      {/* Overlay cliquable */}
      <div 
        className="absolute inset-0" 
        onClick={handleClose}
      />

      {/* Conteneur vidéo */}
      <div className="relative z-10 w-full h-full max-w-6xl max-h-screen p-4 sm:p-8 flex flex-col items-center justify-center">
        
        {/* Bouton fermer avec countdown */}
        <button
          onClick={handleClose}
          disabled={!canClose}
          className={`absolute top-4 right-4 sm:top-8 sm:right-8 z-20 p-3 rounded-full transition-all duration-300 ${
            canClose
              ? 'bg-white text-gray-900 hover:bg-gray-100 cursor-pointer shadow-xl'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
          title={canClose ? 'Fermer' : `Fermeture dans ${countdown}s`}
        >
          {canClose ? (
            <X className="w-6 h-6" />
          ) : (
            <span className="text-sm font-bold">{countdown}</span>
          )}
        </button>

        {/* Badge "Publicité" */}
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-20 bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xl">
          📢 PUBLICITÉ
        </div>

        {/* Vidéo - Format carré 1:1 */}
        <div className="relative w-full max-w-2xl aspect-square bg-black rounded-xl overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            src={campaign.video_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Erreur chargement vidéo:', e)
              onClose()
            }}
          />

          {/* Overlay info au hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">{campaign.video_title}</h3>
              <p className="text-sm mb-4 line-clamp-2">{campaign.video_description}</p>
              
              <button
                onClick={handleClick}
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg"
              >
                <span>En savoir plus</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats en bas (visible en développement) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-xs">
            👁️ {campaign.views.toLocaleString()} vues • 🔗 {campaign.clicks.toLocaleString()} clics
          </div>
        )}
      </div>
    </div>
  )
}
