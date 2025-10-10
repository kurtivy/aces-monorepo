'use client';

import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { Copy, Check, Loader2, ChevronDown, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
import ProgressionBar from '@/components/rwa/middle-column/overview/progression-bar';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { getContractAddresses } from '@/lib/contracts/addresses';

// Import new hooks
import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
import { useSwapMode } from '@/hooks/swap/use-swap-mode';
import { useTokenBalances } from '@/hooks/swap/use-token-balances';
import { useBondingCurveQuote } from '@/hooks/swap/use-bonding-curve-quote';
import { useDexQuote } from '@/hooks/swap/use-dex-quote';

// Import services
import { BondingCurveSwapService } from '@/lib/swap/services/bonding-curve-swap-service';
import { DexSwapService } from '@/lib/swap/services/dex-swap-service';

// Import utilities
import { formatAmountForDisplay, formatUsdValue } from '@/lib/swap/formatters';
import type { PaymentAsset } from '@/lib/swap/types';

// Import the newer SwapCard component
import { SwapCard } from './swap-card';
import { PercentageSelector } from './percentage-selector';

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
  tokenDecimals?: number;
  // Deprecated props (kept for backward compatibility)
  currentAmount?: number;
  targetAmount?: number;
  percentage?: number;
}

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenAddress,
  tokenName = tokenSymbol,
  showFrame = true,
  showHeader = true,
  showProgression = true,
  imageGallery,
  primaryImage,
  chainId = 84532,
  dexMeta = null,
  tokenDecimals = 18,
}: TokenSwapInterfaceProps) {
  // If we just need a simple swap card, render it directly
  const useSimpleCard = !showHeader && !showProgression;

  const { walletAddress, isAuthenticated, connectWallet: authConnectWallet } = useAuth();

  // Initialize contracts
  const contracts = useSwapContracts(walletAddress, isAuthenticated, tokenAddress);
  const { provider, signer, factoryContract, acesContract, currentChainId, isInitialized } =
    contracts;

  // Get contract addresses
  const contractAddresses = useMemo(
    () => getContractAddresses(currentChainId || 84532),
    [currentChainId],
  );

  const routerAddress = useMemo(
    () => (contractAddresses as Record<string, string> | undefined)?.AERODROME_ROUTER || '',
    [contractAddresses],
  );

  // Determine swap mode
  const swapMode = useSwapMode({
    tokenAddress,
    chainId,
    dexMeta,
    routerAddress,
  });

  const { isDexMode, bondingPercentage, tokenBonded, bondingLoading, canSwap } = swapMode;

  // Manage balances
  const balances = useTokenBalances({
    acesContract,
    tokenContract: contracts.tokenContract,
    signer,
    factoryContract,
    tokenAddress,
  });

  const { acesBalance, tokenBalance, stableBalances, refreshBalances } = balances;

  // UI state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>('ACES');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState<string>('');
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Get bonding curve quotes
  const bondingQuote = useBondingCurveQuote({
    factoryContract,
    tokenAddress,
    amount,
    tokenDecimals,
    isDexMode,
    activeTab,
  });

  // Get DEX quotes
  const dexQuote = useDexQuote({
    tokenAddress,
    amount,
    paymentAsset,
    activeTab,
    isDexMode,
  });

  // Format USD display
  const usdDisplay = useMemo(() => {
    if (!isDexMode && bondingQuote.totalUsdValue) {
      return formatUsdValue(bondingQuote.totalUsdValue);
    }
    return null;
  }, [isDexMode, bondingQuote.totalUsdValue]);

  // Determine if we have a valid amount
  const hasValidAmount = useMemo(() => {
    if (!amount || amount.trim() === '') return false;

    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;

    return true;
  }, [amount]);

  // Handle amount change
  const handleAmountChange = useCallback((rawValue: string) => {
    setAmount(rawValue);
  }, []);

  // Handle percentage calculation
  const handlePercentageCalculated = useCallback((calculatedAmount: string) => {
    setAmount(calculatedAmount);
  }, []);

  // Calculate the appropriate balance for the percentage selector
  const percentageSelectorBalance = useMemo(() => {
    return activeTab === 'buy' ? acesBalance : tokenBalance;
  }, [activeTab, acesBalance, tokenBalance]);

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Connect wallet handler
  const handleConnectWallet = useCallback(async () => {
    try {
      setLoading('Connecting wallet...');
      await authConnectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setLoading('');
    }
  }, [authConnectWallet]);

  // Buy tokens handler (bonding curve)
  const handleBondingBuy = useCallback(async () => {
    if (
      !factoryContract ||
      !acesContract ||
      !tokenAddress ||
      !signer ||
      !contractAddresses.FACTORY_PROXY
    ) {
      setTransactionStatus({ type: 'error', message: 'Wallet not connected' });
      return;
    }

    try {
      const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);

      const service = new BondingCurveSwapService(
        factoryContract,
        acesContract,
        contractAddresses.FACTORY_PROXY,
      );

      const result = await service.buyTokens({
        tokenAddress,
        amount: amountWei,
        slippageBps: bondingQuote.slippageBps,
        onStatus: setLoading,
      });

      if (result.success) {
        setTransactionStatus({ type: 'success', message: 'Transaction successful!' });
        setAmount('');
        await refreshBalances();
      } else {
        setTransactionStatus({ type: 'error', message: result.error || 'Transaction failed' });
      }
    } catch (error) {
      console.error('Buy failed:', error);
      setTransactionStatus({ type: 'error', message: 'Transaction failed' });
    } finally {
      setLoading('');
    }
  }, [
    factoryContract,
    acesContract,
    tokenAddress,
    signer,
    contractAddresses,
    amount,
    tokenDecimals,
    bondingQuote.slippageBps,
    refreshBalances,
  ]);

  // Sell tokens handler (bonding curve)
  const handleBondingSell = useCallback(async () => {
    if (!factoryContract || !tokenAddress || !signer) {
      setTransactionStatus({ type: 'error', message: 'Wallet not connected' });
      return;
    }

    try {
      const amountWei = ethers.utils.parseUnits(amount, tokenDecimals);

      const service = new BondingCurveSwapService(
        factoryContract,
        acesContract!,
        contractAddresses.FACTORY_PROXY,
      );

      const result = await service.sellTokens({
        tokenAddress,
        amount: amountWei,
        onStatus: setLoading,
      });

      if (result.success) {
        setTransactionStatus({ type: 'success', message: 'Transaction successful!' });
        setAmount('');
        await refreshBalances();
      } else {
        setTransactionStatus({ type: 'error', message: result.error || 'Transaction failed' });
      }
    } catch (error) {
      console.error('Sell failed:', error);
      setTransactionStatus({ type: 'error', message: 'Transaction failed' });
    } finally {
      setLoading('');
    }
  }, [
    factoryContract,
    acesContract,
    tokenAddress,
    signer,
    contractAddresses,
    amount,
    tokenDecimals,
    refreshBalances,
  ]);

  // DEX swap handler
  const handleDexSwap = useCallback(async () => {
    if (!signer || !walletAddress || !dexQuote.quote || !routerAddress) {
      setTransactionStatus({ type: 'error', message: 'Missing required data for swap' });
      return;
    }

    try {
      const service = new DexSwapService(routerAddress, signer, walletAddress);

      const result = await service.executeSwap({
        quote: dexQuote.quote,
        paymentAsset,
        signer,
        onStatus: setLoading,
      });

      if (result.success) {
        setTransactionStatus({ type: 'success', message: 'Swap confirmed on Aerodrome!' });
        setAmount('');
        await refreshBalances();
      } else {
        setTransactionStatus({ type: 'error', message: result.error || 'Swap failed' });
      }
    } catch (error) {
      console.error('DEX swap failed:', error);
      setTransactionStatus({ type: 'error', message: 'Swap failed' });
    } finally {
      setLoading('');
    }
  }, [signer, walletAddress, dexQuote.quote, routerAddress, paymentAsset, refreshBalances]);

  // Main swap handler
  const handleSwapClick = useCallback(async () => {
    if (isDexMode) {
      await handleDexSwap();
    } else {
      if (activeTab === 'buy') {
        await handleBondingBuy();
      } else {
        await handleBondingSell();
      }
    }
  }, [isDexMode, activeTab, handleDexSwap, handleBondingBuy, handleBondingSell]);

  // Auto-dismiss transaction status
  useMemo(() => {
    if (!transactionStatus) return;
    const timeout = setTimeout(() => setTransactionStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [transactionStatus]);

  // If using simple card, render SwapCard directly
  if (useSimpleCard) {
    return (
      <SwapCard
        tokenSymbol={tokenSymbol}
        tokenAddress={tokenAddress}
        chainId={chainId}
        dexMeta={dexMeta}
      />
    );
  }

  // Render full interface with header and progression
  return (
    <div className="h-full">
      <div
        className={cn(
          'bg-[#151c16] h-full flex flex-col relative',
          showFrame
            ? 'rounded-lg border border-[#D0B284]/20'
            : cn('px-4 sm:px-6 pb-6', showHeader ? 'pt-4' : 'pt-2'),
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
                      {formatAmountForDisplay(acesBalance, 18)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D0B284]/60 text-xs">{tokenSymbol}:</span>
                    <span className="text-[#D0B284] font-mono text-xs">
                      {formatAmountForDisplay(tokenBalance, 18)}
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
                percentage={bondingPercentage}
                isBondedOverride={tokenBonded}
              />
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center ${
                  tokenBonded ? 'text-[#D7BF75]/80' : 'text-[#D7BF75]/80'
                }`}
              >
                {bondingLoading
                  ? 'Loading bonding data...'
                  : tokenBonded
                    ? 'BONDED - 100%'
                    : `Bonded ${bondingPercentage.toFixed(1)}% / 100%`}
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
        <div className={cn('flex-1 space-y-6', showFrame ? 'px-6 pb-6' : '')}>
          {isDexMode ? (
            <>
              {/* Use SwapCard for DEX mode */}
              <div className="mx-auto w-full max-w-[560px]">
                <SwapCard
                  tokenSymbol={tokenSymbol}
                  tokenAddress={tokenAddress}
                  chainId={chainId}
                  dexMeta={dexMeta}
                  onSwapComplete={refreshBalances}
                />
              </div>
            </>
          ) : (
            <>
              {/* Bonding curve interface */}
              <div className="relative flex flex-col gap-5">
                {/* Percentage Selector */}
                <PercentageSelector
                  balance={percentageSelectorBalance}
                  onAmountCalculated={handlePercentageCalculated}
                  currentAmount={amount}
                />

                <div className="rounded-3xl border border-[#D0B284]/25 bg-[#0B0F0B] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#D0B284]/70">
                      {activeTab === 'buy' ? 'Sell' : 'Sell'}
                    </span>
                    <div className="relative inline-flex min-w-[140px] justify-end">
                      <select
                        className="appearance-none rounded-full border border-[#D0B284]/25 bg-black/70 px-4 pr-9 py-2 text-sm font-semibold text-[#D0B284] focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
                        value={activeTab === 'sell' ? tokenSymbol : paymentAsset}
                        onChange={(e) => {
                          if (e.target.value === tokenSymbol) {
                            setActiveTab('sell');
                          } else {
                            setActiveTab('buy');
                            setPaymentAsset(e.target.value as PaymentAsset);
                          }
                        }}
                      >
                        {activeTab === 'sell' ? (
                          <option value={tokenSymbol}>{tokenSymbol}</option>
                        ) : (
                          <option value="ACES">ACES</option>
                        )}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D0B284]/60" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full border-none bg-transparent text-4xl font-semibold text-white outline-none focus:ring-0 placeholder:text-[#D0B284]/30"
                    />
                  </div>

                  {hasValidAmount && usdDisplay && (
                    <div className="mt-2 text-sm text-[#D0B284]/70">≈ {usdDisplay}</div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-[#D0B284]/60">
                    <span>Balance</span>
                    <span className="font-mono text-[#D0B284]">
                      {formatAmountForDisplay(
                        activeTab === 'sell' ? tokenBalance : acesBalance,
                        18,
                      )}{' '}
                      {activeTab === 'sell' ? tokenSymbol : 'ACES'}
                    </span>
                  </div>
                </div>

                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D0B284]/30 bg-black/80 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                    <ArrowDown className="h-4 w-4 text-[#D0B284]" />
                  </div>
                </div>

                <div className="rounded-3xl border border-[#D0B284]/25 bg-[#0B0F0B] p-4 pt-5 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#D0B284]/70">
                      Buy
                    </span>
                    <div className="relative inline-flex min-w-[140px] justify-end">
                      <select
                        className="appearance-none rounded-full border border-[#D0B284]/25 bg-black/70 px-4 pr-9 py-2 text-sm font-semibold text-[#D0B284] focus:outline-none focus:ring-2 focus:ring-[#D0B284]/40"
                        value={activeTab === 'sell' ? 'ACES' : tokenSymbol}
                        disabled
                      >
                        <option value={activeTab === 'sell' ? 'ACES' : tokenSymbol}>
                          {activeTab === 'sell' ? 'ACES' : tokenSymbol}
                        </option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D0B284]/60" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      value={amount}
                      readOnly
                      className="w-full border-none bg-transparent text-4xl font-semibold text-white/90 outline-none"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#D0B284]/60">
                    <span>Balance</span>
                    <span className="font-mono text-[#D0B284]">
                      {formatAmountForDisplay(
                        activeTab === 'sell' ? acesBalance : tokenBalance,
                        18,
                      )}{' '}
                      {activeTab === 'sell' ? 'ACES' : tokenSymbol}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {!isAuthenticated || !provider ? (
                  <Button
                    onClick={handleConnectWallet}
                    disabled={!!loading}
                    className="w-full h-14 rounded-2xl border border-[#D0B284]/30 bg-[#101610] text-[#D0B284] font-proxima-nova font-bold text-lg transition-colors hover:bg-[#151d14] disabled:opacity-50"
                  >
                    {loading || 'Connect Wallet'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSwapClick}
                    disabled={!hasValidAmount || !!loading || !canSwap}
                    className="w-full h-14 rounded-2xl border border-[#D0B284]/30 bg-[#101610] text-[#D0B284] font-spray-letters font-bold text-2xl tracking-widest uppercase transition-colors hover:bg-[#151d14] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </span>
                    ) : (
                      'SWAP'
                    )}
                  </Button>
                )}
              </div>
            </>
          )}

          {transactionStatus && (
            <div className="fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 px-4">
              <div
                className={cn(
                  'flex-1 rounded-xl border px-4 py-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md',
                  transactionStatus.type === 'success'
                    ? 'bg-green-900/80 border-green-500/30 text-green-100'
                    : 'bg-red-900/80 border-red-600/40 text-red-100',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="leading-snug">{transactionStatus.message}</span>
                  <button
                    onClick={() => setTransactionStatus(null)}
                    className="text-xs font-semibold uppercase tracking-wide opacity-80 transition-opacity hover:opacity-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
