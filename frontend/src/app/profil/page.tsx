'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { User, Edit2, Save, X, Crown, CreditCard, Mail, Phone, Globe, Bell, Camera, Shield, Settings, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'

// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic'

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone_number?: string
  whatsapp_number?: string
  country_code?: string
  language?: string
  notification_preferences?: any
  subscription_plan?: string
  credits_balance?: number
  avatar_url?: string
}

export default function ProfilPage() {
  const { user, subscriptionPlan } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      if (user) {
        loadUserProfile()
      } else {
        // Si pas d'utilisateur connecté, arrêter le loading
        setLoading(false)
      }
    }
  }, [mounted, user])

  const loadUserProfile = async () => {
    if (!user) return

    try {
      // Essayer de récupérer le profil existant
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // L'utilisateur n'existe pas dans la table users, le créer
        console.log('Création du profil utilisateur...')
        const newUserProfile = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          phone_number: (user.user_metadata as any)?.phone_number || null,
          whatsapp_number: (user.user_metadata as any)?.whatsapp_number || null,
          country_code: (user.user_metadata as any)?.country_code || '+241',
          preferred_language: (user.user_metadata as any)?.language || 'fr',
          avatar_url: user.user_metadata?.avatar_url || null,
          subscription_type: 'free',
          subscription_status: 'active',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: newData, error: insertError } = await supabase
          .from('users')
          .insert(newUserProfile)
          .select()
          .single()

        if (insertError) {
          console.error('Erreur création profil:', insertError)
          // Fallback sur les données auth
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || '',
            email: user.email || '',
            phone_number: (user.user_metadata as any)?.phone_number || '',
            whatsapp_number: (user.user_metadata as any)?.whatsapp_number || '',
            country_code: (user.user_metadata as any)?.country_code || '+241',
            language: (user.user_metadata as any)?.language || 'fr',
            credits_balance: 0,
            avatar_url: user.user_metadata?.avatar_url || ''
          })
        } else {
          setProfile({
            ...newData,
            credits_balance: 0, // Valeur par défaut
            language: newData.preferred_language
          })
        }
      } else if (error) {
        console.error('Erreur chargement profil:', error)
        // Fallback sur les données auth
        setProfile({
          id: user.id,
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
          phone_number: (user.user_metadata as any)?.phone_number || '',
          whatsapp_number: (user.user_metadata as any)?.whatsapp_number || '',
          country_code: (user.user_metadata as any)?.country_code || '+241',
          language: (user.user_metadata as any)?.language || 'fr',
          credits_balance: 0,
          avatar_url: user.user_metadata?.avatar_url || ''
        })
      } else {
        setProfile({
          ...data,
          credits_balance: data.credits_balance || 0,
          language: data.preferred_language || data.language || 'fr'
        })
      }
    } catch (error) {
      console.error('Erreur:', error)
      // Fallback final
      setProfile({
        id: user.id,
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone_number: '',
        whatsapp_number: '',
        country_code: '+241',
        language: 'fr',
        credits_balance: 0,
        avatar_url: ''
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setEditForm({ ...profile })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditForm({})
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!profile || !editForm) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: profile.id,
          ...editForm,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Erreur sauvegarde:', error)
        alert('Erreur lors de la sauvegarde')
        return
      }

      setProfile({ ...profile, ...editForm })
      setIsEditing(false)
      setEditForm({})
      alert('Profil mis à jour avec succès !')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const getPlanColor = (plan?: string) => {
    switch (plan?.toLowerCase()) {
      case 'premium': return 'from-orange-500 to-red-500'
      case 'pro': return 'from-purple-500 to-indigo-500'
      default: return 'from-gray-400 to-gray-600'
    }
  }

  const getPlanIcon = (plan?: string) => {
    if (plan?.toLowerCase() === 'premium' || plan?.toLowerCase() === 'pro') {
      return <Crown className="w-5 h-5 text-yellow-400" />
    }
    return null
  }

  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connexion requise</h2>
          <p className="text-gray-600 mb-4">Vous devez être connecté pour accéder à votre profil.</p>
          <a 
            href="/auth/signin" 
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium"
          >
            Se connecter
          </a>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Profil non trouvé</h2>
          <p className="text-gray-600">Impossible de charger les informations du profil.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      {/* Hero Section avec Avatar */}
      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Bouton retour au site */}
        <div className="absolute top-4 left-4 z-20">
          <a
            href="/"
            className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl hover:bg-white/30 transition-all duration-200 border border-white/30 hover:scale-105 transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Retour au site</span>
          </a>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Avatar avec upload */}
            <div className="relative inline-block mb-6">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-xl object-cover"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white shadow-xl flex items-center justify-center">
                  <User className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                </div>
              )}
              <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                <Camera className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
              {profile.full_name || 'Utilisateur'}
            </h1>
            <p className="text-white/90 text-lg sm:text-xl mb-4">{profile.email}</p>
            
            {/* Badge abonnement */}
            <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
              {getPlanIcon(subscriptionPlan?.slug)}
              <span className="text-white font-medium">{subscriptionPlan?.name || 'Gratuit'}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-8 space-y-6">
            {/* Informations personnelles */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Informations personnelles</h2>
                </div>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="font-medium">Modifier</span>
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                      <span>Annuler</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-200 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {/* Nom complet */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2 text-orange-500" />
                    Nom complet
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.full_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="Votre nom complet"
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border-2 border-transparent group-hover:border-gray-200 transition-all duration-200">
                      <p className="text-gray-900 font-medium">{profile.full_name || 'Non renseigné'}</p>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-orange-500" />
                    Email
                  </label>
                  <div className="bg-gray-50 rounded-xl p-4 border-2 border-transparent">
                    <p className="text-gray-900 font-medium">{profile.email}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Shield className="w-3 h-3 mr-1" />
                      L'email ne peut pas être modifié
                    </p>
                  </div>
                </div>

                {/* Téléphone */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-orange-500" />
                    Téléphone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="Votre numéro de téléphone"
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border-2 border-transparent group-hover:border-gray-200 transition-all duration-200">
                      <p className="text-gray-900 font-medium">{profile.phone_number || 'Non renseigné'}</p>
                    </div>
                  )}
                </div>

                {/* WhatsApp */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <div className="w-4 h-4 mr-2 text-green-500">📱</div>
                    WhatsApp
                  </label>
                  {isEditing ? (
                    <div className="flex space-x-2">
                      <select
                        value={editForm.country_code || '+241'}
                        onChange={(e) => setEditForm({ ...editForm, country_code: e.target.value })}
                        className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                      >
                        <option value="+241">🇬🇦 +241</option>
                        <option value="+33">🇫🇷 +33</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                      </select>
                      <input
                        type="tel"
                        value={editForm.whatsapp_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Numéro WhatsApp"
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border-2 border-transparent group-hover:border-gray-200 transition-all duration-200">
                      <p className="text-gray-900 font-medium">
                        {profile.country_code} {profile.whatsapp_number || 'Non renseigné'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Langue */}
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-orange-500" />
                    Langue
                  </label>
                  {isEditing ? (
                    <select
                      value={editForm.language || 'fr'}
                      onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇺🇸 English</option>
                    </select>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 border-2 border-transparent group-hover:border-gray-200 transition-all duration-200">
                      <p className="text-gray-900 font-medium">
                        {profile.language === 'fr' ? '🇫🇷 Français' : '🇺🇸 English'}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>

            {/* Statistiques d'activité */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Activité</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-gray-700">Articles lus</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">127</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="font-medium text-gray-700">Sondages</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">23</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="font-medium text-gray-700">Alertes actives</span>
                  </div>
                  <span className="text-2xl font-bold text-orange-600">5</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Colonne latérale */}
          <div className="lg:col-span-4 space-y-6">
            {/* Abonnement */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Abonnement</h3>
              </div>
              
              <div className={`bg-gradient-to-r ${getPlanColor(subscriptionPlan?.slug)} rounded-2xl p-6 text-white mb-6 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                <div className="relative">
                  <div className="flex items-center space-x-3 mb-2">
                    {getPlanIcon(subscriptionPlan?.slug)}
                    <h4 className="text-xl font-bold">{subscriptionPlan?.name || 'Gratuit'}</h4>
                  </div>
                  <p className="text-white/90 text-lg font-medium">
                    {subscriptionPlan?.price_monthly ? `${subscriptionPlan.price_monthly} FCFA/mois` : 'Plan gratuit'}
                  </p>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-6 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105">
                Gérer l'abonnement
              </button>
            </motion.div>

            {/* Solde de crédits */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sm:p-8 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Crédits</h3>
              </div>
              
              <div className="text-center mb-6">
                <div className="relative mb-6">
                  <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto shadow-lg">
                    <CreditCard className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                
                <p className="text-4xl font-bold text-gray-900 mb-2">
                  {profile.credits_balance || 0}
                </p>
                <p className="text-gray-600 mb-6 font-medium">Crédits disponibles</p>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 text-center">Recharger vos crédits</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-center">
                    <div className="text-lg font-bold">100 crédits</div>
                    <div className="text-xs opacity-90">1 000 FCFA</div>
                  </button>
                  <button className="bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-center">
                    <div className="text-lg font-bold">200 crédits</div>
                    <div className="text-xs opacity-90">2 000 FCFA</div>
                  </button>
                  <button className="bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-center">
                    <div className="text-lg font-bold">500 crédits</div>
                    <div className="text-xs opacity-90">5 000 FCFA</div>
                  </button>
                  <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 text-center">
                    <div className="text-lg font-bold">1000 crédits</div>
                    <div className="text-xs opacity-90">10 000 FCFA</div>
                  </button>
                </div>
                <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-200 transition-all duration-200 text-sm font-medium">
                  Historique des transactions
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}
