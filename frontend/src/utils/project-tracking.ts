/**
 * Utility pour tracker les actions sur les projets sauvegardés
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface TrackActionParams {
  projectId: string
  userId: string
  actionType: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan'
  actionReferenceId?: string
  metadata?: Record<string, any>
}

export async function trackProjectAction(params: TrackActionParams): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/project-actions/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Action trackée:', params.actionType)
      return true
    } else {
      console.warn('⚠️ Erreur tracking action:', data.error)
      return false
    }
  } catch (error) {
    console.error('❌ Erreur tracking action:', error)
    return false
  }
}

export function getActionRedirectUrl(actionType: string, referenceId?: string): string {
  switch (actionType) {
    case 'action-plan':
      return `/business/mes-projets?tab=plans${referenceId ? `&id=${referenceId}` : ''}`
    case 'skill-test':
      return `/business/mes-projets?tab=tests${referenceId ? `&id=${referenceId}` : ''}`
    case 'custom-training':
      return `/business/formations${referenceId ? `?id=${referenceId}` : ''}`
    case 'business-plan':
      return `/business/mes-projets?tab=docs${referenceId ? `&id=${referenceId}` : ''}`
    default:
      return '/business/mes-projets'
  }
}

export async function getProjectActions(projectId: string) {
  try {
    const response = await fetch(`${API_URL}/api/project-actions/${projectId}`)
    const data = await response.json()
    
    if (data.success) {
      return data.actions || []
    }
    return []
  } catch (error) {
    console.error('❌ Erreur récupération actions:', error)
    return []
  }
}

export async function getUserActionsSummary(userId: string) {
  try {
    const response = await fetch(`${API_URL}/api/project-actions/user/${userId}/summary`)
    const data = await response.json()
    
    if (data.success) {
      return data.summary
    }
    return null
  } catch (error) {
    console.error('❌ Erreur récupération summary:', error)
    return null
  }
}
