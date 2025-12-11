import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://aces.fun';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://acesbackend-production.up.railway.app';

  const manifest = {
    accountAssociation: {
      // To be filled after signing via Base Build Account Association Tool
      header: '',
      payload: '',
      signature: '',
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
        // TODO: Add 3 screenshot URLs after deployment
      ],
      primaryCategory: 'social',
      tags: ['collectibles', 'trading', 'base', 'rwa', 'tokenization'],
      heroImageUrl: `${baseUrl}/aces-preview-logo.png`,
      tagline: 'Trade Tokenized Collectibles',
      ogTitle: 'ACES.fun',
      ogDescription: 'Trade Tokenized Collectibles on Base',
      ogImageUrl: `${baseUrl}/aces-preview-logo.png`,
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
