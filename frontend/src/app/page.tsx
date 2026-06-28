'use client'

// Force Netlify redeploy - Updated: 2025-10-23 00:40 - article_title nullable fix
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, User, Menu, X, Heart, Share2, Bookmark, LogIn, LogOut } from 'lucide-react'
import { ArticleCard } from '@/components/features/ArticleCard'
import SearchWidget from '@/components/widgets/SearchWidget'
import TrendingWidget from '@/components/widgets/TrendingWidget'
import StatsWidget from '@/components/widgets/StatsWidget'
import YouTubeWidget from '@/components/widgets/YouTubeWidget'
import LazyMount from '@/components/utils/LazyMount'
import YesterdayPollWidget from '@/components/widgets/YesterdayPollWidget'
import UpcomingEvents from '@/components/widgets/UpcomingEvents'
import AuthModal from '@/components/auth/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { addToFavorites, removeFromFavorites, getFavorites, type Favorite } from '@/lib/favorites'
import PromotionalSlider from '@/components/widgets/PromotionalSlider'
import WidgetDropdown from '@/components/widgets/WidgetDropdown'
import CampaignBanner from '@/components/campaigns/CampaignBanner'
import FeedBannerAd from '@/components/campaigns/FeedBannerAd'
import VideoModal from '@/components/campaigns/VideoModal'
import EventsSlider from '@/components/widgets/EventsSlider'
import AudioPlayerBanner from '@/components/audio/AudioPlayerBanner'
import Sidebar from '@/components/layout/Sidebar'
import axios from '@/lib/axios'
import Header from '@/components/layout/Header'
import WeatherWidget from '@/components/widgets/WeatherWidget'
import MultiQuestionPollWidget from '@/components/widgets/MultiQuestionPollWidget'
import RoutesMapWidget from '@/components/widgets/RoutesMapWidget'
import ScrollToTop from '@/components/ui/ScrollToTop'
import WorldCupLive from '@/components/widgets/WorldCupLive'
import HeroSlider from '@/components/hero/HeroSlider'
import HeroVideos from '@/components/hero/HeroVideos'
import { supabase } from '@/lib/supabase'
// Force rebuild for media_name support - v4.9 (Fixed generate-project-proposals function)

interface Article {
  id: string
  title: string
  summary: string
  content?: string
  url: string
  author?: string
  source: string
  media_name?: string
  category: string
  imageUrl?: string
  published_at?: string
  created_at?: string
  publishedAt?: string
  displayTime?: string
  _renderKey?: string
  is_trending?: boolean
  viewCount?: string  // Compatible avec ArticleCard
  view_count?: number  // Valeur brute
  views?: number
  isGovernment?: boolean
  isMinisterial?: boolean
}

interface ArchiveFiltersType {
  dateFilter: 'all' | 'yesterday' | 'week' | 'month' | 'custom'
  customStartDate: string
  customEndDate: string
  searchKeyword: string
}

