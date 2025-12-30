### 5. Service Layer Implementation

```typescript
// services/whatsapp.service.ts
import { Whapi } from 'whapi-sdk';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger';

export class WhatsAppService {
  private whapi: Whapi;
  private messageQueue: Queue;
  private channelQueue: Queue;

  constructor() {
    this.whapi# Backend Structure Document
## GabonNews WhatsApp SaaS

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
└─────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┴────────────────────────┐
        │                                                │
┌───────▼────────┐                            ┌─────────▼────────┐
│   API Server   │                            │   API Server     │
│   (Node.js)    │                            │   (Node.js)      │
└───────┬────────┘                            └─────────┬────────┘
        │                                                │
        └───────────────────┬────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
        ┌───────▼────────┐      ┌───────▼────────┐
        │    Supabase    │      │     Redis       │
        │  (PostgreSQL)  │      │    (Cache)      │
        └────────────────┘      └────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  RSS Worker    │  │ Message Worker  │  │ Payment Worker │
│   (BullMQ)     │  │    (BullMQ)     │  │   (BullMQ)     │
└────────────────┘  └────────────────┘  └────────────────┘
```

### 2. Directory Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── articles.routes.ts
│   │   │   ├── subscriptions.routes.ts
│   │   │   ├── keywords.routes.ts
│   │   │   ├── webhooks.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── articles.controller.ts
│   │   │   ├── subscriptions.controller.ts
│   │   │   └── keywords.controller.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── rateLimit.middleware.ts
│   │   │   └── error.middleware.ts
│   │   └── validators/
│   │       ├── auth.validator.ts
│   │       └── subscription.validator.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── article.service.ts
│   │   ├── subscription.service.ts
│   │   ├── keyword.service.ts
│   │   ├── whatsapp.service.ts
│   │   ├── gpt.service.ts
│   │   └── payment.service.ts
│   ├── workers/
│   │   ├── rss.worker.ts
│   │   ├── message.worker.ts
│   │   ├── payment.worker.ts
│   │   └── cleanup.worker.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── article.model.ts
│   │   ├── subscription.model.ts
│   │   └── keyword.model.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── article.repository.ts
│   │   └── subscription.repository.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── cache.ts
│   │   ├── queue.ts
│   │   └── helpers.ts
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   └── app.ts
├── tests/
├── migrations/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

### 3. Database Schema (Supabase/PostgreSQL)

```sql
-- Users table (updated with user type)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  user_type VARCHAR(20) DEFAULT 'free' CHECK (user_type IN ('free', 'premium', 'journalist', 'admin')),
  media_affiliation VARCHAR(255), -- For journalists
  language VARCHAR(2) DEFAULT 'fr',
  timezone VARCHAR(50) DEFAULT 'Africa/Libreville',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Channels table
CREATE TABLE whatsapp_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(255) UNIQUE NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(20) CHECK (channel_type IN ('main', 'premium', 'journalist')),
  subscriber_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSS feeds configuration (enhanced)
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_name VARCHAR(255) NOT NULL,
  feed_url TEXT UNIQUE NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_successful_fetch TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Editorials table (for journalist content)
CREATE TABLE editorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  editorial_type VARCHAR(50) CHECK (editorial_type IN ('matinale', 'analyse', 'revue_presse', 'custom')),
  content TEXT NOT NULL,
  gpt_generated_content TEXT,
  selected_articles UUID[], -- Array of article IDs
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'scheduled')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles table (enhanced)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL,
  source_url TEXT UNIQUE NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  media_name VARCHAR(255) NOT NULL, -- From RSS feed
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  gpt_summary TEXT,
  category VARCHAR(50),
  keywords TEXT[],
  sentiment VARCHAR(20),
  image_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(content, '')), 'C')
  ) STORED
);

-- Premium user filters
CREATE TABLE user_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filter_name VARCHAR(100),
  filter_type VARCHAR(20) CHECK (filter_type IN ('keyword', 'category', 'source', 'combined')),
  filter_value JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channel broadcast history
CREATE TABLE channel_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES whatsapp_channels(id),
  article_ids UUID[],
  message_content TEXT NOT NULL,
  broadcast_type VARCHAR(20) DEFAULT 'scheduled',
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table (updated)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'premium', 'journalist', 'enterprise')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  price_xaf INTEGER NOT NULL,
  features JSONB, -- Store plan-specific features
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_media ON articles(media_name);
CREATE INDEX idx_articles_feed ON articles(rss_feed_id);
CREATE INDEX idx_editorials_journalist ON editorials(journalist_id);
CREATE INDEX idx_editorials_status ON editorials(status);
CREATE INDEX idx_user_filters_user ON user_filters(user_id, is_active);
```

### 4. API Endpoints

