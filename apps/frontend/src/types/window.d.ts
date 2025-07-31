declare interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
    on: (eventName: string, handler: (params: unknown) => void) => void;
    removeListener: (eventName: string, handler: (params: unknown) => void) => void;
    selectedAddress: string | null;
    isConnected: () => boolean;
  };
  solana?: {
    isPhantom?: boolean;
    connect: (options?: {
      onlyIfTrusted?: boolean;
    }) => Promise<{ publicKey: { toString(): string } }>;
    disconnect: () => Promise<void>;
    on: (eventName: string, handler: (params: unknown) => void) => void;
    removeListener: (eventName: string, handler: (params: unknown) => void) => void;
  };
}
