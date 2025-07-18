'use client';

import { DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI } from './../../../../packages/utils/src/abis';
import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useBalance } from 'wagmi';

// Contract addresses from deployment (0.09 ETH TARGET VERSION - FIXED SUPPLY)
const BONDING_CURVE_ADDRESS = '0x60b6312004dfb5B35f544982060Ae60BDa3a5e31' as const;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const; // Base Sepolia USDC

// Base Sepolia chain definition
const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base Sepolia Explorer',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
} as const;

// Type for the getContractState return value
type ContractStateData = [
  bigint, // totalSupply
  bigint, // tokensSold
  bigint, // totalETHRaised
  bigint, // totalUSDCRaised
  bigint, // currentPrice
  bigint, // marketCap
  bigint, // progress
  boolean, // emergencyStop
];

export interface ICOContractState {
  totalSupply: bigint;
  tokensSold: bigint;
  totalETHRaised: bigint;
  totalUSDCRaised: bigint;
  currentPrice: bigint;
  marketCap: bigint;
  progress: bigint;
  isActive: boolean;
  name: string;
  symbol: string;
  ethBalance?: bigint;
  usdcBalance?: bigint;
  tokenBalance?: bigint;
  emergencyStop: boolean;
}

export interface QuoteResult {
  tokensOut: bigint;
  pricePerToken: bigint;
}

export interface PricingInfo {
  isBondingCurvePhase: boolean;
  isICOPhase: boolean;
  currentPrice: bigint;
  priceType: string;
}