```typescript
// API Routes Structure

// Authentication
POST   /api/v1/auth/register          // WhatsApp registration
POST   /api/v1/auth/verify-otp        // OTP verification
POST   /api/v1/auth/login             // Web login
POST   /api/v1/auth/journalist-verify // Journalist verification
POST   /api/v1/auth/refresh           // Token refresh
POST   /api/v1/auth/logout            // Logout

// RSS Feed Management (Admin)
GET    /api/v1/feeds                  // List all RSS feeds
POST   /api/v1/feeds                  // Add new RSS feed
PUT    /api/v1/feeds/:id              // Update RSS feed
DELETE /api/v1/feeds/:id              // Remove RSS feed
GET    /api/v1/feeds/:id/test         // Test feed connection
GET    /api/v1/feeds/health           // Check all feeds health

// WhatsApp Channel Management
GET    /api/v1/channels               // List channels
POST   /api/v1/channels/broadcast     // Send to channel
GET    /api/v1/channels/:id/stats     // Channel statistics
POST   /api/v1/channels/schedule      // Schedule broadcast

// Articles
GET    /api/v1/articles               // List articles (paginated)
GET    /api/v1/articles/:id           // Get single article
GET    /api/v1/articles/search        // Search articles
GET    /api/v1/articles/trending      // Trending articles
GET    /api/v1/articles/by-source     // Articles by media source
GET    /api/v1/articles/today         // Today's articles for editorial

// Journalist Portal
GET    /api/v1/journalist/dashboard   // Journalist dashboard data
POST   /api/v1/journalist/editorial   // Create editorial
GET    /api/v1/journalist/editorials  // List journalist's editorials
PUT    /api/v1/journalist/editorial/:id // Update editorial
POST   /api/v1/journalist/matinale    // Generate morning brief
POST   /api/v1/journalist/analyze     // Analyze selected articles
GET    /api/v1/journalist/templates   // Editorial templates

// Premium User Filters
GET    /api/v1/filters                // Get user filters
POST   /api/v1/filters                // Create filter
PUT    /api/v1/filters/:id            // Update filter
DELETE /api/v1/filters/:id            // Delete filter
POST   /api/v1/filters/test           // Test filter results

// Subscriptions
GET    /api/v1/subscriptions/current  // Current subscription
GET    /api/v1/subscriptions/plans    // Available plans (free, premium, journalist)
POST   /api/v1/subscriptions/subscribe // Subscribe to plan
POST   /api/v1/subscriptions/upgrade  // Upgrade plan
POST   /api/v1/subscriptions/cancel   // Cancel subscription
GET    /api/v1/subscriptions/history  // Payment history

// WhatsApp Webhooks
POST   /api/v1/webhooks/whatsapp      // WhatsApp messages
POST   /api/v1/webhooks/whatsapp/status // Delivery status
POST   /api/v1/webhooks/whatsapp/channel // Channel events

// Admin Routes
GET    /api/v1/admin/stats            // Dashboard statistics
GET    /api/v1/admin/users            // User management
GET    /api/v1/admin/feeds/logs       // RSS feed logs
POST   /api/v1/admin/broadcast        // Manual broadcast
GET    /api/v1/admin/editorials/review // Review pending editorials
```

### 5. Service Layer Implementation

```typescript
// services/whatsapp.service.ts
import { Whapi } from 'whapi-sdk';
import { Queue } from 'bullmq';
import { logger } from '../utils/logger';

export class WhatsAppService {
  private whapi: Whapi;
  private messageQueue: Queue;
  private channelQueue: Queue;

  constructor() {
    this.whapi = new Whapi({
      apiKey: process.env.WHAPI_API_KEY,
      webhook: process.env.WHAPI_WEBHOOK_URL,
    });
    
    this.messageQueue = new Queue('messages', {
      connection: redisConnection,
    });
    
    this.channelQueue = new Queue('channel-broadcasts', {
      connection: redisConnection,
    });
  }

  // Send to WhatsApp Channel (Free users)
  async broadcastToChannel(channelId: string, content: string, mediaUrls?: string[]) {
    try {
      const result = await this.whapi.channels.broadcast({
        channelId: channelId,
        message: content,
        media: mediaUrls,
      });

      // Log broadcast
      await this.logChannelBroadcast(channelId, content, result);
      
      return result;
    } catch (error) {
      logger.error('Channel broadcast error:', error);
      throw error;
    }
  }

  // Send direct message (Premium users)
  async sendDirectMessage(phoneNumber: string, content: string, mediaUrl?: string) {
    try {
      // Check if premium user
      const user = await this.getUserByPhone(phoneNumber);
      if (user.subscription?.plan_type === 'free') {
        throw new Error('Direct messages are for premium users only');
      }

      // Rate limiting check
      const canSend = await this.checkRateLimit(phoneNumber);
      if (!canSend) {
        return this.queueMessage(phoneNumber, content, mediaUrl);
      }

      // Send via Whapi
      const result = await this.whapi.messages.send({
        to: phoneNumber,
        body: content,
        ...(mediaUrl && { media: { url: mediaUrl } }),
      });

      // Log delivery
      await this.logDelivery(phoneNumber, result.messageId, 'sent');
      
      return result;
    } catch (error) {
      logger.error('WhatsApp send error:', error);
      throw error;
    }
  }

  // Schedule channel broadcasts
  async scheduleChannelBroadcast(articles: Article[], scheduledTime: Date) {
    const content = await this.formatChannelContent(articles);
    
    await this.channelQueue.add('scheduled-broadcast', {
      articles,
      content,
      scheduledTime,
    }, {
      delay: scheduledTime.getTime() - Date.now(),
    });
  }

  private async formatChannelContent(articles: Article[]): Promise<string> {
    let content = `📰 *ACTUALITÉS DU JOUR* 📰\n`;
    content += `_${new Date().toLocaleDateString('fr-FR')}_\n\n`;

    articles.forEach((article, index) => {
      content += `${index + 1}. *${article.title}*\n`;
      content += `📍 _${article.media_name}_\n`;
      content += `${article.gpt_summary}\n`;
      content += `🔗 Lire plus: ${article.source_url}\n\n`;
    });

    content += `\n💎 *Passez au Premium* pour recevoir des actualités personnalisées directement sur votre WhatsApp!`;
    
    return content;
  }

  private async checkRateLimit(phoneNumber: string): Promise<boolean> {
    const key = `rate:${phoneNumber}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    
    return count <= 30; // 30 messages per hour per user
  }
}

