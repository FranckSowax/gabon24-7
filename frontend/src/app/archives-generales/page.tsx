'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'
import { ArticleCard } from '@/components/features/ArticleCard'
import { Loading } from '@/components/ui/Loading'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useModal } from '@/contexts/ModalContext'
import { addToFavorites, removeFromFavorites } from '@/lib/favorites'
import { Search, Calendar, Newspaper, Tag, RotateCcw, Filter, ChevronDown, Sparkles } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import UpcomingEvents from '@/components/widgets/UpcomingEvents'
import YouTubeWidget from '@/components/widgets/YouTubeWidget'
import TrendingWidget from '@/components/widgets/TrendingWidget'
import YesterdayPollWidget from '@/components/widgets/YesterdayPollWidget'
import ScrollToTop from '@/components/ui/ScrollToTop'

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
  created_at: string
}

interface ArchiveFilters {
  searchKeyword: string
  dateFilter: 'all' | 'week' | 'month' | '3months' | '6months' | 'year' | 'custom'
  sourceFilter: string
  categoryFilter: string
  customDateFrom: string
  customDateTo: string
}

export default function ArchivesGeneralesPage() {
  const { user, subscriptionPlan } = useAuth()
  const { openSubscriptionModal } = useModal()
  const isPro = subscriptionPlan?.slug === 'pro'
  const [articles, setArticles] = useState<Article[]>([])
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalArchives, setTotalArchives] = useState(0)
  const [favoriteArticles, setFavoriteArticles] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const articlesPerPage = 200

  // Vérifier l'accès Pro
  useEffect(() => {
    if (!isPro && typeof window !== 'undefined') {
      openSubscriptionModal()
    }
  }, [isPro])

  const [filters, setFilters] = useState<ArchiveFilters>({
    searchKeyword: '',
    dateFilter: 'all',
    sourceFilter: '',
    categoryFilter: '',
    customDateFrom: '',
    customDateTo: ''
  })

  const resetFilters = () => {
    setFilters({
      searchKeyword: '',
      dateFilter: 'all',
      sourceFilter: '',
      categoryFilter: '',
      customDateFrom: '',
      customDateTo: ''
    })
    setCurrentPage(1)
  }

  const [sources, setSources] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [gotoInput, setGotoInput] = useState('')

  // Récupérer tous les articles (archives > 7 jours) depuis Supabase via fonction serverless
  const fetchAllArticles = async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(articlesPerPage))

      // Recherche dynamique
      if (filters.searchKeyword && filters.searchKeyword.trim()) {
        params.set('q', filters.searchKeyword.trim())
      }

      // Filtre par source
      if (filters.sourceFilter && filters.sourceFilter.trim()) {
        params.set('source', filters.sourceFilter.trim())
      }

      // Filtre par catégorie
      if (filters.categoryFilter && filters.categoryFilter.trim()) {
        params.set('category', filters.categoryFilter.trim())
      }

      // Filtres de date
      if (filters.dateFilter && filters.dateFilter !== 'all' && filters.dateFilter !== 'custom') {
        params.set('datePreset', filters.dateFilter)
      }
      if (filters.customDateFrom) {
        params.set('dateFrom', filters.customDateFrom)
      }
      if (filters.customDateTo) {
        params.set('dateTo', filters.customDateTo)
      }

      console.log('Filtres actifs:', {
        recherche: filters.searchKeyword || 'aucune',
        source: filters.sourceFilter || 'toutes',
        categorie: filters.categoryFilter || 'toutes',
        date: filters.dateFilter,
        dateFrom: filters.customDateFrom || '-',
        dateTo: filters.customDateTo || '-',
        page
      })

      const response = await axios.get(`${API_URL}/api/articles/archives?${params.toString()}&_t=${Date.now()}`)

      if (response.data.success) {
        const list = response.data.articles as Article[]
        setArticles(list)
        setFilteredArticles(list) // serveur filtre déjà, on reflète côté client
        
        // Utiliser les données de pagination du backend
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages)
          setTotalArchives(response.data.pagination.total)
        } else {
          // Fallback si pas de pagination
          setTotalPages(Math.ceil((response.data.total || list.length) / articlesPerPage))
          setTotalArchives(response.data.total || list.length)
        }

        // Extraire les sources et catégories uniques (sur la page courante)
        const uniqueSources = Array.from(new Set(list.map((a: Article) => a.source))) as string[]
        const uniqueCategories = Array.from(new Set(list.map((a: Article) => a.category).filter(Boolean))) as string[]
        setSources(uniqueSources)
        setCategories(uniqueCategories)
      }
    } catch (error) {
      console.error('Erreur récupération articles:', error)
    } finally {
      setLoading(false)
    }
  }

  // Les filtres sont désormais côté serveur. On se contente de refléter la liste.
  useEffect(() => {
    setFilteredArticles(articles)
  }, [articles])

  useEffect(() => {
    fetchAllArticles(currentPage)
  }, [currentPage, filters])

  const handleFilterChange = (newFilters: Partial<ArchiveFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1) // Reset à la première page
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleGotoSubmit = () => {
    const n = parseInt(gotoInput, 10)
    if (isNaN(n)) return
    const target = Math.max(1, Math.min(n, totalPages))
    if (target !== currentPage) {
      handlePageChange(target)
    }
  }

  // Gestion des favoris
  const toggleFavorite = async (articleId: string) => {
    if (!user) {
      alert('Veuillez vous connecter pour ajouter des favoris')
      return
    }

    const isFav = favoriteArticles.includes(articleId)
    const article = articles.find(a => a.id === articleId)
    if (!article) return

    try {
      if (isFav) {
        const result = await removeFromFavorites(
          parseInt(articleId),
          article.title,
          article.url,
          article.source
        )
        if (result.success) {
          setFavoriteArticles(prev => prev.filter(id => id !== articleId))
        }
      } else {
        const result = await addToFavorites({
          id: parseInt(articleId),
          title: article.title,
          url: article.url,
          source: article.source
        })
        if (result.success) {
          setFavoriteArticles(prev => [...prev, articleId])
        }
      }
    } catch (error) {
      console.error('Erreur toggle favori:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Central Content Area */}
        <div className="flex-1 lg:ml-64 lg:mr-80 min-w-0">
          <main className="w-full py-4 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-2">
              {/* Top Banner with Profile Widget */}
              <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white rounded-2xl mb-8 shadow-2xl border border-blue-300/30">
                {/* Background Image */}
                <div className="absolute inset-0">
                  <img 
                    src="/archives.jpg" 
                    alt="Archives Background"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* Dark Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60"></div>
                  {/* Animated Elements */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-transparent to-purple-600/20 animate-pulse"></div>
                  <div className="absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-bounce"></div>
                  <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
                </div>
                
                <div className="relative z-10 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📚</span>
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold mb-2">
                          Archives Gabon Insight
                        </h1>
                        <p className="text-blue-100">
                          Explorez notre collection d'articles archivés et retrouvez l'actualité passée
                        </p>
                      </div>
                    </div>
                    <div className="hidden lg:flex items-center space-x-4">
                      <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
                        <button className="px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 bg-white text-indigo-600 shadow-lg">
                          <span>📚</span>
                          <span>Archives</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Filtres Modernisés */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                {/* Header des filtres */}
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Filter className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">Filtres de recherche</h3>
                        <p className="text-white/70 text-sm">Affinez votre recherche dans les archives</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={resetFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all text-sm font-medium backdrop-blur-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Réinitialiser</span>
                      </button>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all text-sm font-medium backdrop-blur-sm"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        <span className="hidden sm:inline">{showFilters ? 'Masquer' : 'Afficher'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Corps des filtres */}
                <div className={`transition-all duration-300 ${showFilters ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  <div className="p-6 space-y-6">
                    {/* Barre de recherche principale */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Rechercher par titre, contenu, source..."
                        value={filters.searchKeyword}
                        onChange={(e) => handleFilterChange({ searchKeyword: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all"
                      />
                      {filters.searchKeyword && (
                        <button
                          onClick={() => handleFilterChange({ searchKeyword: '' })}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <span className="text-xl">&times;</span>
                        </button>
                      )}
                    </div>

                    {/* Grille de filtres */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Filtre par période */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          Période
                        </label>
                        <div className="relative">
                          <select
                            value={filters.dateFilter}
                            onChange={(e) => handleFilterChange({ dateFilter: e.target.value as any })}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none cursor-pointer transition-all text-gray-700"
                          >
                            <option value="all">Toutes les périodes</option>
                            <option value="week">7 derniers jours</option>
                            <option value="month">30 derniers jours</option>
                            <option value="3months">3 derniers mois</option>
                            <option value="6months">6 derniers mois</option>
                            <option value="year">Dernière année</option>
                            <option value="custom">Période personnalisée</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Filtre par source */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Newspaper className="w-4 h-4 text-purple-500" />
                          Source
                        </label>
                        <div className="relative">
                          <select
                            value={filters.sourceFilter}
                            onChange={(e) => handleFilterChange({ sourceFilter: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer transition-all text-gray-700"
                          >
                            <option value="">Toutes les sources</option>
                            {sources.map(source => (
                              <option key={source} value={source}>{source}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Filtre par catégorie */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <Tag className="w-4 h-4 text-pink-500" />
                          Catégorie
                        </label>
                        <div className="relative">
                          <select
                            value={filters.categoryFilter}
                            onChange={(e) => handleFilterChange({ categoryFilter: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none cursor-pointer transition-all text-gray-700"
                          >
                            <option value="">Toutes les catégories</option>
                            {categories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Sélecteur de dates personnalisées */}
                    {filters.dateFilter === 'custom' && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                        <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Période personnalisée
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-600">Date de début</label>
                            <input
                              type="date"
                              value={filters.customDateFrom}
                              onChange={(e) => handleFilterChange({ customDateFrom: e.target.value })}
                              className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-600">Date de fin</label>
                            <input
                              type="date"
                              value={filters.customDateTo}
                              onChange={(e) => handleFilterChange({ customDateTo: e.target.value })}
                              className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tags de filtres actifs */}
                    {(filters.searchKeyword || filters.dateFilter !== 'all' || filters.sourceFilter || filters.categoryFilter) && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {filters.searchKeyword && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                            <Search className="w-3 h-3" />
                            {filters.searchKeyword}
                            <button onClick={() => handleFilterChange({ searchKeyword: '' })} className="ml-1 hover:text-indigo-900">&times;</button>
                          </span>
                        )}
                        {filters.dateFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            <Calendar className="w-3 h-3" />
                            {filters.dateFilter === 'week' ? '7 jours' :
                             filters.dateFilter === 'month' ? '30 jours' :
                             filters.dateFilter === '3months' ? '3 mois' :
                             filters.dateFilter === '6months' ? '6 mois' :
                             filters.dateFilter === 'year' ? '1 an' : 'Personnalisé'}
                            <button onClick={() => handleFilterChange({ dateFilter: 'all' })} className="ml-1 hover:text-purple-900">&times;</button>
                          </span>
                        )}
                        {filters.sourceFilter && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">
                            <Newspaper className="w-3 h-3" />
                            {filters.sourceFilter}
                            <button onClick={() => handleFilterChange({ sourceFilter: '' })} className="ml-1 hover:text-pink-900">&times;</button>
                          </span>
                        )}
                        {filters.categoryFilter && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                            <Tag className="w-3 h-3" />
                            {filters.categoryFilter}
                            <button onClick={() => handleFilterChange({ categoryFilter: '' })} className="ml-1 hover:text-orange-900">&times;</button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            {/* Résultats - Barre de stats */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 mb-6 border border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <span className="text-white font-bold text-sm">{loading ? '...' : totalArchives.toLocaleString()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {loading ? 'Chargement...' : (
                        (filters.searchKeyword || filters.dateFilter !== 'all' || filters.sourceFilter || filters.categoryFilter)
                          ? 'Articles trouvés'
                          : 'Articles archivés'
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {!loading && totalPages > 0 && `${totalPages} ${totalPages > 1 ? 'pages' : 'page'}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="hidden sm:inline">Page</span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold">{currentPage}</span>
                <span>sur</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg font-semibold">{totalPages}</span>
              </div>
            </div>

            {/* Liste des articles au design Home (ArticleCard) */}
            {loading ? (
              <Loading />
            ) : (
              <>
                <div className="space-y-4">
                  {filteredArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article as any}
                      variant="list"
                      onToggleFavorite={toggleFavorite}
                      isFavorite={favoriteArticles.includes(article.id)}
                      onClick={async (a) => {
                    // Optimistic UI: incrément immédiat
                    const bump = (v: any) => {
                      const n = Number(v ?? 0)
                      return isNaN(n) ? 1 : n + 1
                    }
                    setArticles(prev => prev.map(x => x.id === a.id ? { ...x, views: bump((x as any).views ?? (x as any).view_count) } : x))
                    setFilteredArticles(prev => prev.map(x => x.id === a.id ? { ...x, views: bump((x as any).views ?? (x as any).view_count) } : x))

                    // Fire-and-forget tracking; réconcilier avec le comptage exact si dispo
                    try {
                      void fetch(`${API_URL}/api/articles/${a.id}/view`, {
                        method: 'POST'
                      }).then(async (res) => {
                        if (res && res.ok) {
                          try {
                            const result = await res.json().catch(() => ({} as any))
                            const newCount = typeof result?.viewCount !== 'undefined' ? result.viewCount : result?.view_count
                            if (typeof newCount !== 'undefined') {
                              setArticles(prev => prev.map(x => x.id === a.id ? { ...x, views: newCount } : x))
                              setFilteredArticles(prev => prev.map(x => x.id === a.id ? { ...x, views: newCount } : x))
                            }
                          } catch {}
                        }
                      }).catch(() => {})
                    } catch {}

                    if (a.url) window.open(a.url, '_blank')
                  }}
                />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <nav className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Précédent
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 text-sm rounded-md ${
                              currentPage === page ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="px-2 text-gray-400">…</span>
                          <button
                            onClick={() => handlePageChange(totalPages)}
                            className={`px-3 py-2 text-sm rounded-md ${
                              currentPage === totalPages ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Suivant
                      </button>
                      <span className="ml-4 text-sm text-gray-500">Page {currentPage} / {totalPages}</span>
                      <div className="ml-4 flex items-center space-x-2">
                        <label className="text-sm text-gray-500" htmlFor="goto-page">Aller à</label>
                        <input
                          id="goto-page"
                          type="number"
                          min={1}
                          max={totalPages}
                          value={gotoInput}
                          onChange={(e) => setGotoInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGotoSubmit() }}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                          onClick={handleGotoSubmit}
                          disabled={!gotoInput}
                          className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Aller
                        </button>
                      </div>
                    </nav>
                  </div>
                )}

                {filteredArticles.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📄</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun article trouvé</h3>
                    <p className="text-gray-500">Essayez de modifier vos critères de recherche</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        </div>
        
        {/* Right Sidebar - Fixed Position */}
        <aside className="hidden lg:block fixed right-0 top-16 w-80 h-screen bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          {/* Widget YouTube */}
          <YouTubeWidget />

          <UpcomingEvents />

          {/* Widget Sondage d'hier */}
          <YesterdayPollWidget />

          {/* Widget Tendances */}
          <TrendingWidget articles={articles} />
        </aside>
      </div>
      {/* Bouton remonter en haut (desktop + mobile) */}
      <ScrollToTop />
    </div>
  )
}
