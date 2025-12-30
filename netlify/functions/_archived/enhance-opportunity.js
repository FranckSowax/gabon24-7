/**
 * Fonction Netlify pour l'enrichissement des opportunités
 * Utilise MCP Brave Search et DeepWiki
 * Gabon 24/7 - Module Opportunités IA Enrichi
 */

const { OpportunityEnricher } = require('./lib/opportunity-enricher');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📨 Enhance opportunity request received');
    const requestData = JSON.parse(event.body);
    console.log('📋 Request data:', { 
      opportunityId: requestData.opportunityId,
      enrichmentLevel: requestData.enrichmentLevel,
      userId: requestData.userId 
    });

    // Validation des paramètres requis
    if (!requestData.opportunityId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'opportunityId is required',
          details: 'Vous devez fournir l\'ID de l\'opportunité à enrichir'
        })
      };
    }

    const { 
      opportunityId, 
      enrichmentLevel = 'basic',
      userId = null,
      forceRefresh = false 
    } = requestData;

    console.log(`🔍 Enrichissement ${enrichmentLevel} pour opportunité ${opportunityId}`);

    // Vérifier si l'enrichissement existe déjà (sauf si forceRefresh)
    if (!forceRefresh) {
      const existingEnrichment = await checkExistingEnrichment(opportunityId, enrichmentLevel);
      if (existingEnrichment) {
        console.log('📋 Enrichissement existant trouvé en cache');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ...existingEnrichment,
            cached: true,
            timestamp: new Date().toISOString()
          })
        };
      }
    }

    // Récupérer l'opportunité depuis la base de données
    const { data: opportunity, error: fetchError } = await supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (fetchError || !opportunity) {
      console.error('❌ Opportunité non trouvée:', fetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Opportunity not found',
          details: `Aucune opportunité trouvée avec l'ID ${opportunityId}`
        })
      };
    }

    console.log('✅ Opportunité récupérée:', opportunity.opportunity_title);

    // Vérification des crédits pour l'enrichissement premium
    if (enrichmentLevel === 'premium' && userId) {
      const creditCheck = await checkUserCredits(userId, 5); // 5 crédits pour premium
      if (!creditCheck.hasCredits) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: 'Insufficient credits',
            details: 'Crédits insuffisants pour l\'enrichissement premium',
            required_credits: 5,
            current_balance: creditCheck.balance,
            upgrade_url: '/pricing'
          })
        };
      }
    }

    // Initialiser l'enrichisseur
    const enricher = new OpportunityEnricher();

    // Préparer les données d'opportunité pour l'enrichissement
    const opportunityData = {
      id: opportunity.id,
      title: opportunity.opportunity_title,
      description: opportunity.opportunity_description,
      location: extractLocationFromOpportunity(opportunity),
      sector: opportunity.category || 'Services Généraux'
    };

    console.log('🚀 Démarrage enrichissement...');

    // Effectuer l'enrichissement
    const enrichmentResult = await enricher.enrichOpportunity(opportunityData, enrichmentLevel);

    console.log('✅ Enrichissement terminé, sauvegarde...');

    // Sauvegarder l'enrichissement dans la base de données
    const saveResult = await saveEnrichmentToDatabase(opportunity.id, enrichmentResult, enrichmentLevel);
    
    if (!saveResult.success) {
      console.error('⚠️ Erreur sauvegarde:', saveResult.error);
      // Continuer même si la sauvegarde échoue
    }

    // Consommer les crédits si enrichissement premium réussi
    if (enrichmentLevel === 'premium' && userId) {
      await consumeUserCredits(userId, 5, 'enhance-opportunity', opportunity.id);
    }

    // Préparer la réponse
    const response = {
      opportunity_id: opportunity.id,
      enrichment_level: enrichmentLevel,
      enrichment_status: 'completed',
      ...enrichmentResult,
      timestamp: new Date().toISOString(),
      cached: false
    };

    console.log(`🎉 Enrichissement ${enrichmentLevel} complété avec succès`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Erreur enrichissement:', error);

    // Réponse d'erreur avec enrichissement minimal
    const fallbackResponse = {
      opportunity_id: requestData?.opportunityId || 'unknown',
      enrichment_level: 'minimal',
      enrichment_status: 'failed',
      error: error.message,
      factual_data: { message: 'Données non disponibles actuellement' },
      market_research: { message: 'Analyse de marché non disponible' },
      competitor_analysis: { message: 'Analyse concurrentielle non disponible' },
      regulatory_info: { message: 'Informations réglementaires non disponibles' },
      confidence_score: 0,
      data_sources: [],
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(fallbackResponse)
    };
  }
};

