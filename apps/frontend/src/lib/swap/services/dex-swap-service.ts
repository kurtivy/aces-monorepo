import { ethers } from 'ethers';
import type { TransactionResult, StatusCallback, DexQuoteResponse, PaymentAsset } from '../types';
import { SWAP_DEADLINE_BUFFER_SECONDS, SWAP_CONFIRMATIONS } from '../constants';
import { ERC20_ABI } from '@/lib/contracts/abi';

// Aerodrome V2 Router ABI - uses Route[] with {from,to,stable,factory}
const AERODROME_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
];

// Aerodrome Universal Router ABI
const UNIVERSAL_ROUTER_ABI = [
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
];

// Permit2 ABI (allowance-based, used by Universal Router)
const PERMIT2_ABI = [
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
];

const WETH_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// Aerodrome V2 Factory address on Base Mainnet
const AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// Universal Router command: V3_SWAP_EXACT_IN = 0x00
const V3_SWAP_EXACT_IN = 0x00;
// Flag OR'd with tickSpacing to signal the second CL factory (CL Pool Launcher)
const CL_FACTORY_2_FLAG = 0x100000;
// Max uint160 for Permit2 unlimited approval
const MAX_UINT160 = ethers.BigNumber.from(2).pow(160).sub(1);
// Far-future expiration for Permit2 allowance (~136 years from epoch)
const MAX_UINT48 = 2 ** 48 - 1;

/**
 * Service for executing DEX swaps via Aerodrome router.
 * Supports both V2 (classic AMM) and Slipstream (CL) pools.
 *
 * Slipstream swaps use the Aerodrome Universal Router + Permit2 because
 * the dedicated SwapRouter is wired to a different CL factory than the
 * one used by the CL Pool Launcher.
 */
export class DexSwapService {
  private routerContract: ethers.Contract;
  private walletAddress: string;
  private signer: ethers.Signer;
  private routerAddress: string;

  constructor(routerAddress: string, signer: ethers.Signer, walletAddress: string) {
    this.routerContract = new ethers.Contract(routerAddress, AERODROME_ROUTER_ABI, signer);
    this.walletAddress = walletAddress;
    this.signer = signer;
    this.routerAddress = routerAddress;
  }

  async executeSwap(params: {
    quote: DexQuoteResponse;
    paymentAsset: PaymentAsset;
    signer: ethers.Signer;
    onStatus?: StatusCallback;
  }): Promise<TransactionResult> {
    const { quote, paymentAsset, signer, onStatus } = params;

    try {
      if (!this.validateQuote(quote)) {
        return { success: false, error: 'Invalid quote data' };
      }

      if (quote.isSlipstream) {
        return await this.executeSlipstreamSwap(quote, paymentAsset, signer, onStatus);
      }
      return await this.executeV2Swap(quote, paymentAsset, signer, onStatus);
    } catch (error) {
      console.error('[DexSwapService] Swap failed:', error);
      return { success: false, error: this.parseSwapError(error) };
    }
  }

