"use strict";
// Auto-generated file - DO NOT EDIT
// Generated from deployment addresses
// Run 'pnpm extract-abis' to regenerate
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPLOYMENT_INFO = exports.ROOM_CONFIG = exports.BONDING_CURVE_CONTRACTS = exports.CONTRACTS = void 0;
exports.getContractAddress = getContractAddress;
exports.getBondingCurveContracts = getBondingCurveContracts;
exports.CONTRACTS = {
    localhost: {
        acesVault: '',
        acesToken: '',
        implementation: '',
    },
    baseSepolia: {
        acesVault: '0x4f585dFD5A3faA1F782E10DfBe3DbBA7e0dFD20d', // Proxy address
        acesToken: '0x4D74aCf5c51dbE8c89Ce14E624E6b5C338e68708', // Token address
        implementation: '0x90692cd2f4D0EDB93D009F4d3CEe3118D72C8831', // Implementation (for reference)
    },
    baseMainnet: {
        acesVault: '0x791a62cfc43390E800Fb81EaB9b1Cb86E50d68A0', // Proxy address
        acesToken: '0x9D517deF70aCa7fa668dA73b7252957BF5Afa410', // Token address
        implementation: '0x6fd697590ad40Ffc7ff039cfb32B43fBc1EF31E7', // Implementation (for reference)
        acesSwap: '0x7466CF735c8AfD8ecDdd0914590d288566bE6522', // AcesSwap contract for USDC/USDT purchases
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
// Contract addresses - UPDATED FOR PROXY ARCHITECTURE
exports.BONDING_CURVE_CONTRACTS = {
    BASE_SEPOLIA: {
        chainId: 84532,
        acesVault: '0x4f585dFD5A3faA1F782E10DfBe3DbBA7e0dFD20d', // Proxy address
        acesToken: '0x4D74aCf5c51dbE8c89Ce14E624E6b5C338e68708', // Token address
        implementation: '0x90692cd2f4D0EDB93D009F4d3CEe3118D72C8831', // Implementation
        sharesSubject: '0x246ca431fd1353610Bf20F9d4fbD240148522Dc8', // Dev wallet
        roomNumber: 0, // Room number for this subject
    },
    BASE_MAINNET: {
        chainId: 8453,
        acesVault: '0x791a62cfc43390E800Fb81EaB9b1Cb86E50d68A0', // Proxy address
        acesToken: '0x9D517deF70aCa7fa668dA73b7252957BF5Afa410', // Token address
        implementation: '0x6fd697590ad40Ffc7ff039cfb32B43fBc1EF31E7', // Implementation
        sharesSubject: '0x246ca431fd1353610Bf20F9d4fbD240148522Dc8', // Dev wallet (same)
        roomNumber: 0, // Room number for this subject
    },
};
// Helper function to get contract addresses for current network
function getBondingCurveContracts(chainId) {
    switch (chainId) {
        case 84532: // Base Sepolia
            return exports.BONDING_CURVE_CONTRACTS.BASE_SEPOLIA;
        case 8453: // Base Mainnet
            return exports.BONDING_CURVE_CONTRACTS.BASE_MAINNET;
        default:
            throw new Error(`Bonding curve contracts not deployed on chain ${chainId}`);
    }
}
// Room configuration (from your transaction logs)
exports.ROOM_CONFIG = {
    curve: 1, // Linear curve
    steepness: '10000000000000', // From transaction log
    floor: '0',
    maxPrice: '0',
    midPoint: '0',
    lockupPeriod: 0,
};
// Deployment info
exports.DEPLOYMENT_INFO = {
    baseSepolia: {
        network: 'baseSepolia',
        chainId: 84532,
        deployedAt: '2025-06-30T17:02:26.722Z',
        proxyPattern: 'EIP-1967 Transparent Proxy',
    },
    baseMainnet: {
        network: 'baseMainnet',
        chainId: 8453,
        deployedAt: '2025-01-02T00:00:00.000Z', // Update with actual deployment date
        proxyPattern: 'EIP-1967 Transparent Proxy',
    },
};
//# sourceMappingURL=contracts.js.map