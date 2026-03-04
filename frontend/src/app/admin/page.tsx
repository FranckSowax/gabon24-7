'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Rss, Users, RefreshCw,
  BarChart3, Gamepad2, Trophy,
  Eye, MousePointer, Cpu, Coins, Vote,
  Megaphone, FolderOpen, Zap,
  Target, Sparkles
} from 'lucide-react'
import Link from 'next/link'
import axios from '@/lib/axios'
import { supabase } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Types
interface AnalyticsData {
  // Contenu
  articles: { total: number, today: number, thisWeek: number, thisMonth: number }
  rssFeeds: { total: number, active: number, errors: number }
  
  // Utilisateurs
  users: { total: number, active: number, premium: number, newThisWeek: number }
  
  // IA
  aiUsage: { 
    totalRequests: number
    tokensUsed: number
    costUSD: number
    byFunction: Record<string, number>
  }
  
  // Engagement
  pageViews: { total: number, today: number, uniqueVisitors: number }
  clicks: { total: number, adClicks: number, linkClicks: number }
  
  // Publicité
  ads: { impressions: number, clicks: number, ctr: number, revenue: number }
  
  // Sondages
  polls: { total: number, responses: number, activePolls: number }
  
  // Projets
  projects: { total: number, thisMonth: number }
  
  // Jeu
  game: { sessions: number, players: number, prizePool: number, questions: number }
}

