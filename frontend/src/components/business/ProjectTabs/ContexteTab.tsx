/**
 * 📋 COMPOSANT: ContexteTab
 * Affiche le contexte cumulatif d'un projet
 * 
 * NOTE: Ce composant est préparé pour une future intégration avec ProjectChatBot
 * Pour l'instant, il affiche uniquement les informations de contexte
 */

'use client';

import React from 'react';
import { MessageSquare, RefreshCw, Clock, FileText } from 'lucide-react';

interface ContexteTabProps {
  project: {
    id: string;
    title: string;
    cumulative_context?: any[];
    context_updated_at?: string;
  };
  onRefreshContext?: () => void;
  isRefreshing?: boolean;
}

export default function ContexteTab({ 
  project, 
  onRefreshContext,
  isRefreshing = false 
}: ContexteTabProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non disponible';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header avec info contexte */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-800">Contexte du Projet</h3>
        </div>
        
        {project.context_updated_at && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Mis à jour: {formatDate(project.context_updated_at)}</span>
            {onRefreshContext && (
              <button
                onClick={onRefreshContext}
                disabled={isRefreshing}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Rafraîchir le contexte"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Affichage du contexte cumulatif */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {project.cumulative_context && project.cumulative_context.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <FileText className="w-4 h-4" />
              <span>{project.cumulative_context.length} éléments de contexte</span>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {project.cumulative_context.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                  {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun contexte disponible pour ce projet</p>
            <p className="text-xs mt-1">Le contexte sera enrichi au fur et à mesure de vos interactions</p>
          </div>
        )}
      </div>

      {/* Info sur le contexte cumulatif */}
      {project.cumulative_context && project.cumulative_context.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            <strong>💡 Contexte enrichi:</strong> L&apos;assistant a accès à {project.cumulative_context.length} éléments 
            de contexte pour mieux comprendre votre projet.
          </p>
        </div>
      )}
    </div>
  );
}
