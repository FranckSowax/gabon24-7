/**
 * 🎮 GAME SOCKET SERVICE
 * WebSocket pour synchroniser les sessions de jeu en temps réel
 * - Timer synchronisé pour tous les participants
 * - Questions envoyées simultanément
 * - État de la session partagé
 */

const { Server } = require('socket.io');
const { supabase } = require('../config/supabase');

class GameSocketService {
  constructor() {
    this.io = null;
    this.sessions = new Map(); // sessionId -> SessionState
  }

  /**
   * Initialiser le service WebSocket
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'https://gabon24-7.netlify.app',
          'https://gabon24-7-production.up.railway.app'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.io.on('connection', (socket) => {
      console.log(`🎮 [SOCKET] Nouvelle connexion: ${socket.id}`);

      // Rejoindre une session
      socket.on('join-session', (data) => this.handleJoinSession(socket, data));

      // Quitter une session
      socket.on('leave-session', (data) => this.handleLeaveSession(socket, data));

      // Demander la synchronisation
      socket.on('request-sync', (data) => this.handleRequestSync(socket, data));

      // Soumettre une réponse
      socket.on('submit-answer', (data) => this.handleSubmitAnswer(socket, data));

      // Déconnexion
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });

    console.log('🎮 [SOCKET] Service WebSocket initialisé');
    return this.io;
  }

  /**
   * Créer ou récupérer l'état d'une session (Asynchrone pour DB)
   */
  async getOrCreateSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      // Récupérer les infos de la session depuis Supabase pour le maxPlayers
      let maxPlayers = 100;
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('max_players')
          .eq('id', sessionId)
          .single();
        
