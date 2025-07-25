'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Crown, ArrowRight, CheckCircle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useBondingCurveContracts } from '@/hooks/use-ico-contracts';
import { parseEther, formatEther } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract, useBalance } from 'wagmi';
import { Currency, SUPPORTED_CURRENCIES } from '@/types/contracts';

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

  // Gas efficiency warning system
  const getGasWarning = (tokenAmount: number) => {
    if (tokenAmount <= 100) {
      return { level: 'good', message: 'Optimal gas efficiency', color: 'text-green-400' };
    } else if (tokenAmount <= 1000) {
      return { level: 'medium', message: 'Moderate gas cost', color: 'text-yellow-400' };
    } else if (tokenAmount <= 5000) {
      return {
        level: 'high',
        message: 'High gas cost - consider smaller amounts',
        color: 'text-orange-400',
      };
    } else if (tokenAmount <= 10000) {
      return {
        level: 'very-high',
        message: 'Very high gas cost - strongly consider breaking into smaller purchases',
        color: 'text-red-400',
      };
    } else {
      return {
        level: 'excessive',
        message: 'Transaction blocked - exceeds 10,000 token limit per purchase',
        color: 'text-red-500',
      };
    }
  };

  const tokenAmount = Number(expectedTokens);
  const gasWarning = getGasWarning(tokenAmount);

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

  const handlePurchase = async () => {
    if (!acceptTerms) {
      alert('Please accept the terms and conditions');
      return;
    }

    if (amount < minAmount || amount > maxAmount) {
      alert(`Amount must be between $${minAmount} and $${maxAmount}`);
      return;
    }

    // Gas efficiency validation
    const tokenCount = Number(expectedTokens);
    if (tokenCount > 10000) {
      alert(
        `Purchase of ${tokenCount.toLocaleString()} tokens exceeds the 10,000 token limit per transaction. Please reduce your purchase amount.`,
      );
      return;
    }

    if (tokenCount > 5000) {
      const confirm = window.confirm(
        `Warning: Purchasing ${tokenCount.toLocaleString()} tokens will require very high gas fees. ` +
          `Consider purchasing ${Math.round(tokenCount / 2).toLocaleString()} tokens instead for better efficiency. ` +
          `Do you want to continue with this large purchase?`,
      );
      if (!confirm) return;
    }

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
      <DialogContent className="bg-black border-[#D0B284]/30 max-w-lg">
        <DialogHeader className="">
          <DialogTitle></DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Currency Selector */}
          <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#DCDDCC] font-mono">PAYMENT METHOD</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SUPPORTED_CURRENCIES).map(([key, currency]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCurrency(key as Currency)}
                  className={`p-3 rounded-lg border transition-all duration-200 ${
                    selectedCurrency === key
                      ? 'border-[#D0B284] bg-[#D0B284]/10 text-[#D0B284]'
                      : 'border-[#928357]/30 bg-[#231F20]/30 text-[#DCDDCC] hover:border-[#D0B284]/50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">{currency.symbol}</div>
                    <div className="text-xs opacity-75">{currency.name}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Currency Balance Display */}
            <div className="text-xs text-[#928357] text-center mt-2 font-mono">
              Balance:{' '}
              {(Number(userCurrencyBalance) / Math.pow(10, currencyInfo.decimals)).toFixed(4)}{' '}
              {selectedCurrency}
              {selectedCurrency === 'ETH' &&
                ` ($${(Number(formatEther(userCurrencyBalance)) * ethPrice.current).toFixed(0)})`}
            </div>
          </div>

          {/* Amount Slider */}
          <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#DCDDCC] font-mono">
                {selectedCurrency === 'ETH'
                  ? 'INVESTMENT AMOUNT (USD)'
                  : `${selectedCurrency} AMOUNT`}
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full ${
                    selectedCurrency === 'ETH'
                      ? 'bg-gradient-to-r from-green-500 to-green-400'
                      : 'bg-gradient-to-r from-blue-500 to-blue-400'
                  } flex items-center justify-center text-white text-sm font-bold`}
                >
                  {selectedCurrency === 'ETH' ? '$' : selectedCurrency.charAt(0)}
                </div>
                <span className="text-white font-medium">
                  {selectedCurrency === 'ETH' ? 'USD' : selectedCurrency}
                </span>
              </div>
            </div>

            {/* Amount Display */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-white font-mono mb-2">
                {selectedCurrency === 'ETH' ? '$' : ''}
                {amount.toLocaleString()}
                {selectedCurrency !== 'ETH' ? ` ${selectedCurrency}` : ''}
              </div>

              {/* Conversion Display for Stablecoins */}
              {selectedCurrency !== 'ETH' && (
                <div className="text-sm text-[#928357] font-mono mb-2">
                  <div className="flex items-center justify-center gap-2">
                    <span>
                      {amount} {selectedCurrency}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                    <span>≈ {(amount / ethPrice.current).toFixed(6)} ETH</span>
                    <ArrowRight className="w-3 h-3" />
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
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] flex items-center justify-center text-black text-sm font-bold">
                  A
                </div>
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
                Current Price: $
                {(Number(formatEther(contractState.currentPrice)) * ethPrice.current).toFixed(8)}{' '}
                USD
              </div>
            )}

            {/* Gas Efficiency Warning */}
            {tokenAmount > 0 && (
              <div
                className={`text-xs font-mono mt-2 px-2 py-1 rounded ${
                  gasWarning.level === 'good'
                    ? 'bg-green-500/10 border border-green-500/20'
                    : gasWarning.level === 'medium'
                      ? 'bg-yellow-500/10 border border-yellow-500/20'
                      : gasWarning.level === 'high'
                        ? 'bg-orange-500/10 border border-orange-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                <span className={gasWarning.color}>⚡ {gasWarning.message}</span>
              </div>
            )}
          </div>

          {/* Approval Section for ERC20 tokens */}
          {selectedCurrency !== 'ETH' && (
            <div className="bg-[#231F20]/50 rounded-xl border border-[#D0B284]/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#DCDDCC] font-mono">
                  {selectedCurrency} APPROVAL
                </span>
                {approvalCompleted && <CheckCircle className="w-5 h-5 text-green-400" />}
              </div>

              {!approvalCompleted && needsApproval && (
                <div className="space-y-3">
                  <p className="text-xs text-[#928357]">
                    First, approve the contract to spend your {selectedCurrency}
                  </p>
                  <Button
                    onClick={handleApproval}
                    disabled={approvalInProgress}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
                  >
                    {approvalInProgress ? 'Approving...' : `Approve ${selectedCurrency}`}
                  </Button>
                </div>
              )}

              {approvalCompleted && (
                <p className="text-xs text-green-400">✅ {selectedCurrency} spending approved</p>
              )}
            </div>
          )}

          {/* Terms Checkbox */}
          <div className="bg-[#231F20]/30 rounded-xl border border-[#D0B284]/10 p-3">
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
            onClick={handlePurchase}
            disabled={
              !acceptTerms ||
              isPending ||
              isConfirming ||
              amount < minAmount ||
              amount > maxAmount ||
              Number(expectedTokens) <= 0 ||
              !!ethPrice.error ||
              gasWarning.level === 'excessive' ||
              (selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted)
            }
            className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-3 text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? 'Confirming in wallet...'
              : isConfirming
                ? 'Processing transaction...'
                : selectedCurrency !== 'ETH' && needsApproval && !approvalCompleted
                  ? `Approve ${selectedCurrency} First`
                  : gasWarning.level === 'excessive'
                    ? 'Purchase Too Large - Reduce Amount'
                    : selectedCurrency !== 'ETH'
                      ? `Buy ${tokenSymbol} with ${selectedCurrency}`
                      : gasWarning.level === 'very-high'
                        ? `High Gas Cost - Purchase ${tokenSymbol}`
                        : `Purchase ${tokenSymbol} with ${selectedCurrency}`}
          </Button>

          {/* Error Messages */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 font-mono">
              Transaction failed: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}

          {ethPrice.error && (
            <div className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 font-mono">
              ⚠️ Price feed error: {ethPrice.error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
