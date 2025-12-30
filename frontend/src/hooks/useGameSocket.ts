/**
 * 🎮 HOOK WEBSOCKET POUR LE JEU
 * Gère la connexion WebSocket et la synchronisation des timers
 * - Reconnexion automatique
 * - Resynchronisation sur visibilitychange (mobile)
 * - Timer basé sur le temps serveur
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Types
export interface Question {
  id: string;
  round: number;
  question: string;
  answers: string[];
  correct: number;
  timeLimit: number;
  difficulty: string;
  serverTime: number;
  totalQuestions: number;
}

export interface SyncState {
  sessionId: string;
  phase: 'waiting' | 'question' | 'result' | 'pact' | 'finished';
  serverTime: number;
  remainingTime: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: Question | null;
  participantCount: number;
}

export interface GameSocketHook {
  isConnected: boolean;
  phase: string;
  remainingTime: number;
  currentQuestion: Question | null;
  participantCount: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  joinSession: (sessionId: string, playerName?: string) => void;
  leaveSession: () => void;
  submitAnswer: (answerIndex: number) => void;
  requestSync: () => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app';

export function useGameSocket(): GameSocketHook {
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [phase, setPhase] = useState<string>('waiting');
  const [remainingTime, setRemainingTime] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  
  // Référence pour le temps serveur et la durée
  const serverTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  /**
   * Calculer le temps restant basé sur le temps serveur
   */
  const calculateRemainingTime = useCallback(() => {
    if (serverTimeRef.current === 0 || durationRef.current === 0) return 0;
    
    const now = Date.now();
    const elapsed = (now - serverTimeRef.current) / 1000;
    const remaining = Math.max(0, durationRef.current - elapsed);
    
    return Math.ceil(remaining);
  }, []);

  /**
   * Démarrer le timer local synchronisé
   */
  const startLocalTimer = useCallback((serverTime: number, duration: number) => {
    // Arrêter l'ancien timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    serverTimeRef.current = serverTime;
    durationRef.current = duration;

    // Mettre à jour immédiatement
    setRemainingTime(calculateRemainingTime());

    // Mettre à jour chaque 100ms pour plus de précision
    timerIntervalRef.current = setInterval(() => {
      const remaining = calculateRemainingTime();
      setRemainingTime(remaining);
      
      if (remaining <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }
    }, 100);
  }, [calculateRemainingTime]);

  /**
   * Initialiser la connexion WebSocket
   */
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socket;

    // Événements de connexion
    socket.on('connect', () => {
      console.log('🎮 [SOCKET] Connecté au serveur');
      setIsConnected(true);
      
      // Resynchroniser si on était dans une session
      if (sessionIdRef.current) {
        socket.emit('request-sync', { sessionId: sessionIdRef.current });
      }
    });

    socket.on('disconnect', () => {
      console.log('🎮 [SOCKET] Déconnecté du serveur');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🎮 [SOCKET] Erreur de connexion:', error);
    });

    // Événements de jeu
    socket.on('waiting-room-started', ({ serverTime, duration }) => {
      console.log('🎮 [SOCKET] Salle d\'attente démarrée');
      setPhase('waiting');
      startLocalTimer(serverTime, duration);
    });

    socket.on('question-start', (question: Question) => {
      console.log('🎮 [SOCKET] Nouvelle question:', question.round);
      setPhase('question');
      setCurrentQuestion(question);
      setCurrentQuestionIndex(question.round - 1);
      setTotalQuestions(question.totalQuestions);
      startLocalTimer(question.serverTime, question.timeLimit);
    });

    socket.on('question-end', ({ correctAnswer, serverTime }) => {
      console.log('🎮 [SOCKET] Fin de question, réponse correcte:', correctAnswer);
      setPhase('result');
      // Arrêter le timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setRemainingTime(0);
    });

    socket.on('pact-start', ({ serverTime, duration }) => {
      console.log('🎮 [SOCKET] Début du pacte');
      setPhase('pact');
      startLocalTimer(serverTime, duration);
    });

    socket.on('pact-result', ({ accepted, serverTime }) => {
      console.log('🎮 [SOCKET] Résultat du pacte:', accepted ? 'accepté' : 'refusé');
      setPhase('pact-result');
    });

    socket.on('game-end', ({ serverTime }) => {
      console.log('🎮 [SOCKET] Fin du jeu');
      setPhase('finished');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    });

    socket.on('sync', (state: SyncState) => {
      console.log('🎮 [SOCKET] Synchronisation reçue:', state.phase);
      setPhase(state.phase);
      setParticipantCount(state.participantCount);
      setCurrentQuestionIndex(state.currentQuestionIndex);
      setTotalQuestions(state.totalQuestions);
      
      if (state.currentQuestion) {
        setCurrentQuestion(state.currentQuestion);
      }
      
      // Recalculer le timer basé sur le temps serveur
      if (state.remainingTime > 0) {
        serverTimeRef.current = state.serverTime - ((state.currentQuestion?.timeLimit || 0) - state.remainingTime) * 1000;
        durationRef.current = state.currentQuestion?.timeLimit || state.remainingTime;
        startLocalTimer(state.serverTime, state.remainingTime);
      }
    });

    socket.on('participant-joined', ({ totalParticipants }) => {
      setParticipantCount(totalParticipants);
    });

    socket.on('participant-left', ({ totalParticipants }) => {
      setParticipantCount(totalParticipants);
    });

    socket.on('answer-confirmed', ({ answerIndex, isCorrect, score }) => {
      console.log('🎮 [SOCKET] Réponse confirmée:', isCorrect ? 'Correct!' : 'Incorrect');
    });

    // Cleanup
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      socket.disconnect();
    };
  }, [startLocalTimer]);

  /**
   * Gérer la visibilité de la page (mobile)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionIdRef.current) {
        console.log('🎮 [SOCKET] Page visible, resynchronisation...');
        socketRef.current?.emit('request-sync', { sessionId: sessionIdRef.current });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Rejoindre une session
   */
  const joinSession = useCallback((sessionId: string, playerName?: string) => {
    sessionIdRef.current = sessionId;
    socketRef.current?.emit('join-session', {
      sessionId,
      odId: socketRef.current?.id,
      odName: playerName || 'Joueur'
    });
  }, []);

  /**
   * Quitter une session
   */
  const leaveSession = useCallback(() => {
    if (sessionIdRef.current) {
      socketRef.current?.emit('leave-session', { sessionId: sessionIdRef.current });
      sessionIdRef.current = null;
    }
  }, []);

  /**
   * Soumettre une réponse
   */
  const submitAnswer = useCallback((answerIndex: number) => {
    if (sessionIdRef.current) {
      socketRef.current?.emit('submit-answer', {
        sessionId: sessionIdRef.current,
        odId: socketRef.current?.id,
        answerIndex
      });
    }
  }, []);

  /**
   * Demander une synchronisation
   */
  const requestSync = useCallback(() => {
    if (sessionIdRef.current) {
      socketRef.current?.emit('request-sync', { sessionId: sessionIdRef.current });
    }
  }, []);

  return {
    isConnected,
    phase,
    remainingTime,
    currentQuestion,
    participantCount,
    currentQuestionIndex,
    totalQuestions,
    joinSession,
    leaveSession,
    submitAnswer,
    requestSync
  };
}
