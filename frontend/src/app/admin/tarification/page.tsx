'use client'

import { useState, useEffect } from 'react'
import {
  Coins, Save, RefreshCw, Edit2, X, Check, AlertCircle,
  Sparkles, FileText, Target, GraduationCap, Briefcase,
  Bell, Mic, Search, TrendingUp, Zap, DollarSign, Info,
  Brain, Bot, Calculator
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

interface PricingItem {
  id: string
  feature_key: string
  feature_name: string
  feature_description: string
  credits_cost: number
  ai_model: string | null
  estimated_api_cost_usd: number | null
  category: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AIModelCost {
  model: string
  input_cost_per_1k: number
  output_cost_per_1k: number
  avg_tokens_per_request: number
}

// Coûts réels des API IA utilisées dans l'application (en USD)
const AI_MODEL_COSTS: AIModelCost[] = [
  // === Google Gemini (modèle principal de l'app) ===
  { model: 'gemini-2.0-flash', input_cost_per_1k: 0.0001, output_cost_per_1k: 0.0004, avg_tokens_per_request: 2000 },
  { model: 'gemini-1.5-flash', input_cost_per_1k: 0.000075, output_cost_per_1k: 0.0003, avg_tokens_per_request: 2000 },
  { model: 'gemini-1.5-pro', input_cost_per_1k: 0.00125, output_cost_per_1k: 0.005, avg_tokens_per_request: 2000 },

  // === OpenAI (API secondaire) ===
  { model: 'gpt-4-turbo', input_cost_per_1k: 0.01, output_cost_per_1k: 0.03, avg_tokens_per_request: 2000 },
  { model: 'gpt-4o', input_cost_per_1k: 0.005, output_cost_per_1k: 0.015, avg_tokens_per_request: 2000 },
  { model: 'gpt-4o-mini', input_cost_per_1k: 0.00015, output_cost_per_1k: 0.0006, avg_tokens_per_request: 1500 },
  { model: 'gpt-3.5-turbo', input_cost_per_1k: 0.0005, output_cost_per_1k: 0.0015, avg_tokens_per_request: 1000 },

  // === OpenAI Audio ===
  { model: 'tts-1', input_cost_per_1k: 0.015, output_cost_per_1k: 0, avg_tokens_per_request: 0 }, // TTS: $15/1M chars
  { model: 'tts-1-hd', input_cost_per_1k: 0.030, output_cost_per_1k: 0, avg_tokens_per_request: 0 },
  { model: 'whisper-1', input_cost_per_1k: 0.006, output_cost_per_1k: 0, avg_tokens_per_request: 0 }, // $0.006/minute

  // === Replicate - Meta Llama 3.1 ===
  { model: 'llama-3.1-8b', input_cost_per_1k: 0.00005, output_cost_per_1k: 0.00005, avg_tokens_per_request: 1500 },
  { model: 'llama-3.1-70b', input_cost_per_1k: 0.00065, output_cost_per_1k: 0.00065, avg_tokens_per_request: 2000 },

  // === Replicate - Mistral (excellent pour le français) ===
  { model: 'mistral-7b', input_cost_per_1k: 0.00005, output_cost_per_1k: 0.00005, avg_tokens_per_request: 1000 },
  { model: 'mixtral-8x7b', input_cost_per_1k: 0.0003, output_cost_per_1k: 0.0003, avg_tokens_per_request: 1500 },
]

// Configuration par défaut des fonctionnalités (avec les modèles réellement utilisés dans l'app)
const DEFAULT_FEATURES: Omit<PricingItem, 'id' | 'created_at' | 'updated_at'>[] = [
  // Business / Projets
  { feature_key: 'initial_analysis', feature_name: 'Analyse Initiale', feature_description: 'Analyse IA d\'une opportunité business à partir d\'un article', credits_cost: 25, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.04, category: 'business', is_active: true },
  { feature_key: 're_analysis', feature_name: 'Ré-analyse Contextuelle', feature_description: 'Nouvelle analyse avec contexte enrichi', credits_cost: 25, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.05, category: 'business', is_active: true },
  { feature_key: 'action_plan', feature_name: 'Plan d\'Action', feature_description: 'Génération d\'un plan d\'action détaillé', credits_cost: 25, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.04, category: 'business', is_active: true },
  { feature_key: 'skill_test', feature_name: 'Test de Compétences', feature_description: 'Évaluation des compétences pour un projet', credits_cost: 30, ai_model: 'llama-3.1-70b', estimated_api_cost_usd: 0.013, category: 'business', is_active: true },
  { feature_key: 'custom_training', feature_name: 'Formation Personnalisée', feature_description: 'Génération d\'un parcours de formation sur mesure', credits_cost: 50, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.08, category: 'business', is_active: true },
  { feature_key: 'business_plan', feature_name: 'Business Plan Complet', feature_description: 'Génération d\'un business plan professionnel', credits_cost: 150, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.15, category: 'business', is_active: true },
  { feature_key: 'motivation_letter', feature_name: 'Lettre de Motivation', feature_description: 'Génération d\'une lettre de motivation/candidature', credits_cost: 20, ai_model: 'gemini-3-pro', estimated_api_cost_usd: 0.0015, category: 'business', is_active: true },
  { feature_key: 'sponsored_article', feature_name: 'Article Sponsorisé', feature_description: 'Génération d\'un article sponsorisé professionnel', credits_cost: 50, ai_model: 'gemini-3-pro', estimated_api_cost_usd: 0.002, category: 'business', is_active: true },
  
  // Articles / Contenu
  { feature_key: 'article_premium', feature_name: 'Article Premium', feature_description: 'Déverrouillage d\'un article premium', credits_cost: 1, ai_model: null, estimated_api_cost_usd: 0, category: 'content', is_active: true },
  { feature_key: 'audio_summary', feature_name: 'Résumé Audio', feature_description: 'Génération d\'un résumé audio de l\'article (OpenAI TTS)', credits_cost: 5, ai_model: 'tts-1', estimated_api_cost_usd: 0.02, category: 'content', is_active: true },
  { feature_key: 'ai_analysis', feature_name: 'Analyse IA Article', feature_description: 'Analyse approfondie d\'un article par IA', credits_cost: 10, ai_model: 'llama-3.1-8b', estimated_api_cost_usd: 0.0001, category: 'content', is_active: true },
  { feature_key: 'tldr_summary', feature_name: 'Résumé TL;DR', feature_description: 'Génération d\'un résumé court de l\'article', credits_cost: 0, ai_model: 'mistral-7b', estimated_api_cost_usd: 0.0001, category: 'content', is_active: true },
  
  // Veille
  { feature_key: 'veille_report', feature_name: 'Rapport de Veille', feature_description: 'Rapport complet de veille sectorielle', credits_cost: 20, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.06, category: 'veille', is_active: true },
  { feature_key: 'custom_alert', feature_name: 'Alerte Personnalisée', feature_description: 'Débit de 5 crédits pour chaque alerte trouvée', credits_cost: 5, ai_model: null, estimated_api_cost_usd: 0, category: 'veille', is_active: true },
  { feature_key: 'opportunity_analysis', feature_name: 'Analyse d\'Opportunité', feature_description: 'Analyse d\'une opportunité détectée', credits_cost: 15, ai_model: 'llama-3.1-70b', estimated_api_cost_usd: 0.013, category: 'veille', is_active: true },
  
  // Chat / Assistant
  { feature_key: 'chat_message', feature_name: 'Message Chat IA', feature_description: 'Un message dans le chat assistant projet', credits_cost: 2, ai_model: 'gpt-4o-mini', estimated_api_cost_usd: 0.0006, category: 'chat', is_active: true },
  { feature_key: 'document_analysis', feature_name: 'Analyse Document', feature_description: 'Analyse d\'un document uploadé', credits_cost: 15, ai_model: 'gpt-4-turbo-preview', estimated_api_cost_usd: 0.03, category: 'chat', is_active: true },
]

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; bgClass: string; borderClass: string; textClass: string; iconClass: string }> = {
  business: { label: 'Business & Projets', icon: Briefcase, bgClass: 'bg-blue-50', borderClass: 'border-blue-100', textClass: 'text-blue-900', iconClass: 'text-blue-500' },
  content: { label: 'Articles & Contenu', icon: FileText, bgClass: 'bg-green-50', borderClass: 'border-green-100', textClass: 'text-green-900', iconClass: 'text-green-500' },
  veille: { label: 'Veille & Alertes', icon: Bell, bgClass: 'bg-orange-50', borderClass: 'border-orange-100', textClass: 'text-orange-900', iconClass: 'text-orange-500' },
  chat: { label: 'Chat & Assistant', icon: Bot, bgClass: 'bg-purple-50', borderClass: 'border-purple-100', textClass: 'text-purple-900', iconClass: 'text-purple-500' },
}

export default function TarificationPage() {
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<PricingItem>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [creditValue, setCreditValue] = useState(10) // 1 crédit = 10 FCFA par défaut
  const [showCostCalculator, setShowCostCalculator] = useState(false)

  useEffect(() => {
    loadPricing()
    loadCreditValue()
  }, [])

  const loadCreditValue = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'credit_value_fcfa')
        .single()
      
      if (data) {
        setCreditValue(parseInt(data.value) || 10)
      }
    } catch (error) {
      console.log('Utilisation valeur par défaut pour crédit')
    }
  }

  const loadPricing = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .order('category', { ascending: true })
        .order('credits_cost', { ascending: true })

      if (error) {
        // Si la table n'existe pas, on utilise les valeurs par défaut
        console.warn('Table pricing_config non trouvée, utilisation des valeurs par défaut')
        const defaultData = DEFAULT_FEATURES.map((f, i) => ({
          ...f,
          id: `default-${i}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
        setPricing(defaultData as PricingItem[])
      } else {
        setPricing(data || [])
      }
    } catch (error) {
      console.error('Erreur chargement tarifs:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializePricing = async () => {
    try {
      setSaving(true)
      
      // Insérer les valeurs par défaut
      for (const feature of DEFAULT_FEATURES) {
        const { error } = await supabase
          .from('pricing_config')
          .upsert({
            ...feature,
            updated_at: new Date().toISOString()
          }, { onConflict: 'feature_key' })
        
        if (error) {
          console.error('Erreur insertion:', feature.feature_key, error)
        }
      }
      
      setMessage({ type: 'success', text: 'Tarification initialisée avec succès!' })
      loadPricing()
    } catch (error) {
      console.error('Erreur initialisation:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'initialisation' })
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (item: PricingItem) => {
    setEditingId(item.id)
    setEditValues({
      credits_cost: item.credits_cost,
      ai_model: item.ai_model,
      estimated_api_cost_usd: item.estimated_api_cost_usd,
      is_active: item.is_active
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEditing = async (item: PricingItem) => {
    try {
      setSaving(true)

      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Non authentifié')
      }

      // Utiliser l'API backend pour la mise à jour (contourne RLS)
      const response = await fetch(`${API_URL}/api/pricing/${item.feature_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          credits_cost: editValues.credits_cost,
          ai_model: editValues.ai_model,
          estimated_api_cost_usd: editValues.estimated_api_cost_usd,
          is_active: editValues.is_active
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      setMessage({ type: 'success', text: `Tarif "${item.feature_name}" mis à jour!` })
      setEditingId(null)
      setEditValues({})
      loadPricing()
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error)
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  const saveCreditValue = async () => {
    try {
      setSaving(true)

      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Non authentifié')
      }

      // Utiliser l'API backend pour la mise à jour (contourne RLS)
      const response = await fetch(`${API_URL}/api/pricing/settings/credit-value`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ value: creditValue })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erreur lors de la mise à jour')
      }

      setMessage({ type: 'success', text: 'Valeur du crédit mise à jour!' })
    } catch (error: any) {
      console.error('Erreur sauvegarde valeur crédit:', error)
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  const calculateEstimatedCost = (model: string | null): number => {
    if (!model) return 0
    const modelCost = AI_MODEL_COSTS.find(m => m.model === model)
    if (!modelCost) return 0
    
    const avgTokens = modelCost.avg_tokens_per_request
    const inputCost = (avgTokens / 2 / 1000) * modelCost.input_cost_per_1k
    const outputCost = (avgTokens / 2 / 1000) * modelCost.output_cost_per_1k
    return inputCost + outputCost
  }

  const getCategoryItems = (category: string) => {
    return pricing.filter(p => p.category === category)
  }

  const getTotalStats = () => {
    const activeItems = pricing.filter(p => p.is_active)
    const totalApiCost = activeItems.reduce((sum, p) => sum + (p.estimated_api_cost_usd || 0), 0)
    const avgCredits = activeItems.length > 0 
      ? Math.round(activeItems.reduce((sum, p) => sum + p.credits_cost, 0) / activeItems.length)
      : 0
    return { activeItems: activeItems.length, totalApiCost, avgCredits }
  }

  const stats = getTotalStats()

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des tarifs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💰 Tarification & Crédits</h1>
          <p className="text-gray-500 mt-1">Gérez les coûts en crédits de chaque fonctionnalité</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPricing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          {pricing.length === 0 && (
            <button
              onClick={initializePricing}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              Initialiser les tarifs
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-orange-500" />
            <span className="text-sm text-gray-500">Fonctionnalités</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.activeItems}</p>
          <p className="text-xs text-gray-500">actives</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Coût moyen</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.avgCredits}</p>
          <p className="text-xs text-gray-500">crédits/action</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Coût API total</span>
          </div>
          <p className="text-2xl font-bold text-green-600">${stats.totalApiCost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">estimé/usage</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Valeur crédit</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{creditValue} FCFA</p>
          <p className="text-xs text-gray-500">= 1 crédit</p>
        </div>
      </div>

      {/* Configuration valeur crédit */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-orange-500" />
          Valeur du Crédit
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">1 crédit =</span>
            <input
              type="number"
              value={creditValue}
              onChange={(e) => setCreditValue(parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
              min="1"
            />
            <span className="text-gray-600">FCFA</span>
          </div>
          <button
            onClick={saveCreditValue}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Cette valeur est utilisée pour calculer le prix en FCFA des packs de crédits
        </p>
      </div>

      {/* Coûts API IA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <button
          onClick={() => setShowCostCalculator(!showCostCalculator)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Coûts Réels des API IA (référence)
          </h3>
          <span className="text-gray-400">{showCostCalculator ? '▼' : '▶'}</span>
        </button>
        
        {showCostCalculator && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Modèle</th>
                  <th className="px-3 py-2 text-right">Input $/1K tokens</th>
                  <th className="px-3 py-2 text-right">Output $/1K tokens</th>
                  <th className="px-3 py-2 text-right">Tokens moy./req</th>
                  <th className="px-3 py-2 text-right">Coût estimé/req</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {AI_MODEL_COSTS.map((model) => (
                  <tr key={model.model} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{model.model}</td>
                    <td className="px-3 py-2 text-right text-gray-600">${model.input_cost_per_1k.toFixed(5)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">${model.output_cost_per_1k.toFixed(5)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{model.avg_tokens_per_request || '-'}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">
                      ${calculateEstimatedCost(model.model).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tarifs par catégorie */}
      {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
        const items = getCategoryItems(category)
        if (items.length === 0) return null
        
        const CategoryIcon = config.icon
        
        return (
          <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`px-6 py-4 ${config.bgClass} border-b ${config.borderClass}`}>
              <h3 className={`font-semibold ${config.textClass} flex items-center gap-2`}>
                <CategoryIcon className={`w-5 h-5 ${config.iconClass}`} />
                {config.label}
                <span className="text-sm font-normal text-gray-500">({items.length} fonctionnalités)</span>
              </h3>
            </div>
            
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className={`p-4 ${!item.is_active ? 'bg-gray-50 opacity-60' : ''}`}>
                  {editingId === item.id ? (
                    // Mode édition
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{item.feature_name}</h4>
                          <p className="text-sm text-gray-500">{item.feature_description}</p>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
                            {item.feature_key}
                          </code>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Coût (crédits)
                          </label>
                          <input
                            type="number"
                            value={editValues.credits_cost || 0}
                            onChange={(e) => setEditValues({ ...editValues, credits_cost: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Modèle IA
                          </label>
                          <select
                            value={editValues.ai_model || ''}
                            onChange={(e) => {
                              const model = e.target.value || null
                              setEditValues({ 
                                ...editValues, 
                                ai_model: model,
                                estimated_api_cost_usd: calculateEstimatedCost(model)
                              })
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="">Aucun</option>
                            {AI_MODEL_COSTS.map(m => (
                              <option key={m.model} value={m.model}>{m.model}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Coût API (USD)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={editValues.estimated_api_cost_usd || 0}
                            onChange={(e) => setEditValues({ ...editValues, estimated_api_cost_usd: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Statut
                          </label>
                          <select
                            value={editValues.is_active ? 'active' : 'inactive'}
                            onChange={(e) => setEditValues({ ...editValues, is_active: e.target.value === 'active' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="active">Actif</option>
                            <option value="inactive">Inactif</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => saveEditing(item)}
                          disabled={saving}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Sauvegarder
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Mode affichage
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{item.feature_name}</h4>
                          {!item.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">Inactif</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{item.feature_description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <code className="bg-gray-100 px-2 py-0.5 rounded">{item.feature_key}</code>
                          {item.ai_model && (
                            <span className="flex items-center gap-1">
                              <Brain className="w-3 h-3" />
                              {item.ai_model}
                            </span>
                          )}
                          {item.estimated_api_cost_usd !== null && item.estimated_api_cost_usd > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <DollarSign className="w-3 h-3" />
                              ${item.estimated_api_cost_usd.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{item.credits_cost}</p>
                          <p className="text-xs text-gray-500">crédits</p>
                          <p className="text-xs text-gray-400">{item.credits_cost * creditValue} FCFA</p>
                        </div>
                        <button
                          onClick={() => startEditing(item)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Comment ça fonctionne ?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Les tarifs sont stockés en base de données et chargés dynamiquement par l'application</li>
              <li>Le coût API estimé vous aide à définir un prix rentable pour chaque fonctionnalité</li>
              <li>Les fonctionnalités inactives ne seront pas disponibles pour les utilisateurs</li>
              <li>La valeur du crédit en FCFA est utilisée pour les packs d'achat</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
