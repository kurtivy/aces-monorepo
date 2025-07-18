'use client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ActivityTab } from './product-tabs/activity-tab';
import { HoldersTab } from './product-tabs/holders-tab';

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
  activity?: {
    event: string;
    price: number;
    from: string;
    to: string;
    time: string;
  }[];
  holders?: {
    rank: number;
    address: string;
    percentage: number;
    amount: number;
    value: number;
    txns: number;
    exp: string;
  }[];
}

export default function ProductDescription({
  description = 'This exclusive collection represents the pinnacle of Swiss watchmaking craftsmanship. Each timepiece is meticulously crafted with precision engineering and features premium materials including 18k gold, sapphire crystal, and genuine leather straps. The collection showcases traditional horological excellence combined with modern innovation, making a perfect investment for collectors and enthusiasts alike.',
  category = 'Luxury Watches',
  brand = 'Swiss Heritage',
  condition = 'Brand New',
  authenticity = 'Certified Authentic',
  activity = [],
  holders = [],
}: ProductDescriptionProps) {
  return (
    <div className="rounded-xl p-6 h-full flex flex-col bg-gradient-to-b from-black to-[#231F20] ">
      <Tabs defaultValue="description" className="flex flex-col h-full">
        <TabsList className="flex w-full bg-transparent p-0 border-b border-[#D0B284]/30 flex-shrink-0">
          <TabsTrigger
            value="description"
            className="flex-1 pb-2 text-center text-[#D0B284] font-mono font-medium transition-all duration-200 relative data-[state=active]:text-[#D0B284] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[#D0B284]/30 data-[state=active]:after:rounded-t-sm hover:text-white"
          >
            Description
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="flex-1 pb-2 text-center text-[#D0B284] font-mono font-medium transition-all duration-200 relative data-[state=active]:text-[#D0B284] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[#D0B284]/30 data-[state=active]:after:rounded-t-sm hover:text-white"
          >
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="holders"
            className="flex-1 pb-2 text-center text-[#D0B284] font-mono font-medium transition-all duration-200 relative data-[state=active]:text-[#D0B284] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[#D0B284]/30 data-[state=active]:after:rounded-t-sm hover:text-white"
          >
            Holders
          </TabsTrigger>
        </TabsList>

        {/* ALL TabsContent now have FIXED height and scrolling */}
        <TabsContent value="description" className="flex-1 pt-4 overflow-y-auto min-h-0">
          <div className="h-full flex flex-col">
            {/* Product Badges */}
            <div className="flex flex-wrap gap-2 mb-6 flex-shrink-0">
              <Badge
                variant="outline"
                className="border-[#D0B264]/50 text-[#D0B264] bg-[#D0B264]/10"
              >
                {category}
              </Badge>
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-400 bg-green-500/10"
              >
                {condition}
              </Badge>
              <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10">
                {authenticity}
              </Badge>
            </div>

            {/* Product Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm flex-shrink-0">
              <div>
                <span className="text-gray-400">Brand:</span>
                <span className="text-white ml-2 font-medium">{brand}</span>
              </div>
              <div>
                <span className="text-gray-400">Category:</span>
                <span className="text-white ml-2 font-medium">{category}</span>
              </div>
            </div>

            {/* Description - this can scroll if needed */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <h4 className="text-lg font-syne font-semibold text-[#D0B264] mb-3">Description</h4>
              <p className="text-gray-300 leading-relaxed">{description}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="flex-1 pt-4 min-h-0">
          <ActivityTab activity={activity} />
        </TabsContent>

        <TabsContent value="holders" className="flex-1 pt-4 min-h-0">
          <HoldersTab holders={holders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
