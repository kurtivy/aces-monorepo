"use strict";
// Auto-generated file - DO NOT EDIT
// Generated from deployment addresses
// Run 'pnpm extract-abis' to regenerate
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPLOYMENT_INFO = exports.ABIS = exports.BONDING_CURVE_TEST_ABI = exports.ACES_TEST_ABI = exports.BONDING_CURVE_CONTRACTS = exports.CONTRACTS = void 0;
exports.getContractAddress = getContractAddress;
exports.getBondingCurveContracts = getBondingCurveContracts;
exports.CONTRACTS = {
    localhost: {
        acesToken: '',
        mockRwaDeedNft: '',
        mockRwaFactory: '',
    },
    baseSepolia: {
        acesToken: '0x2c9B029B2F232a5e5f3332A34d6EC6B668fEDd95',
        mockRwaDeedNft: '0xb5e4dA5EeaF3703da5e0CA66490f2bAF016c4A68',
        mockRwaFactory: '0x2e2aaDB15f11f1Ca7a0c5Acb5655e2f56701104A',
    },
};
// Helper function to get contract address
function getContractAddress(network, contractName) {
    const address = exports.CONTRACTS[network][contractName];
    if (!address) {
        throw new Error(`Contract ${contractName} not deployed on ${network}`);
    }
    return address;
}
// Contract addresses for Base Sepolia testnet
exports.BONDING_CURVE_CONTRACTS = {
    BASE_SEPOLIA: {
        chainId: 84532,
        acesTest: '0x6474F13C2CEbD4Ca36cAE5a1055d44928822Ded9',
        bondingCurveTest: '0xafa9256Adffc24c3d34296304046647B77eEB139',
    },
};
// Helper function to get contract addresses for current network
function getBondingCurveContracts(chainId) {
    switch (chainId) {
        case 84532: // Base Sepolia
            return exports.BONDING_CURVE_CONTRACTS.BASE_SEPOLIA;
        default:
            throw new Error(`Bonding curve contracts not deployed on chain ${chainId}`);
    }
}
// Contract ABIs are imported from abis.ts
var abis_1 = require("./abis");
Object.defineProperty(exports, "ACES_TEST_ABI", { enumerable: true, get: function () { return abis_1.ACES_TEST_ABI; } });
Object.defineProperty(exports, "BONDING_CURVE_TEST_ABI", { enumerable: true, get: function () { return abis_1.BONDING_CURVE_TEST_ABI; } });
Object.defineProperty(exports, "ABIS", { enumerable: true, get: function () { return abis_1.ABIS; } });
// Deployment info
exports.DEPLOYMENT_INFO = {
    network: 'baseSepolia',
    chainId: 84532,
    deployedAt: '2025-06-30T17:02:26.722Z',
};
//# sourceMappingURL=contracts.js.map