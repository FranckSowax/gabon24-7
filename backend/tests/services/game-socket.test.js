/**
 * Durcissement du service temps réel du jeu : sessions inconnues, quota,
 * nom affiché et réponses répétées.
 */

const KNOWN_SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNKNOWN_SESSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const mockLookup = jest.fn();

jest.mock('socket.io', () => ({ Server: jest.fn() }));
jest.mock('../../config/supabase', () => {
  const builder = {
    select: () => builder,
    eq: (column, value) => { builder.sessionId = value; return builder; },
    single: () => mockLookup(builder.sessionId),
    maybeSingle: () => mockLookup(builder.sessionId),
  };
  return { supabase: { from: () => builder } };
});

jest.mock('../../supabase-config', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async (token) => {
        const match = /^token-(.+)$/.exec(token || '');
        if (!match) return { data: { user: null }, error: { message: 'invalid' } };
        return { data: { user: { id: match[1] } }, error: null };
      }),
    },
  },
}));

const gameSocket = require('../../services/game-socket');

// Par défaut chaque connexion appartient à un compte distinct.
const makeSocket = (id, userId = `user-${id}`) => ({
  id,
  data: userId ? { userId } : {},
  emit: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
});

beforeEach(() => {
  gameSocket.sessions.clear();
  gameSocket.io = { to: jest.fn(() => ({ emit: jest.fn() })) };
  jest.spyOn(gameSocket, 'startWaitingRoom').mockImplementation(() => {});
  mockLookup.mockReset().mockImplementation(async (sessionId) =>
    (sessionId === KNOWN_SESSION ? { data: { id: sessionId, max_players: 2 }, error: null } : { data: null, error: null }));
});

afterEach(() => jest.restoreAllMocks());

describe('authentification de la connexion', () => {
  const connect = async (auth) => {
    const socket = { handshake: { auth } };
    const next = jest.fn();
    await gameSocket.authenticateSocket(socket, next);
    return { socket, next };
  };

  it('accepte un jeton valide et retient l\'identité du joueur', async () => {
    const { socket, next } = await connect({ token: 'token-joueur-1' });

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe('joueur-1');
  });

  it.each([
    ['sans jeton', {}],
    ['sans bloc auth', undefined],
    ['jeton vide', { token: '' }],
    ['jeton non textuel', { token: { id: 'joueur-1' } }],
    ['jeton invalide', { token: 'nimporte-quoi' }],
  ])('refuse une connexion %s', async (label, auth) => {
    const { socket, next } = await connect(auth);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data).toBeUndefined();
  });

  it('refuse de rejoindre une session sans identité', async () => {
    const socket = makeSocket('s1', null);

    await gameSocket.handleJoinSession(socket, { sessionId: KNOWN_SESSION, odName: 'Ada' });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('session-error', { error: 'Connexion non authentifiée' });
  });
});

describe('un compte = un participant', () => {
  it('un même compte ne remplit pas le quota avec plusieurs connexions', async () => {
    for (const id of ['s1', 's2', 's3']) {
      await gameSocket.handleJoinSession(makeSocket(id, 'meme-compte'), { sessionId: KNOWN_SESSION, odName: 'Ada' });
    }

    const session = gameSocket.sessions.get(KNOWN_SESSION);
    expect(session.participants.size).toBe(1);
    expect(gameSocket.startWaitingRoom).not.toHaveBeenCalled();
  });

  it('un joueur éliminé le reste après déconnexion et reconnexion', async () => {
    const first = makeSocket('s1', 'joueur-1');
    await gameSocket.handleJoinSession(first, { sessionId: KNOWN_SESSION, odName: 'Ada' });
    const session = gameSocket.sessions.get(KNOWN_SESSION);
    session.phase = 'question';
    session.currentQuestionIndex = 0;
    session.currentQuestion = { correct_answer_index: 1 };
    gameSocket.handleSubmitAnswer(first, { sessionId: KNOWN_SESSION, answerIndex: 0 }); // mauvaise réponse

    gameSocket.handleLeaveSession(first, { sessionId: KNOWN_SESSION });
    const second = makeSocket('s2', 'joueur-1');
    await gameSocket.handleJoinSession(second, { sessionId: KNOWN_SESSION, odName: 'Ada' });

    expect(session.participants.size).toBe(1);
    expect(session.participants.get('s2')).toEqual(expect.objectContaining({ isAlive: false, userId: 'joueur-1', disconnected: false }));
  });

  it('un joueur en vie garde son score après reconnexion', async () => {
    const first = makeSocket('s1', 'joueur-1');
    await gameSocket.handleJoinSession(first, { sessionId: KNOWN_SESSION, odName: 'Ada' });
    const session = gameSocket.sessions.get(KNOWN_SESSION);
    session.phase = 'question';
    session.currentQuestionIndex = 0;
    session.currentQuestion = { correct_answer_index: 1 };
    gameSocket.handleSubmitAnswer(first, { sessionId: KNOWN_SESSION, answerIndex: 1 });

    gameSocket.handleLeaveSession(first, { sessionId: KNOWN_SESSION });
    const second = makeSocket('s2', 'joueur-1');
    await gameSocket.handleJoinSession(second, { sessionId: KNOWN_SESSION });

    expect(session.participants.get('s2')).toEqual(expect.objectContaining({ isAlive: true, score: 100, odName: 'Ada' }));
    // ...et ne peut pas répondre une seconde fois à la même question
    gameSocket.handleSubmitAnswer(second, { sessionId: KNOWN_SESSION, answerIndex: 1 });
    expect(session.participants.get('s2').score).toBe(100);
  });

  it('avant le début de la partie, quitter libère bien la place', async () => {
    const socket = makeSocket('s1', 'joueur-1');
    await gameSocket.handleJoinSession(socket, { sessionId: KNOWN_SESSION, odName: 'Ada' });

    gameSocket.handleLeaveSession(socket, { sessionId: KNOWN_SESSION });

    expect(gameSocket.sessions.get(KNOWN_SESSION).participants.size).toBe(0);
  });
});

