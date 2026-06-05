import type { Tab } from "@/types";
import { LayoutGrid, ScanFace, Settings, UserPlus } from "lucide-react";

interface LayoutProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "scan", label: "Scan", Icon: ScanFace },
  { id: "register", label: "Register", Icon: UserPlus },
  { id: "dashboard", label: "Dashboard", Icon: LayoutGrid },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const HEADER_H = 52;
  return (
    <div
      className="flex flex-col bg-background"
      style={{ minHeight: "100dvh" }}
    >
      {/* Fixed header: logo + live + nav tabs */}
      <header
        className="bg-card border-b border-border z-30"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_H,
        }}
      >
        <div className="flex items-center px-2 py-1.5 gap-1 h-full">
          {/* Brand */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
              <ScanFace size={14} className="text-primary" strokeWidth={1.8} />
            </div>
            <span
              className="text-sm text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
            >
              FaceAttend
            </span>
          </div>
          {/* Live badge */}
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0 ml-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-live"
              aria-hidden="true"
            />
            <span
              className="text-[10px] text-emerald-600 tracking-wide leading-none"
              style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}
            >
              Live
            </span>
          </div>
          {/* Nav tabs */}
          <nav
            className="flex items-center flex-1 justify-end gap-0.5"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-ocid={`nav.${id}`}
                  onClick={() => setActiveTab(id)}
                  className={[
                    "flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-lg transition-smooth relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  ].join(" ")}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} />
                  <span
                    className="text-[9px] leading-none"
                    style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content area — offset by fixed header, scrolls freely */}
      <main
        className="flex-1 bg-background"
        style={{
          paddingTop: HEADER_H,
          paddingBottom: "env(safe-area-inset-bottom, 12px)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default Layout;
