'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import { DexApi, type DexQuoteResponse } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { useWallets } from '@privy-io/react-auth';

const DEFAULT_SLIPPAGE_BPS = 100;
const SWAP_DEADLINE_BUFFER_SECONDS = 60 * 10;

const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];

interface SwapCardProps {
  tokenSymbol?: string;
  tokenAddress?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  onSwapComplete?: () => void;
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
  const [paymentAsset] = useState<'ACES' | 'USDC' | 'USDT' | 'ETH'>('ACES');
  const [loading, setLoading] = useState('');
  const [tokenBonded, setTokenBonded] = useState(false);

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
      return parseInt(chainIdHex, 16);
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
  const bottomBalanceLabel = useMemo(() => {
    const isReceivingToken = activeTab === 'buy' || isDexMode;
    const rawBalance = isReceivingToken ? tokenBalance : acesBalance;
    const numeric = Number.parseFloat(rawBalance || '0');
    const formatted = Number.isFinite(numeric) ? numeric.toFixed(4) : '0.0000';
    const symbol = isReceivingToken ? tokenSymbol : 'ACES';
    return `${formatted} ${symbol}`;
  }, [activeTab, isDexMode, tokenBalance, acesBalance, tokenSymbol]);

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
      let ethProvider: any = window.ethereum || (window as any).ethereum;

      if (!ethProvider && wallets?.length) {
        for (const wallet of wallets) {
          if (typeof wallet.getEthereumProvider === 'function') {
            try {
              const privyProvider = await wallet.getEthereumProvider();
              if (privyProvider) {
                ethProvider = privyProvider;
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
      slippageBps: DEFAULT_SLIPPAGE_BPS,
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
  }, [isDexMode, tokenAddress, paymentAsset, amount, hasValidAmount, activeTab]);

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

  const isDisabled =
    !hasValidAmount || !!loading || (isDexMode && (dexQuoteLoading || dexSwapPending));

  const handlePercentageClick = (percentage: number) => {
    const balance = activeTab === 'buy' && !isDexMode ? acesBalance : tokenBalance;
    const balanceNum = Number.parseFloat(balance);

    if (balanceNum > 0) {
      const calculatedAmount = (balanceNum * percentage) / 100;
      setAmount(calculatedAmount.toString());
    }
  };

  return (
    <div role="region" aria-label="Swap interface">
      {/* Percentage Buttons */}
      <div className="flex items-center justify-between">
        {[10, 25, 50, 75, 100].map((percentage) => (
          <button
            key={percentage}
            type="button"
            onClick={() => handlePercentageClick(percentage)}
            className="
              flex-1 rounded-lg border-[0.5px] border-[#D0B264]
              bg-black/40 px-2 py-1.5
              text-[13px] font-semibold text-[#D0B264]
              hover:bg-black/55 hover:text-[#D0B264]
              transition-colors duration-150
            "
          >
            {percentage === 100 ? 'MAX' : `${percentage}%`}
          </button>
        ))}
      </div>
      {/* Swap Panels */}
      <div className="rounded-[22px] border-[0.5px] border-[#D0B264] bg-[var(--surface-1)] overflow-hidden">
        <div className="px-4 py-3 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="mb-1 text-[14px] font-medium text-[#D0B264]/80">
                {activeTab === 'buy' ? 'Sell' : 'You sell'}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="
                  w-full h-12 bg-transparent border-none outline-none
                  text-[28px] font-semibold tracking-tight text-foreground/95
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
              <div className="mt-1 text-[12px] text-[#D0B264]/70">
                Balance:{' '}
                {activeTab === 'buy' && !isDexMode
                  ? Number.parseFloat(acesBalance).toFixed(4)
                  : Number.parseFloat(tokenBalance).toFixed(4)}
              </div>
            </div>

            {/* Token pill */}
            <button
              type="button"
              className="
                inline-flex items-center gap-2 rounded-full
                border-[0.5px] border-[#D0B264]/60 bg-black/40
                px-3 py-2 transition-colors duration-150
                hover:bg-black/55 focus:outline-none
              "
            >
              <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                <Image
                  src={activeTab === 'buy' && !isDexMode ? '/aces-logo.png' : '/svg/eth.svg'}
                  alt={activeTab === 'buy' && !isDexMode ? 'ACES' : tokenSymbol}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              </span>
              <span className="text-[16px] font-semibold text-[#D0B264]">
                {activeTab === 'buy' && !isDexMode ? 'ACES' : tokenSymbol}
              </span>
            </button>
          </div>
        </div>

        <div className="border-t border-[#D0B264] px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="mb-1 text-[14px] font-medium text-[#D0B264]/80">
                {activeTab === 'buy' ? 'Buy' : 'You receive'}
              </div>
              <div className="flex h-12 items-center text-[28px] font-semibold text-foreground/90">
                {dexQuoteLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  parseFloat(displayQuote).toFixed(4)
                )}
              </div>
            </div>

            {/* Token pill */}
            <button
              type="button"
              className="
                inline-flex items-center gap-2 rounded-full
                border-[0.5px] border-[#D0B264]/60 bg-black/40
                px-4 py-2 text-[16px] font-extrabold text-[#D0B264]
                transition-colors duration-150 hover:bg-black/55
              "
            >
              <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 ring-[0.5px] ring-[#D0B264]/50">
                <Image
                  src={activeTab === 'buy' || isDexMode ? '/svg/eth.svg' : '/aces-logo.png'}
                  alt={activeTab === 'buy' || isDexMode ? tokenSymbol : 'ACES'}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              </span>
              {activeTab === 'buy' || isDexMode ? tokenSymbol : 'ACES'}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-[12px] text-[#D0B264]/70">
            <span>Balance</span>
            <span className="font-mono text-[#D0B264]">{bottomBalanceLabel}</span>
          </div>
        </div>

        {transactionStatus && (
          <div
            className={cn(
              'border-t border-[#D0B264] px-4 py-3 text-sm md:px-6',
              transactionStatus.type === 'success'
                ? 'bg-green-900/60 text-green-100'
                : 'bg-red-900/60 text-red-100',
            )}
          >
            {transactionStatus.message}
          </div>
        )}

        <div className="border-t border-[#D0B264] bg-black/70 px-3 py-3 md:px-6 md:py-4">
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
              onClick={handleConnectWallet}
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
            <Button
              onClick={handleSwap}
              disabled={isDisabled}
              className="
                h-12 w-full rounded-[16px]
                bg-[var(--surface-3)] hover:bg-[var(--surface-3)]
                text-[34px] font-extrabold text-[#D0B264]
                shadow-none
                disabled:opacity-50
                font-spray-letters tracking-[0.75em] uppercase
              "
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {loading}
                </span>
              ) : isDexMode ? (
                <div className="flex flex-col gap-0.5">
                  <span className="font-spray-letters tracking-widest">SWAP</span>
                </div>
              ) : (
                'SWAP'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SwapCard;
