# Prompt Détaillé : Système RSS SaaS pour Médias Gabonais avec Windsurf Cascade

## Contexte du Projet

Tu es un architecte logiciel expert chargé de développer un système robuste de création et génération de flux RSS similaire à rss.app, spécialement conçu pour un SaaS d'agrégation de médias gabonais. Le système doit être moderne, scalable et intégrer les meilleures pratiques du développement web.

## Objectifs Techniques

### Fonctionnalités Core
- **Génération de flux RSS standards** (XML RSS 2.0/Atom 1.0) ET API JSON/REST
- **Scraping web intelligent** avec support YouTube et sites médias gabonais
- **Intégration Supabase** pour base de données et real-time
- **Monitoring temps réel** avec vérification automatique toutes les 5 minutes
- **Extraction complète d'articles** avec déduplication intelligente
- **Architecture scalable** pour croissance SaaS

### Architecture Recommandée

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│   API Gateway    │───▶│  RSS Service    │
│  (React/Vue)    │    │ (Rate Limiting)  │    │ (Feed Gen/API)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │                       │
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Scraping Service │    │ Supabase DB     │
                       │ (Multi-source)   │    │ (PostgreSQL +   │
                       └──────────────────┘    │ Real-time)      │
                                │              └─────────────────┘
                       ┌──────────────────┐    
                       │ Monitoring       │    
                       │ (Health Checks)  │    
                       └──────────────────┘    
```

## Spécifications Techniques Détaillées

### 1. Structure du Projet

Crée la structure suivante :

```
gabonrss-system/
├── .windsurf/
│   ├── CLAUDE.md                 # Configuration Windsurf
│   └── commands/                 # Commandes personnalisées
├── apps/
│   ├── api/                      # API principale
│   │   ├── src/
│   │   │   ├── controllers/      # Controllers REST
│   │   │   ├── services/         # Business logic
│   │   │   │   ├── rss-generator.ts
│   │   │   │   ├── feed-scraper.ts
│   │   │   │   └── content-processor.ts
│   │   │   ├── middleware/       # Rate limiting, auth
│   │   │   ├── models/          # Types et interfaces
│   │   │   └── utils/           # Helpers
│   │   └── package.json
│   ├── scraper/                 # Service de scraping
│   │   ├── src/
│   │   │   ├── scrapers/        # Scrapers par source
│   │   │   ├── processors/      # Content processing
│   │   │   └── scheduler/       # Job scheduling
│   │   └── package.json
│   └── monitoring/              # Service de monitoring
├── packages/
│   ├── shared/                  # Types partagés
│   └── config/                  # Configuration commune
├── supabase/
│   ├── migrations/              # DB migrations
│   ├── functions/               # Edge Functions
│   └── config.toml
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfiles/
└── docs/
```

### 2. Schéma Base de Données Supabase

Implémente ces tables PostgreSQL avec RLS :

```sql
-- Table des sources RSS
CREATE TABLE sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    url text NOT NULL UNIQUE,
    source_type text NOT NULL, -- 'rss', 'website', 'youtube'
    scraping_config jsonb DEFAULT '{}',
    user_id uuid REFERENCES auth.users(id),
    sync_interval integer DEFAULT 300, -- 5 minutes
    last_sync_at timestamptz,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table des articles avec déduplication
CREATE TABLE feed_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    content text,
    url text NOT NULL,
    guid text,
    author text,
    pub_date timestamptz,
    image_url text,
    categories text[],
    user_id uuid REFERENCES auth.users(id),
    content_hash text UNIQUE, -- Pour déduplication
    raw_data jsonb DEFAULT '{}',
    extraction_metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Table monitoring et métriques
