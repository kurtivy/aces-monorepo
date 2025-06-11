export const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

export const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
