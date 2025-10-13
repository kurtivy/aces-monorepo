import { ethers } from 'ethers';
import type { TransactionResult, StatusCallback } from '../types';
import { APPROVAL_CONFIRMATIONS } from '../constants';

const UNLIMITED_APPROVAL = ethers.constants.MaxUint256;

/**
 * Service for executing bonding curve swaps via factory contract
 * Handles buy and sell transactions with approval flow
 */
export class BondingCurveSwapService {
  private factoryContract: ethers.Contract;
  private acesContract: ethers.Contract;
  private factoryProxyAddress: string;

  constructor(
    factoryContract: ethers.Contract,
    acesContract: ethers.Contract,
    factoryProxyAddress: string,
  ) {
    this.factoryContract = factoryContract;
    this.acesContract = acesContract;
    this.factoryProxyAddress = factoryProxyAddress;
  }

  /**
   * Check if user has sufficient approval
   */
  async checkApproval(ownerAddress: string): Promise<{
    hasApproval: boolean;
    currentAllowance: ethers.BigNumber;
  }> {
    try {
      const allowance: ethers.BigNumber = await this.acesContract.allowance(
        ownerAddress,
        this.factoryProxyAddress,
      );

      return {
        hasApproval: allowance.gt(0),
        currentAllowance: allowance,
      };
    } catch (error) {
      console.error('[BondingCurveSwapService] Failed to check approval:', error);
      return {
        hasApproval: false,
        currentAllowance: ethers.BigNumber.from(0),
      };
    }
  }

