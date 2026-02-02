'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';
import { Copy, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
import ProgressionBar from './middle-column/overview/progression-bar';
import { usePriceConversion } from '@/hooks/use-price-conversion';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { DexApi, type DexQuoteResponse } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';

import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_SLIPPAGE_BPS = 100; // 1% slippage
const SUPPORTED_DEX_ASSETS = ['ACES', 'USDC', 'USDT', 'ETH'] as const;
const DEX_FALLBACK_ADDRESSES = {
  USDC:
    process.env.NEXT_PUBLIC_AERODROME_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C0b43d5Ee1fCD46a7B3',
  ETH:
    process.env.NEXT_PUBLIC_AERODROME_WETH_ADDRESS || '0x4200000000000000000000000000000000000006',
  USDT:
    process.env.NEXT_PUBLIC_AERODROME_USDT_ADDRESS || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
} as const;
const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];
const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;

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
  chainId?: number; // Base Sepolia = 84532, Base Mainnet = 8453
  dexMeta?: DatabaseListing['dex'] | null;
  // Deprecated props (kept for backward compatibility)
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

const DEFAULT_ETH_PRICE = 3000; // TODO: replace with live oracle feed for ETH/USD pricing

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenAddress,
  showFrame = true,
  showHeader = true,
  showProgression = true,
  imageGallery,
  primaryImage,
  chainId = 8453, // Default to Base Mainnet
  dexMeta = null,
}: TokenSwapInterfaceProps) {
  const { walletAddress, isAuthenticated, connectWallet: authConnectWallet } = useAuth();

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
    return getContractAddresses(currentChainId || 8453);
  };

  const contractAddresses = useMemo(getCurrentContractAddresses, [currentChainId]);
  const routerAddress = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.AERODROME_ROUTER || '',
    [contractAddresses],
  );

  const dexAssetAddresses = useMemo(
    () => ({
      ACES: (contractAddresses.ACES_TOKEN || '').toLowerCase(),
      USDC: (DEX_FALLBACK_ADDRESSES.USDC || '').toLowerCase(),
      ETH: (DEX_FALLBACK_ADDRESSES.ETH || '').toLowerCase(),
      USDT: (DEX_FALLBACK_ADDRESSES.USDT || '').toLowerCase(),
    }),
    [contractAddresses],
  );

  // Update chain ID when wallet connects or changes
  useEffect(() => {
    const updateChainId = async () => {
      const chainId = await getCurrentChainId();
      if (chainId && chainId !== currentChainId) {
        debugLog(`Chain ID changed from ${currentChainId} to ${chainId}`);
        setCurrentChainId(chainId);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      updateChainId();

      // Listen for chain changes (if provider supports it)
      const handleChainChanged = () => {
        debugLog('Chain changed, updating...');
        updateChainId();
      };

      // Check if provider supports event listeners (Privy smart wallets may not)
      if (typeof window.ethereum.on === 'function') {
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
          window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
        };
      }
    }
  }, [currentChainId]);

  // Bonding state
  const [tokenBonded, setTokenBonded] = useState<boolean>(false);
  const [bondingPercentage, setBondingPercentage] = useState<number>(0);

  // Balance state
  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [remainingCurveTokensWei, setRemainingCurveTokensWei] = useState<ethers.BigNumber | null>(
    null,
  );

  // Price quote state
  const [priceQuote, setPriceQuote] = useState<string>('0');
  const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');
  const [dexQuote, setDexQuote] = useState<DexQuoteResponse | null>(null);
  const [dexQuoteLoading, setDexQuoteLoading] = useState(false);
  const [dexQuoteError, setDexQuoteError] = useState<string | null>(null);
  const [dexSwapPending, setDexSwapPending] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [paymentAsset, setPaymentAsset] = useState<'ACES' | 'USDC' | 'USDT' | 'ETH'>('ACES');

  const { data: usdConversion, loading: priceLoading } = usePriceConversion(
    activeTab === 'buy' ? priceQuote : sellPriceQuote,
  );
  const [amount, setAmount] = useState('');
  /* TODO(Aerodrome API): Re-enable slippage controls when hooked into swap routing */
  // const [slippage, setSlippage] = useState('0.5');
  // const [showSlippageDropdown, setShowSlippageDropdown] = useState(false);
  const [loading, setLoading] = useState<string>('');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [unsupportedNetwork, setUnsupportedNetwork] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const {
    bondingPercentage: readOnlyBondingPercentage,
    isBonded: readOnlyIsBonded,
    loading: readOnlyBondingLoading,
    currentSupply: readOnlyCurrentSupply,
    tokensBondedAt: readOnlyTokensBondedAt,
  } = useTokenBondingData(tokenAddress, chainId);

  const readOnlyRemainingTokensWei = useMemo(() => {
    if (!readOnlyTokensBondedAt || !readOnlyCurrentSupply) {
      return null;
    }

    try {
      const maxWei = ethers.utils.parseEther(readOnlyTokensBondedAt);
      const currentWei = ethers.utils.parseEther(readOnlyCurrentSupply);
      if (maxWei.lte(currentWei)) {
        return ethers.constants.Zero;
      }
      return maxWei.sub(currentWei);
    } catch (error) {
      console.warn('Failed to parse read-only bonding supply values:', error);
      return null;
    }
  }, [readOnlyTokensBondedAt, readOnlyCurrentSupply]);

  const normalizedWalletPercentage = Number.isFinite(bondingPercentage) ? bondingPercentage : 0;
  const normalizedReadOnlyPercentage = Number.isFinite(readOnlyBondingPercentage)
    ? readOnlyBondingPercentage
    : 0;
  const combinedBondingPercentage = Math.min(
    100,
    Math.max(normalizedWalletPercentage, normalizedReadOnlyPercentage),
  );
  const combinedIsBonded = tokenBonded || readOnlyIsBonded || combinedBondingPercentage >= 100;
  const isDexMode =
    combinedIsBonded &&
    Boolean(dexMeta?.isDexLive && dexMeta.poolAddress && tokenAddress && routerAddress);
  const dexTradeUrl = useMemo(() => {
    if (!isDexMode || !tokenAddress) {
      return null;
    }

    const paymentKey = paymentAsset as keyof typeof dexAssetAddresses;
    const inputAddress = (dexAssetAddresses[paymentKey] || dexAssetAddresses.ACES)?.toLowerCase();
    if (!inputAddress) {
      return null;
    }

    // Get the input amount to pre-fill on Aerodrome
    const amountParam =
      amount && parseFloat(amount) > 0 ? `&exactAmount=${amount}&exactField=input` : '';

    // On Sell tab, swap the direction: sell token for ACES
    // On Buy tab, keep normal: buy token with ACES
    if (activeTab === 'sell') {
      return `https://app.aerodrome.finance/swap?chain=base&inputCurrency=${tokenAddress.toLowerCase()}&outputCurrency=${inputAddress}${amountParam}`;
    }

    return `https://app.aerodrome.finance/swap?chain=base&inputCurrency=${inputAddress}&outputCurrency=${tokenAddress.toLowerCase()}${amountParam}`;
  }, [isDexMode, tokenAddress, paymentAsset, dexAssetAddresses, activeTab, amount]);
  const enforceCurveLimit = activeTab === 'buy' && !combinedIsBonded;

  const effectiveRemainingTokensWei = useMemo(() => {
    if (!enforceCurveLimit) {
      return null;
    }

    if (remainingCurveTokensWei) {
      return remainingCurveTokensWei;
    }
    if (readOnlyRemainingTokensWei) {
      return readOnlyRemainingTokensWei;
    }
    return null;
  }, [enforceCurveLimit, remainingCurveTokensWei, readOnlyRemainingTokensWei]);

  const remainingCurveTokens = useMemo(() => {
    if (!effectiveRemainingTokensWei) {
      return null;
    }
    return Number.parseFloat(ethers.utils.formatEther(effectiveRemainingTokensWei));
  }, [effectiveRemainingTokensWei]);

  const showBondingLoading = readOnlyBondingLoading && !combinedIsBonded;
  const isAcesPayment = paymentAsset === 'ACES';

  const handleAmountChange = useCallback(
    (rawValue: string) => {
      if (enforceCurveLimit) {
        const integerPortion = rawValue.split('.')[0] ?? '';
        const digitsOnly = integerPortion.replace(/\D/g, '');

        if (!digitsOnly) {
          setAmount('');
          return;
        }

        const normalized = digitsOnly.replace(/^0+(?!$)/, '');
        setAmount(normalized);
        return;
      }

      setAmount(rawValue);
    },
    [enforceCurveLimit],
  );

  const handleAmountKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!enforceCurveLimit) {
        return;
      }

      if (
        event.key === '.' ||
        event.key === ',' ||
        event.key === 'Decimal' ||
        event.key === 'e' ||
        event.key === 'E' ||
        event.key === '+' ||
        event.key === '-'
      ) {
        event.preventDefault();
      }
    },
    [enforceCurveLimit],
  );

  const amountValueWei = useMemo(() => {
    const trimmed = (amount || '').trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = ethers.utils.parseEther(trimmed);
      return parsed.gt(ethers.constants.Zero) ? parsed : null;
    } catch (error) {
      return null;
    }
  }, [amount]);

  const amountExceedsRemaining = useMemo(() => {
    if (!enforceCurveLimit || !amountValueWei || !effectiveRemainingTokensWei) {
      return false;
    }
    return amountValueWei.gt(effectiveRemainingTokensWei);
  }, [amountValueWei, effectiveRemainingTokensWei, enforceCurveLimit]);

  const hasValidAmount = Boolean(amountValueWei) && !amountExceedsRemaining;

  const acesIconSrc = '/aces-logo.png';

  const remainingCurveTokensDisplay = useMemo(() => {
    if (remainingCurveTokens === null) {
      return null;
    }

    const maximumFractionDigits = remainingCurveTokens >= 1 ? 2 : 6;
    return remainingCurveTokens.toLocaleString(undefined, { maximumFractionDigits });
  }, [remainingCurveTokens]);

  const amountError = useMemo(() => {
    if (!amount) {
      return null;
    }

    if (!amountValueWei) {
      return 'Enter an amount greater than zero.';
    }

    if (enforceCurveLimit && amountExceedsRemaining) {
      if (remainingCurveTokensDisplay !== null) {
        return `Only ${remainingCurveTokensDisplay} ${tokenSymbol} remain in this bonding stage.`;
      }

      return 'Amount exceeds remaining supply on the bonding curve.';
    }

    return null;
  }, [
    amount,
    amountValueWei,
    amountExceedsRemaining,
    remainingCurveTokensDisplay,
    enforceCurveLimit,
    tokenSymbol,
  ]);

  const paymentAssetOptions = useMemo(() => {
    const baseOptions = [
      { value: 'ACES', label: 'ACES', icon: acesIconSrc },
      // { value: 'USDC', label: 'USDC', icon: '/svg/usdc.svg' },
      // { value: 'USDT', label: 'USDT', icon: '/svg/tether.svg' },
      // { value: 'ETH', label: 'wETH', icon: '/svg/eth.svg' },
    ];

    if (!isDexMode) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      SUPPORTED_DEX_ASSETS.includes(option.value as (typeof SUPPORTED_DEX_ASSETS)[number]),
    );
  }, [acesIconSrc, isDexMode]);

  const getDisplaySymbol = useCallback((symbol: string) => {
    if (!symbol) {
      return symbol;
    }
    return symbol.toUpperCase() === 'ETH' ? 'wETH' : symbol;
  }, []);

  const formatDexAmount = useCallback((rawAmount: string) => {
    const parsed = Number.parseFloat(rawAmount || '0');
    if (!Number.isFinite(parsed)) {
      return '0.00';
    }

    // Format large numbers with commas for better readability
    if (parsed >= 1000000) {
      return `${(parsed / 1000000).toFixed(2)}M`;
    }
    if (parsed >= 1000) {
      return `${(parsed / 1000).toFixed(2)}K`;
    }

    return parsed.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const paymentAssetDisplay = useMemo(() => {
    return getDisplaySymbol(paymentAsset);
  }, [paymentAsset, getDisplaySymbol]);

  const acesQuote = useMemo(() => {
    const rawQuote = activeTab === 'buy' ? priceQuote : sellPriceQuote;
    const parsed = Number.parseFloat(rawQuote || '0');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [activeTab, priceQuote, sellPriceQuote]);

  const usdEquivalent = useMemo(() => {
    if (!usdConversion?.usdValue) {
      return null;
    }
    const parsed = Number.parseFloat(usdConversion.usdValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [usdConversion]);

  const paymentAssetQuote = useMemo(() => {
    if (!hasValidAmount || !usdEquivalent || activeTab !== 'buy' || isAcesPayment) {
      return null;
    }

    if (paymentAsset === 'USDC' || paymentAsset === 'USDT') {
      return {
        label: paymentAsset,
        value: `${usdEquivalent.toFixed(2)} ${paymentAsset}`,
      };
    }

    if (paymentAsset === 'ETH') {
      const ethAmount = usdEquivalent / DEFAULT_ETH_PRICE;
      return {
        label: 'wETH',
        value: `${ethAmount.toFixed(6)} wETH`,
      };
    }

    return null;
  }, [hasValidAmount, usdEquivalent, activeTab, isAcesPayment, paymentAsset]);

  const inputUnitLabel = useMemo(() => {
    const unit = isDexMode && activeTab === 'buy' ? paymentAssetDisplay : tokenSymbol;
    return `$ ${unit}`;
  }, [isDexMode, activeTab, paymentAssetDisplay, tokenSymbol]);

  const disableBuyAction = isDexMode
    ? !hasValidAmount || !dexQuote || dexQuoteLoading || !dexTradeUrl || dexSwapPending
    : !hasValidAmount || !!loading || combinedIsBonded;
  const disableSellAction = isDexMode
    ? !hasValidAmount || !dexQuote || dexQuoteLoading || !dexTradeUrl || dexSwapPending
    : !hasValidAmount || !!loading || combinedIsBonded;
  const buyButtonLabel = isDexMode
    ? dexSwapPending
      ? 'Swapping...'
      : 'Swap'
    : isAcesPayment
      ? `Buy ${tokenSymbol}`
      : `Buy ${tokenSymbol} with ${paymentAssetDisplay}`;

  const refreshBalances = useCallback(async () => {
    if (!acesContract || !tokenAddress || !signer) {
      return;
    }

    try {
      const address = await signer.getAddress();

      const acesBalanceValue = await acesContract.balanceOf(address);
      const formattedAcesBalance = ethers.utils.formatEther(acesBalanceValue);
      setAcesBalance(formattedAcesBalance);

      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const tokenBalanceValue = await tokenContract.balanceOf(address);
      const formattedTokenBalance = ethers.utils.formatEther(tokenBalanceValue);
      setTokenBalance(formattedTokenBalance);

      if (factoryContract) {
        try {
          const tokenInfo = await factoryContract.tokens(tokenAddress);
          const totalSupply = await tokenContract.totalSupply();
          const tokensBondedAt = tokenInfo.tokensBondedAt;

          const remainingWei = tokensBondedAt.gt(totalSupply)
            ? tokensBondedAt.sub(totalSupply)
            : ethers.constants.Zero;
          setRemainingCurveTokensWei(remainingWei);

          const currentSupply = parseFloat(ethers.utils.formatEther(totalSupply));
          const maxSupply = parseFloat(ethers.utils.formatEther(tokensBondedAt));
          const percentage = maxSupply > 0 ? (currentSupply / maxSupply) * 100 : 0;

          setTokenBonded(tokenInfo.tokenBonded);
          setBondingPercentage(Math.min(percentage, 100));
        } catch (bondingError) {
          console.error('Failed to fetch bonding status:', bondingError);
        }
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error);

      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.includes('circuit breaker')
      ) {
        debugLog('Circuit breaker active - keeping existing balances, will retry later');
        return;
      }

      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'UNSUPPORTED_OPERATION' || error.code === 'CALL_EXCEPTION')
      ) {
        debugLog('Signer no longer valid, cleaning up...');
        setProvider(null);
        setSigner(null);
        setFactoryContract(null);
        setAcesContract(null);
        setAcesBalance('0');
        setTokenBalance('0');
        setTokenBonded(false);
        setBondingPercentage(0);
        setRemainingCurveTokensWei(null);
      }
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

      debugLog('Checking allowance:', {
        token: tokenAddr,
        router: routerAddress,
        currentAllowance: ethers.utils.formatEther(allowance),
        requiredAmount: ethers.utils.formatEther(requiredAmount),
      });

      if (allowance.gte(requiredAmount)) {
        debugLog('Sufficient allowance already exists');
        return false; // No approval needed
      }

      debugLog('Requesting approval from user...');
      setLoading('Awaiting approval...');

      try {
        const approveTx = await erc20Contract.approve(routerAddress, requiredAmount);
        setLoading('Confirming approval...');
        await approveTx.wait();
        debugLog('Approval confirmed');
        return true; // Approval was granted
      } catch (error) {
        console.error('Approval failed:', error);
        throw new Error('Token approval was rejected or failed');
      }
    },
    [signer, walletAddress, routerAddress],
  );

  const executeDexSwap = useCallback(async () => {
    if (!isDexMode) {
      return;
    }

    if (!signer || !walletAddress) {
      setTransactionStatus({ type: 'error', message: 'Connect wallet to trade on Aerodrome.' });
      return;
    }

    if (!dexQuote) {
      setTransactionStatus({ type: 'error', message: 'No quote available. Enter an amount.' });
      return;
    }

    if (!routerAddress) {
      setTransactionStatus({
        type: 'error',
        message: 'Aerodrome router address not configured. Contact support.',
      });
      return;
    }

    try {
      setDexSwapPending(true);
      setTransactionStatus(null);
      setLoading('');

      debugLog('=== DEX SWAP DEBUG ===');
      debugLog('Active tab:', activeTab);
      debugLog('Payment asset:', paymentAsset);
      debugLog('Quote:', dexQuote);

      const routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
      const path = dexQuote.path.map((addr) => ethers.utils.getAddress(addr));
      const amountIn = ethers.BigNumber.from(dexQuote.inputAmountRaw);
      const amountOutMin = ethers.BigNumber.from(dexQuote.minOutputRaw);
      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

      // Verify user has sufficient balance
      if (paymentAsset !== 'ETH' || activeTab === 'sell') {
        const inputTokenAddress = path[0];
        const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
        const userBalance = await erc20Contract.balanceOf(walletAddress);

        debugLog('Balance check:', {
          token: inputTokenAddress,
          userBalance: ethers.utils.formatEther(userBalance),
          required: ethers.utils.formatEther(amountIn),
        });

        if (userBalance.lt(amountIn)) {
          throw new Error(
            `Insufficient balance. You need ${ethers.utils.formatEther(amountIn)} but only have ${ethers.utils.formatEther(userBalance)}`,
          );
        }
      }

      debugLog('Swap parameters:', {
        path,
        amountIn: ethers.utils.formatEther(amountIn),
        amountOutMin: ethers.utils.formatEther(amountOutMin),
        deadline: new Date(deadline * 1000).toISOString(),
      });

      let tx;

      if (paymentAsset === 'ETH' && activeTab === 'buy') {
        debugLog('Executing ETH -> Token swap');
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
        // For token swaps, need approval first
        const inputTokenAddress = path[0];
        debugLog('Checking/requesting approval for token:', inputTokenAddress);

        const approvalGranted = await ensureDexAllowance(
          inputTokenAddress,
          dexQuote.inputAmountRaw,
        );

        if (approvalGranted) {
          debugLog('Approval granted, proceeding with swap');
        }

        setLoading('Confirming swap...');
        debugLog('Executing Token -> Token swap');
        tx = await routerContract.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          walletAddress,
          deadline,
        );
      }

      debugLog('Swap transaction sent:', tx.hash);
      setLoading('Waiting for confirmation...');
      await tx.wait();
      debugLog('Swap confirmed');

      setTransactionStatus({
        type: 'success',
        message: 'Swap confirmed on Aerodrome.',
      });

      setAmount('');
      setDexQuote(null);
      setLoading('Refreshing balances...');
      await refreshBalances();
      setLoading('');
    } catch (error) {
      console.error('Dex swap failed:', error);
      let message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Swap failed.';

      // Better error messages for common failures
      if (typeof message === 'string') {
        if (message.toLowerCase().includes('insufficient_output')) {
          message = 'Swap failed: received amount below minimum (check slippage or liquidity).';
        } else if (
          message.toLowerCase().includes('user rejected') ||
          message.toLowerCase().includes('user denied')
        ) {
          message = 'Transaction was rejected by user.';
        } else if (message.toLowerCase().includes('insufficient funds')) {
          message = 'Insufficient balance to complete this swap.';
        } else if (message.toLowerCase().includes('execution reverted')) {
          message =
            'Swap transaction failed. This may be due to insufficient allowance, low liquidity, or price impact. Try refreshing and swapping again.';
        }
      }

      setTransactionStatus({ type: 'error', message });
      setLoading('');
    } finally {
      setDexSwapPending(false);
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
  ]);

  const handleBuyClick = async () => {
    if (isDexMode) {
      await executeDexSwap();
      return;
    }

    if (disableBuyAction) {
      return;
    }

    if (isAcesPayment) {
      await buyTokens();
      return;
    }

    setTransactionStatus({
      type: 'error',
      message: `${paymentAsset} purchases will execute here once the new swap contract is deployed.`,
    });
  };

  // const slippageOptions = ['0.5', '1.0', '2.0'];

  const priceCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeTab === 'sell' && paymentAsset !== 'ACES') {
      setPaymentAsset('ACES');
    }
  }, [activeTab, paymentAsset]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  useEffect(() => {
    if (!transactionStatus) {
      return;
    }

    const timeout = setTimeout(() => setTransactionStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [transactionStatus]);

  // Get buy price quote with circuit breaker handling
  const getBuyPriceQuote = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !amountValueWei) {
      setPriceQuote('0');
      return;
    }

    try {
      const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountValueWei);
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
        debugLog('Circuit breaker active - keeping existing price quote');
        return; // Don't update price to '0'
      }

      setPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amountValueWei]);

  // Get sell price quote with circuit breaker handling
  const getSellPriceQuote = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !amountValueWei) {
      setSellPriceQuote('0');
      return;
    }

    try {
      const sellPrice = await factoryContract.getSellPriceAfterFee(tokenAddress, amountValueWei);
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
        debugLog('Circuit breaker active - keeping existing sell price quote');
        return; // Don't update price to '0'
      }

      setSellPriceQuote('0');
    }
  }, [factoryContract, tokenAddress, amountValueWei]);

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
            debugLog('No accounts connected, skipping initialization');
            return;
          }

          // Get the current chain ID first
          const chainId = await getCurrentChainId();
          debugLog('Current chain ID:', chainId);

          // Validate addresses for this network
          const addresses = getContractAddresses(chainId || 8453);

          // Check if factory and ACES token are configured
          if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
            console.error(`❌ Contract addresses not configured for chain ID ${chainId}`);
            setUnsupportedNetwork(true);

            setNetworkError('');
            return;
          }

          setUnsupportedNetwork(false);
          debugLog('Auto-initializing provider from auth...');
          const newProvider = new ethers.providers.Web3Provider(window.ethereum);
          const newSigner = newProvider.getSigner();

          setProvider(newProvider);
          setSigner(newSigner);

          const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
          setFactoryContract(factory);

          const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);
          setAcesContract(aces);

          debugLog('Auto-initialization complete', {
            chainId,
            factoryProxy: addresses.FACTORY_PROXY,
            acesToken: addresses.ACES_TOKEN,
          });
        } catch (error) {
          console.error('Failed to initialize from auth:', error);
          setNetworkError(
            'Failed to initialize wallet connection. Please try refreshing the page.',
          );
        }
      } else if (!isAuthenticated || !walletAddress) {
        // Clean up when disconnected
        debugLog('User disconnected, cleaning up state...');
        setProvider(null);
        setSigner(null);
        setFactoryContract(null);
        setAcesContract(null);
        setAcesBalance('0');
        setTokenBalance('0');
        setPriceQuote('0');
        setSellPriceQuote('0');
        setUnsupportedNetwork(false);
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
    if (isDexMode) {
      return;
    }
    calculatePriceQuote();
  }, [calculatePriceQuote, isDexMode]);

  useEffect(() => {
    if (!isDexMode) {
      setDexQuote(null);
      setDexQuoteError(null);
      return;
    }

    if (!SUPPORTED_DEX_ASSETS.includes(paymentAsset as (typeof SUPPORTED_DEX_ASSETS)[number])) {
      setPaymentAsset('ACES');
      return;
    }

    if (!tokenAddress || !hasValidAmount) {
      setDexQuote(null);
      setDexQuoteError(null);
      return;
    }

    let cancelled = false;
    setDexQuoteLoading(true);

    // On Sell tab, we're selling the token for ACES
    // On Buy tab, we're buying the token with ACES
    const inputAsset = activeTab === 'sell' ? 'TOKEN' : paymentAsset;

    DexApi.getQuote(tokenAddress, {
      inputAsset,
      amount,
      slippageBps: DEFAULT_SLIPPAGE_BPS,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setDexQuote(result.data);
          setDexQuoteError(null);
        } else {
          setDexQuote(null);
          setDexQuoteError(
            result.error instanceof Error ? result.error.message : 'Failed to fetch quote',
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to fetch DEX quote:', error);
        setDexQuote(null);
        setDexQuoteError(error instanceof Error ? error.message : 'Failed to fetch quote');
      })
      .finally(() => {
        if (!cancelled) {
          setDexQuoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isDexMode, tokenAddress, paymentAsset, amount, hasValidAmount, dexMeta, activeTab]);

  const handleConnectWallet = useCallback(async () => {
    try {
      setLoading('Connecting wallet...');
      await authConnectWallet();
    } catch (error) {
      console.error('Failed to connect wallet via auth context:', error);
    } finally {
      setLoading('');
    }
  }, [authConnectWallet]);

  // Buy tokens
  const buyTokens = async () => {
    if (!factoryContract || !acesContract || !tokenAddress || !amountValueWei || !signer) return;

    setTransactionStatus(null);

    try {
      const amountWei = amountValueWei;
      const priceWei = ethers.utils.parseEther(priceQuote);

      if (effectiveRemainingTokensWei && amountWei.gt(effectiveRemainingTokensWei)) {
        setTransactionStatus({
          type: 'error',
          message: 'Amount exceeds remaining supply on the bonding curve.',
        });
        return;
      }

      debugLog('=== BUY TOKENS DEBUG ===');
      debugLog('Token to buy:', tokenAddress);
      debugLog('Amount (tokens):', amount);
      debugLog('Price (ACES):', priceQuote);

      const address = await signer.getAddress();
      const currentAddresses = getCurrentContractAddresses();
      const currentAllowance = await acesContract.allowance(
        address,
        currentAddresses.FACTORY_PROXY,
      );
      const currentAcesBalance = await acesContract.balanceOf(address);

      debugLog('Current allowance:', ethers.utils.formatEther(currentAllowance));
      debugLog('Required amount:', ethers.utils.formatEther(priceWei));
      debugLog('Current ACES balance:', ethers.utils.formatEther(currentAcesBalance));

      // Step 1: Approve ACES tokens
      setLoading('Approving ACES tokens...');
      const approveTx = await acesContract.approve(currentAddresses.FACTORY_PROXY, priceWei);
      await approveTx.wait(2); // wait for 2 confirmations to avoid short-lived reorg issues

      // Step 2: Buy tokens
      setLoading('Buying tokens...');
      const buyer = await signer.getAddress();
      const buyTx = await factoryContract.buyTokens(buyer, tokenAddress, amountWei, priceWei);
      await buyTx.wait();

      // Step 3: Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      setAmount('');
      setNetworkError(null); // Clear any previous network errors on success
      setTransactionStatus({ type: 'success', message: 'Transaction successful.' });
    } catch (error) {
      console.error('Failed to buy tokens:', error);
      setLoading('');

      // Handle circuit breaker errors specifically
      if (error instanceof Error && error.message.includes('circuit breaker')) {
        setNetworkError('Network congestion detected. Please try again in a few minutes.');
        setTransactionStatus({
          type: 'error',
          message: 'Transaction failed due to network congestion. Please try again later.',
        });
      } else {
        setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
      }
    }
  };

  // Sell tokens
  const sellTokens = async () => {
    if (!factoryContract || !tokenAddress || !amountValueWei || !signer) return;

    setTransactionStatus(null);

    try {
      const amountWei = amountValueWei;

      debugLog('=== SELL TOKENS DEBUG ===');
      debugLog('Token to sell:', tokenAddress);
      debugLog('Amount (tokens):', amount);

      const address = await signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const currentTokenBalance = await tokenContract.balanceOf(address);

      debugLog('Current token balance:', ethers.utils.formatEther(currentTokenBalance));
      debugLog('Estimated ACES received:', sellPriceQuote);

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
      setTransactionStatus({ type: 'success', message: 'Transaction successful.' });
    } catch (error) {
      console.error('Failed to sell tokens:', error);
      setLoading('');

      // Handle circuit breaker errors specifically
      if (error instanceof Error && error.message.includes('circuit breaker')) {
        setNetworkError('Network congestion detected. Please try again in a few minutes.');
        setTransactionStatus({
          type: 'error',
          message: 'Transaction failed due to network congestion. Please try again later.',
        });
      } else if (error instanceof Error && error.message.includes('Insufficient token balance')) {
        setTransactionStatus({
          type: 'error',
          message: 'Transaction failed: insufficient token balance.',
        });
      } else {
        setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
      }
    }
  };

  return (
    <div className="h-full">
      <div
        className={cn(
          'bg-black  h-full flex flex-col relative',
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
                chainId={chainId}
                percentage={combinedBondingPercentage}
                isBondedOverride={combinedIsBonded}
              />
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center ${
                  combinedIsBonded ? 'text-[#D7BF75]/80' : 'text-[#D7BF75]/80'
                }`}
              >
                {showBondingLoading
                  ? 'Loading bonding data...'
                  : combinedIsBonded
                    ? 'BONDED - 100%'
                    : `Bonded ${combinedBondingPercentage.toFixed(1)}% / 100%`}
              </div>
              {enforceCurveLimit && remainingCurveTokensDisplay !== null && !showBondingLoading && (
                <div className="mt-2 text-xs text-[#D0B284]/80 text-center">
                  {remainingCurveTokensDisplay} {tokenSymbol} left in the bonding curve
                </div>
              )}
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
          <div
            className={`mb-4 p-3 border rounded-lg ${
              unsupportedNetwork
                ? 'bg-red-900/50 border-red-600/50'
                : 'bg-orange-900/50 border-orange-600/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center text-sm ${
                  unsupportedNetwork ? 'text-red-200' : 'text-orange-200'
                }`}
              >
                <span className="mr-2">{unsupportedNetwork ? '🚫' : '⚠️'}</span>
                <div>
                  <div className="font-semibold mb-1">
                    {unsupportedNetwork ? 'Unsupported Network' : 'Network Issue'}
                  </div>
                  <div className="text-xs">{networkError}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setNetworkError(null);
                  setUnsupportedNetwork(false);
                }}
                className={`text-sm underline ${
                  unsupportedNetwork
                    ? 'text-red-200 hover:text-red-100'
                    : 'text-orange-200 hover:text-orange-100'
                }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Bonding Complete Banner */}
        {/* {combinedIsBonded && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-600/50 rounded-lg">
            <div className="flex items-center text-green-200 text-sm">
              <span className="mr-2">✅</span>
              <div>
                <div className="font-semibold">Bonding Complete!</div>
                <div className="text-xs mt-1 text-green-300">
                  This token has reached 100% bonding. Trading now routes through Aerodrome
                  liquidity.
                  {isDexMode && dexTradeUrl && (
                    <button
                      onClick={() => window.open(dexTradeUrl, '_blank', 'noopener,noreferrer')}
                      className="ml-1 underline text-green-200 hover:text-green-100"
                    >
                      Open Aerodrome
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Bonding Progress Warning (when close to 100%) */}
        {!combinedIsBonded && combinedBondingPercentage >= 90 && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600/50 rounded-lg">
            <div className="flex items-center text-yellow-200 text-sm">
              <div>
                <div className="font-semibold">Bonding Almost Complete</div>
                <div className="text-xs mt-1 text-yellow-300">
                  Once 100% is reached, this token will migrate to LP.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buy/Sell Tabs */}
        <div className="flex mb-6 bg- rounded-lg p-1 border border-[#D0B284]/20">
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

        {activeTab === 'buy' && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#D0B284]/60">
              Pay with
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={paymentAsset}
                onValueChange={(value) => setPaymentAsset(value as typeof paymentAsset)}
              >
                <SelectTrigger className="h-10 w-36 bg-black border border-[#D0B284]/30 text-[#D0B284] focus:ring-0 focus:border-[#D0B284]/60">
                  <div className="flex items-center gap-2">
                    {/* {selectedPaymentOption && (
                      <Image
                        src={selectedPaymentOption.icon}
                        alt={`${selectedPaymentOption.label} icon`}
                        width={18}
                        height={18}
                        className="h-4.5 w-4.5 rounded-full object-cover"
                        unoptimized={true}
                      />
                    )} */}
                    <SelectValue placeholder="Select" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#101711] border border-[#D0B284]/30 text-[#D0B284]">
                  {paymentAssetOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="focus:bg-[#1e3022] focus:text-[#F3E9C9]"
                    >
                      <div className="flex items-center gap-2">
                        <Image
                          src={option.icon}
                          alt={`${option.label} icon`}
                          width={18}
                          height={18}
                          className="h-4.5 w-4.5 rounded-full object-cover"
                          unoptimized={true}
                        />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Slippage dropdown temporarily disabled until Aerodrome API integration */}
        {/*
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
        */}

        {/* Input Field */}
        <div className="mb-6">
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onKeyDown={handleAmountKeyDown}
              step={enforceCurveLimit ? 1 : 'any'}
              inputMode={enforceCurveLimit ? 'numeric' : 'decimal'}
              aria-invalid={Boolean(amountError)}
              className={cn(
                'h-16 border text-2xl font-bold bg-[#1a2318] text-[#D0B284] placeholder:text-[#D0B284]/50 pr-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                amountError
                  ? 'border-red-500/60 focus-visible:ring-red-500/40'
                  : 'border-[#D0B284]/20 focus-visible:ring-[#D0B284]/40',
              )}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[#D0B284] font-semibold">{inputUnitLabel}</span>
            </div>
          </div>
          {amountError ? (
            <p className="mt-2 text-xs text-red-300">{amountError}</p>
          ) : enforceCurveLimit ? (
            <p className="mt-2 text-xs text-[#D0B284]/70">
              Bonding curve purchases require whole-token amounts.
            </p>
          ) : null}
        </div>

        {/* Buy/Sell Button */}
        <div className="mb-6 space-y-3">
          {!isAuthenticated || !provider ? (
            <Button
              onClick={handleConnectWallet}
              disabled={!!loading}
              className="w-full h-14 bg-[#D0B284]/10 hover:bg-[#D0B284]/20 border border-[#D0B284] text-[#D0B284] font-proxima-nova font-bold text-lg rounded-lg disabled:opacity-50"
            >
              {loading || 'Connect Wallet'}
            </Button>
          ) : activeTab === 'buy' ? (
            <Button
              onClick={handleBuyClick}
              disabled={disableBuyAction}
              className="w-full h-14 bg-[#D0B284]/10 hover:bg-[#D0B284]/20 border border-[#D0B284] text-[#D0B284] font-proxima-nova font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDexMode ? (
                dexSwapPending || loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {loading || 'Swapping...'}
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-lg font-bold">{buyButtonLabel}</span>
                    <span className="text-[10px] opacity-60 uppercase tracking-wider">
                      Powered by Aerodrome
                    </span>
                  </div>
                )
              ) : combinedIsBonded ? (
                'Bonding Complete - Trading Disabled'
              ) : (
                loading || buyButtonLabel
              )}
            </Button>
          ) : (
            <Button
              onClick={isDexMode ? handleBuyClick : sellTokens}
              disabled={disableSellAction}
              className="w-full h-14 bg-[#8B4513] hover:bg-[#8B4513]/90 text-white font-proxima-nova font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDexMode ? (
                dexSwapPending || loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {loading || 'Swapping...'}
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-lg font-bold">Swap</span>
                    <span className="text-[10px] opacity-60 uppercase tracking-wider">
                      Powered by Aerodrome
                    </span>
                  </div>
                )
              ) : combinedIsBonded ? (
                'Bonding Complete - Trading Disabled'
              ) : (
                loading || `Sell ${tokenSymbol}`
              )}
            </Button>
          )}

          {transactionStatus && (
            <div
              role={transactionStatus.type === 'success' ? 'status' : 'alert'}
              aria-live={transactionStatus.type === 'success' ? 'polite' : 'assertive'}
              className={cn(
                'w-full px-4 py-3 rounded-lg border text-sm flex items-start justify-between gap-3 shadow-lg',
                transactionStatus.type === 'success'
                  ? 'bg-green-900/60 border-green-500/30 text-green-100'
                  : 'bg-red-900/60 border-red-600/40 text-red-100',
              )}
            >
              <span className="leading-snug">{transactionStatus.message}</span>
              <button
                onClick={() => setTransactionStatus(null)}
                className="text-xs font-semibold uppercase tracking-wide opacity-80 hover:opacity-100 transition-opacity"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Quote Section */}
        <div className="min-h-[140px]">
          {hasValidAmount && (
            <div className="p-3 bg-[#1a2318]/50 rounded-lg border border-[#D0B284]/20 space-y-3">
              {isDexMode ? (
                // DEX Mode Quote
                dexQuoteLoading ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D0B284]" />
                    <span className="text-sm text-[#D0B284]">Fetching quote…</span>
                  </div>
                ) : dexQuote ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-[0.3em] text-[#D0B284]/60">
                        Expected output
                      </span>
                      <div className="text-right min-w-0 flex-1 ml-2">
                        <div className="font-mono text-lg font-bold text-[#D0B284] break-all overflow-hidden">
                          {formatDexAmount(dexQuote.expectedOutput)}
                        </div>
                        <div className="text-xs font-semibold tracking-widest text-[#D0B284]/80">
                          {activeTab === 'sell' ? paymentAssetDisplay : tokenSymbol}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs border-t border-[#D0B284]/10 pt-2">
                      <div className="text-[#D0B284]/70">
                        Minimum received ({dexQuote.slippageBps / 100}% slippage)
                      </div>
                      <div className="font-mono text-[#D0B284] mt-1 break-all overflow-hidden">
                        {formatDexAmount(dexQuote.minOutput)}{' '}
                        <span className="text-[11px] font-semibold tracking-widest text-[#D0B284]/80">
                          {activeTab === 'sell' ? paymentAssetDisplay : tokenSymbol}
                        </span>
                      </div>
                    </div>
                    {usdConversion && (
                      <div className="text-center text-xs text-[#D0B284]/70 border-t border-[#D0B284]/10 pt-2">
                        {Number.parseFloat(usdConversion.usdValue) < 0.01
                          ? '≈ <$0.01 USD'
                          : `≈ $${usdConversion.usdValue} USD`}
                        {usdConversion.isStale && (
                          <span className="ml-1 text-[#D0B284]/50">(cached)</span>
                        )}
                      </div>
                    )}
                    {dexQuote.intermediate && dexQuote.intermediate.length > 0 && (
                      <div className="text-xs text-[#D0B284]/70 text-center border-t border-[#D0B284]/10 pt-2">
                        Route: {getDisplaySymbol(dexQuote.inputAsset)}
                        {dexQuote.intermediate.map(
                          (step) => ` → ${getDisplaySymbol(step.symbol)}`,
                        )}{' '}
                        → {activeTab === 'sell' ? paymentAssetDisplay : tokenSymbol}
                      </div>
                    )}
                  </>
                ) : dexQuoteError ? (
                  <div className="text-center text-xs text-red-300 py-2">{dexQuoteError}</div>
                ) : (
                  <div className="text-center text-xs text-[#D0B284]/70 py-2">
                    Enter an amount to preview routing.
                  </div>
                )
              ) : (
                // Bonding Curve Mode Quote
                <>
                  <div className="text-center border-b border-[#D0B284]/20 pb-2">
                    <div className="text-sm font-bold text-[#D0B284]">
                      {activeTab === 'buy'
                        ? `Quote ≈ ${acesQuote.toFixed(4)} $ACES`
                        : `Receive ≈ ${sellPriceQuote} $ACES`}
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

                  {activeTab === 'buy' && paymentAssetQuote && (
                    <div className="text-center text-xs text-[#D0B284]/70">
                      <span className="font-semibold text-[#D0B284]">
                        Pay with {paymentAssetQuote.label}:
                      </span>{' '}
                      ≈ {paymentAssetQuote.value}
                      {paymentAsset === 'ETH' && (
                        <span className="mt-1 block text-[11px] text-[#D0B284]/50">
                          Using placeholder wETH price (${DEFAULT_ETH_PRICE}). Update once live
                          routing is wired.
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
