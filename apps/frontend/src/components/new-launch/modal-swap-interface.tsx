'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
import { useBondingCurveContracts } from '@/hooks/contracts/use-bonding-curve-contract';
import { useAcesSwapContract } from '@/hooks/contracts/use-aces-swap-contract';
import { parseEther, formatEther } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import { ACES_VAULT_ABI } from '@aces/utils';
import Image from 'next/image';

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
  const { login, authenticated, user } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { isOnBaseMainnet, isSwitching, ensureCorrectChain, SUPPORTED_CHAINS } =
    useChainSwitching();
  const { contractState, getQuote, ethPrice, refresh } = useBondingCurveContracts();
  const { data: hash, isPending, error, writeContractAsync } = useWriteContract();

  // AcesSwap integration for USDC/USDT
  const {
    swapState,
    useTokenBalance,
    useTokenAllowance,
    calculateSwapQuote,
    performCompleteSwap,
    resetSwapState,
    isContractReady,
  } = useAcesSwapContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isFailed,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // State - simplified to work with ETH
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('ETH');
  const [ethAmount, setEthAmount] = useState(0.01); // Amount in ETH
  const [expectedTokens, setExpectedTokens] = useState('0');
  const [actualCost, setActualCost] = useState('0'); // Cost in ETH
  const [shareCount, setShareCount] = useState(BigInt(0)); // Share count for contract
  const [acceptTerms, setAcceptTerms] = useState(false);
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

  // Current currency info
  const currencyInfo = SUPPORTED_CURRENCIES[selectedCurrency];
  const userEthBalance = contractState?.ethBalance || BigInt(0);
  const userCurrencyBalance =
    selectedCurrency === 'ETH'
      ? userEthBalance
      : selectedCurrency === 'USDC'
        ? usdcBalanceInfo.balance
        : usdtBalanceInfo.balance;

  // Calculate max amount based on currency and balance
  const getMaxAmount = () => {
    if (selectedCurrency === 'ETH') {
      const maxEthFromWallet = Number(formatEther(userEthBalance));
      // Reserve some ETH for gas fees
      const maxUsableEth = Math.max(0, maxEthFromWallet - 0.01);
      return Math.min(1, maxUsableEth); // Cap at 1 ETH for safety
    } else {
      // For stablecoins, convert balance to ETH equivalent for now
      // This will be updated when the AcesSwap contract is integrated
      const balanceInCurrency = Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals);
      const ethEquivalent = balanceInCurrency / ethPrice.current;
      return Math.min(1, ethEquivalent);
    }
  };

  const maxAmount = getMaxAmount();
  const minAmount = 0.001; // 0.001 ETH minimum

  // Create our own buyTokens function that uses the modal's writeContractAsync
  // This ensures the hash gets set in our useWriteContract hook
  const buyTokensWithModalHook = async (
    shareCount: bigint,
    ethCost: bigint,
  ): Promise<`0x${string}`> => {
    if (!authenticated || !user?.wallet?.address) {
      throw new Error('Not authenticated');
    }

    const hash = await writeContractAsync({
      address: ACES_VAULT_ADDRESS,
      abi: ACES_VAULT_ABI,
      functionName: 'buyShares',
      args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount],
      value: ethCost,
      account: user.wallet.address as `0x${string}`,
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

  // Calculate expected tokens when amount changes
  useEffect(() => {
    const calculateExpectedTokens = async () => {
      if (ethAmount < minAmount || ethAmount > maxAmount) {
        setExpectedTokens('0');
        setActualCost('0');
        setShareCount(BigInt(0));
        setNeedsApproval(false);
        return;
      }

      try {
        if (selectedCurrency === 'ETH') {
          // Direct ETH quote from contract
          const quote = await getQuote(ethAmount.toString());

          setExpectedTokens(formatEther(quote.tokensOut));
          setActualCost(formatEther(quote.ethCost));
          setShareCount(quote.shareCount);
          setNeedsApproval(false);
        } else if (isContractReady) {
          // For stablecoins with AcesSwap
          const shareCountEstimate = BigInt(Math.floor(ethAmount * 1000)); // Rough estimate for shares
          const quote = calculateSwapQuote(
            ethAmount.toString(),
            selectedCurrency,
            shareCountEstimate,
          );

          if (quote) {
            setExpectedTokens(shareCountEstimate.toString());
            setActualCost(ethAmount.toString()); // Input amount in selected currency
            setShareCount(shareCountEstimate);

            // Check if approval is needed
            const currentAllowance =
              selectedCurrency === 'USDC' ? usdcAllowance.allowance : usdtAllowance.allowance;
            setNeedsApproval(currentAllowance < quote.inputAmount);
          } else {
            setExpectedTokens('0');
            setActualCost('0');
            setShareCount(BigInt(0));
            setNeedsApproval(false);
          }
        } else {
          // AcesSwap not ready yet
          setExpectedTokens('0');
          setActualCost('0');
          setShareCount(BigInt(0));
          setNeedsApproval(false);
        }
      } catch (error) {
        console.error('Failed to calculate tokens:', error);
        setExpectedTokens('0');
        setActualCost('0');
        setShareCount(BigInt(0));
        setNeedsApproval(false);
      }
    };

    const debounceTimer = setTimeout(calculateExpectedTokens, 300);
    return () => clearTimeout(debounceTimer);
  }, [
    ethAmount,
    selectedCurrency,
    getQuote,
    minAmount,
    maxAmount,
    isContractReady,
    calculateSwapQuote,
    usdcAllowance.allowance,
    usdtAllowance.allowance,
  ]);

  // Handle approval for ERC20 tokens
  const handleApproval = async () => {
    if (selectedCurrency === 'ETH' || !isContractReady) return;

    try {
      setApprovalInProgress(true);

      // Use the AcesSwap hook's approval function
      const success = await performCompleteSwap(
        selectedCurrency,
        ethAmount.toString(),
        shareCount,
        2.5, // 2.5% slippage tolerance
      );

      if (success) {
        setApprovalCompleted(true);
        setNeedsApproval(false);
      }
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setApprovalInProgress(false);
    }
  };

  // Check if approval is needed for ERC20 tokens
  useEffect(() => {
    if (selectedCurrency === 'ETH') {
      setNeedsApproval(false);
      setApprovalCompleted(false);
      return;
    }

    // For stablecoins, approval will be needed when AcesSwap is ready
    setNeedsApproval(true);
    setApprovalCompleted(false);
  }, [selectedCurrency]);

  // Monitor transaction state changes (both ETH and AcesSwap)
  useEffect(() => {
    if (isPending || swapState.step === 'swapping') {
      setTransactionState('submitting');
      setTransactionError(null);
    } else if (isConfirming || swapState.step === 'approving') {
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
      // Use setTimeout to prevent any potential issues with immediate state updates
      setTimeout(() => {
        if (refresh) {
          refresh.tokenSupply();
          refresh.userBalance();
          refresh.price();
        }
      }, 1000);
    } else if (
      swapState.step === 'success' &&
      swapState.transactionHash &&
      transactionState !== 'success'
    ) {
      setTransactionState('success');

      // Store purchase details for AcesSwap success
      setPurchaseDetails({
        ethSpent: actualCost,
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
    } else if (isFailed || error || swapState.error) {
      setTransactionState('failed');

      // Set error message
      let errorMessage = 'Transaction failed. Please try again.';
      const errorSource = error || swapState.error;

      if (errorSource instanceof Error || typeof errorSource === 'string') {
        const errorStr = (
          errorSource instanceof Error ? errorSource.message : errorSource
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
        } else if (errorStr.includes('approval')) {
          errorMessage = 'Token approval failed. Please try again.';
        } else if (errorStr.includes('swap')) {
          errorMessage = 'Swap transaction failed. Please try again.';
        } else if (errorStr.length > 0) {
          errorMessage = `Transaction failed: ${errorStr}`;
        }
      }
      setTransactionError(errorMessage);
    }
  }, [
    isPending,
    isConfirming,
    isConfirmed,
    isFailed,
    error,
    receipt,
    swapState,
    actualCost,
    expectedTokens,
    shareCount,
    refresh,
    transactionState,
  ]);

  // Handle buy crypto with chain switching
  const handleBuyCrypto = async () => {
    if (!user?.wallet?.address) return;

    try {
      setShowCurrencyModal(false);
      await ensureCorrectChain(SUPPORTED_CHAINS.BASE_MAINNET, {
        showPrompt: true,
        autoSwitch: false,
      });
      fundWallet(user.wallet.address);
    } catch (error) {
      console.error('Failed to initiate funding:', error);
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

    if (ethAmount < minAmount || ethAmount > maxAmount) {
      alert(`Amount must be between ${minAmount} and ${maxAmount} ETH`);
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

        // Add small buffer for gas estimation
        const gasBuffer = parseEther('0.01'); // 0.01 ETH buffer for gas
        const totalNeeded = ethCostWei + gasBuffer;

        if (userEthBalance < totalNeeded) {
          const neededEth = Number(formatEther(totalNeeded - userEthBalance));
          alert(
            `Insufficient ETH balance. You need approximately ${neededEth.toFixed(4)} more ETH to cover the purchase and gas fees.`,
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
      } else if (isContractReady) {
        // USDC/USDT purchase via AcesSwap
        setTransactionState('idle');
        setTransactionError(null);
        setPurchaseDetails(null);

        const success = await performCompleteSwap(
          selectedCurrency,
          ethAmount.toString(),
          shareCount,
          2.5, // 2.5% slippage tolerance
        );

        if (success) {
          // Transaction monitoring will handle success state
          console.log('Swap completed successfully');
        }
      } else {
        // AcesSwap contract not deployed yet
        alert(
          `${selectedCurrency} purchases will be available once the AcesSwap contract is deployed!`,
        );
        return;
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
    setEthAmount(minAmount);
    setExpectedTokens('0');
    setActualCost('0');
    setShareCount(BigInt(0));
    setAcceptTerms(false);
    setNeedsApproval(false);
    setApprovalCompleted(false);
    setApprovalInProgress(false);
    resetSwapState(); // Reset AcesSwap state
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

  if (!authenticated) {
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
              onClick={login}
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
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="bg-black border-[#D0B284]/30 max-w-lg h-fit max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle></DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto max-h-[calc(90vh-120px)] px-1">
          {/* Transaction Status Display */}
          {transactionState !== 'idle' && (
            <div className="bg-[#231F20]/70 rounded-xl border border-[#D0B284]/30 p-4">
              {/* Transaction in progress states */}
              {(transactionState === 'submitting' || transactionState === 'pending') && (
                <div className="text-center">
                  <div className="flex items-center justify-center mb-3">
                    <RefreshCw className="w-8 h-8 text-[#D0B284] animate-spin" />
                  </div>
                  <h3 className="text-white text-lg font-bold mb-2">
                    {transactionState === 'submitting'
                      ? 'Submitting Transaction...'
                      : 'Transaction Pending...'}
                  </h3>
                  <p className="text-[#DCDDCC] text-sm mb-3">
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
                  <h3 className="text-white text-xl font-bold mb-2">Purchase Successful!</h3>
                  <p className="text-[#DCDDCC] text-sm mb-4">
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
                  <h3 className="text-white text-xl font-bold mb-2">Transaction Failed</h3>
                  <p className="text-red-400 text-sm mb-4">{transactionError}</p>

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

          {/* Hide form during transaction states except for idle */}
          {transactionState === 'idle' && (
            <>
              {/* Currency Selector Dropdown */}
              <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#DCDDCC] font-mono">
                    PAYMENT METHOD
                  </span>
                </div>

                <button
                  onClick={() => setShowCurrencyModal(true)}
                  className="w-full p-2 rounded-lg border border-[#D0B284]/30 bg-[#231F20]/30 hover:border-[#D0B284]/50 transition-all duration-200 flex items-center justify-between"
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
                      <span className="text-base font-bold text-white">{currencyInfo.symbol}</span>
                      <span className="text-sm text-[#928357]">{currencyInfo.name}</span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#928357]" />
                </button>

                {/* Currency Balance Display */}
                <div className="text-xs text-[#928357] text-center mt-1 font-mono">
                  Balance:{' '}
                  {(Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals)).toFixed(4)}{' '}
                  {selectedCurrency}
                  {selectedCurrency === 'ETH' &&
                    ` ($${(Number(formatEther(userCurrencyBalance)) * ethPrice.current).toFixed(0)})`}
                </div>
              </div>

              {/* Amount Slider - Updated for ETH */}
              <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#DCDDCC] font-mono">
                    {selectedCurrency === 'ETH' ? 'ETH AMOUNT' : `${selectedCurrency} AMOUNT`}
                  </span>
                  <button
                    onClick={() => setEthAmount(maxAmount)}
                    disabled={maxAmount <= 0}
                    className="px-2 py-1 text-xs font-bold text-[#D0B284] border border-[#D0B284]/50 rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 hover:border-[#D0B284] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    MAX
                  </button>
                </div>

                {/* Amount Display */}
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-white font-mono mb-2">
                    {ethAmount.toFixed(4)} ETH
                  </div>

                  {/* USD Value Display */}
                  <div className="text-sm text-[#928357] font-mono">
                    ≈ ${(ethAmount * ethPrice.current).toFixed(2)} USD
                  </div>

                  {/* Actual Cost Display */}
                  {actualCost !== '0' && (
                    <div className="text-xs text-[#928357] font-mono mt-1">
                      Actual Cost: {Number(actualCost).toFixed(6)} ETH
                    </div>
                  )}
                </div>

                {/* Slider */}
                <div className="px-2">
                  <Slider
                    value={[ethAmount]}
                    onValueChange={(value) => setEthAmount(value[0])}
                    max={maxAmount}
                    min={minAmount}
                    step={0.001}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-[#928357] mt-2 font-mono">
                    <span>{minAmount} ETH</span>
                    <span>{(maxAmount / 2).toFixed(3)} ETH</span>
                    <span>{maxAmount.toFixed(3)} ETH</span>
                  </div>
                </div>
              </div>

              {/* Expected Tokens Display */}
              <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#DCDDCC] font-mono">YOU RECEIVE</span>
                  <div className="flex items-center gap-2">
                    <Image
                      src={'/aces-logo.png'}
                      alt={tokenSymbol}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <span className="text-[#D0B284] font-medium">{tokenSymbol}</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-[#D0B284] font-mono">
                  {Number(expectedTokens) > 1000
                    ? `${(Number(expectedTokens) / 1000).toFixed(1)}K`
                    : Number(expectedTokens).toFixed(0)}
                </div>
                <div className="text-sm text-[#928357] font-mono mt-1">
                  ≈ {Number(expectedTokens).toLocaleString()} {tokenSymbol} Tokens
                </div>
                {contractState?.currentPrice && (
                  <div className="text-xs text-[#928357] font-mono mt-1">
                    Current Price: {Number(formatEther(contractState.currentPrice)).toFixed(8)} ETH
                    per share
                  </div>
                )}
                {shareCount > BigInt(0) && (
                  <div className="text-xs text-[#928357] font-mono mt-1">
                    Share Count: {shareCount.toString()}
                  </div>
                )}
              </div>

              {/* Stablecoin Warning - Only show if AcesSwap not ready */}
              {selectedCurrency !== 'ETH' && !isContractReady && (
                <div className="bg-yellow-500/10 rounded-lg border border-yellow-500/20 p-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-yellow-400 font-mono">
                      {selectedCurrency} purchases coming soon via AcesSwap contract
                    </span>
                  </div>
                </div>
              )}

              {/* Approval Status for ERC20 tokens */}
              {selectedCurrency !== 'ETH' && approvalCompleted && (
                <div className="bg-green-500/10 rounded-lg border border-green-500/20 p-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400 font-mono">
                      ✅ {selectedCurrency} spending approved
                    </span>
                  </div>
                </div>
              )}

              {/* Terms Checkbox */}
              <div className="bg-[#231F20]/30 rounded-lg border border-[#D0B284]/10 p-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="modal-terms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#D0B284] bg-[#231F20] border-[#928357] rounded focus:ring-[#D0B284] focus:ring-2"
                  />
                  <label htmlFor="modal-terms" className="text-sm text-[#DCDDCC] leading-relaxed">
                    I understand the risks and accept the terms and conditions of this token launch
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
                  ethAmount < minAmount ||
                  ethAmount > maxAmount ||
                  Number(expectedTokens) <= 0 ||
                  !!ethPrice.error ||
                  // For purchase (not approval), require terms acceptance
                  (!acceptTerms && (selectedCurrency === 'ETH' || approvalCompleted)) ||
                  // Disable for stablecoins if AcesSwap is not ready
                  (selectedCurrency !== 'ETH' && !isContractReady)
                }
                className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-2.5 text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending
                  ? 'Confirming in wallet...'
                  : isConfirming
                    ? 'Processing transaction...'
                    : approvalInProgress
                      ? `Approving ${selectedCurrency}...`
                      : selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted && isContractReady
                        ? `Approve ${selectedCurrency}`
                        : selectedCurrency !== 'ETH' && !isContractReady
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
        <DialogContent className="bg-[#231F20] border-[#D0B284]/30 max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white font-serif text-xl">Select Currency</DialogTitle>
              <button
                onClick={() => setShowCurrencyModal(false)}
                className="text-[#928357] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-2 py-4 overflow-y-auto max-h-[60vh]">
            {Object.entries(SUPPORTED_CURRENCIES).map(([key, currency]) => {
              const isSelected = selectedCurrency === key;
              const balance =
                key === 'ETH'
                  ? userEthBalance
                  : key === 'USDC'
                    ? usdcBalanceInfo.balance
                    : usdtBalanceInfo.balance;

              const balanceFormatted = (Number(balance) / Math.pow(10, currency.decimals)).toFixed(
                4,
              );

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedCurrency(key as Currency);
                    setEthAmount(minAmount); // Reset amount when currency changes
                    setShowCurrencyModal(false);
                  }}
                  className={`w-full p-4 rounded-lg border transition-all duration-200 flex items-center justify-between ${
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
                        className={`text-lg font-bold ${isSelected ? 'text-[#D0B284]' : 'text-white'}`}
                      >
                        {currency.symbol}
                      </div>
                      <div className="text-sm text-[#928357]">{currency.name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-mono ${isSelected ? 'text-[#D0B284]' : 'text-white'}`}
                    >
                      {balanceFormatted}
                    </div>
                    <div className="text-xs text-[#928357]">
                      {key === 'ETH' &&
                        `${(Number(formatEther(balance)) * ethPrice.current).toFixed(0)}`}
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
              className="w-full p-4 rounded-lg border border-[#928357]/30 bg-[#231F20]/30 hover:border-[#D0B284]/50 hover:bg-[#D0B284]/5 transition-all duration-200 flex items-center justify-between disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <CreditCard className="w-7 h-7 text-[#D0B284]" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-white">Buy Crypto</div>
                  <div className="text-sm text-[#928357]">with Credit Card</div>
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
  );
}