  // ================================================================
  // SLIPSTREAM (CL) SWAP via Universal Router + Permit2
  // ================================================================
  private async executeSlipstreamSwap(
    quote: DexQuoteResponse,
    paymentAsset: PaymentAsset,
    signer: ethers.Signer,
    onStatus?: StatusCallback,
  ): Promise<TransactionResult> {
    const addresses = (await import('@/lib/contracts/addresses')).getContractAddresses(8453);
    const universalRouterAddress = addresses.AERODROME_UNIVERSAL_ROUTER;
    const permit2Address = addresses.PERMIT2;

    if (!universalRouterAddress || !permit2Address) {
      return { success: false, error: 'Universal Router or Permit2 address not configured' };
    }

    const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;
    const amountIn = ethers.BigNumber.from(quote.inputAmountRaw);
    const amountOutMin = ethers.BigNumber.from(quote.minOutputRaw);
    const path = (quote.path || []).map((addr: string) => addr.toLowerCase());
    const routes = quote.routes || [];
    const isMultiHop = path.length > 2;
    const tickSpacing = quote.tickSpacing ?? 500;

    if (isMultiHop) {
      return await this.executeMultiHopSlipstreamSwap(
        quote,
        paymentAsset,
        signer,
        universalRouterAddress,
        permit2Address,
        tickSpacing,
        deadline,
        onStatus,
      );
    }

    // Direct swap: ACES ↔ TOKEN via CL pool through Universal Router
    const tokenIn = ethers.utils.getAddress(path[0]);
    const tokenOut = ethers.utils.getAddress(path[path.length - 1]);

    if (paymentAsset === 'ETH') {
      return await this.executeETHToTokenCL(
        quote,
        amountIn,
        amountOutMin,
        tickSpacing,
        deadline,
        signer,
        universalRouterAddress,
        permit2Address,
        onStatus,
      );
    }

    // ERC20 → TOKEN or TOKEN → ACES via CL
    const erc20 = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const balance = await erc20.balanceOf(this.walletAddress);
    if (balance.lt(amountIn)) {
      return {
        success: false,
        error: `Insufficient balance. Need ${ethers.utils.formatEther(amountIn)} but have ${ethers.utils.formatEther(balance)}`,
      };
    }

    // Ensure ERC20 → Permit2 approval, then Permit2 → Universal Router allowance
    onStatus?.('Checking approvals...');
    await this.ensurePermit2Approval(tokenIn, permit2Address, amountIn, signer, onStatus);
    await this.ensurePermit2Allowance(
      tokenIn,
      permit2Address,
      universalRouterAddress,
      signer,
      onStatus,
    );

    onStatus?.('Confirming swap...');

    const universalRouter = new ethers.Contract(
      universalRouterAddress,
      UNIVERSAL_ROUTER_ABI,
      signer,
    );

    // Encode V3_SWAP_EXACT_IN
    const encodedPath = this.encodeCLPath(tokenIn, tokenOut, tickSpacing);
    const swapInput = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [this.walletAddress, amountIn, amountOutMin, encodedPath, true],
    );

    const commands = ethers.utils.hexlify([V3_SWAP_EXACT_IN]);

    // Simulate
    try {
      await universalRouter.callStatic.execute(commands, [swapInput], deadline);
    } catch (simError: unknown) {
      const msg = ((simError as Error)?.message || '').toString();
      console.error('[DexSwapService] Universal Router simulation failed:', simError);
      return {
        success: false,
        error: msg.includes('INSUFFICIENT')
          ? 'Received amount below minimum (increase slippage or reduce size)'
          : 'Swap simulation failed — ' + (msg || 'unknown error'),
      };
    }

    const estimatedGas = await universalRouter.estimateGas.execute(
      commands,
      [swapInput],
      deadline,
    );
    const gasLimit = estimatedGas.mul(130).div(100);

    const tx = await universalRouter.execute(commands, [swapInput], deadline, {
      gasLimit: gasLimit.toNumber(),
    });

    onStatus?.(`Waiting for confirmations (1/${SWAP_CONFIRMATIONS})...`);
    const receipt = await tx.wait(SWAP_CONFIRMATIONS);
    onStatus?.('Transaction confirmed!');

