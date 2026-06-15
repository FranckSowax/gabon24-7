const supabaseService = require('./supabase-config');

async function check() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const { data, error } = await supabaseService.supabase
    .from('articles')
    .select('id, title, created_at, ai_category')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erreur:', error);
    return;
  }
  
  const notEnriched = data.filter(a => !a.ai_category);
  
  console.log('\n📊 ARTICLES DE LA DERNIÈRE HEURE:');
  console.log('='.repeat(80));
  console.log('   Total articles:', data.length);
  console.log('   ✅ Avec enrichissement IA:', data.length - notEnriched.length);
  console.log('   ❌ Sans enrichissement IA:', notEnriched.length);
  
  if (notEnriched.length > 0) {
    console.log('\n❌ ARTICLES NON ENRICHIS:');
    notEnriched.forEach((a, i) => {
      console.log(`   ${i+1}. "${a.title.substring(0, 70)}..." (${a.created_at})`);
    });
  } else {
    console.log('\n✅ Tous les articles récents sont enrichis !');
  }
  console.log('');
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
