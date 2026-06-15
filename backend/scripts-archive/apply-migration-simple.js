/**
 * Script simple pour appliquer la migration des colonnes
 */

const supabaseService = require('./supabase-config');

async function applyMigration() {
  console.log('\n🚀 APPLICATION DE LA MIGRATION\n');

  try {
    // 1. Ajouter ai_keywords
    console.log('1️⃣  Ajout colonne ai_keywords...');
    await supabaseService.supabase.rpc('exec_sql', {
      query: 'ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_keywords TEXT[]'
    });
    console.log('   ✅ OK\n');

    // 2. Ajouter normalized_url
    console.log('2️⃣  Ajout colonne normalized_url...');
    await supabaseService.supabase.rpc('exec_sql', {
      query: 'ALTER TABLE articles ADD COLUMN IF NOT EXISTS normalized_url TEXT'
    });
    console.log('   ✅ OK\n');

    // 3. Ajouter source
    console.log('3️⃣  Ajout colonne source...');
    await supabaseService.supabase.rpc('exec_sql', {
      query: 'ALTER TABLE articles ADD COLUMN IF NOT EXISTS source VARCHAR(255)'
    });
    console.log('   ✅ OK\n');

    // 4. Migrer category vers ai_category
    console.log('4️⃣  Migration category → ai_category...');
    const { data: migrated1 } = await supabaseService.supabase.rpc('exec_sql', {
      query: `UPDATE articles SET ai_category = category WHERE ai_category IS NULL AND category IS NOT NULL`
    });
    console.log('   ✅ OK\n');

    // 5. Migrer keywords vers ai_keywords
    console.log('5️⃣  Migration keywords → ai_keywords...');
    const { data: migrated2 } = await supabaseService.supabase.rpc('exec_sql', {
      query: `UPDATE articles SET ai_keywords = keywords WHERE ai_keywords IS NULL AND keywords IS NOT NULL`
    });
    console.log('   ✅ OK\n');

    // 6. Migrer image_urls vers image_url
    console.log('6️⃣  Migration image_urls → image_url...');
    const { data: migrated3 } = await supabaseService.supabase.rpc('exec_sql', {
      query: `UPDATE articles SET image_url = image_urls[1] WHERE image_url IS NULL AND image_urls IS NOT NULL`
    });
    console.log('   ✅ OK\n');

    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS!\n');

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.log('\n⚠️  La fonction RPC exec_sql n\'existe peut-être pas.');
    console.log('📝 Veuillez exécuter le SQL manuellement via l\'interface Supabase:\n');
    console.log('   Dashboard → SQL Editor → Copier/Coller le fichier:');
    console.log('   backend/migrations/cleanup_duplicate_columns.sql\n');
  }
}

applyMigration();
