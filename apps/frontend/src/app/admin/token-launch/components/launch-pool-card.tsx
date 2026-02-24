'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTokenLaunch } from '../context';
import { ethers } from 'ethers';

export function LaunchPoolCard() {
  const {
    effectiveWalletAddress,
    poolForm,
    setPoolForm,
    handleCreatePool,
    poolLoading,
    poolResult,
    poolPreflight,
    poolPreflightLoading,
    contractAddresses,
    createdTokens,
  } = useTokenLaunch();

  if (!effectiveWalletAddress) return null;

  return (
    <Card className="bg-black border-cyan-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <Lock className="w-5 h-5 mr-2 text-cyan-400" />
          Launch Pool (Aerodrome CL)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-lg">
          <p className="text-sm text-cyan-300 mb-2">
            Pair your token with ACES. Creates a concentrated liquidity pool on Aerodrome
            (SlipStream) with fixed settings.
          </p>
          <p className="text-xs text-cyan-200/70">
            Pool fee: 2%. Lock: 60 days. The current Aerodrome launcher hardcodes beneficiary to
            zero; your entry below is stored for future use if the launcher supports it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[#DCDDCC]">Token A (first token) *</Label>
            {createdTokens.length > 0 && (
              <select
                value={
                  createdTokens.some((t) => t.address === poolForm.tokenAddress)
                    ? poolForm.tokenAddress
                    : ''
                }
                onChange={(e) =>
                  setPoolForm((p) => ({
                    ...p,
                    tokenAddress: e.target.value || p.tokenAddress,
                  }))
                }
                className="w-full bg-black border border-cyan-400/20 text-white rounded-md px-3 py-2 mb-1"
              >
                <option value="">— Or pick from your tokens —</option>
                {createdTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </option>
                ))}
              </select>
            )}
            <Input
              value={poolForm.tokenAddress}
              onChange={(e) => setPoolForm((p) => ({ ...p, tokenAddress: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white font-mono"
              placeholder="0x... token address"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Token B (second token) *</Label>
            <Input
              value={poolForm.platformTokenAddress || contractAddresses.ACES_TOKEN}
              onChange={(e) => setPoolForm((p) => ({ ...p, platformTokenAddress: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white font-mono"
              placeholder="0x... or ACES"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              Default: ACES ({contractAddresses.ACES_TOKEN?.slice(0, 10)}...)
            </p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Beneficiary (fee recipient, optional)</Label>
            <Input
              value={poolForm.beneficiary}
              onChange={(e) => setPoolForm((p) => ({ ...p, beneficiary: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white font-mono"
              placeholder="0x... (saved for when launcher supports it)"
            />
            <p className="text-xs text-amber-200/80 mt-1">
              Not applied on-chain yet: the deployed Aerodrome CL launcher hardcodes beneficiary to
              zero. Your address is stored in the form for when a launcher supports it.
            </p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Token A amount (initial liquidity) *</Label>
            <Input
              type="text"
              value={poolForm.tokenAmount}
              onChange={(e) => setPoolForm((p) => ({ ...p, tokenAmount: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white"
              placeholder="e.g. 10000000"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              Whole tokens (18 decimals). 10000 = 10,000 tokens on-chain.
            </p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Token B amount (initial liquidity) *</Label>
            <Input
              type="text"
              value={poolForm.platformTokenAmount}
              onChange={(e) => setPoolForm((p) => ({ ...p, platformTokenAmount: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white"
              placeholder="e.g. 1000"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              Whole tokens (18 decimals). 10000 = 10,000 tokens on-chain.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-[#DCDDCC]">
          <input
            type="checkbox"
            checked={poolForm.skipSimulation ?? false}
            onChange={(e) => setPoolForm((p) => ({ ...p, skipSimulation: e.target.checked }))}
            className="rounded border-cyan-400/40"
          />
          <span>
            Skip simulation (send tx anyway – use if simulation fails with no reason; inspect result
            on Basescan)
          </span>
        </label>

        {poolPreflightLoading && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-400/20 rounded-lg flex items-center gap-2 text-sm text-cyan-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking balances and allowances...
          </div>
        )}
        {poolPreflight && !poolPreflightLoading && (
          <div
            className={`p-4 rounded-lg border ${
              poolPreflight.balanceOk
                ? poolPreflight.allowanceOk
                  ? 'bg-green-500/10 border-green-400/20'
                  : 'bg-amber-500/10 border-amber-400/20'
                : 'bg-red-500/10 border-red-400/20'
            }`}
          >
            <p className="text-sm font-medium text-[#DCDDCC] mb-2">Preflight check</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#DCDDCC]">Token A:</span>{' '}
                {poolPreflight.balanceA && poolPreflight.amountA && (
                  <>
                    balance {ethers.utils.formatEther(poolPreflight.balanceA)} (need{' '}
                    {ethers.utils.formatEther(poolPreflight.amountA)})
                    {ethers.BigNumber.from(poolPreflight.balanceA).gte(
                      ethers.BigNumber.from(poolPreflight.amountA),
                    ) ? (
                      <CheckCircle className="w-3.5 h-3.5 inline text-green-400 ml-1" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 inline text-red-400 ml-1" />
                    )}
                    {' · '}
                    allowance {ethers.utils.formatEther(poolPreflight.allowanceA)}
                    {ethers.BigNumber.from(poolPreflight.allowanceA).gte(
                      ethers.BigNumber.from(poolPreflight.amountA),
                    ) ? (
                      <CheckCircle className="w-3.5 h-3.5 inline text-green-400 ml-1" />
                    ) : (
                      <span className="text-amber-400 ml-1">
                        (we’ll request approval on Launch)
                      </span>
                    )}
                  </>
                )}
              </div>
              <div>
                <span className="text-[#DCDDCC]">Token B:</span>{' '}
                {poolPreflight.balanceB && poolPreflight.amountB && (
                  <>
                    balance {ethers.utils.formatEther(poolPreflight.balanceB)} (need{' '}
                    {ethers.utils.formatEther(poolPreflight.amountB)})
                    {ethers.BigNumber.from(poolPreflight.balanceB).gte(
                      ethers.BigNumber.from(poolPreflight.amountB),
                    ) ? (
                      <CheckCircle className="w-3.5 h-3.5 inline text-green-400 ml-1" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 inline text-red-400 ml-1" />
                    )}
                    {' · '}
                    allowance {ethers.utils.formatEther(poolPreflight.allowanceB)}
                    {ethers.BigNumber.from(poolPreflight.allowanceB).gte(
                      ethers.BigNumber.from(poolPreflight.amountB),
                    ) ? (
                      <CheckCircle className="w-3.5 h-3.5 inline text-green-400 ml-1" />
                    ) : (
                      <span className="text-amber-400 ml-1">
                        (we’ll request approval on Launch)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {poolPreflight.messages.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-200">
                {poolPreflight.messages.map((msg, i) => (
                  <li key={i}>• {msg}</li>
                ))}
              </ul>
            )}
            {!poolPreflight.balanceOk && (
              <p className="mt-2 text-xs text-red-300">
                Add more tokens to your wallet before launching. Launch is disabled until balances
                are sufficient.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleCreatePool}
          disabled={
            poolLoading ||
            !poolForm.tokenAddress?.trim() ||
            !(poolForm.platformTokenAddress?.trim() || contractAddresses.ACES_TOKEN) ||
            !poolForm.tokenAmount ||
            !poolForm.platformTokenAmount ||
            (poolPreflight != null && !poolPreflight.balanceOk)
          }
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          {poolLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Launching pool...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Launch Pool
            </>
          )}
        </Button>

        {poolResult && (
          <div
            className={`p-3 rounded-lg border ${
              poolResult.startsWith('✅')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
            }`}
          >
            {poolResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
