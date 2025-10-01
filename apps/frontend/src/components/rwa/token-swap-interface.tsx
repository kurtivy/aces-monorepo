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

import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';

interface TokenSwapInterfaceProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  userBalance?: number;
  tokenAddress?: string;
  tokenName?: string;
  tokenOwner?: string;
  showFrame?: boolean;
  showHeader?: boolean;
  showProgression?: boolean;
  imageGallery?: string[];
  primaryImage?: string;
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
  const { walletAddress, isAuthenticated } = useAuth();

  // Contract state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);

  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  // Get current chain ID from wallet
  const getCurrentChainId = async (): Promise<number | null> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }

    try {
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      return parseInt(chainIdHex, 16);
    } catch (error) {
      console.error('Failed to get chain ID:', error);
      return null;
    }
  };

  // Get contract addresses for current chain
  const getCurrentContractAddresses = () => {
    return getContractAddresses(currentChainId || 8453); // Default to mainnet
  };

  // Update chain ID when wallet connects or changes
  useEffect(() => {
    const updateChainId = async () => {
      const chainId = await getCurrentChainId();
      if (chainId && chainId !== currentChainId) {
        console.log(`Chain ID changed from ${currentChainId} to ${chainId}`);
        setCurrentChainId(chainId);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      updateChainId();

      // Listen for chain changes
      const handleChainChanged = () => {
        console.log('Chain changed, updating...');
        updateChainId();
      };

      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [currentChainId]);

  // Bonding state
  const [tokenBonded, setTokenBonded] = useState<boolean>(false);
  const [bondingPercentage, setBondingPercentage] = useState<number>(0);

  // Balance state
  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');

  // Price quote state
  const [priceQuote, setPriceQuote] = useState<string>('0');
  const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');

  // UI state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  const { data: usdConversion, loading: priceLoading } = usePriceConversion(
    activeTab === 'buy' ? priceQuote : sellPriceQuote,
  );
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSlippageDropdown, setShowSlippageDropdown] = useState(false);
  const [loading, setLoading] = useState<string>('');
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const slippageOptions = ['0.5', '1.0', '2.0'];

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

  // Refresh balances and bonding status with circuit breaker error handling
  const refreshBalances = useCallback(async () => {
    if (!acesContract || !tokenAddress || !signer) {
      return;
    }

    try {
      // Verify signer is still valid before calling
      const address = await signer.getAddress();

      const acesBalance = await acesContract.balanceOf(address);
      const formattedAcesBalance = ethers.utils.formatEther(acesBalance);
      setAcesBalance(formattedAcesBalance);

      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const tokenBalance = await tokenContract.balanceOf(address);
      const formattedTokenBalance = ethers.utils.formatEther(tokenBalance);
      setTokenBalance(formattedTokenBalance);

      // Fetch bonding status from factory
      if (factoryContract) {
        try {
          const tokenInfo = await factoryContract.tokens(tokenAddress);
          const totalSupply = await tokenContract.totalSupply();
          const tokensBondedAt = tokenInfo.tokensBondedAt;

          // Calculate bonding percentage
          const currentSupply = parseFloat(ethers.utils.formatEther(totalSupply));
          const maxSupply = parseFloat(ethers.utils.formatEther(tokensBondedAt));
          const percentage = maxSupply > 0 ? (currentSupply / maxSupply) * 100 : 0;

          setTokenBonded(tokenInfo.tokenBonded);
          setBondingPercentage(Math.min(percentage, 100));
        } catch (bondingError) {
          console.error('Failed to fetch bonding status:', bondingError);
        }
      }
    } catch (error: unknown) {
      console.error('Failed to refresh balances:', error);

      // Check for circuit breaker errors specifically
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('circuit breaker')
      ) {
        console.log('Circuit breaker active - keeping existing balances, will retry later');
        // Don't clear balances for circuit breaker errors, just log and continue
        return;
      }

      // If signer is invalid, clean up state
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'UNSUPPORTED_OPERATION' || error.code === 'CALL_EXCEPTION')
      ) {
        console.log('Signer no longer valid, cleaning up...');
        setProvider(null);
        setSigner(null);
        setFactoryContract(null);
        setAcesContract(null);
        setAcesBalance('0');
        setTokenBalance('0');
        setTokenBonded(false);
        setBondingPercentage(0);
      }
    }
  }, [acesContract, tokenAddress, signer, factoryContract]);

  // Get buy price quote with circuit breaker handling
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

      // For circuit breaker errors, keep the last known price instead of setting to '0'
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('circuit breaker')
      ) {
        console.log('Circuit breaker active - keeping existing price quote');
        return; // Don't update price to '0'
      }

      setPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amount]);

  // Get sell price quote with circuit breaker handling
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

      // For circuit breaker errors, keep the last known price instead of setting to '0'
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('circuit breaker')
      ) {
        console.log('Circuit breaker active - keeping existing sell price quote');
        return; // Don't update price to '0'
      }

      setSellPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amount]);

  // Debounced price calculation
  const calculatePriceQuote = useCallback(() => {
    if (priceCalculationTimeoutRef.current) {
      clearTimeout(priceCalculationTimeoutRef.current);
    }

    priceCalculationTimeoutRef.current = setTimeout(() => {
      if (activeTab === 'buy') {
        getBuyPriceQuote();
      } else {
        getSellPriceQuote();
      }
    }, 1000);
  }, [activeTab, getBuyPriceQuote, getSellPriceQuote]);

  // Auto-initialize provider when user is authenticated
  useEffect(() => {
    const initializeFromAuth = async () => {
      if (
        isAuthenticated &&
        walletAddress &&
        !provider &&
        typeof window !== 'undefined' &&
        window.ethereum
      ) {
        try {
          // Check if wallet is actually connected
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
            console.log('No accounts connected, skipping initialization');
            return;
          }

          console.log('Auto-initializing provider from auth...');
          const newProvider = new ethers.providers.Web3Provider(window.ethereum);
          const newSigner = newProvider.getSigner();

          setProvider(newProvider);
          setSigner(newSigner);

          const addresses = getCurrentContractAddresses();
          const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
          setFactoryContract(factory);

          const acesAddress = addresses.ACES_TOKEN;
          const aces = new ethers.Contract(acesAddress, ERC20_ABI, newSigner);
          setAcesContract(aces);

          console.log('Auto-initialization complete');
        } catch (error) {
          console.error('Failed to initialize from auth:', error);
        }
      } else if (!isAuthenticated || !walletAddress) {
        // Clean up when disconnected
        console.log('User disconnected, cleaning up state...');
        setProvider(null);
        setSigner(null);
        setFactoryContract(null);
        setAcesContract(null);
        setAcesBalance('0');
        setTokenBalance('0');
        setPriceQuote('0');
        setSellPriceQuote('0');
      }
    };

    initializeFromAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, walletAddress, currentChainId]); // ✅ Removed provider from deps to prevent loop

  // Refresh balances only when properly connected
  useEffect(() => {
    if (acesContract && tokenAddress && signer && isAuthenticated) {
      refreshBalances();
    }
  }, [acesContract, tokenAddress, signer, isAuthenticated, refreshBalances]);

  // Update price quotes when amount or active tab changes
  useEffect(() => {
    calculatePriceQuote();
  }, [calculatePriceQuote]);

  // Connect wallet using direct MetaMask interaction
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setLoading('Connecting wallet...');
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();

        setProvider(provider);
        setSigner(signer);

        const addresses = getCurrentContractAddresses();
        const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, signer);
        setFactoryContract(factory);

        const acesAddress = addresses.ACES_TOKEN;
        const aces = new ethers.Contract(acesAddress, ERC20_ABI, signer);
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

      const address = await signer.getAddress();
      const currentAddresses = getCurrentContractAddresses();
      const currentAllowance = await acesContract.allowance(
        address,
        currentAddresses.FACTORY_PROXY,
      );
      const currentAcesBalance = await acesContract.balanceOf(address);

      console.log('Current allowance:', ethers.utils.formatEther(currentAllowance));
      console.log('Required amount:', ethers.utils.formatEther(priceWei));
      console.log('Current ACES balance:', ethers.utils.formatEther(currentAcesBalance));

      // Step 1: Approve ACES tokens
      setLoading('Approving ACES tokens...');
      const approveTx = await acesContract.approve(currentAddresses.FACTORY_PROXY, priceWei);
      await approveTx.wait();

      // Step 2: Buy tokens
      setLoading('Buying tokens...');
      const buyTx = await factoryContract.buyTokens(tokenAddress, amountWei, priceWei);
      await buyTx.wait();

      // Step 3: Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      setAmount('');
      setNetworkError(null); // Clear any previous network errors on success
    } catch (error) {
      console.error('Failed to buy tokens:', error);
      setLoading('');

      // Handle circuit breaker errors specifically
      if (error instanceof Error && error.message.includes('circuit breaker')) {
        setNetworkError('Network congestion detected. Please try again in a few minutes.');
        alert('Transaction failed due to network congestion. Please try again later.');
      } else {
        alert(`Buy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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

      const address = await signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const currentTokenBalance = await tokenContract.balanceOf(address);

      console.log('Current token balance:', ethers.utils.formatEther(currentTokenBalance));
      console.log('Estimated ACES received:', sellPriceQuote);

      if (currentTokenBalance.lt(amountWei)) {
        throw new Error(
          `Insufficient token balance! You have ${ethers.utils.formatEther(currentTokenBalance)} but trying to sell ${amount}`,
        );
      }

      setLoading('Selling tokens...');
      const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
      await tx.wait();

      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      setAmount('');
      setNetworkError(null); // Clear any previous network errors on success
    } catch (error) {
      console.error('Failed to sell tokens:', error);
      setLoading('');

      // Handle circuit breaker errors specifically
      if (error instanceof Error && error.message.includes('circuit breaker')) {
        setNetworkError('Network congestion detected. Please try again in a few minutes.');
        alert('Transaction failed due to network congestion. Please try again later.');
      } else {
        alert(`Sell failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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
                        unoptimized={true}
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
                tokenAddress={tokenAddress}
                currentAmount={currentAmount}
                targetAmount={targetAmount}
                percentage={percentage}
              />
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center ${
                  tokenBonded ? 'text-green-400' : 'text-[#D7BF75]/80'
                }`}
              >
                {tokenBonded
                  ? '✅ BONDED - 100%'
                  : `Bonded ${Math.min(bondingPercentage, 100).toFixed(1)}% / 100%`}
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

        {/* Network Error Banner */}
        {networkError && (
          <div className="mb-4 p-3 bg-orange-900/50 border border-orange-600/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-orange-200 text-sm">
                <span className="mr-2">⚠️</span>
                {networkError}
              </div>
              <button
                onClick={() => setNetworkError(null)}
                className="text-orange-200 hover:text-orange-100 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Bonding Complete Banner */}
        {tokenBonded && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-600/50 rounded-lg">
            <div className="flex items-center text-green-200 text-sm">
              <span className="mr-2">✅</span>
              <div>
                <div className="font-semibold">Bonding Complete!</div>
                <div className="text-xs mt-1 text-green-300">
                  This token has reached 100% bonding and is now trading on Aerodrome. Trading on
                  the bonding curve is disabled.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bonding Progress Warning (when close to 100%) */}
        {!tokenBonded && bondingPercentage >= 90 && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600/50 rounded-lg">
            <div className="flex items-center text-yellow-200 text-sm">
              <span className="mr-2">⚡</span>
              <div>
                <div className="font-semibold">Bonding Almost Complete</div>
                <div className="text-xs mt-1 text-yellow-300">
                  {bondingPercentage.toFixed(1)}% bonded. Once 100% is reached, this token will
                  migrate to Aerodrome LP.
                </div>
              </div>
            </div>
          </div>
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

        {/* Buy/Sell Button */}
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
              disabled={!amount || Number.parseFloat(amount) <= 0 || !!loading || tokenBonded}
              className={`w-full h-14 font-proxima-nova font-bold text-lg rounded-lg transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'bg-[#D0B284]/10 hover:bg-[#D0B284]/20 border border-[#D0B284] text-[#D0B284]'
                  : 'bg-[#8B4513] hover:bg-[#8B4513]/90 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {tokenBonded
                ? 'Bonding Complete - Trading Disabled'
                : loading || (activeTab === 'buy' ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`)}
            </Button>
          )}
        </div>

        {/* Quote Section */}
        <div className="min-h-[140px]">
          {amount && Number.parseFloat(amount) > 0 && (
            <div className="p-3 bg-[#1a2318]/50 rounded-lg border border-[#D0B284]/20 space-y-3">
              <div className="text-center border-b border-[#D0B284]/20 pb-2">
                <div className="text-sm font-bold text-[#D0B284]">
                  {activeTab === 'buy'
                    ? `Quote = ${priceQuote} $ACES`
                    : `Receive = ${sellPriceQuote} $ACES`}
                </div>

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