// Composant StatCard
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend, 
  color,
  onClick 
}: {
  icon: any
  label: string
  value: string | number
  subValue?: string
  trend?: { value: number, positive: boolean }
  color: string
  onClick?: () => void
}) => {
  const colorClasses: Record<string, { bg: string, text: string, border: string }> = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-500' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-500' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-500' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-500' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-500' },
    red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-500' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-500' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-500' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-500' },
  }
  
  const c = colorClasses[color] || colorClasses.orange

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`bg-white rounded-xl p-5 shadow-md border-l-4 ${c.border} hover:shadow-lg transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 ${c.bg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      {subValue && <p className={`text-xs ${c.text} mt-1`}>{subValue}</p>}
    </motion.div>
  )
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  // Helper pour récupérer le token d'authentification
  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()

      // Récupérer toutes les stats en parallèle
      const [
        statsRes,
        gameRes,
        pollsRes,
        projectsRes
      ] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/api/game/dashboard/stats`, { headers }).catch(() => ({ data: { stats: {} } })),
        axios.get(`${API_URL}/api/polls/global-stats`).catch(() => ({ data: { stats: {} } })),
        axios.get(`${API_URL}/api/saved-projects/global-stats`).catch(() => ({ data: { stats: {} } }))
      ])

      const s = statsRes.data || {}

      // Construire l'objet analytics avec les données réelles du backend
      setAnalytics({
        articles: {
          total: s.totalArticles || 0,
          today: s.todayArticles || 0,
          thisWeek: s.weekArticles || 0,
          thisMonth: s.monthArticles || 0
        },
        rssFeeds: {
          total: s.totalFeeds || 0,
          active: s.activeFeeds || 0,
          errors: s.errorFeeds || 0
        },
        users: {
          total: s.totalUsers || 0,
          active: s.totalUsers || 0,
          premium: s.premiumUsers || 0,
          newThisWeek: s.newUsersThisWeek || 0
        },
        aiUsage: {
          totalRequests: s.aiTotalRequests || 0,
          tokensUsed: 0,
          costUSD: 0,
          byFunction: s.aiByFunction || {}
        },
        pageViews: {
          total: s.totalPageViews || 0,
          today: s.todayPageViews || 0,
          uniqueVisitors: s.uniqueVisitorsToday || 0
        },
        clicks: {
          total: s.adClicks || 0,
          adClicks: s.adClicks || 0,
          linkClicks: 0
        },
        ads: {
          impressions: s.adImpressions || 0,
          clicks: s.adClicks || 0,
          ctr: s.adCtr || 0,
          revenue: s.adRevenue || 0
        },
        polls: {
          total: pollsRes.data?.stats?.totalPolls || 0,
          responses: pollsRes.data?.stats?.totalResponses || 0,
          activePolls: pollsRes.data?.stats?.activePolls || 0
        },
        projects: {
          total: projectsRes.data?.stats?.totalProjects || 0,
          thisMonth: projectsRes.data?.stats?.projectsThisMonth || 0
        },
        game: {
          sessions: gameRes.data?.stats?.totalSessions || 0,
          players: gameRes.data?.stats?.totalRegistrations || 0,
          prizePool: gameRes.data?.stats?.totalPrizePool || 0,
          questions: gameRes.data?.stats?.totalQuestions || 0
        }
      })
    } catch (error) {
      console.error('Erreur chargement analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  // Éviter l'erreur d'hydratation
  useEffect(() => {
    setMounted(true)
    setLastUpdate(new Date().toLocaleString('fr-FR'))
  }, [])

  // Charger les analytics au montage et lors du changement de période
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics, selectedPeriod])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement des analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Vue d&apos;ensemble complète de Gabon 24/7</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-lg shadow-sm p-1">
            {(['today', 'week', 'month'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period 
                    ? 'bg-orange-500 text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {period === 'today' ? "Aujourd'hui" : period === 'week' ? '7 jours' : '30 jours'}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchAnalytics}
            className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* KPIs Principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={FileText}
          label="Articles"
          value={analytics?.articles.total.toLocaleString() || 0}
          subValue={`+${analytics?.articles.today} aujourd'hui`}
          color="orange"
        />
        <StatCard
          icon={Users}
          label="Utilisateurs"
          value={analytics?.users.total || 0}
          subValue={`+${analytics?.users.newThisWeek} cette semaine`}
          color="blue"
        />
        <StatCard
          icon={Eye}
          label="Pages vues"
          value={analytics?.pageViews.total.toLocaleString() || 0}
          subValue={`${analytics?.pageViews.today} aujourd'hui`}
          color="green"
        />
        <StatCard
          icon={MousePointer}
          label="Clics totaux"
          value={analytics?.clicks.total.toLocaleString() || 0}
          subValue={`${analytics?.clicks.adClicks} sur pubs`}
          color="purple"
        />
        <StatCard
          icon={Cpu}
          label="Requêtes IA"
          value={analytics?.aiUsage.totalRequests || 0}
          subValue={`$${analytics?.aiUsage.costUSD.toFixed(2)} dépensés`}
          color="pink"
        />
        <StatCard
          icon={Gamepad2}
          label="Joueurs Jeu"
          value={analytics?.game.players || 0}
          subValue={`${analytics?.game.sessions} sessions`}
          color="indigo"
        />
      </div>

      {/* Section Contenu & RSS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Articles par période */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Articles publiés
            </h3>
            <Link href="/admin/articles" className="text-sm text-orange-600 hover:underline">
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="text-gray-600">Aujourd&apos;hui</span>
              <span className="font-bold text-orange-600">{analytics?.articles.today}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Cette semaine</span>
              <span className="font-bold text-gray-900">{analytics?.articles.thisWeek}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Ce mois</span>
              <span className="font-bold text-gray-900">{analytics?.articles.thisMonth}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-gray-600">Total</span>
              <span className="font-bold text-green-600">{analytics?.articles.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Flux RSS */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Rss className="w-5 h-5 text-green-500" />
              Flux RSS
            </h3>
            <Link href="/admin/veille" className="text-sm text-green-600 hover:underline">
              Gérer →
            </Link>
          </div>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke="#22c55e" strokeWidth="12" fill="none"
                  strokeDasharray={`${(analytics?.rssFeeds.active || 0) / (analytics?.rssFeeds.total || 1) * 352} 352`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{analytics?.rssFeeds.active}</span>
                <span className="text-xs text-gray-500">actifs</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{analytics?.rssFeeds.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">{analytics?.rssFeeds.active}</p>
              <p className="text-xs text-gray-500">Actifs</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <p className="text-lg font-bold text-red-600">{analytics?.rssFeeds.errors}</p>
              <p className="text-xs text-gray-500">Erreurs</p>
            </div>
          </div>
        </div>

        {/* Usage IA */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Usage IA
            </h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              OpenAI GPT-4.1
            </span>
          </div>
          <div className="space-y-3">
            {Object.keys(analytics?.aiUsage.byFunction || {}).length > 0 ? (
              Object.entries(analytics?.aiUsage.byFunction || {}).map(([func, count]) => (
                <div key={func} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{func}</span>
                      <span className="font-medium">{String(count)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{ width: `${count}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Aucune utilisation IA ce mois</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Requetes totales</span>
            <span className="font-bold text-purple-600">{analytics?.aiUsage.totalRequests || 0}</span>
          </div>
        </div>
      </div>

      {/* Section Engagement & Publicité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publicités */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-yellow-500" />
              Performance Publicités
            </h3>
            <Link href="/admin/campaigns" className="text-sm text-yellow-600 hover:underline">
              Campagnes →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-yellow-50 rounded-xl text-center">
              <Eye className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{(analytics?.ads.impressions || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Impressions</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <MousePointer className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{analytics?.ads.clicks}</p>
              <p className="text-sm text-gray-500">Clics</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl text-center">
              <Target className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{analytics?.ads.ctr}%</p>
              <p className="text-sm text-gray-500">CTR</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center">
              <Coins className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{(analytics?.ads.revenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">FCFA Revenus</p>
            </div>
          </div>
        </div>

        {/* Sondages & Projets */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Vote className="w-5 h-5 text-indigo-500" />
              Sondages & Projets
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/admin/sondages" className="p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <Vote className="w-5 h-5 text-indigo-600" />
                <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                  {analytics?.polls.activePolls} actifs
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics?.polls.total}</p>
              <p className="text-sm text-gray-500">Sondages</p>
              <p className="text-xs text-indigo-600 mt-1">{analytics?.polls.responses} réponses</p>
            </Link>
            <div className="p-4 bg-teal-50 rounded-xl">
              <FolderOpen className="w-5 h-5 text-teal-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">{analytics?.projects.total}</p>
              <p className="text-sm text-gray-500">Projets créés</p>
              <p className="text-xs text-teal-600 mt-1">+{analytics?.projects.thisMonth} ce mois</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Jeu */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">🎮 Il n&apos;en restera qu&apos;1</h3>
              <p className="text-purple-200 text-sm">Battle Royale Quiz</p>
            </div>
          </div>
          <Link
            href="/dashboard/jeu"
            className="flex items-center gap-2 bg-white text-purple-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard Jeu
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
            <Gamepad2 className="w-6 h-6 mx-auto mb-2 text-purple-200" />
            <p className="text-2xl font-bold">{analytics?.game.sessions}</p>
            <p className="text-sm text-purple-200">Sessions</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-purple-200" />
            <p className="text-2xl font-bold">{analytics?.game.players}</p>
            <p className="text-sm text-purple-200">Joueurs</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
            <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
            <p className="text-2xl font-bold">{((analytics?.game.prizePool || 0) / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-purple-200">FCFA Cagnotte</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
            <Zap className="w-6 h-6 mx-auto mb-2 text-purple-200" />
            <p className="text-2xl font-bold">{analytics?.game.questions}</p>
            <p className="text-sm text-purple-200">Questions</p>
          </div>
        </div>
      </div>

      {/* Accès rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { href: '/admin/articles', icon: FileText, label: 'Articles', color: 'orange' },
          { href: '/admin/veille', icon: Rss, label: 'Veille RSS', color: 'green' },
          { href: '/admin/campaigns', icon: Megaphone, label: 'Publicités', color: 'yellow' },
          { href: '/admin/sondages', icon: Vote, label: 'Sondages', color: 'indigo' },
          { href: '/admin/users', icon: Users, label: 'Utilisateurs', color: 'blue' },
          { href: '/dashboard/jeu', icon: Gamepad2, label: 'Jeu Quiz', color: 'purple' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-1`}
          >
            <div className={`p-3 bg-${item.color}-100 rounded-xl mb-2`}>
              <item.icon className={`w-6 h-6 text-${item.color}-600`} />
            </div>
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 pt-4">
        <p>Dernière mise à jour: {mounted ? lastUpdate : '...'}</p>
      </div>
    </div>
  )
}
