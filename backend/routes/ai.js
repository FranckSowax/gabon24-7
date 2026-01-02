const express = require('express');
const router = express.Router();
const { z } = require('zod');
const aiService = require('../services/ai-generator-service');
const geminiService = require('../services/gemini-service');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const supabaseService = require('../supabase-config');
const { processAIRequest, deductCredits } = require('../middleware/ai-validation');
const pricingService = require('../services/pricing-service');

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

const generateDocumentSchema = z.object({
  projectId: z.string().min(1, 'projectId requis'),
  userId: z.string().min(1, 'userId requis'),
  documentType: z.string().min(1, 'documentType requis').max(200),
  taskDescription: z.string().min(1, 'taskDescription requis').max(2000),
  stepTitle: z.string().max(500).optional().default(''),
  stepDescription: z.string().max(2000).optional().default(''),
  projectContext: z.object({
    titre: z.string().max(500).optional().default(''),
    secteur: z.string().max(200).optional().default(''),
    budget: z.string().max(200).optional().default(''),
    description: z.string().max(5000).optional().default(''),
    problematique: z.string().max(2000).optional().nullable(),
    contexte: z.string().max(5000).optional().nullable()
  }).optional().default({})
});

// ==================== ROUTES ====================

// POST /api/ai/generate-article - Générer un article sponsorisé
// 🔒 SÉCURISÉ: Authentification + validation des inputs + CRÉDITS
router.post('/generate-article', requireAuth, validateBody(generateArticleSchema), async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  const result = await processAIRequest('generate-article', userId, async () => {
    // Vérifier que l'API est configurée
    if (!aiService.isConfigured()) {
      throw new Error('Service IA non configuré');
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

    console.log(`🤖 Demande génération article: ${companyName}`);

    return await aiService.generateSponsoredArticle({
      title,
      subtitle,
      category,
      companyName,
      productService,
      targetAudience,
      keyMessage,
      callToAction
    });
  });

  if (!result.success) {
    const statusCode = result.requiresLogin ? 401 : result.requiresTopUp ? 402 : 500;
    return res.status(statusCode).json(result);
  }

  res.json({
    success: true,
    content: result.data.content,
    wordCount: result.data.wordCount,
    metadata: {
      model: result.data.model,
      usage: result.data.usage
    },
    creditsDeducted: result.creditsDeducted,
    remainingCredits: result.remainingCredits
  });
});

// POST /api/ai/generate-description - Générer une description de bannière
// 🔒 SÉCURISÉ: Authentification + validation des inputs + CRÉDITS
router.post('/generate-description', requireAuth, validateBody(generateDescriptionSchema), async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  const result = await processAIRequest('generate-description', userId, async () => {
    if (!aiService.isConfigured()) {
      throw new Error('Service IA non configuré');
    }

    const { companyName, productService, targetAudience } = req.body;
    return await aiService.generateBannerDescription({
      companyName,
      productService,
      targetAudience
    });
  });

  if (!result.success) {
    const statusCode = result.requiresLogin ? 401 : result.requiresTopUp ? 402 : 500;
    return res.status(statusCode).json(result);
  }

  res.json({
    success: true,
    description: result.data,
    creditsDeducted: result.creditsDeducted
  });
});

// POST /api/ai/generate-titles - Générer des suggestions de titres
// 🔒 SÉCURISÉ: Authentification + validation des inputs + CRÉDITS
router.post('/generate-titles', requireAuth, validateBody(generateTitlesSchema), async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  const result = await processAIRequest('generate-titles', userId, async () => {
    if (!aiService.isConfigured()) {
      throw new Error('Service IA non configuré');
    }

    const { companyName, productService, category } = req.body;
    return await aiService.generateTitleSuggestions({
      companyName,
      productService,
      category
    });
  });

  if (!result.success) {
    const statusCode = result.requiresLogin ? 401 : result.requiresTopUp ? 402 : 500;
    return res.status(statusCode).json(result);
  }

  res.json({
    success: true,
    titles: result.data,
    count: result.data.length,
    creditsDeducted: result.creditsDeducted
  });
});

// POST /api/ai/improve-text - Améliorer un texte
// 🔒 SÉCURISÉ: Authentification + validation des inputs + CRÉDITS
router.post('/improve-text', requireAuth, validateBody(improveTextSchema), async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  const result = await processAIRequest('improve-text', userId, async () => {
    if (!aiService.isConfigured()) {
      throw new Error('Service IA non configuré');
    }

    const { text, context } = req.body;
    return await aiService.improveText(text, context);
  });

  if (!result.success) {
    const statusCode = result.requiresLogin ? 401 : result.requiresTopUp ? 402 : 500;
    return res.status(statusCode).json(result);
  }

  res.json({
    success: true,
    original: req.body.text,
    improved: result.data,
    creditsDeducted: result.creditsDeducted
  });
});

