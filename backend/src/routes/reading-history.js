const express = require('express');
const supabaseService = require('../../supabase-config');
const router = express.Router();

const { supabase } = supabaseService;

// Endpoint pour enregistrer un article lu avec contenu complet
router.post('/record', async (req, res) => {
  try {
    const { 
      userId, 
      articleId, 
      articleTitle, 
      articleContent, 
      articleSummary, 
      articleUrl, 
      articleSource = 'rss', 
      articleCategory, 
      articlePublishedAt,
      readingDuration,
      deviceType = 'web'
    } = req.body;

    if (!userId || !articleId || !articleTitle) {
      return res.status(400).json({ 
        error: 'userId, articleId et articleTitle sont requis' 
      });
    }

    // Utiliser la fonction Supabase pour enregistrer l'article lu
    const { data, error } = await supabase.rpc('record_article_read_with_content', {
      p_user_id: userId,
      p_article_id: articleId,
      p_article_title: articleTitle,
      p_article_content: articleContent,
      p_article_summary: articleSummary,
      p_article_url: articleUrl,
      p_article_source: articleSource,
      p_article_category: articleCategory,
      p_article_published_at: articlePublishedAt,
      p_reading_duration: readingDuration,
      p_device_type: deviceType
    });

    if (error) {
      console.error('❌ Erreur enregistrement article lu:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }

    console.log('✅ Article lu enregistré:', { userId, articleId, articleSource });
    res.json({ success: true, recorded: data });

  } catch (error) {
    console.error('❌ Erreur endpoint record reading:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour récupérer l'historique de lecture d'un utilisateur
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      source, 
      category, 
      favorites 
    } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const { data, error } = await supabase.rpc('get_user_reading_history', {
      user_uuid: userId,
      limit_count: parseInt(limit),
      offset_count: parseInt(offset),
      filter_source: source === 'all' ? null : source,
      filter_category: category === 'all' ? null : category,
      filter_favorites: favorites === 'true' ? true : null
    });

    if (error) {
      console.error('❌ Erreur récupération historique:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({ history: data || [] });

  } catch (error) {
    console.error('❌ Erreur endpoint history:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour récupérer les statistiques de lecture d'un utilisateur
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const { data, error } = await supabase.rpc('get_user_reading_stats', {
      user_uuid: userId
    });

    if (error) {
      console.error('❌ Erreur récupération stats:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({ stats: data && data.length > 0 ? data[0] : null });

  } catch (error) {
    console.error('❌ Erreur endpoint stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour toggle favori
router.post('/toggle-favorite', async (req, res) => {
  try {
    const { userId, articleId, articleTitle, articleUrl, articleSource } = req.body;

    if (!userId || !articleId) {
      return res.status(400).json({ error: 'userId et articleId requis' });
    }

    console.log('🔖 Toggle favori backend:', { userId, articleId, hasTitle: !!articleTitle });

    const { data, error } = await supabase.rpc('toggle_article_favorite', {
      user_uuid: userId,
      p_article_id: articleId,
      p_article_title: articleTitle || '',
      p_article_url: articleUrl || '',
      p_article_source: articleSource || ''
    });

    if (error) {
      console.error('❌ Erreur toggle favori:', error);
      return res.status(500).json({ error: 'Erreur lors du toggle favori' });
    }

    console.log('✅ Toggle favori réussi:', { isFavorite: data });
    res.json({ success: data });

  } catch (error) {
    console.error('❌ Erreur endpoint toggle favorite:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour toggle bookmark
router.post('/toggle-bookmark', async (req, res) => {
  try {
    const { userId, articleId } = req.body;

    if (!userId || !articleId) {
      return res.status(400).json({ error: 'userId et articleId requis' });
    }

    const { data, error } = await supabase.rpc('toggle_article_bookmark', {
      user_uuid: userId,
      p_article_id: articleId
    });

    if (error) {
      console.error('❌ Erreur toggle bookmark:', error);
      return res.status(500).json({ error: 'Erreur lors du toggle bookmark' });
    }

    res.json({ success: data });

  } catch (error) {
    console.error('❌ Erreur endpoint toggle bookmark:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
