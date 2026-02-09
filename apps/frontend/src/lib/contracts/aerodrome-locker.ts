import { ethers } from 'ethers';
import { getContractAddresses } from './addresses';

// Velodrome/Aerodrome CLPoolLauncher: single launch() that creates pool, mints LP, and optionally
// locks via LockerFactory. See:
// - https://github.com/velodrome-finance/pool-launcher/blob/main/src/extensions/cl/CLPoolLauncher.sol
// - Locker: https://github.com/velodrome-finance/pool-launcher/blob/main/src/Locker.sol
// LockerFactory.lock(_lp, _lockUntil, _beneficiary, _beneficiaryShare, _bribeableShare, _owner)
// uses beneficiary/bribeableShare; standard CLPoolLauncher hardcodes them in the contract.

const CL_POOL_LAUNCHER_ABI = [
  `function launch(
    (address poolLauncherToken, address tokenToPair, int24 tickSpacing,
     (uint256 amountPoolLauncherToken, uint256 amountTokenToPair, uint256 amountPoolLauncherTokenMin, uint256 amountTokenToPairMin,
      uint160 initialSqrtPriceX96, int24 tickLower, int24 tickUpper, uint32 lockDuration) liquidity
    ) params,
    address recipient
  ) external returns (
    (uint32 createdAt, address pool, address poolLauncherToken, address tokenToPair) poolInfo,
    address locker
  )`,
  'function getPool(address tokenA, address tokenB, int24 tickSpacing) external view returns (address)',
  'function lockerFactory() external view returns (address)',
  'function isPairableToken(address _token) external view returns (bool)',
];

