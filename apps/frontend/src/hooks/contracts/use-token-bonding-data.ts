'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

const CHAIN_NAMES: Record<number, string> = {
  [BASE_SEPOLIA_CHAIN_ID]: 'Base Sepolia',
  [BASE_MAINNET_CHAIN_ID]: 'Base Mainnet',
};

const RPC_ENDPOINTS: Record<number, string[]> = {
  [BASE_SEPOLIA_CHAIN_ID]: [
    'https://sepolia.base.org',
    'https://base-sepolia-rpc.publicnode.com',
    'https://base-sepolia.blockpi.network/v1/rpc/public',
    'https://base-sepolia.gateway.tenderly.co',
  ],
  [BASE_MAINNET_CHAIN_ID]: [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.blockpi.network/v1/rpc/public',
    'https://base.gateway.tenderly.co',
  ],
};

// Simplified ABI - only what we need
const FACTORY_ABI = [
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = ['function totalSupply() view returns (uint256)'];

interface BondingData {
  // Raw contract data
  curve: number;
  currentSupply: string; // In ether (e.g., "22320.83")
  tokensBondedAt: string; // In ether (e.g., "30000000")
  acesBalance: string; // In ether
  floorWei: string;
  floorPriceACES: string;
  steepness: string;
  isBonded: boolean;

  // Calculated values
  bondingPercentage: number; // 0-100

  // Loading state
  loading: boolean;
  error: string | null;
}

/**
 * Simple, single-purpose hook for fetching token bonding data
 * Defaults to Base Sepolia but supports Base Mainnet via the optional chainId
 */
export function useTokenBondingData(
  tokenAddress: string | undefined,
  chainId?: number,
): BondingData {
  const [data, setData] = useState<BondingData>({
    curve: 0,
    currentSupply: '0',
    tokensBondedAt: '30000000', // Default fallback
    acesBalance: '0',
    floorWei: '0',
    floorPriceACES: '0',
    steepness: '0',
    isBonded: false,
    bondingPercentage: 0,
    loading: true,
    error: null,
  });

  const fetchBondingData = useCallback(async () => {
    const activeChainId = chainId ?? BASE_SEPOLIA_CHAIN_ID;

    if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Invalid token address',
      }));
      return;
    }

    const rpcUrls = RPC_ENDPOINTS[activeChainId] ?? RPC_ENDPOINTS[BASE_SEPOLIA_CHAIN_ID];
    const chainName = CHAIN_NAMES[activeChainId] || `chain ${activeChainId}`;
    const { FACTORY_PROXY } = getContractAddresses(activeChainId);

    if (!FACTORY_PROXY) {
      console.error(`❌ Factory proxy not configured for ${chainName}.`);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: `Factory proxy not configured for ${chainName}.`,
      }));
      return;
    }

    console.log(`🔄 Fetching bonding data for ${tokenAddress} on ${chainName}`);

    try {
      let lastError: unknown = null;

      for (const rpcUrl of rpcUrls) {
        try {
          // StaticJsonRpcProvider caches network metadata and avoids redundant requests
          const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, activeChainId);

          // Create contract instances
          const factoryContract = new ethers.Contract(FACTORY_PROXY, FACTORY_ABI, provider);
          const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

          // Fetch data in parallel
          const [tokenData, totalSupply] = await Promise.all([
            factoryContract.tokens(tokenAddress),
            tokenContract.totalSupply(),
          ]);

          console.log('✅ Raw contract data:', {
            tokenData,
            totalSupply: totalSupply.toString(),
            rpcUrl,
          });

          // Parse data
          const curve = tokenData.curve;
          const currentSupply = ethers.utils.formatEther(totalSupply);
          const tokensBondedAt = ethers.utils.formatEther(tokenData.tokensBondedAt);
          const acesBalance = ethers.utils.formatEther(tokenData.acesTokenBalance);
          const floorWei = tokenData.floor.toString();
          const floorPriceACES = ethers.utils.formatEther(tokenData.floor);
          const steepness = tokenData.steepness.toString();
          const isBonded = tokenData.tokenBonded;

          // Calculate bonding percentage
          // This is based on current supply vs tokensBondedAt threshold
          const currentSupplyNum = parseFloat(currentSupply);
          const tokensBondedAtNum = parseFloat(tokensBondedAt);
          const bondingPercentage = isBonded
            ? 100
            : tokensBondedAtNum > 0
              ? Math.min(100, (currentSupplyNum / tokensBondedAtNum) * 100)
              : 0;

          console.log('✅ Parsed bonding data:', {
            curve,
            currentSupply,
            tokensBondedAt,
            acesBalance,
            isBonded,
            bondingPercentage: bondingPercentage.toFixed(2) + '%',
            rpcUrl,
          });

          setData({
            curve,
            currentSupply,
            tokensBondedAt,
            acesBalance,
            floorWei,
            floorPriceACES,
            steepness,
            isBonded,
            bondingPercentage,
            loading: false,
            error: null,
          });

          return;
        } catch (rpcError) {
          lastError = rpcError;
          console.warn(`⚠️ RPC fetch failed for ${rpcUrl}:`, rpcError);
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error(`Failed to fetch bonding data for ${tokenAddress}`);
    } catch (error) {
      console.error('❌ Failed to fetch bonding data:', error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : `Failed to fetch data for ${tokenAddress} on ${chainName}`,
      }));
    }
  }, [tokenAddress, chainId]);

  useEffect(() => {
    fetchBondingData();

    // Refresh every 10 seconds
    const interval = setInterval(fetchBondingData, 10000);

    return () => clearInterval(interval);
  }, [fetchBondingData]);

  return data;
}
