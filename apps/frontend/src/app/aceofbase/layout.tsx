import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ace of Base',
  description: 'Ace of Base',
  metadataBase: new URL('https://www.aceofbase.fun'),
  openGraph: {
    title: 'ACES TOKEN IPO - Buy $ACES Now',
    description:
      'Join the ACES TOKEN IPO. Buy $ACES tokens and participate in the future of luxury asset tokenization.',
    url: '/',
    siteName: 'ACES TOKEN IPO',
    images: [
      {
        url: '/aceofbase.svg',
        width: 800,
        height: 800,
        alt: 'ACES TOKEN IPO Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACES TOKEN IPO - Buy $ACES Now',
    description:
      'Join the ACES TOKEN IPO. Buy $ACES tokens and participate in the future of luxury asset tokenization.',
    images: [
      {
        url: '/aceofbase.svg',
        width: 800,
        height: 800,
        alt: 'ACES TOKEN IPO Logo',
      },
    ],
  },
  icons: {
    icon: '/aceofbase-favicon.ico',
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
