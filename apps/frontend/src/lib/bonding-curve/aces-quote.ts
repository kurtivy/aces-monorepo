// aces-quote.ts
// Frontend-accurate reimplementation of AcesFactory quadratic curve + fees,
// with binary-search quotes for ACES -> RWA and RWA -> ACES.
//
// All numbers are bigint in 1e18 precision like Solidity (wei-style).
// You pass in the current on-chain state (supply, params, fees, caps).

export const W = BigInt(10) ** BigInt(18); // 1e18

function mulDiv(a: bigint, b: bigint, den: bigint): bigint {
  return (a * b) / den;
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sumSquaresWei(sWei: bigint): bigint {
  if (sWei === BigInt(0)) return BigInt(0);
  const t1 = mulDiv(sWei, sWei + W, W);
  const t2 = mulDiv(t1, BigInt(2) * sWei + W, W);
  return mulDiv(t2, BigInt(1), BigInt(6) * W);
}

export function getPriceQuadratic(
  supply: bigint,
  amount: bigint,
  steepness: bigint,
  floor: bigint,
): bigint {
  assert(amount >= W, 'amount must be at least 1 token');
  assert(supply >= W, 'supply must be at least 1 token');
  assert(amount % W === BigInt(0) && supply % W === BigInt(0), 'non-integer token units');

  const startWei = supply;
  const endWei = supply + amount - W;

  const sumBefore = sumSquaresWei(startWei - W);
  const sumAfter = sumSquaresWei(endWei);
  const summation = sumAfter - sumBefore;

  const curveComponent = mulDiv(summation, W, steepness);
  const linearComponent = mulDiv(floor, amount, W);
  return curveComponent + linearComponent;
}

export function addBuyFees(
  price: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const f = protocolFeePercent + subjectFeePercent;
  return price + mulDiv(price, f, W);
}

export function subSellFees(
  price: bigint,
  protocolFeePercent: bigint,
  subjectFeePercent: bigint,
): bigint {
  const f = protocolFeePercent + subjectFeePercent;
  const fees = mulDiv(price, f, W);
  return price - fees;
}

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

export type QuoteState = {
  supply: bigint;
  steepness: bigint;
  floor: bigint;
  protocolFeePercent: bigint;
  subjectFeePercent: bigint;
  tokenBonded: boolean;
  tokensBondedAt: bigint;
  launchpadMaxSupply: bigint;
  lpAmount: bigint;
};

/**
 * Calculate how many RWA tokens can be bought with a given amount of ACES
 * Uses binary search to find the maximum token amount that costs <= acesIn
 */
export function quoteBuyAmountFromAces(acesIn: bigint, s: QuoteState): bigint {
  if (acesIn <= BigInt(0)) return BigInt(0);
  if (s.tokenBonded) return BigInt(0);

  const maxAdd = s.launchpadMaxSupply - s.supply;
  if (maxAdd < W) return BigInt(0);

  const p1 = getBuyPriceAfterFee(
    s.supply,
    W,
    s.steepness,
    s.floor,
    s.protocolFeePercent,
    s.subjectFeePercent,
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
      s.supply,
      nextHi,
      s.steepness,
      s.floor,
      s.protocolFeePercent,
      s.subjectFeePercent,
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
      s.supply,
      mid,
      s.steepness,
      s.floor,
      s.protocolFeePercent,
      s.subjectFeePercent,
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
 * Calculate how many ACES will be received when selling a given amount of RWA tokens
 */
export function quoteSellAcesFromAmount(amountIn: bigint, s: QuoteState): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  if (amountIn % W !== BigInt(0)) amountIn = (amountIn / W) * W;
  if (amountIn === BigInt(0)) return BigInt(0);

  const maxSell = s.supply - W;
  if (amountIn > maxSell) amountIn = maxSell - (maxSell % W);
  if (amountIn <= BigInt(0)) return BigInt(0);

  return getSellPriceAfterFee(
    s.supply,
    amountIn,
    s.steepness,
    s.floor,
    s.protocolFeePercent,
    s.subjectFeePercent,
  );
}
