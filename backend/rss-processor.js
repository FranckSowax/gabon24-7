const RSSParser = require('rss-parser');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const supabaseService = require('./supabase-config');
const OpenAIService = require('./openai-service');

class RSSProcessor {
  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GabonNews RSS Processor/1.0'
      }
    });
    this.openaiService = new OpenAIService();
    this.supabaseService = supabaseService; // Stocker le service Supabase
    
    // Configuration de fréquence
    this.FETCH_INTERVAL_MINUTES = 15; // Récupération toutes les 15 minutes
    this.BATCH_SIZE = 10; // Traiter 10 articles à la fois
    this.isProcessing = false;
  }

  /**
   * 🔄 RÉCUPÉRATION AUTOMATIQUE DES ARTICLES
   * Fréquence: Toutes les 15 minutes
   */
  async startAutomaticProcessing() {
    console.log('🚀 Démarrage du processeur RSS automatique');
    console.log(`⏰ Fréquence: toutes les ${this.FETCH_INTERVAL_MINUTES} minutes`);
    
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
      
      // Traiter chaque article
      for (const item of rssFeed.items.slice(0, this.BATCH_SIZE)) {
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

    // 🖼️ EXTRACTION D'IMAGE (RSS + Web Scraping)
    const imageUrl = await this.extractImageFromArticle(item);
    
    // 📝 GÉNÉRATION DE RÉSUMÉ IA (1 phrase)
    const aiSummary = await this.generateAISummary(item.title, item.contentSnippet || item.content);
    
    // 🏷️ ANALYSE DE SENTIMENT
    const sentiment = this.analyzeSentiment(item.title, item.contentSnippet);
    
    // 🔑 EXTRACTION DE MOTS-CLÉS
    const keywords = this.extractKeywords(item.title, item.contentSnippet);

    // 👤 EXTRACTION INTELLIGENTE DE L'AUTEUR/JOURNALISTE
    const author = this.extractAuthor(item, feed.name);
    
    // ⏱️ CALCUL DE LA DURÉE RÉELLE DE LECTURE
    const readTimeMinutes = this.calculateReadTime(item.content || item.contentSnippet || item.summary || '');

    // 📊 CRÉATION DE L'OBJET ARTICLE ENRICHI
    const article = {
      feed_id: feed.id,
      external_id: item.guid || item.id || articleHash,
      title: item.title || 'Titre non disponible',
      content: item.content || item['content:encoded'] || item.contentSnippet || '',
      summary: item.contentSnippet || item.description || 'Résumé non disponible',
      ai_summary: aiSummary,
      url: item.link,
      image_urls: imageUrl ? [imageUrl] : [], // Array comme attendu par la DB
      author: author,
      published_at: item.pubDate || item.isoDate || new Date().toISOString(),
      category: feed.category,
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
      
      // Utiliser la fonction SQL créée pour insérer l'article
      const { data, error } = await supabaseService.supabase
        .rpc('insert_article_with_image', {
          p_feed_id: article.feed_id,
          p_external_id: article.external_id,
          p_title: article.title,
          p_summary: article.summary || '',
          p_ai_summary: article.ai_summary || '',
          p_url: article.url,
          p_image_urls: article.image_urls || [],
          p_author: article.author || 'Rédaction',
          p_published_at: article.published_at,
          p_category: article.category || 'Actualités',
          p_sentiment: article.sentiment || 'neutre',
          p_read_time_minutes: article.read_time_minutes || 3,
          p_is_published: article.is_published !== false
        });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data && data[0]) {
        const result = data[0];
        if (result.success) {
          console.log(`✅ ${result.message}`);
          if (article.image_urls && article.image_urls.length > 0) {
            console.log('🖼️ Image sauvegardée:', article.image_urls[0]);
          }
          return { data: result, error: null };
        } else {
          console.log('⚠️ Article non sauvegardé:', result.message);
          return { data: null, error: result.message };
        }
      }
      
      return { data, error: null };
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde article:', error.message);
      
      // Log pour debug avec image info
      console.log('📄 Article (échec sauvegarde):', {
        title: article.title.substring(0, 50),
        ai_summary: article.ai_summary?.substring(0, 50) + '...',
        has_image: article.image_urls && article.image_urls.length > 0,
        image_url: article.image_urls?.[0]?.substring(0, 50) + '...'
      });
      
      return { data: null, error: error.message };
    }
  }

  /**
   * 🖼️ EXTRACTION D'IMAGE PRINCIPALE DEPUIS L'ARTICLE RSS
   * Recherche intelligente de l'image principale dans plusieurs sources
   */
  async extractImageFromArticle(item) {
    try {
      let imageUrl = null;

      // 1. Vérifier l'enclosure (pièce jointe) - priorité haute
      if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
        imageUrl = item.enclosure.url;
        console.log('🖼️ Image trouvée via enclosure:', imageUrl);
        return this.validateAndCleanImageUrl(imageUrl);
      }

      // 2. Chercher dans media:content (RSS 2.0 Media)
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

      // 3. Chercher dans media:thumbnail
      if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        imageUrl = item['media:thumbnail'].$.url;
        console.log('🖼️ Image trouvée via media:thumbnail:', imageUrl);
        return this.validateAndCleanImageUrl(imageUrl);
      }

      // 4. Chercher dans le contenu HTML - première image de qualité
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

      // 5. Chercher dans le résumé/description
      if (item.contentSnippet || item.description) {
        const snippet = item.contentSnippet || item.description;
        const imgMatch = snippet.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1] && this.isQualityImage(imgMatch[1])) {
          imageUrl = imgMatch[1];
          console.log('🖼️ Image trouvée via snippet:', imageUrl);
          return this.validateAndCleanImageUrl(imageUrl);
        }
      }

      // 6. Chercher dans les propriétés Open Graph si disponibles
      if (item['og:image']) {
        imageUrl = item['og:image'];
        console.log('🖼️ Image trouvée via Open Graph:', imageUrl);
        return this.validateAndCleanImageUrl(imageUrl);
      }

      // 7. FALLBACK : Scraper la page web de l'article pour trouver l'image principale
      if (item.link) {
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
   * 🌐 SCRAPING WEB POUR EXTRACTION D'IMAGE PRINCIPALE
   * Fallback quand l'image n'est pas dans le flux RSS
   */
  async scrapeImageFromWebPage(articleUrl) {
    try {
      // Timeout court pour éviter de ralentir le processus
      const response = await axios.get(articleUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      let imageUrl = null;

      // 1. Chercher les meta tags Open Graph (priorité haute)
      imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isQualityImage(imageUrl)) {
        return this.makeAbsoluteUrl(imageUrl, articleUrl);
      }

      // 2. Chercher les meta tags Twitter Card
      imageUrl = $('meta[name="twitter:image"]').attr('content');
      if (imageUrl && this.isQualityImage(imageUrl)) {
        return this.makeAbsoluteUrl(imageUrl, articleUrl);
      }

      // 3. Chercher la première image dans l'article avec des sélecteurs spécifiques
      const selectors = [
        'article img:first',
        '.post-content img:first',
        '.entry-content img:first',
        '.article-content img:first',
        '.content img:first',
        'main img:first',
        'img[class*="featured"]',
        'img[class*="hero"]',
        'img[class*="main"]'
      ];

      for (const selector of selectors) {
        const imgSrc = $(selector).attr('src');
        if (imgSrc && this.isQualityImage(imgSrc)) {
          return this.makeAbsoluteUrl(imgSrc, articleUrl);
        }
      }

      // 4. Fallback : première image de taille décente dans la page
      const allImages = $('img');
      for (let i = 0; i < allImages.length; i++) {
        const imgSrc = $(allImages[i]).attr('src');
        if (imgSrc && this.isQualityImage(imgSrc)) {
          // Vérifier si l'image semble être de contenu (pas logo/avatar)
          const imgAlt = $(allImages[i]).attr('alt') || '';
          const imgClass = $(allImages[i]).attr('class') || '';
          
          // Éviter les logos, avatars, icônes
          if (!imgClass.match(/logo|avatar|icon|social|nav|menu/i) && 
              !imgAlt.match(/logo|avatar|icon/i)) {
            return this.makeAbsoluteUrl(imgSrc, articleUrl);
          }
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Erreur scraping web:', error.message);
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
      
      // Compter les mots
      const wordCount = cleanText.split(' ').filter(word => word.length > 0).length;
      
      // Vitesse de lecture moyenne : 200 mots/minute en français
      const wordsPerMinute = 200;
      const readTime = Math.ceil(wordCount / wordsPerMinute);
      
      // Minimum 1 minute, maximum 30 minutes pour les articles
      return Math.max(1, Math.min(30, readTime));
      
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
        .eq('is_active', true);

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
   * 🌐 WEB SCRAPING POUR EXTRACTION D'IMAGES
   * Scrape la page web de l'article pour trouver l'image principale
   */
  async scrapeImageFromWebPage(url) {
    try {
      console.log('🔍 Scraping de:', url);
      
      // Faire la requête HTTP avec timeout
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      let imageUrl = null;
      
      // 1. Chercher Open Graph image (priorité haute)
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage && this.isQualityImage(ogImage)) {
        imageUrl = this.makeAbsoluteUrl(ogImage, url);
        console.log('🖼️ Image OG trouvée:', imageUrl);
        return imageUrl;
      }
      
      // 2. Chercher Twitter Card image
      const twitterImage = $('meta[name="twitter:image"]').attr('content');
      if (twitterImage && this.isQualityImage(twitterImage)) {
        imageUrl = this.makeAbsoluteUrl(twitterImage, url);
        console.log('🖼️ Image Twitter trouvée:', imageUrl);
        return imageUrl;
      }
      
      // 3. Chercher dans l'article principal
      const articleSelectors = [
        'article img:first-of-type',
        '.post-content img:first-of-type',
        '.entry-content img:first-of-type',
        '.content img:first-of-type',
        '.article-content img:first-of-type',
        'main img:first-of-type',
        '.wp-post-image'
      ];
      
      for (const selector of articleSelectors) {
        const img = $(selector);
        if (img.length > 0) {
          const src = img.attr('src') || img.attr('data-src');
          if (src && this.isQualityImage(src)) {
            imageUrl = this.makeAbsoluteUrl(src, url);
            console.log('🖼️ Image article trouvée:', imageUrl);
            return imageUrl;
          }
        }
      }
      
      // 4. Chercher toutes les images et prendre la plus grande
      const allImages = $('img');
      let bestImage = null;
      let bestScore = 0;
      
      allImages.each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src && this.isQualityImage(src)) {
          const score = this.calculateImageScore(src, $(elem));
          if (score > bestScore) {
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
            name: 'Gabon Review',
            url: 'https://www.gabonreview.com/rss',
            category: 'Actualités',
            description: 'Actualités économiques et politiques du Gabon',
            status: 'active'
          },
          {
            name: 'Gabon Eco',
            url: 'https://www.gaboneco.com/rss',
            category: 'Économie',
            description: 'Actualités économiques du Gabon',
            status: 'active'
          },
          {
            name: 'Info241',
            url: 'https://www.info241.com/feed',
            category: 'Actualités',
            description: 'Premier portail d\'information du Gabon',
            status: 'active'
          },
          {
            name: 'Vox Populi',
            url: 'https://voxpopuligabon.com/feed/',
            category: 'Actualités',
            description: 'Actualités gabonaises',
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
}

// Export pour utilisation
module.exports = RSSProcessor;

// Démarrage automatique si exécuté directement
if (require.main === module) {
  const processor = new RSSProcessor();
  processor.startAutomaticProcessing();
}