        if (data) maxPlayers = data.max_players;
      } catch (e) {
        console.error('Erreur récupération maxPlayers:', e);
      }

      this.sessions.set(sessionId, {
        id: sessionId,
        maxPlayers: maxPlayers,
        phase: 'filling', // filling -> waiting -> question -> result -> pact -> finished
        participants: new Map(), // odId -> { odId, odName, isAlive, score }
        currentQuestion: null,
        currentQuestionIndex: 0,
        questions: [],
        serverStartTime: null, // Timestamp serveur du début du timer
        timerDuration: 0, // Durée totale du timer en secondes
        waitingRoomStartTime: null,
        waitingRoomDuration: 120, // 2 minutes par défaut
      });
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Gérer la connexion d'un participant à une session
   */
  async handleJoinSession(socket, { sessionId, odId, odName }) {
    if (!sessionId) return;

    const session = await this.getOrCreateSession(sessionId);
    
    // Ajouter le participant
    session.participants.set(socket.id, {
      odId: socket.id,
      odName: odName || `Joueur ${session.participants.size + 1}`,
      isAlive: true,
      score: 0,
      joinedAt: Date.now()
    });

    // Rejoindre la room Socket.IO
    socket.join(sessionId);
    socket.sessionId = sessionId;

    console.log(`🎮 [SOCKET] ${odName || socket.id} a rejoint la session ${sessionId} (${session.participants.size}/${session.maxPlayers})`);

    // Envoyer l'état actuel au nouveau participant
    this.sendSyncToSocket(socket, session);

    // Notifier les autres participants
    socket.to(sessionId).emit('participant-joined', {
      odId: socket.id,
      odName: odName || `Joueur ${session.participants.size}`,
      totalParticipants: session.participants.size,
      maxPlayers: session.maxPlayers
    });

    // GESTION DU QUOTA : Si on atteint le nombre max de joueurs, on lance le timer de démarrage
    if (session.participants.size >= session.maxPlayers && session.phase === 'filling') {
      console.log(`✅ [SOCKET] Quota atteint pour ${sessionId}, lancement salle d'attente !`);
      this.startWaitingRoom(sessionId);
    }
  }

  /**
   * Démarrer la salle d'attente avec timer synchronisé
   */
  startWaitingRoom(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.waitingRoomStartTime = Date.now();
    session.phase = 'waiting';

    console.log(`🎮 [SOCKET] Salle d'attente démarrée pour ${sessionId}`);

    // Broadcast le début de la salle d'attente
    this.io.to(sessionId).emit('waiting-room-started', {
      serverTime: session.waitingRoomStartTime,
      duration: session.waitingRoomDuration
    });

    // Programmer la fin de la salle d'attente
    setTimeout(() => {
      this.startGame(sessionId);
    }, session.waitingRoomDuration * 1000);
  }

  /**
   * Démarrer le jeu (première question)
   */
  async startGame(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`🎮 [SOCKET] Démarrage du jeu pour ${sessionId}`);

    // Charger les questions depuis la base
    try {
      const { data: questions, error } = await supabase
        .from('game_questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Mélanger les questions
      session.questions = questions.sort(() => Math.random() - 0.5).slice(0, 10);
      session.currentQuestionIndex = 0;

      // Démarrer la première question
      this.startQuestion(sessionId);
    } catch (error) {
      console.error('❌ [SOCKET] Erreur chargement questions:', error);
      // Fallback: utiliser des questions par défaut
      session.questions = this.getDefaultQuestions();
      session.currentQuestionIndex = 0;
      this.startQuestion(sessionId);
    }
  }

  /**
   * Démarrer une question avec timer synchronisé
   */
  startQuestion(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.currentQuestionIndex >= session.questions.length) {
      this.endGame(sessionId);
      return;
    }

    const question = session.questions[session.currentQuestionIndex];
    const timeLimit = question.time_limit || 15;

    session.phase = 'question';
    session.currentQuestion = question;
    session.serverStartTime = Date.now();
    session.timerDuration = timeLimit;

    // Formater la question pour le frontend
    const questionData = {
      id: question.id,
      round: session.currentQuestionIndex + 1,
      question: question.question_text,
      answers: question.answers,
      correct: question.correct_answer_index,
      timeLimit: timeLimit,
      difficulty: question.difficulty || 'Moyen',
      serverTime: session.serverStartTime,
      totalQuestions: session.questions.length
    };

    console.log(`🎮 [SOCKET] Question ${session.currentQuestionIndex + 1}/${session.questions.length} pour ${sessionId}`);

    // Broadcast la question à tous les participants
    this.io.to(sessionId).emit('question-start', questionData);

    // Programmer la fin du temps
    setTimeout(() => {
      this.endQuestion(sessionId);
    }, timeLimit * 1000);
  }

  /**
   * Fin du temps pour une question
   */
  endQuestion(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.phase !== 'question') return;

    session.phase = 'result';
    const correctAnswer = session.currentQuestion.correct_answer_index;

    console.log(`🎮 [SOCKET] Fin question ${session.currentQuestionIndex + 1} pour ${sessionId}`);

    // Broadcast le résultat
    this.io.to(sessionId).emit('question-end', {
      correctAnswer: correctAnswer,
      serverTime: Date.now()
    });

    // Après 3 secondes, passer à la question suivante ou au pacte
    setTimeout(() => {
      session.currentQuestionIndex++;
      
      // Vérifier si c'est le moment du pacte (après question 5)
      if (session.currentQuestionIndex === 5) {
        this.startPact(sessionId);
      } else if (session.currentQuestionIndex < session.questions.length) {
        this.startQuestion(sessionId);
      } else {
        this.endGame(sessionId);
      }
    }, 3000);
  }

  /**
   * Démarrer le vote du pacte
   */
  startPact(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.phase = 'pact';
    session.serverStartTime = Date.now();
    session.timerDuration = 30; // 30 secondes pour voter

    console.log(`🎮 [SOCKET] Début du pacte pour ${sessionId}`);

    this.io.to(sessionId).emit('pact-start', {
      serverTime: session.serverStartTime,
      duration: 30
    });

    // Après 30 secondes, résoudre le pacte
    setTimeout(() => {
      this.resolvePact(sessionId);
    }, 30000);
  }

  /**
   * Résoudre le pacte et continuer
   */
  resolvePact(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Simuler le résultat du pacte (à améliorer avec les vrais votes)
    const pactAccepted = Math.random() > 0.5;

    console.log(`🎮 [SOCKET] Pacte ${pactAccepted ? 'accepté' : 'refusé'} pour ${sessionId}`);

    this.io.to(sessionId).emit('pact-result', {
      accepted: pactAccepted,
      serverTime: Date.now()
    });

    // Après 3 secondes, continuer le jeu
    setTimeout(() => {
      if (pactAccepted) {
        this.endGame(sessionId);
      } else {
        this.startQuestion(sessionId);
      }
    }, 3000);
  }

  /**
   * Fin du jeu
   */
  endGame(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.phase = 'finished';

    console.log(`🎮 [SOCKET] Fin du jeu pour ${sessionId}`);

    this.io.to(sessionId).emit('game-end', {
      serverTime: Date.now()
    });

    // Nettoyer la session après 5 minutes
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5 * 60 * 1000);
  }

  /**
   * Gérer une demande de synchronisation
   */
  handleRequestSync(socket, { sessionId }) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sendSyncToSocket(socket, session);
  }

  /**
   * Envoyer l'état synchronisé à un socket
   */
  sendSyncToSocket(socket, session) {
    const now = Date.now();
    let remainingTime = 0;

    if (session.phase === 'waiting' && session.waitingRoomStartTime) {
      const elapsed = (now - session.waitingRoomStartTime) / 1000;
      remainingTime = Math.max(0, session.waitingRoomDuration - elapsed);
    } else if (session.phase === 'question' && session.serverStartTime) {
      const elapsed = (now - session.serverStartTime) / 1000;
      remainingTime = Math.max(0, session.timerDuration - elapsed);
    } else if (session.phase === 'pact' && session.serverStartTime) {
      const elapsed = (now - session.serverStartTime) / 1000;
      remainingTime = Math.max(0, session.timerDuration - elapsed);
    }

    socket.emit('sync', {
      sessionId: session.id,
      phase: session.phase,
      serverTime: now,
      remainingTime: remainingTime,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.questions.length,
      currentQuestion: session.phase === 'question' ? {
        id: session.currentQuestion?.id,
        round: session.currentQuestionIndex + 1,
        question: session.currentQuestion?.question_text,
        answers: session.currentQuestion?.answers,
        timeLimit: session.timerDuration,
        difficulty: session.currentQuestion?.difficulty
      } : null,
      participantCount: session.participants.size
    });
  }

  /**
   * Gérer la soumission d'une réponse
   */
  handleSubmitAnswer(socket, { sessionId, odId, answerIndex }) {
    const session = this.sessions.get(sessionId);
    if (!session || session.phase !== 'question') return;

    const participant = session.participants.get(socket.id);
    if (!participant || !participant.isAlive) return; // Ignorer si déjà éliminé

    const isCorrect = answerIndex === session.currentQuestion.correct_answer_index;

    if (isCorrect) {
      participant.score += 100;
    } else {
      participant.isAlive = false;

      // Calculer et broadcast les stats d'élimination
      const stats = this.getSessionStats(session);
      this.io.to(sessionId).emit('player-eliminated', {
        odId: socket.id,
        odName: participant.odName,
        ...stats,
        serverTime: Date.now()
      });
    }

    // Confirmer la réponse au joueur
    socket.emit('answer-confirmed', {
      answerIndex,
      isCorrect,
      score: participant.score,
      isAlive: participant.isAlive
    });

    // Broadcast la mise à jour des stats à tous
    const stats = this.getSessionStats(session);
    this.io.to(sessionId).emit('stats-update', stats);
  }

  /**
   * Obtenir les statistiques d'une session
   */
  getSessionStats(session) {
    let alive = 0;
    let eliminated = 0;
    let totalScore = 0;

    session.participants.forEach(p => {
      if (p.isAlive) {
        alive++;
        totalScore += p.score;
      } else {
        eliminated++;
      }
    });

    return {
      totalParticipants: session.participants.size,
      alivePlayers: alive,
      eliminatedPlayers: eliminated,
      averageScore: alive > 0 ? Math.round(totalScore / alive) : 0
    };
  }

  /**
   * Gérer le départ d'une session
   */
  handleLeaveSession(socket, { sessionId }) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.participants.delete(socket.id);
    socket.leave(sessionId);

    console.log(`🎮 [SOCKET] ${socket.id} a quitté la session ${sessionId}`);

    socket.to(sessionId).emit('participant-left', {
      odId: socket.id,
      totalParticipants: session.participants.size
    });
  }

  /**
   * Gérer la déconnexion
   */
  handleDisconnect(socket) {
    if (socket.sessionId) {
      this.handleLeaveSession(socket, { sessionId: socket.sessionId });
    }
    console.log(`🎮 [SOCKET] Déconnexion: ${socket.id}`);
  }

  /**
   * Questions par défaut (fallback)
   */
  getDefaultQuestions() {
    return [
      {
        id: 'default-1',
        question_text: 'Quelle est la capitale du Gabon ?',
        answers: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'],
        correct_answer_index: 0,
        time_limit: 15,
        difficulty: 'Facile'
      },
      {
        id: 'default-2',
        question_text: 'Quel est le nom du président actuel du Gabon ?',
        answers: ['Brice Oligui Nguema', 'Ali Bongo', 'Omar Bongo', 'Jean Ping'],
        correct_answer_index: 0,
        time_limit: 15,
        difficulty: 'Facile'
      },
      // ... autres questions par défaut
    ];
  }
}

module.exports = new GameSocketService();
