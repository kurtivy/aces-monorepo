'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Menu,
  X,
  Send,
  Wallet,
  User,
  CreditCard,
  AlertTriangle,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useFundWallet } from '@privy-io/react-auth';
import { useChainSwitching } from '@/hooks/use-chain-switching';
import { usePrivyWallet } from '@/hooks/use-privy-wallet';
import { WalletModal } from '@/components/wallet/wallet-modal';
import { getDeviceCapabilities } from '../../../lib/utils/browser-utils';

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

// Custom X logo component (modern Twitter/X logo)
export const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Custom Instagram logo component
export const InstagramIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// Custom TikTok logo component
export const TikTokIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.16 20.5a6.33 6.33 0 0 0 10.86-4.43V7.83a8.24 8.24 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.2-.26z" />
  </svg>
);

// Main navigation items
const mainNavItems = [
  { href: '/create-token', label: 'Create Token', external: false, action: 'navigate' },
  { href: '/about', label: 'About', external: false, action: 'modal' },
  { href: '/terms', label: 'Terms & PP', external: false, action: 'modal' },
];

// Social links as icons in footer section
const socialLinks = [
  { href: 'https://x.com/acesdotfun', label: 'X (Twitter)', external: true, icon: XIcon },
  { href: 'https://t.me/acesdotfun/', label: 'Telegram', external: true, icon: Send },
  {
    href: 'https://www.instagram.com/acesdotfun/',
    label: 'Instagram',
    external: true,
    icon: InstagramIcon,
  },
  { href: 'https://www.tiktok.com/@acesdotfun', label: 'TikTok', external: true, icon: TikTokIcon },
];

