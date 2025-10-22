'use client';

import { useModal } from '@/lib/contexts/modal-context';
import AboutModal from './about-modal';
import TermsModal from './terms-modal';

export default function GlobalModals() {
  const {
    isAboutModalOpen,
    isTermsModalOpen,
    termsModalInitialTab,
    closeAboutModal,
    closeTermsModal,
  } = useModal();

  return (
    <>
      <AboutModal isOpen={isAboutModalOpen} onClose={closeAboutModal} />
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={closeTermsModal}
        initialTab={termsModalInitialTab}
      />
    </>
  );
}
