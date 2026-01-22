'use client';

import InfiniteCanvas from '../components/canvas/infinite-canvas';
import { CanvasErrorBoundary } from '../components/canvas-error-boundary';
import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function Home() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <main className="w-full h-screen bg-black">
      <CanvasErrorBoundary>
        <InfiniteCanvas />
      </CanvasErrorBoundary>
    </main>
  );
}
