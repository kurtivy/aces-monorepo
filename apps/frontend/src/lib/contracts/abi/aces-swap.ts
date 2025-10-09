/**
 * ABI for AcesSwap contract
 * Multi-hop swap contract: USDT/USDC → WETH → ACES → LaunchpadToken
 */
export const ACES_SWAP_ABI = [
  // Events
  'event Log(string message)',
  'event Paused(address account)',
  'event Unpaused(address account)',

  // State-changing functions
  'function sellUSDTAndBuyLaunchpadToken(uint256 amountIn, address tokenAddress, uint256 launchpadTokenAmount) external returns (bool success)',
  'function sellUSDCAndBuyLaunchpadToken(uint256 amountIn, address tokenAddress, uint256 launchpadTokenAmount) external returns (bool success)',

  // Owner functions
  'function pause() external',
  'function unpause() external',

  // View functions (if any - not explicitly defined in the contract but can be useful)
  // Note: The contract doesn't have explicit view functions, but we can interact with the public variables
];
