'use client'

import { useState, useEffect } from 'react'
import {
  Gamepad2, Users, Trophy, MessageCircle, Calendar,
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
  Plus, Search, Filter, Download, Eye, Zap, HelpCircle,
  Crown, Medal, X, DollarSign, BarChart3, CalendarDays,
  Phone, AlertCircle, Trash2
} from 'lucide-react'

interface GameSession {
  id: string
  session_type: string
  name: string
  entry_fee: number
  max_players: number
  current_players: number
  prize_pool: number
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  scheduled_start: string | null
  created_at: string
  stats?: {
    registrations: number
    winners: number
    revenue: number
    fillRate: number
  }
}

interface Registration {
  id: string
  session_id: string
  player_name: string
  whatsapp_number: string
  amount_paid?: number
  status: string
  created_at: string
  eliminated_at_round?: number
  eliminated_at_question?: string
  final_position?: number
  game_sessions?: GameSession
}

interface Question {
  id: string
  difficulty: string
  question_text: string
  answers: string[]
  correct_index: number
  created_at: string
  source_excerpt?: string
}

interface AdvancedStats {
  totalRevenue: number
  totalPrizesPaid: number
  netRevenue: number
  totalPlayers: number
  totalWinners: number
  totalSessions: number
  totalQuestions: number
  today: { players: number; revenue: number; sessions: number }
  week: { players: number; revenue: number; sessions: number }
  month: { players: number; revenue: number; sessions: number }
  topSessions: Array<{
    id: string
    name: string
    players: number
    revenue: number
    prizePool: number
    status: string
  }>
  recentWinners: Array<{
    id: string
    name: string
    whatsapp: string
    session: string
    prize: number
    date: string
  }>
}

