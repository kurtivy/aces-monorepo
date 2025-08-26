import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ace of Base | ACES TOKEN LAUNCH',
  description: 'Ace of Base | ACES TOKEN LAUNCH',
  metadataBase: new URL('https://www.aceofbase.fun'),
  openGraph: {
    title: 'ACES TOKEN LAUNCH - Buy $ACES Now',
    description:
      'Join the ACES TOKEN LAUNCH. Buy $ACES tokens and participate in the future of luxury asset tokenization.',
    url: '/',
    siteName: 'ACES TOKEN LAUNCH',
    images: [
      {
        url: '/aceofbase.svg',
        width: 800,
        height: 800,
        alt: 'ACES TOKEN LAUNCH Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACES TOKEN LAUNCH - Buy $ACES Now',
    description:
      'Join the ACES TOKEN LAUNCH. Buy $ACES tokens and participate in the future of luxury asset tokenization.',
    images: [
      {
        url: '/aceofbase.svg',
        width: 800,
        height: 800,
        alt: 'ACES TOKEN LAUNCH Logo',
      },
    ],
  },
  icons: {
    icon: [
      { url: '/aceofbase-favicon.ico' },
      { url: '/aceofbase-favicon.ico', sizes: '16x16', type: 'image/x-icon' },
      { url: '/aceofbase-favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    shortcut: '/aceofbase-favicon.ico',
    apple: '/aceofbase-favicon.ico',
  },
  keywords: [
    'ACES',
    'TOKEN',
    'ICO',
    'cryptocurrency',
    'blockchain',
    'luxury assets',
    'tokenization',
    'investment',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function AceofbaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
