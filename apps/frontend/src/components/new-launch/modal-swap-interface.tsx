'use client';

import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Wallet,
  Crown,
  CheckCircle,
  ChevronDown,
  X,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useBondingCurveContracts,
  type BondingCurveState,
} from '@/hooks/contracts/ico/use-bonding-curve-contract';
import { useAcesSwapContract } from '@/hooks/contracts/ico/use-aces-swap-contract';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import { ACES_VAULT_ABI, ACES_SWAP_ABI } from '@aces/utils';
import Image from 'next/image';
import TokenTermsModal from '@/components/ui/custom/token-terms-modal';
import { CryptoSlider } from './crypto-slider';
import { StablecoinSlider } from './stablecoin-slider';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/components/providers/app-providers';
import { ERC20_ABI } from '@aces/utils';

// Contract addresses - must match the hook (MAINNET)
import { getBondingCurveContracts } from '@aces/utils';

const BASE_MAINNET_CONTRACTS = getBondingCurveContracts(8453); // Base Mainnet
const ACES_VAULT_ADDRESS = BASE_MAINNET_CONTRACTS.acesVault;
const SHARES_SUBJECT_ADDRESS = BASE_MAINNET_CONTRACTS.sharesSubject;
const ROOM_NUMBER = BigInt(BASE_MAINNET_CONTRACTS.roomNumber);

interface ModalSwapInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol?: string;
}