describe('join-session', () => {
  it('refuse une session inconnue sans créer d\'état en mémoire', async () => {
    const socket = makeSocket('s1');

    await gameSocket.handleJoinSession(socket, { sessionId: UNKNOWN_SESSION, odName: 'Ada' });

    expect(gameSocket.sessions.has(UNKNOWN_SESSION)).toBe(false);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('session-error', { error: 'Session inconnue' });
  });

  it.each([undefined, null, {}, { sessionId: 42 }, { sessionId: '' }, { sessionId: 'x'.repeat(65) }])(
    'ignore une demande mal formée (%p)',
    async (payload) => {
      const socket = makeSocket('s1');

      await gameSocket.handleJoinSession(socket, payload);

      expect(gameSocket.sessions.size).toBe(0);
      expect(socket.join).not.toHaveBeenCalled();
    }
  );

  it('accepte une session existante et les sessions démo / entraînement', async () => {
    for (const sessionId of [KNOWN_SESSION, 'demo', 'training']) {
      const socket = makeSocket(`socket-${sessionId}`);
      await gameSocket.handleJoinSession(socket, { sessionId, odName: 'Ada' });
      expect(socket.join).toHaveBeenCalledWith(sessionId);
    }
  });

  it('nettoie et tronque le nom affiché', async () => {
    const socket = makeSocket('s1');

    await gameSocket.handleJoinSession(socket, {
      sessionId: KNOWN_SESSION,
      odName: `<img src=x onerror=alert(1)>\u0000${'a'.repeat(80)}`,
    });

    const { odName } = gameSocket.sessions.get(KNOWN_SESSION).participants.get('s1');
    expect(odName).not.toMatch(/[<>\u0000]/);
    expect(odName.length).toBeLessThanOrEqual(30);
  });

  it('refuse un participant au-delà du quota de la session', async () => {
    const sockets = ['s1', 's2', 's3'].map((id) => makeSocket(id));
    for (const socket of sockets) {
      await gameSocket.handleJoinSession(socket, { sessionId: KNOWN_SESSION, odName: 'Joueur' });
    }

    expect(gameSocket.sessions.get(KNOWN_SESSION).participants.size).toBe(2);
    expect(sockets[2].join).not.toHaveBeenCalled();
    expect(sockets[2].emit).toHaveBeenCalledWith('session-error', { error: 'Session complète' });
  });
});

describe('submit-answer', () => {
  const startQuestion = async () => {
    const socket = makeSocket('s1');
    await gameSocket.handleJoinSession(socket, { sessionId: KNOWN_SESSION, odName: 'Ada' });
    const session = gameSocket.sessions.get(KNOWN_SESSION);
    session.phase = 'question';
    session.currentQuestionIndex = 0;
    session.currentQuestion = { correct_answer_index: 1 };
    return { socket, session, participant: session.participants.get('s1') };
  };

  it('ne compte qu\'une réponse par question', async () => {
    const { socket, participant } = await startQuestion();

    for (let i = 0; i < 5; i++) {
      gameSocket.handleSubmitAnswer(socket, { sessionId: KNOWN_SESSION, answerIndex: 1 });
    }

    expect(participant.score).toBe(100);
  });

  it('ne permet pas de corriger une mauvaise réponse', async () => {
    const { socket, participant } = await startQuestion();

    gameSocket.handleSubmitAnswer(socket, { sessionId: KNOWN_SESSION, answerIndex: 0 });
    gameSocket.handleSubmitAnswer(socket, { sessionId: KNOWN_SESSION, answerIndex: 1 });

    expect(participant.isAlive).toBe(false);
    expect(participant.score).toBe(0);
  });

  it('accepte de nouveau une réponse à la question suivante', async () => {
    const { socket, session, participant } = await startQuestion();

    gameSocket.handleSubmitAnswer(socket, { sessionId: KNOWN_SESSION, answerIndex: 1 });
    session.currentQuestionIndex = 1;
    gameSocket.handleSubmitAnswer(socket, { sessionId: KNOWN_SESSION, answerIndex: 1 });

    expect(participant.score).toBe(200);
  });

  it.each([undefined, null, {}, { sessionId: KNOWN_SESSION }, { sessionId: KNOWN_SESSION, answerIndex: '1' }])(
    'ignore une réponse mal formée (%p)',
    async (payload) => {
      const { socket, participant } = await startQuestion();

      expect(() => gameSocket.handleSubmitAnswer(socket, payload)).not.toThrow();
      expect(participant.score).toBe(0);
      expect(participant.isAlive).toBe(true);
    }
  );
});
