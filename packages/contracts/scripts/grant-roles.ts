import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Starting role granting process...\n');

  // Contract addresses from deployments.json
  const FACTORY_ADDRESS = '0x2e2aaDB15f11f1Ca7a0c5Acb5655e2f56701104A';

  // Connect to the wallet
  const [signer] = await ethers.getSigners();
  console.log(`Using signer address: ${signer.address}\n`);

  // Get the factory contract
  const factory = await ethers.getContractAt('SimpleMockRwaFactory', FACTORY_ADDRESS, signer);

  // Get the roles
  const RWA_CREATOR_ROLE = await factory.RWA_CREATOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();

  // Grant roles to the signer
  console.log('Granting roles to signer...');

  try {
    // Grant RWA_CREATOR_ROLE
    const tx1 = await factory.grantRole(RWA_CREATOR_ROLE, signer.address);
    await tx1.wait();
    console.log('✅ Granted RWA_CREATOR_ROLE');

    // Grant DEFAULT_ADMIN_ROLE
    const tx2 = await factory.grantRole(DEFAULT_ADMIN_ROLE, signer.address);
    await tx2.wait();
    console.log('✅ Granted DEFAULT_ADMIN_ROLE');

    console.log('\n🎉 Successfully granted all roles!');

    // Verify roles
    const hasCreatorRole = await factory.hasRole(RWA_CREATOR_ROLE, signer.address);
    const hasAdminRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

    console.log('\nRole verification:');
    console.log(`RWA_CREATOR_ROLE: ${hasCreatorRole}`);
    console.log(`DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
  } catch (error) {
    console.error('Error granting roles:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
