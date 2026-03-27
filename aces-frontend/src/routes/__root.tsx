import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AppProviders } from "~/components/providers/app-providers";
import { Header } from "~/components/layout/header";
import { Footer } from "~/components/layout/footer";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AppProviders>
      <div className="noise-overlay flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AppProviders>
  );
}
