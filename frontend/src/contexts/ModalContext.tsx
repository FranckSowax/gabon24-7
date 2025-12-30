'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import AuthModal from '@/components/auth/AuthModal';
import SubscriptionModal from '@/components/features/SubscriptionModal';
import { useRouter } from 'next/navigation';

interface ModalContextType {
  openAuthModal: () => void;
  closeAuthModal: () => void;
  openSubscriptionModal: () => void;
  closeSubscriptionModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const router = useRouter();

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const openSubscriptionModal = () => setIsSubscriptionModalOpen(true);
  const closeSubscriptionModal = () => setIsSubscriptionModalOpen(false);

  const handleAuthSuccess = () => {
    // Peut-être recharger la page ou mettre à jour l'état utilisateur
    closeAuthModal();
  };

  const handleSubscribe = (plan: string) => {
    // Rediriger vers la page d'abonnement ou le checkout
    closeSubscriptionModal();
    router.push(`/abonnement?plan=${plan}`);
  };

  return (
    <ModalContext.Provider
      value={{
        openAuthModal,
        closeAuthModal,
        openSubscriptionModal,
        closeSubscriptionModal,
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
      />
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={closeSubscriptionModal}
        onSubscribe={handleSubscribe}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
