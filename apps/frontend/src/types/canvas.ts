export interface ImageInfo {
  element: HTMLImageElement | HTMLVideoElement; // Support both images and videos
  type: 'square' | 'landscape' | 'portrait' | 'submit-asset';
  displayWidth: number;
  displayHeight: number;
  isVideo?: boolean; // Flag to indicate if this is a video element
  metadata: {
    id?: string;
    title: string;
    symbol?: string; // RWA page route symbol (e.g., 'APKAWS')
    description: string;
    date?: string;
    countdownDate?: string; // ISO date string for countdown timer
    ticker?: string;
    image?: string;
    rrp?: number; // Recommended Retail Price (USD)
    tokenPrice?: number; // Hypothetical token price in USDT
    marketCap?: number; // Hypothetical market capitalization in USDT
    tokenSupply?: number; // Total supply of tokens for the asset
  };
}

export interface ViewState {
  x: number;
  y: number;
  scale: number;
  targetX: number;
  targetY: number;
  targetScale: number;
}
