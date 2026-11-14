/**
 * Tests de sécurité du service de paiement E-Billing.
 * Vérifie qu'aucun crédit / abonnement / campagne n'est attribué sur la seule
 * foi de données fournies par le client (callback forgé, montant du panier).
 */

jest.mock('../../config/supabase', () => ({ supabase: {} }));
jest.mock('../../services/whapiService', () => ({ sendWhatsAppMessage: jest.fn() }));

const { EBillingPaymentService } = require('../../services/ebilling-payment.service');

/**
 * Faux client Supabase: chaque table renvoie un résultat configurable et
 * enregistre les écritures (insert / update) pour les assertions.
 */
function createFakeSupabase(results = {}) {
  const writes = [];
  const from = jest.fn((table) => {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      insert: jest.fn((row) => { writes.push({ table, op: 'insert', row }); return builder; }),
      update: jest.fn((row) => { writes.push({ table, op: 'update', row }); return builder; }),
      single: jest.fn(() => Promise.resolve(results[table] || { data: null, error: null })),
      then: (resolve, reject) =>
        Promise.resolve(results[table] || { data: null, error: null }).then(resolve, reject),
    };
    return builder;
  });
  return { from, writes };
}

const PENDING_PAYMENT = {
  id: 'pay-1',
  user_id: 'user-1',
  reference: 'GI_1700000000000_1234',
  bill_id: 'BILL-1',
  amount: 5000,
  status: 'pending',
  payment_type: 'credits',
  credits_granted: false,
};

function createService(results) {
  const service = new EBillingPaymentService();
  const fake = createFakeSupabase(results);
  service.supabase = fake;
  service.checkInvoiceStatus = jest.fn();
  service.checkPhpPaymentStatus = jest.fn().mockResolvedValue({ success: false, status: 'pending' });
  service.processCompletedPayment = jest.fn().mockResolvedValue();
  return { service, fake };
}

function paymentUpdates(fake) {
  return fake.writes.filter((w) => w.table === 'ebilling_payments' && w.op === 'update');
}

describe('E-Billing — callback', () => {
  it('ignore un callback forgé "paid" tant que E-Billing ne confirme pas', async () => {
    const { service, fake } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({ success: true, status: 'pending', data: {} });

    const result = await service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'paid' });

    expect(result.success).toBe(true);
    expect(service.checkInvoiceStatus).toHaveBeenCalledWith('BILL-1');
    expect(service.processCompletedPayment).not.toHaveBeenCalled();
    expect(paymentUpdates(fake)).toHaveLength(0);
  });

  it('n\'attribue rien si la vérification E-Billing est indisponible', async () => {
    const { service, fake } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({ success: false, error: 'timeout' });

    await service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'paid' });

    expect(service.processCompletedPayment).not.toHaveBeenCalled();
    expect(paymentUpdates(fake)).toHaveLength(0);
  });

  it('valide le paiement quand E-Billing confirme, même si le callback annonce autre chose', async () => {
    const { service, fake } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({
      success: true,
      status: 'completed',
      data: { amount: 5000, external_reference: PENDING_PAYMENT.reference },
    });

    await service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'whatever' });

    expect(service.processCompletedPayment).toHaveBeenCalledTimes(1);
    expect(paymentUpdates(fake)[0].row.status).toBe('completed');
  });

  it('refuse une facture payée pour un montant inférieur au montant attendu', async () => {
    const { service, fake } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({
      success: true,
      status: 'completed',
      data: { amount: 100, external_reference: PENDING_PAYMENT.reference },
    });

    await service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'paid' });

    expect(service.processCompletedPayment).not.toHaveBeenCalled();
    expect(paymentUpdates(fake)).toHaveLength(0);
  });

  it('refuse une facture dont la référence ne correspond pas au paiement', async () => {
    const { service } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({
      success: true,
      status: 'completed',
      data: { amount: 5000, external_reference: 'GI_AUTRE_PAIEMENT' },
    });

    await service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'paid' });

    expect(service.processCompletedPayment).not.toHaveBeenCalled();
  });

  it('ne révèle pas si la référence existe', async () => {
    const known = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    known.service.checkInvoiceStatus.mockResolvedValue({ success: true, status: 'pending', data: {} });
    const unknown = createService({ ebilling_payments: { data: null, error: null } });

    const a = await known.service.processCallback({ reference: PENDING_PAYMENT.reference, status: 'paid' });
    const b = await unknown.service.processCallback({ reference: 'GI_INCONNU', status: 'paid' });

    expect(a).toEqual(b);
  });

  it('supporte un corps de callback vide ou invalide', async () => {
    const { service } = createService({});
    await expect(service.processCallback(undefined)).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(service.processCompletedPayment).not.toHaveBeenCalled();
  });
});

