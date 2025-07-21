import React from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoViewerProps {
  photos: string[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

// Individual Photo Viewer Component
export default function PhotoViewer({
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: PhotoViewerProps) {
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
      {/* Close Button */}
      <Button
        onClick={onClose}
        variant="ghost"
        className="absolute top-6 right-6 z-10 rounded-xl p-3 bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30 hover:bg-[#D0B284] hover:text-black transition-all duration-200 shadow-lg"
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <Button
          onClick={onPrev}
          variant="ghost"
          className="absolute left-6 top-1/2 transform -translate-y-1/2 z-10 rounded-xl p-4 bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30 hover:bg-[#D0B284] hover:text-black transition-all duration-200 shadow-lg"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      {currentIndex < photos.length - 1 && (
        <Button
          onClick={onNext}
          variant="ghost"
          className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10 rounded-xl p-4 bg-black/40 backdrop-blur-sm text-[#D0B284] border border-[#D0B284]/30 hover:bg-[#D0B284] hover:text-black transition-all duration-200 shadow-lg"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Current Photo */}
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="relative max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl">
          <Image
            src={photos[currentIndex]}
            alt={`Photo ${currentIndex + 1}`}
            width={1200}
            height={800}
            className="object-contain max-w-full max-h-full"
          />
        </div>
      </div>

      {/* Photo Counter */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/40 backdrop-blur-sm text-[#FFFFFF] px-6 py-3 rounded-xl border border-[#D0B284]/30 shadow-lg">
        <span className="font-medium">
          {currentIndex + 1} of {photos.length}
        </span>
      </div>
    </div>
  );
}
