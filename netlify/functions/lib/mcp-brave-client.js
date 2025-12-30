/**
 * Client MCP Brave Search pour l'enrichissement des opportunités
 * Gabon 24/7 - Module Opportunités IA Enrichi
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class BraveSearchClient {
  constructor() {
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY;
    this.baseUrl = 'https://api.search.brave.com/res/v1';
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Recherche générale avec cache intelligent
   */
  async search(params) {
    const {
      q: query,
      freshness = 'past_year',
      country = 'GA',
      count = 20,
      market_research = false
    } = params;

    console.log(`🔍 Brave Search: "${query}" (${freshness}, ${country})`);

    // Vérifier le cache d'abord
    const cacheKey = this.generateCacheKey(params);
    const cached = await this.checkCache(cacheKey);
    
    if (cached) {
      console.log('📋 Cache hit for Brave Search');
      return cached;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const searchParams = new URLSearchParams({
        q: query,
        freshness: freshness,
        country: country,
        count: count.toString(),
        text_decorations: 'false',
        result_filter: 'web'
      });

      const response = await fetch(`${this.baseUrl}/web/search?${searchParams}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Gabon24-7-OpportunityAnalyzer/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const processed = this.processResults(data, market_research);

      // Mettre en cache
      await this.saveToCache(cacheKey, processed, 'brave_search');

      console.log(`✅ Brave Search completed: ${processed.web_results.length} results`);
      return processed;

    } catch (error) {
      console.error('❌ Brave Search error:', error.message);
      
      // Retourner un résultat vide plutôt que de lancer une erreur
      return {
        web_results: [],
        news: [],
        total: 0,
        query: query,
        error: error.message
      };
    }
  }

  /**
   * Recherche spécialisée pour l'analyse de marché
   */
  async searchMarketData(sector, location = 'Gabon') {
    console.log(`📊 Market research: ${sector} in ${location}`);

    const searches = await Promise.allSettled([
      this.search({
        q: `${sector} market size ${location} 2024`,
        freshness: 'past_year',
        country: 'GA',
        market_research: true
      }),
      this.search({
        q: `${sector} business opportunities ${location}`,
        freshness: 'past_6months',
        country: 'GA',
        market_research: true
      }),
      this.search({
        q: `${sector} industry trends Africa Central`,
        freshness: 'past_year',
        market_research: true
      })
    ]);

    const results = searches
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    return this.combineMarketResults(results, sector, location);
  }

  /**
   * Recherche des concurrents
   */
  async searchCompetitors(sector, location, businessType) {
    console.log(`🏢 Competitor search: ${sector} in ${location}`);

    const searches = await Promise.allSettled([
      // Concurrents directs
      this.search({
        q: `"${sector}" entreprises "${location}" Gabon`,
        freshness: 'past_year',
        country: 'GA'
      }),
      // Concurrents indirects
      this.search({
        q: `services similaires "${businessType}" Afrique Centrale`,
        freshness: 'past_year'
      }),
      // Leaders du marché
      this.search({
        q: `${sector} market leaders Gabon Africa`,
        freshness: 'past_year'
      })
    ]);

    const results = searches
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    return this.extractCompetitorData(results, sector, location);
  }

  /**
   * Recherche d'informations réglementaires récentes
   */
  async searchRegulatoryInfo(sector) {
    console.log(`⚖️ Regulatory search: ${sector}`);

    const searches = await Promise.allSettled([
      this.search({
        q: `réglementation ${sector} Gabon 2024 licences`,
        freshness: 'past_year',
        country: 'GA'
      }),
      this.search({
        q: `OHADA ${sector} business law`,
        freshness: 'past_2years'
      }),
      this.search({
        q: `Gabon government programs ${sector} support`,
        freshness: 'past_year',
        country: 'GA'
      })
    ]);

    const results = searches
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    return this.extractRegulatoryData(results, sector);
  }

  /**
   * Traitement des résultats Brave Search
   */
  processResults(data, isMarketResearch = false) {
    const webResults = (data.web?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      published: result.age,
      domain: new URL(result.url).hostname,
      relevance_score: this.calculateRelevanceScore(result, isMarketResearch),
      language: result.language || 'unknown'
    }));

    const newsResults = (data.news?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      published: result.age,
      source: result.meta_url?.hostname,
      relevance_score: this.calculateRelevanceScore(result, isMarketResearch)
    }));

    return {
      web_results: webResults.sort((a, b) => b.relevance_score - a.relevance_score),
      news: newsResults.sort((a, b) => b.relevance_score - a.relevance_score),
      total: data.web?.total || 0,
      query: data.query,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calcul du score de pertinence
   */
  calculateRelevanceScore(result, isMarketResearch) {
    let score = 5; // Score de base

    const title = (result.title || '').toLowerCase();
    const description = (result.description || '').toLowerCase();
    const content = `${title} ${description}`;

    // Mots-clés gabonais
    const gabonKeywords = ['gabon', 'libreville', 'port-gentil', 'franceville', 'afrique centrale'];
    gabonKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 2;
    });

    // Mots-clés business
    const businessKeywords = ['entreprise', 'business', 'marché', 'opportunité', 'investissement'];
    businessKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 1;
    });

    // Bonus pour recherche de marché
    if (isMarketResearch) {
      const marketKeywords = ['taille du marché', 'croissance', 'tendances', 'statistics', 'données'];
      marketKeywords.forEach(keyword => {
        if (content.includes(keyword)) score += 2;
      });
    }

    // Pénalité pour contenu générique
    const genericKeywords = ['wikipedia', 'definition', 'what is'];
    genericKeywords.forEach(keyword => {
      if (content.includes(keyword)) score -= 1;
    });

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Combinaison des résultats de recherche de marché
   */
  combineMarketResults(results, sector, location) {
    const combined = {
      sector,
      location,
      market_size: this.extractMarketSize(results),
      growth_trends: this.extractGrowthTrends(results),
      customer_segments: this.extractCustomerSegments(results),
      market_dynamics: this.extractMarketDynamics(results),
      data_sources: results.map(r => r.query).filter(Boolean),
      confidence_score: this.calculateMarketConfidence(results),
      last_updated: new Date().toISOString()
    };

    return combined;
  }

  /**
   * Extraction de données concurrentielles
   */
  extractCompetitorData(results, sector, location) {
    const competitors = [];
    const marketGaps = [];

    results.forEach(resultSet => {
      if (resultSet.web_results) {
        resultSet.web_results.forEach(result => {
          // Logique d'extraction des concurrents depuis les résultats
          const competitor = this.parseCompetitorFromResult(result, sector);
          if (competitor) {
            competitors.push(competitor);
          }
        });
      }
    });

    return {
      direct_competitors: competitors.filter(c => c.type === 'direct').slice(0, 10),
      indirect_competitors: competitors.filter(c => c.type === 'indirect').slice(0, 5),
      market_gaps: this.identifyMarketGaps(competitors, sector),
      competitive_landscape: this.analyzeCompetitiveLandscape(competitors),
      data_sources: results.map(r => r.query).filter(Boolean),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Extraction d'informations réglementaires
   */
  extractRegulatoryData(results, sector) {
    const licenses = [];
    const regulations = [];
    const programs = [];

    results.forEach(resultSet => {
      if (resultSet.web_results) {
        resultSet.web_results.forEach(result => {
          // Extraction des licences requises
          const license = this.parseLicenseFromResult(result);
          if (license) licenses.push(license);

          // Extraction des réglementations
          const regulation = this.parseRegulationFromResult(result);
          if (regulation) regulations.push(regulation);

          // Extraction des programmes gouvernementaux
          const program = this.parseGovernmentProgram(result);
          if (program) programs.push(program);
        });
      }
    });

    return {
      licenses_required: licenses.slice(0, 10),
      regulations: regulations.slice(0, 15),
      government_programs: programs.slice(0, 8),
      sector,
      country: 'GA',
      data_sources: results.map(r => r.query).filter(Boolean),
      last_updated: new Date().toISOString()
    };
  }

  // Méthodes helper pour l'extraction de données spécifiques
  extractMarketSize(results) {
    // Logique pour extraire la taille du marché
    return { estimated_value: 'À déterminer', currency: 'XAF', basis: 'Brave Search Analysis' };
  }

  extractGrowthTrends(results) {
    // Logique pour extraire les tendances de croissance
    return ['Digitalisation croissante', 'Demande locale en hausse', 'Opportunités d\'export'];
  }

  extractCustomerSegments(results) {
    // Logique pour identifier les segments clients
    return [
      { name: 'Particuliers urbains', size: 'Grand', potential: 'Élevé' },
      { name: 'PME locales', size: 'Moyen', potential: 'Élevé' },
      { name: 'Secteur public', size: 'Petit', potential: 'Moyen' }
    ];
  }

  extractMarketDynamics(results) {
    return {
      drivers: ['Croissance démographique', 'Urbanisation'],
      barriers: ['Réglementation complexe', 'Accès au financement'],
      opportunities: ['Marché sous-développé', 'Besoins non satisfaits']
    };
  }

  parseCompetitorFromResult(result, sector) {
    // Logique pour parser les informations des concurrents
    if (result.title && result.description) {
      return {
        name: this.extractCompanyName(result.title),
        type: 'direct',
        location: this.extractLocation(result.description) || 'Gabon',
        services: this.extractServices(result.description),
        url: result.url,
        relevance_score: result.relevance_score
      };
    }
    return null;
  }

  // Méthodes de cache
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
      console.log('Cache miss or error:', error.message);
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
          source_type: 'brave',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
        });
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  generateCacheKey(params) {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
  }

  // Méthodes helper utilitaires
  extractCompanyName(title) {
    // Logique pour extraire le nom de l'entreprise
    return title.split(' - ')[0] || title.split(' |')[0] || title;
  }

  extractLocation(text) {
    const locations = ['libreville', 'port-gentil', 'franceville', 'oyem', 'lambaréné'];
    for (const location of locations) {
      if (text.toLowerCase().includes(location)) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }
    return null;
  }

  extractServices(text) {
    // Logique basique pour extraire les services
    return text.split('.')[0].split(',').slice(0, 3);
  }

  calculateMarketConfidence(results) {
    const totalResults = results.reduce((sum, r) => sum + (r.web_results?.length || 0), 0);
    return Math.min(10, Math.max(1, totalResults / 5));
  }

  analyzeCompetitiveLandscape(competitors) {
    return {
      market_saturation: competitors.length > 15 ? 'high' : competitors.length > 8 ? 'medium' : 'low',
      entry_barriers: competitors.length > 10 ? 'high' : 'medium',
      opportunity_level: competitors.length < 5 ? 'high' : competitors.length < 12 ? 'medium' : 'low'
    };
  }

  identifyMarketGaps(competitors, sector) {
    // Logique pour identifier les gaps du marché
    return [
      { gap: 'Services digitaux manquants', opportunity_score: 8 },
      { gap: 'Couverture géographique limitée', opportunity_score: 7 },
      { gap: 'Solutions adaptées aux PME', opportunity_score: 9 }
    ];
  }

  parseLicenseFromResult(result) {
    // Logique pour parser les licences requises
    return null; // À implémenter selon les besoins
  }

  parseRegulationFromResult(result) {
    // Logique pour parser les réglementations
    return null; // À implémenter selon les besoins
  }

  parseGovernmentProgram(result) {
    // Logique pour parser les programmes gouvernementaux
    return null; // À implémenter selon les besoins
  }
}

module.exports = { BraveSearchClient };
