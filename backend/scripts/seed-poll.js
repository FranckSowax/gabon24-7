require('dotenv').config();
const supabaseService = require('../supabase-config');

async function seedPoll() {
  console.log('🌱 Seeding test poll...');
  
  // Désactiver les autres sondages d'abord
  await supabaseService.supabase
    .from('polls')
    .update({ is_active: false })
    .eq('is_active', true);

  const { data, error } = await supabaseService.supabase.from('polls').insert({
    question: 'Que pensez-vous de l\'intégration de l\'IA dans Gabon 24/7 ?',
    poll_type: 'mcq',
    options: ['Excellente initiative', 'Intéressant mais à suivre', 'Pas d\'avis'],
    is_active: true,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 jours
    created_at: new Date().toISOString(),
    status: 'published'
  }).select();
  
  if (error) {
    console.error('❌ Error seeding poll:', error);
  } else {
    console.log('✅ Poll seeded successfully:', data);
  }
}

seedPoll();
