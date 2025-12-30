const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Mock data - Articles RSS simulés
const mockArticles = [
  {
    id: 1,
    title: "Le président Ali Bongo Ondimba inaugure un nouveau centre hospitalier à Libreville",
    description: "Une nouvelle infrastructure de santé moderne ouvre ses portes dans la capitale gabonaise pour améliorer l'accès aux soins.",
    content: "Le président de la République, Ali Bongo Ondimba, a procédé ce matin à l'inauguration du Centre Hospitalier Universitaire de Libreville, une infrastructure moderne qui vient renforcer l'offre de soins dans la capitale. Cette réalisation s'inscrit dans le cadre du Plan Stratégique Gabon Émergent...",
    url: "https://gabonnews.com/sante/nouveau-chu-libreville",
    published_at: new Date().toISOString(),
    source: "Gabon News",
    image_url: "/images/default-news.jpg",
    ai_summary: "Inauguration d'un nouveau centre hospitalier universitaire à Libreville par le président Ali Bongo Ondimba",
    category: "Santé",
    view_count: 245
  },
  {
    id: 2,
    title: "Découverte d'un nouveau gisement pétrolier au large de Port-Gentil",
    description: "Une compagnie internationale annonce la découverte d'importantes réserves pétrolières dans les eaux gabonaises.",
    content: "La compagnie pétrolière Total Energies a annoncé la découverte d'un nouveau gisement pétrolier offshore au large de Port-Gentil. Les premières estimations font état de réserves importantes qui pourraient contribuer significativement à l'économie nationale...",
    url: "https://gabonnews.com/economie/nouveau-gisement-petrole",
    published_at: new Date(Date.now() - 3600000).toISOString(),
    source: "L'Union",
    image_url: "/images/default-news.jpg",
    ai_summary: "Découverte d'un nouveau gisement pétrolier offshore au Gabon par Total Energies",
    category: "Économie",
    view_count: 189
  },
  {
    id: 3,
    title: "Lancement du programme national de digitalisation de l'éducation",
    description: "Le ministère de l'Éducation nationale déploie un ambitieux programme de transformation numérique des écoles.",
    content: "Le ministre de l'Éducation nationale a présenté le programme 'École Numérique Gabon 2030' qui vise à équiper toutes les écoles du pays en outils numériques. Cette initiative comprend la distribution de tablettes aux élèves et la formation des enseignants...",
    url: "https://gabonnews.com/education/ecole-numerique-2030",
    published_at: new Date(Date.now() - 7200000).toISOString(),
    source: "Gabon Matin",
    image_url: "/images/default-news.jpg",
    ai_summary: "Lancement du programme École Numérique Gabon 2030 pour la digitalisation de l'éducation",
    category: "Éducation",
    view_count: 156
  },
  {
    id: 4,
    title: "Festival International de Musique de Libreville : une programmation exceptionnelle",
    description: "La 15e édition du festival accueille des artistes de renommée internationale aux côtés des talents locaux.",
    content: "Le Festival International de Musique de Libreville ouvre ses portes avec une programmation riche mêlant artistes gabonais et internationaux. Cette année, l'événement met l'accent sur la promotion de la musique traditionnelle gabonaise tout en s'ouvrant aux influences contemporaines...",
    url: "https://gabonnews.com/culture/festival-musique-libreville",
    published_at: new Date(Date.now() - 10800000).toISOString(),
    source: "Gabon Culture",
    image_url: "/images/default-news.jpg",
    ai_summary: "15e édition du Festival International de Musique de Libreville avec une programmation mêlant talents locaux et internationaux",
    category: "Culture",
    view_count: 98
  },
  {
    id: 5,
    title: "Signature d'un accord de coopération économique avec la France",
    description: "Le Gabon et la France renforcent leurs liens commerciaux avec un nouvel accord de partenariat stratégique.",
    content: "Le président gabonais et son homologue français ont signé un accord de coopération économique portant sur plusieurs secteurs clés : énergie, agriculture, numérique et formation. Cet accord prévoit des investissements français de plus de 500 millions d'euros sur cinq ans...",
    url: "https://gabonnews.com/international/accord-france-gabon",
    published_at: new Date(Date.now() - 14400000).toISOString(),
    source: "Gabon Diplomatique",
    image_url: "/images/default-news.jpg",
    ai_summary: "Signature d'un accord de coopération économique entre le Gabon et la France prévoyant 500M€ d'investissements",
    category: "International",
    view_count: 167
  },
  {
    id: 6,
    title: "Ouverture de la saison touristique dans le parc national de Loango",
    description: "Le parc national de Loango rouvre ses portes aux visiteurs avec de nouveaux aménagements écotouristiques.",
    content: "Après plusieurs mois de travaux d'aménagement, le parc national de Loango accueille à nouveau les touristes. De nouveaux circuits écotouristiques ont été créés pour permettre l'observation de la faune dans le respect de l'environnement. Le parc espère accueillir 15 000 visiteurs cette saison...",
    url: "https://gabonnews.com/environnement/parc-loango-saison-touristique",
    published_at: new Date(Date.now() - 18000000).toISOString(),
    source: "Gabon Vert",
    image_url: "/images/default-news.jpg",
    ai_summary: "Réouverture du parc national de Loango avec de nouveaux aménagements écotouristiques",
    category: "Environnement",
    view_count: 134
  },
  {
    id: 7,
    title: "Lancement de la campagne de vaccination contre la fièvre jaune",
    description: "Le ministère de la Santé débute une vaste campagne de vaccination préventive dans tout le pays.",
    content: "Une campagne nationale de vaccination contre la fièvre jaune a été lancée par le ministère de la Santé. L'objectif est de vacciner 2 millions de Gabonais d'ici la fin de l'année. Des équipes mobiles se déploient dans les zones rurales pour assurer une couverture maximale...",
    url: "https://gabonnews.com/sante/campagne-vaccination-fievre-jaune",
    published_at: new Date(Date.now() - 21600000).toISOString(),
    source: "Gabon Santé",
    image_url: "/images/default-news.jpg",
    ai_summary: "Lancement d'une campagne nationale de vaccination contre la fièvre jaune visant 2 millions de Gabonais",
    category: "Santé",
    view_count: 203
  },
  {
    id: 8,
    title: "Inauguration du nouveau stade omnisports de Franceville",
    description: "Franceville se dote d'une infrastructure sportive moderne pouvant accueillir 25 000 spectateurs.",
    content: "Le nouveau stade omnisports de Franceville a été inauguré en présence des autorités locales et nationales. Cette infrastructure de 25 000 places répond aux normes internationales et pourra accueillir des compétitions africaines et mondiales. Les travaux ont duré trois ans...",
    url: "https://gabonnews.com/sport/nouveau-stade-franceville",
    published_at: new Date(Date.now() - 25200000).toISOString(),
    source: "Gabon Sport",
    image_url: "/images/default-news.jpg",
    ai_summary: "Inauguration du nouveau stade omnisports de Franceville d'une capacité de 25 000 places",
    category: "Sport",
    view_count: 178
  }
];