/**
 * Vérifier l'enrichissement existant
 */
async function checkExistingEnrichment(opportunityId, enrichmentLevel) {
  try {
    const { data, error } = await supabase
      .from('opportunity_analyses')
      .select('enrichment_data, enrichment_completed_at, confidence_score')
      .eq('id', opportunityId)
      .eq('enrichment_level', enrichmentLevel)
      .eq('enrichment_status', 'completed')
      .gt('enrichment_completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Pas plus de 7 jours
      .single();

    if (data && data.enrichment_data) {
      console.log('📋 Enrichissement existant valide trouvé');
      return {
        ...data.enrichment_data,
        enrichment_level: enrichmentLevel,
        confidence_score: data.confidence_score,
        last_updated: data.enrichment_completed_at
      };
    }
  } catch (error) {
    console.log('ℹ️ Aucun enrichissement existant trouvé');
  }

  return null;
}

/**
 * Vérification des crédits utilisateur
 */
async function checkUserCredits(userId, requiredCredits) {
  try {
    const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/credit-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkBalance',
        userId: userId
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        hasCredits: data.balance >= requiredCredits,
        balance: data.balance
      };
    }
  } catch (error) {
    console.error('Erreur vérification crédits:', error);
  }

  // Par défaut, autoriser pour les tests
  return { hasCredits: true, balance: 100 };
}

/**
 * Consommation des crédits utilisateur
 */
async function consumeUserCredits(userId, credits, service, referenceId) {
  try {
    const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/credit-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'consumeCredits',
        userId: userId,
        credits: credits,
        service: service,
        referenceId: referenceId
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`💳 ${credits} crédits consommés pour ${userId}`);
      return data;
    }
  } catch (error) {
    console.error('Erreur consommation crédits:', error);
  }
}

/**
 * Sauvegarde de l'enrichissement en base
 */
async function saveEnrichmentToDatabase(opportunityId, enrichmentResult, enrichmentLevel) {
  try {
    const updateData = {
      enrichment_data: enrichmentResult,
      factual_data: enrichmentResult.factual_data || {},
      market_research: enrichmentResult.market_research || {},
      competitor_analysis: enrichmentResult.competitor_analysis || {},
      regulatory_info: enrichmentResult.regulatory_info || {},
      enrichment_status: 'completed',
      enrichment_completed_at: new Date().toISOString(),
      data_sources: enrichmentResult.data_sources || [],
      confidence_score: enrichmentResult.confidence_score || 0,
      enrichment_level: enrichmentLevel
    };

    const { data, error } = await supabase
      .from('opportunity_analyses')
      .update(updateData)
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) {
      console.error('Erreur sauvegarde BDD:', error);
      return { success: false, error: error.message };
    }

    console.log('💾 Enrichissement sauvegardé en BDD');
    return { success: true, data };

  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extraction de la localisation depuis l'opportunité
 */
function extractLocationFromOpportunity(opportunity) {
  // Chercher dans les différents champs possibles
  const locations = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Lambaréné'];
  
  const searchFields = [
    opportunity.opportunity_description,
    opportunity.article_summary,
    opportunity.opportunity_title
  ].filter(Boolean).join(' ').toLowerCase();

  for (const location of locations) {
    if (searchFields.includes(location.toLowerCase())) {
      return location;
    }
  }

  // Par défaut, Libreville
  return 'Libreville';
}
