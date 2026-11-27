/**
 * File d'enrichissement IA des articles en attente.
 *
 * WHY: les articles importés flux par flux (rss-parser-service, toutes les
 * 15 min : AGP, Gabon Review, Gabon Actu…) sont enregistrés sans enrichissement
 * et gardent le statut `pending` posé par défaut par la base. Ils représentent
 * environ deux tiers des articles : sans résumé IA, sans TL;DR, et avec la
 * rubrique générique de leur flux. Cette file les traite par petits lots.
 *
 * Elle appelle directement l'IA (pas le cache local, qui ne produit ni résumé
 * ni TL;DR). En cas d'échec, l'article reste en attente et sera repris ; après
 * MAX_RETRIES échecs il passe en `failed`.
 *
 * @example
 *   const { enrichPendingArticles } = require('./services/article-enrichment-queue');
 *   const stats = await enrichPendingArticles({ limit: 30 });
 */

const DEFAULT_BATCH_SIZE = 30;
const DEFAULT_SINCE_DAYS = 30;
const MAX_RETRIES = 3;
const PAUSE_BETWEEN_ARTICLES_MS = 300;

// Rubriques posées par défaut par les flux : l'IA peut les remplacer. Une
// rubrique précise venant du flux (Sport, Économie…) est conservée.
const GENERIC_CATEGORIES = new Set(['', 'actualites', 'actualite', 'general', 'generale', 'autre']);

// Points de remplissage produits par le repli sans IA : jamais enregistrés comme TL;DR.
const FILLER_POINT = /voir l.article complet/i;

function _normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isGenericCategory(category) {
  return GENERIC_CATEGORIES.has(_normalize(category));
}

/** TL;DR exploitable (3 points réels) ou null. */
function cleanTldr(points) {
  if (!Array.isArray(points)) return null;
  const kept = points.filter((point) => typeof point === 'string' && point.trim() && !FILLER_POINT.test(point));
  return kept.length >= 3 ? kept.slice(0, 3) : null;
}

/**
 * Colonnes à écrire pour un article enrichi.
 * L'importance suit la même échelle que l'agrégateur RSS (1 à 10).
 */
function buildEnrichedFields(article, enrichment, now = new Date()) {
  const fields = {
    summary_ai: enrichment.ai_summary || null,
    sentiment_score: Number.isFinite(enrichment.ai_sentiment) ? enrichment.ai_sentiment : null,
    importance: Number.isFinite(enrichment.ai_importance) ? Math.max(1, Math.round(enrichment.ai_importance * 10)) : null,
    is_breaking: Boolean(enrichment.ai_is_breaking),
    keywords: Array.isArray(enrichment.ai_keywords) ? enrichment.ai_keywords : [],
    tldr_points: cleanTldr(enrichment.tldr_points),
    enrichment_status: 'completed',
    enrichment_error: null,
    enriched_at: now.toISOString(),
  };
  if (enrichment.ai_category && isGenericCategory(article.category)) {
    fields.category = enrichment.ai_category;
  }
  return fields;
}

function _defaultEnricher() {
  const ArticleAIEnrichment = require('./article-ai-enrichment');
  const service = new ArticleAIEnrichment();
  return (article) => service.enrichWithAI(article.title || '', article.content || '', article.summary || '');
}

let running = false;

/**
 * Enrichit un lot d'articles en attente, du plus récent au plus ancien.
 *
 * @param {{supabase?: object, enrich?: Function, limit?: number, sinceDays?: number, pauseMs?: number, now?: Date}} [options]
 * @returns {Promise<{skipped?: boolean, picked: number, completed: number, retried: number, failed: number}>}
 */
async function enrichPendingArticles({
  supabase = require('../supabase-config').supabase,
  enrich = _defaultEnricher(),
  limit = DEFAULT_BATCH_SIZE,
  sinceDays = DEFAULT_SINCE_DAYS,
  pauseMs = PAUSE_BETWEEN_ARTICLES_MS,
  now = new Date(),
} = {}) {
  // Un lot à la fois : si le précédent n'est pas fini, on passe son tour.
  if (running) return { skipped: true, picked: 0, completed: 0, retried: 0, failed: 0 };
  running = true;
  const stats = { picked: 0, completed: 0, retried: 0, failed: 0 };
  try {
    const since = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, content, category, enrichment_retries')
      .eq('enrichment_status', 'pending')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    stats.picked = (articles || []).length;

    for (const article of articles || []) {
      try {
        const enrichment = await enrich(article);
        const { error: updateError } = await supabase
          .from('articles')
          .update(buildEnrichedFields(article, enrichment, now))
          .eq('id', article.id);
        if (updateError) throw updateError;
        stats.completed += 1;
      } catch (articleError) {
        const retries = (article.enrichment_retries || 0) + 1;
        const failed = retries >= MAX_RETRIES;
        await supabase
          .from('articles')
          .update({
            enrichment_retries: retries,
            enrichment_status: failed ? 'failed' : 'pending',
            enrichment_error: String(articleError.message || articleError).slice(0, 500),
          })
          .eq('id', article.id);
        if (failed) stats.failed += 1;
        else stats.retried += 1;
      }
      if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    return stats;
  } finally {
    running = false;
  }
}

module.exports = {
  enrichPendingArticles,
  buildEnrichedFields,
  cleanTldr,
  isGenericCategory,
  DEFAULT_BATCH_SIZE,
  MAX_RETRIES,
};
