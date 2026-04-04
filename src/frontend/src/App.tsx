import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createHashHistory } from "@tanstack/react-router";
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
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border print:hidden">
        <div>Developed by Atoto venyo</div>
      </footer>
      <Toaster />
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

const hashHistory = createHashHistory();
const router = createRouter({ routeTree, history: hashHistory });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
