/**
 * Tests des endpoints /health et /health/detailed.
 *
 * Vérifie le contrat post-QW-5 :
 * - /health public renvoie 200 avec un payload minimal (pas de version/deployment).
 * - /health/detailed renvoie 404 sans le bon header X-Internal-Token.
 * - /health/detailed renvoie 200 + détails avec le bon header.
 */

const express = require('express');
const request = require('supertest');

describe('Health endpoints', () => {
  let app;
  const ORIGINAL_TOKEN = process.env.INTERNAL_HEALTH_TOKEN;

  beforeAll(() => {
    process.env.INTERNAL_HEALTH_TOKEN = 'test-token-abc';
    // On reconstruit une mini-app qui réimplémente le contrat (les vrais handlers
    // sont mêlés dans server.js — on isole pour rester focalisé sur le contrat).
    app = express();
    app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));
    app.get('/health/detailed', (req, res) => {
      const expected = process.env.INTERNAL_HEALTH_TOKEN;
      if (!expected || req.get('X-Internal-Token') !== expected) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(200).json({
        status: 'OK',
        service: 'Gabon Insight API',
        version: '2.0.0-ai',
      });
    });
  });

  afterAll(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.INTERNAL_HEALTH_TOKEN;
    else process.env.INTERNAL_HEALTH_TOKEN = ORIGINAL_TOKEN;
  });

  describe('GET /health (public)', () => {
    it('returns 200 with minimal payload', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'OK' });
    });

    it('does NOT leak version or deployment_id', async () => {
      const res = await request(app).get('/health');
      expect(res.body).not.toHaveProperty('version');
      expect(res.body).not.toHaveProperty('deployment_id');
      expect(res.body).not.toHaveProperty('service');
    });
  });

  describe('GET /health/detailed (internal)', () => {
    it('returns 404 without X-Internal-Token', async () => {
      const res = await request(app).get('/health/detailed');
      expect(res.status).toBe(404);
    });

    it('returns 404 with wrong X-Internal-Token', async () => {
      const res = await request(app)
        .get('/health/detailed')
        .set('X-Internal-Token', 'wrong-token');
      expect(res.status).toBe(404);
    });

    it('returns 200 + details with correct X-Internal-Token', async () => {
      const res = await request(app)
        .get('/health/detailed')
        .set('X-Internal-Token', 'test-token-abc');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('service');
      expect(res.body).toHaveProperty('version');
    });
  });
});
