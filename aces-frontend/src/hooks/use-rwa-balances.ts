import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI } from "~/lib/contracts/abis";
import { RWA_TOKENS, type RwaTokenData } from "../../convex/tokenData";

export interface RwaBalance {
  token: RwaTokenData;
  balance: string;
}

/**
 * Batch-reads on-chain balances for all curated ACES RWA tokens.
 * Returns only tokens the connected wallet actually holds (balance > 0).
 */
export function useRwaBalances() {
  const { address } = useAccount();

  // Filter to only tokens with a deployed contract address on-chain.
  // RWA_TOKENS includes upcoming/unlaunched tokens with no contractAddress —
  // passing undefined addresses into wagmi's multicall breaks the entire batch.
  const liveTokens = RWA_TOKENS.filter((t) => !!t.contractAddress);

  // Build a balanceOf call for each live token's ERC-20 contract
  const contracts = address
    ? liveTokens.map((t) => ({
        address: t.contractAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf" as const,
        args: [address] as const,
      }))
    : [];

  // Batch all balanceOf reads into a single multicall, polling every 30s
  const { data, isLoading } = useReadContracts({
    contracts,
    query: { enabled: !!address && liveTokens.length > 0, refetchInterval: 30_000 },
  });

  // Collect only tokens the wallet actually holds (balance > 0)
  const holdings: RwaBalance[] = [];

  if (data) {
    liveTokens.forEach((token, i) => {
      const raw = data[i]?.result;
      if (raw !== undefined) {
        const balance = formatUnits(raw as bigint, token.decimals ?? 18);
        if (parseFloat(balance) > 0) {
          holdings.push({ token, balance });
        }
      }
    });
  }

  // curatedCount reflects only deployed tokens, not the full catalog
  return { holdings, isLoading, curatedCount: liveTokens.length };
}
