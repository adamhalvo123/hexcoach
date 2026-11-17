import {
  Circle,
  Minimize2,
  Minus,
  Moon,
  Sparkles,
  Sun,
  Swords,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useApp } from "@/state/store";
import { isDesktop } from "@/lib/env";
import { cn, formatGameTime, gameModeLabel, shortPatch } from "@/lib/format";
import type { Theme } from "@/lib/types";

const THEME_CYCLE: Theme[] = ["dark", "light", "oled"];

const THEME_META: Record<Theme, { label: string; Icon: typeof Moon }> = {
  dark: { label: "Dark", Icon: Moon },
  light: { label: "Light", Icon: Sun },
  oled: { label: "OLED black", Icon: Circle },
};

async function windowAction(action: "minimize" | "close") {
  if (!isDesktop()) return;
  try {
    const window = getCurrentWindow();
    if (action === "minimize") await window.minimize();
    else await window.close();
  } catch {
    // Window controls are unavailable in the web preview.
  }
}

export default function TitleBar() {
  const { bootstrap, live, settings, ddragon, compact, setCompact, lcu, theme, setTheme, pushToast } = useApp();
  const { Icon: ThemeIcon, label: themeLabel } = THEME_META[theme];

  function cycleTheme() {
    const index = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(index + 1) % THEME_CYCLE.length]);
  }

  // The Rust side intercepts CloseRequested and hides the window instead of
  // exiting. Explain that once, on the first close, while the window is still
  // visible long enough to read the toast.
  async function closeToTray() {
    if (!isDesktop()) return;
    const hintKey = "hexcoach.trayHintShown.v1";
    if (!localStorage.getItem(hintKey)) {
      localStorage.setItem(hintKey, "1");
      pushToast(
        "info",
        "Running in the tray",
        "HexCoach keeps running next to the clock. Reopen it from the tray icon; quit it from the tray menu or Settings.",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 2400));
    }
    await windowAction("close");
  }

  return (
    <header
      data-tauri-drag-region
      className="drag-region relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-void/90 px-3.5"
    >
      <div className="flex min-w-0 items-center gap-3" data-tauri-drag-region>
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-hextech-500/60 bg-hextech-500/15">
          <Swords className="h-4 w-4 text-hextech-300" strokeWidth={2.2} />
          <span className="pointer-events-none absolute inset-0 shadow-glow-sm" />
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[16px] font-bold tracking-[0.22em] text-slate-100">
            HEXCOACH
          </span>
          <span className="hidden border border-line-strong px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-fog sm:inline">
            v{bootstrap ? shortPatch(bootstrap.version) : "0.1"}
          </span>
        </div>
      </div>

      <div className="pointer-events-none hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex" data-tauri-drag-region>
        {live.active ? (
          <span className="chip border-emerald-500/50 bg-emerald-500/10 !text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse-soft bg-emerald-400" />
            LIVE · {gameModeLabel(live.gameMode)} · {formatGameTime(live.gameTime)}
          </span>
        ) : settings.demoMode ? (
          <span className="chip border-gold-500/40 text-gold-300">
            <Sparkles className="h-3 w-3" />
            Demo data
          </span>
        ) : (
          <span className="chip">
            <span className="h-1.5 w-1.5 bg-fog" />
            Standby
          </span>
        )}
        <span className="chip normal-case tracking-normal">
          {lcu.connected ? (
            <Wifi className="h-3 w-3 text-emerald-400" />
          ) : (
            <WifiOff className="h-3 w-3 text-fog" />
          )}
          LCU {lcu.connected ? "linked" : "offline"}
        </span>
      </div>

      <div className="no-drag flex shrink-0 items-center gap-1">
        <div className="barcode mr-2 hidden w-16 text-slate-500 lg:block" aria-hidden />
        <div
          className="mr-1 hidden items-center gap-1.5 border border-line px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-mist lg:flex"
          title="Data Dragon patch and cache status"
        >
          <span
            className={cn(
              "h-1.5 w-1.5",
              ddragon.state === "ready"
                ? "bg-emerald-500"
                : ddragon.state === "error"
                  ? "bg-enemy-500"
                  : "animate-pulse-soft bg-gold-400",
            )}
          />
          {bootstrap ? `PATCH ${bootstrap.version}` : ddragon.state.toUpperCase()}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={cycleTheme}
          title={`Theme: ${themeLabel} — click to switch`}
        >
          <ThemeIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setCompact(!compact)}
          title={
            compact
              ? "Open dashboard"
              : `Compact overlay (${settings.hotkeys.toggleCompact})`
          }
        >
          <Minimize2 className={cn("h-3.5 w-3.5", compact && "rotate-180")} />
        </button>
        <button type="button" className="icon-btn" onClick={() => windowAction("minimize")} title="Minimize">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="icon-btn hover:border-enemy-500/40 hover:bg-enemy-500/15 hover:text-enemy-400"
          onClick={() => void closeToTray()}
          title="Close to tray"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gold-line opacity-70" />
    </header>
  );
}
