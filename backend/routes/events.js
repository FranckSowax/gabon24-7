/**
 * 🎉 ROUTES EVENTS (ÉVÉNEMENTS)
 * Endpoints pour la gestion des événements
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { supabase } = supabaseService;
const { fetchEvents } = require('../fetch-events');

// GET /api/events - Récupérer les événements actifs
router.get('/', async (req, res) => {
  try {
    const health = req.query.health;
    if (health) {
      return res.json({ success: true, ok: true });
    }

    console.log('🎉 Récupération des 5 événements les plus récents...');
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    res.json({
      success: true,
      events: events || [],
      count: events?.length || 0,
      total: events?.length || 0
    });
  } catch (error) {
    console.error('❌ Erreur récupération événements:', error);
    res.json({ success: false, events: [], error: error.message });
  }
});

// POST /api/events/sync - Synchroniser les événements
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Synchronisation des événements...');
    
    const result = await fetchEvents();
    
    res.json({
      success: true,
      message: 'Événements synchronisés',
      ...result
    });
  } catch (error) {
    console.error('❌ Erreur synchronisation événements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