const mockSlides = [
  {
    id: 1,
    title: "Publicité Gabon 24/7",
    description: "Votre plateforme d'information gabonaise",
    image_url: "/images/banner-Studia-2100x-900.jpg",
    link_url: "https://gabon-insight.netlify.app",
    is_active: true
  }
];

const mockEvents = [
  {
    id: 1,
    title: "Événement culturel gabonais",
    description: "Célébration de la culture gabonaise",
    date: new Date(Date.now() + 86400000).toISOString(),
    location: "Libreville",
    image_url: "https://via.placeholder.com/300x200"
  }
];

// Routes de base
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend de développement actif' });
});

// Route pour récupérer les articles depuis Supabase
app.get('/api/articles', async (req, res) => {
  try {
    const { tab } = req.query;
    
    let query = supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filtrage par onglet
    if (tab === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (tab === 'archives') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.lt('created_at', weekAgo.toISOString());
    } else {
      // Par défaut, articles récents (dernière semaine)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    }
    
    const { data: articles, error } = await query.limit(50);
    
    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des articles'
      });
    }
    
    res.json({
      success: true,
      articles: articles || []
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Route pour récupérer les articles par onglet (compatibilité)
app.get('/api/articles/:tab', async (req, res) => {
  const { tab } = req.params;
  
  try {
    let query = supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (tab === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (tab === 'archives') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.lt('created_at', weekAgo.toISOString());
    }
    
    const { data: articles, error } = await query.limit(50);
    
    if (error) {
      console.error('Erreur Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des articles'
      });
    }
    
    res.json({
      success: true,
      articles: articles || []
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Weather API endpoint
app.get('/api/weather/:city', (req, res) => {
  const { city } = req.params;
  
  // Mock weather data matching WeatherWidget expectations
  res.json({
    success: true,
    data: {
      city: city,
      temperature: 28,
      feels_like: 30,
      weather_description: "Temps ensoleillé avec quelques nuages",
      humidity: 75,
      wind_speed: 12,
      pressure: 1013,
      visibility: 10000,
      uv_index: 6,
      weather_icon: "01d"
    },
    fallback: {
      temperature: 25,
      weather_description: "Données météo non disponibles",
      humidity: 70,
      wind_speed: 8
    }
  });
});

// Route pour récupérer les slides publicitaires depuis Supabase
app.get('/api/slides', async (req, res) => {
  try {
    const { data: slides, error } = await supabase
      .from('promotional_slides')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur Supabase slides:', error);
      // Fallback vers données mock en cas d'erreur
      return res.json({
        success: true,
        slides: mockSlides
      });
    }
    
    res.json({
      success: true,
      slides: slides || []
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.json({
      success: true,
      slides: mockSlides
    });
  }
});

// Route pour récupérer les événements depuis Supabase
app.get('/api/events', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .limit(10);
    
    if (error) {
      console.error('Erreur Supabase events:', error);
      // Fallback vers données mock
      return res.json({
        success: true,
        events: mockEvents
      });
    }
    
    res.json({
      success: true,
      events: events || []
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.json({
      success: true,
      events: mockEvents
    });
  }
});

// YouTube feed endpoint
app.get('/api/youtube-feed', (req, res) => {
  res.json([
    {
      id: "dQw4w9WgXcQ",
      title: "Journal Télévisé - Gabon 24/7 - Édition du soir",
      thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      publishedAt: new Date().toISOString(),
      duration: "15:30"
    },
    {
      id: "abc123def456",
      title: "Journal Télévisé - Gabon 24/7 - Édition du midi",
      thumbnail: "https://img.youtube.com/vi/abc123def456/maxresdefault.jpg",
      url: "https://www.youtube.com/watch?v=abc123def456",
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      duration: "12:45"
    }
  ]);
});

// Slide view tracking endpoint
app.post('/api/slides/:slideId/view', (req, res) => {
  const { slideId } = req.params;
  console.log(`📊 Vue enregistrée pour slide ${slideId}`);
  res.json({ 
    success: true, 
    message: `Vue enregistrée pour slide ${slideId}` 
  });
});

// Sondage quotidien
app.post('/api/generate-daily-poll', (req, res) => {
  const polls = [
    {
      question: "Quelle priorité pour le développement du Gabon ?",
      options: ["Économie", "Éducation", "Santé"]
    },
    {
      question: "Comment améliorer les infrastructures gabonaises ?",
      options: ["Routes", "Télécommunications", "Énergie"]
    },
    {
      question: "Quel secteur développer en priorité ?",
      options: ["Tourisme", "Agriculture", "Technologie"]
    }
  ];
  
  const randomPoll = polls[Math.floor(Math.random() * polls.length)];
  res.json(randomPoll);
});

// RSS feeds
app.get('/api/rss-feeds', (req, res) => {
  res.json({
    feeds: [
      {
        id: 1,
        name: "Gabon News",
        url: "https://gabonnews.com/rss",
        active: true,
        last_fetch_at: new Date().toISOString()
      }
    ]
  });
});

// Route catch-all pour éviter les erreurs 404
app.get('*', (req, res) => {
  res.status(404).json({
    error: "Endpoint non trouvé en mode développement",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/articles',
      'GET /api/articles/:tab',
      'GET /api/weather/:city',
      'GET /api/slides',
      'GET /api/events',
      'GET /api/youtube-feed',
      'POST /api/generate-daily-poll',
      'GET /api/rss-feeds'
    ]
  });
});

// Démarrer le serveur
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🚀 Backend de développement démarré sur http://localhost:${PORT}`);
  console.log('📋 Endpoints disponibles:');
  console.log('  - GET  /api/health');
  console.log('  - GET  /api/articles');
  console.log('  - GET  /api/articles/:tab');
  console.log('  - GET  /api/weather/:city');
  console.log('  - GET  /api/slides');
  console.log('  - GET  /api/events');
  console.log('  - GET  /api/youtube-feed');
  console.log('  - POST /api/generate-daily-poll');
  console.log('  - GET  /api/rss-feeds');
});
