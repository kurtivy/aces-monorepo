'use client';

/**
 * All ERC20 token balances for the connected wallet on Base mainnet.
 * Uses QuickNode RPC (via wagmi usePublicClient) — balanceOf for each token in the list.
 * Token list = curated BASE_MAINNET_TOKEN_LIST + Convex active Base tokens (deduped).
 */
import { useAuth } from '@/lib/auth/auth-context';
import { usePublicClient } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ERC20_ABI } from '@/lib/contracts/abi';
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_MAINNET_TOKEN_LIST,
  type BaseTokenInfo,
} from '@/data/base-token-list';

export type BaseTokenHolding = {
  contractAddress: string;
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  decimals: number;
};

function mergeTokenLists(
  curated: BaseTokenInfo[],
  convex: {
    contractAddress: string;
    symbol: string;
    name: string;
    chainId: number;
    decimals?: number;
  }[],
): BaseTokenInfo[] {
  const byAddress = new Map<string, BaseTokenInfo>();
  for (const t of curated) {
    byAddress.set(t.contractAddress.toLowerCase(), t);
  }
  for (const t of convex) {
    if (t.chainId !== BASE_MAINNET_CHAIN_ID) continue;
    const key = t.contractAddress.toLowerCase();
    if (!byAddress.has(key)) {
      byAddress.set(key, {
        contractAddress: key,
        symbol: t.symbol,
        name: t.name,
        chainId: t.chainId,
        decimals: t.decimals ?? 18,
      });
    }
  }
  return Array.from(byAddress.values());
}

export function useAllBaseTokenBalances() {
  const { walletAddress: contextWalletAddress, isAuthenticated } = useAuth();
  const walletAddress = contextWalletAddress as `0x${string}` | undefined;
  const publicClient = usePublicClient({ chainId: BASE_MAINNET_CHAIN_ID });
  const convexTokens = useQuery(api.tokens.list);

  const tokenList = useMemo((): BaseTokenInfo[] => {
    if (convexTokens == null) return BASE_MAINNET_TOKEN_LIST;
    return mergeTokenLists(
      BASE_MAINNET_TOKEN_LIST,
      convexTokens.filter((t) => t.chainId === BASE_MAINNET_CHAIN_ID),
    );
  }, [convexTokens]);

  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!walletAddress || !publicClient || tokenList.length === 0) {
      setBalances({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const BATCH_SIZE = 4;
      const delayMs = 80;
      const results: { address: string; balance: bigint }[] = [];
      for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
        const batch = tokenList.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (t) => {
            try {
              const balance = (await publicClient.readContract({
                address: t.contractAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [walletAddress],
              })) as bigint;
              return { address: t.contractAddress, balance };
            } catch {
              return { address: t.contractAddress, balance: BigInt(0) };
            }
          }),
        );
        results.push(...batchResults);
        if (i + BATCH_SIZE < tokenList.length) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      const map: Record<string, bigint> = {};
      for (const { address, balance } of results) {
        map[address.toLowerCase()] = balance;
      }
      setBalances(map);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balances'));
      setBalances({});
    } finally {
      setLoading(false);
    }
  }, [walletAddress, publicClient, tokenList]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  const holdings = useMemo((): BaseTokenHolding[] => {
    return tokenList
      .map((t) => {
        const balance = balances[t.contractAddress.toLowerCase()] ?? BigInt(0);
        const decimals = t.decimals ?? 18;
        return {
          contractAddress: t.contractAddress,
          symbol: t.symbol,
          name: t.name,
          chainId: t.chainId,
          balance: formatUnits(balance, decimals),
          decimals,
          _raw: balance,
        };
      })
      .filter((h) => h._raw > BigInt(0))
      .map(({ _raw, ...h }) => h)
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
  }, [tokenList, balances]);

  const isLoading =
    convexTokens === undefined || (!!walletAddress && !!tokenList.length && loading);

  return {
    holdings,
    isLoading,
    error,
    refetch: fetchBalances,
    hasWallet: isAuthenticated && !!walletAddress,
    walletAddress,
    tokenListCount: tokenList.length,
  };
}
