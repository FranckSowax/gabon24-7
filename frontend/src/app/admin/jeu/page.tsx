'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Gamepad2, Users, Trophy, MessageCircle, Calendar, 
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
  Plus, Search, Download, Eye, Zap, HelpCircle,
  Crown, Medal, X, Sparkles, Target, Award, Activity,
  ChevronRight, MoreHorizontal, Play, Pause, FileQuestion, Trash2
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
  questions_generated?: boolean
}

interface GameQuestion {
  id: string
  round: number
  difficulty: string
  question_text: string
  answers: string[]
  correct_answer_index: number
  time_limit: number
  is_anti_ai: boolean
  created_at: string
}

interface Registration {
  id: string
  session_id: string
  player_name: string
  whatsapp_number: string
  email: string | null
  status: string
  eliminated_at_round: number | null
  final_position: number | null
  created_at: string
  game_sessions?: GameSession
}

interface DashboardStats {
  sessions: {
    upcoming: number
    active: number
    completed: number
  }
  totalSessions: number
  totalRegistrations: number
  totalQuestions: number
  questionsUsedToday: number
  totalPrizePool: number
  recentSessions: GameSession[]
}

const getApiUrl = () => {
  // Si une variable d'environnement est définie, l'utiliser
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  // En développement local, utiliser localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001'
  }
  // Par défaut en production
  return 'https://gabon24-7-production.up.railway.app'
}

const API_URL = getApiUrl()

// Types de sessions disponibles
const SESSION_TYPES = [
  { value: 'starter', label: 'Starter', entryFee: 500, maxPlayers: 50, color: 'emerald', gradient: 'from-emerald-500 to-green-600' },
  { value: 'classic', label: 'Classic', entryFee: 1000, maxPlayers: 100, color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'premium', label: 'Premium', entryFee: 2500, maxPlayers: 200, color: 'purple', gradient: 'from-purple-500 to-violet-600' },
  { value: 'elite', label: 'Elite', entryFee: 5000, maxPlayers: 500, color: 'amber', gradient: 'from-amber-500 to-orange-600' },
  { value: 'mega', label: 'Mega', entryFee: 10000, maxPlayers: 1000, color: 'rose', gradient: 'from-rose-500 to-red-600' },
]

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.1 }
  }
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
}