// POST /api/ai/analyze-sentiment - Analyser le sentiment d'un texte
// 🔒 SÉCURISÉ: Authentification + validation des inputs + CRÉDITS
router.post('/analyze-sentiment', requireAuth, validateBody(analyzeTextSchema), async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  const result = await processAIRequest('analyze-text', userId, async () => {
    if (!aiService.isConfigured()) {
      throw new Error('Service IA non configuré');
    }

    const { text } = req.body;
    return await aiService.analyzeSentiment(text);
  });

  if (!result.success) {
    const statusCode = result.requiresLogin ? 401 : result.requiresTopUp ? 402 : 500;
    return res.status(statusCode).json(result);
  }

  res.json({
    success: true,
    analysis: result.data,
    creditsDeducted: result.creditsDeducted
  });
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

// POST /api/ai/generate-document - Générer un document adapté à une tâche
// 🔒 SÉCURISÉ: Authentification + validation des inputs + déduction de crédits
router.post('/generate-document', requireAuth, validateBody(generateDocumentSchema), async (req, res) => {
  try {
    const {
      projectId,
      userId,
      documentType,
      taskDescription,
      stepTitle,
      stepDescription,
      projectContext
    } = req.body;

    console.log(`📄 Génération document "${documentType}" pour projet ${projectId}`);

    // 1. Vérifier les crédits de l'utilisateur
    const { data: userData, error: userError } = await supabaseService.supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw new Error('Erreur lors de la vérification des crédits');
    }

    const currentCredits = userData?.credits || 0;
    if (currentCredits < DOCUMENT_CREDIT_COST) {
      return res.status(402).json({
        success: false,
        error: `Crédits insuffisants. Vous avez ${currentCredits} crédits, il en faut ${DOCUMENT_CREDIT_COST}.`
      });
    }

    // 2. Construire le prompt pour la génération du document
    const prompt = `Tu es un expert en rédaction de documents professionnels pour les entrepreneurs au Gabon.

CONTEXTE DU PROJET:
- Titre du projet: ${projectContext.titre || 'Non spécifié'}
- Secteur d'activité: ${projectContext.secteur || 'Non spécifié'}
- Budget prévu: ${projectContext.budget || 'Non spécifié'}
- Description: ${projectContext.description || 'Non spécifiée'}
${projectContext.problematique ? `- Problématique: ${projectContext.problematique}` : ''}
${projectContext.contexte ? `- Contexte additionnel: ${projectContext.contexte}` : ''}

ÉTAPE EN COURS:
- Titre de l'étape: ${stepTitle || 'Non spécifié'}
- Description: ${stepDescription || 'Non spécifiée'}

TÂCHE SPÉCIFIQUE:
${taskDescription}

TYPE DE DOCUMENT À GÉNÉRER: ${documentType}

MISSION: Génère un modèle de document "${documentType}" professionnel, complet et adapté au contexte gabonais.

INSTRUCTIONS:
1. Le document doit être directement utilisable avec des espaces à compléter pour les informations personnelles
2. Utilise un format professionnel avec en-têtes, sections claires
3. Adapte le ton et le contenu au contexte entrepreneurial gabonais
4. Inclus les formules de politesse appropriées
5. Fournis des exemples concrets quand c'est pertinent
6. Le document doit être en français

Génère le document complet en format Markdown avec une structure claire.`;

    // 3. Appeler l'IA pour générer le document
    const generatedContent = await geminiService.generateText(prompt, {
      systemPrompt: 'Tu es un expert en rédaction de documents professionnels pour entrepreneurs. Génère des documents complets, professionnels et adaptés au contexte africain francophone.',
      temperature: 0.7
    });

    if (!generatedContent) {
      throw new Error('Aucun contenu généré par l\'IA');
    }

    // 4. Créer le nom du fichier
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedDocType = documentType.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').substring(0, 50);
    const documentName = `${sanitizedDocType}_${timestamp}.md`;

    // 5. Sauvegarder le document dans Supabase Storage
    const filePath = `${userId}/${projectId}/documents/${documentName}`;
    const contentBuffer = Buffer.from(generatedContent, 'utf-8');

    const { error: uploadError } = await supabaseService.supabase.storage
      .from('action-plan-documents')
      .upload(filePath, contentBuffer, {
        contentType: 'text/markdown',
        upsert: false
      });

    if (uploadError) {
      console.error('Erreur upload document:', uploadError);
      throw new Error('Erreur lors de la sauvegarde du document');
    }

    // 6. Obtenir une URL signée pour le document
    const { data: urlData, error: urlError } = await supabaseService.supabase.storage
      .from('action-plan-documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 an

    if (urlError) {
      throw new Error('Erreur lors de la création du lien de téléchargement');
    }

    // 7. Enregistrer le document dans la bibliothèque (project_actions)
    await supabaseService.supabase
      .from('project_actions')
      .insert({
        project_id: projectId,
        user_id: userId,
        action_type: 'document-generated',
        action_status: 'completed',
        content: generatedContent.substring(0, 500) + '...', // Résumé
        metadata: {
          document_type: documentType,
          document_name: documentName,
          document_url: urlData.signedUrl,
          task_description: taskDescription,
          step_title: stepTitle,
          credits_used: DOCUMENT_CREDIT_COST
        }
      });

    // 8. Déduire les crédits
    if (userData) {
      await supabaseService.supabase
        .from('user_credits')
        .update({ credits: currentCredits - DOCUMENT_CREDIT_COST })
        .eq('user_id', userId);
    } else {
      // Créer l'entrée si elle n'existe pas
      await supabaseService.supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits: -DOCUMENT_CREDIT_COST
        });
    }

    // 9. Enregistrer la transaction de crédits
    await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -DOCUMENT_CREDIT_COST,
        type: 'usage',
        description: `Génération document: ${documentType}`,
        reference_id: projectId,
        reference_type: 'document_generation'
      });

    console.log(`✅ Document "${documentName}" généré avec succès (${DOCUMENT_CREDIT_COST} crédits)`);

    res.json({
      success: true,
      documentName,
      documentUrl: urlData.signedUrl,
      creditsUsed: DOCUMENT_CREDIT_COST,
      remainingCredits: currentCredits - DOCUMENT_CREDIT_COST
    });

  } catch (error) {
    console.error('❌ Erreur génération document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération du document'
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
