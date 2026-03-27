import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/status")({
  component: StatusPage,
});

function StatusPage() {
  return (
    <div className="min-h-screen bg-deep-charcoal p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-4xl text-golden-beige mb-2">
          System Status
        </h1>
        <div className="mt-8 border border-deep-emerald/40 rounded-xl p-6 bg-deep-emerald/10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse-gold" />
            <span className="text-platinum-grey">All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
