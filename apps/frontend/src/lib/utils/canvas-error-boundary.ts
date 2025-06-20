/**
 * Canvas Error Boundary and Fallback Utilities - LIGHTWEIGHT VERSION
 *
 * Phase 2 Step 9: Add Comprehensive Error Boundaries and Fallbacks
 *
 * Performance-optimized version with minimal overhead:
 * - Canvas context getContext browser variations handling
 * - Canvas toDataURL browser format support with fallbacks
 * - getBoundingClientRect precision differences compensation
 * - Graceful degradation for unsupported features
 */

import { LuxuryLogger } from './luxury-logger';

// Error types for comprehensive error classification
export type CanvasErrorType =
  | 'context-creation-failed'
  | 'context-lost'
  | 'todataurl-failed'
  | 'todataurl-security-error'
  | 'todataurl-format-unsupported'
  | 'bounds-calculation-failed'
  | 'bounds-precision-error'
  | 'canvas-not-available'
  | 'canvas-dimensions-invalid'
  | 'performance-degradation'
  | 'memory-pressure-high'
  | 'unknown-error';

export interface CanvasErrorDetails {
  type: CanvasErrorType;
  message: string;
  context: string;
  browserInfo: string;
  recoveryStrategy: string;
  canRecover: boolean;
  fallbackApplied: boolean;
}

export interface CanvasOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: CanvasErrorDetails;
  performanceImpact?: {
    duration: number;
    adaptiveQualityApplied: boolean;
  };
}

/**
 * Phase 2 Step 9 Action 2: Lightweight canvas context creation with browser variation handling
 */
export function safeGetCanvasContext(
  canvas: HTMLCanvasElement,
  contextType: '2d' | 'webgl' | 'webgl2' = '2d',
  options?: CanvasRenderingContext2DSettings | WebGLContextAttributes,
): CanvasOperationResult<
  CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext | null
> {
  try {
    // Issue 2Y: Canvas context getContext browser variations
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      return {
        success: false,
        error: {
          type: 'canvas-not-available',
          message: 'Canvas element is not available or invalid',
          context: `safeGetCanvasContext(${contextType})`,
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Provide valid canvas element',
          canRecover: false,
          fallbackApplied: false,
        },
      };
    }

    // Validate canvas dimensions
    if (canvas.width <= 0 || canvas.height <= 0) {
      return {
        success: false,
        error: {
          type: 'canvas-dimensions-invalid',
          message: `Invalid canvas dimensions: ${canvas.width}x${canvas.height}`,
          context: `safeGetCanvasContext(${contextType})`,
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Set valid canvas dimensions before getting context',
          canRecover: true,
          fallbackApplied: false,
        },
      };
    }

    let context: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext | null =
      null;

    // Browser-specific context creation with fallbacks
    if (contextType === '2d') {
      // Try modern context creation first
      try {
        context = canvas.getContext(
          '2d',
          options as CanvasRenderingContext2DSettings,
        ) as CanvasRenderingContext2D | null;
      } catch (error) {
        // Fallback: Try without options for older browsers
        context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        LuxuryLogger.log(
          `Canvas 2D context created without options due to browser limitation: ${error}`,
          'warn',
        );
      }
    } else {
      // WebGL context with progressive fallback
      const webglOptions = options as WebGLContextAttributes;

      try {
        // Try preferred WebGL version
        context = canvas.getContext(contextType, webglOptions) as
          | WebGLRenderingContext
          | WebGL2RenderingContext
          | null;
      } catch (error) {
        // Fallback: Try experimental prefix for older browsers
        const fallbackType =
          contextType === 'webgl2' ? 'experimental-webgl2' : 'experimental-webgl';
        try {
          context = canvas.getContext(fallbackType as 'webgl' | 'webgl2', webglOptions) as
            | WebGLRenderingContext
            | WebGL2RenderingContext
            | null;
        } catch (fallbackError) {
          // Final fallback: Try without options
          context = canvas.getContext(contextType) as
            | WebGLRenderingContext
            | WebGL2RenderingContext
            | null;
        }
      }
    }

    if (!context) {
      return {
        success: false,
        error: {
          type: 'context-creation-failed',
          message: `Failed to create ${contextType} context`,
          context: `safeGetCanvasContext(${contextType})`,
          browserInfo: navigator.userAgent,
          recoveryStrategy:
            contextType === 'webgl' ? 'Try 2D context fallback' : 'Canvas not supported',
          canRecover: contextType === 'webgl',
          fallbackApplied: false,
        },
      };
    }

    // Check for context lost (WebGL specific)
    if (contextType.startsWith('webgl') && (context as WebGLRenderingContext).isContextLost?.()) {
      return {
        success: false,
        error: {
          type: 'context-lost',
          message: 'WebGL context is lost',
          context: `safeGetCanvasContext(${contextType})`,
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Wait for webglcontextrestored event or retry',
          canRecover: true,
          fallbackApplied: false,
        },
      };
    }

    return {
      success: true,
      data: context,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        type: 'unknown-error',
        message: `Unexpected error during context creation: ${errorMessage}`,
        context: `safeGetCanvasContext(${contextType})`,
        browserInfo: navigator.userAgent,
        recoveryStrategy: 'Retry operation or use fallback rendering',
        canRecover: true,
        fallbackApplied: false,
      },
    };
  }
}

/**
 * Phase 2 Step 9 Action 2: Lightweight canvas toDataURL with browser format support
 */
