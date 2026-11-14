/**
 * Tests de sécurité des routes de crédits.
 * Vérifie qu'aucune route ne permet de créer des crédits sans paiement ni de
 * toucher au compte d'un autre utilisateur.
 */

const express = require('express');
const request = require('supertest');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

// Auth simulée: l'en-tête x-test-user donne l'identité, x-test-admin le rôle admin
jest.mock('../../middleware/auth', () => {
  const authenticate = (req, res) => {
    const id = req.headers['x-test-user'];
    if (!id) {
      res.status(401).json({ success: false, error: 'Token requis' });
      return false;
    }
    req.user = { id, email: 'test@example.com' };
    return true;
  };
  return {
    requireAuth: (req, res, next) => { if (authenticate(req, res)) next(); },
    optionalAuth: (req, res, next) => next(),
    requireAdmin: (req, res, next) => {
      if (!authenticate(req, res)) return;
      if (req.headers['x-test-admin'] !== 'true') {
        return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
      }
      next();
    },
  };
});

jest.mock('../../supabase-config', () => {
  const state = { writes: [], rpcCalls: [] };
  const from = jest.fn((table) => {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      range: jest.fn(() => builder),
      insert: jest.fn((row) => { state.writes.push({ table, op: 'insert', row }); return builder; }),
      update: jest.fn((row) => { state.writes.push({ table, op: 'update', row }); return builder; }),
      upsert: jest.fn((row) => { state.writes.push({ table, op: 'upsert', row }); return builder; }),
      single: jest.fn(() => Promise.resolve({ data: { user_id: 'x', balance: 10, bonus_balance: 0 }, error: null })),
      then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return builder;
  });
  const rpc = jest.fn((name, params) => {
    state.rpcCalls.push({ name, params });
    return Promise.resolve({ data: { success: true }, error: null });
  });
  return { supabase: { from, rpc }, __state: state };
});

const supabaseMock = require('../../supabase-config');
const PaymentService = require('../../services/payment.service').constructor;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/credits', require('../../routes/credits'));
  app.use('/api/credits-premium', require('../../routes/credits-premium'));
  return app;
}

describe('Routes crédits — pas de crédits sans paiement', () => {
  let app;
  const originalSecret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;

  beforeEach(() => {
    supabaseMock.__state.writes.length = 0;
    supabaseMock.__state.rpcCalls.length = 0;
    delete process.env.MOBILE_MONEY_WEBHOOK_SECRET;
    app = createApp();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.MOBILE_MONEY_WEBHOOK_SECRET;
    else process.env.MOBILE_MONEY_WEBHOOK_SECRET = originalSecret;
  });

  it('POST /api/credits/add refuse un utilisateur non connecté', async () => {
    const res = await request(app).post('/api/credits/add').send({ amount: 1000 });
    expect(res.status).toBe(401);
  });

  it('POST /api/credits/add refuse un utilisateur non admin', async () => {
    const res = await request(app)
      .post('/api/credits/add')
      .set('x-test-user', USER_ID)
      .send({ amount: 1000000 });

    expect(res.status).toBe(403);
    expect(supabaseMock.__state.writes).toHaveLength(0);
    expect(supabaseMock.__state.rpcCalls).toHaveLength(0);
  });

  it('POST /api/credits/add reste utilisable par un admin', async () => {
    const res = await request(app)
      .post('/api/credits/add')
      .set('x-test-user', USER_ID)
      .set('x-test-admin', 'true')
      .send({ amount: 50, userId: OTHER_ID });

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('POST /api/credits/packages ne crédite plus rien (410)', async () => {
    const res = await request(app)
      .post('/api/credits/packages')
      .set('x-test-user', USER_ID)
      .send({ packageId: 'pkg-1', paymentMethod: 'demo', paymentReference: 'inventé' });

    expect(res.status).toBe(410);
    expect(supabaseMock.__state.writes).toHaveLength(0);
    expect(supabaseMock.__state.rpcCalls).toHaveLength(0);
  });

  it('POST /api/credits-premium/consume débite le compte du jeton, pas celui du body', async () => {
    const res = await request(app)
      .post('/api/credits-premium/consume')
      .set('x-test-user', USER_ID)
      .send({ userId: OTHER_ID, serviceName: 'chat', amount: 5 });

    expect(res.status).toBe(200);
    expect(supabaseMock.__state.rpcCalls).toHaveLength(1);
    expect(supabaseMock.__state.rpcCalls[0].params.p_user_id).toBe(USER_ID);
  });

  it('GET /api/credits-premium/balance/:userId refuse le solde d\'un autre utilisateur', async () => {
    const res = await request(app)
      .get(`/api/credits-premium/balance/${OTHER_ID}`)
      .set('x-test-user', USER_ID);

    expect(res.status).toBe(403);
  });

  it('webhook Mobile Money fermé tant que le secret n\'est pas configuré', async () => {
    const res = await request(app)
      .post('/api/credits-premium/webhook/mobile-money')
      .send({ transactionId: 'tx-1', status: 'SUCCESS' });

    expect(res.status).toBe(503);
    expect(supabaseMock.__state.writes).toHaveLength(0);
  });

  it('webhook Mobile Money refuse un mauvais secret et accepte le bon', async () => {
    process.env.MOBILE_MONEY_WEBHOOK_SECRET = 'secret-de-test';

    const bad = await request(app)
      .post('/api/credits-premium/webhook/mobile-money')
      .set('x-webhook-secret', 'faux')
      .send({ transactionId: 'tx-1', status: 'SUCCESS' });
    expect(bad.status).toBe(401);
    expect(supabaseMock.__state.writes).toHaveLength(0);

    const good = await request(app)
      .post('/api/credits-premium/webhook/mobile-money')
      .set('x-webhook-secret', 'secret-de-test')
      .send({ transactionId: 'tx-1', status: 'SUCCESS' });
    expect(good.status).toBe(200);
    expect(supabaseMock.__state.writes).toHaveLength(1);
  });

  it('POST /api/credits-premium/purchase refuse une méthode de paiement inconnue', async () => {
    const res = await request(app)
      .post('/api/credits-premium/purchase')
      .set('x-test-user', USER_ID)
      .send({ packageId: 'pkg-1', paymentMethod: 'gratuit' });

    expect(res.status).toBe(400);
    expect(supabaseMock.__state.writes).toHaveLength(0);
  });
});

describe('PaymentService — fournisseur démo', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_DEMO_PAYMENTS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_DEMO_PAYMENTS;
    else process.env.ALLOW_DEMO_PAYMENTS = originalFlag;
  });

  it('une méthode inconnue ne retombe plus sur le fournisseur démo', () => {
    const service = new PaymentService();
    expect(() => service.getProvider('inconnue')).toThrow('Méthode de paiement non supportée');
    expect(() => service.getProvider('constructor')).toThrow('Méthode de paiement non supportée');
  });

  it('le fournisseur démo est indisponible par défaut', () => {
    delete process.env.ALLOW_DEMO_PAYMENTS;
    const service = new PaymentService();
    expect(() => service.getProvider('demo')).toThrow('Méthode de paiement non supportée');
  });

  it('le fournisseur démo reste indisponible en production, même avec le flag', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_PAYMENTS = 'true';
    const service = new PaymentService();
    expect(() => service.getProvider('demo')).toThrow('Méthode de paiement non supportée');
  });
});
