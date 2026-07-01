'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FormationModule } from '@/lib/formations-content'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import {
  BookOpen, CheckCircle2, Circle, Clock, Trophy, ArrowLeft, ArrowRight, Lock, Unlock,
  Sparkles, Send, Loader2, Award, Lightbulb, Layers, Volume2, Pause, Square, DownloadCloud,
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

/* ---------- Assistant IA (gratuit) ---------- */
function AiAssistant({ module }: { module: FormationModule }) {
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    if (!q.trim() || loading) return
    setLoading(true); setAnswer('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/api/formations/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ question: q, moduleTitle: module.title, moduleSummary: module.summary }),
      })
      const data = await res.json()
      setAnswer(data?.success ? data.answer : (data?.error || 'Erreur'))
    } catch { setAnswer('Erreur réseau, réessayez.') } finally { setLoading(false) }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#697357]/20 bg-[#697357]/5 p-4">
      <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-[#697357]" /> Assistant IA — une question sur ce module ?
      </h3>
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

  const markPassed = useCallback(async (id: string, score: number) => {
    setPassed(prev => new Set(prev).add(id))
    if (!user?.id) return // non connecté → progression locale seulement
    try {
      const res = await fetch(`${API_URL}/api/formations/progress`, {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ module_id: id, level, score }),
      })
      const data = await res.json()
      if (data?.success) { setXp(data.xp || 0); setBadges(data.badges || []) }
    } catch { /* la progression locale reste affichée */ }
  }, [user?.id, authHeaders, level])

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
            <button onClick={downloadOffline} title="Télécharger ce niveau pour le lire sans connexion"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold">
              <DownloadCloud className="w-4 h-4" /> <span className="hidden sm:inline">Hors-ligne</span>
            </button>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
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
          {user && badges.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap gap-1.5">
              {badges.map(b => <span key={b.id} title={b.label} className="inline-flex items-center gap-1 bg-[#697357]/10 text-[#4d553e] px-2 py-1 rounded-full text-xs font-semibold">{b.emoji} {b.label}</span>)}
            </div>
          )}
        </aside>

        {/* Contenu du module actif */}
        <main className="min-w-0">
          {allDone && (
            <div className="mb-4 rounded-2xl p-4 flex items-center gap-3 border bg-green-50 border-green-200">
              <Unlock className="w-6 h-6 text-green-600 shrink-0" />
              <div className="text-sm flex-1 text-green-700 font-semibold">🎉 Niveau {level} validé ! Financement {ceilingText.toLowerCase()} débloqué.</div>
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
                <ListenButton text={active.content} title={active.title} />
              </div>
              <CourseContent content={active.content} moduleTitle={active.title} level={level} />

              <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <Sparkles className="w-4 h-4 text-[#697357] shrink-0 mt-0.5" />
                <span>Sous chaque point : <b>Approfondir</b> pour les détails et arguments clés, <b>Expliquer simplement</b> pour un exemple concret. Auto-formez-vous à votre rythme.</span>
              </div>

              <AiAssistant module={active} />

              {showQuiz ? (
                <Quiz key={active.id} module={active} onPass={(score) => markPassed(active.id, score)} />
              ) : (
                <button onClick={() => setShowQuiz(true)}
                  className="mt-6 w-full py-3 rounded-xl border-2 border-[#697357] text-[#4d553e] font-bold hover:bg-[#697357]/5 inline-flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> J'ai terminé la lecture — Passer au QCM
                </button>
              )}

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
    </div>
  )
}
