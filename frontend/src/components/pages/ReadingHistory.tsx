'use client'

// Reading History v3.0 - Modern Design with Real-time Stats
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BookOpen, Heart, Bookmark, Clock, TrendingUp, Calendar, 
  Eye, ExternalLink, Filter, ChevronDown, Sparkles, BarChart3,
  BookMarked, Timer, Flame, Star, RefreshCw
} from 'lucide-react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { supabase } from '@/lib/supabase'
import axios from 'axios'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import UpcomingEvents from '@/components/widgets/UpcomingEvents'
import YouTubeWidget from '@/components/widgets/YouTubeWidget'
import TrendingWidget from '@/components/widgets/TrendingWidget'
import StatsWidget from '@/components/widgets/StatsWidget'
import YesterdayPollWidget from '@/components/widgets/YesterdayPollWidget'

// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic'

interface ReadingHistoryItem {
  id: string
  article_id: string
  article_title: string
  article_content?: string
  article_summary?: string
  article_url?: string
  article_source: string
  article_category?: string
  article_published_at?: string
  read_at: string
  reading_duration?: number
  is_favorite: boolean
  is_bookmarked: boolean
  reading_progress: number
  device_type?: string
  view_count?: number
  image_url?: string
}

interface ReadingStats {
  total_articles_read: number
  articles_this_week: number
  articles_this_month: number
  favorite_articles: number
  bookmarked_articles: number
  total_reading_time: number
  most_read_source?: string
  most_read_category?: string
  totalArticles?: number
  categoriesRead?: number
  sourcesRead?: number
  streak?: number
}

