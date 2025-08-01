import React from 'react';
import { XIcon, InstagramIcon, TikTokIcon } from './nav-menu';
import { Send } from 'lucide-react';

interface SocialIconsProps {
  className?: string;
  iconSize?: number;
}

const SocialIcons = ({ className = '', iconSize = 20 }: SocialIconsProps) => {
  return (
    <div className={`flex justify-start items-start space-x-6 ${className}`}>
      <a
        href="https://www.instagram.com/acesdotfun/"
        className="text-[#D0B284] hover:text-[#D0B284]/80 transition-colors"
      >
        <XIcon size={iconSize} />
      </a>
      <a
        href="https://www.instagram.com/acesdotfun/"
        className="text-[#D0B284] hover:text-[#D0B284]/80 transition-colors"
      >
        <InstagramIcon size={iconSize} />
      </a>
      <a
        href="https://www.tiktok.com/@acesdotfun"
        className="text-[#D0B284] hover:text-[#D0B284]/80 transition-colors"
      >
        <TikTokIcon size={iconSize} />
      </a>
      <a
        href="https://t.me/acesdotfun/"
        className="text-[#D0B284] hover:text-[#D0B284]/80 transition-colors"
      >
        <Send size={iconSize} />
      </a>
    </div>
  );
};

export default SocialIcons;
