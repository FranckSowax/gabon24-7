import { Router } from 'express';
import { RSSController } from '../controllers/rss.controller';
import { authMiddleware } from '../middleware/auth';
import { roleMiddleware } from '../middleware/role';

const router = Router();
const rssController = new RSSController();

// Toutes les routes RSS nécessitent une authentification
router.use(authMiddleware);

/**
 * @route GET /api/rss
 * @desc Obtenir tous les flux RSS
 * @access Admin, Journalist
 */
router.get('/', 
  roleMiddleware(['admin', 'journalist']),
  rssController.getAllFeeds.bind(rssController)
);

/**
 * @route GET /api/rss/stats
 * @desc Obtenir les statistiques des flux RSS
 * @access Admin, Journalist
 */
router.get('/stats',
  roleMiddleware(['admin', 'journalist']),
  rssController.getFeedStats.bind(rssController)
);

/**
 * @route GET /api/rss/:id
 * @desc Obtenir un flux RSS par ID
 * @access Admin, Journalist
 */
router.get('/:id',
  roleMiddleware(['admin', 'journalist']),
  rssController.getFeedById.bind(rssController)
);

/**
 * @route POST /api/rss
 * @desc Créer un nouveau flux RSS
 * @access Admin only
 */
router.post('/',
  roleMiddleware(['admin']),
  rssController.createFeed.bind(rssController)
);

/**
 * @route PUT /api/rss/:id
 * @desc Mettre à jour un flux RSS
 * @access Admin only
 */
router.put('/:id',
  roleMiddleware(['admin']),
  rssController.updateFeed.bind(rssController)
);

/**
 * @route DELETE /api/rss/:id
 * @desc Supprimer un flux RSS
 * @access Admin only
 */
router.delete('/:id',
  roleMiddleware(['admin']),
  rssController.deleteFeed.bind(rssController)
);

/**
 * @route POST /api/rss/:id/process
 * @desc Forcer le traitement d'un flux RSS
 * @access Admin, Journalist
 */
router.post('/:id/process',
  roleMiddleware(['admin', 'journalist']),
  rssController.processFeed.bind(rssController)
);

export default router;
