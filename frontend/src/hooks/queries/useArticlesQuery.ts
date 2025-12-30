/**
 * 📰 HOOK: useArticlesQuery
 * Exemple de hook React Query pour les articles
 * 
 * Installation requise: npm install @tanstack/react-query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
interface Article {
  id: string;
  title: string;
  summary: string;
  content?: string;
  image_url?: string;
  published_at: string;
  category?: string;
  source?: string;
  view_count?: number;
}

interface ArticlesResponse {
  success: boolean;
  articles: Article[];
  total?: number;
}

// Fonctions de fetch
const fetchHomeArticles = async (): Promise<Article[]> => {
  const response = await fetch(`${API_URL}/api/homepage/articles`);
  const data: ArticlesResponse = await response.json();
  if (!data.success) throw new Error('Erreur chargement articles');
  return data.articles;
};

const fetchTrendingArticles = async (): Promise<Article[]> => {
  const response = await fetch(`${API_URL}/api/articles/trending`);
  const data: ArticlesResponse = await response.json();
  if (!data.success) throw new Error('Erreur chargement tendances');
  return data.articles;
};

const fetchArticleById = async (id: string): Promise<Article> => {
  const response = await fetch(`${API_URL}/api/articles/${id}`);
  const data = await response.json();
  if (!data.success) throw new Error('Article non trouvé');
  return data.article;
};

const incrementArticleView = async (id: string): Promise<void> => {
  await fetch(`${API_URL}/api/articles/${id}/view`, { method: 'POST' });
};

// Hooks React Query

/**
 * Hook pour les articles de la page d'accueil
 * - Cache automatique pendant 5 minutes
 * - Refetch automatique au focus
 */
export function useHomeArticles() {
  return useQuery({
    queryKey: queryKeys.articlesHome,
    queryFn: fetchHomeArticles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook pour les articles tendances
 */
export function useTrendingArticles() {
  return useQuery({
    queryKey: queryKeys.articlesTrending,
    queryFn: fetchTrendingArticles,
    staleTime: 2 * 60 * 1000, // 2 minutes (tendances changent plus vite)
  });
}

/**
 * Hook pour un article spécifique
 */
export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.articleById(id || ''),
    queryFn: () => fetchArticleById(id!),
    enabled: !!id, // Ne fetch que si id est défini
    staleTime: 10 * 60 * 1000, // 10 minutes (article change rarement)
  });
}

/**
 * Mutation pour incrémenter les vues
 */
export function useIncrementView() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: incrementArticleView,
    onSuccess: (_, articleId) => {
      // Invalider le cache de l'article pour refetch
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.articleById(articleId) 
      });
    },
  });
}

/**
 * Hook pour prefetch un article (hover sur un lien)
 */
export function usePrefetchArticle() {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.articleById(id),
      queryFn: () => fetchArticleById(id),
      staleTime: 10 * 60 * 1000,
    });
  };
}
