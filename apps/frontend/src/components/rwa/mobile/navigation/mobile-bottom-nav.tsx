'use client';

import { useEffect, useRef } from 'react';
import { Eye, MessageSquare, Gavel } from 'lucide-react';

interface MobileBottomNavProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const navItems = [
  { id: 'overview', icon: Eye, label: 'Overview' },
  { id: 'comments', icon: MessageSquare, label: 'Stats' },
  { id: 'bids', icon: Gavel, label: 'Auction' },
] as const;

export default function MobileBottomNav({ activeSection, onSectionChange }: MobileBottomNavProps) {
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateNavHeight = () => {
      if (!navRef.current) return;
      const height = navRef.current.offsetHeight;
      document.documentElement.style.setProperty('--mobile-bottom-nav-height', `${height}px`);
    };

    updateNavHeight();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateNavHeight);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateNavHeight);
      }
    };
  }, []);

  return (
    <div
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D0B284]/20 bg-[#151c16]/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-around px-2 py-3 safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'text-[#D0B284] bg-[#D0B284]/10'
                  : 'text-[#D0B284]/60 hover:text-[#D0B284] hover:bg-[#D0B284]/5'
              }`}
            >
              <Icon
                className={`h-5 w-5 mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}
              />
              <span className="text-xs font-medium truncate max-w-[60px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