// services/rss.service.ts
import Parser from 'rss-parser';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

export class RSSFeedService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['media:content', 'content:encoded'],
      },
    });
  }

  async addFeed(feedUrl: string, mediaName: string, category?: string) {
    try {
      // Test feed first
      const feed = await this.parser.parseURL(feedUrl);
      
      if (!feed || !feed.items || feed.items.length === 0) {
        throw new Error('Invalid or empty RSS feed');
      }

      // Save to database
      const { data, error } = await supabase
        .from('rss_feeds')
        .insert({
          feed_url: feedUrl,
          media_name: mediaName,
          website_url: feed.link,
          category: category || 'general',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Process initial articles
      await this.processFeed(data.id, feedUrl);

      return { success: true, feed: data };
    } catch (error) {
      logger.error('Add RSS feed error:', error);
      throw error;
    }
  }

  async processFeed(feedId: string, feedUrl: string) {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      const feedInfo = await this.getFeedInfo(feedId);
      
      let newArticles = 0;

      for (const item of feed.items) {
        // Check if article exists
        const exists = await this.articleExists(item.link);
        if (exists) continue;

        // Save article
        await supabase
          .from('articles')
          .insert({
            rss_feed_id: feedId,
            source_url: item.link,
            source_name: feed.title,
            media_name: feedInfo.media_name,
            title: item.title,
            content: item.content || item.contentSnippet,
            summary: item.contentSnippet,
            published_at: item.pubDate,
            image_url: this.extractImageUrl(item),
          });

        newArticles++;
      }

      // Update feed status
      await supabase
        .from('rss_feeds')
        .update({
          last_fetched_at: new Date(),
          last_successful_fetch: new Date(),
          error_count: 0,
        })
        .eq('id', feedId);

      return { newArticles };
    } catch (error) {
      // Update error count
      await this.handleFeedError(feedId, error.message);
      throw error;
    }
  }

  private extractImageUrl(item: any): string | null {
    if (item.enclosure?.url) return item.enclosure.url;
    if (item['media:content']?.$ ?.url) return item['media:content'].$.url;
    
    // Try to extract from content
    const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
  }

  async monitorFeedHealth() {
    const { data: feeds } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('is_active', true);

    const healthReport = [];

    for (const feed of feeds) {
      try {
        await this.parser.parseURL(feed.feed_url);
        healthReport.push({
          feed: feed.media_name,
          status: 'healthy',
          lastFetch: feed.last_fetched_at,
        });
      } catch (error) {
        healthReport.push({
          feed: feed.media_name,
          status: 'error',
          error: error.message,
          errorCount: feed.error_count,
        });

        if (feed.error_count >= 5) {
          // Disable feed after 5 consecutive errors
          await supabase
            .from('rss_feeds')
            .update({ is_active: false })
            .eq('id', feed.id);
        }
      }
    }

    return healthReport;
  }
}

// services/editorial.service.ts
import { OpenAI } from 'openai';
import { supabase } from '../config/database';