CREATE TABLE sync_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES sources(id),
    status text NOT NULL, -- 'success', 'error', 'partial'
    items_processed integer DEFAULT 0,
    duration_ms integer,
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Indexes de performance
CREATE INDEX idx_feed_items_user_pub_date ON feed_items(user_id, pub_date DESC);
CREATE INDEX idx_feed_items_content_hash ON feed_items(content_hash);
CREATE INDEX idx_sources_active_sync ON sources(is_active, sync_interval) WHERE is_active = true;
```

### 3. Service de Génération RSS

Développe un générateur RSS robuste :

```typescript
// apps/api/src/services/rss-generator.ts
import { Feed } from 'feed';
import { Database } from '@/types/supabase';
import { supabase } from '@/lib/supabase';

interface RSSConfig {
  title: string;
  description: string;
  url: string;
  language: string;
  maxItems: number;
}

export class RSSGenerator {
  private config: RSSConfig;

  constructor(config: RSSConfig) {
    this.config = config;
  }

  async generateFeed(userId: string, sources?: string[]): Promise<{
    rss: string;
    atom: string;
    json: string;
  }> {
    const feed = new Feed({
      title: this.config.title,
      description: this.config.description,
      id: this.config.url,
      link: this.config.url,
      language: this.config.language || 'fr',
      updated: new Date(),
      generator: 'GabonRSS v1.0',
      feedLinks: {
        rss: `${this.config.url}/rss.xml`,
        json: `${this.config.url}/feed.json`,
        atom: `${this.config.url}/atom.xml`
      },
      author: {
        name: 'GabonRSS',
        link: this.config.url
      }
    });

    // Récupérer les articles avec optimisation
    const { data: items, error } = await supabase
      .from('feed_items')
      .select(`
        *,
        sources!inner(name, url)
      `)
      .eq('user_id', userId)
      .in('source_id', sources || [])
      .order('pub_date', { ascending: false })
      .limit(this.config.maxItems);

    if (error) throw error;

    // Ajouter les items au feed
    items?.forEach(item => {
      feed.addItem({
        title: item.title,
        id: item.url,
        link: item.url,
        description: item.description || '',
        content: item.content || item.description || '',
        author: item.author ? [{ name: item.author }] : [],
        date: new Date(item.pub_date),
        category: item.categories?.map(cat => ({ name: cat })) || [],
        image: item.image_url
      });
    });

    return {
      rss: feed.rss2(),
      atom: feed.atom1(),
      json: feed.json1()
    };
  }
}
```

### 4. Système de Scraping Intelligent

Implémente un scraper adaptatif pour médias gabonais :

```typescript
// apps/scraper/src/scrapers/adaptive-scraper.ts
import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { Database } from '@/types/supabase';

interface ScrapingConfig {
  requiresJS: boolean;
  selectors: {
    title: string[];
    content: string[];
    date: string[];
    author: string[];
    link: string[];
  };
  encoding: string;
  rateLimit: number;
}

export class AdaptiveScraper {
  private browser?: Browser;
  private gabonMediaConfigs: Record<string, ScrapingConfig>;

  constructor() {
    // Configuration spécifique aux médias gabonais
    this.gabonMediaConfigs = {
      'gabonreview.com': {
        requiresJS: false,
        selectors: {
          title: ['.entry-title', 'h1.title'],
          content: ['.entry-content', '.post-content'],
          date: ['.entry-date', '.published'],
          author: ['.author', '.by-author'],
          link: ['a[rel="bookmark"]']
        },
        encoding: 'utf-8',
        rateLimit: 2000
      },
      'lalibreville.com': {
        requiresJS: true,
        selectors: {
          title: ['h1', '.article-title'],
          content: ['.article-content', '.post-body'],
          date: ['.date', '.timestamp'],
          author: ['.author-name'],
          link: ['.article-link', 'h1 a']
        },
        encoding: 'utf-8',
        rateLimit: 3000
      }
    };
  }

