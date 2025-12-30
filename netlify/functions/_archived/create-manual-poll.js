const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Créer un sondage manuel temporaire
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Méthode non autorisée'
      })
    };
  }

  try {
    console.log('🗳️ Création d\'un sondage manuel temporaire...');
    
    // Vérification des variables d'environnement
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Configuration manquante'
        })
      };
    }

    // Archiver les anciens sondages actifs
    const { error: archiveError } = await supabase
      .from('polls')
      .update({ 
        status: 'archived',
        is_active: false 
      })
      .eq('status', 'published');
    
    if (archiveError) {
      console.error('Erreur archivage anciens sondages:', archiveError);
    } else {
      console.log('✅ Anciens sondages archivés');
    }

    // Créer le sondage temporaire
    const expiresAt = new Date();
    expiresAt.setHours(19, 0, 0, 0); // Expire à 19h UTC aujourd'hui
    
    // Si on est déjà passé 19h, expirer demain à 19h
    if (new Date().getHours() >= 19) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }
    
    const { data: poll, error } = await supabase
      .from('polls')
      .insert({
        question: "Êtes-vous satisfait de l'évolution économique du Gabon en 2025 ?",
        poll_type: 'yes_no',
        options: ["Oui", "Non"],
        expires_at: expiresAt.toISOString(),
        status: 'published',
        published_at: new Date().toISOString(),
        is_active: true,
        is_manual: true,
        total_votes: 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création sondage:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Impossible de créer le sondage',
          details: error.message
        })
      };
    }

    console.log(`✅ Sondage manuel créé: ${poll.question.substring(0, 50)}...`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Sondage manuel créé avec succès',
        data: {
          id: poll.id,
          question: poll.question,
          type: poll.poll_type,
          options: poll.options,
          expires_at: poll.expires_at,
          is_manual: poll.is_manual
        }
      })
    };

  } catch (error) {
    console.error('❌ Erreur création sondage manuel:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la création du sondage',
        details: error.message
      })
    };
  }
};
