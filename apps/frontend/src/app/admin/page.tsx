'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { Loader2 } from 'lucide-react';

export default function AdminHomePage() {
  const { isAuthenticated: isAdminAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAdminAuthenticated) {
        // Not logged in with Supabase admin - redirect to login
        router.push('/admin/login');
        return;
      }

      // Admin authenticated - redirect to token launch page
      router.push('/admin/token-launch');
    }
  }, [isAdminAuthenticated, isLoading, router]);

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
