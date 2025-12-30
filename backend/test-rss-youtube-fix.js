#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE TEST - RSS AGGREGATOR & YOUTUBE WIDGET
 * 
 * Vérifie que les corrections apportées fonctionnent correctement
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gzjjkqmgvqfmqjbvnfmv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amprcW1ndnFmbXFqYnZuZm12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTkzNTQ0NCwiZXhwIjoyMDUxNTExNDQ0fQ.2wJYsuuogjO_3fKOQeHNdLJjXJYNdVkWRDUBCGhAoQs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testYouTubeCache() {
  console.log('\n📺 TEST 1: Vérification du cache YouTube\n');
  console.log('='.repeat(80));
  
  try {
    const { data: videos, error } = await supabase
      .from('youtube_cache')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return false;
    }
    
    if (!videos || videos.length === 0) {
      console.log('⚠️  Aucune vidéo dans le cache');
      return false;
    }
    
    console.log(`✅ ${videos.length} vidéos trouvées dans youtube_cache\n`);
    
    videos.forEach((video, index) => {
      const pubDate = new Date(video.published_at);
      console.log(`${index + 1}. ${pubDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })} | ${video.title.substring(0, 60)}...`);
    });
    
    console.log('\n' + '='.repeat(80));
    return true;
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
    return false;
  }
}

async function testYouTubeAPI() {
  console.log('\n📡 TEST 2: API YouTube (/api/youtube)\n');
  console.log('='.repeat(80));
  
  try {
    const response = await axios.get(`${API_URL}/api/youtube`, {
      timeout: 10000
    });
    
    if (!response.data || response.data.length === 0) {
      console.log('⚠️  Aucune vidéo retournée par l\'API');
      return false;
    }
    
    console.log(`✅ ${response.data.length} vidéos retournées par l'API\n`);
    
    const video = response.data[0];
    console.log('📺 Dernière vidéo:');
    console.log(`   Titre: ${video.title}`);
    console.log(`   ID: ${video.id}`);
    console.log(`   URL: ${video.url}`);
    console.log(`   Publié: ${new Date(video.publishedAt).toLocaleString('fr-FR')}`);
    console.log(`   Thumbnail: ${video.thumbnail ? '✅' : '❌'}`);
    
    console.log('\n' + '='.repeat(80));
    return true;
  } catch (error) {
    console.error('❌ Erreur API:', error.message);
    return false;
  }
}

async function testRSSAggregator() {
  console.log('\n📰 TEST 3: RSS Aggregator Stats\n');
  console.log('='.repeat(80));
  
  try {
    const response = await axios.get(`${API_URL}/api/rss/stats`, {
      timeout: 5000
    });
    
    if (!response.data || !response.data.success) {
      console.log('⚠️  Erreur récupération stats RSS');
      return false;
    }
    
    const stats = response.data.stats;
    console.log('✅ Statistiques RSS Aggregator:\n');
    console.log(`   En cours: ${stats.isProcessing ? 'Oui' : 'Non'}`);
    console.log(`   Dernière MAJ: ${stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('fr-FR') : 'Jamais'}`);
    console.log(`   URL flux: ${stats.feedUrl}`);
    console.log(`   Intervalle: ${stats.interval}`);
    
    console.log('\n' + '='.repeat(80));
    return true;
  } catch (error) {
    console.error('❌ Erreur stats RSS:', error.message);
    return false;
  }
}

async function testRecentArticles() {
  console.log('\n📄 TEST 4: Articles récents dans Supabase\n');
  console.log('='.repeat(80));
  
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, source, published_at, image_urls')
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return false;
    }
    
    if (!articles || articles.length === 0) {
      console.log('⚠️  Aucun article trouvé');
      return false;
    }
    
    console.log(`✅ ${articles.length} articles récents trouvés\n`);
    
    articles.forEach((article, index) => {
      const pubDate = new Date(article.published_at);
      const hasImage = article.image_urls && article.image_urls.length > 0;
      console.log(`${index + 1}. ${pubDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })} | ${hasImage ? '🖼️' : '❌'} | [${article.source}] ${article.title.substring(0, 50)}...`);
    });
    
    console.log('\n' + '='.repeat(80));
    return true;
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 TESTS RSS AGGREGATOR & YOUTUBE WIDGET');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('='.repeat(80));
  
  const results = {
    youtubeCache: await testYouTubeCache(),
    youtubeAPI: await testYouTubeAPI(),
    rssAggregator: await testRSSAggregator(),
    recentArticles: await testRecentArticles()
  };
  
  console.log('\n📊 RÉSULTATS FINAUX\n');
  console.log('='.repeat(80));
  console.log(`YouTube Cache:      ${results.youtubeCache ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`YouTube API:        ${results.youtubeAPI ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`RSS Aggregator:     ${results.rssAggregator ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Articles récents:   ${results.recentArticles ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(80));
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n');
    process.exit(1);
  }
}

// Exécuter les tests
runAllTests().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
