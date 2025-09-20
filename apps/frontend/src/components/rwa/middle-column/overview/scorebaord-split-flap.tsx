// components/ScoreboardSplitFlap.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ========= Types ========= */
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface SplitFlapDigitProps {
  value: string;
  nextValue?: string;
  shouldAnimate?: boolean;
  widthClass?: string;
  heightClass?: string;
}

export interface SplitFlapProps {
  launchDate?: string | null;
  showLabels?: boolean;
  className?: string;
  digitWidthClass?: string;
  digitHeightClass?: string;
}

/* ========= Countdown (drift-aware with predictive animation) ========= */
function useCountdown(launchDate?: string | null) {
  const [isLaunched, setIsLaunched] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [nextTimeLeft, setNextTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (!launchDate) {
      setIsLaunched(true);
      return;
    }
    const target = new Date(launchDate).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setNextTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsLaunched(true);
        return;
      }

      // Calculate current time
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      // Calculate what the time will be in the next second
      const nextDiff = diff - 1000;
      const nextDays = Math.floor(nextDiff / 86400000);
      const nextHours = Math.floor((nextDiff % 86400000) / 3600000);
      const nextMinutes = Math.floor((nextDiff % 3600000) / 60000);
      const nextSeconds = Math.floor((nextDiff % 60000) / 1000);

      const currentTime = { days, hours, minutes, seconds };
      const nextTime = {
        days: nextDays,
        hours: nextHours,
        minutes: nextMinutes,
        seconds: nextSeconds,
      };

      setNextTimeLeft(nextTime);

      // Check if we need to trigger animation 230ms before the change
      const msToNextSecond = 1000 - (now % 1000);

      if (msToNextSecond <= 280) {
        // We're within 230ms of the next second change
        // Check if any digits will actually change
        const willChange =
          currentTime.days !== nextTime.days ||
          currentTime.hours !== nextTime.hours ||
          currentTime.minutes !== nextTime.minutes ||
          currentTime.seconds !== nextTime.seconds;

        if (willChange) {
          setShouldAnimate(true);
          // Update to next time after the exact remaining time to next second
          setTimeout(() => {
            setTimeLeft(nextTime);
            setShouldAnimate(false);
          }, msToNextSecond);
        }
      } else {
        // Normal update when not near transition
        setTimeLeft(currentTime);
        setShouldAnimate(false);
      }

      const nextTick = msToNextSecond > 230 ? msToNextSecond - 230 : msToNextSecond + 770;
      timer = window.setTimeout(tick, nextTick);
    };

    let timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [launchDate]);

  return { isLaunched, timeLeft, nextTimeLeft, shouldAnimate };
}

