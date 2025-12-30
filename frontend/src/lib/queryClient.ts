/**
 * 🔄 REACT QUERY - Configuration du client
 * 
 * Installation requise:
 * npm install @tanstack/react-query
 * 
 * Puis wrapper l'app dans providers.tsx avec QueryClientProvider
 */

import { QueryClient } from '@tanstack/react-query';

// Configuration du client React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache pendant 5 minutes
      staleTime: 5 * 60 * 1000,
      // Garder en cache 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry 2 fois en cas d'erreur
      retry: 2,
      // Refetch quand la fenêtre reprend le focus
      refetchOnWindowFocus: true,
      // Refetch quand la connexion revient
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry 1 fois pour les mutations
      retry: 1,
    },
  },
});

// Clés de query standardisées
export const queryKeys = {
  // Articles
  articles: ['articles'] as const,
  articleById: (id: string) => ['articles', id] as const,
  articlesHome: ['articles', 'home'] as const,
  articlesTrending: ['articles', 'trending'] as const,
  
  // Projets
  projects: ['projects'] as const,
  projectById: (id: string) => ['projects', id] as const,
  projectDocuments: (projectId: string) => ['projects', projectId, 'documents'] as const,
  projectActions: (projectId: string) => ['projects', projectId, 'actions'] as const,
  projectNotes: (projectId: string) => ['projects', projectId, 'notes'] as const,
  
  // Football
  footballFixtures: ['football', 'fixtures'] as const,
  
  // Events
  events: ['events'] as const,
  
  // Polls
  polls: ['polls'] as const,
  pollQuestions: (pollId: string) => ['polls', pollId, 'questions'] as const,
  
  // Game
  gameSessions: ['game', 'sessions'] as const,
  gameSession: (sessionId: string) => ['game', 'sessions', sessionId] as const,
  
  // User
  userCredits: (userId: string) => ['user', userId, 'credits'] as const,
  userAlerts: (userId: string) => ['user', userId, 'alerts'] as const,
};