export class EditorialService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async createMatinale(journalistId: string, selectedArticleIds: string[]) {
    try {
      // Fetch selected articles
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .in('id', selectedArticleIds)
        .order('published_at', { ascending: false });

      // Generate editorial with GPT-5
      const prompt = this.buildMatinalePrompt(articles);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Will be gpt-5 when available
        messages: [
          {
            role: 'system',
            content: `Tu es un journaliste gabonais expérimenté créant une matinale (revue de presse matinale). 
                     Ton style est professionnel mais accessible. Tu dois créer une synthèse cohérente et engageante 
                     des actualités sélectionnées, avec une introduction accrocheuse, des transitions fluides entre 
                     les sujets, et une conclusion qui donne une perspective globale.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const editorialContent = completion.choices[0].message.content;

      // Save editorial
      const { data: editorial } = await supabase
        .from('editorials')
        .insert({
          journalist_id: journalistId,
          title: `Matinale du ${new Date().toLocaleDateString('fr-FR')}`,
          editorial_type: 'matinale',
          content: editorialContent,
          gpt_generated_content: editorialContent,
          selected_articles: selectedArticleIds,
          status: 'draft',
        })
        .select()
        .single();

      return editorial;
    } catch (error) {
      logger.error('Create matinale error:', error);
      throw error;
    }
  }

  private buildMatinalePrompt(articles: Article[]): string {
    let prompt = `Crée une matinale basée sur ces ${articles.length} articles du jour:\n\n`;

    articles.forEach((article, index) => {
      prompt += `Article ${index + 1}:\n`;
      prompt += `Titre: ${article.title}\n`;
      prompt += `Source: ${article.media_name}\n`;
      prompt += `Résumé: ${article.summary || article.gpt_summary}\n\n`;
    });

    prompt += `\nCrée une matinale engageante avec:
    1. Une introduction captivante sur l'actualité du jour
    2. Une présentation structurée des principales informations
    3. Des transitions naturelles entre les sujets
    4. Une analyse des tendances ou thèmes communs
    5. Une conclusion qui met en perspective l'ensemble`;

    return prompt;
  }

  async createThematicAnalysis(
    journalistId: string, 
    theme: string, 
    articleIds: string[]
  ) {
    // Fetch articles
    const { data: articles } = await supabase
      .from('articles')
      .select('*')
      .in('id', articleIds);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `Tu es un analyste expert créant une analyse thématique approfondie sur "${theme}". 
                   Ton analyse doit être objective, nuancée et apporter une vraie valeur ajoutée.`,
        },
        {
          role: 'user',
          content: this.buildAnalysisPrompt(articles, theme),
        },
      ],
      temperature: 0.6,
      max_tokens: 2500,
    });

    return this.saveEditorial(
      journalistId,
      `Analyse: ${theme}`,
      'analyse',
      completion.choices[0].message.content,
      articleIds
    );
  }

  async publishEditorial(editorialId: string, channels: string[]) {
    try {
      // Update status
      await supabase
        .from('editorials')
        .update({
          status: 'published',
          published_at: new Date(),
        })
        .eq('id', editorialId);

      // Queue for distribution
      if (channels.includes('whatsapp_channel')) {
        await this.queueForChannel(editorialId);
      }

      if (channels.includes('email')) {
        await this.queueForEmail(editorialId);
      }

      return { success: true };
    } catch (error) {
      logger.error('Publish editorial error:', error);
      throw error;
    }
  }

  async getEditorialTemplates() {
    return [
      {
        id: 'matinale',
        name: 'Matinale',
        description: 'Revue de presse matinale complète',
        estimatedTime: '10-15 min',
      },
      {
        id: 'analyse',
        name: 'Analyse Thématique',
        description: 'Analyse approfondie sur un sujet spécifique',
        estimatedTime: '15-20 min',
      },
      {
        id: 'revue_presse',
        name: 'Revue de Presse',
        description: 'Tour d\'horizon des actualités',
        estimatedTime: '5-10 min',
      },
      {
        id: 'editorial',
        name: 'Éditorial',
        description: 'Opinion et analyse personnalisée',
        estimatedTime: '20-30 min',
      },
    ];
  }
}

// services/filter.service.ts
export class FilterService {
  async createUserFilter(userId: string, filter: UserFilter) {
    // Validate premium subscription
    const user = await this.validatePremiumUser(userId);

    // Create filter
    const { data } = await supabase
      .from('user_filters')
      .insert({
        user_id: userId,
        filter_name: filter.name,
        filter_type: filter.type,
        filter_value: filter.value,
        priority: filter.priority || 5,
      })
      .select()
      .single();

    return data;
  }

  async applyUserFilters(userId: string, articles: Article[]) {
    // Get user filters
    const { data: filters } = await supabase
      .from('user_filters')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!filters || filters.length === 0) {
      return articles;
    }

