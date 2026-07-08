'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MODULES_BY_LEVEL } from '@/lib/formations-content'
import { FORMATION_SECTORS } from '@/lib/formations'
import { BookOpen, Loader2, Save, Trash2, Download, ArrowLeft, Eye, EyeOff, Sparkles, ListChecks } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Course {
  id: string
  level: number
  order_index: number
  title: string
  summary: string | null
  duration_min: number
  content: string
  sector: string | null
  quiz: any
  is_published: boolean
}

export default function CoursAdminPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/formations/admin/courses`, { headers: await headers() })
      const data = await res.json()
      if (data.success) setCourses(data.courses)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [headers])

  useEffect(() => { load() }, [load])

  const seed = async () => {
    if (!confirm('Importer le contenu de démarrage (15 cours) ? Les cours existants de même identifiant seront écrasés.')) return
    setBusy('seed')
    try {
      const modules = Object.values(MODULES_BY_LEVEL).flat()
      const res = await fetch(`${API_URL}/api/formations/admin/courses/seed`, {
        method: 'POST', headers: await headers(), body: JSON.stringify({ modules }),
      })
      const data = await res.json()
      if (data.success) { alert(`✅ ${data.imported} cours importés.`); await load() }
      else alert(data.error || 'Échec import')
    } catch { alert('Erreur réseau') } finally { setBusy(null) }
  }

  const patch = (id: string, p: Partial<Course>) => setCourses(prev => prev.map(c => c.id === id ? { ...c, ...p } : c))

  const saveCourse = async (c: Course) => {
    setBusy(c.id)
    try {
      const res = await fetch(`${API_URL}/api/formations/admin/courses`, {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({
          id: c.id, level: c.level, order_index: c.order_index, title: c.title,
          summary: c.summary, duration_min: c.duration_min, content: c.content, sector: c.sector,
          quiz: c.quiz, is_published: c.is_published,
        }),
      })
      const data = await res.json()
      if (!data.success) alert(data.error || 'Échec enregistrement')
    } catch { alert('Erreur réseau') } finally { setBusy(null) }
  }

  // ---- Enrichissement paragraphe par paragraphe (appels courts + progression) ----
  const splitBlocks = (content: string) => (content || '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  const isEnrichable = (b: string) => {
    const t = b.trim()
    const headingOnly = /^#{1,3}\s/.test(t) && !t.includes('\n')
    return !headingOnly && t.replace(/[#>*\-\s]/g, '').length > 60
  }

  const enrichParagraph = async (h: Record<string, string>, c: Course, paragraph: string): Promise<string> => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 55000)
    try {
      const res = await fetch(`${API_URL}/api/formations/admin/courses/enrich-paragraph`, {
        method: 'POST', headers: h, signal: ctrl.signal,
        body: JSON.stringify({ paragraph, moduleTitle: c.title, level: c.level, sector: c.sector }),
      })
      const data = await res.json()
      return data?.success && data.text ? data.text : paragraph
    } catch { return paragraph } finally { clearTimeout(t) }
  }

  const enrichModule = async (c: Course, h: Record<string, string>, prefix = '') => {
    const blocks = splitBlocks(c.content)
    const out: string[] = []
    for (let i = 0; i < blocks.length; i++) {
      setProgress(`${prefix}Paragraphe ${i + 1}/${blocks.length} — « ${c.title} »`)
      const enriched = isEnrichable(blocks[i]) ? await enrichParagraph(h, c, blocks[i]) : blocks[i]
      out.push(enriched)
      patch(c.id, { content: [...out, ...blocks.slice(i + 1)].join('\n\n') }) // aperçu live
    }
    const finalContent = out.join('\n\n')
    await fetch(`${API_URL}/api/formations/admin/courses`, {
      method: 'POST', headers: h,
      body: JSON.stringify({
        id: c.id, level: c.level, order_index: c.order_index, title: c.title,
        summary: c.summary, duration_min: c.duration_min, content: finalContent,
        sector: c.sector, quiz: c.quiz, is_published: c.is_published,
      }),
    })
    patch(c.id, { content: finalContent })
  }

  const generate = async (c: Course) => {
    if (!confirm(`Enrichir « ${c.title} » paragraphe par paragraphe via IA ?`)) return
    setBusy(`gen-${c.id}`)
    try { await enrichModule(c, await headers()); alert('✅ Module enrichi.') }
    catch { alert('Erreur enrichissement') } finally { setBusy(null); setProgress(null) }
  }

  const generateAll = async () => {
    if (!courses.length) { alert('Aucun cours en base. Cliquez d\'abord sur « Importer le contenu de démarrage ».'); return }
    if (!confirm(`Enrichir les ${courses.length} cours paragraphe par paragraphe via IA ?\nCela peut prendre plusieurs minutes — laissez cet onglet ouvert.`)) return
    setBusy('gen-all')
    try {
      const h = await headers()
      const list = [...courses]
      for (let k = 0; k < list.length; k++) {
        await enrichModule(list[k], h, `Module ${k + 1}/${list.length} · `)
      }
      alert('✅ Tous les cours ont été enrichis.')
    } catch { alert('Enrichissement interrompu — relancez pour terminer.') }
    finally { setBusy(null); setProgress(null) }
  }

  // Génère un QCM de 10 questions à difficulté croissante (IA) pour un module
  const generateQuiz = async (c: Course): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/formations/admin/courses/generate-quiz`, {
      method: 'POST', headers: await headers(), body: JSON.stringify({ module_id: c.id }),
    })
    const data = await res.json()
    if (data?.success && data.quiz) {
      setCourses(prev => prev.map(x => x.id === c.id ? { ...x, quiz: data.quiz } : x))
      return true
    }
    throw new Error(data?.error || 'Erreur')
  }

  const genQuiz = async (c: Course) => {
    if (!confirm(`Générer un QCM de 10 questions (difficulté croissante) pour « ${c.title} » ?\nCela remplace le QCM actuel.`)) return
    setBusy(`quiz-${c.id}`)
    try { const ok = await generateQuiz(c); alert(ok ? '✅ QCM de 10 questions généré.' : 'Erreur') }
    catch (e: any) { alert('Erreur QCM : ' + (e?.message || '')) } finally { setBusy(null) }
  }

  const genAllQuiz = async () => {
    if (!courses.length) { alert('Aucun cours en base. Cliquez d\'abord sur « Importer le contenu de démarrage ».'); return }
    if (!confirm(`Générer un QCM de 10 questions pour les ${courses.length} cours ?\nCela remplace les QCM actuels et peut prendre quelques minutes.`)) return
    setBusy('quiz-all')
    try {
      const list = [...courses]
      for (let k = 0; k < list.length; k++) {
        setProgress(`QCM ${k + 1}/${list.length} · ${list[k].title}`)
        try { await generateQuiz(list[k]) } catch { /* on continue les suivants */ }
      }
      alert('✅ QCM générés pour tous les cours.')
    } catch { alert('Génération interrompue — relancez pour terminer.') }
    finally { setBusy(null); setProgress(null) }
  }

  const del = async (id: string) => {
    if (!confirm('Supprimer ce cours ?')) return
    const res = await fetch(`${API_URL}/api/formations/admin/courses/${id}`, { method: 'DELETE', headers: await headers() })
    const data = await res.json()
    if (data.success) setCourses(prev => prev.filter(c => c.id !== id))
  }

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm'

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/formations" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-1"><ArrowLeft className="w-4 h-4" /> Candidatures</Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-6 h-6 text-[#697357]" /> Cours & QCM</h1>
          <p className="text-slate-500 text-sm">Éditez le contenu sans redéploiement. Le quiz est au format JSON.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={seed} disabled={busy === 'seed'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">
            {busy === 'seed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Importer le contenu de démarrage
          </button>
          <button onClick={generateAll} disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">
            {busy === 'gen-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Tout enrichir via IA
          </button>
          <button onClick={genAllQuiz} disabled={!!busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold disabled:opacity-50">
            {busy === 'quiz-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />} Générer tous les QCM (10 Q)
          </button>
        </div>
      </header>

      {progress && (
        <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Enrichissement en cours — {progress}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : courses.length === 0 ? (
        <p className="text-slate-500 text-sm">Aucun cours en base. Cliquez sur « Importer le contenu de démarrage » pour seed les 15 modules.</p>
      ) : (
        courses.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono">{c.id}</span> · Niveau {c.level}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-2">
              <input value={c.title} onChange={e => patch(c.id, { title: e.target.value })} placeholder="Titre" className={input} />
              <input type="number" value={c.order_index} onChange={e => patch(c.id, { order_index: parseInt(e.target.value, 10) || 0 })} placeholder="Ordre" className={input} />
              <input type="number" value={c.duration_min} onChange={e => patch(c.id, { duration_min: parseInt(e.target.value, 10) || 0 })} placeholder="Durée (min)" className={input} />
            </div>
            <input value={c.summary || ''} onChange={e => patch(c.id, { summary: e.target.value })} placeholder="Résumé" className={input} />
            <select value={c.sector || ''} onChange={e => patch(c.id, { sector: e.target.value || null })} className={input}>
              <option value="">Secteur : générique (tous)</option>
              {FORMATION_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={c.content} onChange={e => patch(c.id, { content: e.target.value })} rows={8} placeholder="Contenu (markdown)" className={`${input} font-mono text-xs`} />
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">QCM (JSON)</summary>
              <textarea
                defaultValue={JSON.stringify(c.quiz, null, 2)}
                onBlur={e => { try { patch(c.id, { quiz: JSON.parse(e.target.value) }) } catch { alert('JSON du QCM invalide') } }}
                rows={12} className={`${input} font-mono text-xs mt-2`} />
            </details>
            <div className="flex items-center gap-2">
              <button onClick={() => patch(c.id, { is_published: !c.is_published })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${c.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {c.is_published ? <><Eye className="w-4 h-4" /> Publié</> : <><EyeOff className="w-4 h-4" /> Brouillon</>}
              </button>
              <button onClick={() => generate(c)} disabled={busy === `gen-${c.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-semibold disabled:opacity-50">
                {busy === `gen-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Enrichir via IA
              </button>
              <button onClick={() => genQuiz(c)} disabled={busy === `quiz-${c.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#697357]/10 text-[#4d553e] hover:bg-[#697357]/20 text-sm font-semibold disabled:opacity-50">
                {busy === `quiz-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />} QCM 10 Q
              </button>
              <button onClick={() => saveCourse(c)} disabled={busy === c.id}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold disabled:opacity-50">
                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
              <button onClick={() => del(c.id)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
