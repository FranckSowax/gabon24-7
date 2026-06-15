const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis le fichier .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Configuration Supabase:');
console.log('URL:', supabaseUrl ? '✓ Définie' : '✗ Manquante');
console.log('Key:', supabaseKey ? '✓ Définie' : '✗ Manquante');
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoutes() {
  try {
    console.log('📍 Récupération des routes de trafic...\n');
    
    const { data: routes, error } = await supabase
      .from('traffic_routes')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    if (!routes || routes.length === 0) {
      console.log('⚠️  Aucune route trouvée dans la base de données');
      console.log('');
      console.log('💡 Voulez-vous que je crée des routes de démonstration ?');
      return;
    }
    
    console.log(`✅ ${routes.length} route(s) trouvée(s):\n`);
    console.log('='.repeat(80));
    
    routes.forEach((route, index) => {
      console.log(`\n[${index + 1}] Route ID: ${route.id}`);
      console.log(`    Ordre d'affichage: ${route.display_order}`);
      console.log(`    Titre: ${route.title}`);
      console.log(`    Sous-titre: ${route.subtitle || 'Non défini'}`);
      console.log(`    Catégorie: ${route.category || 'Non défini'}`);
      console.log(`    Active: ${route.is_active ? 'Oui' : 'Non'}`);
      console.log(`    URL embed: ${route.embed_url ? 'Définie' : 'Non définie'}`);
      console.log(`    HTML content: ${route.html_content ? 'Défini' : 'Non défini'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

checkRoutes();
