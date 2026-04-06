import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppWindow, Palette, Save, Webhook } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type AppSettings,
  applySettings,
  loadSettings,
  saveSettings,
} from "../hooks/useSettings";

const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "yellow", label: "Yellow" },
  { id: "silver", label: "Silver" },
];

const ACCENT_PRESETS = ["#3b82f6", "#10b981"];

export default function Settings() {
  const saved = loadSettings();

  const [theme, setTheme] = useState(saved?.theme ?? "dark");
  const [darkMode, setDarkMode] = useState(saved?.darkMode ?? true);
  const [accentColor, setAccentColor] = useState(
    saved?.accentColor ?? "#3b82f6",
  );
  const [webhookUrl, setWebhookUrl] = useState(saved?.webhookUrl ?? "");

  const buildSettings = useCallback(
    (): AppSettings => ({
      appName: saved?.appName ?? "FaceAttend",
      appIcon: saved?.appIcon ?? null,
      theme,
      darkMode,
      accentColor,
      bgType: saved?.bgType ?? "solid",
      bgImage: saved?.bgImage ?? null,
      fontSize: saved?.fontSize ?? "16px",
      webhookUrl,
    }),
    [
      saved?.appName,
      saved?.appIcon,
      saved?.bgType,
      saved?.bgImage,
      saved?.fontSize,
      theme,
      darkMode,
      accentColor,
      webhookUrl,
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

        {/* 1. Theme */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Palette className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Theme
            </span>
          </div>
          <div className="p-4 space-y-4">
            {/* Theme pills */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Theme
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                      theme === t.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground hover:bg-muted/40"
                    }`}
                    data-ocid="settings.theme.toggle"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Dark Mode</Label>
              <Switch
                checked={darkMode}
                onCheckedChange={setDarkMode}
                data-ocid="settings.dark_mode.switch"
              />
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Accent Color
              </Label>
              <div className="flex items-center gap-3">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      accentColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    data-ocid="settings.accent_color_preset.button"
                  />
                ))}
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                  title="Custom color"
                  data-ocid="settings.accent_color.input"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Data Export */}
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
