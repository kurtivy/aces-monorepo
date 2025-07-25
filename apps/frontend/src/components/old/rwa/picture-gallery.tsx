'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

interface PictureGalleryProps {
  images?: string[];
  title?: string;
}

export default function PictureGallery({
  images = [
    '/placeholder.svg?height=400&width=400',
    '/placeholder.svg?height=400&width=400',
    '/placeholder.svg?height=400&width=400',
    '/placeholder.svg?height=400&width=400',
  ],
  title = 'Luxury Watch Collection',
}: PictureGalleryProps) {
  const [currentImage, setCurrentImage] = useState(0);

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="h-full rounded-xl overflow-hidden">
      <div className="h-full flex flex-col p-0">
        {/* Main Image - touches top and sides */}
        <div className="relative flex-1 group rounded-t-2xl overflow-hidden">
          <div className="h-full w-full overflow-hidden bg-black border-b border-white/10">
            <Image
              src={images[currentImage] || '/placeholder.svg'}
              alt={`${title} - Image ${currentImage + 1}`}
              width={400}
              height={400}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Navigation Arrows - optional, can be removed if you want a cleaner look */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm h-6 w-6"
                onClick={prevImage}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm h-6 w-6"
                onClick={nextImage}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </>
          )}

          {/* Expand Button - optional, can be removed if you want a cleaner look */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm h-6 w-6"
              >
                <Expand className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl bg-black/90 backdrop-blur-xl border-white/20">
              <DialogTitle className="sr-only">
                {title} - Image {currentImage + 1}
              </DialogTitle>
              <div className="aspect-square rounded-lg overflow-hidden">
                <Image
                  src={images[currentImage] || '/placeholder.svg'}
                  alt={`${title} - Image ${currentImage + 1}`}
                  width={800}
                  height={800}
                  className="w-full h-full object-cover"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dot Indicators - directly below image, minimal spacing */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1 py-2 items-center rounded-b-2xl bg-transparent">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImage(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  index === currentImage
                    ? 'bg-[#D0B264] scale-110'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
