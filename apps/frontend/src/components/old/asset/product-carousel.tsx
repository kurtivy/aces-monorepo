'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

interface ProductCardProps {
  imageSrc: string;
  altText: string;
  productName: string;
  year: string;
  price: string;
}

function ProductCard({ imageSrc, altText, productName, year, price }: ProductCardProps) {
  return (
    <div className="flex-none w-80 h-80 bg-[#231F20] rounded-xl shadow-lg overflow-hidden border border-[#D0B284]/20 hover:border-[#D0B284]/40 transition-all duration-300 group relative">
      <div className="relative w-full h-full">
        <Image
          src={imageSrc || '/placeholder.svg'}
          alt={altText}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="320px"
        />
      </div>

      {/* Title overlay at bottom - only on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
        <div className="w-full p-4 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[#D0B284] text-xs font-mono font-semibold">{year}</span>
            <span className="text-[#FFFFFF] text-xs font-mono font-semibold">{price}</span>
          </div>
          <h3
            className="text-[#FFFFFF] text-lg font-semibold leading-tight"
            style={{ fontFamily: 'system, serif' }}
          >
            {productName}
          </h3>
        </div>
      </div>
    </div>
  );
}

export default function ProductCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340; // Adjusted for larger square cards
      if (direction === 'left') {
        scrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const products = [
    {
      imageSrc: '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
      altText: '10x South African Gold Krugerrands',
      productName: '10x South African Gold Krugerrands',
      year: '2024',
      price: 'Price On Request',
    },
    {
      imageSrc: '/canvas-images/2010-Lamborghini-Murcielago-SV.webp',
      altText: '2010 Lamborghini Murciélago SV',
      productName: '2010 Lamborghini Murciélago SV',
      year: '2010',
      price: 'Price On Request',
    },
    {
      imageSrc: '/canvas-images/2009-F1-McLaren-MP4-24.webp',
      altText: '2009 F1 McLaren MP4-24',
      productName: '2009 F1 McLaren MP4-24',
      year: '2009',
      price: '€5,572,232',
    },
    {
      imageSrc: '/canvas-images/Andy-Warhol-Signed-Marilyn-Monroe.webp',
      altText: 'Andy Warhol Signed Marilyn Monroe',
      productName: 'Andy Warhol Signed Marilyn Monroe',
      year: '1960s',
      price: '$1,200,000',
    },
    {
      imageSrc:
        '/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
      altText: '1991 Porsche 964 Turbo',
      productName: '1991 Porsche 964 Turbo Rubystone Red',
      year: '1991',
      price: 'Price On Request',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 mt-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-[#D0B284]">You Might Also Like</h2>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl border border-[#D0B284]/30 text-[#D0B284] hover:bg-[#D0B284] hover:text-black bg-transparent transition-all duration-200 w-12 h-12"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl border border-[#D0B284]/30 text-[#D0B284] hover:bg-[#D0B284] hover:text-black bg-transparent transition-all duration-200 w-12 h-12"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {products.map((product, index) => (
          <ProductCard key={index} {...product} />
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
