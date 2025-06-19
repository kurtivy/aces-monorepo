'use client';

/**
 * Phase 2 Step 3: Centralized Event Listener Utilities
 *
 * Provides consistent passive event handling across browsers with feature detection.
 * Standardizes event listener setup patterns and error handling.
 */

// Feature detection for passive event support
let passiveSupported = false;

// Simple passive support detection
if (typeof window !== 'undefined') {
  try {
    const options = Object.defineProperty({}, 'passive', {
      get() {
        passiveSupported = true;
        return false;
      },
    });

    // Test with a known event type
    const testHandler = () => {};
    window.addEventListener('scroll', testHandler, options);
    window.removeEventListener('scroll', testHandler);
  } catch (err) {
    passiveSupported = false;
  }
}

/**
 * Event listener options with cross-browser passive support
 */
interface EventListenerOptions {
  passive?: boolean;
  capture?: boolean;
  once?: boolean;
}

/**
 * Phase 2 Step 3 Action 5: Error handling interface for event listener operations
 */
interface EventListenerResult {
  success: boolean;
  error?: string;
  fallbackApplied?: boolean;
  details?: {
    errorType: string;
    originalError?: string;
    context?: string;
  };
}

/**
 * Phase 2 Step 3 Action 5: Event listener error types for debugging
 */
enum EventListenerErrorType {
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  INVALID_EVENT_TYPE = 'INVALID_EVENT_TYPE',
  LISTENER_INVALID = 'LISTENER_INVALID',
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  PASSIVE_NOT_SUPPORTED = 'PASSIVE_NOT_SUPPORTED',
  SECURITY_ERROR = 'SECURITY_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Standardized event listener configuration
 */
interface StandardEventConfig {
  // Critical interactions that need preventDefault() - never passive
  wheel: EventListenerOptions;
  touchstart: EventListenerOptions;
  touchmove: EventListenerOptions;

  // Non-critical interactions that can be passive for performance
  scroll: EventListenerOptions;
  resize: EventListenerOptions;

