import Image from 'next/image';
import { InstagramIcon, TikTokIcon, XIcon } from '@/components/ui/custom/nav-menu';
import { Button } from '@/components/ui/button';

export default function LaunchHeader() {
  return (
    <div className="relative z-10 flex items-center justify-between p-6 w-full overflow-hidden">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
          <Image
            src="/aces-logo.png"
            alt="ACES Logo"
            width={64}
            height={64}
            className="w-16 h-16 object-contain"
          />
        </div>
        <div className="flex items-center">
          <span
            className="text-6xl font-bold text-white mr-2"
            style={{ fontFamily: 'var(--font-syne), sans-serif' }}
          >
            ACES.
          </span>
          <span
            className="text-6xl font-bold ml-2"
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
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full shadow-md"
          aria-label="X (Twitter)"
        >
          <XIcon size={32} />
        </a>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full shadow-md"
          aria-label="Instagram"
        >
          <InstagramIcon size={32} />
        </a>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full shadow-md"
          aria-label="TikTok"
        >
          <TikTokIcon size={32} />
        </a>
        <Button className="ml-4 px-8 py-5 rounded-full bg-[#D0B264] text-black font-bold text-lg shadow-md hover:bg-[#D0B264]/80 transition-colors duration-150">
          CONNECT WALLET
        </Button>
      </div>
    </div>
  );
}