  async scrapeSource(url: string, config?: ScrapingConfig): Promise<any[]> {
    const domain = new URL(url).hostname;
    const scrapeConfig = config || this.gabonMediaConfigs[domain] || this.getDefaultConfig();
    
    try {
      let content: string;
      
      if (scrapeConfig.requiresJS) {
        content = await this.scrapeWithBrowser(url);
      } else {
        content = await this.scrapeWithHTTP(url);
      }

      return this.parseContent(content, scrapeConfig, url);
    } catch (error) {
      console.error(`Scraping failed for ${url}:`, error);
      throw error;
    }
  }

  private async scrapeWithBrowser(url: string): Promise<string> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await this.browser.newPage();
    
    // Configuration pour médias africains (connexions lentes)
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GabonRSS/1.0'
    });

    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    const content = await page.content();
    await page.close();
    
    return content;
  }

  private async scrapeWithHTTP(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GabonRSS-Bot/1.0 (Gabon Media Aggregator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  private parseContent(html: string, config: ScrapingConfig, baseUrl: string): any[] {
    const $ = cheerio.load(html);
    const items: any[] = [];

    // Détecter les articles automatiquement
    const articleSelectors = [
      'article',
      '.post',
      '.entry',
      '.article',
      '.news-item'
    ];

    let articles = $('');
    for (const selector of articleSelectors) {
      articles = $(selector);
      if (articles.length > 0) break;
    }

    articles.each((i, element) => {
      const $el = $(element);
      
      const item = {
        title: this.extractText($el, config.selectors.title),
        content: this.extractText($el, config.selectors.content),
        url: this.extractLink($el, config.selectors.link, baseUrl),
        author: this.extractText($el, config.selectors.author),
        date: this.extractDate($el, config.selectors.date),
        image: this.extractImage($el, baseUrl)
      };

      if (item.title && item.url) {
        items.push(item);
      }
    });

    return items;
  }

  private extractText($el: cheerio.Cheerio, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $el.find(selector).first().text().trim();
      if (text) return text;
    }
    return '';
  }

  private extractLink($el: cheerio.Cheerio, selectors: string[], baseUrl: string): string {
    for (const selector of selectors) {
      const href = $el.find(selector).first().attr('href');
      if (href) {
        return new URL(href, baseUrl).href;
      }
    }
    return '';
  }

  private extractDate($el: cheerio.Cheerio, selectors: string[]): Date {
    for (const selector of selectors) {
      const dateText = $el.find(selector).first().attr('datetime') || 
                       $el.find(selector).first().text();
      if (dateText) {
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) return date;
      }
    }
    return new Date();
  }

  private extractImage($el: cheerio.Cheerio, baseUrl: string): string {
    const imgSelectors = ['img', '.featured-image img', '.thumbnail img'];
    for (const selector of imgSelectors) {
      const src = $el.find(selector).first().attr('src');
      if (src) {
        return new URL(src, baseUrl).href;
      }
    }
    return '';
  }
}
```

### 5. API REST avec Rate Limiting

Crée des endpoints robustes :

```typescript
// apps/api/src/controllers/rss-controller.ts
import { Request, Response } from 'express';
import { RSSGenerator } from '@/services/rss-generator';
import { supabase } from '@/lib/supabase';
import rateLimit from 'express-rate-limit';

