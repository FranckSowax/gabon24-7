const express = require('express');
const router = express.Router();
const { z } = require('zod');
const aiService = require('../services/ai-generator-service');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

// ==================== SCHÉMAS DE VALIDATION ====================

const generateArticleSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  companyName: z.string().min(1, 'companyName requis').max(100),
  productService: z.string().min(1, 'productService requis').max(200),
  targetAudience: z.string().max(500).optional().nullable(),
  keyMessage: z.string().max(500).optional().nullable(),
  callToAction: z.string().max(200).optional().nullable(),
});

const generateDescriptionSchema = z.object({
  companyName: z.string().min(1, 'companyName requis').max(100),
  productService: z.string().min(1, 'productService requis').max(200),
  targetAudience: z.string().max(500).optional().nullable(),
});

const generateTitlesSchema = z.object({
  companyName: z.string().min(1, 'companyName requis').max(100),
  productService: z.string().min(1, 'productService requis').max(200),
  category: z.string().max(50).optional().default('business'),
});

const improveTextSchema = z.object({
  text: z.string().min(1, 'text requis').max(10000),
  context: z.string().max(500).optional().nullable(),
});

const analyzeTextSchema = z.object({
  text: z.string().min(1, 'text requis').max(10000),
});

const regenerateDocSchema = z.object({
  prompt: z.string().min(1, 'prompt requis').max(5000),
});

// ==================== ROUTES ====================

// POST /api/ai/generate-article - Générer un article sponsorisé
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/generate-article', requireAuth, validateBody(generateArticleSchema), async (req, res) => {
  try {
    // Vérifier que l'API OpenAI est configurée
    if (!aiService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Service IA non configuré',
        message: 'La clé API OpenAI n\'est pas configurée'
      });
    }

    const {
      title,
      subtitle,
      category,
      companyName,
      productService,
      targetAudience,
      keyMessage,
      callToAction
    } = req.body;

    // Données déjà validées par Zod
    console.log(`🤖 Demande génération article: ${companyName}`);

    // Générer l'article
    const result = await aiService.generateSponsoredArticle({
      title,
      subtitle,
      category,
      companyName,
      productService,
      targetAudience,
      keyMessage,
      callToAction
    });

    res.json({
      success: true,
      content: result.content,
      wordCount: result.wordCount,
      metadata: {
        model: result.model,
        usage: result.usage
      }
    });

  } catch (error) {
    console.error('❌ Erreur génération article:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération',
      message: error.message
    });
  }
});

// POST /api/ai/generate-description - Générer une description de bannière
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/generate-description', requireAuth, validateBody(generateDescriptionSchema), async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: 'Service IA non configuré'
      });
    }

    const { companyName, productService, targetAudience } = req.body;

    const description = await aiService.generateBannerDescription({
      companyName,
      productService,
      targetAudience
    });

    res.json({
      success: true,
      description: description
    });

  } catch (error) {
    console.error('❌ Erreur génération description:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération',
      message: error.message
    });
  }
});

// POST /api/ai/generate-titles - Générer des suggestions de titres
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/generate-titles', requireAuth, validateBody(generateTitlesSchema), async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: 'Service IA non configuré'
      });
    }

    const { companyName, productService, category } = req.body;

    const titles = await aiService.generateTitleSuggestions({
      companyName,
      productService,
      category
    });

    res.json({
      success: true,
      titles: titles,
      count: titles.length
    });

  } catch (error) {
    console.error('❌ Erreur génération titres:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la génération',
      message: error.message
    });
  }
});

// POST /api/ai/improve-text - Améliorer un texte
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/improve-text', requireAuth, validateBody(improveTextSchema), async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: 'Service IA non configuré'
      });
    }

    const { text, context } = req.body;

    const improvedText = await aiService.improveText(text, context);

    res.json({
      success: true,
      original: text,
      improved: improvedText
    });

  } catch (error) {
    console.error('❌ Erreur amélioration texte:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'amélioration',
      message: error.message
    });
  }
});

// POST /api/ai/analyze-sentiment - Analyser le sentiment d'un texte
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/analyze-sentiment', requireAuth, validateBody(analyzeTextSchema), async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: 'Service IA non configuré'
      });
    }

    const { text } = req.body;

    const analysis = await aiService.analyzeSentiment(text);

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('❌ Erreur analyse sentiment:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'analyse',
      message: error.message
    });
  }
});

// POST /api/ai/regenerate-document - Régénérer un document
// 🔒 SÉCURISÉ: Authentification + validation des inputs
router.post('/regenerate-document', requireAuth, validateBody(regenerateDocSchema), async (req, res) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        error: 'Service IA non configuré'
      });
    }

    const { prompt } = req.body;

    console.log('🔄 Demande de régénération de document...');
    const content = await aiService.regenerateDocument(prompt);

    res.json({
      success: true,
      content: content
    });

  } catch (error) {
    console.error('❌ Erreur régénération document:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la régénération',
      message: error.message
    });
  }
});

// GET /api/ai/status - Vérifier le statut du service IA
router.get('/status', (req, res) => {
  const isConfigured = aiService.isConfigured();
  
  res.json({
    available: isConfigured,
    status: isConfigured ? 'ready' : 'not_configured',
    message: isConfigured 
      ? 'Service IA opérationnel' 
      : 'Clé API OpenAI non configurée'
  });
});

module.exports = router;
