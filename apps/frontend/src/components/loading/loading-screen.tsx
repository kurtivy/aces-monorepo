'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import NeonLogo3D from './neon-logo-3d';
import NeonText from './neon-text';
import Scene3D from './scene-3d';
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

          {/* 3D Neon Logo */}
          <div className="flex flex-col items-center justify-center space-y-8 z-20">
            <NeonLogo3D />
            <NeonText />
          </div>

          {/* 3D Scene Background */}
          <div className="absolute inset-0 z-0">
            <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
              <ambientLight intensity={0.1} />
              <pointLight position={[10, 10, 10]} color="#D7BF75" intensity={0.3} />
              <pointLight position={[-10, -10, 5]} color="#D0B284" intensity={0.2} />

              <Suspense fallback={null}>
                <Scene3D />
              </Suspense>
            </Canvas>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
