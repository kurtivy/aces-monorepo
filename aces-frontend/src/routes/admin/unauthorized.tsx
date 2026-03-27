import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/unauthorized")({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-deep-charcoal flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-heading text-4xl text-golden-beige mb-4">
          Access Denied
        </h1>
        <p className="text-platinum-grey/60 mb-8">
          You do not have permission to access this page.
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-deep-emerald text-golden-beige rounded-lg hover:shadow-emerald-glow transition-shadow"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
