export type StyleVariant =
  | "professional"
  | "softAnime"
  | "darkAnime"
  | "ghibli"
  | "cyberAnime";

export interface AppSettings {
  appName: string;
  appIcon: string | null;
  theme: string;
  darkMode: boolean;
  accentColor: string;
  bgType: string;
  bgImage: string | null;
  fontSize: string;
  webhookUrl: string;
  styleVariant: StyleVariant;
}

const DEFAULTS: AppSettings = {
  appName: "FaceAttend",
  appIcon: null,
  theme: "dark",
  darkMode: true,
  accentColor: "#3b82f6",
  bgType: "solid",
  bgImage: null,
  fontSize: "16px",
  webhookUrl: "",
  styleVariant: "professional",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("faceattend_settings");
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem("faceattend_settings", JSON.stringify(settings));
}

const THEME_PRESETS: Record<string, Record<string, string>> = {
  dark: {
    "--background": "0.13 0.025 255",
    "--foreground": "0.95 0.01 255",
    "--card": "0.17 0.03 255",
    "--border": "0.28 0.04 255",
    "--primary": "0.58 0.2 250",
  },
  light: {
    "--background": "0.97 0.005 255",
    "--foreground": "0.15 0.025 255",
    "--card": "0.99 0.002 255",
    "--border": "0.85 0.02 255",
    "--primary": "0.58 0.2 250",
  },
  blue: {
    "--background": "0.13 0.04 240",
    "--foreground": "0.95 0.01 240",
    "--card": "0.17 0.05 240",
    "--border": "0.28 0.06 240",
    "--primary": "0.58 0.22 240",
  },
  green: {
    "--background": "0.13 0.04 142",
    "--foreground": "0.95 0.01 142",
    "--card": "0.17 0.05 142",
    "--border": "0.28 0.06 142",
    "--primary": "0.58 0.2 142",
  },
  yellow: {
    "--background": "0.18 0.04 80",
    "--foreground": "0.95 0.01 80",
    "--card": "0.22 0.05 80",
    "--border": "0.32 0.06 80",
    "--primary": "0.72 0.2 70",
  },
  silver: {
    "--background": "0.92 0.005 255",
    "--foreground": "0.15 0.01 255",
    "--card": "0.96 0.003 255",
    "--border": "0.75 0.01 255",
    "--primary": "0.45 0.12 255",
  },
};

export function applySettings(settings: AppSettings): void {
  const root = document.documentElement;

  // Dark mode
  if (settings.darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Font size
  root.style.fontSize = settings.fontSize;

  // Theme CSS variables
  const preset = THEME_PRESETS[settings.theme] ?? THEME_PRESETS.dark;
  for (const [key, value] of Object.entries(preset)) {
    root.style.setProperty(key, value);
  }

  // Accent color
  root.style.setProperty("--accent-hex", settings.accentColor);

  // Background
  const body = document.body;
  if (settings.bgType === "image" && settings.bgImage) {
    body.style.backgroundImage = `url(${settings.bgImage})`;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundAttachment = "fixed";
  } else if (settings.bgType === "gradient") {
    body.style.backgroundImage =
      "linear-gradient(135deg, oklch(0.13 0.04 255), oklch(0.2 0.06 280))";
    body.style.backgroundSize = "";
    body.style.backgroundAttachment = "";
  } else {
    body.style.backgroundImage = "none";
    body.style.backgroundSize = "";
    body.style.backgroundAttachment = "";
  }

  // App name (page title)
  document.title = settings.appName;

  // Style variant — set data-style attribute so CSS selectors can target it
  const variant = settings.styleVariant ?? "professional";
  root.setAttribute("data-style", variant);

  // Apply per-style CSS overrides via inline custom properties
  switch (variant) {
    case "softAnime":
      root.style.setProperty("--style-radius", "1.5rem");
      root.style.setProperty("--style-card-bg", "rgba(255,183,197,0.18)");
      root.style.setProperty("--style-card-border", "rgba(196,160,232,0.45)");
      root.style.setProperty("--style-accent-glow", "rgba(196,160,232,0.4)");
      root.style.setProperty("--style-scan-color", "#c4a0e8");
      break;
    case "darkAnime":
      root.style.setProperty("--style-radius", "0.5rem");
      root.style.setProperty("--style-card-bg", "rgba(13,13,26,0.92)");
      root.style.setProperty("--style-card-border", "rgba(255,107,157,0.5)");
      root.style.setProperty("--style-accent-glow", "rgba(255,107,157,0.35)");
      root.style.setProperty("--style-scan-color", "#ff6b9d");
      break;
    case "ghibli":
      root.style.setProperty("--style-radius", "1rem");
      root.style.setProperty("--style-card-bg", "rgba(255,248,231,0.85)");
      root.style.setProperty("--style-card-border", "rgba(139,105,20,0.2)");
      root.style.setProperty("--style-accent-glow", "rgba(135,169,107,0.3)");
      root.style.setProperty("--style-scan-color", "#87a96b");
      break;
    case "cyberAnime":
      root.style.setProperty("--style-radius", "0.375rem");
      root.style.setProperty("--style-card-bg", "rgba(10,14,26,0.9)");
      root.style.setProperty("--style-card-border", "rgba(0,245,255,0.4)");
      root.style.setProperty("--style-accent-glow", "rgba(0,245,255,0.3)");
      root.style.setProperty("--style-scan-color", "#00f5ff");
      break;
    default: // professional
      root.style.setProperty("--style-radius", "0.75rem");
      root.style.setProperty("--style-card-bg", "rgba(255,255,255,0.9)");
      root.style.setProperty("--style-card-border", "rgba(200,210,240,0.6)");
      root.style.setProperty("--style-accent-glow", "rgba(59,130,246,0.15)");
      root.style.setProperty("--style-scan-color", "#6366f1");
      break;
  }
}
