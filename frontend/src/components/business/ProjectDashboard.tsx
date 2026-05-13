'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Zap, FileText, Clock, Target, Award, CheckCircle, AlertCircle } from 'lucide-react'

interface ProjectDashboardProps {
  project: any
  actions: any[]
  documents: any[]
  timeline: any[]
  notes: any[]
}

export default function ProjectDashboard({
  project,
  actions,
  documents,
  timeline,
  notes
}: ProjectDashboardProps) {
  
  // Calculs des statistiques
  const completedActions = actions?.filter(a => a.action_status === 'completed').length || 0
  const totalActions = actions?.length || 0
  const progressPercentage = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0
  
  const documentsCount = documents?.length || 0
  const timelineCount = timeline?.length || 0
  const notesCount = notes?.length || 0
  
  // Score de faisabilité avec couleur
  const getFeasibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-orange-400'
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header du projet */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#4d553e] to-[#3a4030] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg shadow-[#4d553e]/20"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">{project.proposition_titre}</h1>
            <p className="text-white/80 text-sm sm:text-base">{project.secteur_selectionne}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-4xl sm:text-5xl font-bold ${
              project.proposition_score_faisabilite >= 80 ? 'text-green-400' :
              project.proposition_score_faisabilite >= 60 ? 'text-yellow-400' :
              'text-orange-400'
            }`}>
              {project.proposition_score_faisabilite}%
            </div>
            <div className="text-xs sm:text-sm text-white/70">Score de faisabilité</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Secteur</div>
            <div className="text-white font-semibold">{project.secteur_selectionne}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Budget</div>
            <div className="text-white font-semibold">{project.budget_selectionne}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-sm text-gray-400 mb-1">Phase</div>
            <div className="text-white font-semibold capitalize">{project.current_phase || 'Idée'}</div>
          </div>
        </div>
      </motion.div>

      {/* Problématique Centrale */}
      {project.problematique_centrale && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Problématique Centrale
          </h3>
          <p className="text-gray-300 leading-relaxed">
            {project.problematique_centrale}
          </p>
        </motion.div>
      )}

      {/* Barre de progression globale */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            Progression Globale
          </h3>
          <div className="text-3xl font-bold text-blue-400">{progressPercentage}%</div>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-400">
          <span>{completedActions} actions complétées</span>
          <span>{totalActions} actions total</span>
        </div>
      </motion.div>

      {/* Statistiques en grille */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {/* Actions IA */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-yellow-400" />
            <div className="text-2xl font-bold text-white">{completedActions}</div>
          </div>
          <div className="text-sm text-gray-300">Actions IA</div>
          <div className="text-xs text-gray-400 mt-1">sur {totalActions} lancées</div>
        </div>

        {/* Documents */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-400" />
            <div className="text-2xl font-bold text-white">{documentsCount}</div>
          </div>
          <div className="text-sm text-gray-300">Documents</div>
          <div className="text-xs text-gray-400 mt-1">générés</div>
        </div>

        {/* Historique */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-4 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-indigo-400" />
            <div className="text-2xl font-bold text-white">{timelineCount}</div>
          </div>
          <div className="text-sm text-gray-300">Événements</div>
          <div className="text-xs text-gray-400 mt-1">dans l'historique</div>
        </div>

        {/* Notes */}
        <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-xl p-4 border border-pink-500/20">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-pink-400" />
            <div className="text-2xl font-bold text-white">{notesCount}</div>
          </div>
          <div className="text-sm text-gray-300">Notes</div>
          <div className="text-xs text-gray-400 mt-1">personnelles</div>
        </div>
      </motion.div>

      {/* Actions récentes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-purple-400" />
          Actions Récentes
        </h3>
        
        {actions && actions.length > 0 ? (
          <div className="space-y-3">
            {actions.slice(0, 5).map((action: any) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {action.action_status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                  )}
                  <div>
                    <div className="text-white font-medium capitalize">
                      {action.action_type.replace('-', ' ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(action.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  action.action_status === 'completed' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {action.action_status === 'completed' ? 'Terminé' : 'En cours'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune action pour le moment</p>
          </div>
        )}
      </motion.div>

      {/* Prochaines étapes suggérées */}
      {project.proposition_actions_immediates && project.proposition_actions_immediates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/20"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Prochaines Étapes Recommandées
          </h3>
          <div className="space-y-2">
            {project.proposition_actions_immediates.slice(0, 3).map((action: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-sm font-bold">{idx + 1}</span>
                </div>
                <p className="text-gray-300 text-sm">{action}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
