import * as fs from 'fs';
import * as path from 'path';

interface ArtifactFile {
  abi: unknown[];
  contractName: string;
  sourceName: string;
}

interface ContractABIs {
  DualCurrencyBondingCurveToken: unknown[];
}

async function main() {
  console.log('🔍 Extracting ABIs from compiled artifacts...\n');

  const contractsDir = path.join(__dirname, '../artifacts/contracts');
  const utilsAbiPath = path.join(__dirname, '../../utils/src/abis.ts');

  // Extract ABIs from artifacts
  const abis: Partial<ContractABIs> = {};

  // 1. DualCurrencyBondingCurveToken
  const dualCurrencyBondingCurveTokenArtifact = path.join(
    contractsDir,
    'DualCurrencyBondingCurveToken.sol/DualCurrencyBondingCurveToken.json',
  );
  if (fs.existsSync(dualCurrencyBondingCurveTokenArtifact)) {
    const artifact: ArtifactFile = JSON.parse(
      fs.readFileSync(dualCurrencyBondingCurveTokenArtifact, 'utf8'),
    );
    abis.DualCurrencyBondingCurveToken = artifact.abi;
    console.log('✅ Extracted DualCurrencyBondingCurveToken ABI');
  } else {
    console.log('❌ DualCurrencyBondingCurveToken artifact not found. Run "pnpm compile" first.');
    process.exit(1);
  }

  // Generate ABIs file
  const abisFileContent = `// Auto-generated file - DO NOT EDIT
// Generated from compiled contract artifacts
// Run 'pnpm extract-abis' to regenerate

export const DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI = ${JSON.stringify(abis.DualCurrencyBondingCurveToken || [], null, 2)} as const;

// Exported for convenience
export const ABIS = {
  DualCurrencyBondingCurveToken: DUAL_CURRENCY_BONDING_CURVE_TOKEN_ABI,
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
