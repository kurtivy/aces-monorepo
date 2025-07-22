'use client';

import OwnerLoginButton from '@/components/ui/custom/owner-login-button';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';

interface ProfileSectionProps {
  // ownerAddress is no longer used in this component
}

export default function ProfileSection({}: ProfileSectionProps) {
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

  function handleSellerDashboardClick(): void {
    throw new Error('Function not implemented.');
  }

  return (
    <div className="bg-black rounded-xl p-2 flex items-center justify-end min-w-[200px] pr-6">
      <div className="flex items-center gap-2">
        {/* Owner Login Button */}
        <OwnerLoginButton onLoginClick={handleOwnerLogin} />

        <div className="w-px h-6 bg-[#D0B284] mx-2" />

        {/* Connect Wallet Profile */}
        <ConnectWalletProfile
          onProfileClick={handleProfileClick}
          onSettingsClick={handleSettingsClick}
          onSellerDashboardClick={handleSellerDashboardClick}
        />
      </div>
    </div>
  );
}
