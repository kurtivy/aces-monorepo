'use client';

import { motion } from 'framer-motion';
import { Play, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useTwitchStream } from '@/hooks/twitch/use-twitch-stream';
import { useStreamWindow } from '@/hooks/twitch/use-stream-window';

interface TwitchTestProps {
  channelName?: string;
}

export default function TwitchTest({ channelName = 'testchannel' }: TwitchTestProps) {
  const { isLive, loading, error, refetch } = useTwitchStream(channelName);
  const { isOpen, openWindow, closeWindow } = useStreamWindow();

  const handleClick = () => {
    if (isLive && !isOpen) {
      openWindow(channelName);
    } else if (isOpen) {
      closeWindow();
    }
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Twitch Integration Test</h2>

      <div className="space-y-4">
        {/* Status Display */}
        <div className="flex items-center space-x-2">
          {loading ? (
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          ) : isOpen ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : isLive ? (
            <Play className="w-5 h-5 text-red-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-gray-400" />
          )}

          <span className="text-white">
            {loading
              ? 'Checking...'
              : isOpen
                ? 'Stream Open'
                : isLive
                  ? '🔴 Live'
                  : 'Stream Offline'}
          </span>
        </div>

        {/* Error Display */}
        {error && <div className="text-red-400 text-sm">Error: {error}</div>}

        {/* Action Button */}
        <motion.button
          onClick={handleClick}
          disabled={loading || (!isLive && !isOpen)}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all duration-200
            ${
              isLive && !isOpen
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                : isOpen
                  ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                  : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }
          `}
          whileHover={isLive || isOpen ? { scale: 1.05 } : {}}
          whileTap={isLive || isOpen ? { scale: 0.95 } : {}}
        >
          {loading
            ? 'Checking...'
            : isOpen
              ? 'Close Stream'
              : isLive
                ? 'Open Stream'
                : 'Stream Offline'}
        </motion.button>

        {/* Refresh Button */}
        <button
          onClick={refetch}
          disabled={loading}
          className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Refresh Status
        </button>

        {/* Debug Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Channel: {channelName}</div>
          <div>Loading: {loading.toString()}</div>
          <div>Is Live: {isLive.toString()}</div>
          <div>Window Open: {isOpen.toString()}</div>
        </div>
      </div>
    </div>
  );
}
