'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Building2, ArrowRight, Sparkles } from 'lucide-react'

interface ProjectDashboardProps {
  project: any
  actions: any[]
  documents: any[]
  timeline: any[]
  notes: any[]
  onNavigateSection?: (section: string) => void
}

export default function ProjectDashboard({
  project,
  onNavigateSection,
}: ProjectDashboardProps) {

  return (
    <div className="space-y-6">

      {/* 1. Synthèse du projet — hero vert BCEG */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#697357] to-[#4d553e] p-6 sm:p-8 text-white shadow-lg shadow-[#697357]/20"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 mb-1">
                Votre projet
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">
                {project.proposition_titre}
              </h1>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-4xl sm:text-5xl font-black ${
                project.proposition_score_faisabilite >= 80 ? 'text-emerald-300' :
                project.proposition_score_faisabilite >= 60 ? 'text-amber-300' :
                'text-rose-300'
              }`}>
                {project.proposition_score_faisabilite ?? '—'}{project.proposition_score_faisabilite && '%'}
              </div>
              <div className="text-[11px] uppercase tracking-wider opacity-75">Score de faisabilité</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <SynthesisTile label="Secteur" value={project.secteur_selectionne || '—'} />
            <SynthesisTile label="Budget" value={project.budget_selectionne || '—'} />
            <SynthesisTile label="Phase" value={project.current_phase || 'Idée'} />
          </div>
        </div>
      </motion.div>

      {/* 2. Les 2 chemins */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-5">
          Que voulez-vous faire maintenant ?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Choix 1 — Continuer à développer (Outils IA) */}
          <motion.button
            onClick={() => onNavigateSection?.('outils')}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-[#697357]/40 p-6 text-left shadow-md hover:shadow-xl transition-all"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#697357]/5 blur-3xl group-hover:bg-[#697357]/10 transition-all" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#697357]/10 ring-1 ring-[#697357]/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#697357]" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Outils IA
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Continuer à développer mon projet
              </h3>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-sm font-bold text-[#697357]">Explorer les outils</span>
                <span className="w-9 h-9 rounded-full bg-[#697357] text-white flex items-center justify-center group-hover:bg-[#4d553e] transition-all">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </motion.button>

          {/* Choix 2 — Financement BCEG (Prioritaire) */}
          <motion.button
            onClick={() => onNavigateSection?.('financement')}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#697357] to-[#4d553e] p-6 text-white text-left shadow-xl shadow-[#697357]/30 hover:shadow-2xl transition-all"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-amber-200" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30">
                  ★ Prioritaire
                </span>
              </div>

              <h3 className="text-xl font-bold mb-4">
                Préparer mon dossier de financement
              </h3>

              <div className="flex items-center justify-between pt-4 border-t border-white/15">
                <span className="text-sm font-bold">Démarrer le parcours</span>
                <span className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center group-hover:bg-amber-300 group-hover:text-[#4d553e] transition-all">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </motion.button>

        </div>
      </div>

    </div>
  )
}

function SynthesisTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/15">
      <div className="text-[10px] uppercase tracking-wider text-white/70 mb-0.5 font-bold">{label}</div>
      <div className="text-white font-semibold text-sm truncate">{value}</div>
    </div>
  )
}
