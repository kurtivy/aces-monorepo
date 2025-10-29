/**
 * Query pool reserves directly from the contract
 * Run with: npx ts-node apps/backend/test-pool-reserves-direct.ts <poolAddress>
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const ACES_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367';

// Standard Uniswap V2 / Aerodrome Pool ABI
const POOL_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
];

// ERC20 ABI for token info
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];

async function testPoolReservesDirect() {
  console.log('\n🧪 Testing Pool Reserves (Direct Contract Query)\n');

  const poolAddress = process.argv[2] || '0xf417266144036d539ffea594bc6653a89ecfad45';

  const rpcUrl = process.env.QUICKNODE_BASE_URL || process.env.BASE_MAINNET_RPC_URL;
  if (!rpcUrl) {
    console.error('❌ No RPC URL found (QUICKNODE_BASE_URL or BASE_MAINNET_RPC_URL)');
    process.exit(1);
  }

  console.log('✅ RPC URL found:', rpcUrl.substring(0, 40) + '...');
  console.log('📡 Pool Address:', poolAddress);
  console.log('🪙 ACES Address:', ACES_ADDRESS);
  console.log('');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    // Check if pool contract exists
    const code = await provider.getCode(poolAddress);
    if (code === '0x') {
      console.error('❌ No contract found at this address');
      console.error('   The pool address might be invalid');
      process.exit(1);
    }
    console.log('✅ Contract exists at address');
    console.log('');

    // Get pool contract
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

    // Get reserves
    console.log('📊 Fetching reserves...');
    const reserves = await poolContract.getReserves();
    console.log('✅ Reserves fetched');
    console.log('');

    // Get token addresses
    console.log('🪙 Fetching token addresses...');
    const token0Address = await poolContract.token0();
    const token1Address = await poolContract.token1();
    console.log('  Token0:', token0Address);
    console.log('  Token1:', token1Address);
    console.log('');

    // Get token info
    console.log('📝 Fetching token details...');
    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);

    const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
      token0Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.symbol(),
      token1Contract.decimals(),
    ]);

    console.log(`  Token0: ${token0Symbol} (${token0Decimals} decimals)`);
    console.log(`  Token1: ${token1Symbol} (${token1Decimals} decimals)`);
    console.log('');

    // Parse reserves
    const reserve0Raw = reserves[0];
    const reserve1Raw = reserves[1];

    const reserve0 = Number(ethers.formatUnits(reserve0Raw, token0Decimals));
    const reserve1 = Number(ethers.formatUnits(reserve1Raw, token1Decimals));

    console.log('💰 Pool Reserves:');
    console.log(`  Reserve0 (${token0Symbol}):`, reserve0.toFixed(4));
    console.log(`  Reserve1 (${token1Symbol}):`, reserve1.toFixed(4));
    console.log('');

    // Identify which token is ACES
    const isToken0Aces = token0Address.toLowerCase() === ACES_ADDRESS.toLowerCase();
    const isToken1Aces = token1Address.toLowerCase() === ACES_ADDRESS.toLowerCase();

    if (!isToken0Aces && !isToken1Aces) {
      console.warn('⚠️  ACES token not found in this pool');
      console.warn('   This might not be an ACES trading pool');
      return;
    }

    const acesReserve = isToken0Aces ? reserve0 : reserve1;
    const otherReserve = isToken0Aces ? reserve1 : reserve0;
    const otherSymbol = isToken0Aces ? token1Symbol : token0Symbol;

    console.log('🎯 ACES Identified:');
    console.log(`  ACES Reserve: ${acesReserve.toFixed(4)} ACES`);
    console.log(`  ${otherSymbol} Reserve: ${otherReserve.toFixed(4)} ${otherSymbol}`);
    console.log('');

    // Calculate USD value (assuming ACES price)
    const exampleAcesPrice = 0.5; // You can update this
    const liquidityUsd = acesReserve * exampleAcesPrice;

    console.log('💵 Liquidity USD Calculation:');
    console.log(`  ACES Price: $${exampleAcesPrice}`);
    console.log(`  Liquidity USD: $${liquidityUsd.toFixed(2)}`);
    console.log('');

    console.log('📋 Summary for Backend Integration:');
    console.log(JSON.stringify({
      poolAddress,
      acesReserve: acesReserve.toString(),
      liquidityUsd: liquidityUsd.toFixed(2),
      token0: token0Symbol,
      token1: token1Symbol,
      isToken0Aces,
    }, null, 2));

  } catch (error) {
    console.error('❌ Error querying pool:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }

  console.log('\n✅ Test complete\n');
}

testPoolReservesDirect();

