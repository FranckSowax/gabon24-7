const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const parser = new Parser();
const supabase = createClient(supabaseUrl, supabaseKey);

// Bundle RSS.app URL unique
const BUNDLE_URL = 'https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml';

// Fonction pour générer un résumé IA avec OpenAI
async function generateAISummary(title, content) {
  if (!openaiApiKey) {
    console.log('⚠️ Pas de clé OpenAI configurée, résumé IA ignoré');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en actualités gabonaises. Crée un résumé concis et informatif en français, en 2-3 phrases maximum. Mets l\'accent sur les points clés et l\'impact pour le Gabon.'
          },
          {
            role: 'user',
            content: `Titre: ${title}\n\nContenu: ${content.substring(0, 1000)}...`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (response.status === 429) {
      console.log('⚠️ Rate limit OpenAI atteint, résumé ignoré');
      return null;
    }

    if (!response.ok) {
      console.error('❌ Erreur OpenAI:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('❌ Erreur génération résumé IA:', error.message);
    return null;
  }
}

// Fonction pour extraire le domaine et déterminer la source
function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace('www.', '');
    
    // Map des domaines vers noms de sources
    const sourceMap = {
      'gabonreview.com': 'Gabon Review',
      'infogabon.ga': 'Info Gabon',
      'lalibreville.com': 'La Libreville',
      'gabon24.com': 'Gabon 24',
      'union.sonapresse.com': 'L\'Union',
      'gabon-eco.com': 'Gabon Eco',
      'actualite-gabon.com': 'Actualité Gabon',
      'sciencesetavenir.fr': 'Sciences et Avenir',
    };
    
    return sourceMap[domain] || domain;
  } catch (error) {
    return 'Source inconnue';
  }
}

// Fonction pour traiter l'image avec proxy si nécessaire
function processImageUrl(imageUrl, link) {
  if (!imageUrl) return null;
  
  try {
    const articleUrl = new URL(link);
    const imageUrlObj = new URL(imageUrl);
    
    // Si l'image vient d'Info Gabon, utiliser le proxy
    if (articleUrl.hostname.includes('infogabon') && imageUrlObj.hostname.includes('infogabon')) {
      return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    return imageUrl;
  } catch (error) {
    console.log('⚠️ URL image invalide:', imageUrl);
    return null;
  }
}

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Synchronisation RSS Bundle démarrée');
    console.log('📡 Bundle URL:', BUNDLE_URL);

    // Étape 1: Parser le bundle RSS.app
    const feed = await parser.parseURL(BUNDLE_URL);
    console.log(`📄 Bundle parsé: ${feed.items.length} articles trouvés`);

    let newArticles = 0;
    let processedArticles = 0;
    let aiSummariesGenerated = 0;
    const errors = [];
    
    // Limiter le nombre d'articles à traiter pour éviter timeout
    const maxArticles = 50; // Traiter maximum 50 articles par exécution
    const itemsToProcess = feed.items.slice(0, maxArticles);
    
    console.log(`📊 Traitement de ${itemsToProcess.length} articles sur ${feed.items.length} disponibles`);

    // Étape 2: Traiter chaque article du bundle (limité)
    for (const item of itemsToProcess) {
      try {
        processedArticles++;
        
        // Vérifier si l'article existe déjà
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('link', item.link)
          .single();

        if (existingArticle) {
          continue; // Article déjà existant
        }

        // Extraire les données de l'article
        const title = item.title || 'Titre non disponible';
        const content = item.contentSnippet || item.content || item.summary || '';
        const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        const source = extractSourceFromLink(item.link);
        const imageUrl = processImageUrl(item.enclosure?.url || item.image?.url, item.link);

        // Générer résumé IA seulement pour les articles les plus récents
        let aiSummary = null;
        if (content && content.length > 100 && processedArticles <= 10) {
          // Limiter IA aux 10 premiers articles pour éviter timeout
          aiSummary = await generateAISummary(title, content);
          if (aiSummary) {
            aiSummariesGenerated++;
            // Petit délai pour respecter les rate limits OpenAI
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Insérer l'article en base
        const { error: insertError } = await supabase
          .from('articles')
          .insert({
            title: title.substring(0, 500), // Limiter la longueur
            content: content.substring(0, 5000), // Limiter la longueur
            link: item.link,
            pub_date: pubDate,
            source: source,
            image_url: imageUrl,
            ai_summary: aiSummary,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('❌ Erreur insertion article:', insertError.message);
          errors.push(`Erreur insertion: ${insertError.message}`);
        } else {
          newArticles++;
          console.log(`✅ Article ajouté: ${title.substring(0, 50)}...`);
        }

        // Délai entre articles pour éviter la surcharge
        if (processedArticles % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Arrêt précoce si on approche du timeout Netlify (après 20 secondes)
        const elapsed = Date.now() - startTime;
        if (elapsed > 20000) { // 20 secondes max
          console.log(`⏰ Arrêt précoce après ${elapsed}ms pour éviter timeout`);
          break;
        }

      } catch (articleError) {
        console.error('❌ Erreur traitement article:', articleError.message);
        errors.push(`Erreur article: ${articleError.message}`);
      }
    }

    // Étape 3: Log de synchronisation
    const duration = Date.now() - startTime;
    const { error: logError } = await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'bundle',
        feeds_processed: 1,
        articles_extracted: newArticles,
        success_count: 1,
        error_count: errors.length,
        errors: errors,
        duration_ms: duration,
        ai_summaries_generated: aiSummariesGenerated,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('❌ Erreur log:', logError.message);
    }

    const result = {
      success: true,
      bundle_url: BUNDLE_URL,
      total_items: feed.items.length,
      new_articles: newArticles,
      processed_articles: processedArticles,
      ai_summaries_generated: aiSummariesGenerated,
      duration_ms: duration,
      errors: errors,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Synchronisation RSS Bundle terminée:', result);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Erreur critique RSS Bundle:', error);
    
    const errorResult = {
      success: false,
      error: error.message,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(errorResult)
    };
  }
};
