import React, { useState, useEffect } from 'react'

interface StatsWidgetProps {
  articles: any[]
  loading: boolean
}

interface Stats {
  totalArticles: number
  todayArticles: number
  activeSources: number
  lastUpdate: string
  topSource: string
  averageReadTime: number
}

export default function StatsWidget({ articles, loading }: StatsWidgetProps) {
  const [stats, setStats] = useState<Stats>({
    totalArticles: 0,
    todayArticles: 0,
    activeSources: 0,
    lastUpdate: 'Jamais',
    topSource: 'Aucune',
    averageReadTime: 0
  })

  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (articles.length > 0) {
      setIsAnimating(true)
      
      // Calculer les statistiques
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const todayArticles = articles.filter(article => {
        const articleDate = new Date(article.published_at || article.publishedAt)
        return articleDate >= today
      }).length

      const sources = Array.from(new Set(articles.map(article => article.source)))
      const sourceCounts = articles.reduce((acc, article) => {
        acc[article.source] = (acc[article.source] || 0) + 1
        return acc
      }, {} as { [key: string]: number })

      const topSource = Object.entries(sourceCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'Aucune'

      const averageReadTime = articles.reduce((sum, article) => {
        const wordCount = (article.summary || '').split(' ').length
        return sum + Math.max(1, Math.ceil(wordCount / 200)) // 200 mots par minute
      }, 0) / articles.length || 0

      setStats({
        totalArticles: articles.length,
        todayArticles,
        activeSources: sources.length,
        lastUpdate: new Date().toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        topSource,
        averageReadTime: Math.round(averageReadTime)
      })

      setTimeout(() => setIsAnimating(false), 500)
    }
  }, [articles])

  const StatItem = ({ icon, label, value, suffix = '', color = 'text-gray-900' }: {
    icon: string
    label: string
    value: string | number
    suffix?: string
    color?: string
  }) => (
    <div className={`transition-all duration-300 ${isAnimating ? 'scale-105' : 'scale-100'}`}>
      <div className="flex items-center space-x-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>
        {loading ? (
          <div className="h-6 bg-gray-200 rounded animate-pulse w-12"></div>
        ) : (
          `${value}${suffix}`
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">📊 Statistiques en direct</h3>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-500">Live</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatItem
          icon="📰"
          label="Aujourd'hui"
          value={stats.todayArticles}
          color="text-orange-600"
        />
        <StatItem
          icon="📚"
          label="Total"
          value={stats.totalArticles}
        />
        <StatItem
          icon="🏢"
          label="Sources"
          value={stats.activeSources}
          color="text-blue-600"
        />
        <StatItem
          icon="⏱️"
          label="Lecture moy."
          value={stats.averageReadTime}
          suffix=" min"
          color="text-green-600"
        />
      </div>

      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Source principale</span>
          <span className="text-sm font-medium text-gray-900 truncate max-w-24" title={stats.topSource}>
            {stats.topSource}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Dernière mise à jour</span>
          <span className="text-sm font-medium text-gray-900">{stats.lastUpdate}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Actualisation automatique</span>
          <div className="flex items-center space-x-1">
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600">Activée</span>
          </div>
        </div>
      </div>
    </div>
  )
}
