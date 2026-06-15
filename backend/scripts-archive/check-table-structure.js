const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function checkTableStructure() {
  console.log('🔍 VÉRIFICATION STRUCTURE TABLE rss_feeds\n');

  // Récupérer 1 flux pour voir les colonnes
  const { data, error } = await supabase
    .from('rss_feeds')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('📋 Colonnes disponibles:\n');
    const columns = Object.keys(data[0]);
    columns.forEach((col, i) => {
      console.log(`${i + 1}. ${col} = ${data[0][col]}`);
    });
  }
}

checkTableStructure().catch(console.error);
