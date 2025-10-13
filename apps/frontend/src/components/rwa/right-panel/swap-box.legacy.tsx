// 'use client';

// import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import type { KeyboardEvent } from 'react';
// import { ethers } from 'ethers';
// import { Button } from '@/components/ui/button';
// import { useAuth } from '@/lib/auth/auth-context';
// import { Copy, Check, Loader2, ChevronDown, ArrowDown } from 'lucide-react';
// import { cn } from '@/lib/utils';
// import Image from 'next/image';
// import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
// import ProgressionBar from '@/components/rwa/middle-column/overview/progression-bar';
// import { usePriceConversion } from '@/hooks/use-price-conversion';
// import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
// import { DexApi, type DexQuoteResponse } from '@/lib/api/dex';
// import type { DatabaseListing } from '@/types/rwa/section.types';

// import { getContractAddresses } from '@/lib/contracts/addresses';
// import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
// import { SwapCard } from './swap-card';

// const DEFAULT_SLIPPAGE_BPS = 100; // 1% slippage
// const SUPPORTED_DEX_ASSETS = ['ACES', 'USDC', 'USDT', 'ETH'] as const;
// const DEX_FALLBACK_ADDRESSES = {
//   USDC:
//     process.env.NEXT_PUBLIC_AERODROME_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C0b43d5Ee1fCD46a7B3',
//   ETH:
//     process.env.NEXT_PUBLIC_AERODROME_WETH_ADDRESS || '0x4200000000000000000000000000000000000006',
//   USDT:
//     process.env.NEXT_PUBLIC_AERODROME_USDT_ADDRESS || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
// } as const;
// const AERODROME_ROUTER_ABI = [
//   'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
//   'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
// ];
// const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;
// // const PERCENTAGE_PRESETS = [10, 25, 50, 75, 100] as const
// // const SLIPPAGE_PRESETS = [50, 100, 200] as const // 0.5%, 1%, 2%
// type TokenOption = {
//   symbol: string;
//   label: string;
//   address: string;
//   decimals: number;
//   icon: string;
//   isBase?: boolean;
// };

// interface TokenSwapInterfaceProps {
//   tokenSymbol?: string;
//   tokenPrice?: number;
//   userBalance?: number;
//   tokenAddress?: string;
//   tokenName?: string;
//   tokenOwner?: string;
//   showFrame?: boolean;
//   showHeader?: boolean;
//   showProgression?: boolean;
//   imageGallery?: string[];
//   primaryImage?: string;
//   chainId?: number; // Base Sepolia = 84532, Base Mainnet = 8453
//   dexMeta?: DatabaseListing['dex'] | null;
//   tokenDecimals?: number;
//   // Deprecated props (kept for backward compatibility)
//   currentAmount?: number;
//   targetAmount?: number;
//   percentage?: number;
// }

// export default function TokenSwapInterface({
//   tokenSymbol = 'RWA',
//   tokenAddress,
//   tokenName = tokenSymbol,
//   showFrame = true,
//   showHeader = true,
//   showProgression = true,
//   imageGallery,
//   primaryImage,
//   chainId = 84532, // Default to Base Sepolia
//   dexMeta = null,
//   tokenDecimals = 18,
// }: TokenSwapInterfaceProps) {
//   // If we just need a simple swap card, render it directly (without early return to respect hooks rules)
//   const useSimpleCard = !showHeader && !showProgression;

//   const { walletAddress, isAuthenticated, connectWallet: authConnectWallet } = useAuth();

//   // Contract state
//   const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
//   const [signer, setSigner] = useState<ethers.Signer | null>(null);
//   const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
//   const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);

//   const [currentChainId, setCurrentChainId] = useState<number | null>(null);

//   // Get current chain ID from wallet
//   const getCurrentChainId = async (): Promise<number | null> => {
//     if (typeof window === 'undefined' || !window.ethereum) {
//       return null;
//     }

//     try {
//       const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
//       return Number.parseInt(chainIdHex, 16);
//     } catch (error) {
//       console.error('Failed to get chain ID:', error);
//       return null;
//     }
//   };

//   // Get contract addresses for current chain
//   const getCurrentContractAddresses = () => {
//     // Default to Base Sepolia (84532) for development
//     return getContractAddresses(currentChainId || 84532);
//   };

//   const contractAddresses = useMemo(getCurrentContractAddresses, [currentChainId]);
//   const routerAddress = useMemo(
//     () => (contractAddresses as Record<string, string> | undefined)?.AERODROME_ROUTER || '',
//     [contractAddresses],
//   );

//   const dexAssetAddresses = useMemo(
//     () => ({
//       ACES: (contractAddresses.ACES_TOKEN || '').toLowerCase(),
//       USDC: (DEX_FALLBACK_ADDRESSES.USDC || '').toLowerCase(),
//       ETH: (DEX_FALLBACK_ADDRESSES.ETH || '').toLowerCase(),
//       USDT: (DEX_FALLBACK_ADDRESSES.USDT || '').toLowerCase(),
//     }),
//     [contractAddresses],
//   );

//   // Update chain ID when wallet connects or changes
//   useEffect(() => {
//     const updateChainId = async () => {
//       const chainId = await getCurrentChainId();
//       if (chainId && chainId !== currentChainId) {
//         console.log(`Chain ID changed from ${currentChainId} to ${chainId}`);
//         setCurrentChainId(chainId);
//       }
//     };

//     if (typeof window !== 'undefined' && window.ethereum) {
//       updateChainId();

//       // Listen for chain changes
//       const handleChainChanged = () => {
//         console.log('Chain changed, updating...');
//         updateChainId();
//       };

//       window.ethereum.on('chainChanged', handleChainChanged);

//       return () => {
//         window.ethereum?.removeListener('chainChanged', handleChainChanged);
//       };
//     }
//   }, [currentChainId]);

//   // Bonding state
//   const [tokenBonded, setTokenBonded] = useState<boolean>(false);
//   const [bondingPercentage, setBondingPercentage] = useState<number>(0);

//   // Balance state
//   const [acesBalance, setAcesBalance] = useState<string>('0');
//   const [tokenBalance, setTokenBalance] = useState<string>('0');
//   const [remainingCurveTokensWei, setRemainingCurveTokensWei] = useState<ethers.BigNumber | null>(
//     null,
//   );

//   // Price quote state
//   const [priceQuote, setPriceQuote] = useState<string>('0');
//   const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');
//   const [dexQuote, setDexQuote] = useState<DexQuoteResponse | null>(null);
//   const [dexQuoteLoading, setDexQuoteLoading] = useState(false);
//   const [dexQuoteError, setDexQuoteError] = useState<string | null>(null);
//   const [dexSwapPending, setDexSwapPending] = useState(false);

//   // UI state
//   const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
//   const [paymentAsset, setPaymentAsset] = useState<'ACES' | 'USDC' | 'USDT' | 'ETH'>('ACES');

//   const { data: usdConversion, loading: priceLoading } = usePriceConversion(
//     activeTab === 'buy' ? priceQuote : sellPriceQuote,
//   );
//   const usdDisplay = useMemo(() => {
//     if (!usdConversion?.usdValue) {
//       return null;
//     }

//     const numericValue = Number.parseFloat(usdConversion.usdValue);
//     if (!Number.isFinite(numericValue)) {
//       return null;
//     }

//     if (numericValue < 0.01) {
//       return '<$0.01 USD';
//     }

//     return `$${numericValue.toLocaleString(undefined, {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })} USD`;
//   }, [usdConversion]);
//   const [amount, setAmount] = useState('');
//   const [outputAmount, setOutputAmount] = useState('');
//   const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
//   const [fromToken, setFromToken] = useState<string>('ACES');
//   const [toToken, setToToken] = useState<string>(tokenSymbol);
//   const [stableBalances, setStableBalances] = useState<{ USDC: string; USDT: string; ETH: string }>(
//     {
//       USDC: '0',
//       USDT: '0',
//       ETH: '0',
//     },
//   );
//   const { USDC: usdcBalance, USDT: usdtBalance, ETH: ethBalance } = stableBalances;
//   const paymentAssetBalance = useMemo(() => {
//     switch (paymentAsset) {
//       case 'ACES':
//         return acesBalance;
//       case 'ETH':
//         return ethBalance;
//       case 'USDC':
//         return usdcBalance;
//       case 'USDT':
//         return usdtBalance;
//       default:
//         return '0';
//     }
//   }, [paymentAsset, acesBalance, ethBalance, usdcBalance, usdtBalance]);
//   const topBalanceLabel = useMemo(() => {
//     const rawValue = activeTab === 'sell' ? tokenBalance : paymentAssetBalance;
//     const numeric = Number.parseFloat(rawValue || '0');
//     const formatted = Number.isFinite(numeric) ? numeric.toFixed(4) : '0.0000';
//     const suffix = activeTab === 'sell' ? tokenSymbol : paymentAsset;
//     return `${formatted} ${suffix}`;
//   }, [activeTab, tokenBalance, tokenSymbol, paymentAssetBalance, paymentAsset]);
//   const bottomBalanceLabel = useMemo(() => {
//     const numeric = Number.parseFloat(tokenBalance || '0');
//     const formatted = Number.isFinite(numeric) ? numeric.toFixed(4) : '0.0000';
//     return `${formatted} ${tokenSymbol}`;
//   }, [tokenBalance, tokenSymbol]);
//   const [percentageSelection, setPercentageSelection] = useState<number | null>(null);
//   const [slippageMenuOpen, setSlippageMenuOpen] = useState(false);
//   /* TODO(Aerodrome API): Re-enable slippage controls when hooked into swap routing */
//   // const [slippage, setSlippage] = useState('0.5');
//   // const [showSlippageDropdown, setShowSlippageDropdown] = useState(false);
//   const [loading, setLoading] = useState<string>('');
//   const [networkError, setNetworkError] = useState<string | null>(null);
//   const [unsupportedNetwork, setUnsupportedNetwork] = useState<boolean>(false);
//   const [transactionStatus, setTransactionStatus] = useState<{
//     type: 'success' | 'error';
//     message: string;
//   } | null>(null);

