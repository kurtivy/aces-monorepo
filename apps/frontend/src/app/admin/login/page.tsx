'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const { isAuthenticated, isAdmin, connectWallet } = useAuth();
  const {
    isAuthenticated: isAdminAuthenticated,
    isLoading: isAdminLoading,
    login: adminLogin,
    error: adminError,
  } = useAdminAuth();
  const router = useRouter();
  const [adminCredentials, setAdminCredentials] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status and redirect accordingly
  useEffect(() => {
    if (!isAdminLoading) {
      // If both auths are complete, redirect to dashboard
      if (isAdminAuthenticated && isAuthenticated && isAdmin) {
        router.push('/admin/dashboard');
      }
      // If not Privy admin, redirect to unauthorized
      else if (isAuthenticated && !isAdmin) {
        router.push('/admin/unauthorized');
      }
    }
  }, [isAdminAuthenticated, isAuthenticated, isAdmin, isAdminLoading, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Authenticate with Supabase admin credentials
      const result = await adminLogin(adminCredentials.email, adminCredentials.password);

      if (!result.success) {
        setError(result.error || 'Invalid admin credentials. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Step 2: Check if user is also authenticated with Privy and has admin role
      if (!isAuthenticated) {
        setError('Please connect your admin wallet to complete verification.');
        // Trigger wallet connection
        await connectWallet();
        return;
      }

      if (!isAdmin) {
        setError('Your wallet account does not have admin privileges.');
        setIsSubmitting(false);
        return;
      }

      // Both authentications successful - show loading and redirect to dashboard
      setIsRedirecting(true);
      router.push('/admin/dashboard');
    } catch (err) {
      setError('Login failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Loading overlay for redirection */}
      {isRedirecting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-black border border-purple-400/20 rounded-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
            <h3 className="text-white font-libre-caslon text-xl mb-2">Loading Dashboard</h3>
            <p className="text-[#DCDDCC] font-jetbrains">Preparing your admin environment...</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white font-libre-caslon mb-2">Admin Dashboard</h1>
          <p className="text-[#DCDDCC] font-jetbrains">Secure access for authorized personnel</p>
        </div>

        <Card className="bg-black border border-purple-400/20">
          <CardHeader>
            <CardTitle className="text-white font-libre-caslon text-xl">
              Admin Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <p className="text-[#DCDDCC] text-sm font-jetbrains">
                Enter your admin credentials. You&apos;ll also need to connect your admin wallet for
                verification.
              </p>

              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-[#DCDDCC]">
                  Admin Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminCredentials.email}
                  onChange={(e) =>
                    setAdminCredentials((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-black border-purple-400/20 text-white"
                  disabled={isSubmitting || isRedirecting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-[#DCDDCC]">
                  Admin Password
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminCredentials.password}
                  onChange={(e) =>
                    setAdminCredentials((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className="bg-black border-purple-400/20 text-white"
                  disabled={isSubmitting || isRedirecting}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || isRedirecting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redirecting to Dashboard...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Access Dashboard
                  </>
                )}
              </Button>
            </form>

            {(error || adminError) && (
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error || adminError}</span>
              </div>
            )}

            <div className="pt-4 border-t border-purple-400/20">
              <Link href="https://aces.fun" className="block">
                <Button variant="ghost" className="w-full text-[#DCDDCC] hover:bg-purple-400/10">
                  <Home className="w-4 h-4 mr-2" />
                  Return to ACES
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
