import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppWindow, Save, Sparkles, Webhook } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type AppSettings,
  type StyleVariant,
  applySettings,
  loadSettings,
  saveSettings,
} from "../hooks/useSettings";

interface StyleOption {
  id: StyleVariant;
  name: string;
  tagline: string;
  swatches: string[];
  textColor: string;
  bg: string;
  border: string;
  labelColor: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "professional",
    name: "Professional 3D",
    tagline: "Clean • Modern • Glass",
    swatches: ["#e0e7ff", "#6366f1", "#1e293b"],
    textColor: "#1e293b",
    bg: "linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%)",
    border: "rgba(99,102,241,0.3)",
    labelColor: "#4f46e5",
  },
  {
    id: "softAnime",
    name: "Soft Anime",
    tagline: "Pastel • Bubbly • Cute",
    swatches: ["#ffb7c5", "#c4a0e8", "#a8d8ea"],
    textColor: "#6b3d7a",
    bg: "linear-gradient(135deg, #fff0f5 0%, #f5eeff 50%, #eaf6ff 100%)",
    border: "rgba(196,160,232,0.5)",
    labelColor: "#9d4edd",
  },
  {
    id: "darkAnime",
    name: "Dark Anime",
    tagline: "Neon • Dramatic • Action",
    swatches: ["#0d0d1a", "#ff6b9d", "#9d4edd"],
    textColor: "#ffffff",
    bg: "linear-gradient(135deg, #0d0d1a 0%, #1a0d26 100%)",
    border: "rgba(255,107,157,0.5)",
    labelColor: "#ff6b9d",
  },
  {
    id: "ghibli",
    name: "Ghibli",
    tagline: "Warm • Earthy • Cozy",
    swatches: ["#fff8e7", "#87a96b", "#8b6914"],
    textColor: "#5c3d0a",
    bg: "linear-gradient(135deg, #fffbf0 0%, #f5f0df 100%)",
    border: "rgba(139,105,20,0.25)",
    labelColor: "#6b7c3a",
  },
  {
    id: "cyberAnime",
    name: "Cyber Anime",
    tagline: "Holographic • Neon • Futuristic",
    swatches: ["#0a0e1a", "#00f5ff", "#ff00ff"],
    textColor: "#00f5ff",
    bg: "linear-gradient(135deg, #0a0e1a 0%, #0d1530 100%)",
    border: "rgba(0,245,255,0.45)",
    labelColor: "#00f5ff",
  },
];

export default function Settings() {
  const saved = loadSettings();

  const [webhookUrl, setWebhookUrl] = useState(saved?.webhookUrl ?? "");
  const [styleVariant, setStyleVariant] = useState<StyleVariant>(
    saved?.styleVariant ?? "professional",
  );

  const buildSettings = useCallback(
    (): AppSettings => ({
      appName: saved?.appName ?? "FaceAttend",
      appIcon: saved?.appIcon ?? null,
      theme: saved?.theme ?? "dark",
      darkMode: saved?.darkMode ?? true,
      accentColor: saved?.accentColor ?? "#3b82f6",
      bgType: saved?.bgType ?? "solid",
      bgImage: saved?.bgImage ?? null,
      fontSize: saved?.fontSize ?? "16px",
      webhookUrl,
      styleVariant,
    }),
    [
      saved?.appName,
      saved?.appIcon,
      saved?.theme,
      saved?.darkMode,
      saved?.accentColor,
      saved?.bgType,
      saved?.bgImage,
      saved?.fontSize,
      webhookUrl,
      styleVariant,
    ],
  );

  // Apply settings live as they change
  useEffect(() => {
    applySettings(buildSettings());
  }, [buildSettings]);

  const handleSave = () => {
    const settings = buildSettings();
    try {
      saveSettings(settings);
      applySettings(settings);
      toast.success("Settings saved!");
    } catch (_e) {
      toast.error("Could not save settings. Please try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <AppWindow className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Customize your FaceAttend app
            </p>
          </div>
        </div>

        {/* 0. Style Variant */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Visual Style
            </span>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Choose a complete visual personality for the app. Tap a style to
              preview it instantly.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {STYLE_OPTIONS.map((opt, idx) => {
                const isActive = styleVariant === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.3 }}
                    onClick={() => setStyleVariant(opt.id)}
                    data-ocid={`settings.style_variant.item.${idx + 1}`}
                    className={`relative w-full rounded-xl overflow-hidden border-2 transition-all duration-200 text-left ${
                      isActive
                        ? "ring-2 ring-offset-2 ring-primary scale-[1.02] shadow-lg"
                        : "hover:scale-[1.01] hover:shadow-md"
                    }`}
                    style={{
                      borderColor: isActive ? opt.labelColor : opt.border,
                    }}
                  >
                    {/* Card background */}
                    <div
                      className="absolute inset-0"
                      style={{ background: opt.bg }}
                    />

                    {/* Content */}
                    <div className="relative z-10 flex items-center gap-4 px-4 py-3">
                      {/* Color swatches */}
                      <div className="flex gap-1.5 shrink-0">
                        {opt.swatches.map((color) => (
                          <div
                            key={color}
                            className="w-5 h-5 rounded-full border border-white/30 shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>

                      {/* Name + tagline */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-bold leading-tight"
                          style={{ color: opt.textColor }}
                        >
                          {opt.name}
                        </p>
                        <p
                          className="text-xs mt-0.5 opacity-75"
                          style={{ color: opt.textColor }}
                        >
                          {opt.tagline}
                        </p>
                      </div>

                      {/* Active badge */}
                      {isActive && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            color:
                              opt.bg.includes("0d0d1a") ||
                              opt.bg.includes("0a0e1a")
                                ? "#fff"
                                : opt.labelColor,
                            background:
                              opt.bg.includes("0d0d1a") ||
                              opt.bg.includes("0a0e1a")
                                ? `${opt.labelColor}33`
                                : `${opt.labelColor}22`,
                            border: `1px solid ${opt.labelColor}66`,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>

                    {/* Active left border accent */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                        style={{ backgroundColor: opt.labelColor }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 1. Data Export */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Webhook className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Data Export
            </span>
          </div>
          <div className="p-4 space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Webhook URL
            </Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-ngrok-url.ngrok.io/attendance"
              className="bg-background border-border font-mono text-sm"
              data-ocid="settings.webhook_url.input"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter your PC&apos;s public URL (e.g. via ngrok) to receive
              attendance data automatically after each face verification.
            </p>
          </div>
        </section>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full"
          size="lg"
          data-ocid="settings.save.button"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </motion.div>
    </div>
  );
}
