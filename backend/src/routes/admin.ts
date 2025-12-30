import { Router } from 'express';

const router = Router();

// Mock data pour le développement
const mockFeeds = [
  {
    id: '1',
    name: 'L\'Union',
    url: 'https://www.lunion.ga/rss',
    category: 'Actualités',
    status: 'active',
    lastFetch: '2 heures',
    articlesCount: 45
  },
  {
    id: '2',
    name: 'Gabon Matin',
    url: 'https://www.gabonmatin.com/rss',
    category: 'Actualités',
    status: 'active',
    lastFetch: '1 heure',
    articlesCount: 32
  },
  {
    id: '3',
    name: 'Gabon Review',
    url: 'https://www.gabonreview.com/rss',
    category: 'Économie',
    status: 'error',
    lastFetch: '6 heures',
    articlesCount: 28
  }
];

const mockArticles = [
  {
    id: '1',
    title: 'Nouvelle Découverte Pétrolière au Large de Port-Gentil',
    summary: 'Une importante réserve de pétrole découverte au large des côtes gabonaises.',
    source: 'L\'Union',
    publishedAt: '2 heures',
    category: 'Économie'
  },
  {
    id: '2',
    title: 'Lancement du Programme de Reforestation Nationale',
    summary: 'Le gouvernement annonce un programme ambitieux de reforestation.',
    source: 'Gabon Matin',
    publishedAt: '4 heures',
    category: 'Environnement'
  }
];

// Dashboard stats
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalArticles: 156,
      activeFeeds: 3,
      totalUsers: 1247,
      todayArticles: 23
    }
  });
});

// Recent articles
router.get('/recent-articles', (req, res) => {
  res.json({
    success: true,
    articles: mockArticles
  });
});

// RSS Feeds Management
router.get('/rss-feeds', (req, res) => {
  res.json({
    success: true,
    feeds: mockFeeds
  });
});

router.post('/rss-feeds', (req, res) => {
  const { name, url, category } = req.body;
  
  if (!name || !url || !category) {
    return res.status(400).json({
      success: false,
      message: 'Nom, URL et catégorie sont requis'
    });
  }

  const newFeed = {
    id: String(mockFeeds.length + 1),
    name,
    url,
    category,
    status: 'active' as const,
    lastFetch: 'Jamais',
    articlesCount: 0
  };

  mockFeeds.push(newFeed);

  return res.json({
    success: true,
    message: 'Flux RSS ajouté avec succès',
    feed: newFeed
  });
});

router.post('/rss-feeds/:id/test', (req, res) => {
  const { id } = req.params;
  const feed = mockFeeds.find(f => f.id === id);
  
  if (!feed) {
    return res.status(404).json({
      success: false,
      message: 'Flux RSS non trouvé'
    });
  }

  // Simuler un test de connectivité
  feed.status = Math.random() > 0.3 ? 'active' : 'error';
  feed.lastFetch = 'À l\'instant';

  return res.json({
    success: true,
    message: `Test du flux ${feed.name} ${feed.status === 'active' ? 'réussi' : 'échoué'}`,
    feed
  });
});

router.delete('/rss-feeds/:id', (req, res) => {
  const { id } = req.params;
  const index = mockFeeds.findIndex(f => f.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Flux RSS non trouvé'
    });
  }

  const deletedFeed = mockFeeds.splice(index, 1)[0];
  if (!deletedFeed) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }

  return res.json({
    success: true,
    message: `Flux RSS ${deletedFeed.name} supprimé avec succès`
  });
});

// Sync RSS manually
router.post('/sync-rss', (req, res) => {
  // Simuler une synchronisation
  setTimeout(() => {
    mockFeeds.forEach(feed => {
      if (feed.status === 'active') {
        feed.lastFetch = 'À l\'instant';
        feed.articlesCount += Math.floor(Math.random() * 5);
      }
    });
  }, 1000);

  res.json({
    success: true,
    message: 'Synchronisation RSS lancée avec succès'
  });
});

// Route de test simple pour l'administration
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        users: 1247,
        articles: 156,
        feeds: mockFeeds.length
      }
    },
    message: 'Dashboard admin opérationnel'
  });
});

export default router;
