#!/usr/bin/env node
/**
 * Script de test pour valider le tracking des slides
 * Teste les fonctions RPC Supabase: increment_slide_views, increment_slide_clicks, etc.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSlideTracking() {
  console.log('🧪 Test du système de tracking des slides\n');

  try {
    // 1. Récupérer un slide existant (ou en créer un pour le test)
    console.log('📋 Étape 1: Récupération d\'un slide de test...');
    let { data: slides, error: fetchError } = await supabase
      .from('promotional_slides')
      .select('id, title, view_count, click_count')
      .limit(1);

    if (fetchError) throw fetchError;

    let testSlideId;
    let initialStats = { views: 0, clicks: 0, impressions: 0 };

    if (!slides || slides.length === 0) {
      console.log('   ⚠️  Aucun slide trouvé, création d\'un slide de test...');
      
      const { data: newSlide, error: createError } = await supabase
        .from('promotional_slides')
        .insert({
          title: 'Test Slide - Tracking',
          description: 'Slide créé pour tester le tracking',
          image_url: 'https://via.placeholder.com/800x400',
          link_url: 'https://example.com',
          is_active: false, // Inactif pour ne pas affecter la prod
          view_count: 0,
          click_count: 0
        })
        .select()
        .single();

      if (createError) throw createError;
      testSlideId = newSlide.id;
      console.log(`   ✅ Slide de test créé: ${testSlideId}`);
    } else {
      testSlideId = slides[0].id;
      initialStats = {
        views: slides[0].view_count || 0,
        clicks: slides[0].click_count || 0,
        impressions: 0 // Sera compté depuis slide_analytics
      };
      console.log(`   ✅ Slide existant utilisé: ${testSlideId}`);
    }

    console.log(`   📊 Stats initiales:`, initialStats);

    // 2. Tester increment_slide_views
    console.log('\n📋 Étape 2: Test increment_slide_views...');
    const { error: viewError } = await supabase.rpc('increment_slide_views', {
      slide_uuid: testSlideId
    });

    if (viewError) throw viewError;
    console.log('   ✅ Vue incrémentée');

    // 3. Tester increment_slide_clicks
    console.log('\n📋 Étape 3: Test increment_slide_clicks...');
    const { error: clickError } = await supabase.rpc('increment_slide_clicks', {
      slide_uuid: testSlideId
    });

    if (clickError) throw clickError;
    console.log('   ✅ Clic incrémenté');

    // 4. Tester increment_slide_impressions
    console.log('\n📋 Étape 4: Test increment_slide_impressions...');
    const { error: impressionError } = await supabase.rpc('increment_slide_impressions', {
      slide_uuid: testSlideId
    });

    if (impressionError) throw impressionError;
    console.log('   ✅ Impression incrémentée');

    // 5. Vérifier les stats avec get_slide_stats
    console.log('\n📋 Étape 5: Vérification des stats avec get_slide_stats...');
    const { data: stats, error: statsError } = await supabase.rpc('get_slide_stats', {
      slide_uuid: testSlideId
    });

    if (statsError) throw statsError;

    console.log('   📊 Stats après incrémentation:');
    console.log(`      Views:       ${stats[0].views} (attendu: ${initialStats.views + 1})`);
    console.log(`      Clicks:      ${stats[0].clicks} (attendu: ${initialStats.clicks + 1})`);
    console.log(`      Impressions: ${stats[0].impressions} (attendu: ${initialStats.impressions + 1})`);
    console.log(`      CTR:         ${stats[0].ctr}%`);

    // 6. Vérifier que les données correspondent
    const expectedViews = initialStats.views + 1;
    const expectedClicks = initialStats.clicks + 1;
    const expectedImpressions = initialStats.impressions + 1;

    const viewsMatch = parseInt(stats[0].views) === expectedViews;
    const clicksMatch = parseInt(stats[0].clicks) === expectedClicks;
    const impressionsMatch = parseInt(stats[0].impressions) === expectedImpressions;

    console.log('\n📋 Étape 6: Validation des résultats...');
    console.log(`   Views:       ${viewsMatch ? '✅' : '❌'} ${viewsMatch ? 'OK' : 'ERREUR'}`);
    console.log(`   Clicks:      ${clicksMatch ? '✅' : '❌'} ${clicksMatch ? 'OK' : 'ERREUR'}`);
    console.log(`   Impressions: ${impressionsMatch ? '✅' : '❌'} ${impressionsMatch ? 'OK' : 'ERREUR'}`);

    // 7. Vérifier que les événements sont enregistrés dans slide_analytics
    console.log('\n📋 Étape 7: Vérification des événements dans slide_analytics...');
    const { data: analytics, error: analyticsError } = await supabase
      .from('slide_analytics')
      .select('event_type, created_at')
      .eq('slide_id', testSlideId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (analyticsError) throw analyticsError;

    console.log(`   📊 ${analytics.length} événements récents enregistrés:`);
    analytics.forEach(event => {
      console.log(`      - ${event.event_type} (${new Date(event.created_at).toLocaleTimeString()})`);
    });

    // Résultat final
    console.log('\n' + '='.repeat(60));
    if (viewsMatch && clicksMatch && impressionsMatch && analytics.length >= 3) {
      console.log('✅ TOUS LES TESTS RÉUSSIS !');
      console.log('   Les fonctions RPC Supabase fonctionnent correctement.');
    } else {
      console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
      console.log('   Vérifiez les logs ci-dessus pour plus de détails.');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erreur durant les tests:', error.message);
    console.error('   Détails:', error);
    process.exit(1);
  }
}

// Exécuter les tests
testSlideTracking();
