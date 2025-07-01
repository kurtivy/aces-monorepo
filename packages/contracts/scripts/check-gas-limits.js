#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Gas limits (in gas units)
const GAS_LIMITS = {
  // Function call limits
  maxFunctionGas: 200000, // 200k gas per function
  maxConstructorGas: 500000, // 500k gas for deployment

  // Warning thresholds
  warnFunctionGas: 150000, // Warn at 150k gas
  warnConstructorGas: 400000, // Warn at 400k gas
};

function parseGasReport() {
  const gasReportPath = path.join(__dirname, '../gas-report.json');

  if (!fs.existsSync(gasReportPath)) {
    console.error('❌ Gas report not found. Run tests with gas reporter first:');
    console.error('   REPORT_GAS=true npx hardhat test');
    process.exit(1);
  }

  try {
    const gasReportText = fs.readFileSync(gasReportPath, 'utf8');
    return parseGasReportText(gasReportText);
  } catch (error) {
    console.error('❌ Failed to parse gas report:', error.message);
    process.exit(1);
  }
}

function parseGasReportText(text) {
  const methods = {};
  const deployments = {};

  const lines = text.split('\n');

  for (const line of lines) {
    // Parse method gas usage - looking for function names with gas numbers
    const methodMatch = line.match(/│\s+([a-zA-Z][a-zA-Z0-9_]*)\s+·[^·]*·[^·]*·\s+([0-9,]+)\s+·/);
    if (methodMatch) {
      const [, methodName, gasStr] = methodMatch;
      const gasUsed = parseInt(gasStr.replace(/,/g, ''));
      if (methodName && !isNaN(gasUsed) && gasUsed > 0) {
        methods[methodName] = { avg: gasUsed };
      }
    }

    // Parse deployment gas usage
    const deployMatch = line.match(/│\s+([A-Z][A-Za-z0-9_]+)\s+·[^·]*·[^·]*·\s+([0-9,]+)\s+·/);
    if (deployMatch) {
      const [, contractName, gasStr] = deployMatch;
      const gasUsed = parseInt(gasStr.replace(/,/g, ''));
      if (contractName && !isNaN(gasUsed) && gasUsed > 0) {
        deployments[contractName] = { gas: gasUsed };
      }
    }
  }

  return { methods, deployments };
}

function checkGasLimits() {
  console.log('⛽ Checking contract gas usage...\n');

  const gasReport = parseGasReport();

  let hasViolations = false;
  let hasWarnings = false;

  // Check deployment costs
  console.log('📋 Deployment Gas Usage:');
  console.log('========================');

  if (Object.keys(gasReport.deployments).length > 0) {
    Object.entries(gasReport.deployments).forEach(([contractName, data]) => {
      const deployGas = data.gas;
      const status = getGasStatus(
        deployGas,
        GAS_LIMITS.maxConstructorGas,
        GAS_LIMITS.warnConstructorGas,
      );

      console.log(`${status.icon} ${contractName.padEnd(25)}: ${deployGas.toLocaleString()} gas`);

      if (status.violation) hasViolations = true;
      if (status.warning) hasWarnings = true;
    });
  } else {
    console.log('ℹ️  No deployment data found');
  }

  // Check method gas usage
  console.log('\n🔧 Method Gas Usage:');
  console.log('====================');

  if (Object.keys(gasReport.methods).length > 0) {
    Object.entries(gasReport.methods).forEach(([methodName, data]) => {
      const avgGas = data.avg;
      const status = getGasStatus(avgGas, GAS_LIMITS.maxFunctionGas, GAS_LIMITS.warnFunctionGas);

      console.log(`${status.icon} ${methodName.padEnd(20)}: ${avgGas.toLocaleString()} gas (avg)`);

      if (status.violation) hasViolations = true;
      if (status.warning) hasWarnings = true;
    });
  } else {
    console.log('ℹ️  No method data found');
  }

  // Summary
  console.log('\n' + '='.repeat(50));

  if (hasViolations) {
    console.log('❌ Gas limit violations detected!');
    console.log(`💡 Functions should use < ${GAS_LIMITS.maxFunctionGas.toLocaleString()} gas`);
    console.log(`💡 Deployments should use < ${GAS_LIMITS.maxConstructorGas.toLocaleString()} gas`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Some gas usage warnings detected');
    console.log('✅ All gas limits respected');
    process.exit(0);
  } else {
    console.log('✅ All gas usage within optimal limits!');
    process.exit(0);
  }
}

function getGasStatus(gasUsed, maxLimit, warnLimit) {
  if (gasUsed > maxLimit) {
    return { icon: '❌', violation: true, warning: false };
  } else if (gasUsed > warnLimit) {
    return { icon: '⚠️', violation: false, warning: true };
  } else {
    return { icon: '✅', violation: false, warning: false };
  }
}

// Save gas snapshots for tracking over time
function saveGasSnapshot() {
  const gasReport = parseGasReport();
  const timestamp = new Date().toISOString();

  const snapshot = {
    timestamp,
    commit: process.env.GITHUB_SHA || 'local',
    gasReport,
  };

  const snapshotsDir = path.join(__dirname, '../gas-snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const snapshotFile = path.join(snapshotsDir, `gas-snapshot-${Date.now()}.json`);
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

  console.log(`📸 Gas snapshot saved: ${path.basename(snapshotFile)}`);
}

// Run the checks
if (require.main === module) {
  checkGasLimits();
  saveGasSnapshot();
}

module.exports = { checkGasLimits, saveGasSnapshot };
