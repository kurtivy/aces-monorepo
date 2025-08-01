import { ethers } from 'hardhat';
import { parseEther, formatEther } from 'ethers';

// Contract addresses from deployment
const BONDING_CURVE_ADDRESS = '0x0384a5802ec0240E0adA53e0E88EbCDc4479337a';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
  console.log('🔍 Debugging Frontend Purchase Issues...\n');

  // Connect to network
  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  );

  // Use a test wallet (replace with your private key)
  const privateKey =
    process.env.TEST_PRIVATE_KEY ||
    '0x1234567890123456789012345678901234567890123456789012345678901234';
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📡 Connected to Base Sepolia`);
  console.log(`👤 Test wallet: ${wallet.address}`);
  console.log(`💰 Balance: ${formatEther(await provider.getBalance(wallet.address))} ETH\n`);

  // Get contract instances
  const bondingCurve = await ethers.getContractAt(
    'DualCurrencyBondingCurveToken',
    BONDING_CURVE_ADDRESS,
    wallet,
  );
  const usdc = await ethers.getContractAt('IERC20', USDC_ADDRESS, wallet);

  // Check contract state
  console.log('📊 Contract State Check:');
  const state = await bondingCurve.getContractState();
  console.log(`   Emergency Stop: ${state[7] ? 'YES - TRADING STOPPED' : 'NO - TRADING ACTIVE'}`);
  console.log(`   Tokens Sold: ${formatEther(state[1])}`);
  console.log(`   Progress: ${state[6]}%`);
  console.log(`   Current Price: ${formatEther(state[4])} ETH\n`);

  if (state[7]) {
    console.log('❌ CONTRACT IS IN EMERGENCY STOP - NO TRADING ALLOWED');
    return;
  }

  // Test the exact same transaction flow as frontend
  console.log('🧪 Testing Frontend Transaction Flow...\n');

  // Test 1: ETH Purchase (like frontend)
  await testFrontendETHPurchase(bondingCurve, parseEther('0.01'));

  // Test 2: USDC Purchase (like frontend)
  await testFrontendUSDCPurchase(bondingCurve, usdc, parseEther('30')); // 30 USDC = 0.01 ETH equivalent

  // Test 3: Check for common issues
  await checkCommonIssues(bondingCurve, usdc, wallet);
}

async function testFrontendETHPurchase(bondingCurve: ethers.Contract, ethAmount: bigint) {
  console.log(`💸 Testing ETH Purchase (${formatEther(ethAmount)} ETH):`);

  try {
    // Step 1: Get quote (like frontend does)
    console.log('   1️⃣ Getting quote...');
    const quote = await bondingCurve.getQuoteForETH(ethAmount);
    console.log(`      Quote: ${formatEther(quote[0])} tokens for ${formatEther(ethAmount)} ETH`);

    if (quote[0] === 0n) {
      console.log('   ❌ Quote returned 0 tokens - this is the problem!');
      return;
    }

    // Step 2: Check if we have enough ETH
    const balance = await bondingCurve.signer.provider!.getBalance(bondingCurve.signer.address);
    console.log(`   2️⃣ ETH Balance: ${formatEther(balance)}`);

    if (balance < ethAmount) {
      console.log('   ❌ Insufficient ETH balance');
      return;
    }

    // Step 3: Execute transaction (like frontend)
    console.log('   3️⃣ Executing transaction...');
    const tx = await bondingCurve.buyWithETH({ value: ethAmount });
    console.log(`      Transaction hash: ${tx.hash}`);

    // Step 4: Wait for confirmation
    console.log('   4️⃣ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`      ✅ Confirmed in block ${receipt?.blockNumber}`);

    // Step 5: Verify results
    const newBalance = await bondingCurve.balanceOf(bondingCurve.signer.address);
    console.log(`   5️⃣ New token balance: ${formatEther(newBalance)}`);

    if (newBalance > 0n) {
      console.log('   ✅ ETH Purchase SUCCESSFUL!');
    } else {
      console.log('   ❌ ETH Purchase failed - no tokens received');
    }
  } catch (error) {
    console.log(`   ❌ ETH Purchase failed: ${error}`);
    if (error instanceof Error) {
      console.log(`      Error message: ${error.message}`);
      console.log(`      Error code: ${(error as any).code}`);
    }
  }
  console.log('');
}

async function testFrontendUSDCPurchase(
  bondingCurve: ethers.Contract,
  usdc: ethers.Contract,
  usdcAmount: bigint,
) {
  console.log(`💸 Testing USDC Purchase (${formatEther(usdcAmount)} USDC):`);

  try {
    // Step 1: Check USDC balance
    console.log('   1️⃣ Checking USDC balance...');
    const usdcBalance = await usdc.balanceOf(bondingCurve.signer.address);
    console.log(`      USDC Balance: ${formatEther(usdcBalance)}`);

    if (usdcBalance < usdcAmount) {
      console.log('   ❌ Insufficient USDC balance');
      return;
    }

    // Step 2: Check allowance
    console.log('   2️⃣ Checking USDC allowance...');
    const allowance = await usdc.allowance(bondingCurve.signer.address, BONDING_CURVE_ADDRESS);
    console.log(`      Current allowance: ${formatEther(allowance)}`);

    // Step 3: Approve if needed (like frontend does)
    if (allowance < usdcAmount) {
      console.log('   3️⃣ Approving USDC spending...');
      const approveTx = await usdc.approve(BONDING_CURVE_ADDRESS, usdcAmount);
      await approveTx.wait();
      console.log('      ✅ USDC approved');
    } else {
      console.log('   3️⃣ USDC already approved');
    }

    // Step 4: Get quote
    console.log('   4️⃣ Getting quote...');
    const quote = await bondingCurve.getQuoteForUSDC(usdcAmount);
    console.log(`      Quote: ${formatEther(quote[0])} tokens for ${formatEther(usdcAmount)} USDC`);

    if (quote[0] === 0n) {
      console.log('   ❌ Quote returned 0 tokens - this is the problem!');
      return;
    }

    // Step 5: Execute transaction
    console.log('   5️⃣ Executing transaction...');
    const tx = await bondingCurve.buyWithUSDC(usdcAmount);
    console.log(`      Transaction hash: ${tx.hash}`);

    // Step 6: Wait for confirmation
    console.log('   6️⃣ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`      ✅ Confirmed in block ${receipt?.blockNumber}`);

    // Step 7: Verify results
    const newBalance = await bondingCurve.balanceOf(bondingCurve.signer.address);
    console.log(`   7️⃣ New token balance: ${formatEther(newBalance)}`);

    if (newBalance > 0n) {
      console.log('   ✅ USDC Purchase SUCCESSFUL!');
    } else {
      console.log('   ❌ USDC Purchase failed - no tokens received');
    }
  } catch (error) {
    console.log(`   ❌ USDC Purchase failed: ${error}`);
    if (error instanceof Error) {
      console.log(`      Error message: ${error.message}`);
      console.log(`      Error code: ${(error as any).code}`);
    }
  }
  console.log('');
}

async function checkCommonIssues(
  bondingCurve: ethers.Contract,
  usdc: ethers.Contract,
  wallet: ethers.Wallet,
) {
  console.log('🔍 Checking for Common Issues:\n');

  // Issue 1: Contract paused
  try {
    const paused = await bondingCurve.paused();
    console.log(`1️⃣ Contract Paused: ${paused ? 'YES - TRADING STOPPED' : 'NO - TRADING ACTIVE'}`);
  } catch (error) {
    console.log(`1️⃣ Contract Paused: Error checking - ${error}`);
  }

  // Issue 2: Emergency stop
  try {
    const emergencyStop = await bondingCurve.emergencyStop();
    console.log(
      `2️⃣ Emergency Stop: ${emergencyStop ? 'YES - TRADING STOPPED' : 'NO - TRADING ACTIVE'}`,
    );
  } catch (error) {
    console.log(`2️⃣ Emergency Stop: Error checking - ${error}`);
  }

  // Issue 3: Max supply reached
  try {
    const maxSupply = await bondingCurve.MAX_SUPPLY();
    const tokensSold = await bondingCurve.tokensSold();
    console.log(
      `3️⃣ Supply Status: ${formatEther(tokensSold)}/${formatEther(maxSupply)} tokens sold`,
    );
    console.log(`   Max Supply Reached: ${tokensSold >= maxSupply ? 'YES' : 'NO'}`);
  } catch (error) {
    console.log(`3️⃣ Supply Status: Error checking - ${error}`);
  }

  // Issue 4: USDC allowance issues
  try {
    const allowance = await usdc.allowance(wallet.address, BONDING_CURVE_ADDRESS);
    const balance = await usdc.balanceOf(wallet.address);
    console.log(`4️⃣ USDC Status:`);
    console.log(`   Balance: ${formatEther(balance)}`);
    console.log(`   Allowance: ${formatEther(allowance)}`);
    console.log(`   Sufficient Allowance: ${allowance >= balance ? 'YES' : 'NO'}`);
  } catch (error) {
    console.log(`4️⃣ USDC Status: Error checking - ${error}`);
  }

  // Issue 5: Gas estimation
  try {
    console.log(`5️⃣ Gas Estimation Test:`);
    const gasEstimate = await bondingCurve.buyWithETH.estimateGas({ value: parseEther('0.001') });
    console.log(`   ETH Purchase Gas: ${gasEstimate.toString()} gas`);
  } catch (error) {
    console.log(`5️⃣ Gas Estimation: Failed - ${error}`);
  }

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
