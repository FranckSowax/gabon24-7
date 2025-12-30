/**
 * 🎮 HOOK: useGameSessions
 * Gère le chargement et la gestion des sessions de jeu
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface GameSession {
  id: string;
  name: string;
  currentPlayers: number;
  targetPlayers: number;
  prize: number;
  status: 'waiting' | 'filling' | 'active' | 'completed';
  startsAt?: string;
  gameMode?: 'quota' | 'hourly' | 'demo';
  scheduledHour?: number;
  isPrimeTime?: boolean;
  description?: string;
}

// Mapper une session Supabase vers GameSession
const mapSupabaseSessionToGameSession = (dbSession: any): GameSession => {
  const isHourly = dbSession.game_mode === 'hourly';
  const hour = dbSession.scheduled_hour || new Date(dbSession.starts_at).getHours();
  const isPrimeTime = hour >= 19 && hour <= 22;
  
  return {
    id: dbSession.id,
    name: dbSession.name || `Session ${hour}h`,
    currentPlayers: dbSession.current_players || 0,
    targetPlayers: dbSession.target_players || 100,
    prize: dbSession.prize_pool || (isPrimeTime ? 50000 : 25000),
    status: dbSession.status || 'waiting',
    startsAt: dbSession.starts_at,
    gameMode: dbSession.game_mode || 'quota',
    scheduledHour: hour,
    isPrimeTime,
    description: dbSession.description
  };
};

// Sessions initiales (démo + quota statiques)
const INITIAL_SESSIONS: GameSession[] = [
  {
    id: 'demo-session',
    name: '🎮 Mode Démo',
    currentPlayers: 0,
    targetPlayers: 100,
    prize: 0,
    status: 'waiting',
    gameMode: 'demo',
    description: 'Entraînez-vous gratuitement'
  }
];

export function useGameSessions(initialSessionId?: string) {
  const [sessions, setSessions] = useState<GameSession[]>(INITIAL_SESSIONS);
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les sessions depuis l'API
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/game/sessions?limit=50`);
      const data = await response.json();
      
      if (data.success && data.sessions) {
        const apiSessions: GameSession[] = data.sessions.map(mapSupabaseSessionToGameSession);
        
        // Combiner avec les sessions initiales, filtrer les doublons
        const existingIds = new Set(INITIAL_SESSIONS.map(s => s.id));
        const newSessions = apiSessions.filter(s => !existingIds.has(s.id));
        
        setSessions([...INITIAL_SESSIONS, ...newSessions]);
      }
    } catch (err: any) {
      console.error('Erreur chargement sessions:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger une session spécifique
  const loadSession = useCallback(async (sessionId: string) => {
    // Chercher d'abord dans les sessions locales
    const localSession = sessions.find(s => s.id === sessionId);
    if (localSession) {
      setSelectedSession(localSession);
      return localSession;
    }

    // Sinon charger depuis l'API
    try {
      const response = await fetch(`${API_URL}/api/game/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.session) {
        const mappedSession = mapSupabaseSessionToGameSession(data.session);
        setSelectedSession(mappedSession);
        return mappedSession;
      }
    } catch (err) {
      console.error('Erreur chargement session:', err);
    }
    
    return null;
  }, [sessions]);

  // Charger les sessions au montage
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Charger la session initiale si fournie
  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  // Rafraîchir les sessions périodiquement
  useEffect(() => {
    const interval = setInterval(loadSessions, 30000); // Toutes les 30s
    return () => clearInterval(interval);
  }, [loadSessions]);

  // Filtrer les sessions par mode
  const getSessionsByMode = useCallback((mode: 'all' | 'quota' | 'hourly' | 'demo') => {
    if (mode === 'all') return sessions;
    return sessions.filter(s => s.gameMode === mode);
  }, [sessions]);

  // Obtenir les sessions actives
  const getActiveSessions = useCallback(() => {
    return sessions.filter(s => s.status === 'active' || s.status === 'filling');
  }, [sessions]);

  return {
    sessions,
    selectedSession,
    setSelectedSession,
    isLoading,
    error,
    loadSessions,
    loadSession,
    getSessionsByMode,
    getActiveSessions
  };
}
