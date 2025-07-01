import fs from 'fs';
import path from 'path';

interface ArtifactFile {
  abi: unknown[];
  contractName: string;
  sourceName: string;
}

interface ContractABIs {
  AcesToken: unknown[];
  MockRwaDeedNft: unknown[];
  MockRwaFactory: unknown[];
  MockBondingCurveToken: unknown[];
}

async function main() {
  console.log('🔍 Extracting ABIs from compiled artifacts...\n');

  const contractsDir = path.join(__dirname, '../artifacts/contracts');
  const utilsAbiPath = path.join(__dirname, '../../utils/src/abis.ts');
  const utilsContractsPath = path.join(__dirname, '../../utils/src/contracts.ts');
  const deploymentsPath = path.join(__dirname, '../deployments.json');

  // Read deployment addresses
  let deploymentAddresses: {
    contracts?: Record<string, string>;
    network?: string;
    chainId?: number;
    deployedAt?: string;
  } = {};
  if (fs.existsSync(deploymentsPath)) {
    const deploymentData = fs.readFileSync(deploymentsPath, 'utf8');
    deploymentAddresses = JSON.parse(deploymentData);
    console.log('✅ Found deployment addresses');
  } else {
    console.log('⚠️  No deployment addresses found. Run deployment first.');
  }

  // Extract ABIs from artifacts
  const abis: Partial<ContractABIs> = {};

  // 1. AcesToken
  const acesTokenArtifact = path.join(contractsDir, 'AcesToken.sol/AcesToken.json');
  if (fs.existsSync(acesTokenArtifact)) {
    const artifact: ArtifactFile = JSON.parse(fs.readFileSync(acesTokenArtifact, 'utf8'));
    abis.AcesToken = artifact.abi;
    console.log('✅ Extracted AcesToken ABI');
  }

  // 2. MockRwaDeedNft
  const mockRwaDeedNftArtifact = path.join(
    contractsDir,
    'mocks/MockRwaDeedNft.sol/MockRwaDeedNft.json',
  );
  if (fs.existsSync(mockRwaDeedNftArtifact)) {
    const artifact: ArtifactFile = JSON.parse(fs.readFileSync(mockRwaDeedNftArtifact, 'utf8'));
    abis.MockRwaDeedNft = artifact.abi;
    console.log('✅ Extracted MockRwaDeedNft ABI');
  }

  // 3. SimpleMockRwaFactory
  const simpleMockRwaFactoryArtifact = path.join(
    contractsDir,
    'mocks/SimpleMockRwaFactory.sol/SimpleMockRwaFactory.json',
  );
  if (fs.existsSync(simpleMockRwaFactoryArtifact)) {
    const artifact: ArtifactFile = JSON.parse(
      fs.readFileSync(simpleMockRwaFactoryArtifact, 'utf8'),
    );
    abis.MockRwaFactory = artifact.abi; // Keep the same name for compatibility
    console.log('✅ Extracted SimpleMockRwaFactory ABI');
  }

  // 4. MockBondingCurveToken
  const mockBondingCurveTokenArtifact = path.join(
    contractsDir,
    'mocks/MockBondingCurveToken.sol/MockBondingCurveToken.json',
  );
  if (fs.existsSync(mockBondingCurveTokenArtifact)) {
    const artifact: ArtifactFile = JSON.parse(
      fs.readFileSync(mockBondingCurveTokenArtifact, 'utf8'),
    );
    abis.MockBondingCurveToken = artifact.abi;
    console.log('✅ Extracted MockBondingCurveToken ABI');
  }

  // Generate ABIs file
  const abisFileContent = `// Auto-generated file - DO NOT EDIT
// Generated from compiled contract artifacts
// Run 'pnpm extract-abis' to regenerate

export const ACES_TOKEN_ABI = ${JSON.stringify(abis.AcesToken || [], null, 2)} as const;

export const MOCK_RWA_DEED_NFT_ABI = ${JSON.stringify(abis.MockRwaDeedNft || [], null, 2)} as const;

export const MOCK_RWA_FACTORY_ABI = ${JSON.stringify(abis.MockRwaFactory || [], null, 2)} as const;

export const MOCK_BONDING_CURVE_TOKEN_ABI = ${JSON.stringify(abis.MockBondingCurveToken || [], null, 2)} as const;

// Exported for convenience
export const ABIS = {
  AcesToken: ACES_TOKEN_ABI,
  MockRwaDeedNft: MOCK_RWA_DEED_NFT_ABI,
  MockRwaFactory: MOCK_RWA_FACTORY_ABI,
  MockBondingCurveToken: MOCK_BONDING_CURVE_TOKEN_ABI,
} as const;
`;

  fs.writeFileSync(utilsAbiPath, abisFileContent);
  console.log(`✅ ABIs written to ${utilsAbiPath}`);

  // Update contracts.ts with deployment addresses
  if (deploymentAddresses.contracts) {
    const contractsFileContent = `// Auto-generated file - DO NOT EDIT
// Generated from deployment addresses
// Run 'pnpm extract-abis' to regenerate

export const CONTRACTS = {
  localhost: {
    acesToken: '',
    mockRwaDeedNft: '',
    mockRwaFactory: '',
  },
  baseSepolia: {
    acesToken: '${deploymentAddresses.contracts.acesToken || ''}',
    mockRwaDeedNft: '${deploymentAddresses.contracts.mockRwaDeedNft || ''}',
    mockRwaFactory: '${deploymentAddresses.contracts.mockRwaFactory || ''}',
  },
} as const;

export type NetworkName = keyof typeof CONTRACTS;
export type ContractName = keyof typeof CONTRACTS.baseSepolia;

// Helper function to get contract address
export function getContractAddress(
  network: NetworkName,
  contractName: ContractName
): string {
  const address = CONTRACTS[network][contractName];
  if (!address) {
    throw new Error(\`Contract \${contractName} not deployed on \${network}\`);
  }
  return address;
}

// Deployment info
export const DEPLOYMENT_INFO = {
  network: '${deploymentAddresses.network}',
  chainId: ${deploymentAddresses.chainId},
  deployedAt: '${deploymentAddresses.deployedAt}',
} as const;
`;

    fs.writeFileSync(utilsContractsPath, contractsFileContent);
    console.log(`✅ Contract addresses written to ${utilsContractsPath}`);
  }

  console.log('\n🎉 ABI extraction completed successfully!');
  console.log('\nNext steps:');
  console.log('1. cd packages/utils && pnpm build');
  console.log('2. Update your backend services to use the new ABIs and addresses');
  console.log('3. Run integration tests to verify everything works');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ ABI extraction failed:', error);
    process.exit(1);
  });
