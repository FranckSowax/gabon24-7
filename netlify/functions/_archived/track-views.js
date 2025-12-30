const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration Supabase avec validation
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
  });
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (e) {
    console.error('❌ Erreur initialisation Supabase:', e);
    supabase = null;
  }
}

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
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
    if (!supabase) {
      // Laisser le frontend gérer le fallback localstorage
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ success: false, error: 'Supabase non configuré' })
      }
    }

    const { articleId, title, url, source, imageUrl } = JSON.parse(event.body || '{}');

    if (!articleId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'ID d\'article requis'
        })
      };
    }

    console.log(`📊 Tracking vue pour article: ${articleId} - ${title} [${new Date().toISOString()}]`);

    // Vérifier si c'est un article RSS (format: rss-timestamp-index, hash MD5, ou ID de type URL)
    const looksLikeUrlId = typeof articleId === 'string' && /^https?:\/\//i.test(articleId)
    const isRSSArticle = (typeof articleId === 'string' && (articleId.startsWith('rss-') || /^[a-f0-9]{32}$/i.test(articleId) || looksLikeUrlId))
    
    if (isRSSArticle) {
      console.log(`📰 Article RSS détecté: ${articleId} - tracking réel`);
      
      // Calculer un ID RSS stable basé sur l'URL si nécessaire
      const baseForHash = (url && typeof url === 'string' && url.length > 0) ? url : (articleId || '')
      const hashed = crypto.createHash('md5').update(baseForHash).digest('hex')
      const stableRssId = (articleId && (articleId.startsWith('rss-') || /^[a-f0-9]{32}$/i.test(articleId)) && !looksLikeUrlId)
        ? articleId
        : `rss-${hashed}`

      try {
        // Vérifier si l'article RSS existe déjà dans la table rss_article_views
        const { data: existingViews, error: fetchError } = await supabase
          .from('rss_article_views')
          .select('view_count')
          .eq('article_id', stableRssId)
          .single();

        let newViewCount = 1;
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('❌ Erreur lors de la récupération des vues RSS:', fetchError);
          throw fetchError;
        }

        if (existingViews) {
          // Article existe, incrémenter le compteur
          newViewCount = existingViews.view_count + 1;
          const { error: updateError } = await supabase
            .from('rss_article_views')
            .update({ 
              view_count: newViewCount,
              last_viewed_at: new Date().toISOString()
            })
            .eq('article_id', stableRssId);

          if (updateError) {
            console.error('❌ Erreur lors de la mise à jour des vues RSS:', updateError);
            throw updateError;
          }
        } else {
          // Nouvel article ou mise à jour concurrente, utiliser UPSERT pour éviter les doublons
          const nowIso = new Date().toISOString();
          const { error: upsertError } = await supabase
            .from('rss_article_views')
            .upsert([
              {
                article_id: stableRssId,
                title: title,
                source: source,
                url: url,
                view_count: 1,
                first_viewed_at: nowIso,
                last_viewed_at: nowIso,
                image_url: imageUrl || null
              }
            ], { onConflict: 'article_id' });

          if (upsertError) {
            console.error('❌ Erreur lors de l\'upsert des vues RSS:', upsertError);
            throw upsertError;
          }
        }

        // Enregistrer dans l'historique utilisateur si possible (pour articles RSS)
        try {
          const authHeader = event.headers.authorization;
          if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: userError } = await supabase.auth.getUser(token);
            
            if (!userError && user) {
              const { error: historyError } = await supabase
                .from('user_article_history')
                .insert({
                  user_id: user.id,
                  article_id: articleId,
                  title: title,
                  source: source,
                  url: url,
                  viewed_at: new Date().toISOString(),
                  article_type: 'rss'
                });

              if (!historyError) {
                console.log('📋 Article RSS enregistré dans l\'historique utilisateur');
              }
            }
          }
        } catch (historyError) {
          console.warn('⚠️ Erreur historique RSS:', historyError);
        }

        // Enregistrer un événement de vue générique pour agrégation par période
        // NOTE: la table article_views impose user_id NOT NULL dans votre schéma.
        // Nous n'insérons donc QUE si un utilisateur authentifié est présent.
        try {
          let userId = null;
          const authHeader2 = event.headers.authorization;
          if (authHeader2) {
            try {
              const token2 = authHeader2.replace('Bearer ', '');
              const { data: { user: user2 } = {}, error: userErr2 } = await supabase.auth.getUser(token2);
              if (!userErr2 && user2) userId = user2.id;
            } catch (e) {
              // ignore
            }
          }
          if (userId) {
            const { error: eventErr } = await supabase
              .from('article_views')
              .insert({
                user_id: userId,
                article_id: stableRssId,
                article_title: title || null,
                article_url: url || null,
                source: source || null,
                viewed_at: new Date().toISOString(),
                view_count: 1
              });
            if (eventErr) {
              console.warn('⚠️ Erreur insertion article_views (RSS):', eventErr);
            }
          } else {
            console.log('ℹ️ article_views (RSS) ignoré: user_id manquant (contrainte NOT NULL)');
          }
        } catch (ev) {
          console.warn('⚠️ Exception insertion article_views (RSS):', ev);
        }

        console.log(`✅ Vue RSS trackée avec succès. Nouvelles vues: ${newViewCount}`);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            articleId,
            viewCount: newViewCount,
            message: 'Vue RSS trackée avec succès',
            type: 'rss'
          })
        };
      } catch (error) {
        console.error('❌ Erreur dans le tracking RSS:', error);
        // Fallback: retourner un compteur basique
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            articleId,
            viewCount: 1,
            message: 'Vue RSS trackée (mode fallback)',
            type: 'rss'
          })
        };
      }
    }

    // Pour les articles stockés en base (non RSS)
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('view_count')
      .eq('id', articleId);

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération de l\'article:', fetchError);
      throw fetchError;
    }

    // Vérifier si l'article existe
    if (!articles || articles.length === 0) {
      console.warn(`⚠️ Article ${articleId} non trouvé en base`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Article non trouvé'
        })
      };
    }

    const article = articles[0];
    const newViewCount = (article?.view_count || 0) + 1;

    const { error: updateError } = await supabase
      .from('articles')
      .update({ 
        view_count: newViewCount
      })
      .eq('id', articleId);

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour des vues:', updateError);
      throw updateError;
    }

    // Enregistrer dans l'historique utilisateur si possible
    try {
      // Récupérer l'utilisateur depuis les headers (si authentifié)
      const authHeader = event.headers.authorization;
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (!userError && user) {
          // Enregistrer dans l'historique utilisateur
          const { error: historyError } = await supabase
            .from('user_article_history')
            .insert({
              user_id: user.id,
              article_id: articleId,
              title: title,
              source: source,
              url: url,
              viewed_at: new Date().toISOString(),
              article_type: 'database'
            });

          if (historyError) {
            console.warn('⚠️ Erreur enregistrement historique:', historyError);
          } else {
            console.log('📋 Article enregistré dans l\'historique utilisateur');
          }
        }
      }
    } catch (historyError) {
      console.warn('⚠️ Erreur lors de l\'enregistrement historique:', historyError);
    }

    // Enregistrer un événement de vue générique pour agrégation par période (DB)
    // NOTE: article_views.user_id est NOT NULL → insérer uniquement si utilisateur authentifié
    try {
      let userId = null;
      const authHeader2 = event.headers.authorization;
      if (authHeader2) {
        try {
          const token2 = authHeader2.replace('Bearer ', '');
          const { data: { user: user2 } = {}, error: userErr2 } = await supabase.auth.getUser(token2);
          if (!userErr2 && user2) userId = user2.id;
        } catch (e) {
          // ignore
        }
      }
      if (userId) {
        const { error: eventErr } = await supabase
          .from('article_views')
          .insert({
            user_id: userId,
            article_id: articleId,
            article_title: title || null,
            article_url: url || null,
            source: source || null,
            viewed_at: new Date().toISOString(),
            view_count: 1
          });
        if (eventErr) {
          console.warn('⚠️ Erreur insertion article_views (DB):', eventErr);
        }
      } else {
        console.log('ℹ️ article_views (DB) ignoré: user_id manquant (contrainte NOT NULL)');
      }
    } catch (ev) {
      console.warn('⚠️ Exception insertion article_views (DB):', ev);
    }

    console.log(`✅ Vue trackée avec succès. Nouvelles vues: ${newViewCount}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        articleId,
        viewCount: newViewCount,
        message: 'Vue trackée avec succès',
        type: 'database'
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans track-view function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur serveur',
        message: error.message
      })
    };
  }
};
