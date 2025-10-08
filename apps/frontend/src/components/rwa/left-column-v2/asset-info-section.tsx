'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface AssetInfoSectionProps {
  rrp?: string | null;
  brand?: string | null;
  hypePoints?: string[] | null;
}

const formatPrice = (price: string | null | undefined): string => {
  if (!price) return 'N/A';
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 'N/A';
  return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export function AssetInfoSection({ rrp, brand, hypePoints }: AssetInfoSectionProps) {
  const hasHypePoints = hypePoints && hypePoints.length > 0;

  return (
    <motion.div
      className="bg-[#231F20]/50 overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Section Title */}
      <div className="px-5 py-3 border-b border-[#D0B284]/10">
        <h3 className="text-[#D0B284] text-sm font-bold uppercase tracking-[0.3em] font-spray-letters">
          STORY
        </h3>
      </div>

      {/* VALUE (RRP) Row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D0B284]/10">
        <span className="text-xs tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
          VALUE
        </span>
        <span className="text-base font-semibold text-white font-proxima-nova">
          {formatPrice(rrp)}
        </span>
      </div>

      {/* BRAND Row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D0B284]/10">
        <span className="text-xs tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
          BRAND
        </span>
        <span className="text-base font-semibold text-white font-proxima-nova">
          {brand || 'N/A'}
        </span>
      </div>

      {/* HYPE Section */}
      <div className="px-5 py-4">
        <div className="mb-3">
          <span className="text-xs tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
            HYPE
          </span>
        </div>
        {hasHypePoints ? (
          <ul className="space-y-2">
            {hypePoints.map((point, index) => (
              <motion.li
                key={index}
                className="flex items-start gap-2 text-sm text-white/90 font-proxima-nova"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <span className="text-[#D0B284] flex-shrink-0">•</span>
                <span className="flex-1">{point}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/50 italic font-proxima-nova">No hype points available</p>
        )}
      </div>
    </motion.div>
  );
}
