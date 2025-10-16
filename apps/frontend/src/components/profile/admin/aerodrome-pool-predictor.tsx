'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminApi } from '@/lib/api/admin';
import { Loader2, Droplet, CheckCircle, AlertCircle } from 'lucide-react';

// Constants
const ACES_TOKEN_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367';
const V2_FACTORY_ADDRESS = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
const STABLE = false; // Volatile AMM

// Minimal ABI for V2 Factory implementation() function
const V2_FACTORY_ABI = [
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Predicts the deterministic address using CREATE2
 * Matches OpenZeppelin's Clones.predictDeterministicAddress
 */
function predictDeterministicAddress(
  implementation: string,
  salt: string,
  deployer: string,
): string {
  // CREATE2 address formula:
  // keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code))[12:]

  // EIP-1167 Minimal Proxy bytecode with implementation address
  const implementationAddress = implementation.toLowerCase().replace('0x', '');

  // EIP-1167 bytecode: 363d3d373d3d3d363d73[implementation]5af43d82803e903d91602b57fd5bf3
  const initCode =
    '0x3d602d80600a3d3981f3363d3d373d3d3d363d73' +
    implementationAddress +
    '5af43d82803e903d91602b57fd5bf3';

  const initCodeHash = ethers.utils.keccak256(initCode);

  // Compute CREATE2 address
  const create2Input = ethers.utils.solidityPack(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash],
  );

  const hash = ethers.utils.keccak256(create2Input);

  // Take last 20 bytes (40 hex chars) for address
  return ethers.utils.getAddress('0x' + hash.slice(-40));
}

/**
 * Predicts the V2 pool address for a token pair
 */
function predictV2PoolAddress(
  tokenA: string,
  tokenB: string,
  stable: boolean,
  v2Factory: string,
  implementation: string,
): string {
  // Sort tokens (same as Solidity: tokenA < tokenB)
  const [token0, token1] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

  // Create salt: keccak256(abi.encodePacked(token0, token1, stable))
  const salt = ethers.utils.keccak256(
    ethers.utils.solidityPack(['address', 'address', 'bool'], [token0, token1, stable]),
  );

  // Predict deterministic clone address
  return predictDeterministicAddress(implementation, salt, v2Factory);
}

