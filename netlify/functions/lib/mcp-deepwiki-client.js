/**
 * Client MCP DeepWiki pour l'enrichissement des opportunités
 * Gabon 24/7 - Module Opportunités IA Enrichi
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class DeepWikiClient {
  constructor() {
    // Utiliser l'outil MCP DeepWiki via les fonctions existantes
    this.timeout = 15000; // 15 secondes pour les requêtes MCP
    this.maxRetries = 2;
  }

  /**
   * Recherche principale via MCP DeepWiki
   */
  async search(params) {
    const { queries, lang = 'fr', limit = 5 } = params;
    
    console.log(`🔍 DeepWiki Search: ${queries.length} queries (${lang})`);
    
    const results = [];

    for (const query of queries) {
      try {
        console.log(`📚 Searching: "${query}"`);
        
        // Vérifier le cache d'abord
        const cacheKey = this.generateCacheKey({ query, lang, limit });
        const cached = await this.checkCache(cacheKey);
        
        if (cached) {
          console.log('📋 Cache hit for DeepWiki');
          results.push(cached);
          continue;
        }

        // Utiliser l'outil MCP DeepWiki (simulé pour l'instant)
        const searchResult = await this.performMCPSearch(query, lang, limit);
        
        if (searchResult && searchResult.articles) {
          // Sauvegarder en cache
          await this.saveToCache(cacheKey, searchResult, 'deepwiki');
          results.push(searchResult);
        } else {
          results.push({
            query,
            articles: [],
            error: false,
            message: 'No results found'
          });
        }

        // Petit délai pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ DeepWiki error for query "${query}":`, error.message);
        results.push({
          query,
          articles: [],
          error: true,
          message: error.message
        });
      }
    }

    return this.processWikiResults(results);
  }

  /**
   * Recherche de données démographiques et géographiques
   */
  async searchLocationData(location, sector) {
    console.log(`🌍 Location data search: ${location} (${sector})`);

    const queries = [
      `${location} Gabon population démographie`,
      `${location} infrastructure économie`,
      `${location} développement urbain`,
      `Gabon ${sector} statistiques`
    ];

    const results = await this.search({ queries, lang: 'fr', limit: 3 });
    
    return {
      location,
      sector,
      demographics: this.extractDemographics(results),
      infrastructure: this.extractInfrastructure(results),
      economic_indicators: this.extractEconomicIndicators(results),
      data_sources: results.sources || [],
      confidence_score: this.calculateLocationConfidence(results),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Recherche d'informations sectorielles
   */
  async searchSectorInfo(sector, country = 'Gabon') {
    console.log(`🏭 Sector info search: ${sector} in ${country}`);

    const queries = [
      `${country} ${sector} industrie statistiques`,
      `${sector} réglementation ${country}`,
      `${sector} marché Afrique Centrale`,
      `OHADA ${sector} droit des affaires`
    ];

    const results = await this.search({ queries, lang: 'fr', limit: 4 });

    return {
      sector,
      country,
      industry_overview: this.extractIndustryOverview(results),
      key_players: this.extractKeyPlayers(results),
      regulations: this.extractSectorRegulations(results),
      market_structure: this.extractMarketStructure(results),
      data_sources: results.sources || [],
      confidence_score: this.calculateSectorConfidence(results),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Recherche d'informations réglementaires spécifiques
   */
  async searchRegulatoryFramework(sector, country = 'Gabon') {
    console.log(`⚖️ Regulatory framework search: ${sector} in ${country}`);

    const queries = [
      `${country} réglementation ${sector} licences`,
      `${country} code commerce investissement`,
      `OHADA ${sector} procédures légales`,
      `${country} fiscalité ${sector} entreprises`
    ];

    const results = await this.search({ queries, lang: 'fr', limit: 5 });

    return {
      sector,
      country,
      licenses: this.extractLicenseInfo(results),
      legal_requirements: this.extractLegalRequirements(results),
      tax_framework: this.extractTaxFramework(results),
      compliance_requirements: this.extractComplianceRequirements(results),
      data_sources: results.sources || [],
      confidence_score: this.calculateRegulatoryConfidence(results),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Simulation de la recherche MCP DeepWiki
   * À remplacer par l'appel réel au MCP quand disponible
   */
  async performMCPSearch(query, lang, limit) {
    // Pour l'instant, nous simulons la réponse MCP DeepWiki
    // Cette méthode sera remplacée par l'appel réel au serveur MCP
    
    console.log(`🤖 Simulating MCP DeepWiki search for: ${query}`);
    
    // Simulation basique selon le type de query
    const mockArticles = this.generateMockWikiData(query, lang);
    
    return {
      query,
      articles: mockArticles,
      summary: this.generateQuerySummary(query, mockArticles),
      relevance_score: 0.8,
      source: 'wikipedia_mock'
    };
  }

  /**
   * Génération de données Wiki simulées intelligentes
   */
  generateMockWikiData(query, lang) {
    const lowerQuery = query.toLowerCase();
    
    // Données démographiques
    if (lowerQuery.includes('population') || lowerQuery.includes('démographie')) {
      return [{
        title: `Démographie ${query.includes('Libreville') ? 'de Libreville' : 'du Gabon'}`,
        url: 'https://fr.wikipedia.org/wiki/Demographie_Gabon',
        content: 'Données démographiques et statistiques de population',
        infobox: {
          population: query.includes('Libreville') ? 797003 : 2300000,
          density: query.includes('Libreville') ? '2,120 hab/km²' : '8.8 hab/km²',
          growth_rate: '2.4%'
        },
        statistics: {
          urban_population: '87%',
          median_age: 22.5,
          literacy_rate: '84%'
        },
        relevance_score: 0.9
      }];
    }
    
    // Données économiques
    if (lowerQuery.includes('économie') || lowerQuery.includes('infrastructure')) {
      return [{
        title: `Économie ${query.includes('Gabon') ? 'du Gabon' : 'locale'}`,
        url: 'https://fr.wikipedia.org/wiki/Economie_Gabon',
        content: 'Structure économique et infrastructures',
        infobox: {
          gdp_per_capita: 8266,
          currency: 'XAF',
          main_industries: ['Pétrole', 'Bois', 'Manganèse', 'Agriculture']
        },
        geography: {
          airports: query.includes('Libreville') ? 1 : 3,
          ports: query.includes('Libreville') ? 1 : 2,
          road_network: 'En développement'
        },
        relevance_score: 0.85
      }];
    }
    
    // Données sectorielles
    if (lowerQuery.includes('secteur') || lowerQuery.includes('industrie')) {
      return [{
        title: `Secteur ${this.extractSectorFromQuery(query)}`,
        url: 'https://fr.wikipedia.org/wiki/Secteur',
        content: 'Informations sectorielles et industrielles',
        statistics: {
          market_share: 'Données à déterminer',
          growth_rate: '5-8%',
          employment: 'Secteur en croissance'
        },
        relevance_score: 0.75
      }];
    }
    
    // Données réglementaires
    if (lowerQuery.includes('réglementation') || lowerQuery.includes('ohada') || lowerQuery.includes('licence')) {
      return [{
        title: 'Réglementation des affaires au Gabon',
        url: 'https://fr.wikipedia.org/wiki/OHADA',
        content: 'Cadre réglementaire et juridique',
        legal_framework: {
          primary_law: 'Code OHADA',
          business_registration: 'CFE (Centre de Formalités des Entreprises)',
          licensing_authority: 'Ministères sectoriels'
        },
        relevance_score: 0.8
      }];
    }

    // Résultat générique
    return [{
      title: `Informations sur ${query}`,
      url: 'https://fr.wikipedia.org/wiki/',
      content: 'Informations générales disponibles',
      relevance_score: 0.5
    }];
  }

  /**
   * Traitement des résultats Wiki
   */
  processWikiResults(results) {
    const processed = {
      data: {},
      sources: [],
      confidence_score: 0,
      total_articles: 0
    };

    let totalRelevance = 0;
    let articleCount = 0;

    for (const result of results) {
      if (result.articles && result.articles.length > 0) {
        // Extraire les données structurées
        const extracted = this.extractStructuredData(result.articles);
        Object.assign(processed.data, extracted);

        // Ajouter les sources
        processed.sources.push(...result.articles.map(article => ({
          title: article.title,
          url: article.url,
          relevance: article.relevance_score || 0.5,
          query: result.query
        })));

        // Calculer la confiance
        result.articles.forEach(article => {
          totalRelevance += article.relevance_score || 0.5;
          articleCount++;
        });

        processed.total_articles += result.articles.length;
      }
    }

    processed.confidence_score = articleCount > 0 ? totalRelevance / articleCount : 0;

    return processed;
  }

  /**
   * Extraction de données structurées
   */
  extractStructuredData(articles) {
    const data = {};

    for (const article of articles) {
      // Extraire les infobox
      if (article.infobox) {
        Object.assign(data, article.infobox);
      }

      // Extraire les statistiques
      if (article.statistics) {
        data.statistics = { ...data.statistics, ...article.statistics };
      }

      // Extraire les données géographiques
      if (article.geography) {
        data.geography = { ...data.geography, ...article.geography };
      }

      // Extraire le cadre légal
      if (article.legal_framework) {
        data.legal_framework = { ...data.legal_framework, ...article.legal_framework };
      }
    }

    return data;
  }

  // Méthodes d'extraction spécialisées
  extractDemographics(results) {
    const demographics = results.data || {};
    return {
      population: demographics.population || null,
      density: demographics.density || null,
      growth_rate: demographics.growth_rate || null,
      urban_population: demographics.urban_population || null,
      median_age: demographics.median_age || null,
      literacy_rate: demographics.literacy_rate || null
    };
  }

  extractInfrastructure(results) {
    const geography = results.data?.geography || {};
    const stats = results.data?.statistics || {};
    
    return {
      transport: {
        airports: geography.airports || null,
        ports: geography.ports || null,
        road_network: geography.road_network || 'Information non disponible'
      },
      utilities: {
        electricity_coverage: stats.electricity_coverage || 'À déterminer',
        internet_penetration: stats.internet_penetration || '62%',
        water_access: stats.water_access || 'À déterminer'
      }
    };
  }

  extractEconomicIndicators(results) {
    const data = results.data || {};
    return {
      gdp_per_capita: data.gdp_per_capita || null,
      main_industries: data.main_industries || [],
      currency: data.currency || 'XAF',
      business_climate: 'En développement'
    };
  }

  extractIndustryOverview(results) {
    return {
      description: 'Secteur en développement au Gabon',
      key_trends: ['Digitalisation', 'Diversification économique'],
      market_size: 'À évaluer',
      growth_potential: 'Élevé'
    };
  }

  extractKeyPlayers(results) {
    return [
      'Acteurs publics',
      'Entreprises privées locales',
      'Partenaires internationaux'
    ];
  }

  extractSectorRegulations(results) {
    const legal = results.data?.legal_framework || {};
    return {
      primary_legislation: legal.primary_law || 'Code OHADA',
      regulatory_authority: legal.licensing_authority || 'Ministères sectoriels',
      registration_process: legal.business_registration || 'CFE'
    };
  }

  // Méthodes de cache (similaires au client Brave)
  async checkCache(key) {
    try {
      const { data } = await supabase
        .from('enrichment_cache')
        .select('results')
        .eq('query_hash', key)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (data) {
        await supabase
          .from('enrichment_cache')
          .update({ hit_count: supabase.raw('hit_count + 1') })
          .eq('query_hash', key);

        return data.results;
      }
    } catch (error) {
      console.log('DeepWiki cache miss:', error.message);
    }

    return null;
  }

  async saveToCache(key, data, queryType) {
    try {
      await supabase
        .from('enrichment_cache')
        .upsert({
          query_hash: key,
          query_type: queryType,
          query_params: { key },
          results: data,
          source_type: 'deepwiki',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
        });
    } catch (error) {
      console.error('DeepWiki cache save error:', error);
    }
  }

  generateCacheKey(params) {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
  }

  // Méthodes utilitaires
  generateQuerySummary(query, articles) {
    if (articles.length === 0) return null;
    
    return `Résumé basé sur ${articles.length} article(s) Wikipedia concernant "${query}".`;
  }

  extractSectorFromQuery(query) {
    const sectors = {
      'agriculture': 'Agriculture',
      'technologie': 'Technologies',
      'tourisme': 'Tourisme',
      'transport': 'Transport',
      'éducation': 'Éducation',
      'santé': 'Santé',
      'commerce': 'Commerce'
    };

    for (const [key, value] of Object.entries(sectors)) {
      if (query.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'Secteur d\'activité';
  }

  // Méthodes de calcul de confiance
  calculateLocationConfidence(results) {
    return Math.min(10, Math.max(1, (results.total_articles || 0) * 2));
  }

  calculateSectorConfidence(results) {
    return Math.min(10, Math.max(1, (results.confidence_score || 0) * 10));
  }

  calculateRegulatoryConfidence(results) {
    return Math.min(10, Math.max(1, (results.total_articles || 0) * 1.5));
  }

  extractLicenseInfo(results) {
    return [
      {
        name: 'Licence commerciale',
        authority: 'CFE',
        cost: 'Variable selon secteur',
        processing_time: '2-4 semaines'
      }
    ];
  }

  extractLegalRequirements(results) {
    return [
      'Enregistrement au CFE',
      'Obtention des licences sectorielles',
      'Respect du code OHADA'
    ];
  }

  extractTaxFramework(results) {
    return {
      corporate_tax: '30%',
      vat: '18%',
      social_contributions: 'Selon statut'
    };
  }

  extractComplianceRequirements(results) {
    return [
      'Déclarations fiscales régulières',
      'Respect des normes sectorielles',
      'Audit annuel si requis'
    ];
  }

  extractMarketStructure(results) {
    return {
      market_type: 'Concurrence libre',
      barriers_to_entry: 'Modérées',
      key_success_factors: ['Innovation', 'Adaptation locale', 'Partenariats']
    };
  }
}

module.exports = { DeepWikiClient };
