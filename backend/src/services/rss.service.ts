import Parser from 'rss-parser';
import { supabaseAdmin } from '../config/database';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import { QueueManager } from '../config/queue';
import crypto from 'crypto';

export interface RSSItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
  author?: string;
  guid?: string;
  contentSnippet?: string;
  categories?: string[];
  enclosure?: {
    url: string;
    type: string;
  };
}

export interface ParsedArticle {
  title: string;
  content: string;
  url: string;
  published_at: string;
  author?: string;
  image_url?: string;
  category: string;
  keywords: string[];
  hash: string;
}

export class RSSService {
  private parser: Parser;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly DUPLICATE_CACHE_TTL = 86400; // 24 heures

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GabonNews RSS Reader 1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
  }

  /**
   * Traiter un flux RSS spécifique
   */
  async processFeed(feedId: string, feedUrl: string, mediaName: string): Promise<void> {
    try {
      logger.info(`Traitement du flux RSS: ${mediaName} (${feedUrl})`);

      // Vérifier si le flux a été traité récemment
      const cacheKey = `rss:${feedId}:last_processed`;
      const lastProcessed = await RedisService.get(cacheKey);
      
      if (lastProcessed && Date.now() - lastProcessed < this.CACHE_TTL * 1000) {
        logger.debug(`Flux ${mediaName} traité récemment, ignoré`);
        return;
      }

      // Parser le flux RSS
      const feed = await this.parser.parseURL(feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        logger.warn(`Aucun article trouvé dans le flux ${mediaName}`);
        await this.updateFeedStatus(feedId, false, 'Aucun article trouvé');
        return;
      }

      logger.info(`${feed.items.length} articles trouvés dans ${mediaName}`);

      // Traiter chaque article
      const processedArticles: ParsedArticle[] = [];
      
      for (const item of feed.items) {
        try {
          const article = await this.parseArticle(item, mediaName);
          
          if (article && await this.isNewArticle(article.hash)) {
            processedArticles.push(article);
          }
        } catch (error) {
          logger.error(`Erreur lors du parsing d'un article de ${mediaName}:`, error);
        }
      }

      // Sauvegarder les nouveaux articles
      if (processedArticles.length > 0) {
        await this.saveArticles(processedArticles, feedId, mediaName);
        logger.info(`${processedArticles.length} nouveaux articles sauvegardés pour ${mediaName}`);
      } else {
        logger.debug(`Aucun nouvel article pour ${mediaName}`);
      }

      // Mettre à jour le statut du flux
      await this.updateFeedStatus(feedId, true);
      
      // Marquer comme traité dans le cache
      await RedisService.set(cacheKey, Date.now(), this.CACHE_TTL);

    } catch (error) {
      logger.error(`Erreur lors du traitement du flux ${mediaName}:`, error);
      await this.updateFeedStatus(feedId, false, error.message);
      throw error;
    }
  }

  /**
   * Parser un article RSS
   */
  private async parseArticle(item: RSSItem, mediaName: string): Promise<ParsedArticle | null> {
    try {
      if (!item.title || !item.link) {
        return null;
      }

      // Nettoyer et extraire le contenu
      const content = this.cleanContent(item.content || item.contentSnippet || '');
      const title = this.cleanTitle(item.title);
      
      if (content.length < 50) {
        logger.debug(`Article trop court ignoré: ${title}`);
        return null;
      }

      // Extraire l'image
      const imageUrl = this.extractImageUrl(item);

      // Déterminer la catégorie
      const category = this.categorizeArticle(title, content, item.categories);

      // Extraire les mots-clés
      const keywords = this.extractKeywords(title, content);

      // Générer un hash unique
      const hash = this.generateArticleHash(title, item.link, mediaName);

      return {
        title,
        content,
        url: item.link,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        author: item.author,
        image_url: imageUrl,
        category,
        keywords,
        hash
      };

    } catch (error) {
      logger.error('Erreur lors du parsing de l\'article:', error);
      return null;
    }
  }

  /**
   * Vérifier si un article est nouveau
   */
  private async isNewArticle(hash: string): Promise<boolean> {
    try {
      // Vérifier dans le cache Redis d'abord
      const cacheKey = `article:hash:${hash}`;
      const cached = await RedisService.exists(cacheKey);
      
      if (cached) {
        return false;
      }

      // Vérifier dans la base de données
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('hash', hash)
        .limit(1);

      if (error) {
        logger.error('Erreur lors de la vérification de doublons:', error);
        return true; // En cas d'erreur, on traite l'article
      }

      const isNew = !data || data.length === 0;
      
      // Mettre en cache si l'article existe déjà
      if (!isNew) {
        await RedisService.set(cacheKey, true, this.DUPLICATE_CACHE_TTL);
      }

      return isNew;

    } catch (error) {
      logger.error('Erreur lors de la vérification de nouveauté:', error);
      return true;
    }
  }

  /**
   * Sauvegarder les articles dans la base de données
   */
  private async saveArticles(articles: ParsedArticle[], feedId: string, mediaName: string): Promise<void> {
    try {
      const articlesToInsert = articles.map(article => ({
        ...article,
        rss_feed_id: feedId,
        media_name: mediaName,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert(articlesToInsert)
        .select('id, title, hash');

      if (error) {
        logger.error('Erreur lors de la sauvegarde des articles:', error);
        throw error;
      }

      // Mettre en cache les hashs des nouveaux articles
      for (const article of data) {
        const cacheKey = `article:hash:${article.hash}`;
        await RedisService.set(cacheKey, true, this.DUPLICATE_CACHE_TTL);
      }

      // Ajouter les articles à la queue de résumé
      for (const article of data) {
        const originalArticle = articles.find(a => a.hash === article.hash);
        if (originalArticle) {
          await QueueManager.addSummaryJob({
            articleId: article.id,
            title: originalArticle.title,
            content: originalArticle.content,
            mediaName
          }, 1); // Priorité élevée pour les résumés
        }
      }

      logger.info(`${data.length} articles sauvegardés et ajoutés à la queue de résumé`);

    } catch (error) {
      logger.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'un flux RSS
   */
  private async updateFeedStatus(feedId: string, success: boolean, errorMessage?: string): Promise<void> {
    try {
      const updateData: any = {
        last_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (success) {
        updateData.error_count = 0;
      } else {
        // Incrémenter le compteur d'erreurs
        const { data: currentFeed } = await supabaseAdmin
          .from('rss_feeds')
          .select('error_count')
          .eq('id', feedId)
          .single();

        updateData.error_count = (currentFeed?.error_count || 0) + 1;
        
        // Désactiver le flux après 5 erreurs consécutives
        if (updateData.error_count >= 5) {
          updateData.is_active = false;
          logger.warn(`Flux ${feedId} désactivé après ${updateData.error_count} erreurs`);
        }
      }

      await supabaseAdmin
        .from('rss_feeds')
        .update(updateData)
        .eq('id', feedId);

    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut du flux:', error);
    }
  }

  /**
   * Utilitaires de nettoyage et extraction
   */
  private cleanContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
      .replace(/&[^;]+;/g, ' ') // Supprimer les entités HTML
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractImageUrl(item: RSSItem): string | undefined {
    // Essayer l'enclosure d'abord
    if (item.enclosure?.type?.startsWith('image/')) {
      return item.enclosure.url;
    }

    // Chercher dans le contenu
    const content = item.content || '';
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
    
    return imgMatch ? imgMatch[1] : undefined;
  }

  private categorizeArticle(title: string, content: string, categories?: string[]): string {
    const text = `${title} ${content}`.toLowerCase();
    
    // Mots-clés par catégorie
    const categoryKeywords = {
      'politique': ['gouvernement', 'ministre', 'président', 'assemblée', 'sénat', 'élection', 'politique'],
      'economie': ['économie', 'business', 'entreprise', 'banque', 'finance', 'commerce', 'marché'],
      'sport': ['sport', 'football', 'basket', 'tennis', 'olympique', 'championnat', 'match'],
      'culture': ['culture', 'musique', 'art', 'festival', 'cinéma', 'théâtre', 'livre'],
      'sante': ['santé', 'médecin', 'hôpital', 'maladie', 'traitement', 'vaccin', 'covid'],
      'education': ['éducation', 'école', 'université', 'étudiant', 'formation', 'enseignement'],
      'environnement': ['environnement', 'climat', 'pollution', 'forêt', 'écologie', 'nature']
    };

    // Vérifier les catégories RSS d'abord
    if (categories && categories.length > 0) {
      for (const category of categories) {
        const cat = category.toLowerCase();
        if (Object.keys(categoryKeywords).includes(cat)) {
          return cat;
        }
      }
    }

    // Analyser le contenu
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.reduce((acc, keyword) => {
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex);
        return acc + (matches ? matches.length : 0);
      }, 0);

      if (score >= 2) {
        return category;
      }
    }

    return 'general';
  }

  private extractKeywords(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const words = text.match(/\b[a-zàâäéèêëïîôöùûüÿ]{4,}\b/g) || [];
    
    // Mots vides à ignorer
    const stopWords = new Set([
      'dans', 'avec', 'pour', 'cette', 'sont', 'plus', 'tout', 'tous',
      'leur', 'leurs', 'elle', 'elles', 'nous', 'vous', 'ils', 'elles',
      'avoir', 'être', 'faire', 'dire', 'aller', 'voir', 'savoir'
    ]);

    // Compter les occurrences
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 3) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    });

    // Retourner les mots les plus fréquents
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private generateArticleHash(title: string, url: string, mediaName: string): string {
    const content = `${title}|${url}|${mediaName}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Obtenir tous les flux RSS actifs
   */
  async getActiveFeeds(): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Erreur lors de la récupération des flux RSS:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Erreur lors de la récupération des flux actifs:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les anciens articles
   */
  async cleanupOldArticles(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabaseAdmin
        .from('articles')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Erreur lors du nettoyage des anciens articles:', error);
        throw error;
      }

      logger.info(`Articles antérieurs au ${cutoffDate.toISOString()} supprimés`);
    } catch (error) {
      logger.error('Erreur lors du nettoyage:', error);
      throw error;
    }
  }
}
