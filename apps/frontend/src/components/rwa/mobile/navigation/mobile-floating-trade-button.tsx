'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GraffitiTradeButton } from '@/components/rwa/right-panel/graffiti-trade-button';

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
  const buttonOffset = 'calc(var(--mobile-bottom-nav-height, 96px) + 8px)';

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
          <div className="w-full max-w-md mx-auto">
            <GraffitiTradeButton
              onClick={onTradeClick}
              state="trade"
              size="md"
              fullWidth
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
