'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Eye,
  Settings,
  BellRing,
  Activity,
  Search,
  ChevronDown,
  Menu,
  X,
  Megaphone,
  Film,
  GraduationCap,
  Gamepad2,
  Coins,
  Rss,
  Building2,
  Gift,
  RotateCw,
  Loader2,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin verification
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminChecking, setAdminChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user) {
        setIsAdmin(false);
        setAdminChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (error || !data) {
          setIsAdmin(false);
        } else {
          setIsAdmin(data.is_admin === true);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminChecking(false);
      }
    };

    checkAdmin();
  }, [user, authLoading]);

  const navigation = [
    { name: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
    { name: 'Articles', href: '/admin/articles', icon: FileText },
    { name: 'Utilisateurs', href: '/admin/users', icon: Users },
    { name: 'Notifications', href: '/admin/notifications', icon: BellRing },
    { name: 'Monitoring', href: '/admin/monitoring', icon: Activity },
    { name: 'WhatsApp', href: '/admin/whatsapp', icon: MessageSquare },
    { name: 'Publicités', href: '/admin/campaigns', icon: Megaphone },
    { name: 'Vidéos accueil', href: '/admin/hero-videos', icon: Film, badge: 'NEW' },
    { name: 'Formations BCEG', href: '/admin/formations', icon: GraduationCap, badge: 'NEW' },
    { name: 'Sondages', href: '/admin/sondages', icon: BarChart3 },
    { name: 'Veille RSS', href: '/admin/veille', icon: Eye },
    { name: 'Flux RSS', href: '/admin/rss-monitoring', icon: Rss },
    { name: 'BCEG Project', href: '/admin/bceg', icon: Building2, badge: 'NEW' },
    { name: 'BCEG Sponsoring', href: '/admin/bceg/sponsorships', icon: Gift, badge: 'NEW' },
    { name: 'Flip Ad', href: '/admin/flip-ad', icon: RotateCw, badge: 'NEW' },
    { name: 'Feedbacks', href: '/admin/feedbacks', icon: MessageSquare },
    { name: 'Tarification', href: '/admin/tarification', icon: Coins },
    { name: 'Jeu Quiz', href: '/admin/jeu', icon: Gamepad2, badge: 'NEW' },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ];

  // Loading state
  if (authLoading || adminChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-500">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Connexion requise</h1>
          <p className="text-gray-400 mb-6">
            Vous devez être connecté pour accéder à cette page.
          </p>
          <button
            onClick={() => router.push('/auth/signin?redirect=/admin')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // Not admin
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Accès refusé</h1>
          <p className="text-gray-400 mb-6">
            Cette section est réservée aux administrateurs.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  // Admin name/email from auth
  const adminName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin';
  const adminEmail = user.email || '';
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setSidebarOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">G</span>
                </div>
                <span className="font-bold text-gray-900">Gabon Insight</span>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {navigation.map((item: any) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                        : item.badge ? 'text-purple-700 bg-purple-50 hover:bg-purple-100' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : item.badge ? 'text-purple-500' : 'text-gray-500'}`} />
                    <span className="font-medium flex-1">{item.name}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-72 lg:bg-white lg:border-r lg:border-gray-100 lg:shadow-sm">
        <div className="flex items-center px-6 py-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">G</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900">Gabon Insight</h1>
              <p className="text-sm text-orange-600 font-medium">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {navigation.map((item: any) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg transform scale-105'
                    : item.badge
                      ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 hover:from-purple-100 hover:to-indigo-100 border border-purple-200'
                      : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600 hover:shadow-sm'
                }`}
              >
                <item.icon className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-white' : item.badge ? 'text-purple-500' : 'text-gray-400 group-hover:text-orange-500'
                }`} />
                <span className="font-semibold flex-1">{item.name}</span>
                {item.badge && !isActive && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </a>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-6 border-t border-gray-100">
          <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-orange-50 rounded-xl">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{adminInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{adminName}</p>
              <p className="text-xs text-gray-500 truncate">{adminEmail}</p>
            </div>
            <button
              onClick={() => { signOut(); router.push('/'); }}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top header */}
        <header className="bg-white/70 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>

                <div className="hidden md:flex items-center space-x-4">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-80"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <NotificationBell />

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">{adminInitial}</span>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">{adminName}</p>
                    <p className="text-xs text-gray-500">Administrateur</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
