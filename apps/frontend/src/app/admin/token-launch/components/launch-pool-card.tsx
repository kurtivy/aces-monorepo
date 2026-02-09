'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { useTokenLaunch } from '../context';

export function LaunchPoolCard() {
  const {
    effectiveWalletAddress,
    poolForm,
    setPoolForm,
    handleCreatePool,
    poolLoading,
    poolResult,
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
            Pair any two tokens, add liquidity, set trading fee tier, lock duration, and fee
            beneficiaries.
          </p>
          <p className="text-xs text-cyan-200/70">
            Creates a concentrated liquidity pool on Aerodrome (SlipStream). Optionally lock LP and
            assign beneficiary share and bribeable share.
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
            <Label className="text-[#DCDDCC]">Trading fee tier (tick spacing)</Label>
            <select
              value={poolForm.tickSpacing}
              onChange={(e) => setPoolForm((p) => ({ ...p, tickSpacing: e.target.value }))}
              className="w-full bg-black border border-cyan-400/20 text-white rounded-md px-3 py-2"
            >
              <option value="1">1 — 0.01%</option>
              <option value="10">10 — 0.05%</option>
              <option value="60">60 — 0.3%</option>
              <option value="200">200 — 1%</option>
            </select>
            <p className="text-xs text-[#DCDDCC] mt-1">Determines pool fee tier.</p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Lock duration (days)</Label>
            <Input
              type="number"
              min={0}
              value={poolForm.lockDuration}
              onChange={(e) => setPoolForm((p) => ({ ...p, lockDuration: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white"
              placeholder="0 = no lock, 30 = 30 days"
              disabled={poolForm.permanentLock}
            />
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#DCDDCC]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={poolForm.permanentLock}
                  onChange={(e) => setPoolForm((p) => ({ ...p, permanentLock: e.target.checked }))}
                />
                Permanent lock
              </label>
              <span>0 = no lock (unlocked LP)</span>
            </div>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Beneficiary (fee recipient)</Label>
            <Input
              value={poolForm.beneficiary}
              onChange={(e) => setPoolForm((p) => ({ ...p, beneficiary: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white font-mono"
              placeholder="0x... (optional)"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              Optional. Set at lock creation; many launchers hardcode 0.
            </p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Beneficiary share (bps, 0–10000)</Label>
            <Input
              type="number"
              min={0}
              max={10000}
              value={poolForm.beneficiaryShare}
              onChange={(e) => setPoolForm((p) => ({ ...p, beneficiaryShare: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white"
              placeholder="0"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">% of fees to beneficiary (e.g. 500 = 5%).</p>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Bribeable share (bps, 0–10000)</Label>
            <Input
              type="number"
              min={0}
              max={10000}
              value={poolForm.bribeableShare}
              onChange={(e) => setPoolForm((p) => ({ ...p, bribeableShare: e.target.value }))}
              className="bg-black border-cyan-400/20 text-white"
              placeholder="500"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">
              % of fees that can be bribed (e.g. 500 = 5%). Set on locker after launch if launcher
              hardcodes it.
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

        <Button
          onClick={handleCreatePool}
          disabled={
            poolLoading ||
            !poolForm.tokenAddress?.trim() ||
            !(poolForm.platformTokenAddress?.trim() || contractAddresses.ACES_TOKEN) ||
            !poolForm.tokenAmount ||
            !poolForm.platformTokenAmount
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