//   const [copied, setCopied] = useState(false);

//   const {
//     bondingPercentage: readOnlyBondingPercentage,
//     isBonded: readOnlyIsBonded,
//     loading: readOnlyBondingLoading,
//     currentSupply: readOnlyCurrentSupply,
//     tokensBondedAt: readOnlyTokensBondedAt,
//   } = useTokenBondingData(tokenAddress, chainId);

//   const readOnlyRemainingTokensWei = useMemo(() => {
//     if (!readOnlyTokensBondedAt || !readOnlyCurrentSupply) {
//       return null;
//     }

//     try {
//       const maxWei = ethers.utils.parseEther(readOnlyTokensBondedAt);
//       const currentWei = ethers.utils.parseEther(readOnlyCurrentSupply);
//       if (maxWei.lte(currentWei)) {
//         return ethers.constants.Zero;
//       }
//       return maxWei.sub(currentWei);
//     } catch (error) {
//       console.warn('Failed to parse read-only bonding supply values:', error);
//       return null;
//     }
//   }, [readOnlyTokensBondedAt, readOnlyCurrentSupply]);

//   const normalizedWalletPercentage = Number.isFinite(bondingPercentage) ? bondingPercentage : 0;
//   const normalizedReadOnlyPercentage = Number.isFinite(readOnlyBondingPercentage)
//     ? readOnlyBondingPercentage
//     : 0;
//   const combinedBondingPercentage = Math.min(
//     100,
//     Math.max(normalizedWalletPercentage, normalizedReadOnlyPercentage),
//   );
//   const combinedIsBonded = tokenBonded || readOnlyIsBonded || combinedBondingPercentage >= 100;
//   const isDexMode =
//     combinedIsBonded &&
//     Boolean(dexMeta?.isDexLive && dexMeta.poolAddress && tokenAddress && routerAddress);
//   const dexTradeUrl = useMemo(() => {
//     if (!isDexMode || !tokenAddress) {
//       return null;
//     }

//     const paymentKey = paymentAsset as keyof typeof dexAssetAddresses;
//     const inputAddress = (dexAssetAddresses[paymentKey] || dexAssetAddresses.ACES)?.toLowerCase();
//     if (!inputAddress) {
//       return null;
//     }

//     // Get the input amount to pre-fill on Aerodrome
//     const amountParam =
//       amount && Number.parseFloat(amount) > 0 ? `&exactAmount=${amount}&exactField=input` : '';

//     // On Sell tab, swap the direction: sell token for ACES
//     // On Buy tab, keep normal: buy token with ACES
//     if (activeTab === 'sell') {
//       return `https://app.aerodrome.finance/swap?chain=base&inputCurrency=${tokenAddress.toLowerCase()}&outputCurrency=${inputAddress}${amountParam}`;
//     }

//     return `https://app.aerodrome.finance/swap?chain=base&inputCurrency=${inputAddress}&outputCurrency=${tokenAddress.toLowerCase()}${amountParam}`;
//   }, [isDexMode, tokenAddress, paymentAsset, dexAssetAddresses, activeTab, amount]);
//   const enforceCurveLimit = activeTab === 'buy' && !combinedIsBonded;

//   const effectiveRemainingTokensWei = useMemo(() => {
//     if (!enforceCurveLimit) {
//       return null;
//     }

//     if (remainingCurveTokensWei) {
//       return remainingCurveTokensWei;
//     }
//     if (readOnlyRemainingTokensWei) {
//       return readOnlyRemainingTokensWei;
//     }
//     return null;
//   }, [enforceCurveLimit, remainingCurveTokensWei, readOnlyRemainingTokensWei]);

//   const remainingCurveTokens = useMemo(() => {
//     if (!effectiveRemainingTokensWei) {
//       return null;
//     }
//     return Number.parseFloat(ethers.utils.formatEther(effectiveRemainingTokensWei));
//   }, [effectiveRemainingTokensWei]);

//   const showBondingLoading = readOnlyBondingLoading && !combinedIsBonded;
//   const isAcesPayment = paymentAsset === 'ACES';

//   const handleAmountChange = useCallback(
//     (rawValue: string) => {
//       if (!isDexMode && enforceCurveLimit) {
//         const integerPortion = rawValue.split('.')[0] ?? '';
//         const digitsOnly = integerPortion.replace(/\D/g, '');

//         if (!digitsOnly) {
//           setAmount('');
//           return;
//         }

//         const normalized = digitsOnly.replace(/^0+(?!$)/, '');
//         setAmount(normalized);
//         return;
//       }

//       setPercentageSelection(null);
//       setAmount(rawValue);
//     },
//     [enforceCurveLimit, isDexMode],
//   );

//   const handleAmountKeyDown = useCallback(
//     (event: KeyboardEvent<HTMLInputElement>) => {
//       if (!enforceCurveLimit || isDexMode) {
//         return;
//       }

//       if (
//         event.key === '.' ||
//         event.key === ',' ||
//         event.key === 'Decimal' ||
//         event.key === 'e' ||
//         event.key === 'E' ||
//         event.key === '+' ||
//         event.key === '-'
//       ) {
//         event.preventDefault();
//       }
//     },
//     [enforceCurveLimit, isDexMode],
//   );

//   const amountValueWei = useMemo(() => {
//     if (isDexMode) {
//       return null;
//     }

//     const trimmed = (amount || '').trim();
//     if (!trimmed) {
//       return null;
//     }

//     try {
//       const parsed = ethers.utils.parseUnits(trimmed, tokenDecimals);
//       return parsed.gt(ethers.constants.Zero) ? parsed : null;
//     } catch (error) {
//       return null;
//     }
//   }, [amount, isDexMode, tokenDecimals]);

//   const amountExceedsRemaining = useMemo(() => {
//     if (!enforceCurveLimit || !amountValueWei || !effectiveRemainingTokensWei) {
//       return false;
//     }
//     return amountValueWei.gt(effectiveRemainingTokensWei);
//   }, [amountValueWei, effectiveRemainingTokensWei, enforceCurveLimit]);

//   const dexInputAmount = useMemo(() => {
//     if (!isDexMode) {
//       return null;
//     }
//     const value = Number.parseFloat((amount || '').trim());
//     if (!Number.isFinite(value) || value <= 0) {
//       return null;
//     }
//     return value;
//   }, [amount, isDexMode]);

//   const hasValidAmount = useMemo(() => {
//     if (isDexMode) {
//       return dexInputAmount !== null;
//     }
//     return Boolean(amountValueWei) && !amountExceedsRemaining;
//   }, [isDexMode, dexInputAmount, amountValueWei, amountExceedsRemaining]);

//   const listingTokenIcon = useMemo(
//     () =>
//       getValidImageSrc(primaryImage || imageGallery?.[0], undefined, {
//         width: 32,
//         height: 32,
//         text: tokenSymbol,
//       }) || '/aces-logo.png',
//     [primaryImage, imageGallery, tokenSymbol],
//   );

//   const baseTokenOptions = useMemo<TokenOption[]>(() => {
//     const base: TokenOption[] = [
//       {
//         symbol: 'ACES',
//         label: 'ACES',
//         address: dexAssetAddresses.ACES ?? '',
//         decimals: 18,
//         icon: '/aces-logo.png',
//         isBase: true,
//       },
//       {
//         symbol: 'USDC',
//         label: 'USDC',
//         address: dexAssetAddresses.USDC ?? '',
//         decimals: 6,
//         icon: '/svg/usdc.svg',
//         isBase: true,
//       },
//       {
//         symbol: 'USDT',
//         label: 'USDT',
//         address: dexAssetAddresses.USDT ?? '',
//         decimals: 6,
//         icon: '/svg/tether.svg',
//         isBase: true,
//       },
//       {
//         symbol: 'ETH',
//         label: 'wETH',
//         address: dexAssetAddresses.ETH ?? '',
//         decimals: 18,
//         icon: '/svg/eth.svg',
//         isBase: true,
//       },
//     ];

