import { ethers } from 'ethers';
import type { TransactionResult, StatusCallback } from '../types';
import { APPROVAL_CONFIRMATIONS } from '../constants';

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
   * Buy tokens on bonding curve
   * @param params - Buy parameters
   * @param params.tokenAddress - LaunchpadToken contract address
   * @param params.amount - Amount of tokens to buy (in wei)
   * @param params.maxPrice - Maximum ACES price willing to pay (in wei)
   * @param params.onStatus - Optional callback for status updates
   * @returns Transaction result with hash and receipt
   */
  async buyTokens(params: {
    tokenAddress: string;
    amount: ethers.BigNumber;
    maxPrice: ethers.BigNumber;
    onStatus?: StatusCallback;
  }): Promise<TransactionResult> {
    const { tokenAddress, amount, maxPrice, onStatus } = params;

    try {
      console.log('[BondingCurveSwapService] Starting buy transaction...', {
        tokenAddress,
        amount: ethers.utils.formatEther(amount),
        maxPrice: ethers.utils.formatEther(maxPrice),
      });

      // Get signer address
      const signer = this.factoryContract.signer;
      const address = await signer.getAddress();

      // Check current allowance
      const currentAllowance = await this.acesContract.allowance(address, this.factoryProxyAddress);
      console.log(
        '[BondingCurveSwapService] Current allowance:',
        ethers.utils.formatEther(currentAllowance),
      );

      // Check ACES balance
      const acesBalance = await this.acesContract.balanceOf(address);
      console.log('[BondingCurveSwapService] ACES balance:', ethers.utils.formatEther(acesBalance));

      if (acesBalance.lt(maxPrice)) {
        return {
          success: false,
          error: `Insufficient ACES balance. You need ${ethers.utils.formatEther(maxPrice)} but only have ${ethers.utils.formatEther(acesBalance)}`,
        };
      }

      // Step 1: Approve ACES tokens
      onStatus?.('Approving ACES tokens...');
      console.log('[BondingCurveSwapService] Requesting approval...');

      const approveTx = await this.acesContract.approve(this.factoryProxyAddress, maxPrice);

      onStatus?.('Waiting for approval confirmation...');
      console.log('[BondingCurveSwapService] Approval tx sent:', approveTx.hash);

      // Wait for multiple confirmations to avoid reorg issues
      const approvalReceipt = await approveTx.wait(APPROVAL_CONFIRMATIONS);
      console.log('[BondingCurveSwapService] ✅ Approval confirmed');

      // Step 2: Buy tokens
      onStatus?.('Buying tokens...');
      console.log('[BondingCurveSwapService] Executing buy transaction...');

      const buyTx = await this.factoryContract.buyTokens(tokenAddress, amount, maxPrice);

      onStatus?.('Waiting for buy confirmation...');
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

      // Parse error message
      let errorMessage = 'Transaction failed';

      if (error instanceof Error) {
        if (error.message.includes('user rejected') || error.message.includes('user denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
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

      // Get signer address
      const signer = this.factoryContract.signer;
      const address = await signer.getAddress();

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
   * Estimate gas for buying tokens
   * @param tokenAddress - LaunchpadToken contract address
   * @param amount - Amount of tokens to buy (in wei)
   * @returns Estimated gas in wei
   */
  async estimateBuyGas(tokenAddress: string, amount: ethers.BigNumber): Promise<ethers.BigNumber> {
    try {
      // Get buy price for the amount
      const buyPrice = await this.factoryContract.getBuyPriceAfterFee(tokenAddress, amount);

      // Estimate gas for the buy transaction
      const gasEstimate = await this.factoryContract.estimateGas.buyTokens(
        tokenAddress,
        amount,
        buyPrice,
      );

      console.log('[BondingCurveSwapService] Gas estimate:', gasEstimate.toString());

      // Add 20% buffer for safety
      return gasEstimate.mul(120).div(100);
    } catch (error) {
      console.error('[BondingCurveSwapService] Failed to estimate gas:', error);
      // Return a reasonable default (500k gas)
      return ethers.BigNumber.from('500000');
    }
  }
}
