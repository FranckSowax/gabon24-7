'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, CreditCard, Settings, LogOut, Crown, Zap, Gift, Calendar, TrendingUp, BarChart3, Plus, Edit, Trash2, Eye, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscriptionHelpers } from '@/lib/supabase-subscription';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  full_name: string;
  phone_number: string;
  country: string;
  city: string;
  avatar_url: string;
}

interface Subscription {
  id: string;
  plan_name: string;
  plan_slug: string;
  status: string;
  current_period_end: string;
  trial_end: string;
  is_active: boolean;
  features: string[];
  limitations: Record<string, number>;
}

interface Poll {
  id: string;
  question: string;
  poll_type: 'yes_no' | 'mcq';
  options: string[];
  total_votes: number;
  status: 'draft' | 'published' | 'archived';
  scheduled_publish_at?: string;
  published_at?: string;
  expires_at: string;
  created_at: string;
  created_by?: string;
  is_manual: boolean;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'polls'>('overview');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [pollForm, setPollForm] = useState({
    question: '',
    poll_type: 'mcq' as 'yes_no' | 'mcq',
    options: ['', '', ''],
    expires_hours: 24,
    schedule_for_later: false,
    scheduled_publish_at: ''
  });
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (activeTab === 'polls' && user) {
      loadPolls();
    }
  }, [activeTab, user]);

  const loadUserData = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        router.push('/auth/signin');
        return;
      }

      setUser(user);

      // Get user profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Get subscription status
      const subscriptionData = await subscriptionHelpers.getUserSubscription(user.id);
      if (subscriptionData) {
        setSubscription(subscriptionData);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPolls = async () => {
    if (!user) return;
    
    try {
      setPollsLoading(true);
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPolls(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des sondages:', error);
    } finally {
      setPollsLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!user || !pollForm.question.trim()) return;
    
    try {
      const pollData = {
        question: pollForm.question,
        poll_type: pollForm.poll_type,
        options: pollForm.poll_type === 'mcq' ? pollForm.options.filter(opt => opt.trim()) : [],
        expires_at: new Date(Date.now() + pollForm.expires_hours * 60 * 60 * 1000).toISOString(),
        status: pollForm.schedule_for_later ? 'draft' : 'published',
        scheduled_publish_at: pollForm.schedule_for_later ? pollForm.scheduled_publish_at : null,
        published_at: pollForm.schedule_for_later ? null : new Date().toISOString(),
        created_by: user.id,
        is_manual: true,
        is_active: !pollForm.schedule_for_later,
        total_votes: 0
      };
      
      const { error } = await supabase.from('polls').insert(pollData);
      if (error) throw error;
      
      await loadPolls();
      setShowPollModal(false);
      resetPollForm();
    } catch (error) {
      console.error('Erreur lors de la création du sondage:', error);
    }
  };

  const handleUpdatePoll = async () => {
    if (!editingPoll || !pollForm.question.trim()) return;
    
    try {
      const updateData = {
        question: pollForm.question,
        poll_type: pollForm.poll_type,
        options: pollForm.poll_type === 'mcq' ? pollForm.options.filter(opt => opt.trim()) : [],
        expires_at: new Date(Date.now() + pollForm.expires_hours * 60 * 60 * 1000).toISOString()
      };
      
      const { error } = await supabase
        .from('polls')
        .update(updateData)
        .eq('id', editingPoll.id);
      
      if (error) throw error;
      
      await loadPolls();
      setShowPollModal(false);
      setEditingPoll(null);
      resetPollForm();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du sondage:', error);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce sondage ?')) return;
    
    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId);
      
      if (error) throw error;
      await loadPolls();
    } catch (error) {
      console.error('Erreur lors de la suppression du sondage:', error);
    }
  };

  const handlePublishPoll = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from('polls')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          is_active: true
        })
        .eq('id', pollId);
      
      if (error) throw error;
      await loadPolls();
    } catch (error) {
      console.error('Erreur lors de la publication du sondage:', error);
    }
  };

  const resetPollForm = () => {
    setPollForm({
      question: '',
      poll_type: 'mcq',
      options: ['', '', ''],
      expires_hours: 24,
      schedule_for_later: false,
      scheduled_publish_at: ''
    });
  };

  const openEditModal = (poll: Poll) => {
    setEditingPoll(poll);
    setPollForm({
      question: poll.question,
      poll_type: poll.poll_type,
      options: poll.poll_type === 'mcq' ? [...poll.options, '', '', ''].slice(0, 3) : ['', '', ''],
      expires_hours: 24,
      schedule_for_later: false,
      scheduled_publish_at: ''
    });
    setShowPollModal(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const getPlanIcon = (slug: string) => {
    switch(slug) {
      case 'free': return <Gift className="w-6 h-6" />;
      case 'discovery': return <Zap className="w-6 h-6" />;
      case 'pro': return <Crown className="w-6 h-6" />;
      default: return <Gift className="w-6 h-6" />;
    }
  };

  const getPlanColor = (slug: string) => {
    switch(slug) {
      case 'free': return 'text-gray-500';
      case 'discovery': return 'text-orange-500';
      case 'pro': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold">Tableau de bord</h1>
              <p className="text-gray-400 mt-1">
                Bienvenue, {profile?.full_name || user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-8 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Aperçu
              </div>
            </button>
            <button
              onClick={() => setActiveTab('polls')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'polls'
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Sondages
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' ? (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Subscription Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Mon abonnement</h2>
                {subscription?.is_active && (
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                    Actif
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${
                  subscription?.plan_slug === 'discovery' ? 'from-orange-500 to-red-600' :
                  subscription?.plan_slug === 'pro' ? 'from-purple-600 to-pink-600' :
                  'from-gray-500 to-gray-600'
                }`}>
                  {getPlanIcon(subscription?.plan_slug || 'free')}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    Forfait {subscription?.plan_name || 'Gratuit'}
                  </h3>
                  <p className="text-gray-400">
                    {subscription?.status === 'trialing' ? 'Période d\'essai' : 
                     subscription?.is_active ? 'Abonnement actif' : 'Plan gratuit'}
                  </p>
                </div>
              </div>

              {subscription?.trial_end && subscription.status === 'trialing' && (
                <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <span className="font-medium">Essai gratuit</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    Votre essai se termine le {formatDate(subscription.trial_end)}
                  </p>
                </div>
              )}

              {subscription?.features && (
                <div>
                  <h4 className="font-medium mb-3">Fonctionnalités incluses :</h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {subscription.features.slice(0, 6).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => router.push('/abonnement')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  Changer de forfait
                </button>
                <button className="px-4 py-2 border border-gray-600 hover:bg-gray-700/50 text-white rounded-lg transition-colors">
                  Gérer l'abonnement
                </button>
              </div>
            </motion.div>

            {/* Usage Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
            >
              <h2 className="text-xl font-semibold mb-6">Utilisation ce mois-ci</h2>
              
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold">247</div>
                  <div className="text-sm text-gray-400">Articles lus</div>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold">18</div>
                  <div className="text-sm text-gray-400">Jours actifs</div>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="w-8 h-8 text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-sm text-gray-400">Alertes créées</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h3 className="font-semibold text-lg">{profile?.full_name || 'Utilisateur'}</h3>
                <p className="text-gray-400 text-sm">{user?.email}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Téléphone</span>
                  <span>{profile?.phone_number || 'Non renseigné'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Pays</span>
                  <span>🇬🇦 Gabon</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Membre depuis</span>
                  <span>{formatDate(user?.created_at)}</span>
                </div>
              </div>

              <button className="w-full mt-6 py-2 px-4 border border-gray-600 hover:bg-gray-700/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <Settings className="w-4 h-4" />
                Modifier le profil
              </button>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
            >
              <h3 className="font-semibold mb-4">Actions rapides</h3>
              
              <div className="space-y-3">
                <button className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-left">
                  📰 Lire les actualités
                </button>
                <button 
                  onClick={() => router.push('/admin/hero-slides')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg transition-colors text-left flex items-center gap-2"
                >
                  <span>🎬</span>
                  <span>Gérer les sliders</span>
                </button>
                <button className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-left">
                  🔔 Créer une alerte
                </button>
                <button className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-left">
                  📊 Voir les statistiques
                </button>
                <button className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-left">
                  💬 Support client
                </button>
              </div>
            </motion.div>

            {/* Upgrade CTA */}
            {(!subscription || subscription.plan_slug === 'free') && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-center"
              >
                <Crown className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">Passez au Premium</h3>
                <p className="text-sm text-orange-100 mb-4">
                  Débloquez toutes les fonctionnalités et profitez d'une expérience complète.
                </p>
                <button
                  onClick={() => router.push('/abonnement')}
                  className="w-full py-2 px-4 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Découvrir les forfaits
                </button>
              </motion.div>
            )}
          </div>
        </div>
        ) : (
          /* Onglet Sondages */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gestion des Sondages</h2>
                <p className="text-gray-400 mt-1">Créez, modifiez et publiez des sondages</p>
              </div>
              <button
                onClick={() => {
                  setEditingPoll(null);
                  resetPollForm();
                  setShowPollModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nouveau sondage
              </button>
            </div>

            {/* Liste des sondages */}
            {pollsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              <div className="grid gap-4">
                {polls.map((poll) => (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{poll.question}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            poll.status === 'published' ? 'bg-green-500/20 text-green-400' :
                            poll.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {poll.status === 'published' ? 'Publié' :
                             poll.status === 'draft' ? 'Brouillon' : 'Archivé'}
                          </span>
                          {poll.is_manual && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                              Manuel
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-400 space-y-1">
                          <p>Type: {poll.poll_type === 'mcq' ? 'Choix multiples' : 'Oui/Non'}</p>
                          <p>Votes: {poll.total_votes}</p>
                          <p>Créé: {new Date(poll.created_at).toLocaleDateString('fr-FR')}</p>
                          {poll.scheduled_publish_at && (
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Programmé: {new Date(poll.scheduled_publish_at).toLocaleString('fr-FR')}
                            </p>
                          )}
                        </div>
                        
                        {poll.poll_type === 'mcq' && poll.options.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Options:</p>
                            <div className="flex flex-wrap gap-2">
                              {poll.options.map((option, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-700/50 rounded text-sm">
                                  {option}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {poll.status === 'draft' && (
                          <button
                            onClick={() => handlePublishPoll(poll.id)}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                            title="Publier"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(poll)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePoll(poll.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {polls.length === 0 && (
                  <div className="text-center py-12">
                    <BarChart3 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">Aucun sondage</h3>
                    <p className="text-gray-500">Créez votre premier sondage pour commencer</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Modal de création/édition de sondage */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {editingPoll ? 'Modifier le sondage' : 'Nouveau sondage'}
              </h2>
              <button
                onClick={() => {
                  setShowPollModal(false);
                  setEditingPoll(null);
                  resetPollForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Question */}
              <div>
                <label className="block text-sm font-medium mb-2">Question</label>
                <textarea
                  value={pollForm.question}
                  onChange={(e) => setPollForm({...pollForm, question: e.target.value})}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Posez votre question..."
                />
              </div>
              
              {/* Type de sondage */}
              <div>
                <label className="block text-sm font-medium mb-2">Type de sondage</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPollForm({...pollForm, poll_type: 'yes_no'})}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      pollForm.poll_type === 'yes_no'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 bg-gray-700'
                    }`}
                  >
                    Oui/Non
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollForm({...pollForm, poll_type: 'mcq'})}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      pollForm.poll_type === 'mcq'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 bg-gray-700'
                    }`}
                  >
                    Choix multiples
                  </button>
                </div>
              </div>
              
              {/* Options pour MCQ */}
              {pollForm.poll_type === 'mcq' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Options (max 3)</label>
                  <div className="space-y-2">
                    {pollForm.options.map((option, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollForm.options];
                          newOptions[idx] = e.target.value;
                          setPollForm({...pollForm, options: newOptions});
                        }}
                        className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
                        placeholder={`Option ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Durée */}
              <div>
                <label className="block text-sm font-medium mb-2">Durée (heures)</label>
                <input
                  type="number"
                  value={pollForm.expires_hours}
                  onChange={(e) => setPollForm({...pollForm, expires_hours: parseInt(e.target.value) || 24})}
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
                  min="1"
                  max="168"
                />
              </div>
              
              {/* Programmation */}
              {!editingPoll && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pollForm.schedule_for_later}
                      onChange={(e) => setPollForm({...pollForm, schedule_for_later: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Programmer pour plus tard</span>
                  </label>
                  
                  {pollForm.schedule_for_later && (
                    <div className="mt-3">
                      <input
                        type="datetime-local"
                        value={pollForm.scheduled_publish_at}
                        onChange={(e) => setPollForm({...pollForm, scheduled_publish_at: e.target.value})}
                        className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowPollModal(false);
                  setEditingPoll(null);
                  resetPollForm();
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={editingPoll ? handleUpdatePoll : handleCreatePoll}
                disabled={!pollForm.question.trim()}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {editingPoll ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
