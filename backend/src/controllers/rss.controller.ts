import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/database';
import { QueueManager } from '../config/queue';
import { RSSService } from '../services/rss.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

const rssService = new RSSService();

// Schémas de validation
const createFeedSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  url: z.string().url('URL invalide'),
  media_name: z.string().min(1, 'Le nom du média est requis'),
  fetch_interval: z.number().min(5).max(1440).default(15), // 5 min à 24h
});

const updateFeedSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  media_name: z.string().min(1).optional(),
  fetch_interval: z.number().min(5).max(1440).optional(),
  is_active: z.boolean().optional(),
});

export class RSSController {
  /**
   * Obtenir tous les flux RSS
   */
  async getAllFeeds(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, active_only = false } = req.query;
      
      let query = supabaseAdmin
        .from('rss_feeds')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (active_only === 'true') {
        query = query.eq('is_active', true);
      }

      const offset = (Number(page) - 1) * Number(limit);
      query = query.range(offset, offset + Number(limit) - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Erreur lors de la récupération des flux RSS:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Erreur lors de la récupération des flux RSS' 
        });
        return;
      }

      res.json({
        success: true,
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / Number(limit))
        }
      });

    } catch (error) {
      logger.error('Erreur dans getAllFeeds:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur interne du serveur' 
      });
    }
  }

  /**
   * Obtenir un flux RSS par ID
   */
  async getFeedById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        res.status(404).json({ 
          success: false, 
          error: 'Flux RSS non trouvé' 
        });
        return;
      }

      res.json({
        success: true,
        data
      });

    } catch (error) {
      logger.error('Erreur dans getFeedById:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur interne du serveur' 
      });
    }
  }

  /**
   * Créer un nouveau flux RSS
   */
  async createFeed(req: Request, res: Response): Promise<void> {
    try {
      const validation = createFeedSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Données invalides',
          details: validation.error.errors
        });
        return;
      }

      const feedData = validation.data;

      // Vérifier si l'URL existe déjà
      const { data: existingFeed } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('url', feedData.url)
        .single();

      if (existingFeed) {
        res.status(409).json({
          success: false,
          error: 'Cette URL de flux RSS existe déjà'
        });
        return;
      }

      // Tester le flux RSS avant de le créer
      try {
        await rssService.processFeed('test', feedData.url, feedData.media_name);
      } catch (testError) {
        res.status(400).json({
          success: false,
          error: 'Impossible de traiter ce flux RSS',
          details: testError.message
        });
        return;
      }

      // Créer le flux
      const { data, error } = await supabaseAdmin
        .from('rss_feeds')
        .insert({
          ...feedData,
          is_active: true,
          error_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Erreur lors de la création du flux RSS:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la création du flux RSS'
        });
        return;
      }

      // Ajouter immédiatement à la queue de traitement
      await QueueManager.addRSSJob({
        feedId: data.id,
        feedUrl: data.url,
        mediaName: data.media_name
      }, 5); // Priorité élevée pour nouveau flux

      logger.info(`Nouveau flux RSS créé: ${data.media_name}`, { feedId: data.id });

      res.status(201).json({
        success: true,
        data,
        message: 'Flux RSS créé avec succès'
      });

    } catch (error) {
      logger.error('Erreur dans createFeed:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Mettre à jour un flux RSS
   */
  async updateFeed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validation = updateFeedSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Données invalides',
          details: validation.error.errors
        });
        return;
      }

      const updateData = validation.data;

      // Vérifier si le flux existe
      const { data: existingFeed } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('id', id)
        .single();

      if (!existingFeed) {
        res.status(404).json({
          success: false,
          error: 'Flux RSS non trouvé'
        });
        return;
      }

      // Si l'URL change, vérifier qu'elle n'existe pas déjà
      if (updateData.url && updateData.url !== existingFeed.url) {
        const { data: duplicateCheck } = await supabaseAdmin
          .from('rss_feeds')
          .select('id')
          .eq('url', updateData.url)
          .neq('id', id)
          .single();

        if (duplicateCheck) {
          res.status(409).json({
            success: false,
            error: 'Cette URL de flux RSS existe déjà'
          });
          return;
        }
      }

      // Mettre à jour
      const { data, error } = await supabaseAdmin
        .from('rss_feeds')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Erreur lors de la mise à jour du flux RSS:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la mise à jour du flux RSS'
        });
        return;
      }

      logger.info(`Flux RSS mis à jour: ${data.media_name}`, { feedId: id });

      res.json({
        success: true,
        data,
        message: 'Flux RSS mis à jour avec succès'
      });

    } catch (error) {
      logger.error('Erreur dans updateFeed:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Supprimer un flux RSS
   */
  async deleteFeed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Vérifier si le flux existe
      const { data: existingFeed } = await supabaseAdmin
        .from('rss_feeds')
        .select('media_name')
        .eq('id', id)
        .single();

      if (!existingFeed) {
        res.status(404).json({
          success: false,
          error: 'Flux RSS non trouvé'
        });
        return;
      }

      // Supprimer le flux (les articles associés peuvent être conservés)
      const { error } = await supabaseAdmin
        .from('rss_feeds')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Erreur lors de la suppression du flux RSS:', error);
        res.status(500).json({
          success: false,
          error: 'Erreur lors de la suppression du flux RSS'
        });
        return;
      }

      logger.info(`Flux RSS supprimé: ${existingFeed.media_name}`, { feedId: id });

      res.json({
        success: true,
        message: 'Flux RSS supprimé avec succès'
      });

    } catch (error) {
      logger.error('Erreur dans deleteFeed:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Forcer le traitement d'un flux RSS
   */
  async processFeed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Récupérer le flux
      const { data: feed, error } = await supabaseAdmin
        .from('rss_feeds')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !feed) {
        res.status(404).json({
          success: false,
          error: 'Flux RSS non trouvé'
        });
        return;
      }

      if (!feed.is_active) {
        res.status(400).json({
          success: false,
          error: 'Le flux RSS est désactivé'
        });
        return;
      }

      // Ajouter à la queue avec priorité élevée
      await QueueManager.addRSSJob({
        feedId: feed.id,
        feedUrl: feed.url,
        mediaName: feed.media_name
      }, 10); // Priorité maximale

      logger.info(`Traitement forcé du flux RSS: ${feed.media_name}`, { feedId: id });

      res.json({
        success: true,
        message: 'Flux RSS ajouté à la queue de traitement'
      });

    } catch (error) {
      logger.error('Erreur dans processFeed:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Obtenir les statistiques des flux RSS
   */
  async getFeedStats(req: Request, res: Response): Promise<void> {
    try {
      // Statistiques générales
      const [
        { count: totalFeeds },
        { count: activeFeeds },
        { count: inactiveFeeds },
        { count: errorFeeds }
      ] = await Promise.all([
        supabaseAdmin.from('rss_feeds').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('rss_feeds').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabaseAdmin.from('rss_feeds').select('*', { count: 'exact', head: true }).eq('is_active', false),
        supabaseAdmin.from('rss_feeds').select('*', { count: 'exact', head: true }).gt('error_count', 0)
      ]);

      // Articles traités aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: articlesToday } = await supabaseAdmin
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Statistiques des queues
      const queueStats = await QueueManager.getQueueStats();

      res.json({
        success: true,
        data: {
          feeds: {
            total: totalFeeds || 0,
            active: activeFeeds || 0,
            inactive: inactiveFeeds || 0,
            withErrors: errorFeeds || 0
          },
          articles: {
            processedToday: articlesToday || 0
          },
          queues: queueStats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Erreur dans getFeedStats:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }
}
