'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useWalletClient } from 'wagmi';
import { useWagmiEthersSigner } from '@/hooks/use-wagmi-ethers-signer';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abi';
import { mineVanitySaltFixedSupplyWithTimeout } from '@/lib/utils/salt-mining';
import type { SaltMiningResult } from '@/lib/utils/salt-mining';
import { deployFixedSupplyToken } from '@/lib/contracts/fixed-supply-deployment';
import { AdminApi } from '@/lib/api/admin';
import { invalidateListingCache } from '@/hooks/rwa/use-listing-by-symbol';
import {
  SKIP_ADMIN_AUTH,
  type ListingForm,
  type PoolForm,
  type FixedSupplyDeployment,
  type CreateForm,
  type DeployerValidation,
  type ConfigCheckResult,
  type LockerInspectResult,
  type CreatedToken,
  type CreatedListing,
  type UnlinkedToken,
  type SelectedCanvasItem,
  type ChainSwitchFeedback,
  type MiningProgress,
  type PoolPreflight,
  INITIAL_LISTING_FORM,
  INITIAL_POOL_FORM,
  INITIAL_FIXED_SUPPLY_DEPLOYMENT,
  INITIAL_CREATE_FORM,
  INITIAL_DEPLOYER_VALIDATION,
} from '../types';

