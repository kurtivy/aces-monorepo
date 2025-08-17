export declare const CONTRACTS: {
    readonly localhost: {
        readonly acesVault: "";
        readonly acesToken: "";
        readonly implementation: "";
    };
    readonly baseSepolia: {
        readonly acesVault: "0x4f585dFD5A3faA1F782E10DfBe3DbBA7e0dFD20d";
        readonly acesToken: "0x4D74aCf5c51dbE8c89Ce14E624E6b5C338e68708";
        readonly implementation: "0x90692cd2f4D0EDB93D009F4d3CEe3118D72C8831";
    };
};
export type NetworkName = keyof typeof CONTRACTS;
export type ContractName = keyof typeof CONTRACTS.baseSepolia;
export declare function getContractAddress(network: NetworkName, contractName: ContractName): string;
export declare const BONDING_CURVE_CONTRACTS: {
    readonly BASE_SEPOLIA: {
        readonly chainId: 84532;
        readonly acesVault: "0x4f585dFD5A3faA1F782E10DfBe3DbBA7e0dFD20d";
        readonly acesToken: "0x4D74aCf5c51dbE8c89Ce14E624E6b5C338e68708";
        readonly implementation: "0x90692cd2f4D0EDB93D009F4d3CEe3118D72C8831";
        readonly sharesSubject: "0x246ca431fd1353610Bf20F9d4fbD240148522Dc8";
        readonly roomNumber: 0;
    };
};
export declare function getBondingCurveContracts(chainId: number): {
    readonly chainId: 84532;
    readonly acesVault: "0x4f585dFD5A3faA1F782E10DfBe3DbBA7e0dFD20d";
    readonly acesToken: "0x4D74aCf5c51dbE8c89Ce14E624E6b5C338e68708";
    readonly implementation: "0x90692cd2f4D0EDB93D009F4d3CEe3118D72C8831";
    readonly sharesSubject: "0x246ca431fd1353610Bf20F9d4fbD240148522Dc8";
    readonly roomNumber: 0;
};
export interface BondingCurveContracts {
    acesVault: string;
    acesToken: string;
    implementation: string;
    sharesSubject: string;
    roomNumber: number;
}
export interface RoomStats {
    tokenSupply: bigint;
    totalETHRaised: bigint;
    currentPrice: bigint;
    progress: bigint;
}
export declare const ROOM_CONFIG: {
    readonly curve: 1;
    readonly steepness: "10000000000000";
    readonly floor: "0";
    readonly maxPrice: "0";
    readonly midPoint: "0";
    readonly lockupPeriod: 0;
};
export declare const DEPLOYMENT_INFO: {
    readonly network: "baseSepolia";
    readonly chainId: 84532;
    readonly deployedAt: "2025-06-30T17:02:26.722Z";
    readonly proxyPattern: "EIP-1967 Transparent Proxy";
};
//# sourceMappingURL=contracts.d.ts.map