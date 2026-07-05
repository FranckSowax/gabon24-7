'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FORMATION_LEVELS } from '@/lib/formations'
import { MODULES_BY_LEVEL } from '@/lib/formations-content'
import {
  ArrowLeft, ArrowRight, PlayCircle, CheckCircle2, Clock, Trophy, Award, BookOpen, Sparkles,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function LevelIntro({ level }: { level: number }) {
  const { user } = useAuth()
  const meta = FORMATION_LEVELS.find(l => l.level === level)
  const staticModules = MODULES_BY_LEVEL[level] || []
  const [modules, setModules] = useState(staticModules)
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set())

  // Cours en base si disponibles (sinon contenu statique)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/formations/courses?level=${level}`)
        const data = await res.json()
        if (!cancelled && data?.success && Array.isArray(data.courses) && data.courses.length) setModules(data.courses)
      } catch { /* repli statique */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Progression : compte connecté, sinon progression locale (anonyme)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (user?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch(`${API_URL}/api/formations/progress`, {
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          })
          const data = await res.json()
          if (!cancelled && data?.success && Array.isArray(data.passedModuleIds)) {
            setPassedIds(new Set(data.passedModuleIds))
            return
          }
        } catch { /* repli local */ }
      }
      try {
        const saved: string[] = JSON.parse(localStorage.getItem(`fmt-passed-${level}`) || '[]')
        if (!cancelled && saved.length) setPassedIds(new Set(saved))
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [user?.id, level])

  if (!meta) return null

  const totalMin = modules.reduce((s, m) => s + (m.durationMin || 0), 0)
  const passedCount = modules.filter(m => passedIds.has(m.id)).length
  const firstTodo = modules.find(m => !passedIds.has(m.id))
  const started = passedCount > 0
  const ctaLabel = passedCount >= modules.length && modules.length > 0
    ? 'Revoir la formation'
    : started ? 'Reprendre la formation' : 'Démarrer la formation'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero présentation */}
      <section className="relative overflow-hidden text-white">
        <video src={`/covers/formations/niveau-${level}.mp4`} autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-br ${meta.color} opacity-90`} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Programme
          </Link>
          <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-bold mb-3">
            Niveau {level}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">{meta.title}</h1>
          <p className="mt-2 text-white/85 text-base sm:text-lg max-w-2xl">{meta.tagline}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={`/formations/niveau-${level}/apprendre`}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-300 text-[#3a4030] font-bold hover:bg-amber-200 transition-colors shadow-lg">
              <PlayCircle className="w-5 h-5" /> {ctaLabel}
            </Link>
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-2 rounded-lg text-sm font-semibold">
              <Award className="w-4 h-4 text-amber-200" /> {meta.financingCeiling}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {modules.length} leçons</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~{Math.round(totalMin / 60 * 10) / 10} h de contenu</span>
            <span className="inline-flex items-center gap-1.5"><Trophy className="w-4 h-4" /> XP, badges & certificat</span>
          </div>
          {started && (
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-xs text-white/80 mb-1">
                <span>{passedCount}/{modules.length} leçons terminées</span>
                <span>{Math.round((passedCount / Math.max(modules.length, 1)) * 100)} %</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-amber-300 rounded-full transition-all" style={{ width: `${(passedCount / Math.max(modules.length, 1)) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chemin de parcours */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Votre parcours</h2>
          <div className="relative">
            {/* Ligne verticale du chemin */}
            <div className="absolute left-[21px] top-5 bottom-5 w-1 bg-slate-200 rounded-full" />
            <div className="space-y-3">
              {modules.map((m) => {
                const isPassed = passedIds.has(m.id)
                const isCurrent = !isPassed && firstTodo?.id === m.id
                return (
                  <div key={m.id} className="relative flex items-start gap-4">
                    {/* Nœud du chemin */}
                    <span className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center font-black shrink-0 border-4 ${
                      isPassed
                        ? 'bg-[#697357] border-[#697357]/25 text-white'
                        : isCurrent
                          ? 'bg-amber-300 border-amber-200 text-[#3a4030] animate-pulse'
                          : 'bg-white border-slate-200 text-slate-300'
                    }`}>
                      {isPassed ? <CheckCircle2 className="w-5 h-5" /> : m.order}
                    </span>
                    {/* Carte du module */}
                    <div className={`flex-1 rounded-xl border p-4 ${
                      isCurrent ? 'bg-white border-amber-300 ring-2 ring-amber-200 shadow-sm' :
                      isPassed ? 'bg-[#697357]/5 border-[#697357]/20' : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={`font-semibold ${isPassed ? 'text-[#4d553e]' : 'text-slate-900'}`}>{m.title}</h3>
                          <p className="text-sm text-slate-500">{m.summary}</p>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 shrink-0"><Clock className="w-3.5 h-3.5" />{m.durationMin} min</span>
                      </div>
                      {isCurrent && (
                        <Link href={`/formations/niveau-${level}/apprendre`}
                          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-xs font-bold">
                          {started ? 'Reprendre ici' : 'Commencer ici'} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {isPassed && <span className="mt-2 inline-block text-xs font-semibold text-[#4d553e]">✓ Validé</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Ce que vous allez apprendre */}
        <aside className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#697357]" /> Ce que vous allez maîtriser</h3>
            <ul className="space-y-2">
              {meta.topics.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#697357] shrink-0 mt-0.5" /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#697357]/5 rounded-2xl border border-[#697357]/20 p-5 text-sm text-slate-700">
            <p className="font-semibold text-[#4d553e] mb-1">🔓 À la validation du niveau</p>
            Vous obtenez un <b>certificat</b> et débloquez la demande de financement <b>{meta.financingCeiling.toLowerCase()}</b>.
          </div>
          <Link href={`/formations/niveau-${level}/apprendre`}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold transition-colors">
            {ctaLabel} <ArrowRight className="w-5 h-5" />
          </Link>
        </aside>
      </div>
    </div>
  )
}