export default function HomePage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDateRange, setSelectedDateRange] = useState('all')
  const [selectedSortBy, setSelectedSortBy] = useState('recent')
  const [activeTab, setActiveTab] = useState('pour-vous')
  const [forceUpdate, setForceUpdate] = useState(0)
  const [imageSupport] = useState(true) // Force rebuild for image support
  const [trafficUpdate] = useState(0) // Force rebuild for traffic text change
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    category: 'all',
    source: 'all',
    dateRange: 'all',
    sortBy: 'recent'
  })
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [savedArticles, setSavedArticles] = useState<string[]>([])
  const [favoriteArticles, setFavoriteArticles] = useState<string[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const favoritesLoadedForUser = useRef<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFiltersType>({
    dateFilter: 'all',
    customStartDate: '',
    customEndDate: '',
    searchKeyword: ''
  })
  const [archivedArticles, setArchivedArticles] = useState<Article[]>([]);
  const [semaineActuelleArticles, setSemaineActuelleArticles] = useState<Article[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingStats, setTrendingStats] = useState<any>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archivePage, setArchivePage] = useState(1)
  const [archiveHasMore, setArchiveHasMore] = useState(true)
  const [archiveTotalCount, setArchiveTotalCount] = useState(0)
  const [showMobileAIButton, setShowMobileAIButton] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const widgetsAreaRef = useRef<HTMLDivElement | null>(null)
  const widgetCarouselRef = useRef<HTMLDivElement | null>(null)
  const [activeWidgetIndex, setActiveWidgetIndex] = useState(0)
  const WIDGET_COUNT = 5
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // État et fonction pour le menu mobile (comme page veille)
  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);
    
    // Force DOM update pour production
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const sidebar = document.querySelector('aside');
        if (sidebar && newState) {
          sidebar.style.transform = 'translateX(0)';
          sidebar.style.visibility = 'visible';
        }
      }, 0);
    }
  };

  // Contrôle de visibilité du bouton IA mobile selon le scroll
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleScroll = () => {
      try {
        const el = widgetsAreaRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        // Lorsque le bas de la zone widgets est passé au-dessus du header (~80px),
        // on considère que l'utilisateur est dans la section articles
        const threshold = 80
        const inArticles = rect.bottom <= threshold
        setShowMobileAIButton(inArticles)
      } catch {}
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  // Détection du widget actif dans le carousel mobile
  useEffect(() => {
    const el = widgetCarouselRef.current
    if (!el) return
    const onScroll = () => {
      const scrollLeft = el.scrollLeft
      const itemWidth = el.firstElementChild?.firstElementChild?.clientWidth || 300
      const gap = 12 // gap-3 = 0.75rem = 12px
      const index = Math.round(scrollLeft / (itemWidth + gap))
      setActiveWidgetIndex(Math.min(index, WIDGET_COUNT - 1))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        // Auto-refresh activé - rechargement des articles
        handleTabChange(activeTab)
      }, 30000) // Refresh toutes les 30 secondes
      
      setRefreshInterval(interval)
      
      return () => {
        if (interval) {
          clearInterval(interval)
        }
        if (refreshInterval) {
          clearInterval(refreshInterval)
        }
        setRefreshInterval(null)
      }
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [autoRefreshEnabled, activeTab])

  // Déclenchement du VideoModal au lancement (1 fois par session)
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Vérifier si l'utilisateur a déjà vu la vidéo aujourd'hui
    const today = new Date().toDateString()
    const lastShown = localStorage.getItem('videoModalLastShown')
    
    if (lastShown !== today) {
      // Délai de 2 secondes avant d'afficher le modal (pour laisser la page charger)
      const timer = setTimeout(() => {
        setShowVideoModal(true)
        localStorage.setItem('videoModalLastShown', today)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  // Fonctions utilitaires
  const formatViewCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  const [trendingArticles, setTrendingArticles] = useState<Article[]>([])
  const [trendingPeriod, setTrendingPeriod] = useState<'day' | 'week'>('week')

  const getCurrentTrendingArticles = () => {
    return trendingArticles
  }

  // Fonction pour récupérer les articles tendance depuis l'API
  const fetchTrendingArticles = async (period: 'day' | 'week' = 'week') => {
    try {
      // Cache rapide pour affichage instantané
      try {
        if (typeof window !== 'undefined') {
          const cacheKey = `trending_cache_${period}`
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const { articles: cachedArticles } = JSON.parse(cached)
            if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
              setTrendingArticles(cachedArticles)
            }
          }
        }
      } catch {}

      // Pré-vérification rapide
      try {
        const health = await fetch(`${API_URL}/api/articles/trending?health=1&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
        if (!health.ok) throw new Error('health not ok')
      } catch {
        // Fallback: tenter d'abord le cache local
        try {
          if (typeof window !== 'undefined') {
            const cacheKey = `trending_cache_${period}`
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
              const { articles: cachedArticles } = JSON.parse(cached)
              if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                setTrendingArticles(cachedArticles)
                return cachedArticles
              }
            }
          }
        } catch {}

        // Fallback instantané basé sur les vues locales
        const fallbackTrending = articles
          .filter(article => article.views && article.views > 0)
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 10)
        setTrendingArticles(fallbackTrending)
        return fallbackTrending
      }

      // Récupération des articles tendance (Top 10 comme demandé)
      // On récupère 'week' pour avoir le top 10 global (jour + semaine)
      const response = await fetch(`${API_URL}/api/articles/trending?period=${period}&limit=10&_t=${Date.now()}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.articles) {
          // Articles tendance récupérés (déjà limités à 10 par l'API)
          setTrendingArticles(result.articles)
          try {
            if (typeof window !== 'undefined') {
              const cacheKey = `trending_cache_${period}`
              localStorage.setItem(cacheKey, JSON.stringify({ articles: result.articles, timestamp: Date.now() }))
            }
          } catch {}
          return result.articles
        }
      } else {
        console.warn('⚠️ Erreur lors de la récupération des tendances:', response.status)
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des tendances:', error)
    }
    
    // Fallback: utiliser les articles locaux avec tri par vues (Top 10)
    const fallbackTrending = articles
      .filter(article => article.views && article.views > 0)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
    
    setTrendingArticles(fallbackTrending)
    return fallbackTrending
  }

  const getFavoriteArticles = () => {
    return articles.filter(article => favoriteArticles.includes(article.id))
  }

  // State pour dates précises
  const [searchDateFrom, setSearchDateFrom] = useState('')
  const [searchDateTo, setSearchDateTo] = useState('')

  // Recherche API (pour queries textuelles - cherche dans TOUS les articles)
  const searchViaAPI = useCallback(async (query: string) => {
    try {
      const body: any = {
        query,
        limit: 50,
        offset: 0
      }
      if (selectedCategory !== 'all') body.category = selectedCategory
      if (selectedSource !== 'all') body.source = selectedSource
      if (searchDateFrom) body.dateFrom = searchDateFrom
      if (searchDateTo) body.dateTo = searchDateTo

      const res = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success && data.articles) {
        const mapped = data.articles.map((a: any) => ({
          ...a,
          source: a.rss_feeds?.name || a.source || '',
          imageUrl: a.image_url || (a.image_urls && a.image_urls[0]) || null,
          published_at: a.published_at || '',
          viewCount: formatViewCount(a.view_count || 0),
          views: a.view_count || 0
        }))
        setDisplayedArticles(mapped)
      }
    } catch (error) {
      console.error('Erreur recherche API:', error)
    }
  }, [selectedCategory, selectedSource, searchDateFrom, searchDateTo, API_URL])

  // Fonction de recherche dynamique optimisée avec useCallback pour éviter les boucles
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)

    const searchTerm = query.toLowerCase().trim()

    // Si query textuelle >= 3 chars, utiliser l'API search (cherche dans TOUS les articles)
    if (searchTerm.length >= 3) {
      searchViaAPI(query)
      return
    }

    // Sinon, filtrage client-side sur les articles chargés
    let articlesToFilter: Article[] = []
    switch (activeTab) {
      case 'pour-vous':
        articlesToFilter = articles
        break
      case 'semaine-actuelle':
        articlesToFilter = semaineActuelleArticles
        break
      case 'tendances':
        articlesToFilter = getCurrentTrendingArticles()
        break
      case 'favoris':
        articlesToFilter = getFavoriteArticles()
        break
      case 'archives':
        articlesToFilter = archivedArticles
        break
      default:
        articlesToFilter = articles
    }

    // Filtrage client-side
    const filtered = articlesToFilter.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(searchTerm)
      const summaryMatch = article.summary.toLowerCase().includes(searchTerm)
      const sourceMatch = article.source.toLowerCase().includes(searchTerm)
      const categoryMatch = article.category?.toLowerCase().includes(searchTerm)
      const authorMatch = article.author && article.author.toLowerCase().includes(searchTerm)
      const contentMatch = article.content && article.content.toLowerCase().includes(searchTerm)

      const matchesQuery = query.trim() === '' || titleMatch || summaryMatch || sourceMatch || categoryMatch || authorMatch || contentMatch
      const matchesSource = selectedSource === '' || selectedSource === 'all' || article.media_name === selectedSource || article.source === selectedSource

      const matchesCategory = selectedCategory === '' || selectedCategory === 'all' || (() => {
        const articleCategory = (article.category || '').toLowerCase()
        const selectedCat = selectedCategory.toLowerCase()
        return articleCategory === selectedCat || articleCategory.includes(selectedCat)
      })()

      // Filtre par date
      let matchesDate = true
      if (selectedDateRange !== 'all' && (article.published_at || article.created_at)) {
        const articleDate = new Date(article.published_at || article.created_at || Date.now())
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        if (selectedDateRange === 'today') {
          matchesDate = articleDate >= today
        } else if (selectedDateRange === 'week') {
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          matchesDate = articleDate >= weekAgo
        } else if (selectedDateRange === 'month') {
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          matchesDate = articleDate >= monthAgo
        }
      }

      // Filtre par date precise
      if (searchDateFrom && (article.published_at || article.created_at)) {
        const articleDate = new Date(article.published_at || article.created_at || 0)
        if (articleDate < new Date(searchDateFrom)) return false
      }
      if (searchDateTo && (article.published_at || article.created_at)) {
        const articleDate = new Date(article.published_at || article.created_at || 0)
        if (articleDate > new Date(searchDateTo + 'T23:59:59')) return false
      }

      return matchesQuery && matchesSource && matchesCategory && matchesDate
    })

    // Tri selon le filtre selectedSortBy
    const sortedFiltered = filtered.sort((a, b) => {
      if (selectedSortBy === 'popular') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (selectedSortBy === 'recent') {
        const dateA = new Date(a.published_at || a.created_at || 0).getTime()
        const dateB = new Date(b.published_at || b.created_at || 0).getTime()
        return dateB - dateA
      } else if (selectedSortBy === 'relevant') {
        const aTitle = a.title.toLowerCase().includes(searchTerm) ? 3 : 0
        const aSummary = a.summary.toLowerCase().includes(searchTerm) ? 2 : 0
        const aContent = a.content && a.content.toLowerCase().includes(searchTerm) ? 1 : 0
        const aOther = (a.source.toLowerCase().includes(searchTerm) ||
                       (a.author && a.author.toLowerCase().includes(searchTerm))) ? 0.5 : 0

        const bTitle = b.title.toLowerCase().includes(searchTerm) ? 3 : 0
        const bSummary = b.summary.toLowerCase().includes(searchTerm) ? 2 : 0
        const bContent = b.content && b.content.toLowerCase().includes(searchTerm) ? 1 : 0
        const bOther = (b.source.toLowerCase().includes(searchTerm) ||
                       (b.author && b.author.toLowerCase().includes(searchTerm))) ? 0.5 : 0

        return (bTitle + bSummary + bContent + bOther) - (aTitle + aSummary + aContent + aOther)
      }
      return 0
    })

    setDisplayedArticles(sortedFiltered)
  }, [selectedSource, selectedCategory, selectedDateRange, selectedSortBy, articles, semaineActuelleArticles, archivedArticles, favoriteArticles, activeTab, searchViaAPI, searchDateFrom, searchDateTo])


  // Fonction pour récupérer les articles selon l'onglet sélectionné
  const fetchArticlesByTab = async (tab: string) => {
    try {
      // Récupération des articles pour l'onglet
      
      const response = await axios.get(`${API_URL}/api/articles?tab=${tab}&_t=${Date.now()}`)
      
      if (response.data.success) {
        const fetchedArticles = response.data.articles || []
        // Articles récupérés
        return fetchedArticles
      } else {
        console.warn('⚠️ Aucun article trouvé')
        return []
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des articles pour ${tab}:`, error)
      setError(`Erreur lors du chargement des articles`)
      return []
    } finally {}
  }

  // Fonction optimisée pour la page d'accueil (cache intelligent + timeout court)
  const fetchHomepageArticles = async () => {
    try {
      // Vérification cache local (5 minutes de validité)
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('homepage_articles_cache')
          if (cached) {
            const { articles, timestamp } = JSON.parse(cached)
            const cacheAge = Date.now() - timestamp
            
            // Utiliser le cache si moins de 30 secondes
            if (cacheAge < 30 * 1000) {
              return articles
            }
          }
        } catch (e) {
          // Cache corrompu, continuer avec fetch
        }
      }
      
      // 🚀 Utiliser Railway API directement (fonctions Netlify dupliquées supprimées)
      let response
      try {
        // Health check rapide
        const health = await axios.get(`${API_URL}/api/articles/home?health=1&_t=${Date.now()}`, { timeout: 4000 })
        if (!(health?.status === 200 && (health.data?.ok || health.data?.success))) {
          throw new Error('Health not OK')
        }
      } catch (e) {
        // Health NOK: retourner le cache récent si présent, sinon vide
        if (typeof window !== 'undefined') {
          try {
            const cachedAny = localStorage.getItem('homepage_articles_cache')
            if (cachedAny) {
              const { articles, timestamp } = JSON.parse(cachedAny)
              if (Date.now() - timestamp < 60 * 1000) return articles || []
            }
          } catch {}
        }
        return []
      }

      // Charger les articles depuis Railway
      response = await axios.get(`${API_URL}/api/homepage/articles?_t=${Date.now()}`, {
        timeout: 30000,
      })
      console.log('✅ Articles chargés via Railway')
      
      if (response.data.success) {
        const fetchedArticles = response.data.articles || []
        // Articles RSS récupérés pour la page d'accueil
        
        // Validation des articles
        const validArticles = fetchedArticles.filter((article: Article) => 
          article && article.title && article.title.trim() !== ''
        )
        
        if (validArticles.length === 0) {
          console.warn('⚠️ Aucun article valide trouvé')
          return []
        }
        
        // PAS DE TRI - Garder l'ordre du backend (published_at DESC de Supabase)
        // Le backend envoie déjà les articles triés par published_at DESC
        const sortedArticles = validArticles
        
        // Ajout simple du displayTime optimisé
        const articlesWithDisplayTime = sortedArticles.map((article: Article) => ({
          ...article,
          displayTime: article.publishedAt || '—'
        }))
        
        // Sauvegarder en cache local optimisé
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('homepage_articles_cache', JSON.stringify({
              articles: articlesWithDisplayTime,
              timestamp: Date.now()
            }))
          } catch (error) {
            console.warn('Erreur sauvegarde cache:', error)
          }
        }
        
        console.log(`✅ ${articlesWithDisplayTime.length} articles chargés pour la page d'accueil`)
        return articlesWithDisplayTime
      } else {
        console.warn('⚠️ Réponse API non réussie:', response.data)
        return []
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des articles de la page d\'accueil:', error)
      // Tentative de récupération depuis le cache local
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('homepage_articles_cache')
          if (cached) {
            const { articles, timestamp } = JSON.parse(cached)
            const cacheAge = Date.now() - timestamp
            
            // Utiliser le cache si moins de 1 minute (fallback erreur)
            if (cacheAge < 60 * 1000) {
              return articles
            }
          }
        } catch (e) {
          console.warn('⚠️ Erreur lors de la lecture du cache local:', e)
        }
      }
      
      setError('Erreur lors du chargement des articles de la page d\'accueil')
      return []
    }
  }

  // Nouvelle fonction spécifique pour la semaine actuelle (36h-7j) - API corrigée
  const fetchSemaineActuelleArticles = async () => {
    try {
      // Cache rapide pour affichage instantané
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('week_articles_cache')
          if (cached) {
            const { articles: cachedArticles } = JSON.parse(cached)
            if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
              setSemaineActuelleArticles(cachedArticles)
            }
          }
        }
      } catch {}
      console.log('📅 Chargement articles de la semaine (36h-7j)...')
      // Pré-vérification rapide
      try {
        const health = await fetch(`${API_URL}/api/articles/week?health=1&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
        if (!health.ok) throw new Error('health not ok')
      } catch {
        // Fallback: conserver les articles en mémoire si présents
        if (semaineActuelleArticles.length > 0) return semaineActuelleArticles
        // Essayer cache local
        try {
          if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('week_articles_cache')
            if (cached) {
              const { articles: cachedArticles } = JSON.parse(cached)
              if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                return cachedArticles
              }
            }
          }
        } catch {}
        return []
      }

      const response = await axios.get(`${API_URL}/api/articles/week?_t=${Date.now()}`)
      
      if (response.data.success) {
        const fetchedArticles = response.data.articles || []
        // console.log(`📊 Articles semaine chargés: ${fetchedArticles.length}`)
        
        // Les articles sont déjà triés par date dans l'API
        setSemaineActuelleArticles(fetchedArticles)
        try { if (typeof window !== 'undefined') localStorage.setItem('week_articles_cache', JSON.stringify({ articles: fetchedArticles, timestamp: Date.now() })) } catch {}
        return fetchedArticles
      } else {
        console.warn('⚠️ Aucun article trouvé pour la semaine actuelle')
        setSemaineActuelleArticles([])
        return []
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des articles de la semaine:', error)
      setError('Erreur lors du chargement des articles de la semaine')
      setSemaineActuelleArticles([])
      return []
    } finally {}
  }

  // Gestion des changements d'onglets (optimisé pour éviter le rechargement complet)
  const handleTabChange = async (tab: string) => {
    if (tab === activeTab && tab === 'pour-vous') {
      // Refresh contrôlé: ne pas vider l'UI en cas d'erreur/timeout
      const homepageArticles = await fetchHomepageArticles()
      if (Array.isArray(homepageArticles) && homepageArticles.length > 0) {
        setArticles(homepageArticles)
        setDisplayedArticles(homepageArticles)
      }
      return
    }
    
    if (tab === activeTab) return
    
    // Changement d'onglet
    setActiveTab(tab)
    setSearchQuery('')
    setSelectedSource('')
    
    // Affichage immédiat des données en cache si disponibles
    switch (tab) {
      case 'pour-vous':
        setDisplayedArticles(articles)
        // Toujours recharger les articles pour avoir les plus récents, sans vider l'UI si vide
        fetchHomepageArticles().then((homepageArticles) => {
          if (Array.isArray(homepageArticles) && homepageArticles.length > 0) {
            setArticles(homepageArticles)
            if (activeTab === 'pour-vous') setDisplayedArticles(homepageArticles)
          }
        }).catch(() => {})
        break
        
      case 'semaine-actuelle':
        if (semaineActuelleArticles.length > 0) {
          setDisplayedArticles(semaineActuelleArticles)
        } else {
          // Essayer cache local immédiat
          try {
            if (typeof window !== 'undefined') {
              const cached = localStorage.getItem('week_articles_cache')
              if (cached) {
                const { articles: cachedArticles } = JSON.parse(cached)
                if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                  setDisplayedArticles(cachedArticles)
                }
              }
            }
          } catch {}
          // Précharger en arrière-plan
          fetchSemaineActuelleArticles().then(setDisplayedArticles).catch(() => {})
        }
        break
        
      case 'archives':
        if (archivedArticles.length > 0) {
          setDisplayedArticles(archivedArticles)
        } else {
          fetchArticlesByTab('archives').then((archiveArticles) => {
            setArchivedArticles(archiveArticles)
            if (activeTab === 'archives') setDisplayedArticles(archiveArticles)
          }).catch(() => {})
        }
        break
        
      case 'favoris':
        setDisplayedArticles(getFavoriteArticles())
        break
        
      case 'tendances':
        if (trendingArticles.length > 0) {
          setDisplayedArticles(trendingArticles)
        } else {
          // Essayer cache local immédiat
          try {
            if (typeof window !== 'undefined') {
              const cacheKey = `trending_cache_${trendingPeriod}`
              const cached = localStorage.getItem(cacheKey)
              if (cached) {
                const { articles: cachedArticles } = JSON.parse(cached)
                if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                  setDisplayedArticles(cachedArticles)
                }
              }
            }
          } catch {}
          // Précharger en arrière-plan
          fetchTrendingArticles(trendingPeriod).then(setDisplayedArticles).catch(() => {})
        }
        break
      
      default:
        setDisplayedArticles(articles)
    }
  }

  // Chargement initial optimisé: afficher cache immédiat + rafraîchir en arrière-plan
  useEffect(() => {
    const loadInitialArticles = async () => {
      setError(null)

      let showedCache = false
      // 1) Tenter d'afficher immédiatement le cache local, même s'il est ancien (SWR)
      if (typeof window !== 'undefined') {
        try {
          const cachedAny = localStorage.getItem('homepage_articles_cache')
          if (cachedAny) {
            const { articles: cachedArticles } = JSON.parse(cachedAny)
            if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
              setArticles(cachedArticles)
              setDisplayedArticles(cachedArticles)
              setLoading(false)
              showedCache = true
            }
          }
        } catch {}
      }

      // 2) Rafraîchir en arrière-plan
      fetchHomepageArticles()
        .then((fresh) => {
          if (Array.isArray(fresh) && fresh.length > 0) {
            setArticles(fresh)
            if (activeTab === 'pour-vous') setDisplayedArticles(fresh)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!showedCache) setLoading(false)
        })

      // 3) Préchargement silencieux des autres onglets
      try { fetchTrendingArticles('week') } catch {}
      try { fetchSemaineActuelleArticles() } catch {}
    }
    
    loadInitialArticles()
  }, [])

  // Realtime: mettre à jour les compteurs de vues en direct
  useEffect(() => {
    // S'abonner aux mises à jour de la table articles (view_count) et rss_article_views
    const channel = supabase
      .channel('views_live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'articles' }, (payload: any) => {
        const row = (payload as any)?.new
        if (!row?.id) return
        const newCount = Number(row.view_count || 0)
        setArticles(prev => prev.map(a => a.id === row.id ? { ...a, view_count: newCount, views: newCount } : a))
        setDisplayedArticles(prev => prev.map(a => a.id === row.id ? { ...a, view_count: newCount, views: newCount } : a))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rss_article_views' }, (payload: any) => {
        const row = (payload as any)?.new
        if (!row) return
        const url = row.url as string | undefined
        const newCount = Number(row.view_count || 0)
        if (!url) return
        setArticles(prev => prev.map(a => (a.url === url ? { ...a, view_count: newCount, views: newCount } : a)))
        setDisplayedArticles(prev => prev.map(a => (a.url === url ? { ...a, view_count: newCount, views: newCount } : a)))
      })
      .subscribe((status: string, err: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connecté au canal Realtime views_live')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Canal Realtime views_live indisponible (non-bloquant)')
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Timeout connexion Realtime - tentative de reconnexion automatique...')
        } else if (status === 'CLOSED') {
          console.log('Deconnecté du canal Realtime')
        }
      })

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [])

  // Fonction pour mettre à jour les articles affichés selon l'onglet actif
  const updateDisplayedArticles = () => {
    if (searchQuery.trim()) {
      return // Ne pas interférer avec la recherche active
    }

    switch (activeTab) {
      case 'pour-vous':
        setDisplayedArticles(articles)
        break
      case 'semaine-actuelle':
        setDisplayedArticles(semaineActuelleArticles)
        break
      case 'tendances':
        setDisplayedArticles(trendingArticles)
        break
      case 'favoris':
        setDisplayedArticles(getFavoriteArticles())
        break
      case 'archives':
        setDisplayedArticles(archivedArticles)
        break
      default:
        setDisplayedArticles(articles)
    }
  }

  // Effet pour mettre à jour l'affichage quand les articles changent (sans rechargement)
  useEffect(() => {
    updateDisplayedArticles()
  }, [articles, semaineActuelleArticles, archivedArticles, trendingArticles, activeTab, favoriteArticles])

  // Fallback optimisé pour s'assurer que les articles s'affichent (une seule fois)
  useEffect(() => {
    if (activeTab === 'pour-vous' && articles.length > 0 && displayedArticles.length === 0 && !loading) {
      setDisplayedArticles(articles)
    }
  }, [articles.length, displayedArticles.length, loading]) // Dépendances optimisées

  // Effet pour déclencher le filtrage quand les filtres changent
  const prevFiltersRef = useRef({
    source: selectedSource,
    category: selectedCategory,
    dateRange: selectedDateRange,
    sortBy: selectedSortBy,
    tab: activeTab,
    query: searchQuery
  })

  useEffect(() => {
    const prev = prevFiltersRef.current
    const hasChanged = 
      prev.source !== selectedSource ||
      prev.category !== selectedCategory ||
      prev.dateRange !== selectedDateRange ||
      prev.sortBy !== selectedSortBy ||
      prev.tab !== activeTab ||
      prev.query !== searchQuery

    if (hasChanged) {
      console.log('🔄 Filtres changés - Mise à jour des articles', { 
        selectedCategory, 
        selectedSource, 
        selectedDateRange, 
        selectedSortBy 
      })
      prevFiltersRef.current = {
        source: selectedSource,
        category: selectedCategory,
        dateRange: selectedDateRange,
        sortBy: selectedSortBy,
        tab: activeTab,
        query: searchQuery
      }
    }
    
    // Toujours appeler handleSearch pour maintenir la cohérence du filtrage
    handleSearch(searchQuery)
  }, [selectedSource, selectedCategory, selectedDateRange, selectedSortBy, activeTab, handleSearch, searchQuery])

  // Gestion des clics sur les onglets
  const handleTabClick = (e: React.MouseEvent, tab: string) => {
    e.preventDefault()
    e.stopPropagation()
    handleTabChange(tab)
  }

  // Charger les favoris de l'utilisateur (avec protection contre les appels multiples)
  const loadFavorites = async (force = false) => {
    if (!user) {
      return
    }

    // Éviter les chargements redondants pour le même utilisateur
    if (!force && favoritesLoadedForUser.current === user.id) {
      return
    }

    console.log('📥 Chargement des favoris pour:', user.id)
    favoritesLoadedForUser.current = user.id
    try {
      const { favorites: userFavorites } = await getFavorites()
      setFavorites(userFavorites)
      setFavoriteArticles(userFavorites.map(fav => fav.article_id))
    } catch (error) {
      console.error('❌ Erreur chargement favoris:', error)
      favoritesLoadedForUser.current = null // Permettre un retry en cas d'erreur
    }
  }

  // Charger les favoris quand l'utilisateur se connecte
  useEffect(() => {
    if (user) {
      loadFavorites()
    } else {
      setFavorites([])
      setFavoriteArticles([])
      favoritesLoadedForUser.current = null
    }
  }, [user])

  // Gestion des actions sur les articles
  const handleArticleClick = async (article: Article) => {
    try {
      // 1. Enregistrer dans l'historique de lecture directement via Supabase (si user connecté)
      if (user) {
        try {
          // Valider et convertir la date de publication
          let validPublishedAt = null
          const rawDate = article.publishedAt || article.published_at || article.created_at
          if (rawDate) {
            try {
              const parsedDate = new Date(rawDate)
              if (!isNaN(parsedDate.getTime())) {
                validPublishedAt = parsedDate.toISOString()
              }
            } catch {}
          }

          const { error } = await supabase
            .from('user_reading_history')
            .upsert({
              user_id: user.id,
              article_id: String(article.id),
              article_title: article.title || null,
              article_summary: article.summary || null,
              article_url: article.url || null,
              article_source: article.source || null,
              article_category: article.category || null,
              article_published_at: validPublishedAt,
              image_url: article.imageUrl || null,
              reading_duration: 0,
              device_type: 'web',
              read_at: new Date().toISOString(),
              reading_progress: 100
            }, {
              onConflict: 'user_id,article_id'
            })

          if (error) {
            console.error('❌ Erreur Supabase historique:', error)
          } else {
            console.log('✅ Article ajouté à l\'historique (Supabase direct):', article.id)
          }
        } catch (historyError) {
          console.error('❌ Erreur enregistrement historique:', historyError)
        }
      }

      // 2. Tracking des vues - solution de fallback locale
      try {
        // Tentative avec la fonction Netlify
        const response = await fetch(`${API_URL}/api/articles/${article.id}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articleId: article.id,
            title: article.title,
            url: article.url || '',
            source: article.source,
            imageUrl: article.imageUrl
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          // Vue trackée
          
          // Mettre à jour l'état local pour affichage temps réel
          setArticles(prevArticles =>
            prevArticles.map(a =>
              a.id === article.id
                ? { ...a, views: result.viewCount, view_count: result.viewCount }
                : a
            )
          )
        } else {
          // Fallback: tracking local dans localStorage
          const viewKey = `article_view_${article.id}`
          const currentViews = parseInt(localStorage.getItem(viewKey) || '0')
          const newViews = currentViews + 1
          localStorage.setItem(viewKey, newViews.toString())
          // Vue trackée localement
          
          // Mettre à jour l'état local
          setArticles(prevArticles =>
            prevArticles.map(a =>
              a.id === article.id
                ? { ...a, views: newViews, view_count: newViews }
                : a
            )
          )
        }
      } catch (viewError) {
        // Fallback: tracking local dans localStorage
        const viewKey = `article_view_${article.id}`
        const currentViews = parseInt(localStorage.getItem(viewKey) || '0')
        const newViews = currentViews + 1
        localStorage.setItem(viewKey, newViews.toString())
        // Vue trackée localement (fallback)
        
        // Mettre à jour l'état local
        setArticles(prevArticles => 
          prevArticles.map(a => 
            a.id === article.id 
              ? { ...a, views: newViews }
              : a
          )
        )
      }
      
      // 3. Ouvrir l'article
      if (article.url) {
        window.open(article.url, '_blank')
      } else {
        // Fallback si pas d'URL : recherche Google de l'article
        const searchQuery = encodeURIComponent(`${article.title} ${article.source}`)
        window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank')
      }
    } catch (error) {
      console.error('Erreur lors du clic sur l\'article:', error)
      // Même en cas d'erreur de tracking, ouvrir l'article
      if (article.url) {
        window.open(article.url, '_blank')
      } else {
        const searchQuery = encodeURIComponent(`${article.title} ${article.source}`)
        window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank')
      }
    }
  }

  // Gestion des favoris
  const toggleFavorite = async (articleId: string) => {
    console.log('🔖 Toggle favoris appelé:', { articleId, user: !!user, favoriteArticles })
    
    if (!user) {
      console.log('❌ Utilisateur non connecté - affichage modal')
      setShowAuthModal(true)
      return
    }

    const article = articles.find(a => a.id === articleId)
    if (!article) {
      console.log('❌ Article non trouvé:', articleId)
      return
    }

    const isFav = favoriteArticles.includes(articleId)
    console.log('📊 État actuel:', { isFav, articleId, favoriteArticles })

    try {
      if (isFav) {
        console.log('➖ Retrait du favori...')
        // Mise à jour optimiste AVANT l'appel API
        setFavoriteArticles(prev => prev.filter(id => id !== articleId))
        setFavorites(prev => prev.filter(fav => fav.article_id !== articleId))
        
        const result = await removeFromFavorites(
          articleId,
          article.title,
          article.url,
          article.source
        )
        console.log('📤 Résultat retrait:', result)
        if (result.success) {
          showNotification('Article retiré des favoris', 'success')
        } else {
          // Rollback en cas d'échec
          setFavoriteArticles(prev => [...prev, articleId])
          showNotification(result.error || 'Erreur lors de la suppression', 'error')
        }
      } else {
        console.log('➕ Ajout au favori...')
        // Mise à jour optimiste AVANT l'appel API
        setFavoriteArticles(prev => [...prev, articleId])
        
        const result = await addToFavorites({
          id: articleId,
          title: article.title,
          url: article.url,
          source: article.source,
          image_url: article.imageUrl
        })
        console.log('📤 Résultat ajout:', result)
        if (result.success) {
          // Ne pas recharger loadFavorites() pour éviter d'écraser l'état optimiste
          // L'état local est déjà à jour
          showNotification('Article ajouté aux favoris', 'success')
          console.log('✅ Favori ajouté avec succès')
        } else {
          // Rollback en cas d'échec
          setFavoriteArticles(prev => prev.filter(id => id !== articleId))
          console.log('❌ Échec ajout:', result.error)
          showNotification(result.error || 'Erreur lors de l\'ajout', 'error')
        }
      }
    } catch (error) {
      console.error('❌ Erreur toggle favorite:', error)
      showNotification('Erreur lors de la gestion des favoris', 'error')
    }
  }

  // Vérifier si un article est en favoris
  const isFavoriteFunc = (articleId: string) => {
    return favoriteArticles.includes(articleId)
  }

  // Afficher une notification
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // Gestion de l'authentification
  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    showNotification('Connexion réussie !', 'success')
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      showNotification('Déconnexion réussie', 'success')
    } catch (error) {
      showNotification('Erreur lors de la déconnexion', 'error')
    }
  }

  const handleSaveArticle = (articleId: string) => {
    setSavedArticles(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    )
  }

  const handleShare = (article: Article) => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: article.url,
      })
    } else {
      navigator.clipboard.writeText(article.url || '')
      setNotification({
        message: 'Lien copié dans le presse-papiers',
        type: 'success'
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  // Fonction toggleFavorite remplacée par la version avec authentification ci-dessus

  const isFavorite = (articleId: string) => favoriteArticles.includes(articleId)

  if (loading && displayedArticles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center"> {/* Updated 2025-09-16 20:43 */}
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des articles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={toggleMobileMenu} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => {
            // Mobile menu fermé
            setIsMobileMenuOpen(false);
          }}
        />
        
        <div className="flex-1 lg:ml-64 lg:mr-80 min-w-0">
          <main className="w-full py-4 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-2">
              
              {/* H1 SEO — conservé pour le référencement mais masqué visuellement */}
              <h1 className="sr-only">
                Actualités Gabon & Opportunités d&apos;Investissement
              </h1>

              {/* Section vidéos d'accueil (21:9, autoplay en boucle) */}
              <HeroVideos />

              {/* Zone Widgets compacts (dropdowns) — météo / sondage / trafic.
                  Repliés par défaut → les articles sont visibles juste après la vidéo. */}
              <div ref={widgetsAreaRef} className="w-full mb-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <WidgetDropdown title="Météo" icon="🌤️">
                    <LazyMount className="w-full"><WeatherWidget /></LazyMount>
                  </WidgetDropdown>
                  <WidgetDropdown title="Sondage" icon="📊">
                    <LazyMount className="w-full"><MultiQuestionPollWidget /></LazyMount>
                  </WidgetDropdown>
                  <WidgetDropdown title="Trafic" icon="🚗">
                    <LazyMount className="w-full"><RoutesMapWidget /></LazyMount>
                  </WidgetDropdown>

                  {/* Mobile uniquement : YouTube + Coupe du monde (sur desktop ils sont en barre latérale droite) */}
                  <div className="lg:hidden">
                    <WidgetDropdown title="Journal TV" icon="📺">
                      <LazyMount className="w-full">
                        <div className="w-full h-[500px] flex flex-col">
                          <YouTubeWidget className="flex-1 flex flex-col" />
                        </div>
                      </LazyMount>
                    </WidgetDropdown>
                  </div>
                  <div className="lg:hidden">
                    <WidgetDropdown title="Coupe du monde" icon="⚽">
                      <LazyMount className="w-full"><WorldCupLive className="h-[500px]" /></LazyMount>
                    </WidgetDropdown>
                  </div>
                </div>

                {/* Bannière de campagne validée */}
                <LazyMount className="w-full mt-4"><CampaignBanner /></LazyMount>
              </div>

              {/* Navigation des onglets - Design moderne et responsive */}
              <nav className="bg-white/80 backdrop-blur-lg border border-gray-100 sticky top-16 z-40 mb-4 sm:mb-6 rounded-2xl shadow-lg w-full overflow-hidden">
                <div className="w-full p-3 sm:p-4">
                  {/* Layout principal - Stack sur mobile, row sur desktop */}
                  <div className="flex flex-col gap-3">
                    
                    {/* Ligne 1: Onglets + Contrôles */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      
                      {/* Onglets avec scroll horizontal sur mobile */}
                      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                        <div className="flex items-center gap-1 sm:gap-2 min-w-max">
                          {/* Onglet Aujourd'hui */}
                          <button
                            onClick={(e) => handleTabClick(e, 'pour-vous')}
                            className={`relative flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'pour-vous'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 bg-gray-50'
                            }`}
                          >
                            <span className="text-sm sm:text-base">📰</span>
                            <span>Aujourd'hui</span>
                          </button>
                          
                          {/* Onglet Tendances */}
                          <button
                            onClick={(e) => handleTabClick(e, 'tendances')}
                            onMouseEnter={() => {
                              try {
                                if (typeof window !== 'undefined') {
                                  const cached = localStorage.getItem('trending_cache_week')
                                  if (!cached) fetchTrendingArticles('week').catch(() => {})
                                }
                              } catch {}
                            }}
                            className={`relative flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'tendances'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 bg-gray-50'
                            }`}
                          >
                            <span className="text-sm sm:text-base">🔥</span>
                            <span>Tendances</span>
                          </button>
                          
                          {/* Onglet Favoris */}
                          <button
                            onClick={(e) => handleTabClick(e, 'favoris')}
                            className={`relative flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'favoris'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 bg-gray-50'
                            }`}
                          >
                            <span className="text-sm sm:text-base">❤️</span>
                            <span>Favoris</span>
                          </button>
                          
                          {/* Onglet Cette semaine */}
                          <button
                            onClick={(e) => handleTabClick(e, 'semaine-actuelle')}
                            onMouseEnter={() => {
                              try {
                                if (typeof window !== 'undefined') {
                                  const cached = localStorage.getItem('week_articles_cache')
                                  if (!cached) fetchSemaineActuelleArticles().catch(() => {})
                                }
                              } catch {}
                            }}
                            className={`relative flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'semaine-actuelle'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/80 bg-gray-50'
                            }`}
                          >
                            <span className="text-sm sm:text-base">📅</span>
                            <span className="hidden xs:inline">Cette </span>semaine
                          </button>
                        </div>
                      </div>
                      
                      {/* Contrôles Auto-refresh et Actualiser */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle Auto-refresh compact */}
                        <button
                          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                            autoRefreshEnabled
                              ? 'bg-green-500 text-white shadow-md shadow-green-500/25'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full transition-all ${autoRefreshEnabled ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></div>
                          <span className="hidden sm:inline">Auto</span>
                          <span className={autoRefreshEnabled ? 'text-green-100' : 'text-gray-500'}>{autoRefreshEnabled ? 'ON' : 'OFF'}</span>
                        </button>
                        
                        {/* Bouton Actualiser */}
                        <button
                          onClick={() => handleTabChange(activeTab)}
                          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                          </svg>
                          <span className="hidden sm:inline">Actualiser</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Ligne 2: Barre de recherche */}
                    <SearchWidget
                      onSearch={handleSearch}
                      searchQuery={searchQuery}
                      selectedSource={selectedSource}
                      onSourceChange={setSelectedSource}
                      selectedCategory={selectedCategory}
                      onCategoryChange={setSelectedCategory}
                      selectedDateRange={selectedDateRange}
                      onDateRangeChange={setSelectedDateRange}
                      selectedSortBy={selectedSortBy}
                      onSortByChange={setSelectedSortBy}
                      dateFrom={searchDateFrom}
                      dateTo={searchDateTo}
                      onDateFromChange={setSearchDateFrom}
                      onDateToChange={setSearchDateTo}
                    />
                  </div>
                </div>
              </nav>

              {/* Contenu principal */}
              {loading && displayedArticles.length === 0 ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (error && displayedArticles.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-red-600">{error}</p>
                  <button 
                    onClick={() => handleTabChange(activeTab)}
                    className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                activeTab === 'pour-vous' ? (
                  <div className="space-y-6">
                    {(displayedArticles.length === 0 && articles.length === 0) ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500">Aucun article trouvé</p>
                      </div>
                    ) : (
                      <>
                        {/* Articles en vedette - 2 premiers (CORRECTION: Force re-render) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(displayedArticles.length > 0 ? displayedArticles : articles).slice(0, 2).map((article, index) => (
                            <ArticleCard
                              key={article.id}
                              article={article}
                              variant="featured"
                              onClick={() => handleArticleClick(article)}
                              onSave={() => handleSaveArticle(article.id)}
                              onShare={() => handleShare(article)}
                              onToggleFavorite={toggleFavorite}
                              isFavorite={isFavorite(article.id)}
                            />
                          ))}
                        </div>
                        
                        {/* Autres articles en liste (CORRECTION: Force re-render) */}
                        {((displayedArticles.length > 0 ? displayedArticles : articles).length > 2) && (
                          <div className="space-y-4">
                            {(displayedArticles.length > 0 ? displayedArticles : articles).slice(2).map((article, index) => (
                              <div key={article.id}>
                                <ArticleCard
                                  article={article}
                                  variant="list"
                                  onClick={() => handleArticleClick(article)}
                                  onSave={() => handleSaveArticle(article.id)}
                                  onShare={() => handleShare(article)}
                                  onToggleFavorite={toggleFavorite}
                                  isFavorite={isFavorite(article.id)}
                                />
                                {/* Insérer bannière feed après articles 6, 13 et 20 */}
                                {/* Comme les 2 premiers sont en featured, on ajuste: index 4, 11, 18 */}
                                {(index === 4 || index === 11 || index === 18) && (
                                  <FeedBannerAd position={index + 3} />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : activeTab === 'favoris' ? (
                  <div className="space-y-4">
                    {!user ? (
                      <div className="text-center py-12">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 max-w-md mx-auto">
                          <div className="text-orange-600 mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connectez-vous pour voir vos favoris</h3>
                          <p className="text-gray-600 mb-4">Sauvegardez vos articles préférés et retrouvez-les facilement.</p>
                          <button
                            onClick={() => window.location.href = '/auth/signin'}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            Se connecter
                          </button>
                        </div>
                      </div>
                    ) : favorites.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun favori pour le moment</h3>
                        <p className="text-gray-600 mb-4">Cliquez sur le cœur des articles qui vous intéressent pour les retrouver ici.</p>
                        <button
                          onClick={() => setActiveTab('pour-vous')}
                          className="text-orange-600 hover:text-orange-700 font-medium"
                        >
                          Découvrir les articles →
                        </button>
                      </div>
                    ) : (
                      favorites.map((favorite) => (
                        <ArticleCard
                          key={favorite.article_id}
                          article={{
                            id: favorite.article_id.toString(),
                            title: favorite.article_title,
                            url: favorite.article_url || '',
                            source: favorite.article_source || '',
                            imageUrl: favorite.article_image_url || '',
                            summary: '',
                            category: 'general',
                            viewCount: '0',
                            created_at: favorite.created_at
                          }}
                          variant="list"
                          onClick={() => handleArticleClick({
                            id: favorite.article_id.toString(),
                            title: favorite.article_title,
                            url: favorite.article_url || '',
                            source: favorite.article_source || '',
                            imageUrl: favorite.article_image_url || '',
                            summary: '',
                            category: 'general',
                            viewCount: '0',
                            publishedAt: favorite.created_at,
                            view_count: 0
                          })}
                          onSave={() => handleSaveArticle(favorite.article_id.toString())}
                          onShare={() => handleShare({
                            id: favorite.article_id.toString(),
                            title: favorite.article_title,
                            url: favorite.article_url || '',
                            source: favorite.article_source || '',
                            imageUrl: favorite.article_image_url || '',
                            summary: '',
                            category: 'general',
                            viewCount: '0',
                            publishedAt: favorite.created_at,
                            view_count: 0
                          })}
                          onToggleFavorite={toggleFavorite}
                          isFavorite={true}
                        />
                      ))
                    )}
                  </div>
                ) : activeTab === 'semaine-actuelle' ? (
                  <div className="space-y-6">
                    {/* Header pour l'onglet Cette semaine */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Articles de la semaine</h2>
                          <p className="text-sm text-gray-600">Publiés entre 36h et 7 jours</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>📊 {displayedArticles.length} articles</span>
                        <span>•</span>
                        <span>🕒 Mis à jour automatiquement</span>
                      </div>
                    </div>

                    {/* Articles en liste - Même affichage que Home */}
                    {displayedArticles.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun article de la semaine</h3>
                        <p className="text-gray-600">Les articles de cette période s'afficheront ici automatiquement.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedArticles.map((article, index) => (
                          <div key={article.id}>
                            <ArticleCard
                              article={article}
                              variant="list"
                              onClick={() => handleArticleClick(article)}
                              onSave={() => handleSaveArticle(article.id)}
                              onShare={() => handleShare(article)}
                              onToggleFavorite={toggleFavorite}
                              isFavorite={isFavorite(article.id)}
                            />
                            {/* Insérer bannière feed après articles 6, 13 et 20 (positions 7, 14, 21) */}
                            {(index === 6 || index === 13 || index === 20) && (
                              <FeedBannerAd position={index + 1} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeTab === 'tendances' ? (
                  <div className="space-y-6">
                    {/* Header moderne avec filtres période */}
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-gray-900">Articles Tendance</h2>
                            <p className="text-sm text-gray-600">Les plus consultés en temps réel</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2 bg-white rounded-lg p-1 shadow-sm">
                            <button
                              onClick={() => {
                                setTrendingPeriod('day')
                                // Affichage instantané du cache local si dispo
                                try {
                                  if (typeof window !== 'undefined') {
                                    const cached = localStorage.getItem('trending_cache_day')
                                    if (cached) {
                                      const { articles: cachedArticles } = JSON.parse(cached)
                                      if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                                        setTrendingArticles(cachedArticles)
                                        if (activeTab === 'tendances') setDisplayedArticles(cachedArticles)
                                      }
                                    }
                                  }
                                } catch {}
                                // Rafraîchissement en arrière-plan
                                fetchTrendingArticles('day')
                                  .then((fresh) => {
                                    if (Array.isArray(fresh) && fresh.length > 0 && activeTab === 'tendances') {
                                      setDisplayedArticles(fresh)
                                    }
                                  })
                                  .catch(() => {})
                              }}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                trendingPeriod === 'day'
                                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              📅 Aujourd'hui
                            </button>
                            <button
                              onClick={() => {
                                setTrendingPeriod('week')
                                // Affichage instantané du cache local si dispo
                                try {
                                  if (typeof window !== 'undefined') {
                                    const cached = localStorage.getItem('trending_cache_week')
                                    if (cached) {
                                      const { articles: cachedArticles } = JSON.parse(cached)
                                      if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
                                        setTrendingArticles(cachedArticles)
                                        if (activeTab === 'tendances') setDisplayedArticles(cachedArticles)
                                      }
                                    }
                                  }
                                } catch {}
                                // Rafraîchissement en arrière-plan
                                fetchTrendingArticles('week')
                                  .then((fresh) => {
                                    if (Array.isArray(fresh) && fresh.length > 0 && activeTab === 'tendances') {
                                      setDisplayedArticles(fresh)
                                    }
                                  })
                                  .catch(() => {})
                              }}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                                trendingPeriod === 'week'
                                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              📊 Cette semaine
                            </button>
                          </div>
                          
                          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            <span className="font-medium">{displayedArticles.length}</span>
                            <span>articles</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Liste des articles tendance avec design moderne */}
                    <div className="space-y-4">
                      {displayedArticles.length === 0 ? (
                        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                          <div className="text-gray-400 mb-6">
                            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune tendance pour le moment</h3>
                          <p className="text-gray-600 max-w-md mx-auto">Les articles les plus consultés apparaîtront ici dès qu'il y aura suffisamment d'activité.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {displayedArticles.map((article, index) => {
                            // Définir les styles de contour selon le classement
                            const getRankingStyle = (position: number) => {
                              switch (position) {
                                case 0: // 1er place - Or
                                  return 'shadow-xl bg-gradient-to-br from-yellow-100 to-orange-100'
                                case 1: // 2ème place - Argent  
                                  return 'shadow-xl bg-gradient-to-br from-gray-100 to-slate-100'
                                case 2: // 3ème place - Bronze
                                  return 'shadow-xl bg-gradient-to-br from-orange-100 to-red-100'
                                default: // Autres positions
                                  return 'shadow-lg bg-white'
                              }
                            }

                            const getRankingIcon = (position: number) => {
                              return `${position + 1}`
                            }

                            return (
                              <div key={article.id}>
                                <div 
                                  className={`relative rounded-xl transition-all duration-300 hover:scale-[1.02] ${getRankingStyle(index)}`}
                                >
                                  {/* Position indicator moderne - Rectangle pour top 3 */}
                                  <div className="absolute -top-1 -left-1 z-20">
                                    {index < 3 ? (
                                      <div className={`w-8 h-6 rounded flex items-center justify-center text-xs font-bold shadow-lg ${
                                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white' : 
                                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600 text-white' : 
                                        'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
                                      }`}>
                                        {getRankingIcon(index)}
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg bg-gradient-to-r from-blue-400 to-blue-600 text-white">
                                        {getRankingIcon(index)}
                                      </div>
                                    )}
                                  </div>


                                  <div className="p-1">
                                    <ArticleCard
                                      article={{
                                        ...article,
                                        imageUrl: article.imageUrl || '/images/default-article.jpg'
                                      }}
                                      variant="list"
                                      onClick={() => handleArticleClick(article)}
                                      onSave={() => handleSaveArticle(article.id)}
                                      onShare={() => handleShare(article)}
                                      onToggleFavorite={toggleFavorite}
                                      isFavorite={isFavorite(article.id)}
                                    />
                                  </div>
                                </div>
                                {/* Insérer bannière feed après articles 6, 13 et 20 (positions 7, 14, 21) */}
                                {(index === 6 || index === 13 || index === 20) && (
                                  <FeedBannerAd position={index + 1} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedArticles.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500">Aucun article trouvé</p>
                      </div>
                    ) : (
                      displayedArticles.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          variant="list"
                          onClick={() => handleArticleClick(article)}
                          onSave={() => handleSaveArticle(article.id)}
                          onShare={() => handleShare(article)}
                          onToggleFavorite={toggleFavorite}
                          isFavorite={isFavorite(article.id)}
                        />
                      ))
                    )}
                  </div>
                )
              )}
            </div>
          </main>
        </div>

        {/* Timestamp: 2025-10-28 - Widget Football Scores en dessous du Journal TV */}
        <aside className="hidden lg:block fixed right-0 top-16 w-80 h-screen bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          {/* 🎵 Résumé audio journalier */}
          <LazyMount><AudioPlayerBanner /></LazyMount>
          <LazyMount><YouTubeWidget /></LazyMount>
          <LazyMount><WorldCupLive /></LazyMount>
          <LazyMount><UpcomingEvents /></LazyMount>
        </aside>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Bouton retour en haut */}
      <ScrollToTop />

      {/* Bouton mobile Opportunités IA (visible uniquement quand la section articles est affichée) */}
      {showMobileAIButton && (
        <button
          onClick={() => router.push('/business/live-opportunities')}
          className="fixed bottom-20 right-4 md:hidden z-40 bg-gradient-to-r from-purple-500 to-orange-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-95"
          aria-label="Opportunités IA"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      )}


      {/* Video Modal Publicité */}
      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
      />
      
      {/* MCP Enhanced Image System Active */}
      <div className="hidden" data-version="mcp-enhanced-v1.0" />
    </div>
  )
}
/* Build forcé: Thu Oct 16 13:09:25 WAT 2025 */
