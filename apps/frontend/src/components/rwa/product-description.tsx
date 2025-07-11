'use client';

import { Badge } from '@/components/ui/badge';

interface ProductDescriptionProps {
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  condition?: string;
  authenticity?: string;
  website?: string;
  social?: {
    twitter?: string;
    instagram?: string;
    discord?: string;
  };
}

export default function ProductDescription({
  description = 'This exclusive collection represents the pinnacle of Swiss watchmaking craftsmanship. Each timepiece is meticulously crafted with precision engineering and features premium materials including 18k gold, sapphire crystal, and genuine leather straps. The collection showcases traditional horological excellence combined with modern innovation, making it a perfect investment for collectors and enthusiasts alike.',
  category = 'Luxury Watches',
  brand = 'Swiss Heritage',
  condition = 'Brand New',
  authenticity = 'Certified Authentic',
}: ProductDescriptionProps) {
  return (
    <div className="bg-[#231F20] rounded-lg border border-[#D0B264]/40 p-6">
      {/* Product Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant="outline" className="border-[#D0B264]/50 text-[#D0B264] bg-[#D0B264]/10">
          {category}
        </Badge>
        <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
          {condition}
        </Badge>
        <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
          {authenticity}
        </Badge>
      </div>

      {/* Product Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-1 text-sm">
        <div>
          <span className="text-gray-400">Brand:</span>
          <span className="text-white ml-2 font-medium">{brand}</span>
        </div>
        <div>
          <span className="text-gray-400">Category:</span>
          <span className="text-white ml-2 font-medium">{category}</span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h4 className="text-lg font-syne font-semibold text-[#D0B264] mb-3">Description</h4>
        <p className="text-gray-300 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
