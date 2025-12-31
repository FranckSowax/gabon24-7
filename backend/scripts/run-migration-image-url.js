#!/usr/bin/env node
/**
 * Script pour ajouter la colonne image_url à user_reading_history
 * Exécute la migration SQL via Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Migration: Ajout de la colonne image_url à user_reading_history\n');

  try {
    // Vérifier si la colonne existe déjà
    const { data: columns, error: checkError } = await supabase
      .from('user_reading_history')
      .select('image_url')
      .limit(1);

    if (!checkError) {
      console.log('La colonne image_url existe déjà dans user_reading_history');
      return;
    }

    // Si la colonne n'existe pas, l'erreur sera liée au champ non reconnu
    // On peut exécuter la migration via une RPC ou directement
    console.log('Colonne non trouvée, veuillez exécuter cette SQL dans Supabase Dashboard:');
    console.log(`
-- Migration: Ajouter la colonne image_url à user_reading_history
ALTER TABLE user_reading_history
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Commentaire sur la nouvelle colonne
COMMENT ON COLUMN user_reading_history.image_url IS 'URL de l''image de l''article pour affichage dans l''historique';
    `);
  } catch (err) {
    console.error('Erreur:', err.message);
  }
}

runMigration();
