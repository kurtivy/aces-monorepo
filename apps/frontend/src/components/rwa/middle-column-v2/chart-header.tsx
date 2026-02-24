'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

// X Icon from nav-menu
const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ChartHeaderProps {
  title: string;
  onLearnMoreClick: () => void;
  onChatClick?: () => void;
}

export function ChartHeader({ title, onLearnMoreClick, onChatClick }: ChartHeaderProps) {
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
      <h1 className="text-xs md:text-xs lg:text-xs xl:text-base font-bold text-[#D0B284] font-spray-letters tracking-[0.35em] md:tracking-[0.4em] uppercase leading-tight py-3">
        {title}
      </h1>

      {/* Action Icons and Button */}
      <div className="flex items-center gap-3">
        {/* Chat Icon - Always visible */}
        <button
          onClick={onChatClick}
          className="flex items-center justify-center xl:w-8 xl:h-8 w-6 h-6 rounded-full text-[#D0B284] hover:bg-[#D0B284]/10 transition-all duration-200"
          title="Open Chat"
        >
          <MessageCircle className="w-5 h-5" />
        </button>

        {/* X (Twitter) Icon */}
        <a
          href="https://x.com/EvanLuthra"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center xl:w-8 xl:h-8 w-6 h-6 rounded-full text-[#D0B284] hover:bg-[#D0B284]/10 transition-all duration-200"
          title="Follow us on X"
        >
          <XIcon size={18} />
        </a>

        {/* Learn More Button */}
        <button
          onClick={onLearnMoreClick}
          className="hover:bg-[#D0B284]/10 border-[0.5px] border-[#D0B284] text-[#D0B284] px-2 py-1 font-semibold uppercase tracking-wider transition-all duration-200 font-proxima-nova text-xs rounded"
        >
          Auction
        </button>
      </div>
    </motion.div>
  );
}