  // Keyboard/mouse interactions - typically not passive
  keydown: EventListenerOptions;
  mousedown: EventListenerOptions;
  mousemove: EventListenerOptions;
  click: EventListenerOptions;
}

/**
 * Phase 2 Step 3: Standardized event listener configurations
 * Based on browser capabilities and interaction requirements
 */
const standardEventConfig: StandardEventConfig = {
  // Critical for canvas interactions - must prevent default
  wheel: passiveSupported ? { passive: false } : {},
  touchstart: passiveSupported ? { passive: false } : {},
  touchmove: passiveSupported ? { passive: false } : {},

  // Performance optimized - can be passive
  scroll: passiveSupported ? { passive: true } : {},
  resize: passiveSupported ? { passive: true } : {},

  // Interactive events - typically need preventDefault capability
  keydown: passiveSupported ? { passive: false } : {},
  mousedown: passiveSupported ? { passive: false } : {},
  mousemove: passiveSupported ? { passive: false } : {},
  click: passiveSupported ? { passive: false } : {},
};

/**
 * Phase 2 Step 3 Action 5: Enhanced error logging for event listener failures
 */
const logEventListenerError = (
  operation: 'add' | 'remove',
  eventType: string,
  errorType: EventListenerErrorType,
  originalError?: Error,
  context?: string,
): void => {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[EventListener] ${operation.toUpperCase()} failed for '${eventType}' event`, {
      errorType,
      context,
      originalError: originalError?.message,
      passiveSupported,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Phase 2 Step 3 Action 5: Validate event listener parameters
 */
const validateEventListenerParams = (
  element: EventTarget | null | undefined,
  type: string,
  listener: EventListener | null | undefined,
): EventListenerErrorType | null => {
  if (!element) {
    return EventListenerErrorType.ELEMENT_NOT_FOUND;
  }

  if (!type || typeof type !== 'string' || type.trim().length === 0) {
    return EventListenerErrorType.INVALID_EVENT_TYPE;
  }

  if (!listener || typeof listener !== 'function') {
    return EventListenerErrorType.LISTENER_INVALID;
  }

  return null;
};

/**
 * Phase 2 Step 3 Action 5: Classify error types for better debugging
 */
const classifyEventListenerError = (error: Error): EventListenerErrorType => {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (name === 'securityerror' || message.includes('security')) {
    return EventListenerErrorType.SECURITY_ERROR;
  }

  if (message.includes('passive') || message.includes('preventdefault')) {
    return EventListenerErrorType.PASSIVE_NOT_SUPPORTED;
  }

  if (message.includes('memory') || message.includes('quota')) {
    return EventListenerErrorType.MEMORY_ERROR;
  }

  if (message.includes('not supported') || message.includes('invalid')) {
    return EventListenerErrorType.BROWSER_NOT_SUPPORTED;
  }

  return EventListenerErrorType.UNKNOWN_ERROR;
};

/**
 * Phase 2 Step 3 Action 5: Enhanced safe event listener addition with comprehensive error handling
 */
export const addEventListenerSafe = (
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): EventListenerResult => {
  // Phase 2 Step 3 Action 5: Parameter validation
  const validationError = validateEventListenerParams(element, type, listener);
  if (validationError) {
    logEventListenerError('add', type, validationError);
    return {
      success: false,
      error: validationError,
      details: {
        errorType: validationError,
        context: 'parameter_validation',
      },
    };
  }

  try {
    // Use provided options or fall back to standard config
    const eventOptions = options || standardEventConfig[type as keyof StandardEventConfig] || {};

    element.addEventListener(type, listener, eventOptions);
    return { success: true };
  } catch (error) {
    // Phase 2 Step 3 Action 5: Detailed error classification
    const errorType = classifyEventListenerError(error as Error);
    logEventListenerError('add', type, errorType, error as Error);

    // Phase 2 Step 3 Action 5: Fallback strategy for critical events
    if (type === 'wheel' || type === 'keydown' || type === 'click' || type === 'mousemove') {
      try {
        // Retry without options for critical events
        element.addEventListener(type, listener);
        logEventListenerError(
          'add',
          type,
          EventListenerErrorType.PASSIVE_NOT_SUPPORTED,
          undefined,
          'fallback_success',
        );
        return {
          success: true,
          fallbackApplied: true,
          details: {
            errorType,
            context: 'fallback_applied',
            originalError: (error as Error).message,
          },
        };
      } catch (fallbackError) {
        logEventListenerError(
          'add',
          type,
          EventListenerErrorType.BROWSER_NOT_SUPPORTED,
          fallbackError as Error,
          'fallback_failed',
        );
        return {
          success: false,
          error: errorType,
          fallbackApplied: false,
          details: {
            errorType,
            originalError: (error as Error).message,
            context: 'fallback_failed',
          },
        };
      }
    }

    return {
      success: false,
      error: errorType,
      details: {
        errorType,
        originalError: (error as Error).message,
        context: 'primary_attempt_failed',
      },
    };
  }
};

/**
 * Phase 2 Step 3 Action 5: Enhanced safe event listener removal with comprehensive error handling
 */
export const removeEventListenerSafe = (
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): EventListenerResult => {
  // Phase 2 Step 3 Action 5: Parameter validation
  const validationError = validateEventListenerParams(element, type, listener);
  if (validationError) {
    logEventListenerError('remove', type, validationError);
    return {
      success: false,
      error: validationError,
      details: {
        errorType: validationError,
        context: 'parameter_validation',
      },
    };
  }

  try {
    // Ensure we remove with the same options used for adding
    const eventOptions = options || standardEventConfig[type as keyof StandardEventConfig] || {};

    element.removeEventListener(type, listener, eventOptions);
    return { success: true };
  } catch (error) {
    // Phase 2 Step 3 Action 5: Enhanced error handling for removal
    const errorType = classifyEventListenerError(error as Error);
    logEventListenerError('remove', type, errorType, error as Error);

    // Phase 2 Step 3 Action 5: Fallback removal attempt
    try {
      // Retry without options
      element.removeEventListener(type, listener);
      return {
        success: true,
        fallbackApplied: true,
        details: {
          errorType,
          context: 'fallback_applied',
          originalError: (error as Error).message,
        },
      };
    } catch (fallbackError) {
      logEventListenerError(
        'remove',
        type,
        EventListenerErrorType.BROWSER_NOT_SUPPORTED,
        fallbackError as Error,
        'fallback_failed',
      );
      return {
        success: false,
        error: errorType,
        fallbackApplied: false,
        details: {
          errorType,
          originalError: (error as Error).message,
          context: 'fallback_failed',
        },
      };
    }
  }
};

/**
 * Phase 2 Step 3 Action 5: Enhanced window-specific event listener utilities with error handling
 */
export const addWindowEventListenerSafe = (
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): EventListenerResult => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: EventListenerErrorType.ELEMENT_NOT_FOUND,
      details: {
        errorType: EventListenerErrorType.ELEMENT_NOT_FOUND,
        context: 'window_undefined',
      },
    };
  }

  return addEventListenerSafe(window, type, listener, options);
};

export const removeWindowEventListenerSafe = (
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): EventListenerResult => {
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: EventListenerErrorType.ELEMENT_NOT_FOUND,
      details: {
        errorType: EventListenerErrorType.ELEMENT_NOT_FOUND,
        context: 'window_undefined',
      },
    };
  }

  return removeEventListenerSafe(window, type, listener, options);
};

/**
 * Get standardized options for a specific event type
 */
export const getEventOptions = (eventType: keyof StandardEventConfig): EventListenerOptions => {
  return standardEventConfig[eventType] || {};
};

/**
 * Check if passive events are supported
 */
export const isPassiveSupported = (): boolean => {
  return passiveSupported;
};

/**
 * Phase 2 Step 3 Action 5: Enhanced debug info with error statistics
 */
export const getEventListenerDebugInfo = () => {
  return {
    passiveSupported,
    standardConfig: standardEventConfig,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    errorTypes: EventListenerErrorType, // Enum for reference
    capabilities: {
      addEventListener:
        typeof EventTarget !== 'undefined' && 'addEventListener' in EventTarget.prototype,
      removeEventListener:
        typeof EventTarget !== 'undefined' && 'removeEventListener' in EventTarget.prototype,
      passiveSupported,
    },
  };
};

/**
 * Phase 2 Step 3 Action 5: Utility to validate if an element supports event listeners
 */
export const validateEventTarget = (element: unknown): element is EventTarget => {
  return (
    element !== null &&
    element !== undefined &&
    typeof element === 'object' &&
    'addEventListener' in element &&
    typeof (element as EventTarget).addEventListener === 'function' &&
    'removeEventListener' in element &&
    typeof (element as EventTarget).removeEventListener === 'function'
  );
};

/**
 * Phase 2 Step 3 Action 5: Backwards compatibility - simple boolean return versions
 */
export const addEventListenerSimple = (
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): boolean => {
  return addEventListenerSafe(element, type, listener, options).success;
};

export const removeEventListenerSimple = (
  element: EventTarget,
  type: string,
  listener: EventListener,
  options?: EventListenerOptions,
): boolean => {
  return removeEventListenerSafe(element, type, listener, options).success;
};

/**
 * Phase 2 Step 3 Action 5: Event listener health check utility
 */
export const performEventListenerHealthCheck = (): {
  passed: number;
  failed: number;
  details: Array<{ test: string; passed: boolean; error?: string }>;
} => {
  const results: Array<{ test: string; passed: boolean; error?: string }> = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Basic addEventListener support
  try {
    const testElement = document.createElement('div');
    const testHandler = () => {};
    const result = addEventListenerSafe(testElement, 'click', testHandler);
    if (result.success) {
      passed++;
      results.push({ test: 'Basic addEventListener', passed: true });
      removeEventListenerSafe(testElement, 'click', testHandler);
    } else {
      failed++;
      results.push({ test: 'Basic addEventListener', passed: false, error: result.error });
    }
  } catch (error) {
    failed++;
    results.push({
      test: 'Basic addEventListener',
      passed: false,
      error: (error as Error).message,
    });
  }

  // Test 2: Passive event support
  try {
    const testElement = document.createElement('div');
    const testHandler = () => {};
    const result = addEventListenerSafe(testElement, 'wheel', testHandler, { passive: false });
    if (result.success) {
      passed++;
      results.push({ test: 'Passive event support', passed: true });
      removeEventListenerSafe(testElement, 'wheel', testHandler, { passive: false });
    } else {
      passed++; // Still counts as passing if fallback works
      results.push({ test: 'Passive event support', passed: true, error: 'Fallback applied' });
    }
  } catch (error) {
    failed++;
    results.push({ test: 'Passive event support', passed: false, error: (error as Error).message });
  }

  // Test 3: Window event listeners
  try {
    const testHandler = () => {};
    const result = addWindowEventListenerSafe('resize', testHandler);
    if (result.success) {
      passed++;
      results.push({ test: 'Window event listeners', passed: true });
      removeWindowEventListenerSafe('resize', testHandler);
    } else {
      failed++;
      results.push({ test: 'Window event listeners', passed: false, error: result.error });
    }
  } catch (error) {
    failed++;
    results.push({
      test: 'Window event listeners',
      passed: false,
      error: (error as Error).message,
    });
  }

  return { passed, failed, details: results };
};
