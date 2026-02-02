import { createClient } from '@supabase/supabase-js';

// Admin-specific Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Admin authentication will not work.');
}

// Create Supabase client specifically for admin authentication
export const supabaseAdmin =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // Use a separate storage key for admin auth to avoid conflicts with main auth
          storageKey: 'sb-admin-auth',
          autoRefreshToken: true,
          persistSession: true, // Persist so session survives navigation and token-launch can verify
          detectSessionInUrl: false,
        },
      })
    : null;

// Admin authentication functions
export interface AdminAuthResult {
  success: boolean;
  error?: string;
  user?: any;
}

export async function signInAdmin(email: string, password: string): Promise<AdminAuthResult> {
  if (!supabaseAdmin) {
    return {
      success: false,
      error: 'Admin authentication not configured',
    };
  }

  try {
    console.log('🔐 Attempting admin login with email:', email);

    // Clear any existing session first for fresh logins (non-persistent sessions)
    await supabaseAdmin.auth.signOut();

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Supabase auth error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'No user returned from authentication',
      };
    }

    console.log('✅ Admin login successful:', data.user.email);
    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    console.error('❌ Admin login exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function signOutAdmin(): Promise<void> {
  if (supabaseAdmin) {
    await supabaseAdmin.auth.signOut();
    // Also clear from localStorage if needed
    localStorage.removeItem('admin-auth-token');
  }
}

export async function getCurrentAdminUser() {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

// Check if current user is authenticated admin
export async function isAdminAuthenticated(): Promise<boolean> {
  const user = await getCurrentAdminUser();
  return !!user;
}

/**
 * Get Supabase session access token for API calls.
 * Returns null if no active admin session (client-side only).
 */
export async function getAdminAccessToken(): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabaseAdmin.auth.getSession();

    if (error || !session?.access_token) {
      return null;
    }

    return session.access_token;
  } catch {
    return null;
  }
}

// Optional: Clear admin session on app start for security
export function clearAdminSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin-auth-token');
  }
}

export default supabaseAdmin;
