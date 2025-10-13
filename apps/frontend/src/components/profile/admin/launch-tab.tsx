'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';
import { type SaltMiningResult, mineVanitySaltWithTimeout } from '@/lib/utils/salt-mining';
import { useAuth } from '@/lib/auth/auth-context';
import { useWalletClient } from 'wagmi';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminApi } from '@/lib/api/admin';
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Pickaxe,
  CheckCircle,
  AlertCircle,
  Network,
  DollarSign,
  Link2,
  Unlink,
  Globe2,
  ArrowRightLeft,
} from 'lucide-react';

// Wagmi-to-Ethers signer hook (Solution 2: Better Privy Smart Wallet support)
function useWagmiEthersSigner() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);

  useEffect(() => {
    async function getSignerFromWagmi() {
      if (!walletClient) {
        console.log('⏸️ No Wagmi wallet client available');
        setSigner(null);
        setProvider(null);
        return;
      }

      try {
        console.log('🔗 Getting signer from Wagmi wallet client');
        console.log('Wallet client details:', {
          address: walletClient.account.address,
          chainId: walletClient.chain.id,
          chainName: walletClient.chain.name,
        });

        // Convert Viem wallet client to ethers signer
        const { account, chain } = walletClient;

        // Create a provider from the transport
        const network = {
          chainId: chain.id,
          name: chain.name,
        };

        // Create ethers provider from wallet client transport
        const ethersProvider = new ethers.providers.Web3Provider(
          walletClient.transport as unknown as ethers.providers.ExternalProvider,
          network,
        );

        // Get signer from provider
        const ethersSigner = ethersProvider.getSigner(account.address);

        // Verify signer works
        const signerAddress = await ethersSigner.getAddress();
        console.log('✅ Wagmi signer obtained and verified:', signerAddress);

        setSigner(ethersSigner);
        setProvider(ethersProvider);
      } catch (error) {
        console.error('❌ Failed to get Wagmi signer:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        setSigner(null);
        setProvider(null);
      }
    }

    getSignerFromWagmi();
  }, [walletClient]);

  return { signer, provider };
}

