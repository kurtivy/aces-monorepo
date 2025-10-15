#!/usr/bin/env ts-node

/**
 * Direct RPC test to fetch bonding data for a specific token address
 * This simulates what the backend bonding-data route does
 * Usage: cd apps/backend && npx ts-node test-bonding-data.ts
 */

import { ethers } from 'ethers';
import { config } from 'dotenv';

config();

const TOKEN_ADDRESS = '0x0806a12B64FC2F7373A699FB25932A19fd35B557';
const CHAIN_ID = 8453; // Base Mainnet

// Debug: Show what env vars we have
console.log('🔍 Environment Variables Check:');
console.log('ACES_FACTORY_PROXY_ADDRESS:', process.env.ACES_FACTORY_PROXY_ADDRESS || '(not set)');
console.log('FACTORY_PROXY_ADDRESS:', process.env.FACTORY_PROXY_ADDRESS || '(not set)');
console.log('BASE_MAINNET_RPC_URL:', process.env.BASE_MAINNET_RPC_URL ? 'SET' : '(not set)');
console.log('QUICKNODE_BASE_URL:', process.env.QUICKNODE_BASE_URL ? 'SET' : '(not set)');
console.log('');

// Factory proxy address for Base Mainnet (checksummed)
const FACTORY_PROXY_ADDRESS = ethers.getAddress(
  process.env.ACES_FACTORY_PROXY_ADDRESS ||
    process.env.FACTORY_PROXY_ADDRESS ||
    '0x6e53bd8b5e2be6cf44cc9e1c857931a0d70d48d2',
);

// RPC URL
const RPC_URL =
  process.env.BASE_MAINNET_RPC_URL || process.env.QUICKNODE_BASE_URL || 'https://mainnet.base.org';

