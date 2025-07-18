'use client';

import { useState } from 'react';
import { Wallet, CircleUser, ChevronDown, KeySquare } from 'lucide-react';

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

interface ProfileSectionProps {
  ownerAddress?: string;
}

export default function ProfileSection({ ownerAddress }: ProfileSectionProps) {
  // Local state for dummy connection simulation
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectWalletModalOpen, setIsConnectWalletModalOpen] = useState(false);
  const [isOwnerLoginModalOpen, setIsOwnerLoginModalOpen] = useState(false);

  // Dummy user data for simulation
  const dummyConnectedUser = {
    wallet: {
      address: '0x1235abcdef1234567890', // A dummy address for testing
    },
  };

  // Use only local dummy state for authentication
  const effectiveAuthenticated = isConnected;
  const effectiveUser = isConnected ? dummyConnectedUser : null;

  const displayAddress = effectiveUser?.wallet?.address
    ? `0x${effectiveUser.wallet.address.slice(2, 6)}` // Abbreviated format like '0x1235'
    : ownerAddress
      ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` // Full address for owner display
      : null;

  const handleConnectWallet = () => {
    // In a real app, you'd call Privy's login here: login()
    setIsConnected(true); // Simulate connection
    setIsConnectWalletModalOpen(false); // Close the modal
  };

  const handleDisconnect = () => {
    // In a real app, you'd call Privy's logout here: logout()
    setIsConnected(false); // Simulate disconnection
  };

  return (
    <div className="bg-black rounded-xl p-2 flex items-center justify-end min-w-[200px] pr-6">
      {effectiveAuthenticated ? (
        // Authenticated UI: Connected Wallet + Owner Login Button
        <div className="flex items-center gap-2">
          {/* Owner Login Button with Dialog */}
          <Dialog open={isOwnerLoginModalOpen} onOpenChange={setIsOwnerLoginModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-[#D0B284] border border-[#D0B284] hover:bg-[#D0B284]/20 hover:text-[#D0B284] px-4 py-2 rounded-xl"
              >
                <KeySquare className="w-4 h-4 mr-2 text-[#D0B284]" />
                Owner Login
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#231F20] text-white border-[#D0B284]">
              <DialogHeader>
                <DialogTitle className="text-white">Owner Login</DialogTitle>
                <DialogDescription className="text-[#DCDDCC]">
                  This is a placeholder for the owner login screen.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-[#DCDDCC]">Please proceed to the dedicated owner login page.</p>
                <Button
                  onClick={() => setIsOwnerLoginModalOpen(false)}
                  className="bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
                >
                  Close
                </Button>
                {/* You might add a Link or router.push here to navigate to the actual login page */}
              </div>
            </DialogContent>
          </Dialog>

          <div className="w-px h-6 bg-[#D0B284] mx-2" />
          {/* Connected Wallet Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-[#D0B284] hover:bg-[#D0B284]/20 px-2 py-1 rounded-xl cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#D0B284] flex items-center justify-center text-black text-lg font-bold">
                  {displayAddress ? displayAddress[2].toUpperCase() : 'A'}
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-[#D0B284] font-mono text-base">
                    {displayAddress || '0x0000'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 ml-1 text-[#D0B284]" />
                <span className="sr-only">Account options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black border-[#D0B284]">
              <DropdownMenuItem className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]">
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-[#D0B284]/20 cursor-pointer text-[#D0B284] hover:text-[#D0B284]">
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
        </div>
      ) : (
        // Unauthenticated UI: Generic User Icon + Vertical Line + Connect Wallet Button + Owner Login Button
        <div className="flex items-center gap-2">
          {/* Owner Login Button with Dialog */}
          <Dialog open={isOwnerLoginModalOpen} onOpenChange={setIsOwnerLoginModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-[#D0B284] border border-[#D0B284] hover:bg-[#D0B284]/20 hover:text-[#D0B284] px-4 py-2 rounded-xl"
              >
                <KeySquare className="w-4 h-4 mr-2 text-[#D0B284]" />
                Owner Login
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[#231F20] text-white border-[#D0B284]">
              <DialogHeader>
                <DialogTitle className="text-white">Owner Login</DialogTitle>
                <DialogDescription className="text-[#DCDDCC]">
                  This is a placeholder for the owner login screen.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-[#DCDDCC]">Please proceed to the dedicated owner login page.</p>
                <Button
                  onClick={() => setIsOwnerLoginModalOpen(false)}
                  className="bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
                >
                  Close
                </Button>
                {/* You might add a Link or router.push here to navigate to the actual login page */}
              </div>
            </DialogContent>
          </Dialog>

          <div className="w-px h-6 bg-[#D0B284] mx-2" />

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
      )}
    </div>
  );
}
