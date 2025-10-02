'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface MobileFloatingTradeButtonProps {
  isVisible: boolean;
  tokenSymbol: string;
  onTradeClick: () => void;
}

export default function MobileFloatingTradeButton({
  isVisible,
  tokenSymbol,
  onTradeClick,
}: MobileFloatingTradeButtonProps) {
  const buttonOffset = 'calc(104px + env(safe-area-inset-bottom, 0px))';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed left-0 right-0 z-40 px-4"
          style={{ bottom: buttonOffset }}
        >
          <button
            type="button"
            onClick={onTradeClick}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-2 rounded-xl bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#151c16] font-semibold shadow-lg transition-all duration-200 active:scale-95 touch-manipulation py-3"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="text-base font-proxima-nova">Trade ${tokenSymbol}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
