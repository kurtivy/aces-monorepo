"use strict";
// Auto-generated file - DO NOT EDIT
// Generated from deployment addresses
// Run 'pnpm extract-abis' to regenerate
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPLOYMENT_INFO = exports.CONTRACTS = void 0;
exports.getContractAddress = getContractAddress;
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
// Deployment info
exports.DEPLOYMENT_INFO = {
    network: 'baseSepolia',
    chainId: 84532,
    deployedAt: '2025-06-30T17:02:26.722Z',
};
