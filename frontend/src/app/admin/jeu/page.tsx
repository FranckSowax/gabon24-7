'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gamepad2, Users, Trophy, MessageCircle, Calendar,
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
  Plus, Search, Download, Eye, Zap, HelpCircle,
  Crown, Medal, X, Sparkles, Target, Award, Activity,
  ChevronRight, Play, FileQuestion, Trash2, DollarSign,
  BarChart3, CalendarDays, Phone, AlertCircle
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

interface GameQuestion {
  id: string
  round: number
  difficulty: string
  question_text: string
  answers: string[]
  correct_answer_index: number
  correct_index?: number
  time_limit: number
  is_anti_ai: boolean
  created_at: string
}

interface Registration {
  id: string
  session_id: string
  player_name: string
  whatsapp_number: string
  status: string
  eliminated_at_round: number | null
  final_position: number | null
  created_at: string
  game_sessions?: GameSession
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
  grouped: { today: GameQuestion[]; yesterday: GameQuestion[]; older: GameQuestion[] }
  questions: GameQuestion[]
}

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001'
  }
  return 'https://gabon24-7-production.up.railway.app'
}

const API_URL = getApiUrl()

const SESSION_TYPES = [
  { value: 'starter', label: 'Starter', entryFee: 500, maxPlayers: 50, gradient: 'from-emerald-500 to-green-600' },
  { value: 'classic', label: 'Classic', entryFee: 1000, maxPlayers: 100, gradient: 'from-blue-500 to-indigo-600' },
  { value: 'premium', label: 'Premium', entryFee: 2500, maxPlayers: 200, gradient: 'from-purple-500 to-violet-600' },
  { value: 'elite', label: 'Elite', entryFee: 5000, maxPlayers: 500, gradient: 'from-amber-500 to-orange-600' },
  { value: 'mega', label: 'Mega', entryFee: 10000, maxPlayers: 1000, gradient: 'from-rose-500 to-red-600' },
]

