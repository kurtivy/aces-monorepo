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
      x: typeof window !== 'undefined' ? Math.floor(window.screen.width * 0.1) : 100,
      y: typeof window !== 'undefined' ? Math.floor(window.screen.height * 0.1) : 100,
    },
    size: {
      // Much larger default size - 80% of screen width and 80% of screen height
      width: typeof window !== 'undefined' ? Math.floor(window.screen.width * 0.8) : 1200,
      height: typeof window !== 'undefined' ? Math.floor(window.screen.height * 0.8) : 800,
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
        // Create the Twitch embed HTML with improved styling
        newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>🔴 ${channelName} - Live Stream</title>
          <script src="https://embed.twitch.tv/embed/v1.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              background: #0e0e10;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              overflow: hidden;
            }
            
            .header {
              background: linear-gradient(135deg, #9147ff 0%, #772ce8 100%);
              color: white;
              padding: 12px 16px;
              font-size: 16px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
              position: relative;
              z-index: 10;
            }
            
            .live-indicator {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: rgba(255, 255, 255, 0.2);
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 700;
            }
            
            .live-dot {
              width: 8px;
              height: 8px;
              background: #ff4444;
              border-radius: 50%;
              animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.1); }
            }
            
            .container {
              display: flex;
              height: calc(100vh - 44px);
              background: #0e0e10;
            }
            
            .stream-container {
              flex: 1;
              min-width: 0;
              background: #000;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .chat-container {
              width: 340px;
              min-width: 340px;
              max-width: 400px;
              background: #18181b;
              border-left: 1px solid #2d2d35;
              display: flex;
              flex-direction: column;
            }
            
            .chat-header {
              background: #18181b;
              color: #efeff1;
              padding: 10px 16px;
              font-size: 14px;
              font-weight: 600;
              border-bottom: 1px solid #2d2d35;
            }
            
            .chat-iframe-wrapper {
              flex: 1;
              position: relative;
              overflow: hidden;
            }
            
            #twitch-embed {
              width: 100%;
              height: 100%;
            }
            
            iframe {
              border: none;
            }
            
            /* Responsive adjustments */
            @media (max-width: 900px) {
              .chat-container {
                width: 300px;
                min-width: 300px;
              }
            }
            
            @media (max-width: 700px) {
              .container {
                flex-direction: column;
              }
              
              .chat-container {
                width: 100%;
                max-width: 100%;
                height: 300px;
                border-left: none;
                border-top: 1px solid #2d2d35;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="live-indicator">
              <span class="live-dot"></span>
              LIVE
            </div>
            <span>${channelName}</span>
          </div>
          
          <div class="container">
            <div class="stream-container">
              <div id="twitch-embed"></div>
            </div>
            
            <div class="chat-container">
              <div class="chat-header">Stream Chat</div>
              <div class="chat-iframe-wrapper">
                <iframe
                  src="https://www.twitch.tv/embed/${channelName}/chat?parent=${window.location.hostname}&darkpopout"
                  height="100%"
                  width="100%">
                </iframe>
              </div>
            </div>
          </div>
          
          <script>
            new Twitch.Embed("twitch-embed", {
              width: "100%",
              height: "100%",
              channel: "${channelName}",
              layout: "video",
              autoplay: true,
              muted: false,
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
            channelName: channelName,
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
