'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Settings } from 'lucide-react';
import { useTokenLaunch } from '../context';

export function TestAerodromeLockerCard() {
  const {
    effectiveWalletAddress,
    configCheckResult,
    configCheckLoading,
    handleVerifyAerodromeContracts,
    lockerInspectAddress,
    setLockerInspectAddress,
    lockerInspectResult,
    setLockerInspectResult,
    lockerInspectError,
    setLockerInspectError,
    lockerInspectLoading,
    handleInspectLocker,
    wagmiProvider,
  } = useTokenLaunch();

  if (!effectiveWalletAddress) return null;

  return (
    <Card className="bg-black border-amber-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <Settings className="w-5 h-5 mr-2 text-amber-400" />
          Test Aerodrome & Locker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-amber-500/10 border border-amber-400/20 rounded-lg">
          <p className="text-sm text-amber-300 mb-2">
            Verify configured Aerodrome contracts have code on-chain, and inspect any Locker address
            (owner, lock end, bribeable share, beneficiary).
          </p>
        </div>

        <div>
          <Label className="text-[#DCDDCC]">1. Verify contracts</Label>
          <Button
            onClick={handleVerifyAerodromeContracts}
            disabled={configCheckLoading || !wagmiProvider}
            variant="outline"
            className="mt-2 border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
          >
            {configCheckLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              'Run config check'
            )}
          </Button>
          {configCheckResult && (
            <div className="mt-3 p-3 rounded-lg bg-black/50 border border-amber-400/20 text-sm font-mono space-y-1">
              <div
                className={configCheckResult.v2Factory.hasCode ? 'text-green-400' : 'text-red-400'}
              >
                V2 Factory: {configCheckResult.v2Factory.address.slice(0, 10)}... —{' '}
                {configCheckResult.v2Factory.hasCode ? 'OK' : 'No code'}
              </div>
              <div
                className={configCheckResult.clFactory.hasCode ? 'text-green-400' : 'text-red-400'}
              >
                CL Factory: {configCheckResult.clFactory.address.slice(0, 10)}... —{' '}
                {configCheckResult.clFactory.hasCode ? 'OK' : 'No code'}
              </div>
              <div
                className={
                  configCheckResult.factoryRegistry.hasCode ? 'text-green-400' : 'text-red-400'
                }
              >
                Factory Registry: {configCheckResult.factoryRegistry.address.slice(0, 10)}... —{' '}
                {configCheckResult.factoryRegistry.hasCode ? 'OK' : 'No code'}
              </div>
              <div
                className={
                  configCheckResult.clPoolLauncher.hasCode ? 'text-green-400' : 'text-amber-400'
                }
              >
                CL Pool Launcher: {configCheckResult.clPoolLauncher.address.slice(0, 10)}... —{' '}
                {configCheckResult.clPoolLauncher.hasCode
                  ? 'OK'
                  : 'Not set / no code (needed for launch)'}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label className="text-[#DCDDCC]">2. Inspect Locker</Label>
          <p className="text-xs text-[#DCDDCC] mt-1 mb-2">
            Paste a Locker contract address (e.g. after a launch) to read owner, lock end, bribeable
            share, beneficiary.
          </p>
          <div className="flex gap-2">
            <Input
              value={lockerInspectAddress}
              onChange={(e) => {
                setLockerInspectAddress(e.target.value);
                setLockerInspectResult(null);
                setLockerInspectError(null);
              }}
              className="bg-black border-amber-400/20 text-white font-mono flex-1"
              placeholder="0x..."
            />
            <Button
              onClick={handleInspectLocker}
              disabled={lockerInspectLoading || !wagmiProvider}
              variant="outline"
              className="border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
            >
              {lockerInspectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inspect'}
            </Button>
          </div>
          {lockerInspectError && <p className="mt-2 text-sm text-red-400">{lockerInspectError}</p>}
          {lockerInspectResult && (
            <div className="mt-3 p-3 rounded-lg bg-black/50 border border-amber-400/20 text-sm font-mono space-y-1">
              <div>Owner: {lockerInspectResult.owner}</div>
              <div>
                Locked until:{' '}
                {lockerInspectResult.lockedUntilDate || lockerInspectResult.lockedUntil}
              </div>
              <div>Bribeable share: {lockerInspectResult.bribeableShare} bps</div>
              <div>Beneficiary: {lockerInspectResult.beneficiary || '(none)'}</div>
              <div>Beneficiary share: {lockerInspectResult.beneficiaryShare} bps</div>
              <div className="text-amber-300">
                Is locked: {lockerInspectResult.isLocked ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