const LOCKER_ABI = [
  'function setBribeableShare(uint16 _bribeableShare) external',
  'function bribe(uint16 _percentage) external',
  'function owner() external view returns (address)',
  'function lockedUntil() external view returns (uint32)',
  'function beneficiary() external view returns (address)',
  'function beneficiaryShare() external view returns (uint16)',
  'function bribeableShare() external view returns (uint16)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

/** Basis points: 10000 = 100% */
export const MAX_BPS = 10_000;

export interface LaunchParams {
  /** Token being launched (e.g. RWA token) */
  poolLauncherToken: string;
  /** Token to pair with (e.g. ACES) */
  tokenToPair: string;
  /** CL pool tick spacing (e.g. 1, 10, 60, 200) */
  tickSpacing: number;
  /** Liquidity and lock parameters */
  liquidity: LiquidityParams;
}

export interface LiquidityParams {
  amountPoolLauncherToken: string; // wei
  amountTokenToPair: string; // wei
  amountPoolLauncherTokenMin: string;
  amountTokenToPairMin: string;
  /** Initial price as sqrtPriceX96 (see encodeSqrtPriceX96) */
  initialSqrtPriceX96: string;
  tickLower: number;
  tickUpper: number;
  /** Lock duration in seconds; 0 = no lock, max uint32 = permanent */
  lockDuration: number;
}

/**
 * Encode price as sqrtPriceX96 for CL pools.
 * sqrtPriceX96 = sqrt(price) * 2^96 where price = (reserve1/reserve0) in token1 per token0.
 * For token0 = poolLauncherToken, token1 = tokenToPair: price = amountTokenToPair/amountPoolLauncherToken (in raw units).
 */
export function encodeSqrtPriceX96(
  amountToken0: ethers.BigNumber,
  amountToken1: ethers.BigNumber,
): ethers.BigNumber {
  // price = token1/token0; sqrtPrice = sqrt(price); sqrtPriceX96 = sqrtPrice * 2^96
  // Use fixed-point: price = (amountToken1 << 192) / amountToken0, then sqrt
  if (amountToken0.isZero()) throw new Error('amountToken0 must be > 0');
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const price = amountToken1.mul(ethers.BigNumber.from(2).pow(192)).div(amountToken0);
  const sqrtPrice = bigNumberSqrt(price);
  return sqrtPrice.mul(Q96).div(ethers.BigNumber.from(2).pow(96));
}

function bigNumberSqrt(x: ethers.BigNumber): ethers.BigNumber {
  if (x.isZero()) return ethers.BigNumber.from(0);
  let z = x.add(1).div(2);
  let y = x;
  while (z.lt(y)) {
    y = z;
    z = x.div(z).add(z).div(2);
  }
  return y;
}

export interface LaunchResult {
  poolAddress: string;
  lockerAddress: string;
  poolLauncherToken: string;
  tokenToPair: string;
  txHash: string;
}

/**
 * Launch a CL pool via Aerodrome/Velodrome CLPoolLauncher: creates pool (if needed), mints LP,
 * and if lockDuration > 0 locks via LockerFactory with _lockUntil, _beneficiary, _beneficiaryShare, _bribeableShare.
 * Note: Many deployed launchers hardcode beneficiary=0, beneficiaryShare=0, bribeableShare=500 (5%).
 * After launch you can call setBribeableShare(percentage) on the returned locker if the contract allows.
 * @param options.skipSimulation - If true, skip callStatic and send the tx (e.g. to get a tx hash to inspect on Basescan when simulation always reverts).
 * @param options.gasLimit - Manual gas limit when skipSimulation is true (default 2200000; successful launch uses ~1.03M).
 * @param options.maxFeePerGas - EIP-1559 max fee per gas (wei). Use with maxPriorityFeePerGas to increase chance of tx being mined.
 * @param options.maxPriorityFeePerGas - EIP-1559 priority fee per gas (wei).
 * @param options.nonce - Explicit nonce for the launch tx (e.g. from getTransactionCount after prior txs) to avoid gaps/reuse.
 */
export async function launchCLPool(
  signer: ethers.Signer,
  params: LaunchParams,
  recipient: string,
  chainId: number = 8453,
  options?: {
    skipSimulation?: boolean;
    gasLimit?: number;
    maxFeePerGas?: ethers.BigNumberish;
    maxPriorityFeePerGas?: ethers.BigNumberish;
    nonce?: number;
  },
): Promise<LaunchResult> {
  const addresses = getContractAddresses(chainId);
  const launcherAddress = addresses.AERODROME_CL_POOL_LAUNCHER;

  if (!launcherAddress || launcherAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('CLPoolLauncher address not configured for this network');
  }

  const launcher = new ethers.Contract(launcherAddress, CL_POOL_LAUNCHER_ABI, signer);

  const amountA = ethers.BigNumber.from(params.liquidity.amountPoolLauncherToken);
  const amountB = ethers.BigNumber.from(params.liquidity.amountTokenToPair);
  // CL pool uses token0 < token1 by address. sqrtPriceX96 must be "price of token1 in terms of token0".
  const poolLauncherIsToken0 =
    params.poolLauncherToken.toLowerCase() < params.tokenToPair.toLowerCase();
  const amountToken0 = poolLauncherIsToken0 ? amountA : amountB;
  const amountToken1 = poolLauncherIsToken0 ? amountB : amountA;
  const sqrtPriceX96 = params.liquidity.initialSqrtPriceX96
    ? ethers.BigNumber.from(params.liquidity.initialSqrtPriceX96)
    : encodeSqrtPriceX96(amountToken0, amountToken1);

  const liquidityStruct = [
    params.liquidity.amountPoolLauncherToken,
    params.liquidity.amountTokenToPair,
    params.liquidity.amountPoolLauncherTokenMin,
    params.liquidity.amountTokenToPairMin,
    sqrtPriceX96,
    params.liquidity.tickLower,
    params.liquidity.tickUpper,
    params.liquidity.lockDuration,
  ];

  const launchParams = [
    params.poolLauncherToken,
    params.tokenToPair,
    params.tickSpacing,
    liquidityStruct,
  ];

  const skipSimulation = options?.skipSimulation === true;
  const gasLimit = options?.gasLimit ?? 2200000;
  const txOverrides: {
    gasLimit: number;
    maxFeePerGas?: ethers.BigNumber;
    maxPriorityFeePerGas?: ethers.BigNumber;
    nonce?: number;
  } = {
    gasLimit,
  };
  if (options?.maxFeePerGas != null)
    txOverrides.maxFeePerGas = ethers.BigNumber.from(options.maxFeePerGas);
  if (options?.maxPriorityFeePerGas != null)
    txOverrides.maxPriorityFeePerGas = ethers.BigNumber.from(options.maxPriorityFeePerGas);
  if (options?.nonce != null) txOverrides.nonce = options.nonce;

  // Simulate first to get a clear revert reason if the tx would fail (unless skipSimulation).
  // Use explicit gasLimit so nodes with low estimateGas caps (e.g. 482309) don't fail the simulation.
  if (!skipSimulation) {
    try {
      await launcher.callStatic.launch(launchParams, recipient, { gasLimit });
    } catch (staticErr: unknown) {
      const err = staticErr as {
        reason?: string;
        error?: { message?: string; data?: string; error?: { data?: string } };
        data?: string;
        message?: string;
      };
      // Try multiple places providers put revert data (ethers / RPC responses vary)
      const rawData =
        typeof err.data === 'string' && err.data.length >= 10
          ? err.data
          : typeof err.error?.data === 'string' && err.error.data.length >= 10
            ? err.error.data
            : typeof err.error?.error?.data === 'string' && err.error.error.data.length >= 10
              ? err.error.error.data
              : null;
      const revertData = rawData;

      let reason: string | undefined;
      if (err.reason && !err.reason.includes('missing revert data')) {
        reason = err.reason;
      } else if (revertData?.startsWith('0x08c379a0')) {
        try {
          const decoded = ethers.utils.defaultAbiCoder.decode(
            ['string'],
            '0x' + revertData.slice(10),
          );
          reason = decoded[0] as string;
        } catch {
          // ignore
        }
      } else if (revertData && revertData.length >= 10) {
        const selector = revertData.slice(0, 10);
        // Known Velodrome/Aerodrome CL Pool Launcher errors (from IPoolLauncher.sol)
        const knownErrors: Record<string, string> = {
          '0xc1ab6dc1':
            "InvalidToken – the token to pair (e.g. ACES) is not in the launcher's pairable-token whitelist. The launcher owner must call addPairableToken(tokenAddress) to allow pairing with this token.",
          '0xa3574ebc':
            'InvalidPoolLauncherToken – the pool launcher token is in the pairable list (cannot launch a whitelisted token as the new token).',
          '0x03119322':
            'PoolAlreadyExists – a pool for this token pair and tick spacing already exists.',
        };
        reason =
          knownErrors[selector] ??
          `contract reverted with custom error (selector: ${selector}). See 4byte.directory or contract ABI to identify.`;
      }

      const rawMessage = err.message ?? err.error?.message ?? String(staticErr);
      const isMissingRevertData =
        !reason &&
        (rawMessage.includes('missing revert data') ||
          rawMessage.includes('without a reason string'));

      const msg = reason
        ? `Launch would revert: ${reason}`
        : isMissingRevertData
          ? [
              'Launch would revert; the RPC did not return a revert reason.',
              'Common causes:',
              '• Insufficient token allowance – ensure both tokens are approved for the launcher',
              '• Insufficient balance – check you have enough of both tokens',
              '• Initial price outside tick range – tickLower/tickUpper must contain the price implied by your amounts',
              '• Wrong network or launcher address – confirm you are on Base and the CL Pool Launcher is correct',
              'Try approving max for both tokens, double-check amounts, then try again.',
            ].join(' ')
          : `Launch would revert. ${rawMessage}`;

      // Attach debug info for shareable error reports (always include context)
      const debugBlock =
        `\n\n--- Share with team (for debugging) ---\n` +
        (revertData && revertData.length >= 10
          ? `Error selector: ${revertData.slice(0, 10)}\nRaw revert data: ${revertData}\n`
          : `Revert data: ${revertData ?? 'none (RPC did not return)'}\n`) +
        `Launcher: ${launcherAddress}\n` +
        `poolLauncherToken: ${params.poolLauncherToken}\n` +
        `tokenToPair: ${params.tokenToPair}\n` +
        `Chain: Base (8453)\n` +
        `---`;

      const fullMsg = msg + debugBlock;
      const errObj = new Error(fullMsg);
      (errObj as { revertData?: string; selector?: string }).revertData = revertData ?? undefined;
      (errObj as { revertData?: string; selector?: string }).selector = revertData
        ? revertData.slice(0, 10)
        : undefined;
      throw errObj;
    }
  }

  let tx: ethers.ContractTransaction | undefined;
  let receipt: ethers.ContractReceipt | undefined;
  try {
    if (skipSimulation) {
      // Build and send without estimateGas so the tx is always broadcast (even if it will revert).
      // Otherwise ethers may run estimateGas first, which reverts, and the launch tx never gets sent.
      const populated = await launcher.populateTransaction.launch(launchParams, recipient);
      const sendTx = {
        to: populated.to,
        data: populated.data,
        gasLimit: txOverrides.gasLimit,
        ...(txOverrides.maxFeePerGas != null && { maxFeePerGas: txOverrides.maxFeePerGas }),
        ...(txOverrides.maxPriorityFeePerGas != null && {
          maxPriorityFeePerGas: txOverrides.maxPriorityFeePerGas,
        }),
        ...(txOverrides.nonce != null && { nonce: txOverrides.nonce }),
      };
      tx = await signer.sendTransaction(sendTx);
    } else {
      tx = await launcher.launch(launchParams, recipient, {});
    }
    // Wait for 0 confirmations so we get the receipt as soon as the tx is in a block (reduces chance of timeout before mined)
    const awaited = await tx!.wait(0);
    receipt = awaited ?? undefined;
    // If tx reverted (status 0) or receipt is null, throw so we handle it in catch and show tx hash
    if (!receipt || receipt.status === 0) {
      const hash = tx?.hash;
      throw Object.assign(new Error('Launch reverted on-chain.'), {
        transactionHash: hash,
        receipt: receipt ?? null,
      });
    }
  } catch (sendErr: unknown) {
    const err = sendErr as {
      transaction?: { hash?: string };
      transactionHash?: string;
      receipt?: { transactionHash?: string; status?: number; blockNumber?: number };
      data?: string;
      error?: { data?: string };
    };
    // Use the hash of the tx we just sent (most reliable); fall back to error props.
    const hash =
      tx?.hash ??
      err.transaction?.hash ??
      (err as { transactionHash?: string }).transactionHash ??
      err.receipt?.transactionHash;
    const receipt = err.receipt;
    const mined = !!receipt && typeof receipt.blockNumber === 'number';
    const revertData =
      (typeof err.data === 'string' && err.data.length >= 10 ? err.data : null) ??
      (typeof err.error?.data === 'string' && err.error.data.length >= 10 ? err.error.data : null);
    const selector = revertData ? revertData.slice(0, 10) : null;

    let debugBlock = '';
    if (revertData || hash) {
      debugBlock =
        `\n\n--- Share with team (for debugging) ---\n` +
        (hash ? `Tx hash: ${hash}\nBasescan: https://basescan.org/tx/${hash}\n` : '') +
        (mined
          ? `Tx was mined (block ${receipt!.blockNumber}) and reverted.\n`
          : 'Tx may have been dropped (not mined); hash may not appear on Basescan.\n') +
        (revertData ? `Error selector: ${selector}\nRaw revert data: ${revertData}\n` : '') +
        `Launcher: ${launcherAddress}\n` +
        `poolLauncherToken: ${params.poolLauncherToken}\n` +
        `tokenToPair: ${params.tokenToPair}\n` +
        `Chain: Base (8453)\n` +
        `---`;
    }

    if (hash) {
      const txHashStr = typeof hash === 'string' ? hash : undefined;
      const link = txHashStr ? `https://basescan.org/tx/${txHashStr}` : 'https://basescan.org';
      const baseMsg = mined
        ? `Launch reverted on-chain. View tx: ${link} (Base mainnet).`
        : `Launch failed. Tx hash: ${link} (Base mainnet). If Basescan says this transaction is not found, the tx was dropped (never included in a block). Try again with a higher gas price or check wallet nonce; or run with dryRun: true to see the revert reason from simulation.`;
      throw new Error(baseMsg + debugBlock);
    }
    throw sendErr;
  }

  // Launch(address indexed poolLauncherToken, address indexed pool, address indexed sender, PoolLauncherPool poolLauncherPool)
  let poolAddress = '';
  let lockerAddress = '';
  const logs = receipt?.logs ?? [];
  const launchTopic = ethers.utils.id(
    'Launch(address,address,address,(uint32,address,address,address))',
  );
  const launchLog = logs.find((log: { topics: string[] }) => log.topics[0] === launchTopic);
  if (launchLog && launchLog.topics && launchLog.topics[2]) {
    poolAddress = ethers.utils.getAddress('0x' + launchLog.topics[2].slice(26));
  }
  if (!poolAddress && launchLog && launchLog.data) {
    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['tuple(uint32 createdAt, address pool, address poolLauncherToken, address tokenToPair)'],
      launchLog.data,
    );
    if (decoded[0]?.pool) poolAddress = decoded[0].pool;
  }
  // Locker address is not in Launch event; it's the return value of launch(). Try to read from a subsequent log (e.g. LockerFactory).
  const lockerFactoryAddress = await launcher.lockerFactory?.().catch(() => null);
  if (lockerFactoryAddress && logs.length > 0) {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].address?.toLowerCase() === lockerFactoryAddress?.toLowerCase() && logs[i].data) {
        try {
          const iface = new ethers.utils.Interface([
            'event LockerCreated(address locker, address owner)',
          ]);
          const parsed = iface.parseLog(logs[i]);
          if (parsed?.args?.locker) {
            lockerAddress = parsed.args.locker;
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  if (!poolAddress) {
    throw new Error(
      'Launch succeeded but pool address not found in receipt. Check the transaction on block explorer.',
    );
  }

  return {
    poolAddress,
    lockerAddress: lockerAddress || ethers.constants.AddressZero,
    poolLauncherToken: params.poolLauncherToken,
    tokenToPair: params.tokenToPair,
    txHash: receipt!.transactionHash,
  };
}

/**
 * Set bribeable share on an existing Locker (0–10000 bps).
 * Only callable by Locker owner.
 */
export async function setLockerBribeableShare(
  signer: ethers.Signer,
  lockerAddress: string,
  bribeableShareBps: number,
  chainId: number = 8453,
): Promise<{ txHash: string }> {
  if (bribeableShareBps < 0 || bribeableShareBps > MAX_BPS) {
    throw new Error(`bribeableShare must be 0-${MAX_BPS} (basis points)`);
  }
  const locker = new ethers.Contract(lockerAddress, LOCKER_ABI, signer);
  const tx = await locker.setBribeableShare(bribeableShareBps);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash };
}

/**
 * Call bribe(percentage) on Locker to send up to bribeableShare of fees/rewards to the bribe contract.
 * Only callable by Locker owner.
 */
export async function lockerBribe(
  signer: ethers.Signer,
  lockerAddress: string,
  percentageBps: number,
  chainId: number = 8453,
): Promise<{ txHash: string }> {
  const locker = new ethers.Contract(lockerAddress, LOCKER_ABI, signer);
  const tx = await locker.bribe(percentageBps);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash };
}

