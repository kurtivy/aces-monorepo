/**
 * Bonding Curve Mathematics
 * 
 * Pure mathematical implementation of the quadratic bonding curve
 * that matches the smart contract logic. This allows us to calculate
 * quotes WITHOUT making RPC calls, dramatically reducing rate limiting.
 * 
 * Formula: price = (summation * 1e18 / steepness) + (floor * amount)
 * Where summation = sumSquares(endSupply) - sumSquares(startSupply)
 */

import { ethers } from 'ethers';

const W = BigInt(10) ** BigInt(18); // 1e18 for wei calculations

/**
 * Calculate sum of squares from 0 to s
 * Formula: s(s+1)(2s+1) / 6
 */
function sumSquares(s: bigint): bigint {
  if (s === BigInt(0)) return BigInt(0);
  const t1 = (s * (s + W)) / W;
  const t2 = (t1 * (BigInt(2) * s + W)) / W;
  return t2 / (BigInt(6) * W);
}

/**
 * Calculate the cost to buy a specific amount of tokens
 * Returns cost in ACES (as BigInt wei)
 */
export function calculateBuyCost(
  currentSupply: bigint, // Current supply in wei
  amount: bigint, // Amount to buy in wei
  steepness: bigint, // Steepness parameter from contract
  floor: bigint, // Floor price from contract
): bigint {
  const startWei = currentSupply;
  const endWei = currentSupply + amount - W;

  const sumBefore = sumSquares(startWei - W);
  const sumAfter = sumSquares(endWei);
  const summation = sumAfter - sumBefore;

  const curveComponent = (summation * W) / steepness;
  const linearComponent = (floor * amount) / W;
  const basePrice = curveComponent + linearComponent;

  // Add fees: 5% protocol + 5% subject = 10% total
  const feePercent = (BigInt(10) * W) / BigInt(100);
  const priceWithFees = basePrice + (basePrice * feePercent) / W;

  return priceWithFees;
}

/**
 * Calculate sell price (tokens → ACES)
 * Returns amount received in ACES (as BigInt wei)
 */
export function calculateSellPrice(
  currentSupply: bigint, // Current supply in wei
  amount: bigint, // Amount to sell in wei
  steepness: bigint, // Steepness parameter from contract
  floor: bigint, // Floor price from contract
): bigint {
  // Selling reduces supply
  const startWei = currentSupply - amount;
  const endWei = currentSupply - W;

  const sumBefore = sumSquares(startWei - W);
  const sumAfter = sumSquares(endWei);
  const summation = sumAfter - sumBefore;

  const curveComponent = (summation * W) / steepness;
  const linearComponent = (floor * amount) / W;
  const basePrice = curveComponent + linearComponent;

  // Subtract fees: 10% total
  const feePercent = (BigInt(10) * W) / BigInt(100);
  const priceAfterFees = basePrice - (basePrice * feePercent) / W;

  return priceAfterFees;
}

/**
 * Calculate how many tokens can be bought with a specific ACES amount
 * Uses iterative approximation instead of binary search RPC calls
 * 
 * This is much faster and uses ZERO RPC calls!
 */
