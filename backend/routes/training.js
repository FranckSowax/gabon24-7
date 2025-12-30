const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const geminiService = require('../services/gemini-service');

// Service Gemini 3 Pro centralisé
// Rapide et économique

// Fonction pour générer le prompt de formation
function generateTrainingPrompt(userAnalysis = {}, article = {}, sectorResults = {}) {
  const selProps = Array.isArray(sectorResults.selectedPropositions) && sectorResults.selectedPropositions.length > 0
    ? sectorResults.selectedPropositions
    : (sectorResults.propositions || []);

  const title = article?.title || "Projet";
  const offer = Array.isArray(selProps) && selProps.length ? selProps.join(', ') : (sectorResults.offer || sectorResults.title || sectorResults?.nom || "");
  const audience = sectorResults.targetAudience || sectorResults.client_cible || '';
  const revenueModel = sectorResults.revenueModel || sectorResults.modele_revenu || '';
  const localInsights = sectorResults.localInsights || '';

  const budget = userAnalysis.budget || userAnalysis.budget_principal || userAnalysis.budgetRange || '';
  const currentSkills = userAnalysis.currentSkills || userAnalysis.competences_actuelles || '';
  const launchDeadline = userAnalysis.launchDeadline || userAnalysis.delai_lancement || '';
  const weeklyAvailability = userAnalysis.weeklyAvailability || userAnalysis.disponibilite_apprenant_optionnelle || '';

  return `Act like un concepteur pédagogique et chef de projet go-to-market (focus Gabon), spécialisé en lancements rapides.

OBJECTIF
Générer un sommaire court et exhaustif des compétences à acquérir pour lancer une proposition de business donnée, avec des durées de formation directement dérivées de la variable délai_lancement fournie par l'utilisateur.

ENTRÉES
<PROPOSITION>
titre=${title}
offre=${offer}
client_cible=${audience}
modele_revenu=${revenueModel}
</PROPOSITION>

<CONTRAINTES_USER>
budget=${budget}
competences_actuelles=${currentSkills}
delai_lancement=${launchDeadline}
disponibilite_apprenant_optionnelle=${weeklyAvailability || 'Non spécifié'}
</CONTRAINTES_USER>

<CONTEXTE_GABON_OPTIONNEL>
points_locaux=${localInsights}
</CONTEXTE_GABON_OPTIONNEL>

ÉTAPES
1) Identifier le secteur et la complexité du projet.
2) Lister les compétences indispensables au lancement (8–12 max).
3) Croiser avec budget, compétences_actuelles et contexte gabonais.
4) Prioriser chaque compétence (Haute/Moyenne/Basse) + niveau requis (Débutant/Intermédiaire).
5) Calculer une durée indicative par compétence (heures/jours) proportionnelle à la priorité et à l'écart de compétence.
   • Contraintes: la somme des durées de formation doit entrer dans le delai_lancement et conserver une marge pour l'exécution.
6) Ajuster selon disponibilite_apprenant_optionnelle si fournie.
7) S'il manque des infos, formuler "Hypothèse: …".

FORMAT DE SORTIE (JSON strict)
{
  "title": "Sommaire des compétences — [Nom du projet]",
  "modules": [
    {
      "id": 1,
      "competence": "Nom compétence",
      "objective": "objectif opérationnel concret",
      "priority": "Haute|Moyenne|Basse",
      "level": "Débutant|Intermédiaire",
      "duration": "X heures" ou "X jours",
      "duration_numeric": nombre_heures
    }
  ],
  "total_formation": "X heures total",
  "execution_margin": "Y jours conservés pour exécution",
  "gabon_specifics": "Points spécifiques au contexte gabonais"
}

RÈGLES DE STYLE
• Français clair, pédagogique, friendly & pro.
• Couvre "jour 0–90".
• Priorisation et durées cohérentes avec delai_lancement, budget et compétences_actuelles.
• Ancrage Gabon explicite quand pertinent.

Take a deep breath and work on this problem step-by-step.`;
}

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }
  }
  return null;
}

