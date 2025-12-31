'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, CheckCircle2, Circle, Lock, Play, ArrowLeft, Clock, Trophy, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ModuleSummary {
  id: number;
  competence: string;
  objective: string;
  priority: string;
  level: string;
  duration: string;
  duration_numeric: number;
}

interface DetailedModule extends ModuleSummary {
  detailed_content?: {
    module_title: string;
    introduction: string;
    learning_objectives: string[];
    content_sections: {
      section_title: string;
      content: string;
      key_points: string[];
    }[];
    practical_exercises: {
      title: string;
      description: string;
      duration: string;
      deliverable: string;
    }[];
    resources: {
      type: string;
      title: string;
      description: string;
      url: string | null;
    }[];
    gabon_context: string;
    success_criteria: string[];
    next_steps: string;
  };
  isGenerating?: boolean;
  generationError?: string;
}

interface Training {
  id: string;
  title: string;
  modules: ModuleSummary[];
  total_duration: string;
  execution_margin: string;
  gabon_specifics: string;
  pricing: {
    per_module: number;
    full_training: number;
  };
}

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const training_id = params?.training_id as string;
  const purchased = searchParams?.get('purchased') === 'true';
  const selectedModulesParam = searchParams?.get('modules');
  const projectId = searchParams?.get('projectId');
  const resumeMode = searchParams?.get('resume') === 'true';

  const [training, setTraining] = useState<Training | null>(null);
  const [modules, setModules] = useState<DetailedModule[]>([]);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progressLoaded, setProgressLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction pour sauvegarder la progression
  const saveProgress = useCallback(async (moduleIndex: number, modulesState: DetailedModule[]) => {
    if (!user?.id || !training_id) return;

    try {
      // Calculer les modules complétés (ceux qui ont du contenu généré)
      const completedModules = modulesState
        .map((m, idx) => m.detailed_content ? idx : -1)
        .filter(idx => idx !== -1);

      // Préparer le cache des modules générés (par index ET par module.id pour robustesse)
      const generatedModules: Record<string | number, any> = {};
      modulesState.forEach((m, idx) => {
        if (m.detailed_content) {
          generatedModules[idx] = m.detailed_content;  // Par index
          generatedModules[`id_${m.id}`] = m.detailed_content;  // Par module.id
        }
      });

      await fetch(`${API_URL}/api/training/${training_id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentModuleIndex: moduleIndex,
          completedModules,
          generatedModules,
          projectId: projectId || null
        })
      });

      console.log('💾 Progression sauvegardée automatiquement');
    } catch (err) {
      console.error('Erreur sauvegarde progression:', err);
    }
  }, [user?.id, training_id, projectId]);

  // Sauvegarder la progression avec debounce quand le module change
  useEffect(() => {
    if (!progressLoaded || modules.length === 0) return;

    // Debounce la sauvegarde
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(currentModuleIndex, modules);
    }, 2000); // Sauvegarder 2s après le dernier changement

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentModuleIndex, modules, progressLoaded, saveProgress]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id && training_id && modules.length > 0) {
        // Préparer les modules générés (par index ET par module.id)
        const generatedModules: Record<string | number, any> = {};
        modules.forEach((m, idx) => {
          if (m.detailed_content) {
            generatedModules[idx] = m.detailed_content;
            generatedModules[`id_${m.id}`] = m.detailed_content;
          }
        });

        // Utiliser sendBeacon pour sauvegarde synchrone
        const data = JSON.stringify({
          userId: user.id,
          currentModuleIndex,
          completedModules: modules.map((m, idx) => m.detailed_content ? idx : -1).filter(idx => idx !== -1),
          generatedModules,
          projectId: projectId || null
        });
        navigator.sendBeacon(`${API_URL}/api/training/${training_id}/progress`, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user?.id, training_id, currentModuleIndex, modules, projectId]);

  // Charger la formation et démarrer la génération
  useEffect(() => {
    if (!training_id) {
      setError('Formation non spécifiée.');
      setLoading(false);
      return;
    }
    loadTrainingAndGenerate();
  }, [training_id]);

  // Protection anti-copie renforcée
  useEffect(() => {
    const preventCopy = (e: KeyboardEvent) => {
      // Bloquer Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+P, etc.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['c', 'x', 'a', 'p', 's', 'u'].includes(key)) {
          e.preventDefault();
          return false;
        }
      }
      // Bloquer F12, Ctrl+Shift+I (DevTools)
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        return false;
      }
    };

    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const preventSelection = () => {
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('keydown', preventCopy);
    document.addEventListener('contextmenu', preventRightClick);
    document.addEventListener('selectstart', preventSelection);

    return () => {
      document.removeEventListener('keydown', preventCopy);
      document.removeEventListener('contextmenu', preventRightClick);
      document.removeEventListener('selectstart', preventSelection);
    };
  }, []);

  const loadTrainingAndGenerate = async () => {
    try {
      console.log('📖 Chargement formation:', training_id);

      let trainingData = null;
      let savedProgress = null;

      // Essayer de charger depuis l'API
      try {
        const response = await fetch(`${API_URL}/api/training/${training_id}`);
        const data = await response.json();

        if (data.success) {
          trainingData = data.training;
          console.log('✅ Formation chargée depuis API');
        }
      } catch (apiError) {
        console.warn('⚠️ Échec chargement API, tentative sessionStorage...');
      }

      // Si l'API échoue, essayer sessionStorage (pour IDs temporaires)
      if (!trainingData && training_id.startsWith('temp_')) {
        const storedData = sessionStorage.getItem(`training_${training_id}`);
        if (storedData) {
          trainingData = JSON.parse(storedData);
          console.log('✅ Formation chargée depuis sessionStorage');
        }
      }

      if (!trainingData) {
        setError('Formation non trouvée. Elle a peut-être expiré.');
        setLoading(false);
        return;
      }

      // Charger la progression sauvegardée si l'utilisateur est connecté
      if (user?.id) {
        try {
          const progressResponse = await fetch(`${API_URL}/api/training/${training_id}/progress/${user.id}`);
          const progressData = await progressResponse.json();
          if (progressData.success && progressData.progress) {
            savedProgress = progressData.progress;
            console.log('✅ Progression récupérée:', savedProgress.progress_percentage + '%');
            console.log('📦 Modules sauvegardés:', Object.keys(savedProgress.generated_modules || {}).length);
            console.log('🔑 Clés des modules:', Object.keys(savedProgress.generated_modules || {}));
          }
        } catch (progressError) {
          console.warn('⚠️ Pas de progression sauvegardée:', progressError);
        }
      }

      setTraining(trainingData);

      // Déterminer quels modules générer
      const modulesToGenerate = selectedModulesParam
        ? trainingData.modules.filter((m: ModuleSummary) =>
            selectedModulesParam.split(',').includes(String(m.id))
          )
        : trainingData.modules;

      console.log('🎯 Modules à générer:', modulesToGenerate.length);

      // Initialiser les modules avec le contenu sauvegardé si disponible
      const initialModules: DetailedModule[] = modulesToGenerate.map((m: ModuleSummary, idx: number) => {
        // Chercher le contenu sauvegardé par plusieurs méthodes (robustesse)
        const gm = savedProgress?.generated_modules;
        const savedContent = gm?.[idx]  // Par index numérique
          || gm?.[String(idx)]  // Par index string
          || gm?.[`id_${m.id}`]  // Par module.id avec préfixe
          || gm?.[m.id];  // Par module.id directement

        if (savedContent) {
          console.log(`🔄 Module ${idx + 1} "${m.competence}" restauré depuis la sauvegarde`);
        }

        return {
          ...m,
          isGenerating: false,
          detailed_content: savedContent || undefined
        };
      });

      setModules(initialModules);

      // Log le nombre de modules restaurés
      const restoredCount = initialModules.filter(m => m.detailed_content).length;
      console.log(`✅ ${restoredCount}/${initialModules.length} modules restaurés depuis la sauvegarde`);

      // Restaurer la position si on reprend la formation
      if (savedProgress && (resumeMode || savedProgress.current_module_index > 0)) {
        const resumeIndex = Math.min(savedProgress.current_module_index, initialModules.length - 1);
        setCurrentModuleIndex(resumeIndex);
        console.log(`🔄 Reprise au module ${resumeIndex + 1}`);
      }

      setProgressLoaded(true);
      setLoading(false);

      // NE PAS générer automatiquement - l'utilisateur choisira les modules à générer
      console.log('✅ Modules initialisés, prêts pour génération à la demande');

    } catch (err: any) {
      console.error('❌ Erreur chargement:', err);
      setError(err.message || 'Erreur lors du chargement');
      setLoading(false);
    }
  };

  // Générer le contenu d'un module spécifique à la demande
  const generateModuleContent = async (moduleIndex: number) => {
    const module = modules[moduleIndex];
    
    // Si déjà généré, ne rien faire
    if (module.detailed_content) {
      return;
    }
    
    // Marquer comme en cours de génération
    setModules(prev => prev.map((m, idx) => 
      idx === moduleIndex ? { ...m, isGenerating: true, generationError: undefined } : m
    ));
    
    console.log(`📝 Génération module ${moduleIndex + 1}:`, module.competence);
    
    try {
      // Pour les IDs temporaires, envoyer les données complètes de la formation
      const requestBody: any = { moduleId: module.id };
      if (training_id.startsWith('temp_') && training) {
        requestBody.trainingData = training;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/training/${training_id}/generate-module`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.module) {
        console.log('✅ Module généré:', data.module.detailed_content.module_title);
        
        // Mettre à jour le module avec le contenu généré
        setModules(prev => prev.map((m, idx) => 
          idx === moduleIndex ? {
            ...m,
            detailed_content: data.module.detailed_content,
            isGenerating: false
          } : m
        ));
      } else {
        throw new Error(data.error || 'Erreur génération module');
      }
      
    } catch (err: any) {
      console.error(`❌ Erreur module ${moduleIndex + 1}:`, err);
      
      // Message d'erreur plus explicite
      let errorMessage = 'Erreur génération';
      if (err.message.includes('502')) {
        errorMessage = 'Le serveur est en cours de redémarrage. Réessayez dans 1 minute.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'La génération a pris trop de temps. Réessayez.';
      } else if (err.message.includes('Format de réponse AI invalide')) {
        errorMessage = 'Erreur IA. Le système réessaie automatiquement avec un autre modèle...';
      }
      
      // Marquer l'erreur
      setModules(prev => prev.map((m, idx) => 
        idx === moduleIndex ? {
          ...m,
          isGenerating: false,
          generationError: errorMessage
        } : m
      ));
    }
  };

  const navigateToModule = async (index: number) => {
    if (index >= 0 && index < modules.length) {
      setCurrentModuleIndex(index);
      
      // Générer le contenu du module s'il n'est pas encore généré
      await generateModuleContent(index);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de votre formation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <div className="text-red-600 text-center">
            <p className="text-lg font-semibold">Erreur</p>
            <p className="mt-2">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentModule = modules[currentModuleIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR TYPE TEACHABLE */}
      <aside className="w-80 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
        {/* Header de la formation */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => router.push('/business/mes-projets')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </button>
          
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {training?.title || 'Formation personnalisée'}
          </h1>
          
          {/* Progression */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">
                {modules.filter(m => m.detailed_content).length} / {modules.length} modules générés
              </span>
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${modules.length > 0 ? (modules.filter(m => m.detailed_content).length / modules.length * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Liste des modules */}
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Modules de formation
          </h2>
          
          <div className="space-y-2">
            {modules.map((module, index) => (
              <button
                key={module.id}
                onClick={() => !module.isGenerating && navigateToModule(index)}
                disabled={module.isGenerating}
                className={`
                  w-full text-left p-4 rounded-lg transition-all
                  ${currentModuleIndex === index 
                    ? 'bg-blue-50 border-2 border-blue-400' 
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }
                  ${module.isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icône statut */}
                  <div className="flex-shrink-0 mt-1">
                    {module.detailed_content ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : module.isGenerating ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : module.generationError ? (
                      <Circle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500">
                        Module {index + 1}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                      {module.competence}
                    </h3>
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {module.duration}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL - Zone de leçon avec protection anti-copie */}
      <main 
        className="flex-1 overflow-y-auto bg-white"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        {currentModule && currentModule.isGenerating ? (
          <div className="flex items-center justify-center h-full p-12">
            <div className="max-w-md w-full">
              {/* Spinner principal */}
              <div className="text-center mb-8">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Génération du module en cours...
                </h3>
                <p className="text-gray-500 mb-6">
                  Veuillez patienter pendant que l'IA crée le contenu détaillé
                </p>
              </div>

              {/* Barre de progression animée */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Module {currentModuleIndex + 1} / {modules.length}</span>
                  <span className="text-blue-600 font-medium">En cours...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-pulse"
                    style={{
                      width: '70%',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }}
                  />
                </div>
              </div>

              {/* Étapes de génération */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>Analyse du contexte</span>
                </div>
                <div className="flex items-center gap-3 text-blue-600">
                  <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                  <span className="font-medium">Génération du contenu par l'IA...</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <Circle className="w-5 h-5 flex-shrink-0" />
                  <span>Structuration du module</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <Circle className="w-5 h-5 flex-shrink-0" />
                  <span>Adaptation au contexte gabonais</span>
                </div>
              </div>

              {/* Message d'attente */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 text-center">
                  ⏱️ Génération en cours (30-60 secondes)
                </p>
              </div>
            </div>
          </div>
        ) : currentModule && currentModule.detailed_content ? (
          <div className="max-w-4xl mx-auto px-8 py-12">
            {/* Watermark anti-copie */}
            <div 
              className="fixed inset-0 pointer-events-none z-10 opacity-5"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 100px, rgba(0,0,0,0.03) 100px, rgba(0,0,0,0.03) 200px)`,
                fontSize: '14px',
                color: '#999'
              }}
            >
              <div className="flex items-center justify-center h-full transform rotate-45 text-gray-400">
                © Gabon24-7 Formation Protégée
              </div>
            </div>

            {/* Header du module */}
            <div className="mb-8 relative z-20">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <BookOpen className="w-4 h-4" />
                Module {currentModuleIndex + 1} sur {modules.length}
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                {currentModule.detailed_content.module_title}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {currentModule.detailed_content.introduction}
              </p>
            </div>

            {/* Objectifs d'apprentissage */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 relative z-20">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-blue-600" />
                Objectifs d'apprentissage
              </h3>
              <ul className="space-y-2">
                {currentModule.detailed_content.learning_objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections de contenu */}
            <div className="relative z-20">
              {currentModule.detailed_content.content_sections.map((section, idx) => (
                <div key={idx} className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {section.section_title}
                  </h3>
                  <div className="prose prose-lg max-w-none mb-4 text-gray-800">
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  </div>
                  {section.key_points && section.key_points.length > 0 && (
                    <div className="bg-purple-50 rounded-xl p-6 mt-4">
                      <h4 className="font-bold text-gray-900 mb-3">Points clés :</h4>
                      <ul className="space-y-2">
                        {section.key_points.map((point, pidx) => (
                          <li key={pidx} className="flex items-start gap-2">
                            <span className="text-purple-600 font-bold">•</span>
                            <span className="text-gray-700">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Exercices pratiques */}
            {currentModule.detailed_content.practical_exercises.length > 0 && (
              <div className="bg-orange-50 rounded-xl p-6 mb-8 relative z-20">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-orange-600" />
                  Exercices pratiques
                </h3>
                <div className="space-y-4">
                  {currentModule.detailed_content.practical_exercises.map((ex, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-orange-200">
                      <h4 className="font-bold text-gray-900 mb-2">{ex.title}</h4>
                      <p className="text-gray-700 mb-2">{ex.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {ex.duration}
                        </span>
                        <span>Livrable : {ex.deliverable}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contexte Gabon */}
            {currentModule.detailed_content.gabon_context && (
              <div className="bg-green-50 rounded-xl p-6 mb-8 relative z-20">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🇬🇦</span>
                  Contexte gabonais
                </h3>
                <p className="text-gray-700 leading-relaxed">{currentModule.detailed_content.gabon_context}</p>
              </div>
            )}

            {/* Navigation entre modules */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-200 relative z-20">
              <button
                onClick={() => navigateToModule(currentModuleIndex - 1)}
                disabled={currentModuleIndex === 0}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Module précédent
              </button>
              
              <div className="text-sm text-gray-500">
                {currentModuleIndex + 1} / {modules.length}
              </div>
              
              <button
                onClick={() => navigateToModule(currentModuleIndex + 1)}
                disabled={currentModuleIndex === modules.length - 1}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
              >
                Module suivant
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        ) : currentModule && currentModule.generationError ? (
          <div className="flex items-center justify-center h-full p-12">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Circle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Erreur de génération
              </h3>
              <p className="text-gray-600 mb-6">
                {currentModule.generationError}
              </p>
              
              {/* Bouton réessayer */}
              <button
                onClick={() => generateModuleContent(currentModuleIndex)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 font-medium mx-auto"
              >
                <Loader2 className="w-4 h-4" />
                Réessayer la génération
              </button>

              {/* Info supplémentaire */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 Si l'erreur persiste, le backend utilise automatiquement un modèle de secours
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-12">
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Sélectionnez un module
              </h3>
              <p className="text-gray-500">
                Cliquez sur un module dans la sidebar pour commencer
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