export function AerodromePoolPredictor() {
  const { getAccessToken } = useAuth();

  const [tokenAddress, setTokenAddress] = useState<string>('');
  const [predictedPoolAddress, setPredictedPoolAddress] = useState<string>('');
  const [poolImplementation, setPoolImplementation] = useState<string>('');
  const [loading, setLoading] = useState<string>('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Fetch pool implementation address on mount
  useEffect(() => {
    async function fetchPoolImplementation() {
      try {
        // Use a public RPC provider for Base Mainnet
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        const factory = new ethers.Contract(V2_FACTORY_ADDRESS, V2_FACTORY_ABI, provider);

        const impl = await factory.implementation();
        setPoolImplementation(impl);
        console.log('✅ Pool implementation address loaded:', impl);
      } catch (error) {
        console.error('❌ Failed to load pool implementation:', error);
      }
    }

    fetchPoolImplementation();
  }, []);

  // Predict pool address
  const handlePredictPoolAddress = async () => {
    if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
      setResultMessage('❌ Please enter a valid token contract address');
      return;
    }

    if (!poolImplementation) {
      setResultMessage('❌ Pool implementation not loaded. Please try again.');
      return;
    }

    try {
      setLoading('Predicting pool address...');
      setResultMessage(null);

      const poolAddress = predictV2PoolAddress(
        tokenAddress,
        ACES_TOKEN_ADDRESS,
        STABLE,
        V2_FACTORY_ADDRESS,
        poolImplementation,
      );

      setPredictedPoolAddress(poolAddress);
      setResultMessage(`✅ Pool address predicted: ${poolAddress}`);
      setLoading('');
    } catch (error) {
      console.error('Error predicting pool address:', error);
      setResultMessage(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      );
      setLoading('');
    }
  };

  // Update pool address in database
  const handleUpdatePoolAddress = async () => {
    if (!predictedPoolAddress || !ethers.utils.isAddress(predictedPoolAddress)) {
      setResultMessage('❌ No valid pool address to update. Please predict the address first.');
      return;
    }

    if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
      setResultMessage('❌ Invalid token address');
      return;
    }

    try {
      setLoading('Updating database...');
      setResultMessage(null);

      const token = await getAccessToken();
      if (!token) {
        setResultMessage('❌ Not authenticated. Please sign in again.');
        setLoading('');
        return;
      }

      console.log('🔵 Updating pool address:', {
        tokenAddress,
        predictedPoolAddress,
        hasToken: !!token,
      });

      const result = await AdminApi.updateTokenPoolAddress(
        tokenAddress,
        predictedPoolAddress,
        token,
      );

      console.log('✅ Pool address update result:', result);

      if (result.success) {
        setResultMessage(`✅ ${result.message}`);
        // Clear form after successful update
        setTokenAddress('');
        setPredictedPoolAddress('');
      } else {
        setResultMessage(`❌ Error: ${result.message || 'Failed to update pool address'}`);
      }

      setLoading('');
    } catch (error) {
      console.error('❌ Error updating pool address:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      setResultMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading('');
    }
  };

  return (
    <Card className="bg-black border-blue-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <Droplet className="w-5 h-5 mr-2 text-blue-400" />
          Aerodrome Pool Address Predictor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <p className="text-sm text-blue-300 mb-2">
            <strong>🔵 Aerodrome Integration:</strong> Predict the V2 pool address for your token
            paired with ACES
          </p>
          <p className="text-xs text-blue-200/70">
            This predicts the pool address for: <strong>Token / ACES (vAMM)</strong>
          </p>
          <p className="text-xs text-blue-200/70 mt-1">ACES Token: {ACES_TOKEN_ADDRESS}</p>
          <p className="text-xs text-blue-200/70">Factory: {V2_FACTORY_ADDRESS}</p>
          {poolImplementation && (
            <p className="text-xs text-green-300 mt-2 flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" />
              Pool Implementation: {poolImplementation}
            </p>
          )}
          {!poolImplementation && (
            <p className="text-xs text-yellow-400 mt-2 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              Loading pool implementation...
            </p>
          )}
        </div>

        <div>
          <Label className="text-[#DCDDCC]">Token Contract Address</Label>
          <Input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x..."
            className="bg-black border-blue-400/20 text-white font-mono"
            disabled={!!loading}
          />
          <p className="text-xs text-[#DCDDCC] mt-1">
            Enter the contract address of your newly created token
          </p>
        </div>

        <Button
          onClick={handlePredictPoolAddress}
          disabled={!!loading || !tokenAddress || !poolImplementation}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading === 'Predicting pool address...' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Predicting...
            </>
          ) : (
            <>
              <Droplet className="w-4 h-4 mr-2" />
              Predict Pool Address
            </>
          )}
        </Button>

        {predictedPoolAddress && (
          <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded">
            <Label className="text-blue-300 text-sm">Predicted Pool Address</Label>
            <p className="text-white font-mono text-sm break-all mt-1">{predictedPoolAddress}</p>
          </div>
        )}

        {predictedPoolAddress && (
          <Button
            onClick={handleUpdatePoolAddress}
            disabled={!!loading || !predictedPoolAddress}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {loading === 'Updating database...' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating Database...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Update Pool Address in Database
              </>
            )}
          </Button>
        )}

        {resultMessage && (
          <div
            className={`p-3 rounded-lg border ${
              resultMessage.startsWith('✅')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
            }`}
          >
            {resultMessage}
          </div>
        )}

        {loading && !resultMessage && (
          <div className="flex items-center space-x-2 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-jetbrains text-sm">{loading}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
