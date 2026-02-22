'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Clock,
  Settings
} from 'lucide-react';
import { supabase } from '@/lib/auth';
import axios from '@/lib/axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function WhatsAppAdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [limit, setLimit] = useState(5);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchStatus();
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeader();
      const response = await axios.get(`${API_URL}/api/whatsapp/status`, { headers });
      setStatus(response.data);
    } catch (error) {
      console.error('Erreur status WhatsApp:', error);
      setStatus({ success: false, message: 'Erreur de connexion' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTrigger = async () => {
    try {
      setTriggering(true);
      setTriggerResult(null);
      
      const headers = await getAuthHeader();
      const response = await axios.post(`${API_URL}/api/whatsapp/trigger`, {
        limit
      }, { headers });
      
      setTriggerResult({
        success: true,
        message: response.data.message || 'Envoi déclenché avec succès'
      });
      
      // Rafraîchir le status après un court délai
      setTimeout(fetchStatus, 2000);
      
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

  if (!mounted) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-green-600" />
            Gestion WhatsApp
          </h1>
          <p className="text-gray-500 mt-1">
            Contrôlez l'envoi des notifications WhatsApp
          </p>
        </div>
        <button 
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* État du service */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">État du Service</h3>
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
          <p className="text-sm text-gray-500 mb-4">
            {status?.message || 'Vérification de l\'état...'}
          </p>
          {status?.data && (
            <div className="text-xs bg-gray-50 p-3 rounded-lg font-mono text-gray-600">
              {JSON.stringify(status.data, null, 2)}
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 md:col-span-2"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Déclenchement Manuel</h3>
              <p className="text-sm text-gray-500">Forcer l'envoi des articles en attente</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limite d'articles
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
              disabled={triggering || !status?.success}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all ${
                triggering || !status?.success
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-md hover:shadow-lg'
              }`}
            >
              {triggering ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer maintenant
                </>
              )}
            </button>
          </div>

          {triggerResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                triggerResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
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
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Informations */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5" />
          Planification Automatique
        </h4>
        <p className="text-blue-700 text-sm">
          Le système est configuré pour vérifier et envoyer automatiquement les nouveaux articles enrichis 
          toutes les <strong>15 minutes</strong> via le planificateur CRON du serveur.
          Le déclenchement manuel ci-dessus est utile pour les tests ou pour forcer un envoi immédiat.
        </p>
      </div>
    </div>
  );
}
