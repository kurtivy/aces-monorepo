'use client';

import { AnimatePresence, motion, useDragControls, useMotionValue, type PanInfo } from 'framer-motion';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import RWAForumReal from '../middle-column/chat/rwa-forum-real';

interface ChatSectionProps {
  listingId?: string;
  listingTitle?: string;
  isLive?: boolean;
  floating?: boolean;
  onClose?: () => void;
  dragConstraintsRef?: RefObject<HTMLElement | null>;
  floatingPosition?: { top: number; left: number };
}

export function ChatSection({
  listingId,
  listingTitle,
  isLive,
  floating = false,
  onClose,
  dragConstraintsRef,
  floatingPosition,
}: ChatSectionProps) {
  const dragControls = useDragControls();
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 360,
    height: 500,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(false);
  const previousAnchorRef = useRef<{ top: number; left: number } | null>(null);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  }, []);

  const clampPositionWithinViewport = useCallback(
    (next: { top: number; left: number }, dims?: { width: number; height: number }) => {
      if (typeof window === 'undefined') return next;
      const targetDims = dims ?? size;
      const maxLeft = Math.max(12, window.innerWidth - targetDims.width - 12);
      const maxTop = Math.max(12, window.innerHeight - targetDims.height - 12);
      return {
        left: clamp(next.left, 12, maxLeft),
        top: clamp(next.top, 12, maxTop),
      };
    },
    [clamp, size],
  );

  const getInitialPosition = useCallback(() => {
    if (floatingPosition) {
      return clampPositionWithinViewport(floatingPosition);
    }

    if (typeof window !== 'undefined') {
      return clampPositionWithinViewport({
        top: Math.max(24, window.innerHeight / 2 - 250),
        left: Math.max(24, window.innerWidth - 420),
      });
    }

    return { top: 120, left: 120 };
  }, [clampPositionWithinViewport, floatingPosition]);

  const [position, setPosition] = useState<{ top: number; left: number }>(getInitialPosition);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const updateSizeWithinViewport = useCallback((next: { width: number; height: number }) => {
    if (typeof window === 'undefined') return next;
    const maxWidth = Math.max(320, window.innerWidth - 48);
    const maxHeight = Math.max(360, window.innerHeight - 120);

    return {
      width: clamp(next.width, 300, maxWidth),
      height: clamp(next.height, 360, maxHeight),
    };
  }, [clamp]);

  useEffect(() => {
    if (!floating) return;
    const handleWindowResize = () => {
      setSize((prev) => {
        const adjusted = updateSizeWithinViewport(prev);
        setPosition((current) => {
          const clamped = clampPositionWithinViewport(current, adjusted);
          return clamped.top === current.top && clamped.left === current.left ? current : clamped;
        });
        return adjusted;
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [floating, updateSizeWithinViewport, clampPositionWithinViewport]);

  useEffect(() => {
    if (!floating) {
      setShowResizeHint(false);
      previousAnchorRef.current = null;
      return;
    }

    setPosition((current) => {
      const clamped = clampPositionWithinViewport(current);
      return clamped.top === current.top && clamped.left === current.left ? current : clamped;
    });
  }, [floating, clampPositionWithinViewport]);

  useEffect(() => {
    if (!floating || !floatingPosition) return;
    const prev = previousAnchorRef.current;
    const hasChanged = !prev || prev.top !== floatingPosition.top || prev.left !== floatingPosition.left;
    previousAnchorRef.current = floatingPosition;

    if (hasChanged) {
      const clamped = clampPositionWithinViewport(floatingPosition);
      setPosition(clamped);
      x.set(0);
      y.set(0);
    }
  }, [floating, floatingPosition, clampPositionWithinViewport, x, y]);

  useEffect(() => {
    if (!showResizeHint) return;
    const timeout = window.setTimeout(() => setShowResizeHint(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showResizeHint]);

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!floating || isResizing) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-no-drag="true"]')) {
      return;
    }
    dragControls.start(event);
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!floating) return;
    event.stopPropagation();
    event.preventDefault();

    const resizeHandle = event.currentTarget;
    const pointerId = event.pointerId;
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(pointerId);
      } catch (err) {
        // noop - pointer capture optional
      }
    }

    setIsResizing(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = size;

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const nextSize = updateSizeWithinViewport({
        width: startSize.width + deltaX,
        height: startSize.height + deltaY,
      });

      setSize(nextSize);
      setPosition((current) => {
        const clamped = clampPositionWithinViewport(current, nextSize);
        return clamped.top === current.top && clamped.left === current.left ? current : clamped;
      });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      if (resizeHandle.releasePointerCapture) {
        try {
          resizeHandle.releasePointerCapture(pointerId);
        } catch (err) {
          // ignore release failures
        }
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleCommentsLoaded = useCallback(() => {
    if (!floating) return;
    setShowResizeHint(true);
  }, [floating]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!floating) return;
      setPosition((current) => {
        const desired = {
          top: current.top + info.offset.y,
          left: current.left + info.offset.x,
        };
        const clamped = clampPositionWithinViewport(desired);
        return clamped.top === current.top && clamped.left === current.left ? current : clamped;
      });
      x.set(0);
      y.set(0);
    },
    [clampPositionWithinViewport, floating, x, y],
  );

  return (
    <motion.div
      className={`${
        floating
          ? 'pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-[#2a3b2a]/80 bg-[#0C120C]/95 shadow-[-12px_20px_40px_rgba(10,12,10,0.65)] backdrop-blur-sm'
          : 'flex h-full flex-col border-t border-[#D0B284]/20'
      }`}
      drag={floating && !isResizing}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={floating ? dragConstraintsRef ?? undefined : undefined}
      dragElastic={0.12}
      dragMomentum={false}
      initial={{
        opacity: 0,
        scale: floating ? 0.95 : 1,
        y: floating ? 16 : 0,
      }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={floating ? { opacity: 0, scale: 0.95, y: 16 } : undefined}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onDragEnd={handleDragEnd}
      style={
        floating
          ? {
              width: size.width,
              height: size.height,
              top: position.top,
              left: position.left,
              x,
              y,
            }
          : undefined
      }
    >
      {/* Chat Header */}
      <div
        className={`flex-shrink-0 ${
          floating
            ? 'cursor-grab select-none border-b border-[#2a3b2a]/60 bg-[#131C13]/95 px-4 py-3 active:cursor-grabbing'
            : 'border-b border-[#D0B284]/20 bg-[#151C16] px-5 py-3'
        }`}
        onPointerDown={handleHeaderPointerDown}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-spray-letters text-sm font-bold uppercase tracking-[0.3em] text-[#D0B284]">
              CHAT
            </h3>
          </div>

          {floating && (
            <button
              type="button"
              onClick={onClose}
              data-no-drag="true"
              className="flex items-center gap-1 rounded-full border border-transparent bg-[#1B2A1B]/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#D0B284] transition hover:border-[#D0B284]/40 hover:text-white"
            >
              <X size={12} strokeWidth={2} />
              Dock
            </button>
          )}
        </div>
      </div>

      {/* Chat Content - Scrollable */}
      <div className="flex-1 overflow-hidden">
        <RWAForumReal
          listingId={listingId}
          listingTitle={listingTitle}
          isLive={isLive}
          variant="compact"
          onInitialCommentsLoaded={floating ? handleCommentsLoaded : undefined}
        />
      </div>

      {floating && (
        <div className="absolute bottom-1 right-1">
          <div
            role="presentation"
            data-no-drag="true"
            onPointerDown={handleResizePointerDown}
            className="relative h-6 w-6 cursor-nwse-resize"
          >
            <div className="pointer-events-none absolute inset-0 rounded-br-2xl border-r border-b border-[#2a3b2a]/60" />
            <div className="pointer-events-none absolute bottom-1 right-2 h-3 w-3 border-r-2 border-b-2 border-[#D0B284]/50" />
          </div>

          <AnimatePresence>
            {showResizeHint && (
              <motion.div
                key="resize-hint"
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: -4, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="pointer-events-none absolute -top-9 right-1 flex items-center gap-1 rounded-full border border-[#0F3D2E]/30 bg-[#D0B264] px-2 py-1 text-[10px] font-spray-letters uppercase tracking-[0.25em] text-[#0F3D2E] shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
              >
                <span>RESIZE&nbsp;HERE</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
