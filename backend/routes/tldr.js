/**
 * 📝 TL;DR - Résumé intelligent en 3 points
 * Utilise Gemini pour générer un résumé concis
 * GRATUIT - Pas de crédits requis
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini-service');
const { trackAIUsage } = require('../utils/track-ai-usage');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMA DE VALIDATION (.passthrough) ====================
const tldrSchema = z.object({
  title: z.string().max(1000).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  summary: z.string().max(100000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
}).passthrough();

// POST /api/tldr - Générer un résumé TL;DR (GRATUIT)
router.post('/', validateBody(tldrSchema), async (req, res) => {
  try {
    const { title, content, summary, url } = req.body;

    if (!title || (!content && !summary)) {
      return res.status(400).json({
        success: false,
        error: 'Titre et contenu/résumé requis'
      });
    }

    console.log(`📝 [TL;DR] Génération GRATUITE pour: "${title.substring(0, 50)}..."`);

    // Texte à résumer (priorité au contenu complet)
    const textToSummarize = content || summary;

    // Prompt optimisé pour Gemini
    const prompt = `Tu es un assistant expert en synthèse d'actualités gabonaises et africaines.

ARTICLE À RÉSUMER:
Titre: ${title}
Contenu: ${textToSummarize}

INSTRUCTIONS:
- Génère exactement 3 points clés de cet article
- Chaque point doit être une phrase courte et percutante (max 15 mots)
- Utilise des verbes d'action au présent
- Concentre-toi sur les faits essentiels: QUI, QUOI, QUAND, OÙ
- Pas de phrases d'introduction, juste les 3 points

FORMAT DE RÉPONSE (JSON strict):
{
  "points": [
    "Premier point clé",
    "Deuxième point clé", 
    "Troisième point clé"
  ]
}`;

    const systemPrompt = `Tu es un journaliste gabonais expert en synthèse. Tu réponds UNIQUEMENT en JSON valide, sans markdown ni texte supplémentaire.`;

    // Appel à Gemini
    const tldrData = await geminiService.generateJSON(prompt, {
      systemPrompt,
      temperature: 0.3 // Plus déterministe pour des résumés cohérents
    });

    if (!tldrData.points || !Array.isArray(tldrData.points) || tldrData.points.length < 3) {
      throw new Error('Format de réponse incorrect');
    }

    console.log(`✅ [TL;DR] Résumé généré avec succès: ${tldrData.points.length} points`);

    // Track AI usage (gratuit mais on trace l'utilisation)
    await trackAIUsage({
      userId: req.body?.userId || null,
      serviceName: 'tldr',
      description: `TL;DR: ${title.substring(0, 50)}`,
      creditsUsed: 0,
      model: 'gemini-3-pro',
      metadata: { articleTitle: title, url: url || null }
    });

    res.json({
      success: true,
      tldr: {
        points: tldrData.points.slice(0, 3), // Garantir max 3 points
        generatedAt: new Date().toISOString(),
        articleTitle: title
      }
    });

  } catch (error) {
    console.error('❌ [TL;DR] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération du résumé'
    });
  }
});

module.exports = router;
