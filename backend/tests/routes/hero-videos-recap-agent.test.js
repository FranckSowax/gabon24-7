/**
 * Dépôt du récap vidéo par l'agent : POST /api/hero-videos/recap.
 * La route n'accepte que la clé de l'agent (en-tête X-Agent-Key), et cette clé
 * n'ouvre rien d'autre. Un vrai envoi multipart traverse multer ; Supabase et
 * ffmpeg sont simulés (aucun appel réseau, aucune compression réelle).
 */

const express = require('express');
const request = require('supertest');

const AGENT_KEY = 'k'.repeat(48);
const VIDEO = Buffer.from('faux contenu mp4');

const mockDb = { rows: [], inserted: [], updates: [], uploads: [], insertError: null, updateError: null };

jest.mock('../../supabase-config', () => {
  const from = () => {
    const builder = { op: 'select', payload: null };
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.order = () => builder;
    builder.insert = (payload) => { builder.op = 'insert'; builder.payload = payload; return builder; };
    builder.update = (payload) => { builder.op = 'update'; builder.payload = payload; return builder; };
    builder.in = (column, ids) => {
      if (mockDb.updateError) return Promise.resolve({ data: null, error: mockDb.updateError });
      mockDb.updates.push({ payload: builder.payload, ids });
      return Promise.resolve({ data: null, error: null });
    };
    builder.single = () => {
      if (builder.op !== 'insert') return Promise.resolve({ data: null, error: { message: 'not found' } });
      if (mockDb.insertError) return Promise.resolve({ data: null, error: mockDb.insertError });
      const row = { id: `new-${mockDb.inserted.length + 1}`, created_at: new Date().toISOString(), ...builder.payload };
      mockDb.inserted.push(row);
      mockDb.rows.push(row);
      return Promise.resolve({ data: row, error: null });
    };
    builder.maybeSingle = builder.single;
    builder.then = (onFulfilled, onRejected) => Promise.resolve({
      data: mockDb.rows.filter((row) => row.is_active !== false),
      error: null,
    }).then(onFulfilled, onRejected);
    return builder;
  };
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'invalid' } }) },
      storage: {
        from: () => ({
          upload: (name, body, options) => { mockDb.uploads.push({ name, size: body.length, options }); return Promise.resolve({ error: null }); },
          getPublicUrl: (name) => ({ data: { publicUrl: `https://storage.test/hero-videos/${name}` } }),
        }),
      },
    },
  };
});

// ffmpeg simulé : la « compression » recopie le fichier d'entrée.
jest.mock('fluent-ffmpeg', () => {
  const fs = require('fs');
  const factory = (inputPath) => {
    const handlers = {};
    const chain = {
      outputOptions: () => chain,
      on: (event, handler) => { handlers[event] = handler; return chain; },
      save: (outputPath) => { fs.copyFileSync(inputPath, outputPath); setImmediate(() => handlers.end()); return chain; },
    };
    return chain;
  };
  return Object.assign(factory, { setFfmpegPath: () => {} });
});
jest.mock('ffmpeg-static', () => null);

const { buildRecapTitle, normalizeRecapHeadlines } = require('../../services/recap-video');

// Application neuve à chaque test : la limite de débit repart de zéro.
function buildApp() {
  let routes;
  jest.isolateModules(() => { routes = require('../../routes/hero-videos'); });
  const app = express();
  app.use(express.json());
  app.use('/api/hero-videos', routes);
  app.use((err, req, res, next) => res.status(500).json({ success: false, error: 'Erreur interne' }));
  return app;
}

const deposit = (app, { key = AGENT_KEY, headlines = 'Titre A · Titre B', file = true, fields = {} } = {}) => {
  let req = request(app).post('/api/hero-videos/recap');
  if (key !== null) req = req.set('X-Agent-Key', key);
  if (headlines !== null) req = req.field('headlines', headlines);
  Object.entries(fields).forEach(([name, value]) => { req = req.field(name, value); });
  if (file) req = req.attach('video', VIDEO, { filename: 'recap.mp4', contentType: 'video/mp4' });
  return req;
};

