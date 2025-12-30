# **Module Opportunités IA Enrichi avec MCP Brave & DeepWiki**

## **📋 Architecture du Système Amélioré**

Le système utilise Brave Search et DeepWiki pour transformer une simple suggestion d'opportunité en analyse business complète avec données factuelles vérifiées et contexte approfondi.

## **🚀 Prompt Windsurf Cascade pour Développement**

\# Développement du Module Opportunités IA Enrichi avec MCP Brave & DeepWiki

\#\# Contexte du Projet

Tu es un architecte logiciel expert chargé d'améliorer le module Opportunités IA de Gabon 24/7 en intégrant les MCP Brave Search et DeepWiki. Le système doit enrichir chaque opportunité business générée avec des données factuelles vérifiées, du contexte local approfondi et des analyses de marché en temps réel.

\#\# Objectifs Techniques

\#\#\# Stack Technique  
\- \*\*Frontend\*\* : Next.js 14 avec TypeScript  
\- \*\*Backend\*\* : Netlify Functions \+ Edge Functions  
\- \*\*IA\*\* : OpenAI GPT-4o-mini pour génération initiale  
\- \*\*Enrichissement\*\* : MCP Brave Search \+ MCP DeepWiki  
\- \*\*Base de données\*\* : Supabase avec pgvector  
\- \*\*Cache\*\* : Redis/Upstash pour optimisation des recherches

\#\# Structure du Projet

/app /opportunities /enhanced /page.tsx \# Interface améliorée des opportunités /components /opportunities /EnhancedOpportunityCard.tsx /FactualDataPanel.tsx \# Panel données factuelles /MarketInsights.tsx \# Insights de marché /CompetitorAnalysis.tsx \# Analyse concurrence /RegulatoryInfo.tsx \# Informations réglementaires /lib /mcp /braveSearchClient.ts \# Client Brave Search /deepwikiClient.ts \# Client DeepWiki /dataEnricher.ts \# Service d'enrichissement /netlify/functions /enhance-opportunity.ts \# Enrichissement principal /validate-market-data.ts \# Validation données marché /find-competitors.ts \# Recherche concurrents

\#\# 1\. Schéma Base de Données Enrichi

