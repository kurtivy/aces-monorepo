'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Image, Wifi } from 'lucide-react';
import { useTwitchStream } from '@/hooks/twitch/use-twitch-stream';
import { trackMobileModeChange } from '@/lib/utils/analytics';

interface MobileStreamToggleProps {
  channelName: string;
  imageGallery?: string[];
  onModeChange?: (mode: 'images' | 'stream') => void;
}

export default function MobileStreamToggle({
  channelName,
  imageGallery = [],
  onModeChange,
}: MobileStreamToggleProps) {
  const [activeMode, setActiveMode] = useState<'images' | 'stream'>('images');
  const { isLive } = useTwitchStream(channelName);

  const handleModeChange = (mode: 'images' | 'stream') => {
    setActiveMode(mode);
    onModeChange?.(mode);

    // Track analytics
    trackMobileModeChange(mode, { channelName });
  };

  return (
    <div className="w-full">
      {/* Toggle Header */}
      <div className="flex bg-[#1a1a1a] rounded-t-lg overflow-hidden">
        <motion.button
          onClick={() => handleModeChange('images')}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 transition-colors ${
            activeMode === 'images' ? 'bg-[#D0B284] text-black' : 'bg-transparent text-gray-400'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          <Image className="w-4 h-4" />
          <span className="text-sm font-medium">Images</span>
        </motion.button>

        <motion.button
          onClick={() => handleModeChange('stream')}
          disabled={!isLive}
          className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 transition-colors ${
            activeMode === 'stream'
              ? 'bg-[#D0B284] text-black'
              : isLive
                ? 'bg-transparent text-gray-400 hover:text-white'
                : 'bg-transparent text-gray-600 cursor-not-allowed'
          }`}
          whileTap={isLive ? { scale: 0.98 } : {}}
        >
          {isLive ? <Wifi className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="text-sm font-medium">{isLive ? '🔴 Live' : 'Stream'}</span>
        </motion.button>
      </div>

      {/* Content Area */}
      <div className="bg-black rounded-b-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <AnimatePresence mode="wait">
          {activeMode === 'images' ? (
            <motion.div
              key="images"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full"
            >
              {/* Image carousel placeholder - can be replaced with actual image gallery */}
              <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-400">
                {imageGallery.length > 0 ? (
                  <div className="text-center">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg font-medium">Image Gallery</p>
                    <p className="text-sm">{imageGallery.length} images</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg font-medium">Image Gallery</p>
                    <p className="text-sm">No images available</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="stream"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full h-full"
            >
              {isLive ? (
                <iframe
                  src={`https://player.twitch.tv/?channel=${channelName}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false&muted=false`}
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-400">
                  <Wifi className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-lg font-medium">Stream Offline</p>
                  <p className="text-sm">Check back when we&apos;re live!</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
