'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, X, Trash2, RefreshCw, Sparkles, Building2 } from 'lucide-react'

const BCEG_LOGO = '/646710125_122187790628463229_813105913342150168_n.jpg'

interface Section {
  id: string
  title: string
  icon: any
  color: string
  description: string
}

interface ProjectSidebarProps {
  sections: Section[]
  activeSection: string
  onSectionChange: (sectionId: string) => void
  onBack: () => void
  projectTitle: string
  completionStats?: {
    actions: number
    documents: number
    notes: number
  }
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
  completionStats,
  onDeleteProject,
  onRestartAnalysis,
  isDeleting = false,
  isRestarting = false
}: ProjectSidebarProps) {

  const progressPct = completionStats
    ? Math.min(100, Math.round((completionStats.actions / 10) * 100))
    : 0

  return (
    <div className="w-full h-full bg-white border-r border-slate-200 overflow-y-auto">
      <div className="p-5 space-y-5">

        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-[#4d553e] transition-colors group text-sm"
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

        {/* Bandeau BCEG — La banque vous accompagne */}
        <div className="rounded-2xl bg-gradient-to-br from-[#4d553e] to-[#3a4030] p-5 text-white relative overflow-hidden shadow-lg shadow-[#4d553e]/20">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <img src={BCEG_LOGO} alt="BCEG" className="w-7 h-7 rounded-full ring-2 ring-white/40" />
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-90">BCEG Project</span>
            </div>
            <h2 className="text-base font-bold leading-tight line-clamp-2 mb-1">
              {projectTitle}
            </h2>
            <p className="text-xs opacity-80 mb-4 leading-relaxed">
              Nous vous accompagnons vers le financement de votre projet.
            </p>
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

        <nav className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Votre parcours
          </div>

          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            const isFinance = section.id === 'financement'

            return (
              <motion.button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full flex items-center justify-between p-3 rounded-xl transition-all text-left
                  ${isActive
                    ? isFinance
                      ? 'bg-gradient-to-r from-[#4d553e] to-[#3a4030] text-white shadow-md shadow-[#4d553e]/20'
                      : 'bg-[#4d553e]/10 border border-[#4d553e]/30'
                    : isFinance
                      ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
                      : 'bg-white border border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                    ${isActive
                      ? isFinance ? 'bg-white/15' : 'bg-[#4d553e]/20'
                      : isFinance ? 'bg-amber-200/60' : 'bg-slate-100'
                    }
                  `}>
                    <Icon className={`w-4 h-4 ${
                      isActive
                        ? isFinance ? 'text-white' : 'text-[#4d553e]'
                        : isFinance ? 'text-amber-700' : 'text-slate-500'
                    }`} />
                  </div>

                  <div className="min-w-0">
                    <div className={`text-sm font-semibold truncate ${
                      isActive
                        ? isFinance ? 'text-white' : 'text-[#4d553e]'
                        : 'text-slate-800'
                    }`}>
                      {section.title}
                      {isFinance && !isActive && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">★</span>
                      )}
                    </div>
                    <div className={`text-[11px] truncate ${
                      isActive
                        ? isFinance ? 'text-white/70' : 'text-slate-600'
                        : 'text-slate-500'
                    }`}>
                      {section.description}
                    </div>
                  </div>
                </div>

                {isActive && (
                  <ChevronRight className={`w-4 h-4 shrink-0 ml-1 ${isFinance ? 'text-white' : 'text-[#4d553e]'}`} />
                )}
              </motion.button>
            )
          })}
        </nav>

        {activeSection !== 'financement' && sections.some(s => s.id === 'financement') && (
          <motion.button
            onClick={() => onSectionChange('financement')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-[#4d553e] to-[#3a4030] hover:from-[#3a4030] hover:to-[#2c3324] text-white font-bold text-sm shadow-lg shadow-[#4d553e]/30 transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Demander un financement</span>
            <Sparkles className="w-4 h-4 opacity-70" />
          </motion.button>
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
      <div className="text-lg font-bold text-[#4d553e]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}
