'use client';

import { useState } from 'react';
import { GraduationCap, Sparkles } from 'lucide-react';
import TrainingPurchaseModal from './TrainingPurchaseModal';

interface TrainingAccessButtonProps {
  opportunity: any;
  project: any;
  user: any;
  modules: any[]; // Sommaire de formation généré par l'opportunité
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

export default function TrainingAccessButton({
  opportunity,
  project,
  user,
  modules,
  variant = 'primary',
  className = ''
}: TrainingAccessButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const getButtonStyles = () => {
    const baseStyles = 'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all';
    
    switch (variant) {
      case 'primary':
        return `${baseStyles} bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg hover:shadow-xl`;
      case 'secondary':
        return `${baseStyles} bg-blue-600 text-white hover:bg-blue-700`;
      case 'outline':
        return `${baseStyles} border-2 border-orange-600 text-orange-600 hover:bg-orange-50`;
      default:
        return `${baseStyles} bg-gray-600 text-white hover:bg-gray-700`;
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`${getButtonStyles()} ${className}`}
      >
        <GraduationCap className="w-5 h-5" />
        <span>Accéder à la formation</span>
        <Sparkles className="w-4 h-4" />
      </button>

      <TrainingPurchaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        opportunity={opportunity}
        project={project}
        modules={modules}
        user={user}
      />
    </>
  );
}
