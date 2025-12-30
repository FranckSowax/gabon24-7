#!/usr/bin/env node
/**
 * 🖼️ SCRIPT DE CORRECTION DES IMAGES D'ARTICLES
 *
 * Ce script:
 * 1. Nettoie les vieilles URLs Netlify proxy
 * 2. Extrait les images pour les articles qui en manquent
 * 3. Met à jour la base de données
 *
 * Usage:
 *   node scripts/fix-article-images.js [options]
 *
 * Options:
 *   --dry-run    Mode test sans modification
 *   --limit=N    Limiter à N articles (défaut: 100)
 *   --clean      Nettoyer les URLs Netlify uniquement
 *   --extract    Extraire les images uniquement
 *
 * @author Claude Code
 * @date 2025-12-30
 */

require('dotenv').config();
const { imageExtractor } = require('../services/image-extractor');
const supabaseService = require('../supabase-config');

// Configuration depuis les arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cleanOnly = args.includes('--clean');
const extractOnly = args.includes('--extract');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;

const supabase = supabaseService.supabase;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🖼️  CORRECTION DES IMAGES D\'ARTICLES                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Mode: ${dryRun ? 'DRY-RUN (aucune modification)' : 'PRODUCTION (modifications actives)'}`.padEnd(65) + '║');
  console.log(`║  Limite: ${limit} articles`.padEnd(65) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Phase 1: Statistiques initiales
  console.log('📊 Phase 1: Analyse des statistiques...\n');

  const stats = await getStats();
  console.log(`   Total articles:          ${stats.total}`);
  console.log(`   Avec image:              ${stats.withImage} (${percent(stats.withImage, stats.total)})`);
  console.log(`   Sans image:              ${stats.withoutImage} (${percent(stats.withoutImage, stats.total)})`);
  console.log(`   URLs Netlify proxy:      ${stats.netlifyProxy}`);
  console.log(`   Images Unsplash:         ${stats.unsplash}\n`);

  // Phase 2: Nettoyage URLs Netlify
  if (!extractOnly) {
    console.log('🧹 Phase 2: Nettoyage des URLs Netlify proxy...\n');

    const { data: netlifyArticles, error: netlifyError } = await supabase
      .from('articles')
      .select('id, url, image_url, category, source, title')
      .ilike('image_url', '%/.netlify/functions/image-proxy%')
      .limit(limit);

    if (netlifyError) {
      console.error('❌ Erreur récupération articles Netlify:', netlifyError.message);
    } else if (netlifyArticles.length === 0) {
      console.log('   ✅ Aucune URL Netlify à nettoyer\n');
    } else {
      console.log(`   📦 ${netlifyArticles.length} articles avec URLs Netlify trouvés\n`);

      let cleaned = 0;
      let reExtracted = 0;

      for (const article of netlifyArticles) {
        // Extraire l'URL originale
        let cleanedUrl = null;
        if (article.image_url && article.image_url.includes('url=')) {
          try {
            const urlParam = article.image_url.split('url=')[1]?.split('&')[0];
            cleanedUrl = decodeURIComponent(urlParam);
          } catch (e) {
            // Ignorer
          }
        }

        // Si pas d'URL extraite, re-extraire depuis la source
        if (!cleanedUrl && article.url) {
          const result = await imageExtractor.extractImage(article.url, {
            category: article.category,
            source: article.source
          });
          cleanedUrl = result.imageUrl;
          if (cleanedUrl) reExtracted++;
        }

        if (cleanedUrl) {
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('articles')
              .update({
                image_url: cleanedUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', article.id);

            if (!updateError) cleaned++;
          } else {
            cleaned++;
          }
          console.log(`   ✅ ${article.title?.substring(0, 50)}...`);
        }
      }

      console.log(`\n   📈 Résultat nettoyage:`);
      console.log(`      - Nettoyés: ${cleaned}`);
      console.log(`      - Re-extraits: ${reExtracted}\n`);
    }
  }

  // Phase 3: Extraction pour articles sans images
  if (!cleanOnly) {
    console.log('🔍 Phase 3: Extraction d\'images pour articles sans image...\n');

    const { data: missingArticles, error: missingError } = await supabase
      .from('articles')
      .select('id, url, category, source, title')
      .or('image_url.is.null,image_url.eq.')
      .not('url', 'is', null)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (missingError) {
      console.error('❌ Erreur récupération articles sans image:', missingError.message);
    } else if (missingArticles.length === 0) {
      console.log('   ✅ Tous les articles ont des images\n');
    } else {
      console.log(`   📦 ${missingArticles.length} articles sans image trouvés\n`);

      const results = await imageExtractor.extractBatch(missingArticles, {
        concurrency: 3,
        onProgress: (progress) => {
          process.stdout.write(`\r   ⏳ Progression: ${progress.percentage}% (${progress.processed}/${progress.total})`);
        }
      });

      console.log('\n');

      // Mise à jour en base
      let updated = 0;
      let failed = 0;

      for (const result of results) {
        if (result.imageUrl && result.articleId) {
          if (!dryRun) {
            const { error: updateError } = await supabase
              .from('articles')
              .update({
                image_url: result.imageUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', result.articleId);

            if (!updateError) updated++;
            else failed++;
          } else {
            updated++;
          }
        } else {
          failed++;
        }
      }

      console.log(`   📈 Résultat extraction:`);
      console.log(`      - Images trouvées: ${results.filter(r => r.imageUrl).length}`);
      console.log(`      - Mis à jour: ${updated}`);
      console.log(`      - Échecs: ${failed}\n`);

      // Afficher les stratégies utilisées
      const strategies = {};
      results.filter(r => r.strategy).forEach(r => {
        strategies[r.strategy] = (strategies[r.strategy] || 0) + 1;
      });

      console.log('   🎯 Stratégies utilisées:');
      Object.entries(strategies).sort((a, b) => b[1] - a[1]).forEach(([strategy, count]) => {
        console.log(`      - ${strategy}: ${count}`);
      });
      console.log('');
    }
  }

  // Phase 4: Statistiques finales
  console.log('📊 Phase 4: Statistiques finales...\n');

  const finalStats = await getStats();
  console.log(`   Total articles:          ${finalStats.total}`);
  console.log(`   Avec image:              ${finalStats.withImage} (${percent(finalStats.withImage, finalStats.total)})`);
  console.log(`   Sans image:              ${finalStats.withoutImage} (${percent(finalStats.withoutImage, finalStats.total)})`);
  console.log(`   URLs Netlify proxy:      ${finalStats.netlifyProxy}`);

  // Comparaison
  if (!dryRun) {
    const improvement = finalStats.withImage - stats.withImage;
    if (improvement > 0) {
      console.log(`\n   🎉 Amélioration: +${improvement} articles avec images`);
    }
  }

  console.log('\n✅ Script terminé!\n');
}

async function getStats() {
  const { count: total } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });

  const { count: withImage } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .not('image_url', 'is', null)
    .neq('image_url', '');

  const { count: withoutImage } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .or('image_url.is.null,image_url.eq.');

  const { count: netlifyProxy } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .ilike('image_url', '%/.netlify/functions/%');

  const { count: unsplash } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .ilike('image_url', '%unsplash.com%');

  return { total, withImage, withoutImage, netlifyProxy, unsplash };
}

function percent(part, total) {
  if (!total) return '0%';
  return Math.round((part / total) * 100) + '%';
}

// Exécution
main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
