'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle, Home, UserPlus } from 'lucide-react';
import Link from 'next/link';

type Mode = 'signIn' | 'signUp';

export default function AdminLoginPage() {
  const {
    isAuthenticated: isAdminAuthenticated,
    isLoading: isAdminLoading,
    login: adminLogin,
    signUp: adminSignUp,
    error: adminError,
  } = useAdminAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signIn');
  const [adminCredentials, setAdminCredentials] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Redirect only when already authenticated (e.g. landed with session); avoid double-redirect after form submit
  useEffect(() => {
    if (!isAdminLoading && isAdminAuthenticated && !isSubmitting) {
      router.replace('/admin/token-launch');
    }
  }, [isAdminAuthenticated, isAdminLoading, isSubmitting, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSignUpSuccess(false);

    try {
      const action = mode === 'signUp' ? adminSignUp : adminLogin;
      const result = await action(adminCredentials.email, adminCredentials.password);

      if (!result.success) {
        setError(result.error || 'Something went wrong. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (mode === 'signUp') {
        setSignUpSuccess(true);
        setIsSubmitting(false);
        return;
      }

      // Ensure the browser has committed the Set-Cookie from the response before navigating
      setIsRedirecting(true);
      await new Promise((r) => setTimeout(r, 150));
      window.location.assign('/admin/token-launch');
    } catch (err) {
      setError(
        mode === 'signUp' ? 'Sign-up failed. Please try again.' : 'Login failed. Please try again.',
      );
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
            <h3 className="text-white font-libre-caslon text-xl mb-2">Loading Token Launch</h3>
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
            {/* Sign up success: remind to run seedAdmin */}
            {signUpSuccess && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                <p className="font-medium">Account created</p>
                <p className="mt-1 text-[#DCDDCC]">
                  To get admin access, run the <strong>seedAdmin</strong> mutation in the Convex
                  dashboard with your email, then sign in below.
                </p>
                <p className="mt-1 text-xs text-[#DCDDCC]/80">
                  Dashboard → Functions → admin:seedAdmin → Run with{' '}
                  {`{ "email": "${adminCredentials.email}" }`}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-[#DCDDCC] text-sm font-jetbrains">
                {mode === 'signUp'
                  ? 'Create a Convex Auth account. After this, run seedAdmin in the Convex dashboard with your email to get admin access.'
                  : 'Enter your admin credentials to access the dashboard.'}
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
                    Redirecting to Token Launch...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === 'signUp' ? 'Creating account...' : 'Authenticating...'}
                  </>
                ) : mode === 'signUp' ? (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create account
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Access Dashboard
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                    setError(null);
                    setSignUpSuccess(false);
                  }}
                  className="text-sm text-purple-400 hover:text-purple-300 font-jetbrains"
                >
                  {mode === 'signIn' ? 'Create an account instead' : 'Sign in instead'}
                </button>
              </div>
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
