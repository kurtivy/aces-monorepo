'use client';

import { motion, AnimatePresence } from 'framer-motion';

import NeonLogo from './neon-logo';
import NeonText from './neon-text';
import LoadingStyles from './loading-styles';

interface LoadingScreenProps {
  isComplete: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isComplete }) => {
  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        >
          <LoadingStyles />

          {/* 2D Neon Logo */}
          <div className="flex flex-col items-center justify-center space-y-8 z-20">
            <NeonLogo />
            <NeonText />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
