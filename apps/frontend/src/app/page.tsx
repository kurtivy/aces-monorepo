'use client';

import InfiniteCanvas from '../components/canvas/infinite-canvas';
import { CanvasErrorBoundary } from '../components/canvas-error-boundary';
import { useMiniAppContext } from '../hooks/use-miniapp-context';


export default function Home() {
  const { context, error, isInMiniApp, loadState, safeAreaInsets } = useMiniAppContext();
  const showDebug = process.env.NODE_ENV !== 'production';

  return (
    <main className="w-full h-screen bg-black">
      <CanvasErrorBoundary>
        <InfiniteCanvas />
      </CanvasErrorBoundary>
      {showDebug && (
        <div className="fixed bottom-3 left-3 z-50 rounded bg-black/70 px-3 py-2 text-xs text-white">
          <div>MiniApp: {isInMiniApp ? 'yes' : 'no'}</div>
          <div>Context: {loadState}</div>
          {context?.user && (
            <div>
              User: {context.user.displayName || context.user.username || `fid:${context.user.fid}`}
            </div>
          )}
          {safeAreaInsets && (
            <div>
              Insets: {safeAreaInsets.top},{safeAreaInsets.right},{safeAreaInsets.bottom},
              {safeAreaInsets.left}
            </div>
          )}
          {error && <div className="text-red-300">Error: {error}</div>}
        </div>
      )}
    </main>
  );
}
