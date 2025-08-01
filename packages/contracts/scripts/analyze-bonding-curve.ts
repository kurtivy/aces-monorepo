import { ethers } from 'hardhat';

async function main() {
  console.log('🔍 Analyzing Bonding Curve Progression...\n');

  // Contract parameters
  const BONDING_CURVE_SUPPLY = ethers.parseEther('8000000'); // 8M tokens
  const BASE_PRICE = ethers.parseUnits('0.000001', 18); // 0.000001 ETH

  // Calculate price using the same formula as the contract
  function calculatePrice(supply: bigint): bigint {
    if (supply >= BONDING_CURVE_SUPPLY) {
      // Fixed price after bonding curve is complete
      return BASE_PRICE * 2n; // 2x the base price
    }

    // Exponential curve: price = BASE_PRICE * (1 + supply/BONDING_CURVE_SUPPLY)^2
    const progress = (supply * ethers.parseEther('1')) / BONDING_CURVE_SUPPLY; // Progress as percentage (18 decimals)
    const multiplier = ethers.parseEther('1') + progress; // 1 + progress
    const price =
      (BASE_PRICE * multiplier * multiplier) / (ethers.parseEther('1') * ethers.parseEther('1')); // Square for exponential effect

    return price;
  }

  console.log('📊 Bonding Curve Analysis:');
  console.log(`   Base Price: ${ethers.formatEther(BASE_PRICE)} ETH`);
  console.log(`   Bonding Curve Supply: ${ethers.formatEther(BONDING_CURVE_SUPPLY)} tokens\n`);

  // Check key milestones
  const milestones = [
    { name: '0%', supply: 0 },
    { name: '10%', supply: 800000 },
    { name: '25%', supply: 2000000 },
    { name: '50%', supply: 4000000 },
    { name: '75%', supply: 6000000 },
    { name: '90%', supply: 7200000 },
    { name: '95%', supply: 7600000 },
    { name: '99%', supply: 7920000 },
    { name: '99.9%', supply: 7992000 },
    { name: '99.99%', supply: 7999200 },
    { name: '100% (Last in curve)', supply: 7999999 },
    { name: '100% (Fixed price)', supply: 8000000 },
  ];

  let maxPrice = BigInt(0);
  let maxPricePoint = '';

  for (const milestone of milestones) {
    const supply = ethers.parseEther(milestone.supply.toString());
    const price = calculatePrice(supply);
    const progress = ((Number(supply) / Number(BONDING_CURVE_SUPPLY)) * 100).toFixed(2);

    console.log(`   ${milestone.name.padEnd(15)} (${progress}%): ${ethers.formatEther(price)} ETH`);

    if (price > maxPrice) {
      maxPrice = price;
      maxPricePoint = milestone.name;
    }
  }

  console.log(`\n🎯 Peak Analysis:`);
  console.log(`   Maximum price occurs at: ${maxPricePoint}`);
  console.log(`   Maximum price: ${ethers.formatEther(maxPrice)} ETH`);
  console.log(`   vs Final fixed price: ${ethers.formatEther(BASE_PRICE * 2n)} ETH`);
  console.log(`   Difference: ${ethers.formatEther(maxPrice - BASE_PRICE * 2n)} ETH`);

  // Show the mathematical explanation
  console.log(`\n📐 Mathematical Explanation:`);
  console.log(`   Formula: price = BASE_PRICE * (1 + supply/BONDING_CURVE_SUPPLY)²`);
  console.log(`   At 100% completion: price = BASE_PRICE * (1 + 1)² = BASE_PRICE * 4`);
  console.log(`   But contract caps at: BASE_PRICE * 2 (fixed price)`);
  console.log(`   This creates a discontinuity where the curve peaks higher than the final price.`);

  console.log('\n✅ Analysis complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
