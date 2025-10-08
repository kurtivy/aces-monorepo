'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface AssetAboutDetailsV2Props {
  title: string;
  description?: string | null;
  images?: string[] | null;
}

export function AssetAboutDetailsV2({ title, description, images }: AssetAboutDetailsV2Props) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const galleryImages = useMemo(
    () =>
      (images ?? [])
        .filter((src): src is string => Boolean(src && src.trim()))
        .map((src, index) => ({
          id: index,
          src,
          alt: `${title || 'Asset'} image ${index + 1}`,
        })),
    [images, title],
  );

  useEffect(() => {
    setSelectedImageIndex((current) => {
      if (galleryImages.length === 0) {
        return 0;
      }

      return current >= galleryImages.length ? galleryImages.length - 1 : current;
    });
  }, [galleryImages.length]);

  const hasDescription = Boolean(description && description.trim().length > 0);
  const selectedImage = galleryImages[selectedImageIndex];

  return (
    <div className="rounded-lg border border-[#D0B284]/15 bg-[#151c16] p-2">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4 min-h-[320px]">
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

        <div className="flex-1 flex flex-col">
          <div className="flex items-start gap-4">
            <div className="relative flex-1 w-full aspect-[4/3] min-h-[280px] rounded-xl border border-[#D0B284]/20 bg-black/40 overflow-hidden">
              {selectedImage ? (
                <Image
                  src={getValidImageSrc(selectedImage.src, undefined, {
                    width: 800,
                    height: 600,
                    text: 'Image error',
                  })}
                  alt={selectedImage.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized={selectedImage.src.includes('storage.googleapis.com')}
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

            {galleryImages.length > 0 && (
              <div className="flex flex-col gap-2 w-20 max-h-[360px] overflow-y-auto pr-1">
                {galleryImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      'relative w-full aspect-square rounded-lg border overflow-hidden transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0B284]',
                      selectedImageIndex === index
                        ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                        : 'border-[#D0B284]/20 hover:border-[#D0B284]/60',
                    )}
                  >
                    <Image
                      src={getValidImageSrc(image.src, undefined, {
                        width: 160,
                        height: 160,
                        text: 'Thumb error',
                      })}
                      alt={image.alt}
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                      unoptimized={image.src.includes('storage.googleapis.com')}
                      onError={createImageErrorHandler({
                        fallbackText: 'Image',
                        width: 160,
                        height: 160,
                      })}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
