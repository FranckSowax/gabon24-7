/**
 * File d'enrichissement des articles en attente, et détection des robots dans
 * le compteur de vues. Supabase et l'IA sont simulés.
 */

const {
  enrichPendingArticles,
  buildEnrichedFields,
  cleanTldr,
  isGenericCategory,
  MAX_RETRIES,
} = require('../../services/article-enrichment-queue');
const { isBotUserAgent } = require('../../utils/bot-detect');

const NOW = new Date('2026-11-26T08:00:00Z');
const TLDR = ['Le gouvernement annonce cinq nouveaux fonds.', 'Ils visent les secteurs stratégiques.', 'Les modalités seront publiées.'];

const enrichment = (overrides = {}) => ({
  ai_summary: 'Cinq fonds pour les secteurs stratégiques.',
  ai_category: 'Économie',
  ai_sentiment: 0.4,
  ai_importance: 0.73,
  ai_is_breaking: false,
  ai_keywords: ['fonds', 'économie'],
  tldr_points: TLDR,
  ...overrides,
});

function fakeSupabase(rows, { selectError = null, failUpdateFor = [] } = {}) {
  const calls = { select: null, updates: [] };
  return {
    calls,
    from: () => {
      const query = { filters: {} };
      query.select = (columns) => { query.columns = columns; return query; };
      query.eq = (column, value) => {
        if (query.op === 'update') {
          calls.updates.push({ id: value, payload: query.payload });
          return Promise.resolve({ error: failUpdateFor.includes(value) && query.payload.enrichment_status === 'completed' ? { message: 'update refusé' } : null });
        }
        query.filters[column] = value;
        return query;
      };
      query.gte = (column, value) => { query.filters[`${column}>=`] = value; return query; };
      query.order = (column, options) => { query.orderBy = [column, options]; return query; };
      query.limit = (n) => {
        calls.select = { columns: query.columns, filters: query.filters, orderBy: query.orderBy, limit: n };
        return Promise.resolve({ data: selectError ? null : rows.slice(0, n), error: selectError });
      };
      query.update = (payload) => { query.op = 'update'; query.payload = payload; return query; };
      return query;
    },
  };
}

describe('rubrique et TL;DR', () => {
  it('ne remplace que les rubriques génériques', () => {
    expect(isGenericCategory('Actualités')).toBe(true);
    expect(isGenericCategory('Général')).toBe(true);
    expect(isGenericCategory(null)).toBe(true);
    expect(isGenericCategory('Sport')).toBe(false);
    expect(isGenericCategory('Économie')).toBe(false);
  });

  it('ne garde un TL;DR que s\'il a trois vrais points', () => {
    expect(cleanTldr(TLDR)).toEqual(TLDR);
    expect(cleanTldr([TLDR[0], TLDR[1], "Voir l'article complet pour plus de détails"])).toBeNull();
    expect(cleanTldr(null)).toBeNull();
    expect(cleanTldr(['a', '', '  '])).toBeNull();
  });

  it('prépare les colonnes à écrire, sur l\'échelle d\'importance de l\'agrégateur', () => {
    const fields = buildEnrichedFields({ category: 'Actualités' }, enrichment(), NOW);
    expect(fields).toMatchObject({
      summary_ai: 'Cinq fonds pour les secteurs stratégiques.',
      category: 'Économie',
      sentiment_score: 0.4,
      importance: 7,
      is_breaking: false,
      keywords: ['fonds', 'économie'],
      tldr_points: TLDR,
      enrichment_status: 'completed',
      enrichment_error: null,
      enriched_at: NOW.toISOString(),
    });
    expect(buildEnrichedFields({ category: 'Sport' }, enrichment(), NOW)).not.toHaveProperty('category');
  });
});

