export declare const CONTRACTS: {
    readonly localhost: {
        readonly acesToken: "";
        readonly mockRwaDeedNft: "";
        readonly mockRwaFactory: "";
    };
    readonly baseSepolia: {
        readonly acesToken: "0x2c9B029B2F232a5e5f3332A34d6EC6B668fEDd95";
        readonly mockRwaDeedNft: "0xb5e4dA5EeaF3703da5e0CA66490f2bAF016c4A68";
        readonly mockRwaFactory: "0x2e2aaDB15f11f1Ca7a0c5Acb5655e2f56701104A";
    };
};
export type NetworkName = keyof typeof CONTRACTS;
export type ContractName = keyof typeof CONTRACTS.baseSepolia;
export declare function getContractAddress(network: NetworkName, contractName: ContractName): string;
export declare const BONDING_CURVE_CONTRACTS: {
    readonly BASE_SEPOLIA: {
        readonly chainId: 84532;
        readonly acesTest: "0x6474F13C2CEbD4Ca36cAE5a1055d44928822Ded9";
        readonly bondingCurveTest: "0xafa9256Adffc24c3d34296304046647B77eEB139";
    };
};
export declare function getBondingCurveContracts(chainId: number): {
    readonly chainId: 84532;
    readonly acesTest: "0x6474F13C2CEbD4Ca36cAE5a1055d44928822Ded9";
    readonly bondingCurveTest: "0xafa9256Adffc24c3d34296304046647B77eEB139";
};
export interface BondingCurveContracts {
    acesTest: string;
    bondingCurveTest: string;
}
export interface RoomStats {
    tokenSupply: bigint;
    totalETHRaised: bigint;
    currentPrice: bigint;
    progress: bigint;
}
export declare const DEPLOYMENT_INFO: {
    readonly network: "baseSepolia";
    readonly chainId: 84532;
    readonly deployedAt: "2025-06-30T17:02:26.722Z";
};
//# sourceMappingURL=contracts.d.ts.map