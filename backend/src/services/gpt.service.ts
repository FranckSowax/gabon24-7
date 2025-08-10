import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { RedisService } from '../config/redis';
import { supabaseAdmin } from '../config/database';

export class GPTService {
  private openai: OpenAI;
  private readonly CACHE_TTL = 3600; // 1 heure

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY manquante dans les variables d\'environnement');
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: 30000, // 30 secondes
    });
  }

  /**
   * Générer un résumé d'article optimisé pour WhatsApp
   */
  async generateSummary(articleId: string, title: string, content: string, mediaName: string): Promise<string> {
    try {
      // Vérifier le cache d'abord
      const cacheKey = `summary:${articleId}`;
      const cachedSummary = await RedisService.get(cacheKey);
      
      if (cachedSummary) {
        logger.debug(`Résumé trouvé en cache pour l'article ${articleId}`);
        return cachedSummary;
      }

      logger.info(`Génération du résumé pour l'article: ${title}`);

      // Préparer le prompt optimisé pour le contexte gabonais
      const prompt = this.buildSummaryPrompt(title, content, mediaName);

      // Appel à l'API OpenAI
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Tu es un journaliste expert spécialisé dans l'actualité gabonaise. 
            Tu dois créer des résumés d'articles optimisés pour WhatsApp : 
            - Maximum 2-3 phrases courtes
            - Style direct et engageant
            - Préserver les informations essentielles
            - Utiliser un français accessible
            - Mentionner les noms et lieux gabonais correctement`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3, // Peu créatif pour rester factuel
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const summary = completion.choices[0]?.message?.content?.trim();

      if (!summary) {
        throw new Error('Aucun résumé généré par GPT');
      }

      // Validation du résumé
      if (summary.length < 20 || summary.length > 500) {
        throw new Error(`Résumé de longueur invalide: ${summary.length} caractères`);
      }

      // Sauvegarder le résumé dans la base de données
      await this.saveSummary(articleId, summary);

      // Mettre en cache
      await RedisService.set(cacheKey, summary, this.CACHE_TTL);

      logger.info(`Résumé généré et sauvegardé pour l'article ${articleId}`);
      return summary;

    } catch (error) {
      logger.error(`Erreur lors de la génération du résumé pour l'article ${articleId}:`, error);
      
      // Fallback: créer un résumé simple
      const fallbackSummary = this.createFallbackSummary(title, content);
      await this.saveSummary(articleId, fallbackSummary);
      
      return fallbackSummary;
    }
  }

  /**
   * Générer du contenu éditorial pour les journalistes
   */
  async generateEditorial(
    templateType: 'matinale' | 'midi' | 'soir' | 'weekly',
    articles: Array<{ title: string; summary: string; category: string; media_name: string }>,
    customPrompt?: string
  ): Promise<string> {
    try {
      logger.info(`Génération d'éditorial ${templateType} avec ${articles.length} articles`);

      const prompt = this.buildEditorialPrompt(templateType, articles, customPrompt);

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Tu es un éditorialiste expérimenté spécialisé dans l'actualité gabonaise.
            Tu dois créer des contenus éditoriaux engageants qui :
            - Synthétisent les actualités importantes
            - Apportent une analyse contextuelle
            - Utilisent un ton professionnel mais accessible
            - Respectent la diversité des sources d'information
            - Mettent en perspective les enjeux pour le Gabon`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7, // Plus créatif pour l'éditorial
        presence_penalty: 0.2,
        frequency_penalty: 0.2
      });

      const editorial = completion.choices[0]?.message?.content?.trim();

      if (!editorial) {
        throw new Error('Aucun éditorial généré par GPT');
      }

      logger.info(`Éditorial ${templateType} généré avec succès`);
      return editorial;

    } catch (error) {
      logger.error(`Erreur lors de la génération de l'éditorial ${templateType}:`, error);
      throw error;
    }
  }

  /**
   * Extraire et améliorer les mots-clés d'un article
   */
  async enhanceKeywords(title: string, content: string, existingKeywords: string[]): Promise<string[]> {
    try {
      const prompt = `
Analyse cet article gabonais et améliore la liste de mots-clés :

Titre: ${title}
Contenu: ${content.substring(0, 1000)}...
Mots-clés existants: ${existingKeywords.join(', ')}

Retourne une liste de 5-10 mots-clés pertinents en français, séparés par des virgules.
Privilégie les termes spécifiques au Gabon, les noms propres, et les concepts importants.
`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Modèle moins cher pour cette tâche
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en analyse de contenu spécialisé dans l\'actualité gabonaise.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      if (response) {
        const enhancedKeywords = response
          .split(',')
          .map(k => k.trim().toLowerCase())
          .filter(k => k.length > 2)
          .slice(0, 10);
        
        return [...new Set([...existingKeywords, ...enhancedKeywords])];
      }

      return existingKeywords;

    } catch (error) {
      logger.error('Erreur lors de l\'amélioration des mots-clés:', error);
      return existingKeywords;
    }
  }

  /**
   * Construire le prompt pour le résumé
   */
  private buildSummaryPrompt(title: string, content: string, mediaName: string): string {
    // Limiter le contenu pour éviter de dépasser les limites de tokens
    const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content;

    return `
Résume cet article de ${mediaName} en 2-3 phrases courtes pour WhatsApp :

Titre: ${title}

Contenu: ${truncatedContent}

Instructions:
- Maximum 2-3 phrases courtes et percutantes
- Préserver les informations essentielles (qui, quoi, où, quand)
- Style direct et accessible
- Éviter le jargon technique
- Mentionner les lieux et personnalités gabonaises correctement
`;
  }

  /**
   * Construire le prompt pour l'éditorial
   */
  private buildEditorialPrompt(
    templateType: string,
    articles: Array<{ title: string; summary: string; category: string; media_name: string }>,
    customPrompt?: string
  ): string {
    const timeContext = {
      'matinale': 'pour commencer la journée',
      'midi': 'pour la pause déjeuner',
      'soir': 'pour clôturer la journée',
      'weekly': 'pour faire le bilan de la semaine'
    };

    const articlesText = articles
      .map(a => `- ${a.title} (${a.category}, ${a.media_name})\n  ${a.summary}`)
      .join('\n\n');

    return `
Crée un éditorial ${templateType} ${timeContext[templateType as keyof typeof timeContext]} basé sur ces actualités gabonaises :

${articlesText}

${customPrompt ? `\nInstructions spéciales: ${customPrompt}` : ''}

Structure attendue:
- Introduction engageante
- Analyse des points saillants
- Mise en perspective pour le Gabon
- Conclusion avec ouverture

Ton: Professionnel mais accessible, informatif et engageant.
Longueur: 300-500 mots.
`;
  }

  /**
   * Créer un résumé de fallback simple
   */
  private createFallbackSummary(title: string, content: string): string {
    // Extraire les premières phrases du contenu
    const sentences = content.match(/[^\.!?]+[\.!?]+/g) || [];
    const firstSentences = sentences.slice(0, 2).join(' ').trim();
    
    if (firstSentences.length > 50) {
      return firstSentences.length > 200 ? firstSentences.substring(0, 200) + '...' : firstSentences;
    }
    
    // Si pas assez de contenu, utiliser le titre + début du contenu
    const shortContent = content.substring(0, 150).trim();
    return shortContent.length > 100 ? shortContent + '...' : shortContent;
  }

  /**
   * Sauvegarder le résumé dans la base de données
   */
  private async saveSummary(articleId: string, summary: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('articles')
        .update({ 
          summary,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) {
        logger.error(`Erreur lors de la sauvegarde du résumé pour l'article ${articleId}:`, error);
        throw error;
      }

    } catch (error) {
      logger.error('Erreur lors de la sauvegarde du résumé:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques d'utilisation de l'API
   */
  async getUsageStats(): Promise<any> {
    try {
      // Compter les résumés générés aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabaseAdmin
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .not('summary', 'is', null)
        .gte('updated_at', today.toISOString());

      return {
        summariesGeneratedToday: count || 0,
        date: today.toISOString()
      };

    } catch (error) {
      logger.error('Erreur lors du calcul des statistiques GPT:', error);
      return {
        summariesGeneratedToday: 0,
        date: new Date().toISOString()
      };
    }
  }
}
