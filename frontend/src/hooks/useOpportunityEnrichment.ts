'use client';

import { useState, useCallback } from 'react';
import { API_URL } from '@/lib/api-config';

interface EnrichmentData {
  status: string;
  level: string;
  factual_data?: any;
  market_research?: any;
  confidence_score?: number;
  data_sources: string[];
  upgrade_available: boolean;
  upgrade_message?: string;
}

interface UseOpportunityEnrichmentResult {
  enrichment: EnrichmentData | null;
  isEnriching: boolean;
  error: string | null;
  enrichOpportunity: (opportunityId: string, level?: 'basic' | 'premium') => Promise<void>;
}

export function useOpportunityEnrichment(): UseOpportunityEnrichmentResult {
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichOpportunity = useCallback(async (opportunityId: string, level: 'basic' | 'premium' = 'basic') => {
    setIsEnriching(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/opportunities/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunityId,
          enrichmentLevel: level,
          userId: 'demo-user' // À remplacer par l'ID utilisateur réel
        }),
      });

      if (response.status === 402) {
        const errorData = await response.json();
        throw new Error(`Crédits insuffisants: ${errorData.required_credits} crédits requis`);
      }

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      setEnrichment({
        status: data.enrichment_status,
        level: data.enrichment_level,
        factual_data: data.factual_data,
        market_research: data.market_research,
        confidence_score: data.confidence_score,
        data_sources: data.data_sources || [],
        upgrade_available: data.enrichment_level === 'basic',
        upgrade_message: data.upgrade_message
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('Erreur enrichissement:', err);
    } finally {
      setIsEnriching(false);
    }
  }, []);

  return {
    enrichment,
    isEnriching,
    error,
    enrichOpportunity
  };
}
