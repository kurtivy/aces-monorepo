'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ERC20_ABI, LAUNCHPAD_TOKEN_ABI, ACES_FACTORY_ABI } from '@/lib/contracts/abi';
import { useAcesFactoryContract } from '@/hooks/contracts/use-aces-factory-contract';
import {
  type SaltMiningResult,
  mineVanitySaltWithTimeout,
  mineVanitySaltFixedSupplyWithTimeout,
} from '@/lib/utils/salt-mining';
import {
  deployFixedSupplyToken,
  predictFixedSupplyTokenAddress,
  type DeployFixedSupplyTokenParams,
} from '@/lib/contracts/fixed-supply-deployment';
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
  RefreshCw,
  Loader2,
  Pickaxe,
  CheckCircle,
  AlertCircle,
  Network,
  DollarSign,
  Globe2,
  ArrowRightLeft,
  LogOut,
  FileText,
  Lock,
  ToggleLeft,
  ToggleRight,
  Factory,
  Settings,
  ImagePlus,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageLoader from '@/components/loading/page-loader';
import { Textarea } from '@/components/ui/textarea';

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
        // Don't specify address - let the wallet provider determine the signer
        const ethersSigner = ethersProvider.getSigner();

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

function ListingImageGallery({
  images,
  onChange,
  getAccessToken,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  getAccessToken: () => Promise<string | null>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const MAX_IMAGES = 6;

  // Use frontend API route (no backend proxy - runs on localhost:3000)
  const uploadUrl = '/api/admin/upload-image';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= MAX_IMAGES) {
      setUploadError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds 2MB limit');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP allowed.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setUploadError('Authentication required');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Upload failed ${res.status}`);
      }
      const result = await res.json();
      if (result.success && result.imageUrl) {
        onChange([...images, result.imageUrl]);
      } else {
        setUploadError(result.error || 'Upload failed');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (i: number) => {
    onChange(images.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[#DCDDCC]">
          Image Gallery ({images.length}/{MAX_IMAGES}) — GCP Upload
        </Label>
        {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative p-2 bg-black/30 rounded-lg group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Gallery ${i + 1}`}
              className="w-full h-24 rounded-lg object-cover border border-emerald-400/20"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="55" fill="%23666" text-anchor="middle" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeImage(i)}
              className="absolute top-2 right-2 text-red-400 hover:bg-red-400/10 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove image ${i + 1}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-emerald-400/30 hover:border-emerald-400/50 cursor-pointer bg-black/20">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            ) : (
              <ImagePlus className="w-6 h-6 text-emerald-400" />
            )}
            <span className="text-xs text-[#DCDDCC] mt-1">Upload</span>
          </label>
        )}
      </div>
    </div>
  );
}

export default function AdminTokenLaunchPage() {
  // Admin authentication for route protection
  const {
    isAuthenticated: isAdminAuthenticated,
    isLoading: isAdminLoading,
    logout: adminLogout,
    getAdminAccessToken,
  } = useAdminAuth();
  const router = useRouter();

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

  // Created tokens state (for use in listing/pool creation)
  const [createdTokens, setCreatedTokens] = useState<
    Array<{
      address: string;
      name: string;
      symbol: string;
    }>
  >([]);

  // Unlinked tokens from database (tokens not yet associated with a listing)
  const [unlinkedTokens, setUnlinkedTokens] = useState<
    Array<{ address: string; name: string; symbol: string }>
  >([]);

  // Listing creation state
  const [listingForm, setListingForm] = useState({
    title: '',
    symbol: '',
    assetType: 'OTHER' as
      | 'VEHICLE'
      | 'JEWELRY'
      | 'COLLECTIBLE'
      | 'ART'
      | 'FASHION'
      | 'ALCOHOL'
      | 'OTHER',
    brand: '',
    story: '',
    details: '',
    provenance: '',
    value: '',
    reservePrice: '',
    hypeSentence: '',
    imageGallery: [] as string[],
    location: '',
    assetDetails: {} as Record<string, string>,
    hypePoints: [] as string[],
    startingBidPrice: '',
    launchDate: '',
    tokenId: '',
    showOnCanvas: true,
    isFeatured: false,
    showOnDrops: false,
  });
  const [listingLoading, setListingLoading] = useState(false);
  const [listingResult, setListingResult] = useState<string | null>(null);
  const [syncCanvasLoading, setSyncCanvasLoading] = useState(false);
  const [syncCanvasResult, setSyncCanvasResult] = useState<string | null>(null);
  const [syncUsersLoading, setSyncUsersLoading] = useState(false);
  const [syncUsersResult, setSyncUsersResult] = useState<string | null>(null);
  const [createdListings, setCreatedListings] = useState<
    Array<{
      id: string;
      title: string;
      symbol: string;
      isLive: boolean;
      tokenId: string | null;
    }>
  >([]);

  // LP Pool creation state (will be initialized with ACES address in useEffect)
  const [poolForm, setPoolForm] = useState({
    tokenAddress: '',
    platformTokenAddress: '', // Will be set to ACES in useEffect
    stable: false,
    tokenAmount: '',
    platformTokenAmount: '',
    lockDuration: '30', // Default 30 days (0 = no lock; "permanent" = max)
    permanentLock: false,
    // Fee/beneficiary (Locker: beneficiaryShare = % to beneficiary, bribeableShare = % that can be bribed; 0-10000 bps)
    beneficiary: '',
    beneficiaryShare: '0', // 0-10000 bps (e.g. 500 = 5%)
    bribeableShare: '500', // 0-10000 bps (e.g. 500 = 5%; many launchers hardcode this at launch)
    tickSpacing: '60', // CL tick spacing (e.g. 1, 10, 60, 200)
  });
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolResult, setPoolResult] = useState<string | null>(null);
  const [isManualChainSwitching, setIsManualChainSwitching] = useState(false);
  // Aerodrome / Locker testing
  const [configCheckResult, setConfigCheckResult] = useState<{
    v2Factory: { address: string; hasCode: boolean };
    clFactory: { address: string; hasCode: boolean };
    factoryRegistry: { address: string; hasCode: boolean };
    clPoolLauncher: { address: string; hasCode: boolean };
  } | null>(null);
  const [configCheckLoading, setConfigCheckLoading] = useState(false);
  const [lockerInspectAddress, setLockerInspectAddress] = useState('');
  const [lockerInspectResult, setLockerInspectResult] = useState<{
    owner: string;
    lockedUntil: number;
    lockedUntilDate: string;
    bribeableShare: number;
    beneficiary: string;
    beneficiaryShare: number;
    isLocked: boolean;
  } | null>(null);
  const [lockerInspectLoading, setLockerInspectLoading] = useState(false);
  const [lockerInspectError, setLockerInspectError] = useState<string | null>(null);

  // Fixed Supply Token Deployment state
  const [fixedSupplyDeployment, setFixedSupplyDeployment] = useState({
    create2DeployerAddress: '', // Address of CREATE2Deployer contract
    contractBytecode: '', // Contract bytecode (will be loaded from compilation)
    isDeploying: false,
  });

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

  // ACES contract instance
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);

  // Get contract addresses for current chain
  const contractAddresses = getContractAddresses(currentChainId);
  const fixedSupplyFactory = (contractAddresses as { FIXED_SUPPLY_FACTORY?: string })
    .FIXED_SUPPLY_FACTORY;
  const useFactory =
    !!fixedSupplyFactory && fixedSupplyFactory !== '0x0000000000000000000000000000000000000000';

  // Set default platform token address in pool form
  useEffect(() => {
    if (contractAddresses.ACES_TOKEN && !poolForm.platformTokenAddress) {
      setPoolForm((p) => ({ ...p, platformTokenAddress: contractAddresses.ACES_TOKEN }));
    }
  }, [contractAddresses.ACES_TOKEN, poolForm.platformTokenAddress]);

  // Auto-populate CREATE2Deployer address based on current network
  useEffect(() => {
    const create2DeployerAddress = (contractAddresses as any).CREATE2_DEPLOYER;
    if (
      create2DeployerAddress &&
      create2DeployerAddress !== '0x0000000000000000000000000000000000000000'
    ) {
      setFixedSupplyDeployment((prev) => ({
        ...prev,
        create2DeployerAddress: create2DeployerAddress,
      }));
    }
    // Reset validation when network changes
    setDeployerValidation({ isValid: null, message: '', isChecking: false });
  }, [contractAddresses, currentChainId]);

  // Validate CREATE2Deployer contract exists on current network
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
          const isBaseSepolia = currentChainId === 84532;
          const isBaseMainnet = currentChainId === 8453;

          let message = `CREATE2Deployer contract not found at ${address} on ${networkName}.\n\n`;

          if (isBaseMainnet) {
            message += `⚠️ You're on Base Mainnet, but CREATE2Deployer is only deployed on Base Sepolia testnet.\n\n`;
            message += `To fix this:\n`;
            message += `1. Switch to Base Sepolia (Chain ID: 84532) using the button below, OR\n`;
            message += `2. Deploy CREATE2Deployer to Base Mainnet first (see deployment docs)`;
          } else if (isBaseSepolia) {
            message += `⚠️ CREATE2Deployer not found on Base Sepolia.\n\n`;
            message += `Please deploy CREATE2Deployer.sol to Base Sepolia first.`;
          } else {
            message += `⚠️ CREATE2Deployer not found on this network.\n\n`;
            message += `Please deploy CREATE2Deployer.sol to ${networkName} first.`;
          }

          setDeployerValidation({
            isValid: false,
            message,
            isChecking: false,
          });
        } else {
          setDeployerValidation({
            isValid: true,
            message: `✅ CREATE2Deployer verified on ${network.name || `Chain ID ${network.chainId}`}`,
            isChecking: false,
          });
        }
      } catch (error) {
        console.error('Error validating CREATE2Deployer:', error);
        setDeployerValidation({
          isValid: false,
          message: `Error checking contract: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isChecking: false,
        });
      }
    },
    [wagmiProvider, currentChainId],
  );

  // Validate when deployer address or network changes
  useEffect(() => {
    if (fixedSupplyDeployment.create2DeployerAddress && wagmiProvider && currentChainId) {
      const timeoutId = setTimeout(() => {
        validateDeployerContract(fixedSupplyDeployment.create2DeployerAddress);
      }, 500); // Debounce validation

      return () => clearTimeout(timeoutId);
    } else {
      setDeployerValidation({ isValid: null, message: '', isChecking: false });
    }
  }, [
    fixedSupplyDeployment.create2DeployerAddress,
    currentChainId,
    wagmiProvider,
    validateDeployerContract,
  ]);

  // Use contract hook for wallet connection status (still needed for other features)
  const { isWalletConnected, signer: hookSigner } = useAcesFactoryContract({
    chainId: currentChainId,
    externalSigner: wagmiSigner,
    externalProvider: wagmiProvider,
  });

  // Fixed Supply Token creation state
  const [createForm, setCreateForm] = useState({
    name: 'Admin Test Token',
    symbol: 'ATT',
    salt: '', // Empty by default - will be set manually or generated during mining
  });

  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState({
    attempts: 0,
    timeElapsed: 0,
    predictedAddress: '',
  });
  const [saltMiningResult, setSaltMiningResult] = useState<SaltMiningResult | null>(null);

  const [loading, setLoading] = useState<string>('');

  // CREATE2Deployer validation state
  const [deployerValidation, setDeployerValidation] = useState<{
    isValid: boolean | null;
    message: string;
    isChecking: boolean;
  }>({
    isValid: null,
    message: '',
    isChecking: false,
  });

  // Check admin authentication and redirect if necessary.
  // Use a grace period so we don't redirect during Convex auth hydration (avoids
  // bouncing back to login right after a successful sign-in).
  const mountedAtRef = React.useRef<number>(Date.now());
  useEffect(() => {
    const graceMs = 2500;
    const elapsed = Date.now() - mountedAtRef.current;
    if (elapsed < graceMs) return;
    if (!isAdminLoading && !isAdminAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, isAdminLoading, router]);

  // Clear all state when wallet is disconnected
  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !isWalletConnected) {
      // Clear all contract state
      setAcesContract(null);
      setAcesBalance('0');
      // Note: wagmiSigner is managed by the hook, no need to clear manually

      // Clear mining state
      setIsMining(false);
      setSaltMiningResult(null);
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });

      setLoading('');

      console.log('🧹 Cleared all cached state due to wallet disconnection');
      return;
    }
  }, [isAuthenticated, walletAddress, isWalletConnected]);

  // Initialize ACES contract when wallet is connected
  useEffect(() => {
    const initializeContracts = async () => {
      if (!walletAddress || !isAuthenticated || !isWalletConnected) {
        return;
      }

      try {
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
        setAcesContract(null);
        setAcesBalance('0');
      }
    };

    initializeContracts();
  }, [hookSigner, walletAddress, contractAddresses, isAuthenticated, isWalletConnected]);

  // Refresh balances function
  const refreshBalances = async () => {
    if (!walletAddress || !acesContract) {
      alert('Wallet not connected or ACES contract not initialized');
      return;
    }

    try {
      setLoading('Refreshing balances...');
      const balance = await acesContract.balanceOf(walletAddress);
      setAcesBalance(ethers.utils.formatEther(balance));
      console.log('✅ ACES balance refreshed:', ethers.utils.formatEther(balance));
      setLoading('');
    } catch (error) {
      console.error('❌ Failed to refresh ACES balance:', error);
      setAcesBalance('0');
      setLoading('');
      alert('Failed to refresh balance. Please try again.');
    }
  };

  // Separate salt mining function for fixed supply tokens
  const handleBeginSaltMine = async () => {
    console.log('🎯 Beginning salt mining for fixed supply token...');

    if (!walletAddress) {
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

      // Reset progress
      setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      setSaltMiningResult(null);

      const result = await mineVanitySaltFixedSupplyWithTimeout(
        walletAddress,
        createForm.name,
        createForm.symbol,
        walletAddress, // Creator receives all tokens
        deployerForMiningCheck,
        fixedSupplyDeployment.contractBytecode,
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

  // Create fixed supply token function
  const handleCreateToken = async () => {
    console.log('🚀 handleCreateToken called for fixed supply token');
    console.log('createForm:', createForm);

    if (!walletAddress) {
      alert('Wallet address not found. Please reconnect your wallet.');
      return;
    }

    if (!wagmiSigner) {
      alert('Wallet signer not available. Please make sure your wallet is connected and unlocked.');
      return;
    }

    // Validate salt requirements
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
    if (!hasDeployer) {
      alert(
        'CREATE2Deployer or FixedSupplyERC20Factory is required. Enter deployer address or set NEXT_PUBLIC_FIXED_SUPPLY_FACTORY_*.',
      );
      return;
    }

    if (!fixedSupplyDeployment.contractBytecode) {
      alert(
        'Contract bytecode is required. Click "Load default bytecode" or paste from FixedSupplyERC20-bytecode.txt.',
      );
      return;
    }

    try {
      setLoading('Creating fixed supply token...');
      setFixedSupplyDeployment((prev) => ({ ...prev, isDeploying: true }));

      // Deploy fixed supply token (use factory when configured for lower gas)
      const result = await deployFixedSupplyToken(
        wagmiSigner,
        {
          name: createForm.name,
          symbol: createForm.symbol,
          salt: createForm.salt,
          creator: walletAddress,
        },
        fixedSupplyDeployment.contractBytecode,
        fixedSupplyDeployment.create2DeployerAddress,
        fixedSupplyFactory || undefined,
      );

      if (result.success && result.tokenAddress) {
        // Verify token was minted correctly
        if (result.warning) {
          console.warn('⚠️ Token deployment warning:', result.warning);
        }

        // Verify minting by checking on-chain data
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
              tokenContract.balanceOf(walletAddress),
              tokenContract.decimals(),
            ]);

          const expectedSupply = ethers.utils.parseEther('1000000000'); // 1 billion
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

          if (!isMintedCorrectly) {
            console.error('❌ Token minting verification failed:', {
              totalSupply: ethers.utils.formatEther(totalSupply),
              creatorBalance: ethers.utils.formatEther(creatorBalance),
              expectedSupply: ethers.utils.formatEther(expectedSupply),
              name: onChainName,
              symbol: onChainSymbol,
            });
            alert(
              `⚠️ Token deployed but minting verification failed!\n\n` +
                `Total Supply: ${ethers.utils.formatEther(totalSupply)} (expected: 1,000,000,000)\n` +
                `Creator Balance: ${ethers.utils.formatEther(creatorBalance)} (expected: 1,000,000,000)\n` +
                `Name: ${onChainName} (expected: ${createForm.name})\n` +
                `Symbol: ${onChainSymbol} (expected: ${createForm.symbol})\n\n` +
                `Please verify the token on BaseScan before proceeding.`,
            );
          } else {
            verificationSuccess = true;
            console.log('✅ Token minting verified:', {
              totalSupply: ethers.utils.formatEther(totalSupply),
              creatorBalance: ethers.utils.formatEther(creatorBalance),
              name: onChainName,
              symbol: onChainSymbol,
              decimals: decimals.toString(),
            });

            // Save token to database with verified on-chain data
            try {
              const token = await getAccessToken();
              if (token) {
                const dbResult = await AdminApi.createTokenInDatabase(
                  {
                    contractAddress: result.tokenAddress,
                    symbol: onChainSymbol, // Use on-chain symbol (verified)
                    name: onChainName, // Use on-chain name (verified)
                    chainId: currentChainId,
                    totalSupply: totalSupply.toString(),
                    decimals: decimals.toString(),
                    isFixedSupply: true, // Mark as fixed supply token
                  },
                  token,
                );

                if (dbResult.success) {
                  dbSaveSuccess = true;
                  console.log('✅ Token saved to database with verified data:', dbResult.data);
                } else {
                  throw new Error(dbResult.message || 'Database save failed');
                }
              } else {
                throw new Error('Authentication token not available');
              }
            } catch (dbError) {
              console.error('❌ Failed to save token to database:', dbError);
              alert(
                `Token deployed and verified successfully but failed to save to database.\n\n` +
                  `Token Address: ${result.tokenAddress}\n` +
                  `Name: ${onChainName}\n` +
                  `Symbol: ${onChainSymbol}\n` +
                  `Total Supply: ${ethers.utils.formatEther(totalSupply)}\n\n` +
                  `Error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}\n\n` +
                  `Please save this token manually using the token address above.`,
              );
            }
          }
        } catch (verifyError) {
          console.error('❌ Failed to verify token on-chain:', verifyError);
          alert(
            `Token deployed but verification failed!\n\n` +
              `Token Address: ${result.tokenAddress}\n` +
              `Error: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}\n\n` +
              `Please verify the token manually on BaseScan before saving to database.`,
          );
        }

        // Store created token for use in listing creation
        const newToken = {
          address: result.tokenAddress,
          name: verifiedData?.name || createForm.name,
          symbol: verifiedData?.symbol || createForm.symbol,
        };
        setCreatedTokens((prev) => [...prev, newToken]);

        // Show success message with verification details
        const isVanitySuccess = result.tokenAddress?.toLowerCase().endsWith('ace');
        let verifiedInfo = '';
        if (verificationSuccess && verifiedData) {
          verifiedInfo =
            `\n✅ Verified On-Chain:\n` +
            `Total Supply: ${ethers.utils.formatEther(verifiedData.totalSupply)} tokens\n` +
            `Creator Balance: ${ethers.utils.formatEther(verifiedData.creatorBalance)} tokens\n` +
            `Decimals: ${verifiedData.decimals}\n` +
            `\n📝 Note: ERC20 tokens emit a "Transfer" event from address(0) when minting.\n` +
            `This is standard ERC20 behavior - the Transfer event IS the mint event.\n` +
            `Your tokens were successfully minted! ✅\n`;
        }

        const dbStatus = dbSaveSuccess
          ? '✅ Token has been saved to database.'
          : '⚠️ Token NOT saved to database.';

        if (saltMiningResult) {
          alert(
            `✅ Token created${verificationSuccess ? ' and verified' : ''} successfully!\n\n` +
              `Address: ${result.tokenAddress}\n` +
              `Vanity Mining: ${saltMiningResult.attempts} attempts in ${(saltMiningResult.timeElapsed / 1000).toFixed(1)}s\n` +
              `${isVanitySuccess ? '✅ Address ends with "ace"!' : '❌ Vanity mining failed'}\n` +
              `Mined Salt: ${saltMiningResult.salt}\n` +
              verifiedInfo +
              `\n${dbStatus} You can now create a listing.`,
          );
        } else {
          alert(
            `✅ Token created${verificationSuccess ? ' and verified' : ''} successfully!\n\n` +
              `Address: ${result.tokenAddress}\n` +
              verifiedInfo +
              `\n${dbStatus} You can now create a listing.`,
          );
        }

        // Reset form
        setCreateForm({
          name: 'Admin Test Token',
          symbol: 'ATT',
          salt: '',
        });
        setSaltMiningResult(null);
        setMiningProgress({ attempts: 0, timeElapsed: 0, predictedAddress: '' });
      } else {
        console.error('Token creation failed:', result.error);
        alert(`Token creation failed: ${result.error || 'Unknown error'}`);
      }

      setLoading('');
    } catch (error) {
      console.error('Token creation failed:', error);
      setLoading('');

      // Better error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Token creation failed: ${errorMessage}`);
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

  // Create listing
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

        // Reset form
        setListingForm({
          title: '',
          symbol: '',
          showOnCanvas: true,
          isFeatured: false,
          showOnDrops: false,
          assetType: 'OTHER',
          brand: '',
          story: '',
          details: '',
          provenance: '',
          value: '',
          reservePrice: '',
          hypeSentence: '',
          imageGallery: [],
          location: '',
          assetDetails: {},
          hypePoints: [],
          startingBidPrice: '',
          launchDate: '',
          tokenId: '',
        });
      } else {
        setListingResult(`❌ Error: ${result.message || 'Failed to create listing'}`);
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      setListingResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setListingLoading(false);
    }
  };

  // Sync all Prisma listings (showOnCanvas) to Convex so they appear on the infinite canvas. Use after server restart.
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

  // One-time backfill: copy all Prisma users to Convex appUsers (idempotent).
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

  // Launch pool via CLPoolLauncher.launch() (creates pool + mints LP + optionally locks)
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

      const { launchCLPool, setLockerBribeableShare, MAX_BPS, encodeSqrtPriceX96 } = await import(
        '@/lib/contracts/aerodrome-locker'
      );
      const { getContractAddresses } = await import('@/lib/contracts/addresses');
      const addresses = getContractAddresses(currentChainId);
      const launcherAddress = addresses.AERODROME_CL_POOL_LAUNCHER;
      if (!launcherAddress || launcherAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(
          'CLPoolLauncher address not configured for this network. Set NEXT_PUBLIC_AERODROME_CL_POOL_LAUNCHER_*.',
        );
      }

      setLoading('Approving tokens for launcher...');
      const platformToken = tokenB;
      const amountA = ethers.utils.parseEther(poolForm.tokenAmount);
      const amountB = ethers.utils.parseEther(poolForm.platformTokenAmount);

      const erc20Abi = [
        'function approve(address spender, uint256 amount) external returns (bool)',
      ];
      const tokenAContract = new ethers.Contract(tokenA, erc20Abi, wagmiSigner);
      const tokenBContract = new ethers.Contract(platformToken, erc20Abi, wagmiSigner);
      await Promise.all([
        tokenAContract.approve(launcherAddress, amountA),
        tokenBContract.approve(launcherAddress, amountB),
      ]);

      setLoading('Launching CL pool (create pool + add liquidity + lock)...');
      const tickSpacing = parseInt(poolForm.tickSpacing, 10) || 60;
      const lockDurationDays = parseInt(poolForm.lockDuration, 10) || 0;
      const lockDurationSeconds = poolForm.permanentLock
        ? 0xffffffff
        : lockDurationDays * 24 * 60 * 60;

      const sqrtPriceX96 = encodeSqrtPriceX96(amountA, amountB);
      // CL pools require tickLower/tickUpper to be multiples of tickSpacing (Uniswap V3 rule).
      // Use standard full-range bounds (-887272, 887272) aligned to tickSpacing.
      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      const tickLower = Math.floor(MIN_TICK / tickSpacing) * tickSpacing;
      const tickUpper = Math.ceil(MAX_TICK / tickSpacing) * tickSpacing;

      const recipient = await wagmiSigner.getAddress();

      const result = await launchCLPool(
        wagmiSigner,
        {
          poolLauncherToken: tokenA,
          tokenToPair: platformToken,
          tickSpacing,
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
      );

      if (
        result.lockerAddress &&
        result.lockerAddress !== '0x0000000000000000000000000000000000000000'
      ) {
        const bribeBps = Math.min(MAX_BPS, Math.max(0, parseInt(poolForm.bribeableShare, 10) || 0));
        if (bribeBps > 0) {
          setLoading('Setting bribeable share on locker...');
          try {
            await setLockerBribeableShare(
              wagmiSigner,
              result.lockerAddress,
              bribeBps,
              currentChainId,
            );
          } catch (e) {
            console.warn('Could not set bribeable share (launcher may have fixed it):', e);
          }
        }
      }

      const token = await getAdminAccessToken();
      if (token && tokenA) {
        await AdminApi.updateTokenPoolAddress(tokenA, result.poolAddress, token);
      }

      setPoolResult(
        `✅ Pool launched. Pool: ${result.poolAddress}${result.lockerAddress ? ` | Locker: ${result.lockerAddress}` : ''}`,
      );
      setLoading('');
    } catch (error) {
      console.error('Error creating pool:', error);
      setPoolResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading('');
    } finally {
      setPoolLoading(false);
    }
  };

  // Verify Aerodrome contracts (V2 Factory, CL Factory, Registry, CL Pool Launcher) have code on-chain
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
      console.error(e);
      setConfigCheckResult(null);
      alert(`Check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setConfigCheckLoading(false);
    }
  };

  // Inspect a Locker contract (owner, lockedUntil, bribeableShare, beneficiary)
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

  // Toggle listing live status
  const handleToggleListingLive = async (listingId: string, currentStatus: boolean) => {
    if (currentStatus === false) {
      // Warn before going live
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
        // Update local state
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
      console.error('Error toggling listing live status:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Fetch created listings on mount
  useEffect(() => {
    const fetchListings = async () => {
      if (!isAdminAuthenticated) return;

      try {
        const token = await getAdminAccessToken();
        if (!token) return;

        const result = await AdminApi.getAvailableListings(token);
        if (result.success) {
          setCreatedListings(
            result.data.map((listing: any) => ({
              id: listing.id,
              title: listing.title,
              symbol: listing.symbol,
              isLive: listing.isLive,
              tokenId: listing.token?.contractAddress || null,
            })),
          );
        }
      } catch (error) {
        console.error('Error fetching listings:', error);
      }
    };

    fetchListings();
  }, [isAdminAuthenticated, getAdminAccessToken]);

  // Fetch unlinked tokens (tokens in DB not yet linked to a listing)
  useEffect(() => {
    const fetchUnlinkedTokens = async () => {
      if (!isAdminAuthenticated) return;

      try {
        const token = await getAdminAccessToken();
        if (!token) return;

        const result = await AdminApi.getAllTokens(token);
        if (result.success && result.data) {
          const unlinked = result.data
            .filter((t: { listingId: string | null }) => !t.listingId)
            .map((t: { contractAddress: string; name: string; symbol: string }) => ({
              address: t.contractAddress,
              name: t.name,
              symbol: t.symbol,
            }));
          setUnlinkedTokens(unlinked);
        }
      } catch (error) {
        console.error('Error fetching unlinked tokens:', error);
      }
    };

    fetchUnlinkedTokens();
  }, [isAdminAuthenticated, getAdminAccessToken]);

  const handleLogout = async () => {
    await adminLogout();
    router.push('/admin/login');
  };

  // Show loading while checking admin authentication
  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-[#151c16]">
        <PageLoader />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen relative bg-[#151c16] flex flex-col">
      {/* Header Component */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* ACES Background + Luxury Tiles - Extends to cover full page including footer */}
      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={3000}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />

      {/* Title band between header bottom and solid horizontal line */}
      <PageBandTitle
        title="Token Launch Center"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />
      <PageBandSubtitle
        text="Create and manage ERC20 tokens on Base blockchain. Deploy tokens with custom bonding curves, link them to listings, and manage the full token lifecycle."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Flex grow to push footer down */}
      <div className="relative z-20 flex-1 w-full min-h-0">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-[200px] pb-24">
          <div className="space-y-6">
            {/* Admin Header with Logout */}
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="text-purple-400 border-purple-400">
                Admin Only
              </Badge>
              <div className="flex items-center gap-4">
                <ConnectWalletProfile />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-400 border-red-400 hover:bg-red-400/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Fixed Supply ERC20 Token Deployment Section */}
            {walletAddress && (
              <Card className="bg-black border-purple-400/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white font-libre-caslon flex items-center">
                        <Coins className="w-5 h-5 mr-2 text-purple-400" />
                        Fixed Supply ERC20 Token Deployment
                      </CardTitle>
                      <p className="text-sm text-[#DCDDCC] mt-2">
                        Deploy a fixed-supply ERC20 token with 1 billion tokens. All tokens are
                        minted to the creator on deployment. Uses CREATE2 for vanity address mining.
                      </p>
                    </div>
                    <div className="ml-4">
                      {isOnBaseSepolia && (
                        <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-md">
                          <p className="text-xs font-medium text-yellow-400">Base Sepolia</p>
                          <p className="text-xs text-yellow-300/70">Testnet (84532)</p>
                        </div>
                      )}
                      {isOnBaseMainnet && (
                        <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-md">
                          <p className="text-xs font-medium text-green-400">Base Mainnet</p>
                          <p className="text-xs text-green-300/70">Production (8453)</p>
                        </div>
                      )}
                      {!isOnBaseSepolia && !isOnBaseMainnet && (
                        <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-md">
                          <p className="text-xs font-medium text-red-400">Unsupported Network</p>
                          <p className="text-xs text-red-300/70">Chain ID: {currentChainId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Setup Section */}
                  <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-400 mb-1">Setup Required</p>
                        <p className="text-xs text-[#DCDDCC] mb-2">
                          Before deploying tokens, you need to:
                        </p>
                        <ul className="text-xs text-[#DCDDCC] ml-4 list-disc space-y-1">
                          <li>Deploy CREATE2Deployer.sol contract and enter its address below</li>
                          <li>Compile FixedSupplyERC20.sol and provide the bytecode</li>
                        </ul>
                        {(contractAddresses as any).CREATE2_DEPLOYER &&
                          (contractAddresses as any).CREATE2_DEPLOYER !==
                            '0x0000000000000000000000000000000000000000' && (
                            <p className="text-xs text-green-400 mt-2">
                              ✅ CREATE2Deployer address auto-filled for{' '}
                              {isOnBaseSepolia
                                ? 'Base Sepolia'
                                : isOnBaseMainnet
                                  ? 'Base Mainnet'
                                  : 'current network'}
                            </p>
                          )}
                        {useFactory && fixedSupplyFactory && (
                          <p className="text-xs text-cyan-400 mt-2">
                            ⛽ Using FixedSupplyERC20Factory – lower gas (bytecode not sent in tx)
                          </p>
                        )}
                        {(!(contractAddresses as any).CREATE2_DEPLOYER ||
                          (contractAddresses as any).CREATE2_DEPLOYER ===
                            '0x0000000000000000000000000000000000000000') && (
                          <p className="text-xs text-red-400 mt-2">
                            ⚠️ CREATE2Deployer not configured for{' '}
                            {isOnBaseSepolia
                              ? 'Base Sepolia'
                              : isOnBaseMainnet
                                ? 'Base Mainnet'
                                : `Chain ID ${currentChainId}`}
                            . Please enter the address manually.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Configuration Inputs */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-[#DCDDCC]">CREATE2Deployer Contract Address *</Label>
                      <Input
                        value={fixedSupplyDeployment.create2DeployerAddress}
                        onChange={(e) =>
                          setFixedSupplyDeployment((prev) => ({
                            ...prev,
                            create2DeployerAddress: e.target.value,
                          }))
                        }
                        placeholder="0x..."
                        className={`bg-black border-purple-400/20 text-white font-mono mt-2 ${
                          deployerValidation.isValid === false
                            ? 'border-red-500'
                            : deployerValidation.isValid === true
                              ? 'border-green-500'
                              : ''
                        }`}
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        Address of the deployed CREATE2Deployer contract
                      </p>

                      {/* Validation Status */}
                      {deployerValidation.isChecking && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-400/20 rounded-md">
                          <p className="text-xs text-blue-400 flex items-center">
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            {deployerValidation.message}
                          </p>
                        </div>
                      )}

                      {deployerValidation.isValid === true && !deployerValidation.isChecking && (
                        <div className="mt-2 p-2 bg-green-500/10 border border-green-400/20 rounded-md">
                          <p className="text-xs text-green-400 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-2" />
                            {deployerValidation.message}
                          </p>
                        </div>
                      )}

                      {deployerValidation.isValid === false && !deployerValidation.isChecking && (
                        <div className="mt-2 p-3 bg-red-500/10 border border-red-400/20 rounded-md">
                          <p className="text-xs text-red-400 whitespace-pre-line mb-2">
                            {deployerValidation.message}
                          </p>
                          {isOnBaseMainnet && (
                            <Button
                              onClick={async () => {
                                try {
                                  await switchToChain(SUPPORTED_CHAINS.BASE_SEPOLIA);
                                  setChainSwitchFeedback({
                                    type: 'success',
                                    message: 'Switched to Base Sepolia testnet',
                                  });
                                } catch (error) {
                                  setChainSwitchFeedback({
                                    type: 'error',
                                    message: `Failed to switch network: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                  });
                                }
                              }}
                              size="sm"
                              className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs"
                            >
                              Switch to Base Sepolia Testnet
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mt-2 mb-1">
                        <Label className="text-[#DCDDCC]">Contract Bytecode *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs border-purple-400/40 text-purple-300 hover:bg-purple-500/20"
                          onClick={async () => {
                            try {
                              const r = await fetch('/fixed-supply-bytecode.txt');
                              if (!r.ok) throw new Error('Failed to fetch');
                              const hex = (await r.text()).trim();
                              if (!hex || !hex.startsWith('0x'))
                                throw new Error('Invalid bytecode');
                              setFixedSupplyDeployment((prev) => ({
                                ...prev,
                                contractBytecode: hex,
                              }));
                            } catch (e) {
                              console.error('Load default bytecode:', e);
                              alert(
                                'Could not load default bytecode. Copy from packages/contracts/bytecode/FixedSupplyERC20-bytecode.txt instead.',
                              );
                            }
                          }}
                        >
                          Load default bytecode
                        </Button>
                      </div>
                      <Textarea
                        value={fixedSupplyDeployment.contractBytecode}
                        onChange={(e) =>
                          setFixedSupplyDeployment((prev) => ({
                            ...prev,
                            contractBytecode: e.target.value,
                          }))
                        }
                        placeholder="0x6080604052... or click Load default bytecode"
                        className="bg-black border-purple-400/20 text-white font-mono mt-2"
                        rows={4}
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        FixedSupplyERC20 creation bytecode (no constructor args). Same for Base
                        Sepolia &amp; Base Mainnet.
                      </p>
                    </div>
                  </div>

                  {/* Vanity Address Mining Section */}
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
                          isMining ||
                          !walletAddress ||
                          !wagmiSigner ||
                          (!fixedSupplyDeployment.create2DeployerAddress &&
                            !(useFactory && fixedSupplyFactory)) ||
                          !fixedSupplyDeployment.contractBytecode
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

                    {/* Token name and symbol inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-[#DCDDCC] text-sm">Token Name *</Label>
                        <Input
                          value={createForm.name}
                          onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                          disabled={isMining}
                          className="bg-black border-purple-400/20 text-white"
                          placeholder="Token Name"
                        />
                      </div>
                      <div>
                        <Label className="text-[#DCDDCC] text-sm">Token Symbol *</Label>
                        <Input
                          value={createForm.symbol}
                          onChange={(e) => setCreateForm((p) => ({ ...p, symbol: e.target.value }))}
                          disabled={isMining}
                          className="bg-black border-purple-400/20 text-white"
                          placeholder="SYMBOL"
                        />
                      </div>
                    </div>

                    {/* Salt input */}
                    <div>
                      <Label className="text-[#DCDDCC] text-sm">Salt (unique identifier)</Label>
                      <Input
                        type="text"
                        value={createForm.salt}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, salt: e.target.value }))
                        }
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

                    {saltMiningResult && (
                      <div className="p-3 bg-green-500/10 border border-green-400/20 rounded-md mt-4">
                        <p className="text-xs font-medium text-green-400 mb-1 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Vanity Address Found!
                        </p>
                        <p className="text-xs text-green-300 break-all font-mono">
                          <strong>Address:</strong> {saltMiningResult.predictedAddress}
                        </p>
                        <p className="text-xs text-green-300">
                          <strong>Attempts:</strong> {saltMiningResult.attempts.toLocaleString()} |
                          <strong> Time:</strong> {(saltMiningResult.timeElapsed / 1000).toFixed(1)}
                          s
                        </p>
                      </div>
                    )}

                    {/* Mining Progress Display */}
                    {isMining && (
                      <div className="p-4 bg-purple-500/10 border border-purple-400/20 rounded-lg mt-4">
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
                              ? (
                                  miningProgress.attempts /
                                  (miningProgress.timeElapsed / 1000)
                                ).toFixed(0)
                              : 0}{' '}
                            attempts/sec
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Create Token Button */}
                  <Button
                    onClick={handleCreateToken}
                    disabled={
                      fixedSupplyDeployment.isDeploying ||
                      !createForm.name ||
                      !createForm.symbol ||
                      !createForm.salt ||
                      (!fixedSupplyDeployment.create2DeployerAddress &&
                        !(useFactory && fixedSupplyFactory)) ||
                      !fixedSupplyDeployment.contractBytecode ||
                      !walletAddress ||
                      !wagmiSigner
                    }
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                  >
                    {fixedSupplyDeployment.isDeploying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deploying Token...
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4 mr-2" />
                        Create Fixed Supply Token
                      </>
                    )}
                  </Button>

                  {/* Info Section */}
                  <div className="p-3 bg-purple-500/5 rounded border border-purple-400/10">
                    <p className="text-xs font-medium text-purple-300 mb-1">Token Details:</p>
                    <ul className="text-xs text-[#DCDDCC] space-y-1">
                      <li>• Total Supply: 1,000,000,000 tokens (1 billion)</li>
                      <li>• All tokens are minted to the creator on deployment</li>
                      <li>• No additional minting is possible</li>
                      <li>• Uses CREATE2 for deterministic address deployment</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Listing Creation Section */}
            {walletAddress && (
              <Card className="bg-black border-emerald-400/20">
                <CardHeader>
                  <CardTitle className="text-white font-libre-caslon flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-emerald-400" />
                    Create Listing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
                    <p className="text-sm text-emerald-300 mb-2">
                      <strong>📝 Step 2:</strong> Create a listing for your tokenized asset
                    </p>
                    <p className="text-xs text-emerald-200/70">
                      Link your created token to a listing. The listing will start as not live and
                      can be activated later.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#DCDDCC]">Title *</Label>
                      <Input
                        value={listingForm.title}
                        onChange={(e) => setListingForm((p) => ({ ...p, title: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Asset Title"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Symbol *</Label>
                      <Input
                        value={listingForm.symbol}
                        onChange={(e) => setListingForm((p) => ({ ...p, symbol: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="ASSET"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Asset Type *</Label>
                      <select
                        value={listingForm.assetType}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, assetType: e.target.value as any }))
                        }
                        className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
                      >
                        <option value="VEHICLE">Vehicle</option>
                        <option value="JEWELRY">Jewelry</option>
                        <option value="COLLECTIBLE">Collectible</option>
                        <option value="ART">Art</option>
                        <option value="FASHION">Fashion</option>
                        <option value="ALCOHOL">Alcohol</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Link Token (Optional)</Label>
                      <select
                        value={listingForm.tokenId}
                        onChange={(e) => setListingForm((p) => ({ ...p, tokenId: e.target.value }))}
                        className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
                      >
                        <option value="">-- Select a token --</option>
                        {(() => {
                          const seen = new Set(createdTokens.map((t) => t.address.toLowerCase()));
                          const allTokens = [...createdTokens];
                          unlinkedTokens.forEach((t) => {
                            if (!seen.has(t.address.toLowerCase())) {
                              seen.add(t.address.toLowerCase());
                              allTokens.push(t);
                            }
                          });
                          return allTokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.name} ({token.symbol}) - {token.address.slice(0, 10)}...
                            </option>
                          ));
                        })()}
                      </select>
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        Tokens from DB (unlinked) + tokens created this session
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Brand</Label>
                      <Input
                        value={listingForm.brand}
                        onChange={(e) => setListingForm((p) => ({ ...p, brand: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Brand name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Story</Label>
                      <Textarea
                        value={listingForm.story}
                        onChange={(e) => setListingForm((p) => ({ ...p, story: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Tell the story of this asset..."
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Details</Label>
                      <Textarea
                        value={listingForm.details}
                        onChange={(e) => setListingForm((p) => ({ ...p, details: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Additional details..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Provenance</Label>
                      <Textarea
                        value={listingForm.provenance}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, provenance: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Ownership history..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Value (USD)</Label>
                      <Input
                        value={listingForm.value}
                        onChange={(e) => setListingForm((p) => ({ ...p, value: e.target.value }))}
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="e.g. 50000"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Reserve Price (USD)</Label>
                      <Input
                        value={listingForm.reservePrice}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, reservePrice: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Minimum sale price"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Starting Bid Price (USD)</Label>
                      <Input
                        value={listingForm.startingBidPrice}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, startingBidPrice: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Minimum bid amount"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Launch Date</Label>
                      <Input
                        type="datetime-local"
                        value={listingForm.launchDate}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, launchDate: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        When the asset will go live for sale
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Hype Sentence</Label>
                      <Input
                        value={listingForm.hypeSentence}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, hypeSentence: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="Short catchy tagline..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Location</Label>
                      <Input
                        value={listingForm.location}
                        onChange={(e) =>
                          setListingForm((p) => ({ ...p, location: e.target.value }))
                        }
                        className="bg-black border-emerald-400/20 text-white"
                        placeholder="e.g. Miami, FL"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Hype Points (bullet points)</Label>
                      <div className="space-y-2">
                        {listingForm.hypePoints.map((point, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={point}
                              onChange={(e) => {
                                const next = [...listingForm.hypePoints];
                                next[i] = e.target.value;
                                setListingForm((p) => ({ ...p, hypePoints: next }));
                              }}
                              className="bg-black border-emerald-400/20 text-white flex-1"
                              placeholder={`Point ${i + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setListingForm((p) => ({
                                  ...p,
                                  hypePoints: p.hypePoints.filter((_, j) => j !== i),
                                }))
                              }
                              className="text-red-400 hover:bg-red-400/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setListingForm((p) => ({ ...p, hypePoints: [...p.hypePoints, ''] }))
                          }
                          className="border-emerald-400/40 text-emerald-300"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add point
                        </Button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-[#DCDDCC]">Asset Details (key-value)</Label>
                      <div className="space-y-2">
                        {Object.entries(listingForm.assetDetails).map(([key, val], i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={key}
                              onChange={(e) => {
                                const next = { ...listingForm.assetDetails };
                                delete next[key];
                                next[e.target.value] = val;
                                setListingForm((p) => ({ ...p, assetDetails: next }));
                              }}
                              className="bg-black border-emerald-400/20 text-white w-32"
                              placeholder="Key"
                            />
                            <Input
                              value={val}
                              onChange={(e) => {
                                const next = { ...listingForm.assetDetails };
                                next[key] = e.target.value;
                                setListingForm((p) => ({ ...p, assetDetails: next }));
                              }}
                              className="bg-black border-emerald-400/20 text-white flex-1"
                              placeholder="Value"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = { ...listingForm.assetDetails };
                                delete next[key];
                                setListingForm((p) => ({ ...p, assetDetails: next }));
                              }}
                              className="text-red-400 hover:bg-red-400/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setListingForm((p) => ({
                              ...p,
                              assetDetails: { ...p.assetDetails, [`key_${Date.now()}`]: '' },
                            }))
                          }
                          className="border-emerald-400/40 text-emerald-300"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add detail
                        </Button>
                      </div>
                    </div>
                    {/* Canvas / Drops visibility */}
                    <div className="md:col-span-2 flex flex-wrap gap-6 items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={listingForm.showOnCanvas}
                          onChange={(e) =>
                            setListingForm((p) => ({ ...p, showOnCanvas: e.target.checked }))
                          }
                          className="rounded border-emerald-400/40 bg-black text-emerald-500"
                        />
                        <span className="text-sm text-emerald-200">Show on canvas</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={listingForm.isFeatured}
                          onChange={(e) =>
                            setListingForm((p) => ({ ...p, isFeatured: e.target.checked }))
                          }
                          className="rounded border-emerald-400/40 bg-black text-emerald-500"
                        />
                        <span className="text-sm text-emerald-200">Featured (homepage)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={listingForm.showOnDrops}
                          onChange={(e) =>
                            setListingForm((p) => ({ ...p, showOnDrops: e.target.checked }))
                          }
                          className="rounded border-emerald-400/40 bg-black text-emerald-500"
                        />
                        <span className="text-sm text-emerald-200">Show on drops page</span>
                      </label>
                    </div>
                    {/* Image Gallery - GCP Upload */}
                    <div className="md:col-span-2">
                      <ListingImageGallery
                        images={listingForm.imageGallery}
                        onChange={(imageGallery) => setListingForm((p) => ({ ...p, imageGallery }))}
                        getAccessToken={getAdminAccessToken}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateListing}
                    disabled={listingLoading || !listingForm.title || !listingForm.symbol}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {listingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Listing...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Create Listing
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSyncCanvas}
                    disabled={syncCanvasLoading}
                    className="w-full border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                  >
                    {syncCanvasLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing canvas...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync canvas (repopulate from DB after restart)
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSyncUsersToConvex}
                    disabled={syncUsersLoading}
                    className="w-full border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
                  >
                    {syncUsersLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing users...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync users to Convex (one-time backfill)
                      </>
                    )}
                  </Button>

                  {listingResult && (
                    <div
                      className={`p-3 rounded-lg border ${
                        listingResult.startsWith('✅')
                          ? 'bg-green-500/10 border-green-400/20 text-green-300'
                          : 'bg-red-500/10 border-red-400/20 text-red-300'
                      }`}
                    >
                      {listingResult}
                    </div>
                  )}
                  {syncCanvasResult && (
                    <div
                      className={`p-3 rounded-lg border ${
                        syncCanvasResult.startsWith('✅')
                          ? 'bg-green-500/10 border-green-400/20 text-green-300'
                          : 'bg-red-500/10 border-red-400/20 text-red-300'
                      }`}
                    >
                      {syncCanvasResult}
                    </div>
                  )}
                  {syncUsersResult && (
                    <div
                      className={`p-3 rounded-lg border ${
                        syncUsersResult.startsWith('✅')
                          ? 'bg-green-500/10 border-green-400/20 text-green-300'
                          : 'bg-red-500/10 border-red-400/20 text-red-300'
                      }`}
                    >
                      {syncUsersResult}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Launch Pool Section — pair any two tokens, set fees, lock duration, beneficiaries */}
            {walletAddress && (
              <Card className="bg-black border-cyan-400/20">
                <CardHeader>
                  <CardTitle className="text-white font-libre-caslon flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-cyan-400" />
                    Launch Pool (Aerodrome CL)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-cyan-500/10 border border-cyan-400/20 rounded-lg">
                    <p className="text-sm text-cyan-300 mb-2">
                      Pair any two tokens, add liquidity, set trading fee tier, lock duration, and
                      fee beneficiaries.
                    </p>
                    <p className="text-xs text-cyan-200/70">
                      Creates a concentrated liquidity pool on Aerodrome (SlipStream). Optionally
                      lock LP and assign beneficiary share and bribeable share.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#DCDDCC]">Token A (first token) *</Label>
                      {createdTokens.length > 0 && (
                        <select
                          value={
                            createdTokens.some((t) => t.address === poolForm.tokenAddress)
                              ? poolForm.tokenAddress
                              : ''
                          }
                          onChange={(e) =>
                            setPoolForm((p) => ({
                              ...p,
                              tokenAddress: e.target.value || p.tokenAddress,
                            }))
                          }
                          className="w-full bg-black border border-cyan-400/20 text-white rounded-md px-3 py-2 mb-1"
                        >
                          <option value="">— Or pick from your tokens —</option>
                          {createdTokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.name} ({token.symbol})
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        value={poolForm.tokenAddress}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, tokenAddress: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white font-mono"
                        placeholder="0x... token address"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Token B (second token) *</Label>
                      <Input
                        value={poolForm.platformTokenAddress || contractAddresses.ACES_TOKEN}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, platformTokenAddress: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white font-mono"
                        placeholder="0x... or ACES"
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        Default: ACES ({contractAddresses.ACES_TOKEN?.slice(0, 10)}...)
                      </p>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Trading fee tier (tick spacing)</Label>
                      <select
                        value={poolForm.tickSpacing}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, tickSpacing: e.target.value }))
                        }
                        className="w-full bg-black border border-cyan-400/20 text-white rounded-md px-3 py-2"
                      >
                        <option value="1">1 — 0.01%</option>
                        <option value="10">10 — 0.05%</option>
                        <option value="60">60 — 0.3%</option>
                        <option value="200">200 — 1%</option>
                      </select>
                      <p className="text-xs text-[#DCDDCC] mt-1">Determines pool fee tier.</p>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Lock duration (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={poolForm.lockDuration}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, lockDuration: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white"
                        placeholder="0 = no lock, 30 = 30 days"
                        disabled={poolForm.permanentLock}
                      />
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#DCDDCC]">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={poolForm.permanentLock}
                            onChange={(e) =>
                              setPoolForm((p) => ({ ...p, permanentLock: e.target.checked }))
                            }
                          />
                          Permanent lock
                        </label>
                        <span>0 = no lock (unlocked LP)</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Beneficiary (fee recipient)</Label>
                      <Input
                        value={poolForm.beneficiary}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, beneficiary: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white font-mono"
                        placeholder="0x... (optional)"
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        Optional. Set at lock creation; many launchers hardcode 0.
                      </p>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Beneficiary share (bps, 0–10000)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        value={poolForm.beneficiaryShare}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, beneficiaryShare: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white"
                        placeholder="0"
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        % of fees to beneficiary (e.g. 500 = 5%).
                      </p>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Bribeable share (bps, 0–10000)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        value={poolForm.bribeableShare}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, bribeableShare: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white"
                        placeholder="500"
                      />
                      <p className="text-xs text-[#DCDDCC] mt-1">
                        % of fees that can be bribed (e.g. 500 = 5%). Set on locker after launch if
                        launcher hardcodes it.
                      </p>
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Token A amount (initial liquidity) *</Label>
                      <Input
                        type="text"
                        value={poolForm.tokenAmount}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, tokenAmount: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white"
                        placeholder="e.g. 1000"
                      />
                    </div>
                    <div>
                      <Label className="text-[#DCDDCC]">Token B amount (initial liquidity) *</Label>
                      <Input
                        type="text"
                        value={poolForm.platformTokenAmount}
                        onChange={(e) =>
                          setPoolForm((p) => ({ ...p, platformTokenAmount: e.target.value }))
                        }
                        className="bg-black border-cyan-400/20 text-white"
                        placeholder="e.g. 1000"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCreatePool}
                    disabled={
                      poolLoading ||
                      !poolForm.tokenAddress?.trim() ||
                      !(poolForm.platformTokenAddress?.trim() || contractAddresses.ACES_TOKEN) ||
                      !poolForm.tokenAmount ||
                      !poolForm.platformTokenAmount
                    }
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {poolLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Launching pool...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Launch Pool
                      </>
                    )}
                  </Button>

                  {poolResult && (
                    <div
                      className={`p-3 rounded-lg border ${
                        poolResult.startsWith('✅')
                          ? 'bg-green-500/10 border-green-400/20 text-green-300'
                          : 'bg-red-500/10 border-red-400/20 text-red-300'
                      }`}
                    >
                      {poolResult}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Test Aerodrome & Locker (verify contracts + inspect locker) */}
            {walletAddress && (
              <Card className="bg-black border-amber-400/20">
                <CardHeader>
                  <CardTitle className="text-white font-libre-caslon flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-amber-400" />
                    Test Aerodrome & Locker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-400/20 rounded-lg">
                    <p className="text-sm text-amber-300 mb-2">
                      Verify configured Aerodrome contracts have code on-chain, and inspect any
                      Locker address (owner, lock end, bribeable share, beneficiary).
                    </p>
                  </div>

                  <div>
                    <Label className="text-[#DCDDCC]">1. Verify contracts</Label>
                    <Button
                      onClick={handleVerifyAerodromeContracts}
                      disabled={configCheckLoading || !wagmiProvider}
                      variant="outline"
                      className="mt-2 border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
                    >
                      {configCheckLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Run config check'
                      )}
                    </Button>
                    {configCheckResult && (
                      <div className="mt-3 p-3 rounded-lg bg-black/50 border border-amber-400/20 text-sm font-mono space-y-1">
                        <div
                          className={
                            configCheckResult.v2Factory.hasCode ? 'text-green-400' : 'text-red-400'
                          }
                        >
                          V2 Factory: {configCheckResult.v2Factory.address.slice(0, 10)}... —{' '}
                          {configCheckResult.v2Factory.hasCode ? 'OK' : 'No code'}
                        </div>
                        <div
                          className={
                            configCheckResult.clFactory.hasCode ? 'text-green-400' : 'text-red-400'
                          }
                        >
                          CL Factory: {configCheckResult.clFactory.address.slice(0, 10)}... —{' '}
                          {configCheckResult.clFactory.hasCode ? 'OK' : 'No code'}
                        </div>
                        <div
                          className={
                            configCheckResult.factoryRegistry.hasCode
                              ? 'text-green-400'
                              : 'text-red-400'
                          }
                        >
                          Factory Registry: {configCheckResult.factoryRegistry.address.slice(0, 10)}
                          ... — {configCheckResult.factoryRegistry.hasCode ? 'OK' : 'No code'}
                        </div>
                        <div
                          className={
                            configCheckResult.clPoolLauncher.hasCode
                              ? 'text-green-400'
                              : 'text-amber-400'
                          }
                        >
                          CL Pool Launcher: {configCheckResult.clPoolLauncher.address.slice(0, 10)}
                          ... —{' '}
                          {configCheckResult.clPoolLauncher.hasCode
                            ? 'OK'
                            : 'Not set / no code (needed for launch)'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-[#DCDDCC]">2. Inspect Locker</Label>
                    <p className="text-xs text-[#DCDDCC] mt-1 mb-2">
                      Paste a Locker contract address (e.g. after a launch) to read owner, lock end,
                      bribeable share, beneficiary.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={lockerInspectAddress}
                        onChange={(e) => {
                          setLockerInspectAddress(e.target.value);
                          setLockerInspectResult(null);
                          setLockerInspectError(null);
                        }}
                        className="bg-black border-amber-400/20 text-white font-mono flex-1"
                        placeholder="0x..."
                      />
                      <Button
                        onClick={handleInspectLocker}
                        disabled={lockerInspectLoading || !wagmiProvider}
                        variant="outline"
                        className="border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
                      >
                        {lockerInspectLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Inspect'
                        )}
                      </Button>
                    </div>
                    {lockerInspectError && (
                      <p className="mt-2 text-sm text-red-400">{lockerInspectError}</p>
                    )}
                    {lockerInspectResult && (
                      <div className="mt-3 p-3 rounded-lg bg-black/50 border border-amber-400/20 text-sm font-mono space-y-1">
                        <div>Owner: {lockerInspectResult.owner}</div>
                        <div>
                          Locked until:{' '}
                          {lockerInspectResult.lockedUntilDate || lockerInspectResult.lockedUntil}
                        </div>
                        <div>Bribeable share: {lockerInspectResult.bribeableShare} bps</div>
                        <div>Beneficiary: {lockerInspectResult.beneficiary || '(none)'}</div>
                        <div>Beneficiary share: {lockerInspectResult.beneficiaryShare} bps</div>
                        <div className="text-amber-300">
                          Is locked: {lockerInspectResult.isLocked ? 'Yes' : 'No'}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Toggle isLive Section */}
            {walletAddress && createdListings.length > 0 && (
              <Card className="bg-black border-yellow-400/20">
                <CardHeader>
                  <CardTitle className="text-white font-libre-caslon flex items-center">
                    <ToggleRight className="w-5 h-5 mr-2 text-yellow-400" />
                    Manage Listings (Toggle Live Status)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
                    <p className="text-sm text-yellow-300 mb-2">
                      <strong>⚡ Step 4:</strong> Activate listings for trading
                    </p>
                    <p className="text-xs text-yellow-200/70">
                      Once a listing is live, users can start trading the associated token on your
                      platform.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {createdListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="p-4 border border-yellow-400/20 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <h3 className="font-semibold text-white">
                            {listing.title} ({listing.symbol})
                          </h3>
                          <p className="text-sm text-[#DCDDCC]">
                            Status: {listing.isLive ? 'Live' : 'Not Live'}
                          </p>
                          {listing.tokenId && (
                            <p className="text-xs text-[#DCDDCC] font-mono">
                              Token: {listing.tokenId.slice(0, 10)}...
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => handleToggleListingLive(listing.id, listing.isLive)}
                          variant={listing.isLive ? 'outline' : 'default'}
                          className={
                            listing.isLive
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }
                        >
                          {listing.isLive ? (
                            <>
                              <ToggleLeft className="w-4 h-4 mr-2" />
                              Set Not Live
                            </>
                          ) : (
                            <>
                              <ToggleRight className="w-4 h-4 mr-2" />
                              Set Live
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer - At bottom */}
      <div className="relative z-50 mt-auto">
        <Footer />
      </div>
    </div>
  );
}
