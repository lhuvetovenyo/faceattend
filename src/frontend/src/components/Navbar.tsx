import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ScanFace, Settings, UserPlus } from "lucide-react";

const navItems = [
  { to: "/", icon: ScanFace, label: "Face Scan", ocid: "face_scan" },
  { to: "/register", icon: UserPlus, label: "Register", ocid: "register" },
  {
    to: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    ocid: "dashboard",
  },
  { to: "/settings", icon: Settings, label: "Settings", ocid: "settings" },
] as const;

export default function Navbar() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    /* FIX 2: Taller navbar (h-16), stronger backdrop, cleaner brand + pill nav */
    <header
      className="sticky top-0 z-50 print:hidden"
      style={{
        background: "oklch(1 0 0 / 0.88)",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        borderBottom: "1px solid oklch(0.90 0.018 258)",
        boxShadow: "0 1px 0 oklch(0.94 0.014 258), 0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo — stronger brand treatment */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
          data-ocid="nav.link"
        >
          {/* Icon with gradient ring */}
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.50 0.24 265), oklch(0.62 0.20 292))",
              boxShadow:
                "0 2px 8px oklch(0.50 0.24 265 / 0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <ScanFace style={{ width: 18, height: 18, color: "white" }} />
          </div>

          {/* Wordmark with gradient accent on first letter */}
          <span
            className="font-display font-bold tracking-tight"
            style={{ fontSize: "1.1rem", lineHeight: 1 }}
          >
            <span
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.50 0.24 265), oklch(0.62 0.20 292))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Face
            </span>
            <span style={{ color: "oklch(0.15 0.025 262)" }}>Attend</span>
          </span>

          {/* Live badge */}
          <span
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: "oklch(0.91 0.065 152)",
              color: "oklch(0.38 0.18 152)",
              border: "1px solid oklch(0.82 0.10 152)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full pulse-dot"
              style={{ background: "oklch(0.52 0.18 152)" }}
            />
            LIVE
          </span>
        </Link>

        {/* Nav items — filled pill for active, ghost for inactive */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ to, icon: Icon, label, ocid }) => {
            const isActive =
              to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={label}
                data-ocid={`nav.${ocid}.link`}
                className={`relative flex items-center gap-1.5 px-3 py-2 min-w-[44px] justify-center sm:justify-start text-sm font-semibold rounded-lg transition-all duration-150 ${
                  isActive ? "nav-pill-active" : "nav-pill-inactive"
                }`}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{
                    color: isActive ? "white" : "oklch(0.45 0.04 258)",
                  }}
                />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
