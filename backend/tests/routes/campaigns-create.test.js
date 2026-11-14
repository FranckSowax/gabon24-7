/**
 * Création d'une campagne « à la carte » : POST /api/campaigns.
 * Le navigateur ne décide ni du prix, ni du statut, ni du propriétaire, ni de
 * l'état du paiement. Supabase est simulé en mémoire, aucun appel réseau.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const mockState = {};

function mockReset() {
  Object.assign(mockState, {
    overlap: [],
    overlapError: null,
    insertError: null,
    existingFeed: null,
    overlapQueries: 0,
    inserted: { campaigns: [], articles: [], rss_feeds: [] },
  });
}

jest.mock('../../supabase-config', () => {
  const makeBuilder = (table) => {
    const builder = { op: 'select', rows: null };
    const chain = () => builder;
    Object.assign(builder, { select: chain, eq: chain, in: chain, lte: chain, gte: chain, order: chain });
    builder.insert = (rows) => {
      builder.op = 'insert';
      builder.rows = rows;
      return builder;
    };
    const resolve = () => {
      if (builder.op === 'insert') {
        if (table === 'campaigns' && mockState.insertError) {
          return { data: null, error: mockState.insertError };
        }
        const row = { id: `${table}-1`, ...builder.rows[0] };
        mockState.inserted[table].push(row);
        return { data: row, error: null };
      }
      if (table === 'campaigns') {
        mockState.overlapQueries += 1;
        return { data: mockState.overlapError ? null : mockState.overlap, error: mockState.overlapError };
      }
      if (table === 'rss_feeds') return { data: mockState.existingFeed, error: null };
      return { data: { is_admin: false }, error: null };
    };
    builder.single = () => Promise.resolve(resolve());
    builder.maybeSingle = () => Promise.resolve(resolve());
    builder.then = (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
    return builder;
  };

  return {
    supabase: {
      from: jest.fn((table) => makeBuilder(table)),
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

// Le quota (10 créations/jour) n'est pas l'objet de ces tests.
jest.mock('../../middleware/rate-limiter', () => ({
  campaignCreationLimiter: (req, res, next) => next(),
}));

const campaignsRoutes = require('../../routes/campaigns');

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRoutes);

const validBody = (overrides = {}) => ({
  campaign_type: 'banner-home',
  name: 'Soldes de fin d\'année',
  start_date: '2026-12-01',
  duration_days: 7,
  redirect_url: 'https://example.com/promo',
  ...overrides,
});

const post = (body, token = `token-${USER}`) => {
  const req = request(app).post('/api/campaigns');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
};

describe('POST /api/campaigns — campagne à la carte', () => {
  let consoleError;
  let consoleLog;

  beforeEach(() => {
    mockReset();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  it('refuse sans jeton et n\'enregistre rien', async () => {
    const res = await post(validBody(), null);

    expect(res.status).toBe(401);
    expect(mockState.inserted.campaigns).toHaveLength(0);
  });

  it('crée la campagne pour le compte du jeton, en attente, au prix de la grille', async () => {
    const res = await post(validBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.price).toBe(50000);
    expect(mockState.inserted.campaigns).toHaveLength(1);
    expect(mockState.inserted.campaigns[0]).toMatchObject({
      user_id: USER,
      campaign_type: 'banner-home',
      name: 'Soldes de fin d\'année',
      budget: 50000,
      status: 'pending',
      payment_status: 'pending',
      duration_days: 7,
      redirect_url: 'https://example.com/promo',
      views: 0,
      clicks: 0,
    });
  });

  it('ignore le prix, le statut, le propriétaire et le paiement envoyés par le navigateur', async () => {
    const res = await post(validBody({
      budget: 1,
      status: 'active',
      user_id: OTHER,
      payment_status: 'completed',
      views: 99999,
      clicks: 99999,
      admin_approved: true,
      end_date: '2099-01-01',
    }));

    expect(res.status).toBe(201);
    const row = mockState.inserted.campaigns[0];
    expect(row).toMatchObject({
      budget: 50000,
      status: 'pending',
      user_id: USER,
      payment_status: 'pending',
      views: 0,
      clicks: 0,
    });
    expect(row).not.toHaveProperty('admin_approved');
    expect(row.end_date.startsWith('2026-12-08')).toBe(true);
  });

  it.each([
    ['banner-home', 30, false, 160000],
    ['banner-home', 7, true, 100000],
    ['banner-feed', 14, false, 162000],
    ['video-home', 14, true, 1155000],
    ['article-trending', 21, false, 675000],
  ])('%s, %i jours, création=%s : %i FCFA', async (campaign_type, duration_days, design_request, price) => {
    const res = await post(validBody({ campaign_type, duration_days, design_request }));

    expect(res.status).toBe(201);
    expect(mockState.inserted.campaigns[0].budget).toBe(price);
    expect(mockState.inserted.campaigns[0].design_request).toBe(design_request);
  });

  it('compte la rédaction par l\'équipe (request_creation) comme une option de création', async () => {
    const res = await post(validBody({ campaign_type: 'article-trending', request_creation: true }));

    expect(res.status).toBe(201);
    expect(mockState.inserted.campaigns[0].budget).toBe(400000);
    expect(mockState.inserted.campaigns[0].design_request).toBe(true);
  });

  it('démarre aujourd\'hui quand aucune date n\'est fournie', async () => {
    const before = Date.now();
    const res = await post(validBody({ start_date: undefined, duration_days: 14 }));

    expect(res.status).toBe(201);
    const row = mockState.inserted.campaigns[0];
    const start = Date.parse(row.start_date);
    expect(start).toBeGreaterThanOrEqual(before - 1000);
    expect(start).toBeLessThanOrEqual(Date.now() + 1000);
    // 14 jours calendaires (à une heure près en cas de changement d'heure)
    const days = (Date.parse(row.end_date) - start) / (24 * 60 * 60 * 1000);
    expect(Math.abs(days - 14)).toBeLessThan(0.05);
  });

  it.each([
    ['type inconnu', { campaign_type: 'gratuit' }],
    ['type absent', { campaign_type: undefined }],
    ['nom absent', { name: undefined }],
    ['nom vide', { name: '   ' }],
    ['durée hors grille', { duration_days: 1 }],
    ['durée absente', { duration_days: undefined }],
    ['date invalide', { start_date: 'demain' }],
    ['lien javascript:', { redirect_url: 'javascript:alert(1)' }],
    ['image encodée (data:)', { desktop_image_url: 'data:image/png;base64,AAAA' }],
    ['vidéo en file://', { campaign_type: 'video-home', video_url: 'file:///etc/passwd' }],
  ])('refuse : %s', async (label, overrides) => {
    const res = await post(validBody(overrides));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
    expect(mockState.inserted.campaigns).toHaveLength(0);
  });

  it('accepte les champs facultatifs vides envoyés par les formulaires', async () => {
    const res = await post(validBody({
      redirect_url: '',
      desktop_image_url: '',
      mobile_image_url: null,
      design_request_notes: '',
    }));

    expect(res.status).toBe(201);
    expect(mockState.inserted.campaigns[0]).not.toHaveProperty('desktop_image_url');
  });

  describe('créneaux', () => {
    it('refuse une vidéo quand le créneau est déjà pris (1 à la fois)', async () => {
      mockState.overlap = [{ id: 'c1', status: 'active' }];

      const res = await post(validBody({ campaign_type: 'video-home' }));

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, limit: 1, current_count: 1 });
      expect(mockState.inserted.campaigns).toHaveLength(0);
    });

    it('accepte une 10e bannière d\'accueil et refuse la 11e', async () => {
      mockState.overlap = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, status: 'active' }));
      expect((await post(validBody())).status).toBe(201);

      mockState.overlap = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, status: 'active' }));
      expect((await post(validBody())).status).toBe(409);
    });

    it('un panier abandonné (non payé, créé il y a plus de 30 minutes) ne bloque plus le créneau', async () => {
      const old = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      mockState.overlap = [{ id: 'c1', status: 'pending', payment_status: 'pending', created_at: old }];

      const res = await post(validBody({ campaign_type: 'video-home' }));

      expect(res.status).toBe(201);
    });

    it('un paiement en cours (campagne créée il y a moins de 30 minutes) garde le créneau', async () => {
      const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      mockState.overlap = [{ id: 'c1', status: 'pending', payment_status: 'pending', created_at: recent }];

      const res = await post(validBody({ campaign_type: 'video-home' }));

      expect(res.status).toBe(409);
    });

    it('une campagne payée en attente de validation garde le créneau', async () => {
      const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      mockState.overlap = [{ id: 'c1', status: 'pending', payment_status: 'completed', created_at: old }];

      const res = await post(validBody({ campaign_type: 'banner-feed' }));

      expect(res.status).toBe(409);
    });

    it('ne vend pas un créneau qu\'il n\'a pas pu vérifier', async () => {
      mockState.overlapError = { message: 'connexion perdue' };

      const res = await post(validBody({ campaign_type: 'banner-feed' }));

      expect(res.status).toBe(500);
      expect(mockState.inserted.campaigns).toHaveLength(0);
    });

    it('ne limite pas les articles sponsorisés', async () => {
      mockState.overlap = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}` }));

      const res = await post(validBody({ campaign_type: 'article-trending' }));

      expect(res.status).toBe(201);
      expect(mockState.overlapQueries).toBe(0);
    });
  });

  describe('contenu selon le type', () => {
    it('bannière de fil : visuels et réglages d\'affichage fixés par le serveur', async () => {
      const res = await post(validBody({
        campaign_type: 'banner-feed',
        banner_image_url: 'https://cdn.example.com/desktop.png',
        mobile_image_url: 'https://cdn.example.com/mobile.png',
        feed_position_frequency: 1,
      }));

      expect(res.status).toBe(201);
      expect(mockState.inserted.campaigns[0]).toMatchObject({
        banner_image_url: 'https://cdn.example.com/desktop.png',
        mobile_image_url: 'https://cdn.example.com/mobile.png',
        feed_position_frequency: 7,
        feed_images_count: 2,
      });
    });

    it('vidéo : adresse, titre et description enregistrés', async () => {
      const res = await post(validBody({
        campaign_type: 'video-home',
        video_url: 'https://cdn.example.com/spot.mp4',
        video_title: 'Notre spot',
        video_description: 'Trente secondes',
      }));

      expect(res.status).toBe(201);
      expect(mockState.inserted.campaigns[0]).toMatchObject({
        video_url: 'https://cdn.example.com/spot.mp4',
        video_title: 'Notre spot',
        video_description: 'Trente secondes',
      });
    });

    it('une bannière n\'enregistre pas de champs vidéo', async () => {
      await post(validBody({ video_url: 'https://cdn.example.com/spot.mp4' }));

      expect(mockState.inserted.campaigns[0]).not.toHaveProperty('video_url');
    });

    it('article sponsorisé : l\'article est créé non publié et rattaché à la campagne', async () => {
      const res = await post(validBody({
        campaign_type: 'article-trending',
        article_title: 'Une entreprise gabonaise innove',
        article_summary: 'Résumé',
        article_content: 'Contenu de l\'article',
        company_name: 'Exemple SARL',
        is_published: true,
      }));

      expect(res.status).toBe(201);
      expect(res.body.sponsored_article).toBeTruthy();
      expect(mockState.inserted.rss_feeds).toHaveLength(1);
      expect(mockState.inserted.articles).toHaveLength(1);
      expect(mockState.inserted.articles[0]).toMatchObject({
        external_id: 'sponsored-campaigns-1',
        title: 'Une entreprise gabonaise innove',
        is_published: false,
        feed_id: 'rss_feeds-1',
      });
      expect(mockState.inserted.campaigns[0].banner_title).toBe('Une entreprise gabonaise innove');
    });

    it('article sponsorisé : aucun compteur de vues ou de partages inventé', async () => {
      await post(validBody({ campaign_type: 'article-trending', article_title: 'Titre', view_count: 9000 }));

      const article = mockState.inserted.articles[0];
      expect(article).not.toHaveProperty('view_count');
      expect(article).not.toHaveProperty('share_count');
      expect(article).not.toHaveProperty('whatsapp_share_count');
    });

    it('article sponsorisé : réutilise le flux « Gabon Insight » existant', async () => {
      mockState.existingFeed = { id: 'feed-existant' };

      await post(validBody({ campaign_type: 'article-trending', article_title: 'Titre' }));

      expect(mockState.inserted.rss_feeds).toHaveLength(0);
      expect(mockState.inserted.articles[0].feed_id).toBe('feed-existant');
    });
  });

  it('répond 500 sans détail technique si l\'enregistrement échoue', async () => {
    mockState.insertError = { message: 'column "x" does not exist' };

    const res = await post(validBody());

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('column');
  });
});

describe('server.js — une seule création de campagne à la carte', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

  it('ne déclare qu\'un handler POST /api/campaigns (celui des forfaits)', () => {
    expect(source.match(/app\.post\('\/api\/campaigns',/g)).toHaveLength(1);
  });

  it('le handler des forfaits passe la main dès qu\'un campaign_type est présent', () => {
    const start = source.indexOf("app.post('/api/campaigns',");
    const handlerStart = source.slice(start, start + 400);

    expect(handlerStart).toMatch(/async \(req, res, next\)/);
    expect(handlerStart).toMatch(/req\.body\.campaign_type\) \{\s*return next\(\);/);
  });

  it('le routeur des campagnes est monté après le handler des forfaits', () => {
    const forfait = source.indexOf("app.post('/api/campaigns',");
    const router = source.indexOf("app.use('/api/campaigns', campaignsRoutes)");

    expect(forfait).toBeGreaterThan(-1);
    expect(router).toBeGreaterThan(forfait);
  });
});
