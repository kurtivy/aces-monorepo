import { NextRequest, NextResponse } from 'next/server';
import { fetchAction } from 'convex/nextjs';
import { headers } from 'next/headers';
import { api } from '../../../../../convex/_generated/api';

/**
 * Server-side admin account creation to avoid CORS 403 from the Convex Auth proxy.
 * Creates a Convex Auth user (email + password) and sets auth cookies so the client is logged in.
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
  const body = await request.json().catch(() => ({}));
  const email = (body as { email?: string }).email;
  const password = (body as { password?: string }).password;
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Email and password required' },
      { status: 400 },
    );
  }

  try {
    let result = (await fetchAction(api.auth.signIn, {
      provider: 'password',
      params: { flow: 'signUp', email: email.trim(), password },
    })) as { tokens?: { token: string; refreshToken: string } | null; error?: string };

    // Account already exists: try sign-in with same credentials and log them in
    if (result?.error?.toLowerCase().includes('already exists')) {
      result = (await fetchAction(api.auth.signIn, {
        provider: 'password',
        params: { flow: 'signIn', email: email.trim(), password },
      })) as { tokens?: { token: string; refreshToken: string } | null; error?: string };
      if (!result?.tokens) {
        return NextResponse.json(
          { success: false, error: 'This email already has an account. Use Sign in instead.' },
          { status: 400 },
        );
      }
    } else if (result?.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (!result?.tokens) {
      return NextResponse.json(
        { success: false, error: 'Sign-up did not return tokens' },
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
    const raw = err instanceof Error ? err.message : '';
    if (raw.includes('already exists')) {
      try {
        const signInResult = (await fetchAction(api.auth.signIn, {
          provider: 'password',
          params: { flow: 'signIn', email: email.trim(), password },
        })) as { tokens?: { token: string; refreshToken: string } | null };
        if (signInResult?.tokens) {
          const host = (await headers()).get('host') ?? '';
          const names = cookieNames(host);
          const secure = !isLocalHost(host);
          const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
          const response = NextResponse.json({
            success: true,
            tokens: { token: signInResult.tokens.token, refreshToken: 'dummy' },
          });
          response.cookies.set(names.jwt, signInResult.tokens.token, cookieOptions);
          response.cookies.set(names.refresh, signInResult.tokens.refreshToken, cookieOptions);
          return response;
        }
      } catch {
        // fall through to friendly message
      }
      return NextResponse.json(
        { success: false, error: 'This email already has an account. Use Sign in instead.' },
        { status: 400 },
      );
    }
    console.error('[admin/create-account]', err);
    return NextResponse.json({ success: false, error: raw || 'Sign-up failed' }, { status: 400 });
  }
}
