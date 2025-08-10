import React, { useState } from 'react';
import FilterManager from '@/components/filters/FilterManager';

const PremiumFiltersPage: React.FC = () => {
  // En production, récupérer depuis l'auth/context
  const [userId] = useState('demo-user-001');
  const [isPremiumUser] = useState(true); // Simuler un utilisateur premium

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🔍</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Filtres Premium</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FilterManager userId={userId} isPremiumUser={isPremiumUser} />
      </div>
    </div>
  );
};

export default PremiumFiltersPage;
