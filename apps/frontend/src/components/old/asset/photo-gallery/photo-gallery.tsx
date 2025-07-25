import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Share2, Camera } from 'lucide-react';
import PhotoGalleryOverlay from './photo-gallery-overlay';

interface PhotoGalleryProps {
  photos?: string[];
  videos?: string[];
}

// Sample data - replace with your actual data
const mediaData = {
  photos: [
    '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
    '/porsche-images/1.jpeg',
    '/porsche-images/2.jpeg',
    '/porsche-images/3.jpeg',
    '/porsche-images/4.jpeg',
    '/porsche-images/5.jpg',
    '/porsche-images/6.jpg',
    '/porsche-images/7.jpeg',
    '/porsche-images/8.webp',
  ],
  videos: [] as string[],
};

export default function PhotoGallery({
  photos = mediaData.photos,
  videos = mediaData.videos,
}: PhotoGalleryProps = {}) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const openOverlay = () => {
    setOverlayOpen(true);
  };

  const closeOverlay = () => {
    setOverlayOpen(false);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-2 md:px-4 lg:px-6">
        <div className="relative">
          <div
            className="grid grid-cols-1 lg:grid-cols-2 rounded-xl overflow-hidden cursor-pointer shadow-lg"
            onClick={openOverlay}
          >
            {/* Left Section: Main Image */}
            <div className="relative overflow-hidden group rounded-xl border border-[#D0B284]/40 hover:border-[#D0B284]/60 transition-all duration-300">
              <div className="aspect-square">
                <Image
                  src={photos[0]}
                  alt="Main gallery image"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300 rounded-lg"
                  priority
                />
              </div>
            </div>

            {/* Right Section: Sub-grid */}
            <div className="grid grid-cols-2 grid-rows-2">
              {photos.slice(1, 5).map((src, index) => (
                <div
                  key={index}
                  className="relative aspect-square overflow-hidden bg-[#231F20] group rounded-xl border border-[#D0B284]/40 hover:border-[#D0B284]/60 transition-all duration-300"
                >
                  <Image
                    src={src}
                    alt={`Gallery image ${index + 2}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Overlay Buttons - positioned absolutely over the entire gallery */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Save and Share buttons - top left */}
            <div className="absolute top-4 left-4 flex gap-3 pointer-events-auto">
              {/* <Button
                variant="ghost"
                className="rounded-xl px-4 py-2 text-sm font-medium shadow-sm
                           bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30
                           hover:bg-[#D0B284] hover:text-black transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle save action
                }}
              >
                <Heart className="w-4 h-4 mr-2" />
                Save
              </Button> */}
              <Button
                variant="ghost"
                className="rounded-xl px-4 py-2 text-sm font-medium shadow-sm
                           bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30
                           hover:bg-[#D0B284] hover:text-black transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle share action
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            {/* Camera button - bottom right */}
            <div className="absolute bottom-4 right-4 pointer-events-auto">
              <Button
                variant="ghost"
                className="rounded-xl px-6 py-3 text-sm font-medium shadow-sm
                           bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30
                           hover:bg-[#D0B284] hover:text-black transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  openOverlay();
                }}
              >
                <Camera className="w-5 h-5 mr-2" />
                View All {photos.length} Photos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      <PhotoGalleryOverlay
        isOpen={overlayOpen}
        onClose={closeOverlay}
        photos={photos}
        videos={videos}
      />
    </>
  );
}
