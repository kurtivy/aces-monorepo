import * as fs from 'fs';
import * as path from 'path';

interface ArtifactFile {
  abi: unknown[];
  contractName: string;
  sourceName: string;
}

interface ContractABIs {
  AcesTest: unknown[];
  BondingCurveTest: unknown[];
  MockRwaFactory: unknown[];
}

async function main() {
  console.log('🔍 Extracting ABIs from compiled artifacts...\n');

  const contractsDir = path.join(__dirname, '../artifacts/contracts');
  const utilsAbiPath = path.join(__dirname, '../../utils/src/abis.ts');

  // Extract ABIs from artifacts
  const abis: Partial<ContractABIs> = {};

  // 1. MockRwaFactory (needed for backend)
  const mockRwaFactoryArtifact = path.join(
    contractsDir,
    'mocks/MockRwaFactory.sol/MockRwaFactory.json',
  );
  if (fs.existsSync(mockRwaFactoryArtifact)) {
    const artifact: ArtifactFile = JSON.parse(fs.readFileSync(mockRwaFactoryArtifact, 'utf8'));
    abis.MockRwaFactory = artifact.abi;
    console.log('✅ Extracted MockRwaFactory ABI');
  } else {
    console.log('❌ MockRwaFactory artifact not found. Run "pnpm compile" first.');
    process.exit(1);
  }

  // 2. AcesTest
  const acesTestArtifact = path.join(contractsDir, 'AcesTest.sol/AcesTest.json');
  if (fs.existsSync(acesTestArtifact)) {
    const artifact: ArtifactFile = JSON.parse(fs.readFileSync(acesTestArtifact, 'utf8'));
    abis.AcesTest = artifact.abi;
    console.log('✅ Extracted AcesTest ABI');
  } else {
    console.log('❌ AcesTest artifact not found. Run "pnpm compile" first.');
    process.exit(1);
  }

  // 3. BondingCurveTest
  const bondingCurveTestArtifact = path.join(
    contractsDir,
    'BondingCurveTest.sol/BondingCurveTest.json',
  );
  if (fs.existsSync(bondingCurveTestArtifact)) {
    const artifact: ArtifactFile = JSON.parse(fs.readFileSync(bondingCurveTestArtifact, 'utf8'));
    abis.BondingCurveTest = artifact.abi;
    console.log('✅ Extracted BondingCurveTest ABI');
  } else {
    console.log('❌ BondingCurveTest artifact not found. Run "pnpm compile" first.');
    process.exit(1);
  }

  // Generate ABIs file
  const abisFileContent = `// Auto-generated file - DO NOT EDIT
// Generated from compiled contract artifacts
// Run 'pnpm extract-abis' to regenerate

// Legacy ABIs (needed for backend)
export const MOCK_RWA_FACTORY_ABI = ${JSON.stringify(abis.MockRwaFactory || [], null, 2)} as const;

// Bonding Curve ABIs
export const ACES_TEST_ABI = ${JSON.stringify(abis.AcesTest || [], null, 2)} as const;
export const BONDING_CURVE_TEST_ABI = ${JSON.stringify(abis.BondingCurveTest || [], null, 2)} as const;

// Exported for convenience
export const ABIS = {
  MockRwaFactory: MOCK_RWA_FACTORY_ABI,
  AcesTest: ACES_TEST_ABI,
  BondingCurveTest: BONDING_CURVE_TEST_ABI,
} as const;
`;

  fs.writeFileSync(utilsAbiPath, abisFileContent);
  console.log(`✅ ABIs written to ${utilsAbiPath}`);

  console.log('\n🎉 ABI extraction completed successfully!');
  console.log('\nNext steps:');
  console.log('1. cd packages/utils && pnpm build');
  console.log('2. The frontend is already using the correct ABI');
  console.log('3. Run integration tests to verify everything works');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ ABI extraction failed:', error);
    process.exit(1);
  });