function calculatePricing(modules = []) {
  const PRICING = {
    training_costs: {
      module_unit: 2,
      full_discount: 0.7
    }
  };
  const moduleCount = Array.isArray(modules) ? modules.length : 0;
  const modulePrice = moduleCount * PRICING.training_costs.module_unit;
  const fullPrice = Math.floor(modulePrice * PRICING.training_costs.full_discount);
  return {
    per_module: PRICING.training_costs.module_unit,
    total_modules: modulePrice,
    full_training: fullPrice,
    savings: modulePrice - fullPrice
  };
}

// POST /api/training/generate - Générer une formation sur mesure avec Replicate nano-gpt
router.post('/generate', async (req, res) => {
  try {
    const { userAnalysis = {}, article = {}, sectorResults = {}, userId = null, articleId = null } = req.body || {};

    console.log('🎓 Génération formation pour:', sectorResults?.selectedPropositions?.[0] || article?.title);

    // ⚠️ CREDITS DÉSACTIVÉS PENDANT LE DÉVELOPPEMENT
    const CREDITS_ENABLED = false;

    const prompt = generateTrainingPrompt(userAnalysis, article, sectorResults);

    console.log('📡 Appel Gemini 3 Pro...');

    // Utiliser Gemini 3 Pro
    let parsed;
    try {
      // Mode JSON strict
      parsed = await geminiService.generateJSON(prompt, {
        systemPrompt: 'Tu es un expert en ingénierie pédagogique. Réponds UNIQUEMENT avec le JSON demandé, sans texte avant ni après.',
        temperature: 0.7
      });
      
      console.log('✅ Gemini 3 Pro OK');
    } catch (geminiError) {
      console.error('❌ Erreur Gemini:', geminiError);
      return res.status(502).json({ 
        success: false,
        error: 'Erreur Gemini API',
        message: geminiError.message
      });
    }

    if (!parsed || !parsed.modules) {
      console.error('❌ Format de réponse AI invalide');
      return res.status(502).json({ 
        success: false,
        error: 'Format de réponse AI invalide', 
        raw: JSON.stringify(parsed)
      });
    }

    const pricing = calculatePricing(parsed.modules);
    const moduleCount = Array.isArray(parsed.modules) ? parsed.modules.length : 0;
    const baseTitle = (Array.isArray(sectorResults?.selectedPropositions) && sectorResults.selectedPropositions[0])
      || article?.title
      || 'Projet';

    const deadlineRaw = userAnalysis?.launchDeadline || userAnalysis?.delai_lancement || '';
    const prettyDeadline = ({
      '1_mois': '1 mois',
      '3_mois': '3 mois',
      '6_mois': '6 mois',
      '1_an': '1 an'
    })[deadlineRaw] || (deadlineRaw || '').replace(/_/g, ' ');
    const titleSuffix = prettyDeadline ? ` (${moduleCount} modules • délai ${prettyDeadline})` : ` (${moduleCount} modules)`;
    const finalTitle = `Sommaire de la formation — ${baseTitle}${titleSuffix}`;

    const payload = {
      success: true,
      training: {
        title: finalTitle,
        modules: parsed.modules,
        total_duration: parsed.total_formation || null,
        execution_margin: parsed.execution_margin || null,
        gabon_specifics: parsed.gabon_specifics || null,
        pricing
      }
    };

    console.log('✅ Formation générée:', moduleCount, 'modules');

    // Persister dans Supabase
    let savedTrainingId = null;
    
    try {
      const insertBody = {
        user_id: userId || null,
        article_id: articleId || null,
        user_analysis: userAnalysis || {},
        article_context: {
          title: article?.title || null,
          summary: article?.summary || null,
          source: article?.source || null,
          url: article?.url || null
        },
        sector_results: sectorResults || {},
        training_title: payload.training.title,
        modules: payload.training.modules,
        total_duration: payload.training.total_duration,
        execution_margin: payload.training.execution_margin,
        price_per_module: payload.training.pricing?.per_module ?? null,
        price_total: payload.training.pricing?.full_training ?? null,
        status: 'generated'
      };
      
      console.log('💾 Sauvegarde formation dans Supabase...');
      
      const { data: row, error: insErr } = await supabaseService.supabase
        .from('ai_trainings')
        .insert(insertBody)
        .select('id')
        .single();
      
      if (insErr) {
        console.error('❌ Erreur sauvegarde Supabase:', insErr.message);
      } else if (row?.id) {
        savedTrainingId = row.id;
        console.log('✅ Formation sauvegardée, ID:', savedTrainingId);
        
        // 🔔 NOTIFICATION EN TEMPS RÉEL
        try {
          const notificationHelper = require('../utils/notificationHelper');
          await notificationHelper.notifyTrainingGenerated(
            userId,
            projectId,
            savedTrainingId,
            finalTitle
          );
          console.log('✅ Notification formation envoyée');
        } catch (notifError) {
          console.warn('⚠️ Erreur notification:', notifError.message);
        }
      }
    } catch (persistErr) {
      console.error('❌ Exception sauvegarde formation:', persistErr);
    }
    
    // TOUJOURS retourner un trainingId (soit depuis DB, soit généré temporairement)
    if (savedTrainingId) {
      payload.trainingId = savedTrainingId;
    } else {
      // Si la sauvegarde échoue, générer un ID temporaire unique
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload.trainingId = tempId;
      console.warn('⚠️ Utilisation ID temporaire:', tempId);
    }

    res.json(payload);

  } catch (error) {
    console.error('❌ Erreur generate training:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

// GET /api/training/:training_id - Récupérer le sommaire d'une formation
router.get('/:training_id', async (req, res) => {
  try {
    const { training_id } = req.params;

    console.log('📖 Récupération formation ID:', training_id);

    // Récupérer la formation depuis Supabase
    const { data: training, error } = await supabaseService.supabase
      .from('ai_trainings')
      .select('*')
      .eq('id', training_id)
      .single();

    if (error || !training) {
      console.error('❌ Formation non trouvée:', error?.message);
      return res.status(404).json({
        success: false,
        error: 'Formation non trouvée'
      });
    }

    console.log('✅ Formation trouvée:', training.training_title);

    // Retourner uniquement le sommaire (pas le contenu détaillé)
    const response = {
      success: true,
      training: {
        id: training.id,
        title: training.training_title,
        modules: training.modules || [],
        total_duration: training.total_duration,
        execution_margin: training.execution_margin,
        gabon_specifics: training.gabon_specifics,
        pricing: {
          per_module: training.price_per_module,
          full_training: training.price_total
        },
        user_analysis: training.user_analysis,
        article_context: training.article_context,
        sector_results: training.sector_results
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur get training:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

// POST /api/training/:training_id/generate-module - Générer le contenu détaillé d'un module
router.post('/:training_id/generate-module', async (req, res) => {
  try {
    const { training_id } = req.params;
    const { moduleId, trainingData } = req.body;

    console.log(`🎓 Génération module ${moduleId} pour formation ${training_id}`);

    let training = null;

    // Si l'ID est temporaire, utiliser les données fournies dans le body
    if (training_id.startsWith('temp_') && trainingData) {
      console.log('💾 Utilisation données formation depuis body (ID temporaire)');
      training = {
        training_title: trainingData.title,
        modules: trainingData.modules,
        article_context: {},
        user_analysis: {},
        sector_results: {}
      };
    } else {
      // Sinon, récupérer depuis la DB
      const { data, error } = await supabaseService.supabase
        .from('ai_trainings')
        .select('*')
        .eq('id', training_id)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'Formation non trouvée'
        });
      }
      training = data;
    }

    // Trouver le module dans le sommaire
    const module = training.modules?.find(m => m.id === moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module non trouvé'
      });
    }

    // Construire le prompt pour générer le contenu détaillé du module
    const prompt = `Tu es un expert en formation professionnelle et pédagogie.

CONTEXTE DE LA FORMATION
Titre: ${training.training_title}
Projet: ${training.article_context?.title || 'Non spécifié'}
Public cible: ${training.sector_results?.targetAudience || training.sector_results?.client_cible || 'Entrepreneurs'}
Budget: ${training.user_analysis?.budget || 'Non spécifié'}
Délai: ${training.user_analysis?.launchDeadline || training.user_analysis?.delai_lancement || 'Non spécifié'}

MODULE À DÉVELOPPER
Compétence: ${module.competence}
Objectif: ${module.objective}
Priorité: ${module.priority}
Niveau: ${module.level}
Durée: ${module.duration}

MISSION
Génère un contenu de formation COMPLET et ACTIONNABLE pour ce module, adapté au contexte gabonais.

STRUCTURE ATTENDUE (JSON strict):
{
  "module_title": "${module.competence}",
  "introduction": "Paragraphe d'introduction engageant (2-3 phrases)",
  "learning_objectives": [
    "Objectif 1 mesurable",
    "Objectif 2 mesurable",
    "Objectif 3 mesurable"
  ],
  "content_sections": [
    {
      "section_title": "Titre de section",
      "content": "Contenu détaillé avec explications, exemples concrets adaptés au Gabon",
      "key_points": ["Point clé 1", "Point clé 2", "Point clé 3"]
    }
  ],
  "practical_exercises": [
    {
      "title": "Titre exercice",
      "description": "Description détaillée",
      "duration": "X minutes",
      "deliverable": "Ce que l'apprenant doit produire"
    }
  ],
  "resources": [
    {
      "type": "article|video|tool|template",
      "title": "Titre ressource",
      "description": "Description courte",
      "url": "URL si disponible (sinon null)"
    }
  ],
  "gabon_context": "Adaptations et spécificités pour le contexte gabonais",
  "success_criteria": [
    "Critère de réussite 1",
    "Critère de réussite 2"
  ],
  "next_steps": "Ce que l'apprenant doit faire après ce module"
}

RÈGLES
• Contenu en français, clair et actionnable
• Exemples concrets adaptés au Gabon (marchés locaux, réglementations, culture)
• Exercices pratiques réalisables immédiatement
• Ressources accessibles et pertinentes
• Ton professionnel mais friendly
• Focus sur l'application pratique

Take a deep breath and work on this problem step-by-step.`;

    // Stratégie: Gemini 3 Pro
    let parsed;
    let modelUsed = 'gemini-3-pro';
    
    try {
      console.log('📡 Appel Gemini 3 Pro (Contenu Module)...');
      
      parsed = await geminiService.generateJSON(prompt, {
        systemPrompt: 'Tu es un expert en formation professionnelle. Génère un contenu pédagogique structuré en JSON valide.',
        temperature: 0.7
      });
      
      console.log('✅ Gemini 3: Génération réussie');
      
    } catch (geminiError) {
      console.error('❌ Erreur Gemini:', geminiError.message);
      return res.status(502).json({ 
        success: false,
        error: 'Erreur Gemini API',
        details: geminiError.message
      });
    }
    
    if (!parsed || !parsed.content_sections) {
      console.error('❌ Format de réponse AI invalide');
      console.error('🔧 Objet parsé:', JSON.stringify(parsed, null, 2));
      
      return res.status(502).json({ 
        success: false,
        error: 'Format de réponse AI invalide', 
        message: 'Le modèle AI n\'a pas retourné le format JSON attendu',
        debug: {
          parsed: parsed
        }
      });
    }

    console.log('✅ Module généré:', parsed.module_title);

    res.json({
      success: true,
      module: {
        id: moduleId,
        ...module,
        detailed_content: parsed
      }
    });

  } catch (error) {
    console.error('❌ Erreur generate module:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

module.exports = router;
