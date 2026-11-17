import { useApp } from "@/state/store";
import { cn, formatGameTime, shortPatch } from "@/lib/format";

export default function StatusBar() {
  const { lcu, live, perf, ddragon, bootstrap, settings, appInfo } = useApp();

  return (
    <footer className="relative z-20 flex h-8 shrink-0 items-center justify-between gap-3 border-t border-line bg-chrome px-3 text-[10px] text-chrome-ink/60">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap" title={lcu.message ?? "League Client API"}>
          <span
            className={cn(
              "h-1.5 w-1.5",
              lcu.connected ? "bg-emerald-500" : "bg-chrome-ink/25",
            )}
          />
          LCU<span className="hidden sm:inline">{lcu.connected ? " connected" : " offline"}</span>
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap" title="Live Client API polls every 2 seconds">
          <span
            className={cn(
              "h-1.5 w-1.5",
              live.active ? "animate-pulse-soft bg-hextech-400" : "bg-chrome-ink/25",
            )}
          />
          {live.active ? (
            <>
              {formatGameTime(live.gameTime)}
              <span className="hidden sm:inline">· live</span>
            </>
          ) : (
            "Live client idle"
          )}
        </span>
        <span className="hidden truncate text-chrome-ink/40 md:inline">
          {settings.demoMode ? "Demo data enabled" : "Reading local Riot endpoints"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-mono tabular-nums sm:gap-3">
        {settings.performanceHud ? (
          <>
            <span className="hidden sm:inline" title="HexCoach process memory">
              RAM <span className="text-chrome-ink">{perf.ramMb ? perf.ramMb.toFixed(1) : "—"} MB</span>
            </span>
            <span title="Live Client API request latency">
              API <span className="text-chrome-ink">{perf.liveLatencyMs || live.latencyMs} ms</span>
            </span>
            <span className="hidden sm:inline" title="Cached Data Dragon images">
              IMG{" "}
              <span className="text-chrome-ink/70">
                {ddragon.totalImages
                  ? `${ddragon.cachedImages}/${ddragon.totalImages}`
                  : perf.cachedImages
                    ? `${perf.cachedImages}/${perf.totalImages}`
                    : "—"}
              </span>
            </span>
          </>
        ) : null}
        <span className="text-chrome-ink" title="Data Dragon patch">
          {bootstrap ? shortPatch(bootstrap.version) : perf.patch !== "—" ? shortPatch(perf.patch) : "—"}
        </span>
        <span
          className="border border-hextech-500/40 bg-hextech-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-hextech-300"
          title="Win rates are offline heuristics, not Riot match data"
        >
          EST. META
        </span>
        {appInfo ? <span className="hidden text-chrome-ink/40 lg:inline">{appInfo.buildProfile}</span> : null}
      </div>
    </footer>
  );
}
