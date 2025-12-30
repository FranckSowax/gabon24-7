/**
 * 🖼️ SERVICE D'EXTRACTION D'IMAGES MULTI-STRATÉGIE
 * Basé sur l'analyse des anciennes configurations Netlify
 *
 * Stratégies d'extraction:
 * 0. Facebook spécial (User-Agent facebookexternalhit) - PRIORITÉ pour facebook.com
 * 1. Meta tags Open Graph (og:image)
 * 2. Meta tags Twitter Card (twitter:image)
 * 3. Schema.org / JSON-LD (image)
 * 4. Microdata (itemprop="image")
 * 5. Scraping HTML (img tags avec heuristiques)
 * 6. Expressions régulières pour CDN connus
 * 7. Configurations spécifiques par domaine
 *
 * @module image-extractor
 * @author Claude Code
 * @date 2025-12-30
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// ==================== CONFIGURATION FACEBOOK ====================

/**
 * Configuration pour scraper les images Facebook
 * Facebook nécessite un User-Agent spécial pour révéler les og:image
 */
const FACEBOOK_CONFIG = {
  userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  mobileUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  timeout: 20000,
  maxRedirects: 8
};

// ==================== CONFIGURATIONS PAR DOMAINE ====================

/**
 * Configurations spécifiques pour les médias gabonais
 * Chaque site peut avoir ses propres sélecteurs CSS et headers
 */
const DOMAIN_CONFIGS = {
  'gabonreview.com': {
    selectors: [
      'article img.wp-post-image',
      '.entry-content img:first-of-type',
      '.featured-image img',
      'figure.post-thumbnail img'
    ],
    headers: { 'Referer': 'https://www.gabonreview.com/' }
  },
  'directinfosgabon.com': {
    selectors: [
      '.jeg_featured_img img',
      '.entry-content img:first-of-type',
      'article img.wp-post-image'
    ],
    headers: { 'Referer': 'https://directinfosgabon.com/' }
  },
  'gabonmediatime.com': {
    selectors: [
      '.td-post-featured-image img',
      '.entry-thumb img',
      'article img.wp-post-image'
    ],
    headers: { 'Referer': 'https://gabonmediatime.com/' }
  },
  'gabonactu.com': {
    selectors: [
      '.post-thumbnail img',
      '.featured-image img',
      '.entry-content img:first-of-type'
    ],
    headers: { 'Referer': 'https://gabonactu.com/' }
  },
  'insidenews241.com': {
    selectors: [
      '.featured-img img',
      '.post-image img',
      'article .entry-content img:first-of-type'
    ],
    headers: { 'Referer': 'https://insidenews241.com/' }
  },
  'focusgroupemedia.com': {
    selectors: [
      '.jeg_featured_img img',
      '.featured-image img',
      '.wp-block-image img'
    ],
    headers: { 'Referer': 'https://focusgroupemedia.com/' }
  },
  'lalibreville.com': {
    selectors: [
      '.single-featured-image img',
      '.entry-thumb img',
      'article img.wp-post-image'
    ],
    headers: { 'Referer': 'https://lalibreville.com/' }
  },
  'lunion.ga': {
    selectors: [
      '.article-thumbnail img',
      '.news-image img',
      'article img:first-of-type'
    ],
    headers: { 'Referer': 'https://lunion.ga/' }
  },
  'union.sonapresse.com': {
    selectors: [
      '.article-thumbnail img',
      '.news-image img',
      'article img:first-of-type'
    ],
    headers: { 'Referer': 'https://union.sonapresse.com/' }
  },
  'rfi.fr': {
    selectors: [
      'figure.m-figure img',
      '.article-image img',
      'img.article__illustration'
    ],
    headers: { 'Referer': 'https://www.rfi.fr/' }
  },
  'jeuneafrique.com': {
    selectors: [
      '.article-image img',
      'figure.article__cover img',
      '.entry-content img:first-of-type'
    ],
    headers: { 'Referer': 'https://www.jeuneafrique.com/' }
  },
  'france24.com': {
    selectors: [
      'figure.article__image img',
      '.article-main img:first-of-type',
      'img.article__media'
    ],
    headers: { 'Referer': 'https://www.france24.com/' }
  }
};

