import { ethers, run } from 'hardhat';
import fs from 'fs';
import path from 'path';

interface DeploymentAddresses {
  network: string;
  chainId: number;
  deployedAt: string;
  contracts: {
    acesToken: string;
    mockRwaDeedNft: string;
    mockRwaFactory: string;
  };
}

async function main() {
  console.log('🚀 Starting deployment to Base Sepolia...\n');

  // Get the network info
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther('0.01')) {
    throw new Error('❌ Insufficient balance. Need at least 0.01 ETH for deployment.');
  }

  console.log('📋 Deploying contracts...\n');

  // 1. Deploy AcesToken
  console.log('1️⃣  Deploying AcesToken...');
  const AcesToken = await ethers.getContractFactory('AcesToken');
  const acesToken = await AcesToken.deploy(deployer.address);
  await acesToken.waitForDeployment();
  const acesTokenAddress = await acesToken.getAddress();
  console.log(`✅ AcesToken deployed to: ${acesTokenAddress}\n`);

  // 2. Deploy MockRwaDeedNft
  console.log('2️⃣  Deploying MockRwaDeedNft...');
  const MockRwaDeedNft = await ethers.getContractFactory('MockRwaDeedNft');
  const mockRwaDeedNft = await MockRwaDeedNft.deploy(deployer.address);
  await mockRwaDeedNft.waitForDeployment();
  const mockRwaDeedNftAddress = await mockRwaDeedNft.getAddress();
  console.log(`✅ MockRwaDeedNft deployed to: ${mockRwaDeedNftAddress}\n`);

  // 3. Deploy SimpleMockRwaFactory (working version for Phase 1)
  console.log('3️⃣  Deploying SimpleMockRwaFactory...');
  const SimpleMockRwaFactory = await ethers.getContractFactory('SimpleMockRwaFactory');
  const mockRwaFactory = await SimpleMockRwaFactory.deploy(acesTokenAddress, mockRwaDeedNftAddress);
  await mockRwaFactory.waitForDeployment();
  const mockRwaFactoryAddress = await mockRwaFactory.getAddress();
  console.log(`✅ SimpleMockRwaFactory deployed to: ${mockRwaFactoryAddress}\n`);

  // 4. Grant MINTER_ROLE to factory on the NFT contract
  console.log('4️⃣  Setting up permissions...');
  const MINTER_ROLE = await mockRwaDeedNft.MINTER_ROLE();
  const tx = await mockRwaDeedNft.grantRole(MINTER_ROLE, mockRwaFactoryAddress);
  await tx.wait();
  console.log(`✅ Granted MINTER_ROLE to factory on NFT contract\n`);

  // Save deployment addresses
  const deploymentInfo: DeploymentAddresses = {
    network: 'baseSepolia',
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      acesToken: acesTokenAddress,
      mockRwaDeedNft: mockRwaDeedNftAddress,
      mockRwaFactory: mockRwaFactoryAddress,
    },
  };

  const deploymentPath = path.join(__dirname, '../deployments.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved to: ${deploymentPath}\n`);

  // Verify contracts on Etherscan (optional)
  if (process.env.BASE_SCAN_API_KEY) {
    console.log('🔍 Verifying contracts on BaseScan...\n');

    try {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

      console.log('Verifying AcesToken...');
      await run('verify:verify', {
        address: acesTokenAddress,
        constructorArguments: [deployer.address],
      });

      console.log('Verifying MockRwaDeedNft...');
      await run('verify:verify', {
        address: mockRwaDeedNftAddress,
        constructorArguments: [deployer.address],
      });

      console.log('Verifying SimpleMockRwaFactory...');
      await run('verify:verify', {
        address: mockRwaFactoryAddress,
        constructorArguments: [acesTokenAddress, mockRwaDeedNftAddress],
      });

      console.log('✅ All contracts verified!\n');
    } catch (error) {
      console.log('⚠️  Verification failed (this is optional):', error);
    }
  }

  console.log('🎉 Deployment completed successfully!\n');
  console.log('📋 Contract Addresses:');
  console.log(`   AcesToken:      ${acesTokenAddress}`);
  console.log(`   MockRwaDeedNft: ${mockRwaDeedNftAddress}`);
  console.log(`   MockRwaFactory: ${mockRwaFactoryAddress}\n`);

  console.log('🔗 View on BaseScan:');
  console.log(`   AcesToken:      https://sepolia.basescan.org/address/${acesTokenAddress}`);
  console.log(`   MockRwaDeedNft: https://sepolia.basescan.org/address/${mockRwaDeedNftAddress}`);
  console.log(`   MockRwaFactory: https://sepolia.basescan.org/address/${mockRwaFactoryAddress}`);

  return deploymentInfo;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
