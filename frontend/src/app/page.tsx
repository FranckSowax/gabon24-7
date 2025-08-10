'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Header from '../components/layout/Header'
import Sidebar from '../components/layout/Sidebar'
import ArticleCard from '../components/features/ArticleCard'
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
  readTime: string
  trending?: boolean
  author?: string
  url?: string
  image_url?: string
  image_urls?: string[]  // Images extraites via web scraping
  sentiment?: string
  created_at?: string
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('Pour Vous')
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
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
      readTime: '3 min',
      trending: true
    },
    {
      id: '2',
      title: 'Lancement du Programme de Reforestation Nationale',
      summary: 'Le gouvernement gabonais annonce un ambitieux programme de reforestation visant à planter 10 millions d\'arbres d\'ici 2030 pour lutter contre le changement climatique.',
      source: 'L\'Union',
      publishedAt: '4 heures',
      category: 'Environnement',
      readTime: '2 min',
      trending: true
    },
    {
      id: '3',
      title: 'Inauguration du Nouveau Terminal de l\'Aéroport de Libreville',
      summary: 'Le président Ali Bongo Ondimba a inauguré le nouveau terminal international de l\'aéroport Léon Mba, modernisant l\'infrastructure aéroportuaire du pays.',
      source: 'Gabon Review',
      publishedAt: '6 heures',
      category: 'Infrastructure',
      readTime: '4 min'
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

  const handleShareArticle = (article: Article) => {
    const text = `${article.title}\n\n${article.summary}\n\nSource: ${article.source}\nVia GabonNews`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
    
    setNotification({
      type: 'success',
      title: 'Article partagé',
      message: 'L\'article a été partagé sur WhatsApp.'
    })
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
            summary: article.ai_summary || article.summary,
            ai_summary: article.ai_summary,
            source: getMediaDisplayName(article), // Nom du média enrichi
            publishedAt: formatTimeAgo(article.published_at || article.created_at),
            published_at: article.published_at,
            category: article.category,
            readTime: formatReadTime(article.read_time_minutes), // Durée réelle de lecture
            author: article.author || 'Rédaction',
            url: article.url,
            image_url: article.image_urls?.[0] || null, // Image principale
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

  const formatReadTime = (minutes: number) => {
    if (!minutes || minutes < 1) return '1 min'
    if (minutes === 1) return '1 min'
    return `${minutes} min`
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
      {/* Header Component */}
      <Header onSearch={handleSearch} onSubscribe={handleSubscribe} />

      <div className="flex">
        {/* Sidebar Component */}
        <Sidebar user={{ name: 'Rae', email: 'rae.email@gmail.com' }} />

        {/* Contenu Central */}
        <main className="flex-1 max-w-4xl mx-auto p-6">
          {/* Bannière d'abonnement */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">S'abonner à GabonNews+</h2>
              <p className="text-orange-100">Débloquez un accès gratuit à la lecture et l'accès aux articles premium en vous abonnant à GabonNews+</p>
            </div>
            <button 
              onClick={handleSubscribe}
              className="bg-white text-orange-500 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              S'abonner Maintenant
            </button>
          </div>

          {/* Catégories */}
          <div className="flex space-x-6 mb-6 border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('Pour Vous')}
              className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'Pour Vous' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pour Vous
            </button>
            <button 
              onClick={() => setActiveTab('Tendances')}
              className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'Tendances' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tendances
            </button>
            <button 
              onClick={() => setActiveTab('Suivis')}
              className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'Suivis' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Suivis
            </button>
          </div>

          {/* État de chargement */}
          {loading ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
              </div>
              <div className="space-y-4">
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
                <ArticleCardSkeleton />
              </div>
            </div>
          ) : (
            <>
              {/* Articles en Vedette */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {displayArticles.slice(0, 2).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="featured"
                    onSave={handleSaveArticle}
                    onShare={handleShareArticle}
                  />
                ))}
              </div>

              {/* Articles Récents */}
              <div className="space-y-4">
                {displayArticles.slice(2).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="list"
                    onSave={handleSaveArticle}
                    onShare={handleShareArticle}
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

        {/* Sidebar Droite */}
        <aside className="w-80 bg-white border-l border-gray-200 p-6 sticky top-16 h-screen overflow-y-auto">
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
