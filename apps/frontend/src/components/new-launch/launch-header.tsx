import Image from 'next/image';
import SocialIcons from '@/components/ui/custom/social-icons';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';
import { useState } from 'react';

export default function LaunchHeader() {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    // In a real app, you'd call Privy's login here: login()
    setIsConnected(true); // Simulate connection
  };

  const handleDisconnect = () => {
    // In a real app, you'd call Privy's logout here: logout()
    setIsConnected(false); // Simulate disconnection
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
    <div className="relative z-10 flex items-center justify-between p-6 w-full overflow-hidden">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
          <Image
            src="/aces-logo.png"
            alt="ACES Logo"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
        </div>
        <div className="flex items-center">
          <span
            className="text-4xl font-bold text-white mr-2"
            style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          >
            ACES.
          </span>
          <span
            className="text-4xl font-bold ml-2"
            style={{
              fontFamily: 'Spray Letters',
              fontWeight: '400',
              letterSpacing: '0.1em',
              color: '#D7BF75',
              textShadow: '0 0 30px rgba(215, 191, 117, 0.2)',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          >
            FUN
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <SocialIcons iconSize={24} />
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
