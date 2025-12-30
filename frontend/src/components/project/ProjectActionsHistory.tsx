'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Clock, ExternalLink, FileText, GraduationCap, Rocket, Target } from 'lucide-react'
import { getProjectActions, getActionRedirectUrl } from '@/utils/project-tracking'

interface ProjectAction {
  id: string
  action_type: string
  action_status: string
  action_reference_id: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface Props {
  projectId: string
  compact?: boolean
}

export default function ProjectActionsHistory({ projectId, compact = false }: Props) {
  const [actions, setActions] = useState<ProjectAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActions()
  }, [projectId])

  const loadActions = async () => {
    setLoading(true)
    try {
      const data = await getProjectActions(projectId)
      setActions(data)
    } catch (error) {
      console.error('Erreur chargement actions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'action-plan': return <Rocket className="w-4 h-4" />
      case 'skill-test': return <Target className="w-4 h-4" />
      case 'custom-training': return <GraduationCap className="w-4 h-4" />
      case 'business-plan': return <FileText className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'action-plan': return 'Plan d\'action'
      case 'skill-test': return 'Test de compétence'
      case 'custom-training': return 'Formation sur mesure'
      case 'business-plan': return 'Business Plan'
      default: return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'in_progress': return 'text-blue-600 bg-blue-50'
      case 'pending': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Complété'
      case 'in_progress': return 'En cours'
      case 'pending': return 'En attente'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (actions.length === 0) {
    return compact ? null : (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune action encore effectuée</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {actions.slice(0, 3).map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              {getActionIcon(action.action_type)}
              <span>{getActionLabel(action.action_type)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(action.action_status)}`}>
                {getStatusLabel(action.action_status)}
              </span>
              {action.action_reference_id && (
                <a
                  href={getActionRedirectUrl(action.action_type, action.action_reference_id)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
        {actions.length > 3 && (
          <p className="text-xs text-gray-500 text-center">
            +{actions.length - 3} autre{actions.length - 3 > 1 ? 's' : ''} action{actions.length - 3 > 1 ? 's' : ''}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">
        📊 Historique des actions ({actions.length})
      </h4>
      {actions.map((action, index) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              {getActionIcon(action.action_type)}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {getActionLabel(action.action_type)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(action.created_at)}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(action.action_status)}`}>
                {action.action_status === 'completed' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {getStatusLabel(action.action_status)}
              </span>
            </div>
            
            {action.action_reference_id && (
              <a
                href={getActionRedirectUrl(action.action_type, action.action_reference_id)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2"
              >
                <ExternalLink className="w-3 h-3" />
                Voir le résultat
              </a>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
