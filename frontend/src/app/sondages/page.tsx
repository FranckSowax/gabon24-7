'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Loading } from '@/components/ui/Loading'
import UpcomingEvents from '@/components/widgets/UpcomingEvents'
import YouTubeWidget from '@/components/widgets/YouTubeWidget'
import TrendingWidget from '@/components/widgets/TrendingWidget'
import MultiQuestionPollWidget from '@/components/widgets/MultiQuestionPollWidget'
import YesterdayPollWidget from '@/components/widgets/YesterdayPollWidget'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic'

interface Poll {
  id: string
  question: string
  poll_type: 'yes_no' | 'mcq' | 'series'
  options: string[]
  total_votes: number
  created_at: string
  expires_at: string
  is_active: boolean
}

interface PollStats {
  response_value: string
  vote_count: number
  percentage: number
}

interface PollQuestion {
  id: string
  poll_id: string
  question_text: string
  question_type: 'yes_no' | 'mcq'
  options: string[]
  question_order: number
}

interface PollPackage {
  id: string
  name: string
  price: number
  duration: string
  features: string[]
  recommended?: boolean
}

interface PollOrder {
  id: string
  organization: string
  contact: string
  email: string
  phone: string
  package: string
  questions: string[]
  targetAudience: string
  budget: number
  deadline: string
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
}

