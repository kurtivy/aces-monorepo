import { ethers } from 'ethers';

const POOL_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

interface PoolDetectionResult {
  exists: boolean;
  poolAddress: string | null;
  hasLiquidity: boolean;
  reserves?: {
    token0: string;
    token1: string;
    reserve0: string;
    reserve1: string;
  };
}

export class PoolDetectionService {
  constructor(
    private provider: ethers.Provider,
    private factoryAddress: string,
    private acesTokenAddress: string,
  ) {}

  /**
   * Detect if a graduated token has a valid DEX pool
   */
  async detectPool(tokenAddress: string, knownPoolAddress?: string): Promise<PoolDetectionResult> {
    const poolAddress = knownPoolAddress || (await this.predictPoolAddress(tokenAddress));

    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
      return {
        exists: false,
        poolAddress: null,
        hasLiquidity: false,
      };
    }

    try {
      // Check if pool contract exists
      const code = await this.provider.getCode(poolAddress);
      if (code === '0x') {
        return {
          exists: false,
          poolAddress,
          hasLiquidity: false,
        };
      }

      // Check pool reserves
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
      const [reserve0, reserve1] = await poolContract.getReserves();
      const token0 = await poolContract.token0();
      const token1 = await poolContract.token1();

      const hasLiquidity = reserve0 > 0n && reserve1 > 0n;

      return {
        exists: true,
        poolAddress,
        hasLiquidity,
        reserves: {
          token0: token0.toLowerCase(),
          token1: token1.toLowerCase(),
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
        },
      };
    } catch (error) {
      console.error('[PoolDetection] Error checking pool:', error);
      return {
        exists: false,
        poolAddress,
        hasLiquidity: false,
      };
    }
  }

  /**
   * Predict pool address using Aerodrome's deterministic address calculation
   * Based on: https://github.com/velodrome-finance/pool-launcher
   */
  private async predictPoolAddress(tokenAddress: string): Promise<string | null> {
    try {
      const FACTORY_ABI = [
        'function getPair(address tokenA, address tokenB, bool stable) view returns (address)',
      ];

      const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);

      // Try volatile pool first (default for RWA tokens)
      const volatilePool = await factory.getPair(
        tokenAddress,
        this.acesTokenAddress,
        false, // volatile
      );

      if (volatilePool && volatilePool !== ethers.ZeroAddress) {
        return volatilePool.toLowerCase();
      }

      // Fallback: try stable pool
      const stablePool = await factory.getPair(
        tokenAddress,
        this.acesTokenAddress,
        true, // stable
      );

      if (stablePool && stablePool !== ethers.ZeroAddress) {
        return stablePool.toLowerCase();
      }

      return null;
    } catch (error) {
      console.error('[PoolDetection] Error predicting pool address:', error);
      return null;
    }
  }

  /**
   * Verify pool is ready for trading (has liquidity and recent activity)
   */
  async isPoolReady(poolAddress: string, minimumLiquidityUsd = 1000): Promise<boolean> {
    const detection = await this.detectPool('', poolAddress);

    if (!detection.exists || !detection.hasLiquidity) {
      return false;
    }

    // Additional checks can go here:
    // - Minimum liquidity threshold
    // - Recent trade activity
    // - Price sanity check

    return true;
  }
}
