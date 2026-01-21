import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://aces.fun';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://acesbackend-production.up.railway.app';

  const manifest = {
    accountAssociation: {
      header:
        'eyJmaWQiOjEzNTA0MzAsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg1M2VCNzc0Njc1QTllRWM4MGIxMzU5ODg5NzIzOThjMjYxZDFmZDk4In0',
      payload: 'eyJkb21haW4iOiJhY2VzLmZ1biJ9',
      signature:
        'QavHHEcrfdPcgxDvW2mWJrJQ/XNzQLQCBTINQL0hNbsn98mcdgsXEgDHbw01fxIL9pTdZ90qNEBHAYHgACdoARs=',
    },
    miniapp: {
      version: '1',
      name: 'ACES.fun',
      homeUrl: baseUrl,
      iconUrl: `${baseUrl}/aces-preview-logo.png`,
      splashImageUrl: `${baseUrl}/aces-preview-logo.png`,
      splashBackgroundColor: '#000000',
      webhookUrl: `${apiUrl}/api/v1/farcaster/webhook`,
      subtitle: 'Trade Tokenized Collectibles',
      description:
        'Trade tokenized real-world collectibles on Base. Buy, sell, and trade unique tokenized assets.',
      screenshotUrls: [
        'https://aces.fun/screenshots/shot-1.webp',
        'https://aces.fun/screenshots/shot-2.webp',
        'https://aces.fun/screenshots/shot-3.webp',
      ],
      primaryCategory: 'finance',
      tags: ['collectibles', 'trading', 'base', 'rwa', 'tokenization', 'shopping'],
      heroImageUrl: `${baseUrl}/aces-preview-logo.png`,
      tagline: 'Trade Tokenized Collectibles',
      ogTitle: 'ACES.fun',
      ogDescription: 'Trade Tokenized Collectibles on Base',
      ogImageUrl: `${baseUrl}/aces-preview-logo.png`,
      noindex: false,
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
