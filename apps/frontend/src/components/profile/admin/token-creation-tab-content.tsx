'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminApi } from '@/lib/api/admin';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2, Pickaxe, CheckCircle, AlertCircle, Save, Send } from 'lucide-react';
import { TokenParameters } from '@aces/utils';
import { mineVanitySaltWithTimeout, type SaltMiningResult } from '@/lib/utils/salt-mining';

interface TokenCreationTabContentProps {
  listing: {
    id: string;
    title: string;
    symbol: string;
    tokenCreationStatus: string;
    tokenParameters: TokenParameters | null;
    ownerWalletAddress?: string; // The wallet address of the listing owner who will mint the token
  };
  onSuccess?: () => void;
}

export function TokenCreationTabContent({ listing, onSuccess }: TokenCreationTabContentProps) {
  const { getAccessToken } = useAuth();

  // Token creation form state
  const [tokenForm, setTokenForm] = useState<TokenParameters>({
    curve: 0,
    steepness: '100000000',
    floor: '0',
    tokensBondedAt: ethers.utils.parseEther('800000000').toString(),
    salt: '',
    chainId: 8453, // Base Mainnet
    name: listing.title,
    symbol: listing.symbol,
  });

  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState({
    attempts: 0,
    timeElapsed: 0,
    predictedAddress: '',
  });
  const [saltMiningResult, setSaltMiningResult] = useState<SaltMiningResult | null>(null);

  // Save/Submit state
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load existing parameters if available
  useEffect(() => {
    if (listing.tokenParameters) {
      setTokenForm({
        ...listing.tokenParameters,
        name: listing.title,
        symbol: listing.symbol,
      });
    }
  }, [listing]);

  // Begin salt mining for vanity address
  const handleBeginSaltMine = async () => {
    console.log('🎯 Beginning salt mining for listing:', listing.id);

    // For this to work, we need factory address and implementation
    // Since we don't have access to the contract hook here, we'll use hardcoded values
    const FACTORY_PROXY = '0x48dAf15626E3C36a0b06cB917ce82FCFF78FAd0e'; // Base Mainnet
    const TOKEN_IMPLEMENTATION = '0x0000000000000000000000000000000000000000'; // This should be fetched from factory

    try {
      setIsMining(true);
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      setSaltMiningResult(null);

      // CRITICAL: Use the listing owner's wallet address for salt mining
      // The factory contract uses msg.sender in the salt calculation, so the deployer address MUST match
      // If we mine with one address but mint with another, the vanity address will be different!
      const deployerAddress =
        listing.ownerWalletAddress || '0x0000000000000000000000000000000000000001';

      if (!listing.ownerWalletAddress) {
        alert(
          '⚠️ Warning: Listing owner wallet address not found. Vanity address prediction may be incorrect if minted by a different address.',
        );
      }

      const result = await mineVanitySaltWithTimeout(
        deployerAddress,
        tokenForm.name || listing.title,
        tokenForm.symbol || listing.symbol,
        FACTORY_PROXY,
        TOKEN_IMPLEMENTATION,
        {
          targetSuffix: 'ACE',
          maxAttempts: 200000,
          onProgress: (attempts, timeElapsed) => {
            setMiningProgress({ attempts, timeElapsed, predictedAddress: '' });
          },
        },
        300000, // 5 minute timeout
      );

      // Update form with mined salt AND predicted address
      setTokenForm((prev) => ({
        ...prev,
        salt: result.salt,
        predictedAddress: result.predictedAddress,
      }));

      setSaltMiningResult(result);

      alert(
        `🎯 Vanity address found!\n\n` +
          `Predicted Address: ${result.predictedAddress}\n` +
          `Attempts: ${result.attempts.toLocaleString()}\n` +
          `Time: ${(result.timeElapsed / 1000).toFixed(1)}s\n` +
          `Salt: ${result.salt}\n\n` +
          `Salt and predicted address have been added to the form!`,
      );
    } catch (error) {
      console.error('Salt mining failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Salt mining failed: ${errorMessage}`);
    } finally {
      setIsMining(false);
    }
  };

  // Save token parameters (doesn't change status)
  const handleSaveParameters = async () => {
    try {
      setIsSaving(true);
      setSaveResult(null);

      // Validate required fields
      if (!tokenForm.salt.trim()) {
        setSaveResult({
          type: 'error',
          message:
            'Please provide a salt value. You can enter one manually or use "Begin Salt Mine".',
        });
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setSaveResult({ type: 'error', message: 'Authentication required' });
        return;
      }

      const result = await AdminApi.saveTokenParameters(listing.id, tokenForm, token);

      if (result.success) {
        setSaveResult({
          type: 'success',
          message: 'Token parameters saved successfully!',
        });
        onSuccess?.();
      } else {
        setSaveResult({
          type: 'error',
          message: result.message || 'Failed to save token parameters',
        });
      }
    } catch (error) {
      console.error('Failed to save parameters:', error);
      setSaveResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare for minting (saves params + changes status + notifies user)
  const handlePrepareForMinting = async () => {
    const confirmed = confirm(
      `Are you sure you want to prepare this listing for minting?\n\n` +
        `This will AUTOMATICALLY:\n` +
        `1. Predict the token contract address (CREATE2)\n` +
        `2. Predict the Aerodrome pool address (paired with ACES)\n` +
        `3. Add the token to the database with predicted addresses\n` +
        `4. Change status to "Ready to Mint"\n` +
        `5. Send email and notification to the listing owner\n\n` +
        `The owner will then be able to mint the token from their profile.`,
    );

    if (!confirmed) return;

    try {
      setIsPreparing(true);
      setSaveResult(null);

      // Validate required fields
      if (!tokenForm.salt.trim()) {
        setSaveResult({
          type: 'error',
          message: 'Please provide a salt value before preparing for minting.',
        });
        setIsPreparing(false);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setSaveResult({ type: 'error', message: 'Authentication required' });
        setIsPreparing(false);
        return;
      }

      // First save parameters
      const saveResult = await AdminApi.saveTokenParameters(listing.id, tokenForm, token);
      if (!saveResult.success) {
        setSaveResult({
          type: 'error',
          message: saveResult.message || 'Failed to save token parameters',
        });
        return;
      }

      // Then prepare for minting (this will predict addresses and add to DB automatically)
      const prepareResult = await AdminApi.prepareForMinting(listing.id, token);

      if (prepareResult.success) {
        setSaveResult({
          type: 'success',
          message:
            '✅ Success! Token addresses predicted and added to database. User has been notified and can now mint the token.',
        });
        onSuccess?.();
      } else {
        setSaveResult({
          type: 'error',
          message: prepareResult.message || 'Failed to prepare for minting',
        });
      }
    } catch (error) {
      console.error('Failed to prepare for minting:', error);
      setSaveResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsPreparing(false);
    }
  };

  const isReadyToMint = listing.tokenCreationStatus === 'READY_TO_MINT';
  const isMinted = listing.tokenCreationStatus === 'MINTED';

  return (
    <div className="space-y-6">
      {/* Status Indicator */}
      <div className="p-4 border rounded-lg bg-purple-500/5 border-purple-400/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-purple-400 mb-1">Token Creation Status</h3>
            <p className="text-xs text-[#DCDDCC]">
              {listing.tokenCreationStatus === 'AWAITING_USER_DETAILS' &&
                'Waiting for user to finalize details'}
              {listing.tokenCreationStatus === 'PENDING_ADMIN_REVIEW' &&
                'Ready for admin configuration'}
              {listing.tokenCreationStatus === 'READY_TO_MINT' && 'User can now mint the token'}
              {listing.tokenCreationStatus === 'MINTED' && 'Token has been minted'}
            </p>
          </div>
          <div>
            {listing.tokenCreationStatus === 'PENDING_ADMIN_REVIEW' && (
              <CheckCircle className="w-6 h-6 text-blue-400" />
            )}
            {isReadyToMint && <CheckCircle className="w-6 h-6 text-green-400" />}
            {isMinted && <CheckCircle className="w-6 h-6 text-purple-400" />}
          </div>
        </div>
      </div>

      {isMinted && (
        <div className="p-4 bg-green-500/10 border border-green-400/20 rounded-lg">
          <p className="text-sm text-green-300">
            ✅ Token has been minted and the listing is now live!
          </p>
        </div>
      )}

      {!isMinted && (
        <>
          {/* Salt Mining Section */}
          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-400/20 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-purple-400 mb-1 flex items-center">
                  <Pickaxe className="w-4 h-4 mr-2" />
                  Vanity Address Mining
                </h3>
                <p className="text-xs text-[#DCDDCC]">
                  Mine a salt to create a token address ending in &quot;ACE&quot;
                </p>
              </div>
              <Button
                onClick={handleBeginSaltMine}
                disabled={isMining}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
              >
                {isMining ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mining...
                  </>
                ) : (
                  <>
                    <Pickaxe className="w-4 h-4 mr-2" />
                    Begin Salt Mine
                  </>
                )}
              </Button>
            </div>

            {saltMiningResult && (
              <div className="p-3 bg-green-500/10 border border-green-400/20 rounded-md">
                <p className="text-xs font-medium text-green-400 mb-1 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Vanity Address Found!
                </p>
                <p className="text-xs text-green-300 break-all font-mono">
                  <strong>Address:</strong> {saltMiningResult.predictedAddress}
                </p>
                <p className="text-xs text-green-300">
                  <strong>Attempts:</strong> {saltMiningResult.attempts.toLocaleString()} |
                  <strong> Time:</strong> {(saltMiningResult.timeElapsed / 1000).toFixed(1)}s
                </p>
              </div>
            )}

            {isMining && (
              <div className="mt-3 p-3 bg-purple-500/10 border border-purple-400/20 rounded">
                <div className="grid grid-cols-3 gap-4 text-xs text-[#DCDDCC]">
                  <div>
                    <span className="text-purple-400">Attempts:</span>{' '}
                    {miningProgress.attempts.toLocaleString()}
                  </div>
                  <div>
                    <span className="text-purple-400">Time:</span>{' '}
                    {(miningProgress.timeElapsed / 1000).toFixed(1)}s
                  </div>
                  <div>
                    <span className="text-purple-400">Rate:</span>{' '}
                    {miningProgress.timeElapsed > 0
                      ? (miningProgress.attempts / (miningProgress.timeElapsed / 1000)).toFixed(0)
                      : 0}{' '}
                    /sec
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Token Parameters Form */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white">Token Parameters</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#DCDDCC]">Token Name</Label>
                <Input
                  value={tokenForm.name}
                  onChange={(e) => setTokenForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={isMining}
                  className="bg-black border-purple-400/20 text-white"
                  readOnly
                />
                <p className="text-xs text-[#DCDDCC] mt-1">From listing details</p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Token Symbol</Label>
                <Input
                  value={tokenForm.symbol}
                  onChange={(e) => setTokenForm((p) => ({ ...p, symbol: e.target.value }))}
                  disabled={isMining}
                  className="bg-black border-purple-400/20 text-white"
                  readOnly
                />
                <p className="text-xs text-[#DCDDCC] mt-1">From listing details</p>
              </div>

              <div className="md:col-span-2">
                <Label className="text-[#DCDDCC]">Salt (unique identifier)</Label>
                <Input
                  type="text"
                  value={tokenForm.salt}
                  onChange={(e) => setTokenForm((prev) => ({ ...prev, salt: e.target.value }))}
                  className="bg-black border-purple-400/20 text-white font-mono"
                  placeholder="Enter unique salt or use 'Begin Salt Mine'"
                  disabled={isMining}
                />
                {saltMiningResult && (
                  <p className="text-xs text-green-400 mt-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Vanity salt has been applied!
                  </p>
                )}
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Curve Type</Label>
                <select
                  value={tokenForm.curve}
                  onChange={(e) =>
                    setTokenForm((prev) => ({ ...prev, curve: parseInt(e.target.value) }))
                  }
                  className="w-full bg-black border border-purple-400/20 text-white rounded-md px-3 py-2"
                  disabled={isMining}
                >
                  <option value={0}>Quadratic (faster price increase)</option>
                  <option value={1}>Linear (steady price increase)</option>
                </select>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Steepness</Label>
                <Input
                  type="text"
                  value={tokenForm.steepness}
                  onChange={(e) => setTokenForm((prev) => ({ ...prev, steepness: e.target.value }))}
                  className="bg-black border-purple-400/20 text-white"
                  placeholder="100000000"
                  disabled={isMining}
                />
                <p className="text-xs text-[#DCDDCC] mt-1">Higher = steeper price curve</p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Floor Price</Label>
                <Input
                  type="text"
                  value={tokenForm.floor}
                  onChange={(e) => setTokenForm((prev) => ({ ...prev, floor: e.target.value }))}
                  className="bg-black border-purple-400/20 text-white"
                  placeholder="0"
                  disabled={isMining}
                />
                <p className="text-xs text-[#DCDDCC] mt-1">Minimum price per token</p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Tokens Bonded At</Label>
                <Input
                  type="text"
                  value={ethers.utils.formatEther(tokenForm.tokensBondedAt)}
                  onChange={(e) => {
                    try {
                      const valueInWei = ethers.utils.parseEther(e.target.value || '0').toString();
                      setTokenForm((prev) => ({ ...prev, tokensBondedAt: valueInWei }));
                    } catch (err) {
                      // Invalid number, ignore
                    }
                  }}
                  className="bg-black border-purple-400/20 text-white"
                  placeholder="800000000"
                  disabled={isMining}
                />
                <p className="text-xs text-[#DCDDCC] mt-1">
                  Tokens to sell before bonding completes (e.g., 800M)
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSaveParameters}
              disabled={isSaving || isMining || isReadyToMint}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Parameters
                </>
              )}
            </Button>

            <Button
              onClick={handlePrepareForMinting}
              disabled={isPreparing || isMining || isReadyToMint}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Predicting Addresses & Adding to DB...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Prepare for Minting (Auto)
                </>
              )}
            </Button>
          </div>

          {/* Result Message */}
          {saveResult && (
            <div
              className={`p-4 rounded-lg border ${
                saveResult.type === 'success'
                  ? 'bg-green-500/10 border-green-400/20'
                  : 'bg-red-500/10 border-red-400/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {saveResult.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <p
                  className={`text-sm ${saveResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}
                >
                  {saveResult.message}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
