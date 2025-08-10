'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { ArticleCard } from '@/components/features/ArticleCard'
import { ArchiveFilters } from '@/components/features/ArchiveFilters'
import { Loading } from '@/components/ui/Loading'

interface Article {
  id: string
  title: string
  summary: string
  source: string
  publishedAt: string
  published_at?: string
  category: string
  viewCount: string
  view_count: number
  url?: string
  imageUrl?: string
  author?: string
  trending?: boolean
}

interface ArchiveFilters {
  dateFilter: 'all' | 'yesterday' | 'week' | 'month' | 'custom'
  startDate: string
  endDate: string
  searchKeyword: string
}

export default function HomePage() {
  // États
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [archivedArticles, setArchivedArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'pour-vous' | 'tendances' | 'suivis' | 'archives'>('pour-vous')
  const [searchQuery, setSearchQuery] = useState('')
  const [savedArticles, setSavedArticles] = useState<string[]>([])
  const [notification, setNotification] = useState<any>(null)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>({
    dateFilter: 'all',
    startDate: '',
    endDate: '',
    searchKeyword: ''
  })

  // Fonctions utilitaires
  const formatViewCount = (count: number): string => {
    if (count === 0) return '0 vue'
    if (count === 1) return '1 vue'
    if (count < 1000) return `${count} vues`
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k vues`
    return `${(count / 1000000).toFixed(1)}M vues`
  }

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'À l\'instant'
    if (diffHours < 24) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
    
    return date.toLocaleDateString('fr-FR')
  }

  const shouldArchiveArticle = (publishedAt: string): boolean => {
    if (!publishedAt) return false
    
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(20, 0, 0, 0) // 20h00 la veille
    
    const articleDate = new Date(publishedAt)
    return articleDate < yesterday
  }

  const ensureCompleteSummary = (summary: string): string => {
    if (!summary) return 'Résumé non disponible.'
    
    const trimmed = summary.trim()
    if (trimmed.length === 0) return 'Résumé non disponible.'
    
    // Ajouter un point final si manquant
    if (!trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
      return trimmed + '.'
    }
    
    return trimmed
  }

  // Fonction pour récupérer les articles de la page d'accueil
  const fetchHomepageArticles = async () => {
    try {
      console.log('🏠 Récupération des articles de la page d\'accueil...')
      const response = await axios.get('/.netlify/functions/homepage-articles')
      
      if (response.data?.success && response.data?.articles) {
        const transformedArticles = response.data.articles.map((article: any) => ({
          id: article.id,
          title: article.title,
          summary: ensureCompleteSummary(article.summary),
          source: article.source,
          publishedAt: formatTimeAgo(article.publishedAt),
          published_at: article.publishedAt,
          category: article.category,
          viewCount: article.viewCount,
          view_count: article.view_count,
          url: article.url,
          imageUrl: article.imageUrl,
          author: article.author,
          trending: article.view_count > 100
        }))
        
        // Filtrer seulement les articles récents (pas archivés)
        const recentArticles = transformedArticles.filter((article: Article) => 
          !shouldArchiveArticle(article.published_at || '')
        )
        
        console.log(`✅ ${recentArticles.length} articles récents récupérés`)
        return recentArticles
      }
    } catch (error: any) {
      console.error('❌ Erreur récupération articles homepage:', error)
    }
    
    // Articles de fallback
    return [
      {
        id: 'fallback-1',
        title: 'Service temporairement indisponible',
        summary: 'Nous travaillons à rétablir le service. Veuillez réessayer dans quelques instants.',
        source: 'GabonNews',
        publishedAt: 'maintenant',
        published_at: new Date().toISOString(),
        category: 'système',
        viewCount: '0 vue',
        view_count: 0,
        url: '#',
        imageUrl: 'https://picsum.photos/800/400?random=1',
        author: 'Équipe technique',
        trending: false
      }
    ]
  }

  // Fonction pour récupérer les articles archivés
  const fetchArchivedArticles = async () => {
    setArchiveLoading(true)
    try {
      console.log('📚 Récupération des articles archivés...')
      const response = await axios.get('/.netlify/functions/archived-articles')
      
      if (response.data?.success && response.data?.articles) {
        const transformedArticles = response.data.articles.map((article: any) => ({
          id: article.id,
          title: article.title,
          summary: ensureCompleteSummary(article.summary),
          source: article.source,
          publishedAt: formatTimeAgo(article.publishedAt),
          published_at: article.publishedAt,
          category: article.category,
          viewCount: article.viewCount,
          view_count: article.view_count,
          url: article.url,
          imageUrl: article.imageUrl,
          author: article.author,
          trending: false
        }))
        
        console.log(`📚 ${transformedArticles.length} articles archivés récupérés`)
        setArchivedArticles(transformedArticles)
      } else {
        console.log('⚠️ Aucun article archivé récupéré')
        setArchivedArticles([])
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des articles archivés:', error)
      setArchivedArticles([])
    } finally {
      setArchiveLoading(false)
    }
  }

  // Fonction pour incrémenter les vues
  const handleArticleClick = async (article: Article) => {
    try {
      // Ouvrir l'article dans un nouvel onglet
      window.open(article.url, '_blank')
      
      // Incrémenter le compteur de vues
      const response = await axios.post('/.netlify/functions/article-view', { 
        articleId: article.id 
      })
      
      if (response.data.success) {
        console.log(`👁️ Vue comptabilisée pour: ${article.title} (${response.data.view_count} vues)`)
        
        // Mettre à jour le compteur local
        const updateArticle = (a: Article) => 
          a.id === article.id 
            ? { ...a, view_count: response.data.view_count, viewCount: formatViewCount(response.data.view_count) }
            : a
        
        setArticles(prev => prev.map(updateArticle))
        setFilteredArticles(prev => prev.map(updateArticle))
        setArchivedArticles(prev => prev.map(updateArticle))
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'incrémentation des vues:', error)
      // Ouvrir l'article même en cas d'erreur
      window.open(article.url, '_blank')
    }
  }

  // Fonction de recherche
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.summary.toLowerCase().includes(query.toLowerCase()) ||
        article.source.toLowerCase().includes(query.toLowerCase())
      )
      setFilteredArticles(filtered)
    } else {
      setFilteredArticles(articles)
    }
  }

  // Fonction de filtrage des archives
  const filterArchivedArticles = (articles: Article[], filters: ArchiveFilters): Article[] => {
    let filtered = [...articles]
    
    // Filtre par date
    if (filters.dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date
      
      switch (filters.dateFilter) {
        case 'yesterday':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 1)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'custom':
          if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate)
            const end = new Date(filters.endDate)
            filtered = filtered.filter(article => {
              const articleDate = new Date(article.published_at || article.publishedAt)
              return articleDate >= start && articleDate <= end
            })
          }
          return filtered
        default:
          return filtered
      }
      
      filtered = filtered.filter(article => {
        const articleDate = new Date(article.published_at || article.publishedAt)
        return articleDate >= startDate
      })
    }
    
    // Filtre par mots-clés
    if (filters.searchKeyword.trim()) {
      const keyword = filters.searchKeyword.toLowerCase()
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(keyword) ||
        article.summary.toLowerCase().includes(keyword) ||
        article.source.toLowerCase().includes(keyword)
      )
    }
    
    return filtered
  }

  // Effects
  useEffect(() => {
    const loadHomepageArticles = async () => {
      setLoading(true)
      try {
        const articles = await fetchHomepageArticles()
        if (articles && articles.length > 0) {
          setArticles(articles)
          setFilteredArticles(articles)
        }
      } catch (error) {
        console.error('❌ Erreur chargement articles homepage:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadHomepageArticles()
    
    // Actualiser les articles toutes les 5 minutes
    const interval = setInterval(loadHomepageArticles, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Effect pour charger les articles archivés
  useEffect(() => {
    if (activeTab === 'archives' && archivedArticles.length === 0) {
      fetchArchivedArticles()
    }
  }, [activeTab])

  // Handlers pour les actions
  const handleSubscribe = () => setShowSubscriptionModal(true)
  const handleSubscriptionComplete = (plan: string) => {
    setNotification({
      type: 'success',
      title: 'Abonnement en cours',
      message: `Votre abonnement ${plan} est en cours de traitement.`
    })
  }

  const handleSaveArticle = (articleId: string) => {
    if (savedArticles.includes(articleId)) {
      setSavedArticles(prev => prev.filter(id => id !== articleId))
      setNotification({
        type: 'info',
        title: 'Article retiré',
        message: 'L\'article a été retiré de vos favoris.'
      })
    } else {
      setSavedArticles(prev => [...prev, articleId])
      setNotification({
        type: 'success',
        title: 'Article sauvegardé',
        message: 'L\'article a été ajouté à vos favoris.'
      })
    }
  }

  const handleShare = (article: Article) => {
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${article.title} - ${article.url}`)}`
    window.open(shareUrl, '_blank')
    
    setNotification({
      type: 'success',
      title: 'Article partagé',
      message: 'L\'article a été partagé sur WhatsApp.'
    })
  }

  // Articles à afficher selon l'onglet actif
  const getDisplayArticles = () => {
    if (activeTab === 'archives') {
      return filterArchivedArticles(archivedArticles, archiveFilters)
    }
    return searchQuery ? filteredArticles : articles
  }

  const displayArticles = getDisplayArticles()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">GabonNews</h1>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Rechercher des articles..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSubscribe}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                S'abonner
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'pour-vous', label: 'Pour Vous' },
              { id: 'tendances', label: 'Tendances' },
              { id: 'suivis', label: 'Suivis' },
              { id: 'archives', label: 'Archives 📚' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Archives Filters */}
        {activeTab === 'archives' && (
          <div className="mb-6">
            <ArchiveFilters
              filters={archiveFilters}
              onFiltersChange={setArchiveFilters}
            />
          </div>
        )}

        {/* Loading State */}
        {(loading || archiveLoading) && (
          <div className="flex justify-center py-12">
            <Loading />
          </div>
        )}

        {/* Articles Grid */}
        {!loading && !archiveLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayArticles.length > 0 ? (
              displayArticles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  variant={index === 0 ? 'featured' : 'list'}
                  onClick={() => handleArticleClick(article)}
                  onSave={() => handleSaveArticle(article.id)}
                  onShare={() => handleShare(article)}
                  isSaved={savedArticles.includes(article.id)}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">
                  {activeTab === 'archives' 
                    ? 'Aucun article archivé ne correspond à vos critères de recherche.'
                    : 'Aucun article disponible pour le moment.'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{notification.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
