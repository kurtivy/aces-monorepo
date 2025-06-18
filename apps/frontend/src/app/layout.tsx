import type { Metadata } from 'next';
import { Syne, Spectral, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '../components/error-boundary';

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
});

const spectral = Spectral({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-spectral',
  weight: ['200', '300', '400', '500', '600', '700', '800'],
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

        {/* FIX: Brave mobile Web3 compatibility - prevent ethereum injection errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent Brave mobile Web3 injection errors
              if (typeof window !== 'undefined') {
                try {
                  // If window.ethereum doesn't exist, create a minimal stub to prevent errors
                  if (!window.ethereum) {
                    window.ethereum = {
                      selectedAddress: null,
                      isConnected: () => false,
                      request: () => Promise.reject(new Error('No wallet connected')),
                    };
                  }
                  
                  // Prevent assignment errors by making selectedAddress writable
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
      </head>
      <body
        className={`${syne.variable} ${spectral.variable} ${jetbrainsMono.variable} font-spectral antialiased  bg-black`}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