export default function ModalSwapInterface({
  isOpen,
  onClose,
  tokenSymbol = 'ACES',
}: ModalSwapInterfaceProps) {
  const { login, user: privyUser } = usePrivy();
  const { isAuthenticated, user: authUser, connectWallet } = useAuth();
  const { fundWallet } = useFundWallet();
  const { isOnBaseMainnet, isSwitching, ensureCorrectChain, SUPPORTED_CHAINS } =
    useChainSwitching();
  const { contractState, getQuote, ethPrice, refresh } = useBondingCurveContracts();

  // Check if tokens are sold out (875M = maximum supply)
  const MAXIMUM_SUPPLY = 875000000; // 875 million tokens
  const currentSupply = contractState?.tokenSupply ? Number(contractState.tokenSupply) : 0;
  const isSoldOut = currentSupply >= MAXIMUM_SUPPLY;
  const { data: hash, isPending, error, writeContractAsync, reset } = useWriteContract();

  // Stable contract state that persists once loaded (prevents modal from closing during re-fetches)
  const stableContractStateRef = useRef<BondingCurveState | null>(null);
  const [stableContractState, setStableContractState] = useState<BondingCurveState | null>(null);

  // Update stable state when we get valid contract data
  useEffect(() => {
    if (contractState && contractState.ethBalance !== undefined) {
      stableContractStateRef.current = contractState;
      setStableContractState(contractState);
    }
  }, [contractState]);

  // AcesSwap integration for USDC/USDT
  const {
    swapState,
    uniswapRates, // ✅ Add this
    useTokenBalance,
    useTokenAllowance,
    calculateSwapQuote,
    resetSwapState,
    isContractReady,
    isUniswapRatesReady, // ✅ Add this
    approveToken,
  } = useAcesSwapContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isFailed,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Purchase limits
  const PURCHASE_LIMITS = {
    ETH: 0.5, // 0.5 ETH maximum
    USDC: 2000, // $2000 USDC maximum
    USDT: 2000, // $2000 USDT maximum
  } as const;

  // State - handle both ETH and USD amounts
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('ETH');
  const [ethAmount, setEthAmount] = useState(0); // For ETH purchases
  const [usdAmount, setUsdAmount] = useState(0); // For stablecoin purchases (USD value)
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [expectedTokens, setExpectedTokens] = useState('0');
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);
  const [actualCost, setActualCost] = useState('0'); // Cost in ETH
  const [shareCount, setShareCount] = useState(BigInt(0)); // Share count for contract
  const [bondingCurveETHCost, setBondingCurveETHCost] = useState('0'); // Store the exact ETH cost from bonding curve
  const [requiredTokenAmount, setRequiredTokenAmount] = useState(BigInt(0)); // Store the exact token amount needed
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [jurisdictionCompliance, setJurisdictionCompliance] = useState(false);
  const [showTokenTermsModal, setShowTokenTermsModal] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalInProgress, setApprovalInProgress] = useState(false);
  const [approvalCompleted, setApprovalCompleted] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Transaction state management
  const [transactionState, setTransactionState] = useState<
    'idle' | 'submitting' | 'pending' | 'success' | 'failed'
  >('idle');
  const [purchaseDetails, setPurchaseDetails] = useState<{
    ethSpent: string;
    tokensReceived: string;
    shareCount: string;
    transactionHash?: string;
    blockExplorerUrl?: string;
  } | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  // Get token balances using AcesSwap hooks for USDC/USDT
  const usdcBalanceInfo = useTokenBalance('USDC');
  const usdtBalanceInfo = useTokenBalance('USDT');
  const usdcAllowance = useTokenAllowance('USDC');
  const usdtAllowance = useTokenAllowance('USDT');

  // Current currency info - use stable contract state to prevent modal flickering
  const currencyInfo = SUPPORTED_CURRENCIES[selectedCurrency];
  const activeContractState = stableContractState || contractState; // Use stable state if available
  const userEthBalance = activeContractState?.ethBalance || BigInt(0);

  // Background refresh mechanism - refresh prices every 30 seconds without disrupting UI
  useEffect(() => {
    if (!isOpen || !activeContractState) return;

    const refreshInterval = setInterval(() => {
      // Only refresh pricing data, not balance data to avoid disruption
      if (refresh?.price) {
        refresh.price();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isOpen, activeContractState, refresh]);
  const userCurrencyBalance =
    selectedCurrency === 'ETH'
      ? userEthBalance
      : selectedCurrency === 'USDC'
        ? usdcBalanceInfo.balance
        : usdtBalanceInfo.balance;

  // Calculate max amount based on currency and balance - using the EXACT same balance source
  const walletBalanceEth = Number(formatEther(userEthBalance)); // Same source as balance display

  const getMaxAmount = () => {
    if (selectedCurrency === 'ETH') {
      // Base network gas fees: < $0.01 (from gas tracker)
      // Conservative estimate: $0.01 / $3000 ETH = 0.0000033 ETH actual cost
      // Use 5x buffer for safety: 0.00002 ETH (~$0.06)
      const gasReserve = 0.00002; // 0.00002 ETH (~$0.06) reserve for gas + safety margin
      const maxUsableEth = Math.max(0, walletBalanceEth - gasReserve);
      // Apply purchase limit: use lower of available balance or purchase limit
      return Math.min(PURCHASE_LIMITS.ETH, maxUsableEth);
    } else {
      // For stablecoins, convert balance to ETH equivalent for now
      // This will be updated when the AcesSwap contract is integrated
      const balanceInCurrency = Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals);
      const ethEquivalent = balanceInCurrency / ethPrice.current;
      return Math.min(1, ethEquivalent);
    }
  };

  const calculatedMaxAmount = getMaxAmount();
  const maxAmount = Math.max(calculatedMaxAmount, walletBalanceEth * 0.1); // At least 10% of wallet
  const minAmount = Math.min(walletBalanceEth * 0.01, maxAmount * 0.1); // 1% of wallet or 10% of max

  // Calculate step size: divide the range into 100 steps for smooth movement
  const stepSize = (maxAmount - minAmount) / 100;

  // Adjust ethAmount if it's outside the valid range
  useEffect(() => {
    if (ethAmount < minAmount) {
      setEthAmount(minAmount);
    } else if (ethAmount > maxAmount) {
      setEthAmount(maxAmount);
    }
  }, [minAmount, maxAmount, ethAmount]);

  // Create our own buyTokens function that uses the modal's writeContractAsync
  // This ensures the hash gets set in our useWriteContract hook
  const buyTokensWithModalHook = async (
    shareCount: bigint,
    ethCost: bigint,
  ): Promise<`0x${string}`> => {
    if (!isAuthenticated || !privyUser?.wallet?.address) {
      throw new Error('Not authenticated');
    }

    const hash = await writeContractAsync({
      address: ACES_VAULT_ADDRESS,
      abi: ACES_VAULT_ABI,
      functionName: 'buyShares',
      args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount],
      value: ethCost,
      account: privyUser.wallet.address as `0x${string}`,
      // Add gas configuration for Base network
      gas: BigInt(150000), // 150k gas limit for buyShares - should be ~$0.01 on Base
    });
    return hash;
  };

  // Get currency icon path
  const getCurrencyIcon = (currency: Currency) => {
    switch (currency) {
      case 'ETH':
        return '/svg/eth.svg';
      case 'USDC':
        return '/svg/usdc.svg';
      case 'USDT':
        return '/svg/tether.svg';
      default:
        return '/svg/eth.svg';
    }
  };

  // FIND THIS EXISTING useEffect IN YOUR FILE (around line 200-300)
  // AND REPLACE THE ENTIRE useEffect WITH THE NEW CODE BELOW

  useEffect(() => {
    const calculateExpectedTokens = async () => {
      const currentAmount = selectedCurrency === 'ETH' ? ethAmount : usdAmount;

      // More lenient validation - allow very small amounts for calculations
      if (currentAmount <= 0) {
        setExpectedTokens('0');
        setActualCost('0');
        setShareCount(BigInt(0));
        setNeedsApproval(false);
        return;
      }

      // Don't calculate if contract state isn't ready for ETH
      if (selectedCurrency === 'ETH' && (!activeContractState || !getQuote)) {
        setExpectedTokens('0');
        setActualCost('0');
        setShareCount(BigInt(0));
        setNeedsApproval(false);
        return;
      }

      try {
        if (selectedCurrency === 'ETH') {
          setIsCalculatingTokens(true);

          // Use a smaller minimum for more accurate small calculations
          const calculationAmount = Math.max(ethAmount, 0.0001);

          try {
            // Get real quote from the bonding curve
            const quote = await getQuote(calculationAmount.toString());

            // Use real values from quote
            if (quote.shareCount > BigInt(0)) {
              // Display the share count (which equals the number of tokens when formatted properly)
              setExpectedTokens(quote.shareCount.toString());
              setActualCost(formatEther(quote.ethCost));
              setShareCount(quote.shareCount);
            } else {
              setExpectedTokens('0');
              setActualCost('0');
              setShareCount(BigInt(0));
            }
          } catch (quoteError) {
            setExpectedTokens('0');
            setActualCost('0');
            setShareCount(BigInt(0));
          }

          setNeedsApproval(false);
          setIsCalculatingTokens(false);
        } else if (selectedCurrency === 'USDC' || selectedCurrency === 'USDT') {
          // USDC/USDT Flow: Convert to ETH with slippage, then get quote
          if (!isUniswapRatesReady || !isContractReady || !getQuote) {
            setExpectedTokens('0');
            setActualCost('0');
            setShareCount(BigInt(0));
            setNeedsApproval(false);
            return;
          }

          if (uniswapRates.error || usdAmount < 0.01) {
            setExpectedTokens('0');
            setActualCost('0');
            setShareCount(BigInt(0));
            setNeedsApproval(false);
            return;
          }

          setIsCalculatingTokens(true);
          try {
            // Step 1: Convert USD to ETH using Uniswap rates
            const usdcToEthRate =
              selectedCurrency === 'USDC' ? uniswapRates.usdcToETH : uniswapRates.usdtToETH;
            const ethEquivalent = usdAmount * usdcToEthRate;

            // Step 2: Apply 7% slippage to the ETH amount (conservative estimate)
            const ethWithSlippage = ethEquivalent * 0.93; // 7% slippage = 93% of original

            // Step 3: Get quote from bonding curve using ETH with slippage
            const quote = await getQuote(ethWithSlippage.toString());

            if (quote.shareCount > BigInt(0)) {
              // Step 4: Calculate actual USD cost needed (reverse calculation with buffer)
              const exactEthNeeded = Number(formatEther(quote.ethCost));
              const ethToUsdRate =
                selectedCurrency === 'USDC' ? uniswapRates.ethToUSDC : uniswapRates.ethToUSDT;
              const usdNeeded = exactEthNeeded * ethToUsdRate * 1.07; // 7% buffer for slippage

              // Display the share count (which equals the number of tokens when formatted properly)
              setExpectedTokens(quote.shareCount.toString());
              setActualCost(usdNeeded.toFixed(6));
              setShareCount(quote.shareCount);

              // Store values for transaction
              setBondingCurveETHCost(formatEther(quote.ethCost));
              const requiredTokenAmount = parseUnits(
                usdNeeded.toFixed(SUPPORTED_CURRENCIES[selectedCurrency].decimals),
                SUPPORTED_CURRENCIES[selectedCurrency].decimals,
              );
              setRequiredTokenAmount(requiredTokenAmount);

              // Check if approval is needed
              const currentAllowance =
                selectedCurrency === 'USDC' ? usdcAllowance.allowance : usdtAllowance.allowance;
              setNeedsApproval(currentAllowance < requiredTokenAmount);
            } else {
              setExpectedTokens('0');
              setActualCost('0');
              setShareCount(BigInt(0));
              setNeedsApproval(false);
            }
          } catch (error) {
            setExpectedTokens('0');
            setActualCost('0');
            setShareCount(BigInt(0));
            setNeedsApproval(false);
          }
          setIsCalculatingTokens(false);
        }
      } catch (error) {
        setExpectedTokens('0');
        setActualCost('0');
        setShareCount(BigInt(0));
        setNeedsApproval(false);
        setIsCalculatingTokens(false);
      }
    };

    const debounceTimer = setTimeout(calculateExpectedTokens, 500);
    return () => clearTimeout(debounceTimer);
  }, [
    ethAmount,
    usdAmount,
    selectedCurrency,
    getQuote,
    activeContractState,
    isContractReady,
    calculateSwapQuote, // Added this since we're now using the enhanced version
    isUniswapRatesReady, // Added Uniswap rate dependencies
    uniswapRates.error,
    uniswapRates.usdcToETH,
    uniswapRates.usdtToETH,
    uniswapRates.ethToUSDC,
    uniswapRates.ethToUSDT,
    usdcAllowance.allowance,
    usdtAllowance.allowance,
  ]);

  // Handle approval for ERC20 tokens (STEP 1 of stablecoin purchase)
  const handleApproval = async () => {
    if (selectedCurrency === 'ETH' || !isContractReady) return;

    try {
      setApprovalInProgress(true);
      // Clear any previous transaction errors during approval
      setTransactionError(null);

      // Use the exact token amount from the swap quote calculation
      const amountToApprove = requiredTokenAmount;

      // Use the AcesSwap hook's approval function
      const success = await approveToken(selectedCurrency, amountToApprove);

      if (success) {
        // Wait a moment for blockchain state to update, then check actual allowance
        setTimeout(async () => {
          try {
            // Refetch the actual allowance from the blockchain
            const allowanceHook = selectedCurrency === 'USDC' ? usdcAllowance : usdtAllowance;
            await allowanceHook.refetchAllowance();
          } catch (refetchError) {
            // Silently handle refetch errors
          }
        }, 2000); // Wait 2 seconds for blockchain confirmation

        setApprovalCompleted(true);
        setNeedsApproval(false);
      } else {
        setTransactionError('Token approval failed. Please try again.');
      }
    } catch (error) {
      // Handle user cancellation gracefully
      if (
        error instanceof Error &&
        (error.message.includes('User rejected') ||
          error.message.includes('user denied') ||
          error.message.includes('User denied'))
      ) {
        // User cancelled approval - don't show error, just reset state
      } else {
        setTransactionError(error instanceof Error ? error.message : 'Token approval failed');
      }
    } finally {
      setApprovalInProgress(false);
    }
  };

  // Check if approval is needed for ERC20 tokens based on actual blockchain allowance
  useEffect(() => {
    if (selectedCurrency === 'ETH') {
      setNeedsApproval(false);
      setApprovalCompleted(false);
      return;
    }

    // For stablecoins, check actual allowance vs required amount
    if (isContractReady && actualCost && Number(actualCost) > 0) {
      try {
        const requiredAmount = parseUnits(
          actualCost,
          SUPPORTED_CURRENCIES[selectedCurrency].decimals,
        );

        const currentAllowance =
          selectedCurrency === 'USDC' ? usdcAllowance.allowance : usdtAllowance.allowance;

        const needsApproval = currentAllowance < requiredAmount;

        setNeedsApproval(needsApproval);
        setApprovalCompleted(!needsApproval);
      } catch (error) {
        // Default to needing approval if we can't check
        setNeedsApproval(true);
        setApprovalCompleted(false);
      }
    } else {
      // Default state when we don't have quote data yet
      setNeedsApproval(true);
      setApprovalCompleted(false);
    }
  }, [
    selectedCurrency,
    actualCost,
    isContractReady,
    usdcAllowance.allowance,
    usdtAllowance.allowance,
  ]);

  // Monitor transaction state changes (both ETH and AcesSwap)
  // IMPORTANT: Approval steps should NOT trigger transaction UI changes
  useEffect(() => {
    // Handle ETH transaction states - ONLY for actual ETH purchases, not stablecoin approvals
    if (selectedCurrency === 'ETH') {
      if (isPending) {
        setTransactionState('submitting');
        setTransactionError(null);
      } else if (isConfirming) {
        setTransactionState('pending');
      } else if (isConfirmed && receipt && transactionState !== 'success') {
        setTransactionState('success');

        // Store purchase details for success display
        setPurchaseDetails({
          ethSpent: actualCost,
          tokensReceived: expectedTokens,
          shareCount: shareCount.toString(),
          transactionHash: receipt.transactionHash,
          blockExplorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        });

        // Refresh contract state to get updated balances
        setTimeout(() => {
          if (refresh) {
            refresh.tokenSupply();
            refresh.userBalance();
            refresh.price();
          }
        }, 1000);
      } else if (isFailed || error) {
        setTransactionState('failed');
        setTransactionError(
          error instanceof Error ? error.message : 'ETH transaction failed. Please try again.',
        );
      }
    }
    // Handle stablecoin transaction states (AcesSwap)
    // ONLY handle actual SWAP transactions, NOT approval transactions
    else if (selectedCurrency === 'USDC' || selectedCurrency === 'USDT') {
      // CRITICAL: Only monitor swap state, NOT the general wagmi transaction states
      // This prevents approval transactions from triggering the success modal
      if (swapState.step === 'swapping') {
        setTransactionState('submitting');
        setTransactionError(null);
      } else if (
        swapState.step === 'success' &&
        swapState.transactionHash &&
        transactionState !== 'success'
      ) {
        setTransactionState('success');

        // Store purchase details for AcesSwap success
        setPurchaseDetails({
          ethSpent: actualCost, // This will be the USD cost for stablecoins
          tokensReceived: expectedTokens,
          shareCount: shareCount.toString(),
          transactionHash: swapState.transactionHash,
          blockExplorerUrl: `https://basescan.org/tx/${swapState.transactionHash}`,
        });

        // Refresh contract state
        setTimeout(() => {
          if (refresh) {
            refresh.tokenSupply();
            refresh.userBalance();
            refresh.price();
          }
        }, 1000);
      } else if (swapState.error && swapState.step === 'idle') {
        // Only show swap errors when not in approval flow
        setTransactionState('failed');

        // Set error message for stablecoin swaps
        let errorMessage = 'Swap transaction failed. Please try again.';
        const errorStr = (
          typeof swapState.error === 'string'
            ? swapState.error
            : String(swapState.error || 'Unknown error')
        ).toLowerCase();

        if (errorStr.includes('out of gas') || errorStr.includes('gas')) {
          errorMessage =
            'Transaction failed due to insufficient gas. Please try again with a smaller amount.';
        } else if (
          errorStr.includes('insufficient funds') ||
          errorStr.includes('insufficient balance')
        ) {
          errorMessage = 'Insufficient balance to complete this transaction.';
        } else if (errorStr.includes('user rejected') || errorStr.includes('user denied')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (errorStr.includes('swap')) {
          errorMessage = 'Swap transaction failed. Please check your balance and try again.';
        } else if (errorStr.length > 0) {
          errorMessage = `Swap failed: ${errorStr}`;
        }

        setTransactionError(errorMessage);
      }
    }
  }, [
    selectedCurrency,
    // Always include all dependencies to maintain constant array size
    isPending,
    isConfirming,
    isConfirmed,
    isFailed,
    error,
    receipt,
    swapState.step,
    swapState.transactionHash,
    swapState.error,
    actualCost,
    expectedTokens,
    shareCount,
    refresh,
    transactionState,
  ]);

  // Handle buy crypto with chain switching
  const handleBuyCrypto = async () => {
    if (!privyUser?.wallet?.address) return;

    try {
      setShowCurrencyModal(false);
      await ensureCorrectChain(SUPPORTED_CHAINS.BASE_MAINNET, {
        showPrompt: true,
        autoSwitch: false,
      });
      fundWallet(privyUser.wallet.address);
    } catch (error) {
      // Silently handle funding errors
    }
  };

  const handleMainAction = async () => {
    // If ERC20 token and needs approval, handle approval first
    if (selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted) {
      return handleApproval();
    }

    // Otherwise, handle purchase
    return handlePurchase();
  };

  const handlePurchase = async () => {
    if (!acceptTerms) {
      alert('Please accept the terms and conditions');
      return;
    }

    if (!jurisdictionCompliance) {
      alert('Please confirm your jurisdiction compliance');
      return;
    }

    const currentAmount = selectedCurrency === 'ETH' ? ethAmount : usdAmount;
    const maxAmountCheck =
      selectedCurrency === 'ETH'
        ? maxAmount
        : Math.min(
            PURCHASE_LIMITS[selectedCurrency as 'USDC' | 'USDT'],
            Number(userCurrencyBalance) /
              Math.pow(10, SUPPORTED_CURRENCIES[selectedCurrency].decimals),
          );

    if (currentAmount <= 0 || currentAmount > maxAmountCheck) {
      alert(`Amount must be greater than 0 and not exceed available balance`);
      return;
    }

    if (shareCount === BigInt(0)) {
      alert('No tokens can be purchased with this amount');
      return;
    }

    try {
      if (selectedCurrency === 'ETH') {
        // Use the exact values from our quote
        const ethCostWei = parseEther(actualCost);

        // Simple check: just verify user has enough ETH for the purchase
        // Let wallet handle gas estimation and failure - Base fees are < $0.01
        if (userEthBalance < ethCostWei) {
          const neededEth = Number(formatEther(ethCostWei - userEthBalance));
          const ethCostDisplay = Number(formatEther(ethCostWei));
          const userBalanceDisplay = Number(formatEther(userEthBalance));

          alert(
            `Insufficient ETH balance.\n\nRequired: ${ethCostDisplay.toFixed(6)} ETH\nYour balance: ${userBalanceDisplay.toFixed(6)} ETH\nNeed ${neededEth.toFixed(6)} more ETH\n\nNote: Additional gas fees (~$0.01) will be estimated by your wallet.`,
          );
          return;
        }

        // Reset transaction state and error before starting
        setTransactionState('idle');
        setTransactionError(null);
        setPurchaseDetails(null);

        // Purchase with exact contract values using our modal's writeContractAsync
        // This ensures the hash gets captured by our useWriteContract hook
        await buyTokensWithModalHook(shareCount, ethCostWei);

        // Note: Don't close modal here - transaction monitoring will handle success state
      } else if (selectedCurrency === 'USDC' || selectedCurrency === 'USDT') {
        // USDC/USDT purchase via AcesSwap (STEP 2 of stablecoin purchase)
        if (!isContractReady) {
          alert(
            `${selectedCurrency} purchases will be available once the AcesSwap contract is deployed!`,
          );
          return;
        }

        // Ensure approval is completed
        if (needsApproval || !approvalCompleted) {
          alert('Please approve token spending first');
          return;
        }

        setTransactionState('idle');
        setTransactionError(null);
        setPurchaseDetails(null);

        // Use the exact ETH cost from our bonding curve calculation
        // This ensures we use the same value that was used in the quote calculation

        // Pre-transaction validation
        try {
          const tokenAddress =
            selectedCurrency === 'USDC'
              ? SUPPORTED_CURRENCIES.USDC.address
              : SUPPORTED_CURRENCIES.USDT.address;

          // Check current balances and allowances just before transaction
          const [userBalance, userAllowance] = await Promise.all([
            readContract(wagmiConfig, {
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [privyUser?.wallet?.address as `0x${string}`],
            }),
            readContract(wagmiConfig, {
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [
                privyUser?.wallet?.address as `0x${string}`,
                BASE_MAINNET_CONTRACTS.acesSwap as `0x${string}`,
              ],
            }),
          ]);

          // Calculate the required amount from the stored state
          const requiredAmount =
            requiredTokenAmount ||
            parseUnits(actualCost, SUPPORTED_CURRENCIES[selectedCurrency].decimals);

          // Show alerts for specific issues
          if ((userBalance as bigint) < requiredAmount) {
            const deficit = formatUnits(
              requiredAmount - (userBalance as bigint),
              SUPPORTED_CURRENCIES[selectedCurrency].decimals,
            );
            alert(
              `❌ Insufficient ${selectedCurrency} Balance!\n\n` +
                `Need: ${formatUnits(requiredAmount, SUPPORTED_CURRENCIES[selectedCurrency].decimals)} ${selectedCurrency}\n` +
                `Have: ${formatUnits(userBalance as bigint, SUPPORTED_CURRENCIES[selectedCurrency].decimals)} ${selectedCurrency}\n` +
                `Short: ${deficit} ${selectedCurrency}\n\n` +
                `Please add more ${selectedCurrency} to your wallet.`,
            );
            return;
          }

          if ((userAllowance as bigint) < requiredAmount) {
            const deficit = formatUnits(
              requiredAmount - (userAllowance as bigint),
              SUPPORTED_CURRENCIES[selectedCurrency].decimals,
            );
            alert(
              `❌ Insufficient ${selectedCurrency} Allowance!\n\n` +
                `Need: ${formatUnits(requiredAmount, SUPPORTED_CURRENCIES[selectedCurrency].decimals)} ${selectedCurrency}\n` +
                `Approved: ${formatUnits(userAllowance as bigint, SUPPORTED_CURRENCIES[selectedCurrency].decimals)} ${selectedCurrency}\n` +
                `Need to approve: ${deficit} ${selectedCurrency}\n\n` +
                `The approval transaction may have failed or been insufficient.`,
            );
            return;
          }
        } catch (debugError) {
          alert(
            `Failed to verify token balances: ${debugError instanceof Error ? debugError.message : 'Unknown error'}`,
          );
          return;
        }

        // Now proceed with the transaction using corrected amounts
        // Call AcesSwap contract directly with our calculated values

        // Reset swap state for manual transaction monitoring
        resetSwapState();

        // Get the correct contract function name
        const functionName =
          selectedCurrency === 'USDC' ? 'sellUSDCAndBuyCurve' : 'sellUSDTAndBuyCurve';

        try {
          await writeContractAsync({
            address: BASE_MAINNET_CONTRACTS.acesSwap as `0x${string}`,
            abi: ACES_SWAP_ABI,
            functionName,
            args: [
              requiredTokenAmount, // amountIn - USD amount with buffer
              parseEther(bondingCurveETHCost), // amountOutMin - exact ETH needed from bonding curve
              SHARES_SUBJECT_ADDRESS, // roomOwner
              ROOM_NUMBER, // roomNumber
              shareCount, // amount - share count
            ],
            account: privyUser?.wallet?.address as `0x${string}`,
            gas: BigInt(500000), // Higher gas limit for complex swap operation
          });

          // Transaction hash is automatically captured by the useWriteContract hook
          // and will be handled by the existing transaction monitoring logic
        } catch (swapError) {
          // Let the error bubble up to be handled by the transaction monitoring
          throw swapError;
        }
      }
    } catch (error) {
      // Transaction state monitoring will handle this error display
      // But we can still handle immediate validation errors here
      if (
        error instanceof Error &&
        (error.message.includes('User rejected') ||
          error.message.includes('user denied') ||
          error.message.includes('User denied'))
      ) {
        // User cancelled - reset to idle state
        setTransactionState('idle');
        setTransactionError(null);
      }
    }
  };

  // Function to reset form and start new transaction
  const handleStartNewTransaction = () => {
    setTransactionState('idle');
    setTransactionError(null);
    setPurchaseDetails(null);
    setEthAmount(0); // Reset ETH amount
    setUsdAmount(0); // Reset USD amount
    setExpectedTokens('0');
    setActualCost('0');
    setShareCount(BigInt(0));
    setAcceptTerms(false);
    setJurisdictionCompliance(false);
    setNeedsApproval(false);
    setApprovalCompleted(false);
    setApprovalInProgress(false);
    resetSwapState(); // Reset AcesSwap state
    reset(); // Reset wagmi transaction state to clear previous failed transaction
  };

  // Function to close modal with proper cleanup
  const handleCloseModal = () => {
    // Only allow closing if not in the middle of a transaction
    if (transactionState === 'submitting' || transactionState === 'pending') {
      return; // Don't close during active transaction
    }

    // Reset states when closing
    handleStartNewTransaction();
    onClose();
  };

  if (!isAuthenticated) {
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
              onClick={connectWallet}
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
      <Dialog open={isOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="bg-black border-[#D0B284]/30 max-w-lg w-[95vw] sm:w-full h-fit max-h-[95vh] sm:max-h-[90vh] overflow-hidden mx-2 sm:mx-auto">
          <DialogHeader className="pb-2">
            <DialogTitle></DialogTitle>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3 overflow-y-auto max-h-[calc(95vh-100px)] sm:max-h-[calc(90vh-120px)] px-1">
            {/* Transaction Status Display */}
            {transactionState !== 'idle' && (
              <div className="bg-[#231F20]/70 rounded-xl border border-[#D0B284]/30 p-3 sm:p-4">
                {/* Transaction in progress states */}
                {(transactionState === 'submitting' || transactionState === 'pending') && (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <RefreshCw className="w-8 h-8 text-[#D0B284] animate-spin" />
                    </div>
                    <h3 className="text-white text-base sm:text-lg font-bold mb-2">
                      {transactionState === 'submitting'
                        ? 'Submitting Transaction...'
                        : 'Transaction Pending...'}
                    </h3>
                    <p className="text-[#DCDDCC] text-xs sm:text-sm mb-3">
                      {transactionState === 'submitting'
                        ? 'Please confirm the transaction in your wallet'
                        : 'Your transaction is being processed on the blockchain'}
                    </p>
                    {hash && transactionState === 'pending' && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs text-[#928357] font-mono">Transaction Hash:</span>
                        <a
                          href={`https://basescan.org/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#D0B284] hover:text-[#D7BF75] font-mono flex items-center gap-1"
                        >
                          {hash.slice(0, 10)}...{hash.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Transaction success state */}
                {transactionState === 'success' && purchaseDetails && (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                    </div>
                    <h3 className="text-white text-lg sm:text-xl font-bold mb-2">
                      Purchase Successful!
                    </h3>
                    <p className="text-[#DCDDCC] text-xs sm:text-sm mb-4">
                      Your {tokenSymbol} tokens have been purchased successfully
                    </p>

                    {/* Purchase Details */}
                    <div className="bg-[#0A0A0A]/50 rounded-lg p-3 mb-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[#928357] text-sm">ETH Spent:</span>
                        <span className="text-white font-mono text-sm">
                          {Number(purchaseDetails.ethSpent).toFixed(6)} ETH
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#928357] text-sm">Tokens Received:</span>
                        <span className="text-[#D0B284] font-mono text-sm">
                          {Number(purchaseDetails.tokensReceived).toLocaleString()} {tokenSymbol}
                        </span>
                      </div>
                    </div>

                    {/* Transaction Hash */}
                    {purchaseDetails.transactionHash && (
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-xs text-[#928357]">Transaction:</span>
                        <a
                          href={purchaseDetails.blockExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#D0B284] hover:text-[#D7BF75] font-mono flex items-center gap-1"
                        >
                          {purchaseDetails.transactionHash.slice(0, 10)}...
                          {purchaseDetails.transactionHash.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Action Button */}
                    <Button
                      onClick={handleCloseModal}
                      className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold transition-all duration-200"
                    >
                      Close
                    </Button>
                  </div>
                )}

                {/* Transaction failed state */}
                {transactionState === 'failed' && (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                    </div>
                    <h3 className="text-white text-lg sm:text-xl font-bold mb-2">
                      Transaction Failed
                    </h3>
                    <p className="text-red-400 text-xs sm:text-sm mb-4">{transactionError}</p>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleStartNewTransaction}
                        className="flex-1 bg-[#231F20] border border-[#D0B284]/50 text-[#D0B284] hover:bg-[#D0B284]/10 hover:border-[#D0B284] transition-all duration-200"
                      >
                        Try Again
                      </Button>
                      <Button
                        onClick={handleCloseModal}
                        className="flex-1 bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold transition-all duration-200"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sold Out State */}
            {isSoldOut && activeContractState && transactionState === 'idle' && (
              <div className="bg-[#231F20]/70 rounded-xl border border-gray-500/30 p-4 sm:p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-white text-lg sm:text-xl font-bold mb-2">
                  🎉 Token Sale Complete! 🎉
                </h3>
                <p className="text-[#DCDDCC] text-sm sm:text-base mb-4">
                  All {MAXIMUM_SUPPLY.toLocaleString()} {tokenSymbol} tokens have been sold!
                </p>
                <div className="bg-[#0A0A0A]/50 rounded-lg p-3 mb-4">
                  <div className="text-[#D0B284] text-sm font-mono">
                    Total Supply: {currentSupply.toLocaleString()} /{' '}
                    {MAXIMUM_SUPPLY.toLocaleString()} tokens
                  </div>
                  <div className="text-[#928357] text-xs mt-1">
                    Thank you for participating in the ACES token launch!
                  </div>
                </div>
                <Button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white font-bold transition-all duration-200"
                >
                  Close
                </Button>
              </div>
            )}

            {/* Contract Loading State */}
            {!activeContractState && transactionState === 'idle' && (
              <div className="bg-[#231F20]/70 rounded-xl border border-[#D0B284]/30 p-4 sm:p-8 text-center">
                <div className="flex items-center justify-center mb-3">
                  <RefreshCw className="w-6 sm:w-8 h-6 sm:h-8 text-[#D0B284] animate-spin" />
                </div>
                <h3 className="text-white text-base sm:text-lg font-bold mb-2">
                  Loading Contract Data...
                </h3>
                <p className="text-[#DCDDCC] text-xs sm:text-sm">
                  Please wait while we fetch the latest pricing and contract information.
                </p>
              </div>
            )}

            {/* Hide form during transaction states except for idle and when sold out */}
            {transactionState === 'idle' && activeContractState && !isSoldOut && (
              <>
                {/* Currency Selector Dropdown */}
                <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-2 sm:p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs sm:text-sm font-medium text-[#DCDDCC] font-mono">
                      PAYMENT METHOD
                    </span>
                  </div>

                  <button
                    onClick={() => setShowCurrencyModal(true)}
                    className="w-full p-2 sm:p-3 rounded-lg border border-[#D0B284]/30 bg-[#231F20]/30 hover:border-[#D0B284]/50 transition-all duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                        <Image
                          src={getCurrencyIcon(selectedCurrency)}
                          alt={currencyInfo.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-white">
                          {currencyInfo.symbol}
                        </span>
                        <span className="text-xs sm:text-sm text-[#928357]">
                          {currencyInfo.name}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#928357]" />
                  </button>

                  {/* Currency Balance Display */}
                  <div className="text-xs sm:text-sm text-[#928357] text-center mt-1 font-mono flex items-center justify-center gap-1 sm:gap-2">
                    <span>
                      Balance:{' '}
                      {(Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals)).toFixed(
                        4,
                      )}{' '}
                      {selectedCurrency}
                      {selectedCurrency === 'ETH' &&
                        ` ($${(Number(formatEther(userCurrencyBalance)) * ethPrice.current).toFixed(0)})`}
                    </span>
                    <button
                      onClick={async () => {
                        if (refresh?.userBalance) {
                          setIsBackgroundRefreshing(true);
                          try {
                            await refresh.userBalance();
                          } finally {
                            setIsBackgroundRefreshing(false);
                          }
                        }
                      }}
                      className="text-[#D0B284] hover:text-[#D7BF75] transition-colors"
                      title="Refresh balance"
                      disabled={isBackgroundRefreshing}
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isBackgroundRefreshing ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Purchase Limit Display */}
                  <div className="text-xs sm:text-sm text-[#928357] text-center mt-1 font-mono">
                    Purchase limit:{' '}
                    {selectedCurrency === 'ETH'
                      ? `${PURCHASE_LIMITS.ETH} ETH`
                      : `$${PURCHASE_LIMITS[selectedCurrency as 'USDC' | 'USDT'].toLocaleString()} ${selectedCurrency}`}
                  </div>
                </div>

                {/* Slider Component - Conditional based on currency */}
                {selectedCurrency === 'ETH' ? (
                  <CryptoSlider
                    value={ethAmount}
                    onValueChange={setEthAmount}
                    selectedCurrency={selectedCurrency}
                    userCurrencyBalance={userCurrencyBalance}
                    ethPrice={ethPrice.current}
                    minAmount={minAmount}
                    maxAmount={maxAmount}
                    expectedTokens={expectedTokens}
                    actualCost={actualCost}
                    shareCount={shareCount}
                    contractState={activeContractState}
                    isCalculating={isCalculatingTokens}
                    tokenSymbol={tokenSymbol}
                    step={stepSize}
                    onMaxClick={() => {
                      // Use the exact same calculation as getMaxAmount()
                      const gasReserve = 0.00002; // 0.00002 ETH (~$0.06) reserve for gas + safety margin
                      const maxUsable = Math.max(0, walletBalanceEth - gasReserve);
                      setEthAmount(Math.min(maxUsable, maxAmount));
                    }}
                  />
                ) : (
                  <StablecoinSlider
                    value={usdAmount}
                    onValueChange={setUsdAmount}
                    selectedCurrency={selectedCurrency as 'USDC' | 'USDT'}
                    userCurrencyBalance={userCurrencyBalance}
                    ethPrice={ethPrice.current}
                    minAmount={0.5} // $0.50 minimum for stablecoins
                    maxAmount={Math.min(
                      PURCHASE_LIMITS[selectedCurrency as 'USDC' | 'USDT'],
                      Number(userCurrencyBalance) /
                        Math.pow(10, SUPPORTED_CURRENCIES[selectedCurrency].decimals),
                    )}
                    expectedTokens={expectedTokens}
                    actualCost={actualCost}
                    shareCount={shareCount}
                    contractState={activeContractState}
                    isCalculating={isCalculatingTokens}
                    tokenSymbol={tokenSymbol}
                    step={0.01} // $0.01 steps for USD
                    onMaxClick={() => {
                      // Set to lower of available balance or purchase limit
                      const maxUSD =
                        Number(userCurrencyBalance) /
                        Math.pow(10, SUPPORTED_CURRENCIES[selectedCurrency].decimals);
                      const effectiveMax = Math.min(
                        PURCHASE_LIMITS[selectedCurrency as 'USDC' | 'USDT'],
                        maxUSD,
                      );
                      setUsdAmount(effectiveMax);
                    }}
                  />
                )}

                {/* Stablecoin Warning - Only show if AcesSwap not ready */}
                {selectedCurrency !== 'ETH' && !isContractReady && (
                  <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/20 p-2 sm:p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs sm:text-sm text-yellow-400 font-mono">
                        {selectedCurrency} purchases coming soon via AcesSwap contract
                      </span>
                    </div>
                  </div>
                )}

                {/* Approval Status for ERC20 tokens */}
                {selectedCurrency !== 'ETH' && (
                  <>
                    {approvalInProgress && (
                      <div className="bg-blue-500/10 rounded-lg border border-blue-500/20 p-2">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                          <span className="text-xs text-blue-400 font-mono">
                            🔄 Approving {selectedCurrency} spending... Please confirm in your
                            wallet
                          </span>
                        </div>
                      </div>
                    )}
                    {approvalCompleted && !approvalInProgress && (
                      <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400 font-mono">
                            ✅ {selectedCurrency} spending approved
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Terms Checkbox */}
                <div className="bg-[#231F20]/30 rounded-lg border border-[#D0B284]/10 p-2 sm:p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="modal-terms"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-[#D0B284] bg-[#231F20] border-[#928357] rounded focus:ring-[#D0B284] focus:ring-2"
                    />
                    <label
                      htmlFor="modal-terms"
                      className="text-xs sm:text-sm text-[#DCDDCC] leading-relaxed"
                    >
                      I understand the risks and accept the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // console.log('🔥 Terms link clicked, setting state to true');
                          setShowTokenTermsModal(true);
                          // console.log('🔥 State should now be true');
                        }}
                        className="text-[#D0B284] hover:text-white underline transition-colors duration-200"
                      >
                        terms and conditions
                      </button>{' '}
                      of this token launch
                    </label>
                  </div>
                </div>

                {/* Jurisdiction Compliance Checkbox */}
                <div className="bg-[#231F20]/30 rounded-lg border border-[#D0B284]/10 p-2 sm:p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="modal-jurisdiction"
                      checked={jurisdictionCompliance}
                      onChange={(e) => setJurisdictionCompliance(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-[#D0B284] bg-[#231F20] border-[#928357] rounded focus:ring-[#D0B284] focus:ring-2"
                    />
                    <label
                      htmlFor="modal-jurisdiction"
                      className="text-xs sm:text-sm text-[#DCDDCC] leading-relaxed"
                    >
                      I confirm that:
                      <ul className="list-disc ml-4 mt-1 space-y-1">
                        <li>You are NOT a US citizen</li>
                        <li>You are NOT located in the United States</li>
                        <li>
                          You are NOT in any jurisdiction that prohibits participation in digital
                          assets
                        </li>
                      </ul>
                    </label>
                  </div>
                </div>

                {/* Purchase Button */}
                <Button
                  onClick={handleMainAction}
                  disabled={
                    isPending ||
                    isConfirming ||
                    approvalInProgress ||
                    swapState.isLoading ||
                    (selectedCurrency === 'ETH' ? ethAmount <= 0 : usdAmount <= 0) ||
                    Number(expectedTokens) <= 0 ||
                    !!ethPrice.error ||
                    // For purchase (not approval), require terms acceptance and jurisdiction compliance
                    ((!acceptTerms || !jurisdictionCompliance) &&
                      (selectedCurrency === 'ETH' || approvalCompleted)) ||
                    // Disable for stablecoins if AcesSwap is not ready
                    (selectedCurrency !== 'ETH' && !isContractReady)
                  }
                  className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-2.5 sm:py-3 text-sm sm:text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Loading states */}
                  {isPending || swapState.step === 'swapping'
                    ? 'Confirming in wallet...'
                    : isConfirming || swapState.step === 'checking-allowance'
                      ? 'Processing transaction...'
                      : approvalInProgress || swapState.step === 'approving'
                        ? `Approving ${selectedCurrency}...`
                        : swapState.isLoading
                          ? 'Processing...'
                          : /* Step-specific button text for stablecoins */
                            selectedCurrency !== 'ETH' && isContractReady
                            ? needsApproval && !approvalCompleted
                              ? `Approve ${selectedCurrency}` // STEP 1: Approval
                              : `Purchase ${tokenSymbol} with ${selectedCurrency}` // STEP 2: Purchase
                            : /* ETH or contract not ready */
                              selectedCurrency !== 'ETH' && !isContractReady
                              ? `${selectedCurrency} purchases coming soon`
                              : `Purchase ${tokenSymbol} with ${selectedCurrency}`}
                </Button>

                {/* Error Messages */}
                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-2 font-mono">
                    Transaction failed: {error instanceof Error ? error.message : 'Unknown error'}
                  </div>
                )}

                {ethPrice.error && (
                  <div className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 font-mono">
                    ⚠️ Price feed error: {ethPrice.error}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>

        {/* Currency Selection Modal - Same as before */}
        <Dialog open={showCurrencyModal} onOpenChange={setShowCurrencyModal}>
          <DialogContent className="bg-[#231F20] border-[#D0B284]/30 max-w-md w-[90vw] sm:w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden mx-2 sm:mx-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white font-serif text-lg sm:text-xl">
                  Select Currency
                </DialogTitle>
                <button
                  onClick={() => setShowCurrencyModal(false)}
                  className="text-[#928357] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </DialogHeader>

            <div className="space-y-2 py-3 sm:py-4 overflow-y-auto max-h-[65vh] sm:max-h-[60vh]">
              {Object.entries(SUPPORTED_CURRENCIES).map(([key, currency]) => {
                const isSelected = selectedCurrency === key;
                const balance =
                  key === 'ETH'
                    ? userEthBalance
                    : key === 'USDC'
                      ? usdcBalanceInfo.balance
                      : usdtBalanceInfo.balance;

                const balanceFormatted = (
                  Number(balance) / Math.pow(10, currency.decimals)
                ).toFixed(4);

                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedCurrency(key as Currency);
                      // Reset appropriate amount based on currency type
                      if (key === 'ETH') {
                        setEthAmount(0); // Reset to 0 for ETH
                      } else {
                        setUsdAmount(0); // Reset to 0 for stablecoins
                      }
                      setShowCurrencyModal(false);
                    }}
                    className={`w-full p-3 sm:p-4 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'border-[#D0B284] bg-[#D0B284]/10'
                        : 'border-[#928357]/30 bg-[#231F20]/30 hover:border-[#D0B284]/50 hover:bg-[#D0B284]/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <Image
                          src={getCurrencyIcon(key as Currency)}
                          alt={currency.name}
                          width={28}
                          height={28}
                          className="rounded-full"
                        />
                      </div>
                      <div className="text-left">
                        <div
                          className={`text-base sm:text-lg font-bold ${isSelected ? 'text-[#D0B284]' : 'text-white'}`}
                        >
                          {currency.symbol}
                        </div>
                        <div className="text-xs sm:text-sm text-[#928357]">{currency.name}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-xs sm:text-sm font-mono ${isSelected ? 'text-[#D0B284]' : 'text-white'}`}
                      >
                        {balanceFormatted}
                      </div>
                      <div className="text-xs text-[#928357]">
                        {key === 'ETH' &&
                          `$${(Number(formatEther(balance)) * ethPrice.current).toFixed(0)}`}
                        {key !== 'ETH' && `≈ ${balanceFormatted}`}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="ml-2">
                        <CheckCircle className="w-5 h-5 text-[#D0B284]" />
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Buy Crypto with Card Section */}
              <button
                onClick={handleBuyCrypto}
                disabled={isSwitching}
                className="w-full p-3 sm:p-4 rounded-lg border border-[#928357]/30 bg-[#231F20]/30 hover:border-[#D0B284]/50 hover:bg-[#D0B284]/5 transition-all duration-200 flex items-center justify-between disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <CreditCard className="w-7 h-7 text-[#D0B284]" />
                  </div>
                  <div className="text-left">
                    <div className="text-base sm:text-lg font-bold text-white">Buy Crypto</div>
                    <div className="text-xs sm:text-sm text-[#928357]">with Credit Card</div>
                  </div>
                </div>

                <div className="text-right">
                  {!isOnBaseMainnet && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                </div>
              </button>

              <p className="text-xs text-[#928357] text-center mt-3">
                Choose your preferred payment method for purchasing {tokenSymbol} tokens
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </Dialog>

      {/* Token Terms Modal */}
      <TokenTermsModal isOpen={showTokenTermsModal} onClose={() => setShowTokenTermsModal(false)} />
    </>
  );
}
