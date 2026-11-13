import {
  Activity,
  Database,
  Hammer,
  RefreshCw,
  Settings2,
  Sparkles,
  Swords,
} from "lucide-react";
import { useApp } from "@/state/store";
import { cn } from "@/lib/format";
import type { Page } from "@/lib/types";

const NAV: Array<{
  id: Page;
  label: string;
  hint: string;
  icon: typeof Activity;
}> = [
  { id: "live", label: "Live Game", hint: "Scoreboard & builds", icon: Activity },
  { id: "draft", label: "Draft Helper", hint: "Counters & picks", icon: Swords },
  { id: "builds", label: "Builds & Runes", hint: "Plans & runes", icon: Hammer },
  { id: "arena", label: "Arena Lab", hint: "Augments & tiers", icon: Sparkles },
];

export default function Sidebar() {
  const { page, setPage, live, champSelect, ddragon, bootstrap, refreshData } = useApp();

  return (
    <aside className="hidden w-[188px] shrink-0 flex-col border-r border-ink bg-paper text-ink md:flex">
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <p className="px-2.5 pb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.24em] text-ink/50">Workspace</p>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={cn("nav-item group", active && "nav-item-active")}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-paper" : "text-ink/55 group-hover:text-ink",
                  )}
                  strokeWidth={1.9}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  <span className="block truncate text-[10px] font-normal normal-case tracking-normal text-ink/45">
                    {item.hint}
                  </span>
                </span>
                {item.id === "live" && live.active ? (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse-soft rounded-full bg-emerald-600" />
                ) : null}
                {item.id === "draft" && champSelect.active ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-600" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="my-3 h-px bg-ink/15" />

        <button
          type="button"
          onClick={() => setPage("settings")}
          className={cn("nav-item group", page === "settings" && "nav-item-active")}
        >
          <Settings2
            className={cn(
              "h-4 w-4 shrink-0",
              page === "settings" ? "text-paper" : "text-ink/55 group-hover:text-ink",
            )}
            strokeWidth={1.9}
          />
          <span className="min-w-0 flex-1">
            <span className="block">Settings</span>
            <span className="block text-[10px] font-normal normal-case tracking-normal text-ink/45">
              Overlay & account
            </span>
          </span>
        </button>
      </div>

      <div className="shrink-0 space-y-2 border-t border-ink/20 p-2.5">
        <div className="border border-ink/25 bg-ink/[0.035] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-ink/70">
              <Database className="h-3 w-3" />
              Data
            </span>
            <button
              type="button"
              className="icon-btn h-6 w-6 text-ink/60 hover:bg-ink hover:text-paper"
              onClick={() => void refreshData()}
              disabled={ddragon.state === "loading"}
              title="Refresh Data Dragon"
            >
              <RefreshCw
                className={cn("h-3 w-3", ddragon.state === "loading" && "animate-spin")}
              />
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink">
            {bootstrap ? bootstrap.version : ddragon.state === "error" ? "Offline cache" : "Loading…"}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden bg-ink/15">
            <div
              className="h-full bg-ink transition-all duration-500"
              style={{
                width: `${
                  ddragon.totalImages
                    ? Math.round((ddragon.cachedImages / ddragon.totalImages) * 100)
                    : ddragon.state === "ready"
                      ? 100
                      : 15
                }%`,
              }}
            />
          </div>
          <p className="mt-1 text-[9px] text-ink/50">
            {ddragon.totalImages
              ? `${ddragon.cachedImages}/${ddragon.totalImages} images cached`
              : "Static assets are local-cached"}
          </p>
        </div>
        <p className="px-1 text-[9px] leading-relaxed text-ink/45">
          EST. WR values are offline heuristics, not Riot match data.
        </p>
        <div className="barcode w-full text-ink" />
        <p className="px-1 font-mono text-[8px] uppercase tracking-[0.18em] text-ink/40">
          LOT 16.22 · LOCAL ONLY
        </p>
      </div>
    </aside>
  );
}
