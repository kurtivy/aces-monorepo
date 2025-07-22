'use client';

import { useState } from 'react';
import { Wallet, CircleUser, ChevronDown, Crown, Settings, User, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [isConnectWalletModalOpen, setIsConnectWalletModalOpen] = useState(false);

  const {
    isAuthenticated,
    isLoading,
    user,
    walletAddress,
    error,
    connectWallet,
    disconnectWallet,
    hasRole,
  } = useAuth();

  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const displayName = user?.displayName || (displayAddress ? displayAddress : 'User');

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      setIsConnectWalletModalOpen(false);
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

  // Check if user can access seller dashboard
  const canAccessSellerDashboard = hasRole(['SELLER', 'ADMIN']);
  const isSellerVerified = user?.sellerStatus === 'APPROVED';

  if (isAuthenticated && user) {
    // Connected Wallet Dropdown
    return (
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
              <div className={`text-xs ${getRoleBadgeColor()}`}>
                {user.role === 'ADMIN' && '👑 Admin'}
                {user.role === 'SELLER' && isSellerVerified && '✅ Verified Seller'}
                {user.role === 'SELLER' && !isSellerVerified && '⏳ Pending Seller'}
                {user.role === 'TRADER' && '💎 Trader'}
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
          </div>

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
    );
  }

  // Unauthenticated UI: Connect Wallet Button + Generic User Icon
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Connect Wallet Button with Dialog */}
      <Dialog open={isConnectWalletModalOpen} onOpenChange={setIsConnectWalletModalOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center justify-center text-[#D0B284] hover:bg-[#D0B284]/20 hover:text-[#D0B284] px-4 py-2 rounded-xl"
            disabled={isLoading}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-[#231F20] text-white border-[#D0B284]">
          <DialogHeader>
            <DialogTitle className="text-white">Connect Wallet</DialogTitle>
            <DialogDescription className="text-[#DCDDCC]">
              Connect your wallet to access ACES.fun features and start trading RWA tokens.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-[#DCDDCC] text-sm">
                <p className="mb-2">By connecting your wallet, you&apos;ll be able to:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Trade RWA tokens on our platform</li>
                  <li>Create and manage your profile</li>
                  <li>Apply to become a verified seller</li>
                  <li>Access exclusive features</li>
                </ul>
              </div>

              <Button
                onClick={handleConnectWallet}
                className="w-full bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <span className="mr-2">Connecting</span>
                    <span className="animate-pulse">...</span>
                  </div>
                ) : (
                  'Connect with Privy'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vertical Line */}
      <div className="w-px h-6 bg-[#D0B284] mx-2" />

      {/* Generic User Icon */}
      <CircleUser className="w-6 h-6 text-[#D0B284]" />
    </div>
  );
}
