'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

const DEFAULT_CHAIN_PRIORITY = [BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID];

const RPC_ENDPOINTS: Record<number, string[]> = {
  [BASE_SEPOLIA_CHAIN_ID]: [
    'https://sepolia.base.org',
    'https://base-sepolia-rpc.publicnode.com',
    'https://base-sepolia.blockpi.network/v1/rpc/public',
    'https://base-sepolia.gateway.tenderly.co',
  ],
  [BASE_MAINNET_CHAIN_ID]: [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.blockpi.network/v1/rpc/public',
    'https://base.gateway.tenderly.co',
  ],
};

interface HolderCountState {
  holderCount: number | null;
  loading: boolean;
  error: string | null;
}

const ZERO_ADDRESS = ethers.constants.AddressZero;

function getCandidateChainIds(chainId?: number) {
  if (chainId) {
    return [chainId];
  }

  return DEFAULT_CHAIN_PRIORITY;
}

async function resolveCreationBlock(
  factoryContract: ethers.Contract,
  tokenAddress: string,
): Promise<number | null> {
  try {
    const normalizedTarget = tokenAddress.toLowerCase();
    const events = await factoryContract.queryFilter(factoryContract.filters.CreatedToken(), 0, 'latest');
    const matchingEvent = events.find((event) => {
      const createdAddress = event.args?.tokenAddress as string | undefined;
      return createdAddress?.toLowerCase() === normalizedTarget;
    });
    return matchingEvent?.blockNumber ?? null;
  } catch (error) {
    console.warn('Failed to resolve creation block via factory events:', error);
    return null;
  }
}

function updateBalanceMap(
  balances: Map<string, ethers.BigNumber>,
  address: string,
  delta: ethers.BigNumber,
  isAddition: boolean,
) {
  const current = balances.get(address) ?? ethers.constants.Zero;

  if (isAddition) {
    const next = current.add(delta);
    if (next.isZero()) {
      balances.delete(address);
    } else {
      balances.set(address, next);
    }
    return;
  }

  if (delta.gte(current)) {
    balances.delete(address);
    return;
  }

  const next = current.sub(delta);
  if (next.isZero()) {
    balances.delete(address);
  } else {
    balances.set(address, next);
  }
}

async function computeHolderCount(
  tokenContract: ethers.Contract,
  provider: ethers.providers.Provider,
  startBlock: number,
): Promise<number> {
  const balances = new Map<string, ethers.BigNumber>();
  const fromBlock = Math.max(startBlock, 0);
  const latestBlock = await provider.getBlockNumber();

  const events = await collectTransferEvents(tokenContract, fromBlock, latestBlock);

  for (const event of events) {
    const { from, to, value } = event.args ?? {};

    if (!from || !to || !value) {
      continue;
    }

    if (from !== ZERO_ADDRESS) {
      updateBalanceMap(balances, from, value, false);
    }

    if (to !== ZERO_ADDRESS) {
      updateBalanceMap(balances, to, value, true);
    }
  }

  let count = 0;
  for (const balance of balances.values()) {
    if (balance.gt(0)) {
      count += 1;
    }
  }

  return count;
}

async function collectTransferEvents(
  tokenContract: ethers.Contract,
  fromBlock: number,
  toBlock: number,
): Promise<ethers.Event[]> {
  const transferFilter = tokenContract.filters.Transfer();

  try {
    return await tokenContract.queryFilter(transferFilter, fromBlock, toBlock);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const needsChunking =
      message.includes('query returned more than') ||
      message.includes('response size exceeded') ||
      message.includes('log result size exceeded') ||
      message.includes('block range too wide');

    if (!needsChunking) {
      throw error;
    }

    const chunkSize = 200_000;
    const events: ethers.Event[] = [];

    let currentFrom = fromBlock;
    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + chunkSize, toBlock);
      // eslint-disable-next-line no-await-in-loop
      const chunk = await tokenContract.queryFilter(transferFilter, currentFrom, currentTo);
      events.push(...chunk);
      currentFrom = currentTo + 1;
    }

    return events;
  }
}

export function useTokenHolderCount(tokenAddress?: string, chainId?: number) {
  const [state, setState] = useState<HolderCountState>({
    holderCount: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!tokenAddress) {
      setState({ holderCount: null, loading: false, error: null });
      return;
    }

    if (!ethers.utils.isAddress(tokenAddress)) {
      setState({ holderCount: null, loading: false, error: 'Invalid token address' });
      return;
    }

    let cancelled = false;

    const fetchHolderCount = async () => {
      setState({ holderCount: null, loading: true, error: null });

      const candidateChainIds = getCandidateChainIds(chainId);
      let lastError: string | null = null;

      for (const candidateChainId of candidateChainIds) {
        const rpcUrls = RPC_ENDPOINTS[candidateChainId];
        if (!rpcUrls || rpcUrls.length === 0) {
          continue;
        }

        const { FACTORY_PROXY } = getContractAddresses(candidateChainId);
        if (!FACTORY_PROXY || !ethers.utils.isAddress(FACTORY_PROXY)) {
          continue;
        }

        for (const rpcUrl of rpcUrls) {
          try {
            const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, candidateChainId);
            const factoryContract = new ethers.Contract(FACTORY_PROXY, ACES_FACTORY_ABI, provider);
            const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);

            const creationBlock = await resolveCreationBlock(factoryContract, tokenAddress);
            const holderCount = await computeHolderCount(tokenContract, provider, creationBlock ?? 0);

            if (!cancelled) {
              setState({ holderCount, loading: false, error: null });
            }

            return;
          } catch (error) {
            console.warn(`Failed to fetch holder count via ${rpcUrl}:`, error);
            lastError = error instanceof Error ? error.message : 'Failed to fetch holder count';
          }
        }
      }

      if (!cancelled) {
        setState({ holderCount: null, loading: false, error: lastError });
      }
    };

    fetchHolderCount();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, chainId]);

  return state;
}