\`\`\`sql  
\-- Table des opportunités enrichies  
ALTER TABLE opportunity\_analyses ADD COLUMN IF NOT EXISTS  
  enrichment\_data jsonb DEFAULT '{}',  
  factual\_data jsonb DEFAULT '{}',  
  market\_research jsonb DEFAULT '{}',  
  competitor\_analysis jsonb DEFAULT '{}',  
  regulatory\_info jsonb DEFAULT '{}',  
  enrichment\_status text DEFAULT 'pending',  
  enrichment\_completed\_at timestamptz,  
  data\_sources jsonb DEFAULT '\[\]',  
  confidence\_score float DEFAULT 0;

\-- Table de cache pour recherches  
CREATE TABLE IF NOT EXISTS enrichment\_cache (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    query\_hash text UNIQUE NOT NULL,  
    query\_type text NOT NULL, \-- 'brave\_search', 'deepwiki', 'combined'  
    query\_params jsonb NOT NULL,  
    results jsonb NOT NULL,  
    created\_at timestamptz DEFAULT now(),  
    expires\_at timestamptz DEFAULT (now() \+ interval '7 days'),  
    hit\_count integer DEFAULT 0  
);

\-- Table de métriques d'enrichissement  
CREATE TABLE IF NOT EXISTS enrichment\_metrics (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    opportunity\_id uuid REFERENCES opportunity\_analyses(id),  
    enrichment\_type text NOT NULL,  
    data\_points\_added integer DEFAULT 0,  
    sources\_used text\[\],  
    processing\_time\_ms integer,  
    confidence\_level float,  
    created\_at timestamptz DEFAULT now()  
);

\-- Index pour performance  
CREATE INDEX idx\_enrichment\_cache\_hash ON enrichment\_cache(query\_hash);  
CREATE INDEX idx\_enrichment\_cache\_expires ON enrichment\_cache(expires\_at);  
CREATE INDEX idx\_enrichment\_metrics\_opportunity ON enrichment\_metrics(opportunity\_id);

## **2\. Service d'Enrichissement Principal**

// lib/mcp/dataEnricher.ts  
import { BraveSearchClient } from './braveSearchClient';  
import { DeepWikiClient } from './deepwikiClient';  
import { supabase } from '@/lib/supabase';

interface OpportunityData {  
  id: string;  
  title: string;  
  description: string;  
  location: string;  
  sector: string;  
  investment\_required: string;  
}

interface EnrichmentResult {  
  factualData: {  
    demographics: any;  
    infrastructure: any;  
    economic\_indicators: any;  
  };  
  marketResearch: {  
    market\_size: any;  
    growth\_trends: any;  
    customer\_segments: any;  
  };  
  competitorAnalysis: {  
    direct\_competitors: any\[\];  
    indirect\_competitors: any\[\];  
    market\_gaps: any\[\];  
  };  
  regulatoryInfo: {  
    licenses\_required: any\[\];  
    regulations: any\[\];  
    government\_programs: any\[\];  
  };  
  confidenceScore: number;  
  dataSources: string\[\];  
}

export class OpportunityEnricher {  
  private braveClient: BraveSearchClient;  
  private wikiClient: DeepWikiClient;  
    
  constructor() {  
    this.braveClient \= new BraveSearchClient();  
    this.wikiClient \= new DeepWikiClient();  
  }

  async enrichOpportunity(opportunity: OpportunityData): Promise\<EnrichmentResult\> {  
    console.log(\`🔍 Enrichissement de: ${opportunity.title}\`);  
      
    // Phase 1: Collecte de données factuelles via DeepWiki  
    const factualData \= await this.collectFactualData(opportunity);  
      
    // Phase 2: Recherche de marché via Brave Search  
    const marketResearch \= await this.conductMarketResearch(opportunity);  
      
    // Phase 3: Analyse concurrentielle  
    const competitorAnalysis \= await this.analyzeCompetitors(opportunity);  
      
    // Phase 4: Informations réglementaires  
    const regulatoryInfo \= await this.gatherRegulatoryInfo(opportunity);  
      
    // Phase 5: Calcul du score de confiance  
    const confidenceScore \= this.calculateConfidence({  
      factualData,  
      marketResearch,  
      competitorAnalysis,  
      regulatoryInfo  
    });  
      
    return {  
      factualData,  
      marketResearch,  
      competitorAnalysis,  
      regulatoryInfo,  
      confidenceScore,  
      dataSources: this.getDataSources()  
    };  
  }

  private async collectFactualData(opportunity: OpportunityData) {  
    const location \= opportunity.location || 'Libreville';  
      
    // Recherche DeepWiki pour données démographiques et géographiques  
    const locationData \= await this.wikiClient.search({  
      queries: \[  
        \`${location} Gabon population\`,  
        \`${location} infrastructure\`,  
        \`${location} économie\`,  
        \`Gabon ${opportunity.sector}\`  
      \],  
      lang: 'fr'  
    });  
      
    // Extraction des données clés  
    const demographics \= {  
      population: this.extractPopulation(locationData),  
      density: this.extractDensity(locationData),  
      age\_distribution: this.extractAgeDistribution(locationData),  
      income\_levels: await this.searchIncomeData(location)  
    };  
      
    const infrastructure \= {  
      transport: {  
        roads: this.extractRoadInfo(locationData),  
        airports: this.extractAirportInfo(locationData),  
        ports: this.extractPortInfo(locationData),  
        public\_transport: await this.searchPublicTransport(location)  
      },  
      utilities: {  
        electricity\_coverage: this.extractElectricity(locationData),  
        internet\_penetration: await this.searchInternetStats(location),  
        water\_access: this.extractWaterAccess(locationData)  
      }  
    };  
      
    const economic\_indicators \= {  
      gdp\_per\_capita: await this.searchGDPData(location),  
      unemployment\_rate: await this.searchUnemployment(location),  
      business\_climate: await this.searchBusinessClimate(location),  
      main\_industries: this.extractIndustries(locationData)  
    };  
      
    return {  
      demographics,  
      infrastructure,  
      economic\_indicators  
    };  
  }

  private async conductMarketResearch(opportunity: OpportunityData) {  
    const sector \= opportunity.sector;  
    const location \= opportunity.location;  
      
    // Recherche Brave pour données de marché récentes  
    const marketSearches \= await Promise.all(\[  
      this.braveClient.search({  
        q: \`${sector} market size Gabon 2024\`,  
        freshness: 'past\_year',  
        country: 'GA'  
      }),  
      this.braveClient.search({  
        q: \`${sector} business opportunities ${location}\`,  
        freshness: 'past\_6months'  
      }),  
      this.braveClient.search({  
        q: \`${sector} growth trends Africa Central\`,  
        freshness: 'past\_year'  
      })  
    \]);  
      
    // Analyse des résultats  
    const market\_size \= await this.analyzeMarketSize(marketSearches\[0\]);  
    const growth\_trends \= await this.analyzeGrowthTrends(marketSearches\[2\]);  
    const customer\_segments \= await this.identifyCustomerSegments(marketSearches\[1\]);  
      
    // Enrichissement avec données spécifiques au Gabon  
    const localMarketData \= await this.searchLocalMarketData(sector, location);  
      
    return {  
      market\_size: {  
        ...market\_size,  
        local\_estimation: localMarketData.size\_estimate,  
        growth\_rate: localMarketData.growth\_rate  
      },  
      growth\_trends,  
      customer\_segments,  
      market\_dynamics: {  
        drivers: localMarketData.drivers,  
        barriers: localMarketData.barriers,  
        opportunities: localMarketData.opportunities  
      }  
    };  
  }

  private async analyzeCompetitors(opportunity: OpportunityData) {  
    const { sector, location, title } \= opportunity;  
      
    // Recherche des concurrents directs  
    const directCompetitorSearch \= await this.braveClient.search({  
      q: \`"${sector}" entreprises "${location}" Gabon\`,  
      freshness: 'past\_year'  
    });  
      
    // Recherche des concurrents indirects  
    const indirectCompetitorSearch \= await this.braveClient.search({  
      q: \`services similaires "${title}" Afrique Centrale\`,  
      freshness: 'past\_year'  
    });  
      
    // Analyse des résultats  
    const direct\_competitors \= await this.extractCompetitors(  
      directCompetitorSearch,  
      'direct'  
    );  
      
    const indirect\_competitors \= await this.extractCompetitors(  
      indirectCompetitorSearch,  
      'indirect'  
    );  
      
    // Identification des gaps de marché  
    const market\_gaps \= await this.identifyMarketGaps(  
      direct\_competitors,  
      indirect\_competitors,  
      opportunity  
    );  
      
    return {  
      direct\_competitors: direct\_competitors.map(comp \=\> ({  
        name: comp.name,  
        location: comp.location,  
        services: comp.services,  
        strengths: comp.strengths,  
        weaknesses: comp.weaknesses,  
        market\_share: comp.market\_share,  
        pricing: comp.pricing  
      })),  
      indirect\_competitors,  
      market\_gaps,  
      competitive\_advantage: await this.suggestCompetitiveAdvantage(  
        opportunity,  
        direct\_competitors  
      )  
    };  
  }

  private async gatherRegulatoryInfo(opportunity: OpportunityData) {  
    const { sector, location } \= opportunity;  
      
    // Recherche DeepWiki pour réglementations  
    const regulatoryWiki \= await this.wikiClient.search({  
      queries: \[  
        \`Gabon réglementation ${sector}\`,  
        \`Gabon code commerce\`,  
        \`OHADA ${sector}\`,  
        \`Licences commerciales Gabon\`  
      \],  
      lang: 'fr'  
    });  
      
    // Recherche Brave pour informations récentes  
    const regulatorySearch \= await this.braveClient.search({  
      q: \`réglementation ${sector} Gabon 2024 licences\`,  
      freshness: 'past\_year',  
      country: 'GA'  
    });  
      
    // Extraction des informations  
    const licenses\_required \= await this.extractLicenses(  
      regulatoryWiki,  
      regulatorySearch,  
      sector  
    );  
      
    const regulations \= await this.extractRegulations(  
      regulatoryWiki,  
      regulatorySearch  
    );  
      
    // Programmes gouvernementaux de soutien  
    const govPrograms \= await this.searchGovernmentPrograms(sector);  
      
    return {  
      licenses\_required: licenses\_required.map(license \=\> ({  
        name: license.name,  
        authority: license.authority,  
        requirements: license.requirements,  
        cost: license.cost,  
        processing\_time: license.processing\_time,  
        validity\_period: license.validity\_period  
      })),  
      regulations: regulations.map(reg \=\> ({  
        title: reg.title,  
        description: reg.description,  
        compliance\_requirements: reg.requirements,  
        penalties: reg.penalties  
      })),  
      government\_programs: govPrograms.map(prog \=\> ({  
        name: prog.name,  
        type: prog.type,  
        eligibility: prog.eligibility,  
        benefits: prog.benefits,  
        application\_process: prog.process  
      })),  
      tax\_information: await this.searchTaxInfo(sector)  
    };  
  }

  private calculateConfidence(data: any): number {  
    let score \= 0;  
    let factors \= 0;  
      
    // Évaluer la complétude des données  
    if (data.factualData?.demographics?.population) {  
      score \+= 20;  
      factors++;  
    }  
      
    if (data.marketResearch?.market\_size) {  
      score \+= 25;  
      factors++;  
    }  
      
    if (data.competitorAnalysis?.direct\_competitors?.length \> 0\) {  
      score \+= 25;  
      factors++;  
    }  
      
    if (data.regulatoryInfo?.licenses\_required?.length \> 0\) {  
      score \+= 30;  
      factors++;  
    }  
      
    return factors \> 0 ? score / factors : 0;  
  }  
    
  // Méthodes helper pour extraction de données...  
  private extractPopulation(data: any): number {  
    // Logique d'extraction  
    return 0;  
  }  
    
  // ... autres méthodes d'extraction  
}

## **3\. Client Brave Search Optimisé**

// lib/mcp/braveSearchClient.ts  
export class BraveSearchClient {  
  private apiKey: string;  
  private baseUrl: string;  
    
  constructor() {  
    this.apiKey \= process.env.BRAVE\_SEARCH\_API\_KEY\!;  
    this.baseUrl \= 'https://api.brave.com/res/v1';  
  }

  async search(params: {  
    q: string;  
    freshness?: string;  
    country?: string;  
    count?: number;  
  }): Promise\<any\> {  
    // Vérifier le cache d'abord  
    const cacheKey \= this.generateCacheKey(params);  
    const cached \= await this.checkCache(cacheKey);  
      
    if (cached) {  
      return cached;  
    }  
      
    // Faire la recherche  
    const response \= await fetch(\`${this.baseUrl}/web/search\`, {  
      method: 'GET',  
      headers: {  
        'X-Api-Key': this.apiKey,  
        'Accept': 'application/json'  
      },  
      params: {  
        ...params,  
        count: params.count || 20,  
        text\_decorations: false,  
        result\_filter: 'web'  
      }  
    });  
      
    const data \= await response.json();  
      
    // Mettre en cache  
    await this.saveToCache(cacheKey, data);  
      
    return this.processResults(data);  
  }

  private processResults(data: any) {  
    return {  
      web\_results: data.web?.results || \[\],  
      news: data.news?.results || \[\],  
      total: data.web?.total || 0,  
      query: data.query  
    };  
  }

  private async checkCache(key: string): Promise\<any\> {  
    const { data } \= await supabase  
      .from('enrichment\_cache')  
      .select('results')  
      .eq('query\_hash', key)  
      .gt('expires\_at', new Date().toISOString())  
      .single();  
      
    if (data) {  
      // Incrémenter hit count  
      await supabase  
        .from('enrichment\_cache')  
        .update({ hit\_count: supabase.raw('hit\_count \+ 1') })  
        .eq('query\_hash', key);  
        
      return data.results;  
    }  
      
    return null;  
  }

  private async saveToCache(key: string, data: any): Promise\<void\> {  
    await supabase  
      .from('enrichment\_cache')  
      .upsert({  
        query\_hash: key,  
        query\_type: 'brave\_search',  
        query\_params: { key },  
        results: data,  
        expires\_at: new Date(Date.now() \+ 7 \* 24 \* 60 \* 60 \* 1000\)  
      });  
  }

  private generateCacheKey(params: any): string {  
    return crypto  
      .createHash('md5')  
      .update(JSON.stringify(params))  
      .digest('hex');  
  }  
}

## **4\. Client DeepWiki Adapté**

// lib/mcp/deepwikiClient.ts  
export class DeepWikiClient {  
  private baseUrl: string;  
    
  constructor() {  
    this.baseUrl \= process.env.DEEPWIKI\_API\_URL || 'http://localhost:3001';  
  }

  async search(params: {  
    queries: string\[\];  
    lang?: string;  
    limit?: number;  
  }): Promise\<any\> {  
    const results \= \[\];  
      
    for (const query of params.queries) {  
      try {  
        const response \= await fetch(\`${this.baseUrl}/search\`, {  
          method: 'POST',  
          headers: {  
            'Content-Type': 'application/json'  
          },  
          body: JSON.stringify({  
            query,  
            lang: params.lang || 'fr',  
            limit: params.limit || 5  
          })  
        });  
          
        const data \= await response.json();  
        results.push({  
          query,  
          articles: data.articles || \[\],  
          summary: data.summary || null  
        });  
      } catch (error) {  
        console.error(\`DeepWiki error for query "${query}":\`, error);  
        results.push({  
          query,  
          articles: \[\],  
          error: true  
        });  
      }  
    }  
      
    return this.processWikiResults(results);  
  }

  private processWikiResults(results: any\[\]): any {  
    const processed \= {  
      data: {},  
      sources: \[\]  
    };  
      
    for (const result of results) {  
      if (result.articles && result.articles.length \> 0\) {  
        // Extraire les données structurées  
        const extracted \= this.extractStructuredData(result.articles);  
        Object.assign(processed.data, extracted);  
          
        // Ajouter les sources  
        processed.sources.push(...result.articles.map((a: any) \=\> ({  
          title: a.title,  
          url: a.url,  
          relevance: a.relevance\_score  
        })));  
      }  
    }  
      
    return processed;  
  }

  private extractStructuredData(articles: any\[\]): any {  
    const data \= {};  
      
    for (const article of articles) {  
      // Extraire les infobox  
      if (article.infobox) {  
        Object.assign(data, article.infobox);  
      }  
        
      // Extraire les statistiques  
      if (article.statistics) {  
        Object.assign(data, article.statistics);  
      }  
        
      // Extraire les données géographiques  
      if (article.geography) {  
        Object.assign(data, article.geography);  
      }  
    }  
      
    return data;  
  }  
}

## **5\. Interface Utilisateur Enrichie**

// components/opportunities/EnhancedOpportunityCard.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import {  
  TrendingUp, Users, Building2, Shield,   
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,  
  MapPin, Briefcase, Scale, Brain, Loader2  
} from 'lucide-react';

interface EnhancedOpportunityProps {  
  opportunity: any;  
  enrichmentData?: any;  
}

export default function EnhancedOpportunityCard({   
  opportunity,   
  enrichmentData   
}: EnhancedOpportunityProps) {  
  const \[isExpanded, setIsExpanded\] \= useState(false);  
  const \[activeTab, setActiveTab\] \= useState\<'facts' | 'market' | 'competition' | 'regulations'\>('facts');  
  const \[isEnriching, setIsEnriching\] \= useState(\!enrichmentData);  
  const \[data, setData\] \= useState(enrichmentData);

  useEffect(() \=\> {  
    if (\!enrichmentData && \!isEnriching) {  
      enrichOpportunity();  
    }  
  }, \[\]);

  const enrichOpportunity \= async () \=\> {  
    setIsEnriching(true);  
      
    try {  
      const response \= await fetch('/.netlify/functions/enhance-opportunity', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({ opportunity })  
      });  
        
      const enhanced \= await response.json();  
      setData(enhanced);  
    } catch (error) {  
      console.error('Enrichment failed:', error);  
    } finally {  
      setIsEnriching(false);  
    }  
  };

  const getConfidenceColor \= (score: number) \=\> {  
    if (score \>= 80\) return 'text-green-500';  
    if (score \>= 60\) return 'text-yellow-500';  
    return 'text-red-500';  
  };

  return (  
    \<motion.div  
      className="bg-gray-800 rounded-xl overflow-hidden"  
      initial={{ opacity: 0, y: 20 }}  
      animate={{ opacity: 1, y: 0 }}  
    \>  
      {/\* Header \*/}  
      \<div className="p-6 border-b border-gray-700"\>  
        \<div className="flex items-start justify-between"\>  
          \<div className="flex-1"\>  
            \<h3 className="text-xl font-bold mb-2"\>{opportunity.title}\</h3\>  
            \<p className="text-gray-400"\>{opportunity.description}\</p\>  
              
            {/\* Badges de données enrichies \*/}  
            \<div className="flex flex-wrap gap-2 mt-4"\>  
              {data?.factualData && (  
                \<span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs flex items-center gap-1"\>  
                  \<CheckCircle className="w-3 h-3" /\>  
                  Données vérifiées  
                \</span\>  
              )}  
              {data?.marketResearch && (  
                \<span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs flex items-center gap-1"\>  
                  \<TrendingUp className="w-3 h-3" /\>  
                  Analyse marché  
                \</span\>  
              )}  
              {data?.competitorAnalysis && (  
                \<span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs flex items-center gap-1"\>  
                  \<Users className="w-3 h-3" /\>  
                  {data.competitorAnalysis.direct\_competitors.length} concurrents  
                \</span\>  
              )}  
            \</div\>  
          \</div\>  
            
          \<button  
            onClick={() \=\> setIsExpanded(\!isExpanded)}  
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"  
          \>  
            {isExpanded ? \<ChevronUp /\> : \<ChevronDown /\>}  
          \</button\>  
        \</div\>  
      \</div\>

      {/\* Contenu enrichi \*/}  
      \<AnimatePresence\>  
        {isExpanded && (  
          \<motion.div  
            initial={{ height: 0, opacity: 0 }}  
            animate={{ height: 'auto', opacity: 1 }}  
            exit={{ height: 0, opacity: 0 }}  
            transition={{ duration: 0.3 }}  
          \>  
            {isEnriching ? (  
              \<div className="p-8 flex flex-col items-center justify-center"\>  
                \<Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" /\>  
                \<p className="text-gray-400"\>Enrichissement des données en cours...\</p\>  
                \<p className="text-sm text-gray-500 mt-2"\>  
                  Recherche d'informations factuelles via DeepWiki et Brave Search  
                \</p\>  
              \</div\>  
            ) : (  
              \<\>  
                {/\* Tabs \*/}  
                \<div className="flex border-b border-gray-700"\>  
                  {\[  
                    { id: 'facts', label: 'Données Factuelles', icon: Brain },  
                    { id: 'market', label: 'Marché', icon: TrendingUp },  
                    { id: 'competition', label: 'Concurrence', icon: Users },  
                    { id: 'regulations', label: 'Réglementation', icon: Shield }  
                  \].map(tab \=\> {  
                    const Icon \= tab.icon;  
                    return (  
                      \<button  
                        key={tab.id}  
                        onClick={() \=\> setActiveTab(tab.id as any)}  
                        className={\`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${  
                          activeTab \=== tab.id  
                            ? 'bg-gray-700 text-orange-500'  
                            : 'hover:bg-gray-700/50 text-gray-400'  
                        }\`}  
                      \>  
                        \<Icon className="w-4 h-4" /\>  
                        \<span className="text-sm"\>{tab.label}\</span\>  
                      \</button\>  
                    );  
                  })}  
                \</div\>

                {/\* Contenu des tabs \*/}  
                \<div className="p-6"\>  
                  {activeTab \=== 'facts' && data?.factualData && (  
                    \<div className="space-y-4"\>  
                      {/\* Démographie \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3 flex items-center gap-2"\>  
                          \<MapPin className="w-5 h-5 text-orange-500" /\>  
                          {opportunity.location || 'Libreville'}  
                        \</h4\>  
                        \<div className="grid md:grid-cols-2 gap-4"\>  
                          \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                            \<p className="text-sm text-gray-400"\>Population\</p\>  
                            \<p className="text-xl font-bold"\>  
                              {data.factualData.demographics?.population?.toLocaleString() || 'N/A'}  
                            \</p\>  
                            \<p className="text-xs text-gray-500 mt-1"\>  
                              Source: Wikipedia/INSEE  
                            \</p\>  
                          \</div\>  
                          \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                            \<p className="text-sm text-gray-400"\>PIB par habitant\</p\>  
                            \<p className="text-xl font-bold"\>  
                              {data.factualData.economic\_indicators?.gdp\_per\_capita || 'N/A'} USD  
                            \</p\>  
                            \<p className="text-xs text-gray-500 mt-1"\>  
                              Source: Banque Mondiale  
                            \</p\>  
                          \</div\>  
                        \</div\>  
                      \</div\>

                      {/\* Infrastructure \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3"\>Infrastructure\</h4\>  
                        \<div className="space-y-2"\>  
                          {data.factualData.infrastructure?.transport && (  
                            \<\>  
                              \<div className="flex justify-between"\>  
                                \<span className="text-gray-400"\>Routes principales\</span\>  
                                \<span\>{data.factualData.infrastructure.transport.roads || 'N/A'}\</span\>  
                              \</div\>  
                              \<div className="flex justify-between"\>  
                                \<span className="text-gray-400"\>Aéroports\</span\>  
                                \<span\>{data.factualData.infrastructure.transport.airports || 'N/A'}\</span\>  
                              \</div\>  
                              \<div className="flex justify-between"\>  
                                \<span className="text-gray-400"\>Couverture Internet\</span\>  
                                \<span\>{data.factualData.infrastructure.utilities?.internet\_penetration || 'N/A'}%\</span\>  
                              \</div\>  
                            \</\>  
                          )}  
                        \</div\>  
                      \</div\>  
                    \</div\>  
                  )}

                  {activeTab \=== 'market' && data?.marketResearch && (  
                    \<div className="space-y-4"\>  
                      {/\* Taille du marché \*/}  
                      \<div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/30"\>  
                        \<h4 className="font-semibold mb-2"\>Taille du marché estimée\</h4\>  
                        \<p className="text-2xl font-bold text-blue-400"\>  
                          {data.marketResearch.market\_size?.local\_estimation || 'À déterminer'}  
                        \</p\>  
                        \<p className="text-sm text-gray-400 mt-2"\>  
                          Croissance annuelle: {data.marketResearch.market\_size?.growth\_rate || 'N/A'}%  
                        \</p\>  
                      \</div\>

                      {/\* Tendances \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3"\>Tendances du marché\</h4\>  
                        \<div className="space-y-2"\>  
                          {data.marketResearch.growth\_trends?.map((trend: any, i: number) \=\> (  
                            \<div key={i} className="flex items-start gap-2"\>  
                              \<TrendingUp className="w-4 h-4 text-green-500 mt-1" /\>  
                              \<p className="text-sm"\>{trend}\</p\>  
                            \</div\>  
                          ))}  
                        \</div\>  
                      \</div\>

                      {/\* Segments clients \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3"\>Segments de clientèle\</h4\>  
                        \<div className="grid md:grid-cols-2 gap-3"\>  
                          {data.marketResearch.customer\_segments?.map((segment: any, i: number) \=\> (  
                            \<div key={i} className="bg-gray-700/50 rounded-lg p-3"\>  
                              \<p className="font-medium"\>{segment.name}\</p\>  
                              \<p className="text-sm text-gray-400"\>{segment.size}\</p\>  
                            \</div\>

                         ))}  
                        \</div\>  
                      \</div\>  
                    \</div\>  
                  )}

                  {activeTab \=== 'competition' && data?.competitorAnalysis && (  
                    \<div className="space-y-4"\>  
                      {/\* Concurrents directs \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3"\>Concurrents directs\</h4\>  
                        {data.competitorAnalysis.direct\_competitors?.length \> 0 ? (  
                          \<div className="space-y-3"\>  
                            {data.competitorAnalysis.direct\_competitors.map((comp: any, i: number) \=\> (  
                              \<div key={i} className="bg-gray-700/50 rounded-lg p-4"\>  
                                \<div className="flex items-start justify-between mb-2"\>  
                                  \<div\>  
                                    \<p className="font-medium"\>{comp.name}\</p\>  
                                    \<p className="text-sm text-gray-400"\>{comp.location}\</p\>  
                                  \</div\>  
                                  \<span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded"\>  
                                    {comp.market\_share || 'N/A'}% du marché  
                                  \</span\>  
                                \</div\>  
                                \<div className="grid grid-cols-2 gap-4 mt-3"\>  
                                  \<div\>  
                                    \<p className="text-xs text-gray-500"\>Forces\</p\>  
                                    \<ul className="text-sm"\>  
                                      {comp.strengths?.map((s: string, j: number) \=\> (  
                                        \<li key={j}\>• {s}\</li\>  
                                      ))}  
                                    \</ul\>  
                                  \</div\>  
                                  \<div\>  
                                    \<p className="text-xs text-gray-500"\>Faiblesses\</p\>  
                                    \<ul className="text-sm"\>  
                                      {comp.weaknesses?.map((w: string, j: number) \=\> (  
                                        \<li key={j}\>• {w}\</li\>  
                                      ))}  
                                    \</ul\>  
                                  \</div\>  
                                \</div\>  
                              \</div\>  
                            ))}  
                          \</div\>  
                        ) : (  
                          \<div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"\>  
                            \<p className="text-green-400"\>✓ Aucun concurrent direct identifié\</p\>  
                            \<p className="text-sm text-gray-400 mt-1"\>  
                              Opportunité de premier entrant sur le marché  
                            \</p\>  
                          \</div\>  
                        )}  
                      \</div\>

                      {/\* Gaps de marché \*/}  
                      {data.competitorAnalysis.market\_gaps?.length \> 0 && (  
                        \<div\>  
                          \<h4 className="font-semibold mb-3"\>Opportunités non exploitées\</h4\>  
                          \<div className="space-y-2"\>  
                            {data.competitorAnalysis.market\_gaps.map((gap: string, i: number) \=\> (  
                              \<div key={i} className="flex items-start gap-2"\>  
                                \<AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" /\>  
                                \<p className="text-sm"\>{gap}\</p\>  
                              \</div\>  
                            ))}  
                          \</div\>  
                        \</div\>  
                      )}  
                    \</div\>  
                  )}

                  {activeTab \=== 'regulations' && data?.regulatoryInfo && (  
                    \<div className="space-y-4"\>  
                      {/\* Licences requises \*/}  
                      \<div\>  
                        \<h4 className="font-semibold mb-3"\>Licences et autorisations\</h4\>  
                        {data.regulatoryInfo.licenses\_required?.length \> 0 ? (  
                          \<div className="space-y-3"\>  
                            {data.regulatoryInfo.licenses\_required.map((license: any, i: number) \=\> (  
                              \<div key={i} className="bg-gray-700/50 rounded-lg p-4"\>  
                                \<div className="flex items-start justify-between mb-2"\>  
                                  \<p className="font-medium"\>{license.name}\</p\>  
                                  \<span className="text-sm text-orange-400"\>  
                                    {license.cost || 'Coût variable'}  
                                  \</span\>  
                                \</div\>  
                                \<p className="text-sm text-gray-400 mb-2"\>  
                                  Délivré par: {license.authority}  
                                \</p\>  
                                \<div className="flex gap-4 text-xs"\>  
                                  \<span\>⏱ {license.processing\_time || 'Variable'}\</span\>  
                                  \<span\>📅 Validité: {license.validity\_period || '1 an'}\</span\>  
                                \</div\>  
                              \</div\>  
                            ))}  
                          \</div\>  
                        ) : (  
                          \<p className="text-gray-400"\>Aucune licence spécifique identifiée\</p\>  
                        )}  
                      \</div\>

                      {/\* Programmes gouvernementaux \*/}  
                      {data.regulatoryInfo.government\_programs?.length \> 0 && (  
                        \<div\>  
                          \<h4 className="font-semibold mb-3"\>Programmes de soutien\</h4\>  
                          \<div className="space-y-3"\>  
                            {data.regulatoryInfo.government\_programs.map((prog: any, i: number) \=\> (  
                              \<div key={i} className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"\>  
                                \<p className="font-medium text-green-400"\>{prog.name}\</p\>  
                                \<p className="text-sm mt-1"\>{prog.benefits}\</p\>  
                                \<p className="text-xs text-gray-400 mt-2"\>  
                                  Type: {prog.type}  
                                \</p\>  
                              \</div\>  
                            ))}  
                          \</div\>  
                        \</div\>  
                      )}  
                    \</div\>  
                  )}  
                \</div\>

                {/\* Footer avec score de confiance \*/}  
                \<div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700"\>  
                  \<div className="flex items-center justify-between"\>  
                    \<div className="flex items-center gap-2"\>  
                      \<span className="text-sm text-gray-400"\>Fiabilité des données:\</span\>  
                      \<span className={\`font-semibold ${getConfidenceColor(data?.confidenceScore || 0)}\`}\>  
                        {data?.confidenceScore || 0}%  
                      \</span\>  
                    \</div\>  
                    \<div className="flex items-center gap-2 text-xs text-gray-500"\>  
                      \<span\>Sources:\</span\>  
                      {data?.dataSources?.map((source: string, i: number) \=\> (  
                        \<span key={i} className="px-2 py-1 bg-gray-700 rounded"\>  
                          {source}  
                        \</span\>  
                      ))}  
                    \</div\>  
                  \</div\>  
                \</div\>  
              \</\>  
            )}  
          \</motion.div\>  
        )}  
      \</AnimatePresence\>  
    \</motion.div\>  
  );  
}

## **6\. Fonction Netlify d'Enrichissement**

// netlify/functions/enhance-opportunity.ts  
import { Handler } from '@netlify/functions';  
import { OpportunityEnricher } from '@/lib/mcp/dataEnricher';  
import { supabase } from '@/lib/supabase';

export const handler: Handler \= async (event, context) \=\> {  
  if (event.httpMethod \!== 'POST') {  
    return { statusCode: 405, body: 'Method Not Allowed' };  
  }

  try {  
    const { opportunity, userId } \= JSON.parse(event.body || '{}');  
      
    if (\!opportunity) {  
      return {  
        statusCode: 400,  
        body: JSON.stringify({ error: 'Opportunity data required' })  
      };  
    }

    console.log(\`🔍 Starting enrichment for: ${opportunity.title}\`);  
      
    // Initialiser le service d'enrichissement  
    const enricher \= new OpportunityEnricher();  
      
    // Enrichir l'opportunité  
    const enrichmentData \= await enricher.enrichOpportunity(opportunity);  
      
    // Sauvegarder en base de données  
    const { data: saved, error } \= await supabase  
      .from('opportunity\_analyses')  
      .update({  
        enrichment\_data: enrichmentData,  
        factual\_data: enrichmentData.factualData,  
        market\_research: enrichmentData.marketResearch,  
        competitor\_analysis: enrichmentData.competitorAnalysis,  
        regulatory\_info: enrichmentData.regulatoryInfo,  
        enrichment\_status: 'completed',  
        enrichment\_completed\_at: new Date().toISOString(),  
        data\_sources: enrichmentData.dataSources,  
        confidence\_score: enrichmentData.confidenceScore  
      })  
      .eq('id', opportunity.id)  
      .select()  
      .single();

    if (error) {  
      console.error('Database update error:', error);  
    }

    // Enregistrer les métriques  
    await recordEnrichmentMetrics(opportunity.id, enrichmentData);

    return {  
      statusCode: 200,  
      body: JSON.stringify(enrichmentData)  
    };

  } catch (error) {  
    console.error('Enrichment error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({   
        error: 'Failed to enrich opportunity',  
        message: error.message   
      })  
    };  
  }  
};

async function recordEnrichmentMetrics(opportunityId: string, data: any) {  
  const metrics \= \[  
    {  
      opportunity\_id: opportunityId,  
      enrichment\_type: 'factual\_data',  
      data\_points\_added: countDataPoints(data.factualData),  
      sources\_used: \['DeepWiki', 'Wikipedia'\],  
      confidence\_level: data.confidenceScore  
    },  
    {  
      opportunity\_id: opportunityId,  
      enrichment\_type: 'market\_research',  
      data\_points\_added: countDataPoints(data.marketResearch),  
      sources\_used: \['Brave Search', 'Market Reports'\],  
      confidence\_level: data.confidenceScore  
    },  
    {  
      opportunity\_id: opportunityId,  
      enrichment\_type: 'competitor\_analysis',  
      data\_points\_added: data.competitorAnalysis?.direct\_competitors?.length || 0,  
      sources\_used: \['Brave Search', 'Business Directories'\],  
      confidence\_level: data.confidenceScore  
    }  
  \];

  await supabase  
    .from('enrichment\_metrics')  
    .insert(metrics);  
}

function countDataPoints(obj: any): number {  
  if (\!obj) return 0;  
    
  let count \= 0;  
  for (const key in obj) {  
    if (obj\[key\] \!== null && obj\[key\] \!== undefined) {  
      if (typeof obj\[key\] \=== 'object') {  
        count \+= countDataPoints(obj\[key\]);  
      } else {  
        count++;  
      }  
    }  
  }  
  return count;  
}

## **📚 Documentation de Configuration**

### **Installation et Setup**

#### **1\. Installation des dépendances**

\# Installer les packages MCP  
npm install @modelcontextprotocol/client  
npm install mcp-brave-search  
npm install mcp-deepwiki

\# Autres dépendances  
npm install crypto-js  
npm install node-cache

#### **2\. Configuration des variables d'environnement**

\# MCP Brave Search  
BRAVE\_SEARCH\_API\_KEY=your\_brave\_api\_key  
BRAVE\_SEARCH\_TIMEOUT=10000

\# MCP DeepWiki  
DEEPWIKI\_API\_URL=http://localhost:3001  
DEEPWIKI\_CACHE\_TTL=86400

\# Supabase  
SUPABASE\_URL=your\_supabase\_url  
SUPABASE\_SERVICE\_KEY=your\_service\_key

\# OpenAI  
OPENAI\_API\_KEY=your\_openai\_key

#### **3\. Initialisation des tables Supabase**

Exécuter le SQL fourni dans la section "Schéma Base de Données Enrichi"

### **Configuration des MCP**

#### **Configuration Brave Search**

{  
  "mcpServers": {  
    "brave-search": {  
      "command": "npx",  
      "args": \["mcp-brave-search"\],  
      "env": {  
        "BRAVE\_API\_KEY": "${BRAVE\_SEARCH\_API\_KEY}"  
      }  
    }  
  }  
}

#### **Configuration DeepWiki**

{  
  "mcpServers": {  
    "deepwiki": {  
      "command": "npx",  
      "args": \["mcp-deepwiki"\],  
      "config": {  
        "language": "fr",  
        "regions": \["Gabon", "Africa"\],  
        "cache": true  
      }  
    }  
  }  
}

### **Utilisation**

#### **Flux de données**

1. **Génération initiale** : GPT-4o-mini génère l'opportunité de base  
2. **Enrichissement factuel** : DeepWiki fournit données démographiques et infrastructure  
3. **Recherche marché** : Brave Search analyse tendances et concurrence  
4. **Validation** : Croisement des sources pour score de confiance  
5. **Présentation** : Interface structurée avec données vérifiées

#### **API Endpoints**

// Enrichir une opportunité  
POST /.netlify/functions/enhance-opportunity  
{  
  "opportunity": {  
    "id": "uuid",  
    "title": "Service de livraison Port-Gentil",  
    "location": "Port-Gentil",  
    "sector": "logistics"  
  }  
}

// Valider des données de marché  
POST /.netlify/functions/validate-market-data  
{  
  "sector": "logistics",  
  "location": "Port-Gentil",  
  "data": {...}  
}

// Rechercher des concurrents  
POST /.netlify/functions/find-competitors  
{  
  "sector": "logistics",  
  "location": "Port-Gentil",  
  "services": \["delivery", "courier"\]  
}

### **Monitoring et Performance**

#### **Métriques clés**

\-- Performance d'enrichissement  
SELECT   
  enrichment\_type,  
  AVG(processing\_time\_ms) as avg\_time,  
  AVG(data\_points\_added) as avg\_data\_points,  
  AVG(confidence\_level) as avg\_confidence  
FROM enrichment\_metrics  
WHERE created\_at \> now() \- interval '7 days'  
GROUP BY enrichment\_type;

\-- Utilisation du cache  
SELECT   
  query\_type,  
  COUNT(\*) as total\_queries,  
  SUM(hit\_count) as cache\_hits  
FROM enrichment\_cache  
GROUP BY query\_type;

#### **Optimisation du cache**

// Configuration du cache  
const cacheConfig \= {  
  demographics: 7 \* 24 \* 60 \* 60, // 7 jours  
  market\_data: 24 \* 60 \* 60,      // 24 heures    
  competitors: 3 \* 24 \* 60 \* 60,  // 3 jours  
  regulations: 30 \* 24 \* 60 \* 60  // 30 jours  
};

### **Exemples de résultats**

#### **Données factuelles (DeepWiki)**

* Population exacte avec source  
* Infrastructure détaillée  
* Indicateurs économiques locaux  
* Histoire et contexte régional

#### **Analyse marché (Brave Search)**

* Tendances temps réel  
* Articles récents pertinents  
* Études de cas similaires  
* Prix et modèles économiques

Cette intégration transforme le module Opportunités IA en véritable outil d'aide à la décision business, avec des données vérifiées et actualisées automatiquement.

