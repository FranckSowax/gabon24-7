/**
 * 🎉 ROUTES EVENTS (ÉVÉNEMENTS)
 * Endpoints pour la gestion des événements
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { supabase } = supabaseService;
const { fetchEvents } = require('../fetch-events');

// GET /api/events - Récupérer les événements à venir avec images
router.get('/', async (req, res) => {
  try {
    const health = req.query.health;
    if (health) {
      return res.json({ success: true, ok: true });
    }

    // Date actuelle (Gabon = UTC+1)
    const now = new Date();
    const gabonNow = new Date(now.getTime() + (1 * 60 * 60 * 1000));
    const todayStr = gabonNow.toISOString().split('T')[0]; // "2025-12-30"

    console.log(`🎉 Récupération des événements à venir (après ${todayStr})...`);

    // Récupérer les événements futurs avec image
    const { data: futureEvents, error: futureError } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .gte('event_date', todayStr)
      .order('event_date', { ascending: true })
      .limit(10);

    if (futureError) throw futureError;

    // Si pas assez d'événements futurs, compléter avec les événements récents (max 3 jours passés)
    let events = futureEvents || [];

    if (events.length < 5) {
      const threeDaysAgo = new Date(gabonNow);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const { data: recentEvents, error: recentError } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .gte('event_date', threeDaysAgoStr)
        .lt('event_date', todayStr)
        .order('event_date', { ascending: false })
        .limit(5 - events.length);

      if (!recentError && recentEvents) {
        events = [...events, ...recentEvents];
      }
    }

    // Si toujours pas assez, prendre les événements avec image (peu importe la date)
    if (events.length < 3) {
      console.log('⚠️ Pas assez d\'événements récents, récupération des derniers avec image...');

      const existingIds = events.map(e => e.id);

      let query = supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: anyEvents, error: anyError } = await query;

      if (!anyError && anyEvents) {
        // Filtrer manuellement les IDs déjà présents
        const filteredEvents = anyEvents.filter(e => !existingIds.includes(e.id));
        events = [...events, ...filteredEvents.slice(0, 5 - events.length)];
      }
    }

    console.log(`✅ ${events.length} événements trouvés (avec images)`);

    res.json({
      success: true,
      events: events.slice(0, 5),
      count: Math.min(events.length, 5),
      total: events.length
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
