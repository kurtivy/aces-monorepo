/**
 * SPA entry point.
 * Replaced TanStack Start's SSR entry — this app is fully client-rendered
 * since all data comes from Convex, Wagmi RPC, and Privy (all client-side).
 */
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles/app.css";

const router = getRouter();

// Guard against double-render (e.g. React Strict Mode in dev)
const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
