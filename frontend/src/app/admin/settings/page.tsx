'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Settings, 
  Globe, 
  Bell, 
  Shield, 
  Database, 
  Mail, 
  Smartphone,
  CreditCard,
  Palette,
  Clock,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  Server,
  MessageSquare,
  Newspaper,
  Bot,
  Volume2
} from 'lucide-react'

// Types
interface AppSetting {
  id: string
  key: string
  value: string
  description: string
  created_at: string
  updated_at: string
}

interface SettingCategory {
  id: string
  label: string
  icon: any
  description: string
}

// Catégories de paramètres
const SETTING_CATEGORIES: SettingCategory[] = [
  { id: 'general', label: 'Général', icon: Settings, description: 'Paramètres généraux de l\'application' },
  { id: 'credits', label: 'Crédits & Paiements', icon: CreditCard, description: 'Configuration des crédits et paiements' },
  { id: 'ai', label: 'Intelligence Artificielle', icon: Bot, description: 'Configuration des services IA' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Paramètres des notifications' },
  { id: 'content', label: 'Contenu & Articles', icon: Newspaper, description: 'Gestion du contenu' },
  { id: 'audio', label: 'Audio & TTS', icon: Volume2, description: 'Paramètres audio et synthèse vocale' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, description: 'Configuration WhatsApp Business' },
  { id: 'security', label: 'Sécurité', icon: Shield, description: 'Paramètres de sécurité' },
  { id: 'maintenance', label: 'Maintenance', icon: Server, description: 'Outils de maintenance' },
]

// Configuration par défaut des paramètres
const DEFAULT_SETTINGS: Record<string, { key: string; label: string; type: string; default: string; description: string; category: string; options?: string[] }> = {
  // Général
  site_name: { key: 'site_name', label: 'Nom du site', type: 'text', default: 'Gabon Insight', description: 'Nom affiché sur le site', category: 'general' },
  site_description: { key: 'site_description', label: 'Description', type: 'textarea', default: 'Le premier média digital du Gabon', description: 'Description du site pour le SEO', category: 'general' },
  contact_email: { key: 'contact_email', label: 'Email de contact', type: 'email', default: 'contact@gaboninsight.com', description: 'Email principal de contact', category: 'general' },
  timezone: { key: 'timezone', label: 'Fuseau horaire', type: 'select', default: 'Africa/Libreville', description: 'Fuseau horaire par défaut', category: 'general', options: ['Africa/Libreville', 'Europe/Paris', 'UTC'] },
  language: { key: 'language', label: 'Langue par défaut', type: 'select', default: 'fr', description: 'Langue principale du site', category: 'general', options: ['fr', 'en'] },
  
  // Crédits & Paiements
  credit_value_fcfa: { key: 'credit_value_fcfa', label: 'Valeur d\'un crédit (FCFA)', type: 'number', default: '10', description: 'Valeur monétaire d\'un crédit en FCFA', category: 'credits' },
  free_credits_signup: { key: 'free_credits_signup', label: 'Crédits gratuits à l\'inscription', type: 'number', default: '100', description: 'Nombre de crédits offerts aux nouveaux utilisateurs', category: 'credits' },
  min_credit_purchase: { key: 'min_credit_purchase', label: 'Achat minimum (crédits)', type: 'number', default: '100', description: 'Nombre minimum de crédits par achat', category: 'credits' },
  payment_methods: { key: 'payment_methods', label: 'Méthodes de paiement', type: 'multiselect', default: 'mobile_money,card', description: 'Méthodes de paiement acceptées', category: 'credits', options: ['mobile_money', 'card', 'bank_transfer', 'paypal'] },
  
  // Intelligence Artificielle
  default_ai_model: { key: 'default_ai_model', label: 'Modèle IA par défaut', type: 'select', default: 'gemini-3-pro', description: 'Modèle IA utilisé par défaut', category: 'ai', options: ['gemini-3-pro', 'gpt-4-turbo-preview', 'gpt-4o-mini', 'llama-3.1-70b', 'mistral-7b'] },
  ai_temperature: { key: 'ai_temperature', label: 'Température IA', type: 'number', default: '0.7', description: 'Créativité des réponses IA (0-1)', category: 'ai' },
  ai_max_tokens: { key: 'ai_max_tokens', label: 'Tokens max par requête', type: 'number', default: '2000', description: 'Limite de tokens par requête IA', category: 'ai' },
  ai_cache_duration: { key: 'ai_cache_duration', label: 'Durée cache IA (minutes)', type: 'number', default: '5', description: 'Durée de mise en cache des configurations IA', category: 'ai' },
  
  // Notifications
  notifications_enabled: { key: 'notifications_enabled', label: 'Notifications activées', type: 'boolean', default: 'true', description: 'Activer/désactiver les notifications', category: 'notifications' },
  email_notifications: { key: 'email_notifications', label: 'Notifications email', type: 'boolean', default: 'true', description: 'Envoyer des notifications par email', category: 'notifications' },
  push_notifications: { key: 'push_notifications', label: 'Notifications push', type: 'boolean', default: 'true', description: 'Envoyer des notifications push', category: 'notifications' },
  whatsapp_notifications: { key: 'whatsapp_notifications', label: 'Notifications WhatsApp', type: 'boolean', default: 'true', description: 'Envoyer des notifications WhatsApp', category: 'notifications' },
  daily_digest_time: { key: 'daily_digest_time', label: 'Heure du digest quotidien', type: 'time', default: '08:00', description: 'Heure d\'envoi du résumé quotidien', category: 'notifications' },
  
  // Contenu & Articles
  articles_per_page: { key: 'articles_per_page', label: 'Articles par page', type: 'number', default: '20', description: 'Nombre d\'articles affichés par page', category: 'content' },
  auto_enrich_articles: { key: 'auto_enrich_articles', label: 'Enrichissement auto', type: 'boolean', default: 'true', description: 'Enrichir automatiquement les articles avec l\'IA', category: 'content' },
  rss_sync_interval: { key: 'rss_sync_interval', label: 'Intervalle sync RSS (min)', type: 'number', default: '30', description: 'Fréquence de synchronisation des flux RSS', category: 'content' },
  premium_article_preview: { key: 'premium_article_preview', label: 'Aperçu articles premium (%)', type: 'number', default: '30', description: 'Pourcentage visible des articles premium', category: 'content' },
  
  // Audio & TTS
  tts_enabled: { key: 'tts_enabled', label: 'TTS activé', type: 'boolean', default: 'true', description: 'Activer la synthèse vocale', category: 'audio' },
  tts_model: { key: 'tts_model', label: 'Modèle TTS', type: 'select', default: 'tts-1', description: 'Modèle de synthèse vocale', category: 'audio', options: ['tts-1', 'tts-1-hd'] },
  tts_voice: { key: 'tts_voice', label: 'Voix TTS', type: 'select', default: 'onyx', description: 'Voix utilisée pour le TTS', category: 'audio', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] },
  tts_speed: { key: 'tts_speed', label: 'Vitesse TTS', type: 'number', default: '1.0', description: 'Vitesse de lecture (0.25-4.0)', category: 'audio' },
  auto_generate_audio: { key: 'auto_generate_audio', label: 'Génération audio auto', type: 'boolean', default: 'false', description: 'Générer automatiquement l\'audio des articles', category: 'audio' },
  
  // WhatsApp
  whatsapp_enabled: { key: 'whatsapp_enabled', label: 'WhatsApp activé', type: 'boolean', default: 'true', description: 'Activer l\'intégration WhatsApp', category: 'whatsapp' },
  whatsapp_daily_limit: { key: 'whatsapp_daily_limit', label: 'Limite messages/jour', type: 'number', default: '1000', description: 'Limite de messages WhatsApp par jour', category: 'whatsapp' },
  whatsapp_broadcast_time: { key: 'whatsapp_broadcast_time', label: 'Heure de diffusion', type: 'time', default: '07:00', description: 'Heure d\'envoi des messages quotidiens', category: 'whatsapp' },
  
  // Sécurité
  max_login_attempts: { key: 'max_login_attempts', label: 'Tentatives de connexion max', type: 'number', default: '5', description: 'Nombre max de tentatives avant blocage', category: 'security' },
  session_timeout: { key: 'session_timeout', label: 'Timeout session (heures)', type: 'number', default: '24', description: 'Durée de validité d\'une session', category: 'security' },
  require_email_verification: { key: 'require_email_verification', label: 'Vérification email requise', type: 'boolean', default: 'true', description: 'Exiger la vérification de l\'email', category: 'security' },
  
  // Maintenance
  maintenance_mode: { key: 'maintenance_mode', label: 'Mode maintenance', type: 'boolean', default: 'false', description: 'Activer le mode maintenance', category: 'maintenance' },
  debug_mode: { key: 'debug_mode', label: 'Mode debug', type: 'boolean', default: 'false', description: 'Activer les logs de debug', category: 'maintenance' },
  cache_enabled: { key: 'cache_enabled', label: 'Cache activé', type: 'boolean', default: 'true', description: 'Activer le système de cache', category: 'maintenance' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState('general')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  
  // Using singleton supabase from @/lib/supabase

  // Charger les paramètres
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')

      if (error) throw error

      // Convertir en objet clé-valeur
      const settingsMap: Record<string, string> = {}
      
      // D'abord, mettre les valeurs par défaut
      Object.values(DEFAULT_SETTINGS).forEach(setting => {
        settingsMap[setting.key] = setting.default
      })
      
      // Puis, écraser avec les valeurs de la DB
      data?.forEach((item: AppSetting) => {
        settingsMap[item.key] = item.value
      })

      setSettings(settingsMap)
    } catch (error) {
      console.error('Erreur chargement paramètres:', error)
      setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres' })
    } finally {
      setLoading(false)
    }
  }

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      // Sauvegarder chaque paramètre modifié
      for (const [key, value] of Object.entries(settings)) {
        const settingConfig = DEFAULT_SETTINGS[key]
        if (!settingConfig) continue

        // Upsert le paramètre
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            key,
            value,
            description: settingConfig.description,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          })

        if (error) throw error
      }

      setMessage({ type: 'success', text: 'Paramètres sauvegardés avec succès' })
      setHasChanges(false)
      
      // Effacer le message après 3 secondes
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) return
    
    const defaultValues: Record<string, string> = {}
    Object.values(DEFAULT_SETTINGS).forEach(setting => {
      defaultValues[setting.key] = setting.default
    })
    setSettings(defaultValues)
    setHasChanges(true)
  }

  const getCategorySettings = (categoryId: string) => {
    return Object.values(DEFAULT_SETTINGS).filter(s => s.category === categoryId)
  }

  const renderSettingInput = (setting: typeof DEFAULT_SETTINGS[string]) => {
    const value = settings[setting.key] ?? setting.default

    switch (setting.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleSettingChange(setting.key, e.target.checked ? 'true' : 'false')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        )

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {setting.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )

      case 'multiselect':
        const selectedValues = value.split(',').filter(Boolean)
        return (
          <div className="flex flex-wrap gap-2">
            {setting.options?.map(opt => (
              <label key={opt} className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, opt]
                      : selectedValues.filter(v => v !== opt)
                    handleSettingChange(setting.key, newValues.join(','))
                  }}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="ml-2 text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        )

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            step={setting.key.includes('temperature') || setting.key.includes('speed') ? '0.1' : '1'}
          />
        )

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        )

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-orange-500" />
            Paramètres
          </h1>
          <p className="text-gray-600 mt-1">Configurez les paramètres de votre application</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Réinitialiser
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              hasChanges
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Layout principal */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar des catégories */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Catégories</h3>
            </div>
            <nav className="p-2">
              {SETTING_CATEGORIES.map((category) => {
                const Icon = category.icon
                const isActive = activeCategory === category.id
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">{category.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Contenu des paramètres */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header de la catégorie */}
            {SETTING_CATEGORIES.filter(c => c.id === activeCategory).map(category => {
              const Icon = category.icon
              return (
                <div key={category.id} className="p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{category.label}</h2>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Liste des paramètres */}
            <div className="divide-y divide-gray-100">
              {getCategorySettings(activeCategory).map((setting) => (
                <div key={setting.key} className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <label className="block font-medium text-gray-900 mb-1">
                        {setting.label}
                      </label>
                      <p className="text-sm text-gray-500 mb-3">{setting.description}</p>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {setting.key}
                      </code>
                    </div>
                    <div className="sm:w-64 flex-shrink-0">
                      {renderSettingInput(setting)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section API Keys (Maintenance) */}
          {activeCategory === 'maintenance' && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  État des API
                </h3>
                <p className="text-sm text-gray-600 mt-1">Vérifiez la configuration des clés API</p>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500 mb-2">Les statuts sont vérifiés côté serveur (Railway). Consultez les variables d'environnement dans le dashboard Railway.</p>
                {[
                  { name: 'OPENAI_API_KEY', label: 'OpenAI' },
                  { name: 'SUPABASE_URL', label: 'Supabase' },
                  { name: 'WHAPI_TOKEN', label: 'WhatsApp (Whapi)' },
                  { name: 'EBILLING_API_KEY', label: 'E-Billing' },
                ].map((api) => (
                  <div key={api.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{api.label}</p>
                        <code className="text-xs text-gray-500">{api.name}</code>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      Voir Railway
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions rapides (Maintenance) */}
          {activeCategory === 'maintenance' && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  Actions de maintenance
                </h3>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={async () => {
                    if (!confirm('Synchroniser les flux RSS maintenant ?')) return
                    setMessage({ type: 'success', text: 'Synchronisation RSS en cours...' })
                    try {
                      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                      const res = await fetch(`${API_URL}/api/rss/process-all`, { method: 'POST' })
                      const data = await res.json()
                      setMessage({ type: data.success ? 'success' : 'error', text: data.success ? 'Synchronisation RSS terminée avec succès' : `Erreur: ${data.error}` })
                    } catch {
                      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' })
                    }
                  }}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <Newspaper className="w-6 h-6 text-green-500 mb-2" />
                  <p className="font-medium text-gray-900">Sync RSS</p>
                  <p className="text-sm text-gray-500">Synchronise tous les flux RSS</p>
                </button>

                <button
                  onClick={async () => {
                    if (!confirm('Forcer le traitement RSS immédiat ?')) return
                    setMessage({ type: 'success', text: 'Traitement RSS en cours...' })
                    try {
                      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                      const res = await fetch(`${API_URL}/api/rss/process`, { method: 'POST' })
                      const data = await res.json()
                      setMessage({ type: data.success ? 'success' : 'error', text: data.success ? 'Traitement RSS terminé' : `Erreur: ${data.error}` })
                    } catch {
                      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' })
                    }
                  }}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <Bot className="w-6 h-6 text-purple-500 mb-2" />
                  <p className="font-medium text-gray-900">Traitement RSS agrégé</p>
                  <p className="text-sm text-gray-500">Force le traitement du flux agrégé</p>
                </button>

                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 opacity-60 cursor-not-allowed text-left">
                  <RefreshCw className="w-6 h-6 text-blue-500 mb-2" />
                  <p className="font-medium text-gray-900">Vider le cache</p>
                  <p className="text-sm text-gray-500">Non disponible (pas de Redis configuré)</p>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 opacity-60 cursor-not-allowed text-left">
                  <Server className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="font-medium text-gray-900">Exporter logs</p>
                  <p className="text-sm text-gray-500">Non disponible (consultez Railway)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
