/**
 * Routes SLIDES (Promotional Slides)
 * Endpoints pour la gestion des slides promotionnelles
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { supabase } = supabaseService;

// GET /api/slides - Récupérer les slides actives
router.get('/', async (req, res) => {
  try {
    const health = req.query.health;
    if (health) {
      return res.json({ success: true, ok: true });
    }

    console.log('📢 Récupération des slides...');
    const { data: slides, error } = await supabase
      .from('promotional_slides')
      .select('id, title, description, image_url, image_url_banner, image_url_mobile, link_url, cta_text, company_name, display_order, slide_type, html_content')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      slides: slides || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération slides:', error);
    res.json({ success: false, slides: [], error: error.message });
  }
});

// POST /api/slides - Tracker les actions sur les slides (view, click, impression)
router.post('/', async (req, res) => {
  try {
    const { slideId, action } = req.body;

    if (!slideId || !action) {
      return res.status(400).json({ success: false, error: 'slideId et action requis' });
    }

    if (action === 'view') {
      const { error } = await supabase.rpc('increment_slide_views', { slide_uuid: slideId });
      if (error) throw error;
      console.log('✅ [VIEW] Slide:', slideId);
    } else if (action === 'click') {
      const { error } = await supabase.rpc('increment_slide_clicks', { slide_uuid: slideId });
      if (error) throw error;
      console.log('✅ [CLICK] Slide:', slideId);
    } else if (action === 'impression') {
      const { error } = await supabase.rpc('increment_slide_impressions', { slide_uuid: slideId });
      if (error) throw error;
      console.log('✅ [IMPRESSION] Slide:', slideId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erreur tracking slide:', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
