'use client';

import Image from 'next/image';

export default function ProductHeroLocation() {
  return (
    <div className="h-full flex flex-col space-y-6 p-6">
      {/* Hero Image */}
      <div className="flex-shrink-0">
        <div className="relative bg-[#231F20] rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
            alt="King Solomon's Baby - Hero Image"
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={500}
            height={300}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* Location Sections */}
      <div className="flex-1 space-y-3">
        <h4 className="text-[#D0B284] text-sm font-bold mb-4 tracking-wider">DETAILS</h4>

        {/* Location 1 */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-[#DCDDCC] text-sm font-medium">Location:</span>
            <span className="text-white text-sm font-semibold">Los Angeles, CA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
