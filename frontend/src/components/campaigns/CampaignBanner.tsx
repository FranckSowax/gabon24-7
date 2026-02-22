'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Campaign {
  id: string
  campaign_type: string
  name: string
  banner_title: string
  banner_description: string
  redirect_url: string
  start_date: string
  duration_days: number
  desktop_image_url: string
  mobile_image_url: string
  budget: number
  status: string
  views: number
  clicks: number
}

export default function CampaignBanner() {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const fetchActiveCampaign = async () => {
    try {
      console.log('📢 Récupération campagne active banner-home...')
      const response = await axios.get(`${API_URL}/api/campaigns/active`, {
        params: { campaign_type: 'banner-home' }
      })
      
      if (response.data.success && response.data.campaign) {
        // Vérifier si la date de démarrage est atteinte
        const startDate = new Date(response.data.campaign.start_date)
        const now = new Date()
        
        if (now >= startDate) {
          setCampaign(response.data.campaign)
          console.log(`✅ Campagne active trouvée: ${response.data.campaign.name}`)
          
          // Track view automatiquement
          trackView(response.data.campaign.id)
        } else {
          console.log('⏰ Campagne pas encore démarrée')
          setCampaign(null)
        }
      } else {
        console.log('ℹ️ Aucune campagne active pour banner-home')
        setCampaign(null)
      }
    } catch (error) {
      console.error('❌ Erreur récupération campagne:', error)
      setCampaign(null)
    } finally {
      setLoading(false)
    }
  }

  const trackView = async (campaignId: string) => {
    try {
      await axios.post(`${API_URL}/api/campaigns/${campaignId}/track`, {
        action: 'view'
      })
    } catch (error) {
      console.error('❌ Erreur tracking vue:', error)
    }
  }

  const trackClick = async (campaignId: string) => {
    try {
      await axios.post(`${API_URL}/api/campaigns/${campaignId}/track`, {
        action: 'click'
      })
      console.log('👆 Clic campagne enregistré')
    } catch (error) {
      console.error('❌ Erreur tracking clic:', error)
    }
  }

  const handleClick = () => {
    if (!campaign) return
    
    // Track click
    trackClick(campaign.id)
    
    // Open link
    if (campaign.redirect_url) {
      window.open(campaign.redirect_url, '_blank', 'noopener,noreferrer')
    }
  }

  useEffect(() => {
    fetchActiveCampaign()
    
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Refresh every 5 minutes to check for new campaigns
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveCampaign()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="w-full mb-6">
        <div className="bg-gray-200 animate-pulse rounded-lg h-32 sm:h-40"></div>
      </div>
    )
  }

  if (!campaign) {
    return null // Ne rien afficher si pas de campagne active
  }

  const imageUrl = isMobile 
    ? (campaign.mobile_image_url || campaign.desktop_image_url)
    : campaign.desktop_image_url

  return (
    <div className="w-full mb-6">
      <div 
        onClick={handleClick}
        className="relative bg-white rounded-lg overflow-hidden shadow-lg cursor-pointer group hover:shadow-xl transition-shadow duration-300"
      >
        {/* Image */}
        {imageUrl && (
          <div className="relative w-full" style={{ height: isMobile ? '200px' : '300px' }}>
            <img 
              src={imageUrl}
              alt={campaign.banner_title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            
            {/* Badge "Sponsorisé" */}
            <div className="absolute top-3 left-3">
              <span className="inline-block bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Sponsorisé
              </span>
            </div>
            
            {/* Contenu en overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <h3 className="text-white font-bold text-lg sm:text-2xl mb-2">
                {campaign.banner_title}
              </h3>
              {campaign.banner_description && (
                <p className="text-white/90 text-sm sm:text-base line-clamp-2 mb-3">
                  {campaign.banner_description}
                </p>
              )}
              <div className="inline-block bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold text-sm group-hover:bg-orange-50 transition-colors">
                En savoir plus →
              </div>
            </div>
          </div>
        )}

        {/* Hover effect */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
      </div>
    </div>
  )
}
