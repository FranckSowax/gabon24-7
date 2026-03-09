const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const supabaseService = require('../supabase-config');
const aiConfigService = require('../services/ai-config-service');
const geminiService = require('../services/gemini-service');
const { trackAIUsage } = require('../utils/track-ai-usage');

// Instanciation conditionnelle de OpenAI GPT-4.1-mini
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn('⚠️ OPENAI_API_KEY non configurée - Routes action-plans désactivées');
}

/**
 * POST /api/action-plans/generate
 * Génère un plan d'action IA en 10 points à partir d'une proposition business
 */
router.post('/generate', async (req, res) => {
  try {
    // Vérifier si OpenAI est configuré
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'Service IA non disponible - OPENAI_API_KEY non configurée'
      });
    }

    const { userId, articleId, proposal, userContext } = req.body;

    if (!userId || !proposal) {
      return res.status(400).json({
        success: false,
        error: 'userId et proposal sont requis'
      });
    }

    // Construire le prompt pour l'IA
    const prompt = `Tu es un expert en entrepreneuriat au Gabon. Crée un plan d'action IMMÉDIAT et CONCRET en exactement 10 étapes pour cette opportunité business :

**Opportunité** : ${proposal.titre}
**Description** : ${proposal.description}
**Secteur** : ${proposal.secteur || 'Non spécifié'}
**Budget** : ${proposal.budget || 'Non spécifié'}
**Contexte utilisateur** : ${userContext?.situation || 'Non spécifié'}

IMPORTANT :
- Chaque action doit être CONCRÈTE, ACTIONABLE et MESURABLE
- Ordonne les actions par priorité logique (du plus urgent au moins urgent)
- Pour chaque action, précise une CATÉGORIE parmi : "Validation marché", "Finance", "Marketing", "Juridique", "Opérations", "Ressources Humaines"
- Précise une DURÉE ESTIMÉE réaliste (ex: "1-2 jours", "1 semaine", "2-3 semaines")
- Précise une PRIORITÉ parmi : "urgent", "high", "medium", "low"

Réponds UNIQUEMENT avec un JSON valide au format suivant (pas de markdown, pas d'explication) :
{
  "title": "Plan d'Action : [Titre court]",
  "description": "Description en 1 phrase",
  "actions": [
    {
      "title": "Action 1",
      "description": "Description détaillée de l'action",
      "category": "Validation marché",
      "priority": "urgent",
      "estimated_duration": "1-2 jours"
    },
    ...
  ]
}`;

    // Récupérer le modèle configuré pour action_plan
    const configuredModel = await aiConfigService.getModel('action_plan');
    const provider = aiConfigService.getProvider(configuredModel);
    
    console.log(`📋 Génération du plan d'action via ${provider} (${configuredModel})...`);

    let actionPlanData;
    
    try {
      if (provider === 'gemini' && geminiService.apiKey) {
        // Utiliser Gemini
        actionPlanData = await geminiService.generateJSON(prompt, {
          systemPrompt: 'Tu es un expert en entrepreneuriat gabonais. Tu génères des plans d\'action concrets et actionnables. Tu réponds UNIQUEMENT en JSON valide, sans markdown.',
          temperature: 0.7
        });
      } else if (openai) {
        // Utiliser OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en entrepreneuriat gabonais. Tu génères des plans d\'action concrets et actionnables. Tu réponds UNIQUEMENT en JSON valide, sans markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        const content = completion.choices[0].message.content.trim();
        // Nettoyer les blocs markdown ```json ... ```
        let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        try {
          actionPlanData = JSON.parse(cleanContent);
        } catch {
          // Fallback: extraire le JSON enfoui dans du texte
          const jsonMatch = cleanContent.match(/\{[\s\S]*"actions"[\s\S]*\}/);
          if (jsonMatch) {
            actionPlanData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Impossible de parser le JSON du plan d\'action');
          }
        }
      } else {
        throw new Error('Aucun service IA disponible');
      }
    } catch (err) {
      console.error('❌ Erreur génération/parsing IA:', err);
      throw new Error('Echec de la génération du plan d\'action: ' + err.message);
    }

    if (!actionPlanData.actions || actionPlanData.actions.length !== 10) {
      throw new Error('Le plan doit contenir exactement 10 actions');
    }

    // Créer le plan dans Supabase
    const { data: plan, error: planError } = await supabaseService.supabase
      .from('action_plans')
      .insert({
        user_id: userId,
        article_id: articleId,
        title: actionPlanData.title,
        description: actionPlanData.description,
        proposal_context: proposal,
        total_items: 10,
        completed_items: 0,
        progress_percentage: 0,
        status: 'in_progress'
      })
      .select()
      .single();

    if (planError) throw planError;

    // Créer les 10 actions
    const actionItems = actionPlanData.actions.map((action, index) => ({
      plan_id: plan.id,
      order_index: index + 1,
      title: action.title,
      description: action.description,
      category: action.category,
      priority: action.priority || 'medium',
      estimated_duration: action.estimated_duration,
      is_completed: false
    }));

    const { data: items, error: itemsError } = await supabaseService.supabase
      .from('action_items')
      .insert(actionItems)
      .select();

    if (itemsError) throw itemsError;

    console.log('✅ Plan d\'action créé avec succès:', plan.id);

    // Track AI usage
    await trackAIUsage({
      userId: userId || null,
      serviceName: 'generate-action-plan',
      description: `Plan d'action: ${proposal.titre || 'N/A'}`,
      creditsUsed: 0,
      model: provider === 'gemini' ? 'gemini-3-pro' : 'gpt-4.1-mini',
      metadata: { planId: plan.id, provider, sector: proposal.secteur, budget: proposal.budget }
    });

    res.json({
      success: true,
      plan: {
        ...plan,
        items
      }
    });

  } catch (error) {
    console.error('❌ Erreur génération plan d\'action:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération du plan d\'action'
    });
  }
});

