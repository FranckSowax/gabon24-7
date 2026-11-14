/**
 * Garde des fonctions Netlify appelables par HTTP : seules nos tâches
 * planifiées, qui connaissent CRON_SECRET, peuvent les déclencher.
 */

const { isAuthorizedCron, rejectUnlessCron, cronHeaders } =
  require('../../../netlify/functions/utils/cron-auth');

describe('cron-auth (fonctions Netlify)', () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => { process.env.CRON_SECRET = 'secret-de-test'; });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it('accepte le bon secret, quelle que soit la casse de l\'en-tête', () => {
    expect(isAuthorizedCron({ headers: { 'x-cron-secret': 'secret-de-test' } })).toBe(true);
    expect(isAuthorizedCron({ headers: { 'X-Cron-Secret': 'secret-de-test' } })).toBe(true);
  });

  it.each([
    ['sans en-tête', { headers: {} }],
    ['sans objet headers', {}],
    ['événement absent', undefined],
    ['mauvais secret', { headers: { 'x-cron-secret': 'faux' } }],
    ['secret vide', { headers: { 'x-cron-secret': '' } }],
    ['secret non textuel', { headers: { 'x-cron-secret': ['secret-de-test'] } }],
  ])('refuse un appel %s', (label, event) => {
    expect(isAuthorizedCron(event)).toBe(false);
  });

  it('reste fermé si CRON_SECRET n\'est pas configuré', () => {
    delete process.env.CRON_SECRET;

    expect(isAuthorizedCron({ headers: { 'x-cron-secret': '' } })).toBe(false);
    expect(isAuthorizedCron({ headers: { 'x-cron-secret': 'undefined' } })).toBe(false);
    expect(cronHeaders()).toEqual({});
  });

  it('rejectUnlessCron renvoie 401 en conservant les en-têtes CORS, ou null si autorisé', () => {
    const denied = rejectUnlessCron({ headers: {} }, { 'Access-Control-Allow-Origin': '*' });

    expect(denied.statusCode).toBe(401);
    expect(denied.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(denied.body)).toEqual({ success: false, error: 'Non autorisé' });
    expect(rejectUnlessCron({ headers: cronHeaders() })).toBeNull();
  });
});
