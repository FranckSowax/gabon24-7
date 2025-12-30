'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  Eye, 
  Edit, 
  Trash2, 
  Power, 
  Mail, 
  MessageCircle,
  Calendar,
  Target,
  Users,
  BarChart3,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import AlertModal from '@/components/admin/AlertModal';

// 🚧 MODE DÉVELOPPEMENT - UTILISATEUR FACTICE
const DEV_MODE = true;
const DEV_USER = {
  id: '9bb0138d-a587-4b46-a541-a309048bf97a',
  email: 'admin@gabon-insight.com',
  name: 'Admin Dev'
};

interface UserAlert {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  extracted_keywords: string[];
  categories: string[];
  sources: string[];
  is_active: boolean;
  delivery_frequency: string;
  delivery_channels: {
    email: boolean;
    whatsapp: boolean;
  };
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertStats {
  total_alerts: number;
  active_alerts: number;
  total_matches: number;
  notifications_sent: number;
  avg_confidence: number;
}

interface RecentMatch {
  match_id: string;
  alert_name: string;
  article_title: string;
  article_url: string;
  matched_keywords: string[];
  confidence_score: number;
  created_at: string;
}

interface ClientData {
  id: string;
  email: string;
  full_name: string;
  subscription_type: string;
  total_alerts: number;
  active_alerts: number;
  total_matches: number;
  last_login: string;
  created_at: string;
}

export default function AdminVeillePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  
  // 🚧 MODE DÉVELOPPEMENT - Utiliser utilisateur factice si pas authentifié
  const user = DEV_MODE ? DEV_USER : authUser;
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<UserAlert | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');


  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      if (!user?.id || !mounted) return;
      
      setLoading(true);

