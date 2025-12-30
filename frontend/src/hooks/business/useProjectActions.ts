/**
 * 🎯 HOOK: useProjectActions
 * Gère la logique des actions de projet (fetch, add, update)
 */

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProjectAction {
  id: string;
  project_id: string;
  action_type: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at?: string;
  metadata?: any;
}

export function useProjectActions() {
  const [projectActions, setProjectActions] = useState<{[key: string]: ProjectAction[]}>({});
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});

  const fetchProjectActions = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-actions/${projectId}`);
      const data = await response.json();
      
      if (data.success && data.actions) {
        setProjectActions(prev => ({
          ...prev,
          [projectId]: data.actions
        }));
      }
    } catch (error) {
      console.error('Erreur chargement actions:', error);
    }
  }, []);

  const addProjectAction = useCallback(async (
    projectId: string, 
    actionType: string, 
    title: string, 
    description?: string,
    metadata?: any
  ) => {
    setActionLoading(prev => ({ ...prev, [projectId]: true }));
    
    try {
      const response = await fetch(`${API_URL}/api/project-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          action_type: actionType,
          title,
          description,
          metadata
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchProjectActions(projectId);
        return { success: true, action: data.action };
      }
      
      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Erreur ajout action:', error);
      return { success: false, error: error.message };
    } finally {
      setActionLoading(prev => ({ ...prev, [projectId]: false }));
    }
  }, [fetchProjectActions]);

  const updateActionStatus = useCallback(async (
    actionId: string, 
    projectId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ) => {
    try {
      const response = await fetch(`${API_URL}/api/project-actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchProjectActions(projectId);
        return { success: true };
      }
      
      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Erreur mise à jour action:', error);
      return { success: false, error: error.message };
    }
  }, [fetchProjectActions]);

  const getActionsForProject = useCallback((projectId: string): ProjectAction[] => {
    return projectActions[projectId] || [];
  }, [projectActions]);

  const isLoading = useCallback((projectId: string): boolean => {
    return actionLoading[projectId] || false;
  }, [actionLoading]);

  return {
    projectActions,
    actionLoading,
    fetchProjectActions,
    addProjectAction,
    updateActionStatus,
    getActionsForProject,
    isLoading
  };
}
