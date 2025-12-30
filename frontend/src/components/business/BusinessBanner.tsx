'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import { ChevronRight, Lock, Zap, Crown } from 'lucide-react'

interface BusinessBanner {
  id: string
  feature_slug: string
  page_path: string
  sort_order: number
  is_active: boolean
  badge_text: string | null
  badge_color: string
  badge_icon: string | null
  title: string
  subtitle: string | null
  description: string | null
  features: string[] | null
  primary_cta_text: string | null
  primary_cta_url: string | null
  primary_cta_type: 'action' | 'credits' | 'subscription'
  secondary_cta_text: string | null
  secondary_cta_url: string | null
  background_type: 'gradient' | 'image' | 'color'
  background_value: string
  background_image: string | null
  text_color: string
  require_subscription: boolean
  required_subscription_plan: string | null
  require_credits: boolean
  credit_cost: number
}

interface BusinessBannerProps {
  featureSlug?: string // Si fourni, charge la bannière spécifique
  pagePath?: string    // Si fourni, charge les bannières de cette page
}

export default function BusinessBanner({ featureSlug, pagePath }: BusinessBannerProps) {
  const pathname = usePathname()
  const { user, subscriptionPlan } = useAuth()
  const [banners, setBanners] = useState<BusinessBanner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBanners()
  }, [featureSlug, pagePath, pathname])

  const loadBanners = async () => {
    try {
      let query = supabase
        .from('business_banners')
        .select('*')
        .eq('is_active', true)

      if (featureSlug) {
        query = query.eq('feature_slug', featureSlug)
      } else if (pagePath) {
        query = query.eq('page_path', pagePath)
      } else {
        // Utiliser le pathname actuel
        query = query.eq('page_path', pathname)
      }

      const { data, error } = await query.order('sort_order', { ascending: true })

      if (error) throw error
      setBanners(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement bannière:', error)
      setLoading(false)
    }
  }

  const trackClick = async (bannerId: string) => {
    try {
      await supabase.rpc('increment_banner_clicks', { banner_id: bannerId })
    } catch (error) {
      console.error('Erreur tracking:', error)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl animate-pulse mb-8" />
    )
  }

  if (banners.length === 0) {
    return null
  }

  return (
    <div className="space-y-6 mb-8">
      {banners.map((banner) => {
        const hasAccess = checkAccess(banner, user, subscriptionPlan)
        
        return (
          <BannerCard 
            key={banner.id} 
            banner={banner} 
            hasAccess={hasAccess}
            onCtaClick={() => trackClick(banner.id)}
          />
        )
      })}
    </div>
  )
}

