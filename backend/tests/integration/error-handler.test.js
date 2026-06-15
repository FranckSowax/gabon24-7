/**
 * Tests du middleware d'erreur centralisé.
 *
 * Vérifie :
 * - 404 sur route inconnue avec requestId.
 * - 500 sur exception thrown dans un handler, avec requestId, masquage du detail en prod.
 * - 400 avec message custom si err.status défini.
 */

const express = require('express');
const request = require('supertest');
const { errorHandler, notFoundHandler } = require('../../middleware/error-handler');

function buildApp({ nodeEnv = 'test' } = {}) {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  const app = express();
  app.use(express.json());

  app.get('/ok', (req, res) => res.json({ ok: true }));

  app.get('/boom', (_req, _res, _next) => {
    throw new Error('Synthetic explosion');
  });

  app.get('/bad-request', (_req, _res, next) => {
    const err = new Error('Invalid input');
    err.status = 400;
    next(err);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    restoreEnv: () => {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
    },
  };
}

describe('Error handler middleware', () => {
  it('returns 200 for a healthy route', async () => {
    const { app, restoreEnv } = buildApp();
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    restoreEnv();
  });

  it('returns 404 with requestId on unknown route', async () => {
    const { app, restoreEnv } = buildApp();
    const res = await request(app).get('/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
    expect(res.body).toHaveProperty('path', '/unknown-route-xyz');
    expect(res.body).toHaveProperty('requestId');
    expect(typeof res.body.requestId).toBe('string');
    restoreEnv();
  });

  it('returns 500 on thrown error with requestId in non-prod', async () => {
    const { app, restoreEnv } = buildApp({ nodeEnv: 'development' });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Internal server error');
    expect(res.body).toHaveProperty('requestId');
    // En non-prod, le detail est exposé pour faciliter le debug local.
    expect(res.body).toHaveProperty('detail', 'Synthetic explosion');
    expect(res.body).toHaveProperty('stack');
    restoreEnv();
  });

  it('does NOT leak stack/detail in production', async () => {
    const { app, restoreEnv } = buildApp({ nodeEnv: 'production' });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('stack');
    expect(res.body).not.toHaveProperty('detail');
    expect(res.body).toHaveProperty('error', 'Internal server error');
    expect(res.body).toHaveProperty('requestId');
    restoreEnv();
  });

  it('honors err.status (400) and surfaces the message for client-error', async () => {
    const { app, restoreEnv } = buildApp({ nodeEnv: 'production' });
    const res = await request(app).get('/bad-request');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid input');
    expect(res.body).toHaveProperty('requestId');
    restoreEnv();
  });
});
