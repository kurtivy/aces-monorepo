/**
 * Bonding Curve Formula Service
 *
 * Pure TypeScript implementation of the bonding curve pricing formula.
 * This eliminates the need for RPC calls during binary search by calculating
 * prices locally using the same formula as the smart contract.
 *
 * Ported from apps/frontend/src/lib/bonding-curve/aces-quote.ts
 */

const W = BigInt(10) ** BigInt(18); // 1e18

function mulDiv(a: bigint, b: bigint, den: bigint): bigint {
  return (a * b) / den;
}

function sumSquaresWei(sWei: bigint): bigint {
  if (sWei === BigInt(0)) return BigInt(0);
  const t1 = mulDiv(sWei, sWei + W, W);
  const t2 = mulDiv(t1, BigInt(2) * sWei + W, W);
  return mulDiv(t2, BigInt(1), BigInt(6) * W);
}

/**
 * Calculate the quadratic bonding curve price for buying tokens
 * Uses the same formula as the smart contract's getPrice function
 */
export function getPriceQuadratic(
  supply: bigint,
  amount: bigint,
  steepness: bigint,
  floor: bigint,
): bigint {
  if (amount < W) throw new Error('amount must be at least 1 token');
  if (supply < W) throw new Error('supply must be at least 1 token');
  if (amount % W !== BigInt(0) || supply % W !== BigInt(0)) {
    throw new Error('non-integer token units');
  }

  const startWei = supply;
  const endWei = supply + amount - W;

  const sumBefore = sumSquaresWei(startWei - W);
  const sumAfter = sumSquaresWei(endWei);
  const summation = sumAfter - sumBefore;

  const curveComponent = mulDiv(summation, W, steepness);
  const linearComponent = mulDiv(floor, amount, W);
  return curveComponent + linearComponent;
}

/**
 * Add buy fees to the base price
 */
export function addBuyFees(
  price: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const f = protocolFeePercent + subjectFeePercent;
  return price + mulDiv(price, f, W);
}

/**
 * Subtract sell fees from the base price
 */
export function subSellFees(
  price: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const f = protocolFeePercent + subjectFeePercent;
  const fees = mulDiv(price, f, W);
  return price - fees;
}

/**
 * Calculate buy price after fees (same as contract's getBuyPriceAfterFee)
 */
export function getBuyPriceAfterFee(
  supply: bigint,
  amount: bigint,
  steepness: bigint,
  floor: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const pre = getPriceQuadratic(supply, amount, steepness, floor);
  return addBuyFees(pre, protocolFeePercent, subjectFeePercent);
}

/**
 * Calculate sell price after fees (same as contract's getSellPriceAfterFee)
 */
export function getSellPriceAfterFee(
  supply: bigint,
  amount: bigint,
  steepness: bigint,
  floor: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const pre = getPriceQuadratic(supply - amount, amount, steepness, floor);
  return subSellFees(pre, protocolFeePercent, subjectFeePercent);
}

/**
 * Quote state for bonding curve calculations
 */
export interface QuoteState {
  supply: bigint;
  steepness: bigint;
  floor: bigint;
  protocolFeePercent: bigint;
  subjectFeePercent: bigint;
  tokenBonded: boolean;
  tokensBondedAt: bigint;
  launchpadMaxSupply: bigint;
}

/**
 * Calculate how many tokens can be bought with a given amount of ACES
 * Uses binary search with formula-based pricing (no RPC calls)
 *
 * @param acesIn - Amount of ACES to spend (in wei, 18 decimals)
 * @param state - Quote state with supply, curve params, and fees
 * @returns Amount of tokens that can be bought (in wei, token decimals)
 */
export function quoteBuyAmountFromAces(acesIn: bigint, state: QuoteState): bigint {
  if (acesIn <= BigInt(0)) return BigInt(0);
  if (state.tokenBonded) return BigInt(0);

  const maxAdd = state.launchpadMaxSupply - state.supply;
  if (maxAdd < W) return BigInt(0);

  // Check if we can afford at least 1 token
  const p1 = getBuyPriceAfterFee(
    state.supply,
    W,
    state.steepness,
    state.floor,
    state.protocolFeePercent,
    state.subjectFeePercent,
  );
  if (p1 > acesIn) return BigInt(0);

  const lo = W;
  let hi = W;

  // Exponential search to find upper bound
  while (true) {
    let nextHi = hi << BigInt(1);
    if (nextHi > maxAdd) nextHi = maxAdd - (maxAdd % W);
    if (nextHi <= hi) break;

    const price = getBuyPriceAfterFee(
      state.supply,
      nextHi,
      state.steepness,
      state.floor,
      state.protocolFeePercent,
      state.subjectFeePercent,
    );
    if (price > acesIn) break;
    hi = nextHi;
    if (hi === maxAdd) break;
  }

  if (hi === lo) return lo;

  // Binary search for exact amount
  let ans = lo;
  let L = lo,
    R = hi;
  while (L <= R) {
    let mid = ((L + R) / BigInt(2) / W) * W;
    if (mid < W) mid = W;

    const price = getBuyPriceAfterFee(
      state.supply,
      mid,
      state.steepness,
      state.floor,
      state.protocolFeePercent,
      state.subjectFeePercent,
    );

    if (price <= acesIn) {
      ans = mid;
      if (mid === R) break;
      L = mid + W;
    } else {
      if (mid <= L) break;
      R = mid - W;
    }
  }

  return ans;
}

/**
 * Calculate how many ACES will be received when selling tokens
 *
 * @param amountIn - Amount of tokens to sell (in wei, token decimals)
 * @param state - Quote state with supply, curve params, and fees
 * @returns Amount of ACES received (in wei, 18 decimals)
 */
export function quoteSellAcesFromAmount(amountIn: bigint, state: QuoteState): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  if (amountIn % W !== BigInt(0)) amountIn = (amountIn / W) * W;
  if (amountIn === BigInt(0)) return BigInt(0);

  const maxSell = state.supply - W;
  if (amountIn > maxSell) amountIn = maxSell - (maxSell % W);
  if (amountIn <= BigInt(0)) return BigInt(0);

  return getSellPriceAfterFee(
    state.supply,
    amountIn,
    state.steepness,
    state.floor,
    state.protocolFeePercent,
    state.subjectFeePercent,
  );
}