    return articles.filter(article => {
      return filters.some(filter => this.matchesFilter(article, filter));
    });
  }

  private matchesFilter(article: Article, filter: UserFilter): boolean {
    switch (filter.filter_type) {
      case 'keyword':
        const keywords = filter.filter_value.keywords as string[];
        const content = `${article.title} ${article.summary} ${article.keywords?.join(' ')}`.toLowerCase();
        return keywords.some(kw => content.includes(kw.toLowerCase()));

      case 'category':
        return filter.filter_value.categories.includes(article.category);

      case 'source':
        return filter.filter_value.sources.includes(article.media_name);

      case 'combined':
        // Complex filter logic
        return this.matchesCombinedFilter(article, filter.filter_value);

      default:
        return false;
    }
  }
} = new Whapi({
      apiKey: process.env.WHAPI_API_KEY,
      webhook: process.env.WHAPI_WEBHOOK_URL,
    });
    
    this.messageQueue = new Queue('messages', {
      connection: redisConnection,
    });
  }

  async sendMessage(phoneNumber: string, content: string, mediaUrl?: string) {
    try {
      // Rate limiting check
      const canSend = await this.checkRateLimit(phoneNumber);
      if (!canSend) {
        return this.queueMessage(phoneNumber, content, mediaUrl);
      }

      // Send via Whapi
      const result = await this.whapi.messages.send({
        to: phoneNumber,
        body: content,
        ...(mediaUrl && { media: { url: mediaUrl } }),
      });

      // Log delivery
      await this.logDelivery(phoneNumber, result.messageId, 'sent');
      
      return result;
    } catch (error) {
      logger.error('WhatsApp send error:', error);
      throw error;
    }
  }

  async sendBulkMessages(messages: MessageBatch[]) {
    const jobs = messages.map(msg => ({
      name: 'send-message',
      data: msg,
      opts: {
        delay: msg.scheduledFor ? new Date(msg.scheduledFor).getTime() - Date.now() : 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }));

    await this.messageQueue.addBulk(jobs);
  }

  private async checkRateLimit(phoneNumber: string): Promise<boolean> {
    const key = `rate:${phoneNumber}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    
    return count <= 30; // 30 messages per hour per user
  }
}

// services/gpt.service.ts
import OpenAI from 'openai';
import { cache } from '../utils/cache';

export class GPTService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async summarizeArticle(article: Article): Promise<ProcessedArticle> {
    // Check cache first
    const cacheKey = `summary:${article.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Tu es un journaliste gabonais expert. Résume les articles d'actualité en 2-3 phrases maximum pour WhatsApp. 
                     Extrais aussi les mots-clés principaux et détermine la catégorie et le sentiment.
                     Réponds en JSON avec: summary, keywords (array), category, sentiment.`,
          },
          {
            role: 'user',
            content: `Titre: ${article.title}\n\nContenu: ${article.content}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const result = JSON.parse(completion.choices[0].message.content);
      
      // Cache for 24 hours
      await cache.set(cacheKey, JSON.stringify(result), 86400);
      
      return result;
    } catch (error) {
      logger.error('GPT summarization error:', error);
      // Fallback to basic summarization
      return this.basicSummarization(article);
    }
  }

  private basicSummarization(article: Article) {
    // Fallback when GPT fails
    const summary = article.content.substring(0, 200) + '...';
    const keywords = this.extractKeywords(article.title + ' ' + article.content);
    
    return {
      summary,
      keywords,
      category: 'general',
      sentiment: 'neutral',
    };
  }

  private extractKeywords(text: string): string[] {
    // Basic keyword extraction
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une']);
    return [...new Set(words.filter(w => w.length > 4 && !stopWords.has(w)))].slice(0, 10);
  }
}

// services/payment.service.ts
import axios from 'axios';
import { supabase } from '../config/database';

export class PaymentService {
  private airtelMoneyAPI: string;
  private moovMoneyAPI: string;

  constructor() {
    this.airtelMoneyAPI = process.env.AIRTEL_MONEY_API_URL;
    this.moovMoneyAPI = process.env.MOOV_MONEY_API_URL;
  }