// --- Legacy names for backward compatibility (deprecated) ---

export interface CreatePoolParams {
  tokenA: string;
  tokenB: string;
  stable: boolean;
}

/**
 * @deprecated Use launchCLPool() instead. CLPoolLauncher does not expose createPool(tokenA,tokenB,stable);
 * it uses launch(LaunchParams, recipient) which creates pool + mints LP + optionally locks.
 */
export async function createCLPool(
  signer: ethers.Signer,
  params: CreatePoolParams,
  chainId: number = 8453,
): Promise<{ poolAddress: string; txHash: string }> {
  throw new Error(
    'createCLPool is deprecated. Use launchCLPool() with LaunchParams (poolLauncherToken, tokenToPair, tickSpacing, liquidity with amounts and lockDuration).',
  );
}

export interface LockLiquidityParams {
  token: string;
  amount: string;
  unlockTime: number;
  beneficiary?: string;
}

/**
 * @deprecated Locking is done inside launchCLPool() when liquidity.lockDuration > 0.
 * The Locker is a per-position contract created by LockerFactory.lock(), not a single lock(token, amount, time) contract.
 */
export async function lockLiquidity(
  signer: ethers.Signer,
  params: LockLiquidityParams,
  chainId: number = 8453,
): Promise<{ lockId: string; txHash: string }> {
  throw new Error(
    'lockLiquidity is deprecated. Use launchCLPool() with liquidity.lockDuration > 0; the launcher locks via LockerFactory internally.',
  );
}

