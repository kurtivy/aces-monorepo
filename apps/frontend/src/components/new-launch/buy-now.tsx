'use client';

import { useState } from 'react';
import Image from 'next/image';
import ModalSwapInterface from './modal-swap-interface';

type PaymentMethod = {
  name: string;
  color?: string;
} & (
  | {
      icon: string;
      isApplePay?: never;
    }
  | {
      icon?: never;
      isApplePay: true;
    }
);

export default function BuyNowSection() {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const paymentMethods: PaymentMethod[] = [
    {
      name: 'Ethereum',
      icon: '/svg/eth.svg',
    },
    {
      name: 'USDC',
      icon: '/svg/usdc.svg',
    },
    {
      name: 'Tether',
      icon: '/svg/tether.svg',
    },
    {
      name: 'Credit Card',
      icon: '/svg/credit-card.svg',
      color: 'invert brightness-200',
    },
  ];

  return (
    <div
      className="w-full rounded-xl p-2 shadow-2xl relative overflow-hidden"
      style={{ height: '200px' }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 rounded-xl" />

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Payment Methods Section */}
        <div className="flex flex-col items-center space-y-3">
          <h3
            className="text-[#DCDDCC] text-sm font-medium tracking-wider"
            style={{ fontFamily: 'system, serif' }}
          >
            BUY WITH
          </h3>

          {/* Payment Method Icons */}
          <div className="flex items-center justify-center gap-3">
            {paymentMethods.map((method) => (
              <div
                key={method.name}
                className="relative group flex items-center justify-center w-12 h-12 rounded-lg hover:scale-110 transition-all duration-300 cursor-pointer"
                title={method.name}
              >
                {method.isApplePay ? (
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                ) : (
                  <Image
                    src={method.icon}
                    alt={method.name}
                    width={32}
                    height={32}
                    className={`${method.color}`}
                  />
                )}

                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Buy Now Button */}
        <button
          className="relative w-full h-16 bg-gradient-to-r from-[#D0B284] to-[#D7BF75] text-black font-bold text-2xl rounded-xl shadow-2xl border-2 border-[#D0B284] transition-all duration-300 overflow-hidden group mb-4"
          style={{
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsModalOpen(true)}
        >
          {/* Button background effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#D7BF75] to-[#D0B284] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

          {/* Button text */}
          <span className="relative z-10 tracking-wider">BUY $ACES NOW</span>

          {/* Hover glow */}
          <div
            className={`absolute inset-0 rounded-xl transition-all duration-300 ${isHovered ? 'shadow-[0_0_30px_rgba(208,178,100,0.6)]' : ''}`}
          />
        </button>
      </div>

      {/* Modal */}
      <ModalSwapInterface
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tokenSymbol="ACES"
      />
    </div>
  );
}
