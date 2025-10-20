import { ethers, type EventLog, type Log } from 'ethers';

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

const DEFAULT_CHAIN_PRIORITY = [BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID]; // Prioritize mainnet
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ZERO_ADDRESS = ethers.ZeroAddress;
const ALCHEMY_MAX_BLOCK_RANGE = 10000; // Alchemy supports larger ranges than standard RPC

const LAUNCHPAD_TOKEN_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

const ACES_FACTORY_EVENT_ABI = [
  'event CreatedToken(address tokenAddress, uint8 curve, uint256 steepness, uint256 floor)',
] as const;

type CacheEntry = {
  count: number;
  expiresAt: number;
};

type ChainConfig = {
  chainId: number;
  factoryAddress?: string;
  rpcUrls: string[];
};

type TransferEvent = {
  args: any;
};

function normalizeAddress(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return ethers.getAddress(value);
  } catch (error) {
    return undefined;
  }
}

function uniqueTruthy(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  );
}

function resolveChainConfig(chainId: number): ChainConfig | undefined {
  switch (chainId) {
    case BASE_SEPOLIA_CHAIN_ID: {
      const rpcUrls = uniqueTruthy([
        process.env.QUICKNODE_BASE_SEPOLIA_RPC,
        process.env.BASE_SEPOLIA_RPC_URL,
        process.env.BASE_SEPOLIA_RPC,
        process.env.BASE_SEPOLIA_PROVIDER_URL,
        process.env.QUICKNODE_BASE_RPC,
        'https://sepolia.base.org',
        'https://base-sepolia-rpc.publicnode.com',
        'https://base-sepolia.blockpi.network/v1/rpc/public',
        'https://base-sepolia.gateway.tenderly.co',
      ]);

      const factoryAddress =
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_BASE_SEPOLIA) ||
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_TESTNET) ||
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS) ||
        // Fallback to known default testnet deployment
        normalizeAddress('0x7e224ae4e6235bF18BBcb79cc2B5d04a7a6F8d1D');

      return { chainId, factoryAddress, rpcUrls };
    }
    case BASE_MAINNET_CHAIN_ID: {
      const rpcUrls = uniqueTruthy([
        process.env.QUICKNODE_BASE_URL,
        process.env.BASE_MAINNET_RPC_URL,
        'https://mainnet.base.org',
      ]);

      const factoryAddress =
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_BASE_MAINNET) ||
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS_MAINNET) ||
        normalizeAddress(process.env.FACTORY_PROXY_ADDRESS);

      return { chainId, factoryAddress, rpcUrls };
    }
    default:
      return undefined;
  }
}

function normalizeBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return BigInt(value);
  }

  if (typeof value === 'string') {
    if (value.trim().startsWith('0x')) {
      return BigInt(value);
    }

    return BigInt(value.trim());
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    return BigInt((value as { toString: () => string }).toString());
  }

  throw new Error(`Unable to convert value to bigint: ${value}`);
}

function updateBalanceMap(
  balances: Map<string, bigint>,
  address: string,
  delta: bigint,
  isAddition: boolean,
) {
  const key = address.toLowerCase();
  const current = balances.get(key) ?? 0n;

  if (isAddition) {
    const next = current + delta;
    if (next === 0n) {
      balances.delete(key);
    } else {
      balances.set(key, next);
    }
    return;
  }

  const next = current - delta;
  if (next <= 0n) {
    balances.delete(key);
  } else {
    balances.set(key, next);
  }
}

function shouldChunkQuery(error: unknown): boolean {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as any).message).toLowerCase()
      : '';
  const code =
    typeof error === 'object' && error && 'code' in error ? (error as any).code : undefined;

  if (code === -32011) {
    return true;
  }

  return (
    message.includes('query returned more than') ||
    message.includes('response size exceeded') ||
    message.includes('log result size exceeded') ||
    message.includes('block range too wide') ||
    message.includes('no backend is currently healthy') ||
    message.includes('limit')
  );
}

