'use client';

import { useEffect } from 'react';
import ICOLaunchPage from '../../components/new-launch/ico-launch-page';

export default function NewLaunchPage() {
  useEffect(() => {
    console.log('🚀 Aceofbase page mounted');

    // Add aceofbase-specific global flag to help with contract loading
    if (typeof window !== 'undefined') {
      (window as any).__ACEOFBASE_DOMAIN = true;
    }
  }, []);

  return <ICOLaunchPage />;
}
