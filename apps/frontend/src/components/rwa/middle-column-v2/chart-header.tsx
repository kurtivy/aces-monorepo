'use client';

import { motion } from 'framer-motion';

interface ChartHeaderProps {
  title: string;
  onLearnMoreClick: () => void;
}

export function ChartHeader({ title, onLearnMoreClick }: ChartHeaderProps) {
  return (
    <motion.div
      className="flex items-center justify-between px-6 py-4 lg:py-0 bg-[#151c16] border-b border-[#D0B284]/20"
      style={{
        minHeight: 'var(--token-header-top-row-height, 40px)',
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Title */}
      <h1 className="text-xl md:text-2xl font-bold text-[#D0B284] font-spray-letters tracking-widest uppercase py-3">
        {title}
      </h1>

      {/* Learn More Button */}
      <button
        onClick={onLearnMoreClick}
        className=" hover:bg-[#D0B284]/10 border-[0.5px] border-[#D0B284] text-[#D0B284] px-2 py-1 font-semibold uppercase tracking-wider transition-all duration-200 font-proxima-nova text-xs rounded"
      >
        Learn More
      </button>
    </motion.div>
  );
}
