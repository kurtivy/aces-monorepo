'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface AssetAboutDetailsV2Props {
  title: string;
  description?: string | null;
  images?: string[] | null;
}

export function AssetAboutDetailsV2({ title, description, images }: AssetAboutDetailsV2Props) {
  const galleryImages = useMemo(
    () =>
      (images ?? [])
        .filter((src): src is string => Boolean(src && src.trim()))
        .map((src, index) => ({
          src,
          alt: `${title || 'Asset'} image ${index + 1}`,
        })),
    [images, title],
  );

  const hasDescription = Boolean(description && description.trim().length > 0);
  const primaryImage = galleryImages[0];

  return (
    <div className="rounded-lg border border-[#D0B284]/15 bg-[#151c16] p-2">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch">
        <div className="lg:w-1/2 lg:flex">
          <div className="relative flex-1 min-h-[280px] lg:min-h-[320px] rounded-xl border border-[#D0B284]/20 bg-[#151c16]/40 overflow-hidden">
            {primaryImage ? (
              <Image
                src={getValidImageSrc(primaryImage.src, undefined, {
                  width: 800,
                  height: 600,
                  text: 'Image error',
                })}
                alt={primaryImage.alt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                unoptimized={primaryImage.src.includes('storage.googleapis.com')}
                onError={createImageErrorHandler({
                  fallbackText: 'Image',
                  width: 800,
                  height: 600,
                })}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8F9B8F] text-sm">
                No images available
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-1/2 flex flex-col gap-4 min-h-[320px]">
          <div>
            <h2 className="text-lg font-semibold text-white font-neue-world uppercase tracking-wide">
              About This Asset
            </h2>
          </div>

          {hasDescription ? (
            <div className="text-sm md:text-base leading-relaxed text-white whitespace-pre-wrap font-proxima-nova">
              {description}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-[#D0B284]/20 rounded-lg p-6">
              <div className="text-[#DCDDCC] text-base md:text-lg">
                No description available yet
              </div>
              <div className="text-[#8F9B8F] text-xs md:text-sm mt-2">
                Details will be provided once the asset listing is finalized.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
