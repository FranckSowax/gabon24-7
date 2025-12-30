const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fonction planifiée qui s'exécute tous les jours à 21h00 GMT pour publier les sondages programmés
exports.handler = async (event, context) => {
  console.log('⏰ Exécution planifiée - Publication des sondages quotidiens...');
  
  try {
    // Récupérer les sondages programmés pour publication
    const { data: scheduledPolls, error: fetchError } = await supabase
      .from('polls')
      .select('*')
      .eq('status', 'draft')
      .not('scheduled_publish_at', 'is', null)
      .lte('scheduled_publish_at', new Date().toISOString());

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération des sondages:', fetchError);
      throw fetchError;
    }

    if (!scheduledPolls || scheduledPolls.length === 0) {
      console.log('ℹ️ Aucun sondage programmé à publier maintenant');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Aucun sondage à publier',
          published_count: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📋 ${scheduledPolls.length} sondage(s) à publier`);

    // Publier les sondages programmés
    const publishedPolls = [];
    for (const poll of scheduledPolls) {
      const { data, error } = await supabase
        .from('polls')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          is_active: true
        })
        .eq('id', poll.id)
        .select()
        .single();

      if (error) {
        console.error(`❌ Erreur publication sondage ${poll.id}:`, error);
      } else {
        console.log(`✅ Sondage publié: "${poll.question}"`);
        publishedPolls.push(data);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `${publishedPolls.length} sondage(s) publié(s) automatiquement`,
        published_count: publishedPolls.length,
        published_polls: publishedPolls.map(p => ({ id: p.id, question: p.question })),
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur lors de la publication automatique:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la publication automatique',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
