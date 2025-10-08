'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import DynamicImageGallery from '../left-column/overview/dynamic-image-gallery';
import type { ImageData } from '@/types/rwa/section.types';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface RWAGallerySectionProps {
  images: ImageData[];
  selectedImageIndex: number;
  onImageSelect: (index: number) => void;
}

export function RWAGallerySection({
  images,
  selectedImageIndex,
  onImageSelect,
}: RWAGallerySectionProps) {
  const main = images?.[selectedImageIndex];

  return (
    <div className="mb-4">
      {/* Main preview */}
      <div className="w-full aspect-square bg-black/40 rounded-lg border border-[#D0B284]/20 overflow-hidden">
        {main ? (
          <Image
            src={getValidImageSrc(main.src, undefined, {
              width: 600,
              height: 600,
            })}
            alt={main.alt || 'Gallery image'}
            width={600}
            height={600}
            className="w-full h-full object-cover"
            unoptimized={main.src?.includes('storage.googleapis.com')}
            onError={createImageErrorHandler({
              fallbackText: 'Image',
              width: 600,
              height: 600,
            })}
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {/* Thumbnails */}
      <div className={cn('mt-3')}>
        <DynamicImageGallery
          images={images}
          selectedImageIndex={selectedImageIndex}
          onImageSelect={onImageSelect}
        />
      </div>
    </div>
  );
}

export default RWAGallerySection;
