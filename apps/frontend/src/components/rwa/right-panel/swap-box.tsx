'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Copy, Check, Loader2, ChevronDown, Settings, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
import ProgressionBar from '@/components/rwa/middle-column/overview/progression-bar';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Import NEW unified hooks
import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
import { useTokenBalances } from '@/hooks/swap/use-token-balances';
import { useUnifiedQuote } from '@/hooks/swap/use-unified-quote';
import { useUnifiedSwap } from '@/hooks/swap/use-unified-swap';
import { useTokenAllowance } from '@/hooks/swap/use-token-allowance';
import { TransactionSuccessModal } from './transaction-success-modal';

// Import utilities
import { ethers } from 'ethers';
import { formatAmountForDisplay, formatUsdValue } from '@/lib/swap/formatters';
import type { PaymentAsset } from '@/lib/swap/types';
import { clampAmountDecimals } from '@/lib/swap/amount-utils';

import { PercentageSelector } from './percentage-selector';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import RoyalTradeButton from './royal-trade-button';
import GraffitiTradeButton from './graffiti-trade-button';

const USE_GRAFFITI_TRADE_BUTTON = true;
const ENABLE_SWAP_DEBUG_LOGS = process.env.NEXT_PUBLIC_ENABLE_SWAP_DEBUG === 'true';

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (ENABLE_SWAP_DEBUG_LOGS) {
    console.log(...args);
  }
};

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
  chainId?: number;
  tokenDecimals?: number;
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
  transactionStatus?: { type: 'success' | 'error'; message: string } | null;
  onTransactionStatusChange?: (
    status: { type: 'success' | 'error'; message: string } | null,
  ) => void;
}

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenAddress,
  tokenName,
  showFrame = true,
  showHeader = true,
  showProgression = true,
  imageGallery,
  primaryImage,
  chainId = 8453,
  tokenDecimals = 18,
  transactionStatus: externalTransactionStatus,
  onTransactionStatusChange,
}: TokenSwapInterfaceProps) {
  const TradeButtonComponent = USE_GRAFFITI_TRADE_BUTTON ? GraffitiTradeButton : RoyalTradeButton;
  const {
    walletAddress,
    isAuthenticated,
    connectWallet: authConnectWallet,
    isLoading: authIsLoading,
  } = useAuth();

  // Initialize contracts
  const contracts = useSwapContracts(walletAddress, isAuthenticated, tokenAddress);
  const { provider, signer, factoryContract, acesContract, currentChainId, initializationError } =
    contracts;

  // Get contract addresses
  const contractAddresses = useMemo(
    () => getContractAddresses(currentChainId || 8453),
    [currentChainId],
  );

  const routerAddress = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.AERODROME_ROUTER || '',
    [contractAddresses],
  );

  const permit2Address = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.PERMIT2 || '',
    [contractAddresses],
  );

  const factoryProxyAddress = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.FACTORY_PROXY || '',
    [contractAddresses],
  );

  // Helper function to get token address for a given asset
  const getTokenAddressForAsset = useCallback(
    (asset: string): string | null => {
      const normalized = asset?.toUpperCase();
      switch (normalized) {
        case 'ACES':
          return contractAddresses?.ACES_TOKEN || null;
        case 'USDC':
          return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
        case 'USDT':
          return '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'; // Base USDT
        case 'ETH':
        case 'WETH':
          return null; // No approval needed for ETH
        default:
          return null;
      }
    },
    [contractAddresses],
  );

  // Helper function to check if asset is an ERC20 token (needs approval)
  const isERC20Token = useCallback((asset: string): boolean => {
    const normalized = asset?.toUpperCase();
    return ['ACES', 'USDC', 'USDT'].includes(normalized);
  }, []);

  // All tokens are DEX mode now - hardcode values
  const isDexMode = true;
  const bondingPercentage = 100;
  const tokenBonded = true;
  const bondingLoading = false;
  const canSwap = true;

  // Debug logging for DEX mode detection
  // useEffect(() => {
  //   console.log('[SwapBox] DEX Mode Debug:', {
  //     isDexMode,
  //     tokenBonded,
  //     bondingPercentage,
  //     dexMeta,
  //     routerAddress,
  //     tokenAddress,
  //   });
  // }, [isDexMode, tokenBonded, bondingPercentage, dexMeta, routerAddress, tokenAddress]);

  // Debug logging for contract initialization
  // useEffect(() => {
  //   console.log('[SwapBox] Contract Initialization State:', {
  //     isAuthenticated,
  //     walletAddress,
  //     hasProvider: !!provider,
  //     hasSigner: !!signer,
  //     hasFactoryContract: !!factoryContract,
  //     hasAcesContract: !!acesContract,
  //     isInitialized,
  //     initializationError,
  //   });
  // }, [
  //   isAuthenticated,
  //   walletAddress,
  //   provider,
  //   signer,
  //   factoryContract,
  //   acesContract,
  //   isInitialized,
  //   initializationError,
  // ]);

  // Manage balances
  const balances = useTokenBalances({
    acesContract,
    tokenContract: contracts.tokenContract,
    signer,
    factoryContract,
    tokenAddress,
    chainId: currentChainId || chainId,
  });

  const { acesBalance, tokenBalance, stableBalances, refreshBalances } = balances;

  // ========================================
  // UI STATE (Keep for backward compatibility)
  // ========================================
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>('ACES');
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebouncedValue(amount, 150); // 150ms for quicker quote reaction to input
  const [loading, setLoading] = useState<string>('');
  const [localTransactionStatus, setLocalTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [slippageBps, setSlippageBps] = useState(300);
  const [slippagePopoverOpen, setSlippagePopoverOpen] = useState(false);
  const [customSlippageInput, setCustomSlippageInput] = useState('');
  const slippagePopoverRef = useRef<HTMLDivElement | null>(null);
  const [isMdBreakpoint, setIsMdBreakpoint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    return width >= 768 && width < 1024;
  });

  // Use external status if provided, otherwise fall back to local
  const transactionStatus = externalTransactionStatus ?? localTransactionStatus;
  const setTransactionStatus = onTransactionStatusChange ?? setLocalTransactionStatus;

  // Success modal state (shown for RWA buys)
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState('');
  const [successTokenAmount, setSuccessTokenAmount] = useState('0');
  const [successSpentAmount, setSuccessSpentAmount] = useState('0');
  const [successSpentAsset, setSuccessSpentAsset] = useState<
    'ACES' | 'USDC' | 'USDT' | 'ETH' | 'WETH'
  >('ACES');

  useEffect(() => {
    if (!slippagePopoverOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        slippagePopoverRef.current &&
        !slippagePopoverRef.current.contains(event.target as HTMLElement)
      ) {
        setSlippagePopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [slippagePopoverOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMdBreakpoint(width >= 768 && width < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatBalanceDisplay = useCallback(
    (rawBalance: string | null | undefined, decimals: number) => {
      const formatted = formatAmountForDisplay(rawBalance ?? '0', decimals);
      if (isMdBreakpoint && formatted !== '0' && !formatted.startsWith('<')) {
        const numeric = Number.parseFloat(formatted.replace(/,/g, ''));
        if (Number.isFinite(numeric)) {
          return numeric.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
      }
      return formatted;
    },
    [isMdBreakpoint],
  );

  const sellOptions = useMemo(() => {
    // Buying: support ETH/USDC/ACES and the RWA token
    if (activeTab === 'buy') {
      return [
        { value: 'ETH', label: 'ETH' },
        { value: 'USDC', label: 'USDC' },
        { value: 'ACES', label: 'ACES' },
        ...(tokenSymbol ? [{ value: tokenSymbol, label: tokenSymbol }] : []),
      ];
    }

    // Selling RWA → ACES only
    return [
      { value: 'ACES', label: 'ACES' },
      { value: tokenSymbol, label: tokenSymbol },
    ];
  }, [activeTab, tokenSymbol]);

  // Helper function to get token image
  const getTokenImage = useCallback(
    (asset: string) => {
      const normalized = asset?.toUpperCase();
      const symbolUpper = tokenSymbol?.toUpperCase();

      if (normalized && symbolUpper && normalized === symbolUpper) {
        return getValidImageSrc(primaryImage || imageGallery?.[0], undefined, {
          width: 20,
          height: 20,
          text: tokenSymbol,
        });
      }

      switch (normalized) {
        case 'ETH':
        case 'WETH':
          return '/svg/eth.svg';
        case 'USDC':
          return '/svg/usdc.svg';
        case 'USDT':
          return '/svg/tether.svg';
        case 'ACES':
          return '/aces-logo.png';
        default:
          return '/aces-logo.png';
      }
    },
    [tokenSymbol, primaryImage, imageGallery],
  );

  const buyOptions = useMemo(() => {
    // When selling RWA, only ACES should be available at the bottom
    if (activeTab === 'sell') {
      return ['ACES'];
    }
    const rawOptions = [tokenSymbol, 'ACES'].filter(
      (option): option is string => typeof option === 'string' && option.length > 0,
    );
    return Array.from(new Set(rawOptions));
  }, [tokenSymbol, activeTab]);

  const selectedSellAsset = activeTab === 'sell' ? tokenSymbol : paymentAsset;
  const selectedBuyAsset = activeTab === 'sell' ? 'ACES' : tokenSymbol;

  const handleSellAssetChange = useCallback(
    (value: string) => {
      if (value === tokenSymbol) {
        setActiveTab('sell');
        return;
      }

      setActiveTab('buy');
      setPaymentAsset(value as PaymentAsset);
    },
    [tokenSymbol, setActiveTab, setPaymentAsset],
  );

  const handleBuyAssetChange = useCallback(
    (value: string) => {
      if (value === tokenSymbol) {
        setActiveTab('buy');
      } else {
        setActiveTab('sell');
      }
    },
    [tokenSymbol, setActiveTab],
  );

  const getAssetBalanceInfo = useCallback(
    (asset: string | undefined) => {
      const normalized = asset?.toUpperCase();
      const symbolUpper = tokenSymbol?.toUpperCase();

      if (normalized && symbolUpper && normalized === symbolUpper) {
        return {
          rawBalance: tokenBalance ?? '0',
          decimals: tokenDecimals,
        };
      }

      switch (normalized) {
        case 'ACES':
          return {
            rawBalance: acesBalance ?? '0',
            decimals: 18,
          };
        case 'USDC':
          return {
            rawBalance: stableBalances?.USDC ?? '0',
            decimals: 6,
          };
        case 'USDT':
          return {
            rawBalance: stableBalances?.USDT ?? '0',
            decimals: 6,
          };
        case 'ETH':
        case 'WETH':
          return {
            rawBalance: stableBalances?.ETH ?? '0',
            decimals: 18,
          };
        default:
          return {
            rawBalance: '0',
            decimals: 18,
          };
      }
    },
    [tokenSymbol, tokenBalance, tokenDecimals, acesBalance, stableBalances],
  );

  const sellBalanceInfo = useMemo(
    () => getAssetBalanceInfo(selectedSellAsset),
    [selectedSellAsset, getAssetBalanceInfo],
  );

  const buyBalanceInfo = useMemo(
    () => getAssetBalanceInfo(selectedBuyAsset),
    [selectedBuyAsset, getAssetBalanceInfo],
  );

  // Enforce integer-only input when selling the dynamic RWA token
  const effectiveSellDecimals = useMemo(() => {
    const isSellingRwa =
      (selectedSellAsset || '').toUpperCase() === (tokenSymbol || '').toUpperCase();
    return isSellingRwa ? 0 : sellBalanceInfo.decimals;
  }, [selectedSellAsset, tokenSymbol, sellBalanceInfo.decimals]);

  const sellAssetLabel = useMemo(() => {
    const match = sellOptions.find((option) => option.value === selectedSellAsset);
    return match?.label ?? selectedSellAsset ?? '';
  }, [sellOptions, selectedSellAsset]);

  const buyAssetLabel = useMemo(() => {
    const match = buyOptions.find((option) => option === selectedBuyAsset);
    return match ?? selectedBuyAsset ?? '';
  }, [buyOptions, selectedBuyAsset]);

  const hasValidAmount = useMemo(() => {
    if (!amount || amount.trim() === '') return false;
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    return true;
  }, [amount]);

  // Token allowance is declared after the quote hook so the spender
  // can be derived from quote.isSlipstream (V2 Router vs CL SwapRouter).
  // See below after useUnifiedQuote.

  // ========================================
  // UNIFIED LOGIC (Map UI state to sellToken/buyToken)
  // ========================================
  const { sellToken, buyToken } = useMemo(() => {
    // Map activeTab + paymentAsset to sellToken/buyToken
    if (activeTab === 'buy') {
      // Buying TOKEN with ACES (or other assets)
      return {
        sellToken: paymentAsset, // ACES, WETH, USDC, USDT
        buyToken: 'TOKEN' as const,
      };
    } else {
      // Selling TOKEN for ACES
      return {
        sellToken: 'TOKEN' as const,
        buyToken: 'ACES' as const,
      };
    }
  }, [activeTab, paymentAsset]);

  // ========================================
  // UNIFIED QUOTE HOOK
  // ========================================
  const quote = useUnifiedQuote({
    tokenAddress,
    sellToken,
    buyToken,
    amount: debouncedAmount,
    isDexMode,
    slippageBps,
    enabled: !!tokenAddress,
  });

  // ========================================
  // UNIFIED SWAP HOOK
  // ========================================
  const swap = useUnifiedSwap({
    factoryContract,
    acesContract,
    signer,
    walletAddress,
    factoryProxyAddress,
    tokenAddress: tokenAddress || '',
    routerAddress,
    isDexMode,
  });

  // ========================================
  // TOKEN ALLOWANCE (after quote so we know the correct spender)
  // ========================================
  const isQuoteSlipstream = !!(quote.quote as any)?.isSlipstream;
  const spenderAddress = useMemo(
    () => (isQuoteSlipstream ? permit2Address : routerAddress) || null,
    [isQuoteSlipstream, permit2Address, routerAddress],
  );

  const tokenAllowance = useTokenAllowance({
    tokenAddress: getTokenAddressForAsset(selectedSellAsset),
    ownerAddress: walletAddress,
    spenderAddress,
    signer,
    enabled: isERC20Token(selectedSellAsset) && hasValidAmount,
  });

  const isOutputToken =
    (selectedBuyAsset || '').toUpperCase() === (tokenSymbol || '').toUpperCase();
  const isRwaBuy = activeTab === 'buy' && isOutputToken;
  const isTokenQuoteLoading = hasValidAmount && quote.loading;
  const isUsdQuoteLoading = hasValidAmount && quote.loading;

  // ========================================
  // USD DISPLAY (from unified quote)
  // ========================================
  const inputUsdDisplay = useMemo(() => {
    return quote.inputUsdValue ? formatUsdValue(quote.inputUsdValue) : null;
  }, [quote.inputUsdValue]);

  const outputUsdDisplay = useMemo(() => {
    return quote.outputUsdValue ? formatUsdValue(quote.outputUsdValue) : null;
  }, [quote.outputUsdValue]);

  // ========================================
  // VALIDATION
  // ========================================
  // Check if swap is supported (bonding curve removed - only DEX)
  const isSwapSupported = useMemo(() => {
    if (quote.strategy === 'none') return false;
    // Only DEX swaps are supported now
    return quote.strategy === 'dex';
  }, [quote.strategy]);

  // Check if output amount meets minimum requirement (1 token for multi-hop RWA buys)
  const minimumAmountWarning = useMemo(() => {
    if (!hasValidAmount || !quote.needsMultiHop || !isRwaBuy) return null;

    const outputNum = Number.parseFloat(quote.outputAmount || '0');
    if (outputNum < 1 && outputNum > 0) {
      return `Minimum purchase is 1 ${tokenSymbol} token. Please increase your ${selectedSellAsset} amount to buy at least 1 token.`;
    }
    return null;
  }, [
    hasValidAmount,
    quote.needsMultiHop,
    quote.outputAmount,
    isRwaBuy,
    tokenSymbol,
    selectedSellAsset,
  ]);

  // Debug logging for swap button state
  useEffect(() => {
    const assetInfo = getAssetBalanceInfo(selectedSellAsset);
    void (
      isDexMode &&
      isERC20Token(selectedSellAsset) &&
      !tokenAllowance.hasAllowance(amount, assetInfo.decimals) &&
      hasValidAmount
    );
    // console.log('[SwapBox] 🔍 Swap Button State:', {
    //   hasValidAmount,
    //   loading,
    //   canSwap,
    //   isSwapSupported,
    //   quoteStrategy: quote.strategy,
    //   quoteOutputAmount: quote.outputAmount,
    //   quoteLoading: quote.loading,
    //   quoteError: quote.error,
    //   amount,
    //   sellToken,
    //   buyToken,
    //   isDexMode,
    //   selectedSellAsset,
    //   isERC20: isERC20Token(selectedSellAsset),
    //   decimals: assetInfo.decimals,
    //   needsApproval,
    //   willShowApprovalButton: needsApproval,
    //   willShowSwapButton: !needsApproval,
    //   buttonDisabled: !hasValidAmount || !!loading || !canSwap || !isSwapSupported,
    //   disabledReasons: {
    //     noValidAmount: !hasValidAmount,
    //     isLoading: !!loading,
    //     cantSwap: !canSwap,
    //     swapNotSupported: !isSwapSupported,
    //   },
    // });
  }, [
    hasValidAmount,
    loading,
    canSwap,
    isSwapSupported,
    quote,
    amount,
    sellToken,
    buyToken,
    isDexMode,
    selectedSellAsset,
    tokenAllowance,
    isERC20Token,
    getAssetBalanceInfo,
  ]);

  // ========================================
  // HANDLERS
  // ========================================
  const handleAmountChange = useCallback(
    (rawValue: string) => {
      const normalized = rawValue.replace(/,/g, '');
      const clamped = clampAmountDecimals(normalized, effectiveSellDecimals);
      setAmount(clamped);
    },
    [effectiveSellDecimals],
  );

  const handlePercentageCalculated = useCallback(
    (calculatedAmount: string, _percentage: number | null) => {
      const clamped = clampAmountDecimals(calculatedAmount, effectiveSellDecimals);
      setAmount(clamped);
    },
    [effectiveSellDecimals],
  );

  const handleSlippagePreset = useCallback((bps: number) => {
    setSlippageBps(bps);
    setCustomSlippageInput('');
    setSlippagePopoverOpen(false);
  }, []);

  const handleCustomSlippageChange = useCallback((value: string) => {
    setCustomSlippageInput(value);
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 50) {
      setSlippageBps(Math.round(parsed * 100));
    }
  }, []);

  const percentageSelectorBalance = sellBalanceInfo.rawBalance;

  useEffect(() => {
    if (!amount) return;
    const clamped = clampAmountDecimals(amount, effectiveSellDecimals);
    if (clamped !== amount) {
      setAmount(clamped);
    }
  }, [amount, effectiveSellDecimals]);

  // Flip assets between Buy (sell ACES/etc -> buy RWA) and Sell (sell RWA -> buy ACES)
  const handleFlipAssets = useCallback(() => {
    if (activeTab === 'buy') {
      setActiveTab('sell');
    } else {
      setActiveTab('buy');
      setPaymentAsset('ACES');
    }
  }, [activeTab, setActiveTab, setPaymentAsset]);

  const amountDigitCount = useMemo(() => {
    if (!amount) return 0;
    const [integerPart] = amount.split('.');
    return integerPart.replace(/^0+/, '').length || 1;
  }, [amount]);

  const formattedAmount = useMemo(() => {
    if (!amount) return amount;
    const [integerPart = '', decimalPart] = amount.split('.');
    const normalizedInt = integerPart.replace(/^0+(?=\d)/, '');
    const formattedInt =
      normalizedInt.length > 3
        ? normalizedInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : normalizedInt || (integerPart.startsWith('0') ? '0' : '');
    if (decimalPart !== undefined) {
      return `${formattedInt}.${decimalPart}`;
    }
    return formattedInt;
  }, [amount]);

  const outputAmountDisplay = useMemo(() => {
    if (!hasValidAmount || !quote.outputAmount) {
      return isOutputToken ? '0' : '0.00';
    }

    if (isOutputToken) {
      return formatIntegerDisplay(quote.outputAmount);
    }

    return formatDecimalDisplay(quote.outputAmount, 4);
  }, [hasValidAmount, quote.outputAmount, isOutputToken]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleConnectWallet = useCallback(async () => {
    try {
      setLoading('Connecting wallet...');
      await authConnectWallet();
      // Wait a bit for wallet to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setLoading('');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setTransactionStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect wallet',
      });
      setLoading('');
    }
  }, [authConnectWallet, setTransactionStatus]);

  // ========================================
  // UNIFIED SWAP HANDLER
  // ========================================
  const handleSwapClick = useCallback(async () => {
    if (!isSwapSupported) {
      setTransactionStatus({
        type: 'error',
        message: 'This swap is not yet supported.',
      });
      return;
    }

    // Validate minimum output amount for multi-hop swaps (ETH/USDC/USDT → RWA)
    if (quote.needsMultiHop && isRwaBuy) {
      const outputNum = Number.parseFloat(quote.outputAmount || '0');
      if (outputNum < 1) {
        setTransactionStatus({
          type: 'error',
          message: `Minimum purchase is 1 ${tokenSymbol} token. Please increase your ${selectedSellAsset} amount.`,
        });
        return;
      }
    }

    try {
      setLoading('Preparing swap...');

      const result = await swap.executeSwap({
        sellToken,
        buyToken,
        amount,
        quote,
        onStatus: setLoading,
      });

      if (result.success) {
        // If buying the RWA token, show full-screen success modal
        if (isRwaBuy) {
          setSuccessTxHash(result.hash || result.receipt?.transactionHash || '');
          setSuccessTokenAmount(quote.outputAmount || '0');
          setSuccessSpentAmount(amount);
          setSuccessSpentAsset(
            (selectedSellAsset as 'ACES' | 'USDC' | 'USDT' | 'ETH' | 'WETH') || 'ACES',
          );
          setSuccessModalOpen(true);
        } else {
          // Otherwise show a toast (e.g., ACES buys)
          setTransactionStatus({
            type: 'success',
            message: 'Swap confirmed on Aerodrome!',
          });
        }
        setAmount('');
        await refreshBalances();
      } else {
        setTransactionStatus({
          type: 'error',
          message: result.error || 'Transaction failed',
        });
      }
    } catch (error) {
      console.error('Swap failed:', error);
      setTransactionStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Transaction failed',
      });
    } finally {
      setLoading('');
    }
  }, [
    isSwapSupported,
    swap,
    sellToken,
    buyToken,
    amount,
    quote,
    refreshBalances,
    isRwaBuy,
    selectedSellAsset,
    tokenSymbol,
    setTransactionStatus,
  ]);

  // ========================================
  // APPROVAL HANDLER (for DEX mode - any ERC20 token)
  // ========================================
  const handleApproveToken = useCallback(async () => {
    const tokenAddr = getTokenAddressForAsset(selectedSellAsset);

    if (!signer || !spenderAddress || !tokenAddr) {
      console.error('[SwapBox] Missing required data for approval', {
        hasSigner: !!signer,
        hasSpender: !!spenderAddress,
        tokenAddr,
        selectedSellAsset,
      });
      return;
    }

    const spender = spenderAddress;

    try {
      setLoading('Requesting approval...');

      // USDT on Base doesn't return a boolean from approve(), so we need a special ABI
      // that doesn't expect a return value to avoid decoding errors
      const isUSDT = selectedSellAsset === 'USDT';
      const ERC20_ABI = isUSDT
        ? ['function approve(address spender, uint256 amount)'] // No return type for USDT
        : ['function approve(address spender, uint256 amount) returns (bool)'];

      const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

      const UNLIMITED_APPROVAL = ethers.constants.MaxUint256;

      debugLog(`[SwapBox] Requesting unlimited ${selectedSellAsset} approval for Aerodrome...`, {
        tokenAddr,
        spender,
        isUSDT,
      });

      const tx = await tokenContract.approve(spender, UNLIMITED_APPROVAL);

      setLoading('Confirming approval...');
      await tx.wait();

      // console.log(`[SwapBox] ✅ ${selectedSellAsset} approval confirmed`);

      // Refresh allowance
      await tokenAllowance.refetch();

      setTransactionStatus({
        type: 'success',
        message: `${selectedSellAsset} spending approved!`,
      });
    } catch (error) {
      console.error('[SwapBox] Approval failed:', error);
      setTransactionStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Approval failed',
      });
    } finally {
      setLoading('');
    }
  }, [
    signer,
    spenderAddress,
    selectedSellAsset,
    getTokenAddressForAsset,
    tokenAllowance,
    setTransactionStatus,
  ]);

  // Auto-detect and display errors (minimum amount warnings, DEX quote errors)
  useEffect(() => {
    // Don't override transaction errors while a transaction is in-flight
    if (transactionStatus?.type === 'error' && loading) return;
    if (transactionStatus?.type === 'success') return;

    let dexError = quote.strategy === 'dex' && quote.error && hasValidAmount ? quote.error : null;

    // Improve DEX error copy
    if (dexError && /route pool not found/i.test(dexError)) {
      dexError = 'DEX pool not found. Please contact support.';
    }
    if (dexError && /pool not found|pool not supported/i.test(dexError)) {
      dexError = 'DEX pool not found. Please contact support.';
    }
    const nextMessage = minimumAmountWarning ?? dexError ?? null;

    // Set error only if it actually changed
    if (nextMessage) {
      if (transactionStatus?.type !== 'error' || transactionStatus.message !== nextMessage) {
        setTransactionStatus({ type: 'error', message: nextMessage });
      }
      return;
    }

    // Clear auto errors when conditions are no longer met
    if (transactionStatus?.type === 'error') {
      setTransactionStatus(null);
    }
  }, [
    minimumAmountWarning,
    quote.strategy,
    quote.error,
    hasValidAmount,
    transactionStatus,
    loading,
    setTransactionStatus,
  ]);

  // ========================================
  // RENDER (UI UNCHANGED)
  // ========================================
  return (
    <div className="h-full overflow-x-hidden">
      <div
        className={cn(
          ' h-full flex flex-col relative',
          showFrame ? '' : cn('px-4 sm:px-6 pb-6', showHeader ? 'pt-4' : 'pt-2'),
        )}
      >
        {showHeader && (
          <>
            <div className={cn('mb-4 sm:mb-6', showFrame ? 'px-6 pt-6' : '')}>
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
                          onError: (src) => console.error('Token image failed:', src),
                          maxRetries: 1,
                        })}
                        unoptimized={true}
                      />
                    </div>
                    <h2 className="text-[#D0B284] text-xl md:text-2xl xl:text-3xl font-mono font-bold leading-none">
                      ${tokenSymbol}
                    </h2>
                  </div>

                  {tokenAddress && (
                    <div className="flex items-center gap-1.5 md:gap-2 rounded-md bg-black/20 px-2 py-1 md:px-2.5 md:py-1.5 border border-[#D0B284]/20 w-fit">
                      <span className="text-[11px] md:text-xs text-[#D0B284] font-mono">
                        {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(tokenAddress)}
                        className="flex h-3.5 w-3.5 md:h-4 md:w-4 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
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

                <div className="flex w-full sm:w-auto flex-col sm:items-end gap-0.5 md:gap-1 px-2.5 py-1.5 md:px-3 md:py-2 backdrop-blur-sm rounded-lg border border-[#D0B284]/10 sm:border-transparent">
                  <div className="flex items-start gap-2">
                    <span className="text-[#D0B284]/60 text-[11px] md:text-xs leading-none">
                      Balance
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D0B284]/60 text-xs">ACES:</span>
                    <span className="text-[#D0B284] font-mono text-xs">
                      {formatBalanceDisplay(acesBalance, 18)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D0B284]/60 text-xs">{tokenSymbol}:</span>
                    <span className="text-[#D0B284] font-mono text-xs">
                      {formatBalanceDisplay(tokenBalance, 18)}
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
                chainId={chainId}
                percentage={100}
                isBondedOverride={true}
              />
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
                BONDED - 100%
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

        {/* Swap interface */}
        <div className={cn('flex-1 min-h-0 space-y-6 md:space-y-5 overflow-y-auto px-0 pb-6')}>
          {/* Unified interface - handles both bonding curve and DEX mode via unified hooks */}
          <div className="flex flex-col gap-3 md:gap-4 xl:gap-5">
            {/* Percentage Selector */}
            <PercentageSelector
              balance={percentageSelectorBalance}
              onAmountCalculated={handlePercentageCalculated}
              currentAmount={amount}
              className="md:[&>button]:px-3 md:[&>button]:py-3 md:[&>button]:text-sm md:[&>button]:text-[13px] md:[&>button]:tracking-[0.15em] xl:[&>button]:px-5 xl:[&>button]:py-4 xl:[&>button]:text-[15px]"
            />

            <div className="space-y-3 md:space-y-2relative">
              {/* Sell Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm font-semibold text-[#D0B284]">Sell</span>
                    <div className="relative flex items-center" ref={slippagePopoverRef}>
                      <button
                        type="button"
                        onClick={() => setSlippagePopoverOpen((prev) => !prev)}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[#D0B284]/70 transition-colors duration-150 hover:text-[#D0B284] focus:outline-none"
                        aria-label="Slippage settings"
                      >
                        <Settings className="h-3 w-3" />
                        <span className="pt-[1px] text-[11px] font-semibold">
                          {slippageBps / 100}%
                        </span>
                      </button>

                      <AnimatePresence>
                        {slippagePopoverOpen && (
                          <motion.div
                            initial={{ opacity: 0, x: 10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-full top-1/2 z-50 ml-3 w-[180px] -translate-y-1/2 rounded-lg border border-[#D0B264]/30 bg-black/95 p-2.5 shadow-xl backdrop-blur-sm"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <div className="whitespace-nowrap text-[11px] font-medium text-[#D0B264]/70">
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
                                  className="w-full rounded-lg border-[0.5px] border-[#D0B264]/40 bg-black/40 px-2.5 py-1.5 pr-7 text-[13px] font-semibold text-[#D0B264] transition-colors duration-150 focus:border-[#D0B264] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                onClick={() => handleSlippagePreset(100)}
                                className={cn(
                                  'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                                  slippageBps === 100 && !customSlippageInput
                                    ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                                    : 'border-[0.5px] border-[#D0B264]/30 bg-black/40 text-[#D0B264]/70 hover:bg-black/60',
                                )}
                              >
                                1%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSlippagePreset(300)}
                                className={cn(
                                  'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                                  slippageBps === 300 && !customSlippageInput
                                    ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                                    : 'border-[0.5px] border-[#D0B264]/30 bg-black/40 text-[#D0B264]/70 hover:bg-black/60',
                                )}
                              >
                                3%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSlippagePreset(500)}
                                className={cn(
                                  'rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all duration-150',
                                  slippageBps === 500 && !customSlippageInput
                                    ? 'bg-[#D0B264]/20 text-[#D0B264] border-[0.5px] border-[#D0B264]'
                                    : 'border-[0.5px] border-[#D0B264]/30 bg-black/40 text-[#D0B264]/70 hover:bg-black/60',
                                )}
                              >
                                5%
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <span className="text-xs text-[#D0B284]/70">
                    Balance{' '}
                    {formatBalanceDisplay(sellBalanceInfo.rawBalance, sellBalanceInfo.decimals)}{' '}
                    {sellAssetLabel}
                  </span>
                </div>

                <div className=" bg-[#0B0F0B] px-5 py-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="flex w-full items-center gap-6">
                    <div className="relative flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-full border border-[#D0B284]/25 bg-black/70 px-4 py-2.5 text-sm font-semibold text-[#D0B284] transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
                          >
                            <Image
                              src={getTokenImage(selectedSellAsset || '')}
                              alt={sellAssetLabel}
                              width={20}
                              height={20}
                              className={cn(
                                'object-contain',
                                selectedSellAsset?.toUpperCase() === tokenSymbol?.toUpperCase()
                                  ? 'rounded-full'
                                  : '',
                              )}
                              unoptimized={true}
                            />
                            <span>{sellAssetLabel}</span>
                            <ChevronDown className="h-4 w-4 text-[#D0B284]/60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="min-w-[140px] bg-black/95 border-[#D0B284]/30 backdrop-blur-sm"
                        >
                          {sellOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => handleSellAssetChange(option.value)}
                              className="flex items-center gap-2 cursor-pointer text-[#D0B284] hover:bg-[#D0B284]/10 focus:bg-[#D0B284]/10"
                            >
                              <Image
                                src={getTokenImage(option.value)}
                                alt={option.label}
                                width={20}
                                height={20}
                                className={cn(
                                  'object-contain',
                                  option.value.toUpperCase() === tokenSymbol?.toUpperCase()
                                    ? 'rounded-full'
                                    : '',
                                )}
                                unoptimized={true}
                              />
                              <span>{option.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-1 flex-col items-end gap-1">
                      <input
                        value={formattedAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        onBlur={() => quote.refreshQuote?.()}
                        placeholder="0"
                        inputMode={effectiveSellDecimals === 0 ? 'numeric' : 'decimal'}
                        className={cn(
                          'w-full border-none bg-transparent text-right font-semibold text-white outline-none focus:ring-0 placeholder:text-[#D0B284]/30 transition-all',
                          amountDigitCount > 10
                            ? 'text-lg md:text-xl xl:text-2xl'
                            : 'text-2xl md:text-3xl xl:text-4xl',
                        )}
                      />
                      <div className="flex items-center justify-end gap-2 text-xs md:text-sm text-[#D0B284]/60">
                        {isUsdQuoteLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#D0B284]" />
                        ) : hasValidAmount && inputUsdDisplay ? (
                          <>≈ {inputUsdDisplay}</>
                        ) : (
                          '≈ $0.00 USD'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flip button (centered between sections without layout shift) */}
              <button
                type="button"
                onClick={handleFlipAssets}
                aria-label="Flip sell and buy"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border border-[#D0B284]/30 bg-black/80 text-[#D0B284] hover:bg-black/60 shadow-md flex items-center justify-center"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>

              {/* Buy Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs md:text-sm font-semibold text-[#D0B284]">
                    {activeTab === 'buy' ? 'Buy' : 'Receive'}
                  </span>
                  <span className="text-xs text-[#D0B284]/70">
                    Balance{' '}
                    {formatBalanceDisplay(buyBalanceInfo.rawBalance, buyBalanceInfo.decimals)}{' '}
                    {buyAssetLabel}
                  </span>
                </div>

                <div className="bg-[#0B0F0B] px-5 py-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="flex w-full items-center gap-6">
                    <div className="relative flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-full border border-[#D0B284]/25 bg-black/70 px-4 py-2.5 text-sm font-semibold text-[#D0B284] transition-colors hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
                          >
                            <Image
                              src={getTokenImage(selectedBuyAsset || '')}
                              alt={buyAssetLabel}
                              width={20}
                              height={20}
                              className={cn(
                                'object-contain',
                                selectedBuyAsset?.toUpperCase() === tokenSymbol?.toUpperCase()
                                  ? 'rounded-full'
                                  : '',
                              )}
                              unoptimized={true}
                            />
                            <span>{buyAssetLabel}</span>
                            <ChevronDown className="h-4 w-4 text-[#D0B284]/60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="min-w-[140px] bg-black/95 border-[#D0B284]/30 backdrop-blur-sm"
                        >
                          {buyOptions.map((option) => (
                            <DropdownMenuItem
                              key={option}
                              onClick={() => handleBuyAssetChange(option)}
                              className="flex items-center gap-2 cursor-pointer text-[#D0B284] hover:bg-[#D0B284]/10 focus:bg-[#D0B284]/10"
                            >
                              <Image
                                src={getTokenImage(option)}
                                alt={option}
                                width={20}
                                height={20}
                                className={cn(
                                  'object-contain',
                                  option.toUpperCase() === tokenSymbol?.toUpperCase()
                                    ? 'rounded-full'
                                    : '',
                                )}
                                unoptimized={true}
                              />
                              <span>{option}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-1 flex-col items-end gap-1 text-right">
                      <div className="min-h-[32px] md:min-h-[36px] flex items-center justify-end">
                        {isTokenQuoteLoading ? (
                          <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-[#D0B284]" />
                        ) : (
                          <span
                            className={cn(
                              'font-semibold transition-all text-2xl md:text-3xl xl:text-4xl',
                              hasValidAmount && quote.outputAmount
                                ? 'text-white/90'
                                : 'text-[#D0B284]/30',
                            )}
                          >
                            {outputAmountDisplay}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center justify-end gap-2 text-xs md:text-sm text-[#D0B284]/60">
                          {isUsdQuoteLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#D0B284]" />
                          ) : hasValidAmount && outputUsdDisplay ? (
                            <>≈ {outputUsdDisplay}</>
                          ) : (
                            '≈ $0.00 USD'
                          )}
                        </div>
                        {!isUsdQuoteLoading &&
                          hasValidAmount &&
                          quote.minOutputUsdValue &&
                          quote.minOutputUsdValue !== outputUsdDisplay && (
                            <div className="text-[10px] text-[#D0B284]/50">
                              min. {formatUsdValue(quote.minOutputUsdValue)}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className=" flex justify-center">
              {!isAuthenticated ? (
                <TradeButtonComponent
                  className="w-full max-w-[240px] md:max-w-[260px] xl:max-w-[320px]"
                  state="connect"
                  size="xl"
                  onClick={handleConnectWallet}
                  disabled={!!loading || authIsLoading}
                  loading={!!loading || authIsLoading}
                  fullWidth
                />
              ) : !provider || initializationError ? (
                <>
                  <TradeButtonComponent
                    className="w-full max-w-[240px] md:max-w-[260px] xl:max-w-[320px]"
                    state="connect"
                    size="lg"
                    disabled={!!initializationError}
                    loading={!initializationError}
                    fullWidth
                  />
                  {initializationError && (
                    <div className="mt-2 text-center text-xs text-red-400/80 max-w-[240px] md:max-w-[260px] xl:max-w-[320px]">
                      Wallet connection issue. Try refreshing or disabling extra wallet extensions.
                    </div>
                  )}
                </>
              ) : (
                (() => {
                  const assetInfo = getAssetBalanceInfo(selectedSellAsset);
                  const needsApproval =
                    isERC20Token(selectedSellAsset) &&
                    !tokenAllowance.hasAllowance(amount, assetInfo.decimals) &&
                    hasValidAmount;

                  return needsApproval ? (
                    <TradeButtonComponent
                      className="w-full max-w-[240px] md:max-w-[260px] xl:max-w-[320px]"
                      state="approve"
                      size="xl"
                      onClick={handleApproveToken}
                      disabled={!!loading}
                      loading={!!loading}
                      fullWidth
                    />
                  ) : (
                    <TradeButtonComponent
                      className="w-full max-w-[240px] md:max-w-[260px] xl:max-w-[320px]"
                      state="trade"
                      size="xl"
                      onClick={handleSwapClick}
                      disabled={!hasValidAmount || !!loading || !canSwap || !isSwapSupported}
                      loading={!!loading}
                      fullWidth
                    />
                  );
                })()
              )}
            </div>

            <div className="text-center">
              <span className="text-xs font-mono text-[#D0B284]/60 uppercase">
                POWERED BY AERODROME
              </span>
            </div>

            {ENABLE_SWAP_DEBUG_LOGS && hasValidAmount && quote.outputAmount && (
              <div className="mt-3 rounded-lg border border-[#D0B284]/30 bg-black/30 p-3 text-left">
                <div className="text-xs font-mono text-[#D0B284]/80 uppercase mb-1.5">
                  Quote debug
                </div>
                <div className="text-xs text-white/70 space-y-0.5 font-mono">
                  <div>strategy: {quote.strategy}</div>
                  <div>outputAmount: {quote.outputAmount}</div>
                  {quote.path?.length ? <div>path: {quote.path.join(' → ')}</div> : null}
                  {activeTab === 'buy' &&
                    selectedSellAsset === 'ACES' &&
                    Number.parseFloat(quote.outputAmount) > 0 && (
                      <div>
                        implied:{' '}
                        {((Number(amount) || 0) / Number.parseFloat(quote.outputAmount)).toFixed(2)}{' '}
                        ACES per 1 {tokenSymbol}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Success modal for RWA buys */}
          {successModalOpen && (
            <TransactionSuccessModal
              isOpen={successModalOpen}
              onClose={() => setSuccessModalOpen(false)}
              transactionHash={successTxHash}
              tokenSymbol={tokenSymbol || 'RWA'}
              tokenAmount={successTokenAmount}
              acesSpent={successSpentAmount}
              spentAssetSymbol={successSpentAsset}
              chainId={currentChainId || chainId}
              title={tokenName || tokenSymbol || 'RWA'}
              imageSrc={primaryImage || imageGallery?.[0]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatIntegerDisplay(value: string | null | undefined): string {
  if (!value) return '0';
  const normalized = value.includes('.') ? value.split('.')[0] : value;
  const trimmed = normalized.trim();
  if (trimmed === '' || trimmed === '-') return '0';

  try {
    return BigInt(trimmed).toLocaleString();
  } catch {
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      return '0';
    }
    return Math.floor(parsed).toLocaleString();
  }
}

function formatDecimalDisplay(value: string | null | undefined, fractionDigits = 4): string {
  const parsed = Number.parseFloat(value || '0');
  if (!Number.isFinite(parsed)) {
    return '0.00';
  }
  return parsed.toFixed(fractionDigits);
}
