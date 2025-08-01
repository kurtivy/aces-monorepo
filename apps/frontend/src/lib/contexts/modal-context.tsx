'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  isAboutModalOpen: boolean;
  isTermsModalOpen: boolean;
  openAboutModal: () => void;
  openTermsModal: () => void;
  closeAboutModal: () => void;
  closeTermsModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const openAboutModal = () => setIsAboutModalOpen(true);
  const closeAboutModal = () => setIsAboutModalOpen(false);
  const openTermsModal = () => setIsTermsModalOpen(true);
  const closeTermsModal = () => setIsTermsModalOpen(false);

  const value: ModalContextType = {
    isAboutModalOpen,
    isTermsModalOpen,
    openAboutModal,
    openTermsModal,
    closeAboutModal,
    closeTermsModal,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};
