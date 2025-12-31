'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toaster'
import { Check, Headphones, Megaphone, Music, Newspaper, PlayCircle, Sparkles, Clock, ExternalLink } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ArticleLite {
  id: string
  title: string
  source?: string
  url?: string
  created_at?: string
  summary?: string
  ai_summary?: string
}

interface AudioSummary {
  id: string
  summary_type: 'daily' | 'custom'
  article_ids: string[]
  articles_count: number
  text_summary?: string
  audio_url?: string
  audio_duration_seconds?: number
  whatsapp_sent?: boolean
  status: string
  created_at: string
}

const calcCustomCreditsUnits = (count: number) => {
  const base = 2
  const extra = Math.max(0, count - 5) * 0.5
  return Math.round((base + extra) * 10)
}

export default function AudioSummariesPage() {
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Protection de la page
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signin?redirect=/audio')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [user, subscriptionPlan, authLoading, router])

  if (authLoading || !user || subscriptionPlan?.slug !== 'pro') {
    return <Loading />
  }

  // Articles selection
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [availableArticles, setAvailableArticles] = useState<ArticleLite[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articlesPage, setArticlesPage] = useState(1)
  const [articlesTotalPages, setArticlesTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArticles, setSelectedArticles] = useState<ArticleLite[]>([])

  // Generate
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [progressMsg, setProgressMsg] = useState<string>('Analyse IA en cours…')
  const [activeSummaryId, setActiveSummaryId] = useState<string | null>(null)
  const [voice, setVoice] = useState('af_nicole')
  const [pace, setPace] = useState<'slow'|'normal'|'fast'>('normal')

  // History
  const [history, setHistory] = useState<AudioSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Tick every minute to refresh remaining time displays
  const [tick, setTick] = useState(0)

  const remainingHours = (createdAt: string, t: number) => {
    // 't' is unused logically but ensures re-render each minute
    void t
    const expire = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
    const diff = expire - Date.now()
    const hours = Math.max(0, Math.ceil(diff / (60 * 60 * 1000)))
    return hours
  }

  const customCredits = useMemo(() => calcCustomCreditsUnits(selectedArticles.length), [selectedArticles])

  // fetchWithTimeout to improve mobile reliability
  const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 90000) => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetch(input, { ...(init || {}), signal: controller.signal })
      return resp
    } finally {
      clearTimeout(id)
    }
  }

  const fetchArticles = async (page = 1, q = '') => {
    try {
      setArticlesLoading(true)
      const params = new URLSearchParams()
      params.set('tab', 'all')
      params.set('page', String(page))
      params.set('page_size', '50')
      if (q) params.set('q', q)
      const resp = await fetch(`${API_URL}/api/articles?${params.toString()}`)
      const data = await resp.json()
      if (data?.success) {
        setAvailableArticles(data.articles || [])
        setArticlesTotalPages(Math.max(1, Math.ceil((data.total || 0) / 50)))
      }
    } catch (e) {
      console.error('Erreur chargement articles:', e)
    } finally {
      setArticlesLoading(false)
    }
  }

  const fetchHistory = async () => {
    if (!user?.id) return
    try {
      setHistoryLoading(true)
      const resp = await fetch(`${API_URL}/api/audio/history/${user.id}`)
      const data = await resp.json()
      if (data?.success) setHistory(data.summaries || [])
    } catch (e) {
      console.error('Erreur chargement historique:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Realtime updates on audio_summaries for current user
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`audio_summaries_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_summaries', filter: `user_id=eq.${user.id}` }, () => { fetchHistory() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Minute ticker for UI timers (remaining availability)
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (articleModalOpen) fetchArticles(articlesPage, searchTerm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleModalOpen, articlesPage])

  useEffect(() => {
    if (!articleModalOpen) return
    const t = setTimeout(() => {
      setArticlesPage(1)
      fetchArticles(1, searchTerm)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, articleModalOpen])

  // Close overlay when the active summary reaches completed/failed; update progress message per status
  useEffect(() => {
    if (!activeSummaryId) return
    const item = history.find(h => h.id === activeSummaryId)
    if (!item) return
    // Map status to message
    const statusText: Record<string, string> = {
      processing: 'Préparation du journal…',
      synthesizing_audio: 'Synthèse vocale en cours…',
      uploading_audio: 'Téléversement de l’audio…',
      sending_whatsapp: 'Envoi WhatsApp…',
      finalizing: 'Finalisation…',
      completed: 'Terminé ✓',
      failed: 'Échec'
    }
    setProgressMsg(statusText[item.status] || 'Analyse IA en cours…')
    if (item.status === 'completed') {
      setSubmitting(false)
      addToast({ kind: 'success', message: 'Résumé audio prêt' })
      setActiveSummaryId(null)
    }
    if (item.status === 'failed') {
      setSubmitting(false)
      addToast({ kind: 'error', message: 'La génération a échoué' })
      setActiveSummaryId(null)
    }
  }, [history, activeSummaryId, addToast])

  const toggleSelect = (a: ArticleLite) => {
    setSelectedArticles(prev => {
      const exists = prev.some(p => p.id === a.id)
      if (exists) return prev.filter(p => p.id !== a.id)
      if (prev.length >= 5) {
        alert('Vous pouvez sélectionner au maximum 5 articles.')
        return prev
      }
      return [...prev, a]
    })
  }

  const generateDaily = async () => {
    if (!user?.id) { alert('Connexion requise'); return }
    setSubmitting(true)
    setStatusMsg('Génération du résumé quotidien…')
    try {
      const resp = await fetch(`${API_URL}/api/audio/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'daily', userId: user.id, optimize: true, sendWhatsApp: true, voice, pace })
      })
      const json = await resp.json()
      if (!json.success) {
        if (json.needsTopUp) alert(`Crédits insuffisants. Requis: ${json.requiredCredits}. Solde: ${json.balance ?? 0}`)
        else alert(json.error || 'Échec génération')
        return
      }
      setStatusMsg('Résumé quotidien généré ✓')
      fetchHistory()
    } catch (e) {
      alert('Erreur réseau')
    } finally {
      setSubmitting(false)
      setTimeout(() => setStatusMsg(null), 2500)
    }
  }

  const generateCustom = async () => {
    if (!user?.id) { alert('Connexion requise'); return }
    if (selectedArticles.length === 0) { alert('Sélectionnez au moins un article'); return }
    setSubmitting(true)
    setStatusMsg(`Génération du résumé audio personnalisé…`)
    try {
      const resp = await fetch(`${API_URL}/api/audio/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'custom', userId: user.id, articleIds: selectedArticles.map(a => a.id), optimize: true, sendWhatsApp: true, voice, pace })
      })
      const json = await resp.json()
      if (!json.success) {
        if (json.needsTopUp) alert(`Crédits insuffisants. Requis: ${json.requiredCredits}. Solde: ${json.balance ?? 0}`)
        else alert(json.error || 'Échec génération')
        return
      }
      setStatusMsg('Résumé audio généré ✓')
      setSelectedArticles([])
      fetchHistory()
    } catch (e) {
      alert('Erreur réseau')
    } finally {
      setSubmitting(false)
      setTimeout(() => setStatusMsg(null), 2500)
    }
  } 

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 lg:ml-64">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-blue-200 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Headphones className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 font-medium">Résumés audio d'actualités</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Choisissez un mode</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link href="/audio/daily" className="group block bg-white/90 border border-blue-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Résumé quotidien</h2>
                <p className="text-gray-600">Script court 75–95s, 2–3 actus politiques prioritaires. Versions FR/EN/ZH.</p>
              </Link>

              <Link href="/audio/custom" className="group block bg-white/90 border border-blue-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Résumé personnalisé</h2>
                <p className="text-gray-600">Sélectionnez jusqu’à 5 articles, versions FR/EN/ZH.</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
      <ScrollToTop />
    </div>
  )
}
