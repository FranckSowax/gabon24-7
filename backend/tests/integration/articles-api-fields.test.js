/**
 * Les listes d'articles renvoient les TL;DR, et /api/articles/all ne demande
 * plus de colonne inexistante.
 *
 * Le vrai server.js est démarré, branché sur une fausse API Supabase locale
 * (PostgREST simulé) qui enregistre les colonnes demandées.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..', '..');
const API_PORT = 39581;
const TLDR = ['Premier point clé de l\'article.', 'Deuxième point clé de l\'article.', 'Troisième point clé de l\'article.'];
const ARTICLE = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cinq nouveaux fonds pour l\'économie',
  summary: 'Le gouvernement annonce cinq fonds.',
  summary_ai: 'Cinq fonds annoncés.',
  category: 'Économie',
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  image_url: 'https://example.org/image.jpg',
  image_urls: ['https://example.org/image.jpg'],
  source: 'AGP Gabon',
  url: 'https://agpgabon.ga/article',
  is_premium: false,
  is_published: true,
  view_count: 3,
  sentiment_score: 0.4,
  tldr_points: TLDR,
  author: 'Rédaction',
  read_time_minutes: 2,
};

let fakeDb;
let server;
const selects = [];

function startFakeSupabase() {
  return new Promise((resolve) => {
    fakeDb = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const table = url.pathname.replace('/rest/v1/', '');
      if (table === 'articles') selects.push(url.searchParams.get('select') || '');
      const wantsOne = (req.headers.accept || '').includes('vnd.pgrst.object');
      const rows = table === 'articles' ? [ARTICLE] : [];
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Range', `0-${rows.length - 1}/${rows.length}`);
      res.end(JSON.stringify(wantsOne ? (rows[0] || null) : rows));
    });
    fakeDb.listen(0, () => resolve(fakeDb.address().port));
  });
}

beforeAll(async () => {
  const dbPort = await startFakeSupabase();
  server = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SUPABASE_URL: `http://localhost:${dbPort}`,
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      SUPABASE_ANON_KEY: 'test-key',
      PORT: String(API_PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(`http://localhost:${API_PORT}/health`); return; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error('Le serveur n\'a pas démarré');
}, 40000);

afterAll(() => {
  if (server) server.kill('SIGKILL');
  if (fakeDb) fakeDb.close();
});

const get = async (route) => (await fetch(`http://localhost:${API_PORT}${route}`)).json();

describe('TL;DR dans les listes d\'articles', () => {
  it.each([
    ['/api/articles/home'],
    ['/api/articles/week'],
    ['/api/articles/trending'],
    ['/api/articles'],
  ])('%s renvoie les TL;DR', async (route) => {
    const body = await get(route);
    const articles = body.articles || body.data || [];
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].tldr_points).toEqual(TLDR);
  });

  it('un article seul renvoie son TL;DR', async () => {
    const body = await get(`/api/articles/${ARTICLE.id}`);
    expect(body.article.tldr_points).toEqual(TLDR);
  });

  it('toutes les requêtes de liste demandent la colonne', () => {
    const lists = selects.filter((select) => select.startsWith('id,title,summary,category'));
    expect(lists.length).toBeGreaterThan(0);
    lists.forEach((select) => expect(select).toContain('tldr_points'));
  });
});

describe('/api/articles/all', () => {
  it('ne demande plus la colonne inexistante « sentiment » et renvoie images et TL;DR', async () => {
    const body = await get('/api/articles/all?page=1&limit=20');
    expect(body.success).toBe(true);
    expect(body.articles[0]).toMatchObject({ sentiment: 0.4, image_url: ARTICLE.image_url, tldr_points: TLDR });

    const select = selects.find((value) => value.includes('summary_ai') && value.includes('read_time_minutes'));
    const columns = select.split(',').map((column) => column.trim());
    expect(columns).not.toContain('sentiment');
    expect(columns).toEqual(expect.arrayContaining(['sentiment_score', 'image_url', 'tldr_points']));
  });
});
