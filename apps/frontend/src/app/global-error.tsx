'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-black text-white font-syne">
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-[#D0B264] text-2xl font-bold mb-4">Something went wrong!</div>
            <div className="text-white/80 text-sm mb-6">
              {error.message || 'An unexpected error occurred'}
            </div>
            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-semibold py-3 px-6 rounded-xl transition-all duration-200"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="w-full border border-[#D0B264]/40 text-[#D0B264] hover:bg-[#D0B264]/10 font-semibold py-3 px-6 rounded-xl transition-all duration-200"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