//     return base.filter((token) => Boolean(token.address));
//   }, [dexAssetAddresses]);

//   const tokenOptions = useMemo<Record<string, TokenOption>>(() => {
//     const entries: Record<string, TokenOption> = {};

//     baseTokenOptions.forEach((option) => {
//       entries[option.symbol] = option;
//     });

//     entries[tokenSymbol] = {
//       symbol: tokenSymbol,
//       label: tokenName ?? tokenSymbol,
//       address: (tokenAddress ?? '').toLowerCase(),
//       decimals: tokenDecimals,
//       icon: listingTokenIcon,
//       isBase: false,
//     };

//     return entries;
//   }, [baseTokenOptions, tokenSymbol, tokenName, tokenAddress, tokenDecimals, listingTokenIcon]);

//   const fromTokenOptions = useMemo(() => {
//     const options: TokenOption[] = [...baseTokenOptions];
//     if (tokenOptions[tokenSymbol]) {
//       options.push(tokenOptions[tokenSymbol]);
//     }
//     return options;
//   }, [baseTokenOptions, tokenOptions, tokenSymbol]);

//   const isSellingListing = useMemo(() => fromToken === tokenSymbol, [fromToken, tokenSymbol]);

//   const toTokenOptions = useMemo(() => {
//     if (isSellingListing) {
//       return tokenOptions.ACES
//         ? [tokenOptions.ACES]
//         : baseTokenOptions.filter((opt) => opt.symbol === 'ACES');
//     }

//     return tokenOptions[tokenSymbol] ? [tokenOptions[tokenSymbol]] : [];
//   }, [isSellingListing, tokenOptions, tokenSymbol, baseTokenOptions]);

//   useEffect(() => {
//     if (!isDexMode) {
//       return;
//     }

//     if (fromToken === tokenSymbol) {
//       return;
//     }

//     const supported = SUPPORTED_DEX_ASSETS.includes(
//       fromToken as (typeof SUPPORTED_DEX_ASSETS)[number],
//     );

//     if (!supported) {
//       setFromToken('ACES');
//     }
//   }, [isDexMode, fromToken, tokenSymbol]);

//   useEffect(() => {
//     if (!isDexMode) {
//       return;
//     }

//     const sellingListing = fromToken === tokenSymbol;

//     if (sellingListing) {
//       if (toToken !== 'ACES') {
//         setToToken('ACES');
//       }
//       if (activeTab !== 'sell') {
//         setActiveTab('sell');
//       }
//       if (paymentAsset !== 'ACES') {
//         setPaymentAsset('ACES');
//       }
//     } else {
//       if (toToken !== tokenSymbol) {
//         setToToken(tokenSymbol);
//       }
//       if (activeTab !== 'buy') {
//         setActiveTab('buy');
//       }

//       if (
//         SUPPORTED_DEX_ASSETS.includes(fromToken as (typeof SUPPORTED_DEX_ASSETS)[number]) &&
//         paymentAsset !== (fromToken as typeof paymentAsset)
//       ) {
//         setPaymentAsset(fromToken as typeof paymentAsset);
//       }
//     }
//   }, [
//     isDexMode,
//     fromToken,
//     tokenSymbol,
//     toToken,
//     activeTab,
//     paymentAsset,
//     setActiveTab,
//     setPaymentAsset,
//   ]);

//   useEffect(() => {
//     if (!isDexMode) {
//       return;
//     }

//     setAmount('');
//     setOutputAmount('');
//     setDexQuote(null);
//     setDexQuoteError(null);
//     setPercentageSelection(null);
//   }, [fromToken, toToken, isDexMode]);

//   const remainingCurveTokensDisplay = useMemo(() => {
//     if (remainingCurveTokens === null) {
//       return null;
//     }

//     const maximumFractionDigits = remainingCurveTokens >= 1 ? 2 : 6;
//     return remainingCurveTokens.toLocaleString(undefined, { maximumFractionDigits });
//   }, [remainingCurveTokens]);

//   const amountError = useMemo(() => {
//     if (!amount) {
//       return null;
//     }

//     if (isDexMode) {
//       if (!dexInputAmount) {
//         return 'Enter an amount greater than zero.';
//       }
//       if (dexQuoteError) {
//         return dexQuoteError;
//       }
//       return null;
//     }

//     if (!amountValueWei) {
//       return 'Enter an amount greater than zero.';
//     }

//     if (enforceCurveLimit && amountExceedsRemaining) {
//       if (remainingCurveTokensDisplay !== null) {
//         return `Only ${remainingCurveTokensDisplay} ${tokenSymbol} remain in this bonding stage.`;
//       }

//       return 'Amount exceeds remaining supply on the bonding curve.';
//     }

//     return null;
//   }, [
//     amount,
//     amountValueWei,
//     amountExceedsRemaining,
//     remainingCurveTokensDisplay,
//     enforceCurveLimit,
//     tokenSymbol,
//     isDexMode,
//     dexInputAmount,
//     dexQuoteError,
//   ]);

//   const paymentAssetOptions = useMemo(() => {
//     const baseOptions = baseTokenOptions.map((option) => ({
//       value: option.symbol,
//       label: option.label,
//       icon: option.icon,
//     }));

//     if (!isDexMode) {
//       return baseOptions.filter((option) => option.value === 'ACES');
//     }

//     return baseOptions.filter((option) =>
//       SUPPORTED_DEX_ASSETS.includes(option.value as (typeof SUPPORTED_DEX_ASSETS)[number]),
//     );
//   }, [baseTokenOptions, isDexMode]);

//   const getTokenBalance = useCallback(
//     (symbol: string) => {
//       if (symbol === tokenSymbol) {
//         return tokenBalance;
//       }
//       if (symbol === 'ACES') {
//         return acesBalance;
//       }
//       if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'ETH') {
//         return stableBalances[symbol as keyof typeof stableBalances] ?? '0';
//       }
//       return '0';
//     },
//     [tokenSymbol, tokenBalance, acesBalance, stableBalances],
//   );

//   const getTokenDecimals = useCallback(
//     (symbol: string) => {
//       if (symbol === tokenSymbol) {
//         return tokenDecimals;
//       }
//       return tokenOptions[symbol]?.decimals ?? 18;
//     },
//     [tokenSymbol, tokenDecimals, tokenOptions],
//   );

//   const getTokenLabel = useCallback(
//     (symbol: string) => tokenOptions[symbol]?.label ?? symbol,
//     [tokenOptions],
//   );

//   const getTokenIcon = useCallback(
//     (symbol: string) => tokenOptions[symbol]?.icon ?? '/aces-logo.png',
//     [tokenOptions],
//   );

//   const formatAmountForDisplay = useCallback(
//     (value: string, symbol: string) => {
//       const parsed = Number.parseFloat(value || '0');
//       if (!Number.isFinite(parsed) || parsed === 0) {
//         return '0';
//       }

//       if (parsed < 0.0001) {
//         return '<0.0001';
//       }

//       const decimals = Math.min(getTokenDecimals(symbol), 6);
//       return parsed.toLocaleString(undefined, { maximumFractionDigits: decimals });
//     },
//     [getTokenDecimals],
//   );

//   const trimTrailingZeros = useCallback((value: string) => {
//     if (!value.includes('.')) {
//       return value;
//     }
//     return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
//   }, []);

//   const handlePercentageSelection = useCallback(
//     (percentageValue: number) => {
//       if (!isDexMode) {
//         return;
//       }

//       const balanceRaw = getTokenBalance(fromToken) || '0';
//       const decimals = getTokenDecimals(fromToken);

//       try {
//         setDexQuote(null);
//         setDexQuoteError(null);
//         setOutputAmount('');
//         const balanceUnits = ethers.utils.parseUnits(balanceRaw || '0', decimals);
//         if (balanceUnits.isZero()) {
//           setAmount('');
//           setPercentageSelection(percentageValue);
//           return;
//         }

//         const amountUnits = balanceUnits.mul(percentageValue).div(100);
//         const formatted = ethers.utils.formatUnits(amountUnits, decimals);
//         const normalized = amountUnits.isZero() ? '0' : trimTrailingZeros(formatted);
//         setPercentageSelection(percentageValue);
//         setAmount(normalized);
//       } catch (error) {
//         console.error('Failed to apply percentage selection:', error);
//       }
//     },
//     [
//       isDexMode,
//       getTokenBalance,
//       fromToken,
//       getTokenDecimals,
//       trimTrailingZeros,
//       setAmount,
//       setDexQuote,
//       setDexQuoteError,
//       setOutputAmount,
//     ],
//   );

