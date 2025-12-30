/**
 * 🤖 HOOK: useAIStreaming
 * Hook pour consommer les réponses IA en streaming (SSE)
 * Affiche le texte mot par mot comme ChatGPT
 */

import { useState, useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type StreamingStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

interface UseAIStreamingOptions {
  onToken?: (token: string, fullContent: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

interface StreamingState {
  status: StreamingStatus;
  content: string;
  progress: number;
  error: string | null;
}

export function useAIStreaming(options: UseAIStreamingOptions = {}) {
  const { onToken, onComplete, onError, onProgress } = options;
  
  const [state, setState] = useState<StreamingState>({
    status: 'idle',
    content: '',
    progress: 0,
    error: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Démarre une génération en streaming
   */
  const startStreaming = useCallback(async (endpoint: string, body: object) => {
    // Annuler toute génération en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setState({
      status: 'connecting',
      content: '',
      progress: 0,
      error: null
    });

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming non supporté');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      setState(prev => ({ ...prev, status: 'streaming' }));

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  setState(prev => ({ ...prev, progress: 5 }));
                  break;
                  
                case 'token':
                  fullContent += data.content;
                  setState(prev => ({
                    ...prev,
                    content: fullContent,
                    progress: data.progress || prev.progress
                  }));
                  onToken?.(data.content, fullContent);
                  onProgress?.(data.progress);
                  break;
                  
                case 'complete':
                  fullContent = data.content;
                  setState(prev => ({
                    ...prev,
                    content: fullContent,
                    progress: 100,
                    status: 'complete'
                  }));
                  onComplete?.(fullContent);
                  break;
                  
                case 'error':
                  throw new Error(data.message);
                  
                case 'done':
                  setState(prev => ({ ...prev, status: 'complete' }));
                  break;
                  
                case 'heartbeat':
                  // Ignorer les heartbeats
                  break;
              }
            } catch (parseError) {
              // Ignorer les erreurs de parsing (lignes vides, etc.)
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState(prev => ({ ...prev, status: 'idle' }));
        return;
      }
      
      const errorMessage = error.message || 'Erreur de génération';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      onError?.(errorMessage);
    }
  }, [onToken, onComplete, onError, onProgress]);

  /**
   * Annule la génération en cours
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  /**
   * Réinitialise l'état
   */
  const reset = useCallback(() => {
    cancel();
    setState({
      status: 'idle',
      content: '',
      progress: 0,
      error: null
    });
  }, [cancel]);

  return {
    ...state,
    isStreaming: state.status === 'streaming' || state.status === 'connecting',
    startStreaming,
    cancel,
    reset
  };
}

/**
 * Hook simplifié pour générer du contenu avec streaming
 */
export function useGenerateContent() {
  const streaming = useAIStreaming();

  const generate = useCallback(async (prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
  } = {}) => {
    await streaming.startStreaming('/api/ai/stream', {
      prompt,
      ...options
    });
  }, [streaming]);

  return {
    ...streaming,
    generate
  };
}
