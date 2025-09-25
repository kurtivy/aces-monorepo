'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import { mineVanitySaltWithTimeout, type SaltMiningResult } from '@/lib/utils/salt-mining';

interface TokenInfo {
  curve: number;
  tokenAddress: string;
  floor: string;
  steepness: string;
  acesTokenBalance: string;
  subjectFeeDestination: string;
  tokensBondedAt: string;
  tokenBonded: boolean;
}

interface ContractState {
  tokenInfo: TokenInfo | null;
  currentSupply: string;
  loading: boolean;
  error: string | null;
}

interface CreateTokenParams {
  curve: number; // 0 = Quadratic, 1 = Linear
  steepness: string;
  floor: string;
  name: string;
  symbol: string;
  salt?: string; // Optional - will generate if not provided
  tokensBondedAt: string; // New parameter
  useVanityMining?: boolean;
}

export function useAcesFactoryContract(chainId: number = 11155111) {
  const [contractState, setContractState] = useState<ContractState>({
    tokenInfo: null,
    currentSupply: '0',
    loading: false,
    error: null,
  });

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [tokenImplementation, setTokenImplementation] = useState<string | null>(null);

  const contractAddresses = getContractAddresses(chainId);

  // Initialize provider and contracts
  useEffect(() => {
    const initializeContract = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const factory = new ethers.Contract(
            contractAddresses.FACTORY_PROXY, // Use proxy address
            ACES_FACTORY_ABI,
            signer,
          );

          setProvider(provider);
          setSigner(signer);
          setFactoryContract(factory);

          // Get the tokenImplementation address for vanity mining
          try {
            const implAddress = await factory.tokenImplementation();
            setTokenImplementation(implAddress);
            console.log('Token implementation address:', implAddress);
          } catch (error) {
            console.error('Failed to get token implementation address:', error);
          }
        } catch (error) {
          console.error('Failed to initialize factory contract:', error);
          setContractState((prev) => ({ ...prev, error: 'Failed to initialize contract' }));
        }
      }
    };

    initializeContract();
  }, [chainId, contractAddresses.FACTORY_PROXY]);

  // Fetch token information
  const fetchTokenInfo = useCallback(
    async (tokenAddress: string) => {
      if (!factoryContract || !provider) {
        return null;
      }

      setContractState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Get token info from factory
        const tokenData = await factoryContract.tokens(tokenAddress);
        const tokenInfo: TokenInfo = {
          curve: tokenData.curve,
          tokenAddress: tokenData.tokenAddress,
          floor: tokenData.floor.toString(),
          steepness: tokenData.steepness.toString(),
          acesTokenBalance: tokenData.acesTokenBalance.toString(),
          subjectFeeDestination: tokenData.subjectFeeDestination,
          tokensBondedAt: tokenData.tokensBondedAt.toString(),
          tokenBonded: tokenData.tokenBonded,
        };

        // Get current token supply
        const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
        const totalSupply = await tokenContract.totalSupply();
        const currentSupply = ethers.utils.formatEther(totalSupply);

        setContractState({
          tokenInfo,
          currentSupply,
          loading: false,
          error: null,
        });

        return { tokenInfo, currentSupply };
      } catch (error) {
        console.error('Failed to fetch token info:', error);
        setContractState((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch token information',
        }));
        return null;
      }
    },
    [factoryContract, provider],
  );

  // Calculate price at specific supply point
  const calculatePriceAtSupply = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (tokenAddress: string, _supplyPoint: number): Promise<number> => {
      if (!factoryContract) return 0;

      try {
        // TODO: Use supplyPoint for more advanced price calculations
        const amountWei = ethers.utils.parseEther('1'); // Price for 1 token

        const priceWei = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountWei);
        return parseFloat(ethers.utils.formatEther(priceWei));
      } catch (error) {
        console.error('Failed to calculate price at supply:', error);
        return 0;
      }
    },
    [factoryContract],
  );

  // Generate bonding curve data points based on tokensBondedAt
  const generateBondingCurveData = useCallback(
    async (tokenAddress: string) => {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      if (!tokenInfo) return [];

      const tokensBondedAt = parseFloat(tokenInfo.tokenInfo.tokensBondedAt);
      const currentSupply = parseFloat(tokenInfo.currentSupply);

      const dataPoints = [];
      const numPoints = 8; // 1/8 intervals

      for (let i = 1; i <= numPoints; i++) {
        const supplyPoint = Math.floor((tokensBondedAt / numPoints) * i);

        try {
          const priceInAces = await calculatePriceAtSupply(tokenAddress, supplyPoint);
          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: priceInAces,
            phase: supplyPoint <= currentSupply ? 'completed' : 'upcoming',
          });
        } catch (error) {
          console.error(`Failed to calculate price at ${supplyPoint}:`, error);
          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: 0,
            phase: 'upcoming',
          });
        }
      }

      return dataPoints;
    },
    [fetchTokenInfo, calculatePriceAtSupply],
  );

  // Create new token with improved salt mining
  const createToken = useCallback(
    async (
      params: CreateTokenParams,
      onMiningProgress?: (attempts: number, timeElapsed: number) => void,
    ): Promise<{
      success: boolean;
      tokenAddress?: string;
      error?: string;
      saltMiningResult?: SaltMiningResult;
    }> => {
      if (!factoryContract || !signer) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const userAddress = await signer.getAddress();
        let finalSalt: string;
        let saltMiningResult: SaltMiningResult | undefined;

        // Perform vanity mining if requested
        if (params.useVanityMining) {
          if (!tokenImplementation) {
            return {
              success: false,
              error: 'Token implementation not available for vanity mining',
            };
          }

          try {
            saltMiningResult = await mineVanitySaltWithTimeout(
              userAddress,
              params.name,
              params.symbol,
              contractAddresses.FACTORY_PROXY,
              tokenImplementation,
              {
                targetSuffix: 'ace',
                maxAttempts: 200000,
                onProgress: onMiningProgress,
              },
              300000, // 5 minute timeout
            );

            finalSalt = saltMiningResult.salt;
          } catch (miningError) {
            // If vanity mining fails, don't proceed with token creation
            return {
              success: false,
              error: `Vanity mining failed: ${miningError instanceof Error ? miningError.message : 'Unknown mining error'}`,
            };
          }
        } else {
          // Use provided salt or generate default one
          finalSalt = params.salt || `default-${Date.now()}-${Math.random()}`;
        }

        // Call the new createToken function with all 7 parameters
        const tx = await factoryContract.createToken(
          params.curve,
          params.steepness,
          params.floor,
          params.name,
          params.symbol,
          finalSalt,
          params.tokensBondedAt, // New parameter
        );

        const receipt = await tx.wait();

        // Extract token address from events
        const createEvent = receipt.logs.find((log: ethers.providers.Log) => {
          try {
            const parsed = factoryContract.interface.parseLog(log);
            return parsed?.name === 'CreatedToken';
          } catch {
            return false;
          }
        });

        if (createEvent) {
          const parsed = factoryContract.interface.parseLog(createEvent);
          const tokenAddress = parsed.args?.tokenAddress;

          return {
            success: true,
            tokenAddress,
            saltMiningResult,
          };
        }

        return { success: false, error: 'Token creation event not found' };
      } catch (error) {
        console.error('Token creation failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Token creation failed',
        };
      }
    },
    [factoryContract, signer, contractAddresses, tokenImplementation],
  );

  // Buy tokens function
  const buyTokens = useCallback(
    async (
      tokenAddress: string,
      amount: string,
      maxPrice: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!factoryContract) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const amountWei = ethers.utils.parseEther(amount);
        const maxPriceWei = ethers.utils.parseEther(maxPrice);

        const tx = await factoryContract.buyTokens(tokenAddress, amountWei, maxPriceWei);
        await tx.wait();

        return { success: true };
      } catch (error) {
        console.error('Buy tokens failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        };
      }
    },
    [factoryContract],
  );

  // Sell tokens function
  const sellTokens = useCallback(
    async (tokenAddress: string, amount: string): Promise<{ success: boolean; error?: string }> => {
      if (!factoryContract) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
        await tx.wait();

        return { success: true };
      } catch (error) {
        console.error('Sell tokens failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        };
      }
    },
    [factoryContract],
  );

  return {
    contractState,
    contractAddresses,
    fetchTokenInfo,
    generateBondingCurveData,
    calculatePriceAtSupply,
    createToken,
    buyTokens,
    sellTokens,
    // Utility
    isReady: !!factoryContract && !!signer && !!tokenImplementation,
    tokenImplementation,
  };
}
