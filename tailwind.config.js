/** @type {import('tailwindcss').Config} */

// Every structural colour reads a CSS variable so the same utility classes work
// in dark, light and OLED-black themes. Values are defined in styles.css.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const ramp = (prefix, shades) =>
  Object.fromEntries(shades.map((shade) => [shade, token(`${prefix}-${shade}`)]));

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        void: token("void"),
        abyss: token("abyss"),
        panel: token("panel"),
        "panel-2": token("panel-2"),
        "panel-3": token("panel-3"),
        line: token("line"),
        "line-strong": token("line-strong"),
        chrome: token("chrome"),
        "chrome-ink": token("chrome-ink"),
        paper: token("paper"),
        "paper-2": token("paper-2"),
        ink: token("ink"),
        mist: token("mist"),
        fog: token("fog"),
        hextech: ramp("hextech", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        gold: ramp("gold", [300, 400, 500, 600, 700]),
        enemy: ramp("enemy", [400, 500, 600, 700]),
        arcane: ramp("arcane", [400, 500, 600]),
        emerald: ramp("emerald", [300, 400, 500, 600, 700]),
        slate: ramp("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
      },
      fontFamily: {
        sans: ["Bahnschrift", "Segoe UI Variable", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Bahnschrift SemiCondensed", "Bahnschrift", "Arial Narrow", "Segoe UI", "sans-serif"],
        mono: ["Cascadia Mono", "Consolas", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0px",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "3px",
        "2xl": "3px",
        "3xl": "4px",
        full: "9999px",
      },
      boxShadow: {
        panel: "0 24px 80px rgb(var(--c-shadow) / 0.55)",
        glow: "0 0 24px rgb(var(--c-hextech-500) / 0.25)",
        "glow-sm": "0 0 12px rgb(var(--c-hextech-500) / 0.2)",
        "inner-line": "inset 0 1px 0 rgb(var(--c-paper) / 0.06)",
        enemy: "0 0 18px rgb(var(--c-enemy-500) / 0.25)",
      },
      backgroundImage: {
        "hud-grid":
          "linear-gradient(rgb(var(--c-paper) / 0.045) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-paper) / 0.045) 1px, transparent 1px)",
        "hex-glow": "radial-gradient(circle at 50% 0%, rgb(var(--c-hextech-500) / 0.18), transparent 65%)",
        "gold-line":
          "linear-gradient(90deg, transparent, rgb(var(--c-gold-500) / 0.6), transparent)",
        hazard:
          "repeating-linear-gradient(-45deg, rgb(var(--c-hextech-500)) 0 7px, rgb(var(--c-void)) 7px 14px)",
        "paper-grain":
          "repeating-linear-gradient(0deg, rgb(var(--c-paper) / 0.022) 0 1px, transparent 1px 3px)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        sweep: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-soft": "pulseSoft 2.2s ease-in-out infinite",
        sweep: "sweep 2.8s ease-in-out infinite",
        rise: "rise .25s ease-out both",
        "spin-slow": "spinSlow 8s linear infinite",
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
  plugins: [],
};
