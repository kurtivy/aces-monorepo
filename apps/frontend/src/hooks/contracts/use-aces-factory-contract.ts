'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import { mineVanitySaltWithTimeout, type SaltMiningResult } from '@/lib/utils/salt-mining';

interface TokenInfo {
  curve: number;
  tokenAddress: string;
  floor: string;
  steepness: string;
  acesTokenBalance: string;
  subjectFeeDestination: string;
  tokensBondedAt: string;
  tokenBonded: boolean;
}

interface ContractState {
  tokenInfo: TokenInfo | null;
  currentSupply: string;
  loading: boolean;
  error: string | null;
}

interface CreateTokenParams {
  curve: number; // 0 = Quadratic, 1 = Linear
  steepness: string;
  floor: string;
  name: string;
  symbol: string;
  salt?: string; // Optional - will generate if not provided
  tokensBondedAt: string; // New parameter
  useVanityMining?: boolean;
}

export function useAcesFactoryContract(chainId: number = 84532) {
  const [contractState, setContractState] = useState<ContractState>({
    tokenInfo: null,
    currentSupply: '0',
    loading: false,
    error: null,
  });

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [readOnlyProvider, setReadOnlyProvider] = useState<ethers.providers.JsonRpcProvider | null>(
    null,
  );
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [readOnlyFactoryContract, setReadOnlyFactoryContract] = useState<ethers.Contract | null>(
    null,
  );
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [tokenImplementation, setTokenImplementation] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const contractAddresses = getContractAddresses(chainId);

  // Check if wallet is actually connected
  const checkWalletConnection = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }

    try {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      return accounts && accounts.length > 0;
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
      return false;
    }
  };

  // Initialize read-only provider first (always available)
  useEffect(() => {
    const initializeReadOnlyProvider = () => {
      try {
        // Set up read-only provider for Base Sepolia
        const rpcUrl = 'https://sepolia.base.org';
        const readOnlyProv = new ethers.providers.JsonRpcProvider(rpcUrl);
        setReadOnlyProvider(readOnlyProv);

        // Create read-only factory contract
        const readOnlyFactory = new ethers.Contract(
          contractAddresses.FACTORY_PROXY,
          ACES_FACTORY_ABI,
          readOnlyProv,
        );
        setReadOnlyFactoryContract(readOnlyFactory);

        console.log('✅ Read-only provider initialized for Base Sepolia');
      } catch (error) {
        console.error('Failed to initialize read-only provider:', error);
      }
    };

    initializeReadOnlyProvider();
  }, [contractAddresses.FACTORY_PROXY]);

  // Initialize provider and contracts only when wallet is connected
  useEffect(() => {
    const initializeContract = async () => {
      const walletConnected = await checkWalletConnection();
      setIsWalletConnected(walletConnected);

      if (!walletConnected) {
        // Clear all contract state when wallet is disconnected
        setProvider(null);
        setSigner(null);
        setFactoryContract(null);
        setTokenImplementation(null);
        setContractState((prev) => ({
          ...prev,
          error: null,
          loading: false,
        }));
        return;
      }

      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);

          // Check if we can get a signer (wallet is unlocked)
          try {
            const signer = provider.getSigner();
            // Test if signer is accessible
            await signer.getAddress();

            const factory = new ethers.Contract(
              contractAddresses.FACTORY_PROXY, // Use proxy address
              ACES_FACTORY_ABI,
              signer,
            );

            setProvider(provider);
            setSigner(signer);
            setFactoryContract(factory);

            // Get the tokenImplementation address for vanity mining
            try {
              const implAddress = await factory.tokenImplementation();
              setTokenImplementation(implAddress);
              console.log('✅ Token implementation address:', implAddress);
            } catch (error) {
              console.error('Failed to get token implementation address:', error);
              setTokenImplementation(null);
            }
          } catch (signerError) {
            console.error('Failed to get signer (wallet may be locked):', signerError);
            // Clear contract state if signer is not available
            setProvider(null);
            setSigner(null);
            setFactoryContract(null);
            setTokenImplementation(null);
            setContractState((prev) => ({
              ...prev,
              error: 'Wallet is locked or not accessible',
              loading: false,
            }));
          }
        } catch (error) {
          console.error('Failed to initialize factory contract:', error);
          setContractState((prev) => ({ ...prev, error: 'Failed to initialize contract' }));
        }
      }
    };

    initializeContract();

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: unknown) => {
        console.log('Accounts changed:', accounts);
        // Re-initialize when accounts change
        initializeContract();
      };

      const handleChainChanged = () => {
        console.log('Chain changed');
        // Re-initialize when chain changes
        initializeContract();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [chainId, contractAddresses.FACTORY_PROXY]);

  // Fetch token information with rate limiting - uses read-only contract if wallet not connected
  const fetchTokenInfo = useCallback(
    async (tokenAddress: string, bypassRateLimit = false) => {
      const activeContract = factoryContract || readOnlyFactoryContract;
      const activeProvider = provider || readOnlyProvider;

      if (!activeContract || !activeProvider) {
        console.warn('No contract available for token info fetch');
        return null;
      }

      setContractState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Get token info from factory
        const tokenData = await activeContract.tokens(tokenAddress);
        const tokenInfo: TokenInfo = {
          curve: tokenData.curve,
          tokenAddress: tokenData.tokenAddress,
          floor: tokenData.floor.toString(),
          steepness: tokenData.steepness.toString(),
          acesTokenBalance: tokenData.acesTokenBalance.toString(),
          subjectFeeDestination: tokenData.subjectFeeDestination,
          tokensBondedAt: tokenData.tokensBondedAt.toString(),
          tokenBonded: tokenData.tokenBonded,
        };

        // Get current token supply
        const tokenContract = new ethers.Contract(
          tokenAddress,
          LAUNCHPAD_TOKEN_ABI,
          activeProvider,
        );
        const totalSupply = await tokenContract.totalSupply();
        const currentSupply = ethers.utils.formatEther(totalSupply);

        setContractState({
          tokenInfo,
          currentSupply,
          loading: false,
          error: null,
        });

        return { tokenInfo, currentSupply };
      } catch (error) {
        console.error('Failed to fetch token info:', error);

        // Handle circuit breaker errors differently
        const errorMessage =
          error instanceof Error && error.message.includes('circuit breaker')
            ? 'Network congestion - token data temporarily unavailable'
            : 'Failed to fetch token information';

        setContractState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return null;
      }
    },
    [factoryContract, readOnlyFactoryContract, provider, readOnlyProvider],
  );

  // Replace calculatePriceAtSupply - uses read-only contract if wallet not connected
  const calculatePriceAtSupply = useCallback(
    async (tokenAddress: string, supplyPoint: number): Promise<number> => {
      const activeContract = factoryContract || readOnlyFactoryContract;
      if (!activeContract) return 0;

      try {
        if (!ethers.utils.isAddress(tokenAddress)) {
          console.warn('Invalid token address format:', tokenAddress);
          return 0;
        }

        const tokenInfo = await activeContract.tokens(tokenAddress);
        if (tokenInfo.tokenAddress === ethers.constants.AddressZero) {
          console.warn('Token not found in factory registry:', tokenAddress);
          return 0;
        }

        const curve = tokenInfo.curve;
        const steepness = tokenInfo.steepness;
        const floor = tokenInfo.floor;

        // supplyPoint is in wei, convert to whole tokens
        const supplyInWholeTokens = Math.floor(supplyPoint / 1e18);
        const amount = 1;

        // Special case: when supply is 0, return the floor price
        if (supplyInWholeTokens === 0) {
          return parseFloat(ethers.utils.formatEther(floor));
        }

        let priceWei: ethers.BigNumber;

        if (curve === 0) {
          priceWei = await activeContract.getPriceQuadratic(
            supplyInWholeTokens,
            amount,
            steepness,
            floor,
          );
        } else {
          priceWei = await activeContract.getPriceLinear(
            supplyInWholeTokens,
            amount,
            steepness,
            floor,
          );
        }

        return parseFloat(ethers.utils.formatEther(priceWei));
      } catch (error) {
        console.error('Failed to calculate price at supply:', error);

        // For circuit breaker errors, don't log as aggressively
        if (error instanceof Error && error.message.includes('circuit breaker')) {
          console.log('Circuit breaker active - price calculation skipped');
        }

        return 0;
      }
    },
    [factoryContract, readOnlyFactoryContract],
  );

  // Replace generateBondingCurveData
  const generateBondingCurveData = useCallback(
    async (tokenAddress: string) => {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      if (!tokenInfo) return [];

      const tokensBondedAt = parseFloat(tokenInfo.tokenInfo.tokensBondedAt);
      const currentSupply = parseFloat(tokenInfo.currentSupply);

      const dataPoints = [];
      const numPoints = 8;

      // Start from i=0 to include the starting point
      for (let i = 0; i <= numPoints; i++) {
        const supplyPoint = Math.floor((tokensBondedAt / numPoints) * i);

        try {
          const priceInAces = await calculatePriceAtSupply(tokenAddress, supplyPoint);
          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: priceInAces,
            phase: supplyPoint <= currentSupply ? 'completed' : 'upcoming',
          });

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to calculate price at ${supplyPoint}:`, error);
          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: 0,
            phase: 'upcoming',
          });
        }
      }

      return dataPoints;
    },
    [fetchTokenInfo, calculatePriceAtSupply],
  );
  // Create new token with improved salt mining
  const createToken = useCallback(
    async (
      params: CreateTokenParams,
      onMiningProgress?: (attempts: number, timeElapsed: number) => void,
    ): Promise<{
      success: boolean;
      tokenAddress?: string;
      error?: string;
      saltMiningResult?: SaltMiningResult;
    }> => {
      if (!factoryContract || !signer) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const userAddress = await signer.getAddress();
        let finalSalt: string;
        let saltMiningResult: SaltMiningResult | undefined;

        // Perform vanity mining if requested
        if (params.useVanityMining) {
          if (!tokenImplementation) {
            return {
              success: false,
              error: 'Token implementation not available for vanity mining',
            };
          }

          try {
            saltMiningResult = await mineVanitySaltWithTimeout(
              userAddress,
              params.name,
              params.symbol,
              contractAddresses.FACTORY_PROXY,
              tokenImplementation,
              {
                targetSuffix: 'ace',
                maxAttempts: 200000,
                onProgress: onMiningProgress,
              },
              300000, // 5 minute timeout
            );

            finalSalt = saltMiningResult.salt;
          } catch (miningError) {
            // If vanity mining fails, don't proceed with token creation
            return {
              success: false,
              error: `Vanity mining failed: ${miningError instanceof Error ? miningError.message : 'Unknown mining error'}`,
            };
          }
        } else {
          // Use provided salt or generate default one
          finalSalt = params.salt || `default-${Date.now()}-${Math.random()}`;
        }

        // Call the new createToken function with all 7 parameters
        const tx = await factoryContract.createToken(
          params.curve,
          params.steepness,
          params.floor,
          params.name,
          params.symbol,
          finalSalt,
          params.tokensBondedAt, // New parameter
        );

        const receipt = await tx.wait();

        // Extract token address from events
        const createEvent = receipt.logs.find((log: ethers.providers.Log) => {
          try {
            const parsed = factoryContract.interface.parseLog(log);
            return parsed?.name === 'CreatedToken';
          } catch {
            return false;
          }
        });

        if (createEvent) {
          const parsed = factoryContract.interface.parseLog(createEvent);
          const tokenAddress = parsed.args?.tokenAddress;

          return {
            success: true,
            tokenAddress,
            saltMiningResult,
          };
        }

        return { success: false, error: 'Token creation event not found' };
      } catch (error) {
        console.error('Token creation failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Token creation failed',
        };
      }
    },
    [factoryContract, signer, contractAddresses, tokenImplementation],
  );

  // Buy tokens function
  const buyTokens = useCallback(
    async (
      tokenAddress: string,
      amount: string,
      maxPrice: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!factoryContract) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const amountWei = ethers.utils.parseEther(amount);
        const maxPriceWei = ethers.utils.parseEther(maxPrice);

        const tx = await factoryContract.buyTokens(tokenAddress, amountWei, maxPriceWei);
        await tx.wait();

        return { success: true };
      } catch (error) {
        console.error('Buy tokens failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        };
      }
    },
    [factoryContract],
  );

  // Sell tokens function
  const sellTokens = useCallback(
    async (tokenAddress: string, amount: string): Promise<{ success: boolean; error?: string }> => {
      if (!factoryContract) {
        return { success: false, error: 'Contract not initialized' };
      }

      try {
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
        await tx.wait();

        return { success: true };
      } catch (error) {
        console.error('Sell tokens failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        };
      }
    },
    [factoryContract],
  );

  return {
    contractState,
    contractAddresses,
    fetchTokenInfo,
    generateBondingCurveData,
    calculatePriceAtSupply,
    createToken,
    buyTokens,
    sellTokens,
    // Connection state
    isWalletConnected,
    // Utility - ready if either wallet contracts OR read-only contracts are available
    isReady:
      (isWalletConnected && !!factoryContract && !!signer && !!tokenImplementation) ||
      !!readOnlyFactoryContract,
    // Read-only state
    isReadOnly: !isWalletConnected && !!readOnlyFactoryContract,
    tokenImplementation,
    // Contract instances for backward compatibility
    provider,
    readOnlyProvider,
    factoryContract,
    readOnlyFactoryContract,
    signer,
  };
}
