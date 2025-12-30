
import axios from 'axios';
import { supabaseAdmin } from '../config/database';
import { logger } from '../utils/logger';

interface WhapiConfig {
  token: string;
  channelId: string;
}

interface Article {
  id: string;
  title: string;
  summary_ai: string;
  url: string;
  image_urls?: string[];
}

export class WhatsAppService {
  private config: WhapiConfig;
  private readonly WHAPI_URL = 'https://gate.whapi.cloud';

  constructor() {
    const token = process.env.WHAPI_TOKEN;
    const channelId = process.env.WHAPI_CHANNEL_ID;

    if (!token) {
      logger.warn('WHAPI_TOKEN manquante dans les variables d\'environnement');
    }

    this.config = {
      token: token || '',
      channelId: channelId || '' // Si pas de channel ID, on pourra le passer en paramètre
    };
  }

  /**
   * Envoie les articles non envoyés vers WhatsApp
   * Limité à 5 articles par exécution pour éviter le spam
   */
  async sendPendingArticles(limit: number = 5): Promise<void> {
    if (!this.config.token) {
      logger.error('Token Whapi manquant, impossible d\'envoyer les messages');
      return;
    }

    try {
      // 1. Récupérer les articles enrichis mais non envoyés
      const { data: articles, error } = await supabaseAdmin
        .from('articles')
        .select('id, title, summary_ai, url, image_urls')
        .eq('enrichment_status', 'completed')
        .eq('whatsapp_sent', false)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!articles || articles.length === 0) {
        logger.info('Aucun article en attente d\'envoi WhatsApp');
        return;
      }

      logger.info(`${articles.length} articles trouvés pour envoi WhatsApp`);

      // 2. Boucle d'envoi
      for (const article of articles) {
        try {
          await this.sendArticle(article);
          
          // Marquer comme envoyé
          await supabaseAdmin
            .from('articles')
            .update({ whatsapp_sent: true })
            .eq('id', article.id);
            
          logger.info(`Article ${article.id} envoyé sur WhatsApp avec succès`);
          
          // Pause de 5 secondes pour respecter les limites de débit
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (sendError) {
          logger.error(`Erreur lors de l'envoi de l'article ${article.id}:`, sendError);
          // On continue avec l'article suivant même si un échoue
        }
      }
    } catch (error) {
      logger.error('Erreur globale service WhatsApp:', error);
    }
  }

  /**
   * Envoie un article spécifique sur WhatsApp
   */
  private async sendArticle(article: Article): Promise<void> {
    // Utiliser le channel ID de la config ou une valeur par défaut/variable d'env
    const channelId = process.env.WHAPI_CHANNEL_ID;
    
    if (!channelId) {
      throw new Error('WHAPI_CHANNEL_ID non configuré');
    }

    // Préparer le contenu
    const title = article.title;
    const summary = article.summary_ai || 'Pas de résumé disponible.';
    const originalUrl = article.url;
    // Rediriger vers l'analyseur avec l'ID de l'article pré-sélectionné (aid)
    const opportunityUrl = `${process.env.FRONTEND_URL}/business/analyzer?aid=${article.id}&source=whatsapp`;
    
    // Déterminer si on envoie une image
    const imageUrl = (article.image_urls && article.image_urls.length > 0) ? article.image_urls[0] : null;

    try {
      await this.sendInteractiveMessage(channelId, title, summary, originalUrl, opportunityUrl, imageUrl || null);
    } catch (error) {
      logger.warn(`Échec de l'envoi interactif pour l'article ${article.id}, tentative en mode texte simple fallback. Erreur: ${error}`);
      // Fallback mode texte simple si le mode interactif échoue (ex: non supporté par le canal)
      const caption = `*${title}*\n\n${summary}\n\n🔗 Lire l'article complet : ${originalUrl}\n\n🚀 Opportunités Business : ${opportunityUrl}`;
      if (imageUrl) {
        await this.sendImage(channelId, imageUrl, caption);
      } else {
        await this.sendText(channelId, caption);
      }
    }
  }

  /**
   * Envoie un message interactif avec boutons
   */
  private async sendInteractiveMessage(
    to: string, 
    title: string, 
    summary: string, 
    originalUrl: string, 
    opportunityUrl: string,
    imageUrl: string | null
  ): Promise<void> {
    
    const payload: any = {
      to,
      type: 'button',
      body: {
        text: `*${title}*\n\n${summary}`
      },
      footer: {
        text: "Gabon 24/7 - Analyse IA"
      },
      action: {
        buttons: [
          {
            type: "url",
            title: "🚀 Opportunités Biz",
            id: "btn_opportunity",
            url: opportunityUrl
          },
          {
            type: "url",
            title: "🔗 Lire l'article",
            id: "btn_read_more",
            url: originalUrl
          }
        ]
      }
    };

    // Selon la doc Whapi, pour les messages interactifs avec image, 
    // on place 'media' à la racine et on ne met pas de 'header'
    if (imageUrl) {
      payload.media = imageUrl;
    } else {
      // Si pas d'image, on peut ajouter un header texte pour le style
      payload.header = {
        type: 'text',
        text: 'Actualité'
      };
    }

    await axios.post(
      `${this.WHAPI_URL}/messages/interactive`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Envoie un message texte simple
   */
  private async sendText(to: string, body: string): Promise<void> {
    await axios.post(
      `${this.WHAPI_URL}/messages/text`,
      {
        to,
        body,
        typing_time: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Envoie une image avec légende
   */
  private async sendImage(to: string, imageUrl: string, caption: string): Promise<void> {
    await axios.post(
      `${this.WHAPI_URL}/messages/image`,
      {
        to,
        media: imageUrl,
        caption,
        width: 100, // Optionnel mais recommandé par la doc
        height: 100 // Optionnel
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

export const whatsAppService = new WhatsAppService();