export class TokenHolderService {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly cacheTtlMs: number = CACHE_TTL_MS) {}

  async getHolderCount(tokenAddress: string, chainId?: number): Promise<number> {
    if (!tokenAddress) {
      throw new Error('Token address is required');
    }

    let normalizedAddress: string;
    try {
      normalizedAddress = ethers.getAddress(tokenAddress);
    } catch (error) {
      throw new Error('Invalid token address');
    }

    const cacheKey = this.buildCacheKey(normalizedAddress, chainId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.count;
    }

    const candidateChainIds = this.getCandidateChainIds(chainId);
    let lastError: unknown;

    for (const candidateChainId of candidateChainIds) {
      const chainConfig = resolveChainConfig(candidateChainId);
      if (!chainConfig || chainConfig.rpcUrls.length === 0) {
        continue;
      }

      for (const rpcUrl of chainConfig.rpcUrls) {
        try {
          const result = await this.fetchHolderCountFromRpc(normalizedAddress, chainConfig, rpcUrl);
          this.cache.set(cacheKey, { count: result, expiresAt: Date.now() + this.cacheTtlMs });
          return result;
        } catch (error) {
          lastError = error;
          // Continue to next RPC URL
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Failed to resolve holder count');
  }

  private buildCacheKey(tokenAddress: string, chainId?: number) {
    return `${tokenAddress.toLowerCase()}::${chainId ?? 'auto'}`;
  }

  private getCandidateChainIds(chainId?: number): number[] {
    if (chainId) {
      return [chainId];
    }

    return DEFAULT_CHAIN_PRIORITY;
  }

  private async fetchHolderCountFromRpc(
    tokenAddress: string,
    chainConfig: ChainConfig,
    rpcUrl: string,
  ): Promise<number> {
    console.log(`[TokenHolderService] 🔗 Connecting to RPC: ${rpcUrl.substring(0, 50)}...`);
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainConfig.chainId);
    const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);

    let startBlock = 0;
    if (chainConfig.factoryAddress) {
      console.log(`[TokenHolderService] 🏭 Looking up token creation block...`);
      const factoryContract = new ethers.Contract(
        chainConfig.factoryAddress,
        ACES_FACTORY_EVENT_ABI,
        provider,
      );
      const creationBlock = await this.resolveCreationBlock(factoryContract, tokenAddress);
      if (creationBlock) {
        startBlock = creationBlock;
        console.log(`[TokenHolderService] ✅ Token created at block: ${startBlock}`);
      } else {
        console.log(`[TokenHolderService] ⚠️  Could not find creation block, starting from 0`);
      }
    }

    const latestBlock = await provider.getBlockNumber();
    const blockRange = latestBlock - startBlock;
    console.log(
      `[TokenHolderService] 📊 Scanning blocks ${startBlock} to ${latestBlock} (${blockRange.toLocaleString()} blocks)`,
    );

    // Safeguard: If token wasn't found in factory and block range is huge, fail fast
    // For newly minted tokens, this should never trigger
    const MAX_BLOCK_RANGE = 1_000_000; // ~20 days of blocks on Base (2-second blocks)
    if (startBlock === 0 && blockRange > MAX_BLOCK_RANGE) {
      console.log(
        `[TokenHolderService] ⚠️  Block range too large (${blockRange.toLocaleString()} blocks)`,
      );
      console.log(`[TokenHolderService] 💡 This token was not created via ACES factory`);
      throw new Error(
        `Token not found in factory and block range too large. This service only supports ACES factory tokens.`,
      );
    }

    console.log(`[TokenHolderService] 🔍 Fetching Transfer events...`);
    const events = await this.collectTransferEvents(tokenContract, startBlock, latestBlock);
    console.log(`[TokenHolderService] 📝 Found ${events.length.toLocaleString()} Transfer events`);

    const balances = new Map<string, bigint>();

    console.log(`[TokenHolderService] 🧮 Processing ${events.length.toLocaleString()} events...`);
    for (const event of events) {
      const eventArgs = event.args as any;
      if (!eventArgs) {
        continue;
      }

      const from = (typeof eventArgs.from === 'string' ? eventArgs.from : eventArgs[0]) as
        | string
        | undefined;
      const to = (typeof eventArgs.to === 'string' ? eventArgs.to : eventArgs[1]) as
        | string
        | undefined;
      const valueRaw = eventArgs.value ?? eventArgs[2];

      if (!from || !to || valueRaw == null) {
        continue;
      }

      let value: bigint;
      try {
        value = normalizeBigInt(valueRaw);
      } catch (error) {
        continue;
      }

      if (from !== ZERO_ADDRESS) {
        updateBalanceMap(balances, from, value, false);
      }

      if (to !== ZERO_ADDRESS) {
        updateBalanceMap(balances, to, value, true);
      }
    }

    let holderCount = 0;
    for (const balance of balances.values()) {
      if (balance > 0n) {
        holderCount += 1;
      }
    }

    console.log(`[TokenHolderService] ✅ Calculated holder count: ${holderCount}`);
    return holderCount;
  }

  private async resolveCreationBlock(
    factoryContract: ethers.Contract,
    tokenAddress: string,
  ): Promise<number | null> {
    try {
      const normalizedTarget = tokenAddress.toLowerCase();
      const events = await factoryContract.queryFilter(
        factoryContract.filters.CreatedToken(),
        0,
        'latest',
      );

      for (const rawEvent of events) {
        let args: any;

        if ('args' in rawEvent) {
          args = rawEvent.args;
        } else {
          try {
            const parsed = factoryContract.interface.parseLog(rawEvent);
            args = parsed?.args;
          } catch (parseError) {
            continue;
          }
        }

        if (!args) {
          continue;
        }

        const createdAddress = (args.tokenAddress ?? args[0]) as string | undefined;
        if (!createdAddress || typeof createdAddress !== 'string') {
          continue;
        }

        if (createdAddress.toLowerCase() === normalizedTarget) {
          return rawEvent.blockNumber ?? null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async collectTransferEvents(
    tokenContract: ethers.Contract,
    fromBlock: number,
    toBlock: number,
  ): Promise<TransferEvent[]> {
    const transferFilter = tokenContract.filters.Transfer();

    try {
      console.log(
        `[TokenHolderService] 📡 Attempting single query for blocks ${fromBlock}-${toBlock}...`,
      );
      const events = await tokenContract.queryFilter(transferFilter, fromBlock, toBlock);
      console.log(`[TokenHolderService] ✅ Single query successful, got ${events.length} events`);
      return events.map((event) => this.normalizeEvent(tokenContract, event));
    } catch (error) {
      console.log(`[TokenHolderService] ⚠️  Single query failed, switching to chunked queries...`);
      if (!shouldChunkQuery(error)) {
        throw error instanceof Error ? error : new Error('Failed to fetch transfer events');
      }

      // Use Alchemy's larger block range support
      const chunkSize = ALCHEMY_MAX_BLOCK_RANGE;
      const events: TransferEvent[] = [];
      const totalChunks = Math.ceil((toBlock - fromBlock) / chunkSize);
      console.log(
        `[TokenHolderService] 📦 Will process ${totalChunks} chunks of ${chunkSize} blocks each`,
      );

      let currentFrom = fromBlock;
      let chunkNum = 0;
      while (currentFrom <= toBlock) {
        chunkNum++;
        const currentTo = Math.min(currentFrom + chunkSize, toBlock);
        const progress = ((chunkNum / totalChunks) * 100).toFixed(1);
        console.log(
          `[TokenHolderService] 🔄 Processing chunk ${chunkNum}/${totalChunks} (${progress}%) - blocks ${currentFrom}-${currentTo}`,
        );

        try {
          const chunk = await tokenContract.queryFilter(transferFilter, currentFrom, currentTo);
          console.log(
            `[TokenHolderService]    ✅ Chunk ${chunkNum} complete: ${chunk.length} events`,
          );
          events.push(...chunk.map((log) => this.normalizeEvent(tokenContract, log)));
        } catch (chunkError) {
          console.log(
            `[TokenHolderService]    ⚠️  Chunk ${chunkNum} failed, trying smaller chunks...`,
          );
          // If even chunked query fails, try smaller chunks
          if (shouldChunkQuery(chunkError)) {
            const smallerChunkSize = Math.floor(chunkSize / 5);
            const subChunks = Math.ceil((currentTo - currentFrom) / smallerChunkSize);
            console.log(
              `[TokenHolderService]    📦 Breaking into ${subChunks} smaller chunks of ${smallerChunkSize} blocks`,
            );
            for (let i = currentFrom; i <= currentTo; i += smallerChunkSize) {
              const smallTo = Math.min(i + smallerChunkSize, currentTo);
              const smallChunk = await tokenContract.queryFilter(transferFilter, i, smallTo);
              events.push(...smallChunk.map((log) => this.normalizeEvent(tokenContract, log)));
            }
          } else {
            throw chunkError;
          }
        }
        currentFrom = currentTo + 1;
      }

      console.log(`[TokenHolderService] 🎉 All chunks processed, total events: ${events.length}`);
      return events;
    }
  }

  private normalizeEvent(tokenContract: ethers.Contract, event: EventLog | Log): TransferEvent {
    if ('args' in event) {
      return { args: event.args };
    }

    const parsed = tokenContract.interface.parseLog(event);
    if (!parsed) {
      return { args: [] };
    }

    return { args: parsed.args };
  }
}
