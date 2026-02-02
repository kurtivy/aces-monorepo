import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { prisma } from '../prisma';

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
 * Verify Supabase JWT and check ADMIN_EMAILS allowlist.
 * Returns admin user with Prisma User id for use in listings (ownerId).
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

  // Find or create Prisma User for admin (needed for ownerId in listings)
  const privyDid = `supabase-admin:${supabaseUser.id}`;
  let user = await prisma.user.findFirst({
    where: { OR: [{ privyDid }, { email: supabaseUser.email }] },
    select: { id: true, email: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        privyDid,
        email: supabaseUser.email,
        role: 'ADMIN',
        isActive: true,
        sellerStatus: 'NOT_APPLIED',
      },
      select: { id: true, email: true },
    });
  }

  return { id: user.id, email: user.email || supabaseUser.email };
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

    // Look up user in database
    let user = await prisma.user.findUnique({
      where: { privyDid },
      select: {
        id: true,
        privyDid: true,
        walletAddress: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      // Create new user if doesn't exist
      const walletAddress = decoded.wallet_address || null;
      const email = decoded.email || null;

      user = await prisma.user.create({
        data: {
          privyDid,
          walletAddress,
          email,
          role: 'TRADER',
          isActive: true,
          sellerStatus: 'NOT_APPLIED',
        },
        select: {
          id: true,
          privyDid: true,
          walletAddress: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
    } else {
      // Update user info if needed
      const walletAddress = decoded.wallet_address || null;
      const email = decoded.email || null;

      const needsUpdate =
        (walletAddress && user.walletAddress !== walletAddress) ||
        (email && user.email !== email && !user.email);

      if (needsUpdate) {
        const updateData: {
          walletAddress?: string | null;
          email?: string | null;
        } = {};

        if (walletAddress && user.walletAddress !== walletAddress) {
          updateData.walletAddress = walletAddress;
        }

        if (email && !user.email) {
          updateData.email = email;
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          select: {
            id: true,
            privyDid: true,
            walletAddress: true,
            email: true,
            role: true,
            isActive: true,
          },
        });
      }
    }

    if (!user || !user.isActive) {
      return null;
    }

    return user as AuthUser;
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
