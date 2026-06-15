const supabaseService = require('./supabase-config');

async function checkTrafficRoutes() {
  try {
    console.log('📍 Vérification des routes de trafic dans Supabase...\n');
    
    const { data: routes, error } = await supabaseService.supabase
      .from('traffic_routes')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    console.log(`\n✅ Total: ${routes.length} route(s) trouvée(s)\n`);
    console.log('='.repeat(100));
    
    routes.forEach((route, index) => {
      console.log(`\n[${index + 1}] ID: ${route.id} | Ordre: ${route.display_order} | Active: ${route.is_active ? '✓' : '✗'}`);
      console.log(`    Titre: ${route.title}`);
      console.log(`    Sous-titre: ${route.subtitle || 'Non défini'}`);
      console.log(`    Catégorie: ${route.category || 'Non défini'}`);
      console.log(`    URL embed: ${route.embed_url ? route.embed_url.substring(0, 80) + '...' : 'Non définie'}`);
      console.log(`    Créé le: ${route.created_at ? new Date(route.created_at).toLocaleString('fr-FR') : 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(100));
    
    // Analyser les problèmes potentiels
    console.log('\n🔍 Analyse des problèmes potentiels:\n');
    
    const activeRoutes = routes.filter(r => r.is_active);
    console.log(`   Routes actives: ${activeRoutes.length}/${routes.length}`);
    
    const morningRoutes = routes.filter(r => r.category === 'morning');
    const eveningRoutes = routes.filter(r => r.category === 'evening');
    const noCategory = routes.filter(r => !r.category);
    
    console.log(`   Catégorie "morning": ${morningRoutes.length}`);
    console.log(`   Catégorie "evening": ${eveningRoutes.length}`);
    console.log(`   Sans catégorie: ${noCategory.length}`);
    
    const missingSubtitle = routes.filter(r => !r.subtitle);
    if (missingSubtitle.length > 0) {
      console.log(`\n   ⚠️  ${missingSubtitle.length} route(s) sans sous-titre`);
    }
    
    const missingEmbedUrl = routes.filter(r => !r.embed_url && !r.html_content);
    if (missingEmbedUrl.length > 0) {
      console.log(`   ⚠️  ${missingEmbedUrl.length} route(s) sans URL embed ni contenu HTML`);
    }
    
    // Vérifier si les titres correspondent aux catégories
    console.log('\n📋 Correspondance titres/catégories:\n');
    morningRoutes.forEach(r => {
      console.log(`   🌅 [Matinée] ${r.title}`);
    });
    eveningRoutes.forEach(r => {
      console.log(`   🌙 [Soir] ${r.title}`);
    });
    noCategory.forEach(r => {
      console.log(`   ❓ [Aucune] ${r.title}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

checkTrafficRoutes();
