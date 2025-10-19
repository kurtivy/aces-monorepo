import type { Metadata } from 'next';

interface RwaSymbolLayoutProps {
  children: React.ReactNode;
  params: { symbol: string };
}

type ListingResponse = {
  success: boolean;
  data?: {
    title?: string;
    symbol?: string;
    description?: string;
    imageGallery?: string[];
  };
  error?: string;
};

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return 'https://acesbackend-production.up.railway.app';
}

function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return 'https://aces.fun/aces-preview-logo.png';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  // assume leading slash static asset
  return `https://aces.fun${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export async function generateMetadata({
  params,
}: {
  params: { symbol: string };
}): Promise<Metadata> {
  const symbol = (params.symbol || '').trim();
  const apiBase = getApiBaseUrl();

  let title = 'ACES.fun';
  let description = 'Trade Tokenized Collectibles';
  let imageUrl = 'https://aces.fun/aces-preview-logo.png';

  try {
    const res = await fetch(`${apiBase}/api/v1/listings/symbol/${encodeURIComponent(symbol)}`, {
      // Ensure fresh fetch on crawl
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = (await res.json()) as ListingResponse;
      if (json.success && json.data) {
        const data = json.data;
        title = data.title
          ? `${data.title} (${data.symbol || symbol}) · ACES.fun`
          : `ACES.fun · ${symbol}`;
        if (data.description) description = data.description;
        const firstImage =
          Array.isArray(data.imageGallery) && data.imageGallery.length > 0
            ? data.imageGallery[0]
            : undefined;
        if (firstImage) imageUrl = toAbsoluteUrl(firstImage);
      }
    }
  } catch {
    // Use defaults on failure
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/rwa/${symbol}`,
      siteName: 'ACES.fun',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: imageUrl,
          alt: title,
        },
      ],
      creator: '@acesdotfun',
      site: '@acesdotfun',
    },
  };
}

export default function RwaSymbolLayout({ children }: RwaSymbolLayoutProps) {
  return children;
}
