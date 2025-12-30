/**
 * 🤖 HOOK: useAIModal
 * Gère l'état du modal de génération IA (progress, status, messages)
 */

import { useState, useCallback } from 'react';
import React from 'react';

export type AIModalStatus = 'generating' | 'success' | 'error';

export interface AIModalState {
  isOpen: boolean;
  status: AIModalStatus;
  progress: number;
  message: string;
  error: string;
  actionName: string;
  actionIcon: React.ReactNode | null;
}

const initialState: AIModalState = {
  isOpen: false,
  status: 'generating',
  progress: 0,
  message: '',
  error: '',
  actionName: '',
  actionIcon: null
};

export function useAIModal() {
  const [state, setState] = useState<AIModalState>(initialState);

  const openModal = useCallback((actionName: string, actionIcon?: React.ReactNode) => {
    setState({
      isOpen: true,
      status: 'generating',
      progress: 0,
      message: 'Analyse de votre projet...',
      error: '',
      actionName,
      actionIcon: actionIcon || null
    });
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const updateProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress,
      message: message || prev.message
    }));
  }, []);

  const setSuccess = useCallback((message?: string) => {
    setState(prev => ({
      ...prev,
      status: 'success',
      progress: 100,
      message: message || 'Génération terminée avec succès!'
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      status: 'error',
      error
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    openModal,
    closeModal,
    updateProgress,
    setSuccess,
    setError,
    reset
  };
}
