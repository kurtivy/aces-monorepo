// Auto-generated file - DO NOT EDIT
// Generated from deployment addresses
// Run 'pnpm extract-abis' to regenerate

export const CONTRACTS = {
  localhost: {
    acesToken: '',
    mockRwaDeedNft: '',
    mockRwaFactory: '',
  },
  baseSepolia: {
    acesToken: '0x2c9B029B2F232a5e5f3332A34d6EC6B668fEDd95',
    mockRwaDeedNft: '0xb5e4dA5EeaF3703da5e0CA66490f2bAF016c4A68',
    mockRwaFactory: '0x2e2aaDB15f11f1Ca7a0c5Acb5655e2f56701104A',
  },
} as const;

export type NetworkName = keyof typeof CONTRACTS;
export type ContractName = keyof typeof CONTRACTS.baseSepolia;

// Helper function to get contract address
export function getContractAddress(network: NetworkName, contractName: ContractName): string {
  const address = CONTRACTS[network][contractName];
  if (!address) {
    throw new Error(`Contract ${contractName} not deployed on ${network}`);
  }
  return address;
}

// Contract addresses for Base Sepolia testnet
export const BONDING_CURVE_CONTRACTS = {
  BASE_SEPOLIA: {
    chainId: 84532,
    acesTest: '0x6474F13C2CEbD4Ca36cAE5a1055d44928822Ded9',
    bondingCurveTest: '0xafa9256Adffc24c3d34296304046647B77eEB139',
  },
} as const;

// Helper function to get contract addresses for current network
export function getBondingCurveContracts(chainId: number) {
  switch (chainId) {
    case 84532: // Base Sepolia
      return BONDING_CURVE_CONTRACTS.BASE_SEPOLIA;
    default:
      throw new Error(`Bonding curve contracts not deployed on chain ${chainId}`);
  }
}

// Types for the contracts
export interface BondingCurveContracts {
  acesTest: string;
  bondingCurveTest: string;
}

export interface RoomStats {
  tokenSupply: bigint;
  totalETHRaised: bigint;
  currentPrice: bigint;
  progress: bigint;
}

// Deployment info
export const DEPLOYMENT_INFO = {
  network: 'baseSepolia',
  chainId: 84532,
  deployedAt: '2025-06-30T17:02:26.722Z',
} as const;