//   const midPrice = useMemo(() => {
//     if (!isDexMode || !dexQuote || !dexInputAmount) {
//       return null;
//     }

//     const inputAmount = Number.parseFloat(dexQuote.inputAmount || amount || '0');
//     const outputAmountValue = Number.parseFloat(dexQuote.expectedOutput || '0');

//     if (!Number.isFinite(inputAmount) || inputAmount <= 0 || !Number.isFinite(outputAmountValue)) {
//       return null;
//     }

//     if (outputAmountValue <= 0) {
//       return null;
//     }

//     const price = outputAmountValue / inputAmount;
//     if (!Number.isFinite(price) || price <= 0) {
//       return null;
//     }

//     const inverse = inputAmount / outputAmountValue;

//     return {
//       price,
//       inverse,
//       from: getTokenLabel(fromToken),
//       to: getTokenLabel(toToken),
//     };
//   }, [isDexMode, dexQuote, dexInputAmount, amount, fromToken, toToken, getTokenLabel]);

//   const handleFlipTokens = useCallback(() => {
//     if (!isDexMode) {
//       return;
//     }

//     if (fromToken === tokenSymbol) {
//       setFromToken('ACES');
//       setToToken(tokenSymbol);
//     } else {
//       setFromToken(tokenSymbol);
//       setToToken('ACES');
//     }
//     setPercentageSelection(null);
//     setAmount('');
//     setOutputAmount('');
//     setDexQuote(null);
//     setDexQuoteError(null);
//   }, [isDexMode, fromToken, tokenSymbol, setDexQuote, setDexQuoteError, setOutputAmount]);

//   const formattedOutputAmount = useMemo(() => {
//     if (!outputAmount) {
//       return '';
//     }
//     return formatAmountForDisplay(outputAmount, toToken);
//   }, [outputAmount, formatAmountForDisplay, toToken]);

//   const fromTokenBalanceDisplay = useMemo(
//     () => formatAmountForDisplay(getTokenBalance(fromToken), fromToken),
//     [formatAmountForDisplay, getTokenBalance, fromToken],
//   );

//   const toTokenBalanceDisplay = useMemo(
//     () => formatAmountForDisplay(getTokenBalance(toToken), toToken),
//     [formatAmountForDisplay, getTokenBalance, toToken],
//   );

//   const getDisplaySymbol = useCallback((symbol: string) => {
//     if (!symbol) {
//       return symbol;
//     }
//     return symbol.toUpperCase() === 'ETH' ? 'wETH' : symbol;
//   }, []);

//   const formatDexAmount = useCallback((rawAmount: string) => {
//     const parsed = Number.parseFloat(rawAmount || '0');
//     if (!Number.isFinite(parsed)) {
//       return '0.00';
//     }
//     return parsed.toFixed(2);
//   }, []);

//   const usdEquivalent = useMemo(() => {
//     if (!usdConversion?.usdValue) {
//       return null;
//     }
//     const parsed = Number.parseFloat(usdConversion.usdValue);
//     return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
//   }, [usdConversion]);

//   const disableDexSwap = useMemo(() => {
//     if (!isDexMode) {
//       return false;
//     }
//     return !hasValidAmount || !dexQuote || dexQuoteLoading || dexSwapPending;
//   }, [isDexMode, hasValidAmount, dexQuote, dexQuoteLoading, dexSwapPending]);

//   const disableBuyAction = !isDexMode
//     ? !hasValidAmount || !!loading || combinedIsBonded
//     : disableDexSwap;
//   const disableSellAction = !isDexMode
//     ? !hasValidAmount || !!loading || combinedIsBonded
//     : disableDexSwap;

//   const refreshBalances = useCallback(async () => {
//     if (!acesContract || !tokenAddress || !signer) {
//       return;
//     }

//     try {
//       const address = await signer.getAddress();

//       const acesBalanceValue = await acesContract.balanceOf(address);
//       const formattedAcesBalance = ethers.utils.formatEther(acesBalanceValue);
//       setAcesBalance(formattedAcesBalance);

//       const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
//       const tokenBalanceValue = await tokenContract.balanceOf(address);
//       const formattedTokenBalance = ethers.utils.formatEther(tokenBalanceValue);
//       setTokenBalance(formattedTokenBalance);

//       try {
//         const baseTokenConfigs = [
//           { symbol: 'USDC', address: dexAssetAddresses.USDC, decimals: 6 },
//           { symbol: 'USDT', address: dexAssetAddresses.USDT, decimals: 6 },
//           { symbol: 'ETH', address: dexAssetAddresses.ETH, decimals: 18 },
//         ].filter((config) => config.address);

//         if (baseTokenConfigs.length > 0) {
//           const erc20Instances = baseTokenConfigs.map(
//             (config) => new ethers.Contract(config.address, ERC20_ABI, signer),
//           );

//           const balances = await Promise.all(
//             erc20Instances.map((contract) => contract.balanceOf(address)),
//           );

//           const formatted = baseTokenConfigs.reduce(
//             (acc, config, index) => {
//               const balanceValue = balances[index];
//               acc[config.symbol as 'USDC' | 'USDT' | 'ETH'] = ethers.utils.formatUnits(
//                 balanceValue,
//                 config.decimals,
//               );
//               return acc;
//             },
//             { USDC: stableBalances.USDC, USDT: stableBalances.USDT, ETH: stableBalances.ETH },
//           );

//           setStableBalances(formatted);
//         }
//       } catch (stableBalanceError) {
//         console.error('Failed to refresh stable balances:', stableBalanceError);
//       }

//       if (factoryContract) {
//         try {
//           const tokenInfo = await factoryContract.tokens(tokenAddress);
//           const totalSupply = await tokenContract.totalSupply();
//           const tokensBondedAt = tokenInfo.tokensBondedAt;

//           const remainingWei = tokensBondedAt.gt(totalSupply)
//             ? tokensBondedAt.sub(totalSupply)
//             : ethers.constants.Zero;
//           setRemainingCurveTokensWei(remainingWei);

//           const currentSupply = Number.parseFloat(ethers.utils.formatEther(totalSupply));
//           const maxSupply = Number.parseFloat(ethers.utils.formatEther(tokensBondedAt));
//           const percentage = maxSupply > 0 ? (currentSupply / maxSupply) * 100 : 0;

//           setTokenBonded(tokenInfo.tokenBonded);
//           setBondingPercentage(Math.min(percentage, 100));
//         } catch (bondingError) {
//           console.error('Failed to fetch bonding status:', bondingError);
//         }
//       }
//     } catch (error) {
//       console.error('Failed to refresh balances:', error);

//       if (
//         error &&
//         typeof error === 'object' &&
//         'message' in error &&
//         typeof error.message === 'string' &&
//         error.message.includes('circuit breaker')
//       ) {
//         console.log('Circuit breaker active - keeping existing balances, will retry later');
//         return;
//       }

//       if (
//         error &&
//         typeof error === 'object' &&
//         'code' in error &&
//         (error.code === 'UNSUPPORTED_OPERATION' || error.code === 'CALL_EXCEPTION')
//       ) {
//         console.log('Signer no longer valid, cleaning up...');
//         setProvider(null);
//         setSigner(null);
//         setFactoryContract(null);
//         setAcesContract(null);
//         setAcesBalance('0');
//         setTokenBalance('0');
//         setTokenBonded(false);
//         setBondingPercentage(0);
//         setRemainingCurveTokensWei(null);
//       }
//     }
//   }, [acesContract, tokenAddress, signer, factoryContract, dexAssetAddresses, stableBalances]);

//   const ensureDexAllowance = useCallback(
//     async (tokenAddr: string, amountRaw: string) => {
//       if (!signer || !walletAddress || !routerAddress) {
//         throw new Error('Wallet or router unavailable for approval');
//       }

//       const erc20Contract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
//       const allowance: ethers.BigNumber = await erc20Contract.allowance(
//         walletAddress,
//         routerAddress,
//       );
//       const requiredAmount = ethers.BigNumber.from(amountRaw);

//       console.log('Checking allowance:', {
//         token: tokenAddr,
//         router: routerAddress,
//         currentAllowance: ethers.utils.formatEther(allowance),
//         requiredAmount: ethers.utils.formatEther(requiredAmount),
//       });

//       if (allowance.gte(requiredAmount)) {
//         console.log('Sufficient allowance already exists');
//         return false; // No approval needed
//       }

//       console.log('Requesting approval from user...');
//       setLoading('Awaiting approval...');

