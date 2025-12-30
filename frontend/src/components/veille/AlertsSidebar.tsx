'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Power,
  X
} from 'lucide-react'

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

interface AlertsSidebarProps {
  alerts: UserAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (alertId: string | null) => void;
  onCreateAlert: () => void;
  onEditAlert: (alert: UserAlert) => void;
  onDeleteAlert: (alertId: string) => void;
  onToggleAlert: (alertId: string, isActive: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertsSidebar({
  alerts,
  selectedAlertId,
  onSelectAlert,
  onCreateAlert,
  onEditAlert,
  onDeleteAlert,
  onToggleAlert,
  isOpen,
  onClose
}: AlertsSidebarProps) {
  const activeAlerts = alerts.filter(a => a.is_active);
  const inactiveAlerts = alerts.filter(a => !a.is_active);

  return (
    <>
      {/* Overlay mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : '-100%'
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed lg:sticky top-0 left-0 h-screen w-80 bg-white border-r border-gray-200 z-50 lg:z-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Mes Alertes</h2>
              <p className="text-xs text-gray-600">
                {activeAlerts.length} active{activeAlerts.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <button
            onClick={onCreateAlert}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Créer une alerte</span>
          </button>

          <button
            onClick={() => onSelectAlert(null)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
              selectedAlertId === null
                ? 'bg-orange-50 text-orange-700 border-2 border-orange-200'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Toutes les alertes</span>
          </button>
        </div>

        {/* Liste des alertes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Alertes actives */}
          {activeAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Actives ({activeAlerts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlertId === alert.id}
                    onSelect={() => onSelectAlert(alert.id)}
                    onEdit={() => onEditAlert(alert)}
                    onDelete={() => onDeleteAlert(alert.id)}
                    onToggle={(isActive) => onToggleAlert(alert.id, isActive)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Alertes inactives */}
          {inactiveAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Inactives ({inactiveAlerts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {inactiveAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlertId === alert.id}
                    onSelect={() => onSelectAlert(alert.id)}
                    onEdit={() => onEditAlert(alert)}
                    onDelete={() => onDeleteAlert(alert.id)}
                    onToggle={(isActive) => onToggleAlert(alert.id, isActive)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* État vide */}
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium mb-2">Aucune alerte</p>
              <p className="text-sm text-gray-500 mb-4">
                Créez votre première alerte pour commencer
              </p>
              <button
                onClick={onCreateAlert}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
              >
                + Créer une alerte
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}

interface AlertCardProps {
  alert: UserAlert;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (isActive: boolean) => void;
}

function AlertCard({ alert, isSelected, onSelect, onEdit, onDelete, onToggle }: AlertCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative p-3 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'bg-gradient-to-br from-orange-50 to-orange-50 border-2 border-orange-300 shadow-md'
          : alert.is_active
          ? 'bg-white border-2 border-gray-200 hover:border-orange-200 hover:shadow-sm'
          : 'bg-gray-50 border-2 border-gray-200 opacity-60 hover:opacity-100'
      }`}
    >
      {/* Badge nombre de matches */}
      {alert.match_count !== undefined && alert.match_count > 0 && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
          {alert.match_count > 99 ? '99+' : alert.match_count}
        </div>
      )}

      {/* Contenu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate mb-1">
            {alert.name}
          </h4>
          <p className="text-xs text-gray-600 line-clamp-2">
            {alert.description || 'Aucune description'}
          </p>
        </div>
        
        {/* Toggle actif/inactif */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!alert.is_active);
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            alert.is_active
              ? 'bg-green-100 text-green-600 hover:bg-green-200'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }`}
        >
          <Power className="w-4 h-4" />
        </button>
      </div>

      {/* Keywords */}
      {alert.keywords && alert.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {alert.keywords.slice(0, 3).map((keyword, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full"
            >
              {keyword}
            </span>
          ))}
          {alert.keywords.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              +{alert.keywords.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer l'alerte "${alert.name}" ?`)) {
                onDelete();
              }
            }}
            className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Catégories */}
        {alert.categories && alert.categories.length > 0 && (
          <div className="flex gap-1">
            {alert.categories.slice(0, 2).map((cat, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