describe('dépôt du récap par l\'agent (POST /api/hero-videos/recap)', () => {
  let app;
  let consoleError;
  let consoleLog;

  beforeEach(() => {
    process.env.RECAP_AGENT_KEY = AGENT_KEY;
    Object.assign(mockDb, { rows: [], inserted: [], updates: [], uploads: [], insertError: null, updateError: null });
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.RECAP_AGENT_KEY;
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  describe('accès', () => {
    it('refuse une requête sans clé, sans rien enregistrer', async () => {
      const res = await deposit(app, { key: null });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('RECAP_AGENT_UNAUTHORIZED');
      expect(mockDb.uploads).toHaveLength(0);
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('refuse une mauvaise clé, même de la bonne longueur', async () => {
      const res = await deposit(app, { key: 'x'.repeat(48) });
      expect(res.status).toBe(401);
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('refuse une clé qui ne fait que commencer comme la bonne', async () => {
      const res = await deposit(app, { key: AGENT_KEY.slice(0, 40) });
      expect(res.status).toBe(401);
    });

    it('reste fermée (503) tant que la clé n\'est pas configurée sur le serveur', async () => {
      delete process.env.RECAP_AGENT_KEY;
      const res = await deposit(app, { key: '' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('RECAP_AGENT_NOT_CONFIGURED');
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('reste fermée (503) si la clé configurée est trop courte pour être sûre', async () => {
      process.env.RECAP_AGENT_KEY = 'trop-courte';
      const res = await deposit(app, { key: 'trop-courte' });
      expect(res.status).toBe(503);
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('ne renvoie jamais la clé dans ses réponses', async () => {
      const refused = await deposit(app, { key: 'x'.repeat(48) });
      const accepted = await deposit(app);
      expect(JSON.stringify(refused.body)).not.toContain(AGENT_KEY);
      expect(JSON.stringify(accepted.body)).not.toContain(AGENT_KEY);
    });

    it('la clé de l\'agent n\'ouvre aucune route d\'administration', async () => {
      const create = await request(app).post('/api/hero-videos').set('X-Agent-Key', AGENT_KEY)
        .attach('video', VIDEO, { filename: 'pub.mp4', contentType: 'video/mp4' });
      const update = await request(app).put('/api/hero-videos/abc').set('X-Agent-Key', AGENT_KEY).send({ is_active: false });
      const remove = await request(app).delete('/api/hero-videos/abc').set('X-Agent-Key', AGENT_KEY);
      expect([create.status, update.status, remove.status]).toEqual([401, 401, 401]);
      expect(mockDb.inserted).toHaveLength(0);
      expect(mockDb.updates).toHaveLength(0);
    });

    it('bloque les tentatives répétées (limite de débit)', async () => {
      const statuses = [];
      for (let i = 0; i < 11; i += 1) {
        statuses.push((await deposit(app, { key: 'x'.repeat(48), file: false })).status);
      }
      expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
      expect(statuses[10]).toBe(429);
    });
  });

  describe('dépôt', () => {
    it('enregistre le récap avec un titre, un lien et un ordre fixés par le serveur', async () => {
      const res = await deposit(app, {
        headlines: 'Budget 2027 adopté · Coupure d\'eau à Libreville',
        fields: { title: 'Titre imposé', cta_url: 'https://exemple.test/piege', order_index: '9', is_active: 'false' },
      });

      expect(res.status).toBe(201);
      expect(mockDb.uploads).toHaveLength(1);
      expect(mockDb.uploads[0].options).toMatchObject({ contentType: 'video/mp4', upsert: false });
      expect(mockDb.uploads[0].size).toBe(VIDEO.length);

      const row = mockDb.inserted[0];
      expect(row.title).toBe(buildRecapTitle());
      expect(row.description).toBe('Budget 2027 adopté · Coupure d\'eau à Libreville');
      expect(row.cta_label).toBe('Lire l\'actualité');
      expect(row.cta_url).toBe('https://gaboninsight.com/');
      expect(row.order_index).toBe(0);
      expect(row.is_active).toBe(true);
      expect(row.video_url).toMatch(/^https:\/\/storage\.test\/hero-videos\/hero-\d+\.mp4$/);
      expect(res.body.video).toMatchObject({ id: row.id, title: row.title, video_url: row.video_url });
      expect(res.body.replaced).toBe(0);
    });

    it('accepte les titres sous l\'ancien nom « description »', async () => {
      const res = await deposit(app, { headlines: null, fields: { description: 'Titre A · Titre B' } });
      expect(res.status).toBe(201);
      expect(mockDb.inserted[0].description).toBe('Titre A · Titre B');
    });

    it('désactive les récaps précédents, et seulement eux', async () => {
      mockDb.rows = [
        { id: 'pub-1', title: 'Découvrez notre offre', is_active: true },
        { id: 'old-1', title: 'Récap 24 h — 13/11/2026', is_active: true },
        { id: 'old-2', title: 'Récap 24 h — 12/11/2026', is_active: true },
      ];
      const res = await deposit(app);

      expect(res.status).toBe(201);
      expect(res.body.replaced).toBe(2);
      expect(mockDb.updates).toHaveLength(1);
      expect(mockDb.updates[0].ids).toEqual(['old-1', 'old-2']);
      expect(mockDb.updates[0].payload.is_active).toBe(false);
    });

    it('garde le nouveau récap même si les anciens n\'ont pas pu être désactivés', async () => {
      mockDb.rows = [{ id: 'old-1', title: 'Récap 24 h — 13/11/2026', is_active: true }];
      mockDb.updateError = { message: 'boom' };
      const res = await deposit(app);
      expect(res.status).toBe(201);
      expect(res.body.replaced).toBe(0);
      expect(mockDb.inserted).toHaveLength(1);
    });

    it('refuse un envoi sans fichier', async () => {
      const res = await deposit(app, { file: false });
      expect(res.status).toBe(400);
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('refuse un fichier qui n\'est pas une vidéo mp4', async () => {
      const res = await request(app).post('/api/hero-videos/recap').set('X-Agent-Key', AGENT_KEY)
        .field('headlines', 'Titre A')
        .attach('video', Buffer.from('<html>'), { filename: 'page.html', contentType: 'text/html' });
      expect(res.status).toBe(400);
      expect(mockDb.uploads).toHaveLength(0);
    });

    it('refuse un envoi sans titres du jour', async () => {
      const res = await deposit(app, { headlines: '   ' });
      expect(res.status).toBe(400);
      expect(mockDb.uploads).toHaveLength(0);
    });

    it('refuse un fichier envoyé sous un autre nom de champ', async () => {
      const res = await request(app).post('/api/hero-videos/recap').set('X-Agent-Key', AGENT_KEY)
        .field('headlines', 'Titre A')
        .attach('fichier', VIDEO, { filename: 'recap.mp4', contentType: 'video/mp4' });
      expect(res.status).toBe(400);
      expect(mockDb.inserted).toHaveLength(0);
    });

    it('répond 500 sans détail technique si l\'enregistrement échoue', async () => {
      mockDb.insertError = { message: 'relation "hero_videos" violates something secret' };
      const res = await deposit(app);
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('hero_videos');
    });
  });
});

describe('titre du récap', () => {
  it('suit la date de Libreville, pas celle du serveur', () => {
    // 23 h 30 UTC le 14 = 0 h 30 le 15 à Libreville (UTC+1).
    expect(buildRecapTitle(new Date('2026-11-14T23:30:00Z'))).toBe('Récap 24 h — 15/11/2026');
    expect(buildRecapTitle(new Date('2026-11-14T12:00:00Z'))).toBe('Récap 24 h — 14/11/2026');
  });

  it('est reconnu comme un récap par le module', () => {
    const { isRecapVideo } = require('../../services/recap-video');
    expect(isRecapVideo({ title: buildRecapTitle() })).toBe(true);
  });
});

describe('titres du jour', () => {
  it('accepte une liste, un texte séparé par « · » ou des retours à la ligne', () => {
    expect(normalizeRecapHeadlines(['A', ' B ', ''])).toBe('A · B');
    expect(normalizeRecapHeadlines('A · B · C')).toBe('A · B · C');
    expect(normalizeRecapHeadlines('A\nB\r\nC')).toBe('A · B · C');
  });

  it('retire les balises et les caractères de contrôle', () => {
    expect(normalizeRecapHeadlines('<script>alert(1)</script>Budget <b>adopté</b>')).toBe('alert(1) Budget adopté');
    expect(normalizeRecapHeadlines('A\u0000B\u0007')).toBe('A B');
  });

  it('limite le nombre et la longueur des titres', () => {
    const many = normalizeRecapHeadlines(Array.from({ length: 12 }, (_, i) => `Titre ${i}`));
    expect(many.split(' · ')).toHaveLength(6);
    expect(normalizeRecapHeadlines('x'.repeat(500))).toHaveLength(160);
  });

  it('renvoie une chaîne vide quand il n\'y a rien d\'exploitable', () => {
    expect(normalizeRecapHeadlines(undefined)).toBe('');
    expect(normalizeRecapHeadlines([' ', null, '<br>'])).toBe('');
  });
});
