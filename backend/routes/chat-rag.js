const express = require('express');
const router = express.Router();
const GeminiRAGService = require('../services/gemini-rag.service');
const ragService = new GeminiRAGService();

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