// ==================== EXPRESSIONS RÉGULIÈRES CDN ====================

/**
 * Patterns regex pour extraire les images depuis les CDN courants
 */
const CDN_PATTERNS = [
  // WordPress CDN
  /i[0-3]\.wp\.com\/[^\s"']+\.(jpg|jpeg|png|webp|gif)/gi,
  // Cloudinary
  /res\.cloudinary\.com\/[^\s"']+\.(jpg|jpeg|png|webp|gif)/gi,
  // Facebook CDN
  /scontent[a-z0-9-]*\.xx\.fbcdn\.net\/[^\s"']+/gi,
  /external[a-z0-9-]*\.xx\.fbcdn\.net\/[^\s"']+/gi,
  // Instagram CDN
  /scontent[a-z0-9-]*\.cdninstagram\.com\/[^\s"']+/gi,
  // Twitter CDN
  /pbs\.twimg\.com\/media\/[^\s"']+/gi,
  // Supabase Storage
  /[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^\s"']+/gi,
  // Imgur
  /i\.imgur\.com\/[^\s"']+\.(jpg|jpeg|png|webp|gif)/gi,
  // Generic image URLs
  /https?:\/\/[^\s"']+\/[^\s"']+\.(jpg|jpeg|png|webp)(\?[^\s"']*)?/gi
];

// ==================== PLUS DE FALLBACKS UNSPLASH ====================
// Les fallbacks Unsplash ont été supprimés
// Le frontend affiche une icône gradient quand il n'y a pas d'image

// ==================== CLASSE PRINCIPALE ====================

class ImageExtractor {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 2;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Googlebot-Image/1.0',
      'Twitterbot/1.0'
    ];
    this.minImageSize = options.minImageSize || { width: 200, height: 150 };
  }

  /**
   * Extraire l'image d'un article via plusieurs stratégies
   * @param {string} url - URL de l'article
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<{imageUrl: string|null, source: string, strategy: string}>}
   */
  async extractImage(url, options = {}) {
    const { category = null, source = null, forceRefresh = false } = options;

    console.log(`🔍 [ImageExtractor] Extraction image depuis: ${url}`);

    let result = { imageUrl: null, source: null, strategy: null };

    // 🔵 STRATÉGIE SPÉCIALE FACEBOOK - Priorité absolue
    if (this.isFacebookUrl(url)) {
      console.log(`📘 [ImageExtractor] URL Facebook détectée, stratégie spéciale...`);
      result = await this.tryFacebookSpecial(url);
      if (result.imageUrl) {
        console.log(`✅ [ImageExtractor] Image Facebook trouvée via ${result.strategy}`);
        return result;
      }
    }

    let retries = 0;

    while (retries < this.maxRetries && !result.imageUrl) {
      try {
        // Récupérer le HTML de la page
        const html = await this.fetchPage(url, retries);
        if (!html) {
          retries++;
          continue;
        }

        const $ = cheerio.load(html);
        const domain = this.getDomain(url);

        // Stratégie 1: Meta Open Graph
        result = await this.tryOpenGraph($);
        if (result.imageUrl) break;

        // Stratégie 2: Meta Twitter Card
        result = await this.tryTwitterCard($);
        if (result.imageUrl) break;

        // Stratégie 3: Schema.org / JSON-LD
        result = await this.tryJsonLd($);
        if (result.imageUrl) break;

        // Stratégie 4: Microdata
        result = await this.tryMicrodata($);
        if (result.imageUrl) break;

        // Stratégie 5: Sélecteurs spécifiques au domaine
        result = await this.tryDomainSpecific($, domain);
        if (result.imageUrl) break;

        // Stratégie 6: Heuristiques HTML
        result = await this.tryHtmlHeuristics($, url);
        if (result.imageUrl) break;

        // Stratégie 7: Regex sur le HTML brut
        result = await this.tryCdnPatterns(html);
        if (result.imageUrl) break;

        retries++;
      } catch (error) {
        console.warn(`⚠️ [ImageExtractor] Erreur tentative ${retries + 1}:`, error.message);
        retries++;
      }
    }

    // Pas de fallback Unsplash - retourner null si pas d'image trouvée
    // Le frontend affichera une icône gradient à la place

    // Valider l'URL finale
    if (result.imageUrl) {
      result.imageUrl = this.normalizeImageUrl(result.imageUrl, url);
    }

    console.log(`✅ [ImageExtractor] Résultat: ${result.imageUrl ? 'Image trouvée' : 'Pas d\'image'} via ${result.strategy || 'aucune stratégie'}`);
    return result;
  }

  /**
   * Récupérer le HTML d'une page avec retry et rotation de User-Agent
   */
  async fetchPage(url, retryIndex = 0) {
    try {
      const domain = this.getDomain(url);
      const config = DOMAIN_CONFIGS[domain] || {};

      const headers = {
        'User-Agent': this.userAgents[retryIndex % this.userAgents.length],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        ...config.headers
      };

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers,
        maxRedirects: 5,
        validateStatus: status => status < 400
      });

      return response.data;
    } catch (error) {
      console.warn(`⚠️ [fetchPage] Erreur: ${error.message}`);
      return null;
    }
  }

  /**
   * Stratégie 1: Open Graph meta tags
   */
  async tryOpenGraph($) {
    const selectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image:url"]'
    ];

    for (const selector of selectors) {
      const content = $(selector).attr('content');
      if (content && this.isValidImageUrl(content)) {
        return { imageUrl: content, source: 'og:image', strategy: 'open-graph' };
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Stratégie 2: Twitter Card meta tags
   */
  async tryTwitterCard($) {
    const selectors = [
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'meta[property="twitter:image"]'
    ];

    for (const selector of selectors) {
      const content = $(selector).attr('content');
      if (content && this.isValidImageUrl(content)) {
        return { imageUrl: content, source: 'twitter:image', strategy: 'twitter-card' };
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Stratégie 3: JSON-LD / Schema.org
   */
  async tryJsonLd($) {
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      try {
        const json = JSON.parse($(scripts[i]).html());
        const images = this.extractImagesFromJsonLd(json);

        for (const imageUrl of images) {
          if (this.isValidImageUrl(imageUrl)) {
            return { imageUrl, source: 'json-ld', strategy: 'schema-org' };
          }
        }
      } catch (e) {
        // JSON invalide, continuer
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Extraire les images depuis un objet JSON-LD
   */
  extractImagesFromJsonLd(json, images = []) {
    if (!json) return images;

    if (Array.isArray(json)) {
      json.forEach(item => this.extractImagesFromJsonLd(item, images));
    } else if (typeof json === 'object') {
      // Chercher les propriétés d'image
      const imageProps = ['image', 'thumbnailUrl', 'contentUrl', 'primaryImageOfPage'];
      for (const prop of imageProps) {
        if (json[prop]) {
          if (typeof json[prop] === 'string') {
            images.push(json[prop]);
          } else if (Array.isArray(json[prop])) {
            json[prop].forEach(img => {
              if (typeof img === 'string') images.push(img);
              else if (img.url) images.push(img.url);
            });
          } else if (json[prop].url) {
            images.push(json[prop].url);
          }
        }
      }

      // Récursion sur les objets imbriqués
      for (const key of Object.keys(json)) {
        if (typeof json[key] === 'object') {
          this.extractImagesFromJsonLd(json[key], images);
        }
      }
    }

    return images;
  }

  /**
   * Stratégie 4: Microdata
   */
  async tryMicrodata($) {
    const selectors = [
      '[itemprop="image"]',
      '[itemprop="thumbnailUrl"]',
      '[itemprop="contentUrl"]'
    ];

    for (const selector of selectors) {
      const elem = $(selector).first();
      if (elem.length) {
        const src = elem.attr('src') || elem.attr('content') || elem.attr('href');
        if (src && this.isValidImageUrl(src)) {
          return { imageUrl: src, source: 'microdata', strategy: 'microdata' };
        }
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Stratégie 5: Sélecteurs spécifiques au domaine
   */
  async tryDomainSpecific($, domain) {
    const config = DOMAIN_CONFIGS[domain];
    if (!config || !config.selectors) {
      return { imageUrl: null, source: null, strategy: null };
    }

    for (const selector of config.selectors) {
      const elem = $(selector).first();
      if (elem.length) {
        const src = elem.attr('src') || elem.attr('data-src') || elem.attr('data-lazy-src');
        if (src && this.isValidImageUrl(src)) {
          return { imageUrl: src, source: domain, strategy: 'domain-specific' };
        }
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Stratégie 6: Heuristiques HTML
   * Cherche les images dans le contenu de l'article
   */
  async tryHtmlHeuristics($, baseUrl) {
    const candidates = [];

    // Sélecteurs génériques pour articles
    const articleSelectors = [
      'article img',
      '.post-content img',
      '.entry-content img',
      '.article-content img',
      '.article-body img',
      '.content img',
      '.main-content img',
      'figure img',
      '.wp-post-image',
      'img.attachment-full',
      'img.size-full'
    ];

    for (const selector of articleSelectors) {
      $(selector).each((i, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src');
        if (src && this.isValidImageUrl(src)) {
          const width = parseInt($(elem).attr('width')) || 0;
          const height = parseInt($(elem).attr('height')) || 0;
          const alt = $(elem).attr('alt') || '';

          // Calculer un score de pertinence
          let score = 0;
          if (width >= this.minImageSize.width) score += 2;
          if (height >= this.minImageSize.height) score += 2;
          if (!this.isIconOrAvatar(src)) score += 3;
          if (alt.length > 10) score += 1;
          if (i === 0) score += 2; // Première image souvent la plus pertinente

          candidates.push({ src, score, width, height });
        }
      });
    }

    // Trier par score décroissant
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      return {
        imageUrl: candidates[0].src,
        source: 'html-heuristics',
        strategy: 'heuristics'
      };
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Stratégie 7: Patterns CDN via regex
   */
  async tryCdnPatterns(html) {
    for (const pattern of CDN_PATTERNS) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Filtrer les petites images et icônes
        for (const match of matches) {
          if (this.isValidImageUrl(match) && !this.isIconOrAvatar(match)) {
            return { imageUrl: match, source: 'cdn-pattern', strategy: 'regex' };
          }
        }
      }
    }

    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Normaliser l'URL de l'image (ajouter protocole si manquant, résoudre chemins relatifs)
   */
  normalizeImageUrl(imageUrl, baseUrl) {
    try {
      if (!imageUrl) return null;

      // Si déjà une URL absolue
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }

      // URL relative au protocole
      if (imageUrl.startsWith('//')) {
        return 'https:' + imageUrl;
      }

      // URL relative au domaine
      if (imageUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${imageUrl}`;
      }

      // URL relative au chemin
      const base = new URL(baseUrl);
      return new URL(imageUrl, base.href).href;
    } catch (error) {
      console.warn(`⚠️ [normalizeImageUrl] Erreur: ${error.message}`);
      return imageUrl;
    }
  }

  /**
   * Valider une URL d'image
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Longueur raisonnable
    if (url.length < 10 || url.length > 2000) return false;

    // Exclure les data URIs trop longs (petites images inline OK)
    if (url.startsWith('data:') && url.length > 500) return false;

    // Exclure certains patterns problématiques
    const excludePatterns = [
      'safe_image.php',  // Facebook safe_image
      'blank.gif',
      'pixel.gif',
      'spacer.gif',
      '1x1.png',
      'loading.gif',
      'placeholder',
      'avatar',
      'profile_pic',
      'favicon',
      '/emoji/',
      '/icons/',
      '/icon/',
      '/sprites/',
      '.svg'  // Exclure SVG pour le contenu (souvent icônes)
    ];

    const lowerUrl = url.toLowerCase();
    for (const pattern of excludePatterns) {
      if (lowerUrl.includes(pattern)) return false;
    }

    return true;
  }

  /**
   * Vérifier si c'est une icône ou un avatar
   */
  isIconOrAvatar(url) {
    const lowerUrl = url.toLowerCase();
    const patterns = [
      'icon', 'avatar', 'profile', 'logo', 'emoji',
      '_s.', '_n.', '_t.', // Thumbnails Facebook
      '50x50', '100x100', '150x150', // Petites tailles
      'gravatar.com'
    ];

    return patterns.some(p => lowerUrl.includes(p));
  }

  /**
   * Vérifier si l'URL est une URL Facebook
   */
  isFacebookUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('facebook.com') ||
           lowerUrl.includes('fb.com') ||
           lowerUrl.includes('fb.watch');
  }

  /**
   * 📘 STRATÉGIE FACEBOOK SPÉCIALE
   * Utilise le User-Agent facebookexternalhit pour scraper les vraies images
   * Plusieurs tentatives avec différentes approches
   */
  async tryFacebookSpecial(url) {
    console.log(`📘 [Facebook] Tentative d'extraction pour: ${url}`);

    // Tentative 1: User-Agent Facebook Crawler
    let imageUrl = await this.tryFacebookCrawler(url);
    if (imageUrl) {
      return { imageUrl, source: 'facebook-crawler', strategy: 'facebook-og' };
    }

    // Tentative 2: Version mobile de Facebook
    imageUrl = await this.tryFacebookMobile(url);
    if (imageUrl) {
      return { imageUrl, source: 'facebook-mobile', strategy: 'facebook-mobile' };
    }

    // Tentative 3: Extraction depuis l'ID du post
    imageUrl = await this.tryFacebookPostId(url);
    if (imageUrl) {
      return { imageUrl, source: 'facebook-post-id', strategy: 'facebook-scrape' };
    }

    console.log(`⚠️ [Facebook] Aucune image trouvée pour: ${url}`);
    return { imageUrl: null, source: null, strategy: null };
  }

  /**
   * Tentative 1: Scraper Facebook avec User-Agent facebookexternalhit
   */
  async tryFacebookCrawler(url) {
    try {
      console.log(`  📘 [Facebook] Stratégie 1: User-Agent Crawler`);

      const response = await axios.get(url, {
        timeout: FACEBOOK_CONFIG.timeout,
        maxRedirects: FACEBOOK_CONFIG.maxRedirects,
        headers: {
          'User-Agent': FACEBOOK_CONFIG.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const $ = cheerio.load(response.data);

      // Chercher og:image
      let imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isValidFacebookImage(imageUrl)) {
        console.log(`  ✅ [Facebook] Image trouvée via og:image`);
        return imageUrl;
      }

      // Chercher twitter:image
      imageUrl = $('meta[name="twitter:image"]').attr('content');
      if (imageUrl && this.isValidFacebookImage(imageUrl)) {
        console.log(`  ✅ [Facebook] Image trouvée via twitter:image`);
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.log(`  ⚠️ [Facebook] Stratégie 1 échouée: ${error.message}`);
      return null;
    }
  }

  /**
   * Tentative 2: Version mobile de Facebook (m.facebook.com)
   */
  async tryFacebookMobile(url) {
    try {
      console.log(`  📘 [Facebook] Stratégie 2: Version Mobile`);

      // Convertir l'URL en version mobile
      const mobileUrl = url
        .replace('www.facebook.com', 'm.facebook.com')
        .replace('facebook.com', 'm.facebook.com');

      const response = await axios.get(mobileUrl, {
        timeout: FACEBOOK_CONFIG.timeout,
        maxRedirects: FACEBOOK_CONFIG.maxRedirects,
        headers: {
          'User-Agent': FACEBOOK_CONFIG.mobileUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Referer': 'https://m.facebook.com/'
        }
      });

      const $ = cheerio.load(response.data);

      // og:image sur la version mobile
      let imageUrl = $('meta[property="og:image"]').attr('content');
      if (imageUrl && this.isValidFacebookImage(imageUrl)) {
        console.log(`  ✅ [Facebook] Image trouvée via mobile og:image`);
        return imageUrl;
      }

      // Chercher les images dans le contenu mobile
      const images = [];
      $('img').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && this.isValidFacebookImage(src)) {
          images.push(src);
        }
      });

      // Prendre la plus grande image (généralement la première non-avatar)
      if (images.length > 0) {
        // Trier par taille d'URL (heuristique: plus longue = plus grande image)
        const bestImage = images.sort((a, b) => b.length - a.length)[0];
        console.log(`  ✅ [Facebook] Image trouvée via scraping mobile`);
        return bestImage;
      }

      return null;
    } catch (error) {
      console.log(`  ⚠️ [Facebook] Stratégie 2 échouée: ${error.message}`);
      return null;
    }
  }

  /**
   * Tentative 3: Extraction via l'ID du post Facebook
   */
  async tryFacebookPostId(url) {
    try {
      console.log(`  📘 [Facebook] Stratégie 3: Extraction ID post`);

      // Extraire l'ID du post depuis différents formats d'URL
      let postId = null;

      // Format: /posts/123456
      let match = url.match(/\/posts\/([^/?]+)/);
      if (match) postId = match[1];

      // Format: /permalink/123456
      if (!postId) {
        match = url.match(/\/permalink\/([^/?]+)/);
        if (match) postId = match[1];
      }

      // Format: story_fbid=123456
      if (!postId) {
        match = url.match(/story_fbid=([^&]+)/);
        if (match) postId = match[1];
      }

      // Format: /photos/123456
      if (!postId) {
        match = url.match(/\/photos\/[^/]+\/([^/?]+)/);
        if (match) postId = match[1];
      }

      if (!postId) {
        console.log(`  ⚠️ [Facebook] Impossible d'extraire l'ID du post`);
        return null;
      }

      // Essayer de récupérer l'image via l'URL directe du post
      const directUrl = `https://www.facebook.com/${postId}`;

      const response = await axios.get(directUrl, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': FACEBOOK_CONFIG.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);
      const imageUrl = $('meta[property="og:image"]').attr('content');

      if (imageUrl && this.isValidFacebookImage(imageUrl)) {
        console.log(`  ✅ [Facebook] Image trouvée via ID post`);
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.log(`  ⚠️ [Facebook] Stratégie 3 échouée: ${error.message}`);
      return null;
    }
  }

  /**
   * Valider une image Facebook (exclure les placeholders et icônes)
   */
  isValidFacebookImage(url) {
    if (!url || typeof url !== 'string') return false;

    // Doit commencer par http
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

    // Exclure les images problématiques Facebook
    const excludePatterns = [
      'safe_image.php',        // Facebook safe_image placeholder
      '/images/default',       // Facebook default images
      'static.xx.fbcdn',       // Images statiques Facebook (icônes)
      'profile_pic',           // Photos de profil
      'avatar',                // Avatars
      'favicon',               // Favicons
      '_n.jpg',                // Thumbnails très petits
      '_s.jpg',                // Thumbnails très petits
      '_t.jpg',                // Thumbnails très petits
      '50x50',                 // Très petites images
      '100x100',               // Petites images
      'emoji',                 // Emojis
      '/icons/',               // Icônes
      'rsrc.php'               // Resources Facebook
    ];

    const lowerUrl = url.toLowerCase();
    for (const pattern of excludePatterns) {
      if (lowerUrl.includes(pattern)) return false;
    }

    // Doit être assez longue (les vraies images ont des URLs longues)
    if (url.length < 50) return false;
    if (url.length > 2000) return false;

    return true;
  }

  /**
   * Extraire le domaine d'une URL
   */
  getDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  /**
   * Extraction en batch pour plusieurs articles
   */
  async extractBatch(articles, options = {}) {
    const { concurrency = 5, onProgress = null } = options;
    const results = [];
    let processed = 0;

    // Traitement par lots
    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async (article) => {
          const result = await this.extractImage(article.url, {
            category: article.category,
            source: article.source
          });
          return { articleId: article.id, ...result };
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            articleId: batch[results.length % batch.length]?.id,
            imageUrl: null,
            error: result.reason?.message
          });
        }
      }

      processed += batch.length;

      if (onProgress) {
        onProgress({ processed, total: articles.length, percentage: Math.round((processed / articles.length) * 100) });
      }

      // Petit délai entre les batches pour éviter le rate limiting
      if (i + concurrency < articles.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return results;
  }
}

// Export singleton
const imageExtractor = new ImageExtractor();

module.exports = {
  ImageExtractor,
  imageExtractor,
  DOMAIN_CONFIGS
};
