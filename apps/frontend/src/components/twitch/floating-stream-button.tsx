'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Wifi, WifiOff } from 'lucide-react';
import { useTwitchStream } from '@/hooks/twitch/use-twitch-stream';
import { useStreamWindow } from '@/hooks/twitch/use-stream-window';

interface FloatingStreamButtonProps {
  channelName: string;
  className?: string;
}

export default function FloatingStreamButton({
  channelName,
  className = '',
}: FloatingStreamButtonProps) {
  const { isLive, loading } = useTwitchStream(channelName);
  const { isOpen, openWindow } = useStreamWindow();

  const handleClick = () => {
    if (isLive && !isOpen) {
      openWindow(channelName);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
      >
        <motion.button
          onClick={handleClick}
          disabled={!isLive || loading || isOpen}
          className={`
            relative px-6 py-3 rounded-full font-semibold text-sm
            transition-all duration-300 shadow-lg
            ${
              isLive && !isOpen
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }
            ${isOpen ? 'bg-green-600 text-white' : ''}
          `}
          whileHover={isLive && !isOpen ? { scale: 1.05 } : {}}
          whileTap={isLive && !isOpen ? { scale: 0.95 } : {}}
        >
          <div className="flex items-center space-x-2">
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : isOpen ? (
              <Wifi className="w-4 h-4" />
            ) : isLive ? (
              <Play className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}

            <span>
              {loading
                ? 'Checking...'
                : isOpen
                  ? 'Stream Open'
                  : isLive
                    ? '🔴 Watch Live'
                    : 'Stream Offline'}
            </span>
          </div>

          {isLive && !isOpen && (
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
