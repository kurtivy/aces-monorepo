'use client';

import type React from 'react';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, CreditCard, AlertTriangle, Eye, ExternalLink, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useFundWallet } from '@privy-io/react-auth';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import { usePrivyWallet } from '@/hooks/use-privy-wallet';
import { WalletModal } from '@/components/wallet/wallet-modal';
import ChainSwitchModal from '@/components/ui/custom/chain-switch-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CustomAvatar } from '@/components/ui/custom/custom-avatar';
import Image from 'next/image';

interface ConnectWalletProfileProps {
  className?: string;
  // onProfileClick?: () => void;
  isDropdownOpen?: boolean;
  onDropdownChange?: (isOpen: boolean) => void;
}

export default function ConnectWalletProfile({
  className = '',
  // onProfileClick,
  isDropdownOpen,
  onDropdownChange,
}: ConnectWalletProfileProps) {
  const {
    isAuthenticated,
    isLoading,
    user,
    walletAddress,
    connectWallet,
    disconnectWallet,
    hasExternalWallet,
  } = useAuth();

  const { fundWallet } = useFundWallet();
  const { isOnBaseMainnet, isSwitching, ensureCorrectChain, SUPPORTED_CHAINS } =
    useChainSwitching();
  const { hasEmbeddedWallet } = usePrivyWallet();

  // Local state for wallet modal and chain switching
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showChainSwitchModal, setShowChainSwitchModal] = useState(false);
  const [chainSwitchTarget, setChainSwitchTarget] = useState<{ name: string; id: number } | null>(
    null,
  );

  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

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
      // Check if this is a chain switch requirement
      if (error instanceof Error && error.message.startsWith('CHAIN_SWITCH_REQUIRED:')) {
        const [, chainName, chainId] = error.message.split(':');
        setChainSwitchTarget({ name: chainName, id: parseInt(chainId) });
        setShowChainSwitchModal(true);
      } else {
        console.error('Failed to initiate funding:', error);
        // Could show error toast here
      }
    }
  };

  // Handle chain switch from modal
  const handleChainSwitch = async () => {
    if (!chainSwitchTarget) return;

    try {
      await ensureCorrectChain(SUPPORTED_CHAINS.BASE_MAINNET, {
        showPrompt: false,
        autoSwitch: true,
      });

      setShowChainSwitchModal(false);
      setChainSwitchTarget(null);

      // After successful switch, try funding again
      if (walletAddress) {
        fundWallet(walletAddress);
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
      // Keep modal open, maybe show error
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

  // const handleProfileClick = () => {
  //   if (onProfileClick) {
  //     onProfileClick();
  //   }
  // };

  // Handle copying wallet address to clipboard
  const handleCopyAddress = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setIsCopied(true);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  // Get avatar variant based on user role and status
  const getAvatarVariant = () => {
    if (user?.role === 'ADMIN') return 'dramatic-contrast';
    if (user?.role === 'SELLER' && user?.sellerStatus === 'APPROVED') return 'brand-fusion';
    if (user?.role === 'SELLER') return 'golden-luxury';
    return 'golden-flow'; // Default for traders and others
  };

  if (isAuthenticated) {
    // Connected Wallet Dropdown (show immediately when Privy auth succeeds)
    return (
      <div className={className}>
        <DropdownMenu open={isDropdownOpen} onOpenChange={onDropdownChange}>
          <DropdownMenuTrigger asChild>
            <Button
              className="flex items-center gap-2 text-[#D0B264] bg-black hover:bg-black/80 border border-dashed border-[#D0B264]/30 hover:border-[#D0B264]/60 hover:text-[#D0B264] transition-colors duration-150 px-2 py-2 rounded-md group"
              disabled={isLoading}
            >
              {/* Custom Avatar Component */}
              {user?.avatar ? (
                <div className="relative w-10 h-10 z-10">
                  <CustomAvatar
                    variant={getAvatarVariant()}
                    size="sm"
                    className="cursor-pointer w-10 h-10"
                  />
                  <Image
                    src={user.avatar || '/placeholder.svg'}
                    alt="Avatar"
                    className="absolute inset-0 w-6 h-6 rounded-full object-cover"
                    width={24}
                    height={24}
                  />
                </div>
              ) : (
                <div className="z-10">
                  <CustomAvatar
                    variant={getAvatarVariant()}
                    size="sm"
                    className="cursor-pointer w-6 h-6"
                  />
                </div>
              )}

              <div className="flex flex-col items-start min-w-0 pl-2">
                <div className="text-[#D0B264] text-sm font-medium truncate max-w-[120px]">
                  {displayAddress || (isLoading ? 'Loading...' : 'No address')}
                </div>
              </div>
              <span className="sr-only">Account options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-black border-[#D0B264]/30 min-w-[200px]">
            {/* User Info Header */}
            <div
              className="px-3 py-2 border-b border-[#D0B264]/20 cursor-pointer hover:bg-[#D0B264]/5 transition-colors duration-150"
              onClick={handleCopyAddress}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#D0B264]/60">Connected Wallet</p>
                  <p className="text-xs font-mono text-[#D0B264]">
                    {displayAddress || (isLoading ? 'Loading...' : 'No address')}
                  </p>
                </div>
                <div className="flex items-center">
                  {isCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#D0B264]/60 hover:text-[#D0B264] transition-colors duration-150" />
                  )}
                </div>
              </div>
            </div>

            {/* View Wallet */}
            <DropdownMenuItem
              className="!text-[#D0B264] hover:!text-white hover:!bg-[#D0B264]/10 transition-colors duration-150 cursor-pointer group text-sm font-medium uppercase tracking-wide whitespace-nowrap rounded-md px-2 py-1.5"
              onClick={handleViewWallet}
            >
              {hasEmbeddedWallet ? (
                <Eye className="w-4 h-4 mr-2 text-[#D0B264] group-hover:text-white transition-colors duration-150 " />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2 text-[#D0B264] group-hover:text-white transition-colors duration-150" />
              )}
              {hasEmbeddedWallet ? 'View Wallet' : 'View on Block Explorer'}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#D0B264]/20" />

            {/* Buy Crypto - Only show on mainnet or with chain switch prompt */}
            <DropdownMenuItem
              className="!text-[#D0B264] hover:!text-white hover:!bg-[#D0B264]/10 transition-colors duration-150 cursor-pointer group text-sm font-medium uppercase tracking-wide whitespace-nowrap rounded-md px-2 py-1.5"
              onClick={handleBuyCrypto}
              disabled={isSwitching}
            >
              <CreditCard className="w-4 h-4 mr-2 text-[#D0B264] group-hover:text-white transition-colors duration-150" />
              {!isOnBaseMainnet ? 'Buy Crypto (Switch to Base)' : 'Buy Crypto'}
              {!isOnBaseMainnet && <AlertTriangle className="w-3 h-3 ml-auto text-yellow-400" />}
            </DropdownMenuItem>

            {/* Profile */}
            {/* <DropdownMenuItem
              className="!text-[#D0B264] hover:!text-white hover:!bg-[#D0B264]/10 transition-colors duration-150 cursor-pointer group text-sm font-medium uppercase tracking-wide whitespace-nowrap rounded-md px-2 py-1.5"
              onClick={handleProfileClick}
            >
              <User className="w-4 h-4 mr-2 text-[#D0B264] group-hover:text-white transition-colors duration-150" />
              <Link href="/profile">{isLoading && !user ? 'Loading...' : 'Profile'}</Link>
            </DropdownMenuItem> */}

            <DropdownMenuSeparator className="bg-[#D0B264]/20" />

            {/* Disconnect */}
            <DropdownMenuItem
              className="!text-[#D0B264] hover:!text-white hover:!bg-[#D0B264]/10 transition-colors duration-150 cursor-pointer group text-sm font-medium uppercase tracking-wide whitespace-nowrap rounded-md px-2 py-1.5"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              <Wallet className="w-4 h-4 mr-2 text-[#D0B264] group-hover:text-white transition-colors duration-150" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Custom Wallet Modal */}
        <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

        {/* Chain Switch Modal */}
        <ChainSwitchModal
          isOpen={showChainSwitchModal}
          onClose={() => {
            setShowChainSwitchModal(false);
            setChainSwitchTarget(null);
          }}
          onSwitch={handleChainSwitch}
          currentChainName="Current Network"
          targetChainName={chainSwitchTarget?.name || 'Base Mainnet'}
          isSwitching={isSwitching}
          showSkipOption={false}
        />
      </div>
    );
  }

  // Unauthenticated UI: Connect Wallet Button
  return (
    <div className={className}>
      <motion.button
        className="flex items-center justify-center text-[#D0B264] hover:text-[#D0B264] transition-colors duration-150 px-4 py-2 rounded-md bg-black/80 hover:bg-black/70 border border-[#D0B264]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono whitespace-nowrap"
        disabled={isLoading}
        onClick={handleConnectWallet}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isLoading ? (
          <div className="flex items-center font-mono">
            <span className="mr-2">Connecting</span>
            <span className="animate-pulse">...</span>
          </div>
        ) : hasExternalWallet ? (
          'Connect Wallet'
        ) : (
          'Connect Wallet'
        )}
      </motion.button>
    </div>
  );
}
