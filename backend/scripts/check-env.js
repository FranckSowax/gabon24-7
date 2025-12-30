/**
 * Vérifier les variables d'environnement
 */

require('dotenv').config({ path: __dirname + '/../.env' });

console.log('\n🔍 VÉRIFICATION DES VARIABLES D\'ENVIRONNEMENT\n');
console.log('='.repeat(60));

const vars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Définie' : '❌ Manquante',
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Définie' : '❌ Manquante',
};

for (const [key, value] of Object.entries(vars)) {
  console.log(`${key}: ${value}`);
}

console.log('='.repeat(60));

// Test connexion Supabase
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\n🧪 Test connexion Supabase...\n');
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Erreur Supabase:', error.message);
      } else {
        console.log(`✅ Connexion Supabase OK - ${count} articles trouvés`);
      }
    })
    .catch((err) => {
      console.error('❌ Erreur connexion:', err.message);
    });
} else {
  console.log('\n❌ Variables Supabase manquantes');
}
