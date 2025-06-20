/**
 * Simplified Animation Utilities
 *
 * Since Safari viewport culling solved the main performance issue,
 * we only need basic canvas quality adjustment during interactions.
 */

/**
 * Simple interaction-aware canvas quality
 * Reduces quality slightly during user interactions for smoother performance
 */
export function getInteractionCanvasQuality(): number {
  // For now, always return full quality since viewport culling solved the main Safari issue
  // This can be enhanced later if needed for specific interaction scenarios
  return 1.0;
}

// Global exports for testing compatibility (can be removed in production)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).getInteractionCanvasQuality =
    getInteractionCanvasQuality;

  // Minimal debug object for testing script compatibility
  (window as unknown as Record<string, unknown>).animationCoordinator = {
    getInteractionState: () => ({
      isUserInteracting: false,
      interactionType: 'none',
      lastInteractionTime: 0,
    }),
    getAnimationTiming: (priority: 'critical' | 'standard' | 'background') => ({
      targetFPS: 60,
      frameInterval: 16.67,
      shouldThrottle: false,
      priority,
    }),
    shouldDisableBackgroundAnimations: () => false,
    getCurrentFrameRate: () => 'high',
  };

  // Stub functions for test script compatibility
  (window as unknown as Record<string, unknown>).updateInteractionState = () => {};
  (window as unknown as Record<string, unknown>).shouldRunAnimationFrame = () => true;
  (window as unknown as Record<string, unknown>).shouldDisableBackgroundAnimations = () => false;
  (window as unknown as Record<string, unknown>).getTouchSensitivityMultiplier = () => 1.0;
}