//       try {
//         const approveTx = await erc20Contract.approve(routerAddress, requiredAmount);
//         setLoading('Confirming approval...');
//         await approveTx.wait();
//         console.log('Approval confirmed');
//         return true; // Approval was granted
//       } catch (error) {
//         console.error('Approval failed:', error);
//         throw new Error('Token approval was rejected or failed');
//       }
//     },
//     [signer, walletAddress, routerAddress],
//   );

//   const executeDexSwap = useCallback(async () => {
//     if (!isDexMode) {
//       return;
//     }

//     if (!signer || !walletAddress) {
//       setTransactionStatus({ type: 'error', message: 'Connect wallet to trade on Aerodrome.' });
//       return;
//     }

//     if (!dexQuote) {
//       setTransactionStatus({ type: 'error', message: 'No quote available. Enter an amount.' });
//       return;
//     }

//     if (!routerAddress) {
//       setTransactionStatus({
//         type: 'error',
//         message: 'Aerodrome router address not configured. Contact support.',
//       });
//       return;
//     }

//     try {
//       setDexSwapPending(true);
//       setTransactionStatus(null);
//       setLoading('');

//       console.log('=== DEX SWAP DEBUG ===');
//       console.log('Active tab:', activeTab);
//       console.log('Payment asset:', paymentAsset);
//       console.log('Quote:', dexQuote);

//       const routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
//       const path = dexQuote.path.map((addr) => ethers.utils.getAddress(addr));
//       const amountIn = ethers.BigNumber.from(dexQuote.inputAmountRaw);
//       const amountOutMin = ethers.BigNumber.from(dexQuote.minOutputRaw);
//       const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

//       // Verify user has sufficient balance
//       if (paymentAsset !== 'ETH' || activeTab === 'sell') {
//         const inputTokenAddress = path[0];
//         const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
//         const userBalance = await erc20Contract.balanceOf(walletAddress);

//         console.log('Balance check:', {
//           token: inputTokenAddress,
//           userBalance: ethers.utils.formatEther(userBalance),
//           required: ethers.utils.formatEther(amountIn),
//         });

//         if (userBalance.lt(amountIn)) {
//           throw new Error(
//             `Insufficient balance. You need ${ethers.utils.formatEther(amountIn)} but only have ${ethers.utils.formatEther(userBalance)}`,
//           );
//         }
//       }

//       console.log('Swap parameters:', {
//         path,
//         amountIn: ethers.utils.formatEther(amountIn),
//         amountOutMin: ethers.utils.formatEther(amountOutMin),
//         deadline: new Date(deadline * 1000).toISOString(),
//       });

//       let tx;

//       if (paymentAsset === 'ETH' && activeTab === 'buy') {
//         console.log('Executing ETH -> Token swap');
//         setLoading('Confirming swap...');
//         tx = await routerContract.swapExactETHForTokens(
//           amountOutMin,
//           path,
//           walletAddress,
//           deadline,
//           {
//             value: amountIn,
//           },
//         );
//       } else {
//         // For token swaps, need approval first
//         const inputTokenAddress = path[0];
//         console.log('Checking/requesting approval for token:', inputTokenAddress);

//         const approvalGranted = await ensureDexAllowance(
//           inputTokenAddress,
//           dexQuote.inputAmountRaw,
//         );

//         if (approvalGranted) {
//           console.log('Approval granted, proceeding with swap');
//         }

//         setLoading('Confirming swap...');
//         console.log('Executing Token -> Token swap');
//         tx = await routerContract.swapExactTokensForTokens(
//           amountIn,
//           amountOutMin,
//           path,
//           walletAddress,
//           deadline,
//         );
//       }

//       console.log('Swap transaction sent:', tx.hash);
//       setLoading('Waiting for confirmation...');
//       await tx.wait();
//       console.log('Swap confirmed');

//       setTransactionStatus({
//         type: 'success',
//         message: 'Swap confirmed on Aerodrome.',
//       });

//       setAmount('');
//       setDexQuote(null);
//       setLoading('Refreshing balances...');
//       await refreshBalances();
//       setLoading('');
//     } catch (error) {
//       console.error('Dex swap failed:', error);
//       let message =
//         error instanceof Error ? error.message : typeof error === 'string' ? error : 'Swap failed.';

//       // Better error messages for common failures
//       if (typeof message === 'string') {
//         if (message.toLowerCase().includes('insufficient_output')) {
//           message = 'Swap failed: received amount below minimum (check slippage or liquidity).';
//         } else if (
//           message.toLowerCase().includes('user rejected') ||
//           message.toLowerCase().includes('user denied')
//         ) {
//           message = 'Transaction was rejected by user.';
//         } else if (message.toLowerCase().includes('insufficient funds')) {
//           message = 'Insufficient balance to complete this swap.';
//         } else if (message.toLowerCase().includes('execution reverted')) {
//           message =
//             'Swap transaction failed. This may be due to insufficient allowance, low liquidity, or price impact. Try refreshing and swapping again.';
//         }
//       }

//       setTransactionStatus({ type: 'error', message });
//       setLoading('');
//     } finally {
//       setDexSwapPending(false);
//     }
//   }, [
//     isDexMode,
//     signer,
//     walletAddress,
//     dexQuote,
//     routerAddress,
//     paymentAsset,
//     activeTab,
//     ensureDexAllowance,
//     refreshBalances,
//   ]);

//   const handleBuyClick = async () => {
//     if (isDexMode) {
//       await executeDexSwap();
//       return;
//     }

//     if (isAcesPayment) {
//       await buyTokens();
//       return;
//     }

//     setTransactionStatus({
//       type: 'error',
//       message: `${paymentAsset} purchases will execute here once the new swap contract is deployed.`,
//     });
//   };

//   // const slippageOptions = ['0.5', '1.0', '2.0'];

//   const priceCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

//   useEffect(() => {
//     if (activeTab === 'sell' && paymentAsset !== 'ACES') {
//       setPaymentAsset('ACES');
//     }
//   }, [activeTab, paymentAsset]);

