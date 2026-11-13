/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Acid-label monochrome: warm black paper stock + ink.
        void: "#0a0a08",
        abyss: "#10100c",
        panel: "#15150f",
        "panel-2": "#1a1a13",
        "panel-3": "#232218",
        line: "#35332a",
        paper: "#e9e2ce",
        "paper-2": "#ded5bd",
        ink: "#0c0c09",
        hextech: {
          50: "#fbf8ee",
          100: "#f4efdf",
          200: "#ebe4cf",
          300: "#ddd3b8",
          400: "#cbbf9f",
          500: "#b3a681",
          600: "#8f8262",
          700: "#6d6248",
          800: "#4a4334",
          900: "#2c2820",
        },
        gold: {
          300: "#efe3b8",
          400: "#dccb8d",
          500: "#c4ae63",
          600: "#9d8944",
          700: "#71622f",
        },
        enemy: {
          400: "#ff7a5c",
          500: "#e8502f",
          600: "#c33a1e",
          700: "#8f2913",
        },
        arcane: {
          400: "#b7a8d8",
          500: "#9c88c4",
          600: "#7b679f",
        },
        mist: "#b8b19f",
        fog: "#827b69",
        // Warm neutral remap so existing slate utilities stay on-palette.
        slate: {
          50: "#faf8f2",
          100: "#f0ece0",
          200: "#e2dccb",
          300: "#c9c2af",
          400: "#a8a191",
          500: "#8b8576",
          600: "#6d6759",
          700: "#524d41",
          800: "#39352c",
          900: "#23211b",
          950: "#14130f",
        },
        emerald: {
          300: "#c3ddc0",
          400: "#9ec79b",
          500: "#7bab78",
          600: "#5d8a5b",
          700: "#426442",
        },
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
        panel: "0 30px 90px rgba(0, 0, 0, 0.65)",
        glow: "none",
        "glow-sm": "none",
        "inner-line": "none",
        enemy: "none",
      },
      backgroundImage: {
        "hud-grid":
          "linear-gradient(rgba(233,226,206,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(233,226,206,0.045) 1px, transparent 1px)",
        "hex-glow": "none",
        "gold-line": "linear-gradient(90deg, transparent, rgba(233,226,206,.6), transparent)",
        hazard:
          "repeating-linear-gradient(-45deg, #e9e2ce 0 7px, #0a0a08 7px 14px)",
        "paper-grain":
          "repeating-linear-gradient(0deg, rgba(233,226,206,0.022) 0 1px, transparent 1px 3px)",
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
