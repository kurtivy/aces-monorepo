'use client';

import React from 'react';
import { Wallet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VerificationLoginPromptProps {
  onConnectWallet?: () => void;
}

export function VerificationLoginPrompt({ onConnectWallet }: VerificationLoginPromptProps) {
  return (
    <div className="relative mb-8">
      {/* Decorative corner elements matching the page design */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

      <div className="relative border-2 border-[#D0B284]/50 rounded-2xl p-6 bg-gradient-to-br from-[#D0B284]/10 to-[#C9AE6A]/5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Icon */}
          <div className="flex-shrink-0">
            {/* <div className="p-3 bg-[#0f1511] border border-[#D0B284]/30 rounded-2xl">
              <Wallet className="w-8 h-8 text-[#D0B284]" />
            </div> */}
          </div>

          {/* Content */}
          <div className="flex-1 text-center space-y-4">
            <div className="flex items-center gap-3 justify-center">
              <Info className="w-6 h-6 text-[#D0B284]" />
              <h3 className="text-2xl font-bold text-[#D0B284]">Connect Your Wallet to Continue</h3>
            </div>

            <p className="text-[#E6E3D3] text-lg leading-relaxed max-w-2xl mx-auto">
              Please connect your wallet to submit your verification.
            </p>

            <div className="pt-1">
              <p className="text-[#C9AE6A]/80 text-base">
                ✓ Form fields are preview-only until connected
              </p>
            </div>
          </div>

          {/* Connect Button */}
          {onConnectWallet && (
            <div className="flex-shrink-0">
              <Button
                onClick={onConnectWallet}
                className="bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D0B284] text-black font-semibold px-6 py-3 rounded-xl transition-all duration-300 shadow-lg"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
