'use client'

import Link from 'next/link'
import { FORMATION_LEVELS } from '@/lib/formations'
import { MODULES_BY_LEVEL } from '@/lib/formations-content'
import {
  ArrowLeft, ArrowRight, PlayCircle, CheckCircle2, Clock, Trophy, Award, BookOpen, Sparkles,
} from 'lucide-react'

export default function LevelIntro({ level }: { level: number }) {
  const meta = FORMATION_LEVELS.find(l => l.level === level)
  const modules = MODULES_BY_LEVEL[level] || []
  if (!meta) return null

  const totalMin = modules.reduce((s, m) => s + (m.durationMin || 0), 0)

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
              <PlayCircle className="w-5 h-5" /> Démarrer la formation
            </Link>
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-2 rounded-lg text-sm font-semibold">
              <Award className="w-4 h-4 text-amber-200" /> {meta.financingCeiling}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {modules.length} modules</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~{Math.round(totalMin / 60 * 10) / 10} h de contenu</span>
            <span className="inline-flex items-center gap-1.5"><Trophy className="w-4 h-4" /> XP, badges & certificat</span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Programme */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Au programme</h2>
          <div className="space-y-2">
            {modules.map((m) => (
              <div key={m.id} className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4">
                <span className="w-7 h-7 rounded-lg bg-[#697357]/10 text-[#697357] font-bold flex items-center justify-center shrink-0">{m.order}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{m.title}</h3>
                  <p className="text-sm text-slate-500">{m.summary}</p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 shrink-0"><Clock className="w-3.5 h-3.5" />{m.durationMin} min</span>
              </div>
            ))}
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
            Démarrer la formation <ArrowRight className="w-5 h-5" />
          </Link>
        </aside>
      </div>
    </div>
  )
}
