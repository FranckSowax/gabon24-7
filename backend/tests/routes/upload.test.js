/**
 * Envoi de fichiers par les clients : POST /api/upload/*, DELETE /api/upload.
 * De vrais envois multipart traversent multer ; seul le dépôt dans Supabase
 * Storage est simulé. Sert aussi de filet lors des montées de version de multer.
 */

const express = require('express');
const request = require('supertest');

const USER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '33333333-3333-4333-8333-333333333333';

const mockUploadImage = jest.fn();
const mockUploadVideo = jest.fn();
const mockDeleteFile = jest.fn();

jest.mock('../../supabase-config', () => {
  const makeBuilder = () => {
    const builder = { filters: {} };
    builder.select = () => builder;
    builder.eq = (column, value) => { builder.filters[column] = value; return builder; };
    const resolve = () => ({
      data: { is_admin: Object.values(builder.filters).includes('33333333-3333-4333-8333-333333333333'), role: 'user' },
      error: null,
    });
    builder.single = () => Promise.resolve(resolve());
    builder.maybeSingle = () => Promise.resolve(resolve());
    return builder;
  };
  return {
    supabase: {
      from: jest.fn(() => makeBuilder()),
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

// multer (réception du fichier) reste le vrai ; seul le dépôt est simulé.
jest.mock('../../services/upload-service', () => ({
  ...jest.requireActual('../../services/upload-service'),
  uploadCampaignImage: (...args) => mockUploadImage(...args),
  uploadCampaignVideo: (...args) => mockUploadVideo(...args),
  deleteFile: (...args) => mockDeleteFile(...args),
}));

const uploadRoutes = require('../../routes/upload');

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);
// Dernier filet, comme le gestionnaire d'erreurs du serveur.
app.use((err, req, res, next) => res.status(500).json({ success: false, error: 'Erreur interne' }));

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const auth = (req, userId = USER) => req.set('Authorization', `Bearer token-${userId}`);

describe('envoi de fichiers (/api/upload)', () => {
  let consoleError;
  let consoleLog;

  beforeEach(() => {
    mockUploadImage.mockReset().mockResolvedValue('https://cdn.example.com/campaigns/image.png');
    mockUploadVideo.mockReset().mockResolvedValue('https://cdn.example.com/campaigns/video.mp4');
    mockDeleteFile.mockReset().mockResolvedValue(true);
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  describe('POST /image', () => {
    it('refuse sans jeton, sans rien déposer', async () => {
      const res = await request(app).post('/api/upload/image')
        .attach('file', PNG, { filename: 'banniere.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('reçoit une image et renvoie son adresse', async () => {
      const res = await auth(request(app).post('/api/upload/image'))
        .attach('file', PNG, { filename: 'banniere.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        url: 'https://cdn.example.com/campaigns/image.png',
        filename: 'banniere.png',
        size: PNG.length,
      });
      const [buffer, name, mime] = mockUploadImage.mock.calls[0];
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.equals(PNG)).toBe(true);
      expect(name).toBe('banniere.png');
      expect(mime).toBe('image/png');
    });

    it('répond 400 quand aucun fichier n\'est joint', async () => {
      const res = await auth(request(app).post('/api/upload/image')).field('titre', 'sans fichier');

      expect(res.status).toBe(400);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it.each([
      ['un script', 'attaque.html', 'text/html'],
      ['un exécutable', 'outil.exe', 'application/x-msdownload'],
      ['un SVG', 'logo.svg', 'image/svg+xml'],
      ['un PDF', 'doc.pdf', 'application/pdf'],
    ])('refuse %s avec un message clair (400)', async (label, filename, contentType) => {
      const res = await auth(request(app).post('/api/upload/image'))
        .attach('file', Buffer.from('<script>alert(1)</script>'), { filename, contentType });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Type de fichier non autorisé/);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('refuse un champ de fichier inattendu (400)', async () => {
      const res = await auth(request(app).post('/api/upload/image'))
        .attach('autre', PNG, { filename: 'a.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('refuse un fichier de plus de 50 Mo (413)', async () => {
      const tooBig = Buffer.alloc(50 * 1024 * 1024 + 1024, 0);
      const res = await auth(request(app).post('/api/upload/image'))
        .attach('file', tooBig, { filename: 'enorme.png', contentType: 'image/png' });

      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/trop volumineux/);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });
  });

  describe('POST /video', () => {
    it('reçoit une vidéo et renvoie son adresse', async () => {
      const res = await auth(request(app).post('/api/upload/video'))
        .attach('file', Buffer.from('fausse-video'), { filename: 'spot.mp4', contentType: 'video/mp4' });

      expect(res.status).toBe(200);
      expect(res.body.url).toBe('https://cdn.example.com/campaigns/video.mp4');
      expect(mockUploadVideo).toHaveBeenCalledTimes(1);
    });

    it('refuse une image envoyée comme vidéo (400)', async () => {
      const res = await auth(request(app).post('/api/upload/video'))
        .attach('file', PNG, { filename: 'image.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(mockUploadVideo).not.toHaveBeenCalled();
    });
  });

  describe('POST /multiple', () => {
    it('reçoit jusqu\'à 5 images', async () => {
      let req = auth(request(app).post('/api/upload/multiple'));
      for (let i = 0; i < 5; i += 1) {
        req = req.attach('files', PNG, { filename: `image-${i}.png`, contentType: 'image/png' });
      }
      const res = await req;

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(5);
      expect(mockUploadImage).toHaveBeenCalledTimes(5);
    });

    it('refuse une 6e image (400)', async () => {
      let req = auth(request(app).post('/api/upload/multiple'));
      for (let i = 0; i < 6; i += 1) {
        req = req.attach('files', PNG, { filename: `image-${i}.png`, contentType: 'image/png' });
      }
      const res = await req;

      expect(res.status).toBe(400);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });
  });

  describe('DELETE / (suppression de fichier)', () => {
    const body = { url: 'https://x.supabase.co/storage/v1/object/public/campaigns-images/a.png' };

    it('refuse sans jeton', async () => {
      const res = await request(app).delete('/api/upload').send(body);

      expect(res.status).toBe(401);
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('refuse un compte connecté non administrateur', async () => {
      const res = await auth(request(app).delete('/api/upload')).send(body);

      expect(res.status).toBe(403);
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('accepte un administrateur', async () => {
      const res = await auth(request(app).delete('/api/upload'), ADMIN).send(body);

      expect(res.status).toBe(200);
      expect(mockDeleteFile).toHaveBeenCalledWith(body.url, 'campaigns-images');
    });
  });
});
