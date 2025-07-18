'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Crown, ChevronDown, Search } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useICOContracts } from '@/hooks/use-ico-contracts';
import { parseEther, formatEther } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import Image from 'next/image';

interface ModalSwapInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol?: string;
}

type PaymentMethod = 'ETH' | 'USDC' | 'USDT';

interface Token {
  symbol: PaymentMethod;
  name: string;
  icon: string;
  color?: string;
}

const AVAILABLE_TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/svg/eth.svg',
    color: 'invert brightness-200',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/svg/usdc.svg',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    icon: '/svg/tether.svg',
  },
];

export default function ModalSwapInterface({
  isOpen,
  onClose,
  tokenSymbol = 'ACES',
}: ModalSwapInterfaceProps) {
  const { login, authenticated } = usePrivy();
  const { buyWithETH, buyWithUSDC, getETHQuote, getUSDCQuote } = useICOContracts();
  const { data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ETH');
  const [amount, setAmount] = useState('');
  const [expectedTokens, setExpectedTokens] = useState('0');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedToken =
    AVAILABLE_TOKENS.find((token) => token.symbol === paymentMethod) || AVAILABLE_TOKENS[0];
  const filteredTokens = AVAILABLE_TOKENS.filter(
    (token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Calculate expected tokens when amount changes
  useEffect(() => {
    const calculateExpectedTokens = async () => {
      if (!amount || Number(amount) <= 0) {
        setExpectedTokens('0');
        return;
      }

      try {
        let tokensOut = BigInt(0);

        if (paymentMethod === 'ETH') {
          const ethAmount = parseEther(amount);
          const quote = await getETHQuote(ethAmount);
          tokensOut = quote.tokensOut;
        } else if (paymentMethod === 'USDC' || paymentMethod === 'USDT') {
          const usdAmount = BigInt(Math.floor(Number(amount) * 1000000));
          const quote =
            paymentMethod === 'USDC'
              ? await getUSDCQuote(usdAmount)
              : await getUSDCQuote(usdAmount); // Assuming USDT uses same logic as USDC
          tokensOut = quote.tokensOut;
        }

        setExpectedTokens(formatEther(tokensOut));
      } catch (error) {
        console.error('Failed to get quote:', error);
        setExpectedTokens('0');
      }
    };

    const debounceTimer = setTimeout(calculateExpectedTokens, 500);
    return () => clearTimeout(debounceTimer);
  }, [amount, paymentMethod, getETHQuote, getUSDCQuote]);

  const handleTokenSelect = (token: PaymentMethod) => {
    setPaymentMethod(token);
    setShowTokenSelector(false);
    setSearchQuery('');
  };

  const handlePurchase = async () => {
    if (!acceptTerms) {
      alert('Please accept the terms and conditions');
      return;
    }

    try {
      if (paymentMethod === 'ETH') {
        const ethAmount = parseEther(amount);
        await buyWithETH(ethAmount);
      } else {
        const usdAmount = BigInt(Math.floor(Number(amount) * 1000000));
        await buyWithUSDC(usdAmount); // Assuming USDT uses same function as USDC
      }

      if (isConfirmed) {
        setAmount('');
        setExpectedTokens('0');
        onClose();
      }
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  if (!authenticated) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-[#231F20] border-[#D0B284]/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 font-serif">
              <Crown className="w-5 h-5 text-[#D0B284]" />
              Connect Wallet
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-[#D0B284]/10 rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-[#D0B284]" />
            </div>
            <p className="text-[#DCDDCC] text-center mb-8">
              Connect your wallet to participate in the {tokenSymbol} token launch
            </p>
            <Button
              onClick={login}
              className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-3 px-8 rounded-xl transition-all duration-200"
            >
              Connect Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Main Swap Modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-black border-[#D0B284]/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between font-serif">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#D0B284]" />
                Buy {tokenSymbol} Tokens
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Payment Input Tile */}
            <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[#DCDDCC] font-mono">PAY WITH</span>
                <Button
                  onClick={() => setShowTokenSelector(true)}
                  className="bg-[#231F20] hover:bg-[#231F20]/80 border border-[#D0B284]/30 rounded-full px-4 py-2 h-auto flex items-center gap-2 transition-all duration-200"
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-gradient-to-r ${selectedToken.color} flex items-center justify-center`}
                  >
                    <Image
                      src={selectedToken.icon}
                      alt={selectedToken.name}
                      width={24}
                      height={24}
                    />
                  </div>
                  <span className="text-white font-medium">{selectedToken.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-[#DCDDCC]" />
                </Button>
              </div>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent border-none text-3xl text-white p-0 h-auto focus-visible:ring-0 font-mono placeholder:text-[#928357]"
                step={paymentMethod === 'ETH' ? '0.000001' : '0.01'}
              />
            </div>

            {/* Receive Amount Tile */}
            <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[#DCDDCC] font-mono">YOU RECEIVE</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] flex items-center justify-center text-black text-sm font-bold">
                    A
                  </div>
                  <span className="text-[#D0B284] font-medium">{tokenSymbol}</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-[#D0B284] font-mono">
                {Number(expectedTokens) > 1000
                  ? `${(Number(expectedTokens) / 1000).toFixed(1)}K`
                  : Number(expectedTokens).toFixed(0)}
              </div>
              <div className="text-sm text-[#928357] font-mono mt-1">
                ≈ {Number(expectedTokens).toLocaleString()} {tokenSymbol} Tokens
              </div>
            </div>

            {/* Terms Tile */}
            <div className="bg-[#231F20]/30 rounded-xl border border-[#D0B284]/10 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="modal-terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 mt-1 text-[#D0B284] bg-[#231F20] border-[#928357] rounded focus:ring-[#D0B284] focus:ring-2"
                />
                <label htmlFor="modal-terms" className="text-sm text-[#DCDDCC] leading-relaxed">
                  I understand the risks and accept the terms and conditions of this token launch
                </label>
              </div>
            </div>

            {/* Purchase Button */}
            <Button
              onClick={handlePurchase}
              disabled={!acceptTerms || isPending || isConfirming || !amount || Number(amount) <= 0}
              className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-4 text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? 'Confirming in wallet...'
                : isConfirming
                  ? 'Processing transaction...'
                  : `Purchase ${tokenSymbol} with ${paymentMethod}`}
            </Button>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 font-mono">
                Transaction failed: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Token Selection Modal */}
      <Dialog open={showTokenSelector} onOpenChange={setShowTokenSelector}>
        <DialogContent className="bg-[#231F20] border-[#D0B284]/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between font-serif">
              <span>Select a token</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#928357]" />
              <Input
                placeholder="Search tokens"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#231F20]/50 border-[#D0B284]/20 text-[#DCDDCC] pl-10 rounded-xl font-mono placeholder:text-[#928357]"
              />
            </div>

            {/* Popular Tokens Grid */}
            <div className="grid grid-cols-3 gap-3">
              {AVAILABLE_TOKENS.map((token) => (
                <Button
                  key={token.symbol}
                  onClick={() => handleTokenSelect(token.symbol)}
                  className="bg-[#231F20]/50 hover:bg-[#231F20]/80 border border-[#D0B284]/20 rounded-xl p-4 h-auto flex flex-col items-center gap-2 transition-all duration-200"
                >
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-r ${token.color} flex items-center justify-center`}
                  >
                    <Image src={token.icon} alt={token.name} width={24} height={24} />
                  </div>
                  <span className="text-white font-medium text-sm">{token.symbol}</span>
                </Button>
              ))}
            </div>

            {/* Token List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="text-sm text-[#928357] font-mono mb-3">Popular tokens</div>
              {filteredTokens.map((token) => (
                <Button
                  key={token.symbol}
                  onClick={() => handleTokenSelect(token.symbol)}
                  className="w-full bg-[#231F20]/30 hover:bg-[#231F20]/60 border border-[#D0B284]/10 rounded-xl p-4 h-auto flex items-center gap-3 justify-start transition-all duration-200"
                >
                  <div
                    className={`w-8 h-8 rounded-full bg-gradient-to-r ${token.color} flex items-center justify-center`}
                  >
                    <Image src={token.icon} alt={token.name} width={24} height={24} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-white font-medium">{token.name}</span>
                    <span className="text-[#928357] text-sm font-mono">{token.symbol}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
