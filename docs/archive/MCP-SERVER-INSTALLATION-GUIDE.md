# 🚀 Installation Serveur MCP pour Extraction d'Images Avancée

## 📊 État Actuel
- **Taux de succès actuel** : 67% (192/287 articles avec images)
- **Système actuel** : Simulation MCP avec fetch direct + Cheerio
- **Objectif** : Atteindre 85%+ de taux de succès avec un vrai serveur MCP

## 🎯 Options d'Installation MCP

### Option 1: MCP Server Local (Recommandé pour développement)

#### 1.1 Installation des dépendances
```bash
# Dans le dossier du projet
npm install @modelcontextprotocol/server-fetch
npm install @modelcontextprotocol/server-puppeteer
npm install puppeteer
```

#### 1.2 Créer le serveur MCP
```javascript
// mcp-server/image-extractor.js
const { Server } = require('@modelcontextprotocol/server-fetch');
const puppeteer = require('puppeteer');

class ImageExtractorMCP extends Server {
  constructor() {
    super({
      name: 'gabon24-7-image-extractor',
      version: '1.0.0'
    });
    
    this.addTool({
      name: 'extract_images_advanced',
      description: 'Extract images from web pages with advanced techniques',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          source: { type: 'string' }
        }
      }
    }, this.extractImagesAdvanced.bind(this));
  }

  async extractImagesAdvanced({ url, source }) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
      
      // Strategies spécifiques par source
      const strategies = await this.getExtractionStrategies(page, source);
      
      for (const strategy of strategies) {
        const images = await strategy(page);
        if (images.length > 0) {
          await browser.close();
          return { images, method: strategy.name };
        }
      }
      
      await browser.close();
      return { images: [], method: 'none' };
      
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async getExtractionStrategies(page, source) {
    return [
      // Stratégie 1: Meta tags
      async (page) => {
        return await page.evaluate(() => {
          const ogImage = document.querySelector('meta[property="og:image"]')?.content;
          const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content;
          return [ogImage, twitterImage].filter(Boolean);
        });
      },
      
      // Stratégie 2: Images visibles avec dimensions
      async (page) => {
        return await page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          return images
            .filter(img => img.offsetWidth > 200 && img.offsetHeight > 150)
            .map(img => img.src)
            .filter(src => src && !src.includes('icon') && !src.includes('logo'));
        });
      },
      
      // Stratégie 3: Spécifique Facebook
      async (page) => {
        if (!source.toLowerCase().includes('facebook')) return [];
        return await page.evaluate(() => {
          const fbImages = Array.from(document.querySelectorAll('img[src*="fbcdn.net"], img[src*="scontent"]'));
          return fbImages.map(img => img.src);
        });
      },
      
      // Stratégie 4: WordPress featured images
      async (page) => {
        return await page.evaluate(() => {
          const wpImages = Array.from(document.querySelectorAll('.wp-post-image, .post-thumbnail img, .featured-image img'));
          return wpImages.map(img => img.src);
        });
      }
    ];
  }
}

module.exports = ImageExtractorMCP;
```

#### 1.3 Démarrer le serveur MCP
```bash
# Créer le script de démarrage
node mcp-server/start-server.js
```

### Option 2: MCP Server Cloud (Recommandé pour production)

#### 2.1 Utiliser un service MCP hébergé
```javascript
// netlify/functions/mcp-image-extractor.js
const { MCPClient } = require('@modelcontextprotocol/client');

const client = new MCPClient({
  serverUrl: process.env.MCP_SERVER_URL, // URL du serveur MCP hébergé
  apiKey: process.env.MCP_API_KEY
});

exports.handler = async (event, context) => {
  const { url, source } = JSON.parse(event.body);
  
  try {
    const result = await client.callTool('extract_images_advanced', {
      url,
      source
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Option 3: MCP Server Intégré (Solution Hybride)

#### 3.1 Améliorer le système actuel avec techniques avancées
```javascript
// Ajouter à homepage-articles-new.js
async function extractImageWithAdvancedMCP(articleUrl, source) {
  try {
    // Technique 1: Fetch avec headers avancés
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Gabon24-7Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 12000
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Technique 2: Parsing avancé avec priorités dynamiques
    const images = await extractImagesAdvanced(html, articleUrl, source);
    
    // Technique 3: Validation avancée des images
    const validImages = await validateImagesAdvanced(images);
    
    return selectBestImageAdvanced(validImages, source);
    
  } catch (error) {
    console.error(`❌ [ADVANCED-MCP] Erreur: ${error.message}`);
    return null;
  }
}

