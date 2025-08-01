import type { Metadata } from 'next';
import { Libre_Caslon_Text, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '../components/error-boundary';
import { DeviceProvider } from '../contexts/device-provider';
import AppProviders from '@/components/providers/app-providers';

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-libre-caslon',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'ACES.fun',
  description: 'Tokenize your sh!t.',
  metadataBase: new URL('https://aces.fun'),
  openGraph: {
    title: 'ACES.fun',
    description: 'Tokenize your sh!t.',
    url: '/',
    siteName: 'ACES.fun',
    images: [
      {
        url: '/aces-logo.png',
        width: 800,
        height: 800,
        alt: 'ACES.fun Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACES.fun',
    description: 'Tokenize your sh!t.',
    images: [
      {
        url: '/aces-logo.png',
        width: 800,
        height: 800,
        alt: 'ACES.fun Logo',
      },
    ],
    creator: '@acesdotfun',
    site: '@acesdotfun',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/aces-logo.png',
    apple: '/aces-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />

        {/* Web3 compatibility script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                try {
                  if (!window.ethereum) {
                    // Create a complete mock with all required methods
                    window.ethereum = {
                      selectedAddress: null,
                      isConnected: () => false,
                      request: () => Promise.reject(new Error('No wallet connected')),
                      on: function(event, handler) {
                        // Mock event listener that does nothing
                        console.log('Mock ethereum.on called for event:', event);
                      },
                      removeListener: function(event, handler) {
                        // Mock remove listener that does nothing
                        console.log('Mock ethereum.removeListener called for event:', event);
                      },
                      removeAllListeners: function(event) {
                        // Mock remove all listeners
                        console.log('Mock ethereum.removeAllListeners called for event:', event);
                      }
                    };
                  } else {
                    // If window.ethereum exists but is missing methods, add them
                    if (typeof window.ethereum.on !== 'function') {
                      window.ethereum.on = function(event, handler) {
                        console.log('Added mock ethereum.on for event:', event);
                      };
                    }
                    if (typeof window.ethereum.removeListener !== 'function') {
                      window.ethereum.removeListener = function(event, handler) {
                        console.log('Added mock ethereum.removeListener for event:', event);
                      };
                    }
                    if (typeof window.ethereum.removeAllListeners !== 'function') {
                      window.ethereum.removeAllListeners = function(event) {
                        console.log('Added mock ethereum.removeAllListeners for event:', event);
                      };
                    }
                  }
                  
                  if (window.ethereum && typeof window.ethereum.selectedAddress === 'undefined') {
                    Object.defineProperty(window.ethereum, 'selectedAddress', {
                      value: null,
                      writable: true,
                      configurable: true
                    });
                  }
                } catch (error) {
                  console.warn('Web3 compatibility setup failed:', error);
                }
              }
            `,
          }}
        />

        {/* Microsoft Clarity - User Journey & Heat Map Analytics */}
        {process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || ''}");
              `,
            }}
          />
        ) : null}
      </head>
      <body
        className={`${libreCaslon.variable} ${jetbrainsMono.variable} font-system antialiased bg-black`}
      >
        <ErrorBoundary>
          <AppProviders>
            <DeviceProvider>{children}</DeviceProvider>
          </AppProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
