const Parser = require('rss-parser');
const parser = new Parser();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Bundle RSS.app URL unique
const BUNDLE_URL = 'https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml';

// Fonction pour extraire le domaine et déterminer la source (PRÉSERVÉE)
function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace('www.', '');
    
    // Map des domaines vers noms de sources (IDENTIQUE À L'ORIGINAL)
    const sourceMap = {
      'gabonreview.com': 'Gabon Review',
      'infogabon.ga': 'Info Gabon',
      'lalibreville.com': 'La Libreville',
      'gabon24.com': 'Gabon 24',
      'union.sonapresse.com': 'L\'Union',
      'gabon-eco.com': 'Gabon Eco',
      'actualite-gabon.com': 'Actualité Gabon',
      'sciencesetavenir.fr': 'Sciences et Avenir',
      'directinfosgabon.com': 'Direct Infos Gabon',
      'gabonactu.com': 'Gabon Actu',
      'africaintelligence.fr': 'Africa Intelligence',
      'gabon24.tv': 'Gabon 24 TV',
      'focusgroupemedia.com': 'Focus Groupe Media',
      'gabonmediatime.com': 'Gabon Media Time',
      'facebook.com': 'Facebook',
      'echosdeleco.com': 'Echos de l\'Eco',
      'agpgabon.ga': 'AGP Gabon',
      'leconfidentiel.ga': 'Le Confidentiel'
    };
    
    return sourceMap[domain] || domain;
  } catch (error) {
    return 'Source inconnue';
  }
}

// Fonction pour extraire la catégorie (PRÉSERVÉE)
function extractCategory(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  
  if (text.match(/\b(sport|football|basket|rugby|tennis|olympique|copa|can|coupe|match|équipe|joueur)\b/)) {
    return 'Sports';
  }
  if (text.match(/\b(économie|business|entreprise|banque|finance|investissement|commerce|marché|économique)\b/)) {
    return 'Économie';
  }
  if (text.match(/\b(politique|gouvernement|président|ministre|assemblée|sénat|élection|parti|opposition)\b/)) {
    return 'Politique';
  }
  if (text.match(/\b(santé|médical|hôpital|médecin|maladie|coronavirus|covid|vaccination|pharmacie)\b/)) {
    return 'Santé';
  }
  if (text.match(/\b(culture|musique|cinéma|festival|artiste|concert|théâtre|livre|exposition)\b/)) {
    return 'Culture';
  }
  if (text.match(/\b(éducation|école|université|étudiant|professeur|formation|enseignement)\b/)) {
    return 'Éducation';
  }
  if (text.match(/\b(technologie|numérique|internet|digital|innovation|startup|tech)\b/)) {
    return 'Tech';
  }
  
  return 'Actualités';
}

// 🚀 NOUVELLE FONCTION MCP FETCH - Extraction d'images optimisée
async function extractImageWithMCP(articleUrl, source) {
  try {
    console.log(`🔍 [MCP-ENHANCED] Extraction image pour ${source}: ${articleUrl}`);
    
    // Import node-fetch pour compatibilité Netlify
    let fetch;
    if (typeof globalThis.fetch === 'undefined') {
      fetch = require('node-fetch');
    } else {
      fetch = globalThis.fetch;
    }
    
    // Simuler l'appel MCP fetch en utilisant directement fetch avec parsing intelligent
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.warn(`⚠️ [MCP-ENHANCED] Fetch failed (${response.status}) for ${articleUrl}, falling back to direct fetch`);
      return await extractImageDirectFetch(articleUrl, source);
    }

    const html = await response.text();
    
    // Parsing intelligent du HTML pour extraire les images
    const imageUrls = extractImageUrlsFromHTML(html, articleUrl, source);
    
    if (imageUrls.length > 0) {
      const bestImage = selectBestImage(imageUrls, source);
      console.log(`✅ [MCP-ENHANCED] Image extraite via parsing intelligent: ${bestImage}`);
      return bestImage;
    }

    // Fallback vers extraction directe si parsing intelligent ne trouve rien
    console.log(`🔄 [MCP-ENHANCED] Fallback vers extraction directe pour ${articleUrl}`);
    return await extractImageDirectFetch(articleUrl, source);

  } catch (error) {
    console.error(`❌ [MCP-ENHANCED] Erreur MCP pour ${articleUrl}:`, error.message);
    // Fallback vers extraction directe
    return await extractImageDirectFetch(articleUrl, source);
  }
}

