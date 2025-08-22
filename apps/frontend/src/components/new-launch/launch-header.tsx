import { useState } from 'react';
import SocialIcons from '@/components/ui/custom/social-icons';
import LaunchWalletProfile from './launch-wallet-profile';

export default function LaunchHeader() {
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  return (
    <div className="relative z-10 flex items-center justify-between p-6 w-full bg-transparent">
      <div className="flex items-center gap-4">
        <div className="flex items-center">
          <span className="text-2xl font-bold text-white mr-1 font-braah-one">ACES.</span>
          <span className="text-2xl font-bold ml-1 drop-shadow-lg font-spray-letters text-[#D7BF75] tracking-widest">
            TOKEN
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <SocialIcons iconSize={24} />
        <LaunchWalletProfile
          isDropdownOpen={isWalletDropdownOpen}
          onDropdownChange={setIsWalletDropdownOpen}
        />
      </div>
    </div>
  );
}
