'use client';

import { AlertCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminUnauthorizedPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="mb-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2 font-libre-caslon">Access Denied</h1>
          <p className="text-[#DCDDCC] font-jetbrains">
            You don&apos;t have permission to access the admin dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[#DCDDCC]/70 font-jetbrains">
            Admin access is restricted to authorized personnel only.
          </p>

          <Link href="https://aces.fun" className="block">
            <Button
              variant="outline"
              className="w-full border-purple-400 text-purple-400 hover:bg-purple-400/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to ACES
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
