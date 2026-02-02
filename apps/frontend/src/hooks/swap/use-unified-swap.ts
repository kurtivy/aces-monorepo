import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { BondingCurveSwapService } from '@/lib/swap/services/bonding-curve-swap-service';
import { DexSwapService } from '@/lib/swap/services/dex-swap-service';
import { useAcesSwapV2 } from '@/hooks/swap/use-aces-swap-v2';
import type { TransactionResult } from '@/lib/swap/types';
import type { DexQuoteResponse } from '@/lib/api/dex';
import type { UnifiedQuoteResult } from './use-unified-quote';

interface UseUnifiedSwapProps {
  // Contracts
  factoryContract: ethers.Contract | null;
  acesContract: ethers.Contract | null;
  signer: ethers.Signer | null;
  walletAddress: string | null;

  // Addresses
  factoryProxyAddress: string;
  tokenAddress: string;
  routerAddress: string;

  // Mode
  isDexMode: boolean;
}

interface SwapParams {
  sellToken: string;
  buyToken: string;
  amount: string; // Amount of sell token (user input)
  quote: UnifiedQuoteResult; // Quote from useUnifiedQuote
  onStatus?: (status: string) => void;
}

/**
 * Unified swap execution hook
 * Routes to correct swap service based on token pair and mode:
 *
 * BONDING MODE (0-99% bonded):
 * - ACES → TOKEN: Direct bonding curve buy
 * - TOKEN → ACES: Direct bonding curve sell
 * - WETH/USDC/USDT → TOKEN: Multi-hop via AcesSwap contract (when deployed)
 *
 * DEX MODE (100% bonded):
 * - All pairs: Aerodrome router (handles multi-hop automatically)
 */
export function useUnifiedSwap({
  factoryContract,
  acesContract,
  signer,
  walletAddress,
  factoryProxyAddress,
  tokenAddress,
  routerAddress,
  isDexMode,
}: UseUnifiedSwapProps) {
  const [loading, setLoading] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // AcesSwap contract hook (for multi-hop in bonding mode)
  const acesSwapContract = useAcesSwapV2({ signer, walletAddress });

  /**
   * Execute swap based on token pair and mode
   */
  const executeSwap = useCallback(
    async (params: SwapParams): Promise<TransactionResult> => {
      const { sellToken, buyToken, amount, quote, onStatus } = params;

      const updateStatus = (status: string) => {
        setLoading(status);
        onStatus?.(status);
      };

      try {
        setError(null);
        updateStatus('Preparing swap...');

        // Helper to check if token is the RWA token
        const isRwaToken = (token: string) =>
          token.toLowerCase() === tokenAddress.toLowerCase() || token === 'TOKEN';

        const isSellRwa = isRwaToken(sellToken);
        const isBuyRwa = isRwaToken(buyToken);

        // ==========================================
        // DEX MODE: Use Aerodrome for all swaps
        // ==========================================
        if (isDexMode) {
          if (!signer || !walletAddress || !routerAddress) {
            throw new Error('Missing required data for DEX swap');
          }

          if (!quote.quote || quote.strategy !== 'dex') {
            throw new Error('Invalid DEX quote');
          }

          const dexService = new DexSwapService(routerAddress, signer, walletAddress);

          return await dexService.executeSwap({
            quote: quote.quote as DexQuoteResponse,
            paymentAsset: sellToken as any,
            signer,
            onStatus: updateStatus,
          });
        }

        // ==========================================
        // BONDING MODE REMOVED - All swaps are DEX-only now
        // ==========================================
        
        // All bonding curve swaps have been removed
        // If we reach here and it's not a DEX swap, throw an error
        if (quote.strategy !== 'dex') {
          throw new Error('Only DEX swaps are supported. Bonding curve functionality has been removed.');
        }

        // Unsupported swap combination
        throw new Error(
          `Unsupported swap combination: ${sellToken} → ${buyToken} in ${isDexMode ? 'DEX' : 'bonding'} mode`,
        );
      } catch (error) {
        console.error('[useUnifiedSwap] Swap failed:', error); // eslint-disable-line
        const errorMessage = error instanceof Error ? error.message : 'Swap failed';
        setError(errorMessage);
        setLoading('');

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading('');
      }
    },
    [
      factoryContract,
      acesContract,
      signer,
      walletAddress,
      factoryProxyAddress,
      tokenAddress,
      routerAddress,
      isDexMode,
      acesSwapContract,
    ],
  );

  return {
    executeSwap,
    loading,
    error,
    acesSwapReady: acesSwapContract.isReady,
    acesSwapDeployed: acesSwapContract.isDeployed,
  };
}
