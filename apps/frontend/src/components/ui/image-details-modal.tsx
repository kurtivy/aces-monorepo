'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import Image from 'next/image';
import type { ImageInfo } from '../../types/canvas';
import { getImageMetadata } from '../../lib/utils/luxury-logger';

interface ImageDetailsModalProps {
  imageInfo: ImageInfo | null;
  onClose: () => void;
}

export default function ImageDetailsModal({ imageInfo, onClose }: ImageDetailsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Enhanced null safety checks
  if (!imageInfo) {
    return null;
  }

  // Use safe metadata access
  const safeMetadata = getImageMetadata(imageInfo);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-black rounded-3xl overflow-hidden max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-6xl w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
            {/* Image Section */}
            <div className="flex-shrink-0 lg:w-1/2 bg-gradient-to-b from-black/60 to-black p-4 sm:p-6 lg:p-8">
              <div className="relative h-48 sm:h-64 lg:h-full min-h-[200px] max-h-[60vh] lg:max-h-none overflow-hidden rounded-2xl">
                <Image
                  src={safeMetadata.image || '/placeholder.png'}
                  alt={safeMetadata.title}
                  fill
                  className="object-contain transition-transform duration-300 hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
                  quality={85}
                  priority={true} // Load immediately since it's in a modal
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                />
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#D0B264] mb-2 font-syne tracking-wide">
                      {safeMetadata.title}
                    </h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                      <span className="text-xl sm:text-2xl lg:text-3xl font-syne text-[#D0B264] font-bold">
                        {safeMetadata.ticker}
                      </span>
                      {safeMetadata.date && (
                        <span className="text-[#FFFFFF]/60 text-xs sm:text-sm font-jetbrains-mono tracking-wide">
                          • Listed {new Date(safeMetadata.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </motion.div>
                </div>
                <button
                  onClick={onClose}
                  className="text-[#D0B264]/80 hover:text-[#D0B264] transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1"
              >
                <div className="prose prose-invert">
                  <p className="text-[#FFFFFF]/80 text-sm sm:text-base leading-relaxed font-spectral tracking-wide">
                    {safeMetadata.description}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 sm:mt-8"
              >
                <button className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-[#231F20] font-syne font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-goldGlow text-base sm:text-lg">
                  Tokenize Soon!
                </button>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-[#FFFFFF]/60"
              >
                <span className="flex items-center font-jetbrains-mono tracking-wide">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-[#D0B264]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Secure Transaction
                </span>
                <span className="flex items-center font-jetbrains-mono tracking-wide">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-[#D0B264]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Verified Authentic
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
