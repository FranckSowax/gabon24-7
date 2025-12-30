const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
    category: 'Économie',
    readTime: '3 min',
    trending: true
  },
  {
    id: '2',
    title: 'Lancement du Programme de Reforestation Nationale',
    summary: 'Le gouvernement annonce un programme ambitieux de reforestation.',
    source: 'Gabon Matin',
    publishedAt: '4 heures',
    category: 'Environnement',
    readTime: '2 min',
    trending: true
  },
  {
    id: '3',
    title: 'Inauguration du Nouveau Terminal de l\'Aéroport de Libreville',
    summary: 'Le président inaugure le nouveau terminal international de l\'aéroport Léon Mba.',
    source: 'Gabon Review',
    publishedAt: '6 heures',
    category: 'Infrastructure',
    readTime: '4 min'
  }
];

// Routes Admin
app.get('/api/admin/stats', (req, res) => {
  res.json({
    success: true,
    totalArticles: 156,
    activeFeeds: mockFeeds.filter(f => f.status === 'active').length,
    totalUsers: 1247,
    todayArticles: 23
  });
});

app.get('/api/admin/recent-articles', (req, res) => {
  res.json({
    success: true,
    articles: mockArticles
  });
});

app.get('/api/admin/rss-feeds', (req, res) => {
  res.json({
    success: true,
    feeds: mockFeeds
  });
});

app.post('/api/admin/rss-feeds', (req, res) => {
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
    status: 'active',
    lastFetch: 'Jamais',
    articlesCount: 0
  };

  mockFeeds.push(newFeed);

  res.json({
    success: true,
    message: 'Flux RSS ajouté avec succès',
    feed: newFeed
  });
});

app.post('/api/admin/rss-feeds/:id/test', (req, res) => {
  const { id } = req.params;
  const feed = mockFeeds.find(f => f.id === id);
  
  if (!feed) {
    return res.status(404).json({
      success: false,
      message: 'Flux RSS non trouvé'
    });
  }

  // Simuler un test de connectivité plus réaliste
  // Les médias gabonais principaux ont plus de chance de réussir
  const successRate = feed.name.includes('Union') || feed.name.includes('Gabon Matin') ? 0.8 : 0.6;
  const isSuccess = Math.random() < successRate;
  
  feed.status = isSuccess ? 'active' : 'error';
  feed.lastFetch = 'À l\'instant';
  
  // Mettre à jour le nombre d'articles si le test réussit
  if (isSuccess && feed.articlesCount === 0) {
    feed.articlesCount = Math.floor(Math.random() * 20) + 10;
  }

  res.json({
    success: true,
    message: `Test du flux ${feed.name} ${feed.status === 'active' ? 'réussi' : 'échoué'}`,
    feed,
    details: feed.status === 'active' 
      ? `Connexion établie - ${feed.articlesCount} articles disponibles`
      : 'Impossible de se connecter au flux RSS - Vérifiez l\'URL'
  });
});

app.delete('/api/admin/rss-feeds/:id', (req, res) => {
  const { id } = req.params;
  const index = mockFeeds.findIndex(f => f.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Flux RSS non trouvé'
    });
  }

  const deletedFeed = mockFeeds.splice(index, 1)[0];

  res.json({
    success: true,
    message: `Flux RSS ${deletedFeed.name} supprimé avec succès`
  });
});

app.post('/api/admin/sync-rss', (req, res) => {
  // Simuler une synchronisation
  let activeFeeds = 0;
  let newArticles = 0;
  
  mockFeeds.forEach(feed => {
    if (feed.status === 'active') {
      feed.lastFetch = 'À l\'instant';
      const newCount = Math.floor(Math.random() * 5) + 1;
      feed.articlesCount += newCount;
      newArticles += newCount;
      activeFeeds++;
    }
  });

  res.json({
    success: true,
    message: `Synchronisation terminée: ${newArticles} nouveaux articles récupérés depuis ${activeFeeds} flux actifs`
  });
});

// Nouvelle route pour réinitialiser tous les flux en statut actif
app.post('/api/admin/rss-feeds/reset-all', (req, res) => {
  mockFeeds.forEach(feed => {
    feed.status = 'active';
    feed.lastFetch = 'À l\'instant';
    if (feed.articlesCount === 0) {
      feed.articlesCount = Math.floor(Math.random() * 30) + 15;
    }
  });

  res.json({
    success: true,
    message: 'Tous les flux RSS ont été réinitialisés en statut actif',
    activeFeeds: mockFeeds.length
  });
});

// Routes Articles (pour le frontend)
app.get('/api/articles', (req, res) => {
  res.json({
    success: true,
    articles: mockArticles
  });
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend GabonNews opérationnel',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend GabonNews démarré sur http://localhost:${PORT}`);
  console.log(`📊 Dashboard admin: http://localhost:3002/admin`);
  console.log(`📡 API RSS: http://localhost:${PORT}/api/admin/rss-feeds`);
});
