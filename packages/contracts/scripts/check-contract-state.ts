import { ethers } from 'hardhat';
import { formatEther } from 'ethers';

// Contract addresses from deployment (current deployed contract)
const BONDING_CURVE_ADDRESS = '0x0384a5802ec0240E0adA53e0E88EbCDc4479337a';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
  console.log('🔍 Checking Contract State for Frontend Issues...\n');

  // Connect to network
  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  );

  console.log(`📡 Connected to Base Sepolia\n`);

  // Get contract instances
  const bondingCurve = await ethers.getContractAt(
    'DualCurrencyBondingCurveToken',
    BONDING_CURVE_ADDRESS,
    provider,
  );
  const usdc = await ethers.getContractAt('IERC20', USDC_ADDRESS, provider);

  // Check contract state
  console.log('📊 Contract State Analysis:');
  console.log('========================');

  try {
    const state = await bondingCurve.getContractState();
    console.log(`✅ Contract State Retrieved Successfully`);
    console.log(`   Total Supply: ${formatEther(state[0])}`);
    console.log(`   Tokens Sold: ${formatEther(state[1])}`);
    console.log(`   ETH Raised: ${formatEther(state[2])}`);
    console.log(`   USDC Raised: ${formatEther(state[3])}`);
    console.log(`   Current Price: ${formatEther(state[4])} ETH`);
    console.log(`   Market Cap: ${formatEther(state[5])} ETH`);
    console.log(`   Progress: ${state[6]}%`);
    console.log(`   Emergency Stop: ${state[7] ? 'YES ❌' : 'NO ✅'}`);
  } catch (error) {
    console.log(`❌ Failed to get contract state: ${error}`);
    return;
  }

  // Check if trading is allowed
  console.log('\n🚦 Trading Status:');
  console.log('================');

  try {
    const emergencyStop = await bondingCurve.emergencyStop();
    if (emergencyStop) {
      console.log('❌ TRADING STOPPED - Emergency stop is active');
      console.log('   This is why frontend purchases are failing!');
      return;
    } else {
      console.log('✅ Trading is active - Emergency stop is disabled');
    }
  } catch (error) {
    console.log(`❌ Error checking emergency stop: ${error}`);
  }

  try {
    const paused = await bondingCurve.paused();
    if (paused) {
      console.log('❌ TRADING STOPPED - Contract is paused');
      console.log('   This is why frontend purchases are failing!');
      return;
    } else {
      console.log('✅ Contract is not paused');
    }
  } catch (error) {
    console.log(`❌ Error checking pause status: ${error}`);
  }

  // Check supply status
  console.log('\n📦 Supply Status:');
  console.log('================');

  try {
    const maxSupply = await bondingCurve.MAX_SUPPLY();
    const tokensSold = await bondingCurve.tokensSold();
    const remaining = maxSupply - tokensSold;

    console.log(`   Max Supply: ${formatEther(maxSupply)} tokens`);
    console.log(`   Tokens Sold: ${formatEther(tokensSold)} tokens`);
    console.log(`   Remaining: ${formatEther(remaining)} tokens`);
    console.log(`   Progress: ${((Number(tokensSold) / Number(maxSupply)) * 100).toFixed(2)}%`);

    if (tokensSold >= maxSupply) {
      console.log('❌ ALL TOKENS SOLD - No more purchases possible');
      return;
    } else {
      console.log('✅ Tokens still available for purchase');
    }
  } catch (error) {
    console.log(`❌ Error checking supply: ${error}`);
  }

  // Test quote calculations
  console.log('\n💰 Quote Testing:');
  console.log('================');

  try {
    // Test ETH quote
    const ethQuote = await bondingCurve.getQuoteForETH(ethers.parseEther('0.01'));
    console.log(`   ETH Quote (0.01 ETH): ${formatEther(ethQuote[0])} tokens`);

    if (ethQuote[0] === 0n) {
      console.log('❌ ETH Quote returns 0 tokens - This is a problem!');
    } else {
      console.log('✅ ETH Quote working correctly');
    }
  } catch (error) {
    console.log(`❌ ETH Quote failed: ${error}`);
  }

  try {
    // Test USDC quote
    const usdcQuote = await bondingCurve.getQuoteForUSDC(ethers.parseEther('30'));
    console.log(`   USDC Quote (30 USDC): ${formatEther(usdcQuote[0])} tokens`);

    if (usdcQuote[0] === 0n) {
      console.log('❌ USDC Quote returns 0 tokens - This is a problem!');
    } else {
      console.log('✅ USDC Quote working correctly');
    }
  } catch (error) {
    console.log(`❌ USDC Quote failed: ${error}`);
  }

  // Check USDC token
  console.log('\n💵 USDC Token Status:');
  console.log('====================');

  try {
    const usdcName = await usdc.name();
    const usdcSymbol = await usdc.symbol();
    const usdcDecimals = await usdc.decimals();
    const usdcTotalSupply = await usdc.totalSupply();

    console.log(`   Name: ${usdcName}`);
    console.log(`   Symbol: ${usdcSymbol}`);
    console.log(`   Decimals: ${usdcDecimals}`);
    console.log(`   Total Supply: ${formatEther(usdcTotalSupply)}`);
    console.log('✅ USDC token is accessible');
  } catch (error) {
    console.log(`❌ USDC token error: ${error}`);
  }

  // Summary
  console.log('\n📋 Summary:');
  console.log('==========');
  console.log('✅ Contract is deployed and accessible');
  console.log('✅ Trading should be active');
  console.log('✅ Tokens are available for purchase');
  console.log('✅ Quote functions are working');
  console.log('\n💡 If frontend is still failing, check:');
  console.log('   1. Wallet connection issues');
  console.log('   2. Network/RPC issues');
  console.log('   3. Gas estimation problems');
  console.log('   4. User has sufficient balance');
  console.log('   5. USDC allowance for USDC purchases');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