/* ========= Utils ========= */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/* ========= Single rotating digit ========= */
function SplitFlapDigit({
  value,
  nextValue,
  shouldAnimate = false,
  widthClass = 'w-16',
  heightClass = 'h-24',
}: SplitFlapDigitProps) {
  const [animKey, setAnimKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const firstRenderRef = useRef(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Trigger animation based on external shouldAnimate prop
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      setDisplayValue(value);
      return;
    }

    if (shouldAnimate && nextValue && nextValue !== value) {
      setIsAnimating(true);
      setAnimKey((k) => k + 1);

      // Calculate more precise timing for the switch
      // Switch happens when we're roughly at the animation midpoint
      const switchTimer = setTimeout(() => {
        setDisplayValue(nextValue);
      }, 175); // Midpoint of 350ms animation

      // Reset to static display after animation completes
      const endTimer = setTimeout(() => {
        setIsAnimating(false);
      }, 380); // Slightly longer than 350ms animation

      return () => {
        clearTimeout(switchTimer);
        clearTimeout(endTimer);
      };
    } else if (!shouldAnimate) {
      // Update display value when not animating
      setDisplayValue(value);
    }
  }, [shouldAnimate, value, nextValue]);

  // Measure card height for font sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setVar = () => {
      const h = el.offsetHeight;
      el.style.setProperty('--cardH', `${h}px`);
      el.style.setProperty('--digitSize', `calc(var(--cardH) * 0.6)`);
    };
    setVar();

    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative ${widthClass} ${heightClass} [perspective:800px] select-none overflow-hidden`}
      aria-hidden
    >
      {/* base container */}
      <div className="absolute inset-0 rounded-md bg-[#151c16] border border-[#D0B284]/40 shadow-[0_8px_20px_rgba(0,0,0,.45)]" />

      {/* hinge line */}
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-black/60" />

      {/* STATIC: centered number when not animating */}
      {!isAnimating && (
        <div
          className="absolute inset-0 flex items-center justify-center font-extrabold tabular-nums"
          style={{
            color: '#D0B284',
            fontSize: 'var(--digitSize, 42px)',
            lineHeight: '1',
            letterSpacing: '0.02em',
            textShadow:
              '0 0 10px rgba(208,178,132,.22), 0 1px 0 rgba(0,0,0,.6), 0 12px 18px rgba(0,0,0,.45)',
          }}
        >
          {displayValue}
        </div>
      )}

      {/* ANIMATED: mechanical rotation during change */}
      {isAnimating && (
        <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {/* Current number rotating out */}
          <div
            key={`out-${animKey}`}
            className="absolute inset-0 flex items-center justify-center font-extrabold tabular-nums animate-rotateOut"
            style={{
              color: '#D0B284',
              fontSize: 'var(--digitSize, 42px)',
              lineHeight: '1',
              letterSpacing: '0.02em',
              textShadow:
                '0 0 10px rgba(208,178,132,.22), 0 1px 0 rgba(0,0,0,.6), 0 12px 18px rgba(0,0,0,.45)',
              transformOrigin: 'center center',
              backfaceVisibility: 'hidden',
            }}
          >
            {value}
          </div>

          {/* New number rotating in */}
          <div
            key={`in-${animKey}`}
            className="absolute inset-0 flex items-center justify-center font-extrabold tabular-nums animate-rotateIn"
            style={{
              color: '#D0B284',
              fontSize: 'var(--digitSize, 42px)',
              lineHeight: '1',
              letterSpacing: '0.02em',
              textShadow:
                '0 0 10px rgba(208,178,132,.22), 0 1px 0 rgba(0,0,0,.6), 0 12px 18px rgba(0,0,0,.45)',
              transformOrigin: 'center center',
              backfaceVisibility: 'hidden',
            }}
          >
            {nextValue}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes rotateOut {
          0% {
            transform: rotateX(0deg);
            opacity: 1;
          }
          100% {
            transform: rotateX(90deg);
            opacity: 0;
          }
        }

        @keyframes rotateIn {
          0% {
            transform: rotateX(-90deg);
            opacity: 0;
          }
          100% {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }

        .animate-rotateOut {
          animation: rotateOut 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-rotateIn {
          animation: rotateIn 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}

/* ========= Main component ========= */
export default function ScoreboardSplitFlap({
  launchDate,
  showLabels = true,
  className = '',
  digitWidthClass = 'w-18',
  digitHeightClass = 'h-24',
}: SplitFlapProps) {
  const { isLaunched, timeLeft, nextTimeLeft, shouldAnimate } = useCountdown(launchDate);

  const nowPairs = useMemo(
    () => [
      { value: pad2(timeLeft.days), label: 'DAYS' },
      { value: pad2(timeLeft.hours), label: 'HOURS' },
      { value: pad2(timeLeft.minutes), label: 'MINUTES' },
      { value: pad2(timeLeft.seconds), label: 'SECONDS' },
    ],
    [timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds],
  );

  const nextPairs = useMemo(
    () => [
      { value: pad2(nextTimeLeft.days), label: 'DAYS' },
      { value: pad2(nextTimeLeft.hours), label: 'HOURS' },
      { value: pad2(nextTimeLeft.minutes), label: 'MINUTES' },
      { value: pad2(nextTimeLeft.seconds), label: 'SECONDS' },
    ],
    [nextTimeLeft.days, nextTimeLeft.hours, nextTimeLeft.minutes, nextTimeLeft.seconds],
  );

  if (isLaunched) {
    return (
      <div
        className={`w-full flex items-center justify-center rounded-xl px-3 py-3 bg-[#151c16] border border-[#D0B284] border-dashed shadow-lg ${className}`}
      >
        <span className="text-base sm:text-lg font-semibold text-[#D0B284] tracking-wide font-spray-letters">
          Available Now
        </span>
      </div>
    );
  }

  return (
    <div className={`w-full px-4 py-4 bg-[#151c16] shadow-lg relative ${className}`}>
      {/* SVG Dashed Border - Top */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="8"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 right-0 top-0"
      >
        <line
          x1="0"
          y1="1"
          x2="100"
          y2="1"
          stroke="#D0B284"
          strokeOpacity={0.5}
          strokeWidth={1}
          strokeDasharray="12 12"
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      </svg>

      {/* SVG Dashed Border - Bottom */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="8"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 right-0 bottom-0"
      >
        <line
          x1="0"
          y1="1"
          x2="100"
          y2="1"
          stroke="#D0B284"
          strokeOpacity={0.5}
          strokeWidth={1}
          strokeDasharray="12 12"
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      </svg>

      <div className="grid grid-cols-4 gap-6 items-end">
        {nowPairs.map((unit, idx) => {
          const next = nextPairs[idx];
          return (
            <div key={unit.label} className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-2 bg-[#151c16] rounded-lg px-3 py-3">
                <SplitFlapDigit
                  value={unit.value[0]}
                  nextValue={next.value[0]}
                  shouldAnimate={shouldAnimate}
                  widthClass={digitWidthClass}
                  heightClass={digitHeightClass}
                />
                <SplitFlapDigit
                  value={unit.value[1]}
                  nextValue={next.value[1]}
                  shouldAnimate={shouldAnimate}
                  widthClass={digitWidthClass}
                  heightClass={digitHeightClass}
                />
              </div>
              {showLabels && (
                <span className="mt-2 text-base uppercase tracking-[0.12em] text-[#D0B284] font-spray-letters">
                  {unit.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
