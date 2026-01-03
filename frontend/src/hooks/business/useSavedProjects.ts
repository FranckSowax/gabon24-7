import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache global pour les projets (évite les re-fetch inutiles)
const projectsCache: {
  data: SavedProject[] | null;
  timestamp: number;
  userId: string | null;
} = {
  data: null,
  timestamp: 0,
  userId: null
};

const CACHE_DURATION = 30000; // 30 secondes

// Helper pour obtenir les headers avec token d'authentification
const getAuthHeaders = async (): Promise<HeadersInit> => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
};

export interface SavedProject {
  id: string;
  article_title: string;
  article_summary: string;
  article_url: string;
  article_image_url?: string;
  article_source?: string;
  article_published_at?: string;
  problematique_centrale: string;
  secteur_principal: string;
  secteur_selectionne: string;
  budget_selectionne: string;
  proposition_titre: string;
  proposition_description: string;
  proposition_problematique?: string | null;
  proposition_investissement: string;
  proposition_rentabilite: string;
  proposition_revenus_mensuels: string;
  proposition_actions_immediates: string[];
  proposition_avantages_concurrentiels: string[];
  proposition_score_faisabilite: number;
  user_context?: any;
  created_at: string;
  plan_action_steps?: {
    step: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'completed';
  }[];
  current_phase?: string;
  progress_percentage?: number;
  total_credits_used?: number;
  related_articles?: any[];
  context_updated_at?: string;
  cumulative_context?: any[];
  // Champs pour projets partagés
  is_shared?: boolean;
  collaboration?: {
    role: string;
    permissions: {
      can_view: boolean;
      can_comment: boolean;
      can_edit: boolean;
      can_add_documents: boolean;
    };
    joined_at: string;
  };
}

export interface ProjectStats {
  total_projects: number;
  projects_by_sector: Record<string, number>;
  projects_by_budget: Record<string, number>;
  recent_projects_count: number;
}

export function useSavedProjects(userId?: string) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const fetchInProgressRef = useRef(false);

  const fetchProjects = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Éviter les requêtes simultanées
    if (fetchInProgressRef.current) {
      return;
    }

    // Vérifier le cache (sauf si forceRefresh)
    const now = Date.now();
    if (
      !forceRefresh &&
      projectsCache.data &&
      projectsCache.userId === userId &&
      now - projectsCache.timestamp < CACHE_DURATION
    ) {
      setProjects(projectsCache.data);
      setLoading(false);
      return;
    }

    fetchInProgressRef.current = true;

    try {
      // Une seule requête qui inclut les projets partagés
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/api/saved-projects?include_shared=true`,
        { headers }
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.projects)) {
        // Mettre en cache
        projectsCache.data = data.projects;
        projectsCache.timestamp = Date.now();
        projectsCache.userId = userId;

        setProjects(data.projects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [userId]);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    // Stats en background, pas bloquant
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/saved-projects/stats`, { headers });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [userId]);

  // Invalider le cache (appelé après création/suppression)
  const invalidateCache = useCallback(() => {
    projectsCache.data = null;
    projectsCache.timestamp = 0;
  }, []);

  const deleteProject = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/saved-projects/${projectId}`, {
        method: 'DELETE',
        headers
      });

      // Invalider le cache et mettre à jour l'état local
      invalidateCache();
      setProjects(projects.filter(p => p.id !== projectId));

      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }

      fetchStats();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const selectProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(project || null);
  };

  // Toggle step status
  const updateProjectStepStatus = async (projectId: string, stepNumber: number) => {
    const project = projects.find(p => p.id === projectId);
    if (!project?.plan_action_steps) return;

    // Copier et toggle
    const updatedSteps = project.plan_action_steps.map((step: any) => {
      if (step.step === stepNumber) {
        const newStatus = step.status === 'completed' ? 'todo' : step.status === 'todo' ? 'in_progress' : 'completed';
        return { ...step, status: newStatus };
      }
      return step;
    });

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/saved-projects/${projectId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ plan_action_steps: updatedSteps })
      });

      // Mettre à jour l'état local
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, plan_action_steps: updatedSteps } : p
      ));
      
      // Mettre à jour le projet sélectionné aussi
      if (selectedProject?.id === projectId) {
        setSelectedProject(prev => prev ? { ...prev, plan_action_steps: updatedSteps } : null);
      }

    } catch (error) {
      console.error('Error updating step status:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
    // Stats en parallèle, non bloquant
    fetchStats();
  }, [fetchProjects, fetchStats]);

  return {
    projects,
    loading,
    selectedProject,
    stats,
    setSelectedProject,
    selectProject,
    deleteProject,
    updateProjectStepStatus,
    refreshProjects: () => fetchProjects(true), // Force refresh
    invalidateCache
  };
}
