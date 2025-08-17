/**
 * Microsoft Clarity Analytics Wrapper
 *
 * Provides type-safe methods for advanced Microsoft Clarity features
 * including custom events, user identification, and session management.
 */

// Extend the global window object to include Clarity
declare global {
  interface Window {
    clarity?: {
      (action: 'start', options?: Record<string, string | number | boolean>): void;
      (action: 'stop'): void;
      (
        action: 'identify',
        userId: string,
        sessionId?: string,
        pageId?: string,
        userHint?: string,
      ): void;
      (action: 'set', key: string, value: string): void;
      (action: 'event', eventName: string): void;
      (action: 'upgrade', reason: string): void;
      (action: 'consent', consent?: boolean): void;
      (
        action: 'track',
        eventName: string,
        properties?: Record<string, string | number | boolean>,
      ): void;
    };
  }
}

export interface ClarityEventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ClarityUserInfo {
  userId: string;
  sessionId?: string;
  pageId?: string;
  userHint?: string;
}

export class ClarityAnalytics {
  private static instance: ClarityAnalytics;
  private isInitialized = false;
  private isEnabled = false;

  private constructor() {
    this.checkInitialization();
  }

  public static getInstance(): ClarityAnalytics {
    if (!ClarityAnalytics.instance) {
      ClarityAnalytics.instance = new ClarityAnalytics();
    }
    return ClarityAnalytics.instance;
  }

  private checkInitialization(): void {
    if (typeof window === 'undefined') {
      return; // Server-side rendering
    }

    // Check if Clarity script is loaded and project ID is configured
    this.isEnabled = !!(
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID &&
      (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID)
    );

    if (this.isEnabled) {
      // Wait for Clarity to be available
      const checkClarity = () => {
        if (window.clarity) {
          this.isInitialized = true;
        } else {
          setTimeout(checkClarity, 100);
        }
      };
      checkClarity();
    }
  }

  /**
   * Check if Clarity is available and enabled
   */
  public isAvailable(): boolean {
    return this.isEnabled && this.isInitialized && !!window.clarity;
  }

  /**
   * Start Clarity tracking with optional configuration
   */
  public start(options?: Record<string, string | number | boolean>): void {
    if (!this.isAvailable()) return;

    try {
      window.clarity!('start', options);
    } catch (error) {
      console.warn('[Clarity] Failed to start tracking:', error);
    }
  }

  /**
   * Stop Clarity tracking
   */
  public stop(): void {
    if (!this.isAvailable()) return;

    try {
      window.clarity!('stop');
    } catch (error) {
      console.warn('[Clarity] Failed to stop tracking:', error);
    }
  }

  /**
   * Identify a user for better session tracking
   * Useful for tracking user journeys across sessions
   */
  public identifyUser(userInfo: ClarityUserInfo): void {
    if (!this.isAvailable()) return;

    try {
      const { userId, sessionId, pageId, userHint } = userInfo;
      window.clarity!('identify', userId, sessionId, pageId, userHint);
    } catch (error) {
      console.warn('[Clarity] Failed to identify user:', error);
    }
  }

  /**
   * Set custom session variables
   * Useful for segmenting users in analytics
   */
  public setCustomVariable(key: string, value: string): void {
    if (!this.isAvailable()) return;

    try {
      window.clarity!('set', key, value);
    } catch (error) {
      console.warn('[Clarity] Failed to set custom variable:', error);
    }
  }

  /**
   * Track custom events for detailed user behavior analysis
   * Perfect for tracking interactions specific to your app
   */
  public trackEvent(eventName: string, properties?: ClarityEventProperties): void {
    if (!this.isAvailable()) return;

    try {
      if (properties && Object.keys(properties).length > 0) {
        // Set properties as custom variables first
        Object.entries(properties).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            this.setCustomVariable(`event_${key}`, String(value));
          }
        });
      }

      window.clarity!('event', eventName);
    } catch (error) {
      console.warn('[Clarity] Failed to track event:', error);
    }
  }

  /**
   * Upgrade session recording quality
   * Use sparingly for important user journeys
   */
  public upgradeSession(reason: string): void {
    if (!this.isAvailable()) return;

    try {
      window.clarity!('upgrade', reason);
    } catch (error) {
      console.warn('[Clarity] Failed to upgrade session:', error);
    }
  }

  /**
   * Set user consent for privacy compliance
   */
  public setConsent(hasConsent: boolean = true): void {
    if (!this.isAvailable()) return;

    try {
      window.clarity!('consent', hasConsent);
    } catch (error) {
      console.warn('[Clarity] Failed to set consent:', error);
    }
  }

  /**
   * Convenience methods for common ACES.fun events
   */
  public trackCanvasInteraction(
    interactionType: 'click' | 'drag' | 'zoom' | 'hover',
    details?: ClarityEventProperties,
  ): void {
    this.trackEvent(`canvas_${interactionType}`, {
      category: 'canvas_interaction',
      ...details,
    });
  }

  public trackImageView(imageId: string, viewDuration?: number): void {
    this.trackEvent('image_viewed', {
      category: 'image_interaction',
      image_id: imageId,
      view_duration_ms: viewDuration,
    });
  }

  public trackNavigationEvent(from: string, to: string): void {
    this.trackEvent('page_navigation', {
      category: 'navigation',
      from_page: from,
      to_page: to,
    });
  }

  public trackTokenInteraction(action: 'hover' | 'click' | 'create_attempt'): void {
    this.trackEvent(`token_${action}`, {
      category: 'token_interaction',
    });
  }

  public trackPerformanceIssue(issueType: string, details?: ClarityEventProperties): void {
    this.trackEvent('performance_issue', {
      category: 'performance',
      issue_type: issueType,
      ...details,
    });

    // Upgrade session for performance issues to get detailed recordings
    this.upgradeSession(`Performance issue: ${issueType}`);
  }

  /**
   * Debug information for development
   */
  public getDebugInfo(): object {
    return {
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      isAvailable: this.isAvailable(),
      projectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
        ? '***' + process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID.slice(-4)
        : 'not set',
      environment: process.env.NODE_ENV,
    };
  }
}

// Export singleton instance
export const clarityAnalytics = ClarityAnalytics.getInstance();

// Export convenience functions for direct use
export const trackCanvasInteraction = (
  type: 'click' | 'drag' | 'zoom' | 'hover',
  details?: ClarityEventProperties,
) => clarityAnalytics.trackCanvasInteraction(type, details);

export const trackImageView = (imageId: string, viewDuration?: number) =>
  clarityAnalytics.trackImageView(imageId, viewDuration);

export const trackNavigationEvent = (from: string, to: string) =>
  clarityAnalytics.trackNavigationEvent(from, to);

export const trackTokenInteraction = (action: 'hover' | 'click' | 'create_attempt') =>
  clarityAnalytics.trackTokenInteraction(action);

export const trackPerformanceIssue = (issueType: string, details?: ClarityEventProperties) =>
  clarityAnalytics.trackPerformanceIssue(issueType, details);

export const identifyUser = (userInfo: ClarityUserInfo) => clarityAnalytics.identifyUser(userInfo);

export const setCustomVariable = (key: string, value: string) =>
  clarityAnalytics.setCustomVariable(key, value);

export const trackEvent = (eventName: string, properties?: ClarityEventProperties) =>
  clarityAnalytics.trackEvent(eventName, properties);
