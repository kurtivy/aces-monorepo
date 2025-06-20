'use client';

import InfiniteCanvas from '../components/canvas/infinite-canvas';
import { CanvasErrorBoundary } from '../components/canvas-error-boundary';

export default function Home() {
  return (
    <main className="w-full h-screen bg-black">
      <CanvasErrorBoundary>
        <InfiniteCanvas />
      </CanvasErrorBoundary>
    </main>
  );
}