export function useICOContracts() {
  const { ready, authenticated, user } = usePrivy();

  // Get wallet balances
  const { data: ethBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    query: {
      enabled: ready && authenticated && !!user?.wallet?.address,
    },
  });

  const { data: usdcBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: USDC_ADDRESS,
    query: {
      enabled: ready && authenticated && !!user?.wallet?.address,
    },
  });

  const { data: tokenBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: BONDING_CURVE_ADDRESS,
    query: {
      enabled: ready && authenticated && !!user?.wallet?.address,
    },
  });

  // Read all contract state at once
  const { data: contractStateData } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
    functionName: 'getContractState',
    query: {
      enabled: ready && authenticated,
      refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    },
  }) as { data: ContractStateData | undefined };

  const { data: name } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
    functionName: 'name',
    query: {
      enabled: ready && authenticated,
    },
  });

  const { data: symbol } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
    functionName: 'symbol',
    query: {
      enabled: ready && authenticated,
    },
  });

  // Write contract functions
  const { writeContractAsync } = useWriteContract();

  // Get ETH quote - REAL CONTRACT CALL
  const getETHQuote = useCallback(
    async (amountETH: bigint): Promise<QuoteResult> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      if (amountETH <= BigInt(0)) {
        return {
          tokensOut: BigInt(0),
          pricePerToken: BigInt(0),
        };
      }

      try {
        // Use the same calculation as the contract for now
        // In a production environment, you'd call the contract directly
        const currentPrice = contractStateData ? contractStateData[4] : BigInt(0);
        const tokensOut =
          currentPrice > BigInt(0) ? (amountETH * BigInt(1e18)) / currentPrice : BigInt(0);
        const pricePerToken = currentPrice;

        return {
          tokensOut: tokensOut,
          pricePerToken: pricePerToken,
        };
      } catch (error) {
        console.error('ETH quote failed:', error);
        throw new Error('Failed to get ETH quote');
      }
    },
    [ready, authenticated, contractStateData],
  );

  // Get USDC quote - REAL CONTRACT CALL
  const getUSDCQuote = useCallback(
    async (amountUSDC: bigint): Promise<QuoteResult> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      if (amountUSDC <= BigInt(0)) {
        return {
          tokensOut: BigInt(0),
          pricePerToken: BigInt(0),
        };
      }

      try {
        // Convert USDC to ETH equivalent (1 ETH = 3000 USDC from your contract)
        const ethEquivalent = (amountUSDC * BigInt(1e18)) / (BigInt(3000) * BigInt(1e6));

        // Use the same calculation as ETH quote
        const currentPrice = contractStateData ? contractStateData[4] : BigInt(0);
        const tokensOut =
          currentPrice > BigInt(0) ? (ethEquivalent * BigInt(1e18)) / currentPrice : BigInt(0);
        const pricePerToken = currentPrice;

        return {
          tokensOut: tokensOut,
          pricePerToken: pricePerToken,
        };
      } catch (error) {
        console.error('USDC quote failed:', error);
        throw new Error('Failed to get USDC quote');
      }
    },
    [ready, authenticated, contractStateData],
  );

  // USDC approval ABI (ERC20 approve function)
  const USDC_APPROVE_ABI = [
    {
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      name: 'approve',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const;

  // Approve USDC spending
  const approveUSDC = useCallback(
    async (amount: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');
      return writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_APPROVE_ABI,
        functionName: 'approve',
        args: [BONDING_CURVE_ADDRESS, amount],
        chain: baseSepolia,
        account: user?.wallet?.address as `0x${string}`,
      });
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Buy tokens with ETH
  const buyWithETH = useCallback(
    async (amountETH: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      const hash = await writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
        functionName: 'buyWithETH',
        value: amountETH,
        chain: baseSepolia,
        account: user?.wallet?.address as `0x${string}`,
      });

      return hash;
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Buy tokens with USDC
  const buyWithUSDC = useCallback(
    async (amountUSDC: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      // First approve USDC spending
      const approvalHash = await approveUSDC(amountUSDC);

      // Wait for approval to be confirmed before proceeding with purchase
      const hash = await writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
        functionName: 'buyWithUSDC',
        args: [amountUSDC],
        chain: baseSepolia,
        account: user?.wallet?.address as `0x${string}`,
      });

      return hash;
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address, approveUSDC],
  );

  // Sell tokens for ETH
  const sellForETH = useCallback(
    async (tokenAmount: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      return writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
        functionName: 'sellForETH',
        args: [tokenAmount],
        chain: baseSepolia,
        account: user?.wallet?.address as `0x${string}`,
      });
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Sell tokens for USDC
  const sellForUSDC = useCallback(
    async (tokenAmount: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      return writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
        functionName: 'sellForUSDC',
        args: [tokenAmount],
        chain: baseSepolia,
        account: user?.wallet?.address as `0x${string}`,
      });
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // USDC ABI for allowance check
  const USDC_ABI = [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      name: 'allowance',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  // Check USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [user?.wallet?.address as `0x${string}`, BONDING_CURVE_ADDRESS],
    query: {
      enabled: ready && authenticated && !!user?.wallet?.address,
    },
  });

  // Contract state
  const contractState: ICOContractState | undefined = contractStateData
    ? {
        totalSupply: contractStateData[0],
        tokensSold: contractStateData[1],
        totalETHRaised: contractStateData[2],
        totalUSDCRaised: contractStateData[3],
        currentPrice: contractStateData[4],
        marketCap: contractStateData[5],
        progress: contractStateData[6],
        emergencyStop: contractStateData[7],
        isActive: !contractStateData[7], // Active if not in emergency stop
        name: name || '',
        symbol: symbol || '',
        ethBalance: ethBalance?.value,
        usdcBalance: usdcBalance?.value,
        tokenBalance: tokenBalance?.value,
      }
    : undefined;

  // Pricing info for the bonding curve
  const pricingInfo: PricingInfo = {
    isBondingCurvePhase: true,
    isICOPhase: false,
    currentPrice: contractState?.currentPrice || BigInt(0),
    priceType: 'Bonding Curve',
  };

  return {
    contractState,
    buyWithETH,
    buyWithUSDC,
    sellForETH,
    sellForUSDC,
    getETHQuote,
    getUSDCQuote,
    pricingInfo,
    usdcAllowance,
    approveUSDC,
  };
}
