// ABI extracted from AcesFactory-1.json
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

// Specific function signatures for type safety
export const ACES_FACTORY_FUNCTIONS = {
  CREATE_TOKEN: 'createToken(uint8,uint256,uint256,string,string,string,uint256)',
  BUY_TOKENS: 'buyTokens(address,uint256,uint256)',
  SELL_TOKENS: 'sellTokens(address,uint256)',
  GET_BUY_PRICE_AFTER_FEE: 'getBuyPriceAfterFee(address,uint256)',
  GET_SELL_PRICE_AFTER_FEE: 'getSellPriceAfterFee(address,uint256)',
  TOKENS: 'tokens(address)',
  ACES_TOKEN_ADDRESS: 'acesTokenAddress()',
} as const;
