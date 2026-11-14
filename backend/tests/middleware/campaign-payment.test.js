/**
 * Garde « campagne payée » : une campagne non payée ne peut pas être publiée.
 * Supabase est simulé en mémoire, aucun appel réseau.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const { requirePaidCampaign, isCampaignPaid } = require('../../middleware/campaign-payment');

function makeSupabase(result) {
  const calls = [];
  const builder = {
    select: (columns) => { calls.push(['select', columns]); return builder; },
    eq: (column, value) => { calls.push(['eq', column, value]); return builder; },
    maybeSingle: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
  return { calls, from: (table) => { calls.push(['from', table]); return builder; } };
}

function makeApp(supabase) {
  const app = express();
  app.use(express.json());
  const published = jest.fn((req, res) => res.json({ success: true, published: true }));
  app.put('/api/campaigns/:id/validate', requirePaidCampaign(supabase), published);
  return { app, published };
}

const validate = (app) => request(app).put('/api/campaigns/camp-1/validate').send({});

describe('requirePaidCampaign', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it.each(['completed', 'paid'])('laisse passer une campagne payée (%s)', async (payment_status) => {
    const supabase = makeSupabase({ data: { id: 'camp-1', payment_status }, error: null });
    const { app, published } = makeApp(supabase);

    const res = await validate(app);

    expect(res.status).toBe(200);
    expect(published).toHaveBeenCalledTimes(1);
    expect(supabase.calls).toEqual([
      ['from', 'campaigns'],
      ['select', 'id, payment_status'],
      ['eq', 'id', 'camp-1'],
    ]);
  });

  it.each([
    ['en attente', 'pending'],
    ['échoué', 'failed'],
    ['annulé', 'cancelled'],
    ['inconnu', 'PAID '],
    ['absent', null],
    ['non renseigné', undefined],
  ])('bloque une campagne dont le paiement est %s', async (label, payment_status) => {
    const supabase = makeSupabase({ data: { id: 'camp-1', payment_status }, error: null });
    const { app, published } = makeApp(supabase);

    const res = await validate(app);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'CAMPAIGN_NOT_PAID' });
    expect(published).not.toHaveBeenCalled();
  });

  it('répond 404 si la campagne n\'existe pas', async () => {
    const { app, published } = makeApp(makeSupabase({ data: null, error: null }));

    const res = await validate(app);

    expect(res.status).toBe(404);
    expect(published).not.toHaveBeenCalled();
  });

  it('bloque si le paiement n\'a pas pu être vérifié (erreur de lecture)', async () => {
    const { app, published } = makeApp(makeSupabase({ data: null, error: { message: 'relation manquante' } }));

    const res = await validate(app);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PAYMENT_CHECK_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('relation');
    expect(published).not.toHaveBeenCalled();
  });

  it('bloque si la lecture lève une exception', async () => {
    const { app, published } = makeApp(makeSupabase(new Error('réseau coupé')));

    const res = await validate(app);

    expect(res.status).toBe(503);
    expect(published).not.toHaveBeenCalled();
  });

  it('isCampaignPaid ne reconnaît que les états réglés', () => {
    expect(isCampaignPaid({ payment_status: 'completed' })).toBe(true);
    expect(isCampaignPaid({ payment_status: 'paid' })).toBe(true);
    expect(isCampaignPaid({ payment_status: 'pending' })).toBe(false);
    expect(isCampaignPaid({})).toBe(false);
    expect(isCampaignPaid(null)).toBe(false);
  });
});

describe('server.js — le garde précède toutes les routes qui publient une campagne', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  const guardAt = source.indexOf('const paidCampaignGuard =');

  it('le garde est déclaré', () => {
    expect(guardAt).toBeGreaterThan(-1);
  });

  it.each([
    ["'/api/admin/campaigns/:id/approve',\n", "app.post('/api/admin/campaigns/:id/approve', requireAdmin, async"],
    ["'/api/admin/campaigns/:id/activate',\n", "app.post('/api/admin/campaigns/:id/activate', requireAdmin, async"],
    ["'/api/admin/campaigns/:id/reactivate',\n", "app.post('/api/admin/campaigns/:id/reactivate', requireAdmin, async"],
    [
      "app.put('/api/campaigns/:id/validate', requireAdmin, paidCampaignGuard)",
      "app.put('/api/campaigns/:id/validate', requireAdmin, async",
    ],
    [
      "app.patch('/api/admin/campaigns/:id/resume', requireAdmin, paidCampaignGuard)",
      "app.use('/api/admin/campaigns', adminCampaignsRoutes)",
    ],
    [
      "app.put('/api/campaigns/:id/validate', requireAdmin, paidCampaignGuard)",
      "app.use('/api/campaigns', campaignsRoutes)",
    ],
  ])('%s est avant %s', (guarded, handler) => {
    const guardedAt = source.indexOf(guarded);
    const handlerAt = source.indexOf(handler);

    expect(guardedAt).toBeGreaterThan(guardAt);
    expect(handlerAt).toBeGreaterThan(guardedAt);
  });
});
