'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

const DEFAULT_CHAIN_PRIORITY = [BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID];

const POLL_INTERVAL_MS = 60000;

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
  const isFetchingRef = useRef(false);
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
    if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Invalid token address',
      }));
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const candidateChainIds = chainId ? [chainId] : DEFAULT_CHAIN_PRIORITY;

      let lastError: unknown = null;

      for (const candidateChainId of candidateChainIds) {
        const rpcUrls = RPC_ENDPOINTS[candidateChainId];
        if (!rpcUrls || rpcUrls.length === 0) {
          console.warn(`⚠️ No RPC endpoints configured for chain ${candidateChainId}`);
          continue;
        }

        const chainName = CHAIN_NAMES[candidateChainId] || `chain ${candidateChainId}`;
        const { FACTORY_PROXY } = getContractAddresses(candidateChainId);

        if (!FACTORY_PROXY) {
          console.warn(`⚠️ Factory proxy not configured for ${chainName}. Skipping.`);
          continue;
        }

        for (const rpcUrl of rpcUrls) {
          try {
            const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, candidateChainId);
            const factoryContract = new ethers.Contract(FACTORY_PROXY, FACTORY_ABI, provider);
            const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

            const [tokenData, totalSupply] = await Promise.all([
              factoryContract.tokens(tokenAddress),
              tokenContract.totalSupply(),
            ]);

            const curve = tokenData.curve;
            const currentSupply = ethers.utils.formatEther(totalSupply);
            const tokensBondedAt = ethers.utils.formatEther(tokenData.tokensBondedAt);
            const acesBalance = ethers.utils.formatEther(tokenData.acesTokenBalance);
            const floorWei = tokenData.floor.toString();
            const floorPriceACES = ethers.utils.formatEther(tokenData.floor);
            const steepness = tokenData.steepness.toString();
            const isBonded = tokenData.tokenBonded;

            const currentSupplyNum = parseFloat(currentSupply);
            const tokensBondedAtNum = parseFloat(tokensBondedAt);
            const bondingPercentage = isBonded
              ? 100
              : tokensBondedAtNum > 0
                ? Math.min(100, (currentSupplyNum / tokensBondedAtNum) * 100)
                : 0;

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
            console.warn(`⚠️ RPC fetch failed for ${rpcUrl} (${chainName}):`, rpcError);
          }
        }
      }

      console.error('❌ Failed to fetch bonding data:', lastError);
      setData((prev) => ({
        ...prev,
        loading: false,
        error:
          lastError instanceof Error
            ? lastError.message
            : `Failed to fetch data for ${tokenAddress}`,
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [tokenAddress, chainId]);

  useEffect(() => {
    fetchBondingData();

    // Refresh at a slower cadence so we do not hammer public RPCs
    const interval = setInterval(fetchBondingData, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchBondingData]);

  return data;
}