      try {
        await loadClients();
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (selectedClient) {
      loadClientData();
    }
  }, [selectedClient]);

  const loadClients = async () => {
    setClientsLoading(true);
    try {
      // Charger tous les utilisateurs avec leurs statistiques d'alertes
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name, subscription_type, last_login, created_at')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.warn('Erreur lors du chargement des clients:', usersError);
        setClients([]);
        setLoading(false);
        return;
      }

      // Pour chaque utilisateur, charger ses stats d'alertes
      const clientsWithStats = await Promise.all(
        (usersData || []).map(async (user: any) => {
          try {
            const { data: alertsData } = await supabase
              .from('user_alerts')
              .select('id, is_active')
              .eq('user_id', user.id);

            const { data: matchesData } = await supabase
              .from('alert_matches')
              .select('id')
              .in('alert_id', (alertsData || []).map((a: any) => a.id));

            return {
              id: user.id,
              email: user.email || '',
              full_name: user.full_name || 'Utilisateur',
              subscription_type: user.subscription_type || 'free',
              total_alerts: alertsData?.length || 0,
              active_alerts: alertsData?.filter((a: any) => a.is_active).length || 0,
              total_matches: matchesData?.length || 0,
              last_login: user.last_login || '',
              created_at: user.created_at || ''
            };
          } catch (error) {
            console.error('Erreur stats pour utilisateur:', user.id, error);
            return {
              id: user.id,
              email: user.email || '',
              full_name: user.full_name || 'Utilisateur',
              subscription_type: user.subscription_type || 'free',
              total_alerts: 0,
              active_alerts: 0,
              total_matches: 0,
              last_login: user.last_login || '',
              created_at: user.created_at || ''
            };
          }
        })
      );

      setClients(clientsWithStats);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
      setClients([]);
      setLoading(false);
    } finally {
      setClientsLoading(false);
    }
  };

  const loadClientData = async () => {
    if (!selectedClient?.id) return;
    
    try {
      await Promise.all([
        loadClientAlerts(),
        loadClientStats(),
        loadClientRecentMatches()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données client:', error);
    }
  };

  const loadClientAlerts = async () => {
    if (!selectedClient?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', selectedClient.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erreur lors du chargement des alertes client');
        setAlerts([]);
        return;
      }
      setAlerts(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des alertes client:', error);
      setAlerts([]);
    }
  };

  const loadAlerts = async () => {
    // Fonction legacy - maintenant on utilise loadClientAlerts
    if (selectedClient) {
      return loadClientAlerts();
    }
    setAlerts([]);
  };

  const loadClientStats = async () => {
    if (!selectedClient?.id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_alert_stats', { p_user_id: selectedClient.id });

      if (error) {
        console.warn('Fonction get_user_alert_stats non trouvée, utilisation de stats par défaut');
        setStats({
          total_alerts: 0,
          active_alerts: 0,
          total_matches: 0,
          notifications_sent: 0,
          avg_confidence: 0
        });
        return;
      }
      setStats(data?.[0] || null);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques client:', error);
      setStats({
        total_alerts: 0,
        active_alerts: 0,
        total_matches: 0,
        notifications_sent: 0,
        avg_confidence: 0
      });
    }
  };

  const loadClientRecentMatches = async () => {
    if (!selectedClient?.id) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_recent_matches', { 
          p_user_id: selectedClient.id, 
          p_limit: 5 
        });

      if (error) {
        console.warn('Fonction get_user_recent_matches non trouvée, utilisation de données par défaut');
        setRecentMatches([]);
        return;
      }
      setRecentMatches(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des correspondances récentes client:', error);
      setRecentMatches([]);
    }
  };

  const loadStats = async () => {
    // Fonction legacy - maintenant on utilise loadClientStats
    if (selectedClient) {
      return loadClientStats();
    }
    setStats(null);
  };

  const loadRecentMatches = async () => {
    // Fonction legacy - maintenant on utilise loadClientRecentMatches
    if (selectedClient) {
      return loadClientRecentMatches();
    }
    setRecentMatches([]);
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = !clientSearchTerm || 
      client.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearchTerm.toLowerCase());
    
    const matchesSubscription = subscriptionFilter === 'all' || client.subscription_type === subscriptionFilter;
    
    return matchesSearch && matchesSubscription;
  });

  const toggleAlertStatus = async (alertId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: !currentStatus })
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette alerte ?')) return;

    try {
      const { error } = await supabase
        .from('user_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'alerte:', error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterActive === null || alert.is_active === filterActive;
    return matchesSearch && matchesFilter;
  });

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      immediate: 'Immédiat',
      daily: 'Quotidien',
      weekly: 'Hebdomadaire'
    };
    return labels[frequency] || frequency;
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔔 Veille & Alertes</h1>
          <p className="text-gray-500 mt-1">
            {selectedClient 
              ? `Gestion des alertes pour ${selectedClient.full_name}`
              : 'Gérez les alertes de veille de vos clients'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedClient ? (
            <>
              <button
                onClick={() => setSelectedClient(null)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Retour aux clients
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Créer une Alerte
              </button>
            </>
          ) : (
            <button
              onClick={loadClients}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-4 h-4" />
              Actualiser
            </button>
          )}
        </div>
      </div>

      {/* Stats globales - seulement si pas de client sélectionné */}
      {!selectedClient && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Clients</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500">Alertes</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {clients.reduce((sum, c) => sum + c.total_alerts, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Power className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-500">Actives</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {clients.reduce((sum, c) => sum + c.active_alerts, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500">Correspondances</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {clients.reduce((sum, c) => sum + c.total_matches, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-indigo-500" />
              <span className="text-sm text-gray-500">Premium/Pro</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">
              {clients.filter(c => c.subscription_type === 'premium' || c.subscription_type === 'pro').length}
            </p>
          </div>
        </div>
      )}

      {/* Section clients ou alertes */}
      {!selectedClient && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Recherche et filtres */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
              />
            </div>

            <select 
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              value={subscriptionFilter}
              onChange={(e) => setSubscriptionFilter(e.target.value)}
            >
              <option value="all">Tous les abonnements</option>
              <option value="free">🆓 Gratuit</option>
              <option value="premium">⭐ Premium</option>
              <option value="pro">👑 Pro</option>
            </select>
          </div>

                {/* Liste des clients */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Clients ({filteredClients.length})</h3>
                  {clientsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>Aucun client trouvé</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          
                          className="bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-all"
                          onClick={() => setSelectedClient(client)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold">{client.full_name}</h4>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  client.subscription_type === 'pro' ? 'bg-purple-100 text-purple-800' :
                                  client.subscription_type === 'premium' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {client.subscription_type?.toUpperCase() || 'FREE'}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm mb-2">{client.email}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>{client.total_alerts} alertes</span>
                                <span>{client.active_alerts} actives</span>
                                <span>{client.total_matches} correspondances</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${client.last_login ? 'text-green-600' : 'text-gray-400'}`}>
                                {client.last_login 
                                  ? `Actif le ${new Date(client.last_login).toLocaleDateString('fr-FR')}`
                                  : client.created_at 
                                    ? `Inscrit le ${new Date(client.created_at).toLocaleDateString('fr-FR')}`
                                    : 'Nouveau'
                                }
                              </span>
                              <Eye className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
        </div>
      )}

      {/* Statistiques client sélectionné */}
          {selectedClient && stats && (
            <div
              
              
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
            >
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Alertes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_alerts}</p>
                  </div>
                  <Target className="text-orange-500" size={24} />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Alertes Actives</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active_alerts}</p>
                  </div>
                  <Power className="text-green-500" size={24} />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Correspondances</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.total_matches}</p>
                  </div>
                  <TrendingUp className="text-blue-500" size={24} />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Notifications</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.notifications_sent}</p>
                  </div>
                  <Bell className="text-purple-500" size={24} />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Score Moyen</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {Math.round(stats.avg_confidence * 100)}%
                    </p>
                  </div>
                  <BarChart3 className="text-yellow-500" size={24} />
                </div>
              </div>
            </div>
          )}

          {/* Gestion des alertes pour le client sélectionné */}
          {selectedClient && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Alerts List */}
          <div className="lg:col-span-2">
            <div
              
              
              className="bg-white rounded-xl shadow-lg border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Alertes du Client</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterActive(null)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        filterActive === null 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      Toutes
                    </button>
                    <button
                      onClick={() => setFilterActive(true)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        filterActive === true 
                          ? 'bg-green-100 text-green-700' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      Actives
                    </button>
                    <button
                      onClick={() => setFilterActive(false)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        filterActive === false 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      Inactives
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Rechercher une alerte..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="p-6">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="mx-auto text-gray-400 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune alerte trouvée</h3>
                    <p className="text-gray-500">
                      {alerts.length === 0 
                        ? "Créez votre première alerte pour commencer la surveillance" 
                        : "Aucune alerte ne correspond à vos critères de recherche"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        
                        
                        className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                          alert.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{alert.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                alert.is_active 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {alert.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            
                            {alert.description && (
                              <p className="text-gray-600 text-sm mb-3">{alert.description}</p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-3">
                              {alert.keywords.slice(0, 5).map((keyword, idx) => (
                                <span 
                                  key={idx}
                                  className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs"
                                >
                                  {keyword}
                                </span>
                              ))}
                              {alert.keywords.length > 5 && (
                                <span className="text-gray-500 text-xs px-2 py-1">
                                  +{alert.keywords.length - 5} autres
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                {getFrequencyLabel(alert.delivery_frequency)}
                              </div>
                              <div className="flex items-center gap-1">
                                {alert.delivery_channels.email && <Mail size={14} className="text-blue-500" />}
                                {alert.delivery_channels.whatsapp && <MessageCircle size={14} className="text-green-500" />}
                              </div>
                              {alert.last_processed_at && (
                                <span>
                                  Dernière vérification: {new Date(alert.last_processed_at).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => toggleAlertStatus(alert.id, alert.is_active)}
                              className={`p-2 rounded-lg transition-colors ${
                                alert.is_active 
                                  ? 'text-green-600 hover:bg-green-100' 
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title={alert.is_active ? 'Désactiver' : 'Activer'}
                            >
                              <Power size={18} />
                            </button>
                            <button
                              onClick={() => setSelectedAlert(alert)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Matches Sidebar */}
          <div>
            <div
              
              
              className="bg-white rounded-xl shadow-lg border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Eye size={20} />
                  Correspondances Récentes
                </h2>
              </div>

              <div className="p-6">
                {recentMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="mx-auto text-gray-400 mb-4" size={32} />
                    <p className="text-gray-500 text-sm">
                      Aucune correspondance récente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentMatches.map((match) => (
                      <div
                        key={match.match_id}
                        className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm leading-tight">
                            {match.article_title}
                          </h4>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                            {Math.round(match.confidence_score * 100)}%
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-2">
                          Alerte: {match.alert_name}
                        </p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {match.matched_keywords.slice(0, 3).map((keyword, idx) => (
                            <span 
                              key={idx}
                              className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(match.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          <a
                            href={match.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Voir l'article
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Correspondances récentes */}
          <div>
            <div
              
              
              className="bg-white rounded-xl shadow-lg border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Eye size={20} />
                  Correspondances Récentes
                </h2>
              </div>

              <div className="p-6">
                {recentMatches.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="mx-auto text-gray-400 mb-4" size={32} />
                    <p className="text-gray-500 text-sm">
                      Aucune correspondance récente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentMatches.map((match) => (
                      <div
                        key={match.match_id}
                        className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm leading-tight">
                            {match.article_title}
                          </h4>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                            {Math.round(match.confidence_score * 100)}%
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-2">
                          Alerte: {match.alert_name}
                        </p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {match.matched_keywords.slice(0, 3).map((keyword, idx) => (
                            <span 
                              key={idx}
                              className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(match.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          <a
                            href={match.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Voir l'article
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Alert Modal */}
      <AlertModal
        isOpen={showCreateModal || selectedAlert !== null}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedAlert(null);
        }}
        alert={selectedAlert}
        onSave={() => {
          loadAlerts();
          loadStats();
          loadRecentMatches();
        }}
      />
    </div>
  );
}
