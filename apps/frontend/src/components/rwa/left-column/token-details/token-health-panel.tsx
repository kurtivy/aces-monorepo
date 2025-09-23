'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Info, Gift, Coins } from 'lucide-react';

interface TokenHealthPanelProps {
  ratioText?: string; // e.g., "4.32x" (placeholder for now)
  // future props
  // ratioValue?: number; // raw value to compute slider position
}

export default function TokenHealthPanel({ ratioText = '4.32x' }: TokenHealthPanelProps) {
  // For now, slider is neutral at 50%
  const sliderPosition = 50; // percent

  const clampedPosition = useMemo(
    () => Math.max(0, Math.min(100, sliderPosition)),
    [sliderPosition],
  );

  return (
    <motion.div
      className="h-full flex flex-col items-stretch justify-between bg-[#151c16] relative"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      {/* ACES RATIO Header */}
      <div className="w-full px-4 pt-4">
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        >
          <div className="relative">
            <div className="flex items-center gap-2 rounded-full border border-[#D0B284]/50 px-3 py-1">
              <div className="font-spray-letters text-[#D0B284] tracking-widest text-lg sm:text-xl">
                ACES RATIO
              </div>
              {/* Info tooltip */}
              <div className="group relative">
                <Info className="w-4 h-4 text-[#D0B284] opacity-80" />
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#D0B284]/30 bg-[#151c16] px-3 py-2 text-[11px] text-[#D0B284] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Aces Ratio ≈ Market Cap / Reserve Price (P/E-like indicator)
                </div>
              </div>
            </div>
          </div>
          <motion.div
            className="font-proxima-nova text-white text-2xl leading-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          >
            {ratioText}
          </motion.div>
        </motion.div>

        {/* removed dashed separator for a cleaner look */}
      </div>

      {/* Slider Indicator */}
      <div className="w-full px-4 pb-4 flex-1 flex items-center">
        <div className="w-full">
          {/* Top-left label */}
          <motion.div
            className="mb-2 font-spray-letters text-[#D0B284] text-sm sm:text-base"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          >
            Reward per token
          </motion.div>

          {/* Track with dual gradient (0-50 and 50-100) */}
          <motion.div
            className="relative h-3.5 rounded-full overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          >
            {/* left half */}
            <div
              className="absolute left-0 top-0 h-full w-1/2"
              style={{
                background:
                  'linear-gradient(90deg, rgba(24,77,55,0.4) 0%, rgba(24,77,55,0.8) 100%)',
              }}
            />
            {/* right half */}
            <div
              className="absolute right-0 top-0 h-full w-1/2"
              style={{
                background:
                  'linear-gradient(90deg, rgba(139,69,19,0.8) 0%, rgba(139,69,19,0.4) 100%)',
              }}
            />
            {/* subtle border */}
            <div className="absolute inset-0 border border-[#D0B284]/20 rounded-full" />

            {/* Ticks at every 10% from 10 to 90, with a stronger 50% */}
            {([10, 20, 30, 40, 50, 60, 70, 80, 90] as const).map((t) => (
              <div
                key={t}
                className={cn(
                  'absolute top-0 bottom-0 bg-[#D0B284]/40',
                  t === 50 ? 'w-[2px] bg-[#D0B284]/70' : 'w-px',
                )}
                style={{ left: `${t}%` }}
              />
            ))}

            {/* Indicator - subtle oscillation */}
            <motion.div
              className="absolute -top-3 h-10 w-[3px] bg-[#D0B284] shadow-[0_0_10px_rgba(208,178,132,0.7)]"
              style={{ left: `${clampedPosition}%` }}
              animate={{ y: [-0.8, 0.8, -0.8] }}
              transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            />
          </motion.div>

          {/* Bottom-right label */}
          <motion.div
            className="mt-2 flex justify-end"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          >
            <div className="font-spray-letters text-[#D0B284] text-sm sm:text-base">
              Price per token
            </div>
          </motion.div>
        </div>
      </div>

      {/* Animated icons: Gift (left) and Coins (right) starting on same row */}
      <motion.div
        className="absolute left-6 right-6 top-8 pointer-events-none"
        initial={false}
        animate={{ opacity: 1 }}
      >
        {/* Gift - left, moves up while coins moves down */}
        <motion.div
          className="absolute left-0 text-[#D0B284]"
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          <Gift className="w-4 h-4" />
        </motion.div>
        {/* Coins - right, moves down while gift moves up */}
        <motion.div
          className="absolute right-0 text-[#D0B284]"
          animate={{ y: [4, -4, 4] }}
          transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          <Coins className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