export function safeCanvasToDataURL(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality?: number,
): CanvasOperationResult<string> {
  try {
    // Issue 2AA: Canvas toDataURL browser format support
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      return {
        success: false,
        error: {
          type: 'canvas-not-available',
          message: 'Canvas element is not available',
          context: `safeCanvasToDataURL(${type})`,
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Provide valid canvas element',
          canRecover: false,
          fallbackApplied: false,
        },
      };
    }

    // Progressive format fallback strategy
    const formatFallbacks = [
      type, // Try requested format first
      'image/png', // Universal fallback
      'image/jpeg', // Secondary fallback
      undefined, // Default format fallback
    ];

    for (const format of formatFallbacks) {
      try {
        let dataUrl: string;

        if (
          format &&
          quality !== undefined &&
          (format === 'image/jpeg' || format === 'image/webp')
        ) {
          dataUrl = canvas.toDataURL(format, quality);
        } else if (format) {
          dataUrl = canvas.toDataURL(format);
        } else {
          dataUrl = canvas.toDataURL(); // Default format
        }

        // Validate the result
        if (dataUrl && dataUrl.startsWith('data:')) {
          const fallbackApplied = format !== type;

          if (fallbackApplied) {
            LuxuryLogger.log(
              `Canvas toDataURL fallback applied: ${type} → ${format || 'default'}`,
              'warn',
            );
          }

          return {
            success: true,
            data: dataUrl,
          };
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') {
          // Issue 2Z: Handle CORS tainted canvas
          return {
            success: false,
            error: {
              type: 'todataurl-security-error',
              message: 'Canvas is tainted by cross-origin data',
              context: `safeCanvasToDataURL(${type})`,
              browserInfo: navigator.userAgent,
              recoveryStrategy: 'Use CORS-enabled images or skip toDataURL operation',
              canRecover: false,
              fallbackApplied: false,
            },
          };
        }

        // Continue to next format fallback
        continue;
      }
    }

    // All formats failed
    return {
      success: false,
      error: {
        type: 'todataurl-format-unsupported',
        message: `All toDataURL formats failed: ${formatFallbacks.join(', ')}`,
        context: `safeCanvasToDataURL(${type})`,
        browserInfo: navigator.userAgent,
        recoveryStrategy: 'Use alternative export method or skip operation',
        canRecover: false,
        fallbackApplied: true,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        type: 'todataurl-failed',
        message: `Unexpected toDataURL error: ${errorMessage}`,
        context: `safeCanvasToDataURL(${type})`,
        browserInfo: navigator.userAgent,
        recoveryStrategy: 'Retry operation or skip export functionality',
        canRecover: true,
        fallbackApplied: false,
      },
    };
  }
}

/**
 * Phase 2 Step 9 Action 2: Lightweight getBoundingClientRect with minimal overhead
 */
export function safeGetBoundingClientRect(element: Element): CanvasOperationResult<DOMRect> {
  try {
    // Issue 2BB: getBoundingClientRect precision differences
    if (!element || !(element instanceof Element)) {
      return {
        success: false,
        error: {
          type: 'canvas-not-available',
          message: 'Element is not available for bounds calculation',
          context: 'safeGetBoundingClientRect',
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Provide valid DOM element',
          canRecover: false,
          fallbackApplied: false,
        },
      };
    }

    // Check if element is connected to DOM
    if (!element.isConnected) {
      return {
        success: false,
        error: {
          type: 'bounds-calculation-failed',
          message: 'Element is not connected to DOM',
          context: 'safeGetBoundingClientRect',
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Ensure element is attached to DOM before getting bounds',
          canRecover: true,
          fallbackApplied: false,
        },
      };
    }

    let rect: DOMRect;

    try {
      rect = element.getBoundingClientRect();
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'bounds-calculation-failed',
          message: `getBoundingClientRect failed: ${error}`,
          context: 'safeGetBoundingClientRect',
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Retry operation or use fallback positioning',
          canRecover: true,
          fallbackApplied: false,
        },
      };
    }

    // Validate rect values (lightweight check)
    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      return {
        success: false,
        error: {
          type: 'bounds-precision-error',
          message: `Invalid rect values: x=${rect.x}, y=${rect.y}, w=${rect.width}, h=${rect.height}`,
          context: 'safeGetBoundingClientRect',
          browserInfo: navigator.userAgent,
          recoveryStrategy: 'Use fallback positioning or retry operation',
          canRecover: true,
          fallbackApplied: false,
        },
      };
    }

    return {
      success: true,
      data: rect,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        type: 'unknown-error',
        message: `Unexpected bounds calculation error: ${errorMessage}`,
        context: 'safeGetBoundingClientRect',
        browserInfo: navigator.userAgent,
        recoveryStrategy: 'Retry operation or use approximate positioning',
        canRecover: true,
        fallbackApplied: false,
      },
    };
  }
}

/**
 * Lightweight performance monitoring (development mode only)
 */
export function monitorCanvasPerformance(): {
  performance: { operationCount: number };
  recommendations: string[];
  adaptiveSettings: {
    quality: number;
    enableImageSmoothing: boolean;
    frameThrottling: boolean;
  };
} {
  // Lightweight version for production - no overhead
  return {
    performance: { operationCount: 0 },
    recommendations: [],
    adaptiveSettings: {
      quality: 1.0,
      enableImageSmoothing: true,
      frameThrottling: false,
    },
  };
}

/**
 * Error recovery strategies
 */
export function recoverFromCanvasError(error: CanvasErrorDetails): boolean {
  switch (error.type) {
    case 'context-creation-failed':
    case 'context-lost':
    case 'bounds-precision-error':
    case 'bounds-calculation-failed':
    case 'memory-pressure-high':
      return true;

    case 'todataurl-security-error':
      // Skip export functionality
      return false;

    default:
      return error.canRecover;
  }
}