/**
 * Get pool address from CLPoolLauncher.getPool(tokenA, tokenB, tickSpacing).
 */
export async function getCLPoolAddress(
  tokenA: string,
  tokenB: string,
  tickSpacing: number,
  chainId: number = 8453,
): Promise<string> {
  const addresses = getContractAddresses(chainId);
  const launcherAddress = addresses.AERODROME_CL_POOL_LAUNCHER;
  if (!launcherAddress || launcherAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('CLPoolLauncher address not configured for this network');
  }
  const rpcUrl =
    chainId === 8453
      ? process.env.QUICKNODE_BASE_URL ||
        process.env.NEXT_PUBLIC_QUICKNODE_BASE_URL ||
        process.env.NEXT_PUBLIC_RPC_URL_BASE_MAINNET ||
        'https://mainnet.base.org'
      : 'https://sepolia.base.org';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    name: chainId === 8453 ? 'base' : 'base-sepolia',
    chainId,
  });
  const launcher = new ethers.Contract(launcherAddress, CL_POOL_LAUNCHER_ABI, provider);
  const pool = await launcher.getPool(tokenA, tokenB, tickSpacing);
  return pool && pool !== ethers.constants.AddressZero ? pool : '';
}

/** Legacy: get pool from V2 factory (stable/volatile). Use getCLPoolAddress for CL. */
export async function getPoolAddress(
  tokenA: string,
  tokenB: string,
  stable: boolean,
  chainId: number = 8453,
): Promise<string> {
  const addresses = getContractAddresses(chainId);
  const factoryAddress = addresses.AERODROME_FACTORY;
  if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('Aerodrome Factory address not configured for this network');
  }
  const rpcUrl =
    chainId === 8453
      ? process.env.QUICKNODE_BASE_URL ||
        process.env.NEXT_PUBLIC_QUICKNODE_BASE_URL ||
        process.env.NEXT_PUBLIC_RPC_URL_BASE_MAINNET ||
        'https://mainnet.base.org'
      : 'https://sepolia.base.org';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    name: chainId === 8453 ? 'base' : 'base-sepolia',
    chainId,
  });
  const factoryABI = [
    'function getPool(address tokenA, address tokenB, bool stable) external view returns (address pool)',
  ];
  const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
  const [tA, tB] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const poolAddress = await factory.getPool(tA, tB, stable);
  if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
    throw new Error('Pool not found');
  }
  return poolAddress;
}