    return { success: true, hash: tx.hash, receipt };
  }

  /**
   * Multi-hop: V2 legs first, then CL leg via Universal Router.
   * e.g., ETH → ACES (V2 Router) then ACES → TOKEN (Universal Router)
   */
  private async executeMultiHopSlipstreamSwap(
    quote: DexQuoteResponse,
    paymentAsset: PaymentAsset,
    signer: ethers.Signer,
    universalRouterAddress: string,
    permit2Address: string,
    tickSpacing: number,
    deadline: number,
    onStatus?: StatusCallback,
  ): Promise<TransactionResult> {
    const path = (quote.path || []).map((addr: string) => ethers.utils.getAddress(addr));
    const routes = quote.routes || [];
    const amountIn = ethers.BigNumber.from(quote.inputAmountRaw);
    const amountOutMin = ethers.BigNumber.from(quote.minOutputRaw);

    const v2Routes = routes.slice(0, -1);
    const v2Path = path.slice(0, path.length - 1);

    // Step 1: V2 leg(s)
    onStatus?.('Swapping to ACES...');

    const v2RoutesArg = v2Routes.map((r) => ({
      from: ethers.utils.getAddress(r.from),
      to: ethers.utils.getAddress(r.to),
      stable: Boolean(r.stable),
      factory: AERODROME_FACTORY,
    }));

    let v2Tx: ethers.ContractTransaction;
    if (paymentAsset === 'ETH') {
      v2Tx = await this.swapExactETHForTokens(
        ethers.BigNumber.from(0),
        v2RoutesArg,
        this.walletAddress,
        deadline,
        amountIn,
      );
    } else {
      const inputToken = v2Path[0];
      await this.ensureAllowance({
        tokenAddress: inputToken,
        spenderAddress: this.routerContract.address,
        amount: amountIn,
        signer,
        onStatus,
      });

      try {
        const gas = await this.routerContract.estimateGas.swapExactTokensForTokens(
          amountIn,
          ethers.BigNumber.from(0),
          v2RoutesArg,
          this.walletAddress,
          deadline,
        );
        v2Tx = await this.routerContract.swapExactTokensForTokens(
          amountIn,
          ethers.BigNumber.from(0),
          v2RoutesArg,
          this.walletAddress,
          deadline,
          { gasLimit: gas.mul(120).div(100).toNumber() },
        );
      } catch (err: unknown) {
        console.error('[DexSwapService] V2 leg failed:', err);
        return {
          success: false,
          error: 'First swap leg failed: ' + ((err as Error)?.message || 'unknown'),
        };
      }
    }

    onStatus?.('Waiting for first swap...');
    await v2Tx.wait(1);

    // Step 2: Get actual ACES balance received
    const acesAddress = v2Path[v2Path.length - 1];
    const acesContract = new ethers.Contract(acesAddress, ERC20_ABI, signer);
    const acesBalance = await acesContract.balanceOf(this.walletAddress);

    // Step 3: CL leg (ACES → TOKEN) via Universal Router
    onStatus?.('Swapping ACES to token...');

    const tokenOut = path[path.length - 1];

    await this.ensurePermit2Approval(acesAddress, permit2Address, acesBalance, signer, onStatus);
    await this.ensurePermit2Allowance(
      acesAddress,
      permit2Address,
      universalRouterAddress,
      signer,
      onStatus,
    );

    const universalRouter = new ethers.Contract(
      universalRouterAddress,
      UNIVERSAL_ROUTER_ABI,
      signer,
    );
    const encodedPath = this.encodeCLPath(acesAddress, tokenOut, tickSpacing);
    const swapInput = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [this.walletAddress, acesBalance, amountOutMin, encodedPath, true],
    );

    const commands = ethers.utils.hexlify([V3_SWAP_EXACT_IN]);

    try {
      await universalRouter.callStatic.execute(commands, [swapInput], deadline);
    } catch (simError: unknown) {
      const msg = ((simError as Error)?.message || '').toString();
      console.error('[DexSwapService] CL leg simulation failed:', simError);
      return {
        success: false,
        error: msg.includes('INSUFFICIENT')
          ? 'Final swap leg: received amount below minimum (increase slippage)'
          : 'Final swap leg simulation failed: ' + (msg || 'unknown'),
      };
    }

    const gas = await universalRouter.estimateGas.execute(commands, [swapInput], deadline);
    const tx = await universalRouter.execute(commands, [swapInput], deadline, {
      gasLimit: gas.mul(130).div(100).toNumber(),
    });

    onStatus?.(`Waiting for confirmations (1/${SWAP_CONFIRMATIONS})...`);
    const receipt = await tx.wait(SWAP_CONFIRMATIONS);
    onStatus?.('Transaction confirmed!');

    return { success: true, hash: tx.hash, receipt };
  }

  /**
   * ETH → TOKEN via CL: wrap ETH → WETH, then Universal Router swap.
   */
  private async executeETHToTokenCL(
    quote: DexQuoteResponse,
    amountIn: ethers.BigNumber,
    amountOutMin: ethers.BigNumber,
    tickSpacing: number,
    deadline: number,
    signer: ethers.Signer,
    universalRouterAddress: string,
    permit2Address: string,
    onStatus?: StatusCallback,
  ): Promise<TransactionResult> {
    const path = (quote.path || []).map((addr: string) => ethers.utils.getAddress(addr));
    const tokenOut = path[path.length - 1];

    // Wrap ETH → WETH
    onStatus?.('Wrapping ETH...');
    const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
    const wrapTx = await weth.deposit({ value: amountIn });
    await wrapTx.wait(1);

    // Approve Permit2 for WETH, then grant allowance to Universal Router
    await this.ensurePermit2Approval(WETH_ADDRESS, permit2Address, amountIn, signer, onStatus);
    await this.ensurePermit2Allowance(
      WETH_ADDRESS,
      permit2Address,
      universalRouterAddress,
      signer,
      onStatus,
    );

    onStatus?.('Confirming swap...');

    const universalRouter = new ethers.Contract(
      universalRouterAddress,
      UNIVERSAL_ROUTER_ABI,
      signer,
    );
    const encodedPath = this.encodeCLPath(WETH_ADDRESS, tokenOut, tickSpacing);
    const swapInput = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [this.walletAddress, amountIn, amountOutMin, encodedPath, true],
    );

    const commands = ethers.utils.hexlify([V3_SWAP_EXACT_IN]);

    try {
      await universalRouter.callStatic.execute(commands, [swapInput], deadline);
    } catch (simError: unknown) {
      const msg = ((simError as Error)?.message || '').toString();
      return {
        success: false,
        error: msg.includes('INSUFFICIENT')
          ? 'Received amount below minimum (increase slippage or reduce size)'
          : 'Swap simulation failed — ' + (msg || 'unknown error'),
      };
    }

    const gas = await universalRouter.estimateGas.execute(commands, [swapInput], deadline);
    const tx = await universalRouter.execute(commands, [swapInput], deadline, {
      gasLimit: gas.mul(130).div(100).toNumber(),
    });

    onStatus?.(`Waiting for confirmations (1/${SWAP_CONFIRMATIONS})...`);
    const receipt = await tx.wait(SWAP_CONFIRMATIONS);
    onStatus?.('Transaction confirmed!');

    return { success: true, hash: tx.hash, receipt };
  }

  // ================================================================
  // V2 (CLASSIC AMM) SWAP — unchanged logic
  // ================================================================
  private async executeV2Swap(
    quote: DexQuoteResponse,
    paymentAsset: PaymentAsset,
    signer: ethers.Signer,
    onStatus?: StatusCallback,
  ): Promise<TransactionResult> {
    const amountIn = ethers.BigNumber.from(quote.inputAmountRaw);
    const amountOutMin = ethers.BigNumber.from(quote.minOutputRaw);
    const path = (quote.path || []).map((addr: string) => ethers.utils.getAddress(addr));
    const deadline = Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS;

    const routesArg = (quote as any).routes
      ? (quote as any).routes.map((r: any) => ({
          from: ethers.utils.getAddress(r.from),
          to: ethers.utils.getAddress(r.to),
          stable: Boolean(r.stable),
          factory: AERODROME_FACTORY,
        }))
      : path.slice(0, -1).map((from, i) => ({
          from,
          to: path[i + 1],
          stable: false,
          factory: AERODROME_FACTORY,
        }));

    if (paymentAsset !== 'ETH') {
      const inputTokenAddress = path[0];
      const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
      const userBalance = await erc20Contract.balanceOf(this.walletAddress);
      if (userBalance.lt(amountIn)) {
        return {
          success: false,
          error: `Insufficient balance. Need ${ethers.utils.formatEther(amountIn)} but have ${ethers.utils.formatEther(userBalance)}`,
        };
      }
    }

    let tx: ethers.ContractTransaction;

    if (paymentAsset === 'ETH') {
      onStatus?.('Confirming swap...');

      try {
        await this.routerContract.callStatic.swapExactETHForTokens(
          amountOutMin,
          routesArg,
          this.walletAddress,
          deadline,
          { value: amountIn },
        );
      } catch (simError: unknown) {
        const msg = ((simError as Error)?.message || '').toString();
        console.error('[DexSwapService] Simulation failed (ETH->Token):', simError);
        return {
          success: false,
          error: msg.includes('INSUFFICIENT_OUTPUT') || msg.includes('insufficient output')
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
      const inputTokenAddress = (routesArg[0]?.from as string) || path[0];

      const approvalGranted = await this.ensureAllowance({
        tokenAddress: inputTokenAddress,
        spenderAddress: this.routerContract.address,
        amount: amountIn,
        signer,
        onStatus,
      });

      if (approvalGranted) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const erc20Contract = new ethers.Contract(inputTokenAddress, ERC20_ABI, signer);
        const finalAllowance = await erc20Contract.allowance(
          this.walletAddress,
          this.routerContract.address,
        );
        if (finalAllowance.lt(amountIn)) {
          throw new Error('Approval failed - insufficient allowance after approval transaction');
        }
      }

      onStatus?.('Preparing swap transaction...');

      try {
        await this.routerContract.callStatic.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          routesArg,
          this.walletAddress,
          deadline,
        );
      } catch (simError: unknown) {
        const msg = ((simError as Error)?.message || '').toString();
        console.error('[DexSwapService] Simulation failed (Token->Token):', simError);
        return {
          success: false,
          error: msg.includes('INSUFFICIENT_OUTPUT') || msg.includes('insufficient output')
            ? 'Received amount below minimum (increase slippage or reduce size)'
            : msg || 'Swap simulation failed',
        };
      }

      let estimatedGas;
      try {
        estimatedGas = await this.routerContract.estimateGas.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          routesArg,
          this.walletAddress,
          deadline,
        );
        const gasLimit = estimatedGas.mul(120).div(100);
        tx = await this.swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          routesArg,
          this.walletAddress,
          deadline,
          gasLimit.toNumber(),
        );
      } catch (gasError: unknown) {
        console.error('[DexSwapService] Gas estimation failed:', gasError);
        const msg = ((gasError as Error)?.message || '').toString();
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

    onStatus?.(`Waiting for confirmations (1/${SWAP_CONFIRMATIONS})...`);
    const receipt = await tx.wait(SWAP_CONFIRMATIONS);
    onStatus?.('Transaction confirmed!');

    return { success: true, hash: tx.hash, receipt };
  }

  // ================================================================
  // PATH ENCODING
  // ================================================================

  /**
   * Encode a CL path for the Universal Router.
   * Uses CL_FACTORY_2_FLAG to signal pools created by the CL Pool Launcher factory.
   */
  private encodeCLPath(tokenIn: string, tokenOut: string, tickSpacing: number): string {
    const fee = CL_FACTORY_2_FLAG | tickSpacing;
    return ethers.utils.solidityPack(
      ['address', 'uint24', 'address'],
      [tokenIn, fee, tokenOut],
    );
  }

  // ================================================================
  // PERMIT2 HELPERS
  // ================================================================

  /**
   * Ensure the token has granted ERC20 approval to Permit2.
   */
  private async ensurePermit2Approval(
    tokenAddress: string,
    permit2Address: string,
    amount: ethers.BigNumber,
    signer: ethers.Signer,
    onStatus?: StatusCallback,
  ): Promise<void> {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance: ethers.BigNumber = await erc20.allowance(this.walletAddress, permit2Address);

    if (allowance.gte(amount)) return;

    onStatus?.('Approving token for Permit2...');
    const tx = await erc20.approve(permit2Address, ethers.constants.MaxUint256);
    await tx.wait();
  }

  /**
   * Ensure Permit2 has granted an allowance for the Universal Router to spend the token.
   */
  private async ensurePermit2Allowance(
    tokenAddress: string,
    permit2Address: string,
    spenderAddress: string,
    signer: ethers.Signer,
    onStatus?: StatusCallback,
  ): Promise<void> {
    const permit2 = new ethers.Contract(permit2Address, PERMIT2_ABI, signer);
    const [currentAmount, expiration] = await permit2.allowance(
      this.walletAddress,
      tokenAddress,
      spenderAddress,
    );

    const now = Math.floor(Date.now() / 1000);
    if (ethers.BigNumber.from(currentAmount).gt(0) && expiration > now) return;

    onStatus?.('Granting Permit2 allowance...');
    const tx = await permit2.approve(tokenAddress, spenderAddress, MAX_UINT160, MAX_UINT48);
    await tx.wait();
  }

  // ================================================================
  // SHARED HELPERS
  // ================================================================

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

      if (allowance.gte(amount)) {
        return false;
      }

      const UNLIMITED_APPROVAL = ethers.constants.MaxUint256;
      onStatus?.('Approving token spending...');

      const approveTx = await erc20Contract.approve(spenderAddress, UNLIMITED_APPROVAL);
      onStatus?.('Confirming approval...');
      await approveTx.wait();

      return true;
    } catch (error) {
      console.error('[DexSwapService] Approval failed:', error);
      throw new Error('Token approval was rejected or failed');
    }
  }

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

  private parseSwapError(error: unknown): string {
    if (!(error instanceof Error)) return 'Swap failed';

    const msg = error.message.toLowerCase();
    if (msg.includes('insufficient_output')) {
      return 'Swap failed: received amount below minimum (check slippage or liquidity)';
    }
    if (msg.includes('user rejected') || msg.includes('user denied')) {
      return 'Transaction was rejected by user';
    }
    if (msg.includes('insufficient funds')) {
      return 'Insufficient balance to complete this swap';
    }
    if (msg.includes('execution reverted')) {
      return 'Swap transaction failed. This may be due to insufficient allowance, low liquidity, or price impact. Try refreshing and swapping again.';
    }
    return error.message;
  }
}
