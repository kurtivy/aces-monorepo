import { useState, useCallback, useEffect } from 'react';
import { trackStreamWindowEvent } from '@/lib/utils/analytics';

interface WindowState {
  isOpen: boolean;
  windowRef: Window | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface UseStreamWindowReturn {
  isOpen: boolean;
  openWindow: (channelName: string) => void;
  closeWindow: () => void;
}

export function useStreamWindow(): UseStreamWindowReturn {
  const [windowState, setWindowState] = useState<WindowState>({
    isOpen: false,
    windowRef: null,
    position: {
      x: typeof window !== 'undefined' ? window.innerWidth * 0.75 : 1200,
      y: 50,
    },
    size: {
      width: typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.25) : 400,
      height: typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.6) : 600,
    },
  });

  const checkWindowClosed = useCallback(() => {
    if (windowState.windowRef && windowState.windowRef.closed) {
      setWindowState((prev) => ({ ...prev, isOpen: false, windowRef: null }));

      // Analytics tracking
      trackStreamWindowEvent('closed', { windowState });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      fetch(`${apiUrl}/api/v1/twitch/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'window_closed',
          windowState: windowState,
          timestamp: new Date().toISOString(),
        }),
      }).catch((error) => {
        console.error('Failed to track window close analytics:', error);
      });
    }
  }, [windowState]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (windowState.isOpen && windowState.windowRef) {
      interval = setInterval(checkWindowClosed, 1000);
    }
    return () => clearInterval(interval);
  }, [windowState.isOpen, windowState.windowRef, checkWindowClosed]);

  const openWindow = useCallback(
    (channelName: string) => {
      if (typeof window === 'undefined') {
        console.error('Window is not available (SSR)');
        return;
      }

      if (windowState.windowRef && !windowState.windowRef.closed) {
        windowState.windowRef.focus();
        return;
      }

      const newWindow = window.open(
        '',
        'twitchStream',
        `width=${windowState.size.width},height=${windowState.size.height},left=${windowState.position.x},top=${windowState.position.y},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`,
      );

      if (newWindow) {
        // Create the Twitch embed HTML
        newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Live Stream</title>
          <script src="https://embed.twitch.tv/embed/v1.js"></script>
          <style>
            body { margin: 0; padding: 0; background: #000; font-family: Arial, sans-serif; }
            .container { display: flex; height: 100vh; }
            .stream-container { flex: 2; }
            .chat-container { flex: 1; min-width: 300px; }
            .header { background: #9147ff; color: white; padding: 8px 12px; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">🔴 Live Stream</div>
          <div class="container">
            <div class="stream-container">
              <div id="twitch-embed"></div>
            </div>
            <div class="chat-container">
              <iframe
                src="https://www.twitch.tv/embed/${channelName}/chat?parent=${window.location.hostname}"
                height="100%"
                width="100%"
                frameborder="0">
              </iframe>
            </div>
          </div>
          <script>
            new Twitch.Embed("twitch-embed", {
              width: "100%",
              height: "calc(100% - 40px)",
              channel: "${channelName}",
              parent: ["${window.location.hostname}"]
            });
          </script>
        </body>
        </html>
      `);

        setWindowState((prev) => ({ ...prev, isOpen: true, windowRef: newWindow }));

        // Analytics tracking
        trackStreamWindowEvent('opened', { windowState: { ...windowState, isOpen: true } });

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        fetch(`${apiUrl}/api/v1/twitch/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'window_opened',
            windowState: { ...windowState, isOpen: true },
            timestamp: new Date().toISOString(),
          }),
        }).catch((error) => {
          console.error('Failed to track window open analytics:', error);
        });
      }
    },
    [windowState],
  );

  const closeWindow = useCallback(() => {
    if (windowState.windowRef) {
      windowState.windowRef.close();
      setWindowState((prev) => ({ ...prev, isOpen: false, windowRef: null }));
    }
  }, [windowState.windowRef]);

  return {
    isOpen: windowState.isOpen,
    openWindow,
    closeWindow,
  };
}
