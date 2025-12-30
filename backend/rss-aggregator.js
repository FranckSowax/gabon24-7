const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const supabaseService = require('./supabase-config');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');
const sourceMediaCorrector = require('./services/source-media-corrector');

class RSSAggregator {
  constructor() {
    this.parser = new RSSParser({
      timeout: 15000,
      headers: {
        'User-Agent': 'GabonNews RSS Aggregator/1.0'
      }
    });
    
    // URL du flux RSS agrégé rss.app
    this.RSS_FEED_URL = 'https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml';
    
    this.FETCH_INTERVAL_MINUTES = 20; // Récupération toutes les 20 minutes (optimisé pour économie IA)
    this.isProcessing = false;
    this.lastUpdateTime = null;
    
    // Service d'enrichissement IA
    this.aiEnrichmentService = new ArticleAIEnrichment();
  }

  /**
   * 🚀 DÉMARRAGE DU PROCESSEUR AUTOMATIQUE
   */
  async start() {
    console.log('🚀 Démarrage du processeur RSS agrégé');
    console.log(`📡 Source: ${this.RSS_FEED_URL}`);
    console.log(`⏰ Fréquence: toutes les ${this.FETCH_INTERVAL_MINUTES} minutes`);
    
    // Traitement initial
    await this.processAggregatedFeed();
    
    // Planification récurrente
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processAggregatedFeed();
      }
    }, this.FETCH_INTERVAL_MINUTES * 60 * 1000);
  }

  /**
   * 📡 TRAITEMENT DU FLUX RSS AGRÉGÉ
   */
  async processAggregatedFeed() {
    if (this.isProcessing) {
      console.log('⏳ Traitement déjà en cours, ignoré');
      return { success: false, message: 'Déjà en cours' };
    }

    this.isProcessing = true;
    console.log('\n🔄 === DÉBUT DU CYCLE RSS AGRÉGÉ ===');
    
    try {
      // Parser le flux RSS avec retry
      let feed;
      let retries = 3;
      while (retries > 0) {
        try {
          feed = await this.parser.parseURL(this.RSS_FEED_URL);
          break;
        } catch (parseError) {
          retries--;
          if (retries === 0) {
            throw new Error(`Échec parsing RSS après 3 tentatives: ${parseError.message}`);
          }
          console.log(`⚠️ Erreur parsing, retry dans 5s... (${retries} restantes)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (!feed || !feed.items || feed.items.length === 0) {
        console.log('⚠️ Aucun article dans le flux');
        return { success: false, message: 'Aucun article' };
      }

      console.log(`📊 ${feed.items.length} articles trouvés dans le flux`);
      
      // Filtrer les articles récents (dernières 48h)
      const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentItems = feed.items.filter(item => {
        if (!item.pubDate && !item.isoDate) return true;
        const itemDate = new Date(item.pubDate || item.isoDate);
        return itemDate >= yesterday;
      });
      
      console.log(`📊 ${recentItems.length}/${feed.items.length} articles récents à traiter`);
      
      let newArticlesCount = 0;
      let updatedArticlesCount = 0;
      
      // Traiter chaque article
      for (const item of recentItems) {
        try {
          const result = await this.processArticle(item);
          if (result === 'new') newArticlesCount++;
          if (result === 'updated') updatedArticlesCount++;
        } catch (error) {
          console.error(`❌ Erreur article "${item.title?.substring(0, 30)}...":`, error.message);
        }
      }

      this.lastUpdateTime = new Date();
      
      console.log(`✅ Cycle terminé: ${newArticlesCount} nouveaux, ${updatedArticlesCount} mis à jour`);
      console.log('🔄 === FIN DU CYCLE RSS AGRÉGÉ ===\n');
      
      return { 
        success: true, 
        newArticles: newArticlesCount,
        updatedArticles: updatedArticlesCount,
        totalProcessed: recentItems.length
      };
      
    } catch (error) {
      console.error('❌ Erreur cycle RSS:', error.message);
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 📄 TRAITEMENT D'UN ARTICLE INDIVIDUEL
   */
  async processArticle(item) {
    // Créer un hash unique basé sur l'URL normalisée (indépendant du titre)
    const normalizedLink = this.normalizeLink(item.link || '');
    const articleHash = this.generateLinkHash(normalizedLink || item.link || '');
    
    // Vérifier si l'article existe déjà (par URL originale, URL normalisée, GUID, hash)
    const existingArticle = await this.findExistingArticle(item, articleHash, normalizedLink);
    
    if (existingArticle) {
      // Article existe, vérifier s'il a besoin d'enrichissement
      const hasImage = existingArticle.image_urls && existingArticle.image_urls.length > 0;
      if (!hasImage) {
        console.log(`🖼️ Enrichissement image: "${item.title?.substring(0, 40)}..."`);
        const imageUrl = await this.extractImage(item);
        if (imageUrl) {
          await this.updateArticleImage(existingArticle.id, imageUrl);
          return 'updated';
        }
      }
      return 'existing';
    }

    console.log(`📝 Nouveau: "${item.title?.substring(0, 50)}..."`);

    // 🖼️ EXTRACTION D'IMAGE
    const imageUrl = await this.extractImage(item);
    
    // 👤 EXTRACTION AUTEUR & SOURCE
    const { author, source } = this.extractAuthorAndSource(item);
    
    // ✨ CORRECTION AUTOMATIQUE DE LA SOURCE MÉDIA
    const correctedSource = sourceMediaCorrector.correctSource(item.link, source, author);
    console.log(`📰 Source: ${source || 'N/A'} → ${correctedSource}`);
    
    // ⏱️ CALCUL TEMPS DE LECTURE
    const readTime = this.calculateReadTime(item.contentSnippet || item.content || '');

    // 🤖 ENRICHISSEMENT IA (avec vérification pour économie tokens)
    let aiEnrichment;
    
    // Double vérification : vérifier si un article similaire existe déjà avec enrichissement IA
    const { data: similarArticle } = await supabaseService.supabase
      .from('articles')
      .select('id, ai_category, ai_sentiment, ai_importance, ai_keywords')
      .eq('external_id', articleHash)
      .single();
    
    if (similarArticle && similarArticle.ai_category) {
      // Article déjà enrichi, réutiliser les métadonnées existantes (économie 100%)
      console.log('♻️ Article déjà enrichi, réutilisation métadonnées IA existantes (skip IA)');
      aiEnrichment = {
        ai_category: similarArticle.ai_category,
        ai_sentiment: similarArticle.ai_sentiment,
        ai_importance: similarArticle.ai_importance,
        ai_keywords: similarArticle.ai_keywords || [],
        ai_summary: null
      };
    } else {
      // Enrichissement via cache intelligent (local ou IA si nécessaire)
      console.log('🧠 Enrichissement intelligent en cours...');
      aiEnrichment = await this.aiEnrichmentService.enrichArticle(
        item.title || 'Titre non disponible',
        item.content || item.contentSnippet || '',
        item.contentSnippet || item.description || '',
        correctedSource // Passer la source pour le cache intelligent
      );
    }

    // 📊 CRÉATION DE L'ARTICLE
    const article = {
      // Toujours utiliser le hash basé sur le lien normalisé pour garantir l'unicité
      external_id: articleHash,
      title: item.title || 'Titre non disponible',
      content: item.content || item['content:encoded'] || item.contentSnippet || '',
      summary: item.contentSnippet || item.description || '',
      url: item.link, // on conserve le lien original pour l'utilisateur
      normalized_url: normalizedLink || null,
      image_url: imageUrl,
      author: author,
      source: correctedSource,
      published_at: item.pubDate || item.isoDate || new Date().toISOString(),
      read_time_minutes: readTime,
      // 🤖 MÉTADONNÉES IA ENRICHIES (noms temporaires pour saveArticle)
      summary_ai: aiEnrichment.ai_summary || null,
      category: aiEnrichment.ai_category,
      sentiment_score: aiEnrichment.ai_sentiment,
      importance: aiEnrichment.ai_importance ? Math.max(1, Math.round(aiEnrichment.ai_importance * 10)) : null,
      is_breaking: aiEnrichment.ai_is_breaking,
      keywords: aiEnrichment.ai_keywords || []
    };

    // 💾 SAUVEGARDE
    const saved = await this.saveArticle(article);
    return saved ? 'new' : 'error';
  }

  /**
   * 🖼️ EXTRACTION D'IMAGE (RSS + Web Scraping)
   */
  async extractImage(item) {
    try {
      // 1. Chercher dans enclosure
      if (item.enclosure?.url) {
        return item.enclosure.url;
      }

      // 2. Chercher dans media:content
      if (item['media:content']) {
        const media = Array.isArray(item['media:content']) 
          ? item['media:content'][0] 
          : item['media:content'];
        if (media.$?.url) return media.$.url;
      }

      // 3. Chercher dans media:thumbnail
      if (item['media:thumbnail']?.$?.url) {
        return item['media:thumbnail'].$.url;
      }

      // 4. Chercher dans le contenu HTML
      const content = item.content || item['content:encoded'] || item.description || '';
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch?.[1] && this.isValidImage(imgMatch[1])) {
        return imgMatch[1];
      }

      // 5. WEB SCRAPING en fallback
      if (item.link) {
        console.log(`🌐 Scraping image pour: ${item.title?.substring(0, 30)}...`);
        return await this.scrapeImage(item.link);
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur extraction image:', error.message);
      return null;
    }
  }

  /**
   * 🌐 SCRAPING D'IMAGE DEPUIS LA PAGE WEB
   */
  async scrapeImage(url) {
    try {
      const base = new URL(url);
      const hostname = base.hostname.toLowerCase();

      // Utiliser des headers plus complets + Referer du domaine
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 10,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': `${base.protocol}//${base.hostname}/`
        }
      });

      const $ = cheerio.load(response.data);

      // 1) Open Graph en priorité
      let imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isValidImage(imageUrl)) {
        return this.normalizeUrl(imageUrl, url);
      }

      // 2) Twitter Card
      imageUrl = $('meta[name="twitter:image"]').attr('content');
      if (imageUrl && this.isValidImage(imageUrl)) {
        return this.normalizeUrl(imageUrl, url);
      }

      // 3) Domain-specific selectors
      const trySelectors = (selectors) => {
        for (const selector of selectors) {
          const img = $(selector).first();
          if (img && img.length) {
            const s = img.attr('src') || img.attr('data-src') || img.attr('data-original') || img.attr('data-srcset');
            if (s && this.isValidImage(s)) {
              return this.normalizeUrl(s, url);
            }
          }
        }
        return null;
      };

      // gabonactu.com (WordPress)
      if (hostname.includes('gabonactu.com')) {
        const out = trySelectors([
          'article .wp-post-image',
          'figure.wp-caption img',
          '.entry-content img[src*="uploads/"]',
          '.post-thumbnail img',
          '.featured-image img'
        ]);
        if (out) return out;
      }

      // L'Union (lunion.ga / lunion.sonapresse.com)
      if (hostname.includes('lunion.ga') || hostname.includes('lunion.sonapresse.com') || hostname.includes('sonapresse.com')) {
        const out = trySelectors([
          'article img[src*="wp-content/uploads"]',
          '.entry-content img',
          'main article img:first-of-type',
          '.post-thumbnail img'
        ]);
        if (out) return out;
      }

      // sport241.com (WordPress/Newspaper theme)
      if (hostname.includes('sport241.com')) {
        const out = trySelectors([
          '.td-post-featured-image img',
          'article img.wp-post-image',
          '.entry-content img[src*="uploads/"]',
          'article img:first-of-type'
        ]);
        if (out) return out;
      }

      // fr.infosgabon.com (WordPress)
      if (hostname.includes('fr.infosgabon.com')) {
        const out = trySelectors([
          'article .wp-post-image',
          'figure img[src*="uploads/"]',
          '.entry-content img[src*="uploads/"]',
          '.post-thumbnail img',
          'main article img:first-of-type'
        ]);
        if (out) return out;
      }

      // 4) Fallback générique
      const generic = trySelectors([
        '.wp-post-image',
        '.post-thumbnail img',
        '.featured-image img',
        'article img:first-of-type',
        '.entry-content img:first-of-type',
        'main img:first-of-type'
      ]);
      if (generic) return generic;

      return null;
    } catch (error) {
      console.error(`❌ Scraping échoué pour ${url}:`, error.message);
      return null;
    }
  }

  /**
   * 👤 EXTRACTION AUTEUR & SOURCE MÉDIA
   */
  extractAuthorAndSource(item) {
    let author = 'Rédaction';
    let source = 'Gabon News';

    // Extraction de l'auteur
    if (item.creator) {
      author = item.creator;
    } else if (item.author) {
      author = item.author;
    } else if (item['dc:creator']) {
      author = item['dc:creator'];
    }

    // Nettoyage auteur
    author = author.trim()
      .replace(/^(Par|By|Auteur)\s*:?\s*/i, '')
      .substring(0, 100);

    // Extraction de la source depuis l'URL ou le contenu
    if (item.link) {
      const domain = new URL(item.link).hostname;
      
      const sourceMap = {
        'gabonactu.com': 'Gabon Actu',
        'gabon-insight.com': 'Gabonews',
        'agpgabon.ga': 'AGP',
        'lunion.ga': 'L\'Union',
        'union.sonapresse.com': 'L\'Union',
        'gabonreview.com': 'Gabon Review',
        'infosgabon.com': 'Infos Gabon',
        'directinfosgabon.com': 'Direct Infos Gabon',
        'gabonmediatime.com': 'Gabon Media Time',
        'kongossanews.info': 'Kongossa News',
        'rfi.fr': 'RFI',
        'gaboneco.com': 'Gabon Eco'
      };

      for (const [key, value] of Object.entries(sourceMap)) {
        if (domain.includes(key)) {
          source = value;
          break;
        }
      }
    }

    return { author, source };
  }

  /**
   * ⏱️ CALCUL TEMPS DE LECTURE
   */
  calculateReadTime(content) {
    const cleanText = content.replace(/<[^>]*>/g, '').trim();
    const wordCount = cleanText.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200)); // 200 mots/min
  }

  /**
   * 🔑 GÉNÉRATION DE HASH UNIQUE
   */
  generateHash(title, url) {
    const text = `${title}-${url}`;
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * 🔗 NORMALISATION DU LIEN (pour détection de doublons)
   */
  normalizeLink(url) {
    try {
      if (!url) return '';
      const u = new URL(url);
      // Host en minuscule et suppression de www.
      u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
      // Supprimer paramètres de tracking courants
      const trackingParams = [
        'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_name',
        'gclid','fbclid','igshid','mc_cid','mc_eid'
      ];
      trackingParams.forEach(p => u.searchParams.delete(p));
      // Retirer le hash et le slash final (sauf racine)
      u.hash = '';
      if (u.pathname !== '/' && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.replace(/\/$/, '');
      }
      return u.toString();
    } catch (e) {
      return url || '';
    }
  }

  /**
   * 🔐 HASH STABLE BASÉ SUR LE LIEN NORMALISÉ
   */
  generateLinkHash(link) {
    return crypto.createHash('md5').update(link).digest('hex');
  }

  /**
   * 🔍 VALIDATION D'IMAGE
   */
  isValidImage(url) {
    if (!url || typeof url !== 'string') return false;
    
    const lowQuality = ['avatar', 'icon', 'logo', 'button', '1x1', 'pixel'];
    const urlLower = url.toLowerCase();
    
    return !lowQuality.some(term => urlLower.includes(term)) &&
           (url.startsWith('http://') || url.startsWith('https://'));
  }

  /**
   * 🔗 NORMALISATION URL
   */
  normalizeUrl(imageUrl, baseUrl) {
    try {
      if (imageUrl.startsWith('http')) return imageUrl;
      if (imageUrl.startsWith('//')) return 'https:' + imageUrl;
      
      const base = new URL(baseUrl);
      if (imageUrl.startsWith('/')) {
        return base.origin + imageUrl;
      }
      return new URL(imageUrl, baseUrl).href;
    } catch (error) {
      return imageUrl;
    }
  }

  /**
   * 🔍 RECHERCHE ARTICLE EXISTANT
   */
  async findArticleByHash(hash) {
    try {
      const { data, error } = await supabaseService.supabase
        .from('articles')
        .select('id, image_url')
        .eq('external_id', hash)
        .single();
      
      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🔎 RECHERCHE AVANCÉE D'UN ARTICLE EXISTANT
   * - Par external_id (hash lien)
   * - Par external_id (guid/id RSS)
   * - Par url (originale)
   * - Par url normalisée
   */
  async findExistingArticle(item, articleHash, normalizedLink) {
    const supa = supabaseService.supabase;
    try {
      // 1) external_id = hash
      let q1 = await supa
        .from('articles')
        .select('id, image_urls') // ⚠️ Changé image_url → image_urls
        .eq('external_id', articleHash)
        .maybeSingle?.();
      if (!q1 || q1.error) {
        // Fallback pour SDK sans maybeSingle
        const { data, error } = await supa
          .from('articles')
          .select('id, image_urls') // ⚠️ Changé image_url → image_urls
          .eq('external_id', articleHash)
          .single();
        if (!error && data) return data;
      } else if (q1.data) {
        return q1.data;
      }

      // 2) external_id = guid/id RSS
      const candidateIds = [];
      if (item.guid) candidateIds.push(item.guid);
      if (item.id) candidateIds.push(item.id);
      for (const cid of candidateIds) {
        const { data, error } = await supa
          .from('articles')
          .select('id, image_urls') // ⚠️ Changé image_url → image_urls
          .eq('external_id', cid)
          .limit(1);
        if (!error && data && data.length) return data[0];
      }

      // 3) url = lien original
      if (item.link) {
        const { data, error } = await supa
          .from('articles')
          .select('id, image_urls') // ⚠️ Changé image_url → image_urls
          .eq('url', item.link)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length) return data[0];
      }

      // 4) url normalisée (si différente de l'originale)
      if (normalizedLink && normalizedLink !== item.link) {
        const { data, error } = await supa
          .from('articles')
          .select('id, image_urls') // ⚠️ Changé image_url → image_urls
          .eq('normalized_url', normalizedLink)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length) return data[0];
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 💾 SAUVEGARDE ARTICLE
   */
  async saveArticle(article) {
    try {
      // 🔗 Récupérer le rss_feed_id si possible
      let rss_feed_id = null;
      try {
        const { data: feedData } = await supabaseService.supabase
          .from('rss_feeds')
          .select('id')
          .ilike('media_name', `%${article.source}%`)
          .limit(1)
          .single();
        if (feedData) rss_feed_id = feedData.id;
      } catch (e) {
        // Pas grave si pas trouvé, source sera utilisée
      }

      const { data, error } = await supabaseService.supabase
        .from('articles')
        .insert([{
          external_id: article.external_id,
          title: article.title,
          content: article.content,
          summary: article.summary,
          url: article.url,
          normalized_url: article.normalized_url,
          image_urls: article.image_url ? [article.image_url] : [], // ⚠️ image_url supprimé → image_urls (ARRAY)
          author: article.author,
          source: article.source,
          feed_id: rss_feed_id, // 🔗 Liaison avec rss_feeds (colonne renommée)
          published_at: article.published_at,
          read_time_minutes: article.read_time_minutes,
          view_count: 0,
          share_count: 0,
          is_published: true,
          // Métadonnées IA avec NOUVEAUX noms de colonnes (après migration 12 Oct 2025)
          summary_ai: article.summary_ai,
          category: article.category,
          sentiment_score: article.sentiment_score,
          importance: article.importance,
          is_breaking: article.is_breaking,
          keywords: article.keywords,
          enrichment_status: 'completed', // Nouveau champ
          enriched_at: new Date().toISOString() // Nouveau champ
        }])
        .select();

      if (error) {
        console.error(`❌ Erreur sauvegarde: ${error.message}`);
        return false;
      }

      console.log(`✅ Sauvegardé: "${article.title.substring(0, 30)}..." [${article.source}]`);
      if (article.image_url) {
        console.log(`🖼️ Image: ${article.image_url.substring(0, 50)}...`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde:', error.message);
      return false;
    }
  }

  /**
   * 🖼️ MISE À JOUR IMAGE D'ARTICLE
   */
  async updateArticleImage(articleId, imageUrl) {
    try {
      const { error } = await supabaseService.supabase
        .from('articles')
        .update({ image_urls: [imageUrl] }) // ⚠️ Changé image_url → image_urls (ARRAY)
        .eq('id', articleId);

      if (error) throw error;
      
      console.log(`✅ Image mise à jour pour article ${articleId}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour image:', error.message);
      return false;
    }
  }

  /**
   * 📊 STATISTIQUES
   */
  getStats() {
    return {
      isProcessing: this.isProcessing,
      lastUpdate: this.lastUpdateTime,
      feedUrl: this.RSS_FEED_URL,
      interval: `${this.FETCH_INTERVAL_MINUTES} minutes`
    };
  }
}

module.exports = RSSAggregator;
