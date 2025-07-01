#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Coverage thresholds (configurable)
const COVERAGE_THRESHOLDS = {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80,
};

function calculateTotalCoverage(coverage) {
  let totalStatements = 0;
  let coveredStatements = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalLines = 0;
  let coveredLines = 0;

  // Aggregate coverage from all files
  Object.values(coverage).forEach((fileCoverage) => {
    if (fileCoverage.s) {
      totalStatements += Object.keys(fileCoverage.s).length;
      coveredStatements += Object.values(fileCoverage.s).filter((hits) => hits > 0).length;
    }
    if (fileCoverage.b) {
      totalBranches += Object.keys(fileCoverage.b).length;
      coveredBranches += Object.values(fileCoverage.b).filter((hits) =>
        hits.some((h) => h > 0),
      ).length;
    }
    if (fileCoverage.f) {
      totalFunctions += Object.keys(fileCoverage.f).length;
      coveredFunctions += Object.values(fileCoverage.f).filter((hits) => hits > 0).length;
    }
    if (fileCoverage.s) {
      // Using statements as a proxy for lines since the format doesn't separate them
      totalLines += Object.keys(fileCoverage.s).length;
      coveredLines += Object.values(fileCoverage.s).filter((hits) => hits > 0).length;
    }
  });

  return {
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      pct: totalStatements ? (coveredStatements / totalStatements) * 100 : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      pct: totalBranches ? (coveredBranches / totalBranches) * 100 : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct: totalFunctions ? (coveredFunctions / totalFunctions) * 100 : 0,
    },
    lines: {
      total: totalLines,
      covered: coveredLines,
      pct: totalLines ? (coveredLines / totalLines) * 100 : 0,
    },
  };
}

function checkCoverage() {
  console.log('🔍 Checking test coverage...\n');

  const coverageFile = path.join(__dirname, '../coverage/coverage-final.json');

  if (!fs.existsSync(coverageFile)) {
    console.error('❌ Coverage file not found. Run tests with coverage first:');
    console.error('   pnpm test:coverage\n');
    process.exit(1);
  }

  let coverage;
  try {
    const coverageData = fs.readFileSync(coverageFile, 'utf8');
    coverage = JSON.parse(coverageData);
  } catch (error) {
    console.error('❌ Failed to parse coverage file:', error.message);
    process.exit(1);
  }

  const total = calculateTotalCoverage(coverage);
  if (!total) {
    console.error('❌ No coverage data found');
    process.exit(1);
  }

  console.log('📊 Coverage Report:');
  console.log('==================');

  let allPassed = true;
  const results = [];

  // Check each metric
  Object.entries(COVERAGE_THRESHOLDS).forEach(([metric, threshold]) => {
    const actual = total[metric]?.pct || 0;
    const passed = actual >= threshold;
    const status = passed ? '✅' : '❌';

    results.push({
      metric,
      actual,
      threshold,
      passed,
      status,
    });

    console.log(`${status} ${metric.padEnd(12)}: ${actual.toFixed(1)}% (min: ${threshold}%)`);

    if (!passed) {
      allPassed = false;
    }
  });

  console.log('\n📈 Detailed Coverage:');
  console.log('=====================');
  Object.entries(total).forEach(([metric, data]) => {
    if (data && typeof data === 'object' && 'pct' in data) {
      console.log(`${metric.padEnd(12)}: ${data.covered}/${data.total} (${data.pct.toFixed(1)}%)`);
    }
  });

  // Service-specific coverage
  console.log('\n🏗️  Service Coverage:');
  console.log('=====================');

  Object.keys(coverage).forEach((filePath) => {
    if (filePath.includes('/services/') && filePath.endsWith('.ts')) {
      const serviceName = path.basename(filePath, '.ts');
      const fileCoverage = coverage[filePath];

      if (fileCoverage.s) {
        const totalStatements = Object.keys(fileCoverage.s).length;
        const coveredStatements = Object.values(fileCoverage.s).filter((hits) => hits > 0).length;
        const pct = totalStatements ? (coveredStatements / totalStatements) * 100 : 0;
        const status = pct >= COVERAGE_THRESHOLDS.statements ? '✅' : '⚠️';
        console.log(`${status} ${serviceName.padEnd(20)}: ${pct.toFixed(1)}%`);
      }
    }
  });

  console.log('\n' + '='.repeat(50));

  if (allPassed) {
    console.log('🎉 All coverage thresholds met!');
    console.log('✅ Test coverage check passed\n');
    process.exit(0);
  } else {
    console.log('❌ Some coverage thresholds not met');
    console.log('💡 Consider adding more tests to improve coverage\n');

    // Show suggestions
    const failedMetrics = results.filter((r) => !r.passed);
    if (failedMetrics.length > 0) {
      console.log('📝 Suggestions:');
      failedMetrics.forEach(({ metric, actual, threshold }) => {
        const gap = threshold - actual;
        console.log(`   • Increase ${metric} coverage by ${gap.toFixed(1)}%`);
      });
      console.log();
    }

    process.exit(1);
  }
}

// Run the coverage check
if (require.main === module) {
  checkCoverage();
}

module.exports = { checkCoverage, COVERAGE_THRESHOLDS };
