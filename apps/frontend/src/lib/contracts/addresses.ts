// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Base Sepolia (Chain ID: 84532) - TESTNET
  baseSepolia: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_BASE_SEPOLIA ||
      '0xF6b0c828ee8098120AFa90CEb11f80e6Fd4e2F1e', // Base Sepolia ACES token
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE_SEPOLIA ||
      '0xEC8556468B88A4422c786c4acBA61f556Eb592A4', // Base Sepolia factory implementation
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_SEPOLIA ||
      '0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D', // Base Sepolia factory proxy (main interaction point)
    CREATE2_DEPLOYER:
      process.env.NEXT_PUBLIC_CREATE2_DEPLOYER_BASE_SEPOLIA ||
      '0x370B6ED939de3da70f2A884db2eFb4E0C540702A', // Base Sepolia CREATE2Deployer
    FIXED_SUPPLY_FACTORY: process.env.NEXT_PUBLIC_FIXED_SUPPLY_FACTORY_BASE_SEPOLIA || '', // Low-gas FixedSupplyERC20Factory (optional)
    AERODROME_ROUTER: process.env.NEXT_PUBLIC_AERODROME_ROUTER_BASE_SEPOLIA || '', // Optional: only if a testnet router exists
    AERODROME_FACTORY: process.env.NEXT_PUBLIC_AERODROME_FACTORY_BASE_SEPOLIA || '', // V2 Pool Factory (Volatile/Stable)
    AERODROME_CL_FACTORY: process.env.NEXT_PUBLIC_AERODROME_CL_FACTORY_BASE_SEPOLIA || '', // CL Pool Factory (SlipStream)
    AERODROME_CL_QUOTER: process.env.NEXT_PUBLIC_AERODROME_CL_QUOTER_BASE_SEPOLIA || '', // Slipstream Quoter (if deployed on Sepolia)
    AERODROME_FACTORY_REGISTRY:
      process.env.NEXT_PUBLIC_AERODROME_FACTORY_REGISTRY_BASE_SEPOLIA || '', // Factory Registry
    AERODROME_CL_POOL_LAUNCHER:
      process.env.NEXT_PUBLIC_AERODROME_CL_POOL_LAUNCHER_BASE_SEPOLIA || '',
    AERODROME_CL_LOCKER_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_CL_LOCKER_FACTORY_BASE_SEPOLIA || '',
    AERODROME_V2_POOL_LAUNCHER:
      process.env.NEXT_PUBLIC_AERODROME_V2_POOL_LAUNCHER_BASE_SEPOLIA || '',
    AERODROME_V2_LOCKER_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_V2_LOCKER_FACTORY_BASE_SEPOLIA || '',
    AERODROME_LOCKER: process.env.NEXT_PUBLIC_AERODROME_LOCKER_BASE_SEPOLIA || '',
    AERODROME_CL_SWAP_ROUTER: process.env.NEXT_PUBLIC_AERODROME_CL_SWAP_ROUTER_BASE_SEPOLIA || '',
    AERODROME_UNIVERSAL_ROUTER: process.env.NEXT_PUBLIC_AERODROME_UNIVERSAL_ROUTER_BASE_SEPOLIA || '',
    PERMIT2: process.env.NEXT_PUBLIC_PERMIT2_BASE_SEPOLIA || '',
  },
  // Base Mainnet (Chain ID: 8453) - PRODUCTION
  baseMainnet: {
    ACES_TOKEN:
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS_BASE_MAINNET ||
      '0x55337650856299363c496065C836B9C6E9dE0367', // Base Mainnet ACES token
    FACTORY_IMPLEMENTATION:
      process.env.NEXT_PUBLIC_FACTORY_ADDRESS_BASE_MAINNET ||
      '0xd412A18B862Ae8641993ED31368366dD1b3F726c', // Base Mainnet factory implementation (NEW)
    FACTORY_PROXY:
      process.env.NEXT_PUBLIC_PROXY_ADDRESS_BASE_MAINNET ||
      '0x676BB442f45b5e11885Cf6e7ab8A15B5Ff7c5c51', // Base Mainnet factory proxy (ACTIVE - bonding curve contract with buyTokens)
    CREATE2_DEPLOYER:
      process.env.NEXT_PUBLIC_CREATE2_DEPLOYER_BASE_MAINNET ||
      '0x4756EFBD806650aC4f864bEd09f25C49f565fba9', // Base Mainnet CREATE2Deployer
    FIXED_SUPPLY_FACTORY: process.env.NEXT_PUBLIC_FIXED_SUPPLY_FACTORY_BASE_MAINNET || '', // Low-gas FixedSupplyERC20Factory (optional)
    AERODROME_ROUTER:
      process.env.NEXT_PUBLIC_AERODROME_ROUTER_BASE_MAINNET ||
      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Aerodrome Router on Base Mainnet
    AERODROME_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_FACTORY_BASE_MAINNET ||
      '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', // Aerodrome V2 Pool Factory (Volatile/Stable) on Base Mainnet
    AERODROME_CL_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_CL_FACTORY_BASE_MAINNET ||
      '0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a', // Aerodrome CL Pool Factory used by CL Pool Launcher (SlipStream; has 500 = 2%)
    AERODROME_CL_QUOTER:
      process.env.NEXT_PUBLIC_AERODROME_CL_QUOTER_BASE_MAINNET ||
      '0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0', // Aerodrome Slipstream QuoterV2 on Base Mainnet
    AERODROME_FACTORY_REGISTRY:
      process.env.NEXT_PUBLIC_AERODROME_FACTORY_REGISTRY_BASE_MAINNET ||
      '0x5C3F18F06CC09CA1910767A34a20F771039E37C0', // Aerodrome Factory Registry on Base Mainnet
    // Aerodrome Pool Launcher / Locker (Base Mainnet deployment)
    AERODROME_CL_POOL_LAUNCHER:
      process.env.NEXT_PUBLIC_AERODROME_CL_POOL_LAUNCHER_BASE_MAINNET ||
      '0xb9A1094D614c70B94C2CD7b4efc3A6adC6e6F4d3', // CL Pool Launcher: launch(LaunchParams, recipient)
    AERODROME_CL_LOCKER_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_CL_LOCKER_FACTORY_BASE_MAINNET ||
      '0x8BF02b8da7a6091Ac1326d6db2ed25214D812219', // CLLockerFactory: creates lockers when CLPoolLauncher locks
    AERODROME_V2_POOL_LAUNCHER:
      process.env.NEXT_PUBLIC_AERODROME_V2_POOL_LAUNCHER_BASE_MAINNET ||
      '0xA81eEbdEb3129bf5B89AEd89EDe9eC5fB6FDE3B3', // V2 Pool Launcher (Volatile/Stable)
    AERODROME_V2_LOCKER_FACTORY:
      process.env.NEXT_PUBLIC_AERODROME_V2_LOCKER_FACTORY_BASE_MAINNET ||
      '0x067b028C66f61466F66864cc01F92Afc7D99e530', // V2 Locker Factory
    AERODROME_LOCKER:
      process.env.NEXT_PUBLIC_AERODROME_LOCKER_BASE_MAINNET ||
      '0x8BF02b8da7a6091Ac1326d6db2ed25214D812219', // Same as CL Locker Factory (locker instances created by it)
    ACES_SWAP:
      process.env.NEXT_PUBLIC_ACES_SWAP_ADDRESS_MAINNET ||
      '0xD884a65b36D6b435f49e01BfD1dBB4643E97D57b', // Base Mainnet AcesSwapNewest (multi-hop: ETH/USDC/USDT → ACES → RWA)
    AERODROME_CL_SWAP_ROUTER:
      process.env.NEXT_PUBLIC_AERODROME_CL_SWAP_ROUTER_BASE_MAINNET ||
      '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5', // Aerodrome Slipstream SwapRouter on Base Mainnet
    AERODROME_UNIVERSAL_ROUTER:
      process.env.NEXT_PUBLIC_AERODROME_UNIVERSAL_ROUTER_BASE_MAINNET ||
      '0x6Df1c91424F79E40E33B1A48F0687B666bE71075', // Aerodrome Universal Router (supports both CL factory 1 & 2)
    PERMIT2:
      process.env.NEXT_PUBLIC_PERMIT2_BASE_MAINNET ||
      '0x494bbD8A3302AcA833D307D11838f18DbAdA9C25', // Uniswap Permit2 (used by Universal Router)
  },
} as const;

