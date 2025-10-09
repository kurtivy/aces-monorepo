'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Wallet, ChevronDown, Settings } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import { DexApi, type DexQuoteResponse } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { useWallets } from '@privy-io/react-auth';
import { PercentageSelector } from './percentage-selector';

const DEFAULT_SLIPPAGE_BPS = 100;
const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;

const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];

interface TokenOption {
  symbol: string;
  name: string;
  icon: string;
  address?: string;
}

const TOKEN_OPTIONS: TokenOption[] = [
  { symbol: 'ACES', name: 'ACES Token', icon: '/aces-logo.png' },
  { symbol: 'WETH', name: 'Wrapped Ethereum', icon: '/svg/eth.svg' },
  { symbol: 'USDC', name: 'USD Coin', icon: '/svg/eth.svg' },
  { symbol: 'USDT', name: 'Tether USD', icon: '/svg/eth.svg' },
];

interface SwapCardProps {
  tokenSymbol?: string;
  tokenAddress?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  onSwapComplete?: () => void;
}

function ActionButton({
  isWalletConnected,
  isAuthLoading,
  onConnect,
  onSwap,
  isDisabled,
  loading,
  isDexMode,
}: {
  isWalletConnected: boolean;
  isAuthLoading: boolean;
  onConnect: () => void | Promise<void>;
  onSwap: () => void | Promise<void>;
  isDisabled: boolean;
  loading: string;
  isDexMode: boolean;
}) {
  return (
    <div className="mt-3">
      {!isWalletConnected ? (
        <motion.button
          className="
            h-11 w-full rounded-[16px]
            flex items-center justify-center gap-2 text-[#D0B264]
            transition-colors duration-150 bg-black hover:bg-black/80
            cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed font-spray-letters uppercase tracking-widest
            text-[18px]
          "
          disabled={isAuthLoading}
          onClick={onConnect}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Wallet className="h-5 w-5" />
          {isAuthLoading ? (
            <div className="flex items-center font-spray-letters uppercase tracking-widest">
              <span className="mr-2">Connecting</span>
              <span className="animate-pulse">...</span>
            </div>
          ) : (
            'Connect Wallet'
          )}
        </motion.button>
      ) : (
        <motion.button
          onClick={onSwap}
          disabled={isDisabled}
          className="
            h-16 w-full rounded-[16px]
            flex items-center justify-center gap-2 text-[#D0B264]
            transition-colors duration-150 bg-black hover:bg-black/80
            cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed font-spray-letters uppercase tracking-widest
            text-[32px]
          "
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {loading ? (
            <span className="flex items-center font-spray-letters uppercase tracking-widest">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {loading}
            </span>
          ) : isDexMode ? (
            <span className="font-spray-letters tracking-widest">SWAP</span>
          ) : (
            'SWAP'
          )}
        </motion.button>
      )}
    </div>
  );
}

export function SwapCard({
  tokenSymbol = 'TOKEN',
  tokenAddress,
  dexMeta = null,
  onSwapComplete,
}: SwapCardProps) {
  const { walletAddress, isAuthenticated, connectWallet, isLoading: isAuthLoading } = useAuth();
  const { wallets } = useWallets();

  // Contract state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  // UI state
  const [activeTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [paymentAsset, setPaymentAsset] = useState<'ACES' | 'USDC' | 'USDT' | 'ETH' | 'WETH'>(
    'ACES',
  );
  const [loading, setLoading] = useState('');
  const [tokenBonded, setTokenBonded] = useState(false);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [slippagePopoverOpen, setSlippagePopoverOpen] = useState(false);
  const [customSlippageInput, setCustomSlippageInput] = useState('');
  const slippagePopoverRef = useRef<HTMLDivElement>(null);
  const [sellTokenDropdownOpen, setSellTokenDropdownOpen] = useState(false);
  const [buyTokenDropdownOpen, setBuyTokenDropdownOpen] = useState(false);
  const [receivingToken, setReceivingToken] = useState<'ACES' | string>('ACES');

  // Balance state
  const [acesBalance, setAcesBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');

  // Price state
  const [priceQuote, setPriceQuote] = useState('0');
  const [sellPriceQuote, setSellPriceQuote] = useState('0');
  const [dexQuote, setDexQuote] = useState<DexQuoteResponse | null>(null);
  const [dexQuoteLoading, setDexQuoteLoading] = useState(false);
  const [dexSwapPending, setDexSwapPending] = useState(false);

  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Get current chain ID
  const getCurrentChainId = async (): Promise<number | null> => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    try {
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      return Number.parseInt(chainIdHex, 16);
    } catch (error) {
      console.error('Failed to get chain ID:', error);
      return null;
    }
  };

  const contractAddresses = useMemo(
    () => getContractAddresses(currentChainId || 84532),
    [currentChainId],
  );

  const routerAddress = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.AERODROME_ROUTER || '',
    [contractAddresses],
  );

  const isDexMode =
    tokenBonded &&
    Boolean(dexMeta?.isDexLive && dexMeta.poolAddress && tokenAddress && routerAddress);

  const amountValueWei = useMemo(() => {
    const trimmed = (amount || '').trim();
    if (!trimmed) return null;
    try {
      const parsed = ethers.utils.parseEther(trimmed);
      return parsed.gt(ethers.constants.Zero) ? parsed : null;
    } catch (error) {
      return null;
    }
  }, [amount]);

  const hasValidAmount = Boolean(amountValueWei);
  const isWalletConnected = isAuthenticated && !!walletAddress;

  const refreshBalances = useCallback(async () => {
    if (!acesContract || !tokenAddress || !signer) return;

    try {
      const address = await signer.getAddress();
      const acesBalanceValue = await acesContract.balanceOf(address);
      setAcesBalance(ethers.utils.formatEther(acesBalanceValue));

      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const tokenBalanceValue = await tokenContract.balanceOf(address);
      setTokenBalance(ethers.utils.formatEther(tokenBalanceValue));

      if (factoryContract) {
        try {
          const tokenInfo = await factoryContract.tokens(tokenAddress);
          setTokenBonded(tokenInfo.tokenBonded);
        } catch (error) {
          console.error('Failed to fetch bonding status:', error);
        }
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  }, [acesContract, tokenAddress, signer, factoryContract]);

  const ensureDexAllowance = useCallback(
    async (tokenAddr: string, amountRaw: string) => {
      if (!signer || !walletAddress || !routerAddress) {
        throw new Error('Wallet or router unavailable for approval');
      }

      const erc20Contract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const allowance: ethers.BigNumber = await erc20Contract.allowance(
        walletAddress,
        routerAddress,
      );
      const requiredAmount = ethers.BigNumber.from(amountRaw);

      if (allowance.gte(requiredAmount)) {
        return false;
      }

      setLoading('Awaiting approval...');
      const approveTx = await erc20Contract.approve(routerAddress, requiredAmount);
      setLoading('Confirming approval...');
      await approveTx.wait();
      return true;
    },
    [signer, walletAddress, routerAddress],
  );

  const executeDexSwap = useCallback(async () => {
    if (!isDexMode || !signer || !walletAddress || !dexQuote || !routerAddress) {
      setTransactionStatus({ type: 'error', message: 'Unable to execute swap' });
      return;
    }

    try {
      setDexSwapPending(true);
      setTransactionStatus(null);

      const routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
      const path = dexQuote.path.map((addr) => ethers.utils.getAddress(addr));
      const amountIn = ethers.BigNumber.from(dexQuote.inputAmountRaw);
      const amountOutMin = ethers.BigNumber.from(dexQuote.minOutputRaw);
      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

      let tx;

      if (paymentAsset === 'ETH' && activeTab === 'buy') {
        setLoading('Confirming swap...');
        tx = await routerContract.swapExactETHForTokens(
          amountOutMin,
          path,
          walletAddress,
          deadline,
          {
            value: amountIn,
          },
        );
      } else {
        const inputTokenAddress = path[0];
        await ensureDexAllowance(inputTokenAddress, dexQuote.inputAmountRaw);
        setLoading('Confirming swap...');
        tx = await routerContract.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          walletAddress,
          deadline,
        );
      }

      setLoading('Waiting for confirmation...');
      await tx.wait();

      setTransactionStatus({ type: 'success', message: 'Swap confirmed on Aerodrome.' });
      setAmount('');
      setDexQuote(null);
      await refreshBalances();
      onSwapComplete?.();
    } catch (error) {
      console.error('Dex swap failed:', error);
      const message = error instanceof Error ? error.message : 'Swap failed.';
      setTransactionStatus({ type: 'error', message });
    } finally {
      setDexSwapPending(false);
      setLoading('');
    }
  }, [
    isDexMode,
    signer,
    walletAddress,
    dexQuote,
    routerAddress,
    paymentAsset,
    activeTab,
    ensureDexAllowance,
    refreshBalances,
    onSwapComplete,
  ]);

  const buyTokens = useCallback(async () => {
    if (!factoryContract || !acesContract || !tokenAddress || !amountValueWei || !signer) return;

    setTransactionStatus(null);

    try {
      const priceWei = ethers.utils.parseEther(priceQuote);

      setLoading('Approving ACES tokens...');
      const approveTx = await acesContract.approve(contractAddresses.FACTORY_PROXY, priceWei);
      await approveTx.wait(2);

      setLoading('Buying tokens...');
      const buyTx = await factoryContract.buyTokens(tokenAddress, amountValueWei, priceWei);
      await buyTx.wait();

      setLoading('Refreshing balances...');
      await refreshBalances();

      setTransactionStatus({ type: 'success', message: 'Purchase successful!' });
      setAmount('');
      onSwapComplete?.();
    } catch (error) {
      console.error('Failed to buy tokens:', error);
      setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
    } finally {
      setLoading('');
    }
  }, [
    factoryContract,
    acesContract,
    tokenAddress,
    amountValueWei,
    signer,
    priceQuote,
    contractAddresses,
    refreshBalances,
    onSwapComplete,
  ]);

  const sellTokens = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !amountValueWei || !signer) return;

    setTransactionStatus(null);

    try {
      setLoading('Selling tokens...');
      const tx = await factoryContract.sellTokens(tokenAddress, amountValueWei);
      await tx.wait();

      setLoading('Refreshing balances...');
      await refreshBalances();

      setTransactionStatus({ type: 'success', message: 'Sale successful!' });
      setAmount('');
      onSwapComplete?.();
    } catch (error) {
      console.error('Failed to sell tokens:', error);
      setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
    } finally {
      setLoading('');
    }
  }, [factoryContract, tokenAddress, amountValueWei, signer, refreshBalances, onSwapComplete]);

  const initializeProvider = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !walletAddress) {
      setProvider(null);
      setSigner(null);
      setFactoryContract(null);
      setAcesContract(null);
      setAcesBalance('0');
      setTokenBalance('0');
      return false;
    }

    const normalizeAddress = (value: string) => {
      try {
        return ethers.utils.getAddress(value);
      } catch {
        return value;
      }
    };

    if (provider) {
      try {
        const signerAddress = await provider.getSigner().getAddress();
        if (normalizeAddress(signerAddress) === normalizeAddress(walletAddress)) {
          return true;
        }
      } catch (error) {
        console.error('Existing provider signer fetch failed:', error);
      }

      // Clear stale provider to re-initialize
      setProvider(null);
      setSigner(null);
    }

    if (typeof window === 'undefined') {
      return false;
    }

    try {
      let ethProvider = window.ethereum;

      if (!ethProvider && wallets?.length) {
        for (const wallet of wallets) {
          if (typeof wallet.getEthereumProvider === 'function') {
            try {
              const privyProvider = await wallet.getEthereumProvider();
              if (privyProvider) {
                ethProvider = privyProvider as typeof window.ethereum;
                break;
              }
            } catch (providerError) {
              console.error('Privy provider retrieval failed:', providerError);
            }
          }
        }
      }

      if (!ethProvider) {
        if (wallets?.length) {
          setTimeout(() => {
            initializeProvider().catch((retryError) =>
              console.error('Deferred provider initialization failed:', retryError),
            );
          }, 500);
        }
        return false;
      }

      const addresses = getContractAddresses(currentChainId || 84532);
      if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
        return false;
      }

      const newProvider = new ethers.providers.Web3Provider(ethProvider);
      const newSigner = newProvider.getSigner(walletAddress);

      setProvider(newProvider);
      setSigner(newSigner);

      const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
      setFactoryContract(factory);

      const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);
      setAcesContract(aces);

      return true;
    } catch (error) {
      console.error('Failed to initialize provider:', error);
      return false;
    }
  }, [isAuthenticated, walletAddress, provider, wallets, currentChainId]);

  useEffect(() => {
    initializeProvider();
  }, [initializeProvider]);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleSwap = async () => {
    if (!isWalletConnected) {
      await handleConnectWallet();
      return;
    }

    if (!provider) {
      const ready = await initializeProvider();
      if (!ready) {
        await handleConnectWallet();
        return;
      }
    }

    if (isDexMode) {
      await executeDexSwap();
      return;
    }

    if (activeTab === 'buy') {
      await buyTokens();
    } else {
      await sellTokens();
    }
  };

  // Update chain ID
  useEffect(() => {
    const updateChainId = async () => {
      const chainId = await getCurrentChainId();
      if (chainId && chainId !== currentChainId) {
        setCurrentChainId(chainId);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      updateChainId();
      window.ethereum.on('chainChanged', updateChainId);
      return () => window.ethereum?.removeListener('chainChanged', updateChainId);
    }
  }, [currentChainId]);

  // Refresh balances
  useEffect(() => {
    if (acesContract && tokenAddress && signer && isAuthenticated) {
      refreshBalances();
    }
  }, [acesContract, tokenAddress, signer, isAuthenticated, refreshBalances]);

  // Get price quotes
  useEffect(() => {
    if (isDexMode || !factoryContract || !tokenAddress || !amountValueWei) {
      if (!isDexMode) {
        setPriceQuote('0');
        setSellPriceQuote('0');
      }
      return;
    }

    const getQuotes = async () => {
      try {
        if (activeTab === 'buy') {
          const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountValueWei);
          setPriceQuote(ethers.utils.formatEther(buyPrice));
        } else {
          const sellPrice = await factoryContract.getSellPriceAfterFee(
            tokenAddress,
            amountValueWei,
          );
          setSellPriceQuote(ethers.utils.formatEther(sellPrice));
        }
      } catch (error) {
        console.error('Failed to get price quote:', error);
      }
    };

    const timeout = setTimeout(getQuotes, 500);
    return () => clearTimeout(timeout);
  }, [isDexMode, factoryContract, tokenAddress, amountValueWei, activeTab]);

  // Get DEX quotes
  useEffect(() => {
    if (!isDexMode || !tokenAddress || !hasValidAmount) {
      setDexQuote(null);
      return;
    }

    let cancelled = false;
    setDexQuoteLoading(true);

    const inputAsset = activeTab === 'sell' ? 'TOKEN' : paymentAsset;

    DexApi.getQuote(tokenAddress, {
      inputAsset,
      amount,
      slippageBps: slippageBps,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setDexQuote(result.data);
        } else {
          setDexQuote(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to fetch DEX quote:', error);
          setDexQuote(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDexQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDexMode, tokenAddress, paymentAsset, amount, hasValidAmount, activeTab, slippageBps]);

  // Clear transaction status after 5s
  useEffect(() => {
    if (!transactionStatus) return;
    const timeout = setTimeout(() => setTransactionStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [transactionStatus]);

  const displayQuote = isDexMode
    ? dexQuote?.expectedOutput || '0'
    : activeTab === 'buy'
      ? priceQuote
      : sellPriceQuote;

  // USD price calculation (simplified - in production would use price oracle/API)
  const usdPrice = useMemo(() => {
    if (!displayQuote || displayQuote === '0') return '0.00';

    // This is a simplified calculation - in production you'd fetch real USD prices
    // For demonstration, using a rough estimate based on token type
    const quoteValue = Number(displayQuote);
    let usdRate = 1; // Default for ACES

    if (paymentAsset === 'ETH' || paymentAsset === 'WETH') {
      usdRate = 2000; // Example ETH price
    } else if (paymentAsset === 'USDC' || paymentAsset === 'USDT') {
      usdRate = 1; // Stablecoins
    } else if (paymentAsset === tokenSymbol) {
      usdRate = 0.5; // Example RWA token price
    }

    const usdValue = quoteValue * usdRate;
    return usdValue.toFixed(2);
  }, [displayQuote, paymentAsset, tokenSymbol]);

  // Available token options including the dynamic RWA token
  const availableTokenOptions = useMemo(() => {
    const options = [...TOKEN_OPTIONS];
    if (tokenSymbol && tokenSymbol !== 'ACES') {
      options.push({
        symbol: tokenSymbol,
        name: `${tokenSymbol} Token`,
        icon: '/svg/eth.svg', // Default icon for RWA tokens
      });
    }
    return options;
  }, [tokenSymbol]);

  const selectedSellToken =
    availableTokenOptions.find((option) => option.symbol === paymentAsset) ||
    availableTokenOptions[0];

  // Receiving token options (ACES and RWA token)
  const receivingTokenOptions = useMemo(
    () => [
      { symbol: 'ACES', name: 'ACES Token', icon: '/aces-logo.png' },
      ...(tokenSymbol && tokenSymbol !== 'ACES'
        ? [
            {
              symbol: tokenSymbol,
              name: `${tokenSymbol} Token`,
              icon: '/svg/eth.svg',
            },
          ]
        : []),
    ],
    [tokenSymbol],
  );

  const selectedReceivingToken =
    receivingTokenOptions.find((option) => option.symbol === receivingToken) ||
    receivingTokenOptions[0];

  const isDisabled =
    !hasValidAmount || !!loading || (isDexMode && (dexQuoteLoading || dexSwapPending));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sellTokenDropdownOpen &&
        !(event.target as Element).closest('.token-dropdown-container')
      ) {
        setSellTokenDropdownOpen(false);
      }
      if (
        buyTokenDropdownOpen &&
        !(event.target as Element).closest('.buy-token-dropdown-container')
      ) {
        setBuyTokenDropdownOpen(false);
      }
      if (
        slippagePopoverOpen &&
        slippagePopoverRef.current &&
        !slippagePopoverRef.current.contains(event.target as Node)
      ) {
        setSlippagePopoverOpen(false);
      }
    };

    if (sellTokenDropdownOpen || buyTokenDropdownOpen || slippagePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sellTokenDropdownOpen, buyTokenDropdownOpen, slippagePopoverOpen]);

  const handlePercentageCalculated = (calculatedAmount: string) => {
    setAmount(calculatedAmount);
  };

  // Handle slippage preset button clicks
  const handleSlippagePreset = (bps: number) => {
    setSlippageBps(bps);
    setCustomSlippageInput('');
  };

  // Handle custom slippage input
  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippageInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      // Convert percentage to basis points (multiply by 100)
      setSlippageBps(Math.round(numValue * 100));
    }
  };

  // Calculate the appropriate balance for the percentage selector
  const percentageSelectorBalance = useMemo(() => {
    if (isDexMode) {
      // In DEX mode, use the selected sell token balance
      if (paymentAsset === 'ACES') {
        return acesBalance;
      } else if (paymentAsset === tokenSymbol) {
        return tokenBalance;
      }
      // For other tokens (WETH, USDC, USDT), we'd need additional balance fetching
      return '0';
    } else {
      // In non-DEX mode, use ACES balance for buying, token balance for selling
      return activeTab === 'buy' ? acesBalance : tokenBalance;
    }
  }, [isDexMode, paymentAsset, tokenSymbol, acesBalance, tokenBalance, activeTab]);

  // Sell-side balance helpers for display above token selector
  const sellSideBalanceFormatted = Number.isFinite(
    Number.parseFloat(
      paymentAsset === 'ACES' ? acesBalance : paymentAsset === tokenSymbol ? tokenBalance : '0',
    ),
  )
    ? Number.parseFloat(
        paymentAsset === 'ACES' ? acesBalance : paymentAsset === tokenSymbol ? tokenBalance : '0',
      ).toFixed(4)
    : '0.0000';

  return (
    <div role="region" aria-label="Swap interface">
      <PercentageSelector
        balance={percentageSelectorBalance}
        onAmountCalculated={handlePercentageCalculated}
        currentAmount={amount}
      />

      {/* Swap Panels */}
      <div className="mt-3 flex flex-col gap-0">
        {/* Sell/You sell pill */}
        <div className="rounded-2xl border-[0.5px] border-[#D0B264] bg-[var(--surface-1)] px-4 py-3 md:px-6">
          <div className="flex items-start justify-between">
            <div className="text-[14px] font-medium text-[#D0B264]/80">
              {activeTab === 'buy' ? 'Sell' : 'You sell'}
            </div>
            <div className="text-[10px] text-[#D0B264]/60 leading-none">
              Bal: <span className="font-mono text-[#D0B264]">{sellSideBalanceFormatted}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex flex-col">
                <div className="h-8 flex items-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="
                      w-full bg-transparent border-none outline-none
                      text-[28px] font-semibold tracking-tight text-foreground/95
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                    "
                  />
                </div>
                <div className="h-4 flex items-center">
                  <span className="text-[12px] text-[#D0B264]/70">$0</span>
                </div>
              </div>
            </div>

            {/* Token dropdown - vertically centered */}
            <div className="relative token-dropdown-container">
              <button
                type="button"
                onClick={() => setSellTokenDropdownOpen(!sellTokenDropdownOpen)}
                className="
                    inline-flex items-center gap-2 rounded-full
                    border-[0.5px] border-[#D0B264]/60 bg-black/40
                    px-4 py-2 transition-colors duration-150
                    hover:bg-black/55 focus:outline-none
                  "
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                  <Image
                    src={selectedSellToken?.icon || '/svg/eth.svg'}
                    alt={selectedSellToken?.symbol || 'Token'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                </span>
                <span className="text-[16px] font-semibold text-[#D0B264]">
                  {selectedSellToken?.symbol || 'ACES'}
                </span>
                <ChevronDown className="h-4 w-4 text-[#D0B264]/70" />
              </button>

              {/* Dropdown menu */}
              {sellTokenDropdownOpen && (
                <div className="absolute top-full  w-full min-w-[200px] bg-black/90 backdrop-blur-sm border border-[#D0B264]/30 rounded-lg shadow-lg z-50">
                  {availableTokenOptions.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => {
                        setPaymentAsset(token.symbol as typeof paymentAsset);
                        setSellTokenDropdownOpen(false);
                      }}
                      className="
                          w-full px-4 py-2 text-left hover:bg-[#D0B264]/10
                          transition-colors duration-150 flex items-center gap-2
                          first:rounded-t-lg last:rounded-b-lg
                        "
                    >
                      <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                        <Image
                          src={token.icon}
                          alt={token.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-semibold text-[#D0B264]">
                          {token.symbol}
                        </span>
                        <span className="text-[10px] text-[#D0B264]/60">{token.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buy/You receive pill */}
        <div className="rounded-2xl  px-4 py-3 md:px-6 bg-[#090a0976]">
          <div className="mb-1 text-[14px] font-medium text-[#D0B264]/80">
            {activeTab === 'buy' ? 'Buy' : 'You receive'}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-col">
                <div className="h-8 flex items-center">
                  <span className="text-[28px] font-semibold text-foreground/95">
                    {displayQuote && displayQuote !== '0'
                      ? Number(displayQuote).toFixed(4)
                      : '0.0000'}
                  </span>
                </div>
                <div className="h-4 flex items-center">
                  <span className="text-[14px] font-medium text-[#D0B264]/70">${usdPrice}</span>
                </div>
              </div>
            </div>

            {/* Receiving Token dropdown */}
            <div className="relative buy-token-dropdown-container">
              <button
                type="button"
                onClick={() => setBuyTokenDropdownOpen(!buyTokenDropdownOpen)}
                className="
                  inline-flex items-center gap-2 rounded-full
                  border-[0.5px] border-[#D0B264]/60 bg-black/40
                  px-4 py-2 text-[16px] font-extrabold text-[#D0B264]
                  transition-colors duration-150 hover:bg-black/55
                "
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                  <Image
                    src={selectedReceivingToken?.icon || '/svg/eth.svg'}
                    alt={selectedReceivingToken?.symbol || 'Token'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                </span>
                {selectedReceivingToken?.symbol || 'ACES'}
                <ChevronDown className="h-4 w-4 text-[#D0B264]/70" />
              </button>

              {/* Buy Token Dropdown menu */}
              {buyTokenDropdownOpen && (
                <div className="absolute top-full mt-2 w-full min-w-[200px] bg-black/90 backdrop-blur-sm border border-[#D0B264]/30 rounded-lg shadow-lg z-50">
                  {receivingTokenOptions.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => {
                        setReceivingToken(token.symbol as typeof receivingToken);
                        setBuyTokenDropdownOpen(false);
                      }}
                      className="
                        w-full px-4 py-2 text-left hover:bg-[#D0B264]/10
                        transition-colors duration-150 flex items-center gap-2
                        first:rounded-t-lg last:rounded-b-lg
                      "
                    >
                      <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                        <Image
                          src={token.icon}
                          alt={token.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-semibold text-[#D0B264]">
                          {token.symbol}
                        </span>
                        <span className="text-[10px] text-[#D0B264]/60">{token.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* (deleted the previous 'Balance ...' footer) */}
        </div>
      </div>

      {/* Slippage Control */}
      <div className="mt-3 flex items-center justify-end">
        <div className="relative" ref={slippagePopoverRef}>
          <button
            type="button"
            onClick={() => setSlippagePopoverOpen(!slippagePopoverOpen)}
            className="
              flex items-center gap-2 rounded-lg border-[0.5px] border-[#D0B264]/60
              bg-black/40 px-3 py-2 transition-colors duration-150
              hover:bg-black/55 focus:outline-none
            "
            aria-label="Slippage settings"
          >
            <Settings className="h-4 w-4 text-[#D0B264]" />
            <span className="text-[14px] font-semibold text-[#D0B264]">{slippageBps / 100}%</span>
          </button>

          {/* Slippage Popover */}
          <AnimatePresence>
            {slippagePopoverOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="
                  absolute right-0 bottom-full mb-2 z-50
                  w-[180px] rounded-lg border border-[#D0B264]/30
                  bg-black/95 backdrop-blur-sm shadow-xl
                  p-2.5
                "
              >
                {/* Input with Label */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-[11px] font-medium text-[#D0B264]/70 whitespace-nowrap">
                    Slippage
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={customSlippageInput || slippageBps / 100}
                      onChange={(e) => handleCustomSlippageChange(e.target.value)}
                      onFocus={(e) => {
                        if (!customSlippageInput) {
                          setCustomSlippageInput((slippageBps / 100).toString());
                        }
                        e.target.select();
                      }}
                      placeholder="Custom"
                      className="
                        w-full rounded-lg border-[0.5px] border-[#D0B264]/40
                        bg-black/40 px-2.5 py-1.5 pr-7
                        text-[13px] font-semibold text-[#D0B264]
                        focus:border-[#D0B264] focus:outline-none
                        transition-colors duration-150
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                      "
                      min="0"
                      max="50"
                      step="0.1"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#D0B264]/60">
                      %
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSlippagePreset(50)}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                      slippageBps === 50 && !customSlippageInput
                        ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                        : 'bg-black/40 text-[#D0B264]/70 border-[0.5px] border-[#D0B264]/30 hover:bg-black/60',
                    )}
                  >
                    0.5%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlippagePreset(100)}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                      slippageBps === 100 && !customSlippageInput
                        ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                        : 'bg-black/40 text-[#D0B264]/70 border-[0.5px] border-[#D0B264]/30 hover:bg-black/60',
                    )}
                  >
                    1%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlippagePreset(200)}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                      slippageBps === 200 && !customSlippageInput
                        ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                        : 'bg-black/40 text-[#D0B264]/70 border-[0.5px] border-[#D0B264]/30 hover:bg-black/60',
                    )}
                  >
                    2%
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast notification positioned at bottom */}
      {transactionStatus && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50',
            'rounded-lg px-6 py-4 text-sm font-medium shadow-lg backdrop-blur-sm',
            'min-w-[320px] max-w-[480px]',
            transactionStatus.type === 'success'
              ? 'bg-green-900/90 text-green-100 border border-green-700/50'
              : 'bg-red-900/90 text-red-100 border border-red-700/50',
          )}
        >
          <div className="flex items-center justify-center gap-2">
            {transactionStatus.type === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {transactionStatus.message}
          </div>
        </motion.div>
      )}

      {/* Action area */}
      <ActionButton
        isWalletConnected={isWalletConnected}
        isAuthLoading={isAuthLoading}
        onConnect={handleConnectWallet}
        onSwap={handleSwap}
        isDisabled={isDisabled}
        loading={loading}
        isDexMode={isDexMode}
      />
    </div>
  );
}

export default SwapCard;
