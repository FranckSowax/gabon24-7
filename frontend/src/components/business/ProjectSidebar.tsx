'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ChevronRight, X, Trash2, RefreshCw, Sparkles, Building2, Home,
  LayoutDashboard, ArrowUpRight
} from 'lucide-react'

const BCEG_LOGO = '/646710125_122187790628463229_813105913342150168_n.jpg'

interface Section {
  id: string
  title: string
  icon: any
  color: string
  description: string
  href?: string
}

type SidebarMode = 'dashboard' | 'finance' | 'workshop'

interface ProjectSidebarProps {
  sections: Section[]
  activeSection: string
  onSectionChange: (sectionId: string) => void
  onBack: () => void
  projectTitle: string
  projectId?: string
  completionStats?: {
    actions: number
    documents: number
    notes: number
  }
  /** Progression spécifique du dossier de financement (pièces uploadées vs requises) */
  financeProgressPct?: number
  mode?: SidebarMode
  onDeleteProject?: () => void
  onRestartAnalysis?: () => void
  isDeleting?: boolean
  isRestarting?: boolean
}

export default function ProjectSidebar({
  sections,
  activeSection,
  onSectionChange,
  onBack,
  projectTitle,
  projectId,
  completionStats,
  financeProgressPct,
  mode = 'workshop',
  onDeleteProject,
  onRestartAnalysis,
  isDeleting = false,
  isRestarting = false,
}: ProjectSidebarProps) {

  const progressPct = typeof financeProgressPct === 'number'
    ? Math.max(0, Math.min(100, Math.round(financeProgressPct)))
    : completionStats
      ? Math.min(100, Math.round((completionStats.actions / 10) * 100))
      : 0

  const isDashboard = mode === 'dashboard'
  const isFinance = mode === 'finance'

  return (
    <div className="w-full h-full bg-white border-r border-slate-200 overflow-y-auto">
      <div className="p-5 space-y-5">

        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-[#697357] transition-colors group text-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Retour aux projets</span>
          </button>
          <button
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Hero BCEG (toujours présent) — accent différent selon le mode */}
        <div className={`rounded-2xl p-5 text-white relative overflow-hidden shadow-lg ${
          isDashboard
            ? 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-800/20'
            : isFinance
              ? 'bg-gradient-to-br from-[#697357] to-[#4d553e] shadow-[#697357]/30'
              : 'bg-gradient-to-br from-[#697357] to-[#4d553e] shadow-[#697357]/20'
        }`}>
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <img src={BCEG_LOGO} alt="BCEG" className="w-7 h-7 rounded-full ring-2 ring-white/40" />
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-90">
                {isDashboard ? 'BCEG Project' : isFinance ? 'Mode financement' : 'Mode développement'}
              </span>
            </div>
            <h2 className="text-base font-bold leading-tight line-clamp-2 mb-1">
              {projectTitle}
            </h2>
            {!isDashboard && (
              <p className="text-xs opacity-80 mb-4 leading-relaxed">
                {isFinance
                  ? 'Préparons votre dossier pour la BCEG.'
                  : 'Construisons votre projet pièce par pièce.'}
              </p>
            )}
            {isDashboard && (
              <p className="text-xs opacity-80 mb-4 leading-relaxed">
                Choisissez votre mode dans la zone principale.
              </p>
            )}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="opacity-80">Progression vers le financement</span>
                <span className="font-bold">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-amber-300 to-amber-200"
                />
              </div>
            </div>
          </div>
        </div>

        {completionStats && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatPill value={completionStats.actions} label="Actions" />
            <StatPill value={completionStats.documents} label="Docs" />
            <StatPill value={completionStats.notes} label="Notes" />
          </div>
        )}

        {/* MODE DASHBOARD — sidebar épurée : juste un message + retour */}
        {isDashboard && (
          <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-300 p-4 text-center">
            <LayoutDashboard className="w-5 h-5 mx-auto text-slate-400 mb-1.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Cliquez sur l'une des deux cartes à droite pour ouvrir la
              <span className="font-bold text-[#697357]"> sidebar de fonctions</span> correspondante.
            </p>
          </div>
        )}

        {/* MODE FINANCE / WORKSHOP — nav avec sections + retour dashboard */}
        {!isDashboard && (
          <>
            <button
              onClick={() => onSectionChange('dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-all border border-slate-200"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Tableau de bord</span>
            </button>

            <nav className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                {isFinance ? 'Mon dossier de financement' : 'Mes outils projet'}
              </div>

              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                const isExternal = !!section.href

                const inner = (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                        ${isActive ? 'bg-[#697357]/20' : 'bg-slate-100'}
                      `}>
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#697357]' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${isActive ? 'text-[#697357]' : 'text-slate-800'}`}>
                          {section.title}
                        </div>
                        <div className={`text-[11px] truncate ${isActive ? 'text-slate-600' : 'text-slate-500'}`}>
                          {section.description}
                        </div>
                      </div>
                    </div>
                    {isExternal ? (
                      <ArrowUpRight className="w-4 h-4 shrink-0 ml-1 text-slate-400" />
                    ) : isActive ? (
                      <ChevronRight className="w-4 h-4 shrink-0 ml-1 text-[#697357]" />
                    ) : null}
                  </>
                )

                if (isExternal) {
                  return (
                    <motion.a
                      key={section.id}
                      href={section.href}
                      whileHover={{ x: 2 }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all text-left"
                    >
                      {inner}
                    </motion.a>
                  )
                }

                return (
                  <motion.button
                    key={section.id}
                    onClick={() => onSectionChange(section.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-xl transition-all text-left
                      ${isActive
                        ? 'bg-[#697357]/10 border border-[#697357]/30'
                        : 'bg-white border border-slate-200 hover:bg-slate-50'
                      }
                    `}
                  >
                    {inner}
                  </motion.button>
                )
              })}
            </nav>
          </>
        )}

        {/* CTA Soumettre BCEG en mode finance */}
        {isFinance && projectId && (
          <motion.a
            href={`/business/mes-projets/${projectId}/dossier-bceg`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold text-sm shadow-lg shadow-[#697357]/30 transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Soumettre à la BCEG</span>
            <Sparkles className="w-4 h-4 opacity-70" />
          </motion.a>
        )}

        {(onRestartAnalysis || onDeleteProject) && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Outils
            </div>

            {onRestartAnalysis && (
              <button
                onClick={onRestartAnalysis}
                disabled={isRestarting}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                <span>{isRestarting ? 'En cours…' : "Relancer l'analyse"}</span>
              </button>
            )}

            {onDeleteProject && (
              <button
                onClick={onDeleteProject}
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-all disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                <span>{isDeleting ? 'Suppression…' : 'Supprimer le projet'}</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-1">
      <div className="text-lg font-bold text-[#697357]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}
