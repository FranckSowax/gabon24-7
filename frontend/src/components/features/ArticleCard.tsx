'use client'

import React, { useState, useEffect } from 'react'
import { Image as PhotoIcon } from 'lucide-react'
import { TLDRButton } from './TLDRButton'
import { useAuth } from '@/contexts/AuthContext'
import { useModal } from '@/contexts/ModalContext'
import { useDailyUsage } from '@/hooks/useDailyUsage'
import { getUserLimitations } from '@/lib/subscription'

interface Article {
  id: string
  title: string
  summary: string
  source: string
  media_name?: string
  publishedAt?: string
  published_at?: string
  created_at?: string
  displayTime?: string  // NOUVEAU: Temps d'affichage forcé depuis l'API
  category: string
  viewCount?: string  // Remplace readTime - nombre de vues formaté
  view_count?: number  // Valeur brute pour les calculs
  views?: number  // Propriété pour les vues dans les tendances
  trending?: boolean
  imageUrl?: string
  image_url?: string  // Propriété pour compatibilité avec trending articles - MCP Enhanced
  image_urls?: string[]  // Array d'images pour web scraping
  author?: string
  url?: string
  isGovernment?: boolean
  isMinisterial?: boolean
  tldr_points?: string[] | null  // TL;DR pré-généré en 3 points
}

interface ArticleCardProps {
  article: Article
  variant?: 'featured' | 'list'
  onSave?: (articleId: string) => void
  onShare?: (article: Article) => void
  onClick?: (article: Article) => void
  onToggleFavorite?: (articleId: string) => void
  isFavorite?: boolean
  onAuthRequired?: () => void
}

