import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';

interface UseApprovalStatusProps {
  acesContract: ethers.Contract | null;
  spenderAddress: string; // Factory proxy address
  ownerAddress: string | null; // User's wallet address
  enabled?: boolean;
}

interface ApprovalStatusResult {
  hasApproval: boolean;
  currentAllowance: ethers.BigNumber | null;
  isChecking: boolean;
  checkApproval: () => Promise<void>;
  needsApproval: (requiredAmount: ethers.BigNumber) => boolean;
}

/**
 * Hook to check ACES approval status and manage approval flow
 *
 * Checks if the user has approved ACES spending for the factory contract.
 * Supports both regular and unlimited (MaxUint256) approvals.
 *
 * @example
 * const approvalStatus = useApprovalStatus({
 *   acesContract,
 *   spenderAddress: contractAddresses.FACTORY_PROXY,
 *   ownerAddress: walletAddress,
 *   enabled: isConnected
 * });
 *
 * if (!approvalStatus.hasApproval) {
 *   // Show approval button
 * }
 */
export function useApprovalStatus({
  acesContract,
  spenderAddress,
  ownerAddress,
  enabled = true,
}: UseApprovalStatusProps): ApprovalStatusResult {
  const [hasApproval, setHasApproval] = useState(false);
  const [currentAllowance, setCurrentAllowance] = useState<ethers.BigNumber | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkApproval = useCallback(async () => {
    if (!enabled || !acesContract || !ownerAddress || !spenderAddress) {
      setHasApproval(false);
      setCurrentAllowance(null);
      return;
    }

    try {
      setIsChecking(true);

      const allowance: ethers.BigNumber = await acesContract.allowance(
        ownerAddress,
        spenderAddress,
      );

      setCurrentAllowance(allowance);

      // Consider approved if allowance is greater than 0
      // For unlimited approval, this will be MaxUint256
      setHasApproval(allowance.gt(0));

      console.log('[useApprovalStatus] Allowance checked:', {
        owner: ownerAddress,
        spender: spenderAddress,
        allowance: ethers.utils.formatEther(allowance),
        hasApproval: allowance.gt(0),
        isUnlimited: allowance.eq(ethers.constants.MaxUint256),
      });
    } catch (error) {
      console.error('[useApprovalStatus] Failed to check allowance:', error);
      setHasApproval(false);
      setCurrentAllowance(null);
    } finally {
      setIsChecking(false);
    }
  }, [acesContract, ownerAddress, spenderAddress, enabled]);

  // Check approval on mount and when dependencies change
  useEffect(() => {
    checkApproval();
  }, [checkApproval]);

  // Helper function to check if current allowance is sufficient
  const needsApproval = useCallback(
    (requiredAmount: ethers.BigNumber): boolean => {
      if (!currentAllowance) return true;
      return currentAllowance.lt(requiredAmount);
    },
    [currentAllowance],
  );

  return useMemo(
    () => ({
      hasApproval,
      currentAllowance,
      isChecking,
      checkApproval,
      needsApproval,
    }),
    [hasApproval, currentAllowance, isChecking, checkApproval, needsApproval],
  );
}
