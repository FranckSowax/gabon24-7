#!/usr/bin/env node
/**
 * Script de correction des images de reels Facebook
 * Remplace les images Unsplash fallback par les vraies vignettes
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');
const { imageExtractor } = require('../services/image-extractor');
const supabase = supabaseService.supabase;

async function main() {
  console.log('🎬 Correction des vignettes de reels Facebook\n');

  // Trouver les reels avec image Unsplash (fallback)
  const { data: reels, error } = await supabase
    .from('articles')
    .select('id, title, url, image_url')
    .ilike('url', '%facebook.com/reel%')
    .ilike('image_url', '%unsplash%')
    .limit(50);

  if (error) {
    console.error('Erreur:', error.message);
    return;
  }

  if (!reels || reels.length === 0) {
    console.log('✅ Aucun reel avec image Unsplash à corriger');
    return;
  }

  console.log(`🔧 ${reels.length} reels avec images Unsplash à corriger\n`);

  let fixed = 0;
  for (const reel of reels) {
    console.log(`📹 ${reel.title?.substring(0, 50)}...`);

    try {
      const result = await imageExtractor.extractImage(reel.url, { source: 'Gabon 24' });

      if (result.imageUrl && !result.imageUrl.includes('unsplash')) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ image_url: result.imageUrl, updated_at: new Date().toISOString() })
          .eq('id', reel.id);

        if (!updateError) {
          console.log(`   ✅ Corrigé: ${result.imageUrl.substring(0, 60)}...`);
          fixed++;
        }
      } else {
        console.log(`   ⚠️ Impossible de trouver une vraie vignette`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
    }
  }

  console.log(`\n📊 Résultat: ${fixed}/${reels.length} reels corrigés`);
}

main().catch(console.error);
