import type { ContractAddresses, NetworkConfig } from './types';

// Contract addresses for different networks
export const CONTRACTS: Record<string, ContractAddresses> = {
  // Local hardhat network for development
  localhost: {
    acesToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Standard hardhat address
    deedNft: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    factory: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  },
  // Base Sepolia testnet (will be updated when deployed)
  baseSepolia: {
    acesToken: '',
    deedNft: '',
    factory: '',
  },
  // Base mainnet (for future production)
  base: {
    acesToken: '',
    deedNft: '',
    factory: '',
  },
} as const;

// Network configurations
export const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    contracts: CONTRACTS.localhost,
  },
  baseSepolia: {
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    contracts: CONTRACTS.baseSepolia,
  },
  base: {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    contracts: CONTRACTS.base,
  },
} as const;

// Constants from smart-contract.md AcesConstants.sol
export const PLATFORM_CONSTANTS = {
  // Fee Structure (Basis Points: 100 = 1%)
  PLATFORM_FEE_BPS: 50, // 0.5%
  OWNER_FEE_BPS: 50, // 0.5% (Total 1% fee)

  // Linear Bonding Curve Parameters
  CURVE_BASE_PRICE: '0.001', // 0.001 ether
  CURVE_SLOPE: '0.00001', // 0.00001 ether - Price increases by this much for each token minted
} as const;

// Helper functions
export function getContractAddresses(network: string): ContractAddresses {
  const contracts = CONTRACTS[network];
  if (!contracts) {
    throw new Error(`Unknown network: ${network}`);
  }
  return contracts;
}

export function getNetworkConfig(network: string): NetworkConfig {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }
  return config;
}

export function isValidNetwork(network: string): network is keyof typeof NETWORKS {
  return network in NETWORKS;
}

// Default network based on environment
export function getDefaultNetwork(): string {
  const env = process.env.NODE_ENV;
  if (env === 'production') {
    return 'base';
  } else if (env === 'test') {
    return 'localhost';
  } else {
    return 'baseSepolia'; // development default
  }
}
