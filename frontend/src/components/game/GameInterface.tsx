'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Users, Skull, Crown, Zap, Clock, CheckCircle, XCircle, Star, Gift, MessageCircle, ArrowRight, Sparkles } from 'lucide-react'

// Animations variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 }
}

const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
}

const pulseScale = {
  initial: { scale: 1 },
  animate: { 
    scale: [1, 1.05, 1],
    transition: { duration: 0.3 }
  }
}

const shakeAnimation = {
  animate: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 }
  }
}

const correctAnswerAnimation = {
  initial: { scale: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  animate: { 
    scale: [1, 1.02, 1],
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    borderColor: 'rgb(34, 197, 94)',
    transition: { duration: 0.3 }
  }
}

const wrongAnswerAnimation = {
  initial: { scale: 1 },
  animate: { 
    x: [0, -5, 5, -5, 5, 0],
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: 'rgb(239, 68, 68)',
    transition: { duration: 0.4 }
  }
}

const countdownPulse = {
  animate: {
    scale: [1, 1.2, 1],
    transition: { duration: 1, repeat: Infinity }
  }
}

const eliminationAnimation = {
  initial: { opacity: 0, scale: 0.5, rotateX: 90 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    rotateX: 0,
    transition: { type: 'spring', damping: 15 }
  }
}

const victoryAnimation = {
  initial: { opacity: 0, scale: 0, rotate: -180 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    rotate: 0,
    transition: { type: 'spring', damping: 10, stiffness: 100 }
  }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

// Types
// Types de modes de jeu
type GameMode = 'quota' | 'hourly'

interface GameSession {
  id: string
  name: string
  mode: GameMode // 'quota' = remplissage requis, 'hourly' = horaire fixe
  maxPlayers: number | null // null = illimité pour mode hourly
  currentPlayers: number
  entryFee: number
  prize: number // Pour quota: fixe, Pour hourly: calculé dynamiquement
  minPrize?: number // Cagnotte minimum garantie (mode hourly)
  status: 'open' | 'filling' | 'starting' | 'live' | 'ended'
  startsAt?: Date // Heure de lancement (mode hourly)
  scheduledHour?: number // Heure programmée (0-23)
  difficulty: 'Débutant' | 'Standard' | 'Expert' | 'Élite'
  color: string
  backgroundImage?: string // Image de fond pour la carte
  icon: string
  description?: string
}

interface Question {
  id: string
  round: number
  difficulty: 'Facile' | 'Moyen' | 'Difficile' | 'Expert'
  question: string
  answers: string[]
  correct: number
  timeLimit: number
  isAntiAI?: boolean
}

interface PactOffer {
  totalPot: number
  playerCount: number
  systemCommission: number
  amountToShare: number
  individualOffer: number
  formattedOffer: string
  formattedPot: string
}

interface PactResult {
  acceptVotes: number
  refuseVotes: number
  acceptPercentage: number
  isPactAccepted: boolean
  message: string
}

interface GameSummary {
  sessionName: string
  sessionIcon: string
  endTime: Date
  isWinner: boolean
  totalRounds: number
  lastQuestion?: Question
  correctAnswerIndex?: number
  amountWon?: number
  eliminatedAtRound?: number
}

type GamePhase = 'home' | 'session-detail' | 'registered' | 'waiting-for-quota' | 'waiting-for-session' | 'waiting-room' | 'question' | 'result' | 'pact-vote' | 'pact-result' | 'pact-winner' | 'eliminated' | 'winner' | 'loading'

// ============================================
// SESSIONS HORAIRES - Lancement à heure fixe
// ============================================
// Fonction pour calculer la prochaine occurrence d'une heure
const getNextSessionTime = (hour: number): Date => {
  const now = new Date()
  const next = new Date()
  next.setHours(hour, 0, 0, 0)
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// Sessions horaires par défaut
const HOURLY_SESSIONS: GameSession[] = [
  {
    id: 'midi-express',
    name: 'Midi Express',
    mode: 'hourly',
    maxPlayers: null,
    currentPlayers: 0,
    entryFee: 500,
    prize: 10000,
    minPrize: 10000,
    status: 'open',
    startsAt: getNextSessionTime(12),
    scheduledHour: 12,
    difficulty: 'Débutant',
    color: 'from-yellow-500 to-orange-500',
    backgroundImage: '/midi.jpg',
    icon: '☀️',
    description: 'Lancement à 12h00 précises. Min. garanti: 10,000 FCFA'
  },
  {
    id: 'after-work',
    name: 'After Work',
    mode: 'hourly',
    maxPlayers: null,
    currentPlayers: 0,
    entryFee: 1000,
    prize: 25000,
    minPrize: 25000,
    status: 'open',
    startsAt: getNextSessionTime(18),
    scheduledHour: 18,
    difficulty: 'Standard',
    color: 'from-blue-500 to-indigo-600',
    backgroundImage: '/after.jpg',
    icon: '🌆',
    description: 'Lancement à 18h00 précises. Min. garanti: 25,000 FCFA'
  },
  {
    id: 'prime-time',
    name: 'Prime Time',
    mode: 'hourly',
    maxPlayers: null,
    currentPlayers: 0,
    entryFee: 2000,
    prize: 25000,
    minPrize: 25000,
    status: 'open',
    startsAt: getNextSessionTime(20),
    scheduledHour: 20,
    difficulty: 'Expert',
    color: 'from-orange-500 to-red-600',
    backgroundImage: '/nightowl.jpg',
    icon: '🔥',
    description: 'Lancement à 20h00 précises. Min. garanti: 25,000 FCFA'
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    mode: 'hourly',
    maxPlayers: null,
    currentPlayers: 0,
    entryFee: 5000,
    prize: 50000,
    minPrize: 50000,
    status: 'open',
    startsAt: getNextSessionTime(22),
    scheduledHour: 22,
    difficulty: 'Expert',
    color: 'from-purple-500 to-indigo-600',
    backgroundImage: '/midnight.jpg',
    icon: '🌙',
    description: 'Lancement à 22h00 précises. Min. garanti: 50,000 FCFA'
  }
]

// Fonction pour convertir une session Supabase en GameSession
const mapSupabaseSessionToGameSession = (dbSession: any): GameSession => {
  const isHourly = dbSession.game_mode === 'hourly'
  const hour = dbSession.scheduled_hour || new Date(dbSession.starts_at).getHours()
  const isPrimeTime = hour >= 19 && hour <= 22
  
  // Déterminer la difficulté selon le prix d'entrée
  let difficulty: 'Débutant' | 'Standard' | 'Expert' | 'Élite' = 'Standard'
  if (dbSession.entry_fee <= 500) difficulty = 'Débutant'
  else if (dbSession.entry_fee <= 1000) difficulty = 'Standard'
  else if (dbSession.entry_fee <= 2000) difficulty = 'Expert'
  else difficulty = 'Élite'
  
  // Couleurs selon le mode et l'heure
  let color = isHourly ? 'from-cyan-500 to-blue-600' : 'from-green-500 to-emerald-600'
  if (isHourly && isPrimeTime) color = 'from-orange-500 to-red-600'
  if (!isHourly && dbSession.entry_fee >= 5000) color = 'from-yellow-500 to-orange-600'
  
  // Icône selon le nom ou l'heure
  let icon = isHourly ? '⏰' : '🎯'
  if (dbSession.name.includes('☀️')) icon = '☀️'
  else if (dbSession.name.includes('🔥')) icon = '🔥'
  else if (dbSession.name.includes('⚡')) icon = '⚡'
  else if (dbSession.name.includes('🌆')) icon = '🌆'
  else if (dbSession.name.includes('🌙')) icon = '🌙'
  else if (dbSession.name.includes('🌃')) icon = '🌃'
  else if (isPrimeTime && isHourly) icon = '🌟'
  
  // Calculer la cagnotte pour mode horaire
  const prize = isHourly 
    ? Math.max(dbSession.min_prize || 25000, Math.floor(dbSession.current_players * dbSession.entry_fee * 0.5))
    : dbSession.prize_pool || (dbSession.max_players * dbSession.entry_fee * 0.5)
  
  return {
    id: dbSession.id,
    name: dbSession.name.replace(/[☀️🔥⚡🌆🌙🌃]/g, '').trim(),
    mode: dbSession.game_mode || 'quota',
    maxPlayers: dbSession.max_players,
    currentPlayers: dbSession.current_players || 0,
    entryFee: dbSession.entry_fee,
    prize,
    minPrize: dbSession.min_prize,
    status: dbSession.status === 'active' ? 'live' : dbSession.status === 'upcoming' ? 'filling' : 'open',
    startsAt: dbSession.starts_at ? new Date(dbSession.starts_at) : undefined,
    scheduledHour: dbSession.scheduled_hour,
    difficulty,
    color,
    icon,
    description: isHourly 
      ? `Lancement à ${hour}h00 précises. Min. garanti: ${(dbSession.min_prize || 25000).toLocaleString()} FCFA`
      : `${dbSession.max_players} places. Cagnotte garantie !`
  }
}

// Session Training (mode entraînement virtuel - même fonctionnement qu'une session live)
const TRAINING_SESSION: GameSession = {
  id: 'training',
  name: 'Mode Training',
  mode: 'hourly',
  maxPlayers: null,
  currentPlayers: 0,
  entryFee: 0,
  prize: 0,
  minPrize: 0,
  status: 'open',
  difficulty: 'Débutant',
  color: 'from-emerald-500 to-teal-600',
  backgroundImage: '/training.jpg',
  icon: '🎓',
  description: 'Entraînez-vous gratuitement ! Même gameplay que les sessions live.'
}

// Sessions initiales (Training + sessions horaires)
const INITIAL_SESSIONS: GameSession[] = [
  TRAINING_SESSION,
  ...HOURLY_SESSIONS
]

export default function GameInterface({ initialSessionId }: { initialSessionId?: string }) {
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>(initialSessionId ? 'loading' : 'home')
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null)
  const [sessions, setSessions] = useState<GameSession[]>(INITIAL_SESSIONS)
  const [survivors, setSurvivors] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [waitingCountdown, setWaitingCountdown] = useState(120) // 2 minutes
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(25)
  const [maxTime, setMaxTime] = useState(25)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [eliminatedThisRound, setEliminatedThisRound] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showEliminationAnim, setShowEliminationAnim] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [playerName, setPlayerName] = useState('') // Nom du joueur
  const [isRegistering, setIsRegistering] = useState(false)
  
  // États pour Le Pacte
  const [pactOffer, setPactOffer] = useState<PactOffer | null>(null)
  const [pactVote, setPactVote] = useState<'accept' | 'refuse' | null>(null)
  const [pactTimer, setPactTimer] = useState(10)
  const [pactResult, setPactResult] = useState<PactResult | null>(null)
  const [pactVotePercentage, setPactVotePercentage] = useState(0)
  const [showPactAnimation, setShowPactAnimation] = useState(false)
  const [demoQuestions, setDemoQuestions] = useState<Question[]>([])
  
  // États pour le récapitulatif de fin de partie
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  

  // Historique des questions pour éviter les répétitions
  const askedQuestionIdsRef = useRef<Set<string>>(new Set())
  const [askedQuestionIds, setAskedQuestionIds] = useState<Set<string>>(new Set())

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // Fonction pour mélanger un tableau (Fisher-Yates shuffle)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Fonction pour randomiser les réponses d'une question
  const shuffleQuestionAnswers = (q: Question): Question => {
    const correctAnswer = q.answers[q.correct]
    const shuffledAnswers = shuffleArray(q.answers)
    const newCorrectIndex = shuffledAnswers.indexOf(correctAnswer)
    return {
      ...q,
      answers: shuffledAnswers,
      correct: newCorrectIndex
    }
  }

  // Questions brutes pour le mode Démo (seront randomisées à l'utilisation)
  const RAW_DEMO_QUESTIONS: Question[] = [
    { id: 'demo1', round: 1, difficulty: 'Facile', question: "Quelle est la capitale du Gabon ?", answers: ["Libreville", "Port-Gentil", "Franceville", "Oyem"], correct: 0, timeLimit: 15 },
    { id: 'demo2', round: 2, difficulty: 'Facile', question: "Quelle est la monnaie du Gabon ?", answers: ["Euro", "Dollar", "Franc CFA", "Naira"], correct: 2, timeLimit: 15 },
    { id: 'demo3', round: 3, difficulty: 'Moyen', question: "Quel est le fleuve principal ?", answers: ["Komo", "Ogooué", "Nyanga", "Ivindo"], correct: 1, timeLimit: 12 },
    { id: 'demo4', round: 4, difficulty: 'Moyen', question: "Qui est le président de la Transition ?", answers: ["Ali Bongo", "Oligui Nguema", "Jean Ping", "Léon Mba"], correct: 1, timeLimit: 12 },
    { id: 'demo5', round: 5, difficulty: 'Difficile', question: "Combien de provinces compte le Gabon ?", answers: ["7", "9", "10", "12"], correct: 1, timeLimit: 10 },
    { id: 'demo6', round: 6, difficulty: 'Facile', question: "Sur quel continent se trouve le Gabon ?", answers: ["Asie", "Europe", "Afrique", "Amérique"], correct: 2, timeLimit: 15 },
    { id: 'demo7', round: 7, difficulty: 'Moyen', question: "Quel océan borde le Gabon ?", answers: ["Pacifique", "Indien", "Atlantique", "Arctique"], correct: 2, timeLimit: 12 },
    { id: 'demo8', round: 8, difficulty: 'Difficile', question: "En quelle année le Gabon a-t-il obtenu son indépendance ?", answers: ["1958", "1960", "1962", "1964"], correct: 1, timeLimit: 10 },
  ]

  // Générer les questions DEMO avec réponses mélangées (recalculé à chaque session)
  const getShuffledDemoQuestions = (): Question[] => {
    return shuffleArray(RAW_DEMO_QUESTIONS).map((q, index) => ({
      ...shuffleQuestionAnswers(q),
      id: `demo-${Date.now()}-${index}`,
      round: index + 1
    }))
  }

  // Référence stable pour DEMO_QUESTIONS (utilisée comme fallback)
  const DEMO_QUESTIONS = RAW_DEMO_QUESTIONS.map(shuffleQuestionAnswers)

  // Charger une question démo
  const loadDemoQuestion = () => {
    try {
      const questionsPool = (demoQuestions && demoQuestions.length > 0) ? demoQuestions : (DEMO_QUESTIONS || [])
      
      // Sécurité si aucune question
      if (!questionsPool || questionsPool.length === 0) {
        console.error('Aucune question disponible pour la démo')
        setGamePhase('winner') // Fallback
        return
      }

      // Si on a fini toutes les questions
      if (currentRound >= questionsPool.length) {
          setGamePhase('winner')
          return
      }
      
      const question = questionsPool[currentRound]
      if (!question) {
        console.error('Question introuvable index:', currentRound)
        setGamePhase('winner')
        return
      }

      setCurrentQuestion({ ...question, round: currentRound + 1 })
      setGamePhase('question')
      setTimeLeft(question.timeLimit || 20)
      setMaxTime(question.timeLimit || 20)
      setCurrentRound(prev => prev + 1)
      setSelectedAnswer(null)
    } catch (error) {
      console.error('Erreur loadDemoQuestion:', error)
      setGamePhase('winner')
    }
  }

  // Simulation Remplissage DEMO
  useEffect(() => {
    if (gamePhase === 'waiting-for-quota' && selectedSession?.id === 'demo') {
        const DEMO_TARGET = 100 // Objectif simulé pour démarrer rapidement
        
        // Initialiser les joueurs courants si nécessaire
        setSelectedSession(prev => prev ? {...prev, currentPlayers: Math.max(prev.currentPlayers, 85)} : null)

        const interval = setInterval(() => {
            setSelectedSession(prev => {
                if (!prev) return null
                const increment = Math.floor(Math.random() * 3) + 1
                const newCount = Math.min(prev.currentPlayers + increment, DEMO_TARGET)
                
                if (newCount >= DEMO_TARGET) {
                    clearInterval(interval)
                    setTimeout(() => {
                        setGamePhase('waiting-room')
                        setWaitingCountdown(5) // Court pour la démo
                    }, 500)
                }
                return { ...prev, currentPlayers: newCount }
            })
        }, 200) // Plus rapide : 200ms au lieu de 500ms
        return () => clearInterval(interval)
    }
  }, [gamePhase, selectedSession?.id])

  // Timer Demo Waiting Room -> Launch
  useEffect(() => {
    if (gamePhase === 'waiting-room' && selectedSession?.id === 'demo' && waitingCountdown === 0) {
        loadDemoQuestion()
    }
  }, [gamePhase, selectedSession, waitingCountdown])

  // Transition automatique après résultat - TOUTES LES SESSIONS
  useEffect(() => {
    if (selectedSession && (gamePhase === 'result' || gamePhase === 'pact-winner') && isCorrect) {
        const timer = setTimeout(() => {
            const totalQuestions = demoQuestions.length > 0 ? demoQuestions.length : DEMO_QUESTIONS.length
            if (currentRound < totalQuestions) {
                loadDemoQuestion()
            } else {
                setGamePhase('winner')
                setTimeout(() => showGameSummary(true), 2000)
            }
        }, 3000) // 3 secondes pour voir le résultat
        return () => clearTimeout(timer)
    }
  }, [gamePhase, selectedSession, currentRound, demoQuestions, isCorrect])

  // Charger les sessions réelles et mettre à jour les compteurs
  useEffect(() => {
    const fetchSessionsData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/game/sessions`)
        const data = await response.json()
        
        if (data.success && Array.isArray(data.sessions)) {
          setSessions(currentSessions => {
            return currentSessions.map(staticSession => {
              // Essayer de trouver la session en base
              const dbSession = data.sessions.find((s: any) => 
                s.id === staticSession.id || 
                s.name?.toLowerCase() === staticSession.name.toLowerCase() ||
                s.session_type === staticSession.id
              )
              
              if (dbSession) {
                return {
                  ...staticSession,
                  // Gestion explicite du 0 pour éviter le fallback si la valeur est définie
                  currentPlayers: dbSession.current_players !== undefined ? dbSession.current_players : 
                                 (dbSession.currentPlayers !== undefined ? dbSession.currentPlayers : staticSession.currentPlayers),
                  status: (dbSession.status as any) || staticSession.status,
                  // On garde l'ID statique pour le mapping interne frontend sauf si c'est la démo
                  id: staticSession.id 
                }
              }
              return staticSession
            })
          })
        }
      } catch (error) {
        console.error('Erreur chargement sessions:', error)
      }
    }

    fetchSessionsData()
    const interval = setInterval(() => {
        if (gamePhase === 'home') fetchSessionsData()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [API_URL, gamePhase])

  // Connexion Socket.IO et gestion des événements
  useEffect(() => {
    if (!selectedSession?.id) return

    // Si déjà connecté à la bonne session
    if (socket?.connected && (socket as any).sessionId === selectedSession.id) return

    if (socket) socket.disconnect()

    console.log('🔌 Connexion Socket.IO:', API_URL)
    const newSocket: Socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true
    }) as any

    // Ajout de la propriété sessionId pour la vérification ci-dessus
    (newSocket as any).sessionId = selectedSession.id

    newSocket.on('connect', () => {
      console.log('✅ Connecté au serveur de jeu')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur de jeu')
      setIsConnected(false)
    })

    // --- Événements de jeu ---

    newSocket.on('sync', (data: any) => {
      console.log('🔄 SYNC:', data)
      
      // Mise à jour phase
      if (data.phase === 'filling') setGamePhase('waiting-for-quota')
      else if (data.phase === 'waiting') {
        setGamePhase('waiting-room')
        setWaitingCountdown(Math.round(data.remainingTime))
      }
      else if (data.phase === 'question') {
        setGamePhase('question')
        if (data.currentQuestion) {
          setCurrentQuestion(data.currentQuestion)
          setMaxTime(data.currentQuestion.timeLimit)
          setTimeLeft(Math.round(data.remainingTime))
          // Anti-répétition
          if (data.currentQuestion.id) askedQuestionIdsRef.current.add(data.currentQuestion.id)
        }
      }
      
      // Mise à jour participants
      if (data.participantCount) {
        setSelectedSession(prev => prev ? {...prev, currentPlayers: data.participantCount} : null)
      }
    })

    newSocket.on('participant-joined', (data: any) => {
      console.log('👤 Nouveau joueur:', data)
      setSelectedSession(prev => prev ? {...prev, currentPlayers: data.totalParticipants} : null)
    })

    newSocket.on('waiting-room-started', (data: any) => {
      console.log('⏳ Salle d\'attente démarrée')
      setGamePhase('waiting-room')
      setWaitingCountdown(data.duration)
    })

    newSocket.on('question-start', (data: any) => {
      console.log('❓ Question:', data)
      setGamePhase('question')
      setCurrentQuestion(data)
      setMaxTime(data.timeLimit)
      setTimeLeft(data.timeLimit)
      setSelectedAnswer(null)
      setIsCorrect(null)
      askedQuestionIdsRef.current.add(data.id)
    })

    newSocket.on('answer-confirmed', (data: any) => {
      console.log('✅ Réponse confirmée:', data)
      setIsCorrect(data.isCorrect)
      if (!data.isCorrect) {
        setTimeout(() => {
          setGamePhase('eliminated')
          setSurvivors(prev => prev - 1)
        }, 1500)
      } else {
        setStreak(prev => prev + 1)
      }
    })

    newSocket.on('game-end', () => {
      setGamePhase('winner') // Ou écran de fin
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [selectedSession?.id, API_URL])


  // Effet pour charger les sessions depuis l'API au démarrage
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/game/sessions?limit=50`)
        const data = await response.json()
        
        if (data.success && data.sessions) {
          // Convertir les sessions Supabase en GameSession
          const apiSessions: GameSession[] = data.sessions.map((s: any) => mapSupabaseSessionToGameSession(s))
          
          // Combiner avec les sessions locales (demo + quota statiques)
          // Filtrer les doublons par ID ET exclure toute session "training" venant de l'API
          // car on utilise déjà la session training locale (TRAINING_SESSION)
          const existingIds = new Set(INITIAL_SESSIONS.map(s => s.id))
          const newSessions = apiSessions.filter(s => 
            !existingIds.has(s.id) && 
            s.id !== 'training' && 
            s.name !== 'Mode Training' &&
            s.mode !== 'training' as any // Casting car 'training' n'est pas dans le type GameMode
          )
          
          setSessions([...INITIAL_SESSIONS, ...newSessions])
        }
      } catch (error) {
        console.error('Erreur chargement sessions:', error)
        // Garder les sessions initiales en cas d'erreur
      }
    }
    
    loadSessions()
  }, [API_URL])

  // Effet pour initialiser la session depuis l'URL (une seule fois au chargement)
  useEffect(() => {
    // Ne pas réinitialiser si on est déjà dans une phase de jeu avancée
    if (gamePhase !== 'loading' && gamePhase !== 'home') return
    
    if (initialSessionId) {
      // Chercher dans les sessions locales d'abord (pour training)
      const localSession = sessions.find((s: GameSession) => s.id === initialSessionId)
      if (localSession) {
        setSelectedSession(localSession)
        setGamePhase('session-detail')
      } else {
        // Sinon charger depuis l'API
        fetch(`${API_URL}/api/game/sessions/${initialSessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.session) {
              const mappedSession = mapSupabaseSessionToGameSession(data.session)
              setSelectedSession(mappedSession)
              setGamePhase('session-detail')
            }
          })
          .catch(console.error)
      }
    }
  }, [initialSessionId, API_URL, sessions, gamePhase])

  // Configuration du Pacte par session
  const PACT_THRESHOLDS: Record<string, { minPlayers: number; minPot: number }> = {
    starter: { minPlayers: 20, minPot: 20000 },
    classic: { minPlayers: 50, minPot: 200000 },
    premium: { minPlayers: 100, minPot: 800000 },
    elite: { minPlayers: 150, minPot: 4000000 },
    mega: { minPlayers: 200, minPot: 20000000 }
  }


  // Calculer la difficulté (Progressive et basée sur les survivants)
  const getDifficulty = (survivorCount: number, maxPlayers: number | null, round: number): string => {
    const maxP = maxPlayers ?? 1000 // Défaut pour mode illimité
    const ratio = survivorCount / maxP
    
    // Force la difficulté si le jeu dure trop longtemps
    if (round >= 10) return 'Expert'
    if (round >= 7) return 'Difficile'
    
    // Sinon basé sur le nombre de survivants
    if (ratio > 0.6) return 'Facile'
    if (ratio > 0.3) return 'Moyen'
    if (ratio > 0.10) return 'Difficile'
    return 'Expert'
  }

  // Timer progressif : commence à 20s et diminue avec les rounds
  const getTimeLimit = (round: number): number => {
    // Commence à 20 secondes
    const baseTime = 20
    
    // Réduire de 1 seconde tous les 2 rounds
    const reduction = Math.floor(round / 2)
    
    // Minimum 8 secondes pour avoir le temps de lire et répondre
    return Math.max(8, baseTime - reduction)
  }

  // Timer salle d'attente - Lance le jeu quand countdown atteint 0
  useEffect(() => {
    if (gamePhase === 'waiting-room' && waitingCountdown > 0) {
      const timer = setTimeout(() => setWaitingCountdown(prev => prev - 1), 1000)
      return () => clearTimeout(timer)
    } else if (gamePhase === 'waiting-room' && waitingCountdown === 0) {
      // Le countdown est terminé, lancer la première question !
      console.log('🎮 Lancement du jeu !')
      startFirstQuestion()
    }
  }, [waitingCountdown, gamePhase])
  
  // Fonction pour démarrer la première question
  const startFirstQuestion = () => {
    if (!selectedSession) return

    // Utiliser les questions préchargées (demoQuestions) ou les questions DEMO par défaut
    const questionsToUse = demoQuestions.length > 0 ? demoQuestions : DEMO_QUESTIONS

    if (questionsToUse.length > 0) {
      const firstQuestion = questionsToUse[0]
      // S'assurer que demoQuestions est défini pour les prochaines questions
      if (demoQuestions.length === 0) {
        setDemoQuestions(getShuffledDemoQuestions())
      }
      setCurrentQuestion(firstQuestion)
      setMaxTime(getTimeLimit(1))
      setTimeLeft(getTimeLimit(1))
      setCurrentRound(1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setGamePhase('question')
      console.log('❓ Première question:', firstQuestion.question)
    } else {
      // Fallback: charger les questions maintenant (ne devrait jamais arriver)
      const sessionType = selectedSession?.id === 'training' ? 'training' : 'paid'
      fetch(`${API_URL}/api/game/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rounds: 10, sessionType })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.questions && data.questions.length > 0) {
          setDemoQuestions(data.questions)
          const firstQuestion = data.questions[0]
          setCurrentQuestion(firstQuestion)
          setMaxTime(getTimeLimit(1))
          setTimeLeft(getTimeLimit(1))
          setCurrentRound(1)
          setSelectedAnswer(null)
          setIsCorrect(null)
          setGamePhase('question')
        }
      })
      .catch(console.error)
    }
  }

  // Timer question
  useEffect(() => {
    if (gamePhase === 'question' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (gamePhase === 'question' && timeLeft === 0) {
      handleTimeUp()
    }
  }, [timeLeft, gamePhase])

  // Timer du Pacte
  useEffect(() => {
    if (gamePhase === 'pact-vote' && pactTimer > 0) {
      const timer = setTimeout(() => setPactTimer(pactTimer - 1), 1000)
      return () => clearTimeout(timer)
    } else if (gamePhase === 'pact-vote' && pactTimer === 0) {
      handlePactVoteEnd()
    }
  }, [pactTimer, gamePhase])

  // Vérifier si le Pacte peut être proposé (tous les 3 tours)
  const checkPactConditions = (playerCount: number, totalPot: number, round: number): boolean => {
    if (!selectedSession) return false
    
    // Proposer le pacte uniquement tous les 3 rounds (3, 6, 9, etc.)
    if (round % 3 !== 0) return false
    
    const thresholds = PACT_THRESHOLDS[selectedSession.id] || PACT_THRESHOLDS.classic
    return playerCount <= thresholds.minPlayers && totalPot >= thresholds.minPot
  }

  // Calculer l'offre du Pacte
  // Mettre à jour le statut du joueur dans la base de données
  const updatePlayerStatus = async (status: 'eliminated' | 'winner', round?: number, position?: number) => {
    if (!selectedSession || !phoneNumber) return
    
    try {
      const payload: any = {
        whatsapp_number: phoneNumber,
        status,
        round,
        position
      }
      
      // Si éliminé, ajouter la question qui a causé l'élimination
      if (status === 'eliminated' && currentQuestion) {
        payload.eliminated_at_question = currentQuestion.question
        payload.eliminated_round = round
      }
      
      await fetch(`${API_URL}/api/game/sessions/${selectedSession.id}/player-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      console.log(`📊 Statut joueur mis à jour: ${status} (round ${round})`)
    } catch (error) {
      console.error('Erreur mise à jour statut:', error)
    }
  }

  // Créer et afficher le récapitulatif de fin de partie
  const showGameSummary = (isWinner: boolean, amountWon?: number) => {
    if (!selectedSession) return
    
    const summary: GameSummary = {
      sessionName: selectedSession.name,
      sessionIcon: selectedSession.icon,
      endTime: new Date(),
      isWinner,
      totalRounds: currentRound,
      lastQuestion: currentQuestion || undefined,
      correctAnswerIndex: currentQuestion?.correct,
      amountWon: isWinner ? (amountWon || pactOffer?.individualOffer || selectedSession.prize) : undefined,
      eliminatedAtRound: !isWinner ? currentRound : undefined
    }
    
    setGameSummary(summary)
    setShowSummaryModal(true)
  }

  // Fermer le modal et retourner à l'accueil
  const closeSummaryAndGoHome = () => {
    setShowSummaryModal(false)
    setGameSummary(null)
    setGamePhase('home')
    setSelectedSession(null)
    setCurrentRound(0)
    setCurrentQuestion(null)
    setSurvivors(0)
    setStreak(0)
    router.push('/jeu')
  }

  const calculatePactOffer = (totalPot: number, playerCount: number): PactOffer => {
    // Calcul direct sans commission visible pour l'utilisateur (demande client)
    const systemCommission = 0 // Math.floor(totalPot * 0.10)
    const amountToShare = totalPot - systemCommission
    const individualOffer = Math.floor(amountToShare / playerCount)
    
    return {
      totalPot,
      playerCount,
      systemCommission,
      amountToShare,
      individualOffer,
      formattedOffer: new Intl.NumberFormat('fr-FR').format(individualOffer) + ' FCFA',
      formattedPot: new Intl.NumberFormat('fr-FR').format(totalPot) + ' FCFA'
    }
  }

  // Proposer le Pacte
  const proposePact = () => {
    if (!selectedSession) return
    
    const offer = calculatePactOffer(selectedSession.prize, survivors)
    setPactOffer(offer)
    setPactVote(null)
    setPactTimer(20)
    setPactResult(null)
    setPactVotePercentage(0)
    setShowPactAnimation(true)
    
    setTimeout(() => {
      setShowPactAnimation(false)
      setGamePhase('pact-vote')
    }, 1000)
  }

  // Voter pour le Pacte
  const handlePactVote = (vote: 'accept' | 'refuse') => {
    if (pactVote !== null) return
    setPactVote(vote)
    
    // Simuler les votes des autres joueurs (en production: WebSocket)
    const simulatedAcceptRate = 0.70 + Math.random() * 0.15 // 70-85%
    setPactVotePercentage(Math.round(simulatedAcceptRate * 100))
  }

  // Fin du vote du Pacte
  const handlePactVoteEnd = () => {
    // Si pas voté, compte comme refus
    if (pactVote === null) {
      setPactVote('refuse')
    }
    
    // Simuler le résultat final (en production: depuis le serveur)
    const finalAcceptRate = pactVotePercentage || (70 + Math.random() * 15)
    const isPactAccepted = finalAcceptRate >= 80
    
    const result: PactResult = {
      acceptVotes: Math.round(survivors * (finalAcceptRate / 100)),
      refuseVotes: survivors - Math.round(survivors * (finalAcceptRate / 100)),
      acceptPercentage: Math.round(finalAcceptRate * 10) / 10,
      isPactAccepted,
      message: isPactAccepted 
        ? `LE PACTE EST ACCEPTÉ ! ${finalAcceptRate.toFixed(1)}% ont voté OUI`
        : `PACTE REJETÉ ! Seulement ${finalAcceptRate.toFixed(1)}% ont voté OUI (80% requis)`
    }
    
    setPactResult(result)
    setGamePhase('pact-result')
    
    setTimeout(() => {
      if (isPactAccepted) {
        setGamePhase('pact-winner')
        // Mettre à jour le statut - gagnant du pacte
        updatePlayerStatus('winner', currentRound, 1)
        // Afficher le récapitulatif après un délai
        setTimeout(() => showGameSummary(true, pactOffer?.individualOffer), 3000)
      } else {
      }
    }, 4000)
  }

  const handleTimeUp = () => {
    if (!selectedSession) return
    
    if (selectedAnswer === null) {
      setIsCorrect(false)
      setGamePhase('result')
      setTimeout(() => {
        setGamePhase('eliminated')
        setSurvivors(prev => prev - 1)
        // Mettre à jour le statut en base
        updatePlayerStatus('eliminated', currentRound)
        // Afficher le récapitulatif après un délai
        setTimeout(() => showGameSummary(false), 2000)
      }, 1500)
    } else {
      const correct = currentQuestion?.isAntiAI || selectedAnswer === currentQuestion?.correct
      setIsCorrect(correct)
      setGamePhase('result')
      
      if (correct) {
        setStreak(prev => prev + 1)
        const elimRate = 0.15 + (currentRound * 0.02)
        const eliminated = Math.max(1, Math.floor(survivors * elimRate))
        setEliminatedThisRound(eliminated)
        
        // Transition INSTANTANÉE vers la question suivante après un bref délai visuel
        setTimeout(() => {
            const newSurvivors = Math.max(1, survivors - eliminated)
            setSurvivors(newSurvivors)
            
            if (newSurvivors <= 1) {
              setGamePhase('winner')
              // Mettre à jour le statut en base - GAGNANT!
              updatePlayerStatus('winner', currentRound, 1)
              // Afficher le récapitulatif après un délai
              setTimeout(() => showGameSummary(true), 3000)
            } else {
              // Vérifier si le Pacte peut être proposé
              if (checkPactConditions(newSurvivors, selectedSession.prize, currentRound)) {
                proposePact()
              } else {
              }
            }
        }, 800) // Juste 800ms pour voir "Correct", pas d'animation d'élimination superflue
      } else {
        setTimeout(() => {
          setGamePhase('eliminated')
          setSurvivors(prev => prev - 1)
          // Mettre à jour le statut en base
          updatePlayerStatus('eliminated', currentRound)
          // Afficher le récapitulatif après un délai
          setTimeout(() => showGameSummary(false), 2000)
        }, 1500)
      }
    }
  }

  const selectAnswer = (index: number) => {
    if (gamePhase !== 'question' || timeLeft === 0) return
    setSelectedAnswer(index)

    // Envoyer la réponse au serveur
    if (socket && socket.connected && selectedSession && selectedSession.id !== 'demo') {
      socket.emit('submit-answer', {
        sessionId: selectedSession.id,
        answerIndex: index
      })
    }
  }

  const selectSession = (session: GameSession) => {
    // Navigation vers l'URL unique pour avoir /jeu/id_session
    router.push(`/jeu/${session.id}`)
  }

  const handleRegister = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    
    if (!phoneNumber || phoneNumber.length < 8 || !playerName.trim()) return
    if (!selectedSession) return
    
    setIsRegistering(true)
    
    // MODE TRAINING (gratuit - pas de paiement)
    const isTraining = selectedSession.id === 'training'
    
    if (isTraining) {
        // Mode Training: enregistrer l'inscription en base pour le dashboard
        console.log('🎓 Mode Training - Joueur:', playerName, phoneNumber)

        // IMMÉDIATEMENT passer à la salle d'attente (évite le délai perçu)
        setGamePhase('waiting-room')
        setWaitingCountdown(3) // Countdown court pendant le chargement
        setSurvivors(100)

        // Enregistrer l'inscription Training en base (en parallèle, non bloquant)
        fetch(`${API_URL}/api/game/sessions/training/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_name: playerName,
                whatsapp_number: phoneNumber
            })
        }).catch(err => console.error('Erreur enregistrement training:', err))

        // Charger les questions TRAINING en parallèle (pool séparé des sessions payantes)
        fetch(`${API_URL}/api/game/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rounds: 10, sessionType: 'training' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.questions && data.questions.length > 0) {
                console.log('✅ Questions chargées pour training:', data.questions.length)
                setDemoQuestions(data.questions)
                setIsRegistering(false)
            } else {
                console.error('❌ Pas de questions reçues, utilisation questions par défaut')
                // Fallback: utiliser les questions DEMO par défaut
                setDemoQuestions(getShuffledDemoQuestions())
                setIsRegistering(false)
            }
        })
        .catch(err => {
            console.error('Erreur chargement questions:', err)
            // Fallback: utiliser les questions DEMO par défaut
            setDemoQuestions(getShuffledDemoQuestions())
            setIsRegistering(false)
        })
        return
    }
    
    // MODE PAYANT - Simuler le paiement
    try {
      // 1. Simuler le paiement (en production: intégrer Mobile Money)
      const paymentSuccess = await simulatePayment(selectedSession.entryFee)
      
      if (!paymentSuccess) {
        alert('❌ Échec du paiement. Veuillez réessayer.')
        setIsRegistering(false)
        return
      }
      
      // 2. Enregistrer l'inscription en base
      await fetch(`${API_URL}/api/game/sessions/${selectedSession.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: phoneNumber,
          player_name: playerName,
          payment_status: 'paid',
          amount_paid: selectedSession.entryFee
        })
      })
      
      // 3. Rejoindre la session via Socket
      if (socket && socket.connected) {
        console.log('🔌 Emission join-session socket')
        socket.emit('join-session', {
          sessionId: selectedSession.id,
          odId: socket.id,
          odName: playerName
        })
      }
      
      // 4. Passer en salle d'attente avec countdown vers l'heure de session
      setGamePhase('waiting-for-session')
      setIsRegistering(false)
      
    } catch (error) {
      console.error('Erreur inscription:', error)
      alert('❌ Erreur lors de l\'inscription. Veuillez réessayer.')
      setIsRegistering(false)
    }
  }
  
  // Simuler un paiement (en production: intégrer Airtel Money, Moov Money, etc.)
  const simulatePayment = async (amount: number): Promise<boolean> => {
    return new Promise((resolve) => {
      // Simuler un délai de traitement
      setTimeout(() => {
        // En production, ici on appellerait l'API de paiement
        // Pour l'instant, on simule un succès
        console.log(`💳 Paiement simulé: ${amount} FCFA`)
        resolve(true)
      }, 2000)
    })
  }

  const resetGame = () => {
    if (initialSessionId) {
      router.push('/jeu')
      return
    }

    setGamePhase('home')
    setSelectedSession(null)
    setCurrentRound(0)
    setSelectedAnswer(null)
    setSurvivors(0)
    setStreak(0)
    setCurrentQuestion(null)
    setIsCorrect(null)
    setPhoneNumber('')
    setPlayerName('') 
    setAskedQuestionIds(new Set()) 
    askedQuestionIdsRef.current = new Set() 
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ==================== HOME - Liste des sessions ====================
  if (gamePhase === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Header compact */}
        <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-lg font-black text-purple-900">1</span>
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-black text-white">IL N'EN RESTERA QU'1</h1>
                  <p className="text-xs text-purple-300">Le Battle Royale du Savoir</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                EN LIGNE
              </span>
            </div>
          </div>
        </header>

        {/* Hero compact avec CTA direct */}
        <section className="relative py-8 md:py-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 to-slate-900" />
          <div className="relative max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-red-600/90 text-white px-4 py-2 rounded-full text-sm font-bold mb-4 animate-pulse">
              🔥 JOUEZ MAINTENANT
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-3">
              Testez vos connaissances,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                Gagnez GROS !
              </span>
            </h1>
            <p className="text-purple-200 text-sm md:text-base mb-6 max-w-xl mx-auto">
              Choisissez une session ci-dessous et soyez le dernier survivant !
            </p>
            
            {/* Stats compactes */}
            <div className="flex justify-center gap-4 md:gap-6">
              <div className="text-center">
                <p className="text-xl md:text-2xl font-black text-yellow-400">25M+</p>
                <p className="text-xs text-white/60">FCFA à gagner</p>
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-black text-green-400">{sessions.length}</p>
                <p className="text-xs text-white/60">Sessions</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comment ça marche - 4 étapes compactes */}
        <section className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {[
              { icon: '📝', title: 'Inscrivez-vous', desc: 'Payez et rejoignez' },
              { icon: '⏰', title: 'Patientez', desc: 'Jusqu\'à l\'heure de session' },
              { icon: '🎮', title: 'Jouez', desc: 'Répondez vite !' },
              { icon: '🏆', title: 'Gagnez', desc: 'Soyez le dernier !' },
            ].map((step, i) => (
              <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-3 md:p-4 text-center border border-white/10">
                <div className="text-2xl md:text-3xl mb-1">{step.icon}</div>
                <h3 className="font-bold text-white text-xs md:text-sm">{step.title}</h3>
                <p className="text-purple-300 text-[10px] md:text-xs hidden sm:block">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sessions disponibles - DIRECTEMENT VISIBLE */}
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              Sessions du jour
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300">
              {sessions.length} sessions
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
              const isTraining = session.id === 'training'
              
              // Calcul du temps restant pour mode horaire
              const getTimeRemaining = () => {
                if (!session.startsAt) return null
                const now = new Date()
                const diff = new Date(session.startsAt).getTime() - now.getTime()
                if (diff <= 0) return 'Maintenant !'
                const hours = Math.floor(diff / (1000 * 60 * 60))
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                if (hours > 0) return `${hours}h ${minutes}min`
                return `${minutes} min`
              }
              
              // Calcul cagnotte dynamique pour mode horaire (pas pour training)
              const dynamicPrize = isTraining 
                ? 0 
                : Math.max(session.minPrize || 25000, Math.floor(session.currentPlayers * session.entryFee * 0.5))
              
              return (
                <div 
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`group bg-white/5 backdrop-blur-xl rounded-3xl border overflow-hidden transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl ${
                    isTraining ? 'border-emerald-500/30 hover:border-emerald-400/50' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {/* Header avec image de fond */}
                  <div
                    className="relative p-4 md:p-6 min-h-[140px] bg-cover bg-center"
                    style={{
                      backgroundImage: session.backgroundImage
                        ? `url(${session.backgroundImage})`
                        : undefined
                    }}
                  >
                    {/* Overlay gradient pour lisibilité */}
                    <div className={`absolute inset-0 ${session.backgroundImage ? 'bg-black/40' : ''} bg-gradient-to-t from-black/70 via-black/30 to-transparent`} />

                    {/* Contenu du header */}
                    <div className="relative z-10">
                      {/* Badge */}
                      <div className="absolute top-0 right-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          isTraining ? 'bg-emerald-400 text-emerald-900' : 'bg-white/30 text-white backdrop-blur-sm'
                        }`}>
                          {isTraining ? '🎓 GRATUIT' : `⏰ ${session.scheduledHour}h00`}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl md:text-4xl drop-shadow-lg">{session.icon}</span>
                      </div>
                      <h4 className="text-xl md:text-2xl font-black text-white drop-shadow-lg">{session.name}</h4>

                      {/* Info Training ou Countdown */}
                      {isTraining ? (
                        <div className="mt-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-white/80" />
                          <span className="text-white/90 text-sm font-medium drop-shadow">
                            Disponible 24h/24
                          </span>
                        </div>
                      ) : session.startsAt && (
                        <div className="mt-2 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-white/80" />
                          <span className="text-white/90 text-sm font-medium drop-shadow">
                            Lancement dans {getTimeRemaining()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="p-4 md:p-6">
                    {/* Cagnotte ou Description Training */}
                    {isTraining ? (
                      <div className="mb-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <p className="text-emerald-300 text-sm font-medium mb-2">✨ Mode Entraînement</p>
                        <p className="text-white/80 text-xs">
                          Testez vos connaissances sans risque ! Même gameplay que les sessions live.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-purple-300 text-xs">CAGNOTTE ACTUELLE</p>
                          <p className="text-2xl md:text-3xl font-black text-white">
                            {dynamicPrize.toLocaleString('fr-FR')} <span className="text-sm">FCFA</span>
                          </p>
                          {session.minPrize && session.minPrize > 0 && (
                            <p className="text-green-400 text-xs mt-1">
                              Min. garanti: {session.minPrize.toLocaleString('fr-FR')} FCFA
                            </p>
                          )}
                        </div>
                        <Trophy className="w-10 h-10 text-yellow-400 opacity-50" />
                      </div>
                    )}

                    {/* Inscription */}
                    <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-purple-400" />
                        <span className="text-purple-200 text-sm">Inscription</span>
                      </div>
                      <span className={`font-bold ${isTraining ? 'text-emerald-400' : 'text-white'}`}>
                        {session.entryFee === 0 ? 'GRATUIT' : `${session.entryFee.toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </div>

                    {/* Inscrits */}
                    <div className="mb-4">
                      {isTraining ? (
                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-400" />
                            <span className="text-emerald-200 text-sm">Jouez immédiatement</span>
                          </div>
                          <span className="text-white font-bold text-lg">∞</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-cyan-400" />
                            <span className="text-cyan-200 text-sm">Déjà inscrits</span>
                          </div>
                          <span className="text-white font-bold text-lg">{session.currentPlayers}</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <button className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-gradient-to-r ${session.color} text-white hover:shadow-lg`}>
                      {isTraining ? 'S\'entraîner maintenant' : 'S\'inscrire'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-purple-300 text-sm">
              Propulsé par <span className="text-white font-bold">Gabon Insight</span> • Le jeu de quiz #1 au Gabon
            </p>
          </div>
        </footer>
      </div>
    )
  }

  // ==================== SESSION DETAIL ====================
  if (gamePhase === 'session-detail' && selectedSession) {
    const isQuotaMode = selectedSession.mode === 'quota'
    const maxP = selectedSession.maxPlayers ?? Infinity
    const progress = isQuotaMode && selectedSession.maxPlayers ? (selectedSession.currentPlayers / selectedSession.maxPlayers) * 100 : 0
    const remaining = isQuotaMode && selectedSession.maxPlayers ? selectedSession.maxPlayers - selectedSession.currentPlayers : null
    
    // Calcul cagnotte dynamique pour mode horaire
    const dynamicPrize = selectedSession.mode === 'hourly' 
      ? Math.max(selectedSession.minPrize || 25000, Math.floor(selectedSession.currentPlayers * selectedSession.entryFee * 0.5))
      : selectedSession.prize
    
    // Temps restant pour mode horaire
    const getTimeRemaining = () => {
      if (!selectedSession.startsAt) return null
      const now = new Date()
      const diff = new Date(selectedSession.startsAt).getTime() - now.getTime()
      if (diff <= 0) return 'Maintenant !'
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      if (hours > 0) return `${hours}h ${minutes}min`
      if (minutes > 0) return `${minutes}min ${seconds}s`
      return `${seconds}s`
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <button onClick={resetGame} className="text-purple-300 hover:text-white flex items-center gap-2">
              ← Retour aux sessions
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Badge Mode */}
          <div className="flex justify-center mb-4">
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${
              selectedSession.mode === 'hourly' 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                : 'bg-green-500/20 text-green-300 border border-green-500/30'
            }`}>
              {selectedSession.mode === 'hourly' ? '⏰ Mode Horaire' : '🎯 Mode Quota'}
            </span>
          </div>

          {/* Session Card */}
          <div
            className="relative rounded-3xl overflow-hidden mb-6 bg-cover bg-center"
            style={{
              backgroundImage: selectedSession.backgroundImage
                ? `url(${selectedSession.backgroundImage})`
                : undefined
            }}
          >
            {/* Overlay gradient pour lisibilité */}
            <div className={`absolute inset-0 ${selectedSession.backgroundImage ? 'bg-black/50' : ''} bg-gradient-to-b from-black/30 via-black/40 to-black/60`} />

            <div className="relative z-10 p-6 md:p-8">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-5xl drop-shadow-lg">{selectedSession.icon}</span>
                <div>
                  <span className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold text-white">
                    {selectedSession.difficulty}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">{selectedSession.name}</h2>
                </div>
              </div>

              {/* Countdown pour mode horaire */}
              {selectedSession.mode === 'hourly' && selectedSession.startsAt && (
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-4 text-center">
                  <p className="text-white/70 text-sm mb-1">LANCEMENT DANS</p>
                  <p className="text-3xl md:text-4xl font-black text-white animate-pulse">
                    {getTimeRemaining()}
                  </p>
                </div>
              )}

              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center">
                <p className="text-white/80 text-sm">
                  {selectedSession.mode === 'hourly' ? 'CAGNOTTE ACTUELLE' : 'CAGNOTTE À GAGNER'}
                </p>
                <p className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                  {dynamicPrize.toLocaleString('fr-FR')} FCFA
                </p>
                {selectedSession.mode === 'hourly' && selectedSession.minPrize && (
                  <p className="text-green-300 text-sm mt-2">
                    ✓ Minimum garanti: {selectedSession.minPrize.toLocaleString('fr-FR')} FCFA
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Infos */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-6 border border-white/10">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-white/5 rounded-xl">
                <Users className="w-8 h-8 mx-auto text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">
                  {selectedSession.maxPlayers ?? '∞'}
                </p>
                <p className="text-purple-300 text-sm">
                  {selectedSession.mode === 'hourly' ? 'Places illimitées' : 'Joueurs max'}
                </p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-xl">
                <Gift className="w-8 h-8 mx-auto text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">
                  {selectedSession.entryFee === 0 ? 'GRATUIT' : selectedSession.entryFee.toLocaleString('fr-FR')}
                </p>
                <p className="text-purple-300 text-sm">
                  {selectedSession.entryFee === 0 ? '' : 'FCFA / inscription'}
                </p>
              </div>
            </div>

            {/* Progression (Mode Quota) ou Inscrits (Mode Horaire) */}
            <div className="mb-6">
              {selectedSession.mode === 'quota' && selectedSession.maxPlayers ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-300">{selectedSession.currentPlayers} inscrits</span>
                    <span className="text-yellow-400 font-bold">{remaining} places restantes</span>
                  </div>
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${selectedSession.color} transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-center text-purple-300 text-sm mt-2">
                    La session démarre quand les {selectedSession.maxPlayers} places sont remplies
                  </p>
                </>
              ) : selectedSession.mode === 'hourly' ? (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-cyan-300 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Joueurs inscrits
                    </span>
                    <span className="text-2xl font-bold text-white">{selectedSession.currentPlayers}</span>
                  </div>
                  <p className="text-cyan-200/70 text-sm text-center">
                    La session démarre à l&apos;heure fixe, peu importe le nombre d&apos;inscrits.
                    <br />Plus il y a d&apos;inscrits, plus la cagnotte est élevée !
                  </p>
                </div>
              ) : (
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <p className="text-purple-300">Session d&apos;entraînement - Places illimitées</p>
                </div>
              )}
            </div>

            {/* Formulaire inscription */}
            <div className="space-y-4">
              {/* Nom */}
              <div>
                <label className="text-purple-300 text-sm mb-2 block">Nom ou Pseudo</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-300/50"
                />
              </div>

              {/* Téléphone */}
              <div>
                <label className="text-purple-300 text-sm mb-2 block">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <span className="bg-white/10 text-white px-4 py-3 rounded-xl">+241</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="XX XX XX XX"
                    className="flex-1 bg-white/10 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 placeholder-purple-300/50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleRegister}
                disabled={phoneNumber.length < 8 || !playerName.trim() || isRegistering}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                  phoneNumber.length >= 8 && playerName.trim()
                    ? `bg-gradient-to-r ${selectedSession.color} text-white hover:shadow-lg`
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isRegistering ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {selectedSession.id === 'training' ? 'Lancement...' : 'Paiement en cours...'}
                  </>
                ) : selectedSession.id === 'training' ? (
                  <>
                    🎓 S'entraîner gratuitement
                  </>
                ) : (
                  <>
                    💳 Payer {selectedSession.entryFee.toLocaleString('fr-FR')} FCFA et s'inscrire
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Règles */}
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Comment ça marche ?
            </h3>
            <div className="space-y-3 text-sm text-purple-200">
              <p>✅ Inscrivez-vous et payez</p>
              <p>✅ Patientez jusqu'à l'heure de session</p>
              <p>✅ Le jeu démarre automatiquement</p>
              <p>✅ Répondez aux questions avant la fin du timer</p>
              <p>✅ Mauvaise réponse = ÉLIMINÉ</p>
              <p>🏆 Le dernier survivant remporte {selectedSession.prize.toLocaleString('fr-FR')} FCFA !</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==================== WAITING FOR QUOTA ====================
  if (gamePhase === 'waiting-for-quota' && selectedSession) {
    // Pour la démo, on simule une jauge sur 100 joueurs
    const isDemo = selectedSession.id === 'demo'
    const displayMax = isDemo ? 100 : (selectedSession.maxPlayers ?? 100)
    const progressPercent = (selectedSession.currentPlayers / displayMax) * 100
    const playersNeeded = displayMax - selectedSession.currentPlayers
    
    // Calcul du temps restant pour mode horaire
    const getTimeRemainingWaiting = () => {
      if (!selectedSession.startsAt) return null
      const now = new Date()
      const diff = new Date(selectedSession.startsAt).getTime() - now.getTime()
      if (diff <= 0) return 'Maintenant !'
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (hours > 0) return `${hours}h ${minutes}min`
      return `${minutes} min`
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/20">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <h2 className="text-2xl font-black text-white mb-2">Inscription confirmée !</h2>
          <p className="text-purple-300 mb-6">
            Vous êtes inscrit à la <span className="text-white font-bold">{selectedSession.name}</span>
          </p>
          
          {/* Affichage différent selon le mode */}
          {selectedSession.mode === 'hourly' ? (
            // Mode Horaire - Afficher le countdown
            <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-xl p-4 mb-6">
              <Clock className="w-8 h-8 mx-auto text-cyan-400 mb-2" />
              <p className="text-cyan-300 text-sm mb-2">Lancement dans</p>
              <p className="text-3xl font-black text-white animate-pulse">{getTimeRemainingWaiting()}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-200">{selectedSession.currentPlayers} joueurs inscrits</span>
              </div>
            </div>
          ) : (
            // Mode Quota - Afficher la progression
            <div className="bg-white/10 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-300 text-sm">Joueurs inscrits</span>
                <span className="text-white font-bold">{selectedSession.currentPlayers}/{isDemo ? displayMax : (selectedSession.maxPlayers ?? '∞')}</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {playersNeeded > 0 && (
                <p className="text-yellow-400 text-sm mt-2">
                  Plus que <span className="font-bold">{playersNeeded}</span> joueur{playersNeeded > 1 ? 's' : ''} !
                </p>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 text-purple-300">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full"
            />
            <span>En attente des autres joueurs...</span>
          </div>
          
          {/* Cagnotte */}
          <div className="mt-6 bg-yellow-500/20 rounded-xl p-4">
            <Trophy className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
            <p className="text-yellow-400 font-bold">{selectedSession.prize.toLocaleString('fr-FR')} FCFA à gagner</p>
          </div>
        </div>
      </div>
    )
  }

  // ==================== WAITING FOR SESSION (Countdown vers l'heure de lancement) ====================
  if (gamePhase === 'waiting-for-session' && selectedSession) {
    // Calculer le temps restant jusqu'à l'heure de session
    const getSessionCountdown = () => {
      if (!selectedSession.startsAt) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
      const now = new Date()
      const diff = new Date(selectedSession.startsAt).getTime() - now.getTime()
      if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      return { hours, minutes, seconds, total: diff }
    }
    
    const countdown = getSessionCountdown()
    
    // Effet pour mettre à jour le countdown et lancer le jeu à l'heure
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      // Précharger les questions 30 secondes avant l'heure (optimisation)
      let questionsPreloaded = false
      const preloadQuestions = () => {
        if (questionsPreloaded) return
        questionsPreloaded = true
        fetch(`${API_URL}/api/game/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rounds: 10, sessionType: 'paid' })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.questions && data.questions.length > 0) {
            setDemoQuestions(data.questions)
            console.log('✅ Questions préchargées pour session horaire')
          }
        })
        .catch(console.error)
      }

      const interval = setInterval(() => {
        const { total } = getSessionCountdown()

        // Précharger les questions 30 secondes avant
        if (total > 0 && total <= 30000 && !questionsPreloaded) {
          preloadQuestions()
        }

        if (total <= 0) {
          // L'heure est arrivée ! Lancer le jeu IMMÉDIATEMENT
          clearInterval(interval)

          // S'assurer que les questions sont chargées (fallback DEMO si pas prêtes)
          if (demoQuestions.length === 0) {
            setDemoQuestions(getShuffledDemoQuestions())
          }

          // Passer en salle d'attente finale (5 secondes au lieu de 30 pour réactivité)
          setGamePhase('waiting-room')
          setWaitingCountdown(5)
          setSurvivors(selectedSession.currentPlayers || 50)
        }
      }, 1000)

      return () => clearInterval(interval)
    }, [selectedSession.startsAt, demoQuestions.length])
    
    // Calcul cagnotte dynamique
    const dynamicPrize = Math.max(
      selectedSession.minPrize || 25000, 
      Math.floor(selectedSession.currentPlayers * selectedSession.entryFee * 0.5)
    )
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/20">
          {/* Confirmation */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          
          <h2 className="text-2xl font-black text-white mb-2">Paiement confirmé !</h2>
          <p className="text-purple-300 mb-2">
            Vous êtes inscrit à <span className="text-white font-bold">{selectedSession.name}</span>
          </p>
          <p className="text-green-400 text-sm mb-6">
            ✓ {selectedSession.entryFee.toLocaleString('fr-FR')} FCFA payés
          </p>
          
          {/* Countdown principal */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 mb-6">
            <p className="text-white/80 text-sm mb-2">LA SESSION DÉMARRE DANS</p>
            <div className="flex justify-center gap-4">
              {countdown.hours > 0 && (
                <div className="text-center">
                  <motion.p 
                    key={countdown.hours}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-black text-white"
                  >
                    {countdown.hours}
                  </motion.p>
                  <p className="text-white/60 text-xs">HEURES</p>
                </div>
              )}
              <div className="text-center">
                <motion.p 
                  key={countdown.minutes}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-black text-white"
                >
                  {countdown.minutes.toString().padStart(2, '0')}
                </motion.p>
                <p className="text-white/60 text-xs">MIN</p>
              </div>
              <div className="text-center">
                <motion.p 
                  key={countdown.seconds}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-black text-white animate-pulse"
                >
                  {countdown.seconds.toString().padStart(2, '0')}
                </motion.p>
                <p className="text-white/60 text-xs">SEC</p>
              </div>
            </div>
          </div>
          
          {/* Joueurs inscrits */}
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-bold">{selectedSession.currentPlayers}</span>
              <span className="text-purple-300">joueurs inscrits</span>
            </div>
          </div>
          
          {/* Cagnotte */}
          <div className="bg-yellow-500/20 rounded-xl p-4 mb-4">
            <Trophy className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
            <p className="text-yellow-400 font-bold text-xl">{dynamicPrize.toLocaleString('fr-FR')} FCFA</p>
            <p className="text-yellow-300/70 text-xs">Cagnotte actuelle</p>
          </div>
          
          {/* Info */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-300 text-sm">
              📱 Restez sur cette page. Le jeu démarrera automatiquement à l'heure prévue !
            </p>
          </div>
          
          {/* Bouton retour */}
          <button 
            onClick={resetGame}
            className="mt-6 text-purple-400 hover:text-white text-sm underline"
          >
            Annuler et retourner à l'accueil
          </button>
        </div>
      </div>
    )
  }

  // ==================== WAITING ROOM ====================
  if (gamePhase === 'waiting-room' && selectedSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/20">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            ⏳
          </motion.div>
          <h2 className="text-2xl font-black text-white mb-2">Salle d'attente</h2>
          <p className="text-purple-300 mb-6">{selectedSession.name}</p>
          
          {/* Timer principal */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 mb-6">
            <p className="text-white/80 text-sm mb-2">La partie commence dans</p>
            <motion.p 
              key={waitingCountdown}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-5xl font-black text-white"
            >
              {formatTime(waitingCountdown)}
            </motion.p>
          </div>

          {/* Joueurs prêts */}
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <Users className="w-6 h-6 mx-auto text-purple-400 mb-2" />
            <p className="text-white font-bold">{survivors} joueurs prêts</p>
          </div>

          {/* Info questions actualité */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-4">
            <Sparkles className="w-6 h-6 mx-auto text-blue-400 mb-2" />
            <p className="text-blue-300 text-sm">
              Questions basées sur <span className="text-white font-bold">l'actualité des dernières 24-36h</span>
            </p>
          </div>

          {/* Timer info */}
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-4">
            <Clock className="w-6 h-6 mx-auto text-orange-400 mb-2" />
            <p className="text-orange-300 text-sm">
              Timer : <span className="text-white font-bold">20 secondes</span> au début, puis diminue progressivement
            </p>
          </div>

          {/* Cagnotte */}
          <div className="bg-yellow-500/20 rounded-xl p-4">
            <Trophy className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
            <p className="text-yellow-400 font-bold">{selectedSession.prize.toLocaleString('fr-FR')} FCFA à gagner</p>
          </div>
        </div>
      </div>
    )
  }

  // ==================== QUESTION ====================
  if (gamePhase === 'question' && currentQuestion && selectedSession) {
    const timerPercent = (timeLeft / maxTime) * 100
    const timerColor = timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-orange-500' : 'bg-green-500'
    const isUrgent = timeLeft <= 5

    return (
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header compact */}
        <motion.div 
          className="bg-black/30 backdrop-blur-xl border-b border-white/10 px-4 py-3"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.span 
                className="text-xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {selectedSession.icon}
              </motion.span>
              <span className="text-white font-bold text-sm hidden sm:block">{selectedSession.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-purple-300">Round <span className="text-white font-bold">{currentRound}</span></span>
              <motion.span 
                className="text-purple-300"
                animate={streak > 0 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                Série <span className="text-yellow-400 font-bold">{streak}🔥</span>
              </motion.span>
            </div>
          </div>
        </motion.div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Stats */}
          <motion.div 
            className="grid grid-cols-2 gap-3 mb-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div 
              className="bg-white/10 backdrop-blur rounded-xl p-3 text-center"
              variants={fadeInUp}
            >
              <p className="text-purple-300 text-xs">Survivants</p>
              <p className="text-2xl font-black text-green-400">{survivors}</p>
            </motion.div>
            <motion.div 
              className="bg-white/10 backdrop-blur rounded-xl p-3 text-center"
              variants={fadeInUp}
            >
              <p className="text-purple-300 text-xs">Cagnotte</p>
              <p className="text-2xl font-black text-yellow-400">{selectedSession.prize.toLocaleString('fr-FR')}</p>
            </motion.div>
          </motion.div>

          {/* Timer avec animation urgente */}
          <motion.div 
            className={`bg-white/10 backdrop-blur rounded-2xl p-4 mb-6 overflow-hidden relative ${isUrgent ? 'ring-2 ring-red-500' : ''}`}
            animate={isUrgent ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.5, repeat: isUrgent ? Infinity : 0 }}
          >
            <motion.div 
              className={`absolute inset-0 ${timerColor} opacity-30`}
              initial={{ width: '100%' }}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-white font-bold flex items-center gap-2">
                <motion.div animate={isUrgent ? { rotate: [0, 15, -15, 0] } : {}} transition={{ duration: 0.3, repeat: isUrgent ? Infinity : 0 }}>
                  <Clock className="w-5 h-5" />
                </motion.div>
                Timer
              </span>
              <motion.span 
                className={`text-2xl font-black ${isUrgent ? 'text-red-400' : 'text-white'}`}
                animate={isUrgent ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: isUrgent ? Infinity : 0 }}
              >
                {timeLeft} sec
              </motion.span>
            </div>
          </motion.div>

          {/* Question avec animation d'entrée */}
          <motion.div 
            className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6 border border-white/10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, delay: 0.1 }}
          >
            <motion.p 
              className="text-purple-400 text-sm mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Question N°{currentRound} • {currentQuestion.difficulty}
            </motion.p>
            <motion.h2 
              className="text-xl md:text-2xl font-bold text-white"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {currentQuestion.question}
            </motion.h2>
          </motion.div>

          {/* Réponses avec animations staggered */}
          <motion.div 
            className="grid gap-3 md:grid-cols-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {currentQuestion.answers.map((answer, index) => {
              const letter = ['A', 'B', 'C', 'D'][index]
              const isSelected = selectedAnswer === index
              
              return (
                <motion.button
                  key={index}
                  onClick={() => selectAnswer(index)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-colors ${
                    isSelected 
                      ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/30' 
                      : 'bg-white/10 text-white border-transparent hover:bg-white/20 hover:border-white/30'
                  }`}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98 }}
                  animate={isSelected ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.2 }}
                >
                  <motion.span 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isSelected ? 'bg-white text-purple-600' : 'bg-white/20'
                    }`}
                    animate={isSelected ? { rotate: [0, 360] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {letter}
                  </motion.span>
                  <span className="font-medium text-left flex-1">{answer}</span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                    >
                      <CheckCircle className="w-6 h-6 text-white" />
                    </motion.div>
                  )}
                </motion.button>
              )
            })}
          </motion.div>

          {/* Info avec animation */}
          <motion.p 
            className="text-center text-purple-300 text-sm mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {selectedAnswer !== null 
              ? '✓ Réponse sélectionnée - Attendez la fin du timer'
              : '⚠️ Sélectionnez une réponse avant la fin !'}
          </motion.p>
        </div>
      </motion.div>
    )
  }

  // ==================== RESULT ====================
  if (gamePhase === 'result' && selectedSession) {
    const correctAnswerText = currentQuestion?.answers[currentQuestion.correct]
    
    return (
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AnimatePresence mode="wait">
          {isCorrect ? (
            <motion.div 
              key="correct"
              className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border-2 border-green-500/50 relative overflow-hidden"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              {/* Effet de particules de succès */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-green-400 rounded-full"
                    initial={{ 
                      x: '50%', 
                      y: '50%',
                      scale: 0 
                    }}
                    animate={{ 
                      x: `${Math.random() * 100}%`,
                      y: `${Math.random() * 100}%`,
                      scale: [0, 1, 0],
                      opacity: [1, 1, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      delay: i * 0.05,
                      ease: 'easeOut'
                    }}
                  />
                ))}
              </div>
              
              <motion.div 
                className="text-6xl mb-4"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, delay: 0.1 }}
              >
                ✅
              </motion.div>
              <motion.h2 
                className="text-2xl font-black text-green-400 mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                CORRECT !
              </motion.h2>
              <motion.p 
                className="text-purple-300 mb-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Série : {streak} 🔥
              </motion.p>

              {/* Affichage des survivants */}
              <motion.div 
                className="mb-4 bg-black/30 rounded-xl p-3 border border-white/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-gray-300 text-sm mb-1">Survivants en lice</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-yellow-400">{survivors}</span>
                  <span className="text-sm text-gray-400">/ {selectedSession.maxPlayers ?? survivors}</span>
                </div>
              </motion.div>
              
              {showEliminationAnim && (
                <motion.div 
                  className="bg-red-500/20 rounded-xl p-4 border border-red-500/50"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', delay: 0.4 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                  >
                    <Skull className="w-8 h-8 mx-auto text-red-400 mb-2" />
                  </motion.div>
                  <p className="text-red-400 font-bold text-xl">-{eliminatedThisRound} éliminés !</p>
                  <p className="text-red-300 text-sm">Il reste {survivors - eliminatedThisRound} joueurs</p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="wrong"
              className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border-2 border-red-500/50"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: [0, -10, 10, -10, 10, 0]
              }}
              transition={{ 
                scale: { type: 'spring', damping: 15 },
                x: { duration: 0.5, delay: 0.2 }
              }}
            >
              <motion.div 
                className="text-6xl mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.4 }}
              >
                ❌
              </motion.div>
              <motion.h2 
                className="text-2xl font-black text-red-400 mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                MAUVAISE RÉPONSE
              </motion.h2>
              
              {/* Afficher la bonne réponse */}
              <motion.div 
                className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-green-300 text-sm mb-1">La bonne réponse était :</p>
                <p className="text-white font-bold text-lg flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  {correctAnswerText}
                </p>
              </motion.div>
              
              <motion.p 
                className="text-purple-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Vous êtes éliminé...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // ==================== PACT VOTE ====================
  if (gamePhase === 'pact-vote' && selectedSession && pactOffer) {
    const timerPercent = (pactTimer / 10) * 100
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-red-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Effet d'alerte */}
        <div className="absolute inset-0 bg-red-600/20 animate-pulse" />
        <div className="absolute top-0 left-0 right-0 h-2 bg-red-600 animate-pulse" />
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-red-600 animate-pulse" />
        
        <div className="max-w-lg w-full relative z-10">
          {/* Alerte Breaking */}
          <div className="bg-red-600 text-white text-center py-2 rounded-t-2xl animate-pulse">
            <span className="font-black text-lg tracking-wider">⚠️ ALERTE PACTE ⚠️</span>
          </div>
          
          <div className="bg-black/90 backdrop-blur-xl rounded-b-3xl p-6 border-2 border-red-600">
            {/* Timer */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-400">Temps restant</span>
                <span className={`font-bold ${pactTimer <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {pactTimer}s
                </span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${pactTimer <= 3 ? 'bg-red-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'}`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>

            {/* Offre */}
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm mb-2">PROPOSITION DE PARTAGE</p>
              <p className="text-yellow-400 text-lg mb-1">{survivors} survivants se partagent</p>
              <p className="text-5xl font-black text-white mb-2">{pactOffer.formattedOffer}</p>
              <p className="text-gray-500 text-xs">par joueur</p>
            </div>

            {/* Boutons de vote */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handlePactVote('accept')}
                disabled={pactVote !== null}
                className={`py-6 rounded-2xl font-black text-xl transition-all ${
                  pactVote === 'accept' 
                    ? 'bg-green-600 text-white scale-105 shadow-lg shadow-green-500/50' 
                    : pactVote !== null 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white hover:scale-105'
                }`}
              >
                ✅ ACCEPTER
              </button>
              <button
                onClick={() => handlePactVote('refuse')}
                disabled={pactVote !== null}
                className={`py-6 rounded-2xl font-black text-xl transition-all ${
                  pactVote === 'refuse' 
                    ? 'bg-red-600 text-white scale-105 shadow-lg shadow-red-500/50' 
                    : pactVote !== null 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-500 text-white hover:scale-105'
                }`}
              >
                ❌ REFUSER
              </button>
            </div>

            {/* Jauge de vote */}
            {pactVote && (
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm text-center mb-2">Votes en cours...</p>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${pactVotePercentage}%` }}
                  />
                </div>
                <p className="text-center mt-2 text-white font-bold">{pactVotePercentage}% acceptent</p>
                <p className="text-center text-xs text-gray-500">80% requis pour valider</p>
              </div>
            )}

            {!pactVote && (
              <p className="text-center text-red-400 text-sm animate-pulse">
                ⚠️ Pas de réponse = REFUS automatique
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ==================== PACT RESULT ====================
  if (gamePhase === 'pact-result' && pactResult) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        pactResult.isPactAccepted 
          ? 'bg-gradient-to-br from-green-900 via-emerald-900 to-green-900' 
          : 'bg-gradient-to-br from-red-900 via-black to-red-900'
      }`}>
        <div className="max-w-md w-full bg-black/80 backdrop-blur-xl rounded-3xl p-8 text-center border-2 border-white/20">
          <div className={`text-7xl mb-4 ${pactResult.isPactAccepted ? 'animate-bounce' : 'animate-pulse'}`}>
            {pactResult.isPactAccepted ? '🤝' : '⚔️'}
          </div>
          <h2 className={`text-3xl font-black mb-4 ${
            pactResult.isPactAccepted ? 'text-green-400' : 'text-red-400'
          }`}>
            {pactResult.isPactAccepted ? 'PACTE ACCEPTÉ !' : 'PACTE REJETÉ !'}
          </h2>
          
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-green-400">✅ OUI</span>
              <span className="text-white font-bold">{pactResult.acceptVotes} votes</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400">❌ NON</span>
              <span className="text-white font-bold">{pactResult.refuseVotes} votes</span>
            </div>
          </div>
          
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden mb-4">
            <div 
              className={`h-full ${pactResult.isPactAccepted ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${pactResult.acceptPercentage}%` }}
            />
          </div>
          
          <p className="text-white text-lg mb-4">
            <span className="font-bold">{pactResult.acceptPercentage}%</span> ont voté OUI
            <br/>
            <span className="text-gray-400 text-sm">(80% requis)</span>
          </p>
          
          <p className={`text-lg ${pactResult.isPactAccepted ? 'text-green-300' : 'text-red-300'}`}>
            {pactResult.isPactAccepted 
              ? '💰 Distribution des gains en cours...'
              : '⚔️ Le combat continue !'}
          </p>
        </div>
      </div>
    )
  }

  // ==================== PACT WINNER ====================
  if (gamePhase === 'pact-winner' && selectedSession && pactOffer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 rounded-3xl p-8 text-center shadow-2xl">
          <div className="text-6xl mb-4">🤝💰</div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 mb-2">
            PACTE VALIDÉ !
          </h2>
          <p className="text-gray-600 mb-4">
            {survivors} joueurs se partagent la cagnotte
          </p>
          
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-4">
            <p className="text-white/80 text-sm">Vous gagnez</p>
            <p className="text-4xl font-black text-white">{pactOffer.formattedOffer}</p>
          </div>
          
          <div className="bg-gray-100 rounded-xl p-4 mb-6 text-left text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">Cagnotte totale</span>
              <span className="font-bold">{pactOffer.formattedPot}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">Montant partagé</span>
              <span className="font-bold text-green-500">{new Intl.NumberFormat('fr-FR').format(pactOffer.amountToShare)} FCFA</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-500">÷ {survivors} joueurs</span>
              <span className="font-bold text-green-600">{pactOffer.formattedOffer}</span>
            </div>
          </div>

          <button 
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl"
          >
            🔄 Nouvelle partie
          </button>
        </div>
      </div>
    )
  }

  // ==================== ELIMINATED ====================
  if (gamePhase === 'eliminated' && selectedSession) {
    const correctAnswerText = currentQuestion?.answers[currentQuestion.correct]

    return (
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-red-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Effet de particules tombantes */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-4 bg-red-500/30 rounded-full"
              initial={{ 
                x: `${Math.random() * 100}%`,
                y: -20,
                opacity: 0.5
              }}
              animate={{ 
                y: '120%',
                opacity: 0
              }}
              transition={{ 
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          ))}
        </div>

        <motion.div 
          className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border-2 border-red-500/50 relative z-10"
          initial={{ scale: 0.5, rotateX: 90 }}
          animate={{ scale: 1, rotateX: 0 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            <Skull className="w-20 h-20 mx-auto text-red-400 mb-4" />
          </motion.div>
          
          <motion.h2 
            className="text-3xl font-black text-red-400 mb-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            ÉLIMINÉ !
          </motion.h2>
          
          {currentQuestion && (
            <motion.div 
              className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-green-300 text-sm mb-1">La bonne réponse était :</p>
              <p className="text-white font-bold text-lg flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                {correctAnswerText}
              </p>
            </motion.div>
          )}

          <motion.p 
            className="text-purple-300 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Vous avez survécu <span className="text-white font-bold">{currentRound}</span> rounds<br/>
            Série : {streak} 🔥
          </motion.p>
          
          <motion.div 
            className="bg-white/10 rounded-xl p-4 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-purple-300 text-sm">Il reste encore</p>
            <p className="text-2xl font-black text-white">{survivors} joueurs</p>
          </motion.div>

          <motion.button 
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🔄 Retenter ma chance
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }

  // ==================== WINNER ====================
  if (gamePhase === 'winner' && selectedSession) {
    return (
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 flex items-center justify-center p-4 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Confetti effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-3 h-3 rounded-sm ${
                ['bg-yellow-300', 'bg-orange-300', 'bg-red-300', 'bg-white', 'bg-purple-300'][i % 5]
              }`}
              initial={{ 
                x: '50%',
                y: -20,
                rotate: 0,
                opacity: 1
              }}
              animate={{ 
                x: `${Math.random() * 100}%`,
                y: '120%',
                rotate: Math.random() * 720 - 360,
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 1,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          ))}
        </div>

        <motion.div 
          className="max-w-md w-full bg-white/95 rounded-3xl p-8 text-center shadow-2xl relative z-10"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Crown className="w-20 h-20 mx-auto text-yellow-500 mb-4" />
            </motion.div>
          </motion.div>
          
          <motion.h2 
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            🎉 VICTOIRE ! 🎉
          </motion.h2>
          
          <motion.p 
            className="text-gray-600 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            VOUS ÊTES LE DERNIER SURVIVANT !<br/>
            {currentRound} rounds • Série {streak} 🔥
          </motion.p>
          
          <motion.div 
            className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring' }}
          >
            <p className="text-white/80 text-sm">Vous gagnez</p>
            <motion.p 
              className="text-4xl font-black text-white"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.1, 1] }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              {selectedSession.prize.toLocaleString('fr-FR')} FCFA
            </motion.p>
          </motion.div>

          <motion.button 
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 rounded-xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🔄 Rejouer
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }

  // Modal de récapitulatif de fin de partie
  const GameSummaryModal = () => {
    if (!showSummaryModal || !gameSummary) return null
    
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={`w-full max-w-md rounded-3xl overflow-hidden shadow-2xl ${
            gameSummary.isWinner 
              ? 'bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500' 
              : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800'
          }`}
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          {/* Header */}
          <div className={`p-6 text-center ${gameSummary.isWinner ? 'bg-white/10' : 'bg-red-500/20'}`}>
            <motion.div 
              className="text-6xl mb-3"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              {gameSummary.isWinner ? '🏆' : '💀'}
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-1">
              {gameSummary.isWinner ? 'VICTOIRE !' : 'ÉLIMINÉ'}
            </h2>
            <p className="text-white/80 text-sm">
              {gameSummary.sessionIcon} {gameSummary.sessionName}
            </p>
          </div>

          {/* Contenu */}
          <div className="p-6 space-y-4 bg-black/20">
            {/* Date et heure */}
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
              <Clock className="w-5 h-5 text-purple-300" />
              <div>
                <p className="text-white font-semibold">{formatDate(gameSummary.endTime)}</p>
                <p className="text-white/60 text-sm">à {formatTime(gameSummary.endTime)}</p>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white/60 text-xs">Rounds joués</p>
                <p className="text-2xl font-black text-white">{gameSummary.totalRounds}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white/60 text-xs">{gameSummary.isWinner ? 'Position' : 'Éliminé au round'}</p>
                <p className="text-2xl font-black text-white">
                  {gameSummary.isWinner ? '🥇 1er' : `#${gameSummary.eliminatedAtRound}`}
                </p>
              </div>
            </div>

            {/* Montant gagné (si victoire) */}
            {gameSummary.isWinner && gameSummary.amountWon && (
              <motion.div 
                className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-center"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-white/80 text-sm">💰 Gains</p>
                <p className="text-3xl font-black text-white">
                  {gameSummary.amountWon.toLocaleString('fr-FR')} FCFA
                </p>
              </motion.div>
            )}

            {/* Question fatale (si éliminé) */}
            {!gameSummary.isWinner && gameSummary.lastQuestion && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-300 text-xs font-semibold mb-2 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Question fatale
                </p>
                <p className="text-white text-sm mb-3">{gameSummary.lastQuestion.question}</p>
                
                <div className="space-y-2">
                  {gameSummary.lastQuestion.answers.map((answer, idx) => (
                    <div 
                      key={idx}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        idx === gameSummary.correctAnswerIndex
                          ? 'bg-green-500/30 border border-green-500 text-green-300'
                          : 'bg-white/5 text-white/60'
                      }`}
                    >
                      {idx === gameSummary.correctAnswerIndex && (
                        <CheckCircle className="w-4 h-4 inline mr-2 text-green-400" />
                      )}
                      {answer}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-black/30">
            <button
              onClick={closeSummaryAndGoHome}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                gameSummary.isWinner
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
              }`}
            >
              {gameSummary.isWinner ? '🎉 Continuer' : '🔄 Rejouer'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // Loading
  return (
    <>
      <AnimatePresence>
        {showSummaryModal && <GameSummaryModal />}
      </AnimatePresence>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold">Chargement...</p>
        </div>
      </div>
    </>
  )
}

