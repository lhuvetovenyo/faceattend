import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ScanFace, Settings, UserPlus } from "lucide-react";

const navItems = [
  { to: "/", icon: ScanFace, label: "Face Scan" },
  { to: "/register", icon: UserPlus, label: "Register" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export default function Navbar() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md print:hidden">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          replace={true}
          className="flex items-center gap-2.5"
          data-ocid="nav.link"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <ScanFace className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">
            Face<span className="text-primary">Attend</span>
          </span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/20 text-success border border-success/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
            Live
          </span>
        </Link>

        {/* Nav icons */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                replace={true}
                title={label}
                data-ocid={`nav.${label.toLowerCase().replace(" ", "_")}.link`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
