#!/usr/bin/env node
/**
 * Script pour créer les fonctions RPC Supabase pour les slides
 * Exécute le SQL depuis create_slide_analytics_functions.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLFile(filePath) {
  try {
    console.log(`📄 Lecture du fichier: ${filePath}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Diviser le SQL en commandes individuelles (séparées par les fonctions)
    const statements = sql
      .split(/(?=CREATE OR REPLACE FUNCTION|GRANT EXECUTE)/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');

    console.log(`📊 ${statements.length} commandes SQL à exécuter\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extraire le nom de la fonction pour l'affichage
      const match = statement.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/i);
      const functionName = match ? match[1] : `Statement ${i + 1}`;
      
      console.log(`⚙️  Exécution: ${functionName}...`);
      
      try {
        // Utiliser la méthode rpc avec une fonction d'exécution SQL custom
        // OU utiliser directement fetch vers l'API REST de Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement })
        });

        // Alternative: exécuter via SQL Editor API
        if (!response.ok) {
          // Fallback: utiliser l'API SQL Editor de Supabase
          const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ query: statement })
          });
          
          if (!sqlResponse.ok) {
            throw new Error(`HTTP ${sqlResponse.status}: ${await sqlResponse.text()}`);
          }
        }
        
        console.log(`   ✅ ${functionName} créée avec succès`);
      } catch (error) {
        console.error(`   ❌ Erreur sur ${functionName}:`, error.message);
      }
    }

    console.log('\n✨ Setup terminé!');
    console.log('\n📝 Vérifiez dans Supabase Dashboard > SQL Editor que les fonctions sont créées:');
    console.log('   - increment_slide_views');
    console.log('   - increment_slide_clicks');
    console.log('   - increment_slide_impressions');
    console.log('   - get_slide_stats');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
const sqlFilePath = path.join(__dirname, '../database/create_slide_analytics_functions.sql');
executeSQLFile(sqlFilePath);
