/**
 * useTransferEventListener Hook
 * 
 * Real-time wallet balance updates via ERC20 Transfer event listening
 * Provides instant updates when tokens are sent/received
 * 
 * @param tokenAddress - ERC20 token contract address
 * @param walletAddress - Wallet address to monitor
 * @param onTransfer - Callback fired when transfers detected
 * 
 * Example:
 * const handleTransfer = useCallback(() => {
 *   console.log('Transfer detected! Fetching new balance...');
 *   fetchUserBalance();
 * }, []);
 * 
 * useTransferEventListener(tokenAddress, walletAddress, handleTransfer);
 */

import { useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

interface UseTransferEventListenerOptions {
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Auto-cleanup on unmount (default: true) */
  autoCleanup?: boolean;
}

export function useTransferEventListener(
  tokenAddress: string | undefined | null,
  walletAddress: string | undefined | null,
  onTransfer: () => void,
  options: UseTransferEventListenerOptions = {},
) {
  const { debug = false, autoCleanup = true } = options;
  
  const tokenContractRef = useRef<ethers.Contract | null>(null);
  const filterFromRef = useRef<any>(null);
  const filterToRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useTransferEventListener] ${message}`, data || '');
      }
    },
    [debug],
  );

  // Setup listener
  useEffect(() => {
    // Validate inputs
    if (!tokenAddress || !walletAddress || !window.ethereum) {
      log('Missing required parameters or web3 not available', {
        hasToken: !!tokenAddress,
        hasWallet: !!walletAddress,
        hasEthereum: !!window.ethereum,
      });
      return;
    }

    let isActive = true;

    const setupListener = async () => {
      try {
        log('Setting up Transfer event listener', {
          tokenAddress: tokenAddress!.slice(0, 10) + '...',
          walletAddress: walletAddress!.slice(0, 10) + '...',
        });

        // Create provider and contract
        const provider = new ethers.providers.Web3Provider(window.ethereum!);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        if (!isActive) return;

        tokenContractRef.current = tokenContract;

        // Create event filters
        // Filter 1: Transfers FROM wallet (user sends tokens)
        const filterFrom = tokenContract.filters.Transfer(walletAddress, null);
        filterFromRef.current = filterFrom;

        // Filter 2: Transfers TO wallet (user receives tokens)
        const filterTo = tokenContract.filters.Transfer(null, walletAddress);
        filterToRef.current = filterTo;

        // Handle transfer events
        const handleTransfer = async (from: string, to: string, value: any) => {
          if (!isActive) return;

          const isOutgoing = from.toLowerCase() === walletAddress.toLowerCase();
          const direction = isOutgoing ? 'OUT' : 'IN';

          log('✅ Transfer event detected', {
            direction,
            from: from.slice(0, 10) + '...',
            to: to.slice(0, 10) + '...',
            value: ethers.utils.formatEther(value),
          });

          // Call user's callback
          try {
            onTransfer();
          } catch (error) {
            console.error('[useTransferEventListener] Callback error:', error);
          }
        };

        // Subscribe to both filters
        tokenContract.on(filterFrom, handleTransfer);
        tokenContract.on(filterTo, handleTransfer);

        log('✅ Transfer event listener active');

        // Store cleanup function
        unsubscribeRef.current = () => {
          if (tokenContractRef.current) {
            tokenContractRef.current.off(filterFrom, handleTransfer);
            tokenContractRef.current.off(filterTo, handleTransfer);
            log('🧹 Transfer event listener removed');
          }
        };
      } catch (error) {
        if (isActive) {
          console.error('[useTransferEventListener] Setup error:', error);
          log('❌ Failed to setup Transfer event listener', error);
        }
      }
    };

    setupListener();

    // Cleanup
    return () => {
      isActive = false;

      if (autoCleanup && unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [tokenAddress, walletAddress, onTransfer, log, autoCleanup]);
}