export function calculateTokensForACES(
  currentSupply: bigint, // Current supply in wei
  acesAmount: bigint, // ACES to spend in wei
  steepness: bigint,
  floor: bigint,
  tokenDecimals: number = 18,
): bigint {
  const oneToken = BigInt(10) ** BigInt(tokenDecimals);
  
  // Start with a reasonable estimate based on marginal price
  let estimate = oneToken;
  let lastEstimate = BigInt(0);
  let iterations = 0;
  const maxIterations = 20; // Much fewer iterations than binary search
  
  // Newton's method for finding the right amount
  while (iterations < maxIterations && estimate !== lastEstimate) {
    lastEstimate = estimate;
    
    const cost = calculateBuyCost(currentSupply, estimate, steepness, floor);
    
    if (cost === acesAmount) {
      // Perfect match
      return estimate;
    }
    
    if (cost > acesAmount) {
      // Too expensive, reduce estimate
      const ratio = (acesAmount * W) / cost;
      estimate = (estimate * ratio) / W;
    } else {
      // Can afford more, increase estimate proportionally
      const remainingACES = acesAmount - cost;
      const marginalPrice = calculateBuyCost(currentSupply + estimate, oneToken, steepness, floor);
      
      if (marginalPrice === BigInt(0)) break;
      
      const additionalTokens = (remainingACES * oneToken) / marginalPrice;
      estimate = estimate + additionalTokens;
    }
    
    // Round down to nearest token
    estimate = (estimate / oneToken) * oneToken;
    
    // Safety check: don't exceed reasonable bounds
    if (estimate < oneToken) estimate = oneToken;
    if (estimate > BigInt(1000000000) * oneToken) estimate = BigInt(1000000000) * oneToken;
    
    iterations++;
  }
  
  // Verify the final estimate doesn't exceed budget
  const finalCost = calculateBuyCost(currentSupply, estimate, steepness, floor);
  
  if (finalCost > acesAmount && estimate > oneToken) {
    // Reduce by one token if over budget
    estimate = estimate - oneToken;
  }
  
  return estimate;
}

// Supply cache to reduce RPC calls even further
const supplyCache = new Map<string, { supply: bigint; timestamp: number }>();
const pendingRequests = new Map<string, Promise<bigint>>(); // Request coalescing
const SUPPLY_CACHE_TTL = 5000; // 5 seconds (increased from 2s for better cache hit rate)

/**
 * Helper: Get current supply from contract (only RPC call needed)
 * Cached for 5s + request coalescing to handle high concurrent load
 */
export async function getCurrentSupply(
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
): Promise<bigint> {
  const now = Date.now();
  const cached = supplyCache.get(tokenAddress);
  
  // Return cached value if still fresh
  if (cached && now - cached.timestamp < SUPPLY_CACHE_TTL) {
    return cached.supply;
  }

  // Check if request is already in flight (request coalescing)
  const pending = pendingRequests.get(tokenAddress);
  if (pending) {
    console.log(`[Supply] ⚡ Coalescing request for ${tokenAddress} (${pendingRequests.size} pending)`);
    return pending; // Multiple concurrent requests share same promise
  }

  // Make new request
  const promise = (async () => {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function totalSupply() view returns (uint256)'],
        provider,
      );
      
      const supply = await tokenContract.totalSupply();
      supplyCache.set(tokenAddress, { supply, timestamp: Date.now() });
      return supply;
    } finally {
      // Clean up pending request
      pendingRequests.delete(tokenAddress);
    }
  })();

  pendingRequests.set(tokenAddress, promise);
  return promise;
}

/**
 * Complete quote calculation with minimal RPC calls
 * Only needs: 1 RPC for supply, 1 RPC for token data
 * vs 50+ RPC calls for binary search!
 */
export async function getOptimizedQuote(params: {
  tokenAddress: string;
  inputAsset: 'ACES' | 'TOKEN';
  amount: string;
  tokenDecimals: number;
  steepness: bigint;
  floor: bigint;
  provider: ethers.JsonRpcProvider;
}): Promise<{ expectedOutput: string; supplyUsed: bigint }> {
  const { tokenAddress, inputAsset, amount, tokenDecimals, steepness, floor, provider } = params;
  
  // Get current supply (1 RPC call)
  const currentSupply = await getCurrentSupply(tokenAddress, provider);
  
  if (inputAsset === 'ACES') {
    // ACES → TOKEN (buy)
    const acesWei = ethers.parseEther(amount);
    const tokensWei = calculateTokensForACES(currentSupply, acesWei, steepness, floor, tokenDecimals);
    const expectedOutput = ethers.formatUnits(tokensWei, tokenDecimals);
    
    return { expectedOutput, supplyUsed: currentSupply };
  } else {
    // TOKEN → ACES (sell)
    const tokensWei = ethers.parseUnits(amount, tokenDecimals);
    const acesWei = calculateSellPrice(currentSupply, tokensWei, steepness, floor);
    const expectedOutput = ethers.formatEther(acesWei);
    
    return { expectedOutput, supplyUsed: currentSupply };
  }
}

