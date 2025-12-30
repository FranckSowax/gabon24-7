'use client'

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
import EventsSlider from '@/components/widgets/EventsSlider'
import NewsTicker from '@/components/ticker/NewsTicker'
import Sidebar from '@/components/layout/Sidebar'
import axios from 'axios'
import Header from '@/components/layout/Header'
import WeatherWidget from '@/components/widgets/WeatherWidget'
import MultiQuestionPollWidget from '@/components/widgets/MultiQuestionPollWidget'
import RoutesMapWidget from '@/components/widgets/RoutesMapWidget'
import UserProfileWidget from '@/components/widgets/UserProfileWidget'
import ScrollToTop from '@/components/ui/ScrollToTop'
import MobileOpportunityAnalyzer from '@/components/mobile/MobileOpportunityAnalyzer'
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
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [activeTab, setActiveTab] = useState('pour-vous')
  const [forceUpdate, setForceUpdate] = useState(Date.now())
  const [imageSupport] = useState(true) // Force rebuild for image support
  const [trafficUpdate] = useState(Date.now()) // Force rebuild for traffic text change
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    category: 'all',
    source: 'all'
  })
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [savedArticles, setSavedArticles] = useState<string[]>([])
  const [favoriteArticles, setFavoriteArticles] = useState<string[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
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
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingStats, setTrendingStats] = useState<any>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [isMobileAnalyzerOpen, setIsMobileAnalyzerOpen] = useState(false)
  const [showMobileAIButton, setShowMobileAIButton] = useState(false)
  const widgetsAreaRef = useRef<HTMLDivElement | null>(null)

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

  // Fonctions utilitaires
  const formatViewCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  const [trendingArticles, setTrendingArticles] = useState<Article[]>([])
  const [trendingPeriod, setTrendingPeriod] = useState<'day' | 'week'>('day')

  const getCurrentTrendingArticles = () => {
    return trendingArticles
  }

  // Fonction pour récupérer les articles tendance depuis l'API
  const fetchTrendingArticles = async (period: 'day' | 'week' = 'day') => {
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
        const health = await fetch(`/.netlify/functions/trending-articles?health=1&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
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
          .slice(0, 20)
        setTrendingArticles(fallbackTrending)
        return fallbackTrending
      }

      // Récupération des articles tendance
      const response = await fetch(`/.netlify/functions/trending-articles?period=${period}&limit=50&_t=${Date.now()}`)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.articles) {
          // Articles tendance récupérés
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
    
    // Fallback: utiliser les articles locaux avec tri par vues
    const fallbackTrending = articles
      .filter(article => article.views && article.views > 0)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 20)
    
    setTrendingArticles(fallbackTrending)
    return fallbackTrending
  }

  const getFavoriteArticles = () => {
    return articles.filter(article => favoriteArticles.includes(article.id))
  }

  // Fonction de recherche dynamique optimisée avec useCallback pour éviter les boucles
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    
    if (!query.trim()) {
      updateDisplayedArticles()
      return
    }

    const searchTerm = query.toLowerCase().trim()
    
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

    // Filtrage amélioré avec recherche dans le contenu et pondération
    const filtered = articlesToFilter.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(searchTerm)
      const summaryMatch = article.summary.toLowerCase().includes(searchTerm)
      const sourceMatch = article.source.toLowerCase().includes(searchTerm)
      const categoryMatch = article.category.toLowerCase().includes(searchTerm)
      const authorMatch = article.author && article.author.toLowerCase().includes(searchTerm)
      const contentMatch = article.content && article.content.toLowerCase().includes(searchTerm)

      const matchesQuery = query.trim() === '' || titleMatch || summaryMatch || sourceMatch || categoryMatch || authorMatch || contentMatch
      const matchesSource = selectedSource === '' || selectedSource === 'all' || article.media_name === selectedSource || article.source === selectedSource
      const matchesCategory = selectedCategory === '' || selectedCategory === 'all' || article.category === selectedCategory

      return matchesQuery && matchesSource && matchesCategory
    })

    // Tri par pertinence (titre > résumé > contenu > source/auteur)
    const sortedFiltered = filtered.sort((a, b) => {
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
      
      const aScore = aTitle + aSummary + aContent + aOther
      const bScore = bTitle + bSummary + bContent + bOther
      
      return bScore - aScore
    })

    setDisplayedArticles(sortedFiltered)
  }, [selectedSource, selectedCategory, articles, semaineActuelleArticles, archivedArticles, favoriteArticles, activeTab])


  // Fonction pour récupérer les articles selon l'onglet sélectionné
  const fetchArticlesByTab = async (tab: string) => {
    try {
      // Récupération des articles pour l'onglet
      
      const response = await axios.get(`/.netlify/functions/articles?tab=${tab}&_t=${Date.now()}`)
      
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
            
            // Utiliser le cache si moins de 5 minutes
            if (cacheAge < 5 * 60 * 1000) {
              return articles
            }
          }
        } catch (e) {
          // Cache corrompu, continuer avec fetch
        }
      }
      
      // Pré-vérification rapide (health check) pour éviter d'attendre une fonction froide
      try {
        const health = await axios.get(`/.netlify/functions/homepage-articles-new?health=1&_t=${Date.now()}`, { timeout: 4000 })
        if (!(health?.status === 200 && (health.data?.ok || health.data?.success))) {
          throw new Error('Health not OK')
        }
      } catch (e) {
        // Health NOK: retourner le cache si présent, sinon vide rapide (pas de fallback secondaire)
        if (typeof window !== 'undefined') {
          try {
            const cachedAny = localStorage.getItem('homepage_articles_cache')
            if (cachedAny) {
              const { articles } = JSON.parse(cachedAny)
              return articles || []
            }
          } catch {}
        }
        return []
      }

      // Cache buster simple et efficace
      const response = await axios.get(`/.netlify/functions/homepage-articles-new?_t=${Date.now()}`, {
        timeout: 30000,
      })
      
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
        
        // Tri optimisé par date de publication
        const sortedArticles = validArticles.sort((a: Article, b: Article) => {
          const dateA = new Date(a.created_at || a.published_at || a.publishedAt || Date.now()).getTime()
          const dateB = new Date(b.created_at || b.published_at || b.publishedAt || Date.now()).getTime()
          return dateB - dateA
        })
        
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
            
            // Utiliser le cache si moins de 5 minutes
            if (cacheAge < 5 * 60 * 1000) {
              // Utilisation du cache local
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
      // console.log('📅 Chargement articles de la semaine (36h-7j)...')
      // Pré-vérification rapide
      try {
        const health = await fetch(`/.netlify/functions/week-articles?health=1&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
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

      const response = await axios.get(`/.netlify/functions/week-articles?_t=${Date.now()}`)
      
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
      try { fetchTrendingArticles('day') } catch {}
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
      .subscribe()

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
  useEffect(() => {
    // Toujours appeler handleSearch pour maintenir la cohérence du filtrage
    handleSearch(searchQuery)
  }, [selectedSource, selectedCategory, activeTab, handleSearch, searchQuery])

  // Gestion des clics sur les onglets
  const handleTabClick = (e: React.MouseEvent, tab: string) => {
    e.preventDefault()
    e.stopPropagation()
    handleTabChange(tab)
  }

  // Charger les favoris de l'utilisateur
  const loadFavorites = async () => {
    if (!user) return
    
    try {
      const { favorites: userFavorites } = await getFavorites()
      setFavorites(userFavorites)
      setFavoriteArticles(userFavorites.map(fav => fav.article_id))
    } catch (error) {
      console.error('Erreur chargement favoris:', error)
    }
  }

  // Charger les favoris quand l'utilisateur se connecte
  useEffect(() => {
    if (user) {
      loadFavorites()
    } else {
      setFavorites([])
      setFavoriteArticles([])
    }
  }, [user])

  // Gestion des actions sur les articles
  const handleArticleClick = async (article: Article) => {
    try {
      // Tracking des vues - solution de fallback locale
      try {
        // Tentative avec la fonction Netlify
        const response = await fetch('/.netlify/functions/track-views', {
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
    if (!user) {
      setShowAuthModal(true)
      return
    }

    const article = articles.find(a => a.id === articleId)
    if (!article) return

    const isFav = favoriteArticles.includes(articleId)

    try {
      if (isFav) {
        const result = await removeFromFavorites(parseInt(articleId))
        if (result.success) {
          setFavoriteArticles(prev => prev.filter(id => id !== articleId))
          setFavorites(prev => prev.filter(fav => fav.article_id !== articleId))
          showNotification('Article retiré des favoris', 'success')
        } else {
          showNotification(result.error || 'Erreur lors de la suppression', 'error')
        }
      } else {
        const result = await addToFavorites({
          id: parseInt(articleId),
          title: article.title,
          url: article.url,
          source: article.source,
          image_url: article.imageUrl
        })
        if (result.success) {
          setFavoriteArticles(prev => [...prev, articleId])
          await loadFavorites()
          showNotification('Article ajouté aux favoris', 'success')
        } else {
          showNotification(result.error || 'Erreur lors de l\'ajout', 'error')
        }
      }
    } catch (error) {
      console.error('Erreur toggle favorite:', error)
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
          user={user ? { name: (user as any).name || user.email || 'Utilisateur', email: user.email || 'user@example.com' } : undefined}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => {
            // Mobile menu fermé
            setIsMobileMenuOpen(false);
          }}
        />
        
        <div className="flex-1 lg:ml-0 lg:mr-80 min-w-0">
          <main className="w-full py-4 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-2">
              
              {/* Banner Premium */}
              <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 text-white rounded-2xl mb-4 sm:mb-8 shadow-2xl border border-orange-300/30 hover:shadow-orange-500/25 transition-all duration-500 w-full">
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 via-transparent to-red-600/20 animate-pulse"></div>
                  <div className="absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-bounce"></div>
                  <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
                  <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/10 rounded-lg rotate-45 animate-spin" style={{animationDuration: '20s'}}></div>
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-white/10 via-transparent to-transparent"></div>
                  </div>
                </div>
                
                <div className="relative z-20 p-4 lg:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-1 flex justify-center lg:justify-start">
                      <div className="w-full">
                        <UserProfileWidget />
                      </div>
                    </div>
                    
                    <div className="lg:col-span-2">
                      <div className="flex items-start justify-between gap-6">
                        <div className="hidden sm:flex flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-lg">
                              NOUVEAU
                            </div>
                            <div className="text-xl lg:text-2xl font-black tracking-tight">
                              Gabon 24/7
                              <span className="ml-2 text-lg lg:text-xl bg-gradient-to-r from-yellow-300 to-white bg-clip-text text-transparent">
                                Premium
                              </span>
                            </div>
                          </div>
                          <p className="text-orange-50 text-sm leading-relaxed">
                            Accédez à l'actualité gabonaise en temps réel avec des fonctionnalités exclusives et une expérience personnalisée
                          </p>
                        </div>
                        
                        <div className="hidden sm:flex flex-shrink-0">
                          <div className="relative bg-white/15 backdrop-blur-xl rounded-xl p-4 border border-white/30 shadow-xl max-w-sm">
                            <div className="text-center mb-3">
                              <div className="text-xl lg:text-2xl font-black mb-1 bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">
                                2000 FCFA
                              </div>
                              <div className="text-orange-200 text-xs font-medium">par mois seulement</div>
                            </div>
                            <button 
                              onClick={() => setShowSubscriptionModal(true)}
                              className="group/btn relative w-full bg-gradient-to-r from-white to-orange-50 text-orange-600 font-bold py-2 px-4 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-white/25 overflow-hidden"
                            >
                              <div className="relative z-10 flex items-center justify-center">
                                <span className="text-xs lg:text-sm">Commencer l'essai gratuit</span>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-100 to-white opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
                  <div className="absolute inset-0 rounded-2xl border border-white/20 group-hover:border-white/40 transition-colors duration-500"></div>
                </div>
              </div>

              {/* Zone Widgets (météo, sondages, trafic, pub, youtube) - utilisée pour contrôle du scroll */}
              <div ref={widgetsAreaRef} className="w-full">
                {/* Widgets météo, sondage et trafic */}
                <div className="mb-4 sm:mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
                  <LazyMount className="w-full"><WeatherWidget /></LazyMount>
                  <LazyMount className="w-full"><MultiQuestionPollWidget /></LazyMount>
                  <LazyMount className="w-full"><RoutesMapWidget /></LazyMount>
                </div>

                {/* Bandeau d'information défilant - Masqué sur mobile */}
                <div className="hidden sm:block w-full mb-4">
                  <NewsTicker />
                </div>

                {/* Slider publicitaire */}
                <LazyMount className="w-full mb-6"><PromotionalSlider /></LazyMount>

                {/* Widget YouTube mobile */}
                <LazyMount className="lg:hidden mb-4 sm:mb-6 w-full">
                  <div className="bg-white rounded-lg shadow-sm border p-3 sm:p-4 w-full">
                    <YouTubeWidget />
                  </div>
                </LazyMount>
              </div>

              {/* Navigation des onglets */}
              <nav className="bg-white border-b sticky top-16 z-40 mb-4 sm:mb-8 rounded-lg shadow-sm w-full overflow-hidden">
                <div className="w-full px-0">
                  <div className="flex flex-col">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center w-full">
                      <div className="overflow-x-auto scrollbar-hide w-full">
                        <div className="flex space-x-1 sm:space-x-2 lg:space-x-4 min-w-max px-2 w-full">
                          <button
                            onClick={(e) => handleTabClick(e, 'pour-vous')}
                            className={`relative py-3 px-4 sm:px-6 lg:px-8 font-semibold text-sm sm:text-base whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'pour-vous'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 scale-105'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50 hover:scale-102'
                            }`}
                          >
                            <span className="relative z-10">📰 Aujourd'hui</span>
                            {activeTab === 'pour-vous' && (
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl blur-lg opacity-30 -z-10"></div>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleTabClick(e, 'tendances')}
                            onMouseEnter={() => {
                              try {
                                if (typeof window !== 'undefined') {
                                  const cached = localStorage.getItem('trending_cache_day')
                                  if (!cached) fetchTrendingArticles('day').catch(() => {})
                                }
                              } catch {}
                            }}
                            onFocus={() => {
                              try {
                                if (typeof window !== 'undefined') {
                                  const cached = localStorage.getItem('trending_cache_day')
                                  if (!cached) fetchTrendingArticles('day').catch(() => {})
                                }
                              } catch {}
                            }}
                            className={`relative py-3 px-4 sm:px-6 lg:px-8 font-semibold text-sm sm:text-base whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'tendances'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 scale-105'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50 hover:scale-102'
                            }`}
                          >
                            <span className="relative z-10">🔥 Tendances</span>
                            {activeTab === 'tendances' && (
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl blur-lg opacity-30 -z-10"></div>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleTabClick(e, 'favoris')}
                            className={`relative py-3 px-4 sm:px-6 lg:px-8 font-semibold text-sm sm:text-base whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'favoris'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 scale-105'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50 hover:scale-102'
                            }`}
                          >
                            <span className="relative z-10">❤️ Favoris</span>
                            {activeTab === 'favoris' && (
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl blur-lg opacity-30 -z-10"></div>
                            )}
                          </button>
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
                            onFocus={() => {
                              try {
                                if (typeof window !== 'undefined') {
                                  const cached = localStorage.getItem('week_articles_cache')
                                  if (!cached) fetchSemaineActuelleArticles().catch(() => {})
                                }
                              } catch {}
                            }}
                            className={`relative py-3 px-4 sm:px-6 lg:px-8 font-semibold text-sm sm:text-base whitespace-nowrap transition-all duration-300 rounded-xl ${
                              activeTab === 'semaine-actuelle'
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 scale-105'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50 hover:scale-102'
                            }`}
                          >
                            <span className="relative z-10">📅 Cette semaine</span>
                            {activeTab === 'semaine-actuelle' && (
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl blur-lg opacity-30 -z-10"></div>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 lg:space-x-4 text-xs sm:text-sm text-gray-500 mt-3 lg:mt-0 px-0 pb-3 lg:pb-0">
                        <div className="flex items-center justify-between w-full sm:w-auto space-x-2 order-1">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                              className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 min-w-[140px] sm:min-w-[160px] justify-center shadow-sm hover:shadow-md ${
                                autoRefreshEnabled
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-500/25 scale-105'
                                  : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full transition-colors ${autoRefreshEnabled ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></div>
                              <span className="whitespace-nowrap">Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}</span>
                            </button>
                            <button
                              onClick={() => handleTabChange(activeTab)}
                              className="flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                              </svg>
                              <span>Actualiser</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Widget de recherche */}
                  <SearchWidget 
                    onSearch={handleSearch}
                    searchQuery={searchQuery}
                    selectedSource={selectedSource}
                    onSourceChange={setSelectedSource}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                  />
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
                            viewCount: '0'
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
                              <div 
                                key={article.id} 
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

        {/* Timestamp: 2025-09-18 17:30 - Replace emoji badges with rectangles for top 3, move view counter */}
        <aside className="hidden lg:block fixed right-0 top-16 w-80 h-screen bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          <LazyMount><YouTubeWidget /></LazyMount>
          <LazyMount><UpcomingEvents /></LazyMount>
          
          {/* Widget Premium */}
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-sm p-6 text-white">
            <h3 className="font-semibold text-lg mb-2">📱 Gabon 24/7 Premium</h3>
            <p className="text-sm text-orange-100 mb-4">
              Actualités personnalisées, alertes instantanées et contenu exclusif
            </p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-sm">
                <span>✅</span>
                <span>Notifications WhatsApp</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span>✅</span>
                <span>Filtres personnalisés</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span>✅</span>
                <span>Résumés IA exclusifs</span>
              </div>
            </div>
            <button 
              onClick={() => setShowSubscriptionModal(true)}
              className="w-full bg-white text-orange-600 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Commencer l'essai gratuit
            </button>
            <p className="text-xs text-orange-200 mt-2 text-center">
              2000 FCFA/mois • Annuler à tout moment
            </p>
          </div>
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
          onClick={() => router.push('/business/analyzer')}
          className="fixed bottom-20 right-4 md:hidden z-40 bg-gradient-to-r from-purple-500 to-orange-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-95"
          aria-label="Analyser Opportunités IA"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      )}

      {/* Mobile Opportunity Analyzer */}
      <MobileOpportunityAnalyzer
        articles={displayedArticles}
        isOpen={isMobileAnalyzerOpen}
        onClose={() => setIsMobileAnalyzerOpen(false)}
      />
      
      {/* MCP Enhanced Image System Active */}
      <div className="hidden" data-version="mcp-enhanced-v1.0" />
    </div>
  )
}