function BannerCard({ 
  banner, 
  hasAccess,
  onCtaClick 
}: { 
  banner: BusinessBanner
  hasAccess: boolean
  onCtaClick: () => void
}) {
  const getBackgroundStyle = () => {
    switch (banner.background_type) {
      case 'gradient':
        return `bg-gradient-to-br ${banner.background_value}`
      case 'image':
        return 'bg-cover bg-center'
      case 'color':
        return ''
      default:
        return 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-600'
    }
  }

  const backgroundImageStyle = banner.background_type === 'image' && banner.background_image
    ? { backgroundImage: `url(${banner.background_image})` }
    : {}

  const getCtaIcon = () => {
    if (banner.primary_cta_type === 'credits') return <Zap className="w-4 h-4" />
    if (banner.primary_cta_type === 'subscription') return <Crown className="w-4 h-4" />
    return <ChevronRight className="w-4 h-4" />
  }

  return (
    <div
      className={`relative overflow-hidden ${getBackgroundStyle()} text-white rounded-2xl shadow-2xl border border-white/20 transition-all duration-500 hover:shadow-3xl`}
      style={{
        ...backgroundImageStyle,
        color: banner.text_color
      }}
    >
      {/* Effets de fond */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10"></div>
        <div className="absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      </div>

      {/* Contenu */}
      <div className="relative z-10 p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Colonne 1 : Infos principales */}
          <div className="lg:col-span-2 space-y-4">
            {/* Badge + Titre */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {banner.badge_icon && (
                  <span className="text-2xl">{banner.badge_icon}</span>
                )}
                {banner.badge_text && (
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                    style={{ backgroundColor: banner.badge_color, color: '#000' }}
                  >
                    {banner.badge_text}
                  </span>
                )}
                {!hasAccess && (
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-100 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Verrouillé
                  </span>
                )}
              </div>

              <h2 className="text-2xl lg:text-3xl font-black">
                {banner.title}
                {banner.subtitle && (
                  <span className="ml-2 text-xl lg:text-2xl bg-gradient-to-r from-yellow-300 to-white bg-clip-text text-transparent">
                    {banner.subtitle}
                  </span>
                )}
              </h2>
            </div>

            {/* Description */}
            {banner.description && (
              <p className="text-white/90 text-base leading-relaxed">
                {banner.description}
              </p>
            )}

            {/* Features */}
            {banner.features && banner.features.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {banner.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-white/80">
                    <span className="text-yellow-300">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Infos restrictions */}
            {!hasAccess && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex items-start gap-2 text-sm">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    {banner.require_subscription && (
                      <p className="text-white/90">
                        <strong>Abonnement requis:</strong> {banner.required_subscription_plan || 'Premium'} ou supérieur
                      </p>
                    )}
                    {banner.require_credits && banner.credit_cost > 0 && (
                      <p className="text-white/90">
                        <strong>Coût:</strong> {banner.credit_cost} crédit{banner.credit_cost > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne 2 : CTA */}
          <div className="flex flex-col gap-3">
            {/* CTA Principal */}
            {banner.primary_cta_text && banner.primary_cta_url && (
              <a
                href={banner.primary_cta_url}
                onClick={onCtaClick}
                className="group relative bg-white/95 hover:bg-white text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden flex items-center justify-center gap-2"
              >
                <span className="relative z-10">{banner.primary_cta_text}</span>
                {getCtaIcon()}
                <div className="absolute inset-0 bg-gradient-to-r from-white to-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            )}

            {/* CTA Secondaire */}
            {banner.secondary_cta_text && banner.secondary_cta_url && (
              <a
                href={banner.secondary_cta_url}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium py-2 px-6 rounded-xl transition-all duration-300 border border-white/40 text-center text-sm"
              >
                {banner.secondary_cta_text}
              </a>
            )}

            {/* Info crédit cost (si applicable) */}
            {banner.require_credits && banner.credit_cost > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 text-center">
                <div className="text-xs text-white/70 mb-1">Coût par utilisation</div>
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  {banner.credit_cost}
                </div>
                <div className="text-xs text-white/70">crédit{banner.credit_cost > 1 ? 's' : ''}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Effet de brillance */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl border border-white/20"></div>
      </div>
    </div>
  )
}

// Helper pour vérifier l'accès
function checkAccess(
  banner: BusinessBanner,
  user: any,
  subscriptionPlan: any
): boolean {
  if (!banner.require_subscription && !banner.require_credits) {
    return true // Pas de restriction
  }

  if (!user) {
    return false // Utilisateur non connecté
  }

  // Vérifier l'abonnement requis
  if (banner.require_subscription && banner.required_subscription_plan) {
    const planHierarchy: { [key: string]: number } = {
      'free': 0,
      'freemium': 0,
      'premium': 1,
      'pro': 2
    }

    const userPlanLevel = planHierarchy[subscriptionPlan?.slug?.toLowerCase() || 'free'] || 0
    const requiredPlanLevel = planHierarchy[banner.required_subscription_plan.toLowerCase()] || 1

    if (userPlanLevel < requiredPlanLevel) {
      return false
    }
  }

  // Si on arrive ici, l'utilisateur a l'abonnement requis (ou pas d'abonnement requis)
  // Pour les crédits, on retourne true (la vérification se fera au moment de l'action)
  return true
}
