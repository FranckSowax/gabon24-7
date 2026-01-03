/**
 * Script pour créer les sessions de jeu payantes dans Supabase
 * Usage: node scripts/create-paid-game-sessions.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PAID_SESSIONS = [
  {
    session_type: 'midi-express',
    name: 'Midi Express',
    entry_fee: 500,
    max_players: null,
    status: 'waiting',
    game_mode: 'hourly',
    scheduled_hour: 12,
    min_prize: 10000
  },
  {
    session_type: 'after-work',
    name: 'After Work',
    entry_fee: 1000,
    max_players: null,
    status: 'waiting',
    game_mode: 'hourly',
    scheduled_hour: 18,
    min_prize: 25000
  },
  {
    session_type: 'prime-time',
    name: 'Prime Time',
    entry_fee: 2000,
    max_players: null,
    status: 'waiting',
    game_mode: 'hourly',
    scheduled_hour: 20,
    min_prize: 25000
  },
  {
    session_type: 'night-owl',
    name: 'Night Owl',
    entry_fee: 5000,
    max_players: null,
    status: 'waiting',
    game_mode: 'hourly',
    scheduled_hour: 22,
    min_prize: 50000
  }
];

async function createPaidSessions() {
  console.log('🎮 Création des sessions de jeu payantes...\n');

  for (const session of PAID_SESSIONS) {
    try {
      // Vérifier si la session existe déjà
      const { data: existing } = await supabase
        .from('game_sessions')
        .select('id, session_type, name, status')
        .eq('session_type', session.session_type)
        .eq('status', 'waiting')
        .single();

      if (existing) {
        console.log(`⏭️  ${session.name} existe déjà (ID: ${existing.id})`);
        continue;
      }

      // Créer la session
      const { data, error } = await supabase
        .from('game_sessions')
        .insert(session)
        .select()
        .single();

      if (error) {
        console.error(`❌ Erreur création ${session.name}:`, error.message);
        continue;
      }

      console.log(`✅ ${session.name} créée`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Type: ${data.session_type}`);
      console.log(`   Frais: ${data.entry_fee} FCFA`);
      console.log(`   Heure: ${data.scheduled_hour}h00`);
      console.log(`   Prix min: ${data.min_prize} FCFA\n`);

    } catch (err) {
      console.error(`❌ Exception ${session.name}:`, err.message);
    }
  }

  // Afficher le résumé
  console.log('\n📋 Sessions actuelles dans la base:');
  const { data: allSessions, error } = await supabase
    .from('game_sessions')
    .select('id, session_type, name, entry_fee, status, scheduled_hour, min_prize')
    .order('scheduled_hour', { ascending: true });

  if (error) {
    console.error('❌ Erreur récupération sessions:', error.message);
    return;
  }

  console.table(allSessions);
}

createPaidSessions()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
  });
