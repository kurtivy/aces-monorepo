'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PriceConversionData {
  acesAmount: string;
  usdValue: string;
  acesPrice: string;
  isStale: boolean;
}

interface PaymentEstimate {
  symbol: 'USDC' | 'USDT' | 'ETH';
  label: string;
  decimals: number;
  type: 'erc20' | 'native';
}

interface ApprovalState {
  paymentTokenApproved: boolean;
  acesApproved: boolean;
  readyForSwap: boolean;
}

interface TokenSwapPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceQuoteACES: string;
  usdConversion: PriceConversionData | null;
  launchpadAmount: string;
  tokenSymbol?: string;
  isMainnet: boolean;
}

const PAYMENT_TOKENS: PaymentEstimate[] = [
  { symbol: 'USDC', label: 'USDC (Base)', decimals: 6, type: 'erc20' },
  { symbol: 'USDT', label: 'USDT (Base)', decimals: 6, type: 'erc20' },
  { symbol: 'ETH', label: 'ETH (Base)', decimals: 18, type: 'native' },
];

const DEFAULT_ETH_PRICE = 3000; // TODO: replace with live oracle feed when available

export function TokenSwapPaymentModal({
  isOpen,
  onClose,
  priceQuoteACES,
  usdConversion,
  launchpadAmount,
  tokenSymbol = 'TOKEN',
  isMainnet,
}: TokenSwapPaymentModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentEstimate>(PAYMENT_TOKENS[0]);
  const [slippageBps, setSlippageBps] = useState('50');
  const [approvalState] = useState<ApprovalState>({
    paymentTokenApproved: false,
    acesApproved: false,
    readyForSwap: false,
  });

  const parsedAcesRequired = useMemo(() => {
    const numeric = Number.parseFloat(priceQuoteACES || '0');
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }
    return numeric;
  }, [priceQuoteACES]);

  const usdRequired = useMemo(() => {
    if (!usdConversion?.usdValue) {
      return null;
    }
    const usd = Number.parseFloat(usdConversion.usdValue);
    return Number.isFinite(usd) ? usd : null;
  }, [usdConversion]);

  const estimates = useMemo(() => {
    const base = {
      aces: parsedAcesRequired,
      usd: usdRequired,
    };

    const paymentAmounts = new Map<string, number | null>();

    PAYMENT_TOKENS.forEach((token) => {
      if (!base.usd) {
        paymentAmounts.set(token.symbol, null);
        return;
      }

      if (token.type === 'native') {
        paymentAmounts.set(token.symbol, base.usd / DEFAULT_ETH_PRICE);
      } else {
        paymentAmounts.set(token.symbol, base.usd);
      }
    });

    return {
      ...base,
      paymentAmounts,
    };
  }, [parsedAcesRequired, usdRequired]);

  const selectedPaymentAmount = useMemo(() => {
    const value = estimates.paymentAmounts.get(selectedPayment.symbol);
    if (value == null) {
      return null;
    }
    if (selectedPayment.symbol === 'ETH') {
      return value;
    }
    return value;
  }, [estimates.paymentAmounts, selectedPayment.symbol]);

  const formattedPaymentValue = useMemo(() => {
    if (selectedPaymentAmount == null) {
      return '—';
    }

    const precision = selectedPayment.symbol === 'ETH' ? 6 : 2;
    return selectedPayment.symbol === 'ETH'
      ? `${selectedPaymentAmount.toFixed(precision)} ${selectedPayment.symbol}`
      : `${selectedPaymentAmount.toFixed(precision)} ${selectedPayment.symbol}`;
  }, [selectedPayment.symbol, selectedPaymentAmount]);

  const formattedUsd = useMemo(() => {
    if (!estimates.usd) {
      return '—';
    }
    return `$${estimates.usd.toFixed(estimates.usd >= 100 ? 2 : 4)}`;
  }, [estimates.usd]);

  const amountEntered = parsedAcesRequired > 0;
  const disableCurrencySelection = !isMainnet;
  const disablePrimaryAction = !isMainnet || !amountEntered;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg border border-[#D0B284]/30 bg-[#131b14] text-[#D0B284] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#F3E9C9]">
            Pay with Stablecoins or ETH
          </DialogTitle>
          <p className="mt-1 text-xs text-[#D0B284]/70">
            Preview the multi-step flow to swap into ACES and finish purchasing {tokenSymbol}.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#D0B284]/60">
              Current request
            </div>
            <div className="rounded-lg border border-[#D0B284]/20 bg-[#1a2318] p-4">
              <div className="flex items-center justify-between text-sm text-[#D0B284]/80">
                <span>Launchpad amount</span>
                <span className="font-semibold text-[#F3E9C9]">{launchpadAmount || '0'} {tokenSymbol}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#D0B284]/80">
                <span>ACES required (est.)</span>
                <span className="font-semibold text-[#F3E9C9]">
                  {parsedAcesRequired > 0 ? `${parsedAcesRequired.toFixed(4)} ACES` : '0 ACES'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#D0B284]/80">
                <span>USD equivalent</span>
                <span className="font-semibold text-[#F3E9C9]">
                  {formattedUsd}
                  {usdConversion?.isStale ? (
                    <span className="ml-1 text-xs text-[#D0B284]/50">(cached)</span>
                  ) : null}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#D0B284]/60">
              Choose payment asset
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_TOKENS.map((token) => {
                const isSelected = token.symbol === selectedPayment.symbol;
                return (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() => setSelectedPayment(token)}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-left text-sm transition-all duration-200',
                      isSelected
                        ? 'border-[#F3E9C9] bg-[#1c2a1f] text-[#F3E9C9] shadow-lg'
                        : 'border-[#D0B284]/20 bg-[#101611] text-[#D0B284]/80 hover:border-[#D0B284]/40',
                      disableCurrencySelection && 'cursor-not-allowed opacity-60',
                    )}
                    disabled={disableCurrencySelection}
                  >
                    <div className="font-semibold">{token.label}</div>
                    <div className="mt-1 text-xs text-[#D0B284]/60">
                      {token.type === 'native' ? 'No approval required for ETH' : 'Will request ERC-20 approval'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-[#D0B284]/20 bg-[#101611] p-4 text-sm">
              <div className="text-[#D0B284]/70">You will spend approximately:</div>
              <div className="mt-2 text-xl font-semibold text-[#F3E9C9]">{formattedPaymentValue}</div>
              {selectedPayment.symbol === 'ETH' && (
                <p className="mt-2 text-xs text-[#D0B284]/50">
                  Using placeholder ETH/USD price (${DEFAULT_ETH_PRICE}). Update once the price feed is wired.
                </p>
              )}
              {!amountEntered && (
                <p className="mt-2 text-xs text-[#D0B284]/50">
                  Enter a purchase amount on the main form to populate exact estimates.
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#D0B284]/60">
              Flow overview
            </div>
            <ol className="space-y-3 text-sm text-[#D0B284]/80">
              <li className="rounded-lg border border-[#D0B284]/20 bg-[#101611] p-3">
                <div className="font-semibold text-[#F3E9C9]">
                  {selectedPayment.type === 'erc20'
                    ? `Approve ${selectedPayment.symbol}`
                    : 'Confirm ETH swap routing'}
                </div>
                <p className="mt-1 text-xs text-[#D0B284]/60">
                  Allow the upcoming swap contract to spend your {selectedPayment.symbol}.
                </p>
                <StatusPill complete={approvalState.paymentTokenApproved} label="Pending" />
              </li>
              <li className="rounded-lg border border-[#D0B284]/20 bg-[#101611] p-3">
                <div className="font-semibold text-[#F3E9C9]">Swap into ACES</div>
                <p className="mt-1 text-xs text-[#D0B284]/60">
                  Route through Uniswap V3 (USDC/USDT) or wrap/unwrap WETH (ETH) to acquire ACES.
                </p>
                <StatusPill complete={approvalState.readyForSwap} label="Queued" />
              </li>
              <li className="rounded-lg border border-[#D0B284]/20 bg-[#101611] p-3">
                <div className="font-semibold text-[#F3E9C9]">Finalize Launchpad purchase</div>
                <p className="mt-1 text-xs text-[#D0B284]/60">
                  Call the factory contract with the ACES output to mint {tokenSymbol}.
                </p>
                <StatusPill complete={approvalState.acesApproved} label="Pending" />
              </li>
            </ol>
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#D0B284]/60">
              Slippage
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={slippageBps}
                onChange={(event) => setSlippageBps(event.target.value.replace(/[^0-9]/g, ''))}
                className="w-24 bg-[#101611] text-center text-sm font-semibold text-[#F3E9C9]"
                aria-label="Slippage basis points"
              />
              <span className="text-xs text-[#D0B284]/60">Basis points (e.g. 50 = 0.50%).</span>
            </div>
          </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!isMainnet ? (
                <p className="text-xs text-[#D66C5D]">
                  Switch to Base Mainnet to enable the multi-currency purchase flow.
                </p>
              ) : null}
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="w-full border border-[#D0B284]/30 text-[#D0B284] hover:bg-[#D0B284]/10 sm:w-auto"
                >
                  Close
                </Button>
                <Button
                disabled={disablePrimaryAction}
                  className="w-full bg-[#D0B284]/15 text-[#F3E9C9] hover:bg-[#D0B284]/25 sm:w-auto"
                >
                  Flow coming soon
                </Button>
              </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatusPillProps {
  complete: boolean;
  label: string;
}

function StatusPill({ complete, label }: StatusPillProps) {
  return (
    <span
      className={cn(
        'mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-wide',
        complete
          ? 'bg-[#184D37] text-[#C7F0D8]'
          : 'bg-[#2B1C1A] text-[#F4C9BC]',
      )}
    >
      {complete ? 'Ready' : label}
    </span>
  );
}

export default TokenSwapPaymentModal;
