'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FormationModule } from '@/lib/formations-content'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import {
  BookOpen, CheckCircle2, Circle, Clock, Trophy, ArrowLeft, ArrowRight, Lock, Unlock,
  Sparkles, Send, Loader2, Award, Lightbulb, Layers, Volume2, Pause, Square, DownloadCloud, Flame, Brain,
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

/* ---------- QCM (corrigé côté serveur ; repli local pour le contenu statique) ---------- */
type QuizCorrection = { correctIndex?: number; explanation?: string | null }
type QuizSubmitResult = {
  recorded?: boolean
  pass_token?: string
  xp?: number
  badges?: { id: string; label: string; emoji: string }[]
  score: number
}

function Quiz({ module, level, onPass }: { module: FormationModule; level: number; onPass: (score: number, submitRes?: QuizSubmitResult | null) => void }) {
  const qs = module.quiz.questions
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ score: number; passed: boolean; corrections: QuizCorrection[] } | null>(null)
  const submitted = !!result

  // Le contenu statique (non importé en base) embarque encore les réponses → correction locale possible
  const hasLocalKey = qs.some(q => typeof q.correctIndex === 'number')

  const gradeLocally = () => {
    const correct = qs.filter((q, i) => answers[i] === q.correctIndex).length
    const score = Math.round((correct / qs.length) * 100)
    const passed = score >= module.quiz.passScore
    setResult({ score, passed, corrections: qs.map(q => ({ correctIndex: q.correctIndex, explanation: q.explanation })) })
    if (passed) onPass(score, null)
  }

  const submit = async () => {
    if (checking) return
    setChecking(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/api/formations/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ module_id: module.id, level, answers: qs.map((_, i) => answers[i] ?? -1) }),
      })
      const data = await res.json()
      if (data?.success && !data.fallback) {
        setResult({ score: data.score, passed: data.passed, corrections: data.corrections || [] })
        if (data.passed) onPass(data.score, data)
      } else if (hasLocalKey) {
        gradeLocally()
      } else {
        setError('Correction impossible pour le moment. Réessayez dans un instant.')
      }
    } catch {
      if (hasLocalKey) gradeLocally()
      else setError('Connexion instable — impossible de corriger le QCM. Vérifiez votre réseau et réessayez.')
    } finally { setChecking(false) }
  }

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
                const isCorrect = submitted && result?.corrections[qi]?.correctIndex === oi
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
            {submitted && result?.corrections[qi]?.explanation && (
              <p className="text-xs text-slate-500 mt-1.5 italic">💡 {result.corrections[qi].explanation}</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

      {!submitted ? (
        <button onClick={submit} disabled={checking || Object.keys(answers).length < qs.length}
          className="mt-5 w-full py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {checking ? <><Loader2 className="w-5 h-5 animate-spin" /> Correction…</> : 'Valider mes réponses'}
        </button>
      ) : (
        <div className={`mt-5 rounded-xl p-4 text-center font-semibold ${result.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.passed ? `✅ Réussi — ${result.score} % ! Module validé.` : `❌ ${result.score} %. Reprenez le cours et réessayez.`}
          {!result.passed && (
            <button onClick={() => { setResult(null); setAnswers({}) }}
              className="block mx-auto mt-2 text-sm underline">Recommencer le QCM</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Assistant IA (gratuit) ---------- */
function AiAssistant({ module }: { module: FormationModule }) {
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'direct' | 'socratic'>('direct')

  useEffect(() => {
    try { if (localStorage.getItem('fmt-ai-mode') === 'socratic') setMode('socratic') } catch { /* noop */ }
  }, [])
  const switchMode = (m: 'direct' | 'socratic') => {
    setMode(m)
    try { localStorage.setItem('fmt-ai-mode', m) } catch { /* noop */ }
  }

  const ask = async () => {
    if (!q.trim() || loading) return
    setLoading(true); setAnswer('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/api/formations/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ question: q, moduleTitle: module.title, moduleSummary: module.summary, mode }),
      })
      const data = await res.json()
      setAnswer(data?.success ? data.answer : (data?.error || 'Erreur'))
    } catch { setAnswer('Erreur réseau, réessayez.') } finally { setLoading(false) }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#697357]/20 bg-[#697357]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#697357]" /> Assistant IA — une question sur ce module ?
        </h3>
        <div className="inline-flex rounded-full border border-[#697357]/25 bg-white p-0.5 text-xs font-semibold">
          <button onClick={() => switchMode('direct')}
            className={`px-2.5 py-1 rounded-full transition-colors ${mode === 'direct' ? 'bg-[#697357] text-white' : 'text-[#4d553e] hover:bg-[#697357]/10'}`}>
            Réponse directe
          </button>
          <button onClick={() => switchMode('socratic')} title="L'IA vous guide par questions au lieu de donner la réponse"
            className={`px-2.5 py-1 rounded-full transition-colors ${mode === 'socratic' ? 'bg-[#697357] text-white' : 'text-[#4d553e] hover:bg-[#697357]/10'}`}>
            🧠 Me faire réfléchir
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ex : comment calculer ma marge sur mon produit ?"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#697357]" />
        <button onClick={ask} disabled={loading || !q.trim()}
          className="px-3 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      {answer && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-3 text-sm text-slate-700 whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  )
}

/* ---------- Atelier pratique : livrable appliqué à SON projet, corrigé par IA ---------- */
type WorkshopFeedback = {
  score: number
  verdict?: string
  strengths?: string[]
  improvements?: string[]
  next_step?: string
}

function Workshop({ module, level }: { module: FormationModule; level: number }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState('')
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [fb, setFb] = useState<WorkshopFeedback | null>(null)
  const [err, setErr] = useState('')

  const headers = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }

  const openWorkshop = async () => {
    setOpen(true)
    if (brief || loadingBrief) return
    setLoadingBrief(true); setErr('')
    try {
      const res = await fetch(`${API_URL}/api/formations/deliverable/brief`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ module_id: module.id, moduleTitle: module.title, moduleSummary: module.summary, level }),
      })
      const data = await res.json()
      if (data?.success) {
        setBrief(data.brief || '')
        if (data.last) {
          setText(data.last.content || '')
          if (data.last.feedback) setFb(data.last.feedback as WorkshopFeedback)
        }
      } else setErr(data?.error || 'Erreur de chargement de l\'atelier.')
    } catch { setErr('Erreur réseau, réessayez.') } finally { setLoadingBrief(false) }
  }

  const submit = async () => {
    if (sending || text.trim().length < 30) return
    setSending(true); setErr('')
    try {
      const res = await fetch(`${API_URL}/api/formations/deliverable/submit`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ module_id: module.id, level, brief, text, moduleTitle: module.title }),
      })
      const data = await res.json()
      if (data?.success && data.feedback) setFb(data.feedback as WorkshopFeedback)
      else setErr(data?.error || 'Erreur de correction, réessayez.')
    } catch { setErr('Erreur réseau, réessayez.') } finally { setSending(false) }
  }

  const scoreColor = (s: number) => s >= 70 ? 'bg-green-100 text-green-700' : s >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'

  return (
    <div className="mt-6 rounded-2xl border-2 border-amber-300/70 bg-amber-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          🛠️ Atelier pratique — appliquez ce module à votre projet
        </h3>
        <span className="text-[11px] font-bold uppercase tracking-wide bg-amber-300 text-[#3a4030] px-2.5 py-1 rounded-full">
          Pièce de votre dossier BCEG
        </span>
      </div>
      <p className="text-sm text-slate-600 mt-1">
        Un exercice concret corrigé par l'IA avec une note et des conseils. Chaque atelier réussi est une pièce
        de votre futur dossier de financement.
      </p>

      {!user ? (
        <p className="mt-3 text-sm text-slate-600 bg-white rounded-xl border border-amber-200 p-3">
          <Link href={`/auth/signin?redirectTo=/formations/niveau-${level}/apprendre`} className="font-semibold text-[#4d553e] underline">Connectez-vous</Link> pour
          faire l'atelier et conserver vos travaux dans votre dossier.
        </p>
      ) : !open ? (
        <button onClick={openWorkshop}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-bold">
          Ouvrir l'atelier <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          {loadingBrief ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Préparation de votre mission…</p>
          ) : brief && (
            <div className="bg-white rounded-xl border border-amber-200 p-3.5 text-sm">
              <Markdown md={brief} />
            </div>
          )}

          {!loadingBrief && (
            <>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder="Rédigez ici votre réponse, appliquée à VOTRE projet (avec vos chiffres en FCFA)…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#697357] focus:ring-1 focus:ring-[#697357] bg-white" />
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={submit} disabled={sending || text.trim().length < 30}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-bold disabled:opacity-50">
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Correction en cours…</> : <>Envoyer pour correction <Send className="w-4 h-4" /></>}
                </button>
                {text.trim().length < 30 && <span className="text-xs text-slate-400">Quelques phrases minimum.</span>}
              </div>
            </>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}

          {fb && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-black ${scoreColor(fb.score)}`}>{fb.score}/100</span>
                {fb.verdict && <span className="text-sm text-slate-700 font-semibold">{fb.verdict}</span>}
              </div>
              {!!fb.strengths?.length && (
                <ul className="space-y-1">
                  {fb.strengths.map((s, i) => <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />{s}</li>)}
                </ul>
              )}
              {!!fb.improvements?.length && (
                <ul className="space-y-1">
                  {fb.improvements.map((s, i) => <li key={i} className="text-sm text-slate-700 flex items-start gap-2"><Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{s}</li>)}
                </ul>
              )}
              {fb.next_step && (
                <p className="text-sm text-[#4d553e] font-semibold bg-[#697357]/5 border border-[#697357]/20 rounded-lg p-2.5">
                  ➡️ Prochaine étape : {fb.next_step}
                </p>
              )}
              <p className="text-xs text-slate-400">Améliorez votre réponse ci-dessus et renvoyez-la pour progresser.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Auto-formation : un bloc de contenu + 2 boutons IA ---------- */
function ContentBlock({ text, moduleTitle, level }: { text: string; moduleTitle: string; level: number }) {
  const [loading, setLoading] = useState<'deepen' | 'simplify' | null>(null)
  const [resp, setResp] = useState<{ action: 'deepen' | 'simplify'; text: string } | null>(null)

  const run = async (action: 'deepen' | 'simplify') => {
    if (loading) return
    setLoading(action); setResp(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/api/formations/ai-paragraph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ action, paragraph: text, moduleTitle, level }),
      })
      const data = await res.json()
      setResp({ action, text: data?.success ? data.answer : (data?.error || 'Erreur') })
    } catch { setResp({ action, text: 'Erreur réseau, réessayez.' }) } finally { setLoading(null) }
  }

  const trimmed = text.trim()
  const headingOnly = /^#{1,3}\s/.test(trimmed) && !trimmed.includes('\n')
  const actionable = !headingOnly && trimmed.replace(/[#>*\-\s]/g, '').length > 60

  return (
    <div className="group/blk">
      <Markdown md={text} />
      {actionable && (
        <div className="flex flex-wrap gap-2 mt-1 mb-3 opacity-90">
          <button onClick={() => run('deepen')} disabled={!!loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#697357]/10 text-[#4d553e] border border-[#697357]/25 hover:bg-[#697357]/20 disabled:opacity-50">
            {loading === 'deepen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Approfondir
          </button>
          <button onClick={() => run('simplify')} disabled={!!loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 disabled:opacity-50">
            {loading === 'simplify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />} Expliquer simplement
          </button>
        </div>
      )}
      {resp && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${resp.action === 'simplify' ? 'bg-amber-50 border-amber-200' : 'bg-[#697357]/5 border-[#697357]/20'}`}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-1 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-[#697357]" /> {resp.action === 'simplify' ? 'Expliqué simplement' : 'Pour aller plus loin'}
          </div>
          <Markdown md={resp.text} />
        </div>
      )}
    </div>
  )
}

/* ---------- Contenu d'un cours découpé en blocs (boutons IA par paragraphe) ---------- */
function CourseContent({ content, moduleTitle, level }: { content: string; moduleTitle: string; level: number }) {
  const segments = (content || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  return (
    <article className="max-w-none">
      {segments.map((seg, i) => <ContentBlock key={i} text={seg} moduleTitle={moduleTitle} level={level} />)}
    </article>
  )
}

/* ---------- Écoute audio du module (synthèse vocale du navigateur, hors-ligne) ---------- */
function ListenButton({ text, title }: { text: string; title: string }) {
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { try { window.speechSynthesis?.cancel() } catch { /* noop */ } }, [])

  if (!supported) return null

  const clean = (t: string) => `${title}. ${t}`.replace(/[#>*_`]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').slice(0, 4800)

  const play = () => {
    const synth = window.speechSynthesis
    if (state === 'paused') { synth.resume(); setState('playing'); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(clean(text))
    u.lang = 'fr-FR'; u.rate = 1
    u.onend = () => setState('idle'); u.onerror = () => setState('idle')
    synth.speak(u); setState('playing')
  }
  const pause = () => { window.speechSynthesis.pause(); setState('paused') }
  const stop = () => { window.speechSynthesis.cancel(); setState('idle') }

  return (
    <div className="inline-flex items-center gap-1.5">
      {state === 'playing' ? (
        <button onClick={pause} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#697357] text-white text-sm font-semibold">
          <Pause className="w-4 h-4" /> Pause
        </button>
      ) : (
        <button onClick={play} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#697357]/10 text-[#4d553e] border border-[#697357]/25 hover:bg-[#697357]/20 text-sm font-semibold">
          <Volume2 className="w-4 h-4" /> {state === 'paused' ? 'Reprendre' : 'Écouter'}
        </button>
      )}
      {state !== 'idle' && (
        <button onClick={stop} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" title="Arrêter">
          <Square className="w-4 h-4" />
        </button>
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
  // Cours depuis la base (éditables) avec repli sur le contenu statique fourni en prop
  const [courses, setCourses] = useState<FormationModule[]>(modules)
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id || null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/formations/courses?level=${level}`)
        const data = await res.json()
        if (!cancelled && data?.success && Array.isArray(data.courses) && data.courses.length) {
          setCourses(data.courses)
          setOpenId(data.courses[0]?.id || null)
        }
      } catch { /* repli statique */ }
    })()
    return () => { cancelled = true }
  }, [level])
  const [passed, setPassed] = useState<Set<string>>(new Set())
  const [xp, setXp] = useState(0)
  const [badges, setBadges] = useState<{ id: string; label: string; emoji: string }[]>([])
  const [showQuiz, setShowQuiz] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [streakInfo, setStreakInfo] = useState<{ current: number; dueReviews: number } | null>(null)

  // Le QCM ne s'affiche qu'après lecture ; on masque le QCM et on coupe l'audio
  // à chaque changement de module. On mémorise aussi le dernier module ouvert.
  useEffect(() => {
    setShowQuiz(false)
    try { window.speechSynthesis?.cancel() } catch { /* noop */ }
    try { if (openId) localStorage.setItem(`fmt-last-${level}`, openId) } catch { /* noop */ }
  }, [openId, level])

  // Reprise : restaure le dernier module ouvert (hors-ligne friendly)
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !courses.length) return
    try {
      const saved = localStorage.getItem(`fmt-last-${level}`)
      if (saved && courses.some(c => c.id === saved)) setOpenId(saved)
    } catch { /* noop */ }
    restored.current = true
  }, [courses, level])

  // Tour guidé à la première visite du player
  useEffect(() => {
    if (!courses.length) return
    try { if (localStorage.getItem('fmt-tour-done')) return } catch { return }
    const t = setTimeout(() => {
      try {
        driver({
          showProgress: true,
          progressText: '{{current}}/{{total}}',
          nextBtnText: 'Suivant',
          prevBtnText: 'Retour',
          doneBtnText: "C'est parti !",
          steps: [
            { element: '[data-tour="lecons"]', popover: { title: 'Vos leçons', description: 'Suivez votre progression et naviguez librement entre les modules du niveau.' } },
            { element: '[data-tour="ecouter"]', popover: { title: 'Écoutez le cours', description: 'Chaque module peut être écouté en audio — pratique en déplacement ou en faible débit.' } },
            { element: '[data-tour="ia"]', popover: { title: 'Votre coach IA', description: 'Sous chaque point du cours : « Approfondir » pour les détails, « Expliquer simplement » pour un exemple concret.' } },
            { element: '[data-tour="horsligne"]', popover: { title: 'Mode hors-ligne', description: 'Téléchargez tout le niveau pour continuer à lire sans connexion.' } },
            { element: '[data-tour="qcm"]', popover: { title: 'Validez le module', description: 'Terminez la lecture puis réussissez le QCM pour gagner des XP et débloquer votre palier de financement.' } },
          ],
          onDestroyed: () => { try { localStorage.setItem('fmt-tour-done', '1') } catch { /* noop */ } },
        }).drive()
      } catch { /* décoratif */ }
    }, 1200)
    return () => clearTimeout(t)
  }, [courses.length])

  // Téléchargement du niveau pour lecture hors-ligne (fichier HTML autonome)
  const downloadOffline = () => {
    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const sections = courses.map(m => `<h2>${esc(m.title)}</h2><pre>${esc(m.content)}</pre>`).join('<hr/>')
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1f2937}h1{color:#4d553e}h2{color:#697357;margin-top:2rem}pre{white-space:pre-wrap;font-family:inherit}hr{border:none;border-top:1px solid #e5e7eb;margin:2.5rem 0}</style></head><body><h1>${esc(title)}</h1><p>Formations Entrepreneur BCEG — lecture hors-ligne.</p>${sections}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `formation-niveau-${level}.html`; a.click()
    URL.revokeObjectURL(url)
  }

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
          const mine = data.passedModuleIds.filter((id: string) => courses.some(m => m.id === id))
          setPassed(new Set(mine))
          setXp(data.xp || 0)
          setBadges(data.badges || [])
        }
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [user?.id, authHeaders, courses])

  // 🎉 Confettis (import dynamique — ne pèse rien tant qu'on ne valide pas)
  const celebrate = useCallback((big: boolean) => {
    import('canvas-confetti').then(({ default: confetti }) => {
      const colors = ['#697357', '#8a9576', '#fbbf24', '#f59e0b']
      confetti({ particleCount: big ? 160 : 80, spread: big ? 100 : 70, origin: { y: 0.7 }, colors })
      if (big) {
        setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 80, origin: { x: 0, y: 0.8 }, colors }), 250)
        setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 80, origin: { x: 1, y: 0.8 }, colors }), 400)
      }
    }).catch(() => { /* décoratif */ })
  }, [])

  // Streak 🔥 + révisions dues (rafraîchi après chaque module validé)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/formations/streak`, { headers: await authHeaders() })
        const data = await res.json()
        if (!cancelled && data?.success) setStreakInfo({ current: data.current || 0, dueReviews: data.dueReviews || 0 })
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [user?.id, authHeaders, passed.size])

  const markPassed = useCallback(async (id: string, score: number, submitRes?: QuizSubmitResult | null) => {
    const levelDone = !passed.has(id) && passed.size + 1 >= courses.length
    setPassed(prev => new Set(prev).add(id))
    celebrate(levelDone)

    if (user?.id) {
      // Déjà enregistré côté serveur par /quiz/submit ; sinon repli sur /progress (contenu statique)
      if (submitRes?.recorded) { setXp(submitRes.xp || 0); setBadges(submitRes.badges || []); return }
      try {
        const res = await fetch(`${API_URL}/api/formations/progress`, {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ module_id: id, level, score }),
        })
        const data = await res.json()
        if (data?.success) { setXp(data.xp || 0); setBadges(data.badges || []) }
      } catch { /* la progression locale reste affichée */ }
      return
    }

    // Anonyme : progression locale + jeton signé à réclamer après inscription
    try {
      const key = `fmt-passed-${level}`
      const cur: string[] = JSON.parse(localStorage.getItem(key) || '[]')
      if (!cur.includes(id)) localStorage.setItem(key, JSON.stringify([...cur, id]))
      if (submitRes?.pass_token) {
        const toks: string[] = JSON.parse(localStorage.getItem('fmt-pass-tokens') || '[]')
        localStorage.setItem('fmt-pass-tokens', JSON.stringify([...toks, submitRes.pass_token].slice(-60)))
      }
    } catch { /* noop */ }
    try { if (!sessionStorage.getItem('fmt-save-nudge')) setShowSaveModal(true) } catch { setShowSaveModal(true) }
  }, [user?.id, authHeaders, level, passed, courses.length, celebrate])

  // Anonyme : restaurer la progression locale du niveau
  useEffect(() => {
    if (user?.id || !courses.length) return
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(`fmt-passed-${level}`) || '[]')
      const mine = saved.filter(id => courses.some(c => c.id === id))
      if (mine.length) setPassed(new Set(mine))
    } catch { /* noop */ }
  }, [user?.id, courses, level])

  // Connecté : réclamer les QCM réussis en anonyme (jetons signés), puis nettoyer
  useEffect(() => {
    if (!user?.id || !courses.length) return
    let cancelled = false
    ;(async () => {
      try {
        const toks: string[] = JSON.parse(localStorage.getItem('fmt-pass-tokens') || '[]')
        if (!toks.length) return
        const res = await fetch(`${API_URL}/api/formations/progress/claim`, {
          method: 'POST', headers: await authHeaders(), body: JSON.stringify({ tokens: toks }),
        })
        const data = await res.json()
        if (data?.success) {
          localStorage.removeItem('fmt-pass-tokens')
          if (!cancelled && Array.isArray(data.passedModuleIds)) {
            const mine = data.passedModuleIds.filter((id: string) => courses.some(m => m.id === id))
            setPassed(new Set(mine)); setXp(data.xp || 0); setBadges(data.badges || [])
          }
        }
      } catch { /* réessaiera à la prochaine visite */ }
    })()
    return () => { cancelled = true }
  }, [user?.id, authHeaders, courses])

  const allDone = passed.size >= courses.length
  const progress = Math.round((passed.size / courses.length) * 100)

  const downloadCertificate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/formations/certificate/${level}`, { headers: await authHeaders() })
      if (!res.ok) { alert('Validez d\'abord tous les modules du niveau.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `certificat-niveau-${level}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erreur lors du téléchargement du certificat.') }
  }

  const active = courses.find(m => m.id === openId) || courses[0]
  const activeIdx = courses.findIndex(m => m.id === active?.id)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barre supérieure */}
      <div className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/formations/niveau-${level}`} className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Présentation
            </Link>
            <h1 className="text-lg sm:text-xl font-black truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadOffline} title="Télécharger ce niveau pour le lire sans connexion" data-tour="horsligne"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold">
              <DownloadCloud className="w-4 h-4" /> <span className="hidden sm:inline">Hors-ligne</span>
            </button>
            {user && streakInfo && streakInfo.current > 0 && (
              <span title={`${streakInfo.current} jour${streakInfo.current > 1 ? 's' : ''} d'activité d'affilée`}
                className="inline-flex items-center gap-1 bg-white/15 text-amber-200 px-3 py-1.5 rounded-full text-sm font-black">
                <Flame className="w-4 h-4" /> {streakInfo.current}
              </span>
            )}
            {user && (
              <span className="inline-flex items-center gap-1.5 bg-amber-300 text-[#3a4030] px-3 py-1.5 rounded-full text-sm font-bold">
                <Trophy className="w-4 h-4" /> {xp} XP
              </span>
            )}
            {allDone && user && (
              <button onClick={downloadCertificate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold">
                <Award className="w-4 h-4" /> Certificat
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar leçons */}
        <aside className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3" data-tour="lecons">
            <div className="flex justify-between text-xs text-slate-500 mb-1 px-1">
              <span>{passed.size}/{courses.length} validés</span><span>{progress} %</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#697357] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="space-y-1">
              {courses.map((m, i) => {
                const isActive = m.id === active?.id
                const isPassed = passed.has(m.id)
                return (
                  <button key={m.id} onClick={() => setOpenId(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive ? 'bg-[#697357]/10 ring-1 ring-[#697357]/30' : 'hover:bg-slate-50'}`}>
                    {isPassed ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                    <span className={`text-sm flex-1 min-w-0 truncate ${isActive ? 'font-bold text-[#4d553e]' : 'text-slate-700'}`}>{i + 1}. {m.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {user && streakInfo && streakInfo.dueReviews > 0 && (
            <Link href="/formations/revisions"
              className="block bg-amber-50 rounded-2xl border-2 border-amber-300 p-3.5 hover:bg-amber-100 transition-colors">
              <span className="flex items-center gap-2 font-bold text-[#3a4030] text-sm">
                <Brain className="w-5 h-5 text-amber-500" /> {streakInfo.dueReviews} question{streakInfo.dueReviews > 1 ? 's' : ''} à réviser
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">2 min pour ancrer vos acquis et garder votre série 🔥</span>
            </Link>
          )}
          {user && badges.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-1.5">
              {badges.map(b => <span key={b.id} title={b.label} className="inline-flex items-center gap-1 bg-[#697357]/10 text-[#4d553e] px-2 py-1 rounded-full text-xs font-semibold">{b.emoji} {b.label}</span>)}
            </div>
          )}
        </aside>

        {/* Contenu du module actif */}
        <main className="min-w-0">
          {allDone && (
            <div className="mb-4 rounded-2xl p-4 flex flex-wrap items-center gap-3 border bg-green-50 border-green-200">
              <Unlock className="w-6 h-6 text-green-600 shrink-0" />
              <div className="text-sm flex-1 min-w-[200px] text-green-700 font-semibold">🎉 Niveau {level} validé ! Financement {ceilingText.toLowerCase()} débloqué.</div>
              <Link href="/formations/simulateur" className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-300 hover:bg-amber-200 text-[#3a4030] text-sm font-bold">
                🏦 Entretien banquier
              </Link>
              {user && <button onClick={downloadCertificate} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold"><Award className="w-4 h-4" /> Certificat</button>}
            </div>
          )}

          {active && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <BookOpen className="w-3.5 h-3.5" /> Module {activeIdx + 1}/{courses.length} · {active.durationMin} min
                {passed.has(active.id) && <span className="text-green-600 font-semibold">· ✓ validé</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-2xl font-black text-slate-900">{active.title}</h2>
                <div data-tour="ecouter"><ListenButton text={active.content} title={active.title} /></div>
              </div>
              <CourseContent content={active.content} moduleTitle={active.title} level={level} />

              <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3" data-tour="ia">
                <Sparkles className="w-4 h-4 text-[#697357] shrink-0 mt-0.5" />
                <span>Sous chaque point : <b>Approfondir</b> pour les détails et arguments clés, <b>Expliquer simplement</b> pour un exemple concret. Auto-formez-vous à votre rythme.</span>
              </div>

              <AiAssistant module={active} />

              {showQuiz ? (
                <Quiz key={active.id} module={active} level={level} onPass={(score, r) => markPassed(active.id, score, r)} />
              ) : (
                <button onClick={() => setShowQuiz(true)} data-tour="qcm"
                  className="mt-6 w-full py-3 rounded-xl border-2 border-[#697357] text-[#4d553e] font-bold hover:bg-[#697357]/5 inline-flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> J'ai terminé la lecture — Passer au QCM
                </button>
              )}

              <Workshop key={`ws-${active.id}`} module={active} level={level} />

              <div className="mt-6 flex items-center justify-between">
                <button disabled={activeIdx <= 0} onClick={() => setOpenId(courses[activeIdx - 1]?.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold disabled:opacity-40">
                  <ArrowLeft className="w-4 h-4" /> Précédent
                </button>
                {activeIdx < courses.length - 1 ? (
                  <button onClick={() => setOpenId(courses[activeIdx + 1]?.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold">
                    Suivant <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (allDone && nextHref) ? (
                  <Link href={nextHref} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold">
                    {nextLabel || 'Continuer'} <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : <span />}
              </div>
            </div>
          )}

          {!user && (
            <p className="mt-4 text-center text-sm text-slate-500">
              <BookOpen className="w-4 h-4 inline mr-1" /> Connectez-vous pour enregistrer votre progression et débloquer votre palier.
            </p>
          )}
        </main>
      </div>

      {/* Invitation à sauvegarder la progression (après un 1er QCM réussi en anonyme) */}
      {showSaveModal && !user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="text-lg font-black text-slate-900">Module validé — bien joué !</h3>
            <p className="text-sm text-slate-600 mt-2">
              Créez un compte gratuit en 30 secondes pour <b>sauvegarder votre progression</b>, cumuler vos XP
              et débloquer votre palier de financement BCEG. Vos modules déjà validés seront conservés.
            </p>
            <Link href={`/auth/signup?redirectTo=/formations/niveau-${level}/apprendre`}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold">
              Créer mon compte gratuit
            </Link>
            <Link href={`/auth/signin?redirectTo=/formations/niveau-${level}/apprendre`}
              className="mt-2 block text-sm text-[#4d553e] underline">
              J'ai déjà un compte
            </Link>
            <button
              onClick={() => { setShowSaveModal(false); try { sessionStorage.setItem('fmt-save-nudge', '1') } catch { /* noop */ } }}
              className="mt-3 text-xs text-slate-400 hover:text-slate-600">
              Plus tard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