export default function ReadingHistory() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const [stats, setStats] = useState<ReadingStats | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [filters, setFilters] = useState({
    source: 'all',
    category: 'all',
    favorites: false
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const itemsPerPage = 20

  useEffect(() => {
    setMounted(true)
  }, [])

  // Vérifier l'authentification
  useEffect(() => {
    if (!mounted) return

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    checkAuth()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [mounted])

  // Charger l'historique de lecture
  const loadReadingHistory = async (page = 1, reset = false) => {
    if (!user) return

    try {
      setLoading(true)
      const offset = (page - 1) * itemsPerPage

      // Utiliser l'API backend pour récupérer l'historique
      const params = new URLSearchParams({
        userId: user.id,
        page: page.toString(),
        limit: itemsPerPage.toString()
      })

      if (filters.source !== 'all') {
        params.append('source', filters.source)
      }
      if (filters.category !== 'all') {
        params.append('category', filters.category)
      }

      const response = await axios.get(`${API_URL}/api/user/history?${params}`)
      const result = response.data

      if (!result.success) {
        console.error('❌ Erreur chargement historique:', result.error)
        return
      }

      if (reset) {
        setHistory(result.history || [])
        if (result.stats) {
          setStats(result.stats)
        }
      } else {
        setHistory(prev => [...prev, ...(result.history || [])])
      }

      setHasMore(result.hasMore || false)
      setCurrentPage(page)
    } catch (error: any) {
      console.error('❌ Erreur chargement historique:', error.message)
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques (maintenant incluses dans loadReadingHistory)
  const loadStats = async () => {
    // Les statistiques sont maintenant chargées avec l'historique
    // Cette fonction est conservée pour compatibilité
  }

  // Charger les données quand l'utilisateur change
  useEffect(() => {
    if (user) {
      loadReadingHistory(1, true)
      loadStats()
    }
  }, [user, filters])

  // Toggle favori
  const toggleFavorite = async (articleId: string) => {
    if (!user) return

    try {
      const response = await axios.post(`${API_URL}/api/user/favorites/toggle`, {
        userId: user.id,
        articleId: articleId
      })

      if (response.data.success) {
        setHistory(prev => prev.map(item => 
          item.article_id === articleId 
            ? { ...item, is_favorite: !item.is_favorite }
            : item
        ))
        loadStats() // Recharger les stats
      }
    } catch (error: any) {
      console.error('❌ Erreur toggle favori:', error.message)
    }
  }

  // Toggle bookmark
  const toggleBookmark = async (articleId: string) => {
    if (!user) return

    try {
      const response = await axios.post(`${API_URL}/api/user/bookmarks/toggle`, {
        userId: user.id,
        articleId: articleId
      })

      if (response.data.success) {
        setHistory(prev => prev.map(item => 
          item.article_id === articleId 
            ? { ...item, is_bookmarked: !item.is_bookmarked }
            : item
        ))
        loadStats() // Recharger les stats
      }
    } catch (error: any) {
      console.error('❌ Erreur toggle bookmark:', error.message)
    }
  }

  // Formater la durée de lecture
  const formatReadingTime = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}min`
  }

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Proxy pour les images externes
  const getProxiedImage = (url?: string, title?: string): string => {
    if (!url) return ''
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon24-7.com')
      const isSameOrigin = typeof window !== 'undefined' && u.hostname === window.location.hostname
      if (isSameOrigin) return url
    } catch {}
    return `${API_URL}/api/image-proxy?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || '')}`
  }

  // Si l'utilisateur n'est pas connecté
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Historique de Lecture</h1>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Connectez-vous pour voir votre historique de lecture et suivre vos articles préférés.
            </p>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    )
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
        <div className="flex-1 lg:ml-0 lg:mr-80 min-w-0">
          <main className="w-full py-8">
            <div className="w-full px-0 lg:px-2">
              {/* Top Banner with Profile Widget */}
              <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 via-teal-500 to-blue-600 text-white rounded-2xl mb-8 shadow-2xl border border-green-300/30">
                {/* Background Image */}
                <div className="absolute inset-0">
                  <img 
                    src="/historique.jpg" 
                    alt="Historique Background"
                    className="w-full h-full object-cover"
                  />
                  {/* Dark Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60"></div>
                  {/* Animated Elements */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-transparent to-teal-600/20 animate-pulse"></div>
                  <div className="absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-bounce"></div>
                  <div className="absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
                </div>
                
                <div className="relative z-10 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📋</span>
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold mb-2">
                          Historique de lecture
                        </h1>
                        <p className="text-green-100">
                          Retrouvez vos articles lus et vos habitudes de lecture
                        </p>
                      </div>
                    </div>
                    <div className="hidden lg:flex items-center space-x-4">
                      <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
                        <button className="px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-2 bg-white text-indigo-600 shadow-lg">
                          <span>📋</span>
                          <span>Historique</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Statistiques Modernisées */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <TrendingUp className="w-5 h-5 opacity-70" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats?.totalArticles || stats?.total_articles_read || 0}</div>
                  <div className="text-white/80 text-sm font-medium">Articles lus</div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Timer className="w-6 h-6" />
                    </div>
                    <Clock className="w-5 h-5 opacity-70" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{formatReadingTime(stats?.total_reading_time || 0)}</div>
                  <div className="text-white/80 text-sm font-medium">Temps de lecture</div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Heart className="w-6 h-6" />
                    </div>
                    <Star className="w-5 h-5 opacity-70" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats?.favorite_articles || 0}</div>
                  <div className="text-white/80 text-sm font-medium">Favoris</div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <Flame className="w-5 h-5 opacity-70" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stats?.categoriesRead || 0}</div>
                  <div className="text-white/80 text-sm font-medium">Catégories explorées</div>
                </motion.div>
              </div>

              {/* Filtres Modernisés */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 mb-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Filtres</h3>
                  <button 
                    onClick={() => loadReadingHistory(1, true)}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualiser
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Source</label>
                    <select
                      value={filters.source}
                      onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                    >
                      <option value="all">Toutes les sources</option>
                      <option value="AGP">AGP</option>
                      <option value="Gabon Review">Gabon Review</option>
                      <option value="L'Union">L&apos;Union</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Catégorie</label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                    >
                      <option value="all">Toutes les catégories</option>
                      <option value="politique">Politique</option>
                      <option value="economie">Économie</option>
                      <option value="sport">Sport</option>
                      <option value="culture">Culture</option>
                      <option value="societe">Société</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl">
                    <input
                      type="checkbox"
                      id="favorites"
                      checked={filters.favorites}
                      onChange={(e) => setFilters(prev => ({ ...prev, favorites: e.target.checked }))}
                      className="w-5 h-5 text-orange-600 rounded-lg border-2 border-gray-300 focus:ring-orange-500"
                    />
                    <label htmlFor="favorites" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-500" />
                      Favoris uniquement
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* Liste des articles Modernisée */}
              <div className="space-y-4">
                <AnimatePresence>
                  {history.map((item, index) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:border-orange-200 transition-all group"
                    >
                      <div className="flex gap-4">
                        {/* Image article */}
                        <div className="hidden sm:block w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex-shrink-0 overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={getProxiedImage(item.image_url, item.article_title)}
                              alt={item.article_title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement?.classList.add('flex', 'items-center', 'justify-center')
                                const icon = document.createElement('div')
                                icon.innerHTML = '<svg class="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>'
                                target.parentElement?.appendChild(icon)
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-8 h-8 text-orange-400" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                                {item.article_title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded-full font-medium">
                                  {item.article_source}
                                </span>
                                {item.article_category && (
                                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                                    {item.article_category}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(item.read_at)}
                                </span>
                                {item.view_count && item.view_count > 0 && (
                                  <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                                    <Eye className="w-4 h-4" />
                                    {item.view_count} vues
                                  </span>
                                )}
                              </div>
                              {item.article_summary && (
                                <p className="text-gray-600 text-sm line-clamp-2">
                                  {item.article_summary}
                                </p>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleFavorite(item.article_id)}
                                className={`p-2.5 rounded-xl transition-all ${
                                  item.is_favorite 
                                    ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-pink-100 hover:text-pink-500'
                                }`}
                              >
                                <Heart className="w-5 h-5" fill={item.is_favorite ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={() => toggleBookmark(item.article_id)}
                                className={`p-2.5 rounded-xl transition-all ${
                                  item.is_bookmarked 
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-500'
                                }`}
                              >
                                <Bookmark className="w-5 h-5" fill={item.is_bookmarked ? 'currentColor' : 'none'} />
                              </button>
                              {item.article_url && (
                                <button
                                  onClick={() => window.open(item.article_url, '_blank')}
                                  className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-500 transition-all"
                                >
                                  <ExternalLink className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Barre de progression */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Progression de lecture</span>
                              <span className="font-semibold">{item.reading_progress || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.reading_progress || 0}%` }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bouton charger plus */}
              {hasMore && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mt-8"
                >
                  <button
                    onClick={() => loadReadingHistory(currentPage + 1, false)}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                  >
                    <ChevronDown className="w-5 h-5" />
                    Charger plus d&apos;articles
                  </button>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-200 border-t-orange-600"></div>
                    <span className="text-gray-600 font-medium">Chargement de votre historique...</span>
                  </div>
                </div>
              )}

              {/* Message si aucun article */}
              {!loading && history.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16"
                >
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                    <BookMarked className="w-12 h-12 text-orange-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Aucun article lu</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Commencez à lire des articles pour voir votre historique ici et suivre vos habitudes de lecture.
                  </p>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Découvrir les articles
                  </button>
                </motion.div>
              )}
          </div>
        </main>
        
        {/* Right Sidebar - Fixed Position */}
        <aside className="hidden lg:block fixed right-0 top-16 w-80 h-screen bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          {/* Widget YouTube */}
          <YouTubeWidget />
          
          <UpcomingEvents />
          
          {/* Widget Tendances */}
          <TrendingWidget articles={[]} />
          
          {/* Widget Sondage d'hier */}
          <YesterdayPollWidget />
          
          {/* Widget Stats */}
          <StatsWidget articles={[]} loading={false} />
        </aside>
      </div>
    </div>
    </div>
  )
}