//   const copyToClipboard = async (text: string) => {
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     } catch (err) {
//       console.error('Failed to copy text: ', err);
//     }
//   };

//   useEffect(() => {
//     if (!transactionStatus) {
//       return;
//     }

//     const timeout = setTimeout(() => setTransactionStatus(null), 5000);
//     return () => clearTimeout(timeout);
//   }, [transactionStatus]);

//   // Get buy price quote with circuit breaker handling
//   const getBuyPriceQuote = useCallback(async () => {
//     if (!factoryContract || !tokenAddress || !amountValueWei) {
//       setPriceQuote('0');
//       return;
//     }

//     try {
//       const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountValueWei);
//       setPriceQuote(ethers.utils.formatEther(buyPrice));
//     } catch (error) {
//       console.error('Failed to get buy price quote:', error);

//       // For circuit breaker errors, keep the last known price instead of setting to '0'
//       if (
//         error &&
//         typeof error === 'object' &&
//         'message' in error &&
//         typeof error.message === 'string' &&
//         error.message.includes('circuit breaker')
//       ) {
//         console.log('Circuit breaker active - keeping existing price quote');
//         return; // Don't update price to '0'
//       }

//       setPriceQuote('0');
//     }
//   }, [factoryContract, tokenAddress, amountValueWei]);

//   // Get sell price quote with circuit breaker handling
//   const getSellPriceQuote = useCallback(async () => {
//     if (!factoryContract || !tokenAddress || !amountValueWei) {
//       setSellPriceQuote('0');
//       return;
//     }

//     try {
//       const sellPrice = await factoryContract.getSellPriceAfterFee(tokenAddress, amountValueWei);
//       setSellPriceQuote(ethers.utils.formatEther(sellPrice));
//     } catch (error) {
//       console.error('Failed to get sell price quote:', error);

//       // For circuit breaker errors, keep the last known price instead of setting to '0'
//       if (
//         error &&
//         typeof error === 'object' &&
//         'message' in error &&
//         typeof error.message === 'string' &&
//         error.message.includes('circuit breaker')
//       ) {
//         console.log('Circuit breaker active - keeping existing sell price quote');
//         return; // Don't update price to '0'
//       }

//       setSellPriceQuote('0');
//     }
//   }, [factoryContract, tokenAddress, amountValueWei]);

//   // Debounced price calculation
//   const calculatePriceQuote = useCallback(() => {
//     if (priceCalculationTimeoutRef.current) {
//       clearTimeout(priceCalculationTimeoutRef.current);
//     }

//     priceCalculationTimeoutRef.current = setTimeout(() => {
//       if (activeTab === 'buy') {
//         getBuyPriceQuote();
//       } else {
//         getSellPriceQuote();
//       }
//     }, 1000);
//   }, [activeTab, getBuyPriceQuote, getSellPriceQuote]);

//   // Auto-initialize provider when user is authenticated
//   useEffect(() => {
//     const initializeFromAuth = async () => {
//       console.log('🔍 SwapBox initialization check:', {
//         isAuthenticated,
//         walletAddress,
//         hasProvider: !!provider,
//         hasWindow: typeof window !== 'undefined',
//         hasEthereum: typeof window !== 'undefined' && !!window.ethereum,
//       });

//       if (isAuthenticated && walletAddress && !provider && typeof window !== 'undefined') {
//         try {
//           // Wait for Privy to inject the provider (it may take a moment)
//           let ethProvider = window.ethereum || (window as any).ethereum;

//           if (!ethProvider) {
//             console.log('⏳ Waiting for Privy to inject provider...');
//             // Retry after a short delay
//             setTimeout(() => {
//               console.log('🔄 Retrying provider initialization...');
//               initializeFromAuth();
//             }, 500);
//             return;
//           }

//           // Get the current chain ID first
//           const chainId = await getCurrentChainId();
//           console.log('⛓️ Current chain ID:', chainId);

//           // Validate addresses for this network
//           const addresses = getContractAddresses(chainId || 84532);
//           console.log('📍 Contract addresses:', addresses);

//           // Check if factory and ACES token are configured
//           if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
//             console.error(`❌ Contract addresses not configured for chain ID ${chainId}`);
//             setUnsupportedNetwork(true);
//             setNetworkError('');
//             return;
//           }

//           setUnsupportedNetwork(false);
//           console.log('✅ Auto-initializing provider from auth...');

//           // Initialize provider - works with both Privy embedded wallets and external wallets
//           const newProvider = new ethers.providers.Web3Provider(ethProvider);
//           console.log('📱 Using ethereum provider');

//           const newSigner = newProvider.getSigner(walletAddress);

//           setProvider(newProvider);
//           setSigner(newSigner);

//           const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
//           setFactoryContract(factory);

//           const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);
//           setAcesContract(aces);

//           console.log('🎉 Auto-initialization complete', {
//             chainId,
//             factoryProxy: addresses.FACTORY_PROXY,
//             acesToken: addresses.ACES_TOKEN,
//           });
//         } catch (error) {
//           console.error('❌ Failed to initialize from auth:', error);
//           setNetworkError(
//             'Failed to initialize wallet connection. Please try refreshing the page.',
//           );
//         }
//       } else if (!isAuthenticated || !walletAddress) {
//         // Clean up when disconnected
//         console.log('🧹 User disconnected, cleaning up state...');
//         setProvider(null);
//         setSigner(null);
//         setFactoryContract(null);
//         setAcesContract(null);
//         setAcesBalance('0');
//         setTokenBalance('0');
//         setPriceQuote('0');
//         setSellPriceQuote('0');
//         setUnsupportedNetwork(false);
//       } else {
//         console.log('⏭️ Skipping initialization:', {
//           reason: provider ? 'Provider already exists' : 'Conditions not met',
//         });
//       }
//     };

//     initializeFromAuth();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [isAuthenticated, walletAddress, currentChainId]); // ✅ Removed provider from deps to prevent loop

//   // Refresh balances only when properly connected
//   useEffect(() => {
//     if (acesContract && tokenAddress && signer && isAuthenticated) {
//       refreshBalances();
//     }
//   }, [acesContract, tokenAddress, signer, isAuthenticated, refreshBalances]);

//   // Update price quotes when amount or active tab changes
//   useEffect(() => {
//     if (isDexMode) {
//       return;
//     }
//     calculatePriceQuote();
//   }, [calculatePriceQuote, isDexMode]);

//   useEffect(() => {
//     if (!isDexMode) {
//       setDexQuote(null);
//       setDexQuoteError(null);
//       setOutputAmount('');
//       return;
//     }

//     if (!SUPPORTED_DEX_ASSETS.includes(paymentAsset as (typeof SUPPORTED_DEX_ASSETS)[number])) {
//       setPaymentAsset('ACES');
//       return;
//     }

//     if (!tokenAddress || !hasValidAmount) {
//       setDexQuote(null);
//       setDexQuoteError(null);
//       setOutputAmount('');
//       return;
//     }

//     let cancelled = false;
//     setDexQuoteLoading(true);

//     // On Sell tab, we're selling the token for ACES
//     // On Buy tab, we're buying the token with ACES/USDC/USDT/wETH
//     const inputAsset = activeTab === 'sell' ? 'TOKEN' : paymentAsset;

//     DexApi.getQuote(tokenAddress, {
//       inputAsset,
//       amount,
//       slippageBps,
//     })
//       .then((result) => {
//         if (cancelled) return;
//         if (result.success && result.data) {
//           setDexQuote(result.data);
//           setDexQuoteError(null);
//           setOutputAmount(result.data.expectedOutput);
//         } else {
//           setDexQuote(null);
//           setOutputAmount('');
//           setDexQuoteError(
//             result.error instanceof Error ? result.error.message : 'Failed to fetch quote',
//           );
//         }
//       })
//       .catch((error) => {
//         if (cancelled) return;
//         console.error('Failed to fetch DEX quote:', error);
//         setDexQuote(null);
//         setOutputAmount('');
//         setDexQuoteError(error instanceof Error ? error.message : 'Failed to fetch quote');
//       })
//       .finally(() => {
//         if (!cancelled) {
//           setDexQuoteLoading(false);
//         }
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [
//     isDexMode,
//     tokenAddress,
//     paymentAsset,
//     amount,
//     hasValidAmount,
//     dexMeta,
//     activeTab,
//     slippageBps,
//   ]);

//   const handleConnectWallet = useCallback(async () => {
//     try {
//       setLoading('Connecting wallet...');
//       await authConnectWallet();
//     } catch (error) {
//       console.error('Failed to connect wallet via auth context:', error);
//     } finally {
//       setLoading('');
//     }
//   }, [authConnectWallet]);

//   // Buy tokens
//   const buyTokens = async () => {
//     if (!factoryContract || !acesContract || !tokenAddress || !amountValueWei || !signer) return;

//     setTransactionStatus(null);

//     try {
//       const amountWei = amountValueWei;
//       const priceWei = ethers.utils.parseEther(priceQuote);

//       if (effectiveRemainingTokensWei && amountWei.gt(effectiveRemainingTokensWei)) {
//         setTransactionStatus({
//           type: 'error',
//           message: 'Amount exceeds remaining supply on the bonding curve.',
//         });
//         return;
//       }

//       console.log('=== BUY TOKENS DEBUG ===');
//       console.log('Token to buy:', tokenAddress);
//       console.log('Amount (tokens):', amount);
//       console.log('Price (ACES):', priceQuote);

//       const address = await signer.getAddress();
//       const currentAddresses = getCurrentContractAddresses();
//       const currentAllowance = await acesContract.allowance(
//         address,
//         currentAddresses.FACTORY_PROXY,
//       );
//       const currentAcesBalance = await acesContract.balanceOf(address);

//       console.log('Current allowance:', ethers.utils.formatEther(currentAllowance));
//       console.log('Required amount:', ethers.utils.formatEther(priceWei));
//       console.log('Current ACES balance:', ethers.utils.formatEther(currentAcesBalance));

//       // Step 1: Approve ACES tokens
//       setLoading('Approving ACES tokens...');
//       const approveTx = await acesContract.approve(currentAddresses.FACTORY_PROXY, priceWei);
//       await approveTx.wait(2); // wait for 2 confirmations to avoid short-lived reorg issues

//       // Step 2: Buy tokens
//       setLoading('Buying tokens...');
//       const buyTx = await factoryContract.buyTokens(tokenAddress, amountWei, priceWei);
//       await buyTx.wait();

//       // Step 3: Refresh balances
//       setLoading('Refreshing balances...');
//       await refreshBalances();

//       setLoading('');
//       setAmount('');
//       setNetworkError(null); // Clear any previous network errors on success
//       setTransactionStatus({ type: 'success', message: 'Transaction successful.' });
//     } catch (error) {
//       console.error('Failed to buy tokens:', error);
//       setLoading('');

//       // Handle circuit breaker errors specifically
//       if (error instanceof Error && error.message.includes('circuit breaker')) {
//         setNetworkError('Network congestion detected. Please try again in a few minutes.');
//         setTransactionStatus({
//           type: 'error',
//           message: 'Transaction failed due to network congestion. Please try again later.',
//         });
//       } else {
//         setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
//       }
//     }
//   };

//   // Sell tokens
//   const sellTokens = async () => {
//     if (!factoryContract || !tokenAddress || !amountValueWei || !signer) return;

//     setTransactionStatus(null);

//     try {
//       const amountWei = amountValueWei;

//       console.log('=== SELL TOKENS DEBUG ===');
//       console.log('Token to sell:', tokenAddress);
//       console.log('Amount (tokens):', amount);

//       const address = await signer.getAddress();
//       const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
//       const currentTokenBalance = await tokenContract.balanceOf(address);

//       console.log('Current token balance:', ethers.utils.formatEther(currentTokenBalance));
//       console.log('Estimated ACES received:', sellPriceQuote);

//       if (currentTokenBalance.lt(amountWei)) {
//         throw new Error(
//           `Insufficient token balance! You have ${ethers.utils.formatEther(currentTokenBalance)} but trying to sell ${amount}`,
//         );
//       }

//       setLoading('Selling tokens...');
//       const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
//       await tx.wait();

//       setLoading('Refreshing balances...');
//       await refreshBalances();

//       setLoading('');
//       setNetworkError(null); // Clear any previous network errors on success
//       setTransactionStatus({ type: 'success', message: 'Transaction successful.' });
//     } catch (error) {
//       console.error('Failed to sell tokens:', error);
//       setLoading('');

//       // Handle circuit breaker errors specifically
//       if (error instanceof Error && error.message.includes('circuit breaker')) {
//         setNetworkError('Network congestion detected. Please try again in a few minutes.');
//         setTransactionStatus({
//           type: 'error',
//           message: 'Transaction failed due to network congestion. Please try again later.',
//         });
//       } else if (error instanceof Error && error.message.includes('Insufficient token balance')) {
//         setTransactionStatus({
//           type: 'error',
//           message: 'Transaction failed: insufficient token balance.',
//         });
//       } else {
//         setTransactionStatus({ type: 'error', message: 'Transaction failed.' });
//       }
//     }
//   };

//   // Swap logic for DEX
//   const handleSwapClick = async () => {
//     if (isDexMode) {
//       await executeDexSwap();
//     } else {
//       // Fallback to bonding curve logic if not in DEX mode
//       if (activeTab === 'buy') {
//         await handleBuyClick();
//       } else {
//         await sellTokens();
//       }
//     }
//   };

//   const handleLegacyTokenSelectorChange = useCallback(
//     (type: 'from' | 'to', value: string) => {
//       setDexQuote(null);
//       setDexQuoteError(null);
//       setOutputAmount('');
//       setAmount('');

//       if (type === 'from') {
//         if (value === 'RWA') {
//           setActiveTab('sell');
//           setPaymentAsset('ACES');
//         } else {
//           setActiveTab('buy');
//           setPaymentAsset(value as typeof paymentAsset);
//         }
//       } else {
//         if (value === 'ACES') {
//           setActiveTab('sell');
//           setPaymentAsset('ACES');
//         } else {
//           setActiveTab('buy');
//         }
//       }
//     },
//     [
//       setDexQuote,
//       setDexQuoteError,
//       setOutputAmount,
//       setAmount,
//       setActiveTab,
//       setPaymentAsset,
//       paymentAsset,
//     ],
//   );

//   // Render simple SwapCard when no header/progression needed
//   if (useSimpleCard) {
//     return (
//       <SwapCard
//         tokenSymbol={tokenSymbol}
//         tokenAddress={tokenAddress}
//         chainId={chainId}
//         dexMeta={dexMeta}
//       />
//     );
//   }

//   return (
//     <div className="h-full">
//       <div
//         className={cn(
//           'bg-black h-full flex flex-col relative',
//           showFrame
//             ? 'rounded-lg border border-[#D0B284]/20'
//             : cn('px-4 sm:px-6 pb-6', showHeader ? 'pt-4' : 'pt-2'),
//         )}
//       >
//         {showHeader && (
//           <>
//             <div className={cn('mb-4 sm:mb-6', showFrame ? 'px-6 pt-6' : '')}>
//               <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3 mb-2">
//                     <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#D0B284]/30">
//                       <Image
//                         src={getValidImageSrc(primaryImage || imageGallery?.[0], undefined, {
//                           width: 24,
//                           height: 24,
//                           text: 'Token',
//                         })}
//                         alt={`${tokenSymbol} logo`}
//                         width={24}
//                         height={24}
//                         className="w-full h-full object-cover"
//                         onError={createImageErrorHandler({
//                           fallbackText: 'Token',
//                           width: 24,
//                           height: 24,
//                           onError: (src) => {
//                             console.error('Token image failed to load:', src);
//                           },
//                           maxRetries: 1,
//                         })}
//                         unoptimized={true}
//                       />
//                     </div>
//                     <h2 className="text-[#D0B284] text-2xl font-mono font-bold leading-none">
//                       ${tokenSymbol}
//                     </h2>
//                   </div>

//                   {tokenAddress && (
//                     <div className="flex items-center gap-2 rounded-md bg-black/20 px-3 py-1.5 border border-[#D0B284]/20 w-fit">
//                       <span className="text-xs text-[#D0B284] font-mono">
//                         {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
//                       </span>
//                       <button
//                         onClick={() => copyToClipboard(tokenAddress)}
//                         className="flex h-4 w-4 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
//                       >
//                         {copied ? (
//                           <Check className="h-2.5 w-2.5 text-[#D0B284]" />
//                         ) : (
//                           <Copy className="h-2.5 w-2.5 text-[#D0B284]" />
//                         )}
//                       </button>
//                     </div>
//                   )}
//                 </div>

//                 <div className="flex w-full sm:w-auto flex-col sm:items-end gap-1 px-3 py-2 backdrop-blur-sm rounded-lg border border-[#D0B284]/10 sm:border-transparent">
//                   <div className="flex items-start gap-2">
//                     <span className="text-[#D0B284]/60 text-xs leading-none">Balance</span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <span className="text-[#D0B284]/60 text-xs">ACES:</span>
//                     <span className="text-[#D0B284] font-mono text-xs">
//                       {Number.parseFloat(acesBalance).toFixed(4)}
//                     </span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <span className="text-[#D0B284]/60 text-xs">{tokenSymbol}:</span>
//                     <span className="text-[#D0B284] font-mono text-xs">
//                       {Number.parseFloat(tokenBalance).toFixed(4)}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="relative -mx-6 mb-6">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 width="100%"
//                 height="8"
//                 viewBox="0 0 100 2"
//                 preserveAspectRatio="none"
//                 className="pointer-events-none"
//               >
//                 <line
//                   x1="0"
//                   y1="1"
//                   x2="100"
//                   y2="1"
//                   stroke="#D0B284"
//                   strokeOpacity={0.5}
//                   strokeWidth={1}
//                   strokeDasharray="12 12"
//                   vectorEffect="non-scaling-stroke"
//                   shapeRendering="crispEdges"
//                 />
//               </svg>
//             </div>
//           </>
//         )}

//         {showProgression && (
//           <>
//             <div className="mb-6">
//               <ProgressionBar
//                 tokenAddress={tokenAddress}
//                 chainId={chainId}
//                 percentage={combinedBondingPercentage}
//                 isBondedOverride={combinedIsBonded}
//               />
//               <div
//                 className={`mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center ${
//                   combinedIsBonded ? 'text-[#D7BF75]/80' : 'text-[#D7BF75]/80'
//                 }`}
//               >
//                 {showBondingLoading
//                   ? 'Loading bonding data...'
//                   : combinedIsBonded
//                     ? 'BONDED - 100%'
//                     : `Bonded ${combinedBondingPercentage.toFixed(1)}% / 100%`}
//               </div>
//               {enforceCurveLimit && remainingCurveTokensDisplay !== null && !showBondingLoading && (
//                 <div className="mt-2 text-xs text-[#D0B284]/80 text-center">
//                   {remainingCurveTokensDisplay} {tokenSymbol} left in the bonding curve
//                 </div>
//               )}
//             </div>

//             <div className="relative -mx-6 mb-6">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 width="100%"
//                 height="8"
//                 viewBox="0 0 100 2"
//                 preserveAspectRatio="none"
//                 className="pointer-events-none"
//               >
//                 <line
//                   x1="0"
//                   y1="1"
//                   x2="100"
//                   y2="1"
//                   stroke="#D0B284"
//                   strokeOpacity={0.5}
//                   strokeWidth={1}
//                   strokeDasharray="12 12"
//                   vectorEffect="non-scaling-stroke"
//                   shapeRendering="crispEdges"
//                 />
//               </svg>
//             </div>
//           </>
//         )}

//         {/* Network Error Banner */}
//         {networkError && (
//           <div
//             className={`mb-4 p-3 border rounded-lg ${
//               unsupportedNetwork
//                 ? 'bg-red-900/50 border-red-600/50'
//                 : 'bg-orange-900/50 border-orange-600/50'
//             }`}
//           >
//             <div className="flex items-center justify-between">
//               <div
//                 className={`flex items-center text-sm ${unsupportedNetwork ? 'text-red-200' : 'text-orange-200'}`}
//               >
//                 <span className="mr-2">{unsupportedNetwork ? '🚫' : '⚠️'}</span>
//                 <div>
//                   <div className="font-semibold mb-1">
//                     {unsupportedNetwork ? 'Unsupported Network' : 'Network Issue'}
//                   </div>
//                   <div className="text-xs">{networkError}</div>
//                 </div>
//               </div>
//               <button
//                 onClick={() => {
//                   setNetworkError(null);
//                   setUnsupportedNetwork(false);
//                 }}
//                 className={`text-sm underline ${
//                   unsupportedNetwork
//                     ? 'text-red-200 hover:text-red-100'
//                     : 'text-orange-200 hover:text-orange-100'
//                 }`}
//               >
//                 Dismiss
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Bonding Complete Banner */}
//         {/* {combinedIsBonded && (
//           <div className="mb-4 p-3 bg-green-900/50 border border-green-600/50 rounded-lg">
//             <div className="flex items-center text-green-200 text-sm">
//               <span className="mr-2">✅</span>
//               <div>
//                 <div className="font-semibold">Bonding Complete!</div>
//                 <div className="text-xs mt-1 text-green-300">
//                   This token has reached 100% bonding. Trading now routes through Aerodrome
//                   liquidity.
//                   {isDexMode && dexTradeUrl && (
//                     <button
//                       onClick={() => window.open(dexTradeUrl, '_blank', 'noopener,noreferrer')}
//                       className="ml-1 underline text-green-200 hover:text-green-100"
//                     >
//                       Open Aerodrome
//                     </button>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )} */}

//         {/* Bonding Progress Warning (when close to 100%) */}
//         {!combinedIsBonded && combinedBondingPercentage >= 90 && (
//           <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-600/50 rounded-lg">
//             <div className="flex items-center text-yellow-200 text-sm">
//               <div>
//                 <div className="font-semibold">Bonding Almost Complete</div>
//                 <div className="text-xs mt-1 text-yellow-300">
//                   Once 100% is reached, this token will migrate to LP.
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Swap interface */}
//         <div className={cn('flex-1 space-y-6', showFrame ? 'px-6 pb-6' : '')}>
//           {isDexMode ? (
//             <>
//               {/* Use SwapCard for DEX mode */}
//               <div className="mx-auto w-full max-w-[560px]">
//                 <SwapCard
//                   tokenSymbol={tokenSymbol}
//                   tokenAddress={tokenAddress}
//                   chainId={chainId}
//                   dexMeta={dexMeta}
//                   onSwapComplete={refreshBalances}
//                 />
//               </div>
//             </>
//           ) : (
//             <>
//               <div className="relative flex flex-col gap-5">
//                 <div className="rounded-3xl border border-[#D0B284]/25 bg-[#0B0F0B] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
//                   <div className="flex items-center justify-between">
//                     <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#D0B284]/70">
//                       Sell
//                     </span>
//                     <div className="relative inline-flex min-w-[140px] justify-end">
//                       <select
//                         className="appearance-none rounded-full border border-[#D0B284]/25 bg-black/70 px-4 pr-9 py-2 text-sm font-semibold text-[#D0B284] focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
//                         value={activeTab === 'sell' ? 'RWA' : paymentAsset}
//                         onChange={(e) => {
//                           handleLegacyTokenSelectorChange('from', e.target.value);
//                           setDexQuote(null);
//                         }}
//                       >
//                         {activeTab === 'sell' ? (
//                           <option value="RWA">{tokenSymbol}</option>
//                         ) : (
//                           paymentAssetOptions.map((option) => (
//                             <option key={option.value} value={option.value}>
//                               {option.label}
//                             </option>
//                           ))
//                         )}
//                       </select>
//                       <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D0B284]/60" />
//                     </div>
//                   </div>