export default function AdminGameDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'sessions' | 'winners' | 'questions'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSession, setFilterSession] = useState<string>('')
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [deletingQuestions, setDeletingQuestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Modal création session
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [newSession, setNewSession] = useState({
    session_type: 'classic',
    name: '',
    entry_fee: 1000,
    max_players: 100,
    scheduled_start: ''
  })
  
  // Modal détails inscription
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (activeTab === 'questions') {
      loadQuestions()
    }
  }, [activeTab])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    console.log(`🔄 Chargement dashboard depuis: ${API_URL}`)
    
    try {
      const statsRes = await fetch(`${API_URL}/api/game/dashboard/stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!statsRes.ok) {
        throw new Error(`Erreur serveur: ${statsRes.status} ${statsRes.statusText}`)
      }
      
      const statsData = await statsRes.json()
      if (statsData.success) {
        setStats(statsData.stats)
      }

      const regsRes = await fetch(`${API_URL}/api/game/dashboard/registrations?limit=200`)
      if (!regsRes.ok) console.warn('Erreur chargement inscriptions:', regsRes.status)
      const regsData = await regsRes.json().catch(() => ({}))
      if (regsData.success) {
        setRegistrations(regsData.registrations || [])
      }

      const sessionsRes = await fetch(`${API_URL}/api/game/sessions?limit=50`)
      if (!sessionsRes.ok) console.warn('Erreur chargement sessions:', sessionsRes.status)
      const sessionsData = await sessionsRes.json().catch(() => ({}))
      if (sessionsData.success) {
        setSessions(sessionsData.sessions || [])
      }
    } catch (error: any) {
      console.error('Erreur chargement dashboard:', error)
      setError(`Erreur (${API_URL}): ${error.message}. Vérifiez que le backend est accessible.`)
    } finally {
      setLoading(false)
    }
  }

  const loadQuestions = async () => {
    setLoadingQuestions(true)
    try {
      const res = await fetch(`${API_URL}/api/game/generated-questions?limit=200`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setQuestions(data.questions || [])
      }
    } catch (error: any) {
      console.error('Erreur chargement questions:', error)
      // Ne pas bloquer l'UI principale
    } finally {
      setLoadingQuestions(false)
    }
  }

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    )
  }

  const toggleAllQuestions = () => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([])
    } else {
      setSelectedQuestions(questions.map(q => q.id))
    }
  }

  const deleteSelectedQuestions = async () => {
    if (selectedQuestions.length === 0) return
    
    if (!confirm(`Voulez-vous vraiment supprimer ${selectedQuestions.length} questions ?`)) return

    setDeletingQuestions(true)
    try {
      const res = await fetch(`${API_URL}/api/game/generated-questions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedQuestions })
      })
      
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      
      const data = await res.json()
      if (data.success) {
        alert(`✅ ${data.count} questions supprimées !`)
        setSelectedQuestions([])
        loadQuestions()
      } else {
        throw new Error(data.error || 'Erreur inconnue')
      }
    } catch (error: any) {
      console.error('Erreur suppression:', error)
      alert(`❌ Erreur: ${error.message}`)
    } finally {
      setDeletingQuestions(false)
    }
  }

  const generateQuestions = async () => {
    setGeneratingQuestions(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/game/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 30, difficulty: 'medium' })
      })
      
      if (!res.ok) {
        throw new Error(`Erreur serveur: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      if (data.success) {
        alert(`✅ ${data.generated} questions générées avec succès !`)
        loadDashboardData()
        if (activeTab === 'questions') loadQuestions()
      } else {
        throw new Error(data.error || 'Erreur inconnue')
      }
    } catch (error: any) {
      console.error('Erreur génération:', error)
      setError(`Erreur génération: ${error.message}`)
      alert(`❌ Erreur: ${error.message}\nURL: ${API_URL}`)
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
        body: JSON.stringify({
          ...newSession,
          generate_questions: true
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`✅ Session "${newSession.name}" créée !`)
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
        alert(`❌ Erreur: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Erreur création session:', error)
      alert(`❌ Erreur: ${error.message}`)
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
      upcoming: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'À venir', icon: Clock },
      active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'En cours', icon: Play },
      completed: { bg: 'bg-gray-500/10', text: 'text-gray-600', label: 'Terminée', icon: CheckCircle },
      cancelled: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Annulée', icon: XCircle }
    }
    return configs[status] || configs.upcoming
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toString()
  }

  const exportToCSV = () => {
    const headers = ['Nom', 'WhatsApp', 'Email', 'Session', 'Statut', 'Date']
    const rows = filteredRegistrations.map(reg => [
      reg.player_name,
      reg.whatsapp_number,
      reg.email || '',
      reg.game_sessions?.name || '',
      reg.status,
      formatDate(reg.created_at)
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inscriptions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Gamepad2 className="w-16 h-16 text-purple-400 mx-auto" />
          </motion.div>
          <p className="text-white/70 mt-4 text-lg">Chargement du dashboard...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header moderne */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjMCAwLTItMi0yLTRzMi00IDItNCAyIDIgNCAyYzAgMCAyIDIgMiA0cy0yIDQtMiA0LTIgMi00IDJjMCAwLTIgMi0yIDRzMiA0IDIgNCIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Game Dashboard</h1>
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
                {generatingQuestions ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Générer Questions</span>
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
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4"
          >
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Erreur de connexion</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {[
            { label: 'Sessions', value: stats?.totalSessions || 0, icon: Gamepad2, color: 'purple', trend: '+12%' },
            { label: 'Joueurs', value: stats?.totalRegistrations || 0, icon: Users, color: 'blue', trend: '+8%' },
            { label: 'Cagnotte', value: formatNumber(stats?.totalPrizePool || 0), icon: Trophy, color: 'amber', suffix: ' FCFA' },
            { label: 'Questions', value: stats?.totalQuestions || 0, icon: HelpCircle, color: 'emerald' },
            { label: 'En cours', value: stats?.sessions?.active || 0, icon: Activity, color: 'rose' },
            { label: 'Aujourd\'hui', value: stats?.questionsUsedToday || 0, icon: Target, color: 'indigo' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={fadeInUp}
              className="bg-white rounded-2xl p-4 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl bg-${stat.color}-100`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                {stat.trend && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {stat.trend}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900">
                  {stat.value}{stat.suffix || ''}
                </p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-slate-100 px-2">
            <nav className="flex gap-1 overflow-x-auto py-2">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: Eye },
                { id: 'sessions', label: 'Sessions', icon: Gamepad2 },
                { id: 'registrations', label: 'Inscriptions', icon: Users },
                { id: 'winners', label: 'Vainqueurs', icon: Crown },
                { id: 'questions', label: 'Questions générées', icon: FileQuestion },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-8"
                >
                  {/* Sessions récentes */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Sessions récentes</h3>
                      <button 
                        onClick={() => setActiveTab('sessions')}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        Voir tout <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {stats?.recentSessions?.slice(0, 6).map((session, index) => {
                        const statusConfig = getStatusConfig(session.status)
                        return (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-200 hover:border-purple-200 hover:shadow-lg transition-all"
                          >
                            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${getSessionGradient(session.session_type)}`} />
                            
                            <div className="flex items-center justify-between mb-3 pt-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                {session.session_type}
                              </span>
                              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConfig.bg}`}>
                                <statusConfig.icon className={`w-3 h-3 ${statusConfig.text}`} />
                                <span className={`text-xs font-medium ${statusConfig.text}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
                            </div>
                            
                            <h4 className="font-semibold text-slate-900 mb-3 truncate">{session.name}</h4>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Users className="w-4 h-4" />
                                <span className="text-sm font-medium">{session.current_players}/{session.max_players}</span>
                              </div>
                              <span className="text-sm font-bold text-emerald-600">
                                {formatNumber(session.prize_pool)} FCFA
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-3">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  className={`h-full bg-gradient-to-r ${getSessionGradient(session.session_type)}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(session.current_players / session.max_players) * 100}%` }}
                                  transition={{ duration: 1, delay: index * 0.1 }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Dernières inscriptions */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Dernières inscriptions</h3>
                      <button 
                        onClick={() => setActiveTab('registrations')}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        Voir tout <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-slate-50 rounded-2xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joueur</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Session</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {registrations.slice(0, 5).map((reg, index) => (
                            <motion.tr 
                              key={reg.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="bg-white hover:bg-purple-50/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                    reg.status === 'winner' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                                    reg.status === 'eliminated' ? 'bg-gradient-to-br from-red-400 to-rose-500' :
                                    'bg-gradient-to-br from-purple-500 to-indigo-500'
                                  }`}>
                                    {reg.status === 'winner' ? '🏆' : 
                                     reg.status === 'eliminated' ? '💀' : 
                                     reg.player_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-slate-900">{reg.player_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <a 
                                  href={`https://wa.me/${reg.whatsapp_number.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  {reg.whatsapp_number}
                                </a>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-sm text-slate-600">{reg.game_sessions?.name || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                {reg.status === 'winner' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    <Trophy className="w-3 h-3" /> Gagnant
                                  </span>
                                )}
                                {reg.status === 'eliminated' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                    <XCircle className="w-3 h-3" /> Éliminé
                                  </span>
                                )}
                                {reg.status === 'registered' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    <Clock className="w-3 h-3" /> Inscrit
                                  </span>
                                )}
                                {reg.status === 'playing' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                    <Play className="w-3 h-3" /> En jeu
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedRegistration(reg)
                                    setShowRegistrationModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-200 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Détails
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <motion.div
                  key="sessions"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Toutes les sessions ({sessions.length})
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sessions.map((session, index) => {
                      const statusConfig = getStatusConfig(session.status)
                      const progress = (session.current_players / session.max_players) * 100
                      
                      return (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-purple-200 transition-all"
                        >
                          {/* Header gradient */}
                          <div className={`h-24 bg-gradient-to-br ${getSessionGradient(session.session_type)} p-4 relative`}>
                            <div className="absolute inset-0 bg-black/10" />
                            <div className="relative flex items-start justify-between">
                              <div>
                                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
                                  {session.session_type}
                                </span>
                                <h4 className="font-bold text-white text-lg mt-1 line-clamp-1">{session.name}</h4>
                              </div>
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm`}>
                                <statusConfig.icon className="w-3.5 h-3.5 text-white" />
                                <span className="text-xs font-semibold text-white">
                                  {statusConfig.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-4 space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center">
                                <p className="text-lg font-bold text-slate-900">{session.current_players}</p>
                                <p className="text-xs text-slate-500">Joueurs</p>
                              </div>
                              <div className="text-center border-x border-slate-100">
                                <p className="text-lg font-bold text-emerald-600">{formatNumber(session.prize_pool)}</p>
                                <p className="text-xs text-slate-500">FCFA</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-slate-900">{formatNumber(session.entry_fee)}</p>
                                <p className="text-xs text-slate-500">Entrée</p>
                              </div>
                            </div>
                            
                            {/* Progress */}
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-slate-500">Remplissage</span>
                                <span className="font-semibold text-slate-700">{Math.round(progress)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  className={`h-full bg-gradient-to-r ${getSessionGradient(session.session_type)}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.8 }}
                                />
                              </div>
                            </div>
                            
                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(session.created_at)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Registrations Tab */}
              {activeTab === 'registrations' && (
                <motion.div
                  key="registrations"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Rechercher un joueur..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <select
                      value={filterSession}
                      onChange={(e) => setFilterSession(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 text-slate-700"
                    >
                      <option value="">Toutes les sessions</option>
                      {sessions.map(session => (
                        <option key={session.id} value={session.id}>{session.name}</option>
                      ))}
                    </select>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Exporter
                    </motion.button>
                  </div>

                  <p className="text-sm text-slate-500">
                    {filteredRegistrations.length} inscription(s)
                  </p>

                  {/* Table */}
                  <div className="bg-slate-50 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Joueur</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">WhatsApp</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Session</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Date</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredRegistrations.map((reg, index) => (
                            <motion.tr 
                              key={reg.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className="bg-white hover:bg-purple-50/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                                    {reg.player_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-slate-900">{reg.player_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <a 
                                  href={`https://wa.me/${reg.whatsapp_number.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  <span className="text-sm">{reg.whatsapp_number}</span>
                                </a>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-sm text-slate-600">{reg.email || '-'}</span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <span className="text-sm text-slate-600">{reg.game_sessions?.name || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                {reg.status === 'registered' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    <Clock className="w-3 h-3" /> Inscrit
                                  </span>
                                )}
                                {reg.status === 'playing' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                    <Play className="w-3 h-3" /> En jeu
                                  </span>
                                )}
                                {reg.status === 'eliminated' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                    <XCircle className="w-3 h-3" /> Éliminé
                                  </span>
                                )}
                                {reg.status === 'winner' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    <Trophy className="w-3 h-3" /> Gagnant
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-sm text-slate-500">{formatDate(reg.created_at)}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedRegistration(reg)
                                    setShowRegistrationModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-200 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Détails
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Winners Tab */}
              {activeTab === 'winners' && (
                <motion.div
                  key="winners"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      Hall of Fame
                    </h3>
                    <span className="text-sm text-slate-500">{winners.length} vainqueur(s)</span>
                  </div>

                  {winners.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 text-slate-300" />
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">Aucun vainqueur</h4>
                      <p className="text-slate-500">Les champions apparaîtront ici</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {winners.map((winner, index) => (
                        <motion.div
                          key={winner.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className={`relative rounded-2xl overflow-hidden ${
                            index === 0 ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400' :
                            index === 1 ? 'bg-gradient-to-br from-slate-300 via-gray-300 to-slate-400' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 via-amber-500 to-orange-500' :
                            'bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600'
                          } p-0.5`}
                        >
                          <div className="bg-white rounded-[14px] p-5">
                            <div className="flex items-center gap-4">
                              <div className={`relative w-14 h-14 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-amber-100' :
                                index === 1 ? 'bg-slate-100' :
                                index === 2 ? 'bg-orange-100' :
                                'bg-purple-100'
                              }`}>
                                {index === 0 ? (
                                  <Crown className="w-7 h-7 text-amber-600" />
                                ) : index <= 2 ? (
                                  <Medal className="w-7 h-7 text-slate-600" />
                                ) : (
                                  <Award className="w-7 h-7 text-purple-600" />
                                )}
                                {index < 3 && (
                                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 border-current">
                                    #{index + 1}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 truncate">{winner.player_name}</p>
                                <p className="text-sm text-slate-500 truncate">{winner.game_sessions?.name || 'Session'}</p>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                              <a 
                                href={`https://wa.me/${winner.whatsapp_number.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                              >
                                <MessageCircle className="w-4 h-4" />
                                Contacter
                              </a>
                              {winner.game_sessions && (
                                <span className="font-bold text-emerald-600">
                                  {formatNumber(winner.game_sessions.prize_pool)} FCFA
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Questions Tab */}
              {activeTab === 'questions' && (
                <motion.div
                  key="questions"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Questions générées ({questions.length})
                    </h3>
                    <div className="flex items-center gap-3">
                      {selectedQuestions.length > 0 && (
                        <button
                          onClick={deleteSelectedQuestions}
                          disabled={deletingQuestions}
                          className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                        >
                          {deletingQuestions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Supprimer ({selectedQuestions.length})
                        </button>
                      )}
                      <button 
                        onClick={loadQuestions} 
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingQuestions ? 'animate-spin' : ''}`} />
                        Actualiser
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 w-10">
                              <input 
                                type="checkbox" 
                                checked={questions.length > 0 && selectedQuestions.length === questions.length}
                                onChange={toggleAllQuestions}
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Question</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Difficulté</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Round</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Temps</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {questions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                {loadingQuestions ? 'Chargement...' : 'Aucune question générée pour le moment.'}
                              </td>
                            </tr>
                          ) : (
                            questions.map((q, index) => (
                              <tr key={q.id || index} className={`hover:bg-slate-50/50 ${selectedQuestions.includes(q.id) ? 'bg-purple-50/30' : ''}`}>
                                <td className="px-6 py-4">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedQuestions.includes(q.id)}
                                    onChange={() => toggleQuestionSelection(q.id)}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-slate-900">{q.question_text}</span>
                                    <div className="text-xs text-slate-500 space-y-1">
                                      {q.answers.map((ans, i) => (
                                        <span 
                                          key={i} 
                                          className={`inline-block mr-2 px-1.5 py-0.5 rounded ${i === q.correct_answer_index ? 'bg-green-100 text-green-700 font-medium' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                          {ans}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    q.is_anti_ai 
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                      : q.difficulty === 'Facile' ? 'bg-green-100 text-green-800'
                                      : q.difficulty === 'Moyen' ? 'bg-blue-100 text-blue-800'
                                      : q.difficulty === 'Difficile' ? 'bg-orange-100 text-orange-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {q.is_anti_ai ? '⛔️ Anti-IA' : q.difficulty}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  #{q.round}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {q.time_limit}s
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                  {formatDate(q.created_at)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modal Création Session */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Nouvelle Session</h3>
                  </div>
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Type de session */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Type de session</label>
                  <div className="grid grid-cols-5 gap-2">
                    {SESSION_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => handleSessionTypeChange(type.value)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          newSession.session_type === type.value
                            ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full mx-auto mb-1.5 bg-gradient-to-r ${type.gradient}`} />
                        <span className="text-xs font-semibold text-slate-700">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nom */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nom de la session</label>
                  <input
                    type="text"
                    value={newSession.name}
                    onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                    placeholder="Ex: Session du Vendredi"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Frais et Max joueurs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Frais d&apos;entrée</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newSession.entry_fee}
                        onChange={(e) => setNewSession({ ...newSession, entry_fee: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">FCFA</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max joueurs</label>
                    <input
                      type="number"
                      value={newSession.max_players}
                      onChange={(e) => setNewSession({ ...newSession, max_players: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date de début (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={newSession.scheduled_start}
                    onChange={(e) => setNewSession({ ...newSession, scheduled_start: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-800 font-medium text-sm">Génération automatique</p>
                    <p className="text-blue-600 text-xs mt-0.5">
                      Les questions seront générées automatiquement à partir des articles récents.
                    </p>
                  </div>
                </div>

                {/* Résumé */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="font-semibold text-purple-900 mb-2 text-sm">Résumé</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-purple-700">{newSession.entry_fee.toLocaleString()}</p>
                      <p className="text-xs text-purple-500">FCFA/entrée</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-700">{newSession.max_players}</p>
                      <p className="text-xs text-purple-500">joueurs max</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{(newSession.entry_fee * newSession.max_players).toLocaleString()}</p>
                      <p className="text-xs text-purple-500">cagnotte max</p>
                    </div>
                  </div>
                </div>

                {/* Boutons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={createSession}
                    disabled={creatingSession || !newSession.name.trim()}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
                  >
                    {creatingSession ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Créer
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Détails Inscription */}
        {showRegistrationModal && selectedRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRegistrationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header avec statut */}
              <div className={`p-6 ${
                selectedRegistration.status === 'winner' 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400' 
                  : selectedRegistration.status === 'eliminated'
                  ? 'bg-gradient-to-r from-red-500 to-rose-500'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold text-white">
                      {selectedRegistration.status === 'winner' ? '🏆' : 
                       selectedRegistration.status === 'eliminated' ? '💀' : 
                       selectedRegistration.player_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedRegistration.player_name}</h3>
                      <p className="text-white/80 text-sm">
                        {selectedRegistration.status === 'winner' ? 'Vainqueur' :
                         selectedRegistration.status === 'eliminated' ? 'Éliminé' :
                         selectedRegistration.status === 'playing' ? 'En jeu' : 'Inscrit'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRegistrationModal(false)}
                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-5">
                {/* Informations de contact */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contact</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={`https://wa.me/${selectedRegistration.whatsapp_number.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs text-emerald-600">WhatsApp</p>
                        <p className="font-medium text-emerald-700">{selectedRegistration.whatsapp_number}</p>
                      </div>
                    </a>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                      <Calendar className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Inscrit le</p>
                        <p className="font-medium text-slate-700">{formatDate(selectedRegistration.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  {selectedRegistration.email && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-500">📧</span>
                      <div>
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="font-medium text-slate-700">{selectedRegistration.email}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Session jouée */}
                {selectedRegistration.game_sessions && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Session</h4>
                    <div className={`p-4 rounded-xl bg-gradient-to-r ${getSessionGradient(selectedRegistration.game_sessions.session_type)} text-white`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-xs uppercase">{selectedRegistration.game_sessions.session_type}</p>
                          <p className="font-bold text-lg">{selectedRegistration.game_sessions.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/80 text-xs">Cagnotte</p>
                          <p className="font-bold">{formatNumber(selectedRegistration.game_sessions.prize_pool)} FCFA</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Résultat de la partie */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Résultat</h4>
                  
                  {selectedRegistration.status === 'winner' && (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-bold text-amber-800">VICTOIRE !</p>
                          <p className="text-amber-600 text-sm">Position finale : #{selectedRegistration.final_position || 1}</p>
                        </div>
                      </div>
                      {selectedRegistration.game_sessions && (
                        <div className="bg-white/60 rounded-lg p-3 text-center">
                          <p className="text-amber-600 text-xs">Gains</p>
                          <p className="text-2xl font-black text-amber-700">
                            {formatNumber(selectedRegistration.game_sessions.prize_pool)} FCFA
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRegistration.status === 'eliminated' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <p className="font-bold text-red-800">ÉLIMINÉ</p>
                          {selectedRegistration.eliminated_at_round && (
                            <p className="text-red-600 text-sm">Au round #{selectedRegistration.eliminated_at_round}</p>
                          )}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3">
                        <p className="text-red-600 text-xs mb-1">Raison probable</p>
                        <p className="text-red-700 text-sm">
                          {selectedRegistration.eliminated_at_round 
                            ? `Mauvaise réponse ou temps écoulé au round ${selectedRegistration.eliminated_at_round}`
                            : 'Mauvaise réponse ou temps écoulé'}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedRegistration.status === 'registered' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-blue-800">En attente</p>
                          <p className="text-blue-600 text-sm">N'a pas encore joué ou partie en cours</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRegistration.status === 'playing' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center animate-pulse">
                          <Play className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-800">En jeu</p>
                          <p className="text-emerald-600 text-sm">Partie en cours...</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => setShowRegistrationModal(false)}
                  className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
