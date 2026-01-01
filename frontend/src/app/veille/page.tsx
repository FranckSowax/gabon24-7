'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Search,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  Bell,
  RefreshCw,
  Download,
  BarChart3,
  Zap
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/auth'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import AlertsSidebar from '@/components/veille/AlertsSidebar'
import MatchedArticleCard from '@/components/veille/MatchedArticleCard'
import AlertModal from '@/components/admin/AlertModal'
import ScrollToTop from '@/components/ui/ScrollToTop'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Mode développement
const DEV_MODE = true;
const DEV_USER = {
  id: '9bb0138d-a587-4b46-a541-a309048bf97a',
  email: 'sowaxcom@gmail.com',
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
  match_count?: number;
}

interface RecentMatch {
  match_id: string;
  alert_name: string;
  article_title: string;
  article_url: string;
  matched_keywords: string[];
  confidence_score: number;
  created_at: string;
  article_id?: string;
  ai_category?: string | null;
  ai_sentiment?: number | null;
  ai_importance?: number | null;
  ai_is_breaking?: boolean | null;
  published_at?: string | null;
}

interface AlertStats {
  total_alerts: number;
  active_alerts: number;
  total_matches: number;
  notifications_sent: number;
  avg_confidence: number;
}

export default function VeillePageNew() {
  const { user: authUser, subscriptionPlan, loading: authLoading } = useAuth();
  const router = useRouter();
  const user = DEV_MODE ? DEV_USER : authUser;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Helper pour obtenir les headers d'authentification
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  // Protection de la page
  useEffect(() => {
    if (!authLoading && !DEV_MODE) {
      if (!authUser) {
        router.push('/auth/signin?redirect=/veille')
      } else if (subscriptionPlan?.slug !== 'pro') {
        router.push('/abonnement')
      }
    }
  }, [authUser, subscriptionPlan, authLoading, router]);

  // États
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [matches, setMatches] = useState<RecentMatch[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Loading guard for auth
  if ((authLoading || (!authUser && !DEV_MODE) || (subscriptionPlan?.slug !== 'pro' && !DEV_MODE)) && !loading) {
     return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Vérification de l'accès...</p>
        </div>
      </div>
    );
  }
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<UserAlert | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAlertsSidebarOpen, setIsAlertsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'importance'>('date');

  // Charger les données
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAlerts(),
        fetchMatches(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/alerts/user`, { headers });
      const data = await response.json();
      if (data.success) {
        // Compter les matches par alerte
        const alertsWithCounts = await Promise.all(
          data.alerts.map(async (alert: UserAlert) => {
            const matchesRes = await fetch(
              `${API_URL}/api/alerts/matches/${alert.id}`,
              { headers }
            );
            const matchesData = await matchesRes.json();
            return {
              ...alert,
              match_count: matchesData.success ? matchesData.matches.length : 0
            };
          })
        );
        setAlerts(alertsWithCounts);
      }
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/api/alerts/recent-matches`,
        { headers }
      );
      const data = await response.json();
      if (data.success) {
        setMatches(data.matches);
      }
    } catch (error) {
      console.error('Erreur chargement matches:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/alerts/stats`, { headers });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  // Filtrer les matches
  const filteredMatches = matches.filter((match) => {
    // Filtre par alerte sélectionnée
    if (selectedAlertId) {
      const alert = alerts.find(a => a.id === selectedAlertId);
      if (alert && match.alert_name !== alert.name) return false;
    }

    // Filtre par recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !match.article_title.toLowerCase().includes(searchLower) &&
        !match.matched_keywords.some(k => k.toLowerCase().includes(searchLower))
      ) {
        return false;
      }
    }

    // Filtre par catégorie
    if (filterCategory !== 'all' && match.ai_category !== filterCategory) {
      return false;
    }

    // Filtre par confiance
    if (match.confidence_score < filterConfidence / 100) {
      return false;
    }

    return true;
  });

  // Trier les matches
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence_score - a.confidence_score;
      case 'importance':
        return (b.ai_importance || 0) - (a.ai_importance || 0);
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Handlers
  const handleCreateAlert = () => {
    setSelectedAlert(null);
    setShowAlertModal(true);
  };

  const handleEditAlert = (alert: UserAlert) => {
    setSelectedAlert(alert);
    setShowAlertModal(true);
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers
      });
      if (response.ok) {
        await fetchAlerts();
        if (selectedAlertId === alertId) {
          setSelectedAlertId(null);
        }
      }
    } catch (error) {
      console.error('Erreur suppression alerte:', error);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: isActive })
      });
      if (response.ok) {
        await fetchAlerts();
      }
    } catch (error) {
      console.error('Erreur toggle alerte:', error);
    }
  };

  const categories = ['all', 'Politique', 'Économie', 'Société', 'Sport', 'Culture'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-orange-50">
      <Header onMobileMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex">
        {/* Sidebar principale */}
        <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />

        {/* Sidebar alertes */}
        <AlertsSidebar
          alerts={alerts}
          selectedAlertId={selectedAlertId}
          onSelectAlert={setSelectedAlertId}
          onCreateAlert={handleCreateAlert}
          onEditAlert={handleEditAlert}
          onDeleteAlert={handleDeleteAlert}
          onToggleAlert={handleToggleAlert}
          isOpen={isAlertsSidebarOpen}
          onClose={() => setIsAlertsSidebarOpen(false)}
        />

        {/* Contenu principal */}
        <main className="flex-1 lg:ml-64">
          {/* Header sticky */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              {/* Titre et stats */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsAlertsSidebarOpen(!isAlertsSidebarOpen)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Menu className="w-6 h-6 text-gray-600" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Veille & Alertes
                    </h1>
                    <p className="text-sm text-gray-600">
                      {sortedMatches.length} article{sortedMatches.length > 1 ? 's' : ''} détecté{sortedMatches.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchData}
                    className="p-2 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors"
                    title="Actualiser"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats rapides */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <StatCard
                    icon={<Bell className="w-5 h-5" />}
                    label="Alertes actives"
                    value={stats.active_alerts}
                    color="blue"
                  />
                  <StatCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Total matches"
                    value={stats.total_matches}
                    color="green"
                  />
                  <StatCard
                    icon={<Zap className="w-5 h-5" />}
                    label="Notifications"
                    value={stats.notifications_sent}
                    color="yellow"
                  />
                  <StatCard
                    icon={<BarChart3 className="w-5 h-5" />}
                    label="Confiance moy."
                    value={`${Math.round(stats.avg_confidence * 100)}%`}
                    color="purple"
                  />
                  <StatCard
                    icon={<Bell className="w-5 h-5" />}
                    label="Total alertes"
                    value={stats.total_alerts}
                    color="indigo"
                  />
                </div>
              )}

              {/* Barre de recherche et filtres */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Recherche */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher dans les articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>

                {/* Filtres */}
                <div className="flex gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'Toutes catégories' : cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  >
                    <option value="date">Plus récent</option>
                    <option value="confidence">Confiance</option>
                    <option value="importance">Importance</option>
                  </select>

                  <button className="p-2.5 border-2 border-gray-200 hover:border-orange-500 rounded-xl transition-colors">
                    <SlidersHorizontal className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des articles */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {sortedMatches.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Aucun article détecté
                </h3>
                <p className="text-gray-600 mb-6">
                  {selectedAlertId
                    ? 'Aucun article ne correspond à cette alerte'
                    : 'Créez une alerte pour commencer à surveiller les actualités'}
                </p>
                {!selectedAlertId && (
                  <button
                    onClick={handleCreateAlert}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
                  >
                    Créer ma première alerte
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedMatches.map((match) => (
                  <MatchedArticleCard key={match.match_id} article={match} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal création/édition alerte */}
      <AlertModal
        isOpen={showAlertModal}
        alert={selectedAlert}
        onClose={() => {
          setShowAlertModal(false);
          setSelectedAlert(null);
        }}
        onSave={async () => {
          await fetchAlerts();
          setShowAlertModal(false);
          setSelectedAlert(null);
        }}
      />

      <ScrollToTop />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'indigo';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colors = {
    blue: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-orange-600'
  };

  return (
    <div className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-gray-300 transition-colors">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}
