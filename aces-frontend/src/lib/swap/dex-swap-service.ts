/**
 * DEX swap execution service for direct ACES/TOKEN swaps on Aerodrome.
 *
 * Supported routes only:
 * - ACES -> TOKEN
 * - TOKEN -> ACES
 *
 * Execution paths:
 * - V2 pools via Aerodrome Router
 * - Slipstream (CL) pools via Aerodrome Universal Router + Permit2
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  encodePacked,
  parseAbiParameters,
} from "viem";
import { AERODROME, CHAIN_ID, TOKENS } from "~/lib/contracts/addresses";
import { ERC20_ABI } from "~/lib/contracts/abis";
import { SWAP } from "~/lib/swap/constants";
import type { SwapHop, SwapRoute, TransactionResult } from "./types";

const V2_ROUTER_ABI = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
] as const;

const UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

const PERMIT2_ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const AERODROME_FACTORY = AERODROME.V2_FACTORY as Address;
const ACES_ADDRESS = TOKENS.ACES.address.toLowerCase() as Address;
const V3_SWAP_EXACT_IN = 0x00;
const CL_FACTORY_2_FLAG = 0x100000;
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = 281_474_976_710_655;
const PERMIT2_ALLOWANCE_TTL_SECONDS = SWAP.DEADLINE_SECONDS + 300;
const SUPPORTED_ROUTE_ERROR = "Only direct ACES/TOKEN swaps are supported right now";

export type StatusCallback = (status: string) => void;

interface SupportedRoute {
  hop: SwapHop;
  tokenIn: Address;
  tokenOut: Address;
}

export async function executeSwap(params: {
  route: SwapRoute;
  slippageBps: number;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<TransactionResult> {
  const { route, slippageBps, walletAddress, publicClient, walletClient, onStatus } = params;

  // Network selection is validated in the React hook via useAccount/useWalletClient.
  // Some connectors expose a usable wallet client while leaving walletClient.chain
  // unset or stale, so re-checking it here causes false "Switch to Base" failures.
  if (publicClient.chain?.id !== CHAIN_ID) {
    return { success: false, error: "Switch your wallet to Base mainnet to trade" };
  }

  if (
    slippageBps < SWAP.MIN_SLIPPAGE_BPS ||
    slippageBps > SWAP.MAX_SLIPPAGE_BPS
  ) {
    return { success: false, error: "Invalid slippage setting" };
  }

  if (!walletAddress) {
    return { success: false, error: "Wallet not connected" };
  }

  const amountOutMin =
    (route.estimatedOutputRaw * BigInt(10000 - slippageBps)) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP.DEADLINE_SECONDS);

  try {
    const supportedRoute = validateSupportedRoute(route);

    if (supportedRoute.hop.poolType === "cl") {
      return await executeSlipstreamSwap({
        route,
        supportedRoute,
        amountOutMin,
        deadline,
        walletAddress,
        publicClient,
        walletClient,
        onStatus,
      });
    }

    return await executeV2Swap({
      route,
      supportedRoute,
      amountOutMin,
      deadline,
      walletAddress,
      publicClient,
      walletClient,
      onStatus,
    });
  } catch (error) {
    console.error("[dex-swap] Swap failed:", error);
    return { success: false, error: parseSwapError(error) };
  }
}

function validateSupportedRoute(route: SwapRoute): SupportedRoute {
  if (route.inputAmountRaw <= 0n || route.estimatedOutputRaw <= 0n) {
    throw new Error("Invalid swap amount");
  }

  if (route.path.length !== 2 || route.hops.length !== 1) {
    throw new Error(SUPPORTED_ROUTE_ERROR);
  }

  const [tokenIn, tokenOut] = route.path;
  const [hop] = route.hops;

  if (
    hop.tokenIn.toLowerCase() !== tokenIn.toLowerCase() ||
    hop.tokenOut.toLowerCase() !== tokenOut.toLowerCase()
  ) {
    throw new Error("Swap route metadata is inconsistent");
  }

  const inputIsAces = tokenIn.toLowerCase() === ACES_ADDRESS;
  const outputIsAces = tokenOut.toLowerCase() === ACES_ADDRESS;

  if (inputIsAces === outputIsAces) {
    throw new Error(SUPPORTED_ROUTE_ERROR);
  }

  if (route.hasSlipstream !== (hop.poolType === "cl")) {
    throw new Error("Swap route metadata is inconsistent");
  }

  if (hop.poolType === "cl" && hop.tickSpacing <= 0) {
    throw new Error("Slipstream route is missing tick spacing");
  }

  return { hop, tokenIn, tokenOut };
}

async function executeV2Swap(params: {
  route: SwapRoute;
  supportedRoute: SupportedRoute;
  amountOutMin: bigint;
  deadline: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<TransactionResult> {
  const {
    route,
    supportedRoute,
    amountOutMin,
    deadline,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  } = params;

  const routerAddress = AERODROME.ROUTER as Address;
  const amountIn = route.inputAmountRaw;
  const routesArg = [
    {
      from: supportedRoute.hop.tokenIn,
      to: supportedRoute.hop.tokenOut,
      stable: supportedRoute.hop.stable,
      factory: AERODROME_FACTORY,
    },
  ];

  onStatus?.("Checking approvals...");
  await ensureAllowance({
    tokenAddress: supportedRoute.tokenIn,
    spenderAddress: routerAddress,
    amount: amountIn,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  });

  onStatus?.("Confirming swap...");
  await publicClient.simulateContract({
    address: routerAddress,
    abi: V2_ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, amountOutMin, routesArg, walletAddress, deadline],
    account: walletAddress,
  });

  const hash = await walletClient.writeContract({
    address: routerAddress,
    abi: V2_ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, amountOutMin, routesArg, walletAddress, deadline],
    chain: publicClient.chain,
    account: walletAddress,
  });

  onStatus?.("Waiting for confirmations...");
  await waitForSuccessfulReceipt({
    publicClient,
    hash,
    confirmations: SWAP.SWAP_CONFIRMATIONS,
    errorMessage: "Swap transaction reverted",
  });

  onStatus?.("Transaction confirmed!");
  return { success: true, hash };
}

async function executeSlipstreamSwap(params: {
  route: SwapRoute;
  supportedRoute: SupportedRoute;
  amountOutMin: bigint;
  deadline: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<TransactionResult> {
  const {
    route,
    supportedRoute,
    amountOutMin,
    deadline,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  } = params;

  const universalRouterAddress = AERODROME.UNIVERSAL_ROUTER as Address;
  const permit2Address = AERODROME.PERMIT2 as Address;
  const amountIn = route.inputAmountRaw;

  onStatus?.("Checking approvals...");
  await ensurePermit2Approval({
    tokenAddress: supportedRoute.tokenIn,
    permit2Address,
    amount: amountIn,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  });
  await ensurePermit2Allowance({
    tokenAddress: supportedRoute.tokenIn,
    permit2Address,
    spenderAddress: universalRouterAddress,
    amount: amountIn,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  });

  onStatus?.("Confirming swap...");
  const encodedPath = encodeCLPath(
    supportedRoute.tokenIn,
    supportedRoute.tokenOut,
    supportedRoute.hop.tickSpacing,
  );
  const swapInput = encodeV3SwapInput(
    walletAddress,
    amountIn,
    amountOutMin,
    encodedPath,
  );
  const commands = `0x0${V3_SWAP_EXACT_IN}` as `0x${string}`;

  await publicClient.simulateContract({
    address: universalRouterAddress,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [swapInput], deadline],
    account: walletAddress,
  });

  const hash = await walletClient.writeContract({
    address: universalRouterAddress,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [swapInput], deadline],
    chain: publicClient.chain,
    account: walletAddress,
  });

  onStatus?.("Waiting for confirmations...");
  await waitForSuccessfulReceipt({
    publicClient,
    hash,
    confirmations: SWAP.SWAP_CONFIRMATIONS,
    errorMessage: "Swap transaction reverted",
  });

  onStatus?.("Transaction confirmed!");
  return { success: true, hash };
}

async function ensureAllowance(params: {
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<void> {
  const {
    tokenAddress,
    spenderAddress,
    amount,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  } = params;

  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletAddress, spenderAddress],
  }) as bigint;

  if (allowance >= amount) return;

  await setExactErc20Allowance({
    tokenAddress,
    spenderAddress,
    desiredAllowance: amount,
    currentAllowance: allowance,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
    approvalStatus: "Approving token spending...",
    approvalError: "Approval transaction reverted",
  });
}

async function ensurePermit2Approval(params: {
  tokenAddress: Address;
  permit2Address: Address;
  amount: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<void> {
  const {
    tokenAddress,
    permit2Address,
    amount,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  } = params;

  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletAddress, permit2Address],
  }) as bigint;

  if (allowance >= amount) return;

  await setExactErc20Allowance({
    tokenAddress,
    spenderAddress: permit2Address,
    desiredAllowance: amount,
    currentAllowance: allowance,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
    approvalStatus: "Approving token for Permit2...",
    approvalError: "Permit2 approval reverted",
  });
}

async function ensurePermit2Allowance(params: {
  tokenAddress: Address;
  permit2Address: Address;
  spenderAddress: Address;
  amount: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
}): Promise<void> {
  const {
    tokenAddress,
    permit2Address,
    spenderAddress,
    amount,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
  } = params;

  const [currentAmount, expiration] = await publicClient.readContract({
    address: permit2Address,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [walletAddress, tokenAddress, spenderAddress],
  }) as [bigint, number, number];

  const now = Math.floor(Date.now() / 1000);
  const minimumExpiration = Math.min(now + SWAP.DEADLINE_SECONDS, MAX_UINT48);
  const desiredExpiration = Math.min(
    now + PERMIT2_ALLOWANCE_TTL_SECONDS,
    MAX_UINT48,
  );
  const permit2Amount = toPermit2Amount(amount);

  if (
    currentAmount >= permit2Amount &&
    expiration >= minimumExpiration
  ) {
    return;
  }

  onStatus?.("Granting Permit2 allowance...");
  const hash = await walletClient.writeContract({
    address: permit2Address,
    abi: PERMIT2_ABI,
    functionName: "approve",
    args: [tokenAddress, spenderAddress, permit2Amount, desiredExpiration],
    chain: publicClient.chain,
    account: walletAddress,
  });

  await waitForSuccessfulReceipt({
    publicClient,
    hash,
    confirmations: SWAP.APPROVAL_CONFIRMATIONS,
    errorMessage: "Permit2 allowance transaction reverted",
  });
}

async function setExactErc20Allowance(params: {
  tokenAddress: Address;
  spenderAddress: Address;
  desiredAllowance: bigint;
  currentAllowance: bigint;
  walletAddress: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  onStatus?: StatusCallback;
  approvalStatus: string;
  approvalError: string;
}): Promise<void> {
  const {
    tokenAddress,
    spenderAddress,
    desiredAllowance,
    currentAllowance,
    walletAddress,
    publicClient,
    walletClient,
    onStatus,
    approvalStatus,
    approvalError,
  } = params;

  // All platform tokens (ACES + RWA tokens) are standard ERC-20s that allow
  // overwriting a non-zero allowance directly. No reset-to-zero needed.
  onStatus?.(approvalStatus);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spenderAddress, desiredAllowance],
    chain: publicClient.chain,
    account: walletAddress,
  });

  onStatus?.("Confirming approval...");
  await waitForSuccessfulReceipt({
    publicClient,
    hash,
    confirmations: SWAP.APPROVAL_CONFIRMATIONS,
    errorMessage: approvalError,
  });
}

function toPermit2Amount(amount: bigint): bigint {
  if (amount <= 0n || amount > MAX_UINT160) {
    throw new Error("Invalid Permit2 allowance amount");
  }

  return amount;
}

async function waitForSuccessfulReceipt(params: {
  publicClient: PublicClient;
  hash: `0x${string}`;
  confirmations: number;
  errorMessage: string;
}) {
  const { publicClient, hash, confirmations, errorMessage } = params;
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations,
  });

  if (receipt.status !== "success") {
    throw new Error(errorMessage);
  }

  return receipt;
}

function encodeCLPath(
  tokenIn: Address,
  tokenOut: Address,
  tickSpacing: number,
): `0x${string}` {
  const fee = CL_FACTORY_2_FLAG | tickSpacing;
  return encodePacked(
    ["address", "uint24", "address"],
    [tokenIn, fee, tokenOut],
  );
}

function encodeV3SwapInput(
  recipient: Address,
  amountIn: bigint,
  amountOutMin: bigint,
  path: `0x${string}`,
): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters("address, uint256, uint256, bytes, bool"),
    [recipient, amountIn, amountOutMin, path, true],
  );
}

function parseSwapError(error: unknown): string {
  if (!(error instanceof Error)) return "Swap failed";

  const msg = error.message.toLowerCase();
  if (msg.includes("insufficient_output") || msg.includes("insufficient output")) {
    return "Received amount below minimum — try increasing slippage or reducing size";
  }
  if (msg.includes("user rejected") || msg.includes("user denied")) {
    return "Transaction was rejected";
  }
  if (msg.includes("insufficient funds")) {
    return "Insufficient balance to complete this swap";
  }
  if (msg.includes("switch your wallet to base")) {
    return "Switch your wallet to Base mainnet to trade";
  }
  if (msg.includes("only direct aces/token swaps are supported")) {
    return SUPPORTED_ROUTE_ERROR;
  }
  if (msg.includes("execution reverted")) {
    return "Swap reverted — may be due to low liquidity or price impact. Try refreshing.";
  }
  return error.message;
}
