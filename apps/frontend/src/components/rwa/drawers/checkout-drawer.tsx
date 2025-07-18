'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react';
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

interface CheckoutDrawerProps {
  children: React.ReactNode;
  itemTitle?: string;
  itemImage?: string;
  itemPrice?: string;
  itemPriceUSD?: string;
  collectionName?: string;
  tokenId?: string;
  walletAddress?: string;
  onPurchase?: (paymentMethod: string) => void;
}

const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  children,
  itemTitle = 'South African Gold Krugerrands',
  itemImage = '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
  itemPrice = '13.6849 ETH',
  itemPriceUSD = '$47K',
  collectionName = 'ACES Collection',
  tokenId = '#2470',
  walletAddress = '0x4CF9...A2E7',
  onPurchase,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<
    'pending' | 'success' | 'error' | null
  >(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('metamask');

  const handlePurchase = async () => {
    setTransactionStatus('pending');

    // Simulate transaction processing
    setTimeout(() => {
      // Simulate random success/error for demo
      const isSuccess = Math.random() > 0.3;
      setTransactionStatus(isSuccess ? 'success' : 'error');

      if (isSuccess && onPurchase) {
        onPurchase(selectedPaymentMethod);
        setTimeout(() => setIsOpen(false), 2000);
      }
    }, 2000);
  };

  const handleRetry = () => {
    setTransactionStatus(null);
    handlePurchase();
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
              <DrawerTitle className="text-xl font-bold text-white">Checkout</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4 text-[#D0B284]" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Section - Checkout Details */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Checkout</h2>

                {/* Item Details */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                    <Image
                      src={itemImage}
                      alt={itemTitle}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">{itemTitle}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#DCDDCC]">{collectionName}</span>
                      <CheckCircle className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Price Details */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#DCDDCC]">Price</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">{itemPrice}</div>
                      <div className="text-xs text-[#DCDDCC]">{itemPriceUSD}</div>
                    </div>
                  </div>

                  <div className="border-t border-[#D0B284]/20 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white">Total</span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{itemPrice}</div>
                        <div className="text-xs text-[#DCDDCC]">{itemPriceUSD}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section - Payment */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">PAYMENT</h2>

                {/* Payment Method */}
                <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#2A2A2A]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">🦊</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">MetaMask</div>
                        <div className="text-xs text-[#DCDDCC]">{walletAddress}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-green-500">Connected</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => copyToClipboard(walletAddress)}
                      >
                        <Info className="h-3 w-3 text-[#D0B284]" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-[#D0B284]/20 text-[#D0B284] hover:bg-[#D0B284]/10"
                >
                  Change payment method
                </Button>

                {/* Transaction Status */}
                {transactionStatus && (
                  <div className="border-t border-[#D0B284]/20 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {transactionStatus === 'pending' && (
                          <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                        )}
                        {transactionStatus === 'success' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {transactionStatus === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm text-white">
                          {transactionStatus === 'pending' && 'Processing...'}
                          {transactionStatus === 'success' && 'Success'}
                          {transactionStatus === 'error' && 'Rejected'}
                        </span>
                      </div>
                      {transactionStatus === 'error' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-500">Error</span>
                          <Button
                            size="sm"
                            onClick={handleRetry}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="px-4 pb-4">
            <Button
              onClick={handlePurchase}
              disabled={transactionStatus === 'pending'}
              className="w-full bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-bold"
            >
              {transactionStatus === 'pending' ? 'Processing...' : 'Complete Purchase'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CheckoutDrawer;
