'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  MapPin, 
  BarChart3, 
  Crown, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';

interface EnrichmentData {
  status: string;
  level: string;
  factual_data?: {
    demographics?: any;
    infrastructure?: any;
    economic_indicators?: any;
  };
  market_research?: {
    market_size?: any;
    growth_trends?: string[];
    customer_segments?: any[];
  };
  confidence_score?: number;
  data_sources: string[];
  upgrade_available: boolean;
  upgrade_message?: string;
}

interface EnrichmentDisplayProps {
  enrichment: EnrichmentData | null;
  isEnriching: boolean;
  error: string | null;
  onUpgrade?: () => void;
}

export default function EnrichmentDisplay({ 
  enrichment, 
  isEnriching, 
  error, 
  onUpgrade 
}: EnrichmentDisplayProps) {
  if (isEnriching) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-6 mb-6"
      >
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mr-3" />
          <div>
            <h3 className="font-semibold text-gray-900">Enrichissement en cours...</h3>
            <p className="text-sm text-gray-600">
              Collecte de données via MCP Brave Search et DeepWiki
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6"
      >
        <div className="flex items-center">
          <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
          <div>
            <h3 className="font-semibold text-red-900">Erreur d'enrichissement</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!enrichment) {
    return null;
  }

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceBadge = (score?: number) => {
    if (!score) return { text: 'Non évalué', color: 'bg-gray-100 text-gray-600' };
    if (score >= 80) return { text: 'Élevée', color: 'bg-green-100 text-green-700' };
    if (score >= 60) return { text: 'Moyenne', color: 'bg-yellow-100 text-yellow-700' };
    return { text: 'Faible', color: 'bg-red-100 text-red-700' };
  };

  const confidence = getConfidenceBadge(enrichment.confidence_score);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Données d'enrichissement MCP
              </h3>
              <p className="text-sm text-gray-600">
                Analyse enrichie via Brave Search et DeepWiki
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {enrichment.level === 'premium' && (
              <span className="flex items-center px-3 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-700 rounded-full text-sm font-medium">
                <Crown className="w-4 h-4 mr-1" />
                Premium
              </span>
            )}
            
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${confidence.color}`}>
              <BarChart3 className="w-4 h-4 mr-1 inline" />
              Confiance {confidence.text}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Données factuelles */}
          {enrichment.factual_data && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center">
                <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                Données factuelles
              </h4>
              
              {enrichment.factual_data.demographics && (
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">Démographie</h5>
                  <div className="space-y-1 text-sm">
                    {enrichment.factual_data.demographics.population && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Population:</span>
                        <span className="font-medium">
                          {typeof enrichment.factual_data.demographics.population === 'number' 
                            ? enrichment.factual_data.demographics.population.toLocaleString()
                            : enrichment.factual_data.demographics.population}
                        </span>
                      </div>
                    )}
                    {enrichment.factual_data.demographics.density && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Densité:</span>
                        <span className="font-medium">{enrichment.factual_data.demographics.density}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {enrichment.factual_data.economic_indicators && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">Économie</h5>
                  <div className="space-y-1 text-sm">
                    {enrichment.factual_data.economic_indicators.currency && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Devise:</span>
                        <span className="font-medium">{enrichment.factual_data.economic_indicators.currency}</span>
                      </div>
                    )}
                    {enrichment.factual_data.economic_indicators.main_economy && (
                      <div>
                        <span className="text-gray-600">Secteurs clés:</span>
                        <p className="font-medium mt-1">{enrichment.factual_data.economic_indicators.main_economy}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recherche de marché */}
          {enrichment.market_research && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                Analyse de marché
              </h4>

              {enrichment.market_research.market_size && (
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">Taille du marché</h5>
                  <p className="text-sm font-medium text-blue-600">
                    {enrichment.market_research.market_size.estimated_value || 'À évaluer'}
                  </p>
                  {enrichment.market_research.market_size.basis && (
                    <p className="text-xs text-gray-500 mt-1">
                      {enrichment.market_research.market_size.basis}
                    </p>
                  )}
                </div>
              )}

              {enrichment.market_research.growth_trends && enrichment.market_research.growth_trends.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">Tendances de croissance</h5>
                  <div className="space-y-2">
                    {enrichment.market_research.growth_trends.slice(0, 3).map((trend, index) => (
                      <div key={index} className="flex items-start">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{trend}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {enrichment.market_research.customer_segments && enrichment.market_research.customer_segments.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">Segments clients</h5>
                  <div className="space-y-2">
                    {enrichment.market_research.customer_segments.slice(0, 3).map((segment, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-blue-500 mr-2" />
                          <span className="text-sm font-medium">{segment.name}</span>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {segment.potential || segment.size || 'À évaluer'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sources et upgrade */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-sm text-gray-700 mb-1">Sources de données</h5>
              {enrichment.data_sources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {enrichment.data_sources.map((source, index) => (
                    <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {source}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Sources simulées (DeepWiki, Brave Search)</p>
              )}
            </div>

            {enrichment.upgrade_available && onUpgrade && (
              <button
                onClick={onUpgrade}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Premium
              </button>
            )}
          </div>

          {enrichment.upgrade_message && enrichment.level === 'basic' && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <Zap className="w-5 h-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Version Premium disponible</p>
                  <p className="text-xs text-yellow-700 mt-1">{enrichment.upgrade_message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
