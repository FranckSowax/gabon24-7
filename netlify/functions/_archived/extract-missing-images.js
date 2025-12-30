const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration Supabase
const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODg5MjYsImV4cCI6MjA3MDM2NDkyNn0.MLTnZFSSosMt3Lu7BeFR8LFW4ihaUo5Dx2g9sUJeHLA';

const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour extraire l'image principale d'un article
async function extractImageFromArticle(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    let imageUrl = null;

    // Stratégies d'extraction par ordre de priorité
    const strategies = [
      () => $('meta[property="og:image"]').attr('content'),
      () => $('meta[name="twitter:image"]').attr('content'),
      () => $('meta[itemprop="image"]').attr('content'),
      () => $('article img').first().attr('src'),
      () => $('.content img, .post-content img, .entry-content img').first().attr('src')
    ];

    for (let strategy of strategies) {
      imageUrl = strategy();
      if (imageUrl) break;
    }

    if (!imageUrl) return null;

    // Normaliser l'URL de l'image
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      const urlObj = new URL(url);
      imageUrl = urlObj.origin + imageUrl;
    }

    // Valider que l'image est accessible
    await axios.head(imageUrl, { timeout: 5000 });
    return imageUrl;

  } catch (error) {
    return null;
  }
}

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
    const { limit = 10, test = false } = event.queryStringParameters || {};
    
    if (test) {
      // Mode test - traiter un seul article (le plus récent)
      const { data: articles } = await supabase
        .from('articles')
        .select('id, url, title, image_url, created_at')
        .is('image_url', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!articles || articles.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Aucun article sans image trouvé' })
        };
      }

      const article = articles[0];
      const extractedImage = await extractImageFromArticle(article.url);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          article: {
            id: article.id,
            title: article.title,
            url: article.url,
            current_image: article.image_url,
            extracted_image: extractedImage
          }
        })
      };
    }

    // Mode production - traiter plusieurs articles (du plus récent au moins récent)
    const { data: articles } = await supabase
      .from('articles')
      .select('id, url, title, created_at')
      .is('image_url', null)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (!articles || articles.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Aucun article sans image trouvé' })
      };
    }

    let processed = 0;
    let updated = 0;
    const results = [];

    for (let article of articles) {
      processed++;
      const imageUrl = await extractImageFromArticle(article.url);

      if (imageUrl) {
        const { error } = await supabase
          .from('articles')
          .update({ image_url: imageUrl })
          .eq('id', article.id);

        if (!error) {
          updated++;
          results.push({
            id: article.id,
            title: article.title,
            image_url: imageUrl,
            status: 'updated'
          });
        } else {
          results.push({
            id: article.id,
            title: article.title,
            status: 'error',
            error: error.message
          });
        }
      } else {
        results.push({
          id: article.id,
          title: article.title,
          status: 'no_image_found'
        });
      }

      // Pause pour éviter de surcharger
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary: {
          processed,
          updated,
          failed: processed - updated
        },
        results
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
