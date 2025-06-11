export interface ImageInfo {
  element: HTMLImageElement;
  type: 'square' | 'landscape' | 'portrait' | 'create-token';
  displayWidth: number;
  displayHeight: number;
  metadata: {
    id?: string;
    title: string;
    description: string;
    date?: string;
    ticker?: string;
    image?: string;
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
