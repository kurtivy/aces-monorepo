'use client';

import { useState } from 'react';

import OwnerLoginButton from '@/components/ui/custom/owner-login-button';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';

interface ProfileSectionProps {
  // ownerAddress is no longer used in this component
}

export default function ProfileSection({}: ProfileSectionProps) {
  // Local state for dummy connection simulation
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    // In a real app, you'd call Privy's login here: login()
    setIsConnected(true); // Simulate connection
  };

  const handleDisconnect = () => {
    // In a real app, you'd call Privy's logout here: logout()
    setIsConnected(false); // Simulate disconnection
  };

  const handleOwnerLogin = () => {
    // Handle owner login logic here
    console.log('Owner login clicked');
  };

  const handleProfileClick = () => {
    // Handle profile click logic here
    console.log('Profile clicked');
  };

  const handleSettingsClick = () => {
    // Handle settings click logic here
    console.log('Settings clicked');
  };

  return (
    <div className="bg-black rounded-xl p-2 flex items-center justify-end min-w-[200px] pr-6">
      <div className="flex items-center gap-2">
        {/* Owner Login Button */}
        <OwnerLoginButton onLoginClick={handleOwnerLogin} />

        <div className="w-px h-6 bg-[#D0B284] mx-2" />

        {/* Connect Wallet Profile */}
        <ConnectWalletProfile
          isConnected={isConnected}
          userAddress={isConnected ? '0x1235abcdef1234567890' : undefined}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onProfileClick={handleProfileClick}
          onSettingsClick={handleSettingsClick}
        />
      </div>
    </div>
  );
}
