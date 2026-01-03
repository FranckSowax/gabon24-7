/**
 * 🎮 HOOK: useGameSocket
 * Gère la connexion Socket.io et les événements du jeu
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type GamePhase = 
  | 'home' 
  | 'loading' 
  | 'session-detail' 
  | 'registration' 
  | 'waiting-for-quota' 
  | 'waiting-room' 
  | 'question' 
  | 'eliminated' 
  | 'winner'
  | 'pact-offer'
  | 'pact-result';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
  category?: string;
  difficulty?: string;
}

export interface GameSession {
  id: string;
  name: string;
  currentPlayers: number;
  targetPlayers: number;
  prize: number;
  status: 'waiting' | 'filling' | 'active' | 'completed';
  startsAt?: string;
  gameMode?: string;
}

interface UseGameSocketOptions {
  sessionId?: string;
  onQuestionStart?: (question: Question) => void;
  onAnswerConfirmed?: (data: { isCorrect: boolean }) => void;
  onGameEnd?: () => void;
  onParticipantJoined?: (data: { totalParticipants: number }) => void;
}

export function useGameSocket(options: UseGameSocketOptions = {}) {
  const { sessionId, onQuestionStart, onAnswerConfirmed, onGameEnd, onParticipantJoined } = options;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('home');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(25);
  const [maxTime, setMaxTime] = useState(25);
  const [waitingCountdown, setWaitingCountdown] = useState(120);
  const [participantCount, setParticipantCount] = useState(0);
  const [alivePlayers, setAlivePlayers] = useState(0);
  const [eliminatedPlayers, setEliminatedPlayers] = useState(0);
  const [isAlive, setIsAlive] = useState(true);
  
  const askedQuestionIdsRef = useRef<Set<string>>(new Set());

  // Connexion Socket
  useEffect(() => {
    if (!sessionId) return;

    // Si déjà connecté à la bonne session
    if (socket?.connected && (socket as any).sessionId === sessionId) return;

    if (socket) socket.disconnect();

    console.log('🔌 Connexion Socket.IO:', API_URL);
    const newSocket: Socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    (newSocket as any).sessionId = sessionId;

    newSocket.on('connect', () => {
      console.log('✅ Connecté au serveur de jeu');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur de jeu');
      setIsConnected(false);
    });

    // Événement sync
    newSocket.on('sync', (data: any) => {
      console.log('🔄 SYNC:', data);
      
      if (data.phase === 'filling') setGamePhase('waiting-for-quota');
      else if (data.phase === 'waiting') {
        setGamePhase('waiting-room');
        setWaitingCountdown(Math.round(data.remainingTime));
      }
      else if (data.phase === 'question') {
        setGamePhase('question');
        if (data.currentQuestion) {
          setCurrentQuestion(data.currentQuestion);
          setMaxTime(data.currentQuestion.timeLimit);
          setTimeLeft(Math.round(data.remainingTime));
          if (data.currentQuestion.id) {
            askedQuestionIdsRef.current.add(data.currentQuestion.id);
          }
        }
      }
      
      if (data.participantCount) {
        setParticipantCount(data.participantCount);
      }
    });

    newSocket.on('participant-joined', (data: any) => {
      console.log('👤 Nouveau joueur:', data);
      setParticipantCount(data.totalParticipants);
      onParticipantJoined?.(data);
    });

    newSocket.on('waiting-room-started', (data: any) => {
      console.log('⏳ Salle d\'attente démarrée');
      setGamePhase('waiting-room');
      setWaitingCountdown(data.duration);
    });

    newSocket.on('question-start', (data: any) => {
      console.log('❓ Question:', data);
      setGamePhase('question');
      setCurrentQuestion(data);
      setMaxTime(data.timeLimit);
      setTimeLeft(data.timeLimit);
      askedQuestionIdsRef.current.add(data.id);
      onQuestionStart?.(data);
    });

    newSocket.on('answer-confirmed', (data: any) => {
      console.log('✅ Réponse confirmée:', data);
      if (data.isAlive === false) {
        setIsAlive(false);
        setGamePhase('eliminated');
      }
      onAnswerConfirmed?.(data);
    });

    // Stats mises à jour (nombre d'éliminés, joueurs restants)
    newSocket.on('stats-update', (data: any) => {
      console.log('📊 Stats:', data);
      setParticipantCount(data.totalParticipants);
      setAlivePlayers(data.alivePlayers);
      setEliminatedPlayers(data.eliminatedPlayers);
    });

    // Un joueur a été éliminé
    newSocket.on('player-eliminated', (data: any) => {
      console.log('💀 Joueur éliminé:', data.odName);
      setAlivePlayers(data.alivePlayers);
      setEliminatedPlayers(data.eliminatedPlayers);
    });

    newSocket.on('game-end', () => {
      if (isAlive) {
        setGamePhase('winner');
      }
      onGameEnd?.();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, onQuestionStart, onAnswerConfirmed, onGameEnd, onParticipantJoined]);

  // Envoyer une réponse
  const submitAnswer = useCallback((answerIndex: number) => {
    if (socket && currentQuestion) {
      socket.emit('submit-answer', {
        questionId: currentQuestion.id,
        answer: answerIndex
      });
    }
  }, [socket, currentQuestion]);

  // Rejoindre une session
  const joinSession = useCallback((session: GameSession, playerName: string, phoneNumber?: string) => {
    if (socket) {
      socket.emit('join-session', {
        sessionId: session.id,
        playerName,
        phoneNumber
      });
    }
  }, [socket]);

  // Voter pour un pacte
  const votePact = useCallback((vote: 'accept' | 'refuse') => {
    if (socket) {
      socket.emit('pact-vote', { vote });
    }
  }, [socket]);

  // Vérifier si une question a déjà été posée
  const hasQuestionBeenAsked = useCallback((questionId: string) => {
    return askedQuestionIdsRef.current.has(questionId);
  }, []);

  return {
    socket,
    isConnected,
    gamePhase,
    setGamePhase,
    currentQuestion,
    setCurrentQuestion,
    timeLeft,
    setTimeLeft,
    maxTime,
    waitingCountdown,
    setWaitingCountdown,
    participantCount,
    alivePlayers,
    eliminatedPlayers,
    isAlive,
    submitAnswer,
    joinSession,
    votePact,
    hasQuestionBeenAsked
  };
}
