'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
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
  onPurchase?: (paymentMethod: string) => void;
}

const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  children,
  itemTitle = 'South African Gold Krugerrands',
  itemImage = '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
  itemPrice = '13.6849 ETH',
  itemPriceUSD = '$47K',
  collectionName = 'ACES Collection',
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

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="bg-black border-t border-[#D0B284]/20">
        <DrawerHeader className="">
          <DrawerTitle className="text-xl font-bold text-white"></DrawerTitle>
        </DrawerHeader>
        <div className="mx-auto w-full">
          <div className="px-4 py-4">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Section - Checkout Details */}
              <div className="flex-1 space-y-4">
                <h2 className="text-lg font-semibold text-white">Checkout</h2>

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
                        <span className="text-xs text-[#DCDDCC]">{collectionName}</span>
                        <CheckCircle className="h-3 w-3 text-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{itemPrice}</div>
                    <div className="text-xs text-[#DCDDCC]">{itemPriceUSD}</div>
                  </div>
                </div>

                {/* Total Section */}
                <div className="border-t border-[#D0B284]/20 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">Total</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">{itemPrice}</div>
                      <div className="text-xs text-[#DCDDCC]">{itemPriceUSD}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vertical Divider - Removed to fix layout issues */}

              {/* Right Section - Payment */}
              <div className="flex-1 space-y-4">
                <h2 className="text-lg font-semibold text-white">PAYMENT METHOD</h2>

                {/* Payment Method Options - Scrollable */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {/* Phantom */}
                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPaymentMethod === 'phantom'
                        ? 'border-[#D0B284] bg-[#231F20]'
                        : 'border-[#D0B284]/20 bg-[#231F20] hover:border-[#D0B284]/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('phantom')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/svg/phantom.svg"
                          alt="Phantom"
                          width={32}
                          height={32}
                          className="w-6 h-6"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">Phantom</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            selectedPaymentMethod === 'phantom'
                              ? 'border-[#D0B284] bg-[#D0B284]'
                              : 'border-gray-400'
                          }`}
                        >
                          {selectedPaymentMethod === 'phantom' && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Apple Pay */}
                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPaymentMethod === 'applepay'
                        ? 'border-[#D0B284] bg-[#231F20]'
                        : 'border-[#D0B284]/20 bg-[#231F20] hover:border-[#D0B284]/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('applepay')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/svg/apple-pay.svg"
                          alt="Apple Pay"
                          width={48}
                          height={48}
                          className="w-8 h-8"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">Apple Pay</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            selectedPaymentMethod === 'applepay'
                              ? 'border-[#D0B284] bg-[#D0B284]'
                              : 'border-gray-400'
                          }`}
                        >
                          {selectedPaymentMethod === 'applepay' && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MetaMask */}
                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPaymentMethod === 'metamask'
                        ? 'border-[#D0B284] bg-[#231F20]'
                        : 'border-[#D0B284]/20 bg-[#231F20] hover:border-[#D0B284]/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('metamask')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/svg/metamask.svg"
                          alt="MetaMask"
                          width={32}
                          height={32}
                          className="w-6 h-6"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">MetaMask</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            selectedPaymentMethod === 'metamask'
                              ? 'border-[#D0B284] bg-[#D0B284]'
                              : 'border-gray-400'
                          }`}
                        >
                          {selectedPaymentMethod === 'metamask' && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Google Pay */}
                  <div
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPaymentMethod === 'googlepay'
                        ? 'border-[#D0B284] bg-[#231F20]'
                        : 'border-[#D0B284]/20 bg-[#231F20] hover:border-[#D0B284]/40'
                    }`}
                    onClick={() => setSelectedPaymentMethod('googlepay')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/svg/google-pay.svg"
                          alt="Google Pay"
                          width={32}
                          height={32}
                          className="w-8 h-8"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">Google Pay</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            selectedPaymentMethod === 'googlepay'
                              ? 'border-[#D0B284] bg-[#D0B284]'
                              : 'border-gray-400'
                          }`}
                        >
                          {selectedPaymentMethod === 'googlepay' && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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

                {/* Confirm Button - Only in right column */}
                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handlePurchase}
                    disabled={transactionStatus === 'pending'}
                    className="w-32 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-bold"
                  >
                    {transactionStatus === 'pending' ? 'Processing...' : 'Confirm'}
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

export default CheckoutDrawer;
