/**
 * Middlewares de validation : une donnée invalide doit donner un 400 lisible.
 *
 * WHY: ces middlewares lisaient `error.errors`, qui n'existe plus en zod 4.
 * Aucun test ne les couvrait : toute requête invalide aurait répondu 500 après
 * la montée de version, sans que la suite le signale.
 */

const express = require('express');
const request = require('supertest');
const { z } = require('zod');

const { validateBody, validateQuery, validateParams } = require('../../middleware/validation');

const app = express();
app.use(express.json());

const bodySchema = z.object({
  name: z.string().min(3, 'Nom trop court'),
  amount: z.coerce.number().int().positive(),
});
app.post('/body', validateBody(bodySchema), (req, res) => res.json({ success: true, body: req.body }));

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
app.get('/query', validateQuery(querySchema), (req, res) => res.json({ success: true, query: req.query }));

const paramsSchema = z.object({ id: z.string().uuid() });
app.get('/params/:id', validateParams(paramsSchema), (req, res) => res.json({ success: true }));

describe('middlewares de validation', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('validateBody laisse passer un corps valide et le nettoie', async () => {
    const res = await request(app).post('/body').send({ name: 'Campagne', amount: '5000', extra: 'ignoré' });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'Campagne', amount: 5000 });
  });

  it('validateBody répond 400 avec le champ et le message en cause', async () => {
    const res = await request(app).post('/body').send({ name: 'ab', amount: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'name', message: 'Nom trop court' }),
      expect.objectContaining({ field: 'amount' }),
    ]));
  });

  it('validateBody répond 400 sur un corps vide', async () => {
    const res = await request(app).post('/body').send({});

    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(1);
  });

  it('validateQuery applique les valeurs par défaut', async () => {
    const res = await request(app).get('/query');

    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ limit: 20 });
  });

  it('validateQuery répond 400 sur un paramètre hors limites', async () => {
    const res = await request(app).get('/query?limit=5000');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('validateParams accepte un identifiant valide et refuse le reste', async () => {
    const ok = await request(app).get('/params/11111111-1111-4111-8111-111111111111');
    const bad = await request(app).get('/params/pas-un-uuid');

    expect(ok.status).toBe(200);
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
  });
});
