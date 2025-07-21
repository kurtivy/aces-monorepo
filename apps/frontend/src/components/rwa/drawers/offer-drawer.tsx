'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Copy, ChevronDown } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OfferDrawerProps {
  children: React.ReactNode;
  itemTitle?: string;
  itemImage?: string;
  tokenAddress?: string;
  onOfferSubmit?: (offerAmount: number, duration: number) => void;
}

const OfferDrawer: React.FC<OfferDrawerProps> = ({
  children,
  itemTitle = 'South African Gold Krugerrands',
  itemImage = '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
  tokenAddress = '0x7300...0219FE',
  onOfferSubmit,
}) => {
  const [offerAmount, setOfferAmount] = useState('');
  const [duration, setDuration] = useState(30);
  const [isOpen, setIsOpen] = useState(false);

  const handleTopOfferClick = () => {
    // Set to top offer value (45,200 USD)
    setOfferAmount('45200');
  };

  const handleSubmit = () => {
    const amount = parseFloat(offerAmount);
    if (amount > 0 && onOfferSubmit) {
      onOfferSubmit(amount, duration);
      setIsOpen(false);
      setOfferAmount('');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="bg-black border-t border-[#D0B284]/20">
        <div className="mx-auto w-full">
          <DrawerHeader className="">
            <DrawerTitle className="text-xl font-bold text-white"></DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col lg:flex-row gap-6 px-4">
            {/* Left Section - Item Details */}
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold text-white">Item Details</h2>

              {/* Item Details with Price on Same Line */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                    <Image
                      src={itemImage}
                      alt={itemTitle}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{itemTitle}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#DCDDCC]">{tokenAddress}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-[#D0B284]/10"
                        onClick={() => copyToClipboard(tokenAddress)}
                      >
                        <Copy className="h-3 w-3 text-[#D0B284]" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">$47,000</div>
                  <div className="text-xs text-[#DCDDCC]">Retail Price</div>
                </div>
              </div>

              {/* Price Details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                  <span className="text-sm text-[#DCDDCC]">Top Offer</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">$45,200</div>
                    <div className="text-xs text-[#DCDDCC]">Current Best</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Divider - Only visible on large screens */}
            <div className="hidden lg:block w-px bg-[#D0B284]/20 mx-3 self-stretch"></div>

            {/* Right Section - Offer Input */}
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold text-white">MAKE OFFER</h2>

              {/* Offer Amount Input - Single Row */}
              <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#DCDDCC] whitespace-nowrap">Your Offer</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="flex-1 h-10 text-sm bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                  />
                  <span className="text-sm text-[#DCDDCC] whitespace-nowrap">USD</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTopOfferClick}
                    className="borderborder-[#D0B284]/80 text-[#D0B284] hover:text-[#D0B284] hover:bg-[#D0B284]/30 text-xs whitespace-nowrap"
                  >
                    Set to Top Offer
                  </Button>
                </div>
              </div>

              {/* Summary Section */}
              <div className="space-y-3 border-t border-[#D0B284]/20 pt-4 pl-12">
                <div className="flex justify-between text-sm">
                  <span className="text-[#DCDDCC]">Total offer value:</span>
                  <span className="text-white">${offerAmount || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#DCDDCC]">Floor difference:</span>
                  <span className="text-white">-</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#DCDDCC]">Platform fees:</span>
                  <span className="text-white">$0.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#DCDDCC]">Total est. proceeds:</span>
                  <span className="text-white">${offerAmount || '0.00'}</span>
                </div>
              </div>

              {/* Duration and Submit */}
              <div className="space-y-3 pt-4 pl-12">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#DCDDCC]">Offer duration:</span>
                  <div className="relative">
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="appearance-none rounded border border-[#D0B284]/20 bg-[#231F20] px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#D0B284]"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#D0B284] pointer-events-none" />
                  </div>
                </div>

                <div className="flex justify-end py-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={!offerAmount || parseFloat(offerAmount) <= 0}
                    className="w-32 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-bold"
                  >
                    Review Offer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OfferDrawer;
