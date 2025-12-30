const { createClient } = require('@supabase/supabase-js');
const { scoreArticleAgainstAlert } = require('./lib/alert-scoring');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Scoring déporté dans lib/alert-scoring pour tirer parti des champs IA (ai_keywords, ai_category, ai_importance...)

// Fonction pour envoyer une notification (placeholder)
async function sendNotification(alert, article, matchData) {
  // TODO: Implémenter l'envoi de notifications par email/WhatsApp
  console.log(`📧 Notification à envoyer pour l'alerte "${alert.name}"`);
  console.log(`📰 Article: ${article.title}`);
  console.log(`🎯 Mots-clés: ${matchData.matchedKeywords.join(', ')}`);
  console.log(`📊 Score: ${matchData.confidenceScore.toFixed(2)}`);
  
  // Marquer la notification comme envoyée
  return true;
}

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { article_ids, process_all = false } = JSON.parse(event.body || '{}');
    
    let articlesToProcess = [];

    if (process_all) {
      // Traiter tous les articles récents (dernières 2 heures)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentArticles, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, summary, content, keywords, url, source, published_at, enriched_at, ai_keywords, ai_category, ai_sentiment, ai_importance, ai_is_breaking, ai_fact_score')
        .gte('published_at', twoHoursAgo)
        .order('published_at', { ascending: false });

      if (articlesError) {
        throw articlesError;
      }
      articlesToProcess = recentArticles;
    } else if (article_ids && article_ids.length > 0) {
      // Traiter des articles spécifiques
      const { data: specificArticles, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, summary, content, keywords, url, source, published_at, enriched_at, ai_keywords, ai_category, ai_sentiment, ai_importance, ai_is_breaking, ai_fact_score')
        .in('id', article_ids);

      if (articlesError) {
        throw articlesError;
      }
      articlesToProcess = specificArticles;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'article_ids or process_all is required' })
      };
    }

    // Récupérer toutes les alertes actives
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertsError) {
      throw alertsError;
    }

    let totalMatches = 0;
    let notificationsSent = 0;
    const results = [];

    // Traiter chaque article contre chaque alerte active
    for (const article of articlesToProcess) {
      for (const alert of activeAlerts) {
        const keywords = alert.keywords || [];
        if (keywords.length === 0) continue;

        // Vérifier si cette combinaison article/alerte existe déjà
        const { data: existingMatch } = await supabase
          .from('alert_matches')
          .select('id')
          .eq('alert_id', alert.id)
          .eq('article_id', article.id)
          .single();

        if (existingMatch) {
          continue; // Skip si déjà traité
        }

        const matchResult = scoreArticleAgainstAlert(article, alert);

        if (matchResult.matched && matchResult.confidenceScore >= 0.3) { // Seuil minimum de 30%
          // Créer la correspondance en base
          const { error: insertError } = await supabase
            .from('alert_matches')
            .insert({
              alert_id: alert.id,
              article_id: article.id,
              matched_keywords: matchResult.matchedKeywords,
              confidence_score: matchResult.confidenceScore,
              matching_type: 'automated_ai',
              notification_sent: false
            });

          if (!insertError) {
            totalMatches++;
            
            // Envoyer notification si configurée
            if (alert.delivery_channels?.email || alert.delivery_channels?.whatsapp) {
              const notificationSent = await sendNotification(alert, article, matchResult);
              
              if (notificationSent) {
                // Marquer comme notifié
                await supabase
                  .from('alert_matches')
                  .update({ notification_sent: true, notified_at: new Date().toISOString() })
                  .eq('alert_id', alert.id)
                  .eq('article_id', article.id);
                
                notificationsSent++;
              }
            }

            results.push({
              alert_name: alert.name,
              article_title: article.title,
              confidence_score: matchResult.confidenceScore,
              matched_keywords: matchResult.matchedKeywords
            });
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        articles_processed: articlesToProcess.length,
        active_alerts: activeAlerts.length,
        total_matches: totalMatches,
        notifications_sent: notificationsSent,
        results: results.slice(0, 20) // Top 20 résultats
      })
    };

  } catch (error) {
    console.error('Error processing alert matches:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
