const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const GeminiRAGService = require('../services/gemini-rag.service');
const supabase = require('../supabase-config');

const ragService = new GeminiRAGService();
const STATE_FILE = path.join(__dirname, '../rag_sync_state.json');

// Status endpoint
router.get('/status', async (req, res) => {
    try {
        // Get last sync time from state file
        let lastSyncedAt = null;
        if (fs.existsSync(STATE_FILE)) {
            try {
                const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                lastSyncedAt = state.last_synced_at || null;
            } catch (e) {
                // File corrupted or invalid
            }
        }

        // Get articles count from Supabase (enriched articles with summary_ai)
        const { count: enrichedCount } = await supabase.supabase
            .from('articles')
            .select('*', { count: 'exact', head: true })
            .eq('is_published', true)
            .not('summary_ai', 'is', null);

        // Get total articles count
        const { count: totalCount } = await supabase.supabase
            .from('articles')
            .select('*', { count: 'exact', head: true })
            .eq('is_published', true);

        // Check Gemini API key
        const hasApiKey = !!process.env.GEMINI_API_KEY;

        // Check if store exists
        let storeStatus = 'unknown';
        try {
            const store = await ragService.findStore();
            storeStatus = store ? 'active' : 'inactive';
        } catch (e) {
            storeStatus = 'inactive';
        }

        res.json({
            success: true,
            lastSyncedAt,
            articlesCount: totalCount || 0,
            enrichedArticlesCount: enrichedCount || 0,
            storeStatus,
            geminiConfigured: hasApiKey
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const response = await ragService.chat(message, history || []);

    res.json({
      success: true,
      response: response.text,
      // sources: response.sources // To be implemented if we extract citations
    });

  } catch (error) {
    console.error('API Chat Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Force sync endpoint (admin only ideally)
router.post('/sync', async (req, res) => {
    try {
        const syncScript = require('../scripts/sync-articles-to-rag');
        // Run asynchronously
        syncScript().catch(err => console.error('Background sync error:', err));

        res.json({ success: true, message: 'Synchronisation démarrée en arrière-plan' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
