// components/WalletModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChainId } from 'wagmi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Copy, ExternalLink, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { user, exportWallet } = usePrivy();
  const chainId = useChainId();
  const [balance, setBalance] = useState<string>('0.000000');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  const walletAddress = user?.wallet?.address;

  // Fetch balance (you can implement this with your preferred library)
  const fetchBalance = async () => {
    if (!walletAddress) return;

    setIsLoadingBalance(true);
    try {
      // You would implement actual balance fetching here
      // Using ethers, viem, or your preferred library
      console.log('Fetching balance for:', walletAddress);

      // Mock balance for demo - replace with actual implementation
      setTimeout(() => {
        setBalance('0.123456');
        setIsLoadingBalance(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchBalance();
    }
  }, [isOpen, walletAddress]);

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openInExplorer = () => {
    if (walletAddress) {
      const baseUrl =
        chainId === 8453
          ? 'https://basescan.org/address/'
          : 'https://sepolia.basescan.org/address/';
      window.open(`${baseUrl}${walletAddress}`, '_blank');
    }
  };

  if (!walletAddress) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black border-[#D0B284] text-[#D0B284] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Your Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wallet Address */}
          <Card className="bg-[#D0B284]/10 border-[#D0B284]/20">
            <CardContent className="p-4">
              <label className="text-sm text-[#D0B284]/60 block mb-2">Wallet Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-black/50 p-2 rounded">
                  {showFullAddress
                    ? walletAddress
                    : `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="text-[#D0B284] hover:bg-[#D0B284]/20"
                >
                  {copied ? '✓' : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openInExplorer}
                  className="text-[#D0B284] hover:bg-[#D0B284]/20"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Balance */}
          <Card className="bg-[#D0B284]/10 border-[#D0B284]/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[#D0B284]/60">ETH Balance</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  className="text-[#D0B284] hover:bg-[#D0B284]/20 h-auto p-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="text-lg font-semibold">
                {isLoadingBalance ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#D0B284] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : (
                  `${balance} ETH`
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {/* Export/Backup Wallet - Using Privy's actual exportWallet */}
            {exportWallet && (
              <Button
                onClick={() => {
                  exportWallet(); // This opens Privy's built-in export dialog
                }}
                className="w-full bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
              >
                <Eye className="w-4 h-4 mr-2" />
                Export Wallet (Privy)
              </Button>
            )}

            {/* Toggle Full Address */}
            <Button
              onClick={() => setShowFullAddress(!showFullAddress)}
              variant="outline"
              className="w-full border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284]/20"
            >
              {showFullAddress ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {showFullAddress ? 'Hide' : 'Show'} Full Address
            </Button>
          </div>

          {/* Instructions */}
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-3">
              <p className="text-xs text-blue-400 mb-1">💡 Tip:</p>
              <p className="text-xs text-[#D0B284]/80">
                This is your Privy embedded wallet. Funds you purchase through MoonPay will appear
                here.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