//                   <div className="mt-4">
//                     <input
//                       value={amount}
//                       onChange={(e) => handleAmountChange(e.target.value)}
//                       onKeyDown={handleAmountKeyDown}
//                       placeholder="0"
//                       inputMode={enforceCurveLimit ? 'numeric' : 'decimal'}
//                       aria-invalid={Boolean(amountError)}
//                       className={cn(
//                         'w-full border-none bg-transparent text-4xl font-semibold text-white outline-none focus:ring-0 placeholder:text-[#D0B284]/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
//                         enforceCurveLimit ? 'tracking-tight' : '',
//                       )}
//                     />
//                   </div>

//                   {hasValidAmount && usdDisplay && (
//                     <div className="mt-2 text-sm text-[#D0B284]/70">
//                       ≈ {usdDisplay}
//                       {usdConversion?.isStale && (
//                         <span className="ml-1 text-[#D0B284]/40">(cached)</span>
//                       )}
//                     </div>
//                   )}

//                   {amountError ? (
//                     <p className="mt-3 text-xs text-red-300">{amountError}</p>
//                   ) : enforceCurveLimit ? (
//                     <p className="mt-3 text-xs text-[#D0B284]/60">
//                       Bonding curve purchases require whole-token amounts.
//                     </p>
//                   ) : null}

