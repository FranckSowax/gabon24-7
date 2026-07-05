'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Send, Loader2, CheckCircle2, Lightbulb, Award, RefreshCw,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Msg = { role: 'user' | 'assistant'; content: string }
type GridRow = { critere: string; note: number; commentaire?: string }
type Evaluation = {
  global_score: number
  decision: 'favorable' | 'favorable_avec_reserves' | 'a_retravailler'
  grid: GridRow[]
  points_forts: string[]
  points_faibles: string[]
  recommandations: string[]
}

const INTRO: Msg = {
  role: 'assistant',
  content: "Bonjour, je suis M. Ndong, chargé d'affaires à la BCEG. Je vais examiner votre projet comme lors d'un vrai entretien de financement — c'est un entraînement, soyez naturel.\n\nPour commencer : présentez-moi votre projet en quelques phrases (votre activité, vos clients, et le montant que vous recherchez)."
}

const DECISION_META = {
  favorable: { label: '✅ Avis favorable', cls: 'bg-green-100 text-green-700 border-green-300' },
  favorable_avec_reserves: { label: '🟡 Favorable avec réserves', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  a_retravailler: { label: '🔴 À retravailler', cls: 'bg-red-100 text-red-700 border-red-300' },
} as const

export default function SimulateurBanquierPage() {
  const { user } = useAuth()
  const [project, setProject] = useState({ title: '', sector: '', amount: '' })
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([INTRO])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, evaluation, loading])

  const headers = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }

  const nUserMsgs = messages.filter(m => m.role === 'user').length

  const send = async () => {
    const text = input.trim()
    if (!text || loading || evaluating || evaluation) return
    setError('')
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/formations/banker/chat`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ messages: next, project }),
      })
      const data = await res.json()
      if (data?.success && data.reply) setMessages([...next, { role: 'assistant', content: data.reply }])
      else setError(data?.error || 'Le banquier est indisponible, réessayez.')
    } catch { setError('Erreur réseau — votre message est conservé, réessayez.') } finally { setLoading(false) }
  }

  const finish = async () => {
    if (evaluating || evaluation) return
    setEvaluating(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/formations/banker/evaluate`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ messages, project }),
      })
      const data = await res.json()
      if (data?.success && data.evaluation) setEvaluation(data.evaluation)
      else setError(data?.error || 'Évaluation indisponible, réessayez.')
    } catch { setError('Erreur réseau, réessayez.') } finally { setEvaluating(false) }
  }

  const restart = () => {
    setMessages([INTRO]); setEvaluation(null); setError(''); setInput(''); setStarted(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête */}
      <div className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Formations
          </Link>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl shrink-0">🏦</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">Simulateur d'entretien banquier</h1>
              <p className="text-white/75 text-sm">M. Ndong, chargé d'affaires BCEG, challenge votre projet. Entraînez-vous avant le vrai rendez-vous.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {!user ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-700 font-semibold">Connectez-vous pour passer votre entretien simulé.</p>
            <p className="text-sm text-slate-500 mt-1">L'entretien est gratuit et illimité — c'est votre salle d'entraînement.</p>
            <Link href="/auth/signin?redirectTo=/formations/simulateur"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">
              Se connecter
            </Link>
          </div>
        ) : !started ? (
          /* Fiche projet (optionnelle) avant de commencer */
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900">Votre projet (optionnel, mais le banquier sera plus précis)</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input value={project.title} onChange={e => setProject(p => ({ ...p, title: e.target.value }))}
                placeholder="Projet (ex : poulailler à Oyem)" className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#697357]" />
              <input value={project.sector} onChange={e => setProject(p => ({ ...p, sector: e.target.value }))}
                placeholder="Secteur (ex : agriculture)" className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#697357]" />
              <input value={project.amount} onChange={e => setProject(p => ({ ...p, amount: e.target.value }))}
                placeholder="Montant (ex : 2 000 000)" className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#697357]" />
            </div>
            <button onClick={() => setStarted(true)}
              className="mt-4 w-full py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">
              Commencer l'entretien
            </button>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Conseil : préparez vos chiffres (prix, coûts, CA espéré). Le banquier va les challenger — comme dans la vraie vie.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation */}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#697357] text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                  }`}>
                    {m.role === 'assistant' && <span className="block text-[11px] font-bold text-[#697357] mb-1">🏦 M. Ndong — BCEG</span>}
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-400 inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> M. Ndong réfléchit…
                  </div>
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}

            {/* Évaluation finale */}
            {evaluation && (
              <div className="mt-5 bg-white rounded-2xl border-2 border-[#697357]/30 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-black text-slate-900 text-lg flex items-center gap-2"><Award className="w-5 h-5 text-[#697357]" /> Bilan de l'entretien</h2>
                  <span className={`px-3 py-1.5 rounded-full border text-sm font-bold ${DECISION_META[evaluation.decision]?.cls || DECISION_META.a_retravailler.cls}`}>
                    {DECISION_META[evaluation.decision]?.label || 'Bilan'}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <span className="text-4xl font-black text-[#4d553e]">{evaluation.global_score}<span className="text-lg text-slate-400">/100</span></span>
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${evaluation.global_score >= 70 ? 'bg-green-500' : evaluation.global_score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${evaluation.global_score}%` }} />
                  </div>
                </div>

                {!!evaluation.grid?.length && (
                  <div className="mt-4 space-y-2">
                    {evaluation.grid.map((g, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-sm bg-slate-50 rounded-lg p-2.5">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800">{g.critere}</span>
                          {g.commentaire && <p className="text-xs text-slate-500">{g.commentaire}</p>}
                        </div>
                        <span className="shrink-0 font-black text-[#4d553e]">{g.note}/20</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!!evaluation.points_forts?.length && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1.5">Points forts</h3>
                      <ul className="space-y-1">{evaluation.points_forts.map((s, i) => <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />{s}</li>)}</ul>
                    </div>
                  )}
                  {!!evaluation.points_faibles?.length && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1.5">Points faibles</h3>
                      <ul className="space-y-1">{evaluation.points_faibles.map((s, i) => <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{s}</li>)}</ul>
                    </div>
                  )}
                </div>

                {!!evaluation.recommandations?.length && (
                  <div className="mt-4 bg-[#697357]/5 border border-[#697357]/20 rounded-xl p-3.5">
                    <h3 className="text-sm font-bold text-[#4d553e] mb-1.5">Avant de déposer votre dossier BCEG :</h3>
                    <ul className="space-y-1">{evaluation.recommandations.map((s, i) => <li key={i} className="text-sm text-slate-700">→ {s}</li>)}</ul>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/business/mes-projets" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-bold">
                    Déposer mon dossier BCEG
                  </Link>
                  <button onClick={restart} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100">
                    <RefreshCw className="w-4 h-4" /> Refaire un entretien
                  </button>
                </div>
              </div>
            )}

            {/* Saisie */}
            {!evaluation && (
              <div className="sticky bottom-0 mt-4 bg-slate-50 pb-4 pt-2">
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Votre réponse au banquier…" disabled={loading || evaluating}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#697357] focus:ring-1 focus:ring-[#697357] bg-white" />
                  <button onClick={send} disabled={loading || evaluating || !input.trim()}
                    className="px-4 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white disabled:opacity-50">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                {nUserMsgs >= 3 && (
                  <button onClick={finish} disabled={evaluating}
                    className="mt-2 w-full py-2.5 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-[#3a4030] text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    {evaluating ? <><Loader2 className="w-4 h-4 animate-spin" /> Le comité délibère…</> : <>🏁 Terminer l'entretien — obtenir mon évaluation</>}
                  </button>
                )}
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>
    </div>
  )
}
