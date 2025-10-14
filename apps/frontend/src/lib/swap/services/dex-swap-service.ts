import { ethers } from 'ethers';
import type { TransactionResult, StatusCallback, DexQuoteResponse, PaymentAsset } from '../types';
import { SWAP_DEADLINE_BUFFER_SECONDS } from '../constants';
import { ERC20_ABI } from '@/lib/contracts/abi';

// Aerodrome V2 Router ABI - uses Route[] with {from,to,stable,factory}
// Route struct requires factory address for Aerodrome V2
const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];

// Aerodrome Factory address on Base Mainnet
const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

/**
 * Service for executing DEX swaps via Aerodrome router
 * Handles token-to-token and ETH-to-token swaps with approval management
 */
export class DexSwapService {
  private routerContract: ethers.Contract;
  private walletAddress: string;

  constructor(routerAddress: string, signer: ethers.Signer, walletAddress: string) {
    this.routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
    this.walletAddress = walletAddress;
  }

  /**
   * Execute a DEX swap using a quote
   * @param params - Swap parameters
   * @param params.quote - Quote from DexApi containing path and amounts
   * @param params.paymentAsset - Input token (ACES, USDC, USDT, or ETH)
   * @param params.signer - Ethers signer for transaction signing
   * @param params.onStatus - Optional callback for status updates
   * @returns Transaction result with hash and receipt
   */
  async executeSwap(params: {
    quote: DexQuoteResponse;
    paymentAsset: PaymentAsset;
    signer: ethers.Signer;
    onStatus?: StatusCallback;
  }): Promise<TransactionResult> {
    const { quote, paymentAsset, signer, onStatus } = params;

    try {
      console.log('[DexSwapService] Starting swap...', {
        paymentAsset,
        inputAmount: quote.inputAmount,
        expectedOutput: quote.expectedOutput,
      });

      // Validate quote
      if (!this.validateQuote(quote)) {
        return {
          success: false,
          error: 'Invalid quote data',
        };
      }

      // Parse amounts
      const amountIn = ethers.BigNumber.from(quote.inputAmountRaw);
      const amountOutMin = ethers.BigNumber.from(quote.minOutputRaw);
      const path = (quote.path || []).map((addr: string) => ethers.utils.getAddress(addr));
      const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

      // Build Aerodrome Route[] from quote (prefer explicit routes with stable flags)
      // Aerodrome V2 requires factory address in each route
      const routesArg = (quote as any).routes
        ? (quote as any).routes.map((r: any) => ({
            from: ethers.utils.getAddress(r.from),
            to: ethers.utils.getAddress(r.to),
            stable: Boolean(r.stable),
            factory: AERODROME_FACTORY,
          }))
        : // Fallback: derive simple routes from address path (assume volatile)
          path.slice(0, -1).map((from, i) => ({
            from,
            to: path[i + 1],
            stable: false,
            factory: AERODROME_FACTORY,
          }));

      console.log('[DexSwapService] Swap parameters:', {
        path,
        amountIn: ethers.utils.formatEther(amountIn),
        amountOutMin: ethers.utils.formatEther(amountOutMin),
        deadline: new Date(deadline * 1000).toISOString(),
      });

      // Verify balance for token swaps
      if (paymentAsset !== 'ETH') {
        const inputTokenAddress = path[0];
        const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
        const userBalance = await erc20Contract.balanceOf(this.walletAddress);

        console.log('[DexSwapService] Balance check:', {
          token: inputTokenAddress,
          userBalance: ethers.utils.formatEther(userBalance),
          required: ethers.utils.formatEther(amountIn),
        });

        if (userBalance.lt(amountIn)) {
          return {
            success: false,
            error: `Insufficient balance. You need ${ethers.utils.formatEther(amountIn)} but only have ${ethers.utils.formatEther(userBalance)}`,
          };
        }
      }

      let tx: ethers.ContractTransaction;

      // Handle ETH vs token swaps
      if (paymentAsset === 'ETH') {
        // ETH -> Token swap
        console.log('[DexSwapService] Executing ETH -> Token swap');
        onStatus?.('Confirming swap...');

        // Preflight simulate to catch clear revert message before sending
        try {
          await this.routerContract.callStatic.swapExactETHForTokens(
            amountOutMin,
            routesArg,
            this.walletAddress,
            deadline,
            { value: amountIn },
          );
        } catch (simError: any) {
          const msg = (simError?.message || '').toString();
          console.error('[DexSwapService] Simulation failed (ETH->Token):', simError);
          return {
            success: false,
            error:
              msg.includes('INSUFFICIENT_OUTPUT') || msg.includes('insufficient output')
                ? 'Received amount below minimum (increase slippage or reduce size)'
                : msg || 'Swap simulation failed',
          };
        }

        tx = await this.swapExactETHForTokens(
          amountOutMin,
          routesArg,
          this.walletAddress,
          deadline,
          amountIn,
        );
      } else {
        // Token -> Token swap (requires approval)
        const inputTokenAddress = (routesArg[0]?.from as string) || path[0];
        console.log('[DexSwapService] Checking/requesting approval for token:', inputTokenAddress);

        const approvalGranted = await this.ensureAllowance({
          tokenAddress: inputTokenAddress,
          spenderAddress: this.routerContract.address,
          amount: amountIn,
          signer,
          onStatus,
        });

        if (approvalGranted) {
          console.log('[DexSwapService] Approval granted, waiting for blockchain confirmation...');
          // Wait a moment for approval to propagate
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Verify approval was successful
          const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
          const finalAllowance = await erc20Contract.allowance(
            this.walletAddress,
            this.routerContract.address,
          );
          console.log(
            '[DexSwapService] Final allowance after approval:',
            ethers.utils.formatEther(finalAllowance),
          );

          if (finalAllowance.lt(amountIn)) {
            throw new Error('Approval failed - insufficient allowance after approval transaction');
          }
        }

        onStatus?.('Preparing swap transaction...');
        console.log('[DexSwapService] Executing Token -> Token swap');

        // Preflight simulate to catch revert reasons before estimating/sending
        try {
          await this.routerContract.callStatic.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            routesArg,
            this.walletAddress,
            deadline,
          );
        } catch (simError: any) {
          const msg = (simError?.message || '').toString();
          console.error('[DexSwapService] Simulation failed (Token->Token):', simError);
          return {
            success: false,
            error:
              msg.includes('INSUFFICIENT_OUTPUT') || msg.includes('insufficient output')
                ? 'Received amount below minimum (increase slippage or reduce size)'
                : msg || 'Swap simulation failed',
          };
        }

        // Estimate gas first to catch any potential issues
        let estimatedGas;
        try {
          estimatedGas = await this.routerContract.estimateGas.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            routesArg,
            this.walletAddress,
            deadline,
          );
          console.log('[DexSwapService] Gas estimate:', estimatedGas.toString());
          // Add 20% buffer to gas estimate
          const gasLimit = estimatedGas.mul(120).div(100);

          tx = await this.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            routesArg,
            this.walletAddress,
            deadline,
            gasLimit.toNumber(),
          );
        } catch (gasError: any) {
          console.error('[DexSwapService] Gas estimation failed:', gasError);
          const msg = (gasError?.message || '').toString();
          let userMsg = 'Swap failed during gas estimation';
          if (msg.includes('INSUFFICIENT_OUTPUT')) {
            userMsg = 'Received amount below minimum (increase slippage or reduce size)';
          } else if (msg.includes('INSUFFICIENT_LIQUIDITY')) {
            userMsg = 'Insufficient liquidity in the pool for this swap';
          } else if (msg.includes('EXPIRED')) {
            userMsg = 'Transaction deadline expired - please try again';
          }
          return { success: false, error: userMsg };
        }
      }

      console.log('[DexSwapService] Swap transaction sent:', tx.hash);
      onStatus?.('Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log('[DexSwapService] ✅ Swap confirmed');

      onStatus?.('Swap confirmed!');

      return {
        success: true,
        hash: tx.hash,
        receipt,
      };
    } catch (error) {
      console.error('[DexSwapService] ❌ Swap failed:', error);

      // Parse error message
      let errorMessage = 'Swap failed';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        if (msg.includes('insufficient_output')) {
          errorMessage = 'Swap failed: received amount below minimum (check slippage or liquidity)';
        } else if (msg.includes('user rejected') || msg.includes('user denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (msg.includes('insufficient funds')) {
          errorMessage = 'Insufficient balance to complete this swap';
        } else if (msg.includes('execution reverted')) {
          errorMessage =
            'Swap transaction failed. This may be due to insufficient allowance, low liquidity, or price impact. Try refreshing and swapping again.';
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
   * Ensure token allowance for router, approve if needed
   * Uses unlimited approval to avoid repeated approvals (same as bonding curve)
   * @param params - Allowance parameters
   * @returns True if approval transaction was sent, false if sufficient allowance exists
   */
  async ensureAllowance(params: {
    tokenAddress: string;
    spenderAddress: string;
    amount: ethers.BigNumber;
    signer: ethers.Signer;
    onStatus?: StatusCallback;
  }): Promise<boolean> {
    const { tokenAddress, spenderAddress, amount, signer, onStatus } = params;

    try {
      const erc20Contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowance: ethers.BigNumber = await erc20Contract.allowance(
        this.walletAddress,
        spenderAddress,
      );

      const UNLIMITED_APPROVAL = ethers.constants.MaxUint256;

      console.log('[DexSwapService] Checking allowance:', {
        token: tokenAddress,
        spender: spenderAddress,
        currentAllowance: ethers.utils.formatEther(allowance),
        requiredAmount: ethers.utils.formatEther(amount),
        hasUnlimitedApproval: allowance.eq(UNLIMITED_APPROVAL),
      });

      // Check if current approval is sufficient
      if (allowance.gte(amount)) {
        console.log('[DexSwapService] Sufficient allowance already exists');
        return false; // No approval needed
      }

      console.log('[DexSwapService] Requesting UNLIMITED approval from user...');
      onStatus?.('Approving unlimited token spending...');

      // Use unlimited approval (same as bonding curve)
      const approveTx = await erc20Contract.approve(spenderAddress, UNLIMITED_APPROVAL);
      onStatus?.('Confirming approval...');

      await approveTx.wait();
      console.log('[DexSwapService] ✅ Unlimited approval confirmed');

      return true; // Approval was granted
    } catch (error) {
      console.error('[DexSwapService] ❌ Approval failed:', error);
      throw new Error('Token approval was rejected or failed');
    }
  }

  /**
   * Execute token-to-token swap
   * @private
   */
  private async swapExactTokensForTokens(
    amountIn: ethers.BigNumber,
    amountOutMin: ethers.BigNumber,
    routes: Array<{ from: string; to: string; stable: boolean }>,
    to: string,
    deadline: number,
    gasLimit?: number,
  ): Promise<ethers.ContractTransaction> {
    const options = gasLimit ? { gasLimit } : {};
    return await this.routerContract.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      routes,
      to,
      deadline,
      options,
    );
  }

  /**
   * Execute ETH-to-token swap
   * @private
   */
  private async swapExactETHForTokens(
    amountOutMin: ethers.BigNumber,
    routes: Array<{ from: string; to: string; stable: boolean }>,
    to: string,
    deadline: number,
    value: ethers.BigNumber,
  ): Promise<ethers.ContractTransaction> {
    return await this.routerContract.swapExactETHForTokens(amountOutMin, routes, to, deadline, {
      value,
    });
  }

  /**
   * Validate quote has required fields
   * @private
   */
  private validateQuote(quote: DexQuoteResponse): boolean {
    return Boolean(
      quote.inputAmountRaw &&
        quote.minOutputRaw &&
        (((quote as any).routes &&
          Array.isArray((quote as any).routes) &&
          (quote as any).routes.length > 0) ||
          (quote.path && Array.isArray(quote.path) && quote.path.length > 0)),
    );
  }
}
