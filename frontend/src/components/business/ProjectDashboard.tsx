'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Zap, FileText, Clock, Target, Building2, ArrowRight,
  Sparkles, BookOpen, Award, CheckCircle2
} from 'lucide-react'

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
  actions,
  documents,
  timeline,
  notes,
  onNavigateSection,
}: ProjectDashboardProps) {

  const completedActions = actions?.filter(a => a.action_status === 'completed').length || 0
  const totalActions = actions?.length || 0
  const documentsCount = documents?.length || 0
  const timelineCount = timeline?.length || 0
  const notesCount = notes?.length || 0

  const hasBusinessPlan = (actions || []).some(a =>
    a.action_type === 'business-plan' || a.action_type === 'business-plan-section'
  )

  return (
    <div className="space-y-6">

      {/* 1. Synthèse du projet — hero vert BCEG */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4d553e] to-[#3a4030] p-6 sm:p-8 text-white shadow-lg shadow-[#4d553e]/20"
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
              {project.problematique_centrale && (
                <p className="text-sm opacity-85 mt-2 leading-relaxed line-clamp-2">
                  {project.problematique_centrale}
                </p>
              )}
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
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
            Que voulez-vous faire maintenant ?
          </h2>
          <p className="text-sm text-slate-600">
            Choisissez votre prochaine étape — vous pouvez basculer à tout moment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Choix 1 — Financement BCEG */}
          <motion.button
            onClick={() => onNavigateSection?.('financement')}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4d553e] to-[#3a4030] p-6 text-white text-left shadow-xl shadow-[#4d553e]/30 hover:shadow-2xl transition-all"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-amber-200" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30">
                  ★ Prioritaire
                </span>
              </div>

              <h3 className="text-xl font-bold mb-1.5">
                Préparer mon dossier de financement
              </h3>
              <p className="text-sm opacity-85 mb-4 leading-relaxed">
                BCEG vous accompagne : checklist documents, BCEG Score™, business plan,
                soumission en 1 clic. Crédits dès 5 % (CATR / FAMAD).
              </p>

              <ul className="space-y-1.5 text-xs opacity-90 mb-5">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Workflow guidé en 6 étapes</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Score BCEG calculé en temps réel</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Dossier PDF + soumission directe</li>
              </ul>

              <div className="flex items-center justify-between pt-4 border-t border-white/15">
                <span className="text-sm font-bold">Démarrer le parcours</span>
                <span className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center group-hover:bg-amber-300 group-hover:text-[#3a4030] transition-all">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </motion.button>

          {/* Choix 2 — Continuer à développer */}
          <motion.button
            onClick={() => onNavigateSection?.('outils')}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-[#4d553e]/40 p-6 text-left shadow-md hover:shadow-xl transition-all"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#4d553e]/5 blur-3xl group-hover:bg-[#4d553e]/10 transition-all" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#4d553e]/10 ring-1 ring-[#4d553e]/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#4d553e]" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Outils IA
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1.5">
                Continuer à développer mon projet
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Affinez votre business plan, générez un plan d'action, testez vos compétences,
                construisez votre pitch — tous les outils IA pour avancer.
              </p>

              <ul className="space-y-1.5 text-xs text-slate-700 mb-5">
                <li className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 shrink-0 text-[#4d553e]" /> Business plan en 10 sections</li>
                <li className="flex items-center gap-2"><Target className="w-3.5 h-3.5 shrink-0 text-[#4d553e]" /> Plan d'action détaillé</li>
                <li className="flex items-center gap-2"><Award className="w-3.5 h-3.5 shrink-0 text-[#4d553e]" /> Tests, formations, pitch deck</li>
              </ul>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-sm font-bold text-[#4d553e]">Explorer les outils</span>
                <span className="w-9 h-9 rounded-full bg-[#4d553e] text-white flex items-center justify-center group-hover:bg-[#3a4030] transition-all">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </motion.button>

        </div>
      </div>

      {/* 3. Stats compactes (résumé) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip icon={Zap} label="Actions IA" value={completedActions} hint={`sur ${totalActions} lancées`} />
        <StatChip icon={FileText} label="Documents" value={documentsCount} hint="générés" />
        <StatChip icon={Clock} label="Événements" value={timelineCount} hint="dans l'historique" />
        <StatChip icon={TrendingUp} label="Notes" value={notesCount} hint="personnelles" />
      </div>

      {/* 4. Helper hint */}
      {!hasBusinessPlan && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 text-sm text-amber-900">
            <div className="font-bold mb-0.5">💡 Conseil de la BCEG</div>
            <div className="opacity-90">
              Pour démarrer fort, générez d'abord votre <b>Business Plan</b> via les Outils IA —
              c'est la pièce maîtresse de votre dossier de financement.
            </div>
          </div>
        </div>
      )}

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

function StatChip({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number; hint: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-4 h-4 text-[#4d553e]" />
        <div className="text-xl font-bold text-slate-900">{value}</div>
      </div>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>
    </div>
  )
}