/**
 * GET /api/action-plans
 * Récupère tous les plans d'action d'un utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: plans, error } = await supabaseService.supabase
      .from('action_plans')
      .select(`
        *,
        items:action_items(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      plans: plans || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération plans:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des plans'
    });
  }
});

/**
 * GET /api/action-plans/:id
 * Récupère un plan d'action spécifique avec tous ses détails
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: plan, error } = await supabaseService.supabase
      .from('action_plans')
      .select(`
        *,
        items:action_items(
          *,
          comments:action_item_comments(*),
          attachments:action_item_attachments(*)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      plan
    });

  } catch (error) {
    console.error('❌ Erreur récupération plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du plan'
    });
  }
});

/**
 * PUT /api/action-plans/:id/items/:itemId/toggle
 * Marque une action comme complétée/non complétée
 */
router.put('/:id/items/:itemId/toggle', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    // Récupérer l'état actuel
    const { data: item, error: getError } = await supabaseService.supabase
      .from('action_items')
      .select('is_completed')
      .eq('id', itemId)
      .single();

    if (getError) throw getError;

    // Inverser l'état
    const newState = !item.is_completed;
    
    const { data: updatedItem, error } = await supabaseService.supabase
      .from('action_items')
      .update({
        is_completed: newState,
        completed_at: newState ? new Date().toISOString() : null
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      item: updatedItem
    });

  } catch (error) {
    console.error('❌ Erreur toggle item:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de l\'action'
    });
  }
});

/**
 * POST /api/action-plans/:id/items/:itemId/comments
 * Ajoute un commentaire à une action
 */
router.post('/:id/items/:itemId/comments', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId, content } = req.body;

    if (!userId || !content) {
      return res.status(400).json({
        success: false,
        error: 'userId et content sont requis'
      });
    }

    const { data: comment, error } = await supabaseService.supabase
      .from('action_item_comments')
      .insert({
        item_id: itemId,
        user_id: userId,
        content
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('❌ Erreur ajout commentaire:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout du commentaire'
    });
  }
});

/**
 * POST /api/action-plans/:id/items/:itemId/attachments
 * Ajoute une pièce jointe à une action
 */
router.post('/:id/items/:itemId/attachments', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId, fileName, fileUrl, fileType, fileSize } = req.body;

    if (!userId || !fileName || !fileUrl) {
      return res.status(400).json({
        success: false,
        error: 'userId, fileName et fileUrl sont requis'
      });
    }

    const { data: attachment, error } = await supabaseService.supabase
      .from('action_item_attachments')
      .insert({
        item_id: itemId,
        user_id: userId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      attachment
    });

  } catch (error) {
    console.error('❌ Erreur ajout pièce jointe:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout de la pièce jointe'
    });
  }
});

/**
 * DELETE /api/action-plans/:id
 * Supprime un plan d'action
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { error } = await supabaseService.supabase
      .from('action_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true
    });

  } catch (error) {
    console.error('❌ Erreur suppression plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du plan'
    });
  }
});

module.exports = router;
