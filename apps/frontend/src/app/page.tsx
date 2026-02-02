'use client';

import InfiniteCanvas from '../components/canvas/infinite-canvas';
import { CanvasErrorBoundary } from '../components/canvas-error-boundary';
import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    sdk.actions.ready();
  }, []);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <main className="w-full h-screen bg-black" />;
  }
  return (
    <main className="w-full h-screen bg-black">
      <CanvasErrorBoundary>
        <InfiniteCanvas />
      </CanvasErrorBoundary>
    </main>
  );
}
