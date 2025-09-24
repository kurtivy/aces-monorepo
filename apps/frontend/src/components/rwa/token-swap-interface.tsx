'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
import ProgressionBar from './middle-column/overview/progression-bar';
import { usePriceConversion } from '@/hooks/use-price-conversion';

// Contract addresses
const CONTRACTS = {
  FACTORY_PROXY: '0xd484049526dF1325dEAc0D0DB67536b7431D8718',
};

// Minimal ABIs for other contracts
const ACES_TOKEN_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const LAUNCHPAD_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

const ACES_FACTORY_ABI = [
  'function acesTokenAddress() view returns (address)',
  'function getBuyPriceAfterFee(address token, uint256 amount) view returns (uint256)',
  'function getSellPriceAfterFee(address token, uint256 amount) view returns (uint256)',
  'function buyTokens(address token, uint256 amount, uint256 maxPrice) payable',
  'function sellTokens(address token, uint256 amount) returns (uint256)',
];

interface TokenSwapInterfaceProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  userBalance?: number;
  // Additional dynamic props for better integration
  tokenAddress?: string;
  tokenName?: string;
  tokenOwner?: string;
  showFrame?: boolean;
  showHeader?: boolean;
  showProgression?: boolean;
  imageGallery?: string[];
  // Primary image for the token (from listing.imageGallery[0])
  primaryImage?: string;
  // Progression bar props
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenAddress,
  showFrame = true,
  showHeader = true,
  showProgression = true,
  imageGallery,
  primaryImage,
  currentAmount,
  targetAmount,
  percentage = 26.9,
}: TokenSwapInterfaceProps) {
  // Wallet state from global auth
  const { walletAddress, isAuthenticated } = useAuth();

  // Contract state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);
  const [acesTokenAddress, setAcesTokenAddress] = useState<string>('');

  // Balance state
  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');

  // Price quote state
  const [priceQuote, setPriceQuote] = useState<string>('0');
  const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');

  // UI state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Price conversion hook
  const { data: usdConversion, loading: priceLoading } = usePriceConversion(
    activeTab === 'buy' ? priceQuote : sellPriceQuote,
  );
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSlippageDropdown, setShowSlippageDropdown] = useState(false);
  const [loading, setLoading] = useState<string>('');

  const [copied, setCopied] = useState(false);

  // Slippage options
  const slippageOptions = ['0.5', '1.0', '2.0'];

  // Debounce ref for price calculation
  const priceCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Refresh balances - memoized to prevent unnecessary re-renders
  const refreshBalances = useCallback(async () => {
    if (!acesContract || !tokenAddress || !signer) {
      console.log('Refresh balances skipped - missing requirements:', {
        acesContract: !!acesContract,
        tokenAddress,
        signer: !!signer,
      });
      return;
    }

    try {
      const address = await signer.getAddress();
      console.log('Refreshing balances for address:', address);
      console.log('Token address:', tokenAddress);

      // Refresh ACES balance
      const acesBalance = await acesContract.balanceOf(address);
      const formattedAcesBalance = ethers.utils.formatEther(acesBalance);
      setAcesBalance(formattedAcesBalance);
      console.log('ACES balance:', formattedAcesBalance);

      // Refresh token balance
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const tokenBalance = await tokenContract.balanceOf(address);
      const formattedTokenBalance = ethers.utils.formatEther(tokenBalance);
      setTokenBalance(formattedTokenBalance);
      console.log('Token balance:', formattedTokenBalance);
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  }, [acesContract, tokenAddress, signer]);

  // Get buy price quote - memoized
  const getBuyPriceQuote = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !amount) {
      setPriceQuote('0');
      return;
    }

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountWei);
      setPriceQuote(ethers.utils.formatEther(buyPrice));
    } catch (error) {
      console.error('Failed to get buy price quote:', error);
      setPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amount]);

  // Get sell price quote - memoized
  const getSellPriceQuote = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !amount) {
      setSellPriceQuote('0');
      return;
    }

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const sellPrice = await factoryContract.getSellPriceAfterFee(tokenAddress, amountWei);
      setSellPriceQuote(ethers.utils.formatEther(sellPrice));
    } catch (error) {
      console.error('Failed to get sell price quote:', error);
      setSellPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amount]);

  // Debounced price calculation - memoized
  const calculatePriceQuote = useCallback(() => {
    // Clear existing timeout
    if (priceCalculationTimeoutRef.current) {
      clearTimeout(priceCalculationTimeoutRef.current);
    }

    // Set new timeout for 1 second
    priceCalculationTimeoutRef.current = setTimeout(() => {
      if (activeTab === 'buy') {
        getBuyPriceQuote();
      } else {
        getSellPriceQuote();
      }
    }, 1000);
  }, [activeTab, getBuyPriceQuote, getSellPriceQuote]);

  // Auto-initialize provider when user is already authenticated through Privy
  useEffect(() => {
    const initializeFromAuth = async () => {
      console.log('Auto-init check:', {
        isAuthenticated,
        walletAddress,
        hasProvider: !!provider,
        hasEthereum: !!(typeof window !== 'undefined' && (window as any).ethereum),
      });

      if (
        isAuthenticated &&
        walletAddress &&
        !provider &&
        typeof window !== 'undefined' &&
        (window as any).ethereum
      ) {
        try {
          console.log('Auto-initializing provider from auth...');
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          const signer = provider.getSigner();

          setProvider(provider);
          setSigner(signer);

          // Initialize contracts
          const factory = new ethers.Contract(CONTRACTS.FACTORY_PROXY, ACES_FACTORY_ABI, signer);
          setFactoryContract(factory);

          // Get ACES token address
          const acesAddress = await factory.acesTokenAddress();
          setAcesTokenAddress(acesAddress);
          console.log('ACES token address:', acesAddress);

          const aces = new ethers.Contract(acesAddress, ACES_TOKEN_ABI, signer);
          setAcesContract(aces);

          console.log('Auto-initialization complete');
        } catch (error) {
          console.error('Failed to initialize from auth:', error);
        }
      }
    };

    initializeFromAuth();
  }, [isAuthenticated, walletAddress, provider]);

  // Refresh balances when dependencies change
  useEffect(() => {
    if (acesContract && tokenAddress && signer) {
      refreshBalances();
    }
  }, [acesContract, refreshBalances, signer, tokenAddress]);

  // Update price quotes when amount or active tab changes
  useEffect(() => {
    calculatePriceQuote();
  }, [calculatePriceQuote]);

  // Connect wallet using direct MetaMask interaction (like testing page)
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        setLoading('Connecting wallet...');
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();

        setProvider(provider);
        setSigner(signer);

        // Initialize contracts
        const factory = new ethers.Contract(CONTRACTS.FACTORY_PROXY, ACES_FACTORY_ABI, signer);
        setFactoryContract(factory);

        // Get ACES token address
        const acesAddress = await factory.acesTokenAddress();
        setAcesTokenAddress(acesAddress);

        const aces = new ethers.Contract(acesAddress, ACES_TOKEN_ABI, signer);
        setAcesContract(aces);

        setLoading('');
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        setLoading('');
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  // Buy tokens
  const buyTokens = async () => {
    if (!factoryContract || !acesContract || !tokenAddress || !amount || !signer) return;

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const priceWei = ethers.utils.parseEther(priceQuote);

      console.log('=== BUY TOKENS DEBUG ===');
      console.log('Token to buy:', tokenAddress);
      console.log('Amount (tokens):', amount);
      console.log('Price (ACES):', priceQuote);
      console.log('Amount Wei:', amountWei.toString());
      console.log('Price Wei:', priceWei.toString());

      // Check current allowance and balances
      const address = await signer.getAddress();
      const currentAllowance = await acesContract.allowance(address, CONTRACTS.FACTORY_PROXY);
      const currentAcesBalance = await acesContract.balanceOf(address);

      console.log('=== BALANCE CHECK ===');
      console.log('Current allowance:', ethers.utils.formatEther(currentAllowance));
      console.log('Required amount:', ethers.utils.formatEther(priceWei));
      console.log('Current ACES balance:', ethers.utils.formatEther(currentAcesBalance));
      console.log('Allowance sufficient:', currentAllowance.gte(priceWei));
      console.log('ACES balance sufficient:', currentAcesBalance.gte(priceWei));

      // Step 1: Approve ACES tokens
      setLoading('Approving ACES tokens...');
      console.log('Step 1: Approving ACES tokens for factory...');
      const approveTx = await acesContract.approve(CONTRACTS.FACTORY_PROXY, priceWei);
      console.log('Approval transaction sent:', approveTx.hash);
      await approveTx.wait();
      console.log('✅ Approval confirmed');

      // Step 2: Buy tokens
      setLoading('Buying tokens...');
      console.log('Step 2: Calling buyTokens...');

      const buyTx = await factoryContract.buyTokens(tokenAddress, amountWei, priceWei);
      console.log('Buy transaction sent:', buyTx.hash);
      await buyTx.wait();
      console.log('✅ Purchase confirmed');

      // Step 3: Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      console.log('🎉 Buy tokens completed successfully!');
    } catch (error) {
      console.error('Failed to buy tokens:', error);
      setLoading('');
      alert(`Buy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Sell tokens
  const sellTokens = async () => {
    if (!factoryContract || !tokenAddress || !amount || !signer) return;

    try {
      const amountWei = ethers.utils.parseEther(amount);

      console.log('=== SELL TOKENS DEBUG ===');
      console.log('Token to sell:', tokenAddress);
      console.log('Amount (tokens):', amount);
      console.log('Amount Wei:', amountWei.toString());

      // Check current token balance
      const address = await signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const currentTokenBalance = await tokenContract.balanceOf(address);

      console.log('=== SELL BALANCE CHECK ===');
      console.log('Current token balance:', ethers.utils.formatEther(currentTokenBalance));
      console.log('Amount to sell:', amount);
      console.log('Estimated ACES received:', sellPriceQuote);
      console.log('Token balance sufficient:', currentTokenBalance.gte(amountWei));

      if (currentTokenBalance.lt(amountWei)) {
        throw new Error(
          `Insufficient token balance! You have ${ethers.utils.formatEther(currentTokenBalance)} but trying to sell ${amount}`,
        );
      }

      setLoading('Selling tokens...');
      console.log('Executing sell transaction...');
      const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
      console.log('Sell transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Sell confirmed');

      // Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      console.log('🎉 Sell tokens completed successfully!');
    } catch (error) {
      console.error('Failed to sell tokens:', error);
      setLoading('');
      alert(`Sell failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="h-full">
      <div
        className={cn(
          'bg-[#151c16] h-full flex flex-col relative',
          showFrame
            ? 'rounded-lg border border-[#D0B284]/20 p-4 sm:p-6'
            : cn('px-4 sm:px-6 pb-6', showHeader ? 'pt-4' : 'pt-2'),
        )}
      >
        {showHeader && (
          <>
            <div className={cn('mb-4 sm:mb-6', !showFrame && 'px-0')}>
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#D0B284]/30">
                      <Image
                        src={getValidImageSrc(primaryImage || imageGallery?.[0], undefined, {
                          width: 24,
                          height: 24,
                          text: 'Token',
                        })}
                        alt={`${tokenSymbol} logo`}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                        onError={createImageErrorHandler({
                          fallbackText: 'Token',
                          width: 24,
                          height: 24,
                          onError: (src) => {
                            console.error('Token image failed to load:', src);
                          },
                          maxRetries: 1,
                        })}
                      />
                    </div>
                    <h2 className="text-[#D0B284] text-2xl font-mono font-bold leading-none">
                      ${tokenSymbol}
                    </h2>
                  </div>

                  {tokenAddress && (
                    <div className="flex items-center gap-2 rounded-md bg-black/20 px-3 py-1.5 border border-[#D0B284]/20 w-fit">
                      <span className="text-xs text-[#D0B284] font-mono">
                        {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(tokenAddress)}
                        className="flex h-4 w-4 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
                      >
                        {copied ? (
                          <Check className="h-2.5 w-2.5 text-[#D0B284]" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 text-[#D0B284]" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex w-full sm:w-auto flex-col sm:items-end gap-1 px-3 py-2 backdrop-blur-sm rounded-lg border border-[#D0B284]/10 sm:border-transparent">
                  <div className="flex items-start gap-2">
                    <span className="text-[#D0B284]/60 text-xs leading-none">Balance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D0B284]/60 text-xs">ACES:</span>
                    <span className="text-[#D0B284] font-mono text-xs">
                      {Number.parseFloat(acesBalance).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D0B284]/60 text-xs">{tokenSymbol}:</span>
                    <span className="text-[#D0B284] font-mono text-xs">
                      {Number.parseFloat(tokenBalance).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative -mx-6 mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="8"
                viewBox="0 0 100 2"
                preserveAspectRatio="none"
                className="pointer-events-none"
              >
                <line
                  x1="0"
                  y1="1"
                  x2="100"
                  y2="1"
                  stroke="#D0B284"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="12 12"
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="crispEdges"
                />
              </svg>
            </div>
          </>
        )}

        {showProgression && (
          <>
            <div className="mb-6">
              <ProgressionBar
                currentAmount={currentAmount}
                targetAmount={targetAmount}
                percentage={percentage}
              />
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
                Bonded {Math.min(percentage, 100).toFixed(1)}% / 100%
              </div>
            </div>

            <div className="relative -mx-6 mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="8"
                viewBox="0 0 100 2"
                preserveAspectRatio="none"
                className="pointer-events-none"
              >
                <line
                  x1="0"
                  y1="1"
                  x2="100"
                  y2="1"
                  stroke="#D0B284"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="12 12"
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="crispEdges"
                />
              </svg>
            </div>
          </>
        )}

        {/* Buy/Sell Tabs */}
        <div className="flex mb-6 bg-[#1a2318] rounded-lg p-1 border border-[#D0B284]/20">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'buy'
                ? 'bg-[#184D37] text-white shadow-lg'
                : 'text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'sell'
                ? 'bg-[#8B4513] text-white shadow-lg'
                : 'text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Slippage Dropdown */}
        <div className="flex justify-end mb-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSlippageDropdown(!showSlippageDropdown)}
              className="text-[#D0B284] hover:text-white border border-[#D0B284]/20 hover:border-[#D0B284]/40"
            >
              Slippage: {slippage}%
            </Button>

            {showSlippageDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-[#151c16] border border-[#D0B284]/30 rounded-lg shadow-lg z-50 min-w-[80px]">
                {slippageOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSlippage(option);
                      setShowSlippageDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-[#D0B284]/10 transition-colors ${
                      slippage === option
                        ? 'text-[#D0B284] bg-[#D0B284]/10'
                        : 'text-[#D0B284]/70 hover:text-[#D0B284]'
                    } ${option === slippageOptions[0] ? 'rounded-t-lg' : ''} ${
                      option === slippageOptions[slippageOptions.length - 1] ? 'rounded-b-lg' : ''
                    }`}
                  >
                    {option}%
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input Field */}
        <div className="mb-6">
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-16 text-2xl font-bold bg-[#1a2318] border-[#D0B284]/20 text-[#D0B284] placeholder:text-[#D0B284]/50 pr-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="w-8 h-8 bg-[#D0B284] rounded-full flex items-center justify-center">
                <span className="text-[#151c16] text-xs font-bold">{tokenSymbol}</span>
              </div>
              <span className="text-[#D0B284] font-semibold">{tokenSymbol}</span>
            </div>
          </div>
        </div>

        {/* Buy/Sell Button - Fixed Position */}
        <div className="mb-6">
          {!isAuthenticated || !provider ? (
            <Button
              onClick={connectWallet}
              disabled={!!loading}
              className="w-full h-14 bg-[#D0B284]/10 hover:bg-[#D0B284]/20 border border-[#D0B284] text-[#D0B284] font-proxima-nova font-bold text-lg rounded-lg disabled:opacity-50"
            >
              {loading || 'Connect Wallet'}
            </Button>
          ) : (
            <Button
              onClick={activeTab === 'buy' ? buyTokens : sellTokens}
              disabled={!amount || Number.parseFloat(amount) <= 0 || !!loading}
              className={`w-full h-14 font-proxima-nova font-bold text-lg rounded-lg transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'bg-[#D0B284]/10 hover:bg-[#D0B284]/20 border border-[#D0B284] text-[#D0B284]'
                  : 'bg-[#8B4513] hover:bg-[#8B4513]/90 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading || (activeTab === 'buy' ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`)}
            </Button>
          )}
        </div>

        {/* Combined Quote and Fees Section - Reserved Space */}
        <div className="min-h-[140px]">
          {amount && Number.parseFloat(amount) > 0 && (
            <div className="p-3 bg-[#1a2318]/50 rounded-lg border border-[#D0B284]/20 space-y-3">
              {/* Quote Section */}
              <div className="text-center border-b border-[#D0B284]/20 pb-2">
                <div className="text-sm font-bold text-[#D0B284]">
                  {activeTab === 'buy'
                    ? `Quote = ${priceQuote} $ACES`
                    : `Receive = ${sellPriceQuote} $ACES`}
                </div>

                {/* USD Conversion */}
                {usdConversion && (
                  <div className="text-xs text-[#D0B284]/70 mt-1">
                    {Number.parseFloat(usdConversion.usdValue) < 0.01
                      ? '≈ <$0.01 USD'
                      : `≈ $${usdConversion.usdValue} USD`}
                    {usdConversion.isStale && (
                      <span className="ml-1 text-[#D0B284]/50">(cached)</span>
                    )}
                  </div>
                )}

                {priceLoading && (
                  <div className="text-xs text-[#D0B284]/50 mt-1">Loading USD price...</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
