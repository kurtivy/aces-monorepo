'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Contract addresses
const CONTRACTS = {
  FACTORY_PROXY: '0xd484049526dF1325dEAc0D0DB67536b7431D8718',
};

// ABI for AcesFactory contract
const ACES_FACTORY_ABI = [
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination)',
  'function getPrice(address tokenAddress, uint256 amount, bool isBuy) view returns (uint256 price)',
  'function getBuyPrice(address tokenAddress, uint256 amount) view returns (uint256 price)',
];

// ABI for AcesLaunchpadToken
const LAUNCHPAD_TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

interface TokenParams {
  curve: number;
  floor: string;
  steepness: string;
  acesTokenBalance: string;
  subjectFeeDestination: string;
}

interface ContractState {
  tokenParams: TokenParams | null;
  currentSupply: string;
  loading: boolean;
  error: string | null;
}

export function useAcesFactoryContract(tokenAddress?: string) {
  const [contractState, setContractState] = useState<ContractState>({
    tokenParams: null,
    currentSupply: '0',
    loading: false,
    error: null,
  });

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);

  // Initialize provider and contract
  useEffect(() => {
    const initializeContract = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          const factory = new ethers.Contract(CONTRACTS.FACTORY_PROXY, ACES_FACTORY_ABI, provider);

          setProvider(provider);
          setFactoryContract(factory);
        } catch (error) {
          console.error('Failed to initialize contract:', error);
          setContractState((prev) => ({ ...prev, error: 'Failed to initialize contract' }));
        }
      }
    };

    initializeContract();
  }, []);

  // Fetch token parameters and current supply
  const fetchTokenData = useCallback(async () => {
    if (!factoryContract || !tokenAddress) {
      setContractState((prev) => ({ ...prev, loading: false }));
      return;
    }

    setContractState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Get token parameters from factory contract
      const tokenData = await factoryContract.tokens(tokenAddress);
      const tokenParams: TokenParams = {
        curve: tokenData.curve,
        floor: tokenData.floor.toString(),
        steepness: tokenData.steepness.toString(),
        acesTokenBalance: tokenData.acesTokenBalance.toString(),
        subjectFeeDestination: tokenData.subjectFeeDestination,
      };

      // Get current supply from token contract
      if (!provider) {
        throw new Error('Provider not initialized');
      }
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
      const totalSupply = await tokenContract.totalSupply();
      const currentSupply = ethers.utils.formatEther(totalSupply);

      setContractState({
        tokenParams,
        currentSupply,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to fetch token data:', error);
      setContractState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch token data',
      }));
    }
  }, [factoryContract, tokenAddress, provider]);

  // Calculate price at specific supply point
  const calculatePriceAtSupply = useCallback(
    async (supplyPoint: number): Promise<number> => {
      if (!factoryContract || !tokenAddress) return 0;

      try {
        // Convert supply point to wei (1 token = 1 ether in wei)
        const supplyWei = ethers.utils.parseEther(supplyPoint.toString());

        // Calculate price to buy 1 token at this supply point
        const priceWei = await factoryContract.getBuyPrice(
          tokenAddress,
          ethers.utils.parseEther('1'),
        );
        const priceInAces = parseFloat(ethers.utils.formatEther(priceWei));

        return priceInAces;
      } catch (error) {
        console.error('Failed to calculate price at supply:', error);
        return 0;
      }
    },
    [factoryContract, tokenAddress],
  );

  // Generate bonding curve data points
  const generateBondingCurveData = useCallback(async () => {
    if (!factoryContract || !tokenAddress) return [];

    const dataPoints = [];
    const supplyPoints = [
      0, 100000000, 200000000, 300000000, 400000000, 500000000, 600000000, 700000000, 800000000,
    ];

    for (const supplyPoint of supplyPoints) {
      try {
        const priceInAces = await calculatePriceAtSupply(supplyPoint);
        dataPoints.push({
          tokensSold: supplyPoint,
          priceACES: priceInAces,
          phase: supplyPoint <= parseFloat(contractState.currentSupply) ? 'completed' : 'upcoming',
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
  }, [factoryContract, tokenAddress, calculatePriceAtSupply, contractState.currentSupply]);

  // Fetch data when tokenAddress changes
  useEffect(() => {
    if (tokenAddress) {
      fetchTokenData();
    }
  }, [tokenAddress, fetchTokenData]);

  return {
    contractState,
    generateBondingCurveData,
    calculatePriceAtSupply,
    refreshData: fetchTokenData,
  };
}
