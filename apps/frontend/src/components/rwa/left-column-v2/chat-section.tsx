'use client';

import { motion } from 'framer-motion';
import RWAForumReal from '../middle-column/chat/rwa-forum-real';

interface ChatSectionProps {
  listingId?: string;
  listingTitle?: string;
  isLive?: boolean;
}

export function ChatSection({ listingId, listingTitle, isLive }: ChatSectionProps) {
  return (
    <motion.div
      className="flex flex-col h-full border-t border-[#D0B284]/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Chat Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[#D0B284]/20 bg-[#151C16]">
        <h3 className="text-[#D0B284] text-sm font-bold uppercase tracking-[0.3em] font-spray-letters">
          CHAT
        </h3>
      </div>

      {/* Chat Content - Scrollable */}
      <div className="flex-1 overflow-hidden">
        <RWAForumReal
          listingId={listingId}
          listingTitle={listingTitle}
          isLive={isLive}
          variant="compact"
        />
      </div>
    </motion.div>
  );
}
