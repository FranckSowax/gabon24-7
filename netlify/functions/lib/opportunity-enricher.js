/**
 * Service d'enrichissement principal des opportunités
 * Combine MCP Brave Search et DeepWiki pour enrichir les analyses
 * Gabon 24/7 - Module Opportunités IA Enrichi
 */

const { BraveSearchClient } = require('./mcp-brave-client');
const { DeepWikiClient } = require('./mcp-deepwiki-client');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class OpportunityEnricher {
  constructor() {
    this.braveClient = new BraveSearchClient();
    this.wikiClient = new DeepWikiClient();
    this.maxEnrichmentTime = 45000; // 45 secondes max
  }

  /**
   * Enrichissement principal d'une opportunité
   */
  async enrichOpportunity(opportunity, enrichmentLevel = 'basic') {
    console.log(`🔍 Enrichissement ${enrichmentLevel}: ${opportunity.title}`);
    
    const startTime = Date.now();
    
    try {
      // Créer un timeout général
      const enrichmentPromise = this.performEnrichment(opportunity, enrichmentLevel);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Enrichment timeout')), this.maxEnrichmentTime);
      });

      const result = await Promise.race([enrichmentPromise, timeoutPromise]);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Enrichissement terminé en ${processingTime}ms`);

      // Sauvegarder les métriques
      await this.saveEnrichmentMetrics(opportunity.id, result, processingTime);

      return result;

    } catch (error) {
      console.error('❌ Erreur enrichissement:', error.message);
      
      // Retourner un enrichissement minimal en cas d'erreur
      return this.generateMinimalEnrichment(opportunity, error.message);
    }
  }

  /**
   * Exécution de l'enrichissement selon le niveau
   */
  async performEnrichment(opportunity, enrichmentLevel) {
    const location = opportunity.location || 'Libreville';
    const sector = opportunity.sector || this.extractSectorFromTitle(opportunity.title);

    console.log(`📍 Location: ${location}, Secteur: ${sector}`);

    // Enrichissement de base (gratuit/limité)
    if (enrichmentLevel === 'basic') {
      return await this.basicEnrichment(opportunity, location, sector);
    }

    // Enrichissement premium (payant/complet)
    if (enrichmentLevel === 'premium') {
      return await this.premiumEnrichment(opportunity, location, sector);
    }

    throw new Error(`Niveau d'enrichissement inconnu: ${enrichmentLevel}`);
  }

  /**
   * Enrichissement de base (limité)
   */
  async basicEnrichment(opportunity, location, sector) {
    console.log('🆓 Enrichissement de base');

    // Phase 1: Données factuelles essentielles via DeepWiki
    const factualDataPromise = this.collectBasicFactualData(location, sector);

    // Phase 2: Recherche de marché basique via Brave (limitée)
    const marketDataPromise = this.conductBasicMarketResearch(sector, location);

    // Exécuter en parallèle pour optimiser le temps
    const [factualData, marketData] = await Promise.all([
      factualDataPromise,
      marketDataPromise
    ]);

    // Données limitées pour le niveau basic
    const result = {
      factual_data: {
        demographics: this.limitBasicData(factualData.demographics),
        infrastructure: this.limitBasicData(factualData.infrastructure),
        economic_indicators: this.limitBasicData(factualData.economic_indicators)
      },
      market_research: {
        market_size: marketData.market_size,
        growth_trends: marketData.growth_trends.slice(0, 2), // Limité à 2 tendances
        customer_segments: marketData.customer_segments.slice(0, 2) // Limité à 2 segments
      },
      competitor_analysis: {
        direct_competitors: [], // Vide en basic
        market_overview: 'Disponible en version premium'
      },
      regulatory_info: {
        basic_requirements: ['Enregistrement CFE requis', 'Licences sectorielles à vérifier'],
        detailed_info: 'Disponible en version premium'
      },
      confidence_score: this.calculateBasicConfidence(factualData, marketData),
      data_sources: this.collectDataSources([factualData, marketData]),
      enrichment_level: 'basic',
      upgrade_message: 'Passez au premium pour une analyse complète avec concurrents et réglementations détaillées'
    };

    return result;
  }

  /**
   * Enrichissement premium (complet)
   */
  async premiumEnrichment(opportunity, location, sector) {
    console.log('💎 Enrichissement premium');

    // Phase 1: Collecte complète de données factuelles via DeepWiki
    const factualDataPromise = this.collectFactualData(location, sector);

    // Phase 2: Recherche de marché approfondie via Brave Search
    const marketDataPromise = this.conductMarketResearch(sector, location);

    // Phase 3: Analyse concurrentielle via Brave Search
    const competitorDataPromise = this.analyzeCompetitors(sector, location, opportunity.title);

    // Phase 4: Informations réglementaires via DeepWiki + Brave
    const regulatoryDataPromise = this.gatherRegulatoryInfo(sector);

    // Exécuter en parallèle pour optimiser
    const [factualData, marketData, competitorData, regulatoryData] = await Promise.all([
      factualDataPromise,
      marketDataPromise,
      competitorDataPromise,
      regulatoryDataPromise
    ]);

    // Calcul du score de confiance global
    const confidenceScore = this.calculateConfidence({
      factualData,
      marketData,
      competitorData,
      regulatoryData
    });

    return {
      factual_data: factualData,
      market_research: marketData,
      competitor_analysis: competitorData,
      regulatory_info: regulatoryData,
      confidence_score: confidenceScore,
      data_sources: this.collectDataSources([factualData, marketData, competitorData, regulatoryData]),
      enrichment_level: 'premium',
      competitive_advantage: this.suggestCompetitiveAdvantage(opportunity, competitorData),
      recommendations: this.generateActionableRecommendations(factualData, marketData, competitorData, regulatoryData)
    };
  }

  /**
   * Collecte de données factuelles via DeepWiki
   */
  async collectFactualData(location, sector) {
    console.log(`📊 Collecte données factuelles: ${location}, ${sector}`);

    try {
      const locationData = await this.wikiClient.searchLocationData(location, sector);
      
      return {
        demographics: locationData.demographics,
        infrastructure: locationData.infrastructure,
        economic_indicators: locationData.economic_indicators,
        confidence_score: locationData.confidence_score,
        sources: locationData.data_sources
      };
    } catch (error) {
      console.error('❌ Erreur données factuelles:', error);
      return this.getDefaultFactualData(location, sector);
    }
  }

  /**
   * Version basique des données factuelles
   */
  async collectBasicFactualData(location, sector) {
    console.log(`📊 Collecte données factuelles basiques: ${location}`);

    try {
      // Recherche limitée pour le niveau basic
      const queries = [`${location} Gabon population`];
      const results = await this.wikiClient.search({ queries, lang: 'fr', limit: 2 });
      
      return {
        demographics: {
          population: results.data?.population || 'Non disponible',
          density: results.data?.density || 'Non disponible'
        },
        infrastructure: {
          basic_info: 'Infrastructure en développement'
        },
        economic_indicators: {
          currency: 'XAF',
          main_economy: 'Pétrole, bois, agriculture'
        }
      };
    } catch (error) {
      return this.getDefaultFactualData(location, sector);
    }
  }

  /**
   * Recherche de marché via Brave Search
   */
  async conductMarketResearch(sector, location) {
    console.log(`📈 Recherche de marché: ${sector} à ${location}`);

    try {
      const marketData = await this.braveClient.searchMarketData(sector, location);
      
      return {
        market_size: marketData.market_size,
        growth_trends: marketData.growth_trends,
        customer_segments: marketData.customer_segments,
        market_dynamics: marketData.market_dynamics,
        sources: marketData.data_sources
      };
    } catch (error) {
      console.error('❌ Erreur recherche marché:', error);
      return this.getDefaultMarketData(sector);
    }
  }

  /**
   * Version basique de la recherche de marché
   */
  async conductBasicMarketResearch(sector, location) {
    console.log(`📈 Recherche de marché basique: ${sector}`);

    try {
      // Recherche limitée pour le niveau basic
      const searchResult = await this.braveClient.search({
        q: `${sector} marché ${location}`,
        count: 5
      });

      return {
        market_size: { estimated_value: 'Marché en développement', basis: 'Estimation préliminaire' },
        growth_trends: ['Croissance du secteur', 'Opportunités digitales'],
        customer_segments: [
          { name: 'Particuliers', potential: 'Moyen' },
          { name: 'Entreprises', potential: 'Élevé' }
        ]
      };
    } catch (error) {
      return this.getDefaultMarketData(sector);
    }
  }

  /**
   * Analyse de la concurrence via Brave Search
   */
  async analyzeCompetitors(sector, location, businessTitle) {
    console.log(`🏢 Analyse concurrence: ${sector} à ${location}`);

    try {
      const competitorData = await this.braveClient.searchCompetitors(sector, location, businessTitle);
      
      return {
        direct_competitors: competitorData.direct_competitors,
        indirect_competitors: competitorData.indirect_competitors,
        market_gaps: competitorData.market_gaps,
        competitive_landscape: competitorData.competitive_landscape,
        sources: competitorData.data_sources
      };
    } catch (error) {
      console.error('❌ Erreur analyse concurrence:', error);
      return this.getDefaultCompetitorData();
    }
  }

  /**
   * Collecte d'informations réglementaires
   */
  async gatherRegulatoryInfo(sector) {
    console.log(`⚖️ Informations réglementaires: ${sector}`);

    try {
      // Combiner DeepWiki et Brave Search pour les réglementations
      const [wikiRegulatory, braveRegulatory] = await Promise.all([
        this.wikiClient.searchRegulatoryFramework(sector),
        this.braveClient.searchRegulatoryInfo(sector)
      ]);

      return {
        licenses_required: [...(wikiRegulatory.licenses || []), ...(braveRegulatory.licenses_required || [])],
        regulations: [...(wikiRegulatory.legal_requirements || []), ...(braveRegulatory.regulations || [])],
        government_programs: braveRegulatory.government_programs || [],
        tax_information: wikiRegulatory.tax_framework || {},
        sources: [...(wikiRegulatory.data_sources || []), ...(braveRegulatory.data_sources || [])]
      };
    } catch (error) {
      console.error('❌ Erreur infos réglementaires:', error);
      return this.getDefaultRegulatoryData();
    }
  }

  /**
   * Calcul du score de confiance
   */
  calculateConfidence(data) {
    let score = 0;
    let factors = 0;

    // Évaluer la complétude des données factuelles
    if (data.factualData?.demographics?.population) {
      score += 20;
      factors++;
    }

    // Évaluer les données de marché
    if (data.marketData?.market_size) {
      score += 25;
      factors++;
    }

    // Évaluer l'analyse concurrentielle
    if (data.competitorData?.direct_competitors?.length > 0) {
      score += 25;
      factors++;
    }

    // Évaluer les informations réglementaires
    if (data.regulatoryData?.licenses_required?.length > 0) {
      score += 30;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  calculateBasicConfidence(factualData, marketData) {
    let score = 0;
    let factors = 0;

    if (factualData?.demographics) {
      score += 30;
      factors++;
    }

    if (marketData?.market_size) {
      score += 40;
      factors++;
    }

    return factors > 0 ? score / factors : 20; // Score minimum pour basic
  }

  /**
   * Limitation des données pour le niveau basic
   */
  limitBasicData(data) {
    if (!data) return {};
    
    // Retourner seulement les 2 premiers éléments de chaque propriété
    const limited = {};
    Object.keys(data).slice(0, 2).forEach(key => {
      limited[key] = data[key];
    });
    
    return limited;
  }

  /**
   * Génération de recommandations actionnables
   */
  generateActionableRecommendations(factualData, marketData, competitorData, regulatoryData) {
    const recommendations = [];

    // Recommandations basées sur le marché
    if (marketData.market_size?.estimated_value !== 'À déterminer') {
      recommendations.push({
        category: 'Marché',
        action: 'Évaluer la taille du marché local',
        priority: 'high',
        timeframe: '2-4 semaines'
      });
    }

    // Recommandations concurrentielles
    if (competitorData.direct_competitors?.length < 3) {
      recommendations.push({
        category: 'Concurrence',
        action: 'Exploiter le marché peu saturé',
        priority: 'high',
        timeframe: '1-2 mois'
      });
    }

    // Recommandations réglementaires
    if (regulatoryData.licenses_required?.length > 0) {
      recommendations.push({
        category: 'Réglementation',
        action: 'Initier les démarches de licence',
        priority: 'medium',
        timeframe: '4-8 semaines'
      });
    }

    return recommendations;
  }

  /**
   * Suggestion d'avantage concurrentiel
   */
  suggestCompetitiveAdvantage(opportunity, competitorData) {
    const advantages = [];

    if (competitorData.market_gaps?.length > 0) {
      advantages.push(`Exploiter les gaps: ${competitorData.market_gaps[0].gap}`);
    }

    if (competitorData.competitive_landscape?.opportunity_level === 'high') {
      advantages.push('Marché peu saturé - opportunité de premier entrant');
    }

    advantages.push('Adaptation aux spécificités locales gabonaises');

    return advantages;
  }

  /**
   * Extraction du secteur depuis le titre
   */
  extractSectorFromTitle(title) {
    const sectors = {
      'tech': 'Technologies',
      'digital': 'Technologies',
      'agriculture': 'Agriculture',
      'transport': 'Transport',
      'éducation': 'Éducation',
      'santé': 'Santé',
      'commerce': 'Commerce',
      'tourisme': 'Tourisme',
      'finance': 'Finance'
    };

    const lowerTitle = title.toLowerCase();
    for (const [keyword, sector] of Object.entries(sectors)) {
      if (lowerTitle.includes(keyword)) {
        return sector;
      }
    }

    return 'Services Généraux';
  }

  /**
   * Collecte des sources de données
   */
  collectDataSources(dataArray) {
    const sources = [];
    dataArray.forEach(data => {
      if (data?.sources) sources.push(...data.sources);
      if (data?.data_sources) sources.push(...data.data_sources);
    });
    return [...new Set(sources)]; // Dédupliquer
  }

  /**
   * Sauvegarde des métriques d'enrichissement
   */
  async saveEnrichmentMetrics(opportunityId, result, processingTime) {
    try {
      const metrics = {
        opportunity_id: opportunityId,
        enrichment_type: result.enrichment_level,
        data_points_added: this.countDataPoints(result),
        sources_used: result.data_sources || [],
        processing_time_ms: processingTime,
        confidence_level: result.confidence_score,
        api_calls_made: this.estimateApiCalls(result),
        credits_consumed: result.enrichment_level === 'premium' ? 5 : 1
      };

      await supabase
        .from('enrichment_metrics')
        .insert([metrics]);
    } catch (error) {
      console.error('Erreur sauvegarde métriques:', error);
    }
  }

  countDataPoints(result) {
    let count = 0;
    if (result.factual_data) count += Object.keys(result.factual_data).length;
    if (result.market_research) count += Object.keys(result.market_research).length;
    if (result.competitor_analysis) count += Object.keys(result.competitor_analysis).length;
    if (result.regulatory_info) count += Object.keys(result.regulatory_info).length;
    return count;
  }

  estimateApiCalls(result) {
    let calls = 0;
    if (result.enrichment_level === 'basic') calls = 3;
    if (result.enrichment_level === 'premium') calls = 8;
    return calls;
  }

  /**
   * Génération d'un enrichissement minimal en cas d'erreur
   */
  generateMinimalEnrichment(opportunity, errorMessage) {
    return {
      factual_data: this.getDefaultFactualData(opportunity.location, opportunity.sector),
      market_research: this.getDefaultMarketData(opportunity.sector),
      competitor_analysis: { message: 'Analyse non disponible actuellement' },
      regulatory_info: { message: 'Informations non disponibles actuellement' },
      confidence_score: 10,
      data_sources: [],
      enrichment_level: 'minimal',
      error: errorMessage
    };
  }

  // Données par défaut
  getDefaultFactualData(location, sector) {
    return {
      demographics: { population: 'À déterminer', note: 'Données en cours de collecte' },
      infrastructure: { status: 'En développement' },
      economic_indicators: { currency: 'XAF', main_sectors: ['Pétrole', 'Bois', 'Agriculture'] }
    };
  }

  getDefaultMarketData(sector) {
    return {
      market_size: { estimated_value: 'Marché émergent', currency: 'XAF' },
      growth_trends: ['Digitalisation en cours', 'Opportunités locales'],
      customer_segments: [{ name: 'Marché local', potential: 'À évaluer' }]
    };
  }

  getDefaultCompetitorData() {
    return {
      direct_competitors: [],
      market_gaps: [{ gap: 'Marché peu analysé', opportunity_score: 7 }],
      competitive_landscape: { opportunity_level: 'unknown' }
    };
  }

  getDefaultRegulatoryData() {
    return {
      licenses_required: [{ name: 'Licence commerciale standard', authority: 'CFE' }],
      regulations: ['Respect du code OHADA'],
      government_programs: []
    };
  }
}

module.exports = { OpportunityEnricher };
