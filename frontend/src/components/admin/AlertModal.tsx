'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  Lightbulb, 
  Mail, 
  MessageCircle, 
  Clock,
  Target,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  categories: string[];
}

interface AlertFormData {
  name: string;
  description: string;
  keywords: string[];
  categories: string[];
  sources: string[];
  delivery_frequency: string;
  delivery_channels: {
    email: boolean;
    whatsapp: boolean;
  };
  email_address?: string;
  whatsapp_number?: string;
}

interface UserAlert {
  id?: string;
  name: string;
  description: string;
  keywords: string[];
  categories: string[];
  sources: string[];
  delivery_frequency: string;
  delivery_channels: {
    email: boolean;
    whatsapp: boolean;
  };
  whatsapp_enabled?: boolean;
  whatsapp_numbers?: string[];
  whatsapp_credits_used?: number;
}

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: UserAlert | null;
  onSave: () => void;
}

export default function AlertModal({
  isOpen,
  onClose,
  onSave,
  alert
}: AlertModalProps) {
  const { user: authUser, loading: authLoading } = useAuth();
  const user = authUser;

  // Veille subscription limits
  const [veilleLimits, setVeilleLimits] = useState<{
    subscribed: boolean;
    maxAlerts: number;
    maxKeywordsPerAlert: number;
    maxWhatsappNumbers: number;
    planSlug: string | null;
    currentAlertCount: number;
  } | null>(null);

  const [formData, setFormData] = useState<UserAlert>({
    name: '',
    description: '',
    keywords: [],
    categories: [],
    sources: [],
    delivery_frequency: 'immediate',
    delivery_channels: {
      email: true,
      whatsapp: false
    },
    whatsapp_enabled: false,
    whatsapp_numbers: [],
    whatsapp_credits_used: 0
  });

  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userCredits, setUserCredits] = useState(0);
  const CREDITS_PER_NUMBER = 10;

  const availableCategories = [
    'Politique', 'Économie', 'Société', 'Sport', 'Culture', 
    'Santé', 'Éducation', 'Énergie', 'Agriculture', 'Transport',
    'Justice', 'Environnement', 'Technologie', 'International'
  ];

  // Sources RSS réelles du système
  const availableSources = [
    "AGP - Agence Gabonaise de Presse",
    "Gabon Actu",
    "Gabon Review",
    "Direct Infos Gabon",
    "Kongossa News",
    "Gabon Media Time",
    "Vox Populi",
    "L'Union",
    "Gabon Eco",
    "Les Echos de l'eco",
    "Media Poste Gabon",
    "Gabonews",
    "7 Jours Info",
    "G9 Infos",
    "Le Confidentiel du Gabon",
    "Gabon All Sport",
    "Focus Groupe Media",
    "Gaboma Infos",
    "Gabon Mail Infos",
    "Gabon Newsroom",
    "Gabon Clic Infos",
    "Dépêches 241",
    "Infos Gabon",
    "Insidenews",
    "Journal du Gabon",
    "Le Touraco Vert",
    "Peuple Infos",
    "Relais Infos Gabon",
    "Sport 241"
  ];

  // Charger les limites veille a l'ouverture
  useEffect(() => {
    if (!isOpen) return;

    const fetchLimits = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`${API_URL}/api/veille/limits`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (data.success) {
          setVeilleLimits(data);
        }
      } catch {
        // Silently fail - limits won't be enforced on frontend
      }
    };

    fetchLimits();
  }, [isOpen]);

  useEffect(() => {
    let mounted = true;

    const initModal = async () => {
      if (isOpen && mounted) {
        try {
          await loadTemplates();
          if (alert && mounted) {
            setFormData(alert);
          } else if (mounted) {
            resetForm();
          }
        } catch (error) {
          console.error('Error initializing alert modal:', error);
        }
      }
    };

    initModal();

    return () => {
      mounted = false;
    };
  }, [isOpen, alert]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('alert_templates')
        .select('*')
        .eq('is_public', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des modèles:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      keywords: [],
      categories: [],
      sources: [],
      delivery_frequency: 'immediate',
      delivery_channels: {
        email: true,
        whatsapp: false
      },
      whatsapp_enabled: false,
      whatsapp_numbers: [],
      whatsapp_credits_used: 0
    });
    setKeywordInput('');
    setCategoryInput('');
    setSourceInput('');
    setWhatsappInput('');
    setErrors({});
  };

  const applyTemplate = (template: AlertTemplate) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      keywords: [...template.keywords],
      categories: [...template.categories]
    }));
    setErrors({});
  };

  const addKeyword = () => {
    if (!keywordInput.trim() || formData.keywords.includes(keywordInput.trim())) return;

    // Verifier la limite de mots-cles du plan veille
    if (veilleLimits && veilleLimits.maxKeywordsPerAlert !== -1 &&
        formData.keywords.length >= veilleLimits.maxKeywordsPerAlert) {
      setErrors(prev => ({
        ...prev,
        keywords: `Limite: ${veilleLimits.maxKeywordsPerAlert} mots-cles max (plan ${veilleLimits.planSlug}). Passez a Entreprise pour des mots-cles illimites.`
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      keywords: [...prev.keywords, keywordInput.trim()]
    }));
    setKeywordInput('');
    setErrors(prev => ({ ...prev, keywords: '' }));
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const addSource = () => {
    if (sourceInput.trim() && !formData.sources.includes(sourceInput.trim())) {
      setFormData(prev => ({
        ...prev,
        sources: [...prev.sources, sourceInput.trim()]
      }));
      setSourceInput('');
    }
  };

  const removeSource = (source: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter(s => s !== source)
    }));
  };

  const toggleSource = (source: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source]
    }));
  };

  // 📱 GESTION WHATSAPP
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('users')
          .select('whatsapp_credits')
          .eq('id', user.id)
          .single();
        setUserCredits(data?.whatsapp_credits || 0);
      } catch (error) {
        console.error('Erreur chargement crédits:', error);
      }
    };
    
    if (isOpen) loadUserCredits();
  }, [isOpen, user]);

  const handleAddWhatsappNumber = () => {
    if (!whatsappInput.trim()) return;
    
    // Validation format +XXX
    if (!whatsappInput.startsWith('+')) {
      setErrors(prev => ({
        ...prev,
        whatsapp: 'Format international requis (+XXX)'
      }));
      return;
    }
    
    const numbers = formData.whatsapp_numbers || [];
    
    // Vérifier limite 10 numéros
    if (numbers.length >= 10) {
      setErrors(prev => ({
        ...prev,
        whatsapp: 'Maximum 10 numéros WhatsApp'
      }));
      return;
    }
    
    // Vérifier crédits (1er gratuit, 10 crédits/numéro après)
    const creditsNeeded = numbers.length * CREDITS_PER_NUMBER;
    if (numbers.length > 0 && userCredits < creditsNeeded) {
      setErrors(prev => ({
        ...prev,
        whatsapp: `Crédits insuffisants. Requis: ${creditsNeeded}, Disponibles: ${userCredits}`
      }));
      return;
    }
    
    // Vérifier doublon
    if (numbers.includes(whatsappInput)) {
      setErrors(prev => ({
        ...prev,
        whatsapp: 'Ce numéro est déjà ajouté'
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      whatsapp_numbers: [...numbers, whatsappInput],
      whatsapp_credits_used: numbers.length * CREDITS_PER_NUMBER
    }));
    
    setWhatsappInput('');
    setErrors(prev => ({ ...prev, whatsapp: '' }));
  };

  const handleRemoveWhatsappNumber = (number: string) => {
    const numbers = formData.whatsapp_numbers || [];
    const newNumbers = numbers.filter(n => n !== number);
    
    setFormData(prev => ({
      ...prev,
      whatsapp_numbers: newNumbers,
      whatsapp_credits_used: Math.max(0, (newNumbers.length - 1) * CREDITS_PER_NUMBER)
    }));
  };

  const toggleWhatsApp = () => {
    const newEnabled = !formData.whatsapp_enabled;
    
    if (newEnabled && (!formData.whatsapp_numbers || formData.whatsapp_numbers.length === 0)) {
      setErrors(prev => ({
        ...prev,
        whatsapp: 'Ajoutez au moins un numéro WhatsApp'
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      whatsapp_enabled: newEnabled
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom de l\'alerte est requis';
    }

    if (formData.keywords.length === 0) {
      newErrors.keywords = 'Au moins un mot-clé est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    setLoading(true);
    try {
      const alertData = {
        user_id: user.id,
        name: formData.name,
        description: formData.description,
        keywords: formData.keywords,
        extracted_keywords: [],
        categories: formData.categories,
        sources: formData.sources,
        delivery_frequency: formData.delivery_frequency,
        delivery_channels: formData.delivery_channels,
        is_active: true,
        whatsapp_enabled: formData.whatsapp_enabled || false,
        whatsapp_numbers: formData.whatsapp_numbers || [],
        whatsapp_credits_used: formData.whatsapp_credits_used || 0,
        updated_at: new Date().toISOString()
      };

      if (alert?.id) {
        // Update existing alert
        const { error } = await supabase
          .from('user_alerts')
          .update(alertData)
          .eq('id', alert.id);

        if (error) throw error;
      } else {
        // Create new alert
        const { error } = await supabase
          .from('user_alerts')
          .insert([alertData]);

        if (error) throw error;
        
        // Déduire les crédits utilisés
        if (alertData.whatsapp_credits_used > 0) {
          await supabase
            .from('users')
            .update({
              whatsapp_credits: userCredits - alertData.whatsapp_credits_used
            })
            .eq('id', user.id);
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setErrors({ general: 'Erreur lors de la sauvegarde de l\'alerte' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="bg-gradient-to-br from-white via-orange-50 to-red-50 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-orange-200"
      >
        {/* Header Moderne */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 sm:p-8 text-white rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Target className="text-white" size={28} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  {alert ? '✏️ Modifier l\'Alerte' : '✨ Nouvelle Alerte'}
                </h2>
              </div>
              <p className="text-orange-100 text-sm sm:text-base ml-15">
                Configurez votre surveillance personnalisée de l'actualité gabonaise avec IA
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-xl transition-all backdrop-blur-sm"
            >
              <X size={24} />
            </motion.button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Error Message */}
          {errors.general && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-center gap-3 shadow-sm"
            >
              <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
              <span className="text-red-700 font-medium">{errors.general}</span>
            </motion.div>
          )}

          {/* Templates Section */}
          {templates.length > 0 && !alert && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 sm:p-6 border-2 border-yellow-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
                  <Lightbulb className="text-white" size={22} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">🎯 Modèles Suggérés</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.slice(0, 4).map((template, idx) => (
                  <motion.button
                    key={template.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => applyTemplate(template)}
                    className="text-left p-4 bg-white border-2 border-yellow-200 rounded-xl hover:border-orange-400 hover:shadow-lg transition-all"
                  >
                    <h4 className="font-bold text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.keywords.slice(0, 3).map((keyword, idx) => (
                        <span 
                          key={idx}
                          className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-md text-xs font-semibold"
                        >
                          #{keyword}
                        </span>
                      ))}
                      {template.keywords.length > 3 && (
                        <span className="text-gray-500 text-xs px-2 py-0.5 font-medium">
                          +{template.keywords.length - 3}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-orange-500">🎯</span>
                  Nom de l'Alerte *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all text-sm sm:text-base ${
                    errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-orange-400 bg-white'
                  }`}
                  placeholder="Ex: Actualités économiques du Gabon"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-orange-500">📝</span>
                  Description (optionnelle)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 bg-white transition-all text-sm sm:text-base resize-none"
                  placeholder="Décrivez brièvement cette alerte..."
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Mots-clés * <Sparkles className="inline text-orange-500" size={16} />
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ajouter un mot-clé..."
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword, idx) => (
                    <span 
                      key={idx}
                      className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="text-orange-500 hover:text-orange-700"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                {errors.keywords && <p className="text-red-600 text-sm mt-1">{errors.keywords}</p>}
                <p className="text-sm text-gray-500 mt-2">
                  💡 L'IA enrichira automatiquement ces mots-clés avec des termes sémantiques
                </p>
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Categories */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-orange-500">📂</span>
                  Catégories
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${ formData.categories.includes(category)
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-400 shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Sélectionnez les catégories d'articles à surveiller
                </p>
              </div>

              {/* Sources RSS Spécifiques */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-orange-500">📰</span>
                  Sources Spécifiques (optionnel)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                  {availableSources.map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => toggleSource(source)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm text-left ${
                        formData.sources.includes(source)
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-2 border-green-400 shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Laissez vide pour surveiller toutes les sources
                </p>
              </div>
            </div>
          </div>

          {/* SECTION WHATSAPP */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-900">Notifications WhatsApp</span>
                {formData.whatsapp_enabled && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    Activé
                  </span>
                )}
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.whatsapp_enabled}
                  onChange={toggleWhatsApp}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* INFO CRÉDITS */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-blue-900">Vos crédits WhatsApp</p>
                  <p className="text-blue-700 mt-1">
                    Disponibles: <span className="font-bold">{userCredits}</span> crédits
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    • 1er numéro: <span className="font-bold">GRATUIT</span> 🎁<br/>
                    • Numéros supplémentaires: 10 crédits/numéro (jusqu'à 10 max)
                  </p>
                </div>
              </div>
            </div>

            {/* LISTE NUMÉROS */}
            {formData.whatsapp_numbers && formData.whatsapp_numbers.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Numéros configurés ({formData.whatsapp_numbers.length}/10)
                </label>
                
                <div className="space-y-2">
                  {formData.whatsapp_numbers.map((number, index) => (
                    <div
                      key={number}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{number}</p>
                          <p className="text-xs text-gray-500">
                            {index === 0 ? '🎁 Gratuit' : `💎 ${CREDITS_PER_NUMBER} crédits`}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveWhatsappNumber(number)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Retirer ce numéro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                {(formData.whatsapp_credits_used ?? 0) > 0 && (
                  <p className="text-xs text-gray-600">
                    💎 Total crédits utilisés: <span className="font-bold">{formData.whatsapp_credits_used}</span>
                  </p>
                )}
              </div>
            )}

            {/* AJOUTER NUMÉRO */}
            {(!formData.whatsapp_numbers || formData.whatsapp_numbers.length < 10) && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Ajouter un numéro WhatsApp
                </label>
                
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWhatsappNumber()}
                    placeholder="+241 XX XX XX XX"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                  <button
                    onClick={handleAddWhatsappNumber}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
                
                {errors.whatsapp && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.whatsapp}
                  </p>
                )}
                
                <p className="text-xs text-gray-500">
                  Format international requis (ex: +241 01 23 45 67)
                </p>
              </div>
            )}

            {/* PREVIEW MESSAGE */}
            {formData.whatsapp_enabled && formData.whatsapp_numbers && formData.whatsapp_numbers.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-700 mb-2">📱 Aperçu du message WhatsApp:</p>
                <div className="bg-white rounded-lg p-3 text-xs font-mono border border-gray-300">
                  <p className="font-bold">🔔 Nouvelle Alerte: {formData.name || '[Nom alerte]'}</p>
                  <p className="mt-2 font-bold">📰 [Titre de l'article]</p>
                  <p className="mt-1 text-gray-600">[Résumé de l'article...]</p>
                  <p className="mt-2 text-blue-600">🔗 Lire l'article: [URL]</p>
                  <p className="mt-2">🎯 Mots-clés: {formData.keywords.join(', ') || '[keywords]'}</p>
                  <p>📊 Correspondance: [XX]%</p>
                  <p className="mt-2 text-gray-500 italic">---<br/>Alerte envoyée par Gabon Insight</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-orange-200">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              disabled={loading}
              className="px-6 sm:px-8 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-all font-semibold disabled:opacity-50 shadow-sm"
            >
              ✖️ Annuler
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={loading}
              className="px-6 sm:px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {loading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>}
              {alert ? '✓ Mettre à jour' : '✨ Créer l\'Alerte'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