// Simplified ABIs
const FACTORY_ABI = [
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = ['function totalSupply() view returns (uint256)'];

async function testBondingDataDirect() {
  console.log('🧪 Testing direct RPC bonding data fetch...\n');
  console.log(`Token Address: ${TOKEN_ADDRESS}`);
  console.log(`Chain ID: ${CHAIN_ID}`);
  console.log(`Factory Proxy: ${FACTORY_PROXY_ADDRESS}`);
  console.log(`RPC URL: ${RPC_URL.substring(0, 50)}...`);
  console.log('─────────────────────────────────────────────\n');

  try {
    // Create provider
    const network = new ethers.Network('base', CHAIN_ID);
    const provider = new ethers.JsonRpcProvider(RPC_URL, network, {
      staticNetwork: true,
    });

    console.log('✅ Provider created');

    // First, let's verify the factory proxy is a contract
    const factoryCode = await provider.getCode(FACTORY_PROXY_ADDRESS);
    if (factoryCode === '0x') {
      console.error('❌ Factory proxy address has no code! Not a contract.');
      console.log('💡 This might mean:');
      console.log('   - Wrong address in environment variables');
      console.log('   - Wrong network');
      console.log('   - Contract not deployed\n');
      throw new Error('Factory proxy is not a contract');
    }
    console.log('✅ Factory proxy is a contract');

    // Check if token is a contract
    const tokenCode = await provider.getCode(TOKEN_ADDRESS);
    if (tokenCode === '0x') {
      console.error('❌ Token address has no code! Not a contract.');
      throw new Error('Token is not a contract');
    }
    console.log('✅ Token is a contract');

    // Initialize contracts
    const factoryContract = new ethers.Contract(FACTORY_PROXY_ADDRESS, FACTORY_ABI, provider);
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);

    console.log('✅ Contracts initialized\n');
    console.log('🔵 Fetching data from blockchain...\n');

    // First try to get the token data to see if it's registered
    let tokenData;
    try {
      tokenData = await factoryContract.tokens(TOKEN_ADDRESS);
      console.log('✅ Token found in factory!');
    } catch (err) {
      console.error('❌ Error calling factory.tokens():');
      console.error(err);
      console.log('\n💡 This likely means:');
      console.log('   - Token is not registered in this factory');
      console.log('   - Wrong factory proxy address');
      console.log('   - ABI mismatch\n');
      throw err;
    }

    // Get total supply
    const totalSupply = await tokenContract.totalSupply();
    console.log('✅ Total supply fetched');

    console.log('✅ Data fetched successfully!\n');

    // Parse contract data
    const curve = Number(tokenData.curve);
    const currentSupply = ethers.formatEther(totalSupply);
    const tokensBondedAt = ethers.formatEther(tokenData.tokensBondedAt);
    const acesBalance = ethers.formatEther(tokenData.acesTokenBalance);
    const floorWei = tokenData.floor.toString();
    const floorPriceACES = ethers.formatEther(tokenData.floor);
    const steepness = tokenData.steepness.toString();
    const isBonded = Boolean(tokenData.tokenBonded);

    // Calculate bonding percentage
    const currentSupplyNum = parseFloat(currentSupply);
    const tokensBondedAtNum = parseFloat(tokensBondedAt);
    const bondingPercentage = isBonded
      ? 100
      : tokensBondedAtNum > 0
        ? Math.min(100, (currentSupplyNum / tokensBondedAtNum) * 100)
        : 0;

    // Display results
    console.log('📊 RAW CONTRACT DATA:');
    console.log('═════════════════════════════════════════════');
    console.log('tokenData.curve:', tokenData.curve.toString());
    console.log('tokenData.tokenAddress:', tokenData.tokenAddress);
    console.log('tokenData.floor:', tokenData.floor.toString(), 'wei');
    console.log('tokenData.steepness:', tokenData.steepness.toString());
    console.log('tokenData.acesTokenBalance:', tokenData.acesTokenBalance.toString(), 'wei');
    console.log('tokenData.subjectFeeDestination:', tokenData.subjectFeeDestination);
    console.log('tokenData.tokensBondedAt:', tokenData.tokensBondedAt.toString(), 'wei');
    console.log('tokenData.tokenBonded:', tokenData.tokenBonded);
    console.log('totalSupply:', totalSupply.toString(), 'wei');
    console.log('═════════════════════════════════════════════\n');

    console.log('📊 PARSED BONDING DATA (as returned by useTokenBondingData hook):');
    console.log('═════════════════════════════════════════════');
    console.log(`curve: ${curve}`);
    console.log(`currentSupply: "${currentSupply}" tokens`);
    console.log(`tokensBondedAt: "${tokensBondedAt}" tokens`);
    console.log(`acesBalance: "${acesBalance}" ACES`);
    console.log(`floorWei: "${floorWei}"`);
    console.log(`floorPriceACES: "${floorPriceACES}" ACES`);
    console.log(`steepness: "${steepness}"`);
    console.log(`isBonded: ${isBonded}`);
    console.log(`bondingPercentage: ${bondingPercentage.toFixed(4)}%`);
    console.log(`loading: false`);
    console.log(`error: null`);
    console.log('═════════════════════════════════════════════\n');

    console.log('📈 ANALYSIS:');
    console.log('─────────────────────────────────────────────');

    if (tokensBondedAtNum === 0) {
      console.log('⚠️  WARNING: tokensBondedAt is ZERO!');
      console.log('   This token may not be properly configured in the factory.');
      console.log('   The hook will use the default value of "30000000" tokens.');
    } else {
      console.log(`✅ Token will bond at: ${tokensBondedAtNum.toLocaleString()} tokens`);
      console.log(`✅ Current supply: ${currentSupplyNum.toLocaleString()} tokens`);
      console.log(`✅ Progress to bonding: ${bondingPercentage.toFixed(2)}%`);
      console.log(
        `✅ Remaining to bond: ${(tokensBondedAtNum - currentSupplyNum).toLocaleString()} tokens`,
      );
    }

    if (isBonded) {
      console.log('🎉 Token is BONDED!');
    } else {
      console.log('⏳ Token is NOT yet bonded');
    }

    if (parseFloat(acesBalance) > 0) {
      console.log(`💰 ACES balance in pool: ${parseFloat(acesBalance).toLocaleString()} ACES`);
    } else {
      console.log('⚠️  No ACES balance in pool');
    }

    console.log('─────────────────────────────────────────────\n');

    // Return the data object as it would be returned by the hook
    const result = {
      curve,
      currentSupply,
      tokensBondedAt,
      acesBalance,
      floorWei,
      floorPriceACES,
      steepness,
      isBonded,
      bondingPercentage,
      loading: false,
      error: null,
    };

    console.log('🎯 FINAL RESULT (JSON):');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n');

    return result;
  } catch (error) {
    console.error('\n❌ Error fetching bonding data:');
    console.error(error);

    if (error instanceof Error) {
      if (error.message.includes('could not detect network')) {
        console.error('\n💡 TIP: Check your RPC_URL environment variable');
      }
      if (error.message.includes('invalid address')) {
        console.error('\n💡 TIP: Check FACTORY_PROXY_ADDRESS or token address');
      }
    }

    throw error;
  }
}

// Run the test
testBondingDataDirect()
  .then((data) => {
    console.log('✅ Test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed');
    process.exit(1);
  });
