import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import AnimatedBackground from "./components/AnimatedBackground";
import Navbar from "./components/Navbar";
import { applySettings, loadSettings } from "./hooks/useSettings";
import Dashboard from "./pages/Dashboard";
import FaceScan from "./pages/FaceScan";
import Register from "./pages/Register";
import Settings from "./pages/Settings";

// Apply saved settings on startup
applySettings(loadSettings());

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen flex flex-col bg-background">
      <AnimatedBackground />
      <div className="relative flex flex-col flex-1" style={{ zIndex: 2 }}>
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <footer
          className="py-4 text-center print:hidden"
          style={{
            borderTop: "1px solid oklch(0.88 0.015 255)",
            color: "oklch(0.55 0.04 255)",
            fontSize: "0.75rem",
            background: "oklch(1 0 0 / 0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          Developed by Atoto venyo
        </footer>
        <Toaster />
      </div>
    </div>
  ),
});

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: FaceScan,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: Register,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard,
});

const routeTree = rootRoute.addChildren([
  scanRoute,
  registerRoute,
  settingsRoute,
  dashboardRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