// Rate limiting par plan utilisateur
const createRateLimit = (requestsPerHour: number) => rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: requestsPerHour,
  message: {
    error: 'Rate limit exceeded',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

export class RSSController {
  // Rate limiting différentiel
  public freeUserLimit = createRateLimit(100);
  public premiumUserLimit = createRateLimit(1000);
  
  async generateFeed(req: Request, res: Response) {
    try {
      const { format = 'rss', sources, maxItems = 50 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Configuration du feed
      const config = {
        title: `Actualités Gabonaises - ${req.user.name}`,
        description: 'Flux RSS personnalisé des médias gabonais',
        url: `${req.protocol}://${req.get('host')}`,
        language: 'fr',
        maxItems: Math.min(parseInt(maxItems as string), 100)
      };

      const generator = new RSSGenerator(config);
      const feeds = await generator.generateFeed(
        userId, 
        sources as string[] | undefined
      );

      // Headers de cache optimisés
      res.set({
        'Content-Type': this.getContentType(format as string),
        'Cache-Control': 'public, max-age=300', // 5 minutes
        'ETag': this.generateETag(feeds[format as keyof typeof feeds]),
        'X-RateLimit-Remaining': res.get('X-RateLimit-Remaining')
      });

      res.send(feeds[format as keyof typeof feeds]);
    } catch (error) {
      console.error('RSS Generation Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate feed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async addSource(req: Request, res: Response) {
    try {
      const { url, name, type = 'website', config = {} } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!url || !name) {
        return res.status(400).json({ 
          error: 'URL and name are required' 
        });
      }

      // Vérifier si l'URL est accessible
      await this.validateSource(url);

      const { data, error } = await supabase
        .from('sources')
        .insert({
          name,
          url,
          source_type: type,
          scraping_config: config,
          user_id: userId
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error) {
      res.status(400).json({ 
        error: error.message 
      });
    }
  }

  private async validateSource(url: string): Promise<void> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Source not accessible: ${response.status}`);
      }
    } catch (error) {
      throw new Error('Unable to validate source URL');
    }
  }
}
```

### 6. Système de Monitoring Temps Réel

Implémente un monitoring robuste :

```typescript
// apps/monitoring/src/health-monitor.ts
import { supabase } from '@/lib/supabase';
import { AdaptiveScraper } from '@/scrapers/adaptive-scraper';

interface HealthMetrics {
  activeFeeds: number;
  successRate: number;
  averageResponseTime: number;
  errorCount: number;
}

export class HealthMonitor {
  private scraper: AdaptiveScraper;
  private checkInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.scraper = new AdaptiveScraper();
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(async () => {
      await this.checkAllSources();
      await this.generateHealthReport();
    }, this.checkInterval);
  }

  async checkAllSources(): Promise<void> {
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true)
      .lt('last_sync_at', new Date(Date.now() - this.checkInterval).toISOString());

    if (error || !sources) return;

    // Traitement parallèle avec limite
    const concurrency = 5;
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(source => this.syncSource(source))
      );
    }
  }

  private async syncSource(source: any): Promise<void> {
    const startTime = Date.now();
    let status = 'error';
    let itemsProcessed = 0;
    let errorMessage = '';

    try {
      const items = await this.scraper.scrapeSource(source.url, source.scraping_config);
      
      if (items.length > 0) {
        // Insertion avec déduplication
        const { data, error } = await supabase
          .from('feed_items')
          .upsert(
            items.map(item => ({
              ...item,
              source_id: source.id,
              user_id: source.user_id,
              content_hash: this.generateHash(item.title + item.content)
            })),
            { 
              onConflict: 'content_hash',
              ignoreDuplicates: true
            }
          );

        if (!error) {
          status = 'success';
          itemsProcessed = items.length;
        }
      }

      // Mise à jour timestamp
      await supabase
        .from('sources')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', source.id);

    } catch (error) {
      errorMessage = error.message;
      console.error(`Sync failed for ${source.name}:`, error);
    }

    // Log de synchronisation
    await supabase
      .from('sync_logs')
      .insert({
        source_id: source.id,
        status,
        items_processed: itemsProcessed,
        duration_ms: Date.now() - startTime,
        error_message: errorMessage || null
      });
  }

  async generateHealthReport(): Promise<HealthMetrics> {
    const [activeFeeds, recentLogs] = await Promise.all([
      this.getActiveFeedsCount(),
      this.getRecentLogs()
    ]);

    const successRate = this.calculateSuccessRate(recentLogs);
    const averageResponseTime = this.calculateAverageResponseTime(recentLogs);
    const errorCount = recentLogs.filter(log => log.status === 'error').length;

    const metrics = {
      activeFeeds,
      successRate,
      averageResponseTime,
      errorCount
    };

    // Alertes critiques
    if (successRate < 0.8 || errorCount > 10) {
      await this.sendAlert(metrics);
    }

    return metrics;
  }

  private async sendAlert(metrics: HealthMetrics): Promise<void> {
    // Intégration webhook Slack/Discord
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 GabonRSS Alert: Success rate ${metrics.successRate}%, Errors: ${metrics.errorCount}`,
          channel: '#alerts'
        })
      });
    }
  }
}
```

### 7. Configuration Docker et Déploiement

Crée une configuration de déploiement complète :

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ../
      dockerfile: docker/Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  scraper:
    build:
      context: ../
      dockerfile: docker/Dockerfile.scraper
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  monitoring:
    build:
      context: ../
      dockerfile: docker/Dockerfile.monitoring
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - ALERT_WEBHOOK_URL=${ALERT_WEBHOOK_URL}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - api
    restart: unless-stopped

volumes:
  redis_data:
```

