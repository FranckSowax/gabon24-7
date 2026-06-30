'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FormationModule } from '@/lib/formations-content'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import {
  BookOpen, CheckCircle2, Circle, Clock, Trophy, ArrowLeft, ArrowRight, Lock, Unlock,
} from 'lucide-react'

/* ---------- Mini-rendu markdown (#, ##, ###, -, >, **gras**) ---------- */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}
function Markdown({ md }: { md: string }) {
  const lines = md.split('\n')
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1 my-2 text-slate-700">
          {list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
        </ul>
      )
      list = []
    }
  }
  lines.forEach((raw, idx) => {
    const l = raw.trimEnd()
    if (!l.trim()) { flush(); return }
    if (l.startsWith('- ')) { list.push(l.slice(2)); return }
    flush()
    if (l.startsWith('# ')) blocks.push(<h1 key={idx} className="text-2xl font-black text-slate-900 mt-2 mb-3">{l.slice(2)}</h1>)
    else if (l.startsWith('## ')) blocks.push(<h2 key={idx} className="text-lg font-bold text-[#4d553e] mt-5 mb-2">{l.slice(3)}</h2>)
    else if (l.startsWith('### ')) blocks.push(<h3 key={idx} className="font-bold text-slate-900 mt-4 mb-1">{l.slice(4)}</h3>)
    else if (l.startsWith('> ')) blocks.push(<blockquote key={idx} className="border-l-4 border-[#697357] bg-[#697357]/5 rounded-r-lg px-4 py-2 my-3 text-slate-700">{renderInline(l.slice(2))}</blockquote>)
    else blocks.push(<p key={idx} className="text-slate-700 leading-relaxed my-2">{renderInline(l)}</p>)
  })
  flush()
  return <div>{blocks}</div>
}

/* ---------- QCM ---------- */
function Quiz({ module, onPass }: { module: FormationModule; onPass: (score: number) => void }) {
  const qs = module.quiz.questions
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const correct = qs.filter((q, i) => answers[i] === q.correctIndex).length
  const score = Math.round((correct / qs.length) * 100)
  const passed = score >= module.quiz.passScore

  const submit = () => { setSubmitted(true); if (score >= module.quiz.passScore) onPass(score) }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-[#697357]" /> QCM — validez le module (≥ {module.quiz.passScore} %)
      </h3>
      <div className="space-y-5">
        {qs.map((q, qi) => (
          <div key={qi}>
            <p className="font-semibold text-slate-800 mb-2">{qi + 1}. {q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const chosen = answers[qi] === oi
                const isCorrect = oi === q.correctIndex
                let cls = 'border-slate-200 hover:border-[#697357]/50'
                if (submitted) {
                  if (isCorrect) cls = 'border-green-400 bg-green-50'
                  else if (chosen) cls = 'border-red-400 bg-red-50'
                } else if (chosen) cls = 'border-[#697357] bg-[#697357]/5'
                return (
                  <button key={oi} disabled={submitted}
                    onClick={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${cls}`}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {submitted && <p className="text-xs text-slate-500 mt-1.5 italic">💡 {q.explanation}</p>}
          </div>
        ))}
      </div>

      {!submitted ? (
        <button onClick={submit} disabled={Object.keys(answers).length < qs.length}
          className="mt-5 w-full py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold disabled:opacity-50">
          Valider mes réponses
        </button>
      ) : (
        <div className={`mt-5 rounded-xl p-4 text-center font-semibold ${passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {passed ? `✅ Réussi — ${score} % ! Module validé.` : `❌ ${score} %. Reprenez le cours et réessayez.`}
          {!passed && (
            <button onClick={() => { setSubmitted(false); setAnswers({}) }}
              className="block mx-auto mt-2 text-sm underline">Recommencer le QCM</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Page de niveau réutilisable ---------- */
interface LevelCourseProps {
  level: number
  title: string
  ceilingText: string
  modules: FormationModule[]
  nextHref?: string
  nextLabel?: string
}

export default function LevelCourse({ level, title, ceilingText, modules, nextHref, nextLabel }: LevelCourseProps) {
  const { user } = useAuth()
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id || null)
  const [passed, setPassed] = useState<Set<string>>(new Set())

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }, [])

  // Charger la progression enregistrée (si connecté)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/formations/progress`, { headers: await authHeaders() })
        const data = await res.json()
        if (!cancelled && data?.success && Array.isArray(data.passedModuleIds)) {
          const mine = data.passedModuleIds.filter((id: string) => modules.some(m => m.id === id))
          setPassed(new Set(mine))
        }
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [user?.id, authHeaders, modules])

  const markPassed = useCallback(async (id: string, score: number) => {
    setPassed(prev => new Set(prev).add(id))
    if (!user?.id) return // non connecté → progression locale seulement
    try {
      await fetch(`${API_URL}/api/formations/progress`, {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ module_id: id, level, score }),
      })
    } catch { /* la progression locale reste affichée */ }
  }, [user?.id, authHeaders, level])

  const allDone = passed.size >= modules.length
  const progress = Math.round((passed.size / modules.length) * 100)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-3">
            <ArrowLeft className="w-4 h-4" /> Programme
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black">{title}</h1>
          <p className="text-white/80 mt-1 text-sm sm:text-base">Validez les {modules.length} modules pour débloquer la demande de financement {ceilingText.toLowerCase()}.</p>
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{passed.size}/{modules.length} modules validés</span><span>{progress} %</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={`mb-6 rounded-2xl p-4 flex items-center gap-3 border ${allDone ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
          {allDone ? <Unlock className="w-6 h-6 text-green-600 shrink-0" /> : <Lock className="w-6 h-6 text-slate-400 shrink-0" />}
          <div className="text-sm">
            {allDone
              ? <span className="text-green-700 font-semibold">🎉 Niveau {level} validé ! La demande de financement {ceilingText.toLowerCase()} est débloquée.</span>
              : <span className="text-slate-600">Validez tous les modules (cours + QCM) pour débloquer le palier de financement.</span>}
          </div>
        </div>

        <div className="space-y-3">
          {modules.map((m) => {
            const isOpen = openId === m.id
            const isPassed = passed.has(m.id)
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : m.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors">
                  {isPassed ? <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" /> : <Circle className="w-6 h-6 text-slate-300 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900">{m.order}. {m.title}</h3>
                    <p className="text-sm text-slate-500 truncate">{m.summary}</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 shrink-0"><Clock className="w-3.5 h-3.5" />{m.durationMin} min</span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-6 pb-6 border-t border-slate-100">
                    <article className="pt-4 max-w-none"><Markdown md={m.content} /></article>
                    <Quiz module={m} onPass={(score) => markPassed(m.id, score)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          {allDone && nextHref ? (
            <Link href={nextHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">
              {nextLabel || 'Continuer'} <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <p className="text-sm text-slate-500">
              <BookOpen className="w-4 h-4 inline mr-1" />
              {user
                ? 'Votre progression est enregistrée automatiquement à chaque QCM réussi.'
                : 'Connectez-vous pour enregistrer votre progression et débloquer votre palier de financement.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
