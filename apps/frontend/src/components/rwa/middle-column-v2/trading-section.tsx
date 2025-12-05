'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import TradingViewChart from '@/components/charts/trading-view-chart';
import DexScreenerChart from '@/components/charts/dexscreener-chart';
import TradeHistory from '../middle-column/token-details/trade-history';
import { DatabaseListing } from '@/types/rwa/section.types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ImageData {
  id: number;
  src: string;
  thumbnail?: string;
  alt: string;
}

interface TradingSectionProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  images?: ImageData[];
  selectedImageIndex?: number;
  onImageSelect?: Dispatch<SetStateAction<number>>;
}

const DEFAULT_CHART_HEIGHT = 600;
const DEFAULT_TABLE_HEIGHT = 320;
const MIN_CHART_HEIGHT = 260;
const MIN_TABLE_HEIGHT = 200;
const HANDLE_HEIGHT = 10;

export function TradingSection({
  tokenAddress,
  tokenSymbol,
  title,
  chainId,
  dexMeta,
  images,
  selectedImageIndex,
  onImageSelect,
}: TradingSectionProps) {
  const [chartHeight, setChartHeight] = useState<number>(DEFAULT_CHART_HEIGHT);
  const [tableHeight, setTableHeight] = useState<number>(DEFAULT_TABLE_HEIGHT);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const resolvedTokenSymbol = tokenSymbol || 'RWA';

  // 🔥 DEX MODE: Use full DexScreener iframe (chart + transactions + holders)
  // This bypasses our custom TradeHistory and uses DexScreener's built-in UI
  const isDexMode =
    Boolean(dexMeta?.priceSource === 'DEX') && Boolean(dexMeta?.poolAddress?.length);

  // In DEX mode, render full DexScreener experience without splitter/TradeHistory
  // showTransactions=true shows the bottom panel (Transactions, Top Traders, Holders tabs)
  // showTokenInfo=false hides the right sidebar (market cap, liquidity details)
  if (isDexMode && dexMeta?.poolAddress) {
    return (
      <div className="flex flex-col flex-1">
        <DexScreenerChart
          poolAddress={dexMeta.poolAddress}
          tokenSymbol={resolvedTokenSymbol}
          showTransactions={true}
          showTokenInfo={false}
          fullHeight={true}
        />
      </div>
    );
  }

  const splitterRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragInfoRef = useRef<{
    startY: number;
    startChartHeight: number;
    totalHeight: number;
  } | null>(null);
  const pendingHeightsRef = useRef<{ chart: number; table: number } | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  const scheduleHeightUpdate = useCallback((chart: number, table: number) => {
    pendingHeightsRef.current = { chart, table };
    if (frameRequestRef.current !== null) {
      return;
    }

    frameRequestRef.current = window.requestAnimationFrame(() => {
      frameRequestRef.current = null;
      if (!pendingHeightsRef.current) {
        return;
      }
      setChartHeight(pendingHeightsRef.current.chart);
      setTableHeight(pendingHeightsRef.current.table);
      pendingHeightsRef.current = null;
    });
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) {
        return;
      }

      if (event.buttons === 0) {
        dragInfoRef.current = null;
        setIsDragging(false);
        activePointerIdRef.current = null;

        if (event.pointerId != null && splitterRef.current?.hasPointerCapture(event.pointerId)) {
          splitterRef.current.releasePointerCapture(event.pointerId);
        }

        if (typeof document !== 'undefined') {
          document.body.style.removeProperty('user-select');
          document.body.style.removeProperty('cursor');
        }

        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp as EventListener);
        return;
      }

      const dragInfo = dragInfoRef.current;
      if (!dragInfo) {
        return;
      }

      const deltaY = event.clientY - dragInfo.startY;
      const tentativeChartHeight = dragInfo.startChartHeight + deltaY;
      const minChartHeight = MIN_CHART_HEIGHT;
      const maxChartHeight = Math.max(minChartHeight, dragInfo.totalHeight - MIN_TABLE_HEIGHT);
      const nextChartHeight = Math.min(
        Math.max(tentativeChartHeight, minChartHeight),
        maxChartHeight,
      );
      const nextTableHeight = dragInfo.totalHeight - nextChartHeight;

      scheduleHeightUpdate(nextChartHeight, nextTableHeight);
    },
    [scheduleHeightUpdate],
  );

  const handlePointerUp = useCallback(
    (event?: PointerEvent) => {
      dragInfoRef.current = null;
      setIsDragging(false);
      activePointerIdRef.current = null;

      if (event?.pointerId != null && splitterRef.current?.hasPointerCapture(event.pointerId)) {
        splitterRef.current.releasePointerCapture(event.pointerId);
      }

      if (typeof document !== 'undefined') {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);
    },
    [handlePointerMove],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isTableExpanded) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      dragInfoRef.current = {
        startY: event.clientY,
        startChartHeight: chartHeight,
        totalHeight: chartHeight + tableHeight,
      };

      activePointerIdRef.current = event.pointerId;
      setIsDragging(true);

      if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp as EventListener);
      event.preventDefault();
    },
    [chartHeight, tableHeight, isTableExpanded, handlePointerMove, handlePointerUp],
  );

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);

      if (
        activePointerIdRef.current != null &&
        splitterRef.current?.hasPointerCapture(activePointerIdRef.current)
      ) {
        splitterRef.current.releasePointerCapture(activePointerIdRef.current);
      }
      activePointerIdRef.current = null;

      if (typeof document !== 'undefined') {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      }
    };
  }, [handlePointerMove, handlePointerUp]);

  const toggleExpandedTable = useCallback(() => {
    setIsTableExpanded((prev) => {
      if (prev) {
        setChartHeight(DEFAULT_CHART_HEIGHT);
        setTableHeight(DEFAULT_TABLE_HEIGHT);
      }
      return !prev;
    });
  }, []);

  const resetSplit = useCallback(() => {
    setIsTableExpanded(false);
    setChartHeight(DEFAULT_CHART_HEIGHT);
    setTableHeight(DEFAULT_TABLE_HEIGHT);
  }, []);

  const totalHeight = chartHeight + tableHeight;
  const effectiveChartHeight = isTableExpanded ? 0 : chartHeight;
  const effectiveTableHeight = isTableExpanded ? totalHeight : tableHeight;
  const handleDisabled = isTableExpanded;
  const containerMinHeight = MIN_CHART_HEIGHT + MIN_TABLE_HEIGHT + HANDLE_HEIGHT;
  const tradeHistoryStyle = useMemo(
    () => ({
      height: `${Math.max(effectiveTableHeight, MIN_TABLE_HEIGHT)}px`,
      minHeight: `${MIN_TABLE_HEIGHT}px`,
    }),
    [effectiveTableHeight],
  );

  return (
    <div className="flex flex-col" style={{ minHeight: `${containerMinHeight}px` }}>
      <div
        className="overflow-hidden bg-[#231f20]/50"
        style={{ height: `${Math.max(effectiveChartHeight, 0)}px` }}
      >
        <div
          className={`h-full overflow-hidden ${
            isTableExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <TradingViewChart
            tokenAddress={tokenAddress}
            tokenSymbol={resolvedTokenSymbol}
            tokenName={title}
            imageSrc={images?.[selectedImageIndex || 0]?.src}
            heightClass=""
            heightPx={Math.max(effectiveChartHeight, 0)}
            minHeightPx={isTableExpanded ? 0 : MIN_CHART_HEIGHT}
            dexMeta={dexMeta}
          />
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        ref={splitterRef}
        className={`relative flex items-center justify-center text-[#8F9B8F] transition-colors ${
          handleDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-row-resize hover:bg-[#2a332a]'
        } ${isDragging ? 'bg-[#1b241b]' : ''}`}
        style={{ height: `${HANDLE_HEIGHT}px`, margin: 0 }}
        onPointerDown={handlePointerDown}
        onDoubleClick={resetSplit}
        title="Drag to resize. Double-click to reset."
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#3b3b3b]" />
        <div className="relative flex items-center gap-1 text-[11px]">
          <ChevronUp className="h-3 w-3" />
          <ChevronDown className="h-3 w-3" />
        </div>
      </div>

      <TradeHistory
        tokenAddress={tokenAddress}
        tokenSymbol={resolvedTokenSymbol}
        dexMeta={dexMeta}
        className="h-full rounded-t-none"
        contentClassName="h-full"
        style={tradeHistoryStyle}
        onToggleExpand={toggleExpandedTable}
        isExpanded={isTableExpanded}
      />
    </div>
  );
}