// Compact animations for the smaller nav menu
const compactMenuVariants: Variants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: 'easeInOut',
    },
  },
  open: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const compactNavItemVariants: Variants = {
  closed: {
    opacity: 0,
    y: -10,
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

interface ConnectWalletProfileProps {
  className?: string;
  onProfileClick?: () => void;
  onAboutClick?: () => void;
  onTermsClick?: () => void;
}

export default function ConnectWalletProfile({
  className = '',
  onProfileClick,
  onAboutClick,
  onTermsClick,
}: ConnectWalletProfileProps) {
  const { isAuthenticated, isLoading, user, walletAddress, connectWallet, disconnectWallet } =
    useAuth();

  const { fundWallet } = useFundWallet();

  const {
    currentChain,
    isOnBaseMainnet,
    isOnBaseSepolia,
    isSwitching,
    ensureCorrectChain,
    SUPPORTED_CHAINS,
  } = useChainSwitching();

  const { hasEmbeddedWallet } = usePrivyWallet();

  // Local state for navigation menu and wallet modal
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Smart mobile detection using existing device capabilities
  const isMobileDevice = useMemo(() => {
    const capabilities = getDeviceCapabilities();
    return capabilities.touchCapable || capabilities.isMobileSafari;
  }, []);

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

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick();
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

  const isSellerVerified = user?.sellerStatus === 'APPROVED';
  const chainBadge = getChainBadge();

  if (isAuthenticated && user) {
    // Connected Wallet Dropdown + Navigation Menu
    return (
      <div className={`flex items-center gap-2 relative ${className}`}>
        {/* Wallet Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-[#D0B284] hover:bg-[#D0B284]/20 px-2 py-1 rounded-xl cursor-pointer"
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

            {/* Profile */}
            <DropdownMenuItem
              className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
              onClick={handleProfileClick}
            >
              <User className="w-4 h-4 mr-2" />
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>

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

        {/* Vertical Line */}
        <div className="w-px h-6 bg-[#D0B284] mx-2" />

        {/* Compact Navigation Menu */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {isNavOpen && (
              <motion.div
                className="absolute top-12 right-0 bg-black/95 border border-[#D0B264]/40 text-[#D0B264] rounded-lg overflow-hidden shadow-lg min-w-[180px] z-50"
                variants={compactMenuVariants}
                initial="closed"
                animate="open"
                exit="closed"
                style={{
                  willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
                }}
              >
                <div className="p-3">
                  {/* Main Navigation Items */}
                  <div className="space-y-1 border-b border-[#D0B264]/20 mb-3 pb-3">
                    {mainNavItems.map((item, index) => (
                      <motion.div
                        key={item.href}
                        variants={compactNavItemVariants}
                        custom={index}
                        style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                      >
                        {item.external ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setIsNavOpen(false)}
                            className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                          >
                            {item.label}
                          </a>
                        ) : item.action === 'modal' ? (
                          <button
                            onClick={() => {
                              setIsNavOpen(false);
                              if (item.href === '/about' && onAboutClick) {
                                onAboutClick();
                              } else if (item.href === '/terms' && onTermsClick) {
                                onTermsClick();
                              }
                            }}
                            className="block w-full text-left text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                          >
                            {item.label}
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => setIsNavOpen(false)}
                            className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                          >
                            {item.label}
                          </Link>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Social Links Footer */}
                  <div>
                    <div className="flex justify-center space-x-3">
                      {socialLinks.map((social, index) => {
                        const IconComponent = social.icon;
                        return (
                          <motion.div
                            key={social.href}
                            variants={compactNavItemVariants}
                            custom={mainNavItems.length + index}
                            style={{
                              willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
                            }}
                          >
                            <a
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setIsNavOpen(false)}
                              className="flex items-center justify-center w-8 h-8 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full"
                              aria-label={social.label}
                            >
                              <IconComponent size={14} />
                            </a>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compact Hamburger Menu Button */}
          <motion.button
            className="w-10 h-10 bg-black/90 border border-[#D0B284]/40 text-[#D0B284] hover:text-white hover:bg-black/95 hover:border-[#D0B284] transition-colors duration-150 flex items-center justify-center rounded-full shadow-lg"
            onClick={() => setIsNavOpen(!isNavOpen)}
            whileHover={isMobileDevice ? undefined : { scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={
              isMobileDevice ? { duration: 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }
            }
            style={{ willChange: 'transform' }}
          >
            <motion.div
              animate={{ rotate: isNavOpen ? 90 : 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ willChange: 'transform' }}
            >
              {isNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.div>
          </motion.button>
        </div>

        {/* Custom Wallet Modal */}
        <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      </div>
    );
  }

  // Unauthenticated UI: Connect Wallet Button + Vertical Line + Compact Nav Menu
  return (
    <div className={`flex items-center gap-2 relative ${className}`}>
      {/* Connect Wallet Button */}
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

      {/* Compact Navigation Menu */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {isNavOpen && (
            <motion.div
              className="absolute top-8 right-0 bg-black/95 border border-[#D0B264]/40 text-[#D0B264] rounded-lg overflow-hidden shadow-lg min-w-[180px] z-50"
              variants={compactMenuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              style={{
                willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
              }}
            >
              <div className="p-3">
                {/* Main Navigation Items */}
                <div className="space-y-1 border-b border-[#D0B264]/20 mb-3 pb-3">
                  {mainNavItems.map((item, index) => (
                    <motion.div
                      key={item.href}
                      variants={compactNavItemVariants}
                      custom={index}
                      style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                    >
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsNavOpen(false)}
                          className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                        >
                          {item.label}
                        </a>
                      ) : item.action === 'modal' ? (
                        <button
                          onClick={() => {
                            setIsNavOpen(false);
                            if (item.href === '/about' && onAboutClick) {
                              onAboutClick();
                            } else if (item.href === '/terms' && onTermsClick) {
                              onTermsClick();
                            }
                          }}
                          className="block w-full text-left text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setIsNavOpen(false)}
                          className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                        >
                          {item.label}
                        </Link>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Social Links Footer */}
                <div>
                  <div className="flex justify-center space-x-3">
                    {socialLinks.map((social, index) => {
                      const IconComponent = social.icon;
                      return (
                        <motion.div
                          key={social.href}
                          variants={compactNavItemVariants}
                          custom={mainNavItems.length + index}
                          style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                        >
                          <a
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setIsNavOpen(false)}
                            className="flex items-center justify-center w-8 h-8 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full"
                            aria-label={social.label}
                          >
                            <IconComponent size={14} />
                          </a>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Hamburger Menu Button */}
        <motion.button
          className="w-10 h-10 bg-black/90 border border-[#D0B284]/40 text-[#D0B284] hover:text-white hover:bg-black/95 hover:border-[#D0B284] transition-colors duration-150 flex items-center justify-center rounded-full shadow-lg"
          onClick={() => setIsNavOpen(!isNavOpen)}
          whileHover={isMobileDevice ? undefined : { scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={
            isMobileDevice ? { duration: 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }
          }
          style={{ willChange: 'transform' }}
        >
          <motion.div
            animate={{ rotate: isNavOpen ? 90 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ willChange: 'transform' }}
          >
            {isNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
}
