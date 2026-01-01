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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20">
      <Header onMobileMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="flex">
        {/* Sidebar principale */}
        <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />

        {/* Sidebar alertes - positionnée à droite de la sidebar principale */}
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

        {/* Contenu principal - décalé pour les deux sidebars sur desktop */}
        <main className={`flex-1 min-h-screen transition-all duration-300 ${
          isAlertsSidebarOpen
            ? 'lg:ml-[576px]'
            : 'lg:ml-64'
        }`}>
          {/* Header sticky avec glassmorphism */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              {/* Titre et actions */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Bouton toggle sidebar alertes */}
                  <button
                    onClick={() => setIsAlertsSidebarOpen(!isAlertsSidebarOpen)}
                    className={`p-2.5 rounded-xl transition-all ${
                      isAlertsSidebarOpen
                        ? 'bg-orange-100 text-orange-600 shadow-inner'
                        : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                    }`}
                    title={isAlertsSidebarOpen ? 'Masquer les alertes' : 'Afficher les alertes'}
                  >
                    <Bell className="w-5 h-5" />
                  </button>

                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 via-orange-800 to-orange-600 bg-clip-text text-transparent">
                      Veille & Alertes
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {sortedMatches.length} article{sortedMatches.length > 1 ? 's' : ''} détecté{sortedMatches.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchData}
                    className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all"
                    title="Actualiser"
                  >
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.button>
                  <button className="hidden sm:flex p-2.5 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-xl transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats rapides - design moderne cards */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
                  <StatCard
                    icon={<Bell className="w-4 h-4 sm:w-5 sm:h-5" />}
                    label="Alertes actives"
                    value={stats.active_alerts}
                    color="blue"
                  />
                  <StatCard
                    icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
                    label="Total matches"
                    value={stats.total_matches}
                    color="green"
                  />
                  <StatCard
                    icon={<Zap className="w-4 h-4 sm:w-5 sm:h-5" />}
                    label="Notifications"
                    value={stats.notifications_sent}
                    color="yellow"
                  />
                  <StatCard
                    icon={<BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    label="Confiance moy."
                    value={`${Math.round(stats.avg_confidence)}%`}
                    color="purple"
                  />
                  <StatCard
                    icon={<Bell className="w-4 h-4 sm:w-5 sm:h-5" />}
                    label="Total alertes"
                    value={stats.total_alerts}
                    color="indigo"
                  />
                </div>
              )}

              {/* Barre de recherche et filtres - responsive */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {/* Recherche */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-white/70 border border-gray-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm sm:text-base"
                  />
                </div>

                {/* Filtres */}
                <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/70 border border-gray-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'Catégories' : cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/70 border border-gray-200 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                  >
                    <option value="date">Récent</option>
                    <option value="confidence">Confiance</option>
                    <option value="importance">Importance</option>
                  </select>

                  <button className="flex-shrink-0 p-2 sm:p-2.5 bg-white/70 border border-gray-200 hover:border-orange-400 rounded-xl transition-colors">
                    <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des articles */}
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {sortedMatches.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 sm:py-16"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Bell className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  Aucun article détecté
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-md mx-auto">
                  {selectedAlertId
                    ? 'Aucun article ne correspond à cette alerte'
                    : 'Créez une alerte pour commencer à surveiller les actualités'}
                </p>
                {!selectedAlertId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateAlert}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/30"
                  >
                    Créer ma première alerte
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              >
                {sortedMatches.map((match, index) => (
                  <motion.div
                    key={match.match_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <MatchedArticleCard article={match} />
                  </motion.div>
                ))}
              </motion.div>
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
    blue: 'from-orange-500 to-amber-500 shadow-orange-500/20',
    green: 'from-emerald-500 to-green-500 shadow-emerald-500/20',
    yellow: 'from-yellow-500 to-amber-500 shadow-yellow-500/20',
    purple: 'from-purple-500 to-violet-500 shadow-purple-500/20',
    indigo: 'from-indigo-500 to-blue-500 shadow-indigo-500/20'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-gray-200 transition-all shadow-sm hover:shadow-md"
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br ${colors[color]} shadow-lg flex items-center justify-center mb-2`}>
        <span className="text-white">{icon}</span>
      </div>
      <div className="text-lg sm:text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 truncate">{label}</div>
    </motion.div>
  );
}
