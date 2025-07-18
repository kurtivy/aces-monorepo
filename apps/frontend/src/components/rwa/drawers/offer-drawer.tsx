'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Copy, ChevronDown } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
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
  floorPrice?: string;
  topOffer?: string;
  lastSale?: string;
  tokenAddress?: string;
  onOfferSubmit?: (offerAmount: number, duration: number) => void;
}

const OfferDrawer: React.FC<OfferDrawerProps> = ({
  children,
  itemTitle = 'South African Gold Krugerrands',
  itemImage = '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
  floorPrice = '13.6849 ETH',
  topOffer = '13.18 WETH',
  lastSale = '14.08 WETH',
  tokenAddress = '0x7300...0219FE',
  onOfferSubmit,
}) => {
  const [offerAmount, setOfferAmount] = useState('');
  const [duration, setDuration] = useState(30);
  const [isOpen, setIsOpen] = useState(false);

  const handleTopOfferClick = () => {
    // Extract numeric value from topOffer (assuming format like "13.18 WETH")
    const topOfferValue = topOffer.split(' ')[0];
    setOfferAmount(topOfferValue);
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
      <DrawerContent className="bg-[#231F20] border-t border-[#D0B284]/20">
        <div className="mx-auto w-full">
          <DrawerHeader className="px-4 pt-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold text-white">Create item offer</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4 text-[#D0B284]" />
                </Button>
              </DrawerClose>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-[#DCDDCC]">
                <span>1 item</span>
                <div className="h-4 w-4 rounded bg-[#D0B284]/20" />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                  <Image
                    src={itemImage}
                    alt={itemTitle}
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{itemTitle}</h3>
                  <div className="mt-1 flex items-center gap-2">
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
            </div>
          </DrawerHeader>

          <div className="px-4 py-4">
            {/* Offer Details Table */}
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2 text-xs text-[#DCDDCC]">
                <span>FLOOR</span>
                <span>TOP OFFER</span>
                <span>COST</span>
                <span>OFFER TOTAL</span>
                <span>OFFERED AT</span>
              </div>

              <div className="grid grid-cols-5 gap-2 text-sm text-white">
                <span>{floorPrice}</span>
                <span>{topOffer}</span>
                <span>{lastSale}</span>
                <span>0.00 WETH</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="h-8 text-xs bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                  />
                  <span className="text-xs text-[#DCDDCC]">WETH</span>
                </div>
              </div>
            </div>

            {/* Set Price To Button */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTopOfferClick}
                className="border-[#D0B284]/20 text-[#D0B284] hover:bg-[#D0B284]/10"
              >
                SET PRICE TO Top offer
              </Button>
            </div>

            {/* Summary Section */}
            <div className="mt-6 space-y-3 border-t border-[#D0B284]/20 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Total offer value:</span>
                <span className="text-white">($0.00) {offerAmount || '0.00'} WETH</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Floor difference:</span>
                <span className="text-white">-</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Platform fees:</span>
                <span className="text-white">($0.00) 0.00 WETH</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Total est. proceeds:</span>
                <span className="text-white">0.00 WETH ($0.00)</span>
              </div>
            </div>
          </div>

          <DrawerFooter className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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

              <Button
                onClick={handleSubmit}
                disabled={!offerAmount || parseFloat(offerAmount) <= 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Review item offer
              </Button>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OfferDrawer;
