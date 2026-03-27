import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { TOKENS } from "~/lib/contracts/addresses";
import { ERC20_ABI } from "~/lib/contracts/abis";
import type { TokenBalances } from "~/lib/swap/types";
import { useBalance } from "wagmi";

const TOKEN_LIST = [
  { key: "ACES" as const, address: TOKENS.ACES.address, decimals: TOKENS.ACES.decimals },
  { key: "USDC" as const, address: TOKENS.USDC.address, decimals: TOKENS.USDC.decimals },
  { key: "USDT" as const, address: TOKENS.USDT.address, decimals: TOKENS.USDT.decimals },
];

export function useTokenBalances(
  rwaTokenAddress?: string,
  rwaTokenDecimals = 18,
) {
  const { address } = useAccount();

  // ETH balance
  const { data: ethBalance } = useBalance({
    address,
    query: { refetchInterval: 30_000 },
  });

  // ERC20 balances (ACES, USDC, USDT + optional RWA token)
  const contracts = address
    ? [
        ...TOKEN_LIST.map((t) => ({
          address: t.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: [address] as const,
        })),
        ...(rwaTokenAddress
          ? [
              {
                address: rwaTokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "balanceOf" as const,
                args: [address] as const,
              },
            ]
          : []),
      ]
    : [];

  const { data: balances, refetch } = useReadContracts({
    contracts,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const result: TokenBalances = {
    ETH: ethBalance ? formatUnits(ethBalance.value, 18) : "0",
    ACES: "0",
    USDC: "0",
    USDT: "0",
    TOKEN: "0",
  };

  if (balances) {
    TOKEN_LIST.forEach((t, i) => {
      const raw = balances[i]?.result;
      if (raw !== undefined) {
        result[t.key] = formatUnits(raw as bigint, t.decimals);
      }
    });

    if (rwaTokenAddress && balances[TOKEN_LIST.length]?.result !== undefined) {
      result.TOKEN = formatUnits(
        balances[TOKEN_LIST.length].result as bigint,
        rwaTokenDecimals,
      );
    }
  }

  return { balances: result, refetch };
}
