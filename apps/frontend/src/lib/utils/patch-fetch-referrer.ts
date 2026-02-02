/**
 * Ethers v5 sets request.referrer = "client", but Fetch only allows a URL,
 * "about:client", or "". Node/undici throws: Referrer "client" is not a valid URL.
 * This patch runs at module load so it's applied before any ethers RPC call.
 * Server-only; safe no-op on client.
 */
if (typeof window === 'undefined') {
  // Patch Request constructor - error occurs when new Request(url, { referrer: 'client' }) is called
  if (typeof globalThis.Request !== 'undefined') {
    const OriginalRequest = globalThis.Request;
    const PatchedRequest = function (input: RequestInfo | URL, init?: RequestInit): Request {
      if (init && (init as { referrer?: string }).referrer === 'client') {
        init = { ...init, referrer: '' };
      }
      return new OriginalRequest(input, init);
    };
    globalThis.Request = PatchedRequest as unknown as typeof Request;
  }

  // Patch fetch - handle both init and Request object with invalid referrer
  if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (input instanceof Request && input.referrer === 'client') {
        input = new Request(input, { referrer: '' });
      }
      if (init?.referrer === 'client') {
        init = { ...init, referrer: '' };
      }
      return originalFetch.call(this, input, init);
    };
  }
}
