import type { Theme } from "./types";

export const THEME_KEY = "hexcoach.theme.v1";

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
  swatches: [string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Deep navy surfaces with hextech blue accents.",
    swatches: ["#090d16", "#161b22", "#38bdf8"],
  },
  {
    id: "light",
    label: "Light",
    description: "High-contrast daylight palette for bright rooms.",
    swatches: ["#f1f5f9", "#ffffff", "#0284c7"],
  },
  {
    id: "oled",
    label: "OLED black",
    description: "True black panels for OLED displays and night play.",
    swatches: ["#000000", "#08080a", "#38bdf8"],
  },
];

export function normalizeTheme(value: unknown): Theme {
  if (value === "light") return "light";
  if (value === "oled" || value === "oled-black" || value === "black") return "oled";
  return "dark";
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

export function hasStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(THEME_KEY) !== null;
  } catch {
    return false;
  }
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Persisting the theme is best-effort in restricted webviews.
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const next = normalizeTheme(theme);
  root.dataset.theme = next;
  root.classList.toggle("dark", next !== "light");
  root.classList.toggle("theme-light", next === "light");
  root.classList.toggle("theme-oled", next === "oled");
  root.style.colorScheme = next === "light" ? "light" : "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      next === "light" ? "#f1f5f9" : next === "oled" ? "#000000" : "#0d1117",
    );
  }
}
