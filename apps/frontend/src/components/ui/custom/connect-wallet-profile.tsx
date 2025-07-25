'use client';

import { useState } from 'react';
import {
  Wallet,
  CircleUser,
  ChevronDown,
  Crown,
  Settings,
  User,
  Shield,
  CreditCard,
  Zap,
  AlertTriangle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useFundWallet } from '@privy-io/react-auth';
import { useChainSwitching } from '@/hooks/use-chain-switching';
import { usePrivyWallet } from '@/hooks/use-privy-wallet';
import { WalletModal } from '@/components/wallet/wallet-modal';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import Link from 'next/link';

interface ConnectWalletProfileProps {
  className?: string;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onSellerDashboardClick?: () => void;
}

export default function ConnectWalletProfile({
  className = '',
  onProfileClick,
  onSettingsClick,
  onSellerDashboardClick,
}: ConnectWalletProfileProps) {
  const {
    isAuthenticated,
    isLoading,
    user,
    walletAddress,
    connectWallet,
    disconnectWallet,
    hasRole,
  } = useAuth();

  const { fundWallet } = useFundWallet();

  const {
    currentChain,
    isOnBaseMainnet,
    isOnBaseSepolia,
    isSwitching,
    switchToFunding,
    switchToDefault,
    ensureCorrectChain,
    SUPPORTED_CHAINS,
  } = useChainSwitching();

  const { hasEmbeddedWallet } = usePrivyWallet();

  // Local state for wallet modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const displayName = user?.displayName || (displayAddress ? displayAddress : 'User');

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Handle buy crypto with chain switching
  const handleBuyCrypto = async () => {
    if (!walletAddress) return;

    try {
      // Ensure user is on Base mainnet for funding
      await ensureCorrectChain(SUPPORTED_CHAINS.BASE_MAINNET, {
        showPrompt: true,
        autoSwitch: false,
      });

      // Once on correct chain, open funding
      fundWallet(walletAddress);
    } catch (error) {
      console.error('Failed to initiate funding:', error);
      // Could show error toast here
    }
  };

  // Handle viewing wallet - Updated based on actual Privy capabilities
  const handleViewWallet = () => {
    if (hasEmbeddedWallet) {
      // For embedded wallets, open our custom wallet modal
      setIsWalletModalOpen(true);
    } else {
      // For external wallets, open block explorer
      if (walletAddress) {
        const baseUrl = isOnBaseMainnet
          ? 'https://basescan.org/address/'
          : 'https://sepolia.basescan.org/address/';
        window.open(`${baseUrl}${walletAddress}`, '_blank');
      }
    }
  };

  // Handle switching to development chain
  const handleSwitchToTestnet = async () => {
    try {
      await switchToDefault();
    } catch (error) {
      console.error('Failed to switch to testnet:', error);
    }
  };

  const handleSwitchToMainnet = async () => {
    try {
      await switchToFunding();
    } catch (error) {
      console.error('Failed to switch to mainnet:', error);
    }
  };

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick();
    }
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    }
  };

  const handleSellerDashboardClick = () => {
    if (onSellerDashboardClick) {
      onSellerDashboardClick();
    }
  };

  // Get user avatar initial
  const getAvatarInitial = () => {
    if (user?.displayName) {
      return user.displayName[0].toUpperCase();
    }
    if (walletAddress) {
      return walletAddress[2]?.toUpperCase() || 'A';
    }
    return 'A';
  };

  // Get role badge color
  const getRoleBadgeColor = () => {
    if (user?.role === 'ADMIN') return 'text-purple-400';
    if (user?.role === 'SELLER') return 'text-emerald-400';
    return 'text-blue-400';
  };

  // Get chain badge color and icon
  const getChainBadge = () => {
    if (isOnBaseMainnet) {
      return {
        color: 'text-green-400',
        label: 'Base',
        icon: '🟢',
      };
    }
    if (isOnBaseSepolia) {
      return {
        color: 'text-blue-400',
        label: 'Base Sepolia',
        icon: '🔵',
      };
    }
    return {
      color: 'text-red-400',
      label: 'Unknown',
      icon: '🔴',
    };
  };

  // Check if user can access seller dashboard
  const canAccessSellerDashboard = hasRole(['SELLER', 'ADMIN']);
  const isSellerVerified = user?.sellerStatus === 'APPROVED';
  const chainBadge = getChainBadge();

  if (isAuthenticated && user) {
    // Connected Wallet Dropdown
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`flex items-center gap-2 text-[#D0B284] hover:bg-[#D0B284]/20 px-2 py-1 rounded-xl cursor-pointer ${className}`}
              disabled={isLoading}
            >
              <div className="w-8 h-8 rounded-full bg-[#D0B284] flex items-center justify-center text-black text-lg font-bold">
                {user.avatar ? (
                  <Image src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full" />
                ) : (
                  getAvatarInitial()
                )}
              </div>
              <div className="flex flex-col items-start">
                <div className="text-[#D0B284] text-sm font-medium">{displayName}</div>
                <div className="flex items-center gap-1">
                  <div className={`text-xs ${getRoleBadgeColor()}`}>
                    {user.role === 'ADMIN' && '👑 Admin'}
                    {user.role === 'SELLER' && isSellerVerified && '✅ Verified Seller'}
                    {user.role === 'SELLER' && !isSellerVerified && '⏳ Pending Seller'}
                    {user.role === 'TRADER' && '💎 Trader'}
                  </div>
                  <span className="text-[#D0B284]/40">•</span>
                  <div className={`text-xs ${chainBadge.color}`}>
                    {chainBadge.icon} {chainBadge.label}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 ml-1 text-[#D0B284]" />
              <span className="sr-only">Account options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-black border-[#D0B284] min-w-[200px]">
            {/* User Info Header */}
            <div className="px-3 py-2 border-b border-[#D0B284]/20">
              <p className="text-xs text-[#D0B284]/60">Connected Wallet</p>
              <p className="text-xs font-mono text-[#D0B284]">{displayAddress}</p>
              <p className="text-xs text-[#D0B284]/60 mt-1">
                Network: <span className={chainBadge.color}>{currentChain?.name || 'Unknown'}</span>
              </p>
              {hasEmbeddedWallet && <p className="text-xs text-blue-400 mt-1">📧 Email Wallet</p>}
            </div>

            {/* View Wallet */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleViewWallet}
            >
              {hasEmbeddedWallet ? (
                <Eye className="w-4 h-4 mr-2" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              {hasEmbeddedWallet ? 'View Wallet' : 'View on Block Explorer'}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#D0B284]/20" />

            {/* Buy Crypto - Only show on mainnet or with chain switch prompt */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleBuyCrypto}
              disabled={isSwitching}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {!isOnBaseMainnet ? 'Buy Crypto (Switch to Base)' : 'Buy Crypto'}
              {!isOnBaseMainnet && <AlertTriangle className="w-3 h-3 ml-auto text-yellow-400" />}
            </DropdownMenuItem>

            {/* Chain Switching Options */}
            <DropdownMenuSeparator className="bg-[#D0B284]/20" />

            {!isOnBaseSepolia && (
              <DropdownMenuItem
                className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
                onClick={handleSwitchToTestnet}
                disabled={isSwitching}
              >
                <Zap className="w-4 h-4 mr-2" />
                {isSwitching ? 'Switching...' : 'Switch to Base Sepolia'}
                <span className="ml-auto text-xs text-blue-400">Testnet</span>
              </DropdownMenuItem>
            )}

            {!isOnBaseMainnet && (
              <DropdownMenuItem
                className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
                onClick={handleSwitchToMainnet}
                disabled={isSwitching}
              >
                <Zap className="w-4 h-4 mr-2" />
                {isSwitching ? 'Switching...' : 'Switch to Base'}
                <span className="ml-auto text-xs text-green-400">Mainnet</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-[#D0B284]/20" />

            {/* Profile */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleProfileClick}
            >
              <User className="w-4 h-4 mr-2" />
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>

            {/* Seller Dashboard (if available) */}
            {canAccessSellerDashboard && (
              <DropdownMenuItem
                className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
                onClick={handleSellerDashboardClick}
              >
                <Crown className="w-4 h-4 mr-2" />
                Seller Dashboard
                {!isSellerVerified && (
                  <span className="ml-auto text-xs text-orange-400">Verification Required</span>
                )}
              </DropdownMenuItem>
            )}

            {/* Settings */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleSettingsClick}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>

            {/* Admin Dashboard - Only show for admin users */}
            {user?.role === 'ADMIN' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuSeparator className="bg-[#D0B284]" />

            {/* Disconnect */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom Wallet Modal */}
        <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      </>
    );
  }

  // Unauthenticated UI: Connect Wallet Button + Generic User Icon
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        className="flex items-center justify-center text-[#D0B284] hover:bg-[#D0B284]/20 hover:text-[#D0B284] px-4 py-2 rounded-xl"
        disabled={isLoading}
        onClick={handleConnectWallet}
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isLoading ? (
          <div className="flex items-center">
            <span className="mr-2">Connecting</span>
            <span className="animate-pulse">...</span>
          </div>
        ) : (
          'Connect Wallet'
        )}
      </Button>

      {/* Vertical Line */}
      <div className="w-px h-6 bg-[#D0B284] mx-2" />

      {/* Generic User Icon */}
      <CircleUser className="w-6 h-6 text-[#D0B284]" />
    </div>
  );
}
