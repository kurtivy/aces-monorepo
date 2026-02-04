'use client';

/**
 * Profile token holdings: what we fetch
 *
 * 1. Token list: Convex DB (api.tokens.list) — active tokens; we filter to Base mainnet (8453).
 * 2. Balances: For each token we call balanceOf(connectedWallet) on Base mainnet via wagmi
 *    usePublicClient({ chainId: 8453 }).
 * 3. Display: Only tokens where balance > 0; USD value from fetchTokenHealth when available.
 *
 * Empty section can mean: Convex token list is empty, or wallet has no balance for any token.
 */
import { useAuth } from '@/lib/auth/auth-context';
import { usePublicClient } from 'wagmi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ERC20_ABI } from '@/lib/contracts/abi';
import { fetchTokenHealth } from '@/lib/api/token-health';

const BASE_MAINNET_CHAIN_ID = 8453;

type TokenListItem = {
  contractAddress: string;
  symbol: string;
  name: string;
  chainId: number;
  decimals?: number;
};

export type TokenHolding = {
  contractAddress: string;
  symbol: string;
  name: string;
  chainId: number;
  balance: string;
  decimals: number;
  /** USD value of the holding (balance * token price). Null when price unavailable. */
  usdValue: number | null;
};

export function useProfileTokenHoldings() {
  const { walletAddress: contextWalletAddress, isAuthenticated } = useAuth();
  const walletAddress = contextWalletAddress as `0x${string}` | undefined;
  const publicClient = usePublicClient({ chainId: BASE_MAINNET_CHAIN_ID });

  const convexTokens = useQuery(api.tokens.list);
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<Error | null>(null);
  const [pricesUsd, setPricesUsd] = useState<Record<string, number>>({});

  // Convex list is active tokens; restrict to Base mainnet for balance checks
  const tokensOnChain = useMemo((): TokenListItem[] => {
    if (convexTokens == null) return [];
    return convexTokens
      .filter((t) => t.chainId === BASE_MAINNET_CHAIN_ID)
      .map((t) => ({
        contractAddress: t.contractAddress,
        symbol: t.symbol,
        name: t.name,
        chainId: t.chainId,
        decimals: t.decimals,
      }));
  }, [convexTokens]);

  // Debug: log what Convex returns (remove when done)
  useEffect(() => {
    console.log('[useProfileTokenHoldings] api.tokens.list:', convexTokens);
    console.log('[useProfileTokenHoldings] tokensOnChain (Base only):', tokensOnChain);
  }, [convexTokens, tokensOnChain]);

  const fetchBalances = useCallback(async () => {
    if (!walletAddress || !publicClient || tokensOnChain.length === 0) {
      if (tokensOnChain.length > 0) {
        console.log('[useProfileTokenHoldings] fetchBalances skipped:', {
          reason: !walletAddress
            ? 'no wallet'
            : !publicClient
              ? 'no publicClient (switch to Base?)'
              : 'no tokens',
          walletAddress: walletAddress ?? null,
          tokenCount: tokensOnChain.length,
        });
      }
      setBalances({});
      return;
    }
    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const BATCH_SIZE = 4;
      const delayMs = 80;
      const results: { address: string; balance: bigint }[] = [];
      for (let i = 0; i < tokensOnChain.length; i += BATCH_SIZE) {
        const batch = tokensOnChain.slice(i, i + BATCH_SIZE);
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
            } catch (err) {
              console.warn(
                '[useProfileTokenHoldings] balanceOf failed for',
                t.symbol,
                t.contractAddress,
                err,
              );
              return { address: t.contractAddress, balance: BigInt(0) };
            }
          }),
        );
        results.push(...batchResults);
        if (i + BATCH_SIZE < tokensOnChain.length) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      const map: Record<string, bigint> = {};
      for (const { address, balance } of results) {
        map[address.toLowerCase()] = balance;
      }
      console.log('[useProfileTokenHoldings] balanceOf results:', {
        wallet: walletAddress,
        tokens: results.map((r) => ({
          address: r.address,
          balance: r.balance.toString(),
          symbol: tokensOnChain.find(
            (t) => t.contractAddress.toLowerCase() === r.address.toLowerCase(),
          )?.symbol,
        })),
      });
      setBalances(map);
    } catch (err) {
      setBalancesError(err instanceof Error ? err : new Error('Failed to fetch balances'));
      setBalances({});
    } finally {
      setBalancesLoading(false);
    }
  }, [walletAddress, publicClient, tokensOnChain]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // Raw holdings: wallet balances for tokens that exist in our list (balance > 0)
  const rawHoldings = useMemo((): Omit<TokenHolding, 'usdValue'>[] => {
    if (!tokensOnChain.length) return [];
    const mapped = tokensOnChain.map((t) => {
      const key = t.contractAddress.toLowerCase();
      const balance = balances[key] ?? BigInt(0);
      const decimals = t.decimals ?? 18;
      return {
        contractAddress: t.contractAddress,
        symbol: t.symbol,
        name: t.name,
        chainId: t.chainId,
        balance: formatUnits(balance, decimals),
        decimals,
        _balanceRaw: balance,
      };
    });
    const withBalance = mapped.filter((h) => parseFloat(h.balance) > 0);
    if (tokensOnChain.length > 0 && Object.keys(balances).length > 0) {
      console.log('[useProfileTokenHoldings] rawHoldings lookup:', {
        balanceKeys: Object.keys(balances),
        tokenKeys: tokensOnChain.map((t) => t.contractAddress.toLowerCase()),
        mapped: mapped.map((m) => ({
          symbol: m.symbol,
          balance: m.balance,
          key: m.contractAddress.toLowerCase(),
          inBalances: m.contractAddress.toLowerCase() in balances,
        })),
        withBalanceCount: withBalance.length,
      });
    }
    return withBalance
      .map(({ _balanceRaw, ...h }) => h)
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
  }, [tokensOnChain, balances]);

  // Fetch USD price for each holding so we can show value (health API has cache/dedup)
  useEffect(() => {
    if (rawHoldings.length === 0) {
      setPricesUsd({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        rawHoldings.map(async (h) => {
          try {
            const health = await fetchTokenHealth(h.contractAddress, BASE_MAINNET_CHAIN_ID, 'usd');
            const priceUsd =
              health.marketCapData?.currentPriceUsd ?? health.metricsData?.tokenPriceUsd ?? NaN;
            if (!cancelled && Number.isFinite(priceUsd) && priceUsd > 0) {
              next[h.contractAddress.toLowerCase()] = priceUsd;
            }
          } catch {
            // Leave price missing for this token
          }
        }),
      );
      if (!cancelled) setPricesUsd(next);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [rawHoldings]);

  const holdings = useMemo((): TokenHolding[] => {
    return rawHoldings.map((h) => {
      const priceUsd = pricesUsd[h.contractAddress.toLowerCase()];
      const balanceNum = parseFloat(h.balance);
      const usdValue =
        priceUsd != null && Number.isFinite(priceUsd) && Number.isFinite(balanceNum)
          ? balanceNum * priceUsd
          : null;
      return { ...h, usdValue };
    });
  }, [rawHoldings, pricesUsd]);

  const isLoading =
    convexTokens === undefined || (!!walletAddress && !!tokensOnChain.length && balancesLoading);
  const error = balancesError;

  return {
    holdings,
    isLoading,
    error,
    refetch: fetchBalances,
    hasWallet: isAuthenticated && !!walletAddress,
    walletAddress,
    /** Number of tokens in our curated list (Base mainnet, active). Used to explain empty state. */
    tokenListCount: tokensOnChain.length,
  };
}
