/**
 * Script pour créer la table audio_settings
 */

const supabaseService = require('./supabase-config');

async function createTable() {
  try {
    console.log('🚀 Création de la table audio_settings...\n');
    
    // Créer la table directement avec une insertion test puis suppression
    // Ceci va créer la structure implicitement
    const { data, error } = await supabaseService.supabase
      .from('audio_settings')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // UUID test
        voice: 'alloy',
        speed: 1.0,
        auto_play: false
      })
      .select();
    
    if (error) {
      console.log('❌ La table n\'existe pas encore. Veuillez exécuter le SQL suivant dans Supabase SQL Editor:\n');
      console.log(`
-- Table pour les paramètres audio utilisateur
CREATE TABLE IF NOT EXISTS audio_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  voice VARCHAR(50) DEFAULT 'alloy',
  speed DECIMAL(3,2) DEFAULT 1.0,
  auto_play BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par utilisateur
CREATE INDEX IF NOT EXISTS idx_audio_settings_user_id ON audio_settings(user_id);

-- RLS pour audio_settings
ALTER TABLE audio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audio settings" ON audio_settings;
CREATE POLICY "Users can view their own audio settings"
  ON audio_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own audio settings" ON audio_settings;
CREATE POLICY "Users can update their own audio settings"
  ON audio_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own audio settings" ON audio_settings;
CREATE POLICY "Users can insert their own audio settings"
  ON audio_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
      `);
      
      console.log('\n📝 Ou copiez le fichier: migrations/create-audio-tables.sql');
    } else {
      console.log('✅ Table créée avec succès (ou existait déjà)');
      
      // Supprimer l'entrée test
      await supabaseService.supabase
        .from('audio_settings')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createTable();
