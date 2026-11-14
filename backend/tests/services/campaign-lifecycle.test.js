/**
 * Cycle de vie des campagnes : achat par forfait, occupation des créneaux,
 * publication de l'article sponsorisé. Supabase est simulé en mémoire.
 */

const { createPackageCampaign } = require('../../services/package-campaign');
const {
  occupiesSlot,
  setSponsoredArticlePublished,
  RESERVATION_MINUTES,
} = require('../../services/campaign-creation');

const USER = '11111111-1111-4111-8111-111111111111';

function makeSupabase(options = {}) {
  const state = {
    package: 'package' in options
      ? options.package
      : { id: 'pkg-1', name: 'Forfait 2 semaines', price_fcfa: 75000, duration_days: 14, max_slides: 3, is_active: true },
    campaignError: options.campaignError || null,
    slidesError: options.slidesError || null,
    updateError: options.updateError || null,
    updateThrows: options.updateThrows || false,
    inserted: { campaigns: [], promotional_slides: [] },
    updates: [],
  };

  const from = (table) => {
    const builder = { op: 'select', payload: null, filters: {} };
    builder.select = () => builder;
    builder.eq = (column, value) => { builder.filters[column] = value; return builder; };
    builder.insert = (payload) => { builder.op = 'insert'; builder.payload = payload; return builder; };
    builder.update = (payload) => {
      if (state.updateThrows) throw new Error('réseau coupé');
      builder.op = 'update';
      builder.payload = payload;
      return builder;
    };
    const resolve = () => {
      if (builder.op === 'update') {
        state.updates.push({ table, payload: builder.payload, filters: builder.filters });
        return { data: null, error: state.updateError };
      }
      if (builder.op === 'insert') {
        if (table === 'campaigns') {
          if (state.campaignError) return { data: null, error: state.campaignError };
          const row = { id: 'camp-1', ...builder.payload };
          state.inserted.campaigns.push(row);
          return { data: row, error: null };
        }
        if (state.slidesError) return { data: null, error: state.slidesError };
        const rows = builder.payload.map((row, index) => ({ id: `slide-${index}`, ...row }));
        state.inserted.promotional_slides.push(...rows);
        return { data: rows, error: null };
      }
      if (table === 'ad_packages') {
        return state.package
          ? { data: state.package, error: null }
          : { data: null, error: { message: 'not found' } };
      }
      return { data: null, error: null };
    };
    builder.single = () => Promise.resolve(resolve());
    builder.then = (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
    return builder;
  };

  return { state, from };
}

const validBody = (overrides = {}) => ({
  package_id: 'pkg-1',
  company_name: 'Exemple SARL',
  contact_email: 'contact@example.com',
  contact_phone: '+241 00 00 00 00',
  start_date: '2026-12-01',
  slides: [
    { title: 'Offre de fin d\'année', description: 'Jusqu\'au 31', image_url: 'https://cdn.example.com/a.png', link_url: 'https://example.com', cta_text: 'Voir', display_order: 1 },
  ],
  ...overrides,
});

describe('createPackageCampaign — achat par forfait', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('crée la campagne et ses diapositives à partir du champ `slides` envoyé par le site', async () => {
    const supabase = makeSupabase();

    const result = await createPackageCampaign({ supabase, userId: USER, body: validBody() });

    expect(result.ok).toBe(true);
    expect(supabase.state.inserted.campaigns[0]).toMatchObject({
      user_id: USER,
      company_name: 'Exemple SARL',
      contact_email: 'contact@example.com',
      package_id: 'pkg-1',
      total_amount: 75000,
      payment_status: 'pending',
    });
    expect(supabase.state.inserted.campaigns[0].start_date.startsWith('2026-12-01')).toBe(true);
    expect(supabase.state.inserted.campaigns[0].end_date.startsWith('2026-12-15')).toBe(true);
    expect(supabase.state.inserted.promotional_slides).toHaveLength(1);
    expect(supabase.state.inserted.promotional_slides[0]).toMatchObject({
      campaign_id: 'camp-1',
      title: 'Offre de fin d\'année',
      image_url: 'https://cdn.example.com/a.png',
      link_url: 'https://example.com',
      cta_text: 'Voir',
      display_order: 0,
    });
  });

  it('accepte encore l\'ancien nom `slides_data`', async () => {
    const supabase = makeSupabase();
    const { slides, ...rest } = validBody();

    const result = await createPackageCampaign({ supabase, userId: USER, body: { ...rest, slides_data: slides } });

    expect(result.ok).toBe(true);
    expect(supabase.state.inserted.promotional_slides).toHaveLength(1);
  });

  it('ignore le prix, le paiement, le propriétaire et les colonnes glissées dans une diapositive', async () => {
    const supabase = makeSupabase();

    const result = await createPackageCampaign({
      supabase,
      userId: USER,
      body: validBody({
        total_amount: 1,
        payment_status: 'paid',
        user_id: '22222222-2222-4222-8222-222222222222',
        admin_approved: true,
        is_active: true,
        slides: [{ title: 'Titre', is_active: true, view_count: 999999, click_count: 999999, campaign_id: 'autre' }],
      }),
    });

    expect(result.ok).toBe(true);
    const campaign = supabase.state.inserted.campaigns[0];
    expect(campaign).toMatchObject({ total_amount: 75000, payment_status: 'pending', user_id: USER });
    expect(campaign).not.toHaveProperty('admin_approved');
    expect(campaign).not.toHaveProperty('is_active');
    const slide = supabase.state.inserted.promotional_slides[0];
    expect(Object.keys(slide).sort()).toEqual(
      ['campaign_id', 'cta_text', 'description', 'display_order', 'id', 'image_url', 'link_url', 'title']
    );
    expect(slide.campaign_id).toBe('camp-1');
    expect(slide.cta_text).toBe('En savoir plus');
  });

  it.each([
    ['entreprise absente', { company_name: '' }],
    ['e-mail invalide', { contact_email: 'pas-un-email' }],
    ['forfait absent', { package_id: undefined }],
    ['date invalide', { start_date: 'bientôt' }],
    ['aucune diapositive', { slides: [] }],
    ['diapositives absentes', { slides: undefined }],
    ['diapositive sans titre', { slides: [{ title: '   ' }] }],
    ['lien javascript:', { slides: [{ title: 'T', link_url: 'javascript:alert(1)' }] }],
    ['image encodée (data:)', { slides: [{ title: 'T', image_url: 'data:image/png;base64,AAAA' }] }],
  ])('refuse : %s', async (label, overrides) => {
    const supabase = makeSupabase();

    const result = await createPackageCampaign({ supabase, userId: USER, body: validBody(overrides) });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(typeof result.error).toBe('string');
    expect(supabase.state.inserted.campaigns).toHaveLength(0);
  });

  it('refuse plus de diapositives que le forfait n\'en autorise', async () => {
    const supabase = makeSupabase();
    const slides = Array.from({ length: 4 }, (_, i) => ({ title: `Diapositive ${i + 1}` }));

    const result = await createPackageCampaign({ supabase, userId: USER, body: validBody({ slides }) });

    expect(result).toMatchObject({ ok: false, status: 400, details: { max_slides: 3 } });
    expect(supabase.state.inserted.campaigns).toHaveLength(0);
  });

  it('refuse un forfait inconnu ou retiré de la vente', async () => {
    const unknown = await createPackageCampaign({ supabase: makeSupabase({ package: null }), userId: USER, body: validBody() });
    const inactive = await createPackageCampaign({
      supabase: makeSupabase({ package: { id: 'pkg-1', price_fcfa: 75000, duration_days: 14, max_slides: 3, is_active: false } }),
      userId: USER,
      body: validBody(),
    });

    expect(unknown).toMatchObject({ ok: false, status: 400 });
    expect(inactive).toMatchObject({ ok: false, status: 400 });
  });

  it('refuse de vendre un forfait sans prix valide', async () => {
    const supabase = makeSupabase({ package: { id: 'pkg-1', price_fcfa: 0, duration_days: 14, max_slides: 3 } });

    const result = await createPackageCampaign({ supabase, userId: USER, body: validBody() });

    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(supabase.state.inserted.campaigns).toHaveLength(0);
  });

  it('refuse sans compte identifié', async () => {
    const result = await createPackageCampaign({ supabase: makeSupabase(), userId: undefined, body: validBody() });

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('signale l\'échec si les diapositives ne s\'enregistrent pas, sans détail technique', async () => {
    const supabase = makeSupabase({ slidesError: { message: 'column "x" does not exist' } });

    const result = await createPackageCampaign({ supabase, userId: USER, body: validBody() });

    expect(result).toMatchObject({ ok: false, status: 500, details: { campaign_id: 'camp-1' } });
    expect(result.error).not.toContain('column');
  });
});

describe('occupiesSlot — créneaux publicitaires', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();

  it('la réservation pendant le paiement dure 30 minutes', () => {
    expect(RESERVATION_MINUTES).toBe(30);
  });

  it.each([
    ['active', { status: 'active', payment_status: 'pending', created_at: minutesAgo(10000) }, true],
    ['en attente et payée (E-Billing)', { status: 'pending', payment_status: 'completed', created_at: minutesAgo(10000) }, true],
    ['en attente et payée (marquée par un administrateur)', { status: 'pending', payment_status: 'paid', created_at: minutesAgo(10000) }, true],
    ['paiement en cours depuis 5 minutes', { status: 'pending', payment_status: 'pending', created_at: minutesAgo(5) }, true],
    ['paiement en cours depuis 29 minutes', { status: 'pending', payment_status: 'pending', created_at: minutesAgo(29) }, true],
    ['panier abandonné depuis 31 minutes', { status: 'pending', payment_status: 'pending', created_at: minutesAgo(31) }, false],
    ['paiement échoué, ancien', { status: 'pending', payment_status: 'failed', created_at: minutesAgo(120) }, false],
    ['rejetée', { status: 'rejected', payment_status: 'completed', created_at: minutesAgo(5) }, false],
    ['terminée', { status: 'completed', payment_status: 'completed', created_at: minutesAgo(5) }, false],
    ['date de création illisible (prudence : réservé)', { status: 'pending', payment_status: 'pending', created_at: null }, true],
  ])('%s -> %s', (label, campaign, expected) => {
    expect(occupiesSlot(campaign, now)).toBe(expected);
  });

  it('une campagne absente n\'occupe rien', () => {
    expect(occupiesSlot(null, now)).toBe(false);
  });
});

describe('setSponsoredArticlePublished — article sponsorisé', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('publie l\'article lié à la campagne', async () => {
    const supabase = makeSupabase();

    const ok = await setSponsoredArticlePublished(supabase, 'camp-42', true);

    expect(ok).toBe(true);
    expect(supabase.state.updates).toHaveLength(1);
    expect(supabase.state.updates[0]).toMatchObject({
      table: 'articles',
      filters: { external_id: 'sponsored-camp-42' },
    });
    expect(supabase.state.updates[0].payload.is_published).toBe(true);
  });

  it('dépublie l\'article au rejet', async () => {
    const supabase = makeSupabase();

    await setSponsoredArticlePublished(supabase, 'camp-42', false);

    expect(supabase.state.updates[0].payload.is_published).toBe(false);
  });

  it('ne publie que sur un vrai booléen', async () => {
    const supabase = makeSupabase();

    await setSponsoredArticlePublished(supabase, 'camp-42', 'true');

    expect(supabase.state.updates[0].payload.is_published).toBe(false);
  });

  it('ne lève jamais : une erreur de base ou de réseau renvoie false', async () => {
    const failing = await setSponsoredArticlePublished(makeSupabase({ updateError: { message: 'refusé' } }), 'camp-42', true);
    const throwing = await setSponsoredArticlePublished(makeSupabase({ updateThrows: true }), 'camp-42', true);

    expect(failing).toBe(false);
    expect(throwing).toBe(false);
  });
});