describe('file d\'enrichissement', () => {
  const articles = [
    { id: 'a1', title: 'Cinq nouveaux fonds', summary: 'Le gouvernement…', content: '', category: 'Actualités', enrichment_retries: 0 },
    { id: 'a2', title: 'Match des Panthères', summary: 'Victoire…', content: '', category: 'Sport', enrichment_retries: 0 },
  ];

  it('choisit les articles en attente des 30 derniers jours, du plus récent au plus ancien', async () => {
    const supabase = fakeSupabase(articles);
    await enrichPendingArticles({ supabase, enrich: async () => enrichment(), limit: 25, pauseMs: 0, now: NOW });
    expect(supabase.calls.select).toMatchObject({
      filters: { enrichment_status: 'pending', 'published_at>=': '2026-10-27T08:00:00.000Z' },
      orderBy: ['published_at', { ascending: false }],
      limit: 25,
    });
  });

  it('enrichit chaque article et garde une rubrique précise', async () => {
    const supabase = fakeSupabase(articles);
    const seen = [];
    const stats = await enrichPendingArticles({ supabase, enrich: async (article) => { seen.push(article.id); return enrichment(); }, pauseMs: 0, now: NOW });

    expect(seen).toEqual(['a1', 'a2']);
    expect(stats).toEqual({ picked: 2, completed: 2, retried: 0, failed: 0 });
    expect(supabase.calls.updates[0]).toMatchObject({ id: 'a1', payload: { category: 'Économie', tldr_points: TLDR, enrichment_status: 'completed' } });
    expect(supabase.calls.updates[1].payload).not.toHaveProperty('category');
  });

  it('laisse en attente un article dont l\'IA échoue, avec le nombre d\'essais', async () => {
    const supabase = fakeSupabase([articles[0]]);
    const stats = await enrichPendingArticles({ supabase, enrich: async () => { throw new Error('OpenRouter indisponible'); }, pauseMs: 0, now: NOW });
    expect(stats).toMatchObject({ completed: 0, retried: 1, failed: 0 });
    expect(supabase.calls.updates[0].payload).toEqual({ enrichment_retries: 1, enrichment_status: 'pending', enrichment_error: 'OpenRouter indisponible' });
  });

  it('abandonne après le nombre maximal d\'essais', async () => {
    const supabase = fakeSupabase([{ ...articles[0], enrichment_retries: MAX_RETRIES - 1 }]);
    const stats = await enrichPendingArticles({ supabase, enrich: async () => { throw new Error('boom'); }, pauseMs: 0, now: NOW });
    expect(stats).toMatchObject({ failed: 1, retried: 0 });
    expect(supabase.calls.updates[0].payload).toMatchObject({ enrichment_retries: MAX_RETRIES, enrichment_status: 'failed' });
  });

  it('compte comme un échec une écriture refusée par la base', async () => {
    const supabase = fakeSupabase([articles[0]], { failUpdateFor: ['a1'] });
    const stats = await enrichPendingArticles({ supabase, enrich: async () => enrichment(), pauseMs: 0, now: NOW });
    expect(stats).toMatchObject({ completed: 0, retried: 1 });
  });

  it('ne lance pas deux lots en même temps', async () => {
    let release;
    const slow = () => new Promise((resolve) => { release = () => resolve(enrichment()); });
    const supabase = fakeSupabase([articles[0]]);
    const first = enrichPendingArticles({ supabase, enrich: slow, pauseMs: 0, now: NOW });
    await new Promise((resolve) => setImmediate(resolve));
    const second = await enrichPendingArticles({ supabase, enrich: async () => enrichment(), pauseMs: 0, now: NOW });
    expect(second).toMatchObject({ skipped: true });
    release();
    await expect(first).resolves.toMatchObject({ completed: 1 });
  });

  it('remonte une erreur de lecture de la base', async () => {
    const supabase = fakeSupabase([], { selectError: { message: 'base indisponible' } });
    await expect(enrichPendingArticles({ supabase, enrich: async () => enrichment(), pauseMs: 0, now: NOW })).rejects.toMatchObject({ message: 'base indisponible' });
  });
});

describe('enrichissement par l\'IA', () => {
  it('signale l\'échec de l\'IA au lieu de renvoyer un repli', async () => {
    jest.resetModules();
    jest.doMock('../../services/gemini-service', () => ({ generateJSON: async () => { throw new Error('quota'); } }));
    jest.doMock('../../services/smart-enrichment-cache', () => ({ getSmartEnrichment: async () => ({ source: 'ai-required' }) }));
    const ArticleAIEnrichment = require('../../services/article-ai-enrichment');
    const service = new ArticleAIEnrichment();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.enrichWithAI('Titre', '', 'Résumé')).rejects.toThrow('quota');
    // L'ancien point d'entrée garde son repli sans IA.
    await expect(service.enrichArticle('Titre', '', 'Résumé', 'AGP')).resolves.toHaveProperty('ai_category');

    log.mockRestore(); err.mockRestore();
    jest.dontMock('../../services/gemini-service');
    jest.dontMock('../../services/smart-enrichment-cache');
  });
});

describe('robots dans le compteur de vues', () => {
  it('reconnaît les robots et les agents vides', () => {
    [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36',
      'curl/8.4.0',
      'python-requests/2.31',
      'GPTBot/1.0',
      '',
      undefined,
    ].forEach((agent) => expect(isBotUserAgent(agent)).toBe(true));
  });

  it('laisse passer les navigateurs des lecteurs', () => {
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    ].forEach((agent) => expect(isBotUserAgent(agent)).toBe(false));
  });
});
