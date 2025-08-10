'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import ArticleCard from '@/components/features/ArticleCard'
import SubscriptionModal from '../components/features/SubscriptionModal'
import Loading, { ArticleCardSkeleton } from '../components/ui/Loading'
import Notification from '../components/ui/Notification'

interface Article {
  id: string
  title: string
  summary: string
  ai_summary?: string
  source: string
  publishedAt: string
  published_at?: string
  category: string
  viewCount: string  // Remplace readTime - nombre de vues formaté
  view_count?: number  // Valeur brute pour les calculs
  trending?: boolean
  author?: string
  url?: string
  image_url?: string
  image_urls?: string[]  // Images extraites via web scraping
  sentiment?: string
  created_at?: string
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pour-vous')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([])
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
  } | null>(null)
  const [savedArticles, setSavedArticles] = useState<string[]>([])

  // Articles par défaut
  const defaultArticles: Article[] = [
    {
      id: '1',
      title: 'Nouvelle Découverte Pétrolière au Large de Port-Gentil',
      summary: 'Une importante réserve de pétrole a été découverte au large des côtes gabonaises, promettant de renforcer l\'économie nationale et de créer de nouveaux emplois dans le secteur énergétique.',
      source: 'Gabon Matin',
      publishedAt: '2 heures',
      category: 'Économie',
      viewCount: '0 vue',
      view_count: 0,
      trending: true
    },
    {
      id: '2',
      title: 'Lancement du Programme de Reforestation Nationale',
      summary: 'Le gouvernement gabonais annonce un ambitieux programme de reforestation visant à planter 10 millions d\'arbres d\'ici 2030 pour lutter contre le changement climatique.',
      source: 'L\'Union',
      publishedAt: '4 heures',
      category: 'Environnement',
      viewCount: '0 vue',
      view_count: 0,
      trending: true
    },
    {
      id: '3',
      title: 'Inauguration du Nouveau Terminal de l\'Aéroport de Libreville',
      summary: 'Le président Ali Bongo Ondimba a inauguré le nouveau terminal international de l\'aéroport Léon Mba, modernisant l\'infrastructure aéroportuaire du pays.',
      source: 'Gabon Review',
      publishedAt: '6 heures',
      category: 'Infrastructure',
      viewCount: '0 vue',
      view_count: 0
    }
  ]

  const curated = [
    {
      author: 'Alfredo Lubin',
      category: 'Technologie',
      title: 'Nouvelle Technologie Solaire Augmente l\'Efficacité de 30%',
      date: '11 Juil 2024',
      readTime: '2 min'
    },
    {
      author: 'Justin Levin',
      category: 'Environnement',
      title: 'L\'Arbre le Plus Ancien Connu Découvert en Australie',
      date: '12 Juil 2024',
      readTime: '4 min'
    },
    {
      author: 'Charlie Dorward',
      category: 'Technologie',
      title: 'L\'IA Peut Maintenant Créer de l\'Art dans le Style de Peintres Célèbres',
      date: '13 Juil 2024',
      readTime: '5 min'
    }
  ]

  const categories = ['Mode', 'Politique', 'Divertissement', 'Sports', 'Technologie', 'Finance', 'Santé & Bien-être', 'Science', 'Style de vie']
  const recommendedFollows = [
    { name: 'Haylie Botosh', avatar: '👩' },
    { name: 'Emerson Dias', avatar: '👨' }
  ]

  // Handlers
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

  const handleSubscribe = () => {
    setShowSubscriptionModal(true)
  }

  const handleSubscriptionComplete = (plan: string) => {
    setNotification({
      type: 'success',
      title: 'Abonnement en cours',
      message: `Votre abonnement ${plan} est en cours de traitement. Vous recevrez une confirmation par WhatsApp.`
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

  const handleShare = (article: any) => {
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${article.title} - ${article.url}`)}`
    window.open(shareUrl, '_blank')
    
    setNotification({
      type: 'success',
      title: 'Article partagé',
      message: 'L\'article a été partagé sur WhatsApp.'
    })
  }

  // Fonction pour incrémenter les vues quand un utilisateur clique sur un article
  const handleArticleClick = async (article: any) => {
    try {
      // Ouvrir l'article dans un nouvel onglet
      window.open(article.url, '_blank')
      
      // Incrémenter le compteur de vues
      const response = await axios.post(`http://localhost:3001/api/articles/${article.id}/view`)
      
      if (response.data.success) {
        console.log(`👁️ Vue comptabilisée pour: ${article.title} (${response.data.view_count} vues)`)
        
        // Mettre à jour le compteur local pour un feedback immédiat
        setArticles(prevArticles => 
          prevArticles.map(a => 
            a.id === article.id 
              ? { ...a, view_count: response.data.view_count, viewCount: formatViewCount(response.data.view_count) }
              : a
          )
        )
        setFilteredArticles(prevArticles => 
          prevArticles.map(a => 
            a.id === article.id 
              ? { ...a, view_count: response.data.view_count, viewCount: formatViewCount(response.data.view_count) }
              : a
          )
        )
      }
    } catch (error) {
      console.error('❌ Erreur lors de la comptabilisation de la vue:', error)
      // Ouvrir l'article même en cas d'erreur de comptage
      window.open(article.url, '_blank')
    }
  }

  // Effects
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true)
      try {
        console.log('🏠 Récupération des articles pour la page d\'accueil...')
        const response = await axios.get('http://localhost:3001/api/homepage/articles?limit=20')
        
        if (response.data?.success && response.data?.articles) {
          // Transformer les articles pour correspondre à l'interface
          const transformedArticles = response.data.articles.map((article: any) => ({
            id: article.id,
            title: article.title,
            summary: ensureCompleteSummary(article.ai_summary || article.summary),
            ai_summary: article.ai_summary,
            source: getMediaDisplayName(article), // Nom du média enrichi
            publishedAt: formatTimeAgo(article.published_at || article.created_at),
            published_at: article.published_at,
            category: article.category,
            viewCount: formatViewCount(article.view_count || 0), // Nombre de vues
            view_count: article.view_count || 0, // Valeur brute pour debug
            author: article.author || 'Rédaction',
            url: article.url,
            image_url: article.image_urls?.[0] || null, // Image principale
            image_urls: article.image_urls, // Array complet des images
            sentiment: article.sentiment,
            created_at: article.created_at,
            trending: Math.random() > 0.7 // Marquer aléatoirement certains articles comme trending
          }))
          
          console.log(`✅ ${transformedArticles.length} articles récupérés pour la page d'accueil`)
          setArticles(transformedArticles)
          setFilteredArticles(transformedArticles)
        } else {
          console.log('⚠️ Aucun article récupéré, utilisation des articles par défaut')
          setArticles(defaultArticles)
          setFilteredArticles(defaultArticles)
        }
      } catch (error) {
        console.log('❌ Erreur récupération articles, utilisation des articles par défaut:', error)
        setArticles(defaultArticles)
        setFilteredArticles(defaultArticles)
      } finally {
        setLoading(false)
      }
    }
    
    fetchArticles()
    
    // Actualiser les articles toutes les 5 minutes
    const interval = setInterval(fetchArticles, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Fonctions utilitaires
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Récent'
    
    const now = new Date()
    const date = new Date(dateString)
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) return 'Récent'
    
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    // Si la date est dans le futur (peut arriver avec les flux RSS), afficher "À l'instant"
    if (diffInMinutes < 0) return 'À l\'instant'
    
    if (diffInMinutes < 1) return 'À l\'instant'
    if (diffInMinutes < 60) return `il y a ${diffInMinutes} min`
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60)
      return `il y a ${hours} h`
    }
    if (diffInMinutes < 10080) { // 7 jours
      const days = Math.floor(diffInMinutes / 1440)
      return `il y a ${days} j`
    }
    
    // Pour les articles plus anciens, afficher la date formatée
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }
    return date.toLocaleDateString('fr-FR', options)
  }

  // Fonctions utilitaires enrichies
  const getMediaDisplayName = (article: any) => {
    // Extraire le nom du média depuis l'URL ou utiliser une source connue
    if (article.url) {
      if (article.url.includes('agpgabon.ga')) return 'AGP - Agence Gabonaise de Presse'
      if (article.url.includes('gabonreview.com')) return 'Gabon Review'
      if (article.url.includes('info241.com')) return 'Info241'
      if (article.url.includes('gaboneco.com')) return 'Gabon Eco'
      if (article.url.includes('lunion.ga')) return 'L\'Union'
      if (article.url.includes('voxpopuligabon.com')) return 'Vox Populi'
    }
    return article.source || 'GabonNews'
  }

  // Fonction pour s'assurer que les résumés sont complets
  const ensureCompleteSummary = (summary: string) => {
    if (!summary || summary.length < 10) return 'Résumé non disponible';
    
    // Si le résumé se termine par des points de suspension, essayer de le compléter
    if (summary.endsWith('...') || summary.endsWith('…')) {
      // Retirer les points de suspension et ajouter un point si nécessaire
      let cleanSummary = summary.replace(/\.{3,}|…$/, '').trim();
      if (!cleanSummary.match(/[.!?]$/)) {
        cleanSummary += '.';
      }
      return cleanSummary;
    }
    
    // S'assurer que le résumé se termine par une ponctuation
    if (!summary.match(/[.!?]$/)) {
      return summary.trim() + '.';
    }
    
    return summary;
  }

  const formatViewCount = (count: number) => {
    // Formater le nombre de vues
    if (!count || count < 1) return '0 vue'
    if (count === 1) return '1 vue'
    if (count < 1000) return `${count} vues`
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k vues`
    return `${(count / 1000000).toFixed(1)}M vues`
  }

  const estimateReadTime = (text: string) => {
    if (!text) return '1 min'
    const wordsPerMinute = 200
    const wordCount = text.split(' ').length
    const readTime = Math.ceil(wordCount / wordsPerMinute)
    return `${readTime} min`
  }

  useEffect(() => {
    if (!searchQuery) {
      setFilteredArticles(articles)
    }
  }, [articles, searchQuery])

  const displayArticles = searchQuery ? filteredArticles : articles

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileSidebarOpen(true)} />

      <div className="flex">
        {/* Sidebar - Mobile drawer + Desktop sidebar */}
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Contenu Central -        {/* Main Content - Centré au milieu */}
        <main className="flex-1 max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          {/* Subscription Banner - Mobile optimized */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Restez informé avec GabonNews Premium</h2>
                <p className="text-sm sm:text-base text-orange-100">Accédez aux dernières actualités du Gabon en temps réel</p>
              </div>
              <button className="bg-white text-orange-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm sm:text-base w-full sm:w-auto">
                <span className="sm:hidden">S'abonner</span>
                <span className="hidden sm:inline">S'abonner maintenant</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs - Horizontally scrollable on mobile */}
          <div className="mb-4 sm:mb-6">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide pb-2">
              {[
                { id: 'pour-vous', label: 'Pour Vous', icon: '👤' },
                { id: 'tendances', label: 'Tendances', icon: '🔥' },
                { id: 'suivis', label: 'Suivis', icon: '👥' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors whitespace-nowrap text-xs sm:text-sm lg:text-base ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm sm:text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* État de chargement */}
          {loading ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
              </div>
            </div>
          ) : (
            <>
              {/* Articles en Vedette - Responsive grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {displayArticles.slice(0, 2).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="featured"
                    onSave={handleSaveArticle}
                    onShare={handleShare}
                    onClick={handleArticleClick}
                  />
                ))}
              </div>

              {/* Articles Récents - Mobile optimized spacing */}
              <div className="space-y-3 sm:space-y-4">
                {displayArticles.slice(2).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="list"
                    onSave={handleSaveArticle}
                    onShare={handleShare}
                    onClick={handleArticleClick}
                  />
                ))}
              </div>

              {/* Message si aucun résultat */}
              {displayArticles.length === 0 && searchQuery && (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun résultat trouvé</h3>
                  <p className="text-gray-500">Essayez avec d'autres mots-clés ou parcourez nos articles tendances.</p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Sidebar Droite - Hidden on mobile and tablet */}
        <aside className="hidden xl:block w-80 bg-white border-l border-gray-200 p-6 sticky top-16 h-screen overflow-y-auto">
          {/* Sélections Curées */}
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4">Sélections Curées</h3>
            <div className="space-y-4">
              {curated.map((item, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-xs">👤</span>
                    </div>
                    <span className="text-sm font-medium">{item.author}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{item.category}</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-2 hover:text-orange-600 cursor-pointer line-clamp-2">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{item.date}</span>
                    <span>{item.readTime} de lecture</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catégories */}
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4">Catégories</h3>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className="text-left p-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  {category}
                </button>
              ))}
            </div>
            <button className="text-sm text-orange-500 hover:text-orange-600 mt-3">
              Voir Plus de Catégories
            </button>
          </div>

          {/* Suivis Recommandés */}
          <div>
            <h3 className="font-bold text-lg mb-4">Suivis Recommandés</h3>
            <div className="space-y-3">
              {recommendedFollows.map((user, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-lg">{user.avatar}</span>
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <button className="bg-gray-900 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-800">
                    Suivre +
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Modals et Notifications */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscriptionComplete}
      />

      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}
