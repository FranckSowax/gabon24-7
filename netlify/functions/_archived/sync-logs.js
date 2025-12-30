const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      // Enregistrer un log de synchronisation
      const { 
        sync_type, 
        feeds_processed, 
        articles_extracted, 
        success_count, 
        error_count, 
        errors,
        duration_ms 
      } = JSON.parse(event.body);

      const { data, error } = await supabase
        .from('sync_logs')
        .insert({
          sync_type: sync_type || 'manual',
          feeds_processed: feeds_processed || 0,
          articles_extracted: articles_extracted || 0,
          success_count: success_count || 0,
          error_count: error_count || 0,
          errors: errors || [],
          duration_ms: duration_ms || 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Log de synchronisation enregistré',
          data
        })
      };

    } else {
      // Récupérer les logs de synchronisation
      const limit = parseInt(event.queryStringParameters?.limit) || 50;
      const offset = parseInt(event.queryStringParameters?.offset) || 0;

      const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Statistiques des dernières 24h
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: recentLogs, error: recentError } = await supabase
        .from('sync_logs')
        .select('*')
        .gte('created_at', yesterday.toISOString());

      if (recentError) throw recentError;

      const stats24h = {
        total_syncs: recentLogs.length,
        total_feeds_processed: recentLogs.reduce((sum, log) => sum + (log.feeds_processed || 0), 0),
        total_articles_extracted: recentLogs.reduce((sum, log) => sum + (log.articles_extracted || 0), 0),
        success_rate: recentLogs.length > 0 
          ? ((recentLogs.reduce((sum, log) => sum + (log.success_count || 0), 0) / 
             recentLogs.reduce((sum, log) => sum + (log.feeds_processed || 0), 0)) * 100).toFixed(1)
          : 0,
        average_duration: recentLogs.length > 0
          ? Math.round(recentLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / recentLogs.length)
          : 0
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          logs,
          stats24h,
          pagination: {
            limit,
            offset,
            total: logs.length
          }
        })
      };
    }

  } catch (error) {
    console.error('❌ Erreur sync-logs:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la gestion des logs',
        message: error.message
      })
    };
  }
};
