'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { ImageInfo } from '../../../types/canvas';
import { getImageMetadata } from '../../../lib/utils/luxury-logger';

interface DrvnImageModalProps {
  imageInfo: ImageInfo | null;
  onClose: () => void;
}

export default function DrvnImageModal({ imageInfo, onClose }: DrvnImageModalProps) {
  if (!imageInfo) return null;

  const safeMetadata = getImageMetadata(imageInfo);
  const drvnTitle = 'Paul Walker’s Ferrari 360 Modena';

  return (
    <AnimatePresence>
      <motion.div
        key="drvn-image-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80"
        onClick={onClose}
      >
        <div className="origin-center scale-[0.85]">
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{
              duration: 0.15,
              ease: 'easeOut',
              scale: {
                duration: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 0.15,
              },
            }}
            className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-6xl w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh] sm:max-h-[90vh] lg:h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Image Section */}
              <div className="flex-shrink-0 lg:w-1/2 bg-gradient-to-b from-black/60 to-black p-3 sm:p-6 lg:p-8">
                <div className="relative h-72 sm:h-80 md:h-96 lg:h-full min-h-[280px] max-h-[60vh] sm:max-h-[70vh] lg:max-h-none overflow-hidden rounded-xl sm:rounded-2xl bg-black">
                  {safeMetadata.image ? (
                    <Image
                      src={safeMetadata.image}
                      alt={safeMetadata.title}
                      fill
                      className="object-contain bg-black"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
                      quality={80}
                      priority={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#D0B264]/60">
                      <span>No image available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Section */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-start justify-between p-3 sm:p-6 lg:p-8 pb-0">
                  <div className="flex-1 pr-2">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-[#D0B264] mb-2 sm:mb-3 font-neue-world tracking-wide leading-tight">
                      {drvnTitle}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[#D0B264]/80 hover:text-[#D0B264] transition-colors duration-150 p-1 flex-shrink-0"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
                  <div className="text-[#FFFFFF]/80 text-sm sm:text-base leading-relaxed font-spectral tracking-wide space-y-4">
                    <p>
                      ACES.fun and DRVN are joining forces to bring fractional ownership of the
                      world’s rarest, investment-grade JDM and historically significant collector
                      cars to the ACES Internet Collectible Markets — where hype meets heritage.
                    </p>
                    <p>
                      The collaboration launches with Paul Walker’s Ferrari 360 Modena — fully
                      authenticated with his original registration, insurance cards, license plate,
                      and title. A clean-sheet Ferrari design that set the stage for a new era, the
                      360 Modena’s lightweight aluminum body, rigid chassis, and roaring V8 made it
                      an icon of pure driving passion. Now, a piece of that legacy — and Walker’s
                      story — can be yours, only with ACES and DRVN.
                    </p>
                  </div>
                </div>

                {/* Single CTA */}
                <div className="flex-shrink-0 p-3 sm:p-6 lg:p-8 pt-0 bg-gradient-to-t from-black via-black/95 to-transparent">
                  <button
                    disabled
                    className="w-full bg-gradient-to-r from-[#231F20] to-[#231F20]/90 text-[#D0B264] font-syne font-bold py-3 sm:py-4 px-4 sm:px-6 lg:px-8 rounded-lg sm:rounded-xl text-sm sm:text-base lg:text-lg text-center border border-[#D0B264]/70 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
