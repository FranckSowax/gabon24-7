'use client'

import { useState, useEffect } from 'react'
import { Search, Eye, TrendingUp, Star, RefreshCw, ExternalLink, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Article {
  id: string
  title: string
  summary: string | null
  summary_ai: string | null
  url: string
  published_at: string | null
  media_name: string | null
  category: string | null
  view_count: number
  share_count: number
  is_published: boolean
  is_trending: boolean
  is_premium: boolean
  created_at: string
  // Enrichissement IA
  sentiment_score: number | null
}

export default function ArticlesAdminPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(50)
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'view_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'desc'>('desc')
  
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchArticles()
    fetchCategories()
  }, [currentPage, filterCategory, filterStatus, sortBy])

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('articles')
        .select('category')
        .not('category', 'is', null)
      
      if (data) {
        const unique = Array.from(new Set(data.map((a: any) => a.category).filter(Boolean))) as string[]
        setCategories(unique.sort())
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchArticles = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('articles')
        .select(`
          id, title, summary, summary_ai, url, published_at, 
          media_name, category, view_count, share_count,
          is_published, is_trending, is_premium, created_at,
          sentiment_score
        `, { count: 'exact' })
      
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`)
      }
      
      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory)
      }
      
      if (filterStatus === 'published') {
        query = query.eq('is_published', true)
      } else if (filterStatus === 'unpublished') {
        query = query.eq('is_published', false)
      }
      
      query = query.order(sortBy, { ascending: false })
      
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)
      
      const { data, error, count } = await query
      
      if (error) {
        console.error('Erreur:', error)
        return
      }
      
      setArticles(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (articleId: string, field: 'is_published' | 'is_trending' | 'is_premium', currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ [field]: !currentValue })
        .eq('id', articleId)
      
      if (!error) {
        fetchArticles()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Articles</h1>
        <p className="text-gray-600">{totalCount.toLocaleString()} articles</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un article..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes catégories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Statut */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous statuts</option>
              <option value="published">Publiés</option>
              <option value="unpublished">Non publiés</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={fetchArticles}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Trier par:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="created_at">Date création</option>
              <option value="view_count">Vues</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Article</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Média</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Catégorie</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                      <span title="Enrichissement IA">
                        <Sparkles className="w-4 h-4 mx-auto" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Stats</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Statuts</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {articles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="max-w-md">
                          <p className="font-medium text-gray-900 line-clamp-1">{article.title}</p>
                          {article.summary_ai && (
                            <p className="text-xs text-purple-600 line-clamp-1 mt-1">
                              🤖 {article.summary_ai}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(article.published_at || article.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{article.media_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {article.category && (
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {article.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          {article.sentiment_score !== null && (
                            <div className="flex flex-col items-center text-xs text-gray-600">
                              <span>{article.sentiment_score > 0 ? '😊' : article.sentiment_score < 0 ? '😟' : '😐'}</span>
                              <span className="text-xs text-gray-500 mt-1">
                                {article.sentiment_score.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {article.summary_ai && (
                            <span className="text-xs text-purple-600">IA ✓</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1 text-xs text-gray-600">
                          <div>👁️ {article.view_count.toLocaleString()}</div>
                          <div>🔗 {article.share_count.toLocaleString()}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            onClick={() => handleToggleStatus(article.id, 'is_published', article.is_published)}
                            className={`px-2 py-1 rounded text-xs font-medium w-20 ${
                              article.is_published
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {article.is_published ? 'Publié' : 'Brouillon'}
                          </button>
                          {article.is_premium && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                              Premium
                            </span>
                          )}
                          {article.is_trending && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                              Trending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => window.open(article.url, '_blank')}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Voir"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(article.id, 'is_trending', article.is_trending)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Trending"
                          >
                            <TrendingUp className={`w-4 h-4 ${article.is_trending ? 'text-red-500' : 'text-gray-400'}`} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(article.id, 'is_premium', article.is_premium)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Premium"
                          >
                            <Star className={`w-4 h-4 ${article.is_premium ? 'text-yellow-500' : 'text-gray-400'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} sur {totalPages} ({totalCount.toLocaleString()} articles)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
