#!/usr/bin/env node

console.log('🧪 TEST INSERTION ARTICLE SIMPLE\n');

const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function testInsert() {
  try {
    console.log('1️⃣ Création article de test...');
    
    const testArticle = {
      external_id: 'test-' + Date.now(),
      title: 'Article de test - ' + new Date().toLocaleString(),
      content: 'Contenu de test pour vérifier l\'insertion',
      summary: 'Résumé de test',
      url: 'https://example.com/test-' + Date.now(),
      normalized_url: 'https://example.com/test-normalized',
      image_url: 'https://example.com/image.jpg',
      author: 'Test Author',
      source: 'Test Source',
      feed_id: null,
      published_at: new Date().toISOString(),
      read_time_minutes: 3,
      view_count: 0,
      share_count: 0,
      is_published: true,
      // Nouveaux noms de colonnes
      summary_ai: 'Résumé IA de test',
      category: 'Test',
      sentiment_score: 0.5,
      importance: 5,
      is_breaking: false,
      keywords: ['test', 'insertion'],
      enrichment_status: 'completed',
      enriched_at: new Date().toISOString()
    };

    console.log('2️⃣ Insertion dans Supabase...\n');
    
    const { data, error } = await supabase
      .from('articles')
      .insert([testArticle])
      .select();

    if (error) {
      console.error('❌ ERREUR INSERTION:');
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return;
    }

    console.log('✅ INSERTION RÉUSSIE !');
    console.log('📝 Article créé:', data[0].id);
    console.log('📰 Titre:', data[0].title);
    console.log('📍 Source:', data[0].source);
    
    // Nettoyage
    console.log('\n3️⃣ Nettoyage...');
    await supabase
      .from('articles')
      .delete()
      .eq('id', data[0].id);
    
    console.log('✅ Article de test supprimé\n');
    console.log('🎉 TEST RÉUSSI - L\'insertion fonctionne !\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testInsert();
