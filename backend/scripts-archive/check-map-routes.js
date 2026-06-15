const supabaseService = require('./supabase-config');

async function checkMapRoutes() {
  try {
    console.log('📍 Vérification de la table map_routes...\n');
    
    const { data: routes, error } = await supabaseService.supabase
      .from('map_routes')
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
      if (route.embed_url) {
        console.log(`    URL embed: ${route.embed_url.substring(0, 80)}...`);
      }
      if (route.html_content) {
        console.log(`    HTML content: ${route.html_content.substring(0, 80)}...`);
      }
      console.log(`    Créé le: ${route.created_at ? new Date(route.created_at).toLocaleString('fr-FR') : 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(100));
    
    // Analyser les problèmes potentiels
    console.log('\n🔍 Analyse:\n');
    
    const activeRoutes = routes.filter(r => r.is_active);
    console.log(`   Routes actives: ${activeRoutes.length}/${routes.length}`);
    
    const morningRoutes = routes.filter(r => r.category === 'morning');
    const eveningRoutes = routes.filter(r => r.category === 'evening');
    const noCategory = routes.filter(r => !r.category);
    
    console.log(`\n📋 Par catégorie:`);
    console.log(`   🌅 Matinée (morning): ${morningRoutes.length}`);
    console.log(`   🌙 Soir (evening): ${eveningRoutes.length}`);
    console.log(`   ❓ Sans catégorie: ${noCategory.length}`);
    
    console.log('\n📋 Détail des routes par catégorie:\n');
    if (morningRoutes.length > 0) {
      console.log('   🌅 MATINÉE → LIBREVILLE:');
      morningRoutes.forEach(r => {
        console.log(`      - ${r.title} (${r.subtitle})`);
      });
    }
    
    if (eveningRoutes.length > 0) {
      console.log('\n   🌙 SOIR → RETOUR:');
      eveningRoutes.forEach(r => {
        console.log(`      - ${r.title} (${r.subtitle})`);
      });
    }
    
    if (noCategory.length > 0) {
      console.log('\n   ❓ SANS CATÉGORIE:');
      noCategory.forEach(r => {
        console.log(`      - ${r.title} (${r.subtitle})`);
      });
    }
    
    // Vérifier les incohérences
    console.log('\n⚠️  Problèmes potentiels:\n');
    
    morningRoutes.forEach(r => {
      if (r.title.toLowerCase().includes('centre-ville') && 
          r.title.split('→')[0].trim().toLowerCase().includes('centre-ville')) {
        console.log(`   ⚠️  Route matinale inversée? "${r.title}" devrait partir DE la banlieue VERS Libreville`);
      }
    });
    
    eveningRoutes.forEach(r => {
      if (r.title.toLowerCase().includes('centre-ville') && 
          r.title.split('→')[1]?.trim().toLowerCase().includes('centre-ville')) {
        console.log(`   ⚠️  Route soir inversée? "${r.title}" devrait partir DE Libreville VERS la banlieue`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

checkMapRoutes();
