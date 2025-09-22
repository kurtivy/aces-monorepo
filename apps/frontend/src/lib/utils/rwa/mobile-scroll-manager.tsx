'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

interface SectionRef {
  id: string;
  ref: RefObject<HTMLDivElement | null>;
}

interface ScrollManagerReturn {
  activeSection: string;
  isTradeButtonVisible: boolean;
  scrollToSection: (sectionId: string) => void;
}

const MOBILE_HEADER_OFFSET = 120;
const SCROLL_THRESHOLD = 200;
const THROTTLE_INTERVAL = 100;

export function useMobileScrollManager(
  sections: SectionRef[],
  containerRef?: RefObject<HTMLElement | null>,
): ScrollManagerReturn {
  const [activeSection, setActiveSection] = useState('overview');
  const [isTradeButtonVisible, setIsTradeButtonVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const sectionMap = useMemo(() => {
    const map = new Map<string, RefObject<HTMLDivElement | null>>();
    sections.forEach(({ id, ref }) => map.set(id, ref));
    return map;
  }, [sections]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      const targetRef = sectionMap.get(sectionId);
      if (!targetRef?.current) return;

      const targetPosition = targetRef.current.offsetTop - MOBILE_HEADER_OFFSET;

      if (containerRef?.current) {
        containerRef.current.scrollTo({
          top: Math.max(targetPosition, 0),
          behavior: 'smooth',
        });
      } else {
        window.scrollTo({
          top: Math.max(targetPosition, 0),
          behavior: 'smooth',
        });
      }
    },
    [sectionMap, containerRef],
  );

  useEffect(() => {
    if (!sections.length) return;

    const rootElement = containerRef?.current ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      {
        root: rootElement,
        rootMargin: `-${MOBILE_HEADER_OFFSET}px 0px -50% 0px`,
        threshold: 0.1,
      },
    );

    sections.forEach(({ ref }) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      sections.forEach(({ ref }) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
      observer.disconnect();
    };
  }, [sections, containerRef]);

  useEffect(() => {
    const scrollElement = containerRef?.current ?? window;

    const handleScroll = () => {
      const currentScrollY = containerRef?.current?.scrollTop ?? window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;

      if (isScrollingDown && currentScrollY > SCROLL_THRESHOLD) {
        setIsTradeButtonVisible(false);
      } else if (!isScrollingDown || currentScrollY <= SCROLL_THRESHOLD) {
        setIsTradeButtonVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    const throttledHandler = throttle(handleScroll, THROTTLE_INTERVAL);

    scrollElement.addEventListener(
      'scroll',
      throttledHandler as EventListenerOrEventListenerObject,
      {
        passive: true,
      },
    );

    return () => {
      scrollElement.removeEventListener(
        'scroll',
        throttledHandler as EventListenerOrEventListenerObject,
      );
      throttledHandler.cancel?.();
    };
  }, [containerRef]);

  return {
    activeSection,
    isTradeButtonVisible,
    scrollToSection,
  };
}

type Throttled<T extends (...args: unknown[]) => void> = T & { cancel?: () => void };

function throttle<T extends (...args: unknown[]) => void>(fn: T, limit: number): Throttled<T> {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttledFunction = (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttledFunction(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  throttledFunction.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    inThrottle = false;
    lastArgs = null;
  };

  return throttledFunction as Throttled<T>;
}