//                   <div className="mt-3 flex items-center justify-between text-xs text-[#D0B284]/60">
//                     <span>Balance</span>
//                     <span className="font-mono text-[#D0B284]">{topBalanceLabel}</span>
//                   </div>
//                 </div>

//                 <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
//                   <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D0B284]/30 bg-black/80 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
//                     <ArrowDown className="h-4 w-4 text-[#D0B284]" />
//                   </div>
//                 </div>

//                 <div className="rounded-3xl border border-[#D0B284]/25 bg-[#0B0F0B] p-4 pt-5 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
//                   <div className="flex items-center justify-between">
//                     <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#D0B284]/70">
//                       Buy
//                     </span>
//                     <div className="relative inline-flex min-w-[140px] justify-end">
//                       <select
//                         className="appearance-none rounded-full border border-[#D0B284]/25 bg-black/70 px-4 pr-9 py-2 text-sm font-semibold text-[#D0B284] focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
//                         value={activeTab === 'sell' ? 'ACES' : 'RWA'}
//                         onChange={(e) => {
//                           handleLegacyTokenSelectorChange('to', e.target.value);
//                           setDexQuote(null);
//                         }}
//                       >
//                         <option value="RWA">{tokenSymbol}</option>
//                         <option value="ACES">ACES</option>
//                       </select>
//                       <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D0B284]/60" />
//                     </div>
//                   </div>

//                   <div className="mt-4">
//                     <input
//                       value={outputAmount || amount}
//                       readOnly
//                       className="w-full border-none bg-transparent text-4xl font-semibold text-white/90 outline-none"
//                     />
//                   </div>

//                   <div className="mt-4 flex items-center justify-between text-xs text-[#D0B284]/60">
//                     <span>Balance</span>
//                     <span className="font-mono text-[#D0B284]">{bottomBalanceLabel}</span>
//                   </div>
//                 </div>
//               </div>

//               <div className="mt-6">
//                 {!isAuthenticated || !provider ? (
//                   <Button
//                     onClick={handleConnectWallet}
//                     disabled={!!loading}
//                     className="w-full h-14 rounded-2xl border border-[#D0B284]/30 bg-[#101610] text-[#D0B284] font-proxima-nova font-bold text-lg transition-colors hover:bg-[#151d14] disabled:opacity-50"
//                   >
//                     {loading || 'Connect Wallet'}
//                   </Button>
//                 ) : (
//                   <Button
//                     onClick={handleSwapClick}
//                     disabled={activeTab === 'sell' ? disableSellAction : disableBuyAction}
//                     className="w-full h-14 rounded-2xl border border-[#D0B284]/30 bg-[#101610] text-[#D0B284] font-spray-letters font-bold text-2xl tracking-widest uppercase transition-colors hover:bg-[#151d14] disabled:cursor-not-allowed disabled:opacity-50"
//                   >
//                     {loading ? (
//                       <span className="flex items-center justify-center">
//                         <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
//                         <span className="sr-only">{loading}</span>
//                       </span>
//                     ) : (
//                       'SWAP'
//                     )}
//                   </Button>
//                 )}
//               </div>
//             </>
//           )}

//           {transactionStatus && (
//             <div className="fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 px-4">
//               <div
//                 role={transactionStatus.type === 'success' ? 'status' : 'alert'}
//                 aria-live={transactionStatus.type === 'success' ? 'polite' : 'assertive'}
//                 className={cn(
//                   'flex-1 rounded-xl border px-4 py-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md',
//                   transactionStatus.type === 'success'
//                     ? 'bg-green-900/80 border-green-500/30 text-green-100'
//                     : 'bg-red-900/80 border-red-600/40 text-red-100',
//                 )}
//               >
//                 <div className="flex items-start justify-between gap-3">
//                   <span className="leading-snug">{transactionStatus.message}</span>
//                   <button
//                     onClick={() => setTransactionStatus(null)}
//                     className="text-xs font-semibold uppercase tracking-wide opacity-80 transition-opacity hover:opacity-100"
//                   >
//                     Dismiss
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
