// Analytics utility for Twitch integration
// Integrates with Google Analytics and Microsoft Clarity

import { clarityAnalytics } from './clarity-analytics';

// Extend window interface for analytics
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const trackTwitchEvent = (action: string, data?: Record<string, unknown>) => {
  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'twitch_interaction', {
      action,
      data: JSON.stringify(data),
      timestamp: new Date().toISOString(),
    });
  }

  // Microsoft Clarity
  if (typeof window !== 'undefined') {
    clarityAnalytics.setCustomVariable('twitch_action', action);
    if (data) {
      clarityAnalytics.trackEvent(
        'twitch_interaction',
        data as Record<string, string | number | boolean>,
      );
    }
  }
};

// Track stream window events
export const trackStreamWindowEvent = (
  event: 'opened' | 'closed' | 'focused',
  data?: Record<string, unknown>,
) => {
  trackTwitchEvent(`stream_window_${event}`, data);
};

// Track mobile mode changes
export const trackMobileModeChange = (
  mode: 'images' | 'stream',
  data?: Record<string, unknown>,
) => {
  trackTwitchEvent('mobile_mode_change', { mode, ...data });
};

// Track stream status checks
export const trackStreamStatusCheck = (isLive: boolean, channelName: string) => {
  trackTwitchEvent('stream_status_check', { isLive, channelName });
};
