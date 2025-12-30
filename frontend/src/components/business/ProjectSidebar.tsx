'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, X, Trash2, RefreshCw } from 'lucide-react'

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
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 border-r border-white/10 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header avec bouton retour et fermeture mobile */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Retour aux projets</span>
          </button>
          
          {/* Bouton fermeture mobile uniquement */}
          <button
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div>
          
          <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">
            {projectTitle}
          </h2>
          
          {completionStats && (
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{completionStats.actions} actions</span>
              <span>•</span>
              <span>{completionStats.documents} docs</span>
              <span>•</span>
              <span>{completionStats.notes} notes</span>
            </div>
          )}
        </div>

        {/* Navigation par sections */}
        <nav className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Navigation
          </div>
          
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            
            return (
              <motion.button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full flex items-center justify-between p-4 rounded-xl transition-all
                  ${isActive 
                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50' 
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${isActive ? 'bg-purple-500/30' : 'bg-white/5'}
                  `}>
                    <Icon className={`w-5 h-5 ${isActive ? section.color : 'text-gray-400'}`} />
                  </div>
                  
                  <div className="text-left">
                    <div className={`font-semibold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {section.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {section.description}
                    </div>
                  </div>
                </div>
                
                {isActive && (
                  <ChevronRight className="w-5 h-5 text-purple-400" />
                )}
              </motion.button>
            )
          })}
        </nav>

        {/* Indicateur de progression (optionnel) */}
        {completionStats && (
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20">
            <div className="text-sm text-gray-400 mb-2">Progression</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (completionStats.actions / 10) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                />
              </div>
              <div className="text-sm font-bold text-purple-400">
                {Math.min(100, Math.round((completionStats.actions / 10) * 100))}%
              </div>
            </div>
          </div>
        )}

        {/* Actions du projet */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Actions
          </div>

          {/* Bouton Relancer l'analyse */}
          {onRestartAnalysis && (
            <motion.button
              onClick={onRestartAnalysis}
              disabled={isRestarting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
              <span>{isRestarting ? 'Relance en cours...' : 'Relancer l\'analyse'}</span>
            </motion.button>
          )}

          {/* Bouton Supprimer le projet */}
          {onDeleteProject && (
            <motion.button
              onClick={onDeleteProject}
              disabled={isDeleting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              <span>{isDeleting ? 'Suppression...' : 'Supprimer le projet'}</span>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
