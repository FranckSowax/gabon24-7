const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Gabon24-7 RSS Reader 1.0'
  },
  customFields: {
    feed: [],
    item: []
  }
});

// Fonction pour extraire l'image depuis le contenu HTML
function extractImageFromContent(content, description) {
  if (!content && !description) return null;
  
  const text = content || description || '';
  
  // Recherche d'images dans les balises img
  const imgMatch = text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) {
    return imgMatch[1];
  }
  
  // Recherche d'URLs d'images directes
  const urlMatch = text.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  return null;
}

// Fonction pour générer un résumé IA avec OpenAI
async function generateAISummary(title, content) {
  if (!openaiApiKey || !content) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Résume cet article en français en 2-3 phrases maximum:\n\nTitre: ${title}\n\nContenu: ${content.substring(0, 1000)}`
        }],
        max_tokens: 150,
        temperature: 0.7
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || null;
    }
  } catch (error) {
    console.error('Erreur génération résumé IA:', error);
  }
  
  return null;
}

// Fonction principale de synchronisation RSS
async function syncRSSFeeds() {
  console.log('🔄 Début de la synchronisation RSS...');
  
  try {
    // Récupérer tous les flux RSS actifs
    const { data: feeds, error: feedsError } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: false });
    
    if (feedsError) {
      console.error('❌ Erreur récupération feeds:', feedsError);
      throw feedsError;
    }
    
    console.log(`📡 ${feeds?.length || 0} flux RSS à synchroniser`);
    
    let totalNewArticles = 0;
    
    for (const feed of feeds || []) {
      try {
        console.log(`🔍 Synchronisation: ${feed.name} (${feed.url})`);
        
        // Parser le flux RSS avec gestion d'erreur améliorée
        let rssFeed;
        try {
          rssFeed = await parser.parseURL(feed.url);
        } catch (parseError) {
          // Ignorer les erreurs de parsing XML malformé et continuer
          if (parseError.message.includes('Invalid character in entity name') || 
              parseError.message.includes('Status code 403')) {
            console.warn(`⚠️ Flux RSS ignoré (${feed.name}): ${parseError.message}`);
            continue;
          }
          throw parseError; // Re-lancer les autres erreurs
        }
        
        // Limiter à 5 articles par flux pour éviter les timeouts
        for (const item of (rssFeed.items || []).slice(0, 5)) {
          try {
            // Créer un external_id unique basé sur le contenu
            const externalId = item.guid || item.link || `${feed.id}-${Date.now()}-${Math.random()}`;
            
            // Vérifier si l'article existe déjà avec external_id
            const { data: existingArticle } = await supabase
              .from('articles')
              .select('id')
              .eq('feed_id', feed.id)
              .eq('external_id', externalId)
              .single();
            
            if (existingArticle) {
              continue; // Article déjà existant
            }
            
            // Extraire l'image
            const imageUrl = extractImageFromContent(item.content, item.contentSnippet);
            
            // Générer résumé IA avec timeout court
            let aiSummary = null;
            try {
              const summaryPromise = generateAISummary(item.title, item.contentSnippet || item.content);
              aiSummary = await Promise.race([
                summaryPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ]);
            } catch (summaryError) {
              console.warn(`⚠️ Timeout résumé IA pour: ${item.title}`);
            }
            
            // Insérer le nouvel article avec UPSERT pour éviter les doublons
            const { error: insertError } = await supabase
              .from('articles')
              .upsert({
                feed_id: feed.id,
                external_id: externalId,
                title: item.title,
                summary: item.contentSnippet || item.content?.substring(0, 500),
                ai_summary: aiSummary,
                content: item.content || item.contentSnippet,
                url: item.link,
                image_url: imageUrl,
                author: item.creator || item['dc:creator'] || 'Rédaction',
                published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                category: feed.category || 'actualités',
                is_published: true,
                view_count: 0
              }, {
                onConflict: 'feed_id,external_id',
                ignoreDuplicates: true
              });
            
            if (insertError) {
              console.error(`❌ Erreur insertion article ${item.title}:`, insertError);
            } else {
              totalNewArticles++;
              console.log(`✅ Nouvel article: ${item.title}`);
            }
            
          } catch (articleError) {
            console.error(`❌ Erreur traitement article:`, articleError);
          }
        }
        
        // Mettre à jour la date de dernière synchronisation
        await supabase
          .from('rss_feeds')
          .update({ last_fetch_at: new Date().toISOString() })
          .eq('id', feed.id);
          
      } catch (feedError) {
        console.error(`❌ Erreur synchronisation feed ${feed.name}:`, feedError);
      }
    }
    
    console.log(`🎉 Synchronisation terminée: ${totalNewArticles} nouveaux articles`);
    return { success: true, newArticles: totalNewArticles };
    
  } catch (error) {
    console.error('❌ Erreur synchronisation RSS:', error);
    throw error;
  }
}

// Verrou global pour éviter les exécutions simultanées
let syncInProgress = false;

exports.handler = async (event, context) => {
  // Timeout de 10 minutes pour Netlify Functions
  context.callbackWaitsForEmptyEventLoop = false;
  
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
    // Vérifier si une synchronisation est déjà en cours
    if (syncInProgress) {
      console.log('⚠️ Synchronisation déjà en cours, abandon...');
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Synchronisation déjà en cours'
        })
      };
    }

    // Marquer la synchronisation comme en cours
    syncInProgress = true;
    console.log('🔄 Démarrage synchronisation RSS...');
    
    // Vérification des variables d'environnement
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Configuration manquante',
          message: 'Variables d\'environnement Supabase non configurées'
        })
      };
    }

    // Utiliser la synchronisation optimisée pour respecter les limites OpenAI
    console.log('🚀 Démarrage synchronisation RSS programmée via sync optimisé...');
    
    const optimizedUrl = `${process.env.URL || 'https://gabon24-7.netlify.app'}/.netlify/functions/rss-sync-optimized`;
    const response = await fetch(optimizedUrl, { method: 'POST' });
    
    if (!response.ok) {
      throw new Error(`Erreur sync optimisé HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synchronisation réussie: ${result.newArticles || 0} nouveaux articles`,
        newArticles: result.summary?.newArticles || 0,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur handler RSS sync:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur synchronisation RSS',
        message: error.message
      })
    };
  } finally {
    // Libérer le verrou dans tous les cas
    syncInProgress = false;
  }
};
