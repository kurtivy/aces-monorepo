import { ethers } from 'ethers';

export type SupportedChainId = 8453 | 84532;

interface NetworkConfig {
  chainId: SupportedChainId;
  rpcUrl: string;
  aerodromeFactory: string;
  aerodromeRouter: string;
  acesToken: string;
  acesFactoryProxy?: string;
}

const baseMainnet: NetworkConfig = {
  chainId: 8453,
  // Accept either BASE_MAINNET_RPC_URL or QUICKNODE_BASE_URL
  rpcUrl: process.env.BASE_MAINNET_RPC_URL || process.env.QUICKNODE_BASE_URL || '',
  aerodromeFactory: process.env.AERODROME_FACTORY_ADDRESS || '',
  aerodromeRouter: process.env.AERODROME_ROUTER_ADDRESS || '',
  acesToken: process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367',
  acesFactoryProxy:
    process.env.ACES_FACTORY_PROXY_ADDRESS ||
    process.env.FACTORY_PROXY_ADDRESS ||
    '0x676BB442f45b5e11885Cf6e7ab8A15B5Ff7c5c51', // Base Mainnet factory proxy (NEW)
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
  acesFactoryProxy:
    process.env.ACES_FACTORY_PROXY_ADDRESS_SEPOLIA ||
    process.env.FACTORY_PROXY_ADDRESS_SEPOLIA ||
    '',
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

  // Create a proper Network object to prevent network detection failures
  // This tells ethers to use the provided network info instead of auto-detecting
  const network = new ethers.Network(chainId === 8453 ? 'base' : 'base-sepolia', chainId);

  return new ethers.JsonRpcProvider(config.rpcUrl, network, {
    staticNetwork: true, // Skip network detection
  });
}