export default function AdminGameDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'registrations' | 'sessions' | 'winners'>('overview')

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
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    try {
      // Charger les stats avancees
      const statsRes = await fetch(`${API_URL}/api/game/dashboard/advanced-stats`)
      const statsData = await statsRes.json()
      if (statsData.success) {
        setAdvancedStats(statsData.stats)
      }

      // Charger les inscriptions
      const regsRes = await fetch(`${API_URL}/api/game/dashboard/registrations?limit=200`)
      const regsData = await regsRes.json()
      if (regsData.success) {
        setRegistrations(regsData.registrations || [])
      }

      // Charger les questions
      const questionsRes = await fetch(`${API_URL}/api/game/dashboard/questions`)
      const questionsResData = await questionsRes.json()
      if (questionsResData.success) {
        setQuestionsData(questionsResData)
      }

      // Charger les sessions
      await loadSessionStats()

    } catch (error: any) {
      console.error('Erreur chargement dashboard:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSessionStats = async () => {
    try {
      const sessionsRes = await fetch(`${API_URL}/api/game/dashboard/session-stats?period=${sessionPeriod}`)
      const sessionsData = await sessionsRes.json()
      if (sessionsData.success) {
        setSessions(sessionsData.sessions || [])
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
    } catch (error: any) {
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
    } catch (error: any) {
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

  const winners = registrations.filter(reg => reg.status === 'winner')

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch =
      reg.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.whatsapp_number.includes(searchTerm)
    const matchesSession = !filterSession || reg.session_id === filterSession
    return matchesSearch && matchesSession
  })

  const getSessionGradient = (type: string) => {
    const session = SESSION_TYPES.find(t => t.value === type)
    return session?.gradient || 'from-gray-500 to-gray-600'
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string, text: string, label: string, icon: any }> = {
      upcoming: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'A venir', icon: Clock },
      active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'En cours', icon: Play },
      completed: { bg: 'bg-gray-500/10', text: 'text-gray-600', label: 'Terminee', icon: CheckCircle },
      cancelled: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Annulee', icon: XCircle }
    }
    return configs[status] || configs.upcoming
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
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
    return amount.toLocaleString()
  }

  const exportToCSV = () => {
    const headers = ['Nom', 'WhatsApp', 'Montant', 'Session', 'Statut', 'Date inscription']
    const rows = filteredRegistrations.map(reg => [
      reg.player_name,
      reg.whatsapp_number,
      reg.game_sessions?.entry_fee || 0,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Gamepad2 className="w-16 h-16 text-purple-400 mx-auto" />
          </motion.div>
          <p className="text-white/70 mt-4 text-lg">Chargement du dashboard...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard Jeu</h1>
                <p className="text-white/70 text-sm">Il n&apos;en restera qu&apos;1 - Administration</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateQuestions}
                disabled={generatingQuestions}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl transition-all disabled:opacity-50 border border-white/20"
              >
                {generatingQuestions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden sm:inline">Generer Questions</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-purple-600 font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-purple-500/25"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouvelle Session</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={loadDashboardData}
                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl transition-all border border-white/20"
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 px-2">
            <nav className="flex gap-1 overflow-x-auto py-2">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: Eye },
                { id: 'questions', label: 'Questions (72h)', icon: HelpCircle },
                { id: 'registrations', label: 'Inscriptions', icon: Users },
                { id: 'sessions', label: 'Sessions', icon: BarChart3 },
                { id: 'winners', label: 'Vainqueurs', icon: Crown },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
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
                      <div className="flex justify-between"><span className="text-gray-500">Joueurs</span><span className="font-bold">{advancedStats.today.players}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Revenus</span><span className="font-bold text-green-600">{formatMoney(advancedStats.today.revenue)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Sessions</span><span className="font-bold">{advancedStats.today.sessions}</span></div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      <h3 className="font-semibold text-gray-900">Cette semaine</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-gray-500">Joueurs</span><span className="font-bold">{advancedStats.week.players}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Revenus</span><span className="font-bold text-green-600">{formatMoney(advancedStats.week.revenue)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Sessions</span><span className="font-bold">{advancedStats.week.sessions}</span></div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-5 h-5 text-orange-500" />
                      <h3 className="font-semibold text-gray-900">Ce mois</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-gray-500">Joueurs</span><span className="font-bold">{advancedStats.month.players}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Revenus</span><span className="font-bold text-green-600">{formatMoney(advancedStats.month.revenue)} FCFA</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Sessions</span><span className="font-bold">{advancedStats.month.sessions}</span></div>
                    </div>
                  </div>
                </div>

                {/* Top Sessions et Vainqueurs */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />Top Sessions
                    </h3>
                    <div className="space-y-3">
                      {advancedStats.topSessions.slice(0, 5).map((session, i) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                            <div>
                              <p className="font-medium text-gray-900">{session.name}</p>
                              <p className="text-xs text-gray-500">{session.players} joueurs</p>
                            </div>
                          </div>
                          <span className="font-bold text-green-600">{formatMoney(session.revenue)} FCFA</span>
                        </div>
                      ))}
                      {advancedStats.topSessions.length === 0 && <p className="text-center text-gray-500 py-4">Aucune session</p>}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />Vainqueurs recents
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
                            <a href={`https://wa.me/${winner.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                              <Phone className="w-3 h-3" />{winner.whatsapp}
                            </a>
                          </div>
                        </div>
                      ))}
                      {advancedStats.recentWinners.length === 0 && <p className="text-center text-gray-500 py-4">Aucun vainqueur</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== QUESTIONS GENEREES (72H) ==================== */}
            {activeTab === 'questions' && questionsData && (
              <div className="space-y-6">
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
                                <div key={i} className={`text-sm p-2 rounded ${i === (q.correct_answer_index ?? q.correct_index) ? 'bg-green-100 text-green-800 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                                  {answer}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {questionsData.grouped.today.length === 0 && <p className="text-center text-gray-500 py-8">Aucune question generee aujourd&apos;hui</p>}
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
                          <div className="flex items-center gap-2 mb-2">{getDifficultyBadge(q.difficulty)}</div>
                          <p className="text-gray-700">{q.question_text}</p>
                        </div>
                      ))}
                      {questionsData.grouped.yesterday.length > 5 && <p className="text-center text-gray-500 text-sm">+ {questionsData.grouped.yesterday.length - 5} autres questions</p>}
                    </div>
                  </div>
                )}

                {/* Questions plus anciennes */}
                {questionsData.grouped.older.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      Plus anciennes ({questionsData.grouped.older.length}) - Suppression auto bientot
                    </h3>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-orange-700 text-sm">Ces {questionsData.grouped.older.length} questions ont plus de 48h et seront automatiquement supprimees apres 72h.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== INSCRIPTIONS ==================== */}
            {activeTab === 'registrations' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Rechercher par nom ou WhatsApp..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                    </div>
                  </div>
                  <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value="">Toutes les sessions</option>
                    {sessions.map(session => (<option key={session.id} value={session.id}>{session.name}</option>))}
                  </select>
                  <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <Download className="w-4 h-4" />Exporter CSV
                  </button>
                </div>
                <p className="text-sm text-gray-500">{filteredRegistrations.length} inscription(s)</p>
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
                          <td className="px-4 py-3"><span className="font-medium text-gray-900">{reg.player_name}</span></td>
                          <td className="px-4 py-3">
                            <a href={`https://wa.me/${reg.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:text-green-700">
                              <MessageCircle className="w-4 h-4" />{reg.whatsapp_number}
                            </a>
                          </td>
                          <td className="px-4 py-3"><span className="font-medium text-gray-900">{(reg.game_sessions?.entry_fee || 0).toLocaleString()} FCFA</span></td>
                          <td className="px-4 py-3"><span className="text-gray-600">{reg.game_sessions?.name || '-'}</span></td>
                          <td className="px-4 py-3">
                            {reg.status === 'registered' && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Inscrit</span>}
                            {reg.status === 'playing' && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">En jeu</span>}
                            {reg.status === 'eliminated' && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Elimine</span>}
                            {reg.status === 'winner' && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Gagnant</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(reg.created_at)}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelectedRegistration(reg)} className="text-purple-600 hover:text-purple-800 text-sm font-medium">Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== SESSIONS ==================== */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      {[{ value: 'today', label: 'Aujourd\'hui' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'all', label: 'Tout' }].map(p => (
                        <button key={p.value} onClick={() => setSessionPeriod(p.value as typeof sessionPeriod)} className={`px-3 py-1 text-sm rounded-md transition-colors ${sessionPeriod === p.value ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-sm text-purple-600">Sessions</p>
                    <p className="text-2xl font-bold text-purple-700">{sessions.length}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-600">Joueurs</p>
                    <p className="text-2xl font-bold text-blue-700">{sessions.reduce((sum, s) => sum + (s.current_players || 0), 0)}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-600">Revenus</p>
                    <p className="text-2xl font-bold text-green-700">{formatMoney(sessions.reduce((sum, s) => sum + (s.stats?.revenue || 0), 0))} FCFA</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-600">Cagnottes</p>
                    <p className="text-2xl font-bold text-yellow-700">{formatMoney(sessions.reduce((sum, s) => sum + (s.prize_pool || 0), 0))} FCFA</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sessions.map(session => {
                    const statusConfig = getStatusConfig(session.status)
                    return (
                      <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                        <div className={`h-2 bg-gradient-to-r ${getSessionGradient(session.session_type)}`} />
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-gray-500 uppercase">{session.session_type}</span>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConfig.bg}`}>
                              <statusConfig.icon className={`w-3 h-3 ${statusConfig.text}`} />
                              <span className={`text-xs font-medium ${statusConfig.text}`}>{statusConfig.label}</span>
                            </div>
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-3">{session.name}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1"><Users className="w-4 h-4" />Joueurs</span>
                              <span className="font-medium">{session.current_players} / {session.max_players}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1"><DollarSign className="w-4 h-4" />Revenus</span>
                              <span className="font-medium text-green-600">{formatMoney(session.stats?.revenue || 0)} FCFA</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500 flex items-center gap-1"><Trophy className="w-4 h-4" />Cagnotte</span>
                              <span className="font-medium text-purple-600">{formatMoney(session.prize_pool)} FCFA</span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${getSessionGradient(session.session_type)} transition-all`} style={{ width: `${session.stats?.fillRate || 0}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1 text-right">{session.stats?.fillRate || 0}% rempli</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun vainqueur</h4>
                    <p className="text-gray-500">Les vainqueurs apparaitront ici</p>
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
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-gray-300 text-gray-700' : index === 2 ? 'bg-orange-400 text-orange-900' : 'bg-purple-100 text-purple-600'}`}>
                                {index < 3 ? <Crown className="w-4 h-4" /> : <span className="text-sm font-bold">{index + 1}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="font-bold text-gray-900">{winner.player_name}</span></td>
                            <td className="px-4 py-3">
                              <a href={`https://wa.me/${winner.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium">
                                <Phone className="w-4 h-4" />{winner.whatsapp_number}
                              </a>
                            </td>
                            <td className="px-4 py-3"><span className="text-gray-600">{winner.game_sessions?.name || 'Session'}</span></td>
                            <td className="px-4 py-3"><span className="font-bold text-green-600">{(winner.game_sessions?.prize_pool || 0).toLocaleString()} FCFA</span></td>
                            <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(winner.created_at)}</td>
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
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Nouvelle Session</h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X className="w-5 h-5 text-white" /></button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Type de session</label>
                  <div className="grid grid-cols-5 gap-2">
                    {SESSION_TYPES.map(type => (
                      <button key={type.value} onClick={() => handleSessionTypeChange(type.value)} className={`p-3 rounded-xl border-2 text-center transition-all ${newSession.session_type === type.value ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className={`w-4 h-4 rounded-full mx-auto mb-1.5 bg-gradient-to-r ${type.gradient}`} />
                        <span className="text-xs font-semibold">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nom de la session</label>
                  <input type="text" value={newSession.name} onChange={(e) => setNewSession({ ...newSession, name: e.target.value })} placeholder="Ex: Session du Vendredi" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Frais d&apos;entree (FCFA)</label>
                    <input type="number" value={newSession.entry_fee} onChange={(e) => setNewSession({ ...newSession, entry_fee: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max joueurs</label>
                    <input type="number" value={newSession.max_players} onChange={(e) => setNewSession({ ...newSession, max_players: parseInt(e.target.value) || 0 })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date de debut (optionnel)</label>
                  <input type="datetime-local" value={newSession.scheduled_start} onChange={(e) => setNewSession({ ...newSession, scheduled_start: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Resume</h4>
                  <div className="text-sm text-purple-700 space-y-1">
                    <p>Type: <strong>{SESSION_TYPES.find(t => t.value === newSession.session_type)?.label}</strong></p>
                    <p>Entree: <strong>{newSession.entry_fee.toLocaleString()} FCFA</strong></p>
                    <p>Cagnotte potentielle: <strong>{(newSession.entry_fee * newSession.max_players).toLocaleString()} FCFA</strong></p>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
                  <button onClick={createSession} disabled={creatingSession || !newSession.name.trim()} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {creatingSession ? <><RefreshCw className="w-4 h-4 animate-spin" />Creation...</> : <><Plus className="w-4 h-4" />Creer</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detail Inscription */}
      <AnimatePresence>
        {selectedRegistration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRegistration(null)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-purple-600">{selectedRegistration.player_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedRegistration.player_name}</h3>
                    <p className="text-sm text-gray-500">{selectedRegistration.status === 'winner' ? 'Gagnant' : selectedRegistration.status === 'eliminated' ? 'Elimine' : selectedRegistration.status === 'playing' ? 'En jeu' : 'Inscrit'}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRegistration(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600">WhatsApp</p>
                    <a href={`https://wa.me/${selectedRegistration.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-green-800 hover:underline">{selectedRegistration.whatsapp_number}</a>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600">Montant paye</p>
                    <p className="font-medium text-blue-800">{(selectedRegistration.game_sessions?.entry_fee || 0).toLocaleString()} FCFA</p>
                  </div>
                </div>
              </div>
              {selectedRegistration.game_sessions && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Session</p>
                  <div className={`rounded-lg p-3 bg-gradient-to-r ${getSessionGradient(selectedRegistration.game_sessions?.session_type || 'training')}`}>
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
              )}
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">Date d&apos;inscription</p>
                <p className="text-gray-900">{formatDate(selectedRegistration.created_at)}</p>
              </div>
              <button onClick={() => setSelectedRegistration(null)} className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">Fermer</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
