// All addresses are public, on-chain data on Base Mainnet (8453)

export const CHAIN_ID = 8453 as const;

// ── ACES Core Contracts ──────────────────────────────────
export const CONTRACTS = {
  ACES_TOKEN: "0x55337650856299363c496065C836B9C6E9dE0367",
  FACTORY_PROXY: "0x676BB442f45b5e11885Cf6e7ab8A15B5Ff7c5c51",
  FACTORY_IMPLEMENTATION: "0xd412A18B862Ae8641993ED31368366dD1b3F726c",
  CREATE2_DEPLOYER: "0x4756EFBD806650aC4f864bEd09f25C49f565fba9",
  ACES_SWAP: "0xD884a65b36D6b435f49e01BfD1dBB4643E97D57b",
} as const;

// ── Aerodrome DEX Contracts ──────────────────────────────
export const AERODROME = {
  ROUTER: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
  V2_FACTORY: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  CL_FACTORY: "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
  CL_QUOTER: "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0",
  FACTORY_REGISTRY: "0x5C3F18F06CC09CA1910767A34a20F771039E37C0",
  CL_POOL_LAUNCHER: "0xb9A1094D614c70B94C2CD7b4efc3A6adC6e6F4d3",
  CL_LOCKER_FACTORY: "0x8BF02b8da7a6091Ac1326d6db2ed25214D812219",
  V2_POOL_LAUNCHER: "0xA81eEbdEb3129bf5B89AEd89EDe9eC5fB6FDE3B3",
  V2_LOCKER_FACTORY: "0x067b028C66f61466F66864cc01F92Afc7D99e530",
  CL_SWAP_ROUTER: "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5",
  UNIVERSAL_ROUTER: "0x6Df1c91424F79E40E33B1A48F0687B666bE71075",
  PERMIT2: "0x494bbD8A3302AcA833D307D11838f18DbAdA9C25",
} as const;

// ── Standard Tokens on Base ──────────────────────────────
export const TOKENS = {
  ACES: {
    address: "0x55337650856299363c496065C836B9C6E9dE0367",
    decimals: 18,
    symbol: "ACES",
    name: "ACES",
  },
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
  },
  USDT: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    decimals: 6,
    symbol: "USDT",
    name: "Tether USD",
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
  },
  USDbC: {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    decimals: 6,
    symbol: "USDbC",
    name: "USD Base Coin",
  },
  DAI: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    symbol: "DAI",
    name: "Dai Stablecoin",
  },
} as const;

// ── Bonding Curve Config ─────────────────────────────────
export const BONDING_CURVE = {
  acesVault: "0x3C6d779a3e677E00843B2c9190A34b45A2e86f6C",
  acesToken: "0x55337650856299363c496065C836B9C6E9dE0367",
  implementation: "0x6fd697590ad40Ffc7ff039cfb32B43fBc1EF31E7",
  acesSwap: "0x039d1E7A384b1BfcA199a403c8A263a385D25c7a",
  sharesSubject: "0xFa896e205975c4C77918e789898F766478144a54",
  roomNumber: 0,
  chainId: 8453,
} as const;

export const ROOM_CONFIG = {
  curve: 1, // Linear
  steepness: "10000000000000",
  floor: "0",
  maxPrice: "0",
  midPoint: "0",
  lockupPeriod: "0",
} as const;

// ── Supported DEX Assets ─────────────────────────────────
export const SUPPORTED_DEX_ASSETS = [
  "ACES",
  "USDC",
  "USDT",
  "ETH",
  "WETH",
] as const;

export type SupportedDexAsset = (typeof SUPPORTED_DEX_ASSETS)[number];
