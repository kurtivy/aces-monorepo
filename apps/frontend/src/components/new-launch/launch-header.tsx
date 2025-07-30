import Image from 'next/image';
import { useRouter } from 'next/navigation';
import SocialIcons from '@/components/ui/custom/social-icons';
import ConnectWalletNav from '@/components/ui/custom/connect-wallet-nav';

export default function LaunchHeader() {
  const router = useRouter();

  const handleProfileClick = () => {
    router.push('/profile');
  };

  return (
    <div className="relative z-10 flex items-center justify-between p-6 w-full bg-transparent">
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
        <ConnectWalletNav onProfileClick={handleProfileClick} />
      </div>
    </div>
  );
}
