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
  Database,
  Image,
  Palette,
  Phone,
  Save,
  Settings as SettingsIcon,
  Smartphone,
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

function SectionHeader({
  icon: Icon,
  title,
  badgeClass,
}: {
  icon: any;
  title: string;
  badgeClass: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-4"
      style={{ borderBottom: "1px solid oklch(0.90 0.015 255)" }}
    >
      <div className={`w-8 h-8 rounded-xl icon-badge ${badgeClass}`}>
        <Icon style={{ width: 15, height: 15 }} />
      </div>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

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

  const inputClass =
    "bg-white border-border focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:shadow-[0_0_0_3px_oklch(0.52_0.22_265_/_0.12)]";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-5"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl icon-badge icon-badge-indigo">
            <SettingsIcon style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              System Configuration
            </p>
          </div>
        </div>

        {/* 1. App Identity */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={AppWindow}
            title="App Identity"
            badgeClass="icon-badge-indigo"
          />
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="appName"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                App Name
              </Label>
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className={inputClass}
                data-ocid="settings.app_name.input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                App Icon
              </Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{
                    background: "oklch(0.94 0.04 265)",
                    border: "1px solid oklch(0.85 0.06 265)",
                  }}
                >
                  {appIconPreview ? (
                    <img
                      src={appIconPreview}
                      alt="App icon"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AppWindow
                      className="w-7 h-7"
                      style={{ color: "oklch(0.65 0.14 265)" }}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => iconInputRef.current?.click()}
                    className="text-xs font-medium"
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
        </motion.section>

        {/* 2. Theme */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={Palette}
            title="Theme"
            badgeClass="icon-badge-violet"
          />
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Color Theme
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={{
                      background:
                        theme === t.id
                          ? "oklch(0.52 0.22 265)"
                          : "oklch(0.97 0.008 250)",
                      color: theme === t.id ? "white" : "oklch(0.45 0.03 255)",
                      borderColor:
                        theme === t.id
                          ? "oklch(0.52 0.22 265)"
                          : "oklch(0.88 0.015 255)",
                      boxShadow:
                        theme === t.id
                          ? "0 2px 8px oklch(0.52 0.22 265 / 0.25)"
                          : "none",
                    }}
                    data-ocid="settings.theme.toggle"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-sm font-medium text-foreground">
                Dark Mode
              </Label>
              <Switch
                checked={darkMode}
                onCheckedChange={setDarkMode}
                data-ocid="settings.dark_mode.switch"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accent Color
              </Label>
              <div className="flex items-center gap-3">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${accentColor === color ? "scale-110 ring-2 ring-offset-2" : ""}`}
                    style={{
                      backgroundColor: color,
                      borderColor:
                        accentColor === color ? color : "oklch(0.88 0.015 255)",
                    }}
                    aria-label={color}
                    data-ocid="settings.accent_color.toggle"
                  />
                ))}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: "oklch(0.88 0.015 255)" }}
                >
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{
                      backgroundColor: accentColor,
                      borderColor: "oklch(0.88 0.015 255)",
                    }}
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
        </motion.section>

        {/* 3. Background */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={Image}
            title="Background"
            badgeClass="icon-badge-sky"
          />
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Background Type
              </Label>
              <Select value={bgType} onValueChange={setBgType}>
                <SelectTrigger
                  className={inputClass}
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
                  className="w-full text-sm font-medium"
                  onClick={() => bgInputRef.current?.click()}
                  data-ocid="settings.upload_bg.button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Background Image
                </Button>
                {bgImagePreview && (
                  <div
                    className="relative rounded-xl overflow-hidden border"
                    style={{
                      aspectRatio: "16/5",
                      borderColor: "oklch(0.88 0.015 255)",
                    }}
                  >
                    <img
                      src={bgImagePreview}
                      alt="Background preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setBgImagePreview(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center"
                      data-ocid="settings.remove_bg.button"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
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
        </motion.section>

        {/* 4. Typography */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={Type}
            title="Typography"
            badgeClass="icon-badge-slate"
          />
          <div className="p-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Font Size
              </Label>
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger
                  className={inputClass}
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
        </motion.section>

        {/* 5. Data Export */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={Database}
            title="Data Export"
            badgeClass="icon-badge-emerald"
          />
          <div className="p-5 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Webhook URL
            </Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-ngrok-url.ngrok.io/attendance"
              className={`${inputClass} font-mono text-sm`}
              data-ocid="settings.webhook_url.input"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter your PC&apos;s public URL (e.g. via ngrok) to receive
              attendance data automatically after each face verification.
            </p>
          </div>
        </motion.section>

        {/* 6. Install on Phone */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card overflow-hidden"
        >
          <SectionHeader
            icon={Smartphone}
            title="Install on Phone"
            badgeClass="icon-badge-indigo"
          />
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              FaceAttend can be installed directly on your phone as an app — no
              app store needed.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "oklch(0.92 0.05 265)",
                    color: "oklch(0.52 0.22 265)",
                  }}
                >
                  A
                </div>
                <span className="text-sm font-semibold">Android (Chrome)</span>
              </div>
              <ol className="ml-8 space-y-1 text-sm text-muted-foreground list-decimal list-outside">
                <li>Open this app in Chrome</li>
                <li>Tap the three-dot menu (⋮) in the top right</li>
                <li>
                  Tap{" "}
                  <span className="font-medium text-foreground">
                    &quot;Add to Home screen&quot;
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
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "oklch(0.94 0.012 255)",
                    color: "oklch(0.45 0.04 255)",
                  }}
                >
                  i
                </div>
                <span className="text-sm font-semibold">iPhone (Safari)</span>
              </div>
              <ol className="ml-8 space-y-1 text-sm text-muted-foreground list-decimal list-outside">
                <li>Open this app in Safari</li>
                <li>Tap the Share button (□↑) at the bottom</li>
                <li>
                  Scroll down and tap{" "}
                  <span className="font-medium text-foreground">
                    &quot;Add to Home Screen&quot;
                  </span>
                </li>
                <li>
                  Tap <span className="font-medium text-foreground">Add</span>{" "}
                  to confirm
                </li>
              </ol>
            </div>
            <p
              className="text-xs text-muted-foreground pt-3"
              style={{ borderTop: "1px solid oklch(0.90 0.015 255)" }}
            >
              Once installed, it will appear on your home screen with its own
              icon, just like a regular app.
            </p>
          </div>
        </motion.section>

        {/* Save Button */}
        <Button
          className="w-full h-12 text-sm font-semibold"
          onClick={handleSave}
          style={{
            background: "oklch(0.52 0.22 265)",
            color: "white",
            boxShadow: "0 4px 16px oklch(0.52 0.22 265 / 0.35)",
          }}
          data-ocid="settings.save_settings.button"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </motion.div>
    </div>
  );
}
