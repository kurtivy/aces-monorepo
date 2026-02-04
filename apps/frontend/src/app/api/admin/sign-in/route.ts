import { NextRequest, NextResponse } from 'next/server';
import { fetchAction } from 'convex/nextjs';
import { headers } from 'next/headers';
import { api } from '../../../../../convex/_generated/api';

/**
 * Server-side admin sign-in to avoid CORS 403 from the Convex Auth proxy.
 * Signs in with Convex Auth (email + password) and sets auth cookies.
 */
function isLocalHost(host?: string) {
  return /(localhost|127\.0\.0\.1)(:\d+)?/.test(host ?? '');
}

function cookieNames(host: string) {
  const prefix = isLocalHost(host) ? '' : '__Host-';
  return {
    jwt: prefix + '__convexAuthJWT',
    refresh: prefix + '__convexAuthRefreshToken',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 },
      );
    }

    const result = (await fetchAction(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: email.trim(), password },
    })) as { tokens?: { token: string; refreshToken: string } | null; error?: string };

    if (result?.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (!result?.tokens) {
      return NextResponse.json(
        { success: false, error: 'Sign-in did not complete. Check your credentials.' },
        { status: 400 },
      );
    }

    const host = (await headers()).get('host') ?? '';
    const names = cookieNames(host);
    const secure = !isLocalHost(host);
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure,
    };

    const response = NextResponse.json({
      success: true,
      tokens: { token: result.tokens.token, refreshToken: 'dummy' },
    });
    response.cookies.set(names.jwt, result.tokens.token, cookieOptions);
    response.cookies.set(names.refresh, result.tokens.refreshToken, cookieOptions);

    return response;
  } catch (err) {
    console.error('[admin/sign-in]', err);
    const raw = err instanceof Error ? err.message : 'Sign-in failed';
    const message =
      raw.includes('InvalidSecret') || raw.toLowerCase().includes('invalid')
        ? 'Invalid email or password.'
        : raw;
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
