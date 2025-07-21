import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Heart, X, Play } from 'lucide-react';
import Image from 'next/image';
import MediaTabs from './media-tabs';
import PhotoViewer from './photo-viewer';

interface PhotoGalleryOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  videos: string[];
}

// Define mosaic tile layout patterns
const getTileSize = (index: number): string => {
  const patterns = [
    'col-span-2 row-span-2', // Large square (2x2)
    'col-span-1 row-span-1', // Small square (1x1)
    'col-span-2 row-span-1', // Wide rectangle (2x1)
    'col-span-1 row-span-2', // Tall rectangle (1x2)
    'col-span-1 row-span-1', // Small square (1x1)
    'col-span-1 row-span-1', // Small square (1x1)
    'col-span-2 row-span-1', // Wide rectangle (2x1)
    'col-span-1 row-span-1', // Small square (1x1)
    'col-span-1 row-span-2', // Tall rectangle (1x2)
  ];
  return patterns[index % patterns.length];
};

export default function PhotoGalleryOverlay({
  isOpen,
  onClose,
  photos,
  videos,
}: PhotoGalleryOverlayProps) {
  const [activeTab, setActiveTab] = useState('photos');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  if (!isOpen) return null;

  const currentMedia = activeTab === 'photos' ? photos : videos;

  const openPhotoViewer = (index: number) => {
    if (activeTab === 'photos') {
      setCurrentPhotoIndex(index);
      setViewerOpen(true);
    }
  };

  const closePhotoViewer = () => {
    setViewerOpen(false);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => Math.min(prev + 1, photos.length - 1));
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4">
        <div className="bg-[#231F20] rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#D0B284]/20">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#D0B284]/20">
            <MediaTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              photosCount={photos.length}
              videosCount={videos.length}
            />
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-[#D0B284] border border-[#D0B284]/30 hover:bg-[#D0B284] hover:text-black transition-all duration-200"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-[#D0B284] border border-[#D0B284]/30 hover:bg-[#D0B284] hover:text-black transition-all duration-200"
              >
                <Heart className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="rounded-xl p-2 text-[#DCDDCC] hover:text-[#FFFFFF] hover:bg-[#D0B284]/10 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Mosaic Media Grid */}
            <div className="grid grid-cols-6 auto-rows-[120px] max-h-96 overflow-y-auto rounded-xl p-2">
              {currentMedia.map((src, index) => {
                const tileSize = getTileSize(index);
                return (
                  <div
                    key={index}
                    className={`relative cursor-pointer group overflow-hidden rounded-xl border border-[#D0B284]/40 hover:border-[#D0B284]/60 transition-all duration-300 bg-[#231F20] ${tileSize}`}
                    onClick={() => openPhotoViewer(index)}
                  >
                    <Image
                      src={src}
                      alt={`${activeTab} ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200 rounded-lg"
                    />
                    {activeTab === 'videos' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="bg-[#D0B284] rounded-full p-3 shadow-lg">
                          <Play className="w-6 h-6 text-black" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Viewer */}
      {viewerOpen && (
        <PhotoViewer
          photos={photos}
          currentIndex={currentPhotoIndex}
          onClose={closePhotoViewer}
          onNext={nextPhoto}
          onPrev={prevPhoto}
        />
      )}
    </>
  );
}
