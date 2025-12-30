const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gzjjkqmgvqfmqjbvnfmv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amprcW1ndnFmbXFqYnZuZm12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTkzNTQ0NCwiZXhwIjoyMDUxNTExNDQ0fQ.2wJYsuuogjO_3fKOQeHNdLJjXJYNdVkWRDUBCGhAoQs';

let supabase = null;
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialisé pour les articles');
} catch (error) {
  console.error('❌ Erreur initialisation Supabase:', error.message);
}

// Middleware
app.use(cors());
app.use(express.json());

// Import des routes
const youtubeRouter = require('./src/routes/youtube.js');

// Routes
app.use('/api', youtubeRouter);

// Routes de fallback pour éviter les erreurs 404
app.get('/api/weather/:city', (req, res) => {
  res.json({
    data: {
      location: req.params.city,
      temperature: 28,
      condition: 'Ensoleillé',
      humidity: 75,
      windSpeed: 12,
      icon: '☀️',
      description: 'Temps ensoleillé à Libreville'
    },
    success: true
  });
});

app.get('/api/slides', (req, res) => {
  res.json([]);
});

app.get('/api/events', (req, res) => {
  res.json([]);
});

app.get('/api/rss/last-update', (req, res) => {
  res.json({
    lastUpdate: new Date().toISOString(),
    status: 'success'
  });
});

app.get('/api/homepage/articles', async (req, res) => {
  try {
    // Récupérer les articles depuis Supabase
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('❌ Erreur récupération articles:', error);
      return res.status(500).json({
        articles: [],
        totalCount: 0,
        page: 1,
        limit: 20,
        error: 'Erreur lors de la récupération des articles'
      });
    }
    
    console.log(`📰 ${articles?.length || 0} articles récupérés depuis Supabase`);
    
    res.json({
      articles: articles || [],
      totalCount: articles?.length || 0,
      page: 1,
      limit: 20
    });
  } catch (error) {
    console.error('❌ Erreur API articles:', error);
    res.status(500).json({
      articles: [],
      totalCount: 0,
      page: 1,
      limit: 20,
      error: 'Erreur serveur'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Serveur Gabon 24/7 démarré sur le port ${PORT}`);
  console.log(`📺 Module YouTube: http://localhost:${PORT}/api/youtube-feed`);
  console.log(`🌤️ API Météo: http://localhost:${PORT}/api/weather/Libreville`);
  console.log(`📰 API Articles: http://localhost:${PORT}/api/homepage/articles`);
  console.log(`🎉 API Événements: http://localhost:${PORT}/api/events`);
  console.log(`📢 API Slides: http://localhost:${PORT}/api/slides`);
  console.log(`🔄 Health Check: http://localhost:${PORT}/health`);
});
