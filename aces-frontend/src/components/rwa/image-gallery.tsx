import { useState } from "react";
import { cn } from "~/lib/utils";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded border border-golden-beige/10 bg-card-surface glow-border-hover card-glow">
        <img
          src={images[activeIndex]}
          alt={`${title} - Image ${activeIndex + 1}`}
          className="h-full w-full object-cover"
        />
        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-deep-charcoal/80 px-3 py-1 text-xs text-platinum-grey/75 backdrop-blur-sm">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-sm border transition-all sm:h-14 sm:w-14 lg:h-16 lg:w-16",
                i === activeIndex
                  ? "border-golden-beige/40 ring-1 ring-golden-beige/20"
                  : "border-golden-beige/10 opacity-60 hover:opacity-100",
              )}
            >
              <img
                src={img}
                alt={`Thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
