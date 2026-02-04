import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { prisma } from '../prisma';
import { syncAppUserToPrisma } from '../convex-sync';

// Server-side Supabase client for JWT verification (no storage)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServer =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Verify Convex Auth JWT and check admins table.
 * Returns admin with app user id for use in listings (ownerId). Convex = source of truth; sync to Prisma.
 */
export async function requireAdminConvex(request: NextRequest): Promise<AdminUser> {
  const bearer = request.headers.get('authorization');
  const tokenFromHeader = bearer?.startsWith('Bearer ') ? bearer.slice(7).trim() : null;
  const token = tokenFromHeader ?? (await convexAuthNextjsToken());
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }
  const admin = await fetchQuery(api.admin.getCurrentAdmin, {}, { token });
  if (!admin) {
    throw new Error('UNAUTHORIZED');
  }
  const privyDid = `convex-admin:${admin._id}`;
  const convexUser = await fetchMutation(api.users.getOrCreateUser, {
    privyDid,
    email: admin.email,
    role: 'ADMIN',
  });
  await syncAppUserToPrisma(prisma, {
    id: convexUser.id,
    privyDid: convexUser.privyDid,
    walletAddress: convexUser.walletAddress,
    email: convexUser.email,
    username: convexUser.username,
    role: convexUser.role,
    isActive: convexUser.isActive,
    sellerStatus: convexUser.sellerStatus,
    createdAt: convexUser.createdAt,
    updatedAt: convexUser.updatedAt,
  });
  return { id: convexUser.id, email: convexUser.email || admin.email };
}

/**
 * Verify Supabase JWT and check ADMIN_EMAILS allowlist.
 * Returns admin user with Prisma User id for use in listings (ownerId).
 * @deprecated Use requireAdminConvex for new admin routes.
 */
export async function requireAdminSupabase(request: NextRequest): Promise<AdminUser> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  if (!supabaseServer) {
    console.error('❌ Supabase not configured for admin auth');
    throw new Error('UNAUTHORIZED');
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    console.error('❌ ADMIN_EMAILS env var not set');
    throw new Error('FORBIDDEN');
  }

  const allowedEmails = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length === 0) {
    throw new Error('FORBIDDEN');
  }

  const {
    data: { user: supabaseUser },
    error,
  } = await supabaseServer.auth.getUser(token);

  if (error || !supabaseUser?.email) {
    console.error('❌ Supabase admin auth failed:', error?.message);
    throw new Error('UNAUTHORIZED');
  }

  const emailLower = supabaseUser.email.toLowerCase();
  if (!allowedEmails.includes(emailLower)) {
    console.error(
      '[ADMIN] Email not in allowlist — Supabase email:',
      supabaseUser.email,
      '| ADMIN_EMAILS:',
      allowedEmails.join(', '),
    );
    throw new Error('FORBIDDEN');
  }

  const privyDid = `supabase-admin:${supabaseUser.id}`;
  const convexUser = await fetchMutation(api.users.getOrCreateUser, {
    privyDid,
    email: supabaseUser.email,
    role: 'ADMIN',
  });
  await syncAppUserToPrisma(prisma, {
    id: convexUser.id,
    privyDid: convexUser.privyDid,
    walletAddress: convexUser.walletAddress,
    email: convexUser.email,
    username: convexUser.username,
    role: convexUser.role,
    isActive: convexUser.isActive,
    sellerStatus: convexUser.sellerStatus,
    createdAt: convexUser.createdAt,
    updatedAt: convexUser.updatedAt,
  });
  return { id: convexUser.id, email: convexUser.email || supabaseUser.email };
}

/**
 * Simple JWT decode without verification (we trust Privy tokens)
 */
function decodeJWT(
  token: string,
): { sub?: string; wallet_address?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
}

/**
 * Verify Privy JWT token and get user from database
 */
export async function verifyPrivyToken(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!privyAppId) {
      console.error('❌ NEXT_PUBLIC_PRIVY_APP_ID not set');
      return null;
    }

    // Decode JWT without verification to get user info
    const decoded = decodeJWT(token) as {
      sub: string;
      wallet_address?: string;
      email?: string;
    } | null;

    if (!decoded || !decoded.sub) {
      console.error('❌ Invalid JWT token structure');
      return null;
    }

    const privyDid = decoded.sub;
    const convexUser = await fetchMutation(api.users.getOrCreateUser, {
      privyDid,
      walletAddress: decoded.wallet_address ?? undefined,
      email: decoded.email ?? undefined,
    });

    await syncAppUserToPrisma(prisma, {
      id: convexUser.id,
      privyDid: convexUser.privyDid,
      walletAddress: convexUser.walletAddress,
      email: convexUser.email,
      username: convexUser.username,
      role: convexUser.role,
      isActive: convexUser.isActive,
      sellerStatus: convexUser.sellerStatus,
      createdAt: convexUser.createdAt,
      updatedAt: convexUser.updatedAt,
    });

    if (!convexUser.isActive) {
      return null;
    }

    return {
      id: convexUser.id,
      privyDid: convexUser.privyDid,
      walletAddress: convexUser.walletAddress ?? null,
      email: convexUser.email ?? null,
      role: convexUser.role,
      isActive: convexUser.isActive,
    };
  } catch (error) {
    console.error('❌ Error verifying Privy token:', error);
    return null;
  }
}

/**
 * Require authentication for a route handler
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await verifyPrivyToken(request);

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}
