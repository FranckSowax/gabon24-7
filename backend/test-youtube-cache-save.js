#!/usr/bin/env node

/**
 * 🧪 TEST SAUVEGARDE YOUTUBE CACHE
 * Vérifie que le journal du 22 octobre est bien sauvegardé
 */

const supabaseService = require('./supabase-config');

async function testYouTubeCacheSave() {
  console.log('\n🧪 === TEST SAUVEGARDE YOUTUBE CACHE ===\n');
  
  try {
    // Données du journal du 22 octobre
    const cacheData = {
      video_id: 'kBRe3dY3FUc',
      title: 'Journal Télévisé de 20h du 22 octobre 2025.',
      url: 'https://www.youtube.com/watch?v=kBRe3dY3FUc',
      thumbnail: 'https://i.ytimg.com/vi/kBRe3dY3FUc/maxresdefault.jpg',
      published_at: new Date('2025-10-22T19:01:05Z').toISOString(),
      extracted_at: new Date().toISOString(),
      is_active: true
    };
    
    console.log('📝 Données à sauvegarder:');
    console.log(JSON.stringify(cacheData, null, 2));
    
    console.log('\n💾 Sauvegarde dans youtube_cache...');
    
    // Upsert dans youtube_cache
    const { data, error } = await supabaseService.supabase
      .from('youtube_cache')
      .upsert(cacheData, { 
        onConflict: 'video_id',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error('❌ Erreur sauvegarde:', error.message);
      console.error('Détails:', error);
      process.exit(1);
    }
    
    console.log('✅ Sauvegarde réussie !');
    console.log('Données sauvegardées:', data);
    
    // Vérification
    console.log('\n🔍 Vérification...');
    const { data: verification, error: verifyError } = await supabaseService.supabase
      .from('youtube_cache')
      .select('*')
      .eq('video_id', 'kBRe3dY3FUc')
      .single();
    
    if (verifyError) {
      console.error('❌ Erreur vérification:', verifyError.message);
      process.exit(1);
    }
    
    console.log('✅ Journal trouvé dans la base:');
    console.log(`   Titre: ${verification.title}`);
    console.log(`   Date publication: ${verification.published_at}`);
    console.log(`   Date extraction: ${verification.extracted_at}`);
    console.log(`   Actif: ${verification.is_active}`);
    
    console.log('\n🎉 TEST RÉUSSI !\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testYouTubeCacheSave();
