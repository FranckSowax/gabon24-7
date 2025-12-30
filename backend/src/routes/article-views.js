const express = require('express');
const supabaseService = require('../../supabase-config');
const router = express.Router();

const { supabase } = supabaseService;

// Endpoint pour enregistrer une vue d'article
router.post('/track', async (req, res) => {
  try {
    const { userId, articleId, articleTitle, articleUrl, source = 'rss' } = req.body;

    if (!userId || !articleId) {
      return res.status(400).json({ 
        error: 'userId et articleId sont requis' 
      });
    }

    // Utiliser la fonction Supabase pour enregistrer la vue
    const { data, error } = await supabase.rpc('record_article_view', {
      p_user_id: userId,
      p_article_id: articleId,
      p_article_title: articleTitle,
      p_article_url: articleUrl,
      p_source: source
    });

    if (error) {
      console.error('❌ Erreur enregistrement vue article:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }

    console.log('✅ Vue article enregistrée:', { userId, articleId, source });
    res.json({ success: true, recorded: data });

  } catch (error) {
    console.error('❌ Erreur endpoint track article:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour récupérer le nombre d'articles lus par un utilisateur
router.get('/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const { data, error } = await supabase.rpc('get_user_articles_read_count', {
      user_uuid: userId
    });

    if (error) {
      console.error('❌ Erreur récupération count articles:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({ count: data || 0 });

  } catch (error) {
    console.error('❌ Erreur endpoint count articles:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour récupérer l'historique des articles lus par un utilisateur
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const { data, error } = await supabase
      .from('article_views')
      .select('*')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Erreur récupération historique articles:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération' });
    }

    res.json({ history: data || [] });

  } catch (error) {
    console.error('❌ Erreur endpoint history articles:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
