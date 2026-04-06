/**
 * Social media icon links for ACES.fun.
 * Ported from apps/frontend — X, Instagram, TikTok, Telegram.
 */

import { Send } from "lucide-react";

// ── Custom SVG icons ────────────────────────────────

/** X (Twitter) logo */
const XIcon = ({ size = 18 }: { size?: number }) => (
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

/** Instagram logo */
const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

/** TikTok logo */
const TikTokIcon = ({ size = 18 }: { size?: number }) => (
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

// ── Social links config ────────────────────────────

const SOCIAL_LINKS = [
  { href: "https://x.com/acesdotfun", label: "X", icon: XIcon },
  { href: "https://t.me/acesdotfun/", label: "Telegram", icon: Send },
  { href: "https://www.instagram.com/acesdotfun/", label: "Instagram", icon: InstagramIcon },
  { href: "https://www.tiktok.com/@acesdotfun", label: "TikTok", icon: TikTokIcon },
] as const;

// ── Component ──────────────────────────────────────

interface SocialIconsProps {
  className?: string;
  iconSize?: number;
}

export function SocialIcons({ className = "", iconSize = 18 }: SocialIconsProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-platinum-grey/50 hover:text-golden-beige transition-colors"
        >
          <Icon size={iconSize} />
        </a>
      ))}
    </div>
  );
}
