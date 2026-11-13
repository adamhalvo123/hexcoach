import {
  Minimize2,
  Minus,
  Sparkles,
  Swords,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useApp } from "@/state/store";
import { isDesktop } from "@/lib/env";
import { cn, formatGameTime, gameModeLabel, shortPatch } from "@/lib/format";

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
  const { bootstrap, live, settings, ddragon, compact, setCompact, lcu } = useApp();

  return (
    <header
      data-tauri-drag-region
      className="drag-region relative z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-paper/25 bg-void/80 px-3.5"
    >
      <div className="flex min-w-0 items-center gap-3" data-tauri-drag-region>
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-paper bg-paper">
          <Swords className="h-4 w-4 text-ink" strokeWidth={2.2} />
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[16px] font-bold tracking-[0.22em] text-paper">
            HEXCOACH
          </span>
          <span className="hidden border border-paper/25 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-fog sm:inline">
            v{bootstrap ? shortPatch(bootstrap.version) : "0.1"}
          </span>
        </div>
      </div>

      <div className="pointer-events-none hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex" data-tauri-drag-region>
        {live.active ? (
          <span className="chip border-paper bg-paper !text-ink">
            <span className="h-1.5 w-1.5 animate-pulse-soft bg-ink" />
            LIVE · {gameModeLabel(live.gameMode)} · {formatGameTime(live.gameTime)}
          </span>
        ) : settings.demoMode ? (
          <span className="chip border-paper/40 text-paper">
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
            <Wifi className="h-3 w-3 text-paper" />
          ) : (
            <WifiOff className="h-3 w-3 text-fog" />
          )}
          LCU {lcu.connected ? "linked" : "offline"}
        </span>
      </div>

      <div className="no-drag flex shrink-0 items-center gap-1">
        <div className="barcode mr-2 hidden w-16 text-paper/70 lg:block" aria-hidden />
        <div
          className={cn(
            "mr-1 hidden items-center gap-1.5 border border-paper/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-mist lg:flex",
          )}
          title="Data Dragon patch and cache status"
        >
          <span
            className={cn(
              "h-1.5 w-1.5",
              ddragon.state === "ready"
                ? "bg-paper"
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
          onClick={() => setCompact(!compact)}
          title={compact ? "Open dashboard" : "Compact overlay (Ctrl+Shift+C)"}
        >
          <Minimize2 className={cn("h-3.5 w-3.5", compact && "rotate-180")} />
        </button>
        <button type="button" className="icon-btn" onClick={() => windowAction("minimize")} title="Minimize">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="icon-btn hover:border-enemy-500/40 hover:bg-enemy-500/15 hover:text-enemy-400"
          onClick={() => windowAction("close")}
          title="Close HexCoach"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] hazard-rule opacity-80" />
    </header>
  );
}
