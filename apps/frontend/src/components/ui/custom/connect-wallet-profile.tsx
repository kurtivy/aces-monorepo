'use client';

import { useState } from 'react';
import { Wallet, CircleUser, ChevronDown } from 'lucide-react';

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

interface ConnectWalletProfileProps {
  className?: string;
  isConnected?: boolean;
  userAddress?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
}

export default function ConnectWalletProfile({
  className = '',
  isConnected = false,
  userAddress,
  onConnect,
  onDisconnect,
  onProfileClick,
  onSettingsClick,
}: ConnectWalletProfileProps) {
  const [isConnectWalletModalOpen, setIsConnectWalletModalOpen] = useState(false);

  // Dummy user data for simulation if no userAddress provided
  const dummyConnectedUser = {
    wallet: {
      address: '0x1235abcdef1234567890', // A dummy address for testing
    },
  };

  const effectiveUser = isConnected
    ? userAddress
      ? { wallet: { address: userAddress } }
      : dummyConnectedUser
    : null;

  const displayAddress = effectiveUser?.wallet?.address
    ? `0x${effectiveUser.wallet.address.slice(2, 6)}` // Abbreviated format like '0x1235'
    : null;

  const handleConnectWallet = () => {
    if (onConnect) {
      onConnect();
    }
    setIsConnectWalletModalOpen(false);
  };

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect();
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

  if (isConnected) {
    // Connected Wallet Dropdown
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`flex items-center gap-2 text-[#D0B284] hover:bg-[#D0B284]/20 px-2 py-1 rounded-xl cursor-pointer ${className}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#D0B284] flex items-center justify-center text-black text-lg font-bold">
              {displayAddress ? displayAddress[2].toUpperCase() : 'A'}
            </div>
            <div className="flex flex-col items-start">
              <div className="text-[#D0B284] font-mono text-base">{displayAddress || '0x0000'}</div>
            </div>
            <ChevronDown className="w-4 h-4 ml-1 text-[#D0B284]" />
            <span className="sr-only">Account options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-black border-[#D0B284]">
          <DropdownMenuItem
            className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
            onClick={handleProfileClick}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
            onClick={handleSettingsClick}
          >
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#D0B284]" />
          <DropdownMenuItem
            className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]"
            onClick={handleDisconnect}
          >
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
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-[#231F20] text-white border-[#D0B284]">
          <DialogHeader>
            <DialogTitle className="text-white">Connect Wallet</DialogTitle>
            <DialogDescription className="text-[#DCDDCC]">
              Choose your preferred wallet to connect.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-[#DCDDCC]">
              This is a simulation. In a real application, this would list wallet options (e.g.,
              MetaMask, WalletConnect).
            </p>
            <Button
              onClick={handleConnectWallet}
              className="bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
            >
              Confirm Connection
            </Button>
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
