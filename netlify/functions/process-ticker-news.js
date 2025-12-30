const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  try {
    // 1. Récupérer la configuration
    const { data: config } = await supabase
      .from('ticker_config')
      .select('*')
      .single();

    if (!config?.is_enabled) {
      return { statusCode: 200, body: 'Ticker disabled' };
    }

    // 2. Récupérer les derniers articles (3 dernières heures)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    const { data: recentArticles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, url, author, created_at')
      .gte('created_at', threeHoursAgo.toISOString())
      .eq('is_published', true)
      .not('title', 'ilike', '%verbatim%')
      .not('title', 'ilike', '%facebook%')
      .not('summary', 'ilike', '%verbatim%')
      .not('url', 'ilike', '%facebook.com%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (articlesError || !recentArticles || recentArticles.length === 0) {
      return { statusCode: 200, body: 'No new articles' };
    }

    // 3. Filtrer les articles déjà traités
    const { data: existingMessages } = await supabase
      .from('ticker_messages')
      .select('article_id')
      .in('article_id', recentArticles.map(a => a.id));

    const processedIds = new Set(existingMessages?.map(m => m.article_id) || []);
    const newArticles = recentArticles.filter(a => !processedIds.has(a.id));

    if (newArticles.length === 0) {
      return { statusCode: 200, body: 'No new articles to process' };
    }

    // 4. Reformuler les titres (version simplifiée sans OpenAI pour l'instant)
    const reformulatedMessages = newArticles.map(article => ({
      article_id: article.id,
      original: article.title,
      reformulated: reformulateTitle(article.title), // Version simplifiée
      source: article.author || 'Gabon 24/7',
      url: article.url,
      tokens_used: 0
    }));

    // 5. Sauvegarder les messages reformulés
    const messagesToInsert = reformulatedMessages.map(msg => ({
      original_title: msg.original,
      reformulated_title: msg.reformulated,
      article_id: msg.article_id,
      article_url: msg.url,
      source_name: msg.source,
      message_type: 'auto',
      display_end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4h de durée
      ai_tokens_used: msg.tokens_used
    }));

    const { error } = await supabase
      .from('ticker_messages')
      .insert(messagesToInsert);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: messagesToInsert.length,
        messages: reformulatedMessages
      })
    };

  } catch (error) {
    console.error('Error processing ticker news:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed' })
    };
  }
};

// Fonction de reformulation simplifiée (à remplacer par OpenAI plus tard)
function reformulateTitle(title) {
  if (!title) return 'Actualité';
  
  // Raccourcir et nettoyer le titre
  let reformulated = title
    .replace(/\[.*?\]/g, '') // Supprimer les crochets
    .replace(/\(.*?\)/g, '') // Supprimer les parenthèses
    .replace(/^\s*-\s*/, '') // Supprimer les tirets en début
    .replace(/\s+/g, ' ') // Normaliser les espaces
    // Supprimer les mentions de sources médias courantes
    .replace(/^(Gabon 24\/7|Gabon Actu|L'Union|Libreville|RTG|Gabon Matin)\s*[:|-]\s*/i, '')
    .replace(/\s*-\s*(Gabon 24\/7|Gabon Actu|L'Union|Libreville|RTG|Gabon Matin)\s*$/i, '')
    .trim();
  
  // Limiter à 100 caractères
  if (reformulated.length > 100) {
    reformulated = reformulated.substring(0, 97) + '...';
  }
  
  return reformulated || title.substring(0, 100);
}
