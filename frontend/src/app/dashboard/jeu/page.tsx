'use client'

import { useState, useEffect } from 'react'
import { 
  Gamepad2, Users, Trophy, MessageCircle, Calendar, 
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
  Plus, Search, Filter, Download, Eye, Zap, HelpCircle,
  Crown, Medal, X
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
}

interface Registration {
  id: string
  session_id: string
  player_name: string
  whatsapp_number: string
  email: string | null
  status: string
  created_at: string
  eliminated_at_round?: number
  eliminated_at_question?: string
  final_position?: number
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Types de sessions disponibles
const SESSION_TYPES = [
  { value: 'starter', label: 'Starter', entryFee: 500, maxPlayers: 50, color: 'green' },
  { value: 'classic', label: 'Classic', entryFee: 1000, maxPlayers: 100, color: 'blue' },
  { value: 'premium', label: 'Premium', entryFee: 2500, maxPlayers: 200, color: 'purple' },
  { value: 'elite', label: 'Elite', entryFee: 5000, maxPlayers: 500, color: 'yellow' },
  { value: 'mega', label: 'Mega', entryFee: 10000, maxPlayers: 1000, color: 'red' },
]

export default function GameDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'sessions' | 'winners'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSession, setFilterSession] = useState<string>('')
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  
  // Modal création session
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  
  // Modal détail inscription
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

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Charger les stats
      const statsRes = await fetch(`${API_URL}/api/game/dashboard/stats`)
      const statsData = await statsRes.json()
      if (statsData.success) {
        setStats(statsData.stats)
      }

      // Charger les inscriptions
      const regsRes = await fetch(`${API_URL}/api/game/dashboard/registrations?limit=200`)
      const regsData = await regsRes.json()
      if (regsData.success) {
        setRegistrations(regsData.registrations)
      }

      // Charger les sessions
      const sessionsRes = await fetch(`${API_URL}/api/game/sessions?limit=50`)
      const sessionsData = await sessionsRes.json()
      if (sessionsData.success) {
        setSessions(sessionsData.sessions)
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error)
    } finally {
      setLoading(false)
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
        alert(`✅ ${data.generated} questions générées avec succès !`)
        loadDashboardData()
      } else {
        alert(`❌ Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur génération:', error)
      alert('❌ Erreur lors de la génération')
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
        alert('✅ Session créée avec succès !')
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
    } catch (error) {
      console.error('Erreur création session:', error)
      alert('❌ Erreur lors de la création')
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
      mega: 'bg-red-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string, text: string, label: string }> = {
      upcoming: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'À venir' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'En cours' },
      completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Terminée' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulée' }
    }
    const badge = badges[status] || badges.upcoming
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
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

  const exportToCSV = () => {
    const headers = ['Nom', 'WhatsApp', 'Email', 'Session', 'Statut', 'Date inscription']
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
                Générer Questions
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

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Gamepad2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalSessions || 0}</p>
                <p className="text-xs text-gray-500">Sessions</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalRegistrations || 0}</p>
                <p className="text-xs text-gray-500">Inscrits</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Trophy className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {((stats?.totalPrizePool || 0) / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-gray-500">Cagnotte FCFA</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <HelpCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalQuestions || 0}</p>
                <p className="text-xs text-gray-500">Questions</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.sessions?.active || 0}</p>
                <p className="text-xs text-gray-500">En cours</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.questionsUsedToday || 0}</p>
                <p className="text-xs text-gray-500">Q. aujourd&apos;hui</p>
              </div>
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
                { id: 'registrations', label: 'Inscriptions', icon: Users },
                { id: 'sessions', label: 'Sessions', icon: Gamepad2 },
                { id: 'winners', label: '🏆 Vainqueurs', icon: Crown },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
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
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Sessions récentes</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stats?.recentSessions?.slice(0, 6).map(session => (
                    <div key={session.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`w-3 h-3 rounded-full ${getSessionTypeColor(session.session_type)}`} />
                        {getStatusBadge(session.status)}
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1">{session.name}</h4>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {session.current_players}
                        </span>
                        <span className="font-medium text-green-600">
                          {session.prize_pool.toLocaleString()} FCFA
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dernières inscriptions */}
                <h3 className="text-lg font-semibold text-gray-900 mt-8">Dernières inscriptions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registrations.slice(0, 5).map(reg => (
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
                          <td className="px-4 py-3 text-gray-600">
                            {reg.game_sessions?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {formatDate(reg.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Registrations Tab */}
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
                  {filteredRegistrations.length} inscription(s) trouvée(s)
                </p>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joueur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
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
                          <td className="px-4 py-3 text-gray-600">
                            {reg.email || '-'}
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
                                Éliminé {reg.eliminated_at_round ? `(R${reg.eliminated_at_round})` : ''}
                              </span>
                            )}
                            {reg.status === 'winner' && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">🏆 Gagnant</span>
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
                              Détails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Toutes les sessions</h3>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle session
                  </button>
                </div>

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
                              <Trophy className="w-4 h-4" />
                              Cagnotte
                            </span>
                            <span className="font-medium text-green-600">
                              {session.prize_pool.toLocaleString()} FCFA
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Zap className="w-4 h-4" />
                              Entrée
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
                              style={{ width: `${(session.current_players / session.max_players) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {Math.round((session.current_players / session.max_players) * 100)}% rempli
                          </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.created_at)}
                          </span>
                          <button className="text-purple-600 hover:text-purple-700 font-medium">
                            Voir détails →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Winners Tab */}
            {activeTab === 'winners' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">🏆 Tableau des Vainqueurs</h3>
                  <span className="text-sm text-gray-500">{winners.length} vainqueur(s)</span>
                </div>

                {winners.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun vainqueur pour le moment</h4>
                    <p className="text-gray-500">Les vainqueurs des sessions apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {winners.map((winner, index) => (
                      <div 
                        key={winner.id} 
                        className={`relative rounded-xl overflow-hidden ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                          'bg-gradient-to-br from-purple-500 to-indigo-600'
                        } p-1`}
                      >
                        <div className="bg-white rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-100' :
                              index === 1 ? 'bg-gray-100' :
                              index === 2 ? 'bg-orange-100' :
                              'bg-purple-100'
                            }`}>
                              {index === 0 ? (
                                <Crown className="w-6 h-6 text-yellow-600" />
                              ) : index <= 2 ? (
                                <Medal className="w-6 h-6 text-gray-600" />
                              ) : (
                                <Trophy className="w-6 h-6 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{winner.player_name}</p>
                              <p className="text-sm text-gray-500">{winner.game_sessions?.name || 'Session'}</p>
                            </div>
                            {index < 3 && (
                              <span className="ml-auto text-2xl font-bold text-gray-400">#{index + 1}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <a 
                              href={`https://wa.me/${winner.whatsapp_number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:text-green-700"
                            >
                              <MessageCircle className="w-4 h-4" />
                              Contacter
                            </a>
                            <span className="text-gray-500">{formatDate(winner.created_at)}</span>
                          </div>

                          {winner.game_sessions && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Cagnotte gagnée</span>
                                <span className="font-bold text-green-600">
                                  {winner.game_sessions.prize_pool?.toLocaleString() || 0} FCFA
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Création Session */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Créer une nouvelle session</h3>
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
                      <span className={`block w-3 h-3 rounded-full mx-auto mb-1 bg-${type.color}-500`} />
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

              {/* Frais d'entrée et Max joueurs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frais d&apos;entrée (FCFA)</label>
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

              {/* Date de début */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de début (optionnel)</label>
                <input
                  type="datetime-local"
                  value={newSession.scheduled_start}
                  onChange={(e) => setNewSession({ ...newSession, scheduled_start: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Résumé */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">Résumé</h4>
                <div className="text-sm text-purple-700 space-y-1">
                  <p>Type: <strong>{SESSION_TYPES.find(t => t.value === newSession.session_type)?.label}</strong></p>
                  <p>Entrée: <strong>{newSession.entry_fee.toLocaleString()} FCFA</strong></p>
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
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Créer la session
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail Inscription */}
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
                    {selectedRegistration.status === 'winner' ? '🏆 Gagnant' : 
                     selectedRegistration.status === 'eliminated' ? '❌ Éliminé' : 
                     selectedRegistration.status === 'playing' ? '🎮 En jeu' : '📝 Inscrit'}
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
                  <p className="font-medium text-green-800">{selectedRegistration.whatsapp_number}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Inscrit le</p>
                  <p className="font-medium text-gray-800">{formatDate(selectedRegistration.created_at)}</p>
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

            {/* Résultat */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Résultat</p>
              {selectedRegistration.status === 'winner' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="font-bold text-yellow-800">Vainqueur ! 🎉</p>
                      <p className="text-sm text-yellow-600">A remporté la cagnotte</p>
                    </div>
                  </div>
                </div>
              )}
              {selectedRegistration.status === 'eliminated' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-red-500" />
                    <div>
                      <p className="font-bold text-red-800">
                        Éliminé au Round {selectedRegistration.eliminated_at_round || '?'}
                      </p>
                      {selectedRegistration.eliminated_at_question && (
                        <p className="text-sm text-red-600 mt-1">
                          Question: {selectedRegistration.eliminated_at_question.substring(0, 80)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedRegistration.status === 'playing' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Gamepad2 className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="font-bold text-green-800">En jeu</p>
                      <p className="text-sm text-green-600">Partie en cours...</p>
                    </div>
                  </div>
                </div>
              )}
              {selectedRegistration.status === 'registered' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="font-bold text-blue-800">Inscrit</p>
                      <p className="text-sm text-blue-600">En attente du début de la session</p>
                    </div>
                  </div>
                </div>
              )}
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