export function useTokenLaunchState() {
  const {
    isAuthenticated: isAdminAuthenticated,
    isLoading: isAdminLoading,
    logout: adminLogout,
    getAdminAccessToken,
    adminAuthToken,
  } = useAdminAuth();
  const router = useRouter();
  const { walletAddress, getAccessToken } = useAuth();
  const {
    currentChainId,
    switchToChain,
    isSwitching: isChainSwitchPending,
    SUPPORTED_CHAINS,
  } = useChainSwitching();
  const { signer: wagmiSigner, provider: wagmiProvider } = useWagmiEthersSigner();
  const { data: walletClient } = useWalletClient();

  const [createdTokens, setCreatedTokens] = useState<CreatedToken[]>([]);
  const [unlinkedTokensLoadError, setUnlinkedTokensLoadError] = useState<string | null>(null);

  const [listingForm, setListingForm] = useState<ListingForm>(INITIAL_LISTING_FORM);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingResult, setListingResult] = useState<string | null>(null);
  const [syncCanvasLoading, setSyncCanvasLoading] = useState(false);
  const [syncCanvasResult, setSyncCanvasResult] = useState<string | null>(null);
  const [syncUsersLoading, setSyncUsersLoading] = useState(false);
  const [syncUsersResult, setSyncUsersResult] = useState<string | null>(null);
  const [createdListings, setCreatedListings] = useState<CreatedListing[]>([]);

  const [poolForm, setPoolForm] = useState<PoolForm>(INITIAL_POOL_FORM);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolResult, setPoolResult] = useState<string | null>(null);
  const [poolPreflight, setPoolPreflight] = useState<PoolPreflight | null>(null);
  const [poolPreflightLoading, setPoolPreflightLoading] = useState(false);
  const [isManualChainSwitching, setIsManualChainSwitching] = useState(false);

  const [configCheckResult, setConfigCheckResult] = useState<ConfigCheckResult | null>(null);
  const [configCheckLoading, setConfigCheckLoading] = useState(false);
  const [lockerInspectAddress, setLockerInspectAddress] = useState('');
  const [lockerInspectResult, setLockerInspectResult] = useState<LockerInspectResult | null>(null);
  const [lockerInspectLoading, setLockerInspectLoading] = useState(false);
  const [lockerInspectError, setLockerInspectError] = useState<string | null>(null);

  const [selectedCanvasItem, setSelectedCanvasItem] = useState<SelectedCanvasItem | null>(null);
  const [canvasLinkTokenAddress, setCanvasLinkTokenAddress] = useState('');
  const [canvasSetPoolAddressInput, setCanvasSetPoolAddressInput] = useState('');
  const [canvasLinkTokenLoading, setCanvasLinkTokenLoading] = useState(false);
  const [canvasSetPoolAddressLoading, setCanvasSetPoolAddressLoading] = useState(false);
  const [canvasActionResult, setCanvasActionResult] = useState<string | null>(null);

  const [fixedSupplyDeployment, setFixedSupplyDeployment] = useState<FixedSupplyDeployment>(
    INITIAL_FIXED_SUPPLY_DEPLOYMENT,
  );
  const [chainSwitchFeedback, setChainSwitchFeedback] = useState<ChainSwitchFeedback | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>(INITIAL_CREATE_FORM);
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState<MiningProgress>({
    attempts: 0,
    timeElapsed: 0,
    predictedAddress: '',
  });
  const [saltMiningResult, setSaltMiningResult] = useState<SaltMiningResult | null>(null);
  const [loading, setLoading] = useState<string>('');
  const [deployerValidation, setDeployerValidation] = useState<DeployerValidation>(
    INITIAL_DEPLOYER_VALIDATION,
  );
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);

  const contractAddresses = getContractAddresses(currentChainId);
  const fixedSupplyFactory = (contractAddresses as { FIXED_SUPPLY_FACTORY?: string })
    .FIXED_SUPPLY_FACTORY;
  const useFactory =
    !!fixedSupplyFactory && fixedSupplyFactory !== '0x0000000000000000000000000000000000000000';

  const { isWalletConnected, signer: hookSigner } = useAcesFactoryContract({
    chainId: currentChainId,
    externalSigner: wagmiSigner,
    externalProvider: wagmiProvider,
  });

  const effectiveWalletAddress = (walletAddress || walletClient?.account?.address) ?? null;
  const hasEffectiveWallet = isWalletConnected && !!effectiveWalletAddress;
  const isOnBaseMainnet = currentChainId === SUPPORTED_CHAINS.BASE_MAINNET.id;
  const isOnBaseSepolia = currentChainId === SUPPORTED_CHAINS.BASE_SEPOLIA.id;

  useEffect(() => {
    if (contractAddresses.ACES_TOKEN && !poolForm.platformTokenAddress) {
      setPoolForm((p) => ({ ...p, platformTokenAddress: contractAddresses.ACES_TOKEN }));
    }
  }, [contractAddresses.ACES_TOKEN, poolForm.platformTokenAddress]);

  // Preflight: balances and allowances for pool launch (so user sees issues before clicking Launch)
  useEffect(() => {
    const tokenA = poolForm.tokenAddress?.trim();
    const tokenB = (poolForm.platformTokenAddress?.trim() || contractAddresses.ACES_TOKEN)?.trim();
    const amountAStr = poolForm.tokenAmount?.trim();
    const amountBStr = poolForm.platformTokenAmount?.trim();
    if (!tokenA || !tokenB || !amountAStr || !amountBStr || !wagmiSigner) {
      setPoolPreflight(null);
      return;
    }
    let amountA: ethers.BigNumber;
    let amountB: ethers.BigNumber;
    try {
      amountA = ethers.utils.parseEther(amountAStr);
      amountB = ethers.utils.parseEther(amountBStr);
    } catch {
      setPoolPreflight(null);
      return;
    }
    if (amountA.isZero() || amountB.isZero()) {
      setPoolPreflight(null);
      return;
    }
    const addresses = getContractAddresses(currentChainId);
    const launcherAddress = addresses.AERODROME_CL_POOL_LAUNCHER;
    if (!launcherAddress || launcherAddress === '0x0000000000000000000000000000000000000000') {
      setPoolPreflight(null);
      return;
    }
    const erc20Abi = [
      'function balanceOf(address account) external view returns (uint256)',
      'function allowance(address owner, address spender) external view returns (uint256)',
    ];
    setPoolPreflightLoading(true);
    const tokenAContract = new ethers.Contract(tokenA, erc20Abi, wagmiSigner);
    const tokenBContract = new ethers.Contract(tokenB, erc20Abi, wagmiSigner);
    wagmiSigner
      .getAddress()
      .then((userAddress) =>
        Promise.all([
          tokenAContract.balanceOf(userAddress),
          tokenBContract.balanceOf(userAddress),
          tokenAContract.allowance(userAddress, launcherAddress),
          tokenBContract.allowance(userAddress, launcherAddress),
        ]),
      )
      .then(([balanceA, balanceB, allowanceA, allowanceB]) => {
        const balanceOk = balanceA.gte(amountA) && balanceB.gte(amountB);
        const allowanceOk = allowanceA.gte(amountA) && allowanceB.gte(amountB);
        const messages: string[] = [];
        if (!balanceA.gte(amountA))
          messages.push(
            `Token A: insufficient balance (have ${ethers.utils.formatEther(balanceA)}, need ${ethers.utils.formatEther(amountA)})`,
          );
        if (!balanceB.gte(amountB))
          messages.push(
            `Token B: insufficient balance (have ${ethers.utils.formatEther(balanceB)}, need ${ethers.utils.formatEther(amountB)})`,
          );
        if (!allowanceA.gte(amountA))
          messages.push(
            `Token A: launcher not approved (allowance ${ethers.utils.formatEther(allowanceA)}). We will request approval when you launch.`,
          );
        if (!allowanceB.gte(amountB))
          messages.push(
            `Token B: launcher not approved (allowance ${ethers.utils.formatEther(allowanceB)}). We will request approval when you launch.`,
          );
        setPoolPreflight({
          tokenA,
          tokenB,
          amountA: amountA.toString(),
          amountB: amountB.toString(),
          balanceA: balanceA.toString(),
          balanceB: balanceB.toString(),
          allowanceA: allowanceA.toString(),
          allowanceB: allowanceB.toString(),
          balanceOk,
          allowanceOk,
          messages,
        });
      })
      .catch(() => setPoolPreflight(null))
      .finally(() => setPoolPreflightLoading(false));
  }, [
    poolForm.tokenAddress,
    poolForm.platformTokenAddress,
    poolForm.tokenAmount,
    poolForm.platformTokenAmount,
    contractAddresses.ACES_TOKEN,
    currentChainId,
    wagmiSigner,
  ]);

  useEffect(() => {
    const create2DeployerAddress = (contractAddresses as { CREATE2_DEPLOYER?: string })
      .CREATE2_DEPLOYER;
    if (
      create2DeployerAddress &&
      create2DeployerAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      setFixedSupplyDeployment((prev) => ({
        ...prev,
        create2DeployerAddress: create2DeployerAddress,
      }));
    }
    setDeployerValidation(INITIAL_DEPLOYER_VALIDATION);
  }, [contractAddresses, currentChainId]);

  const validateDeployerContract = useCallback(
    async (address: string) => {
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        setDeployerValidation({
          isValid: false,
          message: 'Invalid address format',
          isChecking: false,
        });
        return;
      }
      if (!wagmiProvider || !currentChainId) {
        setDeployerValidation({
          isValid: null,
          message: 'Wallet not connected',
          isChecking: false,
        });
        return;
      }
      setDeployerValidation({ isValid: null, message: 'Checking...', isChecking: true });
      try {
        const code = await wagmiProvider.getCode(address);
        const network = await wagmiProvider.getNetwork();
        if (!code || code === '0x') {
          const networkName = network.name || `Chain ID ${network.chainId}`;
          let message = `CREATE2Deployer contract not found at ${address} on ${networkName}.\n\n`;
          if (isOnBaseMainnet) {
            message += `⚠️ You're on Base Mainnet, but CREATE2Deployer is only deployed on Base Sepolia testnet.\n\nTo fix this:\n1. Switch to Base Sepolia (Chain ID: 84532) using the button below, OR\n2. Deploy CREATE2Deployer to Base Mainnet first (see deployment docs)`;
          } else if (isOnBaseSepolia) {
            message += `⚠️ CREATE2Deployer not found on Base Sepolia.\n\nPlease deploy CREATE2Deployer.sol to Base Sepolia first.`;
          } else {
            message += `⚠️ CREATE2Deployer not found on this network.\n\nPlease deploy CREATE2Deployer.sol to ${networkName} first.`;
          }
          setDeployerValidation({ isValid: false, message, isChecking: false });
        } else {
          setDeployerValidation({
            isValid: true,
            message: `✅ CREATE2Deployer verified on ${network.name || `Chain ID ${network.chainId}`}`,
            isChecking: false,
          });
        }
      } catch (error) {
        setDeployerValidation({
          isValid: false,
          message: `Error checking contract: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isChecking: false,
        });
      }
    },
    [wagmiProvider, currentChainId, isOnBaseMainnet, isOnBaseSepolia],
  );

  useEffect(() => {
    if (fixedSupplyDeployment.create2DeployerAddress && wagmiProvider && currentChainId) {
      const timeoutId = setTimeout(() => {
        validateDeployerContract(fixedSupplyDeployment.create2DeployerAddress);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setDeployerValidation(INITIAL_DEPLOYER_VALIDATION);
    }
  }, [
    fixedSupplyDeployment.create2DeployerAddress,
    currentChainId,
    wagmiProvider,
    validateDeployerContract,
  ]);

  const mountedAtRef = React.useRef<number>(Date.now());
  useEffect(() => {
    if (SKIP_ADMIN_AUTH) return;
    const graceMs = 5000;
    const elapsed = Date.now() - mountedAtRef.current;
    if (elapsed < graceMs) return;
    if (!isAdminLoading && !isAdminAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, isAdminLoading, router]);

  useEffect(() => {
    if (!hasEffectiveWallet) {
      setAcesContract(null);
      setAcesBalance('0');
      setIsMining(false);
      setSaltMiningResult(null);
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      setLoading('');
    }
  }, [hasEffectiveWallet]);

  useEffect(() => {
    async function initializeContracts() {
      if (!effectiveWalletAddress || !isWalletConnected || !hookSigner) return;
      try {
        const aces = new ethers.Contract(contractAddresses.ACES_TOKEN, ERC20_ABI, hookSigner);
        setAcesContract(aces);
        try {
          const balance = await aces.balanceOf(effectiveWalletAddress);
          setAcesBalance(ethers.utils.formatEther(balance));
        } catch {
          setAcesBalance('0');
        }
      } catch {
        setAcesContract(null);
        setAcesBalance('0');
      }
    }
    initializeContracts();
  }, [hookSigner, effectiveWalletAddress, contractAddresses, isWalletConnected]);

  const handleBeginSaltMine = async () => {
    if (!effectiveWalletAddress) {
      alert('Wallet address not found. Please reconnect your wallet.');
      return;
    }
    if (!wagmiSigner) {
      alert('Wallet signer not available. Please make sure your wallet is connected and unlocked.');
      return;
    }
    const deployerForMiningCheck = useFactory
      ? fixedSupplyFactory
      : fixedSupplyDeployment.create2DeployerAddress;
    if (!deployerForMiningCheck) {
      alert(
        'CREATE2Deployer or FixedSupplyERC20Factory address is required. Use the deployer field or set NEXT_PUBLIC_FIXED_SUPPLY_FACTORY_*.',
      );
      return;
    }
    if (!fixedSupplyDeployment.contractBytecode) {
      alert(
        'Contract bytecode is required for address prediction. Click "Load default bytecode" or paste it.',
      );
      return;
    }
    try {
      setIsMining(true);
      setLoading('Mining vanity address...');
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      setSaltMiningResult(null);
      const result = await mineVanitySaltFixedSupplyWithTimeout(
        effectiveWalletAddress,
        createForm.name,
        createForm.symbol,
        effectiveWalletAddress,
        deployerForMiningCheck,
        fixedSupplyDeployment.contractBytecode,
        {
          targetSuffix: 'ACE',
          maxAttempts: 200000,
          onProgress: (attempts, timeElapsed) => {
            setMiningProgress({ attempts, timeElapsed, predictedAddress: '' });
            setLoading(
              `Mining address... ${attempts} attempts, ${(timeElapsed / 1000).toFixed(1)}s`,
            );
          },
        },
        300000,
      );
      setCreateForm((prev) => ({ ...prev, salt: result.salt }));
      setSaltMiningResult(result);
      alert(
        `🎯 Vanity address found!\n\nPredicted Address: ${result.predictedAddress}\nAttempts: ${result.attempts.toLocaleString()}\nTime: ${(result.timeElapsed / 1000).toFixed(1)}s\nSalt: ${result.salt}\n\nSalt has been added to the form. You can now click "Create Token"!`,
      );
    } catch (error) {
      alert(
        `Salt mining failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      );
    } finally {
      setIsMining(false);
      setLoading('');
    }
  };

  const handleCreateToken = async () => {
    if (!effectiveWalletAddress || !wagmiSigner) {
      alert('Wallet address or signer not found. Please reconnect your wallet.');
      return;
    }
    if (!createForm.salt.trim()) {
      alert(
        'Please provide a salt value for token creation. You can enter one manually or use "Begin Salt Mine" to generate a vanity address.',
      );
      return;
    }
    const hasDeployer = !!(
      fixedSupplyDeployment.create2DeployerAddress ||
      (useFactory && fixedSupplyFactory)
    );
    if (!hasDeployer || !fixedSupplyDeployment.contractBytecode) {
      alert('CREATE2Deployer or FixedSupplyERC20Factory and contract bytecode are required.');
      return;
    }
    try {
      setLoading('Creating fixed supply token...');
      setFixedSupplyDeployment((prev) => ({ ...prev, isDeploying: true }));
      const result = await deployFixedSupplyToken(
        wagmiSigner,
        {
          name: createForm.name,
          symbol: createForm.symbol,
          salt: createForm.salt,
          creator: effectiveWalletAddress,
        },
        fixedSupplyDeployment.contractBytecode,
        fixedSupplyDeployment.create2DeployerAddress,
        fixedSupplyFactory || undefined,
      );
      if (result.success && result.tokenAddress) {
        let verifiedData: {
          name: string;
          symbol: string;
          totalSupply: string;
          creatorBalance: string;
          decimals: string;
        } | null = null;
        let verificationSuccess = false;
        let dbSaveSuccess = false;
        try {
          const { FIXED_SUPPLY_ERC20_ABI } = await import(
            '@/lib/contracts/abi/fixed-supply-erc20-abi'
          );
          const tokenContract = new ethers.Contract(
            result.tokenAddress,
            FIXED_SUPPLY_ERC20_ABI,
            wagmiSigner,
          );
          const [onChainName, onChainSymbol, totalSupply, creatorBalance, decimals] =
            await Promise.all([
              tokenContract.name(),
              tokenContract.symbol(),
              tokenContract.totalSupply(),
              tokenContract.balanceOf(effectiveWalletAddress),
              tokenContract.decimals(),
            ]);
          const expectedSupply = ethers.utils.parseEther('1000000000');
          const isMintedCorrectly =
            totalSupply.eq(expectedSupply) &&
            creatorBalance.eq(totalSupply) &&
            onChainName === createForm.name &&
            onChainSymbol === createForm.symbol;
          verifiedData = {
            name: onChainName,
            symbol: onChainSymbol,
            totalSupply: totalSupply.toString(),
            creatorBalance: creatorBalance.toString(),
            decimals: decimals.toString(),
          };
          if (isMintedCorrectly) {
            verificationSuccess = true;
          } else {
            alert(
              `⚠️ Token deployed but minting verification failed!\n\nTotal Supply: ${ethers.utils.formatEther(totalSupply)} (expected: 1,000,000,000)\nCreator Balance: ${ethers.utils.formatEther(creatorBalance)}\nName: ${onChainName}\nSymbol: ${onChainSymbol}\n\nAttempting to save to database so it appears in the platform.`,
            );
          }
          // Always try to save to DB (and thus Convex) when we have on-chain data, so the token
          // is not lost even if verification flags a mismatch.
          try {
            const token = await getAccessToken();
            if (token) {
              const dbResult = await AdminApi.createTokenInDatabase(
                {
                  contractAddress: result.tokenAddress,
                  symbol: onChainSymbol,
                  name: onChainName,
                  chainId: currentChainId,
                  totalSupply: totalSupply.toString(),
                  decimals: decimals.toString(),
                  isFixedSupply: true,
                },
                token,
              );
              if (dbResult.success) {
                dbSaveSuccess = true;
              } else {
                throw new Error(dbResult.message || 'Database save failed');
              }
            } else {
              throw new Error('Authentication token not available');
            }
          } catch (dbError) {
            alert(
              `Token deployed but failed to save to database.\n\nToken Address: ${result.tokenAddress}\nError: ${dbError instanceof Error ? dbError.message : 'Unknown error'}\n\nPlease save this token manually.`,
            );
          }
        } catch (verifyError) {
          alert(
            `Token deployed but verification failed (RPC may still be indexing).\n\nToken Address: ${result.tokenAddress}\nError: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}\n\nAttempting to save to database using form data.`,
          );
          // Save to DB using form data when on-chain read failed (e.g. RPC lag after factory deploy)
          try {
            const token = await getAccessToken();
            if (token) {
              const dbResult = await AdminApi.createTokenInDatabase(
                {
                  contractAddress: result.tokenAddress,
                  symbol: createForm.symbol,
                  name: createForm.name,
                  chainId: currentChainId,
                  totalSupply: '1000000000000000000000000000', // 1e27 wei = 1B tokens
                  decimals: '18',
                  isFixedSupply: true,
                },
                token,
              );
              if (dbResult.success) dbSaveSuccess = true;
            }
          } catch (dbErr) {
            console.error('DB save after verification failure:', dbErr);
          }
        }
        const newToken: CreatedToken = {
          address: result.tokenAddress,
          name: verifiedData?.name || createForm.name,
          symbol: verifiedData?.symbol || createForm.symbol,
        };
        setCreatedTokens((prev) => [...prev, newToken]);
        if (dbSaveSuccess) {
          fetchUnlinkedTokens();
        }
        let verifiedInfo = '';
        if (verificationSuccess && verifiedData) {
          verifiedInfo = `\n✅ Verified On-Chain:\nTotal Supply: ${ethers.utils.formatEther(verifiedData.totalSupply)} tokens\nCreator Balance: ${ethers.utils.formatEther(verifiedData.creatorBalance)} tokens\nDecimals: ${verifiedData.decimals}\n`;
        }
        const dbStatus = dbSaveSuccess
          ? '✅ Token has been saved to database.'
          : '⚠️ Token NOT saved to database.';
        alert(
          `✅ Token created${verificationSuccess ? ' and verified' : ''} successfully!\n\nAddress: ${result.tokenAddress}\n${verifiedInfo}\n${dbStatus} You can now create a listing.`,
        );
        setCreateForm(INITIAL_CREATE_FORM);
        setSaltMiningResult(null);
        setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      } else {
        alert(`Token creation failed: ${result.error || 'Unknown error'}`);
      }
      setLoading('');
    } catch (error) {
      setLoading('');
      alert(
        `Token creation failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      );
    } finally {
      setFixedSupplyDeployment((prev) => ({ ...prev, isDeploying: false }));
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
      setChainSwitchFeedback({ type: 'success', message: `Switched to ${targetChain.name}.` });
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

  const handleCreateListing = async () => {
    if (!listingForm.title || !listingForm.symbol || !listingForm.assetType) {
      alert('Please fill in required fields: title, symbol, and asset type');
      return;
    }
    try {
      setListingLoading(true);
      setListingResult(null);
      const token = await getAdminAccessToken();
      if (!token) {
        setListingResult('❌ Error: Admin session expired. Please log in again.');
        setListingLoading(false);
        return;
      }
      const result = await AdminApi.createListing(
        {
          title: listingForm.title,
          symbol: listingForm.symbol,
          assetType: listingForm.assetType,
          brand: listingForm.brand || null,
          story: listingForm.story || null,
          details: listingForm.details || null,
          provenance: listingForm.provenance || null,
          value: listingForm.value || null,
          reservePrice: listingForm.reservePrice || null,
          hypeSentence: listingForm.hypeSentence || null,
          imageGallery: listingForm.imageGallery,
          location: listingForm.location || null,
          assetDetails:
            Object.keys(listingForm.assetDetails).length > 0 ? listingForm.assetDetails : null,
          hypePoints: listingForm.hypePoints.filter(Boolean),
          startingBidPrice: listingForm.startingBidPrice || null,
          launchDate: listingForm.launchDate || null,
          tokenId: listingForm.tokenId || null,
          showOnCanvas: listingForm.showOnCanvas,
          isFeatured: listingForm.isFeatured,
          showOnDrops: listingForm.showOnDrops,
        },
        token,
      );
      if (result.success && result.data) {
        setListingResult(`✅ ${result.message}`);
        setCreatedListings((prev) => [
          ...prev,
          {
            id: result.data.id,
            title: result.data.title,
            symbol: result.data.symbol,
            isLive: result.data.isLive,
            tokenId: listingForm.tokenId || null,
          },
        ]);
        setListingForm(INITIAL_LISTING_FORM);
      } else {
        setListingResult(`❌ Error: ${result.message || 'Failed to create listing'}`);
      }
    } catch (error) {
      setListingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setListingLoading(false);
    }
  };

  const handleSyncCanvas = async () => {
    try {
      setSyncCanvasLoading(true);
      setSyncCanvasResult(null);
      const token = await getAdminAccessToken();
      if (!token) {
        setSyncCanvasResult('❌ Admin session expired. Please log in again.');
        return;
      }
      const result = await AdminApi.syncCanvas(token);
      if (result.success) {
        const parts = [result.message ?? 'Canvas synced.'];
        if (result.synced != null) parts.push(`${result.synced} synced`);
        if (result.removed != null && result.removed > 0)
          parts.push(`${result.removed} removed (no image)`);
        setSyncCanvasResult(`✅ ${parts.join('; ')}`);
      } else {
        setSyncCanvasResult(`❌ ${result.error ?? 'Sync failed'}`);
      }
    } catch (error) {
      setSyncCanvasResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncCanvasLoading(false);
    }
  };

  const handleSyncUsersToConvex = async () => {
    try {
      setSyncUsersLoading(true);
      setSyncUsersResult(null);
      const token = await getAdminAccessToken();
      if (!token) {
        setSyncUsersResult('❌ Admin session expired. Please log in again.');
        return;
      }
      const result = await AdminApi.syncUsersToConvex(token);
      if (result.success) {
        const parts = [result.message ?? 'Users synced to Convex.'];
        if (result.synced != null) parts.push(`${result.synced} synced`);
        if (result.failed != null && result.failed > 0) parts.push(`${result.failed} failed`);
        setSyncUsersResult(`✅ ${parts.join('; ')}`);
      } else {
        setSyncUsersResult(`❌ ${result.error ?? 'Sync failed'}`);
      }
    } catch (error) {
      setSyncUsersResult(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncUsersLoading(false);
    }
  };

  const handleCreatePool = async () => {
    const tokenA = poolForm.tokenAddress?.trim();
    const tokenB = (poolForm.platformTokenAddress?.trim() || contractAddresses.ACES_TOKEN)?.trim();
    if (!tokenA || !tokenB) {
      alert('Please enter both token addresses');
      return;
    }
    if (!poolForm.tokenAmount || !poolForm.platformTokenAmount) {
      alert('Please enter liquidity amounts for both tokens');
      return;
    }
    if (!wagmiSigner) {
      alert('Wallet signer not available');
      return;
    }
    try {
      setPoolLoading(true);
      setPoolResult(null);
      const { launchCLPool, encodeSqrtPriceX96, getCLPoolAddress } = await import(
        '@/lib/contracts/aerodrome-locker'
      );
      const addresses = getContractAddresses(currentChainId);
      const launcherAddress = addresses.AERODROME_CL_POOL_LAUNCHER;
      if (!launcherAddress || launcherAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(
          'CLPoolLauncher address not configured for this network. Set NEXT_PUBLIC_AERODROME_CL_POOL_LAUNCHER_*.',
        );
      }
      // Default to 2% fee tier (tick spacing 500) for Base mainnet launches.
      const parsedTickSpacing = Number.parseInt(poolForm.tickSpacing, 10);
      const tickSpacingNum =
        Number.isFinite(parsedTickSpacing) && parsedTickSpacing > 0 ? parsedTickSpacing : 500;
      setLoading('Checking if pool already exists...');
      const existingPool = await getCLPoolAddress(tokenA, tokenB, tickSpacingNum, currentChainId);
      if (existingPool && existingPool !== ethers.constants.AddressZero) {
        throw new Error(
          `Pool already exists for this token pair and tick spacing. Address: ${existingPool}. Launch would revert with PoolAlreadyExists.`,
        );
      }
      const amountA = ethers.utils.parseEther(poolForm.tokenAmount.trim());
      const amountB = ethers.utils.parseEther(poolForm.platformTokenAmount.trim());
      const erc20Abi = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function balanceOf(address account) external view returns (uint256)',
      ];
      const tokenAContract = new ethers.Contract(tokenA, erc20Abi, wagmiSigner);
      const tokenBContract = new ethers.Contract(tokenB, erc20Abi, wagmiSigner);
      const userAddress = await wagmiSigner.getAddress();
      setLoading('Checking balances and allowances...');
      const [balanceA, balanceB, allowanceA, allowanceB] = await Promise.all([
        tokenAContract.balanceOf(userAddress),
        tokenBContract.balanceOf(userAddress),
        tokenAContract.allowance(userAddress, launcherAddress),
        tokenBContract.allowance(userAddress, launcherAddress),
      ]);
      if (balanceA.lt(amountA)) {
        throw new Error(
          `Insufficient Token A balance. You have ${ethers.utils.formatEther(balanceA)}, need ${ethers.utils.formatEther(amountA)}. Add more tokens to your wallet before launching.`,
        );
      }
      if (balanceB.lt(amountB)) {
        throw new Error(
          `Insufficient Token B balance. You have ${ethers.utils.formatEther(balanceB)}, need ${ethers.utils.formatEther(amountB)}. Add more tokens to your wallet before launching.`,
        );
      }
      const approveAmount = ethers.constants.MaxUint256;
      const needsApprovalA = allowanceA.lt(amountA);
      const needsApprovalB = allowanceB.lt(amountB);
      if (needsApprovalA || needsApprovalB) {
        setLoading('Approving tokens for launcher (required for launch)...');
        const approvals: Promise<unknown>[] = [];
        if (needsApprovalA) approvals.push(tokenAContract.approve(launcherAddress, approveAmount));
        if (needsApprovalB) approvals.push(tokenBContract.approve(launcherAddress, approveAmount));
        await Promise.all(approvals);
      }
      setLoading('Launching CL pool (create pool + add liquidity + lock)...');
      // Hardcoded: 60-day lock
      const lockDurationSeconds = 60 * 24 * 60 * 60;
      const poolLauncherIsToken0 = tokenA.toLowerCase() < tokenB.toLowerCase();
      const amountToken0 = poolLauncherIsToken0 ? amountA : amountB;
      const amountToken1 = poolLauncherIsToken0 ? amountB : amountA;
      const sqrtPriceX96 = encodeSqrtPriceX96(amountToken0, amountToken1);
      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      const tickLower = Math.ceil(MIN_TICK / tickSpacingNum) * tickSpacingNum;
      const tickUpper = Math.floor(MAX_TICK / tickSpacingNum) * tickSpacingNum;
      const recipient = await wagmiSigner.getAddress();
      const launchOptions = poolForm.skipSimulation
        ? {
            skipSimulation: true,
            gasLimit: 2200000,
            nonce: await wagmiSigner.getTransactionCount('pending'),
            maxFeePerGas: ethers.utils.parseUnits('1', 'gwei'),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.5', 'gwei'),
          }
        : undefined;
      // Note: poolForm.beneficiary and beneficiaryShare are not passed to the contract. The
      // deployed Aerodrome CLPoolLauncher calls LockerFactory.lock(..., address(0), 0, 10_000, ...)
      // and has no parameters for beneficiary. The Locker has no setBeneficiary() after creation.
      const result = await launchCLPool(
        wagmiSigner,
        {
          poolLauncherToken: tokenA,
          tokenToPair: tokenB,
          tickSpacing: tickSpacingNum,
          liquidity: {
            amountPoolLauncherToken: amountA.toString(),
            amountTokenToPair: amountB.toString(),
            amountPoolLauncherTokenMin: '0',
            amountTokenToPairMin: '0',
            initialSqrtPriceX96: sqrtPriceX96.toString(),
            tickLower,
            tickUpper,
            lockDuration: lockDurationSeconds,
          },
        },
        recipient,
        currentChainId,
        launchOptions,
      );
      let poolSavedToDb = false;
      try {
        const token = await getAdminAccessToken();
        if (token && tokenA) {
          await AdminApi.updateTokenPoolAddress(tokenA, result.poolAddress, token);
          poolSavedToDb = true;
        }
      } catch (e) {
        console.warn('Could not update token pool address in app:', e);
      }
      setPoolResult(
        `✅ Pool launched. Pool: ${result.poolAddress}${result.lockerAddress ? ` | Locker: ${result.lockerAddress}` : ''}${!poolSavedToDb && tokenA ? ' (pool address not saved to app – sign in as admin to update)' : ''}`,
      );
      if (poolSavedToDb && tokenA) {
        const tokenSymbol = createdTokens.find(
          (t) => t.address?.toLowerCase() === tokenA.toLowerCase(),
        )?.symbol;
        if (tokenSymbol) invalidateListingCache(tokenSymbol);
      }
      setLoading('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const suggestSkip = msg.includes('RPC did not return') || msg.includes('revert reason');
      setPoolResult(
        `❌ Error: ${msg}${suggestSkip ? ' Try checking "Skip simulation" and launch again to send the tx and inspect on Basescan.' : ''}`,
      );
      setLoading('');
    } finally {
      setPoolLoading(false);
    }
  };

  const handleVerifyAerodromeContracts = async () => {
    if (!wagmiProvider || !currentChainId) {
      alert('Wallet not connected');
      return;
    }
    setConfigCheckLoading(true);
    setConfigCheckResult(null);
    try {
      const { verifyAerodromeContracts } = await import('@/lib/contracts/aerodrome-locker');
      const result = await verifyAerodromeContracts(wagmiProvider, currentChainId);
      setConfigCheckResult(result);
    } catch (e) {
      setConfigCheckResult(null);
      alert(`Check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setConfigCheckLoading(false);
    }
  };

  const handleInspectLocker = async () => {
    const addr = lockerInspectAddress.trim();
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      setLockerInspectError('Enter a valid locker address (0x...)');
      return;
    }
    if (!wagmiProvider) {
      setLockerInspectError('Wallet not connected');
      return;
    }
    setLockerInspectLoading(true);
    setLockerInspectResult(null);
    setLockerInspectError(null);
    try {
      const { inspectLocker } = await import('@/lib/contracts/aerodrome-locker');
      const result = await inspectLocker(wagmiProvider, addr);
      setLockerInspectResult(result);
    } catch (e) {
      setLockerInspectResult(null);
      setLockerInspectError(e instanceof Error ? e.message : 'Failed to read locker');
    } finally {
      setLockerInspectLoading(false);
    }
  };

  const handleToggleListingLive = async (listingId: string, currentStatus: boolean) => {
    if (currentStatus === false) {
      const confirmed = confirm(
        'Are you sure you want to make this listing live? Users will be able to start trading once it goes live.',
      );
      if (!confirmed) return;
    }
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        alert('❌ Error: Admin session expired. Please log in again.');
        return;
      }
      const result = await AdminApi.toggleListingLive(listingId, !currentStatus, token);
      if (result.success) {
        setCreatedListings((prev) =>
          prev.map((listing) =>
            listing.id === listingId ? { ...listing, isLive: !currentStatus } : listing,
          ),
        );
        alert(`✅ Listing ${!currentStatus ? 'is now live' : 'is no longer live'}`);
      } else {
        alert(`❌ Error: ${result.message || 'Failed to toggle listing status'}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const refetchListings = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    try {
      const token = await getAdminAccessToken();
      if (!token) return;
      const result = await AdminApi.getAvailableListings(token);
      if (result.success) {
        setCreatedListings(
          result.data.map((listing) => ({
            id: listing.id,
            title: listing.title,
            symbol: listing.symbol,
            isLive: listing.isLive,
            tokenId: listing.token?.contractAddress ?? null,
          })),
        );
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    }
  }, [isAdminAuthenticated, getAdminAccessToken]);

  useEffect(() => {
    refetchListings();
  }, [refetchListings]);

  const convexUnlinkedTokens = useQuery(api.tokens.listUnlinked);
  const unlinkedTokens: UnlinkedToken[] = (convexUnlinkedTokens ?? []).map((t) => ({
    address: t.contractAddress,
    name: t.name,
    symbol: t.symbol,
  }));
  const unlinkedTokensLoading = convexUnlinkedTokens === undefined;
  const fetchUnlinkedTokens = useCallback(() => {
    // Tokens are loaded reactively from Convex; no-op for compatibility with Refresh buttons
  }, []);

  const convexCanvasItems = useQuery(api.canvasItems.listForCanvas);
  const canvasItemsWithListingId =
    convexCanvasItems?.filter(
      (item): item is typeof item & { listingId: string } => !!item.listingId,
    ) ?? [];

  const handleCanvasLinkToken = useCallback(async () => {
    if (!selectedCanvasItem?.listingId || !canvasLinkTokenAddress?.trim()) {
      setCanvasActionResult('Select a canvas item and an unlinked token.');
      return;
    }
    setCanvasLinkTokenLoading(true);
    setCanvasActionResult(null);
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        setCanvasActionResult('Admin auth required.');
        return;
      }
      const result = await AdminApi.linkTokenToListing(
        canvasLinkTokenAddress.trim(),
        selectedCanvasItem.listingId,
        token,
      );
      if (result.success) {
        setCanvasActionResult('Token linked to listing. Refreshing...');
        await refetchListings();
        await fetchUnlinkedTokens();
        setCanvasLinkTokenAddress('');
        setCanvasActionResult(
          'Token linked. You can now use it in Launch Pool or set pool address.',
        );
      } else {
        setCanvasActionResult(result.message || 'Link failed.');
      }
    } catch (error) {
      setCanvasActionResult(error instanceof Error ? error.message : 'Link failed.');
    } finally {
      setCanvasLinkTokenLoading(false);
    }
  }, [
    selectedCanvasItem,
    canvasLinkTokenAddress,
    getAdminAccessToken,
    refetchListings,
    fetchUnlinkedTokens,
  ]);

  const handleUseTokenInLaunchPool = useCallback(() => {
    const listing = createdListings.find((l) => l.id === selectedCanvasItem?.listingId);
    const tokenAddress = listing?.tokenId;
    if (!tokenAddress) return;
    setPoolForm((p) => ({ ...p, tokenAddress }));
    setCanvasActionResult(
      'Token A pre-filled. Complete the Launch Pool form below and click Launch Pool.',
    );
  }, [selectedCanvasItem, createdListings]);

  const handleCanvasSetPoolAddress = useCallback(async () => {
    const listing = createdListings.find((l) => l.id === selectedCanvasItem?.listingId);
    const tokenAddress = listing?.tokenId;
    const poolAddress = canvasSetPoolAddressInput?.trim();
    if (!selectedCanvasItem?.listingId || !tokenAddress || !poolAddress) {
      setCanvasActionResult('Select a canvas item with a linked token and enter a pool address.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
      setCanvasActionResult('Invalid pool address (must be 0x + 40 hex chars).');
      return;
    }
    setCanvasSetPoolAddressLoading(true);
    setCanvasActionResult(null);
    try {
      const token = await getAdminAccessToken();
      if (!token) {
        setCanvasActionResult('Admin auth required.');
        return;
      }
      await AdminApi.updateTokenPoolAddress(tokenAddress, poolAddress, token);
      invalidateListingCache(selectedCanvasItem.symbol);
      setCanvasSetPoolAddressInput('');
      setCanvasActionResult(
        `Pool address saved. /rwa/${selectedCanvasItem.symbol} will show chart and swap.`,
      );
    } catch (error) {
      setCanvasActionResult(
        error instanceof Error ? error.message : 'Failed to update pool address.',
      );
    } finally {
      setCanvasSetPoolAddressLoading(false);
    }
  }, [selectedCanvasItem, createdListings, canvasSetPoolAddressInput, getAdminAccessToken]);

  const handleLogout = async () => {
    await adminLogout();
    router.push('/admin/login');
  };

  useEffect(() => {
    if (SKIP_ADMIN_AUTH || !isAdminLoading) return;
    const start = Date.now();
    const t = setInterval(() => setLoadingElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isAdminLoading]);

  return {
    isAdminAuthenticated,
    isAdminLoading,
    adminLogout,
    getAdminAccessToken,
    adminAuthToken,
    router,
    effectiveWalletAddress,
    hasEffectiveWallet,
    currentChainId,
    switchToChain,
    SUPPORTED_CHAINS,
    isOnBaseMainnet,
    isOnBaseSepolia,
    wagmiSigner,
    wagmiProvider,
    walletClient,
    contractAddresses,
    fixedSupplyFactory,
    useFactory,
    createdTokens,
    setCreatedTokens,
    unlinkedTokens,
    unlinkedTokensLoading,
    unlinkedTokensLoadError,
    fetchUnlinkedTokens,
    listingForm,
    setListingForm,
    listingLoading,
    listingResult,
    syncCanvasLoading,
    syncCanvasResult,
    syncUsersLoading,
    syncUsersResult,
    createdListings,
    setCreatedListings,
    refetchListings,
    poolForm,
    setPoolForm,
    poolLoading,
    poolResult,
    poolPreflight,
    poolPreflightLoading,
    isManualChainSwitching,
    chainSwitchFeedback,
    setChainSwitchFeedback,
    configCheckResult,
    configCheckLoading,
    lockerInspectAddress,
    setLockerInspectAddress,
    lockerInspectResult,
    setLockerInspectResult,
    lockerInspectError,
    setLockerInspectError,
    lockerInspectLoading,
    selectedCanvasItem,
    setSelectedCanvasItem,
    canvasLinkTokenAddress,
    setCanvasLinkTokenAddress,
    canvasSetPoolAddressInput,
    setCanvasSetPoolAddressInput,
    canvasLinkTokenLoading,
    canvasSetPoolAddressLoading,
    canvasActionResult,
    setCanvasActionResult,
    convexCanvasItems,
    canvasItemsWithListingId,
    fixedSupplyDeployment,
    setFixedSupplyDeployment,
    createForm,
    setCreateForm,
    isMining,
    miningProgress,
    saltMiningResult,
    loading,
    deployerValidation,
    loadingElapsed,
    acesBalance,
    acesContract,
    handleBeginSaltMine,
    handleCreateToken,
    handleManualChainSwitch,
    handleCreateListing,
    handleSyncCanvas,
    handleSyncUsersToConvex,
    handleCreatePool,
    handleVerifyAerodromeContracts,
    handleInspectLocker,
    handleToggleListingLive,
    handleCanvasLinkToken,
    handleUseTokenInLaunchPool,
    handleCanvasSetPoolAddress,
    handleLogout,
  };
}
