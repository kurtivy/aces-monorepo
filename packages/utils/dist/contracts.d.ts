import type { ContractAddresses, NetworkConfig } from './types';
export declare const CONTRACTS: Record<string, ContractAddresses>;
export declare const NETWORKS: Record<string, NetworkConfig>;
export declare const PLATFORM_CONSTANTS: {
    readonly PLATFORM_FEE_BPS: 50;
    readonly OWNER_FEE_BPS: 50;
    readonly CURVE_BASE_PRICE: "0.001";
    readonly CURVE_SLOPE: "0.00001";
};
export declare function getContractAddresses(network: string): ContractAddresses;
export declare function getNetworkConfig(network: string): NetworkConfig;
export declare function isValidNetwork(network: string): network is keyof typeof NETWORKS;
export declare function getDefaultNetwork(): string;
