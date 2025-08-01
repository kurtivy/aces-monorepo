'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Wallet,
  Crown,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  X,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import { useBondingCurveContracts } from '@/hooks/contracts/use-bonding-curve-contract';
import { parseEther, formatEther } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract, useBalance } from 'wagmi';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import Image from 'next/image';

interface ModalSwapInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol?: string;
}

export default function ModalSwapInterface({
  isOpen,
  onClose,
  tokenSymbol = 'ACEST',
}: ModalSwapInterfaceProps) {
  const { login, authenticated, user } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { isOnBaseMainnet, isSwitching, ensureCorrectChain, SUPPORTED_CHAINS } =
    useChainSwitching();
  const { contractState, getQuote, buyTokens, ethPrice } = useBondingCurveContracts();
  const { data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Currency state
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('ETH');
  const [amount, setAmount] = useState(1); // Amount in selected currency
  const [expectedTokens, setExpectedTokens] = useState('0');
  const [actualCost, setActualCost] = useState('0'); // Cost in selected currency
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalInProgress, setApprovalInProgress] = useState(false);
  const [approvalCompleted, setApprovalCompleted] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Get balances for selected currency
  const { data: usdcBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: SUPPORTED_CURRENCIES.USDC.address,
    query: { enabled: authenticated && !!user?.wallet?.address },
  });

  const { data: usdtBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: SUPPORTED_CURRENCIES.USDT.address,
    query: { enabled: authenticated && !!user?.wallet?.address },
  });

  // Current currency info
  const currencyInfo = SUPPORTED_CURRENCIES[selectedCurrency];
  const userEthBalance = contractState?.ethBalance || BigInt(0);
  const userCurrencyBalance =
    selectedCurrency === 'ETH'
      ? userEthBalance
      : selectedCurrency === 'USDC'
        ? usdcBalance?.value || BigInt(0)
        : usdtBalance?.value || BigInt(0);

  // Calculate max amount based on currency and balance
  const getMaxAmount = () => {
    if (selectedCurrency === 'ETH') {
      const maxUsdFromWallet = Number(formatEther(userEthBalance)) * ethPrice.current;
      return Math.min(10000, maxUsdFromWallet);
    } else {
      // For stablecoins, balance is in token units (USDC/USDT), convert to human readable
      const balanceInCurrency = Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals);
      return Math.min(10000, balanceInCurrency);
    }
  };

  const maxAmount = getMaxAmount();
  const minAmount = 1; // $1 minimum for all currencies

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

  // Calculate expected tokens when amount or currency changes
  useEffect(() => {
    const calculateExpectedTokens = async () => {
      if (amount < minAmount || ethPrice.current <= 0) {
        setExpectedTokens('0');
        setActualCost('0');
        return;
      }

      try {
        if (selectedCurrency === 'ETH') {
          // For ETH, amount is in USD, convert to ETH
          const ethAmount = amount / ethPrice.current;
          const ethAmountWei = parseEther(ethAmount.toString());

          const currentPrice = contractState?.currentPrice || BigInt(0);
          if (currentPrice > BigInt(0)) {
            let estimatedTokens = (ethAmountWei * BigInt(1e18)) / currentPrice;
            estimatedTokens = (estimatedTokens * BigInt(85)) / BigInt(100); // 85% buffer
            setExpectedTokens(formatEther(estimatedTokens));
            setActualCost((ethAmount * 1.02).toString()); // 2% buffer
          }
        } else {
          // For stablecoins (USDC/USDT), amount is directly in USD
          // We need to estimate how many tokens they'll get for this USD amount
          // Since the pre-contract will convert USDC/USDT → ETH → tokens,
          // we can use the same logic but set the cost in stablecoin terms

          const ethAmount = amount / ethPrice.current;
          const ethAmountWei = parseEther(ethAmount.toString());

          const currentPrice = contractState?.currentPrice || BigInt(0);
          if (currentPrice > BigInt(0)) {
            let estimatedTokens = (ethAmountWei * BigInt(1e18)) / currentPrice;
            estimatedTokens = (estimatedTokens * BigInt(85)) / BigInt(100); // 85% buffer
            setExpectedTokens(formatEther(estimatedTokens));

            // For stablecoins, cost is approximately the USD amount (plus some slippage)
            const costWithSlippage = amount * 1.05; // 5% slippage buffer for conversion
            setActualCost(costWithSlippage.toString());
          }
        }
      } catch (error) {
        console.error('Failed to calculate tokens:', error);
        setExpectedTokens('0');
        setActualCost('0');
      }
    };

    const debounceTimer = setTimeout(calculateExpectedTokens, 300);
    return () => clearTimeout(debounceTimer);
  }, [amount, selectedCurrency, ethPrice.current, contractState?.currentPrice, minAmount]);

  // Check if approval is needed for ERC20 tokens
  useEffect(() => {
    if (selectedCurrency === 'ETH') {
      setNeedsApproval(false);
      setApprovalCompleted(false);
      return;
    }

    // For now, we'll assume approval is needed for ERC20s
    // This will be updated when the pre-contract is ready
    setNeedsApproval(true);
    setApprovalCompleted(false);
  }, [selectedCurrency, amount]);

  const handleApproval = async () => {
    if (selectedCurrency === 'ETH') return;

    setApprovalInProgress(true);
    try {
      // TODO: Implement actual ERC20 approval when pre-contract is ready
      // For now, simulate approval
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setApprovalCompleted(true);
      setNeedsApproval(false);
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setApprovalInProgress(false);
    }
  };

  // Handle buy crypto with chain switching (copied from connect-wallet-profile.tsx)
  const handleBuyCrypto = async () => {
    if (!user?.wallet?.address) return;

    try {
      // Close the currency modal first
      setShowCurrencyModal(false);

      // Ensure user is on Base mainnet for funding
      await ensureCorrectChain(SUPPORTED_CHAINS.BASE_MAINNET, {
        showPrompt: true,
        autoSwitch: false,
      });

      // Once on correct chain, open funding
      fundWallet(user.wallet.address);
    } catch (error) {
      console.error('Failed to initiate funding:', error);
      // Could show error toast here
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

    if (amount < minAmount || amount > maxAmount) {
      alert(`Amount must be between $${minAmount} and $${maxAmount}`);
      return;
    }

    const tokenCount = Number(expectedTokens);

    try {
      if (selectedCurrency === 'ETH') {
        // Existing ETH purchase logic
        const ethAmountWei = parseEther(actualCost);
        const tokenAmountWei = parseEther(expectedTokens);
        const ethBufferMultiplier = 1.1;
        const ethAmountWithBuffer = BigInt(Math.floor(Number(ethAmountWei) * ethBufferMultiplier));

        // Gas estimation logic (existing)
        let estimatedGas: bigint;
        if (tokenCount <= 100) {
          estimatedGas = BigInt(1000000);
        } else if (tokenCount <= 1000) {
          estimatedGas = BigInt(2000000);
        } else if (tokenCount <= 5000) {
          estimatedGas = BigInt(4000000);
        } else {
          estimatedGas = BigInt(6000000);
        }

        const gasPrice = tokenCount > 1000 ? BigInt(2000000000) : BigInt(1000000000);
        const estimatedGasCost = estimatedGas * gasPrice;
        const totalNeeded = ethAmountWithBuffer + estimatedGasCost;

        if (userEthBalance < totalNeeded) {
          const neededEth = Number(formatEther(totalNeeded - userEthBalance));
          alert(
            `Insufficient ETH balance. You need approximately ${neededEth.toFixed(4)} more ETH to cover the purchase and gas fees.`,
          );
          return;
        }

        await buyTokens(tokenAmountWei, ethAmountWithBuffer);
      } else {
        // TODO: Implement pre-contract purchase for USDC/USDT
        alert(`${selectedCurrency} purchases will be available once the pre-contract is deployed!`);
        return;
      }

      // Reset form on success
      setAmount(minAmount);
      setExpectedTokens('0');
      setActualCost('0');
      onClose();
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      // Error handling logic (existing)
      let errorMessage = 'Transaction failed. Please try again.';
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('exceeds') && errorStr.includes('token limit')) {
          errorMessage = error.message;
        } else if (errorStr.includes('out of gas') || errorStr.includes('gas')) {
          errorMessage =
            'Transaction failed due to insufficient gas. Please try again with a smaller amount.';
        } else if (errorStr.includes('insufficient funds')) {
          errorMessage = 'Insufficient balance to complete this transaction.';
        } else if (errorStr.includes('user rejected') || errorStr.includes('user denied')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else if (error.message.length > 0) {
          errorMessage = `Transaction failed: ${error.message}`;
        }
      }
      alert(errorMessage);
    }
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black border-[#D0B284]/30 max-w-lg h-fit max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle></DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto max-h-[calc(90vh-120px)] px-1">
          {/* Currency Selector Dropdown */}
          <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[#DCDDCC] font-mono">PAYMENT METHOD</span>
            </div>

            {/* Currency Dropdown Button */}
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
                ` (${(Number(formatEther(userCurrencyBalance)) * ethPrice.current).toFixed(0)})`}
            </div>
          </div>

          {/* Amount Slider */}
          <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#DCDDCC] font-mono">
                {selectedCurrency === 'ETH'
                  ? 'INVESTMENT AMOUNT (USD Value Approx.)'
                  : `${selectedCurrency} AMOUNT`}
              </span>
              <button
                onClick={() => setAmount(maxAmount)}
                disabled={maxAmount <= 0}
                className="px-2 py-1 text-xs font-bold text-[#D0B284] border border-[#D0B284]/50 rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 hover:border-[#D0B284] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                MAX
              </button>
            </div>

            {/* Amount Display */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-white font-mono mb-2">
                {selectedCurrency === 'ETH' ? '$' : ''}
                {amount.toLocaleString()}
                {selectedCurrency !== 'ETH' ? ` ${selectedCurrency}` : ''}
              </div>

              {/* Conversion Display for Stablecoins - More Compact */}
              {selectedCurrency !== 'ETH' && (
                <div className="text-xs text-[#928357] font-mono mb-2">
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span>
                      {amount} {selectedCurrency}
                    </span>
                    <ArrowRight className="w-2 h-2" />
                    <span>≈ {(amount / ethPrice.current).toFixed(5)} ETH</span>
                    <ArrowRight className="w-2 h-2" />
                    <span>
                      {Number(expectedTokens).toFixed(0)} {tokenSymbol}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-sm text-[#928357] font-mono">
                {selectedCurrency === 'ETH'
                  ? `≈ ${Number(actualCost).toFixed(6)} ETH (@ $${ethPrice.current.toLocaleString()})`
                  : `≈ $${amount} USD value`}
              </div>
            </div>

            {/* Slider */}
            <div className="px-2">
              <Slider
                value={[amount]}
                onValueChange={(value) => setAmount(value[0])}
                max={maxAmount}
                min={minAmount}
                step={selectedCurrency === 'ETH' ? 1 : 0.1} // Finer control for stablecoins
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#928357] mt-2 font-mono">
                <span>
                  {selectedCurrency === 'ETH' ? '$' : ''}
                  {minAmount}
                  {selectedCurrency !== 'ETH' ? ` ${selectedCurrency}` : ''}
                </span>
                <span>
                  {selectedCurrency === 'ETH' ? '$' : ''}
                  {Math.round(maxAmount / 2)}
                  {selectedCurrency !== 'ETH' ? ` ${selectedCurrency}` : ''}
                </span>
                <span>
                  {selectedCurrency === 'ETH' ? '$' : ''}
                  {maxAmount}
                  {selectedCurrency !== 'ETH' ? ` ${selectedCurrency}` : ''}
                </span>
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
                  alt={currencyInfo.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span className="text-[#D0B284] font-medium">${tokenSymbol}</span>
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
                Current Price: $
                {(Number(formatEther(contractState.currentPrice)) * ethPrice.current).toFixed(8)}{' '}
                USD
              </div>
            )}
          </div>

          {/* Approval Status Indicator for ERC20 tokens - More Compact */}
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

          {/* Approval explanation for ERC20 tokens - More Compact */}
          {selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted && (
            <div className="bg-blue-500/10 rounded-lg border border-blue-500/20 p-2">
              <p className="text-xs text-blue-300 text-center">
                First, approve the contract to spend your {selectedCurrency}, then purchase{' '}
                {tokenSymbol} tokens
              </p>
            </div>
          )}

          {/* Terms Checkbox - More Compact */}
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
              amount < minAmount ||
              amount > maxAmount ||
              Number(expectedTokens) <= 0 ||
              !!ethPrice.error ||
              // For purchase (not approval), require terms acceptance
              (!acceptTerms && (selectedCurrency === 'ETH' || approvalCompleted))
            }
            className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-2.5 text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? 'Confirming in wallet...'
              : isConfirming
                ? 'Processing transaction...'
                : approvalInProgress
                  ? `Approving ${selectedCurrency}...`
                  : selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted
                    ? `Approve ${selectedCurrency}`
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
        </div>
      </DialogContent>

      {/* Currency Selection Modal */}
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
                    ? usdcBalance?.value || BigInt(0)
                    : usdtBalance?.value || BigInt(0);

              const balanceFormatted = (Number(balance) / Math.pow(10, currency.decimals)).toFixed(
                4,
              );

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedCurrency(key as Currency);
                    setAmount(minAmount); // Reset amount when currency changes
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
                        `$${(Number(formatEther(balance)) * ethPrice.current).toFixed(0)}`}
                      {key !== 'ETH' && `≈ $${balanceFormatted}`}
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

            {/* Buy Crypto with Card Section - Styled like currency options */}
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
