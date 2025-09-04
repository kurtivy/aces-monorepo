/**
 * Shared date constants for consistent countdown timers across the application
 */

// Featured section launch date - used in both canvas featured section and upcoming page
export const FEATURED_TARGET_DATE = '2025-09-19T12:00:00-04:00';

// Type for countdown time left interface
export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Calculate time left until target date
 * @param targetDate - The target date string or Date object
 * @returns TimeLeft object with days, hours, minutes, seconds
 */
export const calculateTimeLeft = (targetDate: string | Date): TimeLeft => {
  const difference = +new Date(targetDate) - +new Date();

  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  return { days: 0, hours: 0, minutes: 0, seconds: 0 };
};
