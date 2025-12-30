'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, GraduationCap, Check, Lock, Sparkles, BookOpen,
  Clock, Trophy, Zap, CreditCard, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'débutant' | 'intermédiaire' | 'avancé';
  order: number;
}

interface TrainingPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: any;
  project: any;
  modules: Module[];
  user: any;
}

export default function TrainingPurchaseModal({
  isOpen,
  onClose,
  opportunity,
  project,
  modules,
  user
}: TrainingPurchaseModalProps) {
  const router = useRouter();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [purchaseType, setPurchaseType] = useState<'all' | 'custom'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const CREDITS_PER_MODULE = 5;
  const DISCOUNT_ALL_MODULES = 0.2; // 20% de réduction pour tout acheter

  useEffect(() => {
    if (isOpen) {
      // Sélectionner tous les modules par défaut
      setSelectedModules(modules.map(m => m.id));
      setPurchaseType('all');
      setError('');
    }
  }, [isOpen, modules]);

  const toggleModule = (moduleId: string) => {
    if (purchaseType === 'all') {
      setPurchaseType('custom');
    }

    setSelectedModules(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(id => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const selectAllModules = () => {
    setSelectedModules(modules.map(m => m.id));
    setPurchaseType('all');
  };

  const calculateCredits = () => {
    if (selectedModules.length === 0) return 0;
    
    const baseCredits = selectedModules.length * CREDITS_PER_MODULE;
    
    if (purchaseType === 'all' && selectedModules.length === modules.length) {
      return Math.floor(baseCredits * (1 - DISCOUNT_ALL_MODULES));
    }
    
    return baseCredits;
  };

  const handlePurchase = async () => {
    if (selectedModules.length === 0) {
      setError('Veuillez sélectionner au moins un module');
      return;
    }

    const creditsNeeded = calculateCredits();
    
    if (user.ia_credits < creditsNeeded) {
      setError(`Crédits insuffisants. Vous avez ${user.ia_credits} crédits, ${creditsNeeded} requis.`);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/training/create-training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          project_id: project.id,
          opportunity_id: opportunity.id,
          modules_selected: modules.filter(m => selectedModules.includes(m.id)),
          payment_credits: creditsNeeded
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur lors de la création');
        return;
      }

      // Rediriger vers la formation
      router.push(`/training/${data.training_id}`);
      onClose();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const creditsNeeded = calculateCredits();
  const hasSufficientCredits = user.ia_credits >= creditsNeeded;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-orange-500 to-red-500 px-8 py-6 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Formation Personnalisée</h2>
            </div>
            <p className="text-white/90">
              {project.title} • {opportunity.title}
            </p>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-8">
            {/* Info Formation */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <Sparkles className="w-10 h-10 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Formation IA sur mesure
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Contenu généré par IA adapté à votre projet
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Illustrations contextuelles Gabon
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Accès illimité à vie
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      Suivi de progression module par module
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Options d'achat */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={selectAllModules}
                className={`p-4 rounded-xl border-2 transition-all ${
                  purchaseType === 'all'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Trophy className="w-6 h-6 text-orange-600" />
                  <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    -20% 🎁
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Formation Complète</h4>
                <p className="text-sm text-gray-600">
                  Tous les {modules.length} modules inclus
                </p>
              </button>

              <button
                onClick={() => setPurchaseType('custom')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  purchaseType === 'custom'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <Zap className="w-6 h-6 text-blue-600 mb-2" />
                <h4 className="font-semibold text-gray-900 mb-1">À la carte</h4>
                <p className="text-sm text-gray-600">
                  Sélectionnez vos modules
                </p>
              </button>
            </div>

            {/* Liste des modules */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Modules disponibles ({modules.length})
              </h3>
              
              <div className="space-y-3">
                {modules.map((module, index) => {
                  const isSelected = selectedModules.includes(module.id);
                  const isLocked = purchaseType === 'custom' && index > 0 && !selectedModules.includes(modules[index - 1].id);
                  
                  return (
                    <button
                      key={module.id}
                      onClick={() => !isLocked && toggleModule(module.id)}
                      disabled={isLocked}
                      className={`
                        w-full text-left p-4 rounded-lg border-2 transition-all
                        ${isSelected 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 hover:border-gray-300'
                        }
                        ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox/Lock */}
                        <div className="flex-shrink-0 mt-1">
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-gray-400" />
                          ) : (
                            <div className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center
                              ${isSelected 
                                ? 'border-green-500 bg-green-500' 
                                : 'border-gray-300'
                              }
                            `}>
                              {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                          )}
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-500">
                              Module {index + 1}
                            </span>
                            <span className={`
                              text-xs px-2 py-0.5 rounded-full
                              ${module.difficulty === 'débutant' ? 'bg-green-100 text-green-800' :
                                module.difficulty === 'intermédiaire' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }
                            `}>
                              {module.difficulty}
                            </span>
                          </div>
                          
                          <h4 className="font-semibold text-gray-900 mb-1">
                            {module.title}
                          </h4>
                          
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {module.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {module.duration}
                            </div>
                            <div className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {CREDITS_PER_MODULE} crédits
                            </div>
                          </div>

                          {isLocked && (
                            <p className="text-xs text-orange-600 mt-2">
                              ⚠️ Terminez le module précédent pour débloquer
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Résumé */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Modules sélectionnés</span>
                  <span className="font-semibold text-gray-900">
                    {selectedModules.length} / {modules.length}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Prix unitaire</span>
                  <span className="text-gray-900">{CREDITS_PER_MODULE} crédits/module</span>
                </div>

                {purchaseType === 'all' && selectedModules.length === modules.length && (
                  <div className="flex items-center justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Trophy className="w-4 h-4" />
                      Réduction formation complète
                    </span>
                    <span className="font-semibold">-20%</span>
                  </div>
                )}

                <div className="border-t border-gray-300 pt-3 mt-3">
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold text-gray-900">Total</span>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">
                        {creditsNeeded} crédits
                      </div>
                      <div className="text-xs text-gray-500">
                        Solde: {user.ia_credits} crédits
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-4 bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              
              <button
                onClick={handlePurchase}
                disabled={loading || !hasSufficientCredits || selectedModules.length === 0}
                className={`
                  px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all
                  ${hasSufficientCredits && selectedModules.length > 0
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Création...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-5 h-5" />
                    Démarrer la formation ({creditsNeeded} crédits)
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
