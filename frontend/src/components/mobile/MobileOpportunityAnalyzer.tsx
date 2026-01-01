'use client';
// Version 0.1.14 - Budget selection identique desktop

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Brain, TrendingUp, Target, CheckCircle,
  AlertCircle, Loader2, X, Sparkles, Bookmark, ArrowRight, DollarSign, Coins, Wallet, Banknote
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import TopUpModal from '@/components/credits/TopUpModal';
import { getCurrentSession, getCurrentUser } from '@/lib/auth';
import TrainingSummaryModal from '@/components/training/TrainingSummaryModal';
import SavedContextsManager from '@/components/business/SavedContextsManager';
import PersonalizationFormInline from '@/components/forms/PersonalizationFormInline';

// Helper: Promise timeout to avoid infinite spinners on slow networks (mobile)
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Opération'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} trop longue, vérifiez votre connexion réseau.`)), ms)
  })
  try {
    const result = await Promise.race([promise, timeout]) as T
    return result
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

interface Article {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  media_name?: string;
}

interface MobileOpportunityAnalyzerProps {
  articles: Article[];
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileOpportunityAnalyzer({ 
  articles, 
  isOpen, 
  onClose 
}: MobileOpportunityAnalyzerProps) {
  const router = useRouter();
  const [step, setStep] = useState<'select' | 'analyze' | 'results'>('select');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const { user } = useAuth();
  const [selectedSector, setSelectedSector] = useState<any | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [proposals, setProposals] = useState<any[] | null>(null);
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);
  const [savingProjects, setSavingProjects] = useState<Set<number>>(new Set());
  const [savedProjects, setSavedProjects] = useState<Set<number>>(new Set());
  const [savedProjectIds, setSavedProjectIds] = useState<Map<number, string>>(new Map());
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false);
  const [trainingForIndex, setTrainingForIndex] = useState<number | null>(null);
  const [generatedTraining, setGeneratedTraining] = useState<any>(null);
  const [generatedTrainingId, setGeneratedTrainingId] = useState<string | null>(null);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [assuredUserId, setAssuredUserId] = useState<string | null>(null);
  const [lastUserContext, setLastUserContext] = useState<any>(null);
  const [showContextChoice, setShowContextChoice] = useState(false);

  const budgetLevels = [
    { 
      id: '50000', 
      name: '50,000 XAF', 
      range: '50,000 XAF',
      description: 'Micro-projet, idéal pour démarrer',
      color: 'from-green-500 to-emerald-600',
      icon: Coins
    },
    { 
      id: '100000', 
      name: '100,000 XAF', 
      range: '100,000 XAF',
      description: 'Petit budget, opportunités accessibles',
      color: 'from-blue-500 to-cyan-600',
      icon: Wallet
    },
    { 
      id: '200000', 
      name: '200,000 XAF', 
      range: '200,000 XAF',
      description: 'Budget moyen, plus de possibilités',
      color: 'from-purple-500 to-pink-600',
      icon: Banknote
    },
    { 
      id: '500000', 
      name: '500,000 XAF', 
      range: '500,000 XAF',
      description: 'Budget confortable, projets ambitieux',
      color: 'from-orange-500 to-red-600',
      icon: DollarSign
    },
    { 
      id: '1000000', 
      name: '1,000,000 XAF', 
      range: '1,000,000 XAF',
      description: 'Grand budget, opportunités premium',
      color: 'from-yellow-500 to-amber-600',
      icon: Sparkles
    },
    { 
      id: '2000000', 
      name: '2,000,000+ XAF', 
      range: '2,000,000+ XAF',
      description: 'Budget important, projets d\'envergure',
      color: 'from-indigo-500 to-purple-700',
      icon: TrendingUp
    },
  ] as const;

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedArticle(null);
      setAnalysisResult(null);
      setError(null);
      setShowTopUpModal(false);
      setSelectedSector(null);
      setSelectedBudget(null);
      setProposals(null);
    }
  }, [isOpen]);

  // Charger le userId dès l'ouverture pour que SavedContextsManager fonctionne
  useEffect(() => {
    if (isOpen && !assuredUserId) {
      const loadUserId = async () => {
        const uid = user?.id || null;
        if (uid) {
          setAssuredUserId(uid);
          return;
        }
        // Essayer de récupérer le userId depuis la session
        try {
          const { data: { session } } = await getCurrentSession();
          if (session?.user?.id) {
            setAssuredUserId(session.user.id);
          }
        } catch (e) {
          console.log('Session non disponible');
        }
      };
      loadUserId();
    }
  }, [isOpen, user?.id, assuredUserId]);

  // Ensure user id (mobile-friendly) similar to desktop
  const ensureUserId = async (): Promise<string | null> => {
    let uid: string | null = user?.id || null
    if (uid) return uid
    try { const { data: { session } } = await getCurrentSession(); uid = session?.user?.id || null } catch {}
    if (uid) return uid
    try { const { data } = await getCurrentUser(); uid = (data as any)?.user?.id || null } catch {}
    if (uid) return uid
    for (let i=0;i<8 && !uid;i++) {
      try {
        const [{ data: { session } }, { data }] = await Promise.all([
          getCurrentSession(),
          getCurrentUser()
        ])
        uid = session?.user?.id || (data as any)?.user?.id || null
      } catch {}
      if (!uid) await new Promise(res => setTimeout(res, 500))
    }
    return uid
  }

  const handleStartAnalysis = async () => {
    if (!selectedArticle) return;
    setStep('analyze');
    setIsAnalyzing(true);
    setError(null);
    try {
      const uid = await ensureUserId();
      if (!uid) {
        setError("Vous devez vous connecter pour analyser avec l'IA.");
        setStep('select');
        setIsAnalyzing(false);
        const redirectTarget = (typeof window !== 'undefined')
          ? `/auth/signin?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
          : '/auth/signin';
        setTimeout(() => router.push(redirectTarget), 900);
        return;
      }
      setAssuredUserId(uid);

      const response = await withTimeout(fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/opportunities/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: {
            title: selectedArticle.title,
            summary: selectedArticle.summary,
            source: selectedArticle.source,
            url: selectedArticle.url
          },
          userId: uid
        })
      }), 20000, 'Analyse');

      if (response.status === 402) {
        const details = await response.json().catch(() => ({}));
        if (details?.requireLogin) {
          setError("Connexion requise pour utiliser l'IA.");
          setStep('select');
          setIsAnalyzing(false);
          const redirectTarget = (typeof window !== 'undefined')
            ? `/auth/signin?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
            : '/auth/signin'
          setTimeout(() => router.push(redirectTarget), 600);
          return;
        }
        if (details?.needsTopUp) {
          setError('Crédits insuffisants. Veuillez recharger vos crédits.');
          setShowTopUpModal(true);
          setStep('select');
          setIsAnalyzing(false);
          return;
        }
        throw new Error('Crédits insuffisants');
      } else if (!response.ok) {
        throw new Error(`Erreur d'analyse: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);
      setStep('results');
    } catch (err: any) {
      setError(err?.message || 'Analyse trop longue. Vérifiez votre connexion.');
      setStep('select');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectSector = (secteur: any) => {
    setSelectedSector(secteur);
    setSelectedBudget(null);
    setProposals(null);
    setShowContextChoice(true); // Afficher l'écran de choix de contexte
  }

  const handleContextSubmit = async (context: any) => {
    setLastUserContext(context);
    setShowContextChoice(false);
    // Après avoir soumis le contexte, passer à la sélection du budget
    // Le budget sera sélectionné via handleSelectBudget
  }

  const handleSelectBudget = async (budgetId: string) => {
    if (!selectedSector || !analysisResult) return
    setIsGeneratingProposals(true)
    setSelectedBudget(budgetId)
    setProposals(null)
    setShowContextChoice(false); // Cacher l'écran de contexte
    try {
      const budgetRange = (budgetLevels as readonly any[]).find(b => b.id === budgetId)?.range || budgetId
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/opportunities/generate-by-budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secteur: selectedSector.nom,
          budget: budgetRange,
          problematique: analysisResult?.analyse_contextuelle?.problematique_centrale || ''
        })
      })
      if (!res.ok) throw new Error('Erreur lors de la génération des propositions')
      const data = await res.json()
      setProposals(data?.propositions || [])
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la génération des propositions')
    } finally {
      setIsGeneratingProposals(false)
    }
  }

  const saveProject = async (proposalIndex: number) => {
    if (!selectedArticle || !analysisResult || !selectedSector || !selectedBudget || !proposals?.[proposalIndex]) {
      setError('Données manquantes pour la sauvegarde')
      return
    }
    const uid = await ensureUserId()
    if (!uid) {
      const redirectTarget = (typeof window !== 'undefined')
        ? `/auth/signin?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
        : '/auth/signin'
      setTimeout(() => router.push(redirectTarget), 600)
      return
    }
    setSavingProjects(prev => new Set(prev).add(proposalIndex))
    try {
      // Convertir l'ID budget en plage lisible pour l'affichage
      const budgetRange = (budgetLevels as readonly any[]).find(b => b.id === selectedBudget)?.range || selectedBudget
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/save-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          article: selectedArticle,
          analysis: analysisResult,
          secteurSelectionne: selectedSector.nom,
          budgetSelectionne: budgetRange,
          proposition: proposals[proposalIndex],
          userContext: lastUserContext
        })
      })
      const result = await resp.json()
      if (!resp.ok || result?.success === false) throw new Error(result?.error || 'Erreur lors de la sauvegarde')
      setSavedProjects(prev => new Set(prev).add(proposalIndex))
      // Stocker l'ID du projet sauvegardé
      if (result?.projectId) {
        setSavedProjectIds(prev => new Map(prev).set(proposalIndex, result.projectId))
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la sauvegarde du projet')
    } finally {
      setSavingProjects(prev => { const n = new Set(prev); n.delete(proposalIndex); return n })
    }
  }

  const handleAllerPlusLoin = async (proposalIndex: number) => {
    if (!selectedArticle || !analysisResult || !proposals?.[proposalIndex]) return
    const uid = await ensureUserId()
    if (!uid) {
      const redirectTarget = (typeof window !== 'undefined')
        ? `/auth/signin?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
        : '/auth/signin'
      setTimeout(() => router.push(redirectTarget), 600)
      return
    }
    setIsGeneratingTraining(true)
    setTrainingForIndex(proposalIndex)
    setGeneratedTraining(null)
    try {
      const proposal = proposals[proposalIndex]
      const budgetRange = (budgetLevels as readonly any[]).find(b => b.id === selectedBudget)?.range || selectedBudget || ''
      const userAnalysis = { budget: budgetRange }
      const sectorResults = {
        selectedPropositions: [proposal.titre],
        localInsights: analysisResult?.analyse_contextuelle?.problematique_centrale || ''
      }
      const res = await fetch('/api/training/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAnalysis,
          article: {
            title: selectedArticle.title,
            summary: selectedArticle.summary,
            source: selectedArticle.source,
            url: selectedArticle.url
          },
          sectorResults,
          userId: uid,
          articleId: selectedArticle.id
        })
      })
      if (res.status === 402) {
        const details = await res.json().catch(() => ({}))
        if (details?.requireLogin) {
          const redirectTarget = (typeof window !== 'undefined')
            ? `/auth/signin?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
            : '/auth/signin'
          setTimeout(() => router.push(redirectTarget), 600)
          return
        }
        if (details?.needsTopUp) {
          setError('Crédits insuffisants. Veuillez recharger vos crédits.')
          setShowTopUpModal(true)
          return
        }
        throw new Error('Crédits insuffisants')
      }
      if (!res.ok) throw new Error('Erreur lors de la génération de la formation')
      const data = await res.json()
      setGeneratedTraining(data?.training || null)
      setGeneratedTrainingId(data?.trainingId || null)
      setIsTrainingModalOpen(true)
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la génération de la formation')
    } finally {
      setIsGeneratingTraining(false)
    }
  }

  const handleBack = () => {
    if (step === 'results') {
      setStep('select');
      setAnalysisResult(null);
    } else if (step === 'analyze') {
      setStep('select');
      setIsAnalyzing(false);
    }
  };

  const handleRestart = () => {
    setStep('select');
    setSelectedArticle(null);
    setAnalysisResult(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white md:hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={step === 'select' ? onClose : handleBack}
            className="p-2 hover:bg-orange-600 rounded-lg transition-colors"
          >
            {step === 'select' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-bold">Opportunités IA</h1>
          <div className="w-9" />
        </div>
        
        {/* Step indicator */}
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            step === 'select' ? 'bg-white text-orange-500' : 'bg-orange-400 text-white'
          }`}>
            1
          </div>
          <div className={`h-1 w-8 transition-colors ${
            ['analyze', 'results'].includes(step) ? 'bg-white' : 'bg-orange-400'
          }`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            step === 'results' ? 'bg-white text-orange-500' :
            step === 'analyze' ? 'bg-white text-orange-500' : 'bg-orange-400 text-white'
          }`}>
            2
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Sélectionnez un article
                </h2>
                <p className="text-gray-600 text-sm">
                  Choisissez l'actualité gabonaise à transformer en opportunité business
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {articles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 mb-2">Aucun article disponible</p>
                    <p className="text-gray-500 text-sm">
                      Veuillez d'abord charger des articles sur la page d'accueil
                    </p>
                  </div>
                ) : (
                  articles.slice(0, 8).map((article) => (
                    <div
                      key={article.id}
                      onClick={() => setSelectedArticle(article)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedArticle?.id === article.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {article.imageUrl && (
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                            {article.title}
                          </h3>
                          <p className="text-gray-600 text-xs line-clamp-2 mb-2">
                            {article.summary}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-600 text-xs font-medium">
                              {article.media_name || article.source}
                            </span>
                            {selectedArticle?.id === article.id && (
                              <CheckCircle className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 'analyze' && (
            <motion.div
              key="analyze"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 h-full flex flex-col items-center justify-center"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Analyse en cours...
                </h2>
                <div className="space-y-3 text-left max-w-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600">Préparation de l'analyse</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <span className="text-sm text-gray-600">Chargement</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    <span className="text-sm text-gray-600">Veuillez patienter</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'results' && analysisResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Analyse terminée ! 🎯
                </h2>
              </div>

              {/* Article analysé */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-gray-900 text-sm mb-2">Article analysé :</h3>
                <p className="text-gray-700 text-sm line-clamp-2">
                  {selectedArticle?.title}
                </p>
                <p className="text-orange-600 text-xs mt-1">
                  {selectedArticle?.media_name || selectedArticle?.source}
                </p>
              </div>

              {/* Analyse contextuelle */}
              {analysisResult.analyse_contextuelle && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Target className="w-4 h-4 text-orange-500 mr-2" />
                    Contexte
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-600">Secteur :</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {analysisResult.analyse_contextuelle.secteur_principal}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Problématique :</span>
                      <p className="mt-1 text-gray-900">
                        {analysisResult.analyse_contextuelle.problematique_centrale}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Urgence :</span>
                      <div className="flex items-center mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${(analysisResult.analyse_contextuelle.urgence_score / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {analysisResult.analyse_contextuelle.urgence_score}/10
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Opportunités */}
              {analysisResult.secteurs_opportunites && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-2" />
                    Opportunités
                  </h3>
                  <div className="space-y-3">
                    {analysisResult.secteurs_opportunites.map((opp: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => handleSelectSector(opp)}
                        className="w-full text-left bg-green-50 rounded-lg p-3 border border-green-200 hover:bg-green-100"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-green-900 text-sm">{opp.nom}</h4>
                          <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded">{opp.score_potentiel}/10</span>
                        </div>
                        <p className="text-green-700 text-xs">{opp.description}</p>
                        <div className="mt-2 text-right text-green-700 text-xs inline-flex items-center gap-1">Choisir <ArrowRight className="w-3 h-3"/></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Context choice screen when a sector is chosen */}
              {selectedSector && showContextChoice && !selectedBudget && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Secteur: {selectedSector.nom}</h3>
                    <button onClick={() => { setSelectedSector(null); setShowContextChoice(false); }} className="text-sm text-gray-500">← Retour</button>
                  </div>

                  {/* Gestionnaire de contextes sauvegardés */}
                  <SavedContextsManager
                    userId={assuredUserId || user?.id || null}
                    currentContext={lastUserContext}
                    onLoadContext={(context) => {
                      const loadedContext = {
                        situation: context.situation,
                        competences: context.competences,
                        disponibilite: context.disponibilite,
                        objectif_delai: context.objectif_delai,
                        experience_entrepreneuriale: context.experience_entrepreneuriale,
                        contraintes: context.contraintes,
                        budget_principal: context.budget_principal
                      };
                      setLastUserContext(loadedContext);
                      handleContextSubmit(loadedContext);
                    }}
                    onSaveContext={(name) => {
                      console.log('✅ Contexte sauvegardé:', name);
                    }}
                  />

                  <div className="mb-4 mt-4">
                    <h5 className="text-gray-900 font-semibold mb-1">🎯 Personnalisez votre contexte</h5>
                    <p className="text-gray-600 text-sm">Renseignez votre profil pour adapter les propositions.</p>
                  </div>

                  <PersonalizationFormInline
                    budgetOptions={budgetLevels as any}
                    onSubmit={handleContextSubmit}
                    isLoading={isGeneratingProposals}
                    userId={assuredUserId || user?.id}
                    onSaveProfile={async (context) => {
                      const uid = assuredUserId || user?.id;
                      if (!uid) return;
                      const contextName = `Profil ${new Date().toLocaleDateString()}`;
                      try {
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/user-contexts`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId: uid,
                            contextName,
                            situation: context.situation || '',
                            competences: context.competences || [],
                            disponibilite: context.disponibilite || '',
                            objectif_delai: context.objectif_delai || '',
                            experience_entrepreneuriale: context.experience_entrepreneuriale || '',
                            contraintes: context.contraintes || '',
                            budget_principal: context.budget_principal || ''
                          })
                        });
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Erreur sauvegarde');
                        }
                        alert('✅ Profil sauvegardé avec succès !');
                      } catch (error) {
                        console.error('❌ Erreur:', error);
                        alert(`❌ ${error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'}`);
                      }
                    }}
                  />
                </div>
              )}

              {/* Budget selection after context is submitted - Design identique desktop */}
              {selectedSector && !showContextChoice && !selectedBudget && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Secteur: {selectedSector.nom}</h3>
                    <button onClick={() => setShowContextChoice(true)} className="text-sm text-gray-500">← Retour</button>
                  </div>
                  <div className="mb-4">
                    <h4 className="text-gray-900 font-semibold mb-1 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-500" />
                      Budget de démarrage
                    </h4>
                    <p className="text-gray-600 text-sm">Sélectionnez votre budget principal</p>
                  </div>
                  <div className="space-y-3">
                    {budgetLevels.map(level => {
                      const Icon = level.icon;
                      return (
                        <motion.div
                          key={level.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectBudget(level.id)}
                          className="p-4 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white hover:from-orange-50 hover:to-yellow-50 hover:border-orange-300 cursor-pointer transition-all active:scale-95"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-3 bg-gradient-to-r ${level.color} rounded-lg flex-shrink-0`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-gray-900 text-sm">{level.name}</h5>
                              <p className="text-gray-600 text-xs mt-0.5">{level.description}</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Proposals list when budget selected */}
              {selectedSector && selectedBudget && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Propositions pour {selectedSector.nom}</h3>
                    <button 
                      onClick={() => {
                        setSelectedBudget(null);
                        setShowContextChoice(false); // S'assurer qu'on affiche l'écran de budget
                        setProposals(null);
                      }} 
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      ← Changer de budget
                    </button>
                  </div>
                  {isGeneratingProposals && (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                      <div className="text-sm text-gray-600">Génération des propositions...</div>
                    </div>
                  )}
                  {!isGeneratingProposals && proposals && proposals.length === 0 && (
                    <div className="text-sm text-gray-600">Aucune proposition pour ce budget.</div>
                  )}
                  {!isGeneratingProposals && proposals && proposals.length > 0 && (
                    <div className="space-y-3">
                      {proposals.map((p, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 text-sm">{p.titre || `Proposition ${idx+1}`}</h5>
                            {typeof p.score_faisabilite === 'number' && (
                              <div className="text-yellow-600 text-xs font-bold">{p.score_faisabilite}%</div>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-gray-700 text-sm mb-2">{p.description}</p>
                          )}
                          {p.premiers_investissements && (
                            <div className="mb-2">
                              <span className="text-gray-800 text-xs font-medium block mb-1">Premiers investissements:</span>
                              {(() => {
                                const val = p.premiers_investissements
                                const items = Array.isArray(val)
                                  ? val
                                  : String(val || '').split(/(?:\s*[•–—]\s+|\s+-\s+|[;]|\n)+/).filter(Boolean)
                                if (items.length > 1) {
                                  return (
                                    <ul className="space-y-1 pl-2">
                                      {items.slice(0, 5).map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-gray-700 text-xs">
                                          <span className="text-yellow-600 mt-0.5 flex-shrink-0">•</span>
                                          <span className="leading-relaxed">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                }
                                return <span className="text-gray-700 text-xs">{String(val)}</span>
                              })()}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => saveProject(idx)}
                              disabled={savingProjects.has(idx) || savedProjects.has(idx)}
                              className="flex-1 py-2 px-3 rounded-lg bg-white border border-gray-300 text-gray-800 text-sm font-medium disabled:opacity-60"
                            >
                              <div className="inline-flex items-center gap-2 justify-center">
                                <Bookmark className="w-4 h-4" />
                                {savedProjects.has(idx) ? 'Sauvegardé' : (savingProjects.has(idx) ? 'Sauvegarde...' : 'Sauvegarder')}
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                const projectId = savedProjectIds.get(idx)
                                if (!projectId) {
                                  alert('⚠️ Veuillez d\'abord sauvegarder ce projet pour accéder aux options avancées')
                                  return
                                }
                                router.push(`/business/mes-projets?projectId=${projectId}&openCard=true`)
                              }}
                              disabled={!savedProjects.has(idx)}
                              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                                savedProjects.has(idx)
                                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-500 hover:to-orange-600'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2">
                                Aller + Loin
                                <ArrowRight className="w-4 h-4" />
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Enrichissement MCP */}
              {analysisResult.mcp_enhanced && analysisResult.mcp_enrichment && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Sparkles className="w-4 h-4 text-purple-500 mr-2" />
                    Données Perplexity
                  </h3>
                  
                  {/* Score faisabilité */}
                  {analysisResult.mcp_enrichment.feasibility_score && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 text-sm mb-2">📊 Faisabilité</h4>
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-gradient-to-r from-orange-400 to-green-500 h-3 rounded-full"
                            style={{ width: `${analysisResult.mcp_enrichment.feasibility_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          {analysisResult.mcp_enrichment.feasibility_score}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Budget guidance */}
                  {analysisResult.mcp_enrichment.budget_guidance && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 text-sm mb-2">💰 Budgets</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(analysisResult.mcp_enrichment.budget_guidance.startup_ranges || {}).map(([key, value]) => (
                          <div key={key} className="bg-blue-50 p-2 rounded">
                            <span className="font-medium text-blue-900 capitalize">{key}:</span>
                            <p className="text-blue-700">{value as string}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financements */}
                  {analysisResult.mcp_enrichment.funding_options && (
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm mb-2">🏦 Financements</h4>
                      <div className="space-y-2 text-xs">
                        {analysisResult.mcp_enrichment.funding_options.government && (
                          <div>
                            <span className="font-medium text-green-700">Gouvernement:</span>
                            <p className="text-green-600">{analysisResult.mcp_enrichment.funding_options.government.join(', ')}</p>
                          </div>
                        )}
                        {analysisResult.mcp_enrichment.funding_options.private && (
                          <div>
                            <span className="font-medium text-blue-700">Privé:</span>
                            <p className="text-blue-600">{analysisResult.mcp_enrichment.funding_options.private.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed bottom button */}
      {step === 'select' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden">
          <button
            onClick={handleStartAnalysis}
            disabled={!selectedArticle}
            className={`w-full py-4 px-6 rounded-xl font-semibold transition-all ${
              selectedArticle
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedArticle ? 'Démarrer l\'analyse' : 'Sélectionnez un article'}
          </button>
        </div>
      )}

      {step === 'results' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden">
          <div className="space-y-2">
            <button
              onClick={handleRestart}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              Analyser un autre article
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal de recharge crédits */}
      <TopUpModal
        open={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        onPurchased={() => {
          // Après recharge, rester sur l'écran de sélection et laisser l'utilisateur relancer
          setError(null)
        }}
      />
      <TrainingSummaryModal
        open={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        training={generatedTraining}
        trainingId={generatedTrainingId}
        userId={assuredUserId || user?.id}
        onNeedsTopUp={() => setShowTopUpModal(true)}
      />
    </div>
  );
}