/**
 * Add liquidity to a pool (helper)
 */
export async function addLiquidityToPool(
  signer: ethers.Signer,
  poolAddress: string,
  tokenA: string,
  tokenB: string,
  amountA: string,
  amountB: string,
  chainId: number = 8453,
): Promise<{ txHash: string }> {
  throw new Error(
    'addLiquidityToPool not yet implemented - use CLPoolLauncher.launch() to add and optionally lock in one tx',
  );
}

// --- Testing / verification ---

export interface AerodromeConfigCheck {
  v2Factory: { address: string; hasCode: boolean };
  clFactory: { address: string; hasCode: boolean };
  factoryRegistry: { address: string; hasCode: boolean };
  clPoolLauncher: { address: string; hasCode: boolean };
}

/**
 * Verify that configured Aerodrome contract addresses have code on-chain.
 * Use this to confirm V2 Factory, CL Factory, and Factory Registry are deployed before testing launch.
 */
export async function verifyAerodromeContracts(
  provider: ethers.providers.Provider,
  chainId: number = 8453,
): Promise<AerodromeConfigCheck> {
  const addresses = getContractAddresses(chainId);
  const check = async (address: string) => {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return { address: address || '0x0', hasCode: false };
    }
    const code = await provider.getCode(address);
    return { address, hasCode: !!code && code !== '0x' };
  };
  const [v2Factory, clFactory, factoryRegistry, clPoolLauncher] = await Promise.all([
    check(addresses.AERODROME_FACTORY),
    check(addresses.AERODROME_CL_FACTORY),
    check(addresses.AERODROME_FACTORY_REGISTRY),
    check(addresses.AERODROME_CL_POOL_LAUNCHER),
  ]);
  return { v2Factory, clFactory, factoryRegistry, clPoolLauncher };
}

