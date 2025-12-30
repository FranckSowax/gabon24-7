'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Building2, Shield,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,
  MapPin, Briefcase, Scale, Brain, Loader2, Crown,
  ExternalLink, BarChart3, Target, Zap, GraduationCap
} from 'lucide-react';
import { TrainingAccessButton } from '@/components/training';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EnhancedOpportunityProps {
  opportunity: any;
  enrichmentData?: any;
  onUpgrade?: () => void;
  showUpgrade?: boolean;
}

export default function EnhancedOpportunityCard({ 
  opportunity, 
  enrichmentData,
  onUpgrade,
  showUpgrade = true
}: EnhancedOpportunityProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'facts' | 'market' | 'competition' | 'regulations' | 'formation'>('facts');
  const [isEnriching, setIsEnriching] = useState(!enrichmentData);
  const [data, setData] = useState(enrichmentData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enrichmentData && !isEnriching) {
      enrichOpportunity();
    }
  }, []);

  const enrichOpportunity = async (level: 'basic' | 'premium' = 'basic') => {
    setIsEnriching(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/opportunities/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          opportunityId: opportunity.id,
          enrichmentLevel: level,
          userId: 'demo-user' // À remplacer par l'ID utilisateur réel
        })
      });
      
      if (response.status === 402) {
        const errorData = await response.json();
        setError(`Crédits insuffisants: ${errorData.required_credits} crédits requis`);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      
      const enhanced = await response.json();
      setData(enhanced);
    } catch (error) {
      console.error('Enrichment failed:', error);
      setError('Enrichissement temporairement indisponible');
    } finally {
      setIsEnriching(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 80) return { text: 'Élevée', color: 'bg-green-500/20 text-green-400' };
    if (score >= 60) return { text: 'Moyenne', color: 'bg-yellow-500/20 text-yellow-400' };
    return { text: 'Faible', color: 'bg-red-500/20 text-red-400' };
  };

  const isPremium = data?.enrichment_level === 'premium';
  const isBasic = data?.enrichment_level === 'basic';
  const confidence = getConfidenceBadge(data?.confidence_score || 0);

  return (
    <motion.div
      className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold">{opportunity.opportunity_title || opportunity.title}</h3>
              {isPremium && (
                <span className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 rounded-lg text-xs">
                  <Crown className="w-3 h-3" />
                  Premium
                </span>
              )}
            </div>
            
            <p className="text-gray-400 mb-3">
              {opportunity.opportunity_description || opportunity.description}
            </p>
            
            {/* Badges de données enrichies */}
            <div className="flex flex-wrap gap-2 mb-3">
              {data?.factual_data && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Données vérifiées
                </span>
              )}
              {data?.market_research && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Analyse marché
                </span>
              )}
              {data?.competitor_analysis?.direct_competitors && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {data.competitor_analysis.direct_competitors.length} concurrents
                </span>
              )}
              {data?.confidence_score && (
                <span className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${confidence.color}`}>
                  <BarChart3 className="w-3 h-3" />
                  Confiance {confidence.text}
                </span>
              )}
            </div>

            {/* Secteur et localisation */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {opportunity.category || 'Secteur général'}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {opportunity.location || 'Libreville'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Bouton upgrade si basic */}
            {isBasic && showUpgrade && onUpgrade && (
              <button
                onClick={onUpgrade}
                className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Crown className="w-3 h-3" />
                Upgrade
              </button>
            )}
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>
        </div>
      </div>

      {/* Contenu enrichi */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isEnriching ? (
              <div className="p-8 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" />
                <p className="text-gray-400">Enrichissement des données en cours...</p>
                <p className="text-sm text-gray-500 mt-2">
                  Recherche d'informations via MCP Brave Search et DeepWiki
                </p>
              </div>
            ) : error ? (
              <div className="p-8 flex flex-col items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
                <p className="text-red-400 mb-2">{error}</p>
                <button
                  onClick={() => enrichOpportunity('basic')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-700 overflow-x-auto">
                  {[
                    { id: 'facts', label: 'Données Factuelles', icon: Brain },
                    { id: 'market', label: 'Marché', icon: TrendingUp },
                    { id: 'competition', label: 'Concurrence', icon: Users },
                    { id: 'regulations', label: 'Réglementation', icon: Shield },
                    { id: 'formation', label: 'Formation', icon: GraduationCap }
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isLocked = !isPremium && (tab.id === 'competition' || tab.id === 'regulations');
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => !isLocked && setActiveTab(tab.id as any)}
                        disabled={isLocked}
                        className={`flex-1 min-w-fit px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                          activeTab === tab.id
                            ? 'bg-gray-700 text-orange-500'
                            : isLocked
                            ? 'text-gray-600 cursor-not-allowed'
                            : 'hover:bg-gray-700/50 text-gray-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{tab.label}</span>
                        {isLocked && <Crown className="w-3 h-3 text-yellow-500" />}
                      </button>
                    );
                  })}
                </div>

                {/* Contenu des tabs */}
                <div className="p-6">
                  {activeTab === 'facts' && data?.factual_data && (
                    <FactualDataPanel data={data.factual_data} location={opportunity.location} />
                  )}

                  {activeTab === 'market' && data?.market_research && (
                    <MarketResearchPanel data={data.market_research} isPremium={isPremium} />
                  )}

                  {activeTab === 'competition' && (
                    <CompetitorAnalysisPanel 
                      data={data?.competitor_analysis} 
                      isPremium={isPremium}
                      onUpgrade={() => enrichOpportunity('premium')}
                    />
                  )}

                  {activeTab === 'regulations' && (
                    <RegulatoryInfoPanel 
                      data={data?.regulatory_info} 
                      isPremium={isPremium}
                      onUpgrade={() => enrichOpportunity('premium')}
                    />
                  )}

                  {activeTab === 'formation' && (
                    <FormationPanel 
                      opportunity={opportunity}
                      enrichmentData={data}
                    />
                  )}
                </div>

                {/* Recommandations premium */}
                {isPremium && data?.recommendations && (
                  <div className="px-6 pb-6">
                    <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-lg p-4 border border-orange-500/30">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Target className="w-5 h-5 text-orange-500" />
                        Recommandations actionnables
                      </h4>
                      <div className="grid gap-3">
                        {data.recommendations.slice(0, 3).map((rec: any, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              rec.priority === 'high' ? 'bg-red-500' :
                              rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{rec.action}</p>
                              <p className="text-xs text-gray-500">{rec.timeframe} • {rec.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message d'upgrade pour basic */}
                {isBasic && data?.upgrade_message && (
                  <div className="px-6 pb-6">
                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg p-4 border border-yellow-500/30">
                      <div className="flex items-center gap-3">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-400">Version Premium disponible</p>
                          <p className="text-xs text-gray-400 mt-1">{data.upgrade_message}</p>
                        </div>
                        <button
                          onClick={() => enrichOpportunity('premium')}
                          className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded text-xs hover:opacity-90 transition-opacity"
                        >
                          Upgrader
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Composants des panels spécialisés
function FactualDataPanel({ data, location }: { data: any; location?: string }) {
  return (
    <div className="space-y-4">
      {/* Démographie */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-500" />
          {location || 'Localisation'}
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-sm text-gray-400">Population</p>
            <p className="text-xl font-bold">
              {typeof data.demographics?.population === 'number' 
                ? data.demographics.population.toLocaleString()
                : data.demographics?.population || 'Non disponible'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Source: Wikipedia/INSEE</p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-sm text-gray-400">Densité</p>
            <p className="text-xl font-bold">
              {data.demographics?.density || 'Non disponible'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Habitants par km²</p>
          </div>
        </div>
      </div>

      {/* Infrastructure */}
      {data.infrastructure && (
        <div>
          <h4 className="font-semibold mb-3">Infrastructure</h4>
          <div className="space-y-2">
            {data.infrastructure.transport && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Transport</span>
                  <span>{data.infrastructure.transport.roads || 'En développement'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Aéroports</span>
                  <span>{data.infrastructure.transport.airports || 'À vérifier'}</span>
                </div>
              </>
            )}
            {data.infrastructure.utilities && (
              <div className="flex justify-between">
                <span className="text-gray-400">Internet</span>
                <span>{data.infrastructure.utilities.internet_penetration || '62%'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketResearchPanel({ data, isPremium }: { data: any; isPremium: boolean }) {
  return (
    <div className="space-y-4">
      {/* Taille du marché */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/30">
        <h4 className="font-semibold mb-2">Taille du marché estimée</h4>
        <p className="text-2xl font-bold text-blue-400">
          {data.market_size?.estimated_value || 'À déterminer'}
        </p>
        {data.market_size?.growth_rate && (
          <p className="text-sm text-gray-400 mt-2">
            Croissance annuelle: {data.market_size.growth_rate}
          </p>
        )}
      </div>

      {/* Tendances */}
      {data.growth_trends && (
        <div>
          <h4 className="font-semibold mb-3">Tendances du marché</h4>
          <div className="space-y-2">
            {data.growth_trends.slice(0, isPremium ? 10 : 2).map((trend: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-green-500 mt-1" />
                <p className="text-sm">{trend}</p>
              </div>
            ))}
            {!isPremium && data.growth_trends.length > 2 && (
              <p className="text-xs text-gray-500 italic">
                +{data.growth_trends.length - 2} tendances en version premium
              </p>
            )}
          </div>
        </div>
      )}

      {/* Segments clients */}
      {data.customer_segments && (
        <div>
          <h4 className="font-semibold mb-3">Segments de clientèle</h4>
          <div className="grid md:grid-cols-2 gap-3">
            {data.customer_segments.slice(0, isPremium ? 10 : 2).map((segment: any, i: number) => (
              <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                <p className="font-medium">{segment.name}</p>
                <p className="text-sm text-gray-400">
                  {segment.size || segment.potential || 'Potentiel à évaluer'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitorAnalysisPanel({ data, isPremium, onUpgrade }: { 
  data: any; 
  isPremium: boolean; 
  onUpgrade: () => void; 
}) {
  if (!isPremium) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h4 className="font-semibold mb-2">Analyse concurrentielle</h4>
        <p className="text-gray-400 mb-4">
          Identifiez vos concurrents directs et indirects, analysez les gaps du marché
        </p>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
        >
          <Crown className="w-4 h-4" />
          Passer au Premium
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Concurrents directs */}
      {data?.direct_competitors && (
        <div>
          <h4 className="font-semibold mb-3">Concurrents directs</h4>
          {data.direct_competitors.length > 0 ? (
            <div className="space-y-3">
              {data.direct_competitors.slice(0, 5).map((comp: any, i: number) => (
                <div key={i} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{comp.name}</p>
                      <p className="text-sm text-gray-400">{comp.location}</p>
                    </div>
                    {comp.market_share && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                        {comp.market_share}% du marché
                      </span>
                    )}
                  </div>
                  {comp.services && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {comp.services.slice(0, 3).map((service: string, j: number) => (
                        <span key={j} className="text-xs bg-gray-600 px-2 py-1 rounded">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p>Marché peu saturé - Opportunité de premier entrant</p>
            </div>
          )}
        </div>
      )}

      {/* Gaps de marché */}
      {data?.market_gaps && (
        <div>
          <h4 className="font-semibold mb-3">Opportunités identifiées</h4>
          <div className="space-y-2">
            {data.market_gaps.map((gap: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm">{gap.gap}</p>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  Score: {gap.opportunity_score}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegulatoryInfoPanel({ data, isPremium, onUpgrade }: { 
  data: any; 
  isPremium: boolean; 
  onUpgrade: () => void; 
}) {
  if (!isPremium) {
    return (
      <div className="text-center py-8">
        <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h4 className="font-semibold mb-2">Informations réglementaires</h4>
        <p className="text-gray-400 mb-4">
          Licences requises, réglementations sectorielles et programmes d'aide
        </p>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
        >
          <Crown className="w-4 h-4" />
          Passer au Premium
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Licences requises */}
      {data?.licenses_required && (
        <div>
          <h4 className="font-semibold mb-3">Licences requises</h4>
          <div className="space-y-3">
            {data.licenses_required.slice(0, 5).map((license: any, i: number) => (
              <div key={i} className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium">{license.name}</p>
                  {license.cost && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                      {license.cost}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{license.authority}</p>
                {license.processing_time && (
                  <p className="text-xs text-gray-500 mt-1">
                    Délai: {license.processing_time}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Programmes gouvernementaux */}
      {data?.government_programs && data.government_programs.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">Programmes de soutien</h4>
          <div className="space-y-2">
            {data.government_programs.slice(0, 3).map((program: any, i: number) => (
              <div key={i} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="font-medium text-green-400">{program.name}</p>
                <p className="text-sm text-gray-400">{program.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réglementations basiques */}
      {data?.basic_requirements && (
        <div>
          <h4 className="font-semibold mb-3">Exigences de base</h4>
          <div className="space-y-2">
            {data.basic_requirements.map((req: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-yellow-500" />
                <p className="text-sm">{req}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormationPanel({ opportunity, enrichmentData }: { opportunity: any; enrichmentData: any }) {
  // Mock user data - à remplacer par les vraies données utilisateur
  const mockUser = {
    id: 'demo-user',
    ia_credits: 100
  };

  // Mock project data - à remplacer par les vraies données projet
  const mockProject = {
    id: opportunity.id,
    title: opportunity.opportunity_title || opportunity.title,
    category: opportunity.sector || 'business'
  };

  // Extraire les modules du sommaire de formation si disponible
  const trainingModules = enrichmentData?.training_summary?.modules || [];

  const hasTrainingAvailable = trainingModules.length > 0;

  return (
    <div className="space-y-6">
      {/* Header Formation */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-6 border border-purple-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <GraduationCap className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white mb-2">
              Formation IA Personnalisée
            </h3>
            <p className="text-gray-400 mb-4">
              Accédez à une formation complète générée par intelligence artificielle, 
              adaptée spécifiquement à votre projet et au contexte gabonais.
            </p>
          </div>
        </div>
      </div>

      {hasTrainingAvailable ? (
        <>
          {/* Aperçu des modules */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-400" />
              Modules disponibles ({trainingModules.length})
            </h4>
            <div className="grid gap-3 mb-6">
              {trainingModules.slice(0, 5).map((module: any, index: number) => (
                <div 
                  key={index}
                  className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-white mb-1">{module.title}</h5>
                      <p className="text-sm text-gray-400 line-clamp-2">{module.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {module.duration && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {module.duration}
                          </span>
                        )}
                        {module.difficulty && (
                          <span className={`px-2 py-0.5 rounded-full ${
                            module.difficulty === 'débutant' ? 'bg-green-500/20 text-green-400' :
                            module.difficulty === 'intermédiaire' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {module.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {trainingModules.length > 5 && (
              <p className="text-sm text-gray-500 text-center">
                + {trainingModules.length - 5} autres modules disponibles
              </p>
            )}
          </div>

          {/* Bouton d'accès à la formation */}
          <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-white mb-1">Prêt à commencer ?</h4>
                <p className="text-sm text-gray-400">
                  Accédez à {trainingModules.length} modules de formation personnalisés
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">À partir de</p>
                <p className="text-lg font-bold text-purple-400">
                  {trainingModules.length === 1 ? '0' : Math.max(0, (trainingModules.length - 1) * 5)} crédits IA
                </p>
                <p className="text-xs text-green-400">1er module gratuit</p>
              </div>
            </div>

            <TrainingAccessButton
              opportunity={opportunity}
              project={mockProject}
              user={mockUser}
              modules={trainingModules}
              variant="primary"
              className="w-full"
            />
          </div>

          {/* Avantages */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-semibold mb-3 text-blue-400">Ce qui est inclus:</h4>
            <div className="grid gap-2">
              {[
                'Contenu généré par IA adapté à votre projet',
                'Illustrations contextuelles du Gabon',
                'Accès illimité à vie',
                'Suivi de progression module par module',
                'Exemples concrets et prix en FCFA'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Pas de formation disponible */}
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-gray-500" />
            </div>
            <h4 className="font-semibold mb-2">Formation en préparation</h4>
            <p className="text-gray-400 mb-4">
              La formation pour cette opportunité est en cours de génération.
              <br />
              Revenez plus tard ou contactez le support.
            </p>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              Notifier quand prête
            </button>
          </div>
        </>
      )}
    </div>
  );
}
