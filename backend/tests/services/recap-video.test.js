/**
 * Récap vidéo de l'actualité : il a son module et ne tourne plus dans le
 * carrousel de la section d'accueil. Supabase est simulé, aucun appel réseau.
 */

const express = require('express');
const request = require('supertest');

const mockRows = { value: [], error: null };

jest.mock('../../supabase-config', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (onFulfilled, onRejected) => Promise.resolve({ data: mockRows.error ? null : mockRows.value, error: mockRows.error }).then(onFulfilled, onRejected),
  };
  return { supabase: { from: () => builder, rpc: () => Promise.resolve({}), storage: { from: () => ({}) } } };
});
jest.mock('fluent-ffmpeg', () => Object.assign(() => ({}), { setFfmpegPath: () => {} }));
jest.mock('ffmpeg-static', () => null);

const { isRecapVideo, splitRecapVideos, RECAP_MAX_AGE_HOURS } = require('../../services/recap-video');
const heroVideosRoutes = require('../../routes/hero-videos');

const app = express();
app.use(express.json());
app.use('/api/hero-videos', heroVideosRoutes);

const NOW = new Date('2026-11-15T08:00:00Z');
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3600 * 1000).toISOString();
const video = (id, title, created_at, extra = {}) => ({ id, title, video_url: `https://cdn.example.com/${id}.mp4`, created_at, ...extra });

describe('isRecapVideo', () => {
  it.each([
    'Récap 24 h — 14/11/2026',
    'récap du jour',
    'RECAP 24H',
    'Recap de la semaine',
    '  Récapitulatif de l\'actualité',
  ])('reconnaît « %s »', (title) => {
    expect(isRecapVideo({ title })).toBe(true);
  });

  it.each([
    'Importer votre Jetour T2 avec des pros ! Driveby Africa',
    'Studia Sup',
    'Le récap de nos offres',
    'Recapture du marché',
    '',
    null,
  ])('ne prend pas pour un récap « %s »', (title) => {
    expect(isRecapVideo({ title })).toBe(false);
  });

  it('supporte une vidéo absente', () => {
    expect(isRecapVideo(null)).toBe(false);
    expect(isRecapVideo(undefined)).toBe(false);
  });
});

describe('splitRecapVideos', () => {
  const ad1 = video('ad1', 'Driveby Africa', hoursAgo(500));
  const ad2 = video('ad2', 'Studia Sup', hoursAgo(400));

  it('sort le récap du carrousel et garde l\'ordre des autres vidéos', () => {
    const recap = video('r1', 'Récap 24 h — 14/11/2026', hoursAgo(10));

    const result = splitRecapVideos([recap, ad1, ad2], NOW);

    expect(result.recap).toBe(recap);
    expect(result.heroVideos).toEqual([ad1, ad2]);
  });

  it('choisit le récap le plus récent, et aucun ancien récap ne retourne dans le carrousel', () => {
    const old = video('r-old', 'Récap 24 h — 13/11/2026', hoursAgo(34));
    const latest = video('r-new', 'Récap 24 h — 14/11/2026', hoursAgo(10));

    const result = splitRecapVideos([old, ad1, latest], NOW);

    expect(result.recap.id).toBe('r-new');
    expect(result.heroVideos).toEqual([ad1]);
  });

  it('masque un récap de plus de trois jours, sans le remettre dans le carrousel', () => {
    const stale = video('r-stale', 'Récap 24 h — 10/11/2026', hoursAgo(RECAP_MAX_AGE_HOURS + 1));

    const result = splitRecapVideos([stale, ad1], NOW);

    expect(result.recap).toBeNull();
    expect(result.heroVideos).toEqual([ad1]);
  });

  it('ignore un récap sans date lisible plutôt que d\'afficher une vidéo d\'âge inconnu', () => {
    const result = splitRecapVideos([video('r', 'Récap 24 h', null), ad1], NOW);

    expect(result.recap).toBeNull();
    expect(result.heroVideos).toEqual([ad1]);
  });

  it('supporte l\'absence de vidéo', () => {
    expect(splitRecapVideos([], NOW)).toEqual({ recap: null, heroVideos: [] });
    expect(splitRecapVideos(null, NOW)).toEqual({ recap: null, heroVideos: [] });
  });
});

describe('routes /api/hero-videos', () => {
  let consoleError;

  beforeEach(() => {
    mockRows.error = null;
    mockRows.value = [
      video('r1', 'Récap 24 h — aujourd\'hui', new Date(Date.now() - 3 * 3600 * 1000).toISOString(), { description: 'Titre A · Titre B' }),
      video('ad1', 'Driveby Africa', '2026-06-01T10:00:00Z'),
      video('ad2', 'Studia Sup', '2026-06-02T10:00:00Z'),
    ];
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('GET /active ne renvoie plus le récap', async () => {
    const res = await request(app).get('/api/hero-videos/active');

    expect(res.status).toBe(200);
    expect(res.body.videos.map((v) => v.id)).toEqual(['ad1', 'ad2']);
  });

  it('GET /recap renvoie le récap du jour', async () => {
    const res = await request(app).get('/api/hero-videos/recap');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, video: { id: 'r1', description: 'Titre A · Titre B' } });
  });

  it('GET /recap renvoie null quand il n\'y a pas de récap', async () => {
    mockRows.value = mockRows.value.filter((v) => v.id !== 'r1');

    const res = await request(app).get('/api/hero-videos/recap');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, video: null });
  });

  it('une panne de base donne une erreur propre, sans détail technique', async () => {
    mockRows.error = { message: 'relation "hero_videos" does not exist' };

    const recap = await request(app).get('/api/hero-videos/recap');
    const active = await request(app).get('/api/hero-videos/active');

    expect(recap.status).toBe(500);
    expect(recap.body.video).toBeNull();
    expect(active.status).toBe(500);
    expect(active.body.videos).toEqual([]);
    expect(JSON.stringify(recap.body)).not.toContain('relation');
  });
});