export interface LockerInfo {
  owner: string;
  lockedUntil: number;
  lockedUntilDate: string;
  bribeableShare: number;
  beneficiary: string;
  beneficiaryShare: number;
  isLocked: boolean;
}

/**
 * Read Locker state (owner, lockedUntil, bribeableShare, beneficiary).
 * Use this to test that a Locker contract responds correctly—e.g. after a launch or with a known locker address.
 */
export async function inspectLocker(
  provider: ethers.providers.Provider,
  lockerAddress: string,
): Promise<LockerInfo> {
  if (!lockerAddress || lockerAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid locker address');
  }
  const locker = new ethers.Contract(lockerAddress, LOCKER_ABI, provider);
  const [owner, lockedUntil, bribeableShare, beneficiary, beneficiaryShare] = await Promise.all([
    locker.owner(),
    locker.lockedUntil(),
    locker.bribeableShare(),
    locker.beneficiary(),
    locker.beneficiaryShare(),
  ]);
  const ts = lockedUntil.toNumber ? lockedUntil.toNumber() : Number(lockedUntil);
  const isLocked = ts > 0 && ts !== 0xffffffff;
  let lockedUntilDate = '';
  if (isLocked && ts !== 0xffffffff) {
    const d = new Date(ts * 1000);
    lockedUntilDate = d.toISOString();
  } else if (ts === 0xffffffff) {
    lockedUntilDate = 'Permanent';
  }
  return {
    owner,
    lockedUntil: ts,
    lockedUntilDate,
    bribeableShare: bribeableShare.toNumber ? bribeableShare.toNumber() : Number(bribeableShare),
    beneficiary,
    beneficiaryShare: beneficiaryShare.toNumber
      ? beneficiaryShare.toNumber()
      : Number(beneficiaryShare),
    isLocked,
  };
}
