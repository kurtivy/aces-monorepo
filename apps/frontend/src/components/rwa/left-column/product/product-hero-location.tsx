'use client';

import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface ProductHeroLocationProps {
  listing?: {
    imageGallery?: string[];
    location?: string | null;
    title?: string;
  } | null;
}

export default function ProductHeroLocation({ listing }: ProductHeroLocationProps) {
  // Get the first image from the gallery or use fallback
  const heroImage =
    listing?.imageGallery?.[0] ||
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg';
  const imageAlt = listing?.title ? `${listing.title} - Hero Image` : 'Asset - Hero Image';

  // Get location or use fallback
  const location = listing?.location || 'Worldwide';

  return (
    <div className="h-full flex flex-col">
      {/* Hero Image */}
      <div className="flex-shrink-0">
        <div className="relative bg-[#151c16] rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src={getValidImageSrc(
              heroImage,
              'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
              { width: 500, height: 300, text: 'Product Image' }
            )}
            alt={imageAlt}
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={500}
            height={300}
            onError={createImageErrorHandler({
              fallbackText: 'Product Image',
              width: 500,
              height: 300,
              onError: (src) => {
                console.error('Hero image failed to load:', src);
              },
              maxRetries: 2,
            })}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* Location Sections */}
      <div className="flex-1 space-y-3">
        <div className="bg-[#151c16] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-[#DCDDCC] text-sm font-medium">Location:</span>
            <span className="text-white text-sm font-semibold">{location}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