// Get addresses for current network
export function getContractAddresses(chainId: number = 8453) {
  // Default to Base Mainnet
  switch (chainId) {
    case 84532: // Base Sepolia (Testnet)
      return CONTRACT_ADDRESSES.baseSepolia;
    case 8453: // Base Mainnet (Production)
      return CONTRACT_ADDRESSES.baseMainnet;
    default:
      console.warn(
        `⚠️ Unsupported chain ID: ${chainId}. Only Base Sepolia (84532) and Base Mainnet (8453) are supported. Defaulting to Base Mainnet.`,
      );
      return CONTRACT_ADDRESSES.baseMainnet;
  }
}

// Validation function - checks if all required contracts are configured
export function validateContractAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId);

  // All networks need ACES_TOKEN and FACTORY_PROXY for trading to work
  const hasRequiredContracts = Boolean(addresses.ACES_TOKEN && addresses.FACTORY_PROXY);

  if (!hasRequiredContracts && chainId === 84532) {
    console.error(
      '❌ Base Sepolia contracts not fully configured! Set:\n' +
        '  - NEXT_PUBLIC_FACTORY_ADDRESS_BASE_SEPOLIA\n' +
        '  - NEXT_PUBLIC_PROXY_ADDRESS_BASE_SEPOLIA',
    );
  }
  if (!hasRequiredContracts && chainId === 8453) {
    console.error(
      '❌ Base Mainnet contracts not fully configured! Set:\n' +
        '  - NEXT_PUBLIC_FACTORY_ADDRESS_BASE_MAINNET\n' +
        '  - NEXT_PUBLIC_PROXY_ADDRESS_BASE_MAINNET\n' +
        '  - NEXT_PUBLIC_AERODROME_ROUTER_BASE_MAINNET',
    );
  }

  return hasRequiredContracts;
}

// Network configuration
export const NETWORK_CONFIG = {
  DEFAULT_CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '8453'), // Base Mainnet
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'baseMainnet',
} as const;