describe('E-Billing — statut d\'un paiement', () => {
  it('refuse la consultation du paiement d\'un autre utilisateur', async () => {
    const { service } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });

    const result = await service.checkPaymentStatus(PENDING_PAYMENT.reference, 'autre-user');

    expect(result).toEqual({ success: false, error: 'Paiement non trouvé' });
    expect(service.checkInvoiceStatus).not.toHaveBeenCalled();
  });

  it('autorise le propriétaire et relit le statut auprès d\'E-Billing', async () => {
    const { service } = createService({ ebilling_payments: { data: PENDING_PAYMENT, error: null } });
    service.checkInvoiceStatus.mockResolvedValue({ success: true, status: 'pending', data: {} });

    const result = await service.checkPaymentStatus(PENDING_PAYMENT.reference, 'user-1');

    expect(result.success).toBe(true);
    expect(result.payment.status).toBe('pending');
  });
});

describe('E-Billing — paiement de campagnes', () => {
  // Campagne "avec type" : son prix est celui de la grille serveur (50 000 FCFA
  // pour une bannière d'accueil d'une semaine), quel que soit le budget enregistré.
  const CAMPAIGN_A = {
    id: 'c-a', user_id: 'user-1', campaign_type: 'banner-home', duration_days: 7, budget: 50000, payment_status: 'pending',
  };
  // Campagne par forfait : prix fixé par le serveur dans total_amount.
  const CAMPAIGN_B = { id: 'c-b', user_id: null, total_amount: 90000, payment_status: 'pending' };

  function createCampaignService(campaigns) {
    const { service } = createService({ campaigns: { data: campaigns, error: null } });
    service.initiatePayment = jest.fn().mockResolvedValue({ success: true });
    return service;
  }

  it('facture la somme des campagnes en base, pas le montant du client', async () => {
    const service = createCampaignService([CAMPAIGN_A, CAMPAIGN_B]);

    await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a', 'c-b'] });

    expect(service.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 140000, type: 'campaign' }));
  });

  it('refuse un montant client inférieur au prix réel', async () => {
    const service = createCampaignService([CAMPAIGN_A]);

    const result = await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'], expectedAmount: 100 });

    expect(result.success).toBe(false);
    expect(service.initiatePayment).not.toHaveBeenCalled();
  });

  it('refuse la campagne d\'un autre utilisateur', async () => {
    const service = createCampaignService([{ ...CAMPAIGN_A, user_id: 'user-2' }]);

    const result = await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'] });

    expect(result.success).toBe(false);
    expect(service.initiatePayment).not.toHaveBeenCalled();
  });

  it('refuse une campagne inexistante', async () => {
    const service = createCampaignService([CAMPAIGN_A]);

    const result = await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a', 'c-inconnue'] });

    expect(result.success).toBe(false);
    expect(service.initiatePayment).not.toHaveBeenCalled();
  });

  it('ignore un budget falsifié : le prix vient de la grille serveur', async () => {
    const service = createCampaignService([
      { ...CAMPAIGN_A, campaign_type: 'video-home', duration_days: 14, design_request: true, budget: 1 },
    ]);

    await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'] });

    // 855 000 (vidéo, 2 semaines) + 300 000 (création de la vidéo)
    expect(service.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 1155000 }));
  });

  it('ne croit pas le budget d\'une campagne par forfait', async () => {
    const service = createCampaignService([{ ...CAMPAIGN_B, user_id: 'user-1', budget: 1 }]);

    await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-b'] });

    expect(service.initiatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 90000 }));
  });

  it.each([
    ['une durée hors grille', { duration_days: 3 }],
    ['un type inconnu', { campaign_type: 'gratuit' }],
  ])('refuse une campagne avec %s', async (label, override) => {
    const service = createCampaignService([{ ...CAMPAIGN_A, ...override }]);

    const result = await service.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'] });

    expect(result.success).toBe(false);
    expect(service.initiatePayment).not.toHaveBeenCalled();
  });

  it('refuse une campagne déjà payée ou sans prix', async () => {
    const paid = createCampaignService([{ ...CAMPAIGN_A, payment_status: 'completed' }]);
    const free = createCampaignService([{ ...CAMPAIGN_B, user_id: 'user-1', total_amount: 0 }]);

    expect((await paid.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'] })).success).toBe(false);
    expect((await free.initiateCampaignPayment({ userId: 'user-1', campaignIds: ['c-a'] })).success).toBe(false);
    expect(paid.initiatePayment).not.toHaveBeenCalled();
    expect(free.initiatePayment).not.toHaveBeenCalled();
  });
});