interface QuestionsData {
  total: number
  byDifficulty: { Facile: number; Moyen: number; Difficile: number }
  grouped: { today: Question[]; yesterday: Question[]; older: Question[] }
  questions: Question[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function GameDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'sessions' | 'winners' | 'questions'>('overview')

  // Data states
  const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSession, setFilterSession] = useState<string>('')
  const [sessionPeriod, setSessionPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [newSession, setNewSession] = useState({
    session_type: 'classic',
    name: '',
    entry_fee: 1000,
    max_players: 100,
    scheduled_start: ''
  })

  const SESSION_TYPES = [
    { value: 'starter', label: 'Starter', entryFee: 500, maxPlayers: 50, color: 'green' },
    { value: 'classic', label: 'Classic', entryFee: 1000, maxPlayers: 100, color: 'blue' },
    { value: 'premium', label: 'Premium', entryFee: 2500, maxPlayers: 200, color: 'purple' },
    { value: 'elite', label: 'Elite', entryFee: 5000, maxPlayers: 500, color: 'yellow' },
    { value: 'mega', label: 'Mega', entryFee: 10000, maxPlayers: 1000, color: 'red' },
  ]

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessionStats()
    }
  }, [sessionPeriod, activeTab])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Charger les stats avancées
      const statsRes = await fetch(`${API_URL}/api/game/dashboard/advanced-stats`)
      const statsData = await statsRes.json()
      if (statsData.success) {
        setAdvancedStats(statsData.stats)
      }

      // Charger les inscriptions
      const regsRes = await fetch(`${API_URL}/api/game/dashboard/registrations?limit=200`)
      const regsData = await regsRes.json()
      if (regsData.success) {
        setRegistrations(regsData.registrations)
      }

      // Charger les questions
      const questionsRes = await fetch(`${API_URL}/api/game/dashboard/questions`)
      const questionsResData = await questionsRes.json()
      if (questionsResData.success) {
        setQuestionsData(questionsResData)
      }

      // Charger les sessions
      await loadSessionStats()

    } catch (error) {
      console.error('Erreur chargement dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSessionStats = async () => {
    try {
      const sessionsRes = await fetch(`${API_URL}/api/game/dashboard/session-stats?period=${sessionPeriod}`)
      const sessionsData = await sessionsRes.json()
      if (sessionsData.success) {
        setSessions(sessionsData.sessions)
      }
    } catch (error) {
      console.error('Erreur chargement sessions:', error)
    }
  }

  const generateQuestions = async () => {
    setGeneratingQuestions(true)
    try {
      const res = await fetch(`${API_URL}/api/game/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 30, difficulty: 'medium' })
      })
      const data = await res.json()
      if (data.success) {
        alert(`${data.generated} questions generees avec succes !`)
        loadDashboardData()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur generation:', error)
      alert('Erreur lors de la generation')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const createSession = async () => {
    if (!newSession.name.trim()) {
      alert('Veuillez entrer un nom pour la session')
      return
    }

    setCreatingSession(true)
    try {
      const res = await fetch(`${API_URL}/api/game/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      })
      const data = await res.json()
      if (data.success) {
        alert('Session creee avec succes !')
        setShowCreateModal(false)
        setNewSession({
          session_type: 'classic',
          name: '',
          entry_fee: 1000,
          max_players: 100,
          scheduled_start: ''
        })
        loadDashboardData()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur creation session:', error)
      alert('Erreur lors de la creation')
    } finally {
      setCreatingSession(false)
    }
  }

  const handleSessionTypeChange = (type: string) => {
    const sessionType = SESSION_TYPES.find(t => t.value === type)
    if (sessionType) {
      setNewSession({
        ...newSession,
        session_type: type,
        entry_fee: sessionType.entryFee,
        max_players: sessionType.maxPlayers
      })
    }
  }

  // Filtrer les vainqueurs
  const winners = registrations.filter(reg => reg.status === 'winner')

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch =
      reg.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.whatsapp_number.includes(searchTerm)
    const matchesSession = !filterSession || reg.session_id === filterSession
    return matchesSearch && matchesSession
  })

  const getSessionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      starter: 'bg-green-500',
      classic: 'bg-blue-500',
      premium: 'bg-purple-500',
      elite: 'bg-yellow-500',
      mega: 'bg-red-500',
      training: 'bg-emerald-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string, text: string, label: string }> = {
      upcoming: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'A venir' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'En cours' },
      completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Terminee' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulee' }
    }
    const badge = badges[status] || badges.upcoming
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const getDifficultyBadge = (difficulty: string) => {
    const badges: Record<string, { bg: string, text: string }> = {
      'Facile': { bg: 'bg-green-100', text: 'text-green-800' },
      'Moyen': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Difficile': { bg: 'bg-red-100', text: 'text-red-800' }
    }
    const badge = badges[difficulty] || { bg: 'bg-gray-100', text: 'text-gray-800' }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {difficulty}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`
    }
    return amount.toLocaleString()
  }

  const exportToCSV = () => {
    const headers = ['Nom', 'WhatsApp', 'Montant', 'Session', 'Statut', 'Date inscription']
    const rows = filteredRegistrations.map(reg => [
      reg.player_name,
      reg.whatsapp_number,
      reg.amount_paid || reg.game_sessions?.entry_fee || 0,
      reg.game_sessions?.name || '',
      reg.status,
      formatDate(reg.created_at)
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inscriptions-jeu-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Dashboard Jeu</h1>
                <p className="text-purple-200 text-sm">Il n&apos;en restera qu&apos;1</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={generateQuestions}
                disabled={generatingQuestions}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {generatingQuestions ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <HelpCircle className="w-4 h-4" />
                )}
                Generer Questions
              </button>
              <button
                onClick={loadDashboardData}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: Eye },
                { id: 'questions', label: 'Questions', icon: HelpCircle },
                { id: 'registrations', label: 'Inscriptions', icon: Users },
                { id: 'sessions', label: 'Sessions', icon: BarChart3 },
                { id: 'winners', label: 'Vainqueurs', icon: Crown },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* ==================== VUE D'ENSEMBLE ==================== */}
            {activeTab === 'overview' && advancedStats && (
              <div className="space-y-6">
                {/* Stats principales */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Revenus</span>
                    </div>
                    <p className="text-2xl font-bold">{formatMoney(advancedStats.totalRevenue)} FCFA</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Prix payes</span>
                    </div>
                    <p className="text-2xl font-bold">{formatMoney(advancedStats.totalPrizesPaid)} FCFA</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Net</span>
                    </div>
                    <p className="text-2xl font-bold">{formatMoney(advancedStats.netRevenue)} FCFA</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Joueurs</span>
                    </div>
                    <p className="text-2xl font-bold">{advancedStats.totalPlayers}</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Vainqueurs</span>
                    </div>
                    <p className="text-2xl font-bold">{advancedStats.totalWinners}</p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Gamepad2 className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Sessions</span>
                    </div>
                    <p className="text-2xl font-bold">{advancedStats.totalSessions}</p>
                  </div>

                  <div className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="w-5 h-5 opacity-80" />
                      <span className="text-sm opacity-80">Questions</span>
                    </div>
                    <p className="text-2xl font-bold">{advancedStats.totalQuestions}</p>
                  </div>
                </div>

                {/* Stats par periode */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <CalendarDays className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-gray-900">Aujourd&apos;hui</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Joueurs</span>
                        <span className="font-bold text-gray-900">{advancedStats.today.players}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Revenus</span>
                        <span className="font-bold text-green-600">{formatMoney(advancedStats.today.revenue)} FCFA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sessions</span>
                        <span className="font-bold text-gray-900">{advancedStats.today.sessions}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      <h3 className="font-semibold text-gray-900">Cette semaine</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Joueurs</span>
                        <span className="font-bold text-gray-900">{advancedStats.week.players}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Revenus</span>
                        <span className="font-bold text-green-600">{formatMoney(advancedStats.week.revenue)} FCFA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sessions</span>
                        <span className="font-bold text-gray-900">{advancedStats.week.sessions}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-orange-500" />
                      <h3 className="font-semibold text-gray-900">Ce mois</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Joueurs</span>
                        <span className="font-bold text-gray-900">{advancedStats.month.players}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Revenus</span>
                        <span className="font-bold text-green-600">{formatMoney(advancedStats.month.revenue)} FCFA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sessions</span>
                        <span className="font-bold text-gray-900">{advancedStats.month.sessions}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Sessions et Vainqueurs recents */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Top Sessions */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Top Sessions (par revenus)
                    </h3>
                    <div className="space-y-3">
                      {advancedStats.topSessions.slice(0, 5).map((session, i) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{session.name}</p>
                              <p className="text-xs text-gray-500">{session.players} joueurs</p>
                            </div>
                          </div>
                          <span className="font-bold text-green-600">{formatMoney(session.revenue)} FCFA</span>
                        </div>
                      ))}
                      {advancedStats.topSessions.length === 0 && (
                        <p className="text-center text-gray-500 py-4">Aucune session</p>
                      )}
                    </div>
                  </div>

                  {/* Vainqueurs recents */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      Vainqueurs recents
                    </h3>
                    <div className="space-y-3">
                      {advancedStats.recentWinners.slice(0, 5).map((winner) => (
                        <div key={winner.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{winner.name}</p>
                            <p className="text-xs text-gray-500">{winner.session}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatMoney(winner.prize)} FCFA</p>
                            <a
                              href={`https://wa.me/${winner.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              {winner.whatsapp}
                            </a>
                          </div>
                        </div>
                      ))}
                      {advancedStats.recentWinners.length === 0 && (
                        <p className="text-center text-gray-500 py-4">Aucun vainqueur</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== QUESTIONS GENEREES ==================== */}
            {activeTab === 'questions' && questionsData && (
              <div className="space-y-6">
                {/* Stats questions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Total (72h)</p>
                    <p className="text-2xl font-bold text-gray-900">{questionsData.total}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-600">Facile</p>
                    <p className="text-2xl font-bold text-green-700">{questionsData.byDifficulty.Facile}</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-600">Moyen</p>
                    <p className="text-2xl font-bold text-yellow-700">{questionsData.byDifficulty.Moyen}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-600">Difficile</p>
                    <p className="text-2xl font-bold text-red-700">{questionsData.byDifficulty.Difficile}</p>
                  </div>
                </div>

                {/* Questions du jour */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-500" />
                    Aujourd&apos;hui ({questionsData.grouped.today.length} questions)
                  </h3>
                  <div className="space-y-2">
                    {questionsData.grouped.today.map(q => (
                      <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getDifficultyBadge(q.difficulty)}
                              <span className="text-xs text-gray-400">{formatDate(q.created_at)}</span>
                            </div>
                            <p className="text-gray-900 font-medium">{q.question_text}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {q.answers?.map((answer, i) => (
                                <div
                                  key={i}
                                  className={`text-sm p-2 rounded ${i === q.correct_index ? 'bg-green-100 text-green-800 font-medium' : 'bg-gray-50 text-gray-600'}`}
                                >
                                  {answer}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {questionsData.grouped.today.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Aucune question generee aujourd&apos;hui</p>
                    )}
                  </div>
                </div>

                {/* Questions d'hier */}
                {questionsData.grouped.yesterday.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-500" />
                      Hier ({questionsData.grouped.yesterday.length} questions)
                    </h3>
                    <div className="space-y-2">
                      {questionsData.grouped.yesterday.slice(0, 5).map(q => (
                        <div key={q.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getDifficultyBadge(q.difficulty)}
                          </div>
                          <p className="text-gray-700">{q.question_text}</p>
                        </div>
                      ))}
                      {questionsData.grouped.yesterday.length > 5 && (
                        <p className="text-center text-gray-500 text-sm">+ {questionsData.grouped.yesterday.length - 5} autres questions</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Questions plus anciennes */}
                {questionsData.grouped.older.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      Plus anciennes ({questionsData.grouped.older.length} questions) - Seront supprimees bientot
                    </h3>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-orange-700 text-sm">
                        Ces {questionsData.grouped.older.length} questions ont plus de 48h et seront automatiquement supprimees apres 72h.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== INSCRIPTIONS ==================== */}
            {activeTab === 'registrations' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Rechercher par nom ou WhatsApp..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <select
                    value={filterSession}
                    onChange={(e) => setFilterSession(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Toutes les sessions</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>{session.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Exporter CSV
                  </button>
                </div>

                {/* Count */}
                <p className="text-sm text-gray-500">
                  {filteredRegistrations.length} inscription(s) trouvee(s)
                </p>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRegistrations.map(reg => (
                        <tr key={reg.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{reg.player_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`https://wa.me/${reg.whatsapp_number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:text-green-700"
                            >
                              <MessageCircle className="w-4 h-4" />
                              {reg.whatsapp_number}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">
                              {(reg.amount_paid || reg.game_sessions?.entry_fee || 0).toLocaleString()} FCFA
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getSessionTypeColor(reg.game_sessions?.session_type || '')}`} />
                              <span className="text-gray-600">{reg.game_sessions?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {reg.status === 'registered' && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Inscrit</span>
                            )}
                            {reg.status === 'playing' && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">En jeu</span>
                            )}
                            {reg.status === 'eliminated' && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                Elimine {reg.eliminated_at_round ? `(R${reg.eliminated_at_round})` : ''}
                              </span>
                            )}
                            {reg.status === 'winner' && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Gagnant</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {formatDate(reg.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedRegistration(reg)}
                              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== SESSIONS AVEC STATS ==================== */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {[
                        { value: 'today', label: 'Aujourd\'hui' },
                        { value: 'week', label: 'Semaine' },
                        { value: 'month', label: 'Mois' },
                        { value: 'all', label: 'Tout' }
                      ].map(p => (
                        <button
                          key={p.value}
                          onClick={() => setSessionPeriod(p.value as typeof sessionPeriod)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            sessionPeriod === p.value
                              ? 'bg-white text-purple-600 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle session
                  </button>
                </div>

                {/* Stats globales periode */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-sm text-purple-600">Sessions</p>
                    <p className="text-2xl font-bold text-purple-700">{sessions.length}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-600">Joueurs</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {sessions.reduce((sum, s) => sum + (s.current_players || 0), 0)}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-600">Revenus</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatMoney(sessions.reduce((sum, s) => sum + (s.stats?.revenue || 0), 0))} FCFA
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-600">Cagnottes</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {formatMoney(sessions.reduce((sum, s) => sum + (s.prize_pool || 0), 0))} FCFA
                    </p>
                  </div>
                </div>

                {/* Liste sessions */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sessions.map(session => (
                    <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                      <div className={`h-2 ${getSessionTypeColor(session.session_type)}`} />
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-gray-500 uppercase">
                            {session.session_type}
                          </span>
                          {getStatusBadge(session.status)}
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-3">{session.name}</h4>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              Joueurs
                            </span>
                            <span className="font-medium">
                              {session.current_players} / {session.max_players}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              Revenus
                            </span>
                            <span className="font-medium text-green-600">
                              {formatMoney(session.stats?.revenue || 0)} FCFA
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              Cagnotte
                            </span>
                            <span className="font-medium text-purple-600">
                              {formatMoney(session.prize_pool)} FCFA
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Zap className="w-4 h-4" />
                              Entree
                            </span>
                            <span className="font-medium">
                              {session.entry_fee > 0 ? `${session.entry_fee.toLocaleString()} FCFA` : 'Gratuit'}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-4">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getSessionTypeColor(session.session_type)} transition-all`}
                              style={{ width: `${session.stats?.fillRate || 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {session.stats?.fillRate || 0}% rempli
                          </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sessions.length === 0 && (
                  <div className="text-center py-12">
                    <Gamepad2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Aucune session</h4>
                    <p className="text-gray-500">Aucune session pour cette periode</p>
                  </div>
                )}
              </div>
            )}

            {/* ==================== VAINQUEURS ==================== */}
            {activeTab === 'winners' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Tableau des Vainqueurs</h3>
                  <span className="text-sm text-gray-500">{winners.length} vainqueur(s)</span>
                </div>

                {winners.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun vainqueur pour le moment</h4>
                    <p className="text-gray-500">Les vainqueurs des sessions apparaitront ici</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-yellow-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Joueur</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Contact</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Session</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Gains</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {winners.map((winner, index) => (
                          <tr key={winner.id} className="hover:bg-yellow-50/50">
                            <td className="px-4 py-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                index === 1 ? 'bg-gray-300 text-gray-700' :
                                index === 2 ? 'bg-orange-400 text-orange-900' :
                                'bg-purple-100 text-purple-600'
                              }`}>
                                {index < 3 ? (
                                  <Crown className="w-4 h-4" />
                                ) : (
                                  <span className="text-sm font-bold">{index + 1}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-gray-900">{winner.player_name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`https://wa.me/${winner.whatsapp_number.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                              >
                                <Phone className="w-4 h-4" />
                                {winner.whatsapp_number}
                              </a>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${getSessionTypeColor(winner.game_sessions?.session_type || '')}`} />
                                <span className="text-gray-600">{winner.game_sessions?.name || 'Session'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-green-600">
                                {(winner.game_sessions?.prize_pool || 0).toLocaleString()} FCFA
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {formatDate(winner.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Creation Session */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Creer une nouvelle session</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type de session */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de session</label>
                <div className="grid grid-cols-5 gap-2">
                  {SESSION_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => handleSessionTypeChange(type.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        newSession.session_type === type.value
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`block w-3 h-3 rounded-full mx-auto mb-1 ${getSessionTypeColor(type.value)}`} />
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom de la session */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la session</label>
                <input
                  type="text"
                  value={newSession.name}
                  onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                  placeholder="Ex: Session du Vendredi Soir"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Frais d'entree et Max joueurs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frais d&apos;entree (FCFA)</label>
                  <input
                    type="number"
                    value={newSession.entry_fee}
                    onChange={(e) => setNewSession({ ...newSession, entry_fee: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max joueurs</label>
                  <input
                    type="number"
                    value={newSession.max_players}
                    onChange={(e) => setNewSession({ ...newSession, max_players: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Date de debut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de debut (optionnel)</label>
                <input
                  type="datetime-local"
                  value={newSession.scheduled_start}
                  onChange={(e) => setNewSession({ ...newSession, scheduled_start: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Resume */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">Resume</h4>
                <div className="text-sm text-purple-700 space-y-1">
                  <p>Type: <strong>{SESSION_TYPES.find(t => t.value === newSession.session_type)?.label}</strong></p>
                  <p>Entree: <strong>{newSession.entry_fee.toLocaleString()} FCFA</strong></p>
                  <p>Cagnotte potentielle: <strong>{(newSession.entry_fee * newSession.max_players).toLocaleString()} FCFA</strong></p>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={createSession}
                  disabled={creatingSession || !newSession.name.trim()}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingSession ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creation...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Creer la session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Inscription */}
      {selectedRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRegistration(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-purple-600">
                    {selectedRegistration.player_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedRegistration.player_name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedRegistration.status === 'winner' ? 'Gagnant' :
                     selectedRegistration.status === 'eliminated' ? 'Elimine' :
                     selectedRegistration.status === 'playing' ? 'En jeu' : 'Inscrit'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Contact */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">WhatsApp</p>
                  <a
                    href={`https://wa.me/${selectedRegistration.whatsapp_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-green-800 hover:underline"
                  >
                    {selectedRegistration.whatsapp_number}
                  </a>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">Montant paye</p>
                  <p className="font-medium text-blue-800">
                    {(selectedRegistration.amount_paid || selectedRegistration.game_sessions?.entry_fee || 0).toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            </div>

            {/* Session */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Session</p>
              <div className={`rounded-lg p-3 ${getSessionTypeColor(selectedRegistration.game_sessions?.session_type || 'training')}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/80">{selectedRegistration.game_sessions?.session_type?.toUpperCase() || 'TRAINING'}</p>
                    <p className="font-bold text-white">{selectedRegistration.game_sessions?.name || 'Mode Training'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/80">Cagnotte</p>
                    <p className="font-bold text-white">{selectedRegistration.game_sessions?.prize_pool?.toLocaleString('fr-FR') || 0} FCFA</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Date inscription */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Date d&apos;inscription</p>
              <p className="text-gray-900">{formatDate(selectedRegistration.created_at)}</p>
            </div>

            <button
              onClick={() => setSelectedRegistration(null)}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
