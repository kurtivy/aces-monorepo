'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Wifi, WifiOff } from 'lucide-react';
import { useTwitchStream } from '@/hooks/twitch/use-twitch-stream';
import { useStreamWindow } from '@/hooks/twitch/use-stream-window';
import { cn } from '@/lib/utils';

interface FloatingStreamButtonProps {
  channelName: string;
  className?: string;
  variant?: 'pill' | 'selector';
  buttonClassName?: string;
}

export default function FloatingStreamButton({
  channelName,
  className = '',
  variant = 'pill',
  buttonClassName = '',
}: FloatingStreamButtonProps) {
  const { isLive, loading } = useTwitchStream(channelName);
  const { isOpen, openWindow } = useStreamWindow();

  const handleClick = () => {
    if (isLive && !isOpen) {
      openWindow(channelName);
    }
  };

  const label = loading ? 'Checking...' : isOpen ? 'Stream Open' : 'Live Stream';

  const isSelectorVariant = variant === 'selector';
  const selectorDisabled = !isOpen && (!isLive || loading);
  const showLiveState = !loading && (isLive || isOpen);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={cn(isSelectorVariant ? 'w-full' : '', className)}
      >
        <motion.button
          onClick={handleClick}
          disabled={!isLive || loading || isOpen}
          className={cn(
            'relative transition-all duration-300',
            isSelectorVariant
              ? cn(
                  'relative flex h-16 w-full items-center justify-center overflow-hidden rounded-md',
                  'bg-[#0E150E] text-[#D0B284] font-spray-letters text-[13px] tracking-[0.25em]',
                  'transition-colors',
                  isOpen ? 'bg-[#162016] text-white' : '',
                  selectorDisabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:bg-[#151F15] hover:text-white',
                )
              : cn(
                  'relative px-6 py-3 rounded-full font-spray-letters text-base shadow-lg',
                  isLive && !isOpen
                    ? 'bg-[#D7BF75] hover:bg-[#D7BF75]/90 text-[#231F20] cursor-pointer'
                    : 'bg-[#231F20] text-[#D7BF75] border border-[#D7BF75] cursor-not-allowed',
                  isOpen ? 'bg-[#184D37] border border-[#D7BF75] text-white' : '',
                ),
            buttonClassName,
          )}
          style={
            isSelectorVariant
              ? undefined
              : {
                  transform: !isLive && !loading ? 'scale(0.6)' : 'scale(1)',
                }
          }
          whileHover={isSelectorVariant ? undefined : isLive && !isOpen ? { scale: 1.05 } : {}}
          whileTap={isSelectorVariant ? undefined : isLive && !isOpen ? { scale: 0.95 } : {}}
        >
          {isSelectorVariant ? (
            <>
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-[#2a3b2a] bg-[#151F15]">
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-3 w-3 rounded-full border-2 border-[#D0B284]/80 border-t-transparent"
                  />
                ) : isOpen ? (
                  <Wifi className="h-3.5 w-3.5 text-[#4FFFB0]" />
                ) : isLive ? (
                  <Play className="h-3.5 w-3.5 text-[#4FFFB0]" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-[#D54040]" />
                )}
              </div>

              <span className="pointer-events-none">{label.toUpperCase()}</span>

              <span
                className={cn(
                  'pointer-events-none absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-[#D0B284]/50 transition',
                  loading
                    ? 'bg-[#D0B284] animate-pulse'
                    : showLiveState
                      ? 'bg-[#4FFFB0] shadow-[0_0_12px_rgba(79,255,176,0.6)]'
                      : 'bg-[#D54040]',
                )}
              />

              <div className="pointer-events-none absolute left-5 right-5 top-3 border-t border-dashed border-[#D0B284]/40" />
              <div className="pointer-events-none absolute left-5 right-5 bottom-3 border-t border-dashed border-[#D0B284]/40" />
            </>
          ) : (
            <div className="flex items-center space-x-2">
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-xl"
                />
              ) : isOpen ? (
                <Wifi className="w-4 h-4" />
              ) : isLive ? (
                <Play className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}

              <span className="font-spray-letters text-base tracking-wider">{label}</span>
            </div>
          )}

          {isLive && !isOpen && (
            <motion.div
              className={cn(
                'absolute',
                isSelectorVariant ? 'invisible' : '-top-1 -right-1 h-3 w-3 rounded-xl bg-[#D7BF75]',
              )}
              animate={
                isSelectorVariant
                  ? undefined
                  : {
                      scale: [1, 1.2, 1],
                    }
              }
              transition={
                isSelectorVariant
                  ? undefined
                  : {
                      duration: 1,
                      repeat: Infinity,
                    }
              }
            />
          )}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
