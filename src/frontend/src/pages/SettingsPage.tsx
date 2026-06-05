import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/types";
import { Check } from "lucide-react";

type ThemeOption = {
  id: Theme;
  label: string;
  swatches: [string, string, string];
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "professional-3d",
    label: "Professional 3D",
    swatches: ["#4F6FD8", "#B0B8C9", "#F5F6FA"],
  },
  {
    id: "soft-anime",
    label: "Soft Anime",
    swatches: ["#E88BAA", "#C9B8E8", "#FFF5F8"],
  },
  {
    id: "dark-anime",
    label: "Dark Anime",
    swatches: ["#7B5EA7", "#4A3570", "#1A1226"],
  },
  {
    id: "ghibli",
    label: "Ghibli",
    swatches: ["#5C9E6E", "#8B6340", "#F7F3E8"],
  },
  {
    id: "cyber-anime",
    label: "Cyber Anime",
    swatches: ["#22D4E8", "#A855F7", "#0D0F1A"],
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6 p-4 pb-6 animate-fade-up">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-display font-bold text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your preferences
        </p>
      </div>

      {/* Appearance section */}
      <section data-ocid="settings.appearance_section">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Appearance
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const isSelected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-ocid={`settings.theme_card.${option.id}`}
                onClick={() => setTheme(option.id)}
                className={[
                  "relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 text-center transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-primary-glow"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
                ].join(" ")}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check
                      className="h-3 w-3 text-primary-foreground"
                      strokeWidth={3}
                    />
                  </span>
                )}

                <div className="flex gap-1.5">
                  {option.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-6 w-6 rounded-full border border-border shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <span
                  className={[
                    "text-xs font-medium leading-tight",
                    isSelected ? "text-primary" : "text-foreground",
                  ].join(" ")}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
