// components/WalletModal.tsx
'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChainId, useBalance } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Copy, ExternalLink, RefreshCw, Eye, EyeOff, Send } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/types/contracts';
import { useReliableETHPrice } from '@/hooks/contracts/use-reliable-eth-price';
import { useSendTransaction } from '@privy-io/react-auth';
import { useSignMessage } from '@privy-io/react-auth';
import Image from 'next/image';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Token interface for display
interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  usdValue: string;
  changePercent: string;
  isPositive: boolean;
  decimals: number;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { user, exportWallet } = usePrivy();
  const chainId = useChainId();
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  // Advanced Privy features
  const { sendTransaction } = useSendTransaction();
  const { signMessage } = useSignMessage();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [messageToSign, setMessageToSign] = useState('');

  const walletAddress = user?.wallet?.address as `0x${string}` | undefined;

  // Real ETH price fetching
  const { price: ethPriceUSD, isLoading: priceLoading } = useReliableETHPrice(30000);

  // Real balance fetching using wagmi
  const {
    data: ethBalance,
    isLoading: ethLoading,
    refetch: refetchEth,
  } = useBalance({
    address: walletAddress,
    query: { enabled: !!walletAddress },
  });

  const {
    data: usdcBalance,
    isLoading: usdcLoading,
    refetch: refetchUsdc,
  } = useBalance({
    address: walletAddress,
    token: SUPPORTED_CURRENCIES.USDC.address,
    query: { enabled: !!walletAddress },
  });

  const {
    data: usdtBalance,
    isLoading: usdtLoading,
    refetch: refetchUsdt,
  } = useBalance({
    address: walletAddress,
    token: SUPPORTED_CURRENCIES.USDT.address,
    query: { enabled: !!walletAddress },
  });

  const isLoadingBalances = ethLoading || usdcLoading || usdtLoading || priceLoading;

  // Prepare token list for display with real prices
  const tokenBalances: TokenBalance[] = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: ethBalance?.value ? formatEther(ethBalance.value) : '0',
      formattedBalance: ethBalance?.value
        ? `${parseFloat(formatEther(ethBalance.value)).toFixed(3)} ETH`
        : '0.000 ETH',
      usdValue:
        ethBalance?.value && ethPriceUSD
          ? `$${(parseFloat(formatEther(ethBalance.value)) * ethPriceUSD).toFixed(2)}`
          : '$0.00',
      changePercent:
        ethBalance?.value && parseFloat(formatEther(ethBalance.value)) > 0 && ethPriceUSD
          ? `+$${(parseFloat(formatEther(ethBalance.value)) * ethPriceUSD * 0.032).toFixed(2)}` // Mock 3.2% daily change
          : '$0.00',
      isPositive: true,
      decimals: 18,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: usdcBalance?.value ? formatUnits(usdcBalance.value, 6) : '0',
      formattedBalance: usdcBalance?.value
        ? `${parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2)} USDC`
        : '0.00 USDC',
      usdValue: usdcBalance?.value
        ? `$${parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2)}`
        : '$0.00',
      changePercent:
        usdcBalance?.value && parseFloat(formatUnits(usdcBalance.value, 6)) > 0
          ? `-$${(parseFloat(formatUnits(usdcBalance.value, 6)) * 0.0001).toFixed(2)}` // Mock small negative change
          : '$0.00',
      isPositive: false,
      decimals: 6,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      balance: usdtBalance?.value ? formatUnits(usdtBalance.value, 6) : '0',
      formattedBalance: usdtBalance?.value
        ? `${parseFloat(formatUnits(usdtBalance.value, 6)).toFixed(2)} USDT`
        : '0.00 USDT',
      usdValue: usdtBalance?.value
        ? `$${parseFloat(formatUnits(usdtBalance.value, 6)).toFixed(2)}`
        : '$0.00',
      changePercent:
        usdtBalance?.value && parseFloat(formatUnits(usdtBalance.value, 6)) > 0
          ? `+$${(parseFloat(formatUnits(usdtBalance.value, 6)) * 0.00005).toFixed(2)}` // Mock tiny positive change
          : '$0.00',
      isPositive: true,
      decimals: 6,
    },
  ];

  const handleRefreshBalances = () => {
    refetchEth();
    refetchUsdc();
    refetchUsdt();
  };

  // Handle sending ETH transaction
  const handleSendTransaction = async () => {
    if (!sendTo || !sendAmount || !walletAddress) return;

    try {
      await sendTransaction({
        to: sendTo as `0x${string}`,
        value: (parseFloat(sendAmount) * 1e18).toString(), // Convert ETH to wei
      });
      setSendModalOpen(false);
      setSendAmount('');
      setSendTo('');
      // Refresh balances after transaction
      handleRefreshBalances();
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  // Handle signing message
  const handleSignMessage = async () => {
    if (!messageToSign) return;

    try {
      await signMessage({ message: messageToSign });
      setSignModalOpen(false);
      setMessageToSign('');
    } catch (error) {
      console.error('Signing failed:', error);
    }
  };

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
      <DialogContent className="bg-black/95 border border-[#D0B264]/40 text-[#D0B264] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-[#D0B264] text-lg font-medium uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Your Wallet
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Wallet Address */}
          <Card className="bg-black/90 border border-[#D0B264]/40">
            <CardContent className="p-2">
              <label className="text-xs text-[#D0B264]/60 font-medium uppercase tracking-wide block mb-1">
                Address
              </label>
              <code className="block text-xs font-mono bg-black/70 text-[#D0B264] p-1.5 rounded border border-[#D0B264]/20 mb-2">
                {showFullAddress
                  ? walletAddress
                  : `${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-8)}`}
              </code>

              {/* Quick Actions Row */}
              <div className="flex gap-1 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1 rounded h-auto text-xs"
                >
                  {copied ? '✓' : <Copy className="w-3 h-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openInExplorer}
                  className="text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1 rounded h-auto text-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshBalances}
                  disabled={isLoadingBalances}
                  className="text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 h-auto px-2 py-1 rounded text-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  onClick={() => setShowFullAddress(!showFullAddress)}
                  variant="ghost"
                  size="sm"
                  className="text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1 rounded h-auto text-xs"
                >
                  {showFullAddress ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>

              {/* Main Action Buttons */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    onClick={() => setSendModalOpen(true)}
                    className="bg-[#D0B264] text-black hover:bg-[#D0B264]/80 hover:text-black transition-colors duration-150 px-2 py-1.5 rounded text-xs font-medium uppercase tracking-wide"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Send ETH
                  </Button>
                  {exportWallet && (
                    <Button
                      onClick={() => {
                        exportWallet(); // This opens Privy's built-in export dialog
                      }}
                      variant="default"
                      className="border border-[#D0B264]/40 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 rounded text-xs font-medium uppercase tracking-wide"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Export
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Balances List */}
          <Card className="bg-black/90 border border-[#D0B264]/40">
            <CardContent className="p-2">
              <div className="space-y-1">
                {tokenBalances.map((token) => {
                  const getTokenIcon = (symbol: string) => {
                    switch (symbol) {
                      case 'ETH':
                        return (
                          <div className="w-10 h-10 rounded-full overflow-hidden">
                            <Image
                              src="/svg/eth.svg"
                              alt="Ethereum"
                              width={40}
                              height={40}
                              className="w-full h-full"
                            />
                          </div>
                        );
                      case 'USDC':
                        return (
                          <div className="w-10 h-10 rounded-full overflow-hidden">
                            <Image
                              src="/svg/usdc.svg"
                              alt="USD Coin"
                              width={40}
                              height={40}
                              className="w-full h-full"
                            />
                          </div>
                        );
                      case 'USDT':
                        return (
                          <div className="w-10 h-10 rounded-full overflow-hidden">
                            <Image
                              src="/svg/tether.svg"
                              alt="Tether USD"
                              width={40}
                              height={40}
                              className="w-full h-full"
                            />
                          </div>
                        );
                      default:
                        return (
                          <div className="w-10 h-10 bg-[#D0B264]/20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-[#D0B264]">
                              {symbol.slice(0, 2)}
                            </span>
                          </div>
                        );
                    }
                  };

                  return (
                    <div
                      key={token.symbol}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-[#D0B264]/5 transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3">
                        {getTokenIcon(token.symbol)}
                        <div>
                          <div className="text-sm font-medium text-white">{token.name}</div>
                          <div className="text-xs text-[#D0B264]/60">{token.formattedBalance}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{token.usdValue}</div>
                        <div
                          className={`text-xs ${token.isPositive ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {token.changePercent}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Send Transaction Inline Form */}
          {sendModalOpen && (
            <Card className="bg-black/95 border border-[#D0B264]/60">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#D0B264] font-medium uppercase tracking-wide">
                    Send ETH
                  </label>
                  <Button
                    onClick={() => setSendModalOpen(false)}
                    variant="ghost"
                    size="sm"
                    className="text-[#D0B264]/60 hover:text-white h-auto p-1"
                  >
                    ×
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="To Address (0x...)"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="w-full text-xs bg-black/70 text-[#D0B264] p-1.5 rounded border border-[#D0B264]/30 placeholder-[#D0B264]/50"
                  />
                  <input
                    type="number"
                    placeholder="Amount ETH"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    step="0.001"
                    min="0"
                    className="w-full text-xs bg-black/70 text-[#D0B264] p-1.5 rounded border border-[#D0B264]/30 placeholder-[#D0B264]/50"
                  />
                  <Button
                    onClick={handleSendTransaction}
                    disabled={!sendTo || !sendAmount}
                    className="w-full bg-[#D0B264] text-black hover:bg-[#D0B264]/80 disabled:opacity-50 px-2 py-1.5 rounded text-xs font-medium uppercase tracking-wide"
                  >
                    Send Transaction
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sign Message Inline Form */}
          {signModalOpen && (
            <Card className="bg-black/95 border border-[#D0B264]/60">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#D0B264] font-medium uppercase tracking-wide">
                    Sign Message
                  </label>
                  <Button
                    onClick={() => setSignModalOpen(false)}
                    variant="ghost"
                    size="sm"
                    className="text-[#D0B264]/60 hover:text-white h-auto p-1"
                  >
                    ×
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <textarea
                    placeholder="Message to sign..."
                    value={messageToSign}
                    onChange={(e) => setMessageToSign(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-black/70 text-[#D0B264] p-1.5 rounded border border-[#D0B264]/30 placeholder-[#D0B264]/50 resize-none"
                  />
                  <Button
                    onClick={handleSignMessage}
                    disabled={!messageToSign}
                    className="w-full bg-[#D0B264] text-black hover:bg-[#D0B264]/80 disabled:opacity-50 px-2 py-1.5 rounded text-xs font-medium uppercase tracking-wide"
                  >
                    Sign Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