// Fonction pour extraire les URLs d'images depuis le HTML avec parsing intelligent
function extractImageUrlsFromHTML(html, articleUrl, source) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const imageUrls = [];
  
  // Stratégies d'extraction par ordre de priorité
  const strategies = [
    // 1. Open Graph et Twitter Cards (priorité maximale)
    () => {
      const ogImage = $('meta[property="og:image"]').attr('content');
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      return [ogImage, twitterImage].filter(Boolean);
    },
    
    // 2. Images spécifiques par source
    () => {
      const sourceSpecific = [];
      
      if (source.includes('Info Gabon')) {
        sourceSpecific.push(
          $('.wp-post-image').attr('src'),
          $('.post-thumbnail img').attr('src'),
          $('.featured-image img').attr('src')
        );
      }
      
      if (source.includes('Gabon Actu')) {
        sourceSpecific.push(
          $('.post-header img').attr('src'),
          $('.entry-content img:first').attr('src'),
          $('.wp-post-image').attr('src')
        );
      }
      
      if (source.includes('Le Confidentiel')) {
        sourceSpecific.push(
          $('.single-post-thumb img').attr('src'),
          $('.wp-post-image').attr('src'),
          $('.post-thumbnail img').attr('src')
        );
      }
      
      if (source.includes('Facebook')) {
        sourceSpecific.push(
          $('div[data-ft] img').attr('src'),
          $('.story_body_container img').attr('src'),
          $('.userContentWrapper img').attr('src')
        );
      }
      
      return sourceSpecific.filter(Boolean);
    },
    
    // 3. Sélecteurs génériques WordPress
    () => {
      return [
        $('.wp-post-image').attr('src'),
        $('.post-thumbnail img').attr('src'),
        $('.featured-image img').attr('src'),
        $('.entry-content img:first').attr('src'),
        $('article img:first').attr('src'),
        $('img[src*="wp-content"]:first').attr('src')
      ].filter(Boolean);
    },
    
    // 4. Toutes les images avec data-src (lazy loading)
    () => {
      const lazySrcs = [];
      $('img[data-src]').each((i, el) => {
        const dataSrc = $(el).attr('data-src');
        if (dataSrc) lazySrcs.push(dataSrc);
      });
      return lazySrcs;
    },
    
    // 5. Fallback - première image valide trouvée
    () => {
      const fallbackSrcs = [];
      $('img[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
          fallbackSrcs.push(src);
        }
      });
      return fallbackSrcs.slice(0, 5); // Limiter à 5 pour performance
    }
  ];
  
  // Appliquer les stratégies dans l'ordre
  strategies.forEach(strategy => {
    try {
      const urls = strategy();
      urls.forEach(url => {
        if (url) {
          // Nettoyer et normaliser l'URL
          let cleanUrl = url.replace(/['"]/g, '').trim();
          
          // Convertir URL relative en absolue
          if (cleanUrl.startsWith('/')) {
            try {
              const baseUrl = new URL(articleUrl);
              cleanUrl = `${baseUrl.protocol}//${baseUrl.host}${cleanUrl}`;
            } catch (e) {
              return;
            }
          }
          
          // Valider l'image
          if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) && 
              !cleanUrl.includes('icon') && 
              !cleanUrl.includes('logo') &&
              !cleanUrl.includes('avatar') &&
              !cleanUrl.includes('placeholder') &&
              cleanUrl.length > 20) {
            imageUrls.push(cleanUrl);
          }
        }
      });
    } catch (e) {
      console.warn(`⚠️ [MCP-ENHANCED] Erreur stratégie extraction:`, e.message);
    }
  });

  return [...new Set(imageUrls)]; // Supprimer les doublons
}

// Fonction pour sélectionner la meilleure image
function selectBestImage(imageUrls, source) {
  if (imageUrls.length === 0) return null;
  
  // Priorités par source
  const priorities = {
    'facebook.com': ['fbcdn.net', 'scontent'],
    'gabonactu.com': ['gabonactu.com'],
    'infogabon.ga': ['infogabon.ga'],
    'leconfidentiel.ga': ['leconfidentiel.ga']
  };
  
  // Chercher les images prioritaires pour cette source
  const sourceDomain = Object.keys(priorities).find(domain => source.toLowerCase().includes(domain.split('.')[0]));
  if (sourceDomain) {
    const preferredDomains = priorities[sourceDomain];
    for (const domain of preferredDomains) {
      const preferredImage = imageUrls.find(url => url.includes(domain));
      if (preferredImage) return preferredImage;
    }
  }
  
  // Éviter les images Unsplash pour certaines sources
  const avoidUnsplash = ['Info Gabon', 'Gabon Actu', 'Direct Infos Gabon', 'Le Confidentiel'];
  if (avoidUnsplash.includes(source)) {
    const nonUnsplashImages = imageUrls.filter(url => !url.includes('unsplash.com'));
    if (nonUnsplashImages.length > 0) {
      return nonUnsplashImages[0];
    }
  }
  
  // Prendre la première image valide
  return imageUrls[0];
}

