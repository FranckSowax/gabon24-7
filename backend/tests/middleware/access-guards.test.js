/**
 * Tests des gardes d'accès ajoutés lors de l'audit de sécurité :
 * requireOwnUser, ownUserParam et requireCronOrAdmin.
 */

const express = require('express');
const request = require('supertest');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

// Jetons de test: "token-<uuid>" identifie un utilisateur ; ADMIN est admin en base.
jest.mock('../../supabase-config', () => {
  const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
  let lookedUpId = null;
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn((column, value) => { lookedUpId = value; return builder; }),
    single: jest.fn(() => Promise.resolve({ data: { is_admin: lookedUpId === ADMIN_ID }, error: null })),
  };
  return {
    supabase: {
      from: jest.fn(() => builder),
      auth: {
        getUser: jest.fn((token) => {
          const match = /^token-(.+)$/.exec(token || '');
          if (!match) return Promise.resolve({ data: { user: null }, error: { message: 'invalid' } });
          return Promise.resolve({ data: { user: { id: match[1], email: 'test@example.com' } }, error: null });
        }),
      },
    },
  };
});

const {
  requireOwnUser,
  ownUserParam,
  requireCronOrAdmin,
  INTERNAL_CALL_TOKEN,
} = require('../../middleware/auth');

function createApp() {
  const app = express();
  app.use(express.json());

  const router = express.Router();
  router.param('userId', ownUserParam);
  router.post('/record', (req, res) => res.json({ ok: true, user: req.user.id }));
  router.get('/history/:userId', (req, res) => res.json({ ok: true }));
  router.get('/list', (req, res) => res.json({ ok: true }));
  app.use('/api/reading-history', requireOwnUser, router);

  app.post('/api/rss/process-all', requireCronOrAdmin, (req, res) => res.json({ ok: true, cron: req.isCron === true }));
  return app;
}

const bearer = (id) => ({ Authorization: `Bearer token-${id}` });

describe('requireOwnUser', () => {
  const app = createApp();

  it('refuse une requête sans jeton', async () => {
    const res = await request(app).post('/api/reading-history/record').send({ userId: USER });
    expect(res.status).toBe(401);
  });

  it('refuse un jeton invalide', async () => {
    const res = await request(app)
      .post('/api/reading-history/record')
      .set('Authorization', 'Bearer nimporte-quoi')
      .send({ userId: USER });
    expect(res.status).toBe(401);
  });

  it('accepte son propre userId dans le body', async () => {
    const res = await request(app).post('/api/reading-history/record').set(bearer(USER)).send({ userId: USER });
    expect(res.status).toBe(200);
    expect(res.body.user).toBe(USER);
  });

  it('accepte une requête sans userId', async () => {
    const res = await request(app).post('/api/reading-history/record').set(bearer(USER)).send({ articleId: 'a1' });
    expect(res.status).toBe(200);
  });

  it.each(['userId', 'user_id'])('refuse le %s d\'un autre dans le body', async (key) => {
    const res = await request(app).post('/api/reading-history/record').set(bearer(USER)).send({ [key]: OTHER });
    expect(res.status).toBe(403);
  });

  it.each(['userId', 'user_id'])('refuse le %s d\'un autre dans la query', async (key) => {
    const res = await request(app).get(`/api/reading-history/list?${key}=${OTHER}`).set(bearer(USER));
    expect(res.status).toBe(403);
  });

  it('refuse le :userId d\'un autre dans l\'URL', async () => {
    const res = await request(app).get(`/api/reading-history/history/${OTHER}`).set(bearer(USER));
    expect(res.status).toBe(403);
  });

  it('accepte son propre :userId dans l\'URL', async () => {
    const res = await request(app).get(`/api/reading-history/history/${USER}`).set(bearer(USER));
    expect(res.status).toBe(200);
  });

  it('laisse un administrateur agir sur un autre compte', async () => {
    const body = await request(app).post('/api/reading-history/record').set(bearer(ADMIN)).send({ userId: OTHER });
    const param = await request(app).get(`/api/reading-history/history/${OTHER}`).set(bearer(ADMIN));
    expect(body.status).toBe(200);
    expect(param.status).toBe(200);
  });
});

describe('requireCronOrAdmin', () => {
  const app = createApp();
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('refuse un appel anonyme', async () => {
    process.env.CRON_SECRET = 'secret-cron';
    const res = await request(app).post('/api/rss/process-all');
    expect(res.status).toBe(401);
  });

  it('refuse un mauvais secret', async () => {
    process.env.CRON_SECRET = 'secret-cron';
    const res = await request(app).post('/api/rss/process-all').set('X-Cron-Secret', 'faux');
    expect(res.status).toBe(401);
  });

  it('accepte le bon secret de cron', async () => {
    process.env.CRON_SECRET = 'secret-cron';
    const res = await request(app).post('/api/rss/process-all').set('X-Cron-Secret', 'secret-cron');
    expect(res.status).toBe(200);
    expect(res.body.cron).toBe(true);
  });

  it('reste fermé si CRON_SECRET n\'est pas configuré, même avec un en-tête vide', async () => {
    delete process.env.CRON_SECRET;
    const empty = await request(app).post('/api/rss/process-all').set('X-Cron-Secret', '');
    const any = await request(app).post('/api/rss/process-all').set('X-Cron-Secret', 'undefined');
    expect(empty.status).toBe(401);
    expect(any.status).toBe(401);
  });

  it('accepte le jeton interne du processus', async () => {
    delete process.env.CRON_SECRET;
    const res = await request(app).post('/api/rss/process-all').set('X-Internal-Token', INTERNAL_CALL_TOKEN);
    expect(res.status).toBe(200);
  });

  it('accepte un administrateur et refuse un simple utilisateur', async () => {
    delete process.env.CRON_SECRET;
    const admin = await request(app).post('/api/rss/process-all').set(bearer(ADMIN));
    const user = await request(app).post('/api/rss/process-all').set(bearer(USER));
    expect(admin.status).toBe(200);
    expect(user.status).toBe(403);
  });
});
