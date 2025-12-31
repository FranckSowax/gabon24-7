'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import TopUpModal from '@/components/credits/TopUpModal'
import Sidebar from '@/components/layout/Sidebar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { Loading } from '@/components/ui/Loading'
import { Check, ChevronRight, Layers, ListChecks, Newspaper, Sparkles, Wand2, ExternalLink, Save, Mail, Share2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import HowItWorksSlider from '@/components/common/HowItWorksSlider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Services disponibles (alignés avec la fonction Netlify actu-plus.js)
const SERVICES: { key: string; label: string; description: string; credits: number; icon: any }[] = [
  {
    key: 'resume_journalistique',
    label: 'Résumé journalistique',
    description: 'Résumé prêt à publier en 2–4 paragraphes (≤300 mots). Neutralité et attribution sobre des sources.',
    credits: 2,
    icon: Newspaper
  },
  {
    key: 'synthese_recherche',
    label: 'Synthèse de recherche',
    description: 'Synthèse structurée ≤600 mots: Contexte, Faits, Divergences, Enjeux, Bibliographie (sources fournies).',
    credits: 3,
    icon: Layers
  },
  {
    key: 'fiche_actualites',
    label: "Fiche d'actualités",
    description: "Fiche en 6 sections: Contexte, Faits (puces), Chronologie, Acteurs, Impacts, À suivre.",
    credits: 3,
    icon: ListChecks
  }
]
;

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

interface ArticleLite {
  id: string
  title: string
  source?: string
  url?: string
  created_at?: string
  imageUrl?: string
}

export default function ActuPlusPage() {
  const { user, subscriptionPlan, loading } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [step, setStep] = useState<'intro' | 'compose' | 'result'>('intro')

  // Protection de la page
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/signin?redirect=/actu-plus')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [user, subscriptionPlan, loading, router])

  // Afficher un loader pendant la vérification
  if (loading || !user || subscriptionPlan?.slug !== 'pro') {
    return <Loading />
  }

  // Sélection service et options
  const [serviceKey, setServiceKey] = useState('resume_journalistique')
  const selectedService = useMemo(() => SERVICES.find(s => s.key === serviceKey) || SERVICES[0], [serviceKey])
  const [usePerplexity, setUsePerplexity] = useState(false)
  const [context, setContext] = useState('')
  const [tone, setTone] = useState('')
  // Ton & Style (multi-sélection)
  const [toneList, setToneList] = useState<string[]>([])
  const toneOptions = [
    'Neutre et factuel',
    'Pédagogique',
    'Institutionnel',
    'Percutant et engageant',
    'Analytique',
    'Narratif',
    'Formel',
    'Informel',
  ]

  // Sélection des articles
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [availableArticles, setAvailableArticles] = useState<ArticleLite[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articlesPage, setArticlesPage] = useState(1)
  const [articlesTotalPages, setArticlesTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArticles, setSelectedArticles] = useState<ArticleLite[]>([])

  // Résultat
  const [submitting, setSubmitting] = useState(false)
  const [resultText, setResultText] = useState('')
  const [resultRelated, setResultRelated] = useState<ArticleLite[]>([])
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [topUpOpen, setTopUpOpen] = useState(false)
  
  // Champs spécifiques par service
  // Résumé journalistique
  const [resumeLength, setResumeLength] = useState<'200'|'300'|'400'>('300')
  const [includeQuotes, setIncludeQuotes] = useState<boolean>(false)
  // Synthèse de recherche
  const [synthSections, setSynthSections] = useState<string[]>(['Contexte','Faits','Divergences','Enjeux','Bibliographie'])
  const synthAllSections = ['Contexte','Faits','Divergences','Enjeux','Bibliographie']
  const [biblioStyle, setBiblioStyle] = useState<'APA'|'MLA'|'Chicago'|'Aucun'>('APA')
  // Fiche d'actualités
  const [bulletsDepth, setBulletsDepth] = useState<'Basique'|'Détaillée'>('Basique')
  const [includeTimeline, setIncludeTimeline] = useState<boolean>(true)
  const [highlightActors, setHighlightActors] = useState<boolean>(true)

  // Flow mobile (1: service -> 2: articles -> 3: personnalisation)
  const [composeMobileStep, setComposeMobileStep] = useState<1|2|3>(1)

  // Charger la liste d'articles pour sélection (via supabase-articles, tab=all)
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

  useEffect(() => {
    if (articleModalOpen) {
      fetchArticles(articlesPage, searchTerm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleModalOpen, articlesPage])

  // Recherche dynamique (debounce)
  useEffect(() => {
    if (!articleModalOpen) return
    const t = setTimeout(() => {
      setArticlesPage(1)
      fetchArticles(1, searchTerm)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, articleModalOpen])

  // Gestion sélection toggle
  const toggleSelect = (a: ArticleLite) => {
    setSelectedArticles((prev) => {
      const exists = prev.some(p => p.id === a.id)
      if (exists) return prev.filter(p => p.id !== a.id)
      return [...prev, a]
    })
  }

  const submitActuPlus = async () => {
    setErrorMsg(null)
    if (selectedArticles.length === 0) {
      setErrorMsg('Veuillez sélectionner au moins un article à traiter.')
      return
    }
    try {
      setSubmitting(true)
      const body = {
        userId: user?.id || null,
        serviceType: serviceKey,
        articleIds: selectedArticles.map(a => a.id),
        context,
        tone: toneList.length ? toneList.join(', ') : tone,
        options: {
          toneList,
          resume: { length: resumeLength, includeQuotes },
          synthese: { sections: synthSections, biblioStyle },
          fiche: { bulletsDepth, includeTimeline, highlightActors },
        },
        usePerplexity: false
      }
      const resp = await fetch(`${API_URL}/api/actu-plus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await resp.json()
      if (!json.success) {
        if (json.needsTopUp) {
          setErrorMsg(`Crédits insuffisants. Crédits requis: ${json.requiredCredits}. Solde: ${json.balance || 0}.`)
          setTopUpOpen(true)
        } else {
          setErrorMsg(json.error || 'Erreur lors du traitement')
        }
        return
      }
      setReferenceId(json.referenceId || null)
      setResultText(json.result?.text || '')
      setResultRelated(json.result?.related || [])
      setStep('result')
    } catch (e) {
      setErrorMsg('Erreur réseau lors du traitement Actu++')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <div className="flex">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Intro */}
            {step === 'intro' && (
              <section>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl mb-6 shadow-lg">
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-4">
                    Actu++
                  </h1>
                  <p className="text-base sm:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
                    Transformez vos articles en livrables professionnels grâce à l'intelligence artificielle
                  </p>
                </div>

                {/* Comment ça marche ? */}
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">Comment ça marche ?</h2>
                  <HowItWorksSlider
                    className="max-w-4xl mx-auto"
                    steps={[
                      { title: 'Sélectionnez vos articles', desc: 'Choisissez 1 à 5 articles pertinents.', Icon: Newspaper, gradient: 'from-orange-400 to-red-500' },
                      { title: 'Choisissez un service', desc: 'Résumé, Synthèse ou Fiche.', Icon: Layers, gradient: 'from-orange-500 to-orange-600' },
                      { title: 'Personnalisez et lancez', desc: 'Ajoutez un contexte et un ton, puis démarrez.', Icon: Wand2, gradient: 'from-orange-600 to-orange-700' },
                    ]}
                  />
                </div>

                {/* Services en cartes carrées */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  {SERVICES.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setServiceKey(s.key)}
                      className={`group rounded-2xl border ${serviceKey === s.key ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-200'} bg-white shadow hover:shadow-xl transition-all duration-300 p-0 overflow-hidden`}
                    >
                      <div className="h-36 sm:h-40 flex flex-col items-center justify-center text-center p-5">
                        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow mb-3">
                          <s.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="font-semibold text-gray-900">{s.label}</div>
                        <div className="text-xs text-gray-600 mt-1">{s.credits * 10} crédit{s.credits * 10 > 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-center">
                  <button 
                    onClick={() => setStep('compose')} 
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-base sm:text-lg font-semibold"
                  >
                    <Wand2 className="w-6 h-6" />
                    Commencer maintenant
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {errorMsg && (
                    <div className="mt-3">
                      <button onClick={() => setTopUpOpen(true)} className="text-sm font-semibold text-orange-700 hover:text-orange-800 underline">
                        Recharger mes crédits
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Compose */}
            {step === 'compose' && (
              <section>
                {/* Header moderne */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-orange-200 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 font-medium">Configuration de votre livrable</span>
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">
                    Personnalisez votre analyse
                  </h2>
                </div>

                {/* Indicateur d'étapes (mobile) */}
                <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
                  {[1,2,3].map(i => (
                    <span key={i} className={`h-2 rounded-full transition-all ${composeMobileStep===i ? 'w-6 bg-orange-600' : 'w-2 bg-orange-300'}`} />
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Colonne services */}
                <div className={`lg:col-span-1 ${composeMobileStep === 1 ? '' : 'hidden lg:block'}`}>
                  <div className="bg-white/90 sm:backdrop-blur-sm border border-orange-200 rounded-3xl p-4 sm:p-5 lg:p-6 shadow-lg sm:shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <Layers className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Services disponibles</h3>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {SERVICES.map(s => (
                        <label key={s.key} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg ${serviceKey === s.key ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-orange-100 shadow-lg' : 'border-gray-200 hover:border-orange-300 bg-white'}`}>
                          <input type="radio" name="service" className="mt-1.5 text-orange-600 focus:ring-orange-500" checked={serviceKey === s.key} onChange={() => setServiceKey(s.key)} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <s.icon className="w-5 h-5 text-orange-600" />
                                <span className="font-semibold text-gray-900">{s.label}</span>
                              </div>
                              <span className="text-xs font-semibold text-orange-700 bg-orange-200 px-2.5 py-1 rounded-full">{s.credits * 10} crédit{s.credits * 10 > 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2 leading-relaxed">{s.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {/* Navigation mobile: étape suivante */}
                    <div className="mt-4 flex lg:hidden justify-end">
                      <button onClick={() => setComposeMobileStep(2)} className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700">Continuer</button>
                    </div>
                  </div>
                </div>

                {/* Colonne sélection articles + personnalisation */}
                <div className="lg:col-span-2 space-y-5 sm:space-y-6">
                  {/* Articles en premier */}
                  <div className={`bg-white/90 sm:backdrop-blur-sm border border-orange-200 rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl ${composeMobileStep === 2 ? '' : 'hidden lg:block'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                          <Newspaper className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Articles à analyser</h3>
                      </div>
                      <button 
                        onClick={() => { setArticleModalOpen(true); setArticlesPage(1); }} 
                        className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        + Sélectionner
                      </button>
                    </div>
                    {selectedArticles.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Newspaper className="w-8 h-8 text-orange-500" />
                        </div>
                        <p className="text-gray-500 font-medium">Aucun article sélectionné</p>
                        <p className="text-sm text-gray-400 mt-1">Cliquez sur \"Sélectionner\" pour choisir vos articles</p>
                      </div>
                    ) : (
                      <ul className="space-y-2.5 sm:space-y-3">
                        {selectedArticles.map(a => (
                          <li key={a.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-shadow">
                            <div>
                              <p className="font-semibold text-gray-900 leading-tight">{a.title}</p>
                              <p className="text-sm text-orange-600 font-medium mt-1">{a.source}</p>
                            </div>
                            <button 
                              className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors" 
                              onClick={() => toggleSelect(a)}
                            >
                              Retirer
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {errorMsg && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
                      </div>
                    )}
                  </div>
                  {/* Personnalisation ensuite */}
                  <div className={`bg-white/90 sm:backdrop-blur-sm border border-orange-200 rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl ${composeMobileStep === 3 ? '' : 'hidden lg:block'}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <Wand2 className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Personnalisation</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Contexte spécifique</label>
                        <textarea 
                          value={context} 
                          onChange={(e) => setContext(e.target.value)} 
                          className="w-full border border-orange-200 rounded-xl p-4 min-h-[120px] focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none" 
                          placeholder="Ex: Analyse pour investisseurs, rapport gouvernemental, briefing équipe..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ton & Style</label>
                        <div className="grid grid-cols-2 gap-2">
                          {toneOptions.map(opt => {
                            const checked = toneList.includes(opt)
                            return (
                              <label key={opt} className={`flex items-center gap-2 p-2 rounded-lg border ${checked ? 'border-orange-500 bg-orange-50' : 'border-orange-200'}`}>
                                <input type="checkbox" checked={checked} onChange={() => setToneList(prev => checked ? prev.filter(x => x!==opt) : [...prev, opt])} />
                                <span className="text-sm text-gray-700">{opt}</span>
                              </label>
                            )
                          })}
                        </div>
                        <input 
                          value={tone}
                          onChange={(e)=> setTone(e.target.value)}
                          placeholder="Complément (optionnel)"
                          className="mt-2 w-full border border-orange-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Champs spécifiques par service */}
                    <div className="mt-6 space-y-4">
                      {serviceKey === 'resume_journalistique' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Longueur du résumé</label>
                            <select value={resumeLength} onChange={(e)=> setResumeLength(e.target.value as any)} className="w-full border border-orange-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                              <option value="200">≈ 200 mots</option>
                              <option value="300">≈ 300 mots</option>
                              <option value="400">≈ 400 mots</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 flex items-center gap-3 mt-2 md:mt-7">
                            <input id="includeQuotes" type="checkbox" checked={includeQuotes} onChange={(e)=> setIncludeQuotes(e.target.checked)} />
                            <label htmlFor="includeQuotes" className="text-sm text-gray-700">Inclure des citations directes si pertinentes</label>
                          </div>
                        </div>
                      )}

                      {serviceKey === 'synthese_recherche' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Sections à inclure</label>
                            <div className="grid grid-cols-2 gap-2">
                              {synthAllSections.map(sec => {
                                const checked = synthSections.includes(sec)
                                return (
                                  <label key={sec} className={`flex items-center gap-2 p-2 rounded-lg border ${checked ? 'border-orange-500 bg-orange-50' : 'border-orange-200'}`}>
                                    <input type="checkbox" checked={checked} onChange={() => setSynthSections(prev => checked ? prev.filter(x => x!==sec) : [...prev, sec])} />
                                    <span className="text-sm text-gray-700">{sec}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Style bibliographique</label>
                            <select value={biblioStyle} onChange={(e)=> setBiblioStyle(e.target.value as any)} className="w-full border border-orange-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                              <option value="APA">APA</option>
                              <option value="MLA">MLA</option>
                              <option value="Chicago">Chicago</option>
                              <option value="Aucun">Aucun</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {serviceKey === 'fiche_actualites' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Niveau de détail (puces)</label>
                            <select value={bulletsDepth} onChange={(e)=> setBulletsDepth(e.target.value as any)} className="w-full border border-orange-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                              <option value="Basique">Basique</option>
                              <option value="Détaillée">Détaillée</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-3 mt-2 md:mt-7">
                            <input id="includeTimeline" type="checkbox" checked={includeTimeline} onChange={(e)=> setIncludeTimeline(e.target.checked)} />
                            <label htmlFor="includeTimeline" className="text-sm text-gray-700">Inclure une chronologie</label>
                          </div>
                          <div className="flex items-center gap-3 mt-2 md:mt-7">
                            <input id="highlightActors" type="checkbox" checked={highlightActors} onChange={(e)=> setHighlightActors(e.target.checked)} />
                            <label htmlFor="highlightActors" className="text-sm text-gray-700">Mettre en avant les acteurs</label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA final (unique) */}
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-0 items-stretch sm:items-center justify-between">
                      <div className="text-xs sm:text-sm text-gray-600">
                        <span className="font-semibold">Coût total: </span>
                        <span className="text-orange-700 font-semibold text-base">
                          {selectedService.credits * 10} crédit{(selectedService.credits * 10) > 1 ? 's' : ''}
                        </span>
                      </div>
                      <button 
                        disabled={submitting || selectedArticles.length === 0} 
                        onClick={submitActuPlus} 
                        className={`inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-semibold text-base sm:text-lg transition-all duration-200 ${
                          submitting || selectedArticles.length === 0 
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-xl hover:shadow-2xl transform hover:scale-105'
                        }`}
                      >
                        {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        <Sparkles className="w-5 h-5" />
                        {submitting ? 'Traitement en cours...' : 'Lancer l\'analyse'}
                      </button>
                    </div>

                    {/* Navigation mobile */}
                    <div className="mt-4 flex lg:hidden justify-between">
                      <button onClick={() => setComposeMobileStep(2)} className="px-4 py-2 rounded-xl border">Retour</button>
                    </div>
                  </div>
                </div>
                </div>
              </section>
            )}

            {/* Résultat */}
            {step === 'result' && (
              <section>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-orange-200 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 font-medium">Analyse terminée avec succès</span>
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent mb-2">
                    Votre livrable est prêt
                  </h2>
                  {referenceId && <p className="text-gray-500 text-sm mb-4">Référence: {referenceId}</p>}
                  <button onClick={() => setStep('compose')} className="text-sm text-orange-600 hover:text-orange-800 font-medium hover:underline">← Modifier les paramètres</button>

                  {/* Actions: Enregistrer, Partager */}
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
                    <button
                      onClick={async () => {
                        if (!user?.id) {
                          alert("Connexion requise.")
                          return
                        }
                        const title = window.prompt('Titre du document', 'Livrable Actu++') || 'Livrable Actu++'
                        try {
                          const resp = await fetch(`${API_URL}/api/actu-plus/save`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, title, content: resultText || '', referenceId, service: 'actu_plus' })
                          })
                          const json = await resp.json()
                          if (json.success) {
                            alert('Enregistré dans Mes Projets')
                          } else {
                            alert(json.error || 'Erreur lors de l\'enregistrement')
                          }
                        } catch (e) {
                          alert('Erreur réseau lors de l\'enregistrement')
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:px-4 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow text-sm sm:text-base">
                      <Save className="w-4 h-4" />
                      Enregistrer dans Mes Projets
                    </button>
                    <button
                      onClick={() => {
                        const text = resultText || ''
                        const share = `Actu++ — ${selectedService.label}\n\n${text.slice(0, 800)}${text.length > 800 ? '…' : ''}`
                        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(share)}`
                        window.open(url, '_blank')
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:px-4 sm:py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow text-sm sm:text-base"
                    >
                      <Share2 className="w-4 h-4" />
                      Partager WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        const text = resultText || ''
                        const subject = `Actu++ — ${selectedService.label}`
                        const body = `${text}`
                        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:px-4 sm:py-2 rounded-xl bg-gray-900 hover:bg-black text-white shadow text-sm sm:text-base"
                    >
                      <Mail className="w-4 h-4" />
                      Partager par Email
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                  <div className="lg:col-span-2">
                    <div className="bg-white/90 sm:backdrop-blur-sm border border-orange-200 rounded-3xl p-5 sm:p-6 lg:p-8 shadow-lg sm:shadow-xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Votre livrable</h3>
                      </div>
                      {resultText ? (
                        <div className="prose prose-sm xs:prose-base sm:prose-lg max-w-none">
                          <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 border border-gray-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {resultText}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <Loading />
                      )}
                    </div>
                  </div>
                  <aside>
                    <div className="bg-white/90 sm:backdrop-blur-sm border border-orange-200 rounded-3xl p-4 sm:p-6 shadow-lg sm:shadow-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="font-bold text-gray-900">Articles liés</h4>
                      </div>
                      {resultRelated.length === 0 ? (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Layers className="w-6 h-6 text-orange-500" />
                          </div>
                          <p className="text-gray-500 text-sm font-medium">Aucune suggestion disponible</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {resultRelated.map(r => (
                            <li key={r.id} className="p-3 bg-orange-50 rounded-xl border border-orange-200 hover:shadow-md transition-shadow">
                              <a className="text-orange-700 hover:text-orange-900 font-medium hover:underline block" href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                              <span className="text-gray-600 text-sm mt-1 block">{r.source}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </aside>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} onPurchased={() => setErrorMsg(null)} />

      {/* Modal sélection d'articles */}
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
                        {/* Thumbnail */}
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
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white">📰</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-2">{a.title}</p>
                              <p className="text-sm text-gray-500">{a.source}</p>
                            </div>
                            {a.url && (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 text-orange-600 hover:text-orange-800 p-1 rounded-lg hover:bg-orange-50"
                                title="Ouvrir l'article"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {availableArticles.length === 0 && (
                <p className="p-4 text-gray-500">Aucun article trouvé.</p>
              )}

              {articlesTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <button disabled={articlesPage === 1} onClick={() => setArticlesPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 disabled:opacity-50">Précédent</button>
                  <span className="text-sm text-gray-600">Page {articlesPage} / {articlesTotalPages}</span>
                  <button disabled={articlesPage === articlesTotalPages} onClick={() => setArticlesPage(p => Math.min(articlesTotalPages, p + 1))} className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 disabled:opacity-50">Suivant</button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setArticleModalOpen(false)} className="px-4 py-2 rounded-lg border">Annuler</button>
                <button onClick={() => { setArticleModalOpen(false); setComposeMobileStep(3); }} className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">Valider la sélection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
