'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Radio,
  Hash,
  Image
} from 'lucide-react';
import axios from '@/lib/axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Channel {
  id: string;
  name: string;
  description?: string;
  role?: string;
  chat_pic?: string;
}

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [limit, setLimit] = useState(5);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/whatsapp/status`);
      setStatus(response.data);
      if (response.data?.data?.pendingArticles !== undefined) {
        setPendingCount(response.data.data.pendingArticles);
      }
    } catch (error) {
      console.error('Erreur status WhatsApp:', error);
      setStatus({ success: false, message: 'Erreur de connexion' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/whatsapp/channels`);
      if (response.data?.channels) {
        setChannels(response.data.channels);
      }
    } catch (error) {
      console.error('Erreur channels:', error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
    fetchChannels();
  }, [fetchStatus, fetchChannels]);

  const handleTrigger = async () => {
    try {
      setTriggering(true);
      setTriggerResult(null);

      const response = await axios.post(`${API_URL}/api/whatsapp/trigger`, { limit });

      setTriggerResult({
        success: true,
        message: response.data.message || 'Envoi déclenché avec succès'
      });

      setTimeout(fetchStatus, 3000);

    } catch (error: any) {
      console.error('Erreur trigger WhatsApp:', error);
      setTriggerResult({
        success: false,
        message: error.response?.data?.error || 'Erreur lors du déclenchement'
      });
    } finally {
      setTriggering(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-green-600" />
            Chaîne WhatsApp
          </h1>
          <p className="text-gray-500 mt-1">
            Gestion des publications sur la chaîne Gabon Insight
          </p>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchChannels(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* État du service */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Service Whapi</h3>
            {status?.success ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Connecté
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Déconnecté
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {status?.message || 'Vérification...'}
          </p>
        </div>

        {/* Articles en attente */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Articles en attente</h3>
            <Hash className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-4xl font-bold text-orange-600">
            {pendingCount !== null ? pendingCount : '—'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Articles enrichis non publiés
          </p>
        </div>

        {/* Chaînes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Chaînes</h3>
            <Radio className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-4xl font-bold text-green-600">
            {channels.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Chaînes WhatsApp liées
          </p>
        </div>
      </div>

      {/* Chaînes WhatsApp */}
      {channels.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Chaînes WhatsApp</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {channels.map((ch) => (
              <div key={ch.id} className="px-6 py-4 flex items-center gap-4">
                {ch.chat_pic ? (
                  <img
                    src={ch.chat_pic}
                    alt={ch.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{ch.name}</p>
                  {ch.description && (
                    <p className="text-sm text-gray-500 truncate">{ch.description}</p>
                  )}
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{ch.id}</p>
                </div>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                  {ch.role || 'member'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Déclenchement manuel */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Publication manuelle</h3>
            <p className="text-sm text-gray-500">Publier les articles en attente sur la chaîne WhatsApp</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl mb-4">
          <div className="flex items-start gap-3">
            <Image className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-600">
              <p><strong>Format de publication :</strong></p>
              <p>Image de l&apos;article en header + titre en gras + résumé IA + lien article + lien analyse opportunités IA</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre d&apos;articles
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 5)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering || !status?.success || pendingCount === 0}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all ${
              triggering || !status?.success || pendingCount === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-md hover:shadow-lg'
            }`}
          >
            {triggering ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Publication en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Publier maintenant
              </>
            )}
          </button>
        </div>

        {triggerResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            triggerResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {triggerResult.success ? (
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">
                {triggerResult.success ? 'Succès' : 'Erreur'}
              </p>
              <p className="text-sm opacity-90">{triggerResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info planification */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5" />
          Planification automatique
        </h4>
        <p className="text-blue-700 text-sm">
          Les articles enrichis sont automatiquement publiés sur la chaîne WhatsApp toutes les{' '}
          <strong>15 minutes</strong> via le planificateur CRON. Chaque article est envoyé avec son image,
          titre, résumé IA et un lien vers l&apos;analyse d&apos;opportunités IA.
        </p>
      </div>
    </div>
  );
}
