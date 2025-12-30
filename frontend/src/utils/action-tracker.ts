/**
 * 🎯 ACTION TRACKER HELPER
 * Automatise l'enregistrement des actions IA sur les projets
 */

import { trackProjectAction } from './project-tracking'

interface ActionTrackerContext {
  userId: string
  projectId?: string | null
  articleId?: string
  proposalData?: {
    titre: string
    secteur?: string
    budget?: string
    description?: string
  }
}

/**
 * Track une action automatiquement avec contexte enrichi
 */
export async function autoTrackAction(
  actionType: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan',
  referenceId: string | null,
  context: ActionTrackerContext
): Promise<boolean> {
  try {
    // Si pas de projectId, on ne peut pas tracker
    if (!context.projectId) {
      console.warn('⚠️ Impossible de tracker l\'action: projectId manquant')
      return false
    }

    console.log(`📊 Auto-tracking action: ${actionType}`, {
      projectId: context.projectId,
      referenceId,
      hasProposal: !!context.proposalData
    })

    const metadata = {
      article_id: context.articleId,
      proposition_titre: context.proposalData?.titre,
      secteur: context.proposalData?.secteur,
      budget: context.proposalData?.budget,
      tracked_at: new Date().toISOString()
    }

    const success = await trackProjectAction({
      projectId: context.projectId,
      userId: context.userId,
      actionType,
      actionReferenceId: referenceId || undefined,
      metadata
    })

    if (success) {
      console.log(`✅ Action ${actionType} trackée avec succès`)
    } else {
      console.error(`❌ Échec tracking action ${actionType}`)
    }

    return success

  } catch (error) {
    console.error('❌ Erreur auto-tracking:', error)
    return false
  }
}

/**
 * Hook pour gérer le projectId dans l'URL ou le state
 */
export function useProjectIdFromContext(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Essayer depuis l'URL
    const params = new URLSearchParams(window.location.search)
    const urlProjectId = params.get('projectId')
    if (urlProjectId) {
      console.log('📌 ProjectId trouvé dans URL:', urlProjectId)
      return urlProjectId
    }

    // Essayer depuis sessionStorage (sauvegarde récente)
    const recentProjectId = sessionStorage.getItem('recent_project_id')
    if (recentProjectId) {
      console.log('📌 ProjectId trouvé dans session:', recentProjectId)
      return recentProjectId
    }

    return null
  } catch (error) {
    console.error('Erreur récupération projectId:', error)
    return null
  }
}

/**
 * Sauvegarde le projectId dans sessionStorage pour usage ultérieur
 */
export function saveProjectIdToSession(projectId: string) {
  try {
    sessionStorage.setItem('recent_project_id', projectId)
    sessionStorage.setItem('recent_project_timestamp', Date.now().toString())
    console.log('💾 ProjectId sauvegardé en session:', projectId)
  } catch (error) {
    console.error('Erreur sauvegarde projectId:', error)
  }
}

/**
 * Nettoie le projectId de la session (après navigation ou expiration)
 */
export function clearProjectIdFromSession() {
  try {
    sessionStorage.removeItem('recent_project_id')
    sessionStorage.removeItem('recent_project_timestamp')
    console.log('🗑️ ProjectId effacé de la session')
  } catch (error) {
    console.error('Erreur nettoyage projectId:', error)
  }
}

/**
 * Wrapper pour les actions du plan d'action
 */
export async function trackActionPlanGeneration(
  planId: string,
  context: ActionTrackerContext
) {
  return await autoTrackAction('action-plan', planId, context)
}

/**
 * Wrapper pour les actions de test de compétence
 */
export async function trackSkillTestGeneration(
  testId: string,
  context: ActionTrackerContext
) {
  return await autoTrackAction('skill-test', testId, context)
}

/**
 * Wrapper pour les actions de formation
 */
export async function trackTrainingGeneration(
  trainingId: string,
  context: ActionTrackerContext
) {
  return await autoTrackAction('custom-training', trainingId, context)
}

/**
 * Wrapper pour les actions de business plan
 */
export async function trackBusinessPlanGeneration(
  businessPlanId: string,
  context: ActionTrackerContext
) {
  return await autoTrackAction('business-plan', businessPlanId, context)
}

/**
 * Batch tracking: track plusieurs actions d'un coup
 */
export async function batchTrackActions(
  actions: Array<{
    type: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan'
    referenceId: string | null
  }>,
  context: ActionTrackerContext
): Promise<boolean[]> {
  console.log(`📊 Batch tracking de ${actions.length} actions`)
  
  const results = await Promise.all(
    actions.map(action => 
      autoTrackAction(action.type, action.referenceId, context)
    )
  )

  const successCount = results.filter(r => r).length
  console.log(`✅ ${successCount}/${actions.length} actions trackées avec succès`)

  return results
}

/**
 * Vérifier si une action a déjà été effectuée sur un projet
 */
export async function checkActionExists(
  projectId: string,
  actionType: string
): Promise<boolean> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${API_URL}/api/project-actions/${projectId}`)
    const data = await response.json()

    if (data.success && data.actions) {
      const exists = data.actions.some((a: any) => 
        a.action_type === actionType && a.action_status === 'completed'
      )
      return exists
    }

    return false
  } catch (error) {
    console.error('Erreur vérification action:', error)
    return false
  }
}

/**
 * Obtenir le statut de toutes les actions d'un projet
 */
export async function getProjectActionsSummary(projectId: string): Promise<{
  [key: string]: 'done' | 'pending' | 'none'
}> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${API_URL}/api/project-actions/${projectId}`)
    const data = await response.json()

    const summary: { [key: string]: 'done' | 'pending' | 'none' } = {
      'action-plan': 'none',
      'skill-test': 'none',
      'custom-training': 'none',
      'business-plan': 'none'
    }

    if (data.success && data.actions) {
      data.actions.forEach((action: any) => {
        summary[action.action_type] = action.action_status === 'completed' ? 'done' : 'pending'
      })
    }

    return summary
  } catch (error) {
    console.error('Erreur récupération summary:', error)
    return {
      'action-plan': 'none',
      'skill-test': 'none',
      'custom-training': 'none',
      'business-plan': 'none'
    }
  }
}

export default {
  autoTrackAction,
  useProjectIdFromContext,
  saveProjectIdToSession,
  clearProjectIdFromSession,
  trackActionPlanGeneration,
  trackSkillTestGeneration,
  trackTrainingGeneration,
  trackBusinessPlanGeneration,
  batchTrackActions,
  checkActionExists,
  getProjectActionsSummary
}