  /**
   * Approve unlimited ACES spending (one-time approval)
   */
  async approveUnlimited(params: { onStatus?: StatusCallback }): Promise<TransactionResult> {
    const { onStatus } = params;

    try {
      console.log('[BondingCurveSwapService] Approving unlimited ACES...');

      const signer = this.factoryContract.signer;
      const address = await signer.getAddress();

      // Check current approval
      const { hasApproval, currentAllowance } = await this.checkApproval(address);

      if (hasApproval && currentAllowance.eq(UNLIMITED_APPROVAL)) {
        console.log('[BondingCurveSwapService] ✅ Already has unlimited approval');
        return { success: true };
      }

      onStatus?.('Approving ACES...');

      const approveTx = await this.acesContract.approve(
        this.factoryProxyAddress,
        UNLIMITED_APPROVAL,
      );

      onStatus?.('...');
      console.log('[BondingCurveSwapService] Approval tx sent:', approveTx.hash);

      const approvalReceipt = await approveTx.wait(APPROVAL_CONFIRMATIONS);
      console.log('[BondingCurveSwapService] ✅ Unlimited approval confirmed');

      onStatus?.('Approval complete!');

      return {
        success: true,
        hash: approveTx.hash,
        receipt: approvalReceipt,
      };
    } catch (error) {
      console.error('[BondingCurveSwapService] ❌ Approval failed:', error);

      let errorMessage = 'Approval failed';

      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('user denied')) {
          errorMessage = 'Approval rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get fresh quote right before executing buy
   */
  private async getFreshQuoteWithSlippage(
    tokenAddress: string,
    amount: ethers.BigNumber,
    slippageBps: number,
  ): Promise<ethers.BigNumber> {
    try {
      console.log('[BondingCurveSwapService] Fetching fresh quote...');

      const freshQuote: ethers.BigNumber = await this.factoryContract.getBuyPriceAfterFee(
        tokenAddress,
        amount,
      );

      // Apply slippage: quote * (1 + slippage/10000)
      const multiplier = ethers.BigNumber.from(10000 + slippageBps);
      const maxACES = freshQuote.mul(multiplier).div(10000);

      console.log('[BondingCurveSwapService] Fresh quote calculated:', {
        baseQuote: ethers.utils.formatEther(freshQuote),
        withSlippage: ethers.utils.formatEther(maxACES),
        slippageBps,
      });

      return maxACES;
    } catch (error) {
      console.error('[BondingCurveSwapService] Failed to get fresh quote:', error);
      throw error;
    }
  }

  /**
   * Buy tokens on bonding curve with slippage protection
   * @param params - Buy parameters
   * @param params.tokenAddress - LaunchpadToken contract address
   * @param params.amount - Amount of tokens to buy (in wei)
   * @param params.slippageBps - Slippage in basis points
   * @param params.onStatus - Optional callback for status updates
   * @returns Transaction result with hash and receipt
   */
  async buyTokens(params: {
    tokenAddress: string;
    amount: ethers.BigNumber;
    slippageBps: number;
    onStatus?: StatusCallback;
  }): Promise<TransactionResult> {
    const { tokenAddress, amount, slippageBps, onStatus } = params;

    try {
      console.log('[BondingCurveSwapService] Starting buy transaction...', {
        tokenAddress,
        amount: ethers.utils.formatEther(amount),
        slippageBps,
      });

      const signer = this.factoryContract.signer;
      const address = await signer.getAddress();

      // Step 1: Check approval status
      const { hasApproval } = await this.checkApproval(address);

      if (!hasApproval) {
        return {
          success: false,
          error: 'ACES approval required. Please approve first.',
        };
      }

      // Step 2: Get fresh quote with slippage RIGHT BEFORE buying
      onStatus?.('Getting fresh price quote...');
      const maxACES = await this.getFreshQuoteWithSlippage(tokenAddress, amount, slippageBps);

      // Step 3: Check ACES balance
      const acesBalance: ethers.BigNumber = await this.acesContract.balanceOf(address);
      console.log('[BondingCurveSwapService] ACES balance:', ethers.utils.formatEther(acesBalance));

      if (acesBalance.lt(maxACES)) {
        return {
          success: false,
          error: `Insufficient ACES balance. You need ${ethers.utils.formatEther(maxACES)} but only have ${ethers.utils.formatEther(acesBalance)}`,
        };
      }

      // Step 4: Execute buy with fresh maxACES
      onStatus?.('Buying tokens...');
      console.log('[BondingCurveSwapService] Executing buy with fresh quote...');

      const buyTx = await this.factoryContract.buyTokens(tokenAddress, amount, maxACES);

      onStatus?.('Waiting for confirmation...');
      console.log('[BondingCurveSwapService] Buy tx sent:', buyTx.hash);

      const buyReceipt = await buyTx.wait();
      console.log('[BondingCurveSwapService] ✅ Buy confirmed');

      onStatus?.('Transaction complete!');

      return {
        success: true,
        hash: buyTx.hash,
        receipt: buyReceipt,
      };
    } catch (error) {
      console.error('[BondingCurveSwapService] ❌ Buy failed:', error);

      let errorMessage = 'Transaction failed';

      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('user denied')) {
          errorMessage = 'Transaction rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else if (error.message.includes('Did not send enough Aces tokens')) {
          errorMessage =
            'Price increased beyond slippage tolerance. Please try again with higher slippage.';
        } else if (error.message.includes('circuit breaker')) {
          errorMessage = 'Network congestion detected. Please try again in a few minutes.';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sell tokens on bonding curve
   * @param params - Sell parameters
   * @param params.tokenAddress - LaunchpadToken contract address
   * @param params.amount - Amount of tokens to sell (in wei)
   * @param params.onStatus - Optional callback for status updates
   * @returns Transaction result with hash and receipt
   */
  async sellTokens(params: {
    tokenAddress: string;
    amount: ethers.BigNumber;
    onStatus?: StatusCallback;
  }): Promise<TransactionResult> {
    const { tokenAddress, amount, onStatus } = params;

    try {
      console.log('[BondingCurveSwapService] Starting sell transaction...', {
        tokenAddress,
        amount: ethers.utils.formatEther(amount),
      });

      // Check token balance (need LaunchpadToken ABI)
      // For now, we'll trust the amount is valid
      // TODO: Add balance check when we integrate with tokenContract

      // Execute sell
      onStatus?.('Selling tokens...');
      console.log('[BondingCurveSwapService] Executing sell transaction...');

      const sellTx = await this.factoryContract.sellTokens(tokenAddress, amount);

      onStatus?.('Waiting for sell confirmation...');
      console.log('[BondingCurveSwapService] Sell tx sent:', sellTx.hash);

      const sellReceipt = await sellTx.wait();
      console.log('[BondingCurveSwapService] ✅ Sell confirmed');

      onStatus?.('Transaction complete!');

      return {
        success: true,
        hash: sellTx.hash,
        receipt: sellReceipt,
      };
    } catch (error) {
      console.error('[BondingCurveSwapService] ❌ Sell failed:', error);

      // Parse error message
      let errorMessage = 'Transaction failed';

      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('user denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient token balance';
        } else if (error.message.includes('circuit breaker')) {
          errorMessage = 'Network congestion detected. Please try again in a few minutes.';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Estimate gas for buying tokens with slippage
   * @param tokenAddress - LaunchpadToken contract address
   * @param amount - Amount of tokens to buy (in wei)
   * @param slippageBps - Slippage in basis points
   * @returns Estimated gas in wei
   */
  async estimateBuyGas(
    tokenAddress: string,
    amount: ethers.BigNumber,
    slippageBps: number,
  ): Promise<ethers.BigNumber> {
    try {
      const maxACES = await this.getFreshQuoteWithSlippage(tokenAddress, amount, slippageBps);

      const gasEstimate = await this.factoryContract.estimateGas.buyTokens(
        tokenAddress,
        amount,
        maxACES,
      );

      console.log('[BondingCurveSwapService] Gas estimate:', gasEstimate.toString());

      // Add 20% buffer for safety
      return gasEstimate.mul(120).div(100);
    } catch (error) {
      console.error('[BondingCurveSwapService] Failed to estimate gas:', error);
      return ethers.BigNumber.from('500000');
    }
  }
}