### 8. Tests et Validation

Implémente des tests complets :

```typescript
// apps/api/tests/rss-generator.test.ts
import { RSSGenerator } from '@/services/rss-generator';
import { supabase } from '@/lib/supabase';

describe('RSSGenerator', () => {
  let generator: RSSGenerator;
  
  beforeEach(() => {
    generator = new RSSGenerator({
      title: 'Test Feed',
      description: 'Test Description',
      url: 'https://test.com',
      language: 'fr',
      maxItems: 10
    });
  });

  test('should generate valid RSS feed', async () => {
    const feeds = await generator.generateFeed('test-user-id');
    
    expect(feeds.rss).toContain('<?xml version="1.0"');
    expect(feeds.rss).toContain('<rss version="2.0">');
    expect(feeds.rss).toContain('Test Feed');
  });

  test('should handle empty feed gracefully', async () => {
    // Mock empty result
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })
    } as any);

    const feeds = await generator.generateFeed('empty-user');
    expect(feeds.rss).toContain('<channel>');
  });
});
```

## Instructions de Développement

### Phase 1 : Configuration de Base (Semaine 1)
1. **Initialise** le projet avec la structure recommandée
2. **Configure** Supabase avec les schémas de base de données
3. **Implémente** le service de génération RSS de base
4. **Crée** les endpoints API essentiels

### Phase 2 : Scraping et Monitoring (Semaine 2)
1. **Développe** le système de scraping adaptatif
2. **Implémente** la gestion des médias gabonais spécifiques
3. **Ajoute** le monitoring temps réel
4. **Configure** les alertes et notifications

### Phase 3 : Optimisation et Scalabilité (Semaine 3)
1. **Implémente** le rate limiting et la sécurité
2. **Ajoute** le caching Redis
3. **Configure** Docker et déploiement
4. **Optimise** les performances

### Phase 4 : Tests et Documentation (Semaine 4)
1. **Écris** les tests unitaires et d'intégration
2. **Configure** CI/CD avec GitHub Actions
3. **Documente** l'API avec Swagger
4. **Teste** en conditions réelles

## Considérations Spéciales pour les Médias Gabonais

### Configuration Locale
- **Encodage** UTF-8 strict pour les caractères français
- **Fuseaux horaires** GMT+1 (Afrique/Libreville)
- **Langues** : Français (principal), Fang, Mbédé
- **Connexions** : Timeouts généreux (30s+) pour infrastructure variable

### Sources Recommandées
- Gabon Review, L'Union, La Libreville
- Sites gouvernementaux (.gov.ga)
- Médias régionaux CEMAC
- Chaînes YouTube officielles

### Optimisations Performance
- **CDN** : CloudFlare avec points de présence africains
- **Compression** : Gzip/Brotli obligatoire
- **Cache** : Headers appropriés pour connexions lentes
- **Images** : Optimisation automatique et formats WebP

Cette architecture garantit un système RSS robuste, scalable et adapté aux spécificités du marché gabonais, avec une performance optimale même sur des infrastructures moins développées.