  async initializePayment(userId: string, amount: number, method: 'airtel' | 'moov') {
    const transactionId = this.generateTransactionId();
    
    // Create payment record
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount_xaf: amount,
        payment_method: method,
        transaction_id: transactionId,
        status: 'pending',
      })
      .select()
      .single();

    // Initialize with provider
    if (method === 'airtel') {
      return this.initAirtelPayment(payment);
    } else {
      return this.initMoovPayment(payment);
    }
  }

  private async initAirtelPayment(payment: Payment) {
    try {
      const response = await axios.post(
        `${this.airtelMoneyAPI}/merchant/v1/payments`,
        {
          reference: payment.transaction_id,
          subscriber: {
            country: 'GA',
            currency: 'XAF',
            msisdn: payment.user_phone,
          },
          transaction: {
            amount: payment.amount_xaf,
            country: 'GA',
            currency: 'XAF',
            id: payment.transaction_id,
          },
        },
        {
          headers: {
            'X-API-Key': process.env.AIRTEL_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        ussdCode: response.data.ussd_code,
        transactionId: payment.transaction_id,
      };
    } catch (error) {
      logger.error('Airtel payment error:', error);
      throw error;
    }
  }

  async verifyPayment(transactionId: string) {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (!payment) throw new Error('Payment not found');

    // Check with provider
    const status = await this.checkProviderStatus(payment);
    
    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: status,
        completed_at: status === 'completed' ? new Date() : null,
      })
      .eq('id', payment.id);

    // If completed, activate subscription
    if (status === 'completed') {
      await this.activateSubscription(payment.user_id, payment.subscription_id);
    }

    return status;
  }

  private generateTransactionId(): string {
    return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 6. Worker Implementation

```typescript
// workers/rss.worker.ts
import { Worker } from 'bullmq';
import { RSSFeedService } from '../services/rss.service';
import { GPTService } from '../services/gpt.service';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const rssService = new RSSFeedService();
const gptService = new GPTService();

export const rssWorker = new Worker(
  'rss-feeds',
  async (job) => {
    const { feedId, feedUrl, mediaName } = job.data;
    
    try {
      // Process feed
      const result = await rssService.processFeed(feedId, feedUrl);
      
      // Process new articles with GPT
      const { data: unprocessedArticles } = await supabase
        .from('articles')
        .select('*')
        .eq('rss_feed_id', feedId)
        .is('gpt_summary', null);
      
      for (const article of unprocessedArticles) {
        const processed = await gptService.summarizeArticle(article);
        
        await supabase
          .from('articles')
          .update({
            gpt_summary: processed.summary,
            keywords: processed.keywords,
            category: processed.category,
            sentiment: processed.sentiment,
          })
          .eq('id', article.id);
      }
      
      logger.info(`Processed ${result.newArticles} articles from ${mediaName}`);
      
      return result;
    } catch (error) {
      logger.error(`RSS feed error for ${feedUrl}:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// workers/channel.worker.ts
import { Worker } from 'bullmq';
import { WhatsAppService } from '../services/whatsapp.service';
import { supabase } from '../config/database';

const whatsappService = new WhatsAppService();

export const channelWorker = new Worker(
  'channel-broadcasts',
  async (job) => {
    const { articles, content, channelId } = job.data;
    
    try {
      // Send to main channel
      const mainChannelId = channelId || process.env.MAIN_CHANNEL_ID;
      
      const result = await whatsappService.broadcastToChannel(
        mainChannelId,
        content
      );
      
      // Log broadcast
      await supabase
        .from('channel_broadcasts')
        .insert({
          channel_id: mainChannelId,
          article_ids: articles.map(a => a.id),
          message_content: content,
          broadcast_type: 'scheduled',
          sent_at: new Date(),
          recipient_count: result.recipientCount,
        });
      
      logger.info(`Channel broadcast sent to ${result.recipientCount} subscribers`);
      
      return { success: true };
    } catch (error) {
      logger.error('Channel broadcast error:', error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// workers/premium-message.worker.ts
import { Worker } from 'bullmq';
import { WhatsAppService } from '../services/whatsapp.service';
import { FilterService } from '../services/filter.service';
import { supabase } from '../config/database';

const whatsappService = new WhatsAppService();
const filterService = new FilterService();

export const premiumMessageWorker = new Worker(
  'premium-messages',
  async (job) => {
    const { userId, articles } = job.data;
    
    try {
      // Get user details
      const { data: user } = await supabase
        .from('users')
        .select('*, subscriptions(*), user_filters(*)')
        .eq('id', userId)
        .single();
      
      // Check if premium/journalist
      if (!['premium', 'journalist'].includes(user.user_type)) {
        return { success: false, reason: 'Not premium user' };
      }
      
      // Apply filters
      const filteredArticles = await filterService.applyUserFilters(
        userId,
        articles
      );
      
      if (filteredArticles.length === 0) {
        return { success: false, reason: 'No matching articles' };
      }
      
      // Format personalized message
      let message = `🎯 *Actualités personnalisées pour vous*\n\n`;
      
      filteredArticles.slice(0, 5).forEach((article, index) => {
        message += `${index + 1}. *${article.title}*\n`;
        message += `📰 _${article.media_name}_\n`;
        message += `${article.gpt_summary}\n`;
        message += `🔗 ${article.source_url}\n\n`;
      });
      
      // Send direct message
      const result = await whatsappService.sendDirectMessage(
        user.whatsapp_number,
        message
      );
      
      // Log delivery
      await supabase
        .from('message_queue')
        .insert({
          user_id: userId,
          message_type: 'filtered_news',
          content: message,
          status: 'sent',
          sent_at: new Date(),
        });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Premium message delivery error:', error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

// workers/scheduler.worker.ts
import { Worker } from 'bullmq';
import cron from 'node-cron';
import { supabase } from '../config/database';

// Schedule RSS feed fetching every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  const { data: feeds } = await supabase
    .from('rss_feeds')
    .select('*')
    .eq('is_active', true);
  
  for (const feed of feeds) {
    await rssQueue.add('fetch-feed', {
      feedId: feed.id,
      feedUrl: feed.feed_url,
      mediaName: feed.media_name,
    });
  }
});

// Schedule channel broadcasts at 8h, 12h, 18h
cron.schedule('0 8,12,18 * * *', async () => {
  // Get articles from last 4 hours
  const since = new Date();
  since.setHours(since.getHours() - 4);
  
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .gte('published_at', since.toISOString())
    .order('published_at', { ascending: false })
    .limit(10);
  
  if (articles.length > 0) {
    await channelQueue.add('scheduled-broadcast', {
      articles,
      scheduledTime: new Date(),
    });
  }
});

// Process premium user deliveries every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  // Get premium users with active filters
  const { data: users } = await supabase
    .from('users')
    .select('*, user_filters(*)')
    .in('user_type', ['premium', 'journalist'])
    .eq('is_active', true);
  
  // Get recent articles
  const since = new Date();
  since.setMinutes(since.getMinutes() - 30);
  
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .gte('created_at', since.toISOString());
  
  if (articles.length > 0) {
    for (const user of users) {
      if (user.user_filters?.length > 0) {
        await premiumMessageQueue.add('send-filtered', {
          userId: user.id,
          articles,
        });
      }
    }
  }
});
```

### 7. API Controllers

```typescript
// controllers/feeds.controller.ts
import { Request, Response } from 'express';
import { RSSFeedService } from '../services/rss.service';
import { supabase } from '../config/database';

export class FeedsController {
  private rssService: RSSFeedService;

  constructor() {
    this.rssService = new RSSFeedService();
  }

  async listFeeds(req: Request, res: Response) {
    try {
      const { data: feeds } = await supabase
        .from('rss_feeds')
        .select('*')
        .order('media_name');

      res.json({
        success: true,
        data: feeds,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async addFeed(req: Request, res: Response) {
    try {
      const { feedUrl, mediaName, category } = req.body;

      // Validate admin role
      if (req.user.user_type !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      const result = await this.rssService.addFeed(feedUrl, mediaName, category);

      res.json({
        success: true,
        data: result,
        message: `Feed ${mediaName} ajouté avec succès`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  async testFeed(req: Request, res: Response) {
    try {
      const { feedUrl } = req.body;
      
      const parser = new Parser();
      const feed = await parser.parseURL(feedUrl);

      res.json({
        success: true,
        data: {
          title: feed.title,
          description: feed.description,
          itemCount: feed.items.length,
          latestItem: feed.items[0]?.title,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Feed invalide ou inaccessible',
      });
    }
  }

  async getFeedHealth(req: Request, res: Response) {
    try {
      const healthReport = await this.rssService.monitorFeedHealth();

      res.json({
        success: true,
        data: healthReport,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// controllers/journalist.controller.ts
import { Request, Response } from 'express';
import { EditorialService } from '../services/editorial.service';
import { supabase } from '../config/database';

export class JournalistController {
  private editorialService: EditorialService;

  constructor() {
    this.editorialService = new EditorialService();
  }

  async getDashboard(req: Request, res: Response) {
    try {
      const journalistId = req.user.id;

      // Get today's articles
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .gte('published_at', today.toISOString())
        .order('published_at', { ascending: false });

      // Get journalist's recent editorials
      const { data: editorials } = await supabase
        .from('editorials')
        .select('*')
        .eq('journalist_id', journalistId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Group articles by source
      const articlesBySource = articles.reduce((acc, article) => {
        if (!acc[article.media_name]) {
          acc[article.media_name] = [];
        }
        acc[article.media_name].push(article);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          todayArticles: articles,
          articlesBySource,
          recentEditorials: editorials,
          templates: await this.editorialService.getEditorialTemplates(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async createMatinale(req: Request, res: Response) {
    try {
      const journalistId = req.user.id;
      const { selectedArticles } = req.body;

      // Validate journalist subscription
      if (!['journalist', 'admin'].includes(req.user.user_type)) {
        return res.status(403).json({
          success: false,
          error: 'Abonnement journaliste requis',
        });
      }

      const editorial = await this.editorialService.createMatinale(
        journalistId,
        selectedArticles
      );

      res.json({
        success: true,
        data: editorial,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async createEditorial(req: Request, res: Response) {
    try {
      const journalistId = req.user.id;
      const { 
        title, 
        type, 
        selectedArticles, 
        customContent,
        theme 
      } = req.body;

      let editorial;

      switch (type) {
        case 'matinale':
          editorial = await this.editorialService.createMatinale(
            journalistId,
            selectedArticles
          );
          break;

        case 'analyse':
          editorial = await this.editorialService.createThematicAnalysis(
            journalistId,
            theme,
            selectedArticles
          );
          break;

        case 'custom':
          editorial = await this.editorialService.createCustomEditorial(
            journalistId,
            title,
            customContent,
            selectedArticles
          );
          break;

        default:
          throw new Error('Type éditorial invalide');
      }

      res.json({
        success: true,
        data: editorial,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async publishEditorial(req: Request, res: Response) {
    try {
      const { editorialId, channels } = req.body;

      // Verify ownership
      const { data: editorial } = await supabase
        .from('editorials')
        .select('journalist_id')
        .eq('id', editorialId)
        .single();

      if (editorial.journalist_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Non autorisé',
        });
      }

      const result = await this.editorialService.publishEditorial(
        editorialId,
        channels
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// controllers/channel.controller.ts  
import { Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { supabase } from '../config/database';

export class ChannelController {
  private whatsappService: WhatsAppService;

  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  async broadcastToChannel(req: Request, res: Response) {
    try {
      const { articleIds, customMessage, immediate } = req.body;

      // Fetch articles
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .in('id', articleIds);

      const channelId = process.env.MAIN_CHANNEL_ID;

      if (immediate) {
        // Send immediately
        const result = await this.whatsappService.broadcastToChannel(
          channelId,
          customMessage || this.formatArticlesForChannel(articles)
        );

        res.json({
          success: true,
          data: result,
        });
      } else {
        // Schedule for next broadcast time
        const nextBroadcast = this.getNextBroadcastTime();
        await this.whatsappService.scheduleChannelBroadcast(
          articles,
          nextBroadcast
        );

        res.json({
          success: true,
          message: `Broadcast programmé pour ${nextBroadcast.toLocaleString('fr-FR')}`,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private getNextBroadcastTime(): Date {
    const now = new Date();
    const broadcastHours = [8, 12, 18]; // 8h, 12h, 18h
    
    for (const hour of broadcastHours) {
      const broadcastTime = new Date(now);
      broadcastTime.setHours(hour, 0, 0, 0);
      
      if (broadcastTime > now) {
        return broadcastTime;
      }
    }
    
    // Next day at 8h
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow;
  }

  async getChannelStats(req: Request, res: Response) {
    try {
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('channel_type', 'main')
        .single();

      const { data: broadcasts } = await supabase
        .from('channel_broadcasts')
        .select('*')
        .eq('channel_id', channel.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      res.json({
        success: true,
        data: {
          channel,
          recentBroadcasts: broadcasts,
          subscriberCount: channel.subscriber_count,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// controllers/filters.controller.ts  
export class FiltersController {
  private filterService: FilterService;

  constructor() {
    this.filterService = new FilterService();
  }

  async getUserFilters(req: Request, res: Response) {
    try {
      const userId = req.user.id;

      // Check premium status
      if (!['premium', 'journalist', 'admin'].includes(req.user.user_type)) {
        return res.status(403).json({
          success: false,
          error: 'Fonctionnalité réservée aux abonnés Premium',
        });
      }

      const { data: filters } = await supabase
        .from('user_filters')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: false });

      res.json({
        success: true,
        data: filters,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async createFilter(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const filter = req.body;

      // Validate premium
      if (req.user.user_type === 'free') {
        return res.status(403).json({
          success: false,
          error: 'Passez au Premium pour créer des filtres personnalisés',
        });
      }

      const result = await this.filterService.createUserFilter(userId, filter);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async testFilter(req: Request, res: Response) {
    try {
      const { filter } = req.body;

      // Get recent articles
      const { data: articles } = await supabase
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

      const filtered = await this.filterService.applyUserFilters(
        req.user.id,
        articles
      );

      res.json({
        success: true,
        data: {
          totalArticles: articles.length,
          filteredCount: filtered.length,
          samples: filtered.slice(0, 5),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}lte('published_at', endDate);
      }

      // Pagination
      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .order('published_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      const { data: articles, count, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: articles,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count,
          pages: Math.ceil(count / Number(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async searchArticles(req: Request, res: Response) {
    try {
      const { q, limit = 10 } = req.query;

      // Check cache
      const cacheKey = `search:${q}:${limit}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      // Full-text search
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, title, summary, source_name, published_at')
        .textSearch('search_vector', q as string, {
          type: 'websearch',
          config: 'french',
        })
        .order('published_at', { ascending: false })
        .limit(Number(limit));

      if (error) throw error;

      const response = {
        success: true,
        data: articles,
        query: q,
      };

      // Cache for 1 hour
      await cache.set(cacheKey, JSON.stringify(response), 3600);

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getTrending(req: Request, res: Response) {
    try {
      const { period = '24h' } = req.query;

      const since = new Date();
      if (period === '24h') {
        since.setHours(since.getHours() - 24);
      } else if (period === '7d') {
        since.setDate(since.getDate() - 7);
      }

      // Get most shared/viewed articles
      const { data: trending } = await supabase
        .from('articles')
        .select(`
          *,
          analytics_events!inner(
            event_type,
            created_at
          )
        `)
        .eq('analytics_events.event_type', 'article_viewed')
        .gte('analytics_events.created_at', since.toISOString())
        .order('analytics_events.count', { ascending: false })
        .limit(10);

      res.json({
        success: true,
        data: trending,
        period,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

// controllers/keywords.controller.ts  
export class KeywordsController {
  async getUserKeywords(req: Request, res: Response) {
    try {
      const userId = req.user.id;

      const { data: keywords } = await supabase
        .from('user_keywords')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      res.json({
        success: true,
        data: keywords,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async addKeywords(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { keywords, category } = req.body;

      // Check subscription limits
      const { data: user } = await supabase
        .from('users')
        .select('*, subscriptions(*)')
        .eq('id', userId)
        .single();

      const maxKeywords = user.subscriptions[0]?.plan_type === 'free' ? 5 : 20;
      
      const { count: currentCount } = await supabase
        .from('user_keywords')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (currentCount + keywords.length > maxKeywords) {
        return res.status(400).json({
          success: false,
          error: `Limite de ${maxKeywords} mots-clés atteinte`,
        });
      }

      // Add keywords
      const keywordRecords = keywords.map(keyword => ({
        user_id: userId,
        keyword: keyword.toLowerCase().trim(),
        category,
      }));

      const { data: added, error } = await supabase
        .from('user_keywords')
        .insert(keywordRecords)
        .select();

      if (error) throw error;

      res.json({
        success: true,
        data: added,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
```

### 8. Middleware Implementation

```typescript
// middlewares/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token manquant',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    
    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non autorisé',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token invalide',
    });
  }
}

// middlewares/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const apiRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Trop de requêtes, veuillez réessayer plus tard',
});

export const authRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
});
```

### 9. Main Application Entry

```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { errorMiddleware } from './middlewares/error.middleware';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './api/routes/auth.routes';
import articleRoutes from './api/routes/articles.routes';
import subscriptionRoutes from './api/routes/subscriptions.routes';
import keywordRoutes from './api/routes/keywords.routes';
import webhookRoutes from './api/routes/webhooks.routes';
import adminRoutes from './api/routes/admin.routes';

// Import workers
import './workers/rss.worker';
import './workers/message.worker';
import './workers/payment.worker';
import './workers/cleanup.worker';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/articles', articleRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/keywords', keywordRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/admin', adminRoutes);

// Socket.io for real-time updates
io.on('connection', (socket) => {
  logger.info('New socket connection:', socket.id);
  
  socket.on('subscribe', (userId) => {
    socket.join(`user:${userId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info('Socket disconnected:', socket.id);
  });
});

// Error handling
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io };
```