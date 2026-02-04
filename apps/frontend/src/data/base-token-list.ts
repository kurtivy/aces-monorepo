/**
 * Curated Base mainnet (chainId 8453) ERC20 token list.
 * Used with QuickNode RPC (balanceOf) to show "all tokens on Base" for a wallet.
 * Addresses are lowercase for consistent lookup.
 */
export const BASE_MAINNET_CHAIN_ID = 8453;

export type BaseTokenInfo = {
  contractAddress: string;
  symbol: string;
  name: string;
  chainId: number;
  decimals: number;
};

export const BASE_MAINNET_TOKEN_LIST: BaseTokenInfo[] = [
  {
    contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    symbol: 'USDC',
    name: 'USD Coin',
    chainId: BASE_MAINNET_CHAIN_ID,
    decimals: 6,
  },
  {
    contractAddress: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
    symbol: 'USDT',
    name: 'Tether USD',
    chainId: BASE_MAINNET_CHAIN_ID,
    decimals: 6,
  },
  {
    contractAddress: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    chainId: BASE_MAINNET_CHAIN_ID,
    decimals: 18,
  },
  {
    contractAddress: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    symbol: 'USDbC',
    name: 'USD Base Coin',
    chainId: BASE_MAINNET_CHAIN_ID,
    decimals: 6,
  },
  {
    contractAddress: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    chainId: BASE_MAINNET_CHAIN_ID,
    decimals: 18,
  },
];
