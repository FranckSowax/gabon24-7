'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Eye, Clock, BarChart3, RefreshCw, 
  CheckCircle, XCircle, Archive, Vote, TrendingUp, Users,
  Calendar, ChevronDown, Search, Filter, X, Play, Pause
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Poll {
  id: string;
  question: string;
  poll_type: 'yes_no' | 'mcq' | 'series';
  options: string[];
  total_votes: number;
  status: 'draft' | 'published' | 'archived';
  scheduled_publish_at?: string;
  published_at?: string;
  expires_at: string;
  created_at: string;
  created_by?: string;
  is_manual: boolean;
  is_active?: boolean;
}

interface PollStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  totalVotes: number;
  avgVotesPerPoll: number;
}

export default function AdminSondagesPage() {
  const [user, setUser] = useState<any>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPollModal, setShowPollModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<PollStats | null>(null);
  const [pollForm, setPollForm] = useState({
    question: '',
    poll_type: 'mcq' as 'yes_no' | 'mcq',
    options: ['', '', '', ''],
    expires_hours: 24,
    schedule_for_later: false,
    scheduled_publish_at: ''
  });
  const router = useRouter();

  useEffect(() => {
    loadUserAndPolls();
  }, []);

  const loadUserAndPolls = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        router.push('/auth/signin');
        return;
      }

      setUser(user);
      await loadPolls();
    } catch (error) {
      console.error('Error loading user data:', error);
      router.push('/auth/signin');
    }
  };

  const loadPolls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      const pollsData = (data || []) as Poll[];
      setPolls(pollsData);
      
      // Calculer les stats
      const totalVotes = pollsData.reduce((sum: number, p: Poll) => sum + (p.total_votes || 0), 0);
      setStats({
        total: pollsData.length,
        published: pollsData.filter((p: Poll) => p.status === 'published').length,
        draft: pollsData.filter((p: Poll) => p.status === 'draft').length,
        archived: pollsData.filter((p: Poll) => p.status === 'archived').length,
        totalVotes,
        avgVotesPerPoll: pollsData.length > 0 ? Math.round(totalVotes / pollsData.length) : 0
      });
    } catch (error) {
      console.error('Erreur lors du chargement des sondages:', error);
    } finally {
      setLoading(false);
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
      options: ['', '', '', ''],
      expires_hours: 24,
      schedule_for_later: false,
      scheduled_publish_at: ''
    });
  };

  const handleArchivePoll = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from('polls')
        .update({ status: 'archived', is_active: false })
        .eq('id', pollId);
      
      if (error) throw error;
      await loadPolls();
    } catch (error) {
      console.error('Erreur lors de l\'archivage:', error);
    }
  };

  const handleToggleActive = async (poll: Poll) => {
    try {
      const { error } = await supabase
        .from('polls')
        .update({ is_active: !poll.is_active })
        .eq('id', poll.id);
      
      if (error) throw error;
      await loadPolls();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  // Filtrer les sondages
  const filteredPolls = polls.filter(poll => {
    const matchesStatus = filterStatus === 'all' || poll.status === filterStatus;
    const matchesSearch = poll.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const isExpired = (poll: Poll) => new Date(poll.expires_at) < new Date();
  const getTimeRemaining = (poll: Poll) => {
    const now = new Date();
    const expires = new Date(poll.expires_at);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expiré';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j ${hours % 24}h`;
    return `${hours}h`;
  };

  const openEditModal = (poll: Poll) => {
    setEditingPoll(poll);
    setPollForm({
      question: poll.question,
      // Ne pas permettre d'éditer directement un sondage "series" en tant que tel
      // On mappe vers un type éditable pour l'UI (par défaut mcq)
      poll_type: (poll.poll_type === 'series' ? 'mcq' : poll.poll_type),
      options: poll.poll_type === 'mcq' ? [...poll.options, '', '', ''].slice(0, 3) : ['', '', ''],
      expires_hours: 24,
      schedule_for_later: false,
      scheduled_publish_at: ''
    });
    setShowPollModal(true);
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des sondages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Gestion des Sondages</h1>
          <p className="text-gray-500 mt-1">Créez et gérez vos sondages interactifs</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPolls}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => {
              setEditingPoll(null);
              resetPollForm();
              setShowPollModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Nouveau sondage
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-gray-500">Publiés</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats?.published || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-gray-500">Brouillons</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats?.draft || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-500">Archivés</span>
          </div>
          <p className="text-2xl font-bold text-gray-600">{stats?.archived || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500">Votes</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{stats?.totalVotes?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="text-sm text-gray-500">Moy/sondage</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{stats?.avgVotesPerPoll || 0}</p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un sondage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Tous', icon: BarChart3 },
            { value: 'published', label: 'Publiés', icon: CheckCircle },
            { value: 'draft', label: 'Brouillons', icon: Clock },
            { value: 'archived', label: 'Archivés', icon: Archive }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === filter.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des sondages */}
      <div className="space-y-4">
        {filteredPolls.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun sondage trouvé</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Essayez une autre recherche' : 'Créez votre premier sondage'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => { setEditingPoll(null); resetPollForm(); setShowPollModal(true); }}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Créer un sondage
              </button>
            )}
          </div>
        ) : (
          filteredPolls.map((poll) => (
            <div
              key={poll.id}
              className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
                isExpired(poll) ? 'border-gray-300 opacity-75' : 'border-gray-200'
              }`}
            >
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Contenu principal */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        poll.status === 'published' ? 'bg-green-100' :
                        poll.status === 'draft' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {poll.poll_type === 'yes_no' ? (
                          <CheckCircle className={`w-5 h-5 ${
                            poll.status === 'published' ? 'text-green-600' :
                            poll.status === 'draft' ? 'text-yellow-600' : 'text-gray-600'
                          }`} />
                        ) : (
                          <BarChart3 className={`w-5 h-5 ${
                            poll.status === 'published' ? 'text-green-600' :
                            poll.status === 'draft' ? 'text-yellow-600' : 'text-gray-600'
                          }`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-lg leading-tight">{poll.question}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            poll.status === 'published' ? 'bg-green-100 text-green-700' :
                            poll.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {poll.status === 'published' ? '✓ Publié' :
                             poll.status === 'draft' ? '⏳ Brouillon' : '📦 Archivé'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {poll.poll_type === 'mcq' ? '📝 QCM' : poll.poll_type === 'yes_no' ? '👍 Oui/Non' : '📋 Série'}
                          </span>
                          {poll.is_active && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              🟢 Actif
                            </span>
                          )}
                          {isExpired(poll) && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              ⏰ Expiré
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Options MCQ */}
                    {poll.poll_type === 'mcq' && poll.options && poll.options.length > 0 && (
                      <div className="ml-13 mt-3">
                        <div className="flex flex-wrap gap-2">
                          {poll.options.map((option, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700">
                              {option}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Métriques */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span className="font-semibold text-gray-900">{poll.total_votes}</span> votes
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(poll.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {getTimeRemaining(poll)}
                      </div>
                      {poll.scheduled_publish_at && poll.status === 'draft' && (
                        <div className="flex items-center gap-1.5 text-orange-600">
                          <Calendar className="w-4 h-4" />
                          Programmé: {new Date(poll.scheduled_publish_at).toLocaleString('fr-FR')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {poll.status === 'draft' && (
                      <button
                        onClick={() => handlePublishPoll(poll.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                        title="Publier"
                      >
                        <Play className="w-4 h-4" />
                        <span className="hidden sm:inline">Publier</span>
                      </button>
                    )}
                    {poll.status === 'published' && (
                      <button
                        onClick={() => handleToggleActive(poll)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                          poll.is_active 
                            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                        }`}
                        title={poll.is_active ? 'Mettre en pause' : 'Activer'}
                      >
                        {poll.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(poll)}
                      className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {poll.status === 'published' && (
                      <button
                        onClick={() => handleArchivePoll(poll.id)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                        title="Archiver"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de création/édition */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPoll ? '✏️ Modifier le sondage' : '➕ Nouveau sondage'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingPoll ? 'Modifiez les informations du sondage' : 'Créez un nouveau sondage interactif'}
                </p>
              </div>
              <button
                onClick={() => { setShowPollModal(false); setEditingPoll(null); resetPollForm(); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Formulaire */}
            <div className="p-6 space-y-6">
              {/* Question */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question *</label>
                <textarea
                  value={pollForm.question}
                  onChange={(e) => setPollForm({...pollForm, question: e.target.value})}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Posez votre question aux utilisateurs..."
                />
              </div>
              
              {/* Type de sondage */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Type de sondage</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPollForm({...pollForm, poll_type: 'yes_no'})}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      pollForm.poll_type === 'yes_no'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">👍👎</span>
                    <span className="font-medium">Oui / Non</span>
                    <span className="text-xs text-gray-500">Question binaire</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollForm({...pollForm, poll_type: 'mcq'})}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      pollForm.poll_type === 'mcq'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">📝</span>
                    <span className="font-medium">Choix multiples</span>
                    <span className="text-xs text-gray-500">Jusqu'à 4 options</span>
                  </button>
                </div>
              </div>
              
              {/* Options pour MCQ */}
              {pollForm.poll_type === 'mcq' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Options de réponse</label>
                  <div className="space-y-3">
                    {pollForm.options.map((option, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-sm">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...pollForm.options];
                            newOptions[idx] = e.target.value;
                            setPollForm({...pollForm, options: newOptions});
                          }}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder={`Option ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Durée */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Durée du sondage</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={pollForm.expires_hours}
                    onChange={(e) => setPollForm({...pollForm, expires_hours: parseInt(e.target.value) || 24})}
                    className="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center"
                    min="1"
                    max="168"
                  />
                  <span className="text-gray-600">heures</span>
                  <div className="flex gap-2 ml-4">
                    {[24, 48, 72, 168].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setPollForm({...pollForm, expires_hours: h})}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          pollForm.expires_hours === h
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {h === 24 ? '1j' : h === 48 ? '2j' : h === 72 ? '3j' : '1sem'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Programmation */}
              {!editingPoll && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pollForm.schedule_for_later}
                      onChange={(e) => setPollForm({...pollForm, schedule_for_later: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">📅 Programmer pour plus tard</span>
                      <p className="text-sm text-gray-500">Le sondage sera publié automatiquement à la date choisie</p>
                    </div>
                  </label>
                  
                  {pollForm.schedule_for_later && (
                    <div className="mt-4">
                      <input
                        type="datetime-local"
                        value={pollForm.scheduled_publish_at}
                        onChange={(e) => setPollForm({...pollForm, scheduled_publish_at: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowPollModal(false); setEditingPoll(null); resetPollForm(); }}
                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={editingPoll ? handleUpdatePoll : handleCreatePoll}
                disabled={!pollForm.question.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {editingPoll ? 'Mettre à jour' : 'Créer le sondage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
