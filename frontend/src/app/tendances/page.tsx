'use client';

import { useState, useEffect } from 'react';
import { ArticleCard } from '@/components/features/ArticleCard';
import { Loading } from '@/components/ui/Loading';
import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Article {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  published_at: string;
  category: string;
  viewCount: string;
  view_count: number;
  share_count?: number;
  url: string;
  imageUrl: string;
  author: string;
  trending: boolean;
}

interface TrendingStats {
  daily: {
    mostViewed: Article[];
    mostShared: Article[];
  };
  monthly: {
    mostViewed: Article[];
    mostShared: Article[];
  };
}

export default function TendancesPage() {
  const [stats, setStats] = useState<TrendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [activeMetric, setActiveMetric] = useState<'views' | 'shares'>('views');

  useEffect(() => {
    fetchTrendingStats();
  }, []);

  const fetchTrendingStats = async () => {
    try {
      setLoading(true);
      console.log('📊 Récupération des statistiques de tendances...');

      const [dailyViews, monthlyViews, dailyShares, monthlyShares] = await Promise.all([
        axios.get(`${API_URL}/api/stats/trending/daily/views`, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }),
        axios.get(`${API_URL}/api/stats/trending/monthly/views`, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }),
        axios.get(`${API_URL}/api/stats/trending/daily/shares`, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }),
        axios.get(`${API_URL}/api/stats/trending/monthly/shares`, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      const trendingStats: TrendingStats = {
        daily: {
          mostViewed: dailyViews.data.articles || [],
          mostShared: dailyShares.data.articles || []
        },
        monthly: {
          mostViewed: monthlyViews.data.articles || [],
          mostShared: monthlyShares.data.articles || []
        }
      };

      setStats(trendingStats);
      console.log('✅ Statistiques de tendances récupérées');
    } catch (error) {
      console.error('❌ Erreur récupération tendances:', error);
      // Fallback avec données vides
      setStats({
        daily: { mostViewed: [], mostShared: [] },
        monthly: { mostViewed: [], mostShared: [] }
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentArticles = (): Article[] => {
    if (!stats) return [];
    
    if (activeTab === 'daily') {
      return activeMetric === 'views' ? stats.daily.mostViewed : stats.daily.mostShared;
    } else {
      return activeMetric === 'views' ? stats.monthly.mostViewed : stats.monthly.mostShared;
    }
  };

  const handleArticleClick = (article: Article) => {
    // Incrémenter les vues
    axios.post(`${API_URL}/api/articles/${article.id}/view`)
      .catch(error => console.error('Erreur incrémentation vues:', error));
    
    // Ouvrir l'article
    if (article.url) {
      window.open(article.url, '_blank');
    }
  };

  const handleSaveArticle = (articleId: string) => {
    console.log('Sauvegarde article:', articleId);
    // TODO: Implémenter la sauvegarde
  };

  const handleShare = (article: Article) => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: article.url
      });
    } else {
      navigator.clipboard.writeText(article.url);
      alert('Lien copié dans le presse-papiers !');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📈 Tendances</h1>
              <p className="text-gray-600 mt-1">
                Découvrez les articles les plus populaires
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Mis à jour en temps réel
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Période */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Période
              </label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'daily'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Aujourd'hui
                </button>
                <button
                  onClick={() => setActiveTab('monthly')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === 'monthly'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Ce mois
                </button>
              </div>
            </div>

            {/* Métrique */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Classement par
              </label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveMetric('views')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeMetric === 'views'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  👁️ Vues
                </button>
                <button
                  onClick={() => setActiveMetric('shares')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeMetric === 'shares'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📤 Partages
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loading />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Titre de la section */}
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {activeMetric === 'views' ? '👁️' : '📤'}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {activeTab === 'daily' ? 'Aujourd\'hui' : 'Ce mois'} - 
                {activeMetric === 'views' ? ' Plus vus' : ' Plus partagés'}
              </h2>
              <div className="text-sm text-gray-500">
                ({getCurrentArticles().length} articles)
              </div>
            </div>

            {/* Liste des articles */}
            {getCurrentArticles().length > 0 ? (
              <div className="grid gap-6">
                {getCurrentArticles().map((article, index) => (
                  <div key={article.id} className="relative">
                    {/* Badge de classement */}
                    <div className="absolute -left-4 -top-2 z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-600' :
                        'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    {/* Article Card */}
                    <div className="ml-4">
                      <ArticleCard
                        article={article}
                        variant="list"
                        onClick={() => handleArticleClick(article)}
                        onSave={() => handleSaveArticle(article.id)}
                        onShare={() => handleShare(article)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune donnée disponible
                </h3>
                <p className="text-gray-600">
                  Les statistiques de tendances seront disponibles une fois que les articles auront été consultés.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