export function ArticleCard({ 
  article, 
  variant = 'list', 
  onSave, 
  onShare,
  onClick,
  onToggleFavorite,
  isFavorite = false,
  onAuthRequired
}: ArticleCardProps) {
  const { user, subscription, loading: authLoading } = useAuth()
  const { openAuthModal, openSubscriptionModal } = useModal()
  
  // État pour éviter les erreurs d'hydratation React #418
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  
  // Récupérer les limitations du plan actuel
  const limitations = getUserLimitations(subscription)
  const dailyLimit = limitations.daily_articles
  
  // Hook de gestion de l'usage quotidien
  const { increment, checkAccess } = useDailyUsage(user?.id, dailyLimit)

  // Gestion unifiée du clic sur l'article
  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Vérifier la limite quotidienne (si connecté)
    if (user && !checkAccess()) {
      openSubscriptionModal()
      return
    }

    // Incrémenter le compteur si connecté
    if (user) {
      increment()
    }

    // Action finale - accessible à tous
    if (onClick) {
      onClick(article)
    } else if (article.url) {
      window.open(article.url, '_blank')
    }
  }

  // Support both imageUrl, image_url and image_urls[0]
  let imageSrcRaw = article.imageUrl || (article as any).image_url || ((article as any).image_urls && (article as any).image_urls[0])
  // Normalize legacy Netlify proxy URLs by extracting the real image URL
  if (typeof imageSrcRaw === 'string' && imageSrcRaw.includes('/.netlify/functions/image-proxy')) {
    const m = imageSrcRaw.match(/url=([^&]+)/)
    if (m) {
      try { imageSrcRaw = decodeURIComponent(m[1]) } catch { imageSrcRaw = m[1] }
    }
  }
  
  // Backend API base for proxy (env or default)
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'


  // Fix URLs relatives (sport241.com, etc.)
  if (imageSrcRaw && !imageSrcRaw.startsWith('http')) {
    // Extraire le domaine depuis l'URL de l'article
    if (article.url) {
      try {
        const articleUrl = new URL(article.url)
        const baseUrl = `${articleUrl.protocol}//${articleUrl.hostname}`

        // Si l'URL commence par /, c'est une URL absolue relative
        if (imageSrcRaw.startsWith('/')) {
          imageSrcRaw = baseUrl + imageSrcRaw
        } else {
          // Sinon, construire depuis le domaine + path
          imageSrcRaw = baseUrl + '/' + imageSrcRaw
        }
      } catch (e) {
        // Si échec, essayer de deviner le protocole
        if (!imageSrcRaw.startsWith('//')) {
          imageSrcRaw = 'https://' + imageSrcRaw
        } else {
          imageSrcRaw = 'https:' + imageSrcRaw
        }
      }
    } else {
      // Pas d'URL article, ajouter https par défaut
      if (!imageSrcRaw.startsWith('//')) {
        imageSrcRaw = 'https://' + imageSrcRaw
      } else {
        imageSrcRaw = 'https:' + imageSrcRaw
      }
    }
  }
  
  // Decide whether to proxy the image to avoid Cross-Origin-Resource-Policy blocks
  const shouldProxyImage = (url?: string) => {
    if (!url) return false
    if (url.startsWith('data:') || url.startsWith('blob:')) return false
    if (url.startsWith(`${API_BASE}/api/image-proxy`)) return false
    try {
      const u = new URL(url)
      const host = u.hostname
      const isSameOrigin = typeof window !== 'undefined' && host === window.location.hostname
      // Proxy all external origins by default for robustness
      return !isSameOrigin
    } catch {
      return false
    }
  }

  // Détection des URLs Facebook (posts et images CDN)
  const isFacebookPost = !!article.url && article.url.toLowerCase().includes('facebook.com')
  const isFacebookCdnImage = typeof imageSrcRaw === 'string' && (
    imageSrcRaw.includes('fbcdn.net') ||
    imageSrcRaw.includes('fbsbx.com') ||
    imageSrcRaw.includes('facebook.com')
  )
  const isDefaultFbPlaceholder = typeof imageSrcRaw === 'string' && (
    imageSrcRaw.includes('facebook.com/images/default') ||
    imageSrcRaw.includes('safe_image.php') ||
    imageSrcRaw.includes('/rsrc.php')
  )

  // Utiliser le resolver Facebook si:
  // 1. C'est un post Facebook ET (pas d'image OU image placeholder)
  // 2. Ou si l'image existante est un placeholder Facebook
  const preferFacebookResolver = isFacebookPost && (isDefaultFbPlaceholder || !imageSrcRaw)

  // Construire l'URL de l'image — proxy uniquement pour Facebook (CORS bloquant)
  let proxiedImageSrc: string | undefined

  if (preferFacebookResolver) {
    proxiedImageSrc = `${API_BASE}/api/image-proxy/facebook-image?url=${encodeURIComponent(article.url || '')}`
  } else if (isFacebookCdnImage && imageSrcRaw) {
    proxiedImageSrc = `${API_BASE}/api/image-proxy?url=${encodeURIComponent(imageSrcRaw)}`
  } else {
    // Charger directement sans proxy — évite les timeouts Railway
    proxiedImageSrc = imageSrcRaw
  }
  const debug = false
  
  // Nettoyer le summary du HTML et des images
  const cleanSummary = (summary: string) => {
    if (!summary) return ''
    // Supprimer toutes les balises HTML (images, etc.)
    const cleanText = summary
      .replace(/<img[^>]*>/gi, '') // Supprimer images
      .replace(/<[^>]+>/g, '') // Supprimer autres balises HTML
      .replace(/&nbsp;/g, ' ') // Remplacer &nbsp;
      .replace(/&amp;/g, '&') // Remplacer &amp;
      .replace(/&lt;/g, '<') // Remplacer &lt;
      .replace(/&gt;/g, '>') // Remplacer &gt;
      .replace(/&quot;/g, '"') // Remplacer &quot;
      .trim()
    return cleanText
  }
  
  // Déterminer si l'article provient d'un flux gouvernemental ou présidentiel
  const isGovernmentSource = article.isGovernment || (article.source && (
    article.source.toLowerCase().includes('ministère') || 
    article.source.toLowerCase().includes('ministere') ||
    article.source.toLowerCase().includes('présidence') ||
    article.source.toLowerCase().includes('presidence') ||
    article.source.toLowerCase().includes('communication gouvernementale') ||
    article.source.toLowerCase().includes('gouvernement') ||
    // Inclure les tweets du président @oliguinguema
    article.source.toLowerCase().includes('oliguinguema') ||
    article.source.toLowerCase().includes('brice clotaire oligui nguema')
  )) || 
  // Détecter aussi par URL ou contenu Twitter présidentiel
  (article.url && article.url.includes('oliguinguema')) ||
  (article.author && article.author.toLowerCase().includes('oliguinguema'))

  // Formater la date de publication
  const formatPublishedDate = (article: Article): string => {
    // PRIORITÉ AU DISPLAYTIME CORRIGÉ DEPUIS L'API
    if (article.displayTime) {
      return article.displayTime
    }
    
    const dateStr = article.publishedAt || article.published_at || article.created_at
    if (!dateStr) return 'Date inconnue'
    
    // Nettoyer la chaîne de date et gérer différents formats
    let cleanDateStr = dateStr.toString().trim()
    
    // Si c'est déjà un format relatif français (formaté par le backend), l'utiliser directement
    const relativeFormats = /^(\d+\s*(min|h|jour|semaine|mois)s?|il y a|maintenant)/i
    if (relativeFormats.test(cleanDateStr)) {
      return cleanDateStr
    }
    
    // Gérer les formats de date courants
    if (cleanDateStr.includes('T') && !cleanDateStr.includes('Z') && !cleanDateStr.includes('+')) {
      cleanDateStr += 'Z' // Ajouter Z pour UTC si manquant
    }
    
    const date = new Date(cleanDateStr)
    
    // Vérifier si la date est valide et récente (pas avant 2020)
    if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
      // Ne plus logguer comme erreur, c'est peut-être un format non-standard mais valide
      
      // Essayer de parser manuellement les formats courants
      const datePatterns = [
        /(\d{1,2})\s+(jan|fév|mar|avr|mai|jun|jul|aoû|sep|oct|nov|déc)\w*\.?\s+(\d{4})/i,
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/
      ]
      
      for (const pattern of datePatterns) {
        const match = cleanDateStr.match(pattern)
        if (match) {
          try {
            let parsedDate
            if (pattern.source.includes('jan|fév')) {
              // Format français
              const monthMap: { [key: string]: string } = {
                'jan': '01', 'fév': '02', 'mar': '03', 'avr': '04',
                'mai': '05', 'jun': '06', 'jul': '07', 'aoû': '08',
                'sep': '09', 'oct': '10', 'nov': '11', 'déc': '12'
              }
              const day = match[1].padStart(2, '0')
              const month = monthMap[match[2].toLowerCase().substring(0, 3)]
              const year = match[3]
              if (month && parseInt(year) >= 2020) {
                parsedDate = new Date(`${year}-${month}-${day}T12:00:00Z`)
              }
            } else {
              parsedDate = new Date(cleanDateStr)
            }
            
            if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 2020) {
              return formatDateDifference(parsedDate)
            }
          } catch (e) {
            continue
          }
        }
      }
      
      // Si aucun parsing n'a fonctionné, utiliser la date actuelle
      return formatDateDifference(new Date())
    }
    
    return formatDateDifference(date)
  }
  
  const formatDateDifference = (date: Date): string => { // Updated 00:44 - Hydration fix
    // Éviter les erreurs d'hydratation: retourner placeholder côté serveur
    if (!mounted) return '...'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMinutes < 1) return '1 min'
    if (diffMinutes < 60) return `${diffMinutes} min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
    
    try {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    } catch (error) {
      console.warn('Erreur lors du formatage de la date:', error)
      return 'Date invalide'
    }
  }

  const handleSave = () => {
    if (onSave) {
      onSave(article.id)
    }
  }

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🖱️ ArticleCard: handleToggleFavorite appelé', { 
      articleId: article.id, 
      isFavorite,
      hasCallback: !!onToggleFavorite 
    })
    if (onToggleFavorite) {
      onToggleFavorite(article.id)
    } else {
      console.log('❌ onToggleFavorite n\'est pas défini!')
    }
  }

  const handleShare = () => {
    if (onShare) {
      onShare(article)
    } else {
      // Partage WhatsApp par défaut
      const text = `${article.title}\n\n${article.summary}\n\nSource: ${article.source}\nVia Gabon Insight`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(whatsappUrl, '_blank')
    }
  }

  if (variant === 'featured') {
    return (
      <div className={`relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow cursor-pointer border ${
        article.isMinisterial ? 'bg-green-50 border-green-200' : 
        isGovernmentSource ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
      }`}>
        {article.trending && (
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10">
            <span className="bg-orange-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center">
              🔥 <span className="hidden sm:inline ml-1">Tendance</span>
            </span>
          </div>
        )}
        
        <div 
          className="h-48 sm:h-60 md:h-72 bg-gradient-to-br from-green-400 to-blue-500 relative overflow-hidden cursor-pointer"
          onClick={handleCardClick}
        >
          {proxiedImageSrc ? (
            <img 
              src={proxiedImageSrc} 
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => {
                // Retry avec URL directe si le proxy échoue
                const img = e.currentTarget as HTMLImageElement
                const tried = img.getAttribute('data-retry') === '1'
                const isProxied = img.src.startsWith(`${API_BASE}/api/image-proxy`)

                if (!tried && isProxied && imageSrcRaw) {
                  img.setAttribute('data-retry', '1')
                  img.src = imageSrcRaw
                  return
                }

                // Fallback: icône gradient
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement | null
                if (fallback) fallback.classList.remove('hidden')
              }}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className={`${proxiedImageSrc ? 'hidden' : ''} bg-gradient-to-br from-green-400 to-blue-500 h-full w-full flex items-center justify-center absolute inset-0`}>
            <PhotoIcon className="h-8 sm:h-12 w-8 sm:w-12 text-white opacity-70" />
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs sm:text-sm">📰</span>
                </div>
                <span className="text-xs sm:text-sm opacity-90 font-medium truncate text-white">{article.source}</span>
              </div>
              <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
                {typeof (article.views ?? article.view_count) !== 'undefined' && (
                  <span className="text-xs opacity-80 bg-black bg-opacity-30 px-2 py-1 rounded text-white">
                    {`${Number(article.views ?? article.view_count ?? 0)} ${Number(article.views ?? article.view_count ?? 0) > 1 ? 'vues' : 'vue'}`}
                  </span>
                )}
                {article.author && (
                  <span className="text-xs opacity-75 bg-black bg-opacity-30 px-2 py-1 rounded text-white">
                    {article.author}
                  </span>
                )}
              </div>
            </div>
            <h3 
              className={`font-bold mb-1 sm:mb-2 cursor-pointer hover:text-orange-300 active:text-orange-400 transition-all duration-200 select-none text-white line-clamp-2 touch-manipulation ${
                variant === 'featured' ? 'text-base sm:text-lg lg:text-xl' : 'text-sm sm:text-base md:text-lg'
              }`}
              style={{ 
                WebkitTapHighlightColor: 'rgba(251, 146, 60, 0.3)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 10
              }}
              onClick={handleCardClick}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)'
                e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.2)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              onTouchCancel={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {article.title}
            </h3>
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-3">{cleanSummary(article.summary)}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-500">
              <span className="truncate">{formatPublishedDate(article)}</span>
              <span className="hidden sm:inline">
                {`${Number(article.views ?? article.view_count ?? 0)} ${Number(article.views ?? article.view_count ?? 0) > 1 ? 'vues' : 'vue'}`}
              </span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Bouton TL;DR */}
              <TLDRButton
                articleId={article.id}
                articleTitle={article.title}
                articleContent={article.summary}
                articleUrl={article.url}
                tldrPoints={article.tldr_points}
              />
              <button 
                onClick={handleToggleFavorite}
                className={`p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                  isFavorite ? 'text-orange-500' : 'text-gray-400'
                }`}
                title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <button 
                onClick={handleShare}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Partager"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-3 sm:p-4 lg:p-6 rounded-lg shadow hover:shadow-md transition-shadow border ${
      article.isMinisterial ? 'bg-green-50 border-green-200' : 
      isGovernmentSource ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Image principale de l'article */}
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 cursor-pointer relative overflow-hidden rounded-lg"
          onClick={handleCardClick}
        >
          {proxiedImageSrc ? (
            <img
              src={proxiedImageSrc}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => {
                // Retry avec URL directe si le proxy échoue
                const img = e.currentTarget as HTMLImageElement
                const tried = img.getAttribute('data-retry') === '1'
                const isProxied = img.src.startsWith(`${API_BASE}/api/image-proxy`)

                if (!tried && isProxied && imageSrcRaw) {
                  img.setAttribute('data-retry', '1')
                  img.src = imageSrcRaw
                  return
                }

                // Fallback: icône gradient
                img.style.display = 'none'
                const fallback = img.parentElement?.querySelector('.fallback-icon') as HTMLElement | null
                if (fallback) fallback.classList.remove('hidden')
              }}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className={`fallback-icon ${proxiedImageSrc ? 'hidden' : ''} w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center absolute inset-0`}>
            <span className="text-lg sm:text-xl text-white">📰</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{article.source}</span>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="text-xs sm:text-sm text-gray-500 truncate">{article.category}</span>
            {article.trending && (
              <>
                <span className="text-gray-400 hidden sm:inline">•</span>
                <span className="text-xs bg-orange-100 text-orange-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                  🔥 <span className="hidden sm:inline">Tendance</span>
                </span>
              </>
            )}
          </div>
          
          <h3 
            className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-2 hover:text-orange-600 active:text-orange-700 cursor-pointer line-clamp-2 transition-all duration-200 leading-tight break-words select-none touch-manipulation"
            style={{ 
              WebkitTapHighlightColor: 'rgba(251, 146, 60, 0.3)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              minHeight: '1.2em',
              touchAction: 'manipulation',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 10
            }}
            onClick={handleCardClick}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)'
              e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.1)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onTouchCancel={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {article.title}
          </h3>
          
          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">{cleanSummary(article.summary)}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-wrap gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <span className="whitespace-nowrap">{formatPublishedDate(article)}</span>
              <span className="text-gray-400">•</span>
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <span className="whitespace-nowrap">
                  {`${Number(article.views ?? article.view_count ?? 0)} ${Number(article.views ?? article.view_count ?? 0) > 1 ? 'vues' : 'vue'}`}
                </span>
              </div>
              {article.author && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="font-medium text-gray-600 truncate">{article.author}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 flex flex-col space-y-2">
          {/* Bouton TL;DR */}
          <TLDRButton
            articleId={article.id}
            articleTitle={article.title}
            articleContent={article.summary}
            articleUrl={article.url}
            tldrPoints={article.tldr_points}
          />
          
          <button
            onClick={handleToggleFavorite}
            className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
              isFavorite ? 'text-orange-500' : 'text-gray-400'
            }`}
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Partager sur WhatsApp"
          >
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.700"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
