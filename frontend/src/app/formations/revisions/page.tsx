'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Loader2, Flame, CheckCircle2, RefreshCw, Trophy } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type ReviewItem = { id: string; module_id: string; question: string; options: string[]; box: number; level: number }
type AnswerResult = { correct: boolean; correctIndex: number; explanation?: string | null; nextInDays: number; mastered?: boolean }

export default function RevisionsPage() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [total, setTotal] = useState(0)
  const [idx, setIdx] = useState(0)
  const [good, setGood] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState(false)
  const [finished, setFinished] = useState(false)
  const [streak, setStreak] = useState<{ current: number } | null>(null)

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setFinished(false); setIdx(0); setGood(0); setChosen(null); setResult(null)
    try {
      const res = await fetch(`${API_URL}/api/formations/reviews/due?limit=10`, { headers: await headers() })
      const data = await res.json()
      if (data?.success) { setItems(data.items || []); setTotal(data.total || 0) }
    } catch { /* affichage vide */ } finally { setLoading(false) }
  }, [headers])

  useEffect(() => { if (user?.id) load() }, [user?.id, load])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/formations/streak`, { headers: await headers() })
        const data = await res.json()
        if (data?.success) setStreak({ current: data.current || 0 })
      } catch { /* noop */ }
    })()
  }, [user?.id, headers, finished])

  const answer = async (oi: number) => {
    if (answering || result) return
    const item = items[idx]
    setAnswering(true); setChosen(oi)
    try {
      const res = await fetch(`${API_URL}/api/formations/reviews/answer`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ review_id: item.id, answer: oi }),
      })
      const data = await res.json()
      if (data?.success) {
        setResult(data as AnswerResult)
        if (data.correct) {
          setGood(g => g + 1)
          import('canvas-confetti').then(({ default: confetti }) =>
            confetti({ particleCount: 40, spread: 55, origin: { y: 0.75 }, colors: ['#697357', '#fbbf24'] })
          ).catch(() => { /* décoratif */ })
        }
      } else setChosen(null)
    } catch { setChosen(null) } finally { setAnswering(false) }
  }

  const next = () => {
    setChosen(null); setResult(null)
    if (idx + 1 >= items.length) setFinished(true)
    else setIdx(idx + 1)
  }

  const item = items[idx]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Formations
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black">🧠 Révisions du jour</h1>
              <p className="text-white/75 text-sm">Vos questions ratées reviennent à J+1, J+3, J+7, J+21 — jusqu'à les maîtriser.</p>
            </div>
            {streak && streak.current > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-amber-300 text-[#3a4030] px-3 py-1.5 rounded-full text-sm font-black">
                <Flame className="w-4 h-4" /> {streak.current} j
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {authLoading || loading ? (
          <p className="text-center text-slate-500 py-16 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Chargement…</p>
        ) : !user ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-700 font-semibold">Connectez-vous pour retrouver vos révisions.</p>
            <Link href="/auth/signin?redirectTo=/formations/revisions"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">Se connecter</Link>
          </div>
        ) : finished || (!items.length && !loading) ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            {items.length ? (
              <>
                <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h2 className="text-xl font-black text-slate-900">Série terminée : {good}/{items.length} 🎉</h2>
                <p className="text-sm text-slate-500 mt-1">Votre série 🔥 continue. Les questions ratées reviendront demain.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h2 className="text-xl font-black text-slate-900">Rien à réviser aujourd'hui !</h2>
                <p className="text-sm text-slate-500 mt-1">Continuez un module pour nourrir votre série 🔥.</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {total > items.length && (
                <button onClick={load} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-bold">
                  <RefreshCw className="w-4 h-4" /> Série suivante ({total - items.length} restantes)
                </button>
              )}
              <Link href="/formations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100">
                Continuer la formation <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : item ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Question {idx + 1}/{items.length} · Niveau {item.level}</span>
              <span>Boîte {item.box}/4</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-[#697357] rounded-full transition-all" style={{ width: `${(idx / items.length) * 100}%` }} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">{item.question}</h2>
            <div className="space-y-2">
              {item.options.map((opt, oi) => {
                let cls = 'border-slate-200 hover:border-[#697357]/50'
                if (result) {
                  if (oi === result.correctIndex) cls = 'border-green-400 bg-green-50'
                  else if (oi === chosen) cls = 'border-red-400 bg-red-50'
                  else cls = 'border-slate-200 opacity-60'
                } else if (oi === chosen) cls = 'border-[#697357] bg-[#697357]/5'
                return (
                  <button key={oi} disabled={!!result || answering} onClick={() => answer(oi)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${cls}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {result && (
              <div className={`mt-4 rounded-xl p-3.5 text-sm ${result.correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                <p className="font-bold">
                  {result.correct
                    ? result.mastered ? '🏆 Correct — question maîtrisée !' : `✅ Correct ! Prochaine révision dans ${result.nextInDays} j.`
                    : '❌ Raté — elle reviendra demain.'}
                </p>
                {result.explanation && <p className="mt-1 text-slate-600">💡 {result.explanation}</p>}
              </div>
            )}
            {result && (
              <button onClick={next} className="mt-4 w-full py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold inline-flex items-center justify-center gap-2">
                {idx + 1 >= items.length ? 'Voir mon résultat' : 'Question suivante'} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
