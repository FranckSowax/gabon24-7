const RSSParser = require('rss-parser');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const supabaseService = require('./supabase-config');
const OpenAIService = require('./openai-service');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');

class RSSProcessor {
  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GabonNews RSS Processor/1.0'
      }
    });
    this.openaiService = new OpenAIService();
    this.aiEnrichmentService = new ArticleAIEnrichment();
    this.supabaseService = supabaseService; // Stocker le service Supabase
    
    // Configuration de fréquence
    this.FETCH_INTERVAL_MINUTES = 60; // Récupération toutes les 60 minutes (économie tokens OpenAI)
    this.BATCH_SIZE = null; // Pas de limite - traiter TOUS les articles du jour
    this.isProcessing = false;
    this.lastUpdateTime = null; // Stocker l'heure de dernière mise à jour
  }

  /**
   * 🔄 RÉCUPÉRATION AUTOMATIQUE DES ARTICLES
   * Fréquence: Toutes les 60 minutes (optimisé pour économie OpenAI)
   */
  async startAutomaticProcessing() {
    console.log('🚀 Démarrage du processeur RSS automatique');
    console.log(`⏰ Fréquence: toutes les ${this.FETCH_INTERVAL_MINUTES} minutes (optimisé pour économie OpenAI)`);
    
    // Traitement initial
    await this.processAllFeeds();
    
    // Planification récurrente
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processAllFeeds();
      }
    }, this.FETCH_INTERVAL_MINUTES * 60 * 1000);
  }

  /**
   * 📡 TRAITEMENT DE TOUS LES FLUX RSS
   */
  async processAllFeeds() {
    if (this.isProcessing) {
      console.log('⏳ Traitement déjà en cours, ignoré');
      return;
    }

    this.isProcessing = true;
    console.log('\n🔄 === DÉBUT DU CYCLE DE TRAITEMENT RSS ===');
    
    try {
      // Récupérer tous les flux RSS actifs
      const feeds = await this.getRSSFeeds();
      console.log(`📡 ${feeds.length} flux RSS à traiter`);

      let totalNewArticles = 0;

      for (const feed of feeds) {
        try {
          const newArticles = await this.processFeed(feed);
          totalNewArticles += newArticles;
          
          // Pause entre les flux pour éviter la surcharge
          await this.sleep(2000);
        } catch (error) {
          console.error(`❌ Erreur traitement flux ${feed.name}:`, error.message);
        }
      }

      console.log(`✅ Cycle terminé: ${totalNewArticles} nouveaux articles traités`);
      
      // Mettre à jour l'heure de dernière mise à jour
      this.lastUpdateTime = new Date();
      
    } catch (error) {
      console.error('❌ Erreur cycle RSS:', error);
    } finally {
      this.isProcessing = false;
      console.log('🔄 === FIN DU CYCLE DE TRAITEMENT RSS ===\n');
    }
  }

  /**
   * 📰 TRAITEMENT D'UN FLUX RSS SPÉCIFIQUE
   */
  async processFeed(feed) {
    console.log(`\n📡 Traitement: ${feed.name}`);
    
    try {
      // Parser le flux RSS
      const rssFeed = await this.parser.parseURL(feed.url);
      
      if (!rssFeed.items || rssFeed.items.length === 0) {
        console.log(`⚠️  Aucun article dans ${feed.name}`);
        return 0;
      }

      console.log(`📊 ${rssFeed.items.length} articles trouvés dans ${feed.name}`);
      
      let newArticlesCount = 0;
      
      // Traiter TOUS les articles (pas de limite)
      // Filtrer pour ne traiter que les articles du jour courant
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      const recentItems = rssFeed.items.filter(item => {
        if (!item.pubDate && !item.isoDate) return true; // Traiter si pas de date
        const itemDate = new Date(item.pubDate || item.isoDate);
        return itemDate >= yesterday; // Articles des dernières 24h
      });
      
      console.log(`📊 ${recentItems.length}/${rssFeed.items.length} articles récents à traiter`);
      
      // Traiter chaque article récent
      for (const item of recentItems) {
        try {
          const isNew = await this.processArticle(item, feed);
          if (isNew) newArticlesCount++;
        } catch (error) {
          console.error(`❌ Erreur article:`, error.message);
        }
      }

      console.log(`✅ ${feed.name}: ${newArticlesCount} nouveaux articles`);
      return newArticlesCount;
      
    } catch (error) {
      console.error(`❌ Erreur parsing ${feed.name}:`, error.message);
      return 0;
    }
  }

  /**
   * 📄 TRAITEMENT D'UN ARTICLE INDIVIDUEL
   * - Vérification de duplicata
   * - Extraction d'image
   * - Génération de résumé IA
   * - Sauvegarde en base
   */
  async processArticle(item, feed) {
    // Créer un hash unique pour détecter les doublons
    const articleHash = this.generateArticleHash(item.title, item.link);
    
    // Vérifier si l'article existe déjà
    const exists = await this.articleExists(articleHash);
    if (exists) {
      return false; // Article déjà traité
    }

    console.log(`📝 Nouveau: "${item.title?.substring(0, 50)}..."`);

    // 🔍 DÉTECTION DE CONTENU INSUFFISANT (FetchRSS, etc.)
    const hasInsufficientContent = this.hasInsufficientRSSContent(item);
    let enrichedContent = null;
    let webScrapedImage = null;

    if (hasInsufficientContent && item.link) {
      console.log(`🌐 Contenu RSS insuffisant, scraping web: ${item.link}`);
      enrichedContent = await this.scrapeFullArticleContent(item.link);
    }

    // 🖼️ EXTRACTION D'IMAGE (RSS + Web Scraping + FetchRSS)
    let imageUrl = await this.extractImageFromArticle(item, feed);
    
    // Si pas d'image trouvée et contenu enrichi disponible, utiliser l'image scrapée
    if (!imageUrl && enrichedContent?.image) {
      imageUrl = enrichedContent.image;
      console.log(`🖼️ Image récupérée via web scraping: ${imageUrl}`);
    }
    
    // Traitement spécial pour FetchRSS et Gabon Media Time - forcer le scraping si pas d'image
    if (!imageUrl && item.link && 
        ((feed.url && feed.url.includes('fetchrss.com')) || 
         (feed.name && feed.name.includes('Gabon Media Time')) ||
         item.link.includes('gabonmediatime.com'))) {
      console.log('🔍 FetchRSS/Gabon Media Time: Tentative de scraping forcé pour image');
      imageUrl = await this.scrapeImageFromWebPage(item.link);
      if (imageUrl) {
        console.log(`🖼️ Image récupérée via scraping forcé: ${imageUrl}`);
      }
    }
    
    // 📘 Traitement spécial pour Facebook - scraper les vraies images
    if (!imageUrl && item.link && item.link.includes('facebook.com')) {
      console.log('📘 Article Facebook détecté, tentative de scraping spécial');
      imageUrl = await this.scrapeFacebookImage(item.link);
      
      // Fallback vers placeholder si échec
      if (!imageUrl) {
        console.log('⚠️ Scraping Facebook échoué, utilisation placeholder');
        imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/1024px-Facebook_Logo_%282019%29.png';
      }
    }
    
    // 📝 PRÉPARATION DU CONTENU POUR IA
    const contentForAI = enrichedContent?.content || item.contentSnippet || item.content || item.description || '';
    const summaryForDisplay = enrichedContent?.summary || item.contentSnippet || item.description || '';
    
    // 📝 RÉSUMÉ SIMPLE (sans OpenAI pour économiser les appels API)
    const aiSummary = this.generateSimpleSummary(item.title, contentForAI);
    
    // 🏷️ ANALYSE DE SENTIMENT
    const sentiment = this.analyzeSentiment(item.title, contentForAI);
    
    // 🔑 EXTRACTION DE MOTS-CLÉS
    const keywords = this.extractKeywords(item.title, contentForAI);

    // 👤 EXTRACTION INTELLIGENTE DE L'AUTEUR/JOURNALISTE
    const author = enrichedContent?.author || this.extractAuthor(item, feed.name);
    
    // ⏱️ CALCUL DE LA DURÉE RÉELLE DE LECTURE
    const readTimeMinutes = this.calculateReadTime(enrichedContent?.content || item.content || item.contentSnippet || item.summary || '');

    // 📅 EXTRACTION DE DATE AMÉLIORÉE POUR TOUS LES SITES
    let publishedDate = item.pubDate || item.isoDate;
    let originalDateFound = false;
    
    // Extraction intelligente pour tous les sites gabonais
    if (item.link && (
      item.link.includes('union.sonapresse.com') || 
      item.link.includes('gabon-insight.com') ||
      item.link.includes('gabonactu.com') ||
      item.link.includes('rfi.fr') ||
      item.link.includes('gabonallsport.com') ||
      item.link.includes('kongossanews.info') ||
      item.link.includes('infosgabon.com') ||
      item.link.includes('agpgabon.ga') ||
      item.link.includes('gabonmediatime.com') ||
      item.link.includes('directinfosgabon.com')
    )) {
      try {
        if (enrichedContent?.html) {
          const datePatterns = [
            // Meta tags Open Graph et Schema.org
            /<meta[^>]*property=["']*article:published_time["']*[^>]*content=["'](.*?)["'][^>]*>/i,
            /<meta[^>]*name=["']*publish[^"']*date["']*[^>]*content=["'](.*?)["'][^>]*>/i,
            /<meta[^>]*name=["']*date["']*[^>]*content=["'](.*?)["'][^>]*>/i,
            /"datePublished"\s*:\s*["'](.*?)["']/i,
            /"dateCreated"\s*:\s*["'](.*?)["']/i,
            
            // Balises HTML5 time
            /<time[^>]*datetime=["'](.*?)["'][^>]*>/i,
            /<time[^>]*pubdate[^>]*datetime=["'](.*?)["'][^>]*>/i,
            
            // Sélecteurs CSS spécifiques par site
            /class=["']date["'][^>]*>([^<]+)</i,
            /class=["']published["'][^>]*>([^<]+)</i,
            /class=["']post-date["'][^>]*>([^<]+)</i,
            /class=["']entry-date["'][^>]*>([^<]+)</i,
            
            // Patterns textuels français
            /Publié le (\d{1,2}\/\d{1,2}\/\d{4})/i,
            /Le (\d{1,2} [a-zàéèêç]+ \d{4})/i,
            /(\d{1,2} [a-zàéèêç]+ \d{4})/i,
            /(\d{1,2}\/\d{1,2}\/\d{4})/i,
            
            // Patterns ISO et RFC
            /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i,
            /(\d{4}-\d{2}-\d{2})/i
          ];
          
          for (const pattern of datePatterns) {
            const match = enrichedContent.html.match(pattern);
            if (match) {
              try {
                let dateStr = match[1];
                
                // Conversion mois français
                const frenchMonths = {
                  'janvier': 'January', 'février': 'February', 'mars': 'March', 'avril': 'April',
                  'mai': 'May', 'juin': 'June', 'juillet': 'July', 'août': 'August',
                  'septembre': 'September', 'octobre': 'October', 'novembre': 'November', 'décembre': 'December'
                };
                
                for (const [french, english] of Object.entries(frenchMonths)) {
                  dateStr = dateStr.replace(new RegExp(french, 'i'), english);
                }
                
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2020) {
                  publishedDate = parsedDate.toISOString();
                  originalDateFound = true;
                  console.log(`📅 Date originale extraite: ${publishedDate} pour ${item.title?.substring(0, 50)}...`);
                  break;
                }
              } catch (e) {
                // Continuer avec la date RSS par défaut
              }
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Erreur extraction date pour ${item.title}: ${error.message}`);
      }
    }

    // 🤖 DÉTECTION INTELLIGENTE DE DATE AVEC OpenAI si date douteuse
    if (!originalDateFound && publishedDate) {
      const dateForAnalysis = new Date(publishedDate);
      const now = new Date();
      const hoursDiff = Math.abs(now.getTime() - dateForAnalysis.getTime()) / (1000 * 60 * 60);
      
      // Si la date semble suspecte (trop ancienne ou future), utiliser OpenAI
      if (hoursDiff > 168 || dateForAnalysis > now) { // Plus de 7 jours ou dans le futur
        console.log(`🤖 Date suspecte détectée, analyse OpenAI: ${publishedDate}`);
        const aiExtractedDate = await this.extractDateWithOpenAI(item.title, item.content || item.contentSnippet || '', item.link);
        if (aiExtractedDate) {
          publishedDate = aiExtractedDate;
          console.log(`✅ Date corrigée par OpenAI: ${publishedDate}`);
        }
      }
    }

    // 🏷️ EXTRACTION INTELLIGENTE DE LA CATÉGORIE
    const extractedCategory = this.extractCategory(item, feed);
    
    // 🤖 ENRICHISSEMENT IA SYSTÉMATIQUE
    // Génère: ai_category, ai_sentiment, ai_importance, ai_is_breaking
    console.log('🤖 Enrichissement IA en cours...');
    const aiEnrichment = await this.aiEnrichmentService.enrichArticle(
      item.title || 'Titre non disponible',
      enrichedContent?.content || item.content || item.contentSnippet || '',
      summaryForDisplay || aiSummary || ''
    );
    
    // 📊 CRÉATION DE L'OBJET ARTICLE ENRICHI
    const article = {
      feed_id: feed.id,
      external_id: item.guid || item.id || articleHash,
      title: item.title || 'Titre non disponible',
      content: enrichedContent?.content || item.content || item['content:encoded'] || item.contentSnippet || '',
      summary: this.cleanAndCompleteSummary(summaryForDisplay || 'Résumé non disponible'),
      summary_ai: aiSummary, // Corrigé: summary_ai est le bon nom
      url: item.link,
      image_url: imageUrl || null,
      author: author,
      published_at: publishedDate || new Date().toISOString(),
      // 🎯 PRIORITÉ: Catégorie IA > Catégorie RSS
      category: aiEnrichment.ai_category || extractedCategory,
      keywords: keywords,
      sentiment: sentiment,
      read_time_minutes: readTimeMinutes,
      is_published: true
    };

    // 💾 SAUVEGARDE EN BASE DE DONNÉES
    try {
      const result = await this.saveArticle(article);
      if (result.error) {
        console.error(`❌ Erreur sauvegarde: ${result.error}`);
        return false;
      }
      console.log(`✅ Sauvegardé: "${article.title.substring(0, 30)}..."`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur sauvegarde:`, error.message);
      return false;
    }
  }

  /**
   * 💾 SAUVEGARDE D'ARTICLE EN BASE DE DONNÉES
   */
  async saveArticle(article) {
    try {
      console.log('💾 Insertion article dans Supabase...');
      
      // Insertion directe avec métadonnées IA
      const { data, error } = await supabaseService.supabase
        .from('articles')
        .insert({
          feed_id: article.feed_id,
          external_id: article.external_id,
          title: article.title,
          summary: article.summary || '',
          summary_ai: article.summary_ai || '', // Corrigé: summary_ai est le bon nom
          url: article.url,
          image_urls: article.image_url ? [article.image_url] : [], // Corrigé: image_urls est un array
          author: article.author || 'Rédaction',
          published_at: article.published_at,
          category: article.category || 'Actualités',
          sentiment: article.sentiment || 'neutre',
          read_time_minutes: article.read_time_minutes || 3,
          is_published: article.is_published !== false,
          // 🤖 Métadonnées IA enrichies (colonnes renommées après restructuration)
          // Note: Les valeurs IA sont déjà dans category, sentiment, keywords ci-dessus
        })
        .select()
        .single();
      
      if (error) {
        // Ignorer les erreurs de duplicata (external_id unique)
        if (error.message?.includes('duplicate') || error.code === '23505') {
          console.log('⚠️  Article déjà existant (duplicata)');
          return { data: null, error: 'duplicate' };
        }
        throw new Error(error.message);
      }
      
      if (data) {
        console.log(`✅ Article sauvegardé avec métadonnées IA`);
        if (article.image_url) {
          console.log('🖼️  Image:', article.image_url.substring(0, 60) + '...');
        }
        console.log(`🤖 IA: ${article.ai_category} | Sentiment: ${article.ai_sentiment?.toFixed(2)} | Importance: ${article.ai_importance?.toFixed(2)} | Breaking: ${article.ai_is_breaking ? 'Oui' : 'Non'}`);
        if (article.ai_keywords && article.ai_keywords.length > 0) {
          console.log(`🔑 Keywords IA: ${article.ai_keywords.slice(0, 5).join(', ')}${article.ai_keywords.length > 5 ? '...' : ''}`);
        }
        return { data, error: null };
      }
      
      return { data: null, error: 'Pas de données retournées' };
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde article:', error.message);
      
      // Log pour debug avec image info
      console.log('📄 Article (échec sauvegarde):', {
        title: article.title.substring(0, 50),
        summary: article.summary?.substring(0, 50) + '...',
        has_image: !!article.image_url,
        image_url: article.image_url?.substring(0, 50) + '...'
      });
      
      return { data: null, error: error.message };
    }
  }

  /**
   * 🖼️ EXTRACTION D'IMAGE PRINCIPALE DEPUIS L'ARTICLE RSS
   * Recherche intelligente de l'image principale dans plusieurs sources
   */
  async extractImageFromArticle(item, feed = null) {
    try {
      // Médias nécessitant un scraping web prioritaire (faible taux d'extraction RSS)
      const scrapingPriorityFeeds = [
        'fetchrss.com',
        'Gabon Media Time', 
        'AGP',
        'Gabon Actu',
        'Gabonews', 
        'RFI - Gabon',
        'Gabon All Sport',
        'Kongossa News',
        'Infos Gabon',
        'L\'Union',
        'Direct Infos Gabon',
        'Echos de l\'eco',
        'Vox Populi 241'
      ];
      
      const needsScraping = scrapingPriorityFeeds.some(feedPattern => 
        (feed && (feed.url.includes(feedPattern) || feed.name.includes(feedPattern))) ||
        (item.link && (
          item.link.includes('gabonmediatime.com') ||
          item.link.includes('agpgabon.ga') ||
          item.link.includes('gabonactu.com') ||
          item.link.includes('gabon-insight.com') ||
          item.link.includes('rfi.fr') ||
          item.link.includes('gabonallsport.com') ||
          item.link.includes('kongossanews.info') ||
          item.link.includes('infosgabon.com')
        ))
      );
      
      if (needsScraping) {
        const scrapedImage = await this.scrapeImageFromWebPage(item.link);
        if (scrapedImage) {
          console.log(`🖼️ Image récupérée via scraping pour ${feed?.name || 'Unknown'}: ${scrapedImage}`);
          return this.validateAndCleanImageUrl(scrapedImage);
        }
      }
      
      // 2. Chercher dans enclosure (priorité haute pour les flux RSS standards)
      if (item.enclosure && item.enclosure.url) {
        const enclosureUrl = item.enclosure.url;
        if (this.isQualityImage(enclosureUrl)) {
          imageUrl = enclosureUrl;
          console.log('🖼️ Image trouvée via enclosure:', imageUrl);
          return this.validateAndCleanImageUrl(imageUrl);
        }
      } // 2. Chercher dans media:content (RSS 2.0 Media)
      if (item['media:content']) {
        if (Array.isArray(item['media:content'])) {
          for (const media of item['media:content']) {
            if (media.$ && media.$.url && media.$.medium === 'image') {
              imageUrl = media.$.url;
              console.log('🖼️ Image trouvée via media:content array:', imageUrl);
              return this.validateAndCleanImageUrl(imageUrl);
            }
          }
        } else if (item['media:content'].$ && item['media:content'].$.url) {
          imageUrl = item['media:content'].$.url;
          console.log('🖼️ Image trouvée via media:content:', imageUrl);
          return this.validateAndCleanImageUrl(imageUrl);
        }
      }

      // 4. Chercher dans media:thumbnail
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
        console.log('🖼️ Image trouvée via media:thumbnail:', imageUrl);
        return this.validateAndCleanImageUrl(imageUrl);
      }

      // 5. Chercher dans le contenu HTML - première image de qualité
      if (item.content || item['content:encoded']) {
        const content = item.content || item['content:encoded'];
        const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
        
        if (imgMatches) {
          for (const imgTag of imgMatches) {
            const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
            if (srcMatch && srcMatch[1]) {
              const potentialUrl = srcMatch[1];
              
              // Filtrer les images de mauvaise qualité
              if (this.isQualityImage(potentialUrl)) {
                imageUrl = potentialUrl;
                console.log('🖼️ Image trouvée via contenu HTML:', imageUrl);
                return this.validateAndCleanImageUrl(imageUrl);
              }
            }
          }
        }
      }

      // 6. Chercher dans le résumé/description
      if (item.contentSnippet || item.description) {
        const snippet = item.contentSnippet || item.description;
        const imgMatch = snippet.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1] && this.isQualityImage(imgMatch[1])) {
          imageUrl = imgMatch[1];
          console.log('🖼️ Image trouvée via snippet:', imageUrl);
          return this.validateAndCleanImageUrl(imageUrl);
        }
      }

      // 7. Chercher dans les propriétés Open Graph si disponibles
      if (item['og:image']) {
        imageUrl = item['og:image'];
        console.log('🖼️ Image trouvée via Open Graph:', imageUrl);
        return this.validateAndCleanImageUrl(imageUrl);
      }

      // 8. FALLBACK : Scraper la page web de l'article pour trouver l'image principale
      if (item.link && (!feed || !feed.url || !feed.url.includes('fetchrss.com'))) {
        console.log('🔍 Tentative de scraping web pour:', item.title?.substring(0, 30));
        imageUrl = await this.scrapeImageFromWebPage(item.link);
        if (imageUrl) {
          console.log('🖼️ Image trouvée via web scraping:', imageUrl);
          return this.validateAndCleanImageUrl(imageUrl);
        }
      }

      console.log('⚠️ Aucune image trouvée pour:', item.title?.substring(0, 50));
      return null;
      
    } catch (error) {
      console.error('❌ Erreur extraction image:', error.message);
      return null;
    }
  }

  /**
   * 📘 SCRAPER IMAGE FACEBOOK AVEC USER-AGENT SPÉCIAL
   */
  async scrapeFacebookImage(url) {
    try {
      console.log(`📘 Scraping Facebook: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Referer': 'https://www.facebook.com/',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Open Graph (meilleur pour Facebook)
      let imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        console.log(`📘 Image Facebook trouvée: ${imageUrl}`);
        return imageUrl;
      }
      
      // Twitter Card fallback
      imageUrl = $('meta[name="twitter:image"]').attr('content');
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        return imageUrl;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Erreur scraping Facebook: ${error.message}`);
      return null;
    }
  }

  /**
   * 🌐 SCRAPING WEB POUR EXTRACTION D'IMAGE PRINCIPALE
   * Fallback quand l'image n'est pas dans le flux RSS
   */
  async scrapeImageFromWebPage(url) {
    try {
      console.log(`🌐 Scraping image from: ${url}`);
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Priorité aux métadonnées Open Graph
      let imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        console.log(`🖼️ Image trouvée via Open Graph: ${imageUrl}`);
        return this.normalizeImageUrl(imageUrl, url);
      }

      // Twitter Card comme fallback
      imageUrl = $('meta[name="twitter:image"]').attr('content');
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        console.log(`🖼️ Image trouvée via Twitter Card: ${imageUrl}`);
        return this.normalizeImageUrl(imageUrl, url);
      }

      // Sélecteurs spécifiques optimisés par domaine
      let prioritySelectors = [];
      
      if (url.includes('gabonactu.com')) {
        prioritySelectors = [
          '.post-thumbnail img',
          '.featured-image img',
          '.wp-post-image',
          'article .entry-content img:first-of-type',
          '.single-featured img'
        ];
      } else if (url.includes('gabon-insight.com')) {
        prioritySelectors = [
          '.article-image img',
          '.post-image img',
          '.content img:first-of-type',
          '.td-post-featured-image img'
        ];
      } else if (url.includes('rfi.fr')) {
        prioritySelectors = [
          '.article-media img',
          '.m-figure img',
          '.article-content img:first-of-type',
          '.t-content__media img'
        ];
      } else if (url.includes('gabonallsport.com')) {
        prioritySelectors = [
          '.featured-image img',
          '.post-thumbnail img',
          '.article-image img',
          '.entry-thumb img'
        ];
      } else if (url.includes('union.sonapresse.com') || url.includes('lunion')) {
        prioritySelectors = [
          '.article-featured-image img',
          '.post-thumbnail img',
          '.entry-image img',
          'article img:first-of-type'
        ];
      } else if (url.includes('directinfosgabon')) {
        prioritySelectors = [
          '.td-post-featured-image img',
          '.entry-thumb img',
          '.post-thumbnail img'
        ];
      } else {
        // Sélecteurs génériques améliorés
        prioritySelectors = [
          'meta[property="og:image"]',
          'meta[name="twitter:image"]',
          'img[class*="featured"]',
          'img[class*="main"]',
          'img[class*="hero"]',
          '.wp-post-image',
          '.attachment-post-thumbnail',
          'article img:first-of-type',
          '.post-content img:first-of-type',
          '.entry-content img:first-of-type',
          'main img:first-of-type'
        ];
      }

      for (const selector of prioritySelectors) {
        const img = $(selector).first();
        if (img.length) {
          imageUrl = img.attr('src') || img.attr('data-src');
          if (imageUrl && this.isValidImageUrl(imageUrl)) {
            console.log(`🖼️ Image trouvée via sélecteur ${selector}: ${imageUrl}`);
            return this.normalizeImageUrl(imageUrl, url);
          }
        }
      }

      console.log(`❌ Aucune image valide trouvée sur: ${url}`);
      return null;
    } catch (error) {
      console.error(`❌ Erreur lors du scraping de ${url}:`, error.message);
      return null;
    }
  }

  /**
   * 🔗 CONVERSION URL RELATIVE EN ABSOLUE
   */
  makeAbsoluteUrl(imageUrl, baseUrl) {
    try {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      
      const base = new URL(baseUrl);
      if (imageUrl.startsWith('//')) {
        return base.protocol + imageUrl;
      }
      if (imageUrl.startsWith('/')) {
        return base.origin + imageUrl;
      }
      
      return new URL(imageUrl, baseUrl).href;
    } catch (error) {
      return imageUrl;
    }
  }

  /**
   * 🔍 VALIDATION ET NETTOYAGE URL IMAGE
   */
  validateAndCleanImageUrl(url) {
    if (!url) return null;
    
    // Nettoyer l'URL
    url = url.trim();
    
    // Vérifier si c'est une URL valide
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }
    
    // Vérifier l'extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasValidExtension = validExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
    
    if (!hasValidExtension) {
      // Accepter quand même si l'URL semble être une image
      if (!url.includes('image') && !url.includes('photo') && !url.includes('img')) {
        return null;
      }
    }
    
    return url;
  }

  /**
   * 🎯 VÉRIFICATION QUALITÉ IMAGE
   */
  isQualityImage(url) {
    if (!url) return false;
    
    const lowQualityIndicators = [
      'avatar', 'icon', 'logo', 'button', 'badge', 'pixel',
      'spacer', 'transparent', '1x1', 'tracking'
    ];
    
    const urlLower = url.toLowerCase();
    
    // Rejeter les images de mauvaise qualité
    if (lowQualityIndicators.some(indicator => urlLower.includes(indicator))) {
      return false;
    }
    
    // Rejeter les images trop petites (si dimensions dans l'URL)
    const sizeMatch = url.match(/(\d+)x(\d+)/);
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      if (width < 200 || height < 150) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 👤 EXTRACTION INTELLIGENTE DE L'AUTEUR/JOURNALISTE
   * Recherche l'auteur dans plusieurs champs RSS
   */
  extractAuthor(item, feedName) {
    try {
      // 1. Champs standards RSS
      if (item.creator && item.creator.trim()) {
        return this.cleanAuthorName(item.creator);
      }
      
      if (item.author && item.author.trim()) {
        return this.cleanAuthorName(item.author);
      }

      // 2. Champs Dublin Core
      if (item['dc:creator'] && item['dc:creator'].trim()) {
        return this.cleanAuthorName(item['dc:creator']);
      }

      // 3. Chercher dans le contenu
      if (item.content || item['content:encoded']) {
        const content = item.content || item['content:encoded'];
        
        // Patterns pour détecter l'auteur
        const authorPatterns = [
          /Par\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          /By\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          /Auteur\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          /Journaliste\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          /Rédacteur\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
        ];

        for (const pattern of authorPatterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            return this.cleanAuthorName(match[1]);
          }
        }
      }

      // 4. Chercher dans le titre ou description
      if (item.title) {
        const titleMatch = item.title.match(/\|\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/);
        if (titleMatch && titleMatch[1]) {
          return this.cleanAuthorName(titleMatch[1]);
        }
      }

      // 5. Fallback selon le média
      const mediaDefaults = {
        'AGP': 'Rédaction AGP',
        'Gabon Review': 'Rédaction Gabon Review',
        'Info241': 'Rédaction Info241',
        'Gabon Eco': 'Rédaction Gabon Eco',
        'L\'Union': 'Rédaction L\'Union',
        'Vox Populi': 'Rédaction Vox Populi'
      };

      return mediaDefaults[feedName] || `Rédaction ${feedName}` || 'Rédaction';
      
    } catch (error) {
      console.error('❌ Erreur extraction auteur:', error.message);
      return 'Rédaction';
    }
  }

  /**
   * 🧹 NETTOYAGE NOM AUTEUR
   */
  cleanAuthorName(author) {
    if (!author) return 'Rédaction';
    
    // Nettoyer et formater
    author = author.trim()
      .replace(/^(Par|By|Auteur|Journaliste|Rédacteur)\s*:?\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '');
    
    // Capitaliser correctement
    author = author.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return author || 'Rédaction';
  }

  /**
   * 🔍 DÉTECTION DE CONTENU RSS INSUFFISANT
   * Détecte si le contenu RSS est générique ou insuffisant
   */
  hasInsufficientRSSContent(item) {
    const content = item.contentSnippet || item.description || item.content || '';
    const insufficientIndicators = [
      'Feed generated with FetchRSS',
      'Generated by FeedBurner',
      'Read more',
      'Continue reading',
      'Click here',
      'Visit website',
      'fetchrss.com',
      'Generated by FetchRSS'
    ];
    
    // Détection spécifique FetchRSS par URL du flux
    const feedUrl = item.feedUrl || '';
    if (feedUrl.includes('fetchrss.com')) {
      console.log('🔍 Flux FetchRSS détecté, enrichissement nécessaire');
      return true;
    }
    
    // Contenu trop court
    if (content.length < 50) return true;
    
    // Contenu générique détecté
    if (insufficientIndicators.some(indicator => content.toLowerCase().includes(indicator.toLowerCase()))) {
      return true;
    }
    
    // Pas de contenu substantiel
    const cleanContent = content.replace(/<[^>]*>/g, '').trim();
    if (cleanContent.length < 100) return true;
    
    return false;
  }

  /**
   * 🌐 SCRAPING COMPLET D'ARTICLE WEB
   * Extrait le contenu, l'image et l'auteur depuis la page web
   */
  async scrapeFullArticleContent(articleUrl) {
    try {
      console.log(`🌐 Scraping contenu complet: ${articleUrl}`);
      
      const response = await axios.get(articleUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // 📝 EXTRACTION DU CONTENU PRINCIPAL
      let content = '';
      let summary = '';
      
      // Sélecteurs communs pour le contenu d'article
      const contentSelectors = [
        'article .entry-content',
        'article .post-content', 
        '.article-content',
        '.post-body',
        '.entry-content',
        '.content',
        'main article',
        '[class*="content"]',
        '.text'
      ];
      
      for (const selector of contentSelectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim().length > 100) {
          content = element.text().trim();
          break;
        }
      }
      
      // Fallback: chercher les paragraphes dans l'article
      if (!content) {
        const paragraphs = $('article p, .post p, .content p, main p').map((i, el) => $(el).text().trim()).get();
        content = paragraphs.filter(p => p.length > 20).join(' ');
      }
      
      // Créer un résumé à partir du contenu
      if (content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        summary = sentences.slice(0, 2).join('. ').trim();
        if (summary && !summary.match(/[.!?]$/)) summary += '.';
      }
      
      // 🖼️ EXTRACTION DE L'IMAGE PRINCIPALE
      let image = null;
      
      // Sélecteurs pour l'image principale
      const imageSelectors = [
        'article img[class*="featured"]',
        'article img[class*="main"]',
        '.post-thumbnail img',
        '.featured-image img',
        'article img:first-of-type',
        '.entry-content img:first-of-type'
      ];
      
      for (const selector of imageSelectors) {
        const imgElement = $(selector).first();
        if (imgElement.length) {
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
          if (imgSrc && this.isQualityImage(imgSrc)) {
            image = this.makeAbsoluteUrl(imgSrc, articleUrl);
            break;
          }
        }
      }
      
      // 👤 EXTRACTION DE L'AUTEUR
      let author = null;
      const authorSelectors = [
        '.author-name',
        '.by-author',
        '[class*="author"]',
        '.post-author',
        '[rel="author"]'
      ];
      
      for (const selector of authorSelectors) {
        const authorElement = $(selector).first();
        if (authorElement.length) {
          author = authorElement.text().trim();
          if (author.length > 2 && author.length < 50) break;
        }
      }
      
      console.log(`✅ Scraping réussi: ${content.length} chars, image: ${!!image}, auteur: ${author || 'N/A'}`);
      
      return {
        content: content || null,
        summary: summary || null,
        image: image || null,
        author: author || null
      };
      
    } catch (error) {
      console.error(`❌ Erreur scraping ${articleUrl}:`, error.message);
      return null;
    }
  }

  /**
   * 🧹 NETTOYAGE ET COMPLÉTION DES RÉSUMÉS
   * S'assure que les phrases sont complètes
   */
  cleanAndCompleteSummary(summary) {
    if (!summary || summary.length < 10) return 'Résumé non disponible';
    
    // Nettoyer le HTML
    let cleanSummary = summary
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limiter à une longueur raisonnable mais garder les phrases complètes
    const maxLength = 200;
    if (cleanSummary.length <= maxLength) {
      return cleanSummary;
    }
    
    // Trouver la dernière phrase complète dans la limite
    const sentences = cleanSummary.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      
      const testResult = result + (result ? '. ' : '') + trimmedSentence;
      if (testResult.length <= maxLength) {
        result = testResult;
      } else {
        break;
      }
    }
    
    // Si aucune phrase complète ne rentre, prendre les premiers mots
    if (!result) {
      const words = cleanSummary.split(' ');
      result = words.slice(0, 25).join(' ');
      if (words.length > 25) result += '...';
    } else if (!result.match(/[.!?]$/)) {
      result += '.';
    }
    
    return result;
  }

  /**
   * ⏱️ CALCUL DURÉE RÉELLE DE LECTURE
   * Basé sur le contenu complet de l'article
   */
  calculateReadTime(content) {
    try {
      if (!content) return 1;
      
      // Nettoyer le HTML et extraire le texte pur
      const cleanText = content
        .replace(/<[^>]*>/g, ' ') // Supprimer les balises HTML
        .replace(/\s+/g, ' ') // Normaliser les espaces
        .trim();
      
      // Compter les mots réels (longueur > 2 caractères)
      const words = cleanText.split(' ').filter(word => word.length > 2);
      const wordCount = words.length;
      
      // Vitesse de lecture moyenne : 200 mots/minute en français
      const wordsPerMinute = 200;
      const readTime = Math.ceil(wordCount / wordsPerMinute);
      
      // Minimum 1 minute, maximum 30 minutes pour les articles
      const finalReadTime = Math.max(1, Math.min(30, readTime));
      
      console.log(`📖 Temps de lecture calculé: ${wordCount} mots → ${finalReadTime} min`);
      return finalReadTime;
      
    } catch (error) {
      console.error('❌ Erreur calcul durée lecture:', error.message);
      return 1;
    }
  }

  /**
   * 🤖 GÉNÉRATION DE RÉSUMÉ IA (1 PHRASE)
   * Utilise OpenAI pour créer un résumé en une phrase
   */
  async generateAISummary(title, content) {
    try {
      // Vérifier si OpenAI est configuré
      if (!process.env.OPENAI_API_KEY) {
        return this.generateSimpleSummary(title, content);
      }

      const prompt = `Résume cet article gabonais en UNE SEULE phrase complète et informative. La phrase doit être factuelle, basée strictement sur le contenu fourni, sans interprétation personnelle. Assure-toi que la phrase soit complète avec un point final.

Titre: ${title}
Contenu: ${content?.substring(0, 800)}

Instructions:
- Une seule phrase complète qui résume l'essentiel
- Basé uniquement sur les faits du contenu
- Aucune interprétation ou opinion
- Phrase complète avec point final
- Français correct

Résumé:`;

      const response = await this.openaiService.client.chat.completions.create({
        model: 'gpt-4o-mini', // Modèle plus performant et économique
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.2
      });

      const summary = response.choices[0]?.message?.content?.trim();
      return summary || this.generateSimpleSummary(title, content);
      
    } catch (error) {
      console.error('❌ Erreur résumé IA:', error.message);
      return this.generateSimpleSummary(title, content);
    }
  }

  /**
   * 📝 GÉNÉRATION DE RÉSUMÉ SIMPLE (FALLBACK)
   */
  generateSimpleSummary(title, content) {
    if (!content) return title?.substring(0, 150) + '...';
    
    // Prendre les 2 premières phrases du contenu
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 2) {
      return (sentences[0] + '. ' + sentences[1]).substring(0, 150) + '.';
    }
    
    return content.substring(0, 150) + '...';
  }

  /**
   * 📡 RÉCUPÉRATION DES FLUX RSS DEPUIS LA BASE
   */
  async getRSSFeeds() {
    try {
      const { data, error } = await supabaseService.supabase
        .from('rss_feeds')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('❌ Erreur récupération flux RSS:', error.message);
      
      // Fallback avec les flux par défaut
      return [
        { id: 1, name: 'AGP', url: 'https://agpgabon.ga/feed/', category: 'actualites' },
        { id: 2, name: 'Gabon Review', url: 'https://www.gabonreview.com/feed/', category: 'actualites' },
        { id: 3, name: 'Gabon Eco', url: 'https://gaboneco.com/feed/', category: 'economie' },
        { id: 4, name: 'Info241', url: 'https://info241.com/feed/', category: 'actualites' }
      ];
    }
  }

  /**
   * 🔍 VÉRIFICATION EXISTENCE ARTICLE
   */
  async articleExists(hash) {
    try {
      const { data, error } = await supabaseService.supabase
        .from('articles')
        .select('id')
        .eq('external_id', hash)
        .limit(1);

      if (error) throw error;
      
      return data && data.length > 0;
    } catch (error) {
      console.error('❌ Erreur vérification article:', error.message);
      return false;
    }
  }

  /**
   * 🔑 GÉNÉRATION HASH UNIQUE ARTICLE
   */
  generateArticleHash(title, url) {
    const content = `${title}-${url}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 🔍 UTILITAIRES
   */
  generateArticleHash(title, url) {
    return crypto.createHash('md5').update(`${title}-${url}`).digest('hex');
  }

  async articleExists(hash) {
    try {
      // Vérifier en base de données si l'article existe
      const { data } = await this.supabaseService.supabase
        .from('articles')
        .select('id')
        .eq('hash', hash)
        .limit(1);
      
      return data && data.length > 0;
    } catch (error) {
      return false; // En cas d'erreur, considérer comme nouveau
    }
  }

  /**
            bestScore = score;
            bestImage = src;
          }
        }
      });
      
      if (bestImage) {
        imageUrl = this.makeAbsoluteUrl(bestImage, url);
        console.log('🖼️ Meilleure image trouvée:', imageUrl);
        return imageUrl;
      }
      
      console.log('⚠️ Aucune image trouvée via scraping pour:', url);
      return null;
      
    } catch (error) {
      console.error('❌ Erreur scraping web:', error.message);
      return null;
    }
  }
  
  /**
   * 📊 CALCUL SCORE QUALITÉ IMAGE
   * Évalue la qualité d'une image pour le scraping
   */
  calculateImageScore(src, imgElement) {
    let score = 0;
    
    // Points pour la taille (si disponible)
    const width = imgElement.attr('width');
    const height = imgElement.attr('height');
    if (width && height) {
      const area = parseInt(width) * parseInt(height);
      if (area > 50000) score += 50; // Grande image
      else if (area > 10000) score += 30; // Image moyenne
      else if (area > 1000) score += 10; // Petite image
    }
    
    // Points pour l'URL (indicateurs de qualité)
    if (src.includes('featured') || src.includes('hero')) score += 30;
    if (src.includes('thumb') || src.includes('small')) score -= 20;
    if (src.includes('logo') || src.includes('avatar')) score -= 50;
    if (src.includes('icon') || src.includes('button')) score -= 40;
    
    // Points pour l'extension
    if (src.includes('.jpg') || src.includes('.jpeg')) score += 10;
    if (src.includes('.png')) score += 5;
    if (src.includes('.webp')) score += 15;
    
    return Math.max(0, score);
  }

  // Cette méthode saveArticle a été supprimée car elle est déjà définie plus haut
  // avec l'utilisation correcte de la fonction RPC Supabase insert_article_with_image

  async getRSSFeeds() {
    try {
      // Essayer de récupérer les flux existants
      let feeds = await this.supabaseService.getRSSFeeds();
      
      // Si aucun flux n'existe, créer les flux par défaut
      if (!feeds || feeds.length === 0) {
        console.log('📡 Aucun flux RSS trouvé, création des flux par défaut...');
        
        const defaultFeeds = [
          {
            name: 'AGP',
            url: 'https://rss.app/feeds/XEAhuGTtWqAxVGmf.xml',
            category: 'Actualités',
            description: 'Agence Gabonaise de Presse',
            status: 'active'
          },
          {
            name: 'Kongossa News',
            url: 'https://rss.app/feeds/kumDX1PvlGmQE9Ua.xml',
            category: 'Actualités',
            description: 'Actualités et informations gabonaises',
            status: 'active'
          },
          {
            name: 'Gabon Actu',
            url: 'https://rss.app/feeds/A1q87qnprkKnJX5H.xml',
            category: 'Actualités',
            description: 'Actualités du Gabon',
            status: 'active'
          },
          {
            name: 'Gaboneco',
            url: 'https://rss.app/feeds/btvMPY8kQJjAwk2Y.xml',
            category: 'Économie',
            description: 'Actualités économiques du Gabon',
            status: 'active'
          },
          {
            name: 'Infos Gabon',
            url: 'https://rss.app/feeds/dF1NEbqOwOTS6Mn4.xml',
            category: 'Actualités',
            description: 'Informations gabonaises',
            status: 'active'
          },
          {
            name: 'Gabonews',
            url: 'https://rss.app/feeds/YNqDwUBLHNGdBmZk.xml',
            category: 'Actualités',
            description: 'Actualités gabonaises',
            status: 'active'
          },
          {
            name: 'MediaPoste Gabon',
            url: 'https://rss.app/feeds/cD6UdphnTWSthlO5.xml',
            category: 'Actualités',
            description: 'Actualités et médias gabonais',
            status: 'active'
          },
          {
            name: 'Gabon Media Time',
            url: 'https://rss.app/feeds/YZrtbmX63sgyaGU6.xml',
            category: 'Actualités',
            description: 'Actualités gabonaises',
            status: 'active'
          },
          {
            name: 'L\'Union',
            url: 'https://rss.app/feeds/j8B4wWUs83Kc8ABp.xml',
            category: 'Actualités',
            description: 'Journal L\'Union - Actualités gabonaises',
            status: 'active'
          },
          {
            name: 'Direct Infos Gabon',
            url: 'https://rss.app/feeds/S4hyKQHbbTvE5Fzh.xml',
            category: 'Actualités',
            description: 'Informations directes du Gabon',
            status: 'active'
          },
          {
            name: 'Echos de l\'eco',
            url: 'https://rss.app/feeds/RGtSjzdHJuUahZ4k.xml',
            category: 'Économie',
            description: 'Actualités économiques gabonaises',
            status: 'active'
          },
          {
            name: 'Vox Populi 241',
            url: 'https://rss.app/feeds/rsiBwGi6F0SWvZ83.xml',
            category: 'Actualités',
            description: 'Actualités et opinions gabonaises',
            status: 'active'
          }
        ];

        // Créer chaque flux
        feeds = [];
        for (const feedData of defaultFeeds) {
          try {
            const createdFeed = await this.supabaseService.ensureRSSFeedExists(feedData);
            feeds.push(createdFeed);
          } catch (error) {
            console.error(`❌ Erreur création flux ${feedData.name}:`, error.message);
          }
        }
      }
      
      return feeds;
    } catch (error) {
      console.error('❌ Erreur getRSSFeeds:', error.message);
      // Fallback avec flux simulés
      return [
        { id: '1', name: 'Gabon Review', url: 'https://www.gabonreview.com/rss', category: 'Actualités' },
        { id: '2', name: 'Gabon Eco', url: 'https://www.gaboneco.com/rss', category: 'Économie' }
      ];
    }
  }

  /**
   * 🔑 EXTRACTION DE MOTS-CLÉS
   */
  extractKeywords(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    const commonWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'à', 'un', 'une', 'pour', 'avec', 'sur', 'dans'];
    const words = text.match(/\b\w{4,}\b/g) || [];
    const keywords = words
      .filter(word => !commonWords.includes(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
    
    return Object.entries(keywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 🏷️ EXTRACTION INTELLIGENTE DE CATÉGORIE
   */
  extractCategory(item, feed) {
    // 1. Priorité: catégories RSS natives (array)
    if (item.categories && Array.isArray(item.categories) && item.categories.length > 0) {
      const category = item.categories[0];
      console.log(`🏷️ Catégorie RSS extraite: ${category}`);
      return this.normalizeCategory(category);
    }
    
    // 2. Tag category simple (string)
    if (item.category && typeof item.category === 'string') {
      console.log(`🏷️ Catégorie tag extraite: ${item.category}`);
      return this.normalizeCategory(item.category);
    }
    
    // 3. Dublin Core subject
    if (item['dc:subject']) {
      console.log(`🏷️ Catégorie DC extraite: ${item['dc:subject']}`);
      return this.normalizeCategory(item['dc:subject']);
    }
    
    // 4. Extraction depuis le titre/contenu (mots-clés)
    const titleLower = (item.title || '').toLowerCase();
    const contentLower = (item.contentSnippet || '').toLowerCase();
    
    // Détection par mots-clés enrichis
    // SPORT - Enrichi avec termes footballistiques et compétitions
    if (titleLower.includes('sport') || titleLower.includes('football') || titleLower.includes('match') ||
        titleLower.includes('ligue') || titleLower.includes('champion') || titleLower.includes('aubameyang') ||
        titleLower.includes(' om ') || titleLower.includes('ajax') || titleLower.includes('équipe') ||
        titleLower.includes('joueur') || titleLower.includes('but') || titleLower.includes('victoire') ||
        titleLower.includes('défaite') || titleLower.includes('coupe') || titleLower.includes('tournoi') ||
        contentLower.includes('ligue des champions')) {
      return 'Sport';
    }
    
    // POLITIQUE - Enrichi avec termes électoraux et institutionnels
    if (titleLower.includes('politique') || titleLower.includes('gouvernement') || titleLower.includes('ministre') ||
        titleLower.includes('election') || titleLower.includes('electoral') || titleLower.includes('scrutin') ||
        titleLower.includes('acer') || titleLower.includes('referendum') || titleLower.includes('président') ||
        titleLower.includes('assemblée') || titleLower.includes('député') || titleLower.includes('candidat') ||
        titleLower.includes('vote') || titleLower.includes('législative') || titleLower.includes('sénat') ||
        titleLower.includes('parlement') || titleLower.includes('opposition') || titleLower.includes('coalition')) {
      return 'Politique';
    }
    
    // ÉCONOMIE - Enrichi avec termes financiers et économiques
    if (titleLower.includes('économie') || titleLower.includes('economie') || titleLower.includes('business') ||
        titleLower.includes('banque') || titleLower.includes('mondiale') || titleLower.includes('capital') ||
        titleLower.includes('croissance') || titleLower.includes('développement') || titleLower.includes('investissement') ||
        titleLower.includes('commerce') || titleLower.includes('export') || titleLower.includes('import') ||
        titleLower.includes('entreprise') || titleLower.includes('industrie') || titleLower.includes('pib') ||
        titleLower.includes('fmi') || titleLower.includes('budget') || titleLower.includes('finance')) {
      return 'Économie';
    }
    
    // SANTÉ
    if (titleLower.includes('santé') || titleLower.includes('sante') || titleLower.includes('médical') ||
        titleLower.includes('hopital') || titleLower.includes('hôpital') || titleLower.includes('vaccin') ||
        titleLower.includes('maladie') || titleLower.includes('docteur') || titleLower.includes('patient')) {
      return 'Santé';
    }
    
    // CULTURE
    if (titleLower.includes('culture') || titleLower.includes('musique') || titleLower.includes('art') ||
        titleLower.includes('cinéma') || titleLower.includes('cinema') || titleLower.includes('festival') ||
        titleLower.includes('artiste') || titleLower.includes('concert') || titleLower.includes('spectacle')) {
      return 'Culture';
    }
    
    // TECHNOLOGIE
    if (titleLower.includes('technologie') || titleLower.includes('tech') || titleLower.includes('numérique') ||
        titleLower.includes('digital') || titleLower.includes('internet') || titleLower.includes('informatique') ||
        titleLower.includes('intelligence artificielle') || titleLower.includes('smartphone') || titleLower.includes('application')) {
      return 'Technologie';
    }
    
    // 5. Fallback: catégorie du flux RSS
    return feed.category || 'Actualités';
  }

  /**
   * 🔄 NORMALISATION DE CATÉGORIE
   */
  normalizeCategory(category) {
    if (!category) return 'Actualités';
    
    const categoryLower = category.toLowerCase().trim();
    
    // Mapping des variantes vers catégories standard
    const categoryMap = {
      'sport': 'Sport',
      'sports': 'Sport',
      'football': 'Sport',
      'économie': 'Économie',
      'economie': 'Économie',
      'economy': 'Économie',
      'business': 'Économie',
      'politique': 'Politique',
      'politics': 'Politique',
      'santé': 'Santé',
      'sante': 'Santé',
      'health': 'Santé',
      'culture': 'Culture',
      'art': 'Culture',
      'musique': 'Culture',
      'technologie': 'Technologie',
      'technology': 'Technologie',
      'tech': 'Technologie',
      'numérique': 'Technologie',
      'actualités': 'Actualités',
      'actualites': 'Actualités',
      'news': 'Actualités',
      'infos': 'Actualités'
    };
    
    return categoryMap[categoryLower] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * 🏷️ ANALYSE DE SENTIMENT
   */
  analyzeSentiment(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    const positiveWords = ['succès', 'victoire', 'croissance', 'amélioration', 'développement', 'progrès'];
    const negativeWords = ['crise', 'problème', 'échec', 'baisse', 'accident', 'conflit'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positif';
    if (negativeCount > positiveCount) return 'négatif';
    return 'neutre';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Récupérer l'heure de dernière mise à jour
   */
  getLastUpdateTime() {
    return this.lastUpdateTime;
  }
}

// Export pour utilisation
module.exports = RSSProcessor;

// Démarrage automatique si exécuté directement
if (require.main === module) {
  const processor = new RSSProcessor();
  processor.startAutomaticProcessing();
}
