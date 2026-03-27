// Contract ABIs for the ACES platform
// Extracted from packages/utils/src/abis.ts and apps/frontend/src/lib/contracts/abi/
// All arrays use `as const` for viem type inference

// =============================================================================
// ERC20 Standard ABI
// =============================================================================

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

// =============================================================================
// AcesFactory ABI (latest version with bonding + Aerodrome support)
// =============================================================================

export const ACES_FACTORY_ABI = [
  // Constructor
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  // View functions
  {
    type: 'function',
    name: 'UPGRADE_INTERFACE_VERSION',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'acesTokenAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'aerodromeRouterAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeeDestination',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeePercent',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'subjectFeePercent',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenImplementation',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Token struct getter
  {
    type: 'function',
    name: 'tokens',
    inputs: [{ name: 'tokenAddress', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'curve', type: 'uint8', internalType: 'enum AcesFactory.Curves' },
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'floor', type: 'uint256', internalType: 'uint256' },
      { name: 'steepness', type: 'uint256', internalType: 'uint256' },
      { name: 'acesTokenBalance', type: 'uint256', internalType: 'uint256' },
      { name: 'subjectFeeDestination', type: 'address', internalType: 'address' },
      { name: 'tokensBondedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'tokenBonded', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  // Price calculation functions
  {
    type: 'function',
    name: 'getPrice',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBuyPrice',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellPrice',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBuyPriceAfterFee',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellPriceAfterFee',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPriceQuadratic',
    inputs: [
      { name: 'supply', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'steepness', type: 'uint256', internalType: 'uint256' },
      { name: 'floor', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getPriceLinear',
    inputs: [
      { name: 'supply', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'steepness', type: 'uint256', internalType: 'uint256' },
      { name: 'floor', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'price', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'pure',
  },
  // Main transaction functions
  {
    type: 'function',
    name: 'createToken',
    inputs: [
      { name: 'curve', type: 'uint8', internalType: 'enum AcesFactory.Curves' },
      { name: 'steepness', type: 'uint256', internalType: 'uint256' },
      { name: 'floor', type: 'uint256', internalType: 'uint256' },
      { name: 'name', type: 'string', internalType: 'string' },
      { name: 'symbol', type: 'string', internalType: 'string' },
      { name: 'salt', type: 'string', internalType: 'string' },
      { name: 'tokensBondedAt', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buyTokens',
    inputs: [
      { name: 'buyer', type: 'address', internalType: 'address' },
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'acesAmountIn', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellTokens',
    inputs: [
      { name: 'tokenAddress', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  // Owner functions
  {
    type: 'function',
    name: 'initialize',
    inputs: [{ name: 'initialOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Setter functions
  {
    type: 'function',
    name: 'setAcesTokenAddress',
    inputs: [{ name: '_acesTokenAddress', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAerodromeRouterAddress',
    inputs: [{ name: '_router', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setProtocolFeeDestination',
    inputs: [{ name: 'feeDestination', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setProtocolFeePercent',
    inputs: [{ name: 'feePercent', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSubjectFeePercent',
    inputs: [{ name: 'feePercent', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTokenImplementation',
    inputs: [{ name: 'impl', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Upgrade functions
  {
    type: 'function',
    name: 'proxiableUUID',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'upgradeToAndCall',
    inputs: [
      { name: 'newImplementation', type: 'address', internalType: 'address' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  // Withdraw functions
  {
    type: 'function',
    name: 'withdrawACES',
    inputs: [{ name: 'tokenAddress', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawETH',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'AerodromeRouterAddressChanged',
    inputs: [{ name: 'newAddress', type: 'address', indexed: false, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BondedToken',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: false, internalType: 'address' },
      { name: 'totalSupply', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CreatedToken',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: false, internalType: 'address' },
      { name: 'curve', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'steepness', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'floor', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeDestinationChanged',
    inputs: [{ name: 'newDestination', type: 'address', indexed: false, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [{ name: 'version', type: 'uint64', indexed: false, internalType: 'uint64' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newOwner', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolFeePercentChanged',
    inputs: [{ name: 'newPercent', type: 'uint256', indexed: false, internalType: 'uint256' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SellApprovalChanged',
    inputs: [
      { name: 'seller', type: 'address', indexed: true, internalType: 'address' },
      { name: 'operator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'approved', type: 'bool', indexed: false, internalType: 'bool' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubjectFeePercentChanged',
    inputs: [{ name: 'newPercent', type: 'uint256', indexed: false, internalType: 'uint256' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Trade',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: false, internalType: 'address' },
      { name: 'isBuy', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'tokenAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'acesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'protocolAcesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'subjectAcesAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'supply', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [{ name: 'implementation', type: 'address', indexed: true, internalType: 'address' }],
    anonymous: false,
  },
  // Errors
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [{ name: 'target', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ERC1967InvalidImplementation',
    inputs: [{ name: 'implementation', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'ERC1967NonPayable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedInnerCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidInitialization',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitializing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'UUPSUnauthorizedCallContext',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UUPSUnsupportedProxiableUUID',
    inputs: [{ name: 'slot', type: 'bytes32', internalType: 'bytes32' }],
  },
] as const;

// Typed function signature helpers for ACES_FACTORY_ABI
export const ACES_FACTORY_FUNCTIONS = {
  CREATE_TOKEN: 'createToken(uint8,uint256,uint256,string,string,string,uint256)',
  BUY_TOKENS: 'buyTokens(address,address,uint256,uint256)',
  SELL_TOKENS: 'sellTokens(address,uint256)',
  GET_BUY_PRICE_AFTER_FEE: 'getBuyPriceAfterFee(address,uint256)',
  GET_SELL_PRICE_AFTER_FEE: 'getSellPriceAfterFee(address,uint256)',
  TOKENS: 'tokens(address)',
  ACES_TOKEN_ADDRESS: 'acesTokenAddress()',
} as const;

// =============================================================================
// AcesSwap ABI (latest version - ETH/USDC/USDT to launchpad token)
// =============================================================================

export const ACES_SWAP_ABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_acesCurves',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellEthAndBuyLaunchpadToken',
    inputs: [
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'launchpadTokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'success',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sellUSDCAndBuyLaunchpadToken',
    inputs: [
      {
        name: 'amountIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'launchpadTokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'success',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellUSDTAndBuyLaunchpadToken',
    inputs: [
      {
        name: 'amountIn',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'launchpadTokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'success',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Log',
    inputs: [
      {
        name: 'message',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Paused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Unpaused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
] as const;

// =============================================================================
// AcesVault ABI (legacy bonding curve rooms - shares model)
// =============================================================================

export const ACES_VAULT_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'UPGRADE_INTERFACE_VERSION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'buyShares',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createRoom',
    inputs: [
      {
        name: 'curve',
        type: 'uint8',
        internalType: 'enum AcesVault.Curves',
      },
      {
        name: 'steepness',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'floor',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'midPoint',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: 'lockupPeriod',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'room',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBuyPrice',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBuyPriceAfterFee',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPrice',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'isBuy',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPriceLinear',
    inputs: [
      {
        name: 'supply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'steepness',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'floor',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getPriceQuadratic',
    inputs: [
      {
        name: 'supply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'steepness',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'floor',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getPriceSigmoid',
    inputs: [
      {
        name: 'supply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'steepness',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'floor',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'midPoint',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getRoomsLength',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellPrice',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellPriceAfterFee',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenBalance',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'holder',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenSupply',
    inputs: [
      {
        name: 'sharesSubject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        name: 'initialOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeeDestination',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeePercent',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proxiableUUID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rooms',
    inputs: [
      {
        name: 'subject',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'curve',
        type: 'uint8',
        internalType: 'enum AcesVault.Curves',
      },
      {
        name: 'floor',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'midPoint',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: 'maxPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'steepness',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sharesSupply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'lockupPeriod',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'creationTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setFeeDestination',
    inputs: [
      {
        name: 'feeDestination',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setProtocolFeePercent',
    inputs: [
      {
        name: 'feePercent',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSubjectFeePercent',
    inputs: [
      {
        name: 'feePercent',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTokenAddress',
    inputs: [
      {
        name: 'newToken',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'subjectFeePercent',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC20',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'upgradeToAndCall',
    inputs: [
      {
        name: 'newImplementation',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdrawETH',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'CreatedRoom',
    inputs: [
      {
        name: 'subject',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'curve',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'steepness',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'floor',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'maxPrice',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'midPoint',
        type: 'int256',
        indexed: false,
        internalType: 'int256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeDestinationChanged',
    inputs: [
      {
        name: 'newDestination',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolFeePercentChanged',
    inputs: [
      {
        name: 'newPercent',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SellApprovalChanged',
    inputs: [
      {
        name: 'seller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'operator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'approved',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubjectFeePercentChanged',
    inputs: [
      {
        name: 'newPercent',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Trade',
    inputs: [
      {
        name: 'trader',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'subject',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'roomNumber',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'isBuy',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'shareAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'ethAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'protocolEthAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'subjectEthAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'supply',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  // Errors
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC1967InvalidImplementation',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC1967NonPayable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidInitialization',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitializing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'UUPSUnauthorizedCallContext',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UUPSUnsupportedProxiableUUID',
    inputs: [
      {
        name: 'slot',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
] as const;

// =============================================================================
// Convenience re-export
// =============================================================================

export const ABIS = {
  ERC20: ERC20_ABI,
  AcesFactory: ACES_FACTORY_ABI,
  AcesSwap: ACES_SWAP_ABI,
  AcesVault: ACES_VAULT_ABI,
} as const;
