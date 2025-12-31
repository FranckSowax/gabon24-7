'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { Loading } from '@/components/ui/Loading'
import { useToast } from '@/components/ui/Toaster'
import { ExternalLink, Headphones, Music, Newspaper, PlayCircle, Sparkles } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ArticleLite {
  id: string
  title: string
  source?: string
  url?: string
  created_at?: string
  summary?: string
  ai_summary?: string
  imageUrl?: string
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

export default function AudioCustomPage() {
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Protection de la page
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signin?redirect=/audio/custom')
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
  const [language, setLanguage] = useState<'fr'|'en'|'zh'>('fr')
  const [pace, setPace] = useState<'slow'|'normal'|'fast'>('normal')

  // History
  const [history, setHistory] = useState<AudioSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tick, setTick] = useState(0) // refresh timers

  const remainingHours = (createdAt: string, t: number) => {
    void t
    const expire = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
    const diff = expire - Date.now()
    const hours = Math.max(0, Math.ceil(diff / (60 * 60 * 1000)))
    return hours
  }

  // Image proxy helpers (align with ArticleCard.tsx)
  const shouldProxyImage = (url?: string) => {
    if (!url) return false
    if (url.startsWith(`${API_URL}/api/image-proxy`)) return false
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon-insight.netlify.app')
      const host = u.hostname
      const domainsNeedingProxy = [
        'gabonclic.info','gabonmediatime.com','fbcdn.net','facebook.com','scontent',
        'union.sonapresse.com','gabonreview.com','infosgabon.com','directinfosgabon.com','g9infos.com',
        'leconfidentiel.ga','echosdeleco.com','alibreville.com','lenouveaugabon.com','gaboneco.com',
        'depeches241.com','courrierdesjournalistes.net','focusgroupemedia.com','gabonmailinfos.com'
      ]
      const isSameOrigin = typeof window !== 'undefined' && host === window.location.hostname
      if (isSameOrigin) return false
      return domainsNeedingProxy.some(d => host.includes(d))
    } catch {
      return false
    }
  }
  const getProxiedImage = (url?: string, title?: string): string | undefined => {
    if (!url) return undefined
    return shouldProxyImage(url) ? `${API_URL}/api/image-proxy?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || '')}` : url
  }

  const calcCustomCreditsUnits = (count: number) => {
    // Base: 20 crédits pour 1-5 articles
    // Extra: +5 crédits par article supplémentaire (max 10 articles)
    const base = 20
    const extra = Math.max(0, count - 5) * 5
    return base + extra
  }

  const customCredits = useMemo(() => calcCustomCreditsUnits(selectedArticles.length), [selectedArticles])

  // fetchWithTimeout
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
    } catch {
      /* ignore */
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
      if (data?.success) {
        const onlyCustom = (data.summaries || []).filter((s: AudioSummary) => s.summary_type === 'custom')
        setHistory(onlyCustom)
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // realtime
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`audio_summaries_custom_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_summaries', filter: `user_id=eq.${user.id}` }, () => fetchHistory())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // minute ticker
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!articleModalOpen) return
    const t = setTimeout(() => {
      setArticlesPage(1)
      fetchArticles(1, searchTerm)
    }, 350)
    return () => clearTimeout(t)
  }, [articleModalOpen, searchTerm])

  // bind overlay when active
  useEffect(() => {
    if (!activeSummaryId) return
    const item = history.find(h => h.id === activeSummaryId)
    if (!item) return
    const statusText: Record<string, string> = {
      processing: 'Préparation du résumé…',
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
      if (prev.length >= 10) {
        addToast({ kind: 'error', message: 'Vous pouvez sélectionner au maximum 10 articles.' })
        return prev
      }
      return [...prev, a]
    })
  }

  const generateCustom = async () => {
    if (!user?.id) { addToast({ kind: 'error', message: 'Connexion requise' }); return }
    if (selectedArticles.length === 0) { addToast({ kind: 'error', message: 'Sélectionnez au moins un article' }); return }
    setSubmitting(true)
    setProgressMsg('Analyse des articles…')
    setStatusMsg('Génération du résumé audio personnalisé…')
    try {
      const languages = [language, ...(['fr','en','zh'] as const).filter(l => l !== language)]
      const resp = await fetchWithTimeout(`${API_URL}/api/audio/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'custom', userId: user.id, articleIds: selectedArticles.map(a => a.id), optimize: true, sendWhatsApp: true, language, languages, pace })
      }, 90000)
      const json = await resp.json()
      if (!json.success) {
        if (json.needsTopUp) addToast({ kind: 'error', title: 'Crédits insuffisants', message: `Requis: ${json.requiredCredits}. Solde: ${json.balance ?? 0}` })
        else addToast({ kind: 'error', message: json.error || 'Échec génération' })
        setSubmitting(false)
        return
      }
      setActiveSummaryId(json.summaryId as string)
      setStatusMsg('Résumé audio généré ✓')
      setSelectedArticles([])
      fetchHistory()
    } catch (e) {
      addToast({ kind: 'error', message: 'Erreur réseau' })
      setSubmitting(false)
    } finally {
      setTimeout(() => setStatusMsg(null), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 pb-24">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 lg:ml-64">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-blue-200 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Headphones className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 font-medium">Résumé personnalisé</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Sélection d'articles</h1>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:gap-8">
              <div className="space-y-6">
                <div className="bg-white/90 border border-blue-200 rounded-3xl p-6 sm:p-7 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <Music className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">Articles (max 10)</h2>
                    </div>
                    <button type="button" onClick={() => { setArticleModalOpen(true); setArticlesPage(1) }} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-xl font-medium shadow min-h-[40px]">
                      + Sélectionner
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Langue</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=> setLanguage('fr')} className={`flex-1 px-3 py-2 rounded-xl border ${language==='fr' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200 bg-white text-gray-700'}`}>🇫🇷 Français</button>
                        <button type="button" onClick={()=> setLanguage('en')} className={`flex-1 px-3 py-2 rounded-xl border ${language==='en' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200 bg-white text-gray-700'}`}>🇺🇸 Anglais</button>
                        <button type="button" onClick={()=> setLanguage('zh')} className={`flex-1 px-3 py-2 rounded-xl border ${language==='zh' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-blue-200 bg-white text-gray-700'}`}>🇨🇳 Chinois</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Vitesse</label>
                      <select value={pace} onChange={(e)=> setPace(e.target.value as any)} className="w-full border border-blue-200 rounded-xl p-2.5">
                        <option value="slow">Lent</option>
                        <option value="normal">Normal</option>
                        <option value="fast">Rapide</option>
                      </select>
                    </div>
                  </div>

                  {selectedArticles.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Newspaper className="w-8 h-8 text-blue-500" />
                      </div>
                      <p className="text-gray-500 font-medium">Aucun article sélectionné</p>
                      <p className="text-sm text-gray-400 mt-1">Cliquez sur "Sélectionner" pour choisir vos articles</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedArticles.map(a => (
                        <li key={a.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{a.title}</p>
                            <p className="text-sm text-blue-600 font-medium mt-1">{a.source}</p>
                          </div>
                          <button className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-lg hover:bg-red-50" onClick={() => setSelectedArticles(prev => prev.filter(p => p.id !== a.id))}>Retirer</button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div className="text-sm text-gray-600">Coût estimé: <span className="font-semibold text-blue-700">{customCredits} crédits</span></div>
                    <button type="button" disabled={submitting || selectedArticles.length === 0 || !user?.id} onClick={generateCustom} className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold min-h-[44px] w-full sm:w-auto justify-center ${submitting || selectedArticles.length === 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow'}`}>
                      <Sparkles className="w-5 h-5" />
                      Générer résumé audio
                    </button>
                  </div>
                </div>

                {statusMsg && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">{statusMsg}</div>
                )}
              </div>

              {/* Historique centré sous le widget */}
              <div className="bg-white/90 border border-blue-200 rounded-3xl p-6 sm:p-7 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <PlayCircle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Historique</h2>
                </div>
                {historyLoading ? (
                  <Loading />
                ) : history.length === 0 ? (
                  <p className="text-gray-500">Aucun résumé audio pour le moment.</p>
                ) : (
                  <ul className="space-y-3">
                    {history.map(h => (
                      <li key={h.id} className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">Personnalisé</span>
                            <span className="ml-2 text-gray-500">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${h.status === 'completed' ? 'bg-green-100 text-green-700' : h.status === 'processing' ? 'bg-yellow-100 text-yellow-700' : h.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                              {h.status}
                            </span>
                            {h.audio_url && (
                              <a href={h.audio_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:text-blue-900 text-sm inline-flex items-center gap-1">
                                Ouvrir <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                        {h.audio_url && (
                          <audio className="mt-2 w-full" controls src={h.audio_url} />
                        )}
                        {typeof h.audio_duration_seconds === 'number' && (
                          <div className="text-xs text-gray-600 mt-1">Durée: ~{h.audio_duration_seconds}s</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1 text-right">Disponible : {remainingHours(h.created_at, tick)} heures</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Article selection modal */}
      {articleModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Sélectionner des articles</h3>
              <button onClick={() => setArticleModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchArticles(1, searchTerm) }} placeholder="Rechercher..." className="flex-1 border rounded-lg px-3 py-2" />
              </div>

              {articlesLoading ? (
                <Loading />
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y">
                  {availableArticles.map(a => {
                    const checked = selectedArticles.some(s => s.id === a.id)
                    const thumb = getProxiedImage(a.imageUrl, a.title)
                    return (
                      <label key={a.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(a)} className="mt-1" />
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={a.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">📰</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-2">{a.title}</p>
                              <p className="text-sm text-gray-500">{a.source}</p>
                            </div>
                            {a.url && (
                              <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50" title="Ouvrir l'article">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                  {availableArticles.length === 0 && (
                    <p className="p-4 text-gray-500">Aucun article trouvé.</p>
                  )}
                </div>
              )}

              {articlesTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <button disabled={articlesPage === 1} onClick={() => setArticlesPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 disabled:opacity-50">Précédent</button>
                  <span className="text-sm text-gray-600">Page {articlesPage} / {articlesTotalPages}</span>
                  <button disabled={articlesPage === articlesTotalPages} onClick={() => setArticlesPage(p => Math.min(articlesTotalPages, p + 1))} className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 disabled:opacity-50">Suivant</button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setArticleModalOpen(false)} className="px-4 py-2 rounded-lg border">Fermer</button>
                <button onClick={() => setArticleModalOpen(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Valider la sélection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="font-semibold text-gray-900">{progressMsg}</p>
            <p className="text-sm text-gray-500 mt-1">Veuillez patienter, cela peut prendre jusqu'à une minute…</p>
            <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
