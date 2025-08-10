'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface Article {
  id: string
  title: string
  summary: string
  aiSummary: string
  source: string
  category: string
  author: string
  publishedAt: string
  readTime: string
  link: string
  keywords: string[]
  sentiment: string
  sentimentConfidence: number
  images: string[]
  createdAt: string
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`http://localhost:3001/api/articles`, {
        params: {
          page: currentPage,
          limit: 20,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          search: searchTerm || undefined,
          sortBy,
          sortOrder
        }
      })
      
      if (response.data.success) {
        setArticles(response.data.data.articles)
        setTotalPages(response.data.data.totalPages)
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des articles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [currentPage, selectedCategory, sortBy, sortOrder])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchArticles()
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positif': return 'text-green-600 bg-green-100'
      case 'négatif': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positif': return '😊'
      case 'négatif': return '😟'
      default: return '😐'
    }
  }

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return 'N/A'
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gestion des Articles</h1>
        <p className="text-gray-600">Articles récupérés depuis les flux RSS avec résumés IA</p>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="md:col-span-2">
            <div className="flex">
              <input
                type="text"
                placeholder="Rechercher dans les articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-orange-500 text-white rounded-r-lg hover:bg-orange-600"
              >
                🔍
              </button>
            </div>
          </div>

          {/* Catégorie */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes catégories</option>
              <option value="Actualités">Actualités</option>
              <option value="Économie">Économie</option>
              <option value="Politique">Politique</option>
              <option value="Sports">Sports</option>
              <option value="Culture">Culture</option>
            </select>
          </div>

          {/* Tri */}
          <div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field)
                setSortOrder(order)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="createdAt-desc">Plus récents</option>
              <option value="createdAt-asc">Plus anciens</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="source-asc">Source A-Z</option>
              <option value="sentiment-desc">Sentiment</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">{articles.length}</div>
          <div className="text-sm text-gray-600">Articles affichés</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">
            {articles.filter(a => a.sentiment === 'positif').length}
          </div>
          <div className="text-sm text-gray-600">Articles positifs</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-red-600">
            {articles.filter(a => a.sentiment === 'négatif').length}
          </div>
          <div className="text-sm text-gray-600">Articles négatifs</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {new Set(articles.map(a => a.source)).size}
          </div>
          <div className="text-sm text-gray-600">Sources actives</div>
        </div>
      </div>

      {/* Table des articles */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Aucun article trouvé</p>
            <p className="text-sm mt-2">Vérifiez que les flux RSS sont actifs et synchronisés</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Article
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Résumé IA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mots-clés
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {truncateText(article.title, 60)}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          {article.author} • {article.readTime}
                        </div>
                        <div className="text-xs text-gray-400">
                          {truncateText(article.summary, 100)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-sm">
                        <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                          {truncateText(article.aiSummary || 'Résumé en cours...', 150)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{article.source}</div>
                        <div className="text-gray-500">{article.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(article.sentiment)}`}>
                        {getSentimentIcon(article.sentiment)} {article.sentiment}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {Math.round((article.sentimentConfidence || 0) * 100)}% confiance
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(article.keywords || []).slice(0, 3).map((keyword, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800"
                          >
                            {keyword}
                          </span>
                        ))}
                        {(article.keywords || []).length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{(article.keywords || []).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{formatDate(article.publishedAt)}</div>
                      <div className="text-xs text-gray-400">
                        Ajouté: {formatDate(article.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex space-x-2">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(article.link)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Copier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Précédent
            </button>
            
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 border rounded-lg ${
                    currentPage === page
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
