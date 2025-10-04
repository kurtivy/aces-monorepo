'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const DEFAULT_SLIPPAGE_BPS = 100;
const SUPPORTED_DEX_ASSETS = ['ACES', 'USDC', 'ETH'] as const;
const DEX_FALLBACK_ADDRESSES = {
  USDC:
    process.env.NEXT_PUBLIC_AERODROME_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C0b43d5Ee1fCD46a7B3',
  ETH:
    process.env.NEXT_PUBLIC_AERODROME_WETH_ADDRESS || '0x4200000000000000000000000000000000000006',
} as const;
const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];
const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;

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
  chainId = 84532, // Default to Base Sepolia
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
    // Default to Base Sepolia (84532) for development
    return getContractAddresses(currentChainId || 84532);
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
    }),
    [contractAddresses],
  );

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
  } = useTokenBondingData(tokenAddress, chainId);

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

    return `https://app.aerodrome.finance/swap?chain=base&inputCurrency=${inputAddress}&outputCurrency=${tokenAddress.toLowerCase()}`;
  }, [isDexMode, tokenAddress, paymentAsset, dexAssetAddresses]);
  const showBondingLoading = readOnlyBondingLoading && !combinedIsBonded;
  const isAcesPayment = paymentAsset === 'ACES';
  const hasValidAmount = useMemo(() => {
    const parsed = Number.parseFloat(amount || '0');
    return Number.isFinite(parsed) && parsed > 0;
  }, [amount]);

  const acesIconSrc = '/aces-logo.png';

  const paymentAssetOptions = useMemo(() => {
    const baseOptions = [
      { value: 'ACES', label: 'ACES', icon: acesIconSrc },
      { value: 'USDC', label: 'USDC', icon: '/svg/usdc.svg' },
      { value: 'USDT', label: 'USDT', icon: '/svg/tether.svg' },
      { value: 'ETH', label: 'ETH', icon: '/svg/eth.svg' },
    ];

    if (!isDexMode) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      SUPPORTED_DEX_ASSETS.includes(option.value as (typeof SUPPORTED_DEX_ASSETS)[number]),
    );
  }, [acesIconSrc, isDexMode]);

  const selectedPaymentOption = paymentAssetOptions.find((option) => option.value === paymentAsset);

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
        label: 'ETH',
        value: `${ethAmount.toFixed(6)} ETH`,
      };
    }

    return null;
  }, [hasValidAmount, usdEquivalent, activeTab, isAcesPayment, paymentAsset]);

  const disableBuyAction = isDexMode
    ? !hasValidAmount || !dexQuote || dexQuoteLoading || !dexTradeUrl || dexSwapPending
    : !hasValidAmount || !!loading || combinedIsBonded;
  const disableSellAction = !hasValidAmount || !!loading || combinedIsBonded;
  const buyButtonLabel = isDexMode
    ? dexSwapPending
      ? 'Swapping...'
      : 'Swap on Aerodrome'
    : isAcesPayment
      ? `Buy ${tokenSymbol}`
      : `Buy ${tokenSymbol} with ${paymentAsset}`;

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
        console.log('Circuit breaker active - keeping existing balances, will retry later');
        return;
      }

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
        return;
      }

      const approveTx = await erc20Contract.approve(routerAddress, requiredAmount);
      await approveTx.wait();
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

      const routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
      const path = dexQuote.path.map((addr) => ethers.utils.getAddress(addr));
      const amountIn = ethers.BigNumber.from(dexQuote.inputAmountRaw);
      const amountOutMin = ethers.BigNumber.from(dexQuote.minOutputRaw);
      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

      let tx;

      if (paymentAsset === 'ETH') {
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

        tx = await routerContract.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          walletAddress,
          deadline,
        );
      }

      await tx.wait();

      setTransactionStatus({
        type: 'success',
        message: 'Swap confirmed on Aerodrome.',
      });

      setAmount('');
      setDexQuote(null);
      await refreshBalances();
    } catch (error) {
      console.error('Dex swap failed:', error);
      let message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Swap failed.';

      if (typeof message === 'string' && message.toLowerCase().includes('insufficient_output')) {
        message = 'Swap failed: received amount below minimum (check slippage or liquidity).';
      }

      setTransactionStatus({ type: 'error', message });
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

          // Get the current chain ID first
          const chainId = await getCurrentChainId();
          console.log('Current chain ID:', chainId);

          // Validate addresses for this network
          const addresses = getContractAddresses(chainId || 84532);

          // Check if factory and ACES token are configured
          if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
            console.error(`❌ Contract addresses not configured for chain ID ${chainId}`);
            setUnsupportedNetwork(true);

            setNetworkError('');
            return;
          }

          setUnsupportedNetwork(false);
          console.log('Auto-initializing provider from auth...');
          const newProvider = new ethers.providers.Web3Provider(window.ethereum);
          const newSigner = newProvider.getSigner();

          setProvider(newProvider);
          setSigner(newSigner);

          const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
          setFactoryContract(factory);

          const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);
          setAcesContract(aces);

          console.log('Auto-initialization complete', {
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
        console.log('User disconnected, cleaning up state...');
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

    DexApi.getQuote(tokenAddress, {
      inputAsset: paymentAsset,
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
  }, [isDexMode, tokenAddress, paymentAsset, amount, hasValidAmount, dexMeta]);

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
    if (!factoryContract || !acesContract || !tokenAddress || !amount || !signer) return;

    setTransactionStatus(null);

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
      await approveTx.wait(2); // wait for 2 confirmations to avoid short-lived reorg issues

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
    if (!factoryContract || !tokenAddress || !amount || !signer) return;

    setTransactionStatus(null);

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
                chainId={chainId}
                percentage={combinedBondingPercentage}
                isBondedOverride={combinedIsBonded}
              />
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center ${
                  combinedIsBonded ? 'text-green-400' : 'text-[#D7BF75]/80'
                }`}
              >
                {showBondingLoading
                  ? 'Loading bonding data...'
                  : combinedIsBonded
                    ? '✅ BONDED - 100%'
                    : `Bonded ${combinedBondingPercentage.toFixed(1)}% / 100%`}
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
        {combinedIsBonded && (
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
        )}

        {/* Bonding Progress Warning (when close to 100%) */}
        {!combinedIsBonded && combinedBondingPercentage >= 90 && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600/50 rounded-lg">
            <div className="flex items-center text-yellow-200 text-sm">
              <span className="mr-2">⚡</span>
              <div>
                <div className="font-semibold">Bonding Almost Complete</div>
                <div className="text-xs mt-1 text-yellow-300">
                  {combinedBondingPercentage.toFixed(1)}% bonded. Once 100% is reached, this token
                  will migrate to Aerodrome LP.
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
                <SelectTrigger className="h-10 w-36 bg-[#111910] border border-[#D0B284]/30 text-[#D0B284] focus:ring-0 focus:border-[#D0B284]/60">
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
              onChange={(e) => setAmount(e.target.value)}
              className="h-16 text-2xl font-bold bg-[#1a2318] border-[#D0B284]/20 text-[#D0B284] placeholder:text-[#D0B284]/50 pr-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[#D0B284] font-semibold">$ {tokenSymbol}</span>
            </div>
          </div>
        </div>

        {isDexMode && (
          <div className="mb-6 rounded-lg border border-[#D0B284]/20 bg-black/20 px-4 py-3 text-sm text-[#DCDDCC]">
            {dexQuoteLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#D0B284]" />
                <span>Fetching Aerodrome quote…</span>
              </div>
            ) : dexQuote ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-[0.3em] text-[#D0B284]/60">
                    Expected output
                  </span>
                  <span className="font-mono text-lg text-[#D0B284]">
                    {Number.parseFloat(dexQuote.expectedOutput).toFixed(6)} {tokenSymbol}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs text-[#D0B284]/80">
                  <span>Minimum received ({dexQuote.slippageBps / 100}% slippage)</span>
                  <span className="font-mono text-[#DCDDCC]">
                    {Number.parseFloat(dexQuote.minOutput).toFixed(6)} {tokenSymbol}
                  </span>
                </div>
                {dexQuote.intermediate && dexQuote.intermediate.length > 0 && (
                  <div className="text-xs text-[#D0B284]/70">
                    Route: {dexQuote.inputAsset}
                    {dexQuote.intermediate.map((step) => ` → ${step.symbol}`)} → {tokenSymbol}
                  </div>
                )}
                {dexTradeUrl && (
                  <div className="text-xs text-[#D0B284]/70">
                    Route preview opens Aerodrome swap in a new tab.
                  </div>
                )}
              </div>
            ) : dexQuoteError ? (
              <div className="text-xs text-red-300">{dexQuoteError}</div>
            ) : (
              <div className="text-xs text-[#D0B284]/70">
                Enter an amount to preview Aerodrome routing.
              </div>
            )}
          </div>
        )}

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
                dexSwapPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Swapping...
                  </span>
                ) : (
                  buyButtonLabel
                )
              ) : combinedIsBonded ? (
                'Bonding Complete - Trading Disabled'
              ) : (
                loading || buyButtonLabel
              )}
            </Button>
          ) : (
            <Button
              onClick={sellTokens}
              disabled={disableSellAction}
              className="w-full h-14 bg-[#8B4513] hover:bg-[#8B4513]/90 text-white font-proxima-nova font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {combinedIsBonded
                ? 'Bonding Complete - Trading Disabled'
                : loading || `Sell ${tokenSymbol}`}
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
                      Using placeholder ETH price (${DEFAULT_ETH_PRICE}). Update once live routing
                      is wired.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
