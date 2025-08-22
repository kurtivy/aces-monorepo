'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import with fallback to prevent SSR issues
const ICOLaunchPage = dynamic(
  () => import('../../components/new-launch/ico-launch-page'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border border-[#D0B264]/50 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#D0B264] text-xl font-neue-world">Loading ACES ICO...</div>
        </div>
      </div>
    ),
  }
);

export default function NewLaunchPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('🚀 Aceofbase page mounted');
    
    // Add aceofbase-specific global flag to help with contract loading
    if (typeof window !== 'undefined') {
      (window as any).__ACEOFBASE_DOMAIN = true;
    }
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border border-[#D0B264]/50 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[#D0B264] text-xl font-neue-world">Initializing...</div>
        </div>
      </div>
    );
  }

  return <ICOLaunchPage />;
}
