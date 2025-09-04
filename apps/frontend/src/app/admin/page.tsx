'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2 } from 'lucide-react';

export default function AdminHomePage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Not logged in with Privy - redirect to login
        router.push('/admin/login');
        return;
      }

      if (!isAdmin) {
        // Logged in but not admin - show error
        router.push('/admin/unauthorized');
        return;
      }

      // Admin user - redirect to dashboard
      router.push('/admin/dashboard');
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-[#DCDDCC] font-jetbrains">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return null;
}
