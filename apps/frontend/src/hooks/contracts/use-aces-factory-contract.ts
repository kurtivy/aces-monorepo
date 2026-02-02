'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses, NETWORK_CONFIG } from '@/lib/contracts/addresses';
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

interface UseAcesFactoryContractOptions {
  chainId?: number;
  externalSigner?: ethers.Signer | null;
  externalProvider?: ethers.providers.Web3Provider | null;
}

export function useAcesFactoryContract(
  options?: UseAcesFactoryContractOptions | number, // Support legacy number param
) {
  // Support both legacy (number) and new (options object) API
  const effectiveChainId =
    typeof options === 'number' ? options : (options?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID);
  const externalSigner = typeof options === 'object' ? options?.externalSigner : undefined;
  const externalProvider = typeof options === 'object' ? options?.externalProvider : undefined;

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
  const [currentChainId, setCurrentChainId] = useState<number>(effectiveChainId);

  // Request deduplication: track pending requests
  const pendingRequestsRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const contractAddresses = getContractAddresses(currentChainId);

  // Update chain ID when it changes
  useEffect(() => {
    const updateChainId = async () => {
      const detectedChainId = await getCurrentChainId();
      if (detectedChainId && detectedChainId !== currentChainId) {
        console.log(`Chain ID changed from ${currentChainId} to ${detectedChainId}`);
        setCurrentChainId(detectedChainId);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      updateChainId();

      // Listen for chain changes (if provider supports it)
      const handleChainChanged = () => {
        console.log('Chain changed, updating...');
        updateChainId();
      };

      // Check if provider supports event listeners (Privy smart wallets may not)
      if (typeof window.ethereum.on === 'function') {
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
          window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
        };
      }
    }
  }, [currentChainId]);

  // Get current chain ID from wallet
  const getCurrentChainId = async (): Promise<number | null> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }

    try {
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      return parseInt(chainIdHex, 16);
    } catch (error) {
      console.error('Failed to get chain ID:', error);
      return null;
    }
  };

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
    const initializeReadOnlyProvider = async () => {
      try {
        let rpcUrl: string;

        if (currentChainId === 8453) {
          // Base Mainnet
          rpcUrl =
            (process.env.QUICKNODE_BASE_URL as string) ||
            (process.env.BASE_MAINNET_RPC_URL as string);
        } else if (currentChainId === 84532) {
          // Base Sepolia
          rpcUrl = 'https://sepolia.base.org';
        } else {
          // Fallback to Base Mainnet
          rpcUrl = 'https://mainnet.base.org';
        }

        // Explicitly specify network to avoid detection errors
        const readOnlyProv = new ethers.providers.JsonRpcProvider(rpcUrl, {
          name: currentChainId === 8453 ? 'base' : 'base-sepolia',
          chainId: currentChainId,
        });
        setReadOnlyProvider(readOnlyProv);

        // Create read-only factory contract
        const readOnlyFactory = new ethers.Contract(
          contractAddresses.FACTORY_PROXY,
          ACES_FACTORY_ABI,
          readOnlyProv,
        );
        setReadOnlyFactoryContract(readOnlyFactory);

        console.log(
          `✅ Read-only provider initialized for Base ${currentChainId === 8453 ? 'Mainnet' : 'Sepolia'} (Chain ID: ${currentChainId})`,
        );
      } catch (error) {
        console.error('Failed to initialize read-only provider:', error);
      }
    };

    // Always initialize read-only provider (uses environment default if no chainId provided)
    initializeReadOnlyProvider();
  }, [contractAddresses.FACTORY_PROXY, currentChainId]);

  // Fetch token implementation using whichever factory contract is available (read-only or signer)
  useEffect(() => {
    const loadTokenImplementation = async () => {
      try {
        const contract = factoryContract ?? readOnlyFactoryContract;
        if (!contract) {
          return;
        }

        const implAddress = await contract.tokenImplementation();
        setTokenImplementation(implAddress);
        console.log('✅ Token implementation address (fallback loader):', implAddress);
      } catch (error) {
        console.error('Failed to load token implementation via fallback contract:', error);
      }
    };

    if (!tokenImplementation && (factoryContract || readOnlyFactoryContract)) {
      void loadTokenImplementation();
    }
  }, [factoryContract, readOnlyFactoryContract, tokenImplementation]);

  // Initialize provider and contracts - supports both external (Privy) and window.ethereum
  useEffect(() => {
    const initializeContract = async () => {
      // Priority 1: Use external signer (from Privy)
      if (externalSigner) {
        try {
          console.log('🔗 Using external signer (Privy)');

          // Test if signer is accessible
          const address = await externalSigner.getAddress();
          console.log('✅ External signer address:', address);

          const factory = new ethers.Contract(
            contractAddresses.FACTORY_PROXY,
            ACES_FACTORY_ABI,
            externalSigner,
          );

          setProvider(externalProvider || null);
          setSigner(externalSigner);
          setFactoryContract(factory);
          setIsWalletConnected(true);

          // Get the tokenImplementation address for vanity mining
          try {
            const implAddress = await factory.tokenImplementation();
            setTokenImplementation(implAddress);
            console.log('✅ Token implementation address (external):', implAddress);
          } catch (error) {
            console.error('Failed to get token implementation address:', error);
            setTokenImplementation(null);
          }
          return;
        } catch (error) {
          console.error('❌ Failed to use external signer:', error);
          // Fall through to window.ethereum check
        }
      }

      // Priority 2: Try window.ethereum (MetaMask, etc.)
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
          console.log('🔗 Using window.ethereum provider');
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

    // Listen for account changes (only for window.ethereum)
    if (typeof window !== 'undefined' && window.ethereum && !externalSigner) {
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

      // Check if provider supports event listeners (Privy smart wallets may not)
      if (typeof window.ethereum.on === 'function') {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
          window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
          window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
        };
      }
    }
  }, [currentChainId, contractAddresses.FACTORY_PROXY, externalSigner, externalProvider]);

  // Timeout wrapper for contract calls
  const withTimeout = useCallback(
    <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Contract call timeout')), timeoutMs),
        ),
      ]);
    },
    [],
  );

  // Fetch token information with rate limiting - uses read-only contract if wallet not connected
  const fetchTokenInfo = useCallback(
    async (tokenAddress: string, _bypassRateLimit = false) => {
      // eslint-disable-line @typescript-eslint/no-unused-vars
      const activeContract = factoryContract || readOnlyFactoryContract;
      const activeProvider = provider || readOnlyProvider;
      const isUsingReadOnly = !factoryContract && !!readOnlyFactoryContract;

      // Check for pending request for this token
      const requestKey = `fetchTokenInfo-${tokenAddress}`;
      if (pendingRequestsRef.current.has(requestKey)) {
        console.log('⚠️ Deduplicating fetchTokenInfo request for:', tokenAddress);
        return pendingRequestsRef.current.get(requestKey) as Promise<{
          tokenInfo: TokenInfo;
          currentSupply: string;
        } | null>;
      }

      console.log('🔄 fetchTokenInfo called:', {
        tokenAddress,
        hasActiveContract: !!activeContract,
        hasActiveProvider: !!activeProvider,
        isUsingReadOnly,
      });

      if (!activeContract || !activeProvider) {
        console.warn('❌ No contract available for token info fetch');
        setContractState((prev) => ({
          ...prev,
          loading: false,
          error: 'Contract not initialized',
        }));
        return null;
      }

      setContractState((prev) => ({ ...prev, loading: true, error: null }));

      // Create promise and store it
      const requestPromise = (async () => {
        try {
          // Get token info from factory with timeout
          console.log('📞 Calling contract.tokens()...');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tokenData = (await withTimeout(activeContract.tokens(tokenAddress), 8000)) as any;
          console.log('✅ Token data received:', tokenData);

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

          // Get current token supply with timeout
          console.log('📞 Calling token.totalSupply()...');
          const tokenContract = new ethers.Contract(
            tokenAddress,
            LAUNCHPAD_TOKEN_ABI,
            activeProvider,
          );
          const totalSupply = (await withTimeout(
            tokenContract.totalSupply(),
            8000,
          )) as ethers.BigNumber;
          const currentSupply = ethers.utils.formatEther(totalSupply);
          console.log('✅ Total supply received:', currentSupply);

          setContractState({
            tokenInfo,
            currentSupply,
            loading: false,
            error: null,
          });

          return { tokenInfo, currentSupply };
        } catch (error) {
          console.error('❌ Failed to fetch token info:', error);

          // Handle different error types
          let errorMessage = 'Failed to fetch token information';
          if (error instanceof Error) {
            if (error.message.includes('timeout')) {
              errorMessage = 'Network timeout - please retry';
            } else if (error.message.includes('circuit breaker')) {
              errorMessage = 'Network congestion - please retry';
            } else if (error.message.includes('CALL_EXCEPTION')) {
              errorMessage = 'Token not found or invalid contract';
            }
          }

          setContractState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));
          return null;
        } finally {
          // Clean up pending request
          pendingRequestsRef.current.delete(requestKey);
        }
      })();

      // Store the pending request
      pendingRequestsRef.current.set(requestKey, requestPromise);

      return requestPromise;
    },
    [factoryContract, readOnlyFactoryContract, provider, readOnlyProvider, withTimeout],
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

        // supplyPoint is already in whole tokens (not wei)
        const supplyInWholeTokens = Math.floor(supplyPoint);
        const amount = 1; // Price for buying 1 token

        // Special case: when supply is 0, return the floor price
        if (supplyInWholeTokens === 0) {
          return parseFloat(ethers.utils.formatEther(floor));
        }

        // Guard against calling contract with 0 supply which causes "Amount must be at least 1 token" error
        if (supplyInWholeTokens < 1) {
          console.warn('Supply point too low for contract calculation:', supplyInWholeTokens);
          return parseFloat(ethers.utils.formatEther(floor));
        }

        // Convert to wei for contract call (contract expects wei values)
        const supplyWei = ethers.utils.parseEther(supplyInWholeTokens.toString());
        const amountWei = ethers.utils.parseEther(amount.toString());

        let priceWei: ethers.BigNumber;

        if (curve === 0) {
          // Quadratic curve
          priceWei = await activeContract.getPriceQuadratic(supplyWei, amountWei, steepness, floor);
        } else {
          // Linear curve
          priceWei = await activeContract.getPriceLinear(supplyWei, amountWei, steepness, floor);
        }

        // Return price in ACES (formatted from wei)
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

  // Generate bonding curve data using actual contract price calculations
  const generateBondingCurveData = useCallback(
    async (tokenAddress: string) => {
      const tokenInfo = await fetchTokenInfo(tokenAddress);
      if (!tokenInfo) return [];

      // tokensBondedAt is already formatted to ether (whole tokens)
      const tokensBondedAt = parseFloat(
        ethers.utils.formatEther(tokenInfo.tokenInfo.tokensBondedAt),
      );
      const currentSupply = parseFloat(tokenInfo.currentSupply);

      const dataPoints = [];
      const numIntervals = 8; // Create 8 intervals as requested

      console.log('🎯 Generating bonding curve with:', {
        tokensBondedAt,
        currentSupply,
        intervals: numIntervals,
      });

      // Generate points at 0%, 12.5%, 25%, 37.5%, 50%, 62.5%, 75%, 87.5%, 100%
      for (let i = 0; i <= numIntervals; i++) {
        const supplyPoint = Math.floor((tokensBondedAt / numIntervals) * i);

        // For 0 tokens, use floor price
        if (supplyPoint === 0 || supplyPoint < 1) {
          const floorPrice = parseFloat(ethers.utils.formatEther(tokenInfo.tokenInfo.floor));
          dataPoints.push({
            tokensSold: 0,
            priceACES: floorPrice,
            phase: 'completed',
          });
          continue;
        }

        try {
          // Calculate price for buying 1 token at this supply level
          const priceInAces = await calculatePriceAtSupply(tokenAddress, supplyPoint);

          console.log(
            `📊 Supply: ${supplyPoint.toLocaleString()} tokens → Price: ${priceInAces.toFixed(6)} ACES`,
          );

          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: priceInAces,
            phase: supplyPoint <= currentSupply ? 'completed' : 'upcoming',
          });

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to calculate price at ${supplyPoint}:`, error);
          // Use previous point's price or floor as fallback
          const fallbackPrice: number =
            dataPoints.length > 0
              ? dataPoints[dataPoints.length - 1].priceACES
              : parseFloat(ethers.utils.formatEther(tokenInfo.tokenInfo.floor));

          dataPoints.push({
            tokensSold: supplyPoint,
            priceACES: fallbackPrice,
            phase: 'upcoming',
          });
        }
      }

      console.log('✅ Generated curve data points:', dataPoints.length);
      return dataPoints;
    },
    [fetchTokenInfo, calculatePriceAtSupply],
  );

  // Calculate bonding curve progress (pump.fun style)
  const calculateBondingProgress = useCallback(
    async (
      tokenAddress: string,
    ): Promise<{
      percentage: number;
      currentACES: string;
      targetACES: string;
      isBonded: boolean;
    } | null> => {
      const activeContract = factoryContract || readOnlyFactoryContract;
      const isUsingReadOnly = !factoryContract && !!readOnlyFactoryContract;

      console.log('🔄 calculateBondingProgress called:', {
        tokenAddress,
        hasActiveContract: !!activeContract,
        isUsingReadOnly,
      });

      if (!activeContract) {
        console.warn('❌ No contract available for bonding progress calculation');
        return null;
      }

      try {
        // Get token info from factory with timeout
        console.log('📞 Calling contract.tokens() for bonding progress...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tokenData = (await withTimeout(activeContract.tokens(tokenAddress), 8000)) as any;

        // If token doesn't exist, return null
        if (tokenData.tokenAddress === ethers.constants.AddressZero) {
          console.warn('⚠️ Token not found:', tokenAddress);
          return null;
        }

        const currentACESBalance = tokenData.acesTokenBalance; // BigNumber
        const tokensBondedAt = tokenData.tokensBondedAt; // BigNumber
        const isBonded = tokenData.tokenBonded;
        const curve = tokenData.curve;
        const steepness = tokenData.steepness;
        const floor = tokenData.floor;

        // Calculate total ACES needed to reach bonding threshold
        // This is the cumulative price from 1 token to tokensBondedAt
        const startSupply = ethers.utils.parseEther('1'); // Start from 1 token (minimum)
        const amountToBuy = tokensBondedAt.sub(startSupply); // Amount needed to reach bonding

        let totalACESTarget: ethers.BigNumber;

        console.log('📞 Calculating price curve...');
        if (curve === 0) {
          // Quadratic curve
          totalACESTarget = await withTimeout(
            activeContract.getPriceQuadratic(startSupply, amountToBuy, steepness, floor),
            8000,
          );
        } else {
          // Linear curve
          totalACESTarget = await withTimeout(
            activeContract.getPriceLinear(startSupply, amountToBuy, steepness, floor),
            8000,
          );
        }

        // Calculate percentage
        const percentage = isBonded
          ? 100
          : Math.min(
              100,
              (parseFloat(ethers.utils.formatEther(currentACESBalance)) /
                parseFloat(ethers.utils.formatEther(totalACESTarget))) *
                100,
            );

        console.log('✅ Bonding progress calculated:', {
          percentage: percentage.toFixed(2) + '%',
          isBonded,
        });

        return {
          percentage,
          currentACES: ethers.utils.formatEther(currentACESBalance),
          targetACES: ethers.utils.formatEther(totalACESTarget),
          isBonded,
        };
      } catch (error) {
        console.error('❌ Failed to calculate bonding progress:', error);
        return null;
      }
    },
    [factoryContract, readOnlyFactoryContract, withTimeout],
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

        const buyer = await factoryContract.signer.getAddress();
        const tx = await factoryContract.buyTokens(buyer, tokenAddress, amountWei, maxPriceWei);
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
    calculateBondingProgress,
    createToken,
    buyTokens,
    sellTokens,
    // Connection state
    isWalletConnected,
    // Utility - ready if either wallet contracts OR read-only contracts are available
    isReady:
      (isWalletConnected && !!factoryContract && !!signer && !!tokenImplementation) ||
      (!!readOnlyFactoryContract && !!tokenImplementation),
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
