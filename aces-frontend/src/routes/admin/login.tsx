import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-deep-charcoal flex items-center justify-center">
      <div className="w-full max-w-sm border border-golden-beige/20 rounded-xl p-8 bg-deep-charcoal/80">
        <h1 className="font-heading text-2xl text-golden-beige mb-6 text-center">
          Admin Login
        </h1>
        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 bg-deep-charcoal border border-golden-beige/20 rounded-lg text-platinum-grey placeholder:text-platinum-grey/30 focus:border-golden-beige/50 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 bg-deep-charcoal border border-golden-beige/20 rounded-lg text-platinum-grey placeholder:text-platinum-grey/30 focus:border-golden-beige/50 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 bg-deep-emerald text-golden-beige rounded-lg hover:shadow-emerald-glow transition-shadow font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
