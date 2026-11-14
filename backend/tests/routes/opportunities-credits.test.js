/**
 * Génération de propositions (service payant) : le service n'est jamais rendu
 * sans débit confirmé. Les cas testés s'arrêtent tous avant l'appel à l'IA.
 */

const express = require('express');
const request = require('supertest');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const mockRpc = jest.fn();
const mockAiCreate = jest.fn();
const mockTrackAIUsage = jest.fn();

// L'IA et le suivi d'usage sont simulés : aucun appel réseau.
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: (...args) => mockAiCreate(...args) } },
})));
jest.mock('../../utils/track-ai-usage', () => ({
  trackAIUsage: (...args) => mockTrackAIUsage(...args),
}));
process.env.OPENAI_API_KEY = 'test-openai-key';

jest.mock('../../supabase-config', () => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve({ data: { is_admin: false }, error: null })),
  };
  return {
    supabase: {
      from: jest.fn(() => builder),
      rpc: (...args) => mockRpc(...args),
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

const opportunitiesRoutes = require('../../routes/opportunities');

const app = express();
app.use(express.json());
app.use('/api/opportunities', opportunitiesRoutes);

const validBody = { secteur: 'Agriculture', budget: '1-5 millions', problematique: 'Accès au marché' };
const post = (body, token = `token-${USER}`) => {
  const req = request(app).post('/api/opportunities/generate-proposals');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
};

describe('POST /api/opportunities/generate-proposals — crédits', () => {
  beforeEach(() => mockRpc.mockReset());

  it('refuse un appel sans jeton, sans rien débiter', async () => {
    const res = await post({ ...validBody, userId: USER }, null);

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('refuse une requête incomplète avant tout débit', async () => {
    const res = await post({ secteur: 'Agriculture' });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('débite le compte du jeton, jamais le userId du body', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'Solde insuffisant' }, error: null });

    await post({ ...validBody, userId: OTHER });

    expect(mockRpc).toHaveBeenCalledWith('consume_credits', expect.objectContaining({ p_user_id: USER, p_amount: 5 }));
  });

  it('refuse si le solde est insuffisant', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'Solde insuffisant' }, error: null });

    const res = await post(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ success: false, error: 'Solde insuffisant', credits_required: 5 }));
  });

  it('bloque (503) si la base renvoie une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    const res = await post(validBody);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('CREDITS_UNAVAILABLE');
    expect(res.body.error).not.toContain('connection refused');
  });

  it('bloque (503) si l\'appel aux crédits lève une exception', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'));

    const res = await post(validBody);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('CREDITS_UNAVAILABLE');
  });

  it('bloque si la base ne confirme pas le débit', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const res = await post(validBody);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/opportunities/generate-proposals — remboursement', () => {
  const aiAnswer = (content) => ({ choices: [{ message: { content } }], usage: { total_tokens: 42 } });
  const refundCalls = () => mockRpc.mock.calls.filter(([name]) => name === 'refund_credits');

  // Débit accepté ; le remboursement réussit sauf indication contraire.
  const setupRpc = (refundResult = { data: { success: true, balance: 100 }, error: null }) => {
    mockRpc.mockImplementation((name) => Promise.resolve(
      name === 'consume_credits' ? { data: { success: true, total_balance: 95 }, error: null } : refundResult
    ));
  };

  beforeEach(() => {
    mockRpc.mockReset();
    mockAiCreate.mockReset();
    mockTrackAIUsage.mockReset().mockResolvedValue(undefined);
  });

  it('ne rembourse pas quand la génération réussit', async () => {
    setupRpc();
    mockAiCreate.mockResolvedValue(aiAnswer(JSON.stringify({ propositions: [{ titre: 'Projet A' }] })));

    const res = await post(validBody);

    expect(res.status).toBe(200);
    expect(res.body.propositions).toHaveLength(1);
    expect(refundCalls()).toHaveLength(0);
  });

  it('rembourse le compte du jeton si l\'appel à l\'IA échoue', async () => {
    setupRpc();
    mockAiCreate.mockRejectedValue(new Error('OpenAI indisponible'));

    const res = await post({ ...validBody, userId: OTHER });

    expect(res.status).toBe(500);
    expect(res.body.credits_refunded).toBe(true);
    expect(refundCalls()).toHaveLength(1);
    expect(refundCalls()[0][1]).toEqual(expect.objectContaining({ p_user_id: USER, p_amount: 5 }));
    expect(refundCalls()[0][1].p_description).toEqual(expect.any(String));
  });

  it.each([
    ['une réponse illisible', 'ceci n\'est pas du JSON'],
    ['une réponse sans propositions', JSON.stringify({ autre: 'chose' })],
    ['une liste de propositions vide', JSON.stringify({ propositions: [] })],
  ])('rembourse si l\'IA renvoie %s', async (label, content) => {
    setupRpc();
    mockAiCreate.mockResolvedValue(aiAnswer(content));

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body.credits_refunded).toBe(true);
    expect(refundCalls()).toHaveLength(1);
  });

  it('signale un remboursement raté sans masquer l\'erreur', async () => {
    setupRpc({ data: null, error: { message: 'base indisponible' } });
    mockAiCreate.mockRejectedValue(new Error('OpenAI indisponible'));

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body.credits_refunded).toBe(false);
    expect(refundCalls()).toHaveLength(1);
  });

  describe('origine du débit (bonus / principal)', () => {
    const callsTo = (fn) => mockRpc.mock.calls.filter(([name]) => name === fn);

    // Débit de 5 crédits pris à 3 sur le bonus et 2 sur le solde principal.
    const setupSplitDebit = (splitResult) => {
      mockRpc.mockImplementation((name) => Promise.resolve({
        consume_credits: { data: { success: true, transaction_id: 'tx-1', from_bonus: 3, from_balance: 2 }, error: null },
        refund_credits_split: splitResult,
        refund_credits: { data: { success: true }, error: null },
      }[name]));
      mockAiCreate.mockRejectedValue(new Error('OpenAI indisponible'));
    };

    it('rend chaque part à son solde d\'origine', async () => {
      setupSplitDebit({ data: { success: true, balance: 2, bonus_balance: 3 }, error: null });

      const res = await post(validBody);

      expect(res.body.credits_refunded).toBe(true);
      expect(callsTo('refund_credits_split')).toHaveLength(1);
      expect(callsTo('refund_credits_split')[0][1]).toEqual(expect.objectContaining({
        p_user_id: USER, p_from_bonus: 3, p_from_balance: 2, p_reference_id: 'tx-1',
      }));
      expect(callsTo('refund_credits')).toHaveLength(0);
    });

    it('retombe sur l\'ancien remboursement si la migration n\'est pas appliquée', async () => {
      setupSplitDebit({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.refund_credits_split' } });

      const res = await post(validBody);

      expect(res.body.credits_refunded).toBe(true);
      expect(callsTo('refund_credits')).toHaveLength(1);
      expect(callsTo('refund_credits')[0][1]).toEqual(expect.objectContaining({ p_user_id: USER, p_amount: 5 }));
    });

    it.each([
      ['une erreur de base', { data: null, error: { code: '57014', message: 'timeout' } }],
      ['un remboursement déjà fait', { data: { success: false, error: 'Déjà remboursé' }, error: null }],
    ])('ne rembourse pas une seconde fois par l\'ancien chemin après %s', async (label, splitResult) => {
      setupSplitDebit(splitResult);

      const res = await post(validBody);

      expect(res.body.credits_refunded).toBe(false);
      expect(callsTo('refund_credits')).toHaveLength(0);
    });
  });

  it('livre le résultat sans rembourser si seul le suivi d\'usage échoue', async () => {
    setupRpc();
    mockAiCreate.mockResolvedValue(aiAnswer(JSON.stringify({ propositions: [{ titre: 'Projet A' }] })));
    mockTrackAIUsage.mockRejectedValue(new Error('suivi indisponible'));

    const res = await post(validBody);

    expect(res.status).toBe(200);
    expect(res.body.propositions).toHaveLength(1);
    expect(refundCalls()).toHaveLength(0);
  });
});