async function extractImagesAdvanced(html, articleUrl, source) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const images = [];
  
  // Stratégie avancée 1: JSON-LD structured data
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data.image) {
        const imageUrl = typeof data.image === 'string' ? data.image : data.image.url;
        if (imageUrl) images.push({ url: imageUrl, priority: 10, method: 'json-ld' });
      }
    } catch (e) {}
  });
  
  // Stratégie avancée 2: CSS background-image
  $('div, section, header').each((i, el) => {
    const style = $(el).attr('style');
    if (style && style.includes('background-image')) {
      const match = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
      if (match && match[1]) {
        images.push({ url: match[1], priority: 7, method: 'css-background' });
      }
    }
  });
  
  // Stratégie avancée 3: Lazy loading avec data-src, data-lazy-src
  $('img[data-src], img[data-lazy-src], img[data-original]').each((i, el) => {
    const dataSrc = $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-original');
    if (dataSrc) {
      images.push({ url: dataSrc, priority: 8, method: 'lazy-loading' });
    }
  });
  
  // Stratégie avancée 4: Srcset pour images responsives
  $('img[srcset]').each((i, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
      urls.forEach(url => {
        images.push({ url, priority: 6, method: 'srcset' });
      });
    }
  });
  
  return images.sort((a, b) => b.priority - a.priority);
}

async function validateImagesAdvanced(images) {
  const validImages = [];
  
  for (const img of images.slice(0, 10)) { // Limiter à 10 pour performance
    try {
      // Validation HEAD request pour vérifier que l'image existe
      const headResponse = await fetch(img.url, { 
        method: 'HEAD', 
        timeout: 3000 
      });
      
      if (headResponse.ok) {
        const contentType = headResponse.headers.get('content-type');
        const contentLength = headResponse.headers.get('content-length');
        
        if (contentType && contentType.startsWith('image/') && 
            (!contentLength || parseInt(contentLength) > 5000)) {
          validImages.push({
            ...img,
            contentType,
            size: contentLength ? parseInt(contentLength) : null
          });
        }
      }
    } catch (e) {
      // Image non accessible, on passe
    }
  }
  
  return validImages;
}
```

## 🚀 Implémentation Recommandée (Option 3 - Hybride)

### Étape 1: Améliorer le système actuel
```bash
# Pas besoin d'installation externe, juste améliorer le code existant
```

### Étape 2: Ajouter les techniques avancées
- JSON-LD structured data
- CSS background-image extraction
- Lazy loading detection
- Srcset parsing
- Validation HEAD requests

### Étape 3: Monitoring amélioré
```javascript
// Ajouter des métriques détaillées
const extractionStats = {
  'json-ld': 0,
  'css-background': 0,
  'lazy-loading': 0,
  'srcset': 0,
  'meta-tags': 0,
  'wordpress': 0
};
```

## 📊 Objectifs d'Amélioration

### Taux de Succès Cibles
- **Actuel** : 67% (192/287)
- **Objectif Phase 1** : 75% (+23 articles avec images)
- **Objectif Phase 2** : 85% (+52 articles avec images)
- **Objectif Final** : 90%+ (258+ articles avec images)

### Sources Prioritaires à Améliorer
1. **Articles sans images RSS** : Focus principal
2. **Sites WordPress** : Extraction featured images
3. **Sites avec lazy loading** : Détection data-src
4. **Sites avec JSON-LD** : Structured data
5. **Sites avec CSS backgrounds** : Images en arrière-plan

## 🔧 Prochaines Étapes

1. **Choisir l'option** (Recommandé: Option 3 - Hybride)
2. **Implémenter les améliorations** dans homepage-articles-new.js
3. **Tester et valider** l'amélioration du taux de succès
4. **Déployer** et monitorer les résultats
5. **Itérer** selon les résultats obtenus

Quelle option préférez-vous pour commencer ?
