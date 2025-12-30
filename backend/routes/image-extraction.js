/**
 * 🖼️ ROUTES D'EXTRACTION D'IMAGES
 * API pour extraire et mettre à jour les images des articles
 *
 * Endpoints:
 * - POST /api/image-extraction/extract - Extraire l'image d'un article
 * - POST /api/image-extraction/batch - Extraire en batch pour plusieurs articles
 * - POST /api/image-extraction/fix-missing - Corriger les articles sans images
 * - GET /api/image-extraction/stats - Statistiques sur les images
 *
 * @module routes/image-extraction
 * @author Claude Code
 * @date 2025-12-30
 */

const express = require('express');
const router = express.Router();
const { imageExtractor } = require('../services/image-extractor');
const supabaseService = require('../supabase-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { z } = require('zod');

// ==================== VALIDATION SCHEMAS ====================

const extractSingleSchema = z.object({
  url: z.string().url(),
  articleId: z.string().optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  updateDatabase: z.boolean().optional().default(false)
});

const extractBatchSchema = z.object({
  articleIds: z.array(z.string()).max(100).optional(),
  limit: z.number().min(1).max(500).optional().default(50),
  onlyMissing: z.boolean().optional().default(true),
  updateDatabase: z.boolean().optional().default(true)
});

// ==================== ENDPOINTS ====================

/**
 * POST /api/image-extraction/extract
 * Extraire l'image d'un article unique
 */
router.post('/extract', async (req, res) => {
  try {
    // Validation
    const validation = extractSingleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: validation.error.errors
      });
    }

    const { url, articleId, category, source, updateDatabase } = validation.data;

    console.log(`🔍 [image-extraction] Extraction pour: ${url}`);

    // Extraire l'image
    const result = await imageExtractor.extractImage(url, { category, source });

    // Mettre à jour la base de données si demandé
    if (updateDatabase && articleId && result.imageUrl) {
      const { error } = await supabaseService.supabase
        .from('articles')
        .update({
          image_url: result.imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) {
        console.warn(`⚠️ Erreur mise à jour article ${articleId}:`, error.message);
      } else {
        console.log(`✅ Article ${articleId} mis à jour avec nouvelle image`);
      }
    }

    res.json({
      success: true,
      data: {
        imageUrl: result.imageUrl,
        strategy: result.strategy,
        source: result.source,
        updated: updateDatabase && articleId && result.imageUrl
      }
    });

  } catch (error) {
    console.error('❌ Erreur extraction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-extraction/batch
 * Extraire les images en batch pour plusieurs articles
 * Requiert authentification admin
 */
router.post('/batch', requireAdmin, async (req, res) => {
  try {
    // Validation
    const validation = extractBatchSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: validation.error.errors
      });
    }

    const { articleIds, limit, onlyMissing, updateDatabase } = validation.data;

    console.log(`📦 [image-extraction] Batch extraction - limit: ${limit}, onlyMissing: ${onlyMissing}`);

    // Construire la requête
    let query = supabaseService.supabase
      .from('articles')
      .select('id, url, category, source, image_url')
      .not('url', 'is', null);

    if (articleIds && articleIds.length > 0) {
      query = query.in('id', articleIds);
    } else if (onlyMissing) {
      // Articles sans image ou avec image invalide
      query = query.or('image_url.is.null,image_url.eq.,image_url.ilike.%.netlify/functions/%');
    }

    query = query.limit(limit).order('created_at', { ascending: false });

    const { data: articles, error } = await query;

    if (error) {
      throw new Error(`Erreur récupération articles: ${error.message}`);
    }

    console.log(`📊 ${articles.length} articles à traiter`);

    if (articles.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun article à traiter',
        stats: { total: 0, processed: 0, success: 0, failed: 0 }
      });
    }

    // Extraire les images en batch
    const results = await imageExtractor.extractBatch(articles, {
      concurrency: 3,
      onProgress: (progress) => {
        console.log(`⏳ Progression: ${progress.percentage}% (${progress.processed}/${progress.total})`);
      }
    });

    // Mettre à jour la base de données si demandé
    let updatedCount = 0;
    let failedCount = 0;

    if (updateDatabase) {
      for (const result of results) {
        if (result.imageUrl && result.articleId) {
          const { error: updateError } = await supabaseService.supabase
            .from('articles')
            .update({
              image_url: result.imageUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', result.articleId);

          if (updateError) {
            failedCount++;
            console.warn(`⚠️ Erreur mise à jour ${result.articleId}:`, updateError.message);
          } else {
            updatedCount++;
          }
        } else {
          failedCount++;
        }
      }
    }

    const successCount = results.filter(r => r.imageUrl).length;

    console.log(`✅ Batch terminé: ${successCount}/${articles.length} images trouvées, ${updatedCount} mis à jour`);

    res.json({
      success: true,
      stats: {
        total: articles.length,
        processed: results.length,
        imagesFound: successCount,
        updated: updatedCount,
        failed: failedCount
      },
      details: results.map(r => ({
        articleId: r.articleId,
        imageUrl: r.imageUrl,
        strategy: r.strategy,
        source: r.source
      }))
    });

  } catch (error) {
    console.error('❌ Erreur batch extraction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-extraction/fix-missing
 * Corriger automatiquement tous les articles sans images
 * Requiert authentification admin
 */
router.post('/fix-missing', requireAdmin, async (req, res) => {
  try {
    const { limit = 100, dryRun = false } = req.body;

    console.log(`🔧 [image-extraction] Fix missing images - limit: ${limit}, dryRun: ${dryRun}`);

    // Récupérer les articles sans image valide
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, url, title, category, source, image_url')
      .or('image_url.is.null,image_url.eq.')
      .not('url', 'is', null)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur récupération articles: ${error.message}`);
    }

    console.log(`📊 ${articles.length} articles sans image trouvés`);

    if (articles.length === 0) {
      return res.json({
        success: true,
        message: 'Tous les articles ont des images',
        stats: { total: 0, fixed: 0, failed: 0 }
      });
    }

    // Mode dry-run: ne fait que l'extraction sans mise à jour
    if (dryRun) {
      const results = await imageExtractor.extractBatch(articles.slice(0, 10), { concurrency: 2 });

      return res.json({
        success: true,
        dryRun: true,
        message: `${articles.length} articles à corriger. Aperçu sur 10 articles:`,
        preview: results.map(r => ({
          articleId: r.articleId,
          wouldUpdate: !!r.imageUrl,
          imageUrl: r.imageUrl,
          strategy: r.strategy
        }))
      });
    }

    // Traitement réel
    const results = await imageExtractor.extractBatch(articles, {
      concurrency: 3,
      onProgress: (progress) => {
        console.log(`⏳ Fix progress: ${progress.percentage}%`);
      }
    });

    // Mise à jour en base
    let fixedCount = 0;
    let failedCount = 0;

    for (const result of results) {
      if (result.imageUrl && result.articleId) {
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({
            image_url: result.imageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', result.articleId);

        if (updateError) {
          failedCount++;
        } else {
          fixedCount++;
        }
      } else {
        failedCount++;
      }
    }

    console.log(`✅ Fix terminé: ${fixedCount}/${articles.length} articles corrigés`);

    res.json({
      success: true,
      stats: {
        total: articles.length,
        fixed: fixedCount,
        failed: failedCount,
        successRate: Math.round((fixedCount / articles.length) * 100) + '%'
      }
    });

  } catch (error) {
    console.error('❌ Erreur fix-missing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-extraction/stats
 * Statistiques sur les images des articles
 */
router.get('/stats', async (req, res) => {
  try {
    // Total articles
    const { count: totalArticles } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });

    // Articles avec image
    const { count: withImage } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .not('image_url', 'is', null)
      .neq('image_url', '');

    // Articles sans image
    const { count: withoutImage } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .or('image_url.is.null,image_url.eq.');

    // Articles avec vieilles URLs Netlify proxy
    const { count: netlifyProxy } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .ilike('image_url', '%/.netlify/functions/%');

    // Articles avec images Unsplash (fallback)
    const { count: unsplashFallback } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .ilike('image_url', '%unsplash.com%');

    res.json({
      success: true,
      stats: {
        totalArticles,
        withImage,
        withoutImage,
        netlifyProxy,
        unsplashFallback,
        coverageRate: totalArticles > 0 ? Math.round((withImage / totalArticles) * 100) + '%' : '0%',
        needsAttention: withoutImage + netlifyProxy
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-extraction/cleanup-netlify
 * Nettoyer les vieilles URLs Netlify proxy
 * Requiert authentification admin
 */
router.post('/cleanup-netlify', requireAdmin, async (req, res) => {
  try {
    const { limit = 100, dryRun = false } = req.body;

    // Récupérer les articles avec vieilles URLs Netlify
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, url, image_url, category, source')
      .ilike('image_url', '%/.netlify/functions/image-proxy%')
      .limit(limit);

    if (error) {
      throw new Error(`Erreur récupération: ${error.message}`);
    }

    console.log(`📊 ${articles.length} articles avec URLs Netlify trouvés`);

    if (articles.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun article avec URL Netlify proxy'
      });
    }

    // Extraire l'URL originale des vieilles URLs proxy
    const cleanedArticles = articles.map(article => {
      let originalUrl = null;

      if (article.image_url && article.image_url.includes('url=')) {
        try {
          const urlParam = article.image_url.split('url=')[1]?.split('&')[0];
          originalUrl = decodeURIComponent(urlParam);
        } catch (e) {
          // Ignorer les erreurs de décodage
        }
      }

      return {
        ...article,
        cleanedUrl: originalUrl
      };
    });

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        preview: cleanedArticles.slice(0, 10).map(a => ({
          id: a.id,
          oldUrl: a.image_url?.substring(0, 100) + '...',
          newUrl: a.cleanedUrl
        }))
      });
    }

    // Mettre à jour les articles
    let updatedCount = 0;
    let reExtractedCount = 0;

    for (const article of cleanedArticles) {
      let newImageUrl = article.cleanedUrl;

      // Si l'URL extraite n'est pas valide, re-extraire depuis la source
      if (!newImageUrl && article.url) {
        const result = await imageExtractor.extractImage(article.url, {
          category: article.category,
          source: article.source
        });
        newImageUrl = result.imageUrl;
        if (newImageUrl) reExtractedCount++;
      }

      if (newImageUrl) {
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({
            image_url: newImageUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);

        if (!updateError) updatedCount++;
      }
    }

    res.json({
      success: true,
      stats: {
        total: articles.length,
        updated: updatedCount,
        reExtracted: reExtractedCount
      }
    });

  } catch (error) {
    console.error('❌ Erreur cleanup-netlify:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
