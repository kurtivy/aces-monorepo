/**
 * Shown during route transitions (e.g. when clicking logo to go home).
 * Provides instant feedback so navigation doesn't feel sluggish.
 */
export default function Loading() {
  return (
    <main className="w-full h-screen bg-black flex items-center justify-center">
      <div
        className="w-8 h-8 border border-[#D0B284]/30 border-t-[#D0B264] rounded-full animate-spin"
        aria-hidden
      />
    </main>
  );
}
