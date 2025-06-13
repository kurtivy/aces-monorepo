export const MOBILE_BREAKPOINT = 768;

export const UNIT_SIZE = 200;

export const getUnitSize = (width?: number): number => {
  const screenWidth =
    width || (typeof window !== 'undefined' ? window.innerWidth : MOBILE_BREAKPOINT);
  if (screenWidth < MOBILE_BREAKPOINT) {
    return 150; // Smaller unit size for mobile
  }
  return 200; // Default unit size for desktop
};

export const LOADING_DURATION = 3000; // milliseconds
