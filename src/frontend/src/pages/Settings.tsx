import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AppWindow,
  Image,
  Palette,
  Phone,
  Save,
  Type,
  Upload,
  Webhook,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const FONT_SIZES = [
  { value: "14px", label: "Small (14px)" },
  { value: "16px", label: "Medium (16px)" },
  { value: "18px", label: "Large (18px)" },
  { value: "20px", label: "Extra Large (20px)" },
];

const BG_TYPES = [
  { value: "solid", label: "Solid Color" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Upload Image" },
];

export default function Settings() {
  const saved = loadSettings();

  const [appName, setAppName] = useState(saved?.appName ?? "FaceAttend");
  const [appIconPreview, setAppIconPreview] = useState<string | null>(
    saved?.appIcon ?? null,
  );
  const [theme, setTheme] = useState(saved?.theme ?? "dark");
  const [darkMode, setDarkMode] = useState(saved?.darkMode ?? true);
  const [accentColor, setAccentColor] = useState(
    saved?.accentColor ?? "#3b82f6",
  );
  const [bgType, setBgType] = useState(saved?.bgType ?? "image");
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(
    saved?.bgImage ?? null,
  );
  const [fontSize, setFontSize] = useState(saved?.fontSize ?? "16px");
  const [webhookUrl, setWebhookUrl] = useState(saved?.webhookUrl ?? "");

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAppIconPreview(url);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBgImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const buildSettings = useCallback(
    (): AppSettings => ({
      appName,
      appIcon: appIconPreview,
      theme,
      darkMode,
      accentColor,
      bgType,
      bgImage: bgImagePreview,
      fontSize,
      webhookUrl,
    }),
    [
      appName,
      appIconPreview,
      theme,
      darkMode,
      accentColor,
      bgType,
      bgImagePreview,
      fontSize,
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
      toast.error(
        "Could not save — background image may be too large. Try a smaller image.",
      );
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

        {/* 1. App Identity */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <AppWindow className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              App Identity
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="appName"
                className="text-xs uppercase tracking-wider text-muted-foreground font-semibold"
              >
                App Name
              </Label>
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="bg-background border-border"
                data-ocid="settings.app_name.input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                App Icon
              </Label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {appIconPreview ? (
                    <img
                      src={appIconPreview}
                      alt="App icon"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AppWindow className="w-7 h-7 text-muted-foreground opacity-40" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => iconInputRef.current?.click()}
                    className="text-xs"
                    data-ocid="settings.upload_icon.button"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Upload Icon
                  </Button>
                  {appIconPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAppIconPreview(null)}
                      className="text-xs text-destructive hover:text-destructive"
                      data-ocid="settings.remove_icon.button"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleIconUpload}
              />
            </div>
          </div>
        </section>

        {/* 2. Theme */}
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
                    aria-label={color}
                    data-ocid="settings.accent_color.toggle"
                  />
                ))}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border">
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-sm font-mono text-muted-foreground">
                    {accentColor}
                  </span>
                </div>
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

        {/* 3. Background */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Image className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Background
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Background Type
              </Label>
              <Select value={bgType} onValueChange={setBgType}>
                <SelectTrigger
                  className="bg-background border-border"
                  data-ocid="settings.bg_type.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BG_TYPES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bgType === "image" && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => bgInputRef.current?.click()}
                  data-ocid="settings.upload_bg.button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Background Image
                </Button>
                {bgImagePreview && (
                  <div
                    className="relative rounded-lg overflow-hidden border border-border"
                    style={{ aspectRatio: "16/5" }}
                  >
                    <img
                      src={bgImagePreview}
                      alt="Background preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setBgImagePreview(null)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                      data-ocid="settings.remove_bg.button"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBgUpload}
                />
              </div>
            )}
          </div>
        </section>

        {/* 4. Typography */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Type className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Typography
            </span>
          </div>
          <div className="p-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Font Size
              </Label>
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger
                  className="bg-background border-border"
                  data-ocid="settings.font_size.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 5. Data Export */}
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

        {/* 6. Install on Phone */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Phone className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Install on Phone
            </span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              FaceAttend can be installed directly on your phone as an app — no
              app store needed.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">A</span>
                </div>
                <span className="text-sm font-semibold">Android (Chrome)</span>
              </div>
              <ol className="ml-7 space-y-1 text-sm text-muted-foreground list-decimal list-outside">
                <li>Open this app in Chrome</li>
                <li>Tap the three-dot menu (⋮) in the top right</li>
                <li>
                  Tap{" "}
                  <span className="font-medium text-foreground">
                    "Add to Home screen"
                  </span>
                </li>
                <li>
                  Tap <span className="font-medium text-foreground">Add</span>{" "}
                  to confirm
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">i</span>
                </div>
                <span className="text-sm font-semibold">iPhone (Safari)</span>
              </div>
              <ol className="ml-7 space-y-1 text-sm text-muted-foreground list-decimal list-outside">
                <li>Open this app in Safari</li>
                <li>Tap the Share button (□↑) at the bottom</li>
                <li>
                  Scroll down and tap{" "}
                  <span className="font-medium text-foreground">
                    "Add to Home Screen"
                  </span>
                </li>
                <li>
                  Tap <span className="font-medium text-foreground">Add</span>{" "}
                  to confirm
                </li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Once installed, it will appear on your home screen with its own
              icon, just like a regular app.
            </p>
          </div>
        </section>

        {/* Save Button */}
        <Button
          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
          onClick={handleSave}
          data-ocid="settings.save_settings.button"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </motion.div>
    </div>
  );
}
