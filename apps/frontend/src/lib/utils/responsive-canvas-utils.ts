import type { DeviceCapabilities } from '../../types/capabilities';

export interface ResponsiveMetrics {
  // Scaling factors
  fontScale: number;
  paddingScale: number;
  iconScale: number;
  borderScale: number;
  spacingScale: number;

  // Device context
  isMobile: boolean;
  unitSize: number;
  baseScale: number;
}

export const getResponsiveMetrics = (
  unitSize: number,
  _capabilities: DeviceCapabilities, // eslint-disable-line @typescript-eslint/no-unused-vars
): ResponsiveMetrics => {
  const isMobile = unitSize <= 150; // Use existing breakpoint logic
  const baseScale = unitSize / 200; // Desktop unitSize is 200

  if (!isMobile) {
    // Desktop: No scaling applied - preserves existing design
    return {
      fontScale: 1.0,
      paddingScale: 1.0,
      iconScale: 1.0,
      borderScale: 1.0,
      spacingScale: 1.0,
      isMobile: false,
      unitSize,
      baseScale: 1.0,
    };
  }

  // Mobile: Proportional scaling based on unitSize reduction
  // unitSize goes from 200 -> 150, so scale factor is 0.75
  const mobileScale = baseScale; // 0.75 for mobile

  return {
    fontScale: mobileScale * 0.85, // Slightly smaller fonts for readability
    paddingScale: mobileScale * 0.8, // Tighter padding
    iconScale: mobileScale * 0.8, // Smaller icons
    borderScale: Math.max(0.5, mobileScale * 0.7), // Minimum visible borders
    spacingScale: mobileScale * 0.85, // Tighter spacing
    isMobile: true,
    unitSize,
    baseScale: mobileScale,
  };
};

// Helper function for consistent mobile detection
export const getDeviceContext = (unitSize: number, capabilities: DeviceCapabilities) => {
  return {
    isMobile: unitSize <= 150,
    isMobileSafari: capabilities.safariMobileOptimizations || false,
    touchCapable: capabilities.touchCapable || false,
    performanceTier: capabilities.performanceTier || 'medium',
  };
};