export default function SondagesPage() {
  const router = useRouter()
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const [polls, setPolls] = useState<Poll[]>([])
  const [archivedPolls, setArchivedPolls] = useState<Poll[]>([])
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [pollStats, setPollStats] = useState<PollStats[]>([])
  const [lastSeriesPoll, setLastSeriesPoll] = useState<Poll | null>(null)
  const [lastSeriesQuestions, setLastSeriesQuestions] = useState<PollQuestion[]>([])
  const [lastSeriesQuestionStats, setLastSeriesQuestionStats] = useState<Record<string, PollStats[]>>({})
  const [lastSeriesLoading, setLastSeriesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([])
  const [filteredArchivedPolls, setFilteredArchivedPolls] = useState<Poll[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [isProfessionalMode, setIsProfessionalMode] = useState(false)
  const [activeProTab, setActiveProTab] = useState<'dashboard' | 'tools' | 'order' | 'pricing'>('dashboard')
  const [selectedPackage, setSelectedPackage] = useState<PollPackage | null>(null)
  const [orderForm, setOrderForm] = useState({
    organization: '',
    contact: '',
    email: '',
    phone: '',
    questions: [''],
    targetAudience: '',
    deadline: '',
    additionalInfo: ''
  })

  // Protection de la page - Pro uniquement
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signin?redirect=/sondages')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [user, subscriptionPlan, authLoading, router])

  // Afficher loading pendant la vérification
  if (authLoading || !user || subscriptionPlan?.slug !== 'pro') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  // Fonction pour le menu mobile (comme les autres pages)
  const toggleMobileMenu = () => {
    console.log('SondagesPage - toggleMobileMenu called, current:', isMobileMenuOpen);
    const newState = !isMobileMenuOpen;
    console.log('SondagesPage - Setting isMobileMenuOpen to:', newState);
    setIsMobileMenuOpen(newState);
    
    // Force DOM update pour production
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const sidebar = document.querySelector('aside');
        if (sidebar && newState) {
          sidebar.style.transform = 'translateX(0)';
          sidebar.style.visibility = 'visible';
        }
      }, 0);
    }
  };

  // Charger questions + statistiques du dernier sondage de type "series" archivé
  const loadLastSeriesDetails = async (pollId: string) => {
    try {
      setLastSeriesLoading(true)
      // 1) Charger toutes les questions de la série via Express
      const qRes = await fetch(`${API_URL}/api/polls/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId })
      })
      if (!qRes.ok) throw new Error(`HTTP ${qRes.status}`)
      const qData = await qRes.json()
      const questions: PollQuestion[] = (qData?.questions || [])
      setLastSeriesQuestions(questions)

      // 2) Charger stats par question
      const statsMap: Record<string, PollStats[]> = {}
      for (const q of questions) {
        const sRes = await fetch(`${API_URL}/api/polls/stats?question_id=${q.id}`)
        const sData = await sRes.json().catch(() => ({}))
        if (sData?.success && Array.isArray(sData.stats)) {
          const raw = sData.stats
          const total = raw.reduce((sum: number, s: any) => sum + (s.vote_count ?? s.count ?? 0), 0)
          statsMap[q.id] = raw.map((s: any) => ({
            response_value: s.response_value ?? s.response,
            vote_count: s.vote_count ?? s.count ?? 0,
            percentage: total ? ((s.vote_count ?? s.count ?? 0) * 100) / total : 0
          }))
        } else {
          statsMap[q.id] = []
        }
      }
      setLastSeriesQuestionStats(statsMap)
    } catch (e) {
      console.error('Erreur chargement stats (series):', e)
      setLastSeriesQuestions([])
      setLastSeriesQuestionStats({})
    } finally {
      setLastSeriesLoading(false)
    }
  }

  // Charger tous les sondages via Express backend
  const loadPolls = async () => {
    try {
      setLoading(true)

      const response = await fetch(`${API_URL}/api/polls`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setPolls(result.polls || [])
      } else {
        throw new Error(result.error || 'Erreur lors du chargement')
      }

      // Charger les sondages archivés via Supabase (temporaire)
      try {
        const { data: archived, error: supErr } = await supabase
          .from('polls')
          .select('*')
          .eq('is_active', false)
          .order('created_at', { ascending: false })
          .limit(50)
        if (supErr) throw supErr
        setArchivedPolls(archived || [])
      } catch (e) {
        setArchivedPolls([])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des sondages:', error)
      // Fallback : essayer Supabase direct
      try {
        const { data, error: supabaseError } = await supabase
          .from('polls')
          .select('*')
          .eq('status', 'published')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20)

        if (supabaseError) throw supabaseError
        console.log('Fallback - Sondages chargés via Supabase:', data)
        setPolls(data || [])

        // Charger archivés en fallback
        try {
          const { data: archived } = await supabase
            .from('polls')
            .select('*')
            .eq('is_active', false)
            .order('created_at', { ascending: false })
            .limit(50)
          setArchivedPolls(archived || [])
        } catch {}
      } catch (fallbackError) {
        console.error('Erreur fallback Supabase:', fallbackError)
        setPolls([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques d'un sondage via Express (par question)
  const loadPollStats = async (pollId: string) => {
    try {
      setStatsLoading(true)
      // 1) Récupérer les questions du sondage
      const qRes = await fetch(`${API_URL}/api/polls/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId })
      })
      if (!qRes.ok) throw new Error(`HTTP ${qRes.status}`)
      const qData = await qRes.json().catch(() => ({}))
      const firstQuestionId = Array.isArray(qData?.questions) && qData.questions.length > 0 ? qData.questions[0].id : null
      if (!firstQuestionId) {
        setPollStats([])
        return
      }

      // 2) Stats pour la première question
      const sRes = await fetch(`${API_URL}/api/polls/stats?question_id=${firstQuestionId}`)
      if (!sRes.ok) throw new Error(`HTTP ${sRes.status}`)
      const sData = await sRes.json()
      if (sData.success) {
        const raw = sData.stats || []
        const total = raw.reduce((sum: number, s: any) => sum + (s.vote_count ?? s.count ?? 0), 0)
        const normalized: PollStats[] = raw.map((s: any) => ({
          response_value: s.response_value ?? s.response,
          vote_count: s.vote_count ?? s.count ?? 0,
          percentage: total ? ((s.vote_count ?? s.count ?? 0) * 100) / total : 0
        }))
        setPollStats(normalized)
      } else {
        throw new Error(sData.error || 'Erreur lors du chargement des stats')
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error)
      // Fallback : essayer Supabase direct
      try {
        const { data, error: supabaseError } = await supabase
          .from('poll_stats')
          .select('*')
          .eq('poll_id', pollId)
          .order('vote_count', { ascending: false })

        if (supabaseError) throw supabaseError
        console.log('Fallback - Stats chargées via Supabase:', data)
        setPollStats(data || [])
      } catch (fallbackError) {
        console.error('Erreur fallback Supabase stats:', fallbackError)
        setPollStats([])
      }
    } finally {
      setStatsLoading(false)
    }
  }

  // Sélectionner un sondage et charger ses stats
  const selectPoll = async (poll: Poll) => {
    setSelectedPoll(poll)
    setShowModal(true)
    await loadPollStats(poll.id)
  }

  // Filtrer les sondages selon la recherche
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredPolls(polls)
      setFilteredArchivedPolls(archivedPolls)
    } else {
      const filteredActive = polls.filter(poll =>
        poll.question.toLowerCase().includes(query.toLowerCase())
      )
      const filteredArchived = archivedPolls.filter(poll =>
        poll.question.toLowerCase().includes(query.toLowerCase())
      )
      setFilteredPolls(filteredActive)
      setFilteredArchivedPolls(filteredArchived)
    }
  }

  useEffect(() => {
    loadPolls()
  }, [])

  useEffect(() => {
    setFilteredPolls(polls)
  }, [polls])

  useEffect(() => {
    setFilteredArchivedPolls(archivedPolls)
  }, [archivedPolls])

  // Déterminer le dernier sondage "series" archivé (clôturé à 18:55 UTC) et charger ses résultats
  useEffect(() => {
    if (!archivedPolls || archivedPolls.length === 0) {
      setLastSeriesPoll(null)
      setLastSeriesQuestions([])
      setLastSeriesQuestionStats({})
      return
    }
    const seriesArchived = archivedPolls.filter(p => p.poll_type === 'series')
    if (seriesArchived.length === 0) {
      setLastSeriesPoll(null)
      setLastSeriesQuestions([])
      setLastSeriesQuestionStats({})
      return
    }
    // Choisir le plus récent selon la date d'expiration (clôture)
    const latest = [...seriesArchived].sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime())[0]
    setLastSeriesPoll(latest)
    if (latest?.id) {
      loadLastSeriesDetails(latest.id)
    }
  }, [archivedPolls])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (poll: Poll) => {
    const now = new Date()
    const expiresAt = new Date(poll.expires_at)
    
    if (poll.is_active && expiresAt > now) {
      return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Actif</span>
    } else {
      return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Terminé</span>
    }
  }

  const displayActivePolls = searchQuery.trim() ? filteredPolls : polls
  const displayArchivedPolls = searchQuery.trim() ? filteredArchivedPolls : archivedPolls

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={toggleMobileMenu} />
      
      {/* Main Layout */}
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => {
            console.log('SondagesPage - onMobileClose called');
            setIsMobileMenuOpen(false);
          }}
        />
        
        {/* Central Content Area */}
        <div className="flex-1 lg:ml-0 lg:mr-80 min-w-0">
          <main className="w-full py-4 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-2">
              {/* Top Banner with Profile Widget - Ultra Responsive */}
              <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white rounded-lg sm:rounded-2xl mb-4 sm:mb-8 shadow-xl sm:shadow-2xl border border-blue-300/30">
                {/* Background Image */}
                <div className="absolute inset-0">
                  <img 
                    src="/sondages.jpg" 
                    alt="Sondages Background"
                    className="w-full h-full object-cover"
                  />
                  {/* Dark Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60"></div>
                  {/* Animated Elements - Hidden on mobile for performance */}
                  <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-blue-600/20 via-transparent to-purple-600/20 animate-pulse"></div>
                  <div className="hidden sm:block absolute top-4 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-bounce"></div>
                  <div className="hidden sm:block absolute bottom-8 right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
                </div>
                
                <div className="relative z-10 p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xl sm:text-2xl">{isProfessionalMode ? '🏢' : '📊'}</span>
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 leading-tight">
                          {isProfessionalMode ? 'Sondages Professionnels' : 'Sondages Gabon Insight'}
                        </h1>
                        <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                          {isProfessionalMode 
                            ? 'Solutions d\'enquêtes sur mesure pour votre organisation'
                            : 'Votre opinion compte ! Participez aux débats nationaux'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Mode Toggle - Responsive */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                      <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-1 border border-white/20 w-full sm:w-auto">
                        <button
                          onClick={() => setIsProfessionalMode(false)}
                          className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base flex-1 sm:flex-initial justify-center ${
                            !isProfessionalMode
                              ? 'bg-white text-indigo-600 shadow-lg'
                              : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>👥</span>
                          <span>Public</span>
                        </button>
                        <button
                          onClick={() => window.location.href = '/sondages-pro'}
                          className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base flex-1 sm:flex-initial justify-center ${
                            isProfessionalMode
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg'
                              : 'text-white/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>🏢</span>
                          <span>Pro</span>
                          {isProfessionalMode && <span className="hidden sm:inline text-xs bg-white/20 px-2 py-0.5 rounded-full">PREMIUM</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Conditional Content Based on Mode */}
              {!isProfessionalMode ? (
                <>
                  {/* Search Bar - Public Mode - Ultra Responsive */}
                  <div className="mb-6 sm:mb-8">
                    <div className="relative max-w-full sm:max-w-md mx-auto">
                      <input
                        type="text"
                        placeholder="Rechercher un sondage..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-sm sm:text-base"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Professional Mode Navigation - Ultra Responsive */}
                  <div className="mb-6 sm:mb-8">
                    <div className="border-b border-gray-200">
                      {/* Desktop Navigation */}
                      <nav className="hidden sm:flex -mb-px space-x-4 lg:space-x-8 overflow-x-auto scrollbar-hide">
                        {[
                          { id: 'dashboard', label: 'Tableau de Bord', icon: '📊' },
                          { id: 'tools', label: 'Outils Pro', icon: '🛠️' },
                          { id: 'pricing', label: 'Tarifs', icon: '💰' },
                          { id: 'order', label: 'Commander', icon: '🚀' }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveProTab(tab.id as any)}
                            className={`${
                              activeProTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-3 sm:py-4 px-3 sm:px-6 border-b-2 font-medium text-sm rounded-t-lg transition-all duration-200 flex items-center space-x-2`}
                          >
                            <span>{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                          </button>
                        ))}
                      </nav>

                      {/* Mobile Navigation */}
                      <div className="sm:hidden">
                        <div className="grid grid-cols-2 gap-2 p-2">
                          {[
                            { id: 'dashboard', label: 'Tableau de Bord', shortLabel: 'Dashboard', icon: '📊' },
                            { id: 'tools', label: 'Outils Pro', shortLabel: 'Outils', icon: '🛠️' },
                            { id: 'pricing', label: 'Tarifs', shortLabel: 'Prix', icon: '💰' },
                            { id: 'order', label: 'Commander', shortLabel: 'Commande', icon: '🚀' }
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveProTab(tab.id as any)}
                              className={`${
                                activeProTab === tab.id
                                  ? 'bg-indigo-500 text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              } py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex flex-col items-center space-y-1`}
                            >
                              <span className="text-lg">{tab.icon}</span>
                              <span>{tab.shortLabel}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Content Based on Mode */}
              {!isProfessionalMode ? (
                /* Public Polls Grid - Organized by Day - Mobile First */
                <div className="space-y-6 sm:space-y-8">
                  {/* Résultats du dernier sondage de série archivé */}
                  {lastSeriesPoll && (
                    <div className="bg-white rounded-lg sm:rounded-2xl shadow-sm border border-orange-200/60 overflow-hidden">
                      <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏁</span>
                          <h3 className="text-base sm:text-lg font-bold text-gray-900">Résultats du dernier sondage (série)</h3>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                          Clôturé le {new Date(lastSeriesPoll.expires_at).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                          <h4 className="text-sm sm:text-base font-semibold text-gray-900">
                            {lastSeriesPoll.question}
                          </h4>
                          <div className="text-xs sm:text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1 rounded-full shadow">
                            {lastSeriesPoll.total_votes || 0} votes
                          </div>
                        </div>

                        {lastSeriesLoading ? (
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                          </div>
                        ) : lastSeriesQuestions.length > 0 ? (
                          <div className="space-y-4">
                            {lastSeriesQuestions.map((q, qIdx) => {
                              const qStats = lastSeriesQuestionStats[q.id] || []
                              return (
                                <div key={q.id} className="p-3 rounded-xl border border-orange-100 bg-orange-50/40">
                                  <div className="mb-2 font-medium text-gray-900 text-sm">{qIdx + 1}. {q.question_text}</div>
                                  {qStats.length > 0 ? (
                                    <div className="space-y-2">
                                      {qStats.map((stat, idx) => (
                                        <div key={idx} className="p-2 rounded-lg border border-gray-200 bg-white/60">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{stat.response_value}</span>
                                            <span className="text-xs sm:text-sm font-bold text-gray-900">{(stat.percentage || 0).toFixed(0)}%</span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                              className="h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                                              style={{ width: `${stat.percentage || 0}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500">Aucune donnée pour cette question.</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">Aucune statistique disponible.</div>
                        )}
                      </div>
                    </div>
                  )}
                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="group bg-white rounded-lg sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-pulse hover:shadow-xl transition-all duration-300">
                          <div className="h-3 sm:h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-3 sm:mb-4"></div>
                          <div className="h-2 sm:h-3 bg-gray-100 rounded-lg w-2/3 mb-2"></div>
                          <div className="h-2 sm:h-3 bg-gray-100 rounded-lg w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : displayActivePolls.length > 0 ? (
                    (() => {
                      // Grouper les sondages par jour
                      const pollsByDay = displayActivePolls.reduce((acc: Record<string, Poll[]>, poll: Poll) => {
                        const date = new Date(poll.created_at).toDateString()
                        if (!acc[date]) {
                          acc[date] = []
                        }
                        acc[date].push(poll)
                        return acc
                      }, {} as Record<string, Poll[]>)

                      return Object.entries(pollsByDay)
                        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                        .map(([dateString, dayPolls]: [string, Poll[]]) => {
                          const date = new Date(dateString)
                          const isToday = date.toDateString() === new Date().toDateString()
                          const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString()
                          
                          let dayLabel = date.toLocaleDateString('fr-FR', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric'
                          })
                          
                          if (isToday) dayLabel = `Aujourd'hui • ${dayLabel}`
                          else if (isYesterday) dayLabel = `Hier • ${dayLabel}`

                          return (
                            <motion.div
                              key={dateString}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              {/* Day Header - Mobile Responsive */}
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                                <div className={`px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm inline-flex items-center space-x-2 ${
                                  isToday 
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                                    : isYesterday
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700'
                                }`}>
                                  <span>{isToday ? '🔥' : isYesterday ? '📅' : '📊'}</span>
                                  <span className="truncate">{dayLabel}</span>
                                </div>
                                <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                                <span className="text-xs sm:text-sm text-gray-500 font-medium">
                                  {dayPolls.length} sondage{dayPolls.length > 1 ? 's' : ''}
                                </span>
                              </div>

                              {/* Polls Grid for this day - Mobile First */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                {dayPolls.map((poll: Poll, index: number) => (
                                  <motion.div
                                    key={poll.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    whileHover={{ y: -4, scale: 1.01 }}
                                    className="group bg-white rounded-lg sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl sm:hover:shadow-2xl hover:border-indigo-200 cursor-pointer transition-all duration-300 overflow-hidden"
                                    onClick={() => selectPoll(poll)}
                                  >
                                    <div className="relative">
                                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                      <div className="relative p-4 sm:p-6">
                                        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4">
                                          <div className="flex items-center space-x-2 flex-wrap">
                                            {getStatusBadge(poll)}
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                            {isToday && (
                                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                                NOUVEAU
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center">
                                            <span className="text-xs text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium border border-gray-200">
                                              👥 {poll.total_votes || 0} votes
                                            </span>
                                          </div>
                                        </div>
                                        
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 line-clamp-3 leading-relaxed group-hover:text-indigo-700 transition-colors duration-300">
                                          {poll.question}
                                        </h3>
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-xs sm:text-sm">
                                          <span className="flex items-center text-gray-500 group-hover:text-gray-700 transition-colors">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-2 group-hover:bg-indigo-200 transition-colors">
                                              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                            </div>
                                            <span className="text-xs sm:text-sm">
                                              {new Date(poll.created_at).toLocaleTimeString('fr-FR', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                              })}
                                            </span>
                                          </span>
                                          <div className="flex items-center text-indigo-600 font-semibold group-hover:text-indigo-700 transition-colors">
                                            <span className="mr-1 text-xs sm:text-sm">Voir résultats</span>
                                            <svg className="w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )
                        })
                    })()
                  ) : (
                    <div className="text-center py-12 sm:py-16">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                        <span className="text-2xl sm:text-3xl">📊</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Aucun sondage trouvé</h3>
                      <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto px-4">
                        {searchQuery.trim() 
                          ? 'Aucun sondage ne correspond à votre recherche. Essayez avec d\'autres mots-clés.'
                          : 'Aucun sondage disponible pour le moment. Revenez bientôt pour participer aux débats !'
                        }
                      </p>
                    </div>
                  )}

                  {/* Section Sondages Archivés */}
                  {displayArchivedPolls.length > 0 && (
                    <div className="mt-12 sm:mt-16">
                      {/* Toggle pour afficher les sondages archivés */}
                      <div className="text-center mb-6 sm:mb-8">
                        <button
                          onClick={() => setShowArchived(!showArchived)}
                          className="inline-flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl font-medium text-gray-700 hover:text-gray-900 transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                          <span className="text-lg">📚</span>
                          <span>Sondages Archivés ({displayArchivedPolls.length})</span>
                          <svg 
                            className={`w-4 h-4 transition-transform duration-300 ${showArchived ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Sondages archivés */}
                      {showArchived && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-6 sm:space-y-8"
                        >
                          {(() => {
                            // Grouper les sondages archivés par jour
                            const archivedPollsByDay = displayArchivedPolls.reduce((acc: Record<string, Poll[]>, poll: Poll) => {
                              const date = new Date(poll.created_at).toDateString()
                              if (!acc[date]) {
                                acc[date] = []
                              }
                              acc[date].push(poll)
                              return acc
                            }, {} as Record<string, Poll[]>)

                            return Object.entries(archivedPollsByDay)
                              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                              .map(([dateString, dayPolls]: [string, Poll[]]) => {
                                const date = new Date(dateString)
                                const dayLabel = date.toLocaleDateString('fr-FR', { 
                                  weekday: 'long', 
                                  day: 'numeric', 
                                  month: 'long',
                                  year: 'numeric'
                                })

                                return (
                                  <motion.div
                                    key={`archived-${dateString}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                  >
                                    {/* Day Header pour archives */}
                                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                                      <div className="px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm inline-flex items-center space-x-2 bg-gradient-to-r from-amber-100 to-orange-200 text-amber-800">
                                        <span>📚</span>
                                        <span className="truncate">{dayLabel}</span>
                                      </div>
                                      <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-amber-300 to-transparent"></div>
                                      <span className="text-xs sm:text-sm text-amber-600 font-medium">
                                        {dayPolls.length} sondage{dayPolls.length > 1 ? 's' : ''} archivé{dayPolls.length > 1 ? 's' : ''}
                                      </span>
                                    </div>

                                    {/* Archived Polls Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                      {dayPolls.map((poll: Poll, index: number) => (
                                        <motion.div
                                          key={poll.id}
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: index * 0.1 }}
                                          whileHover={{ y: -2, scale: 1.005 }}
                                          className="group bg-white rounded-lg sm:rounded-2xl shadow-sm border border-amber-100 hover:shadow-lg hover:border-amber-200 cursor-pointer transition-all duration-300 overflow-hidden opacity-90 hover:opacity-100"
                                          onClick={() => selectPoll(poll)}
                                        >
                                          <div className="relative">
                                            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 opacity-30"></div>
                                            <div className="relative p-4 sm:p-6">
                                              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4">
                                                <div className="flex items-center space-x-2 flex-wrap">
                                                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">Archivé</span>
                                                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                                </div>
                                                <div className="flex items-center">
                                                  <span className="text-xs text-amber-600 bg-gradient-to-r from-amber-50 to-orange-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium border border-amber-200">
                                                    👥 {poll.total_votes || 0} votes
                                                  </span>
                                                </div>
                                              </div>
                                              
                                              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 line-clamp-3 leading-relaxed group-hover:text-amber-700 transition-colors duration-300">
                                                {poll.question}
                                              </h3>
                                              
                                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-xs sm:text-sm">
                                                <span className="flex items-center text-amber-600 group-hover:text-amber-700 transition-colors">
                                                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 rounded-lg flex items-center justify-center mr-2 group-hover:bg-amber-200 transition-colors">
                                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                  </div>
                                                  <span className="text-xs sm:text-sm">
                                                    {new Date(poll.created_at).toLocaleTimeString('fr-FR', { 
                                                      hour: '2-digit', 
                                                      minute: '2-digit' 
                                                    })}
                                                  </span>
                                                </span>
                                                <div className="flex items-center text-amber-600 font-semibold group-hover:text-amber-700 transition-colors">
                                                  <span className="mr-1 text-xs sm:text-sm">Voir résultats</span>
                                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                  </svg>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )
                              })
                          })()}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Professional Mode Content */
                <div className="space-y-8">
                  {/* Dashboard Tab */}
                  {activeProTab === 'dashboard' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-2xl border border-blue-200">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl">📈</span>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm text-blue-700 font-medium">Sondages Actifs</p>
                              <p className="text-3xl font-bold text-blue-900">12</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-2xl border border-green-200">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl">👥</span>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm text-green-700 font-medium">Répondants</p>
                              <p className="text-3xl font-bold text-green-900">8,547</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-6 rounded-2xl border border-purple-200">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl">✅</span>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm text-purple-700 font-medium">Taux de Réponse</p>
                              <p className="text-3xl font-bold text-purple-900">87%</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 p-6 rounded-2xl border border-yellow-200">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                              <span className="text-2xl">⏱️</span>
                            </div>
                            <div className="ml-4">
                              <p className="text-sm text-yellow-700 font-medium">Temps Moyen</p>
                              <p className="text-3xl font-bold text-yellow-900">3.2min</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                          <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-lg">🎯</span>
                          </span>
                          Pourquoi Choisir Nos Services ?
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">🎯</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 mb-2">Expertise Locale</h4>
                                <p className="text-gray-600">Connaissance approfondie du marché gabonais et des spécificités culturelles.</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-4">
                              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">⚡</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 mb-2">Résultats Rapides</h4>
                                <p className="text-gray-600">Collecte et analyse accélérées pour des décisions éclairées.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">📊</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 mb-2">Analyses Avancées</h4>
                                <p className="text-gray-600">Statistiques poussées et insights actionnables pour votre stratégie.</p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-4">
                              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">🔒</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 mb-2">Confidentialité Garantie</h4>
                                <p className="text-gray-600">Protection totale de vos données et de celles de vos répondants.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Tools Tab */}
                  {activeProTab === 'tools' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {[
                        {
                          icon: '📊',
                          title: 'Créateur de Sondages',
                          description: 'Interface intuitive pour créer vos sondages personnalisés',
                          features: ['Questions multiples', 'Logique conditionnelle', 'Prévisualisation temps réel']
                        },
                        {
                          icon: '🎯',
                          title: 'Ciblage Avancé',
                          description: 'Définissez précisément votre audience cible',
                          features: ['Critères démographiques', 'Géolocalisation', 'Comportements']
                        },
                        {
                          icon: '📈',
                          title: 'Analytics Pro',
                          description: 'Analyses statistiques approfondies de vos résultats',
                          features: ['Tableaux croisés', 'Tests de significativité', 'Tendances temporelles']
                        },
                        {
                          icon: '📱',
                          title: 'Distribution Multi-Canal',
                          description: 'Diffusez vos sondages sur tous les canaux',
                          features: ['Réseaux sociaux', 'Email', 'SMS', 'QR Codes']
                        },
                        {
                          icon: '🔒',
                          title: 'Sécurité & Conformité',
                          description: 'Protection des données et conformité RGPD',
                          features: ['Chiffrement', 'Anonymisation', 'Audit trail']
                        },
                        {
                          icon: '📋',
                          title: 'Rapports Personnalisés',
                          description: 'Générez des rapports adaptés à vos besoins',
                          features: ['Templates pro', 'Export multiple', 'Branding personnalisé']
                        }
                      ].map((tool, index) => (
                        <motion.div
                          key={tool.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl hover:border-indigo-200 transition-all duration-300"
                        >
                          <div className="text-4xl mb-4">{tool.icon}</div>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{tool.title}</h3>
                          <p className="text-gray-600 mb-4">{tool.description}</p>
                          <ul className="space-y-2 mb-6">
                            {tool.features.map((feature, i) => (
                              <li key={i} className="flex items-center text-sm text-gray-600">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <button className="w-full bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-600 py-3 px-4 rounded-xl hover:from-indigo-100 hover:to-blue-100 transition-all duration-300 font-medium">
                            En Savoir Plus
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Pricing Tab */}
                  {activeProTab === 'pricing' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      <div className="text-center">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Choisissez Votre Formule</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                          Des solutions adaptées à tous les budgets et besoins. Tarifs transparents, sans frais cachés.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                          {
                            id: 'basic',
                            name: 'Sondage Express',
                            price: 150000,
                            duration: '48h',
                            features: [
                              'Jusqu\'à 3 questions',
                              '500 répondants minimum',
                              'Rapport de base',
                              'Graphiques simples',
                              'Support email'
                            ]
                          },
                          {
                            id: 'standard',
                            name: 'Sondage Standard',
                            price: 300000,
                            duration: '5 jours',
                            features: [
                              'Jusqu\'à 8 questions',
                              '1000 répondants minimum',
                              'Rapport détaillé',
                              'Analyse démographique',
                              'Graphiques avancés',
                              'Support téléphonique',
                              '1 révision incluse'
                            ],
                            recommended: true
                          },
                          {
                            id: 'premium',
                            name: 'Sondage Premium',
                            price: 500000,
                            duration: '7 jours',
                            features: [
                              'Questions illimitées',
                              '2000+ répondants',
                              'Rapport complet + présentation',
                              'Analyse croisée avancée',
                              'Segmentation détaillée',
                              'Support prioritaire 24/7',
                              'Révisions illimitées',
                              'Consultation stratégique'
                            ]
                          }
                        ].map((pkg, index) => (
                          <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative bg-white rounded-3xl shadow-lg border-2 p-8 ${
                              pkg.recommended 
                                ? 'border-indigo-500 ring-4 ring-indigo-100 scale-105' 
                                : 'border-gray-200 hover:border-indigo-300'
                            } transition-all duration-300`}
                          >
                            {pkg.recommended && (
                              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                                  ⭐ Recommandé
                                </span>
                              </div>
                            )}
                            
                            <div className="text-center mb-8">
                              <h3 className="text-2xl font-bold text-gray-900 mb-3">{pkg.name}</h3>
                              <div className="text-4xl font-bold text-indigo-600 mb-2">
                                {pkg.price.toLocaleString()} FCFA
                              </div>
                              <p className="text-gray-500 font-medium">Livré en {pkg.duration}</p>
                            </div>

                            <ul className="space-y-4 mb-8">
                              {pkg.features.map((feature, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-500 mr-3 mt-1 text-lg">✓</span>
                                  <span className="text-gray-600">{feature}</span>
                                </li>
                              ))}
                            </ul>

                            <button
                              onClick={() => {
                                setSelectedPackage(pkg as any)
                                setActiveProTab('order')
                              }}
                              className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-300 ${
                                pkg.recommended
                                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg'
                                  : 'bg-gray-100 text-gray-900 hover:bg-indigo-50 hover:text-indigo-600'
                              }`}
                            >
                              Choisir cette formule
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Order Tab */}
                  {activeProTab === 'order' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-4xl mx-auto"
                    >
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
                          <span className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-4">
                            <span className="text-xl">🚀</span>
                          </span>
                          Commander Votre Sondage
                        </h2>
                        
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 mb-8">
                          <h3 className="font-bold text-indigo-900 text-lg mb-2">🎯 Processus Simple en 3 Étapes</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="text-center">
                              <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                              <p className="text-sm text-indigo-700">Remplissez le formulaire</p>
                            </div>
                            <div className="text-center">
                              <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                              <p className="text-sm text-indigo-700">Validation sous 24h</p>
                            </div>
                            <div className="text-center">
                              <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                              <p className="text-sm text-indigo-700">Lancement du sondage</p>
                            </div>
                          </div>
                        </div>

                        <div className="text-center py-12">
                          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">📝</span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-3">Formulaire de Commande</h3>
                          <p className="text-gray-600 mb-6">
                            Le formulaire de commande détaillé sera intégré ici avec tous les champs nécessaires.
                          </p>
                          <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300">
                            Commencer la Commande
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
        
        {/* Right Sidebar - Fixed Position */}
        <aside className="hidden lg:block fixed right-0 top-16 w-80 h-screen bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          <YouTubeWidget />
          <UpcomingEvents />
          <YesterdayPollWidget />
          <TrendingWidget articles={[]} />
          <MultiQuestionPollWidget />
        </aside>
      </div>

      {/* Modal de détails du sondage sélectionné */}
      <AnimatePresence>
        {selectedPoll && showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedPoll(null)
              setShowModal(false)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">
                      {selectedPoll.question}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <span className="mr-1">📅</span>
                        {formatDate(selectedPoll.created_at)}
                      </span>
                      <span className="flex items-center">
                        <span className="mr-1">🗳️</span>
                        {selectedPoll.total_votes || 0} participants
                      </span>
                      {getStatusBadge(selectedPoll)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPoll(null)
                      setShowModal(false)
                    }}
                    className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📊</span>
                  Résultats détaillés
                </h3>
                
                {statsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="flex justify-between mb-2">
                          <div className="h-4 bg-gray-200 rounded w-20"></div>
                          <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : pollStats.length > 0 ? (
                  <div className="space-y-4">
                    {pollStats.map((stat, index) => {
                      const getBarColor = () => {
                        if (stat.response_value === 'yes') return 'bg-green-500'
                        if (stat.response_value === 'no') return 'bg-red-500'
                        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500']
                        return colors[index % colors.length]
                      }

                      return (
                        <motion.div
                          key={stat.response_value}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          className="space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">
                              {stat.response_value === 'yes' ? 'Oui' : 
                               stat.response_value === 'no' ? 'Non' : 
                               stat.response_value}
                            </span>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-600">
                                {stat.vote_count} vote{stat.vote_count > 1 ? 's' : ''}
                              </span>
                              <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {Math.round(stat.percentage || 0)}%
                              </span>
                            </div>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <motion.div
                              className={`h-full ${getBarColor()}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${stat.percentage || 0}%` }}
                              transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                            />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">📊</span>
                    </div>
                    <p>Aucun vote enregistré pour ce sondage</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
