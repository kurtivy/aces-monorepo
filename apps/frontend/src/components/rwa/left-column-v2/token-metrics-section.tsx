'use client';

import { motion } from 'framer-motion';
import TokenHealthPanel from '../left-column/token-details/token-health-panel';

interface TokenMetricsSectionProps {
  tokenAddress?: string;
  reservePrice?: string | null;
  chainId?: number;
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

export function TokenMetricsSection({
  tokenAddress,
  reservePrice,
  chainId,
  rrp,
  brand,
  hypePoints,
}: TokenMetricsSectionProps) {
  const hasHypePoints = hypePoints && hypePoints.length > 0;

  return (
    <div className="bg-[#221F20] overflow-hidden">
      {/* DATA Section Title */}
      <div className="py-1 border-b border-[#D0B284]/10">
        <h3 className="text-[#D0B284] text-sm font-bold uppercase tracking-[0.3em] font-spray-letters text-center">
          DATA
        </h3>
      </div>

      {/* Token Health Panel */}
      <TokenHealthPanel tokenAddress={tokenAddress} reservePrice={reservePrice} chainId={chainId} />

      {/* STORY Section */}
      <div className="border-t border-[#D0B284]/10 mt-2">
        {/* Section Title */}
        <div className="py-1 border-b border-[#D0B284]/10 ">
          <h3 className="text-[#D0B284] text-sm font-bold uppercase tracking-[0.3em] font-spray-letters text-center">
            STORY
          </h3>
        </div>

        {/* VALUE (RRP) Row */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#D0B284]/10">
          <span className="text-[10px] tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
            VALUE
          </span>
          <span className="text-sm font-semibold text-white font-proxima-nova">
            {formatPrice(rrp)}
          </span>
        </div>

        {/* BRAND Row */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#D0B284]/10">
          <span className="text-[10px] tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
            BRAND
          </span>
          <span className="text-sm font-semibold text-white font-proxima-nova">
            {brand || 'N/A'}
          </span>
        </div>

        {/* HYPE Section */}
        <div className="px-5 py-3">
          <div className="mb-2">
            <span className="text-[10px] tracking-[0.28em] uppercase text-[#D0B284] font-spray-letters">
              HYPE
            </span>
          </div>
          {hasHypePoints ? (
            <ul className="space-y-1.5">
              {hypePoints.map((point, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-1.5 text-xs text-white/90 font-proxima-nova"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <span className="text-[#D0B284] flex-shrink-0 text-[10px]">•</span>
                  <span className="flex-1">{point}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/50 italic font-proxima-nova">
              No hype points available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
