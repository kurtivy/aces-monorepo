'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TermsModalTab = 'terms' | 'privacy' | 'launchpad';

interface ModalContextType {
  isAboutModalOpen: boolean;
  isTermsModalOpen: boolean;
  termsModalInitialTab: TermsModalTab;
  openAboutModal: () => void;
  openTermsModal: (tab?: TermsModalTab) => void;
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
  const [termsModalInitialTab, setTermsModalInitialTab] = useState<TermsModalTab>('terms');

  const openAboutModal = () => setIsAboutModalOpen(true);
  const closeAboutModal = () => setIsAboutModalOpen(false);
  const openTermsModal = (tab: TermsModalTab = 'terms') => {
    setTermsModalInitialTab(tab);
    setIsTermsModalOpen(true);
  };
  const closeTermsModal = () => setIsTermsModalOpen(false);

  const value: ModalContextType = {
    isAboutModalOpen,
    isTermsModalOpen,
    termsModalInitialTab,
    openAboutModal,
    openTermsModal,
    closeAboutModal,
    closeTermsModal,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};