// Fonction de fallback - extraction directe (VERSION SIMPLIFIÉE DE L'ORIGINAL)
async function extractImageDirectFetch(articleUrl, source) {
  try {
    // Import compatible node-fetch
    let fetch;
    if (typeof globalThis.fetch === 'undefined') {
      fetch = require('node-fetch');
    } else {
      fetch = globalThis.fetch;
    }
    
    const cheerio = require('cheerio');
    
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 8000
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Sélecteurs universels pour images
    const selectors = [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      '.wp-post-image',
      '.post-thumbnail img',
      '.featured-image img',
      '.entry-content img:first',
      'article img:first',
      'img[src*="wp-content"]'
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        let imageUrl = selector.includes('meta') 
          ? element.attr('content')
          : element.attr('src') || element.attr('data-src');
        
        if (imageUrl) {
          // Convertir URL relative en absolue
          if (imageUrl.startsWith('/')) {
            const baseUrl = new URL(articleUrl);
            imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
          }
          
          if (imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) &&
              !imageUrl.includes('icon') && !imageUrl.includes('logo')) {
            return imageUrl;
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`❌ [DIRECT-FETCH] Erreur extraction: ${error.message}`);
    return null;
  }
}

// Fonction pour traiter l'image avec proxy si nécessaire (PRÉSERVÉE ET AMÉLIORÉE)
async function processImageUrl(imageUrl, link, source) {
  // Si pas d'image du RSS, essayer l'extraction MCP
  if (!imageUrl) {
    console.log(`🚀 [MCP-ENHANCED] Pas d'image RSS, extraction MCP pour: ${source}`);
    const extractedImage = await extractImageWithMCP(link, source);
    if (extractedImage) {
      // Déterminer si proxy nécessaire
      if (needsProxy(extractedImage, source)) {
        return `/.netlify/functions/image-proxy?url=${encodeURIComponent(extractedImage)}`;
      }
      return extractedImage;
    }
    return null;
  }
  
  // Logique existante préservée
  try {
    const articleUrl = new URL(link);
    const imageUrlObj = new URL(imageUrl);
    
    // Détecter les images Unsplash problématiques
    if (imageUrlObj.hostname.includes('unsplash.com')) {
      if (['Info Gabon', 'Gabon Actu', 'Direct Infos Gabon', 'Le Confidentiel'].includes(source)) {
        console.warn(`🚨 Image Unsplash détectée pour ${source}: ${imageUrl} - extraction MCP`);
        const extractedImage = await extractImageWithMCP(link, source);
        if (extractedImage) {
          if (needsProxy(extractedImage, source)) {
            return `/.netlify/functions/image-proxy?url=${encodeURIComponent(extractedImage)}`;
          }
          return extractedImage;
        }
        return null;
      }
    }
    
    // Logique proxy existante préservée
    if (needsProxy(imageUrl, source)) {
      return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    return imageUrl;
  } catch (error) {
    console.log('⚠️ URL image invalide:', imageUrl);
    return null;
  }
}

// Fonction pour déterminer si un proxy est nécessaire
function needsProxy(imageUrl, source) {
  try {
    const imageUrlObj = new URL(imageUrl);
    
    // Domaines nécessitant un proxy
    const proxyDomains = ['infogabon', 'gabonactu', 'leconfidentiel', 'fbcdn.net', 'scontent'];
    
    return proxyDomains.some(domain => 
      imageUrlObj.hostname.includes(domain) || 
      (source.includes('Facebook') && imageUrlObj.hostname.includes('facebook'))
    );
  } catch (error) {
    return false;
  }
}

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 [MCP-ENHANCED] Synchronisation RSS Bundle avec MCP démarrée');
    console.log('📡 Bundle URL:', BUNDLE_URL);

    // Étape 1: Parser le bundle RSS.app (IDENTIQUE)
    const feed = await parser.parseURL(BUNDLE_URL);
    console.log(`📄 Bundle parsé: ${feed.items.length} articles trouvés`);

    let newArticles = 0;
    let processedArticles = 0;
    let mcpEnhanced = 0;
    const errors = [];
    
    // Étape 2: Traiter chaque article avec MCP enhancement
    for (const item of feed.items) {
      try {
        processedArticles++;
        
        // Vérifier si l'article existe déjà (IDENTIQUE)
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('url', item.link)
          .single();

        if (existingArticle) {
          continue;
        }

        // Extraire les données de l'article (IDENTIQUE)
        const title = item.title || 'Titre non disponible';
        const content = item.contentSnippet || item.content || item.summary || '';
        const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        const source = extractSourceFromLink(item.link);
        const category = extractCategory(title, content);
        
        // 🚀 TRAITEMENT IMAGE AMÉLIORÉ AVEC MCP
        let finalImageUrl = null;
        let usedMcp = false;
        
        // Essayer d'abord les images du RSS
        if (item.enclosure?.url) {
          finalImageUrl = await processImageUrl(item.enclosure.url, item.link, source);
        } else if (item['media:content']?.url) {
          finalImageUrl = await processImageUrl(item['media:content'].url, item.link, source);
        }
        
        // Si pas d'image RSS ou image Unsplash, utiliser MCP
        if (!finalImageUrl || (finalImageUrl && finalImageUrl.includes('unsplash'))) {
          console.log(`🚀 [MCP-ENHANCED] Extraction MCP pour: ${source} - ${title.substring(0, 50)}...`);
          const mcpImage = await extractImageWithMCP(item.link, source);
          if (mcpImage) {
            finalImageUrl = needsProxy(mcpImage, source) 
              ? `/.netlify/functions/image-proxy?url=${encodeURIComponent(mcpImage)}`
              : mcpImage;
            usedMcp = true;
            mcpEnhanced++;
          }
        }

        // Insérer l'article (IDENTIQUE)
        const { data: insertedArticle, error } = await supabase
          .from('articles')
          .insert({
            external_id: `bundle-mcp-${Date.now()}-${Math.random()}`,
            title: title,
            summary: content.substring(0, 500),
            content: content,
            url: item.link,
            image_url: finalImageUrl,
            author: item.creator || item['dc:creator'] || 'Rédaction',
            published_at: pubDate,
            category: category,
            is_published: true,
            view_count: 0
          })
          .select('id')
          .single();

        if (error) {
          console.error('❌ Erreur insertion:', error.message);
          errors.push(`Erreur insertion: ${error.message}`);
        } else {
          newArticles++;
          const mcpFlag = usedMcp ? '[MCP]' : '';
          console.log(`✅ ${mcpFlag} Article ajouté: ${title.substring(0, 50)}...`);
          
          // Ajouter à la queue pour résumé IA différé (IDENTIQUE)
          if (insertedArticle?.id) {
            try {
              await supabase
                .from('pending_ai_summaries')
                .insert({
                  article_id: insertedArticle.id,
                  priority: 1,
                  status: 'pending',
                  created_at: new Date().toISOString()
                });
            } catch (queueError) {
              console.warn('⚠️ Erreur ajout queue IA:', queueError.message);
            }
          }
        }

        // Arrêt précoce si timeout approche (IDENTIQUE)
        const elapsed = Date.now() - startTime;
        if (elapsed > 15000) {
          console.log(`⏰ Arrêt précoce après ${elapsed}ms pour éviter timeout`);
          break;
        }

      } catch (articleError) {
        console.error('❌ Erreur traitement article:', articleError.message);
        errors.push(`Erreur article: ${articleError.message}`);
      }
    }

    // Étape 3: Log de synchronisation (AMÉLIORÉ)
    const duration = Date.now() - startTime;
    const { error: logError } = await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'bundle-mcp-enhanced',
        feeds_processed: 1,
        articles_extracted: newArticles,
        success_count: 1,
        error_count: errors.length,
        errors: errors,
        duration_ms: duration,
        ai_summaries_generated: 0,
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
      mcp_enhanced_images: mcpEnhanced,
      ai_summaries_generated: 0,
      duration_ms: duration,
      errors: errors,
      mode: 'mcp-enhanced',
      timestamp: new Date().toISOString()
    };

    console.log('🚀 [MCP-ENHANCED] Synchronisation terminée:', result);

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
    console.error('❌ [MCP-ENHANCED] Erreur critique:', error);
    
    const errorResult = {
      success: false,
      error: error.message,
      duration_ms: Date.now() - startTime,
      mode: 'mcp-enhanced',
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
