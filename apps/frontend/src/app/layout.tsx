import type { Metadata } from 'next';
import './globals.css';
import ErrorBoundary from '../components/error-boundary';
import { DeviceProvider } from '../contexts/device-provider';
import AppProviders from '@/components/providers/app-providers';
import { fontVariables } from '@/lib/fonts';

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

        {/* Microsoft Clarity - User Journey & Heat Map Analytics */}
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
              `,
            }}
          />
        )}

        {/* Google Analytics - Website Analytics */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`${fontVariables} font-body antialiased bg-black`}>
        <ErrorBoundary>
          <AppProviders>
            <DeviceProvider>{children}</DeviceProvider>
          </AppProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}