export function LaunchTab() {
  // Use Privy authentication system for wallet connection (required for contract deployment)
  const { isAuthenticated, user, walletAddress, getAccessToken, refreshUserProfile } = useAuth();

  // Chain switching hook to detect current network
  const {
    currentChainId,
    currentChain,
    isOnSupportedChain,
    switchToChain,
    isSwitching: isChainSwitchPending,
    SUPPORTED_CHAINS,
  } = useChainSwitching();

  // Add token to database state
  const [addTokenAddress, setAddTokenAddress] = useState<string>('');
  const [addTokenLoading, setAddTokenLoading] = useState<boolean>(false);
  const [addTokenResult, setAddTokenResult] = useState<string | null>(null);

  // Listing linking state
  const [availableListings, setAvailableListings] = useState<
    Array<{
      id: string;
      title: string;
      symbol: string;
      assetType: string;
      isLive: boolean;
      owner: { walletAddress: string | null; email: string | null };
      token: { contractAddress: string; symbol: string; name: string } | null;
    }>
  >([]);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [linkTokenAddress, setLinkTokenAddress] = useState<string>('');
  const [linkingLoading, setLinkingLoading] = useState<boolean>(false);
  const [linkingResult, setLinkingResult] = useState<string | null>(null);
  const [isManualChainSwitching, setIsManualChainSwitching] = useState(false);

  const [chainSwitchFeedback, setChainSwitchFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const isSwitchingChains = isManualChainSwitching || isChainSwitchPending;
  const isOnBaseMainnet = currentChainId === SUPPORTED_CHAINS.BASE_MAINNET.id;
  const isOnBaseSepolia = currentChainId === SUPPORTED_CHAINS.BASE_SEPOLIA.id;

  // Get signer from Wagmi (Solution 2: Better support for Privy Smart Wallets)
  const { signer: wagmiSigner, provider: wagmiProvider } = useWagmiEthersSigner();

  const [acesBalance, setAcesBalance] = useState<string>('0');

  // Factory contract instances
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);

  // Get contract addresses for current chain
  const contractAddresses = getContractAddresses(currentChainId);

  // Use new contract hook with current chain ID and pass Wagmi signer
  const {
    createToken,
    isReady,
    tokenImplementation,
    isWalletConnected,
    factoryContract: hookFactoryContract,
    signer: hookSigner,
  } = useAcesFactoryContract({
    chainId: currentChainId,
    externalSigner: wagmiSigner,
    externalProvider: wagmiProvider,
  });

  // Token creation state with new tokensBondedAt field
  const [createForm, setCreateForm] = useState({
    name: 'Admin Test Token',
    symbol: 'ATT',
    salt: '', // Empty by default - will be set manually or generated during mining
    steepness: '100000000',
    floor: '0',
    tokensBondedAt: '800000000', // New field - 800M tokens (will be converted to wei)
    curve: 0,
  });

  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState({
    attempts: 0,
    timeElapsed: 0,
    predictedAddress: '',
  });
  const [saltMiningResult, setSaltMiningResult] = useState<SaltMiningResult | null>(null);

  // Trading state
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [priceQuote, setPriceQuote] = useState<string>('0');
  const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');
  const [loading, setLoading] = useState<string>('');

  // Created token state
  const [createdTokens, setCreatedTokens] = useState<
    Array<{
      address: string;
      name: string;
      symbol: string;
      balance: string;
      totalSupply: string;
    }>
  >([
    // Add your test token for quick testing
    {
      address: '0xa19763cfd3dcd1f47447954f5576e660f8b6e261',
      name: 'Test Token',
      symbol: 'TEST',
      balance: '0',
      totalSupply: '0',
    },
    {
      address: '0x569805040d28B360d004bB9969E84C4E19dFd2B8',
      name: 'New Launchpad Token',
      symbol: 'NLT',
      balance: '0',
      totalSupply: '0',
    },
  ]);

  // Clear all state when wallet is disconnected
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !isWalletConnected) {
      // Clear all contract state
      setFactoryContract(null);
      setAcesContract(null);
      setAcesBalance('0');
      // Note: wagmiSigner is managed by the hook, no need to clear manually

      // Clear mining state
      setIsMining(false);
      setSaltMiningResult(null);
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });

      // Clear trading state
      setSelectedToken('');
      setTradeAmount('');
      setPriceQuote('0');
      setSellPriceQuote('0');
      setLoading('');

      console.log('🧹 Cleared all cached state due to wallet disconnection');
      return;
    }
  }, [isAuthenticated, walletAddress, isWalletConnected]);

  // Initialize contracts when wallet is connected
  useEffect(() => {
    const initializeContracts = async () => {
      if (!walletAddress || !isAuthenticated || !isWalletConnected) {
        return;
      }

      try {
        // Use factory contract from hook (hook now uses the Privy signer we passed in)
        if (hookFactoryContract) {
          setFactoryContract(hookFactoryContract);
          console.log('✅ Using factory contract from hook');
        }

        // Initialize ACES contract - use hook signer (which is now using Privy)
        if (hookSigner) {
          const aces = new ethers.Contract(contractAddresses.ACES_TOKEN, ERC20_ABI, hookSigner);
          setAcesContract(aces);

          // Get ACES balance
          try {
            const balance = await aces.balanceOf(walletAddress);
            setAcesBalance(ethers.utils.formatEther(balance));
            console.log('✅ ACES balance loaded:', ethers.utils.formatEther(balance));
          } catch (balanceError) {
            console.error('❌ Failed to get ACES balance:', balanceError);
            setAcesBalance('0');
          }
        }

        console.log('✅ Contracts initialization completed');
      } catch (error) {
        console.error('❌ Failed to initialize contracts:', error);
        setFactoryContract(null);
        setAcesContract(null);
        setAcesBalance('0');
      }
    };

    initializeContracts();
  }, [
    hookSigner,
    hookFactoryContract,
    walletAddress,
    contractAddresses,
    isAuthenticated,
    isWalletConnected,
  ]);

  // Separate salt mining function
  const handleBeginSaltMine = async () => {
    console.log('🎯 Beginning salt mining...');
    console.log('Debug values:', {
      isReady,
      wagmiSigner: !!wagmiSigner,
      hookSigner: !!hookSigner,
      walletAddress: !!walletAddress,
      isAuthenticated,
      isWalletConnected,
    });

    if (!isReady) {
      alert('Contract hook not ready. Please wait...');
      return;
    }

    if (!walletAddress) {
      alert('Wallet address not found. Please reconnect your wallet.');
      return;
    }

    if (!isAuthenticated) {
      alert('Please authenticate first.');
      return;
    }

    // Use hook signer (which now includes Privy signer)
    if (!hookSigner) {
      alert('Wallet signer not available. Please make sure your wallet is connected and unlocked.');
      return;
    }

    try {
      setIsMining(true);
      setLoading('Mining vanity address...');

      // Reset progress
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      setSaltMiningResult(null);

      // Get factory and tokenImplementation from the hook
      const factoryAddress = contractAddresses.FACTORY_PROXY;

      if (!tokenImplementation) {
        alert('Token implementation not loaded yet. Please wait...');
        return;
      }

      const result = await mineVanitySaltWithTimeout(
        walletAddress,
        createForm.name,
        createForm.symbol,
        factoryAddress,
        tokenImplementation,
        {
          targetSuffix: 'ACE',
          maxAttempts: 200000,
          onProgress: (attempts, timeElapsed) => {
            console.log('Mining progress:', { attempts, timeElapsed });
            setMiningProgress({ attempts, timeElapsed, predictedAddress: '' });
            setLoading(
              `Mining address... ${attempts} attempts, ${(timeElapsed / 1000).toFixed(1)}s`,
            );
          },
        },
        300000, // 5 minute timeout
      );

      // Success! Update the form with the mined salt
      setCreateForm((prev) => ({
        ...prev,
        salt: result.salt,
      }));

      setSaltMiningResult(result);

      alert(
        `🎯 Vanity address found!\n\n` +
          `Predicted Address: ${result.predictedAddress}\n` +
          `Attempts: ${result.attempts.toLocaleString()}\n` +
          `Time: ${(result.timeElapsed / 1000).toFixed(1)}s\n` +
          `Salt: ${result.salt}\n\n` +
          `Salt has been added to the form. You can now click "Create Token"!`,
      );
    } catch (error) {
      console.error('Salt mining failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Salt mining failed: ${errorMessage}`);
    } finally {
      setIsMining(false);
      setLoading('');
    }
  };

  // Enhanced createToken function using new hook
  const handleCreateToken = async () => {
    console.log('🚀 handleCreateToken called');
    console.log('isReady:', isReady);
    console.log('createForm:', createForm);

    if (!isReady) {
      alert('Contract hook not ready. Please wait...');
      return;
    }

    // Validate salt requirements
    if (!createForm.salt.trim()) {
      alert(
        'Please provide a salt value for token creation. You can enter one manually or use "Begin Salt Mine" to generate a vanity address.',
      );
      return;
    }

    // Validate tokensBondedAt (must be at least 1 token in the contract)
    try {
      const tokensBondedAtWei = ethers.utils.parseEther(createForm.tokensBondedAt);
      const minTokensBondedAt = ethers.utils.parseEther('1'); // At least 1 token
      if (tokensBondedAtWei.lt(minTokensBondedAt)) {
        alert('Tokens Bonded At must be at least 1 token');
        return;
      }
    } catch (error) {
      alert('Invalid Tokens Bonded At value. Please enter a valid number.');
      return;
    }

    try {
      setLoading('Creating token...');

      const result = await createToken(
        {
          curve: createForm.curve,
          steepness: createForm.steepness,
          floor: createForm.floor,
          name: createForm.name,
          symbol: createForm.symbol,
          salt: createForm.salt,
          tokensBondedAt: ethers.utils.parseEther(createForm.tokensBondedAt).toString(), // Convert to wei
          useVanityMining: false, // Always false since we do mining separately
        },
        // Mining progress callback
        (attempts, timeElapsed) => {
          console.log('Mining progress:', { attempts, timeElapsed });
          setMiningProgress({ attempts, timeElapsed, predictedAddress: '' });
          setLoading(`Mining address... ${attempts} attempts, ${(timeElapsed / 1000).toFixed(1)}s`);
        },
      );

      // Stop mining state
      setIsMining(false);

      if (result.success) {
        // Handle successful creation
        const newToken = {
          address: result.tokenAddress!,
          name: createForm.name,
          symbol: createForm.symbol,
          balance: '0',
          totalSupply: '0',
        };

        setCreatedTokens((prev) => [...prev, newToken]);
        setSelectedToken(result.tokenAddress!);

        if (result.saltMiningResult) {
          setSaltMiningResult(result.saltMiningResult);

          // Update the salt input field with the mined salt
          setCreateForm((prev) => ({
            ...prev,
            salt: result.saltMiningResult!.salt,
          }));

          const isVanitySuccess = result.tokenAddress?.toLowerCase().endsWith('ace');
          alert(
            `Token created successfully!\n\n` +
              `Address: ${result.tokenAddress}\n` +
              `Vanity Mining: ${result.saltMiningResult.attempts} attempts in ${(result.saltMiningResult.timeElapsed / 1000).toFixed(1)}s\n` +
              `${isVanitySuccess ? '✅ Address ends with "ace"!' : '❌ Vanity mining failed'}\n` +
              `Mined Salt: ${result.saltMiningResult.salt}`,
          );
        } else {
          alert(`Token created successfully!\nAddress: ${result.tokenAddress}`);
        }

        // Reset form (but keep the mined salt for vanity addresses)
        setCreateForm((prev) => ({
          ...prev,
          salt: result.saltMiningResult ? result.saltMiningResult.salt : `token-${Date.now()}`, // Generate new default salt
        }));
        setSaltMiningResult(null);
        setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      } else {
        console.error('Token creation failed:', result.error);
        alert(`Token creation failed: ${result.error || 'Unknown error'}`);
      }

      setLoading('');
    } catch (error) {
      console.error('Token creation failed:', error);
      setIsMining(false);
      setLoading('');
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });

      // Better error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Token creation failed: ${errorMessage}`);
    }
  };

  const handleManualChainSwitch = async (
    targetChain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS],
  ) => {
    if (!targetChain) return;

    if (currentChainId === targetChain.id) {
      setChainSwitchFeedback({
        type: 'info',
        message: `Already connected to ${targetChain.name}.`,
      });
      return;
    }

    setChainSwitchFeedback(null);
    setIsManualChainSwitching(true);

    try {
      await switchToChain(targetChain);
      setChainSwitchFeedback({
        type: 'success',
        message: `Switched to ${targetChain.name}.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message.replace('CHAIN_SWITCH_REQUIRED:', '').trim()
          : 'Unknown error occurred while switching networks.';
      setChainSwitchFeedback({
        type: 'error',
        message: `Failed to switch: ${errorMessage || 'Please try again.'}`,
      });
    } finally {
      setIsManualChainSwitching(false);
    }
  };

  // Get price quote for buying
  const getPriceQuote = async () => {
    if (!factoryContract || !selectedToken || !tradeAmount) {
      console.log('Missing requirements for price quote:', {
        factoryContract: !!factoryContract,
        selectedToken: !!selectedToken,
        tradeAmount: !!tradeAmount,
      });
      return;
    }

    try {
      console.log('Getting price quote for:', {
        token: selectedToken,
        amount: tradeAmount,
      });

      const amountWei = ethers.utils.parseEther(tradeAmount);
      console.log('Amount in wei:', amountWei.toString());

      const priceWei = await factoryContract.getBuyPriceAfterFee(selectedToken, amountWei);
      console.log('Price quote (wei):', priceWei.toString());

      const formattedPrice = ethers.utils.formatEther(priceWei);
      console.log('Price quote (formatted):', formattedPrice);
      setPriceQuote(formattedPrice);
    } catch (error) {
      console.error('Failed to get price quote:', error);

      // More specific error handling
      if (error && typeof error === 'object' && 'reason' in error) {
        console.error('Error reason:', (error as { reason: unknown }).reason);
      }
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Error code:', (error as { code: unknown }).code);
      }
      if (error && typeof error === 'object' && 'data' in error) {
        console.error('Error data:', (error as { data: unknown }).data);
      }

      setPriceQuote('0');
    }
  };

  // Get sell price quote
  const getSellPriceQuote = async () => {
    if (!factoryContract || !selectedToken || !tradeAmount) return;

    try {
      const amountWei = ethers.utils.parseEther(tradeAmount);
      const sellPriceWei = await factoryContract.getSellPriceAfterFee(selectedToken, amountWei);
      setSellPriceQuote(ethers.utils.formatEther(sellPriceWei));
    } catch (error) {
      console.error('Failed to get sell price quote:', error);
      setSellPriceQuote('0');
    }
  };

  // Buy tokens
  const buyTokens = async () => {
    if (!factoryContract || !acesContract || !selectedToken || !tradeAmount || !hookSigner) return;

    try {
      const amountWei = ethers.utils.parseEther(tradeAmount);
      const priceWei = ethers.utils.parseEther(priceQuote);

      setLoading('Approving ACES tokens...');
      console.log('Approving ACES tokens for amount:', priceWei.toString());
      const approveTx = await acesContract.approve(contractAddresses.FACTORY_PROXY, priceWei);
      console.log('Approval transaction hash:', approveTx.hash);

      const approvalReceipt = await approveTx.wait();
      console.log('Approval confirmed in block:', approvalReceipt.blockNumber);

      // Add a small delay to ensure approval is fully processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setLoading('Buying tokens...');
      console.log(
        'Buying tokens - Token:',
        selectedToken,
        'Amount:',
        amountWei.toString(),
        'Max Price:',
        priceWei.toString(),
      );

      const buyTx = await factoryContract.buyTokens(selectedToken, amountWei, priceWei);
      console.log('Buy transaction hash:', buyTx.hash);

      const buyReceipt = await buyTx.wait();
      console.log('Buy confirmed in block:', buyReceipt.blockNumber);

      setLoading('Refreshing balances...');
      await refreshBalances();
      setLoading('');

      alert('Tokens purchased successfully!');
    } catch (error) {
      console.error('Failed to buy tokens:', error);

      // Better error handling
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: unknown }).code === -32603
      ) {
        alert('Network error occurred. Please check your connection and try again.');
      } else if (error && typeof error === 'object' && 'reason' in error) {
        alert(`Transaction failed: ${(error as { reason: unknown }).reason}`);
      } else if (error && typeof error === 'object' && 'message' in error) {
        alert(`Error: ${(error as { message: unknown }).message}`);
      } else {
        alert('Unknown error occurred. Please try again.');
      }

      setLoading('');
    }
  };

  // Sell tokens
  const sellTokens = async () => {
    if (!factoryContract || !selectedToken || !tradeAmount) return;

    try {
      const amountWei = ethers.utils.parseEther(tradeAmount);

      setLoading('Selling tokens...');
      console.log('Selling tokens - Token:', selectedToken, 'Amount:', amountWei.toString());

      const tx = await factoryContract.sellTokens(selectedToken, amountWei);
      console.log('Sell transaction hash:', tx.hash);

      const receipt = await tx.wait();
      console.log('Sell confirmed in block:', receipt.blockNumber);

      setLoading('Refreshing balances...');
      await refreshBalances();
      setLoading('');

      alert('Tokens sold successfully!');
    } catch (error) {
      console.error('Failed to sell tokens:', error);

      // Better error handling
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: unknown }).code === -32603
      ) {
        alert('Network error occurred. Please check your connection and try again.');
      } else if (error && typeof error === 'object' && 'reason' in error) {
        alert(`Transaction failed: ${(error as { reason: unknown }).reason}`);
      } else if (error && typeof error === 'object' && 'message' in error) {
        alert(`Error: ${(error as { message: unknown }).message}`);
      } else {
        alert('Unknown error occurred. Please try again.');
      }

      setLoading('');
    }
  };

  // Refresh balances
  const refreshBalances = async () => {
    if (!acesContract || !walletAddress) return;

    try {
      console.log('Refreshing ACES balance for address:', walletAddress);
      const acesBalance = await acesContract.balanceOf(walletAddress);
      console.log('ACES balance (wei):', acesBalance.toString());
      setAcesBalance(ethers.utils.formatEther(acesBalance));
      console.log('ACES balance (formatted):', ethers.utils.formatEther(acesBalance));

      // Update token balances for created tokens
      if (createdTokens.length > 0) {
        console.log('Refreshing balances for', createdTokens.length, 'created tokens');
        const updatedTokens = await Promise.all(
          createdTokens.map(async (token) => {
            try {
              if (!hookSigner) return token;
              console.log('Getting balance for token:', token.address);
              const tokenContract = new ethers.Contract(
                token.address,
                LAUNCHPAD_TOKEN_ABI,
                hookSigner,
              );
              const balance = await tokenContract.balanceOf(walletAddress);
              const totalSupply = await tokenContract.totalSupply();
              console.log(
                `Token ${token.symbol} - Balance:`,
                balance.toString(),
                'Total Supply:',
                totalSupply.toString(),
              );
              return {
                ...token,
                balance: ethers.utils.formatEther(balance),
                totalSupply: ethers.utils.formatEther(totalSupply),
              };
            } catch (tokenError) {
              console.error(`Failed to get balance for token ${token.address}:`, tokenError);
              return token; // Return original token if balance fetch fails
            }
          }),
        );
        setCreatedTokens(updatedTokens);
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      // Privy-compatible error handling
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      if (error && typeof error === 'object' && 'reason' in error) {
        console.error('Error reason:', (error as { reason: unknown }).reason);
      }
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Error code:', (error as { code: unknown }).code);
      }
    }
  };

  // Update selected token and clear trade amount
  const handleTokenSelect = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
    setTradeAmount('');
    setPriceQuote('0');
    setSellPriceQuote('0');
  };

  // Update trade amount and clear quotes
  const handleTradeAmountChange = (amount: string) => {
    setTradeAmount(amount);
    setPriceQuote('0');
    setSellPriceQuote('0');
  };

  // Fetch available listings
  const fetchAvailableListings = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const result = await AdminApi.getAvailableListings(token);
      if (result.success) {
        setAvailableListings(result.data);
        console.log('✅ Loaded', result.count, 'available listings');
      }
    } catch (error) {
      console.error('Error fetching available listings:', error);
    }
  }, [getAccessToken]);

  // Load listings on mount
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      fetchAvailableListings();
    }
  }, [isAuthenticated, user?.role, fetchAvailableListings]);

  // Add token to database
  const handleAddTokenToDatabase = async () => {
    if (!addTokenAddress || !ethers.utils.isAddress(addTokenAddress)) {
      alert('Please enter a valid contract address');
      return;
    }

    try {
      setAddTokenLoading(true);
      setAddTokenResult(null);

      // Get access token for authentication
      const token = await getAccessToken();
      if (!token) {
        setAddTokenResult('❌ Error: Not authenticated. Please sign in again.');
        setAddTokenLoading(false);
        return;
      }

      const result = await AdminApi.addTokenToDatabase(addTokenAddress, token);

      if (result.success) {
        setAddTokenResult(`✅ ${result.message}`);

        // Automatically populate the linking form with the newly added token
        setLinkTokenAddress(addTokenAddress);
        setAddTokenAddress('');

        // Refresh token balances to include new token
        await refreshBalances();

        // Refresh available listings in case any were updated
        await fetchAvailableListings();
      } else {
        setAddTokenResult(`❌ Error: ${result.message || 'Failed to add token'}`);
      }
    } catch (error) {
      console.error('Error adding token to database:', error);
      setAddTokenResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAddTokenLoading(false);
    }
  };

  // Link token to listing
  const handleLinkTokenToListing = async () => {
    if (!linkTokenAddress || !ethers.utils.isAddress(linkTokenAddress)) {
      alert('Please enter a valid token contract address');
      return;
    }

    if (!selectedListingId) {
      alert('Please select a listing to link');
      return;
    }

    try {
      setLinkingLoading(true);
      setLinkingResult(null);

      const token = await getAccessToken();
      if (!token) {
        setLinkingResult('❌ Error: Not authenticated. Please sign in again.');
        setLinkingLoading(false);
        return;
      }

      const result = await AdminApi.linkTokenToListing(linkTokenAddress, selectedListingId, token);

      if (result.success) {
        setLinkingResult(`✅ ${result.message}`);

        // Clear form
        setLinkTokenAddress('');
        setSelectedListingId('');

        // Refresh listings to show updated associations
        await fetchAvailableListings();
      } else {
        setLinkingResult(`❌ Error: ${result.message || 'Failed to link token'}`);
      }
    } catch (error) {
      console.error('Error linking token to listing:', error);
      setLinkingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLinkingLoading(false);
    }
  };

  // Unlink token from listing
  const handleUnlinkToken = async () => {
    if (!linkTokenAddress || !ethers.utils.isAddress(linkTokenAddress)) {
      alert('Please enter a valid token contract address');
      return;
    }

    try {
      setLinkingLoading(true);
      setLinkingResult(null);

      const token = await getAccessToken();
      if (!token) {
        setLinkingResult('❌ Error: Not authenticated. Please sign in again.');
        setLinkingLoading(false);
        return;
      }

      const result = await AdminApi.unlinkTokenFromListing(linkTokenAddress, token);

      if (result.success) {
        setLinkingResult(`✅ ${result.message}`);

        // Clear form
        setLinkTokenAddress('');
        setSelectedListingId('');

        // Refresh listings
        await fetchAvailableListings();
      } else {
        setLinkingResult(`❌ Error: ${result.message || 'Failed to unlink token'}`);
      }
    } catch (error) {
      console.error('Error unlinking token:', error);
      setLinkingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLinkingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white font-libre-caslon">Token Launch Center</h2>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-purple-400 border-purple-400">
            Admin Only
          </Badge>
          {/* Wallet Connection Component */}
          <ConnectWalletProfile className="ml-4" />
        </div>
      </div>

      {/* Admin Role Verification */}
      {isAuthenticated && walletAddress && (
        <Card className="bg-black border-purple-400/20">
          <CardHeader>
            <CardTitle className="text-white font-libre-caslon flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-purple-400" />
              Admin Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                {user?.role === 'ADMIN' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Admin Access Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-medium">Admin Access Required</span>
                  </>
                )}
              </div>
              <div className="text-sm text-[#DCDDCC]">
                <p>
                  <strong>Address:</strong> {walletAddress}
                </p>
                <p>
                  <strong>Role:</strong> {user?.role || 'Loading...'}
                </p>
              </div>
              {user?.role !== 'ADMIN' && (
                <div className="p-3 bg-red-500/10 border border-red-400/20 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <p className="text-red-400 text-sm">
                        This wallet is not registered as an admin. Contract deployment will be
                        restricted. Please contact an administrator to upgrade your account.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-red-400/70">
                      Already upgraded in database? Try refreshing your profile:
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          setLoading('Refreshing profile...');
                          await refreshUserProfile();
                          setLoading('');
                        } catch (error) {
                          console.error('Failed to refresh profile:', error);
                          setLoading('');
                          alert('Failed to refresh profile. Please try again or contact support.');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-400/20 hover:bg-red-400/10"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Profile
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info Card */}
      <Card className="bg-black border-purple-400/20">
        <CardHeader>
          <CardTitle className="text-white font-libre-caslon flex items-center">
            <Network className="w-5 h-5 mr-2 text-purple-400" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              {isReady ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-[#DCDDCC]">Hook Ready</span>
            </div>
            <div className="flex items-center space-x-2">
              {isAuthenticated && walletAddress ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-[#DCDDCC]">Wallet Connected</span>
            </div>
            <div className="flex items-center space-x-2">
              {factoryContract ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-[#DCDDCC]">Factory Contract</span>
            </div>
            <div className="flex items-center space-x-2">
              {acesContract ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-[#DCDDCC]">ACES Contract</span>
            </div>
          </div>
          {loading && (
            <div className="flex items-center space-x-2 text-purple-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-jetbrains">{loading}</span>
            </div>
          )}

          {/* Debug Info for Contract Status */}
          <div className="text-xs text-[#DCDDCC] space-y-1 p-2 bg-purple-500/5 rounded border border-purple-400/10">
            <p>
              <strong>Debug - Contract Hook Status:</strong>
            </p>
            <p>
              • Chain ID: {currentChainId} ({currentChain?.name || 'Unknown'})
            </p>
            <p>• Supported Chain: {isOnSupportedChain ? '✅ Yes' : '❌ No'}</p>
            <p>• isAuthenticated: {isAuthenticated ? '✅ True' : '❌ False'}</p>
            <p>• walletAddress: {walletAddress ? '✅ Connected' : '❌ Not connected'}</p>
            <p>• isWalletConnected (Hook): {isWalletConnected ? '✅ True' : '❌ False'}</p>
            <p>• isReady: {isReady ? '✅ True' : '❌ False'}</p>
            <p>• Wagmi signer (Solution 2): {wagmiSigner ? '✅ Available' : '❌ Not available'}</p>
            <p>• Hook signer: {hookSigner ? '✅ Available' : '❌ Not available'}</p>
            <p>• Hook factory: {hookFactoryContract ? '✅ Available' : '❌ Not available'}</p>
            <p>• Local factory: {factoryContract ? '✅ Available' : '❌ Not available'}</p>
            <p>• Local ACES: {acesContract ? '✅ Available' : '❌ Not available'}</p>
            <p>• tokenImplementation: {tokenImplementation ? '✅ Loaded' : '❌ Not loaded'}</p>
            <p>• ACES Balance: {acesBalance} ACES</p>
            <p>• ACES Token Address: {contractAddresses.ACES_TOKEN}</p>
            {currentChainId !== 84532 && currentChainId !== 8453 && (
              <p className="text-yellow-400">
                ⚠️ Warning: Expected Base Mainnet (8453) or Base Sepolia (84532), got{' '}
                {currentChainId}
              </p>
            )}
            <p>
              <strong>Salt Mining Disabled:</strong>{' '}
              {isMining || !isReady || !walletAddress || !isAuthenticated || !hookSigner
                ? '❌ YES'
                : '✅ NO'}
            </p>
            {(isMining || !isReady || !walletAddress || !isAuthenticated || !hookSigner) && (
              <p className="text-red-400 text-xs">
                <strong>Disabled because:</strong>
                {isMining && ' Currently mining'}
                {!isReady && ' Contract hook not ready'}
                {!walletAddress && ' No wallet address'}
                {!isAuthenticated && ' Not authenticated'}
                {!hookSigner && ' No signer available'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {hookSigner && (
              <Button
                onClick={async () => {
                  try {
                    const provider = hookSigner.provider;
                    const blockNumber = await provider?.getBlockNumber();
                    const network = await provider?.getNetwork();
                    console.log('=== Network Status ===');
                    console.log('Latest block:', blockNumber);
                    console.log('Network:', network?.name);
                    console.log('Chain ID:', network?.chainId);
                    alert(`Network OK! Block: ${blockNumber}, Chain: ${network?.chainId}`);
                  } catch (error) {
                    console.error('Network check failed:', error);
                    alert('Network connection failed!');
                  }
                }}
                variant="outline"
                size="sm"
                className="text-purple-400 border-purple-400/20 hover:bg-purple-400/10"
              >
                <Network className="w-4 h-4 mr-2" />
                Test Network
              </Button>
            )}
            {walletAddress && hookSigner && (
              <Button
                onClick={async () => {
                  try {
                    console.log('=== Testing ACES Contract ===');
                    console.log('Wallet Address:', walletAddress);
                    console.log('ACES Token Address:', contractAddresses.ACES_TOKEN);

                    // First, verify the signer's network
                    const signerNetwork = await hookSigner.provider?.getNetwork();
                    console.log('Signer Network:', signerNetwork?.chainId, signerNetwork?.name);

                    // Check if contract has code
                    const code = await hookSigner.provider?.getCode(contractAddresses.ACES_TOKEN);
                    console.log('Contract code length:', code?.length);

                    if (!code || code === '0x') {
                      alert(
                        `❌ ACES contract not deployed!\n\nAddress: ${contractAddresses.ACES_TOKEN}\nNetwork: ${signerNetwork?.name} (${signerNetwork?.chainId})\n\nThe contract has no code at this address on this network.`,
                      );
                      return;
                    }

                    const testAces = new ethers.Contract(
                      contractAddresses.ACES_TOKEN,
                      ERC20_ABI,
                      hookSigner,
                    );
                    console.log('Contract created with signer');

                    const balance = await testAces.balanceOf(walletAddress);
                    const formattedBalance = ethers.utils.formatEther(balance);
                    console.log('Raw Balance (wei):', balance.toString());
                    console.log('Formatted Balance:', formattedBalance);

                    alert(
                      `ACES Balance Test:\nRaw: ${balance.toString()}\nFormatted: ${formattedBalance} ACES`,
                    );
                  } catch (error) {
                    console.error('ACES contract test failed:', error);
                    const signerNetwork = await hookSigner.provider?.getNetwork();
                    alert(
                      `ACES test failed!\n\nNetwork: ${signerNetwork?.name} (${signerNetwork?.chainId})\nAddress: ${contractAddresses.ACES_TOKEN}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    );
                  }
                }}
                variant="outline"
                size="sm"
                className="text-green-400 border-green-400/20 hover:bg-green-400/10"
              >
                <Coins className="w-4 h-4 mr-2" />
                Test ACES Balance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isAuthenticated && walletAddress && (
        <Card className="bg-black border-purple-400/20">
          <CardHeader>
            <CardTitle className="text-white font-libre-caslon flex items-center">
              <Globe2 className="w-5 h-5 mr-2 text-purple-400" />
              Network Selector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm text-[#DCDDCC]">Current chain</p>
                <p className="text-white font-mono text-sm bg-purple-400/10 p-2 rounded border border-purple-400/20 inline-flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-purple-300" />
                  {currentChain?.name || 'Unknown network'} ({currentChainId ?? '—'})
                </p>
              </div>
              {!isOnSupportedChain && (
                <p className="text-sm text-yellow-400">
                  ⚠️ Unsupported chain detected. Switch to Base Mainnet or Base Sepolia.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={() => handleManualChainSwitch(SUPPORTED_CHAINS.BASE_SEPOLIA)}
                disabled={isSwitchingChains}
                variant="outline"
                className={`justify-center border border-purple-400/30 text-sm font-medium transition-colors ${
                  isOnBaseSepolia
                    ? 'bg-purple-500/20 text-purple-200 border-purple-400'
                    : 'text-[#DCDDCC] hover:bg-purple-500/10'
                }`}
              >
                Base Sepolia (84532)
              </Button>
              <Button
                onClick={() => handleManualChainSwitch(SUPPORTED_CHAINS.BASE_MAINNET)}
                disabled={isSwitchingChains}
                variant="outline"
                className={`justify-center border border-purple-400/30 text-sm font-medium transition-colors ${
                  isOnBaseMainnet
                    ? 'bg-purple-500/20 text-purple-200 border-purple-400'
                    : 'text-[#DCDDCC] hover:bg-purple-500/10'
                }`}
              >
                Base Mainnet (8453)
              </Button>
            </div>
            {(isSwitchingChains || chainSwitchFeedback) && (
              <div className="rounded border border-purple-400/20 bg-purple-500/5 px-3 py-2 text-sm">
                {isSwitchingChains && (
                  <p className="text-[#DCDDCC]">Prompting wallet to confirm chain switch…</p>
                )}
                {chainSwitchFeedback && !isSwitchingChains && (
                  <p
                    className={
                      chainSwitchFeedback.type === 'error'
                        ? 'text-red-400'
                        : chainSwitchFeedback.type === 'success'
                          ? 'text-green-400'
                          : 'text-purple-300'
                    }
                  >
                    {chainSwitchFeedback.message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ACES Balance and Controls */}
      {isAuthenticated && walletAddress && (
        <Card className="bg-black border-purple-400/20">
          <CardHeader>
            <CardTitle className="text-white font-libre-caslon flex items-center">
              <Coins className="w-5 h-5 mr-2 text-purple-400" />
              Account Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#DCDDCC] text-sm">Admin Address</Label>
                  <p className="text-white font-mono text-sm bg-purple-400/10 p-2 rounded border border-purple-400/20 break-all">
                    {walletAddress}
                  </p>
                </div>
                <div>
                  <Label className="text-[#DCDDCC] text-sm">ACES Balance</Label>
                  <p className="text-white font-mono text-sm bg-purple-400/10 p-2 rounded border border-purple-400/20">
                    {parseFloat(acesBalance).toFixed(4)} ACES
                  </p>
                </div>
              </div>
              {user && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#DCDDCC]">
                      Admin: <span className="text-purple-400">{user.email || 'Admin User'}</span>
                    </p>
                    <p className="text-xs text-[#DCDDCC]">
                      Role: <span className="text-purple-400">{user.role || 'ADMIN'}</span>
                    </p>
                  </div>
                  <Button
                    onClick={refreshBalances}
                    variant="outline"
                    className="text-purple-400 border-purple-400/20 hover:bg-purple-400/10"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Balances
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && walletAddress && (
        <>
          {/* Token Creation */}
          <Card className="bg-black border-purple-400/20">
            <CardHeader>
              <CardTitle className="text-white font-libre-caslon flex items-center">
                <Coins className="w-5 h-5 mr-2 text-purple-400" />
                Create New Launchpad Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Salt Mining Section */}
              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-400/20 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-purple-400 mb-1 flex items-center">
                      <Pickaxe className="w-4 h-4 mr-2" />
                      Vanity Address Mining
                    </h3>
                    <p className="text-xs text-[#DCDDCC]">
                      Mine a salt to create a token address ending in &quot;ACE&quot;
                    </p>
                  </div>
                  <Button
                    onClick={handleBeginSaltMine}
                    disabled={
                      isMining || !isReady || !walletAddress || !isAuthenticated || !hookSigner
                    }
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                  >
                    {isMining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Mining...
                      </>
                    ) : (
                      <>
                        <Pickaxe className="w-4 h-4 mr-2" />
                        Begin Salt Mine
                      </>
                    )}
                  </Button>
                </div>

                {saltMiningResult && (
                  <div className="p-3 bg-green-500/10 border border-green-400/20 rounded-md">
                    <p className="text-xs font-medium text-green-400 mb-1 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Vanity Address Found!
                    </p>
                    <p className="text-xs text-green-300 break-all font-mono">
                      <strong>Address:</strong> {saltMiningResult.predictedAddress}
                    </p>
                    <p className="text-xs text-green-300">
                      <strong>Attempts:</strong> {saltMiningResult.attempts.toLocaleString()} |
                      <strong> Time:</strong> {(saltMiningResult.timeElapsed / 1000).toFixed(1)}s
                    </p>
                  </div>
                )}
              </div>

              {/* Token Creation Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[#DCDDCC]">Token Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    disabled={isMining}
                    className="bg-black border-purple-400/20 text-white"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <Label className="text-[#DCDDCC]">Token Symbol</Label>
                  <Input
                    value={createForm.symbol}
                    onChange={(e) => setCreateForm((p) => ({ ...p, symbol: e.target.value }))}
                    disabled={isMining}
                    className="bg-black border-purple-400/20 text-white"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <Label className="text-[#DCDDCC]">Salt (unique identifier)</Label>
                  <Input
                    type="text"
                    value={createForm.salt}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, salt: e.target.value }))}
                    className="bg-black border-purple-400/20 text-white"
                    placeholder="Enter unique salt or use 'Begin Salt Mine'"
                    disabled={isMining}
                  />
                  {saltMiningResult && (
                    <p className="text-xs text-green-400 mt-1 flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Vanity salt has been applied!
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-[#DCDDCC]">Curve Type</Label>
                  <select
                    value={createForm.curve}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, curve: parseInt(e.target.value) }))
                    }
                    className="w-full bg-black border border-purple-400/20 text-white rounded-md px-3 py-2"
                    disabled={isMining}
                  >
                    <option value={0}>Quadratic (faster price increase)</option>
                    <option value={1}>Linear (steady price increase)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[#DCDDCC]">Steepness</Label>
                  <Input
                    type="text"
                    value={createForm.steepness}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, steepness: e.target.value }))
                    }
                    className="bg-black border-purple-400/20 text-white"
                    placeholder="100000000"
                    disabled={isMining}
                  />
                  <p className="text-xs text-[#DCDDCC] mt-1">Higher = steeper price curve</p>
                </div>
                <div>
                  <Label className="text-[#DCDDCC]">Floor Price</Label>
                  <Input
                    type="text"
                    value={createForm.floor}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, floor: e.target.value }))}
                    className="bg-black border-purple-400/20 text-white"
                    placeholder="0"
                    disabled={isMining}
                  />
                  <p className="text-xs text-[#DCDDCC] mt-1">Minimum price per token</p>
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <Label className="text-[#DCDDCC]">
                    Tokens Bonded At (Bonding Curve Completion)
                  </Label>
                  <Input
                    type="text"
                    value={createForm.tokensBondedAt}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, tokensBondedAt: e.target.value }))
                    }
                    className="bg-black border-purple-400/20 text-white"
                    placeholder="800000000"
                    disabled={isMining}
                  />
                  <p className="text-xs text-[#DCDDCC] mt-1">
                    Number of tokens that must be sold before bonding curve completes (default:
                    800M). Enter in token units (e.g., 800000000 for 800M tokens).
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCreateToken}
                disabled={!!loading || isMining}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {isMining ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mining Address...
                  </>
                ) : loading === 'Creating token...' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : loading?.includes('Mining') ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {loading}
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    Create Token
                  </>
                )}
              </Button>

              {/* Mining Progress Display */}
              {isMining && (
                <div className="p-4 bg-purple-500/10 border border-purple-400/20 rounded-lg">
                  <h4 className="font-semibold text-purple-400 mb-3 flex items-center">
                    <Pickaxe className="w-4 h-4 mr-2" />
                    Mining Vanity Address...
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-[#DCDDCC]">
                    <div>
                      <span className="text-purple-400">Attempts:</span>{' '}
                      {miningProgress.attempts.toLocaleString()}
                    </div>
                    <div>
                      <span className="text-purple-400">Time:</span>{' '}
                      {(miningProgress.timeElapsed / 1000).toFixed(1)}s
                    </div>
                    <div>
                      <span className="text-purple-400">Rate:</span>{' '}
                      {miningProgress.timeElapsed > 0
                        ? (miningProgress.attempts / (miningProgress.timeElapsed / 1000)).toFixed(0)
                        : 0}{' '}
                      attempts/sec
                    </div>
                    <div>
                      <span className="text-purple-400">Target:</span> Address ending in
                      &quot;ace&quot;
                    </div>
                    <div>
                      <span className="text-purple-400">Max Attempts:</span> 200,000
                    </div>
                    <div>
                      <span className="text-purple-400">Timeout:</span> 5 minutes
                    </div>
                  </div>
                  {miningProgress.predictedAddress && (
                    <div className="mt-3 p-2 bg-purple-400/10 rounded border border-purple-400/20">
                      <p className="text-sm text-purple-400 break-all font-mono">
                        <strong>Predicted Address:</strong> {miningProgress.predictedAddress}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Salt Mining Result Display */}
              {saltMiningResult && (
                <div className="p-4 bg-green-500/10 border border-green-400/20 rounded-lg">
                  <h4 className="font-semibold text-green-400 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Vanity Address Found!
                  </h4>
                  <div className="space-y-2 text-sm text-green-300">
                    <p className="font-mono break-all">
                      <strong>Predicted Address:</strong> {saltMiningResult.predictedAddress}
                    </p>
                    <p>
                      <strong>Attempts:</strong> {saltMiningResult.attempts.toLocaleString()}
                    </p>
                    <p>
                      <strong>Time:</strong> {(saltMiningResult.timeElapsed / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Token to Database Card */}
          <Card className="bg-black border-cyan-400/20">
            <CardHeader>
              <CardTitle className="text-white font-libre-caslon flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-cyan-400" />
                Add Token to Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-lg">
                <p className="text-sm text-cyan-300 mb-2">
                  <strong>⚠️ Important:</strong> After creating a token on-chain, you must manually
                  add it to the database using this form.
                </p>
                <p className="text-xs text-cyan-200/70">
                  The cron job only syncs tokens with trading activity. New tokens with 0 trades
                  must be added manually first.
                </p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Token Contract Address</Label>
                <Input
                  type="text"
                  value={addTokenAddress}
                  onChange={(e) => setAddTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-black border-cyan-400/20 text-white font-mono"
                  disabled={addTokenLoading}
                />
                <p className="text-xs text-[#DCDDCC] mt-1">
                  Enter the contract address of the token you just created
                </p>
              </div>

              <Button
                onClick={handleAddTokenToDatabase}
                disabled={
                  addTokenLoading || !addTokenAddress || !ethers.utils.isAddress(addTokenAddress)
                }
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {addTokenLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding to Database...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Add Token to Database
                  </>
                )}
              </Button>

              {addTokenResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    addTokenResult.startsWith('✅')
                      ? 'bg-green-500/10 border-green-400/20 text-green-300'
                      : 'bg-red-500/10 border-red-400/20 text-red-300'
                  }`}
                >
                  {addTokenResult}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Link Token to Listing Card */}
          <Card className="bg-black border-emerald-400/20">
            <CardHeader>
              <CardTitle className="text-white font-libre-caslon flex items-center">
                <Link2 className="w-5 h-5 mr-2 text-emerald-400" />
                Link Token to Listing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
                <p className="text-sm text-emerald-300 mb-2">
                  <strong>📎 Step 3:</strong> Associate your token with an approved listing
                </p>
                <p className="text-xs text-emerald-200/70">
                  Each listing can be linked to one token. This connects the blockchain asset with
                  the real-world asset listing.
                </p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Token Contract Address</Label>
                <Input
                  type="text"
                  value={linkTokenAddress}
                  onChange={(e) => setLinkTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-black border-emerald-400/20 text-white font-mono"
                  disabled={linkingLoading}
                />
                <p className="text-xs text-[#DCDDCC] mt-1">
                  Enter the token address (auto-populated after adding to database)
                </p>
              </div>

              <div>
                <Label className="text-[#DCDDCC]">Select Listing</Label>
                <select
                  value={selectedListingId}
                  onChange={(e) => setSelectedListingId(e.target.value)}
                  className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
                  disabled={linkingLoading}
                >
                  <option value="">-- Choose a listing --</option>
                  {availableListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title} ({listing.symbol})
                      {listing.token
                        ? ` - Already linked to ${listing.token.symbol}`
                        : ' - Available'}
                      {!listing.isLive ? ' - Not Live' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#DCDDCC] mt-1">
                  Showing {availableListings.length} approved listings
                </p>
              </div>

              {/* Show selected listing details */}
              {selectedListingId && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-400/10 rounded">
                  {(() => {
                    const selected = availableListings.find((l) => l.id === selectedListingId);
                    if (!selected) return null;
                    return (
                      <div className="space-y-1 text-sm">
                        <p className="text-emerald-300">
                          <strong>Listing:</strong> {selected.title}
                        </p>
                        <p className="text-emerald-300/80">
                          <strong>Type:</strong> {selected.assetType}
                        </p>
                        <p className="text-emerald-300/80">
                          <strong>Owner:</strong>{' '}
                          {selected.owner.email || selected.owner.walletAddress}
                        </p>
                        {selected.token && (
                          <p className="text-yellow-400 text-xs">
                            ⚠️ Currently linked to: {selected.token.name} (
                            {selected.token.contractAddress})
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleLinkTokenToListing}
                  disabled={
                    linkingLoading ||
                    !linkTokenAddress ||
                    !ethers.utils.isAddress(linkTokenAddress) ||
                    !selectedListingId
                  }
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {linkingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Link Token to Listing
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleUnlinkToken}
                  disabled={
                    linkingLoading || !linkTokenAddress || !ethers.utils.isAddress(linkTokenAddress)
                  }
                  variant="outline"
                  className="text-red-400 border-red-400/20 hover:bg-red-400/10"
                >
                  {linkingLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-2" />
                      Unlink
                    </>
                  )}
                </Button>
              </div>

              {linkingResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    linkingResult.startsWith('✅')
                      ? 'bg-green-500/10 border-green-400/20 text-green-300'
                      : 'bg-red-500/10 border-red-400/20 text-red-300'
                  }`}
                >
                  {linkingResult}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-400/10">
                <div className="text-center p-2 bg-emerald-500/5 rounded">
                  <p className="text-xs text-emerald-300/60">Total Listings</p>
                  <p className="text-lg font-bold text-emerald-300">{availableListings.length}</p>
                </div>
                <div className="text-center p-2 bg-emerald-500/5 rounded">
                  <p className="text-xs text-emerald-300/60">Already Linked</p>
                  <p className="text-lg font-bold text-emerald-300">
                    {availableListings.filter((l) => l.token !== null).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Created Tokens */}
          {createdTokens.length > 0 && (
            <Card className="bg-black border-purple-400/20">
              <CardHeader>
                <CardTitle className="text-white font-libre-caslon flex items-center">
                  <Coins className="w-5 h-5 mr-2 text-purple-400" />
                  Created Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {createdTokens.map((token) => (
                    <div
                      key={token.address}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedToken === token.address
                          ? 'border-purple-400 bg-purple-400/10'
                          : 'border-purple-400/20 hover:border-purple-400/40 hover:bg-purple-400/5'
                      }`}
                      onClick={() => handleTokenSelect(token.address)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-white">
                            {token.name} ({token.symbol})
                          </h3>
                          <p className="text-sm text-[#DCDDCC] font-mono break-all">
                            {token.address}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-[#DCDDCC]">
                            <strong className="text-purple-400">Your Balance:</strong>{' '}
                            {parseFloat(token.balance).toFixed(4)}
                          </p>
                          <p className="text-[#DCDDCC]">
                            <strong className="text-purple-400">Total Supply:</strong>{' '}
                            {parseFloat(token.totalSupply).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trading Section */}
          {selectedToken && (
            <Card className="bg-black border-purple-400/20">
              <CardHeader>
                <CardTitle className="text-white font-libre-caslon flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-purple-400" />
                  Trade Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-[#DCDDCC]">Amount to Trade</Label>
                  <Input
                    type="text"
                    value={tradeAmount}
                    onChange={(e) => handleTradeAmountChange(e.target.value)}
                    className="bg-black border-purple-400/20 text-white"
                    placeholder="1.0"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Buy Section */}
                  <div className="space-y-4">
                    <Button
                      onClick={getPriceQuote}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled={!tradeAmount || !!loading}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Get Buy Price Quote
                    </Button>
                    {priceQuote !== '0' && (
                      <div className="p-3 bg-green-500/10 border border-green-400/20 rounded">
                        <p className="text-sm text-green-400">
                          <strong>Buy Price:</strong> {priceQuote} ACES
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={buyTokens}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={!tradeAmount || priceQuote === '0' || !!loading}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Buy Tokens
                    </Button>
                  </div>

                  {/* Sell Section */}
                  <div className="space-y-4">
                    <Button
                      onClick={getSellPriceQuote}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                      disabled={!tradeAmount || !!loading}
                    >
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Get Sell Price Quote
                    </Button>
                    {sellPriceQuote !== '0' && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-400/20 rounded">
                        <p className="text-sm text-yellow-400">
                          <strong>Sell Price:</strong> {sellPriceQuote} ACES
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={sellTokens}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      disabled={!tradeAmount || sellPriceQuote === '0' || !!loading}
                    >
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Sell Tokens
                    </Button>
                  </div>
                </div>

                {loading && (
                  <div className="p-4 bg-purple-500/10 border border-purple-400/20 rounded text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <p className="text-purple-400 font-jetbrains">{loading}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
