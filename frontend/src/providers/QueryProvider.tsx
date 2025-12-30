'use client';

/**
 * 🔄 QUERY PROVIDER
 * Configuration React Query pour la gestion d'état et cache
 */

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Configuration du client React Query
function makeQueryClient() {
  return new QueryClient({
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
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: toujours créer un nouveau client
    return makeQueryClient();
  } else {
    // Browser: réutiliser le client existant
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools uniquement en développement */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
