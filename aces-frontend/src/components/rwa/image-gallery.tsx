import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      {/* Main image — no fixed aspect ratio; image determines its own height.
          `group` class enables child arrow buttons to show on hover. */}
      <div className="group relative w-full overflow-hidden rounded border border-golden-beige/10 bg-card-surface glow-border-hover card-glow">
        <img
          src={images[activeIndex]}
          alt={`${title} - Image ${activeIndex + 1}`}
          className="w-full object-contain bg-card-surface"
        />

        {/* Left arrow — previous image.
            Appears on hover; disabled + dimmed when at first image. */}
        <button
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous image"
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-deep-charcoal/60 backdrop-blur-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            activeIndex === 0
              ? "opacity-30 group-hover:opacity-30 cursor-not-allowed text-platinum-grey/50"
              : "hover:bg-deep-charcoal/80 text-platinum-grey/80",
          )}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Right arrow — next image.
            Appears on hover; disabled + dimmed when at last image. */}
        <button
          onClick={() => setActiveIndex((i) => Math.min(images.length - 1, i + 1))}
          disabled={activeIndex === images.length - 1}
          aria-label="Next image"
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-deep-charcoal/60 backdrop-blur-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            activeIndex === images.length - 1
              ? "opacity-30 group-hover:opacity-30 cursor-not-allowed text-platinum-grey/50"
              : "hover:bg-deep-charcoal/80 text-platinum-grey/80",
          )}
        >
          <ChevronRight size={20} />
        </button>

        {/* Image counter badge — bottom-right overlay */}
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
