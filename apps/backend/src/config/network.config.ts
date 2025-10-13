import { ethers } from 'ethers';

export type SupportedChainId = 8453 | 84532;

interface NetworkConfig {
  chainId: SupportedChainId;
  rpcUrl: string;
  aerodromeFactory: string;
  aerodromeRouter: string;
  acesToken: string;
}

const baseMainnet: NetworkConfig = {
  chainId: 8453,
  rpcUrl: process.env.QUICKNODE_BASE_URL || '',
  aerodromeFactory: process.env.AERODROME_FACTORY_ADDRESS || '',
  aerodromeRouter: process.env.AERODROME_ROUTER_ADDRESS || '',
  acesToken: process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
};

const baseSepolia: NetworkConfig = {
  chainId: 84532,
  rpcUrl: process.env.QUICKNODE_BASE_SEPOLIA_RPC || '',
  aerodromeFactory: process.env.AERODROME_FACTORY_ADDRESS_BASE_SEPOLIA || '',
  aerodromeRouter: process.env.AERODROME_ROUTER_ADDRESS_BASE_SEPOLIA || '',
  acesToken:
    process.env.ACES_TOKEN_ADDRESS_SEPOLIA ||
    process.env.ACES_TOKEN_ADDRESS_BASE_SEPOLIA ||
    '0xF6b0c828ee8098120AFa90CEb11f80e6Fd4e2F1e',
};

const NETWORKS: Record<SupportedChainId, NetworkConfig> = {
  8453: baseMainnet,
  84532: baseSepolia,
};

export function getNetworkConfig(chainId: SupportedChainId): NetworkConfig {
  return NETWORKS[chainId];
}

export function createProvider(chainId: SupportedChainId): ethers.JsonRpcProvider | null {
  const config = getNetworkConfig(chainId);
  if (!config.rpcUrl) {
    return null;
  }
  return new ethers.JsonRpcProvider(config.rpcUrl);
}